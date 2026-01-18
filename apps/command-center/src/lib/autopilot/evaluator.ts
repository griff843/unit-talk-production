/**
 * Phase 4: Autopilot Evaluator
 * Main autopilot logic that evaluates picks and makes publishing decisions
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import type {
  AutopilotMode,
  AutopilotDecision,
  AutopilotEvaluationContext,
  PickData,
  SLOSnapshot,
  DecisionOutcome,
} from './types';
import { riskChecker } from './risk-checker';
import { stalenessChecker } from './staleness-checker';
import { decisionLogger } from './decision-logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export class AutopilotEvaluator {
  /**
   * Run autopilot evaluation
   * Finds candidate picks, evaluates each one, and logs decisions
   *
   * In log_only mode:
   * - NO Discord posts
   * - NO state-changing DB writes (except decision logging)
   * - ALL logic executes normally
   */
  async runEvaluation(mode: AutopilotMode = 'log_only'): Promise<{
    success: boolean;
    evaluation_run_id: string;
    decisions: AutopilotDecision[];
    summary: {
      total_evaluated: number;
      approved: number;
      rejected: number;
      unknown: number;
      would_publish: number;
    };
    execution_time_ms: number;
    error?: string;
  }> {
    const startTime = Date.now();
    const evaluation_run_id = uuidv4();

    console.log(`[AutopilotEvaluator] Starting evaluation run ${evaluation_run_id} in mode: ${mode}`);

    try {
      // Step 1: Get SLO snapshot for context
      const sloSnapshot = await this.getSLOSnapshot();

      // Step 2: Get candidate picks for evaluation
      const candidatePicks = await this.getCandidatePicks();

      console.log(`[AutopilotEvaluator] Found ${candidatePicks.length} candidate picks to evaluate`);

      // Step 3: Evaluate each pick
      const context: AutopilotEvaluationContext = {
        mode,
        evaluation_run_id,
        slo_snapshot: sloSnapshot,
        current_time: new Date(),
      };

      const decisions: AutopilotDecision[] = [];

      for (const pick of candidatePicks) {
        const decision = await this.evaluatePick(pick, context);
        decisions.push(decision);
      }

      // Step 4: Log all decisions to database
      if (decisions.length > 0) {
        const logResult = await decisionLogger.logDecisions(decisions);
        if (!logResult.success) {
          console.error('[AutopilotEvaluator] Failed to log decisions:', logResult.error);
        } else {
          console.log(`[AutopilotEvaluator] Successfully logged ${logResult.count} decisions`);
        }
      }

      // Step 5: Calculate summary
      const summary = {
        total_evaluated: decisions.length,
        approved: decisions.filter((d) => d.decision === 'approved').length,
        rejected: decisions.filter((d) => d.decision === 'rejected').length,
        unknown: decisions.filter((d) => d.decision === 'unknown').length,
        would_publish: decisions.filter((d) => d.would_publish).length,
      };

      const execution_time_ms = Date.now() - startTime;

      console.log(`[AutopilotEvaluator] Evaluation complete in ${execution_time_ms}ms:`, summary);

      return {
        success: true,
        evaluation_run_id,
        decisions,
        summary,
        execution_time_ms,
      };
    } catch (error: any) {
      console.error('[AutopilotEvaluator] Evaluation failed:', error);
      return {
        success: false,
        evaluation_run_id,
        decisions: [],
        summary: {
          total_evaluated: 0,
          approved: 0,
          rejected: 0,
          unknown: 0,
          would_publish: 0,
        },
        execution_time_ms: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  /**
   * Evaluate a single pick and return decision
   */
  private async evaluatePick(pick: PickData, context: AutopilotEvaluationContext): Promise<AutopilotDecision> {
    const startTime = Date.now();

    // Step 1: Risk assessment
    const riskResult = await riskChecker.checkRisk(pick);

    // Step 2: Staleness check
    const stalenessResult = await stalenessChecker.checkStaleness(pick);

    // Step 3: Make decision (fail closed: UNKNOWN > PASS)
    let decision: DecisionOutcome = 'unknown';
    let decisionReason = 'Insufficient data for decision';
    let wouldPublish = false;
    let publishChannel: string | null = null;
    let publishBlockedReason: string | null = null;

    // Decision logic
    if (!riskResult.passed) {
      decision = 'rejected';
      decisionReason = `Risk check failed: ${riskResult.risk_factors.map((f) => f.message).join('; ')}`;
    } else if (stalenessResult.is_stale) {
      decision = 'rejected';
      decisionReason = `Staleness check failed: ${stalenessResult.reasons.join('; ')}`;
    } else if (riskResult.risk_score < 20) {
      decision = 'approved';
      decisionReason = `Low risk (score: ${riskResult.risk_score}), data fresh`;
      wouldPublish = true;
      publishChannel = 'discord'; // Would publish to Discord in prod mode
    } else {
      decision = 'unknown';
      decisionReason = `Moderate risk (score: ${riskResult.risk_score}), requires manual review`;
    }

    // Step 4: Check if publishing is blocked by SLO status
    if (wouldPublish && context.slo_snapshot) {
      const sloIssues = this.checkSLOBlockers(context.slo_snapshot);
      if (sloIssues.length > 0) {
        wouldPublish = false;
        publishBlockedReason = `SLO blockers: ${sloIssues.join('; ')}`;
      }
    }

    // Step 5: In log_only mode, NEVER actually publish (even if would_publish=true)
    if (context.mode === 'log_only' && wouldPublish) {
      publishBlockedReason = 'Autopilot in log_only mode (no external writes)';
    }

    const decision_record: AutopilotDecision = {
      mode: context.mode,
      evaluation_run_id: context.evaluation_run_id,
      evaluated_at: new Date().toISOString(),
      pick_id: pick.id || null,
      pick_data: pick,
      decision,
      decision_reason: decisionReason,
      risk_score: riskResult.risk_score,
      risk_factors: riskResult.risk_factors,
      data_age_minutes: stalenessResult.data_age_minutes,
      odds_staleness_minutes: stalenessResult.odds_staleness_minutes,
      is_stale: stalenessResult.is_stale,
      would_publish: wouldPublish,
      publish_channel: publishChannel,
      publish_blocked_reason: publishBlockedReason,
      slo_snapshot: context.slo_snapshot,
      execution_time_ms: Date.now() - startTime,
    };

    return decision_record;
  }

  /**
   * Get candidate picks for autopilot evaluation
   * In log_only mode, we evaluate approved picks from last 24h for testing
   */
  private async getCandidatePicks(): Promise<PickData[]> {
    try {
      // In log_only mode, we'll use raw_props table as candidates for testing
      const { data, error } = await supabase
        .from('raw_props')
        .select('*')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24h
        .order('created_at', { ascending: false })
        .limit(50); // Limit for testing

      if (error) {
        console.error('[AutopilotEvaluator] Error fetching candidate picks:', error);
        return [];
      }

      // Map raw_props to PickData format
      return (data || []).map((prop: any) => ({
        id: prop.id,
        player_name: prop.player_name,
        stat_type: prop.stat_type,
        line: prop.line,
        over_odds: prop.over_odds,
        under_odds: prop.under_odds,
        sport: prop.sport || 'UNKNOWN',
        created_at: prop.created_at,
        confidence: Math.random(), // Simulated confidence for testing
      }));
    } catch (error) {
      console.error('[AutopilotEvaluator] Exception fetching candidate picks:', error);
      return [];
    }
  }

  /**
   * Get current SLO snapshot for decision context
   */
  private async getSLOSnapshot(): Promise<SLOSnapshot> {
    try {
      // Call SLO status API endpoint
      const response = await fetch('http://localhost:3015/api/slo/status');
      if (!response.ok) {
        throw new Error(`SLO API returned ${response.status}`);
      }

      const sloData = await response.json();

      return {
        timestamp: sloData.timestamp,
        overall_status: sloData.overall_status,
        data_sources: sloData.data_sources,
        slo_summary: {
          pass_count: sloData.slos.filter((s: any) => s.status === 'PASS').length,
          fail_count: sloData.slos.filter((s: any) => s.status === 'FAIL').length,
          unknown_count: sloData.slos.filter((s: any) => s.status === 'UNKNOWN').length,
        },
      };
    } catch (error) {
      console.error('[AutopilotEvaluator] Failed to get SLO snapshot:', error);
      // Return degraded snapshot
      return {
        timestamp: new Date().toISOString(),
        overall_status: 'UNKNOWN',
        data_sources: {
          local_postgres: false,
          supabase: false,
        },
        slo_summary: {
          pass_count: 0,
          fail_count: 0,
          unknown_count: 6,
        },
      };
    }
  }

  /**
   * Check if SLO status should block publishing
   */
  private checkSLOBlockers(snapshot: SLOSnapshot): string[] {
    const blockers: string[] = [];

    // Block if overall status is FAIL
    if (snapshot.overall_status === 'FAIL') {
      blockers.push('Overall SLO status is FAIL');
    }

    // Block if both datasources are disconnected
    if (!snapshot.data_sources.local_postgres && !snapshot.data_sources.supabase) {
      blockers.push('Both datasources disconnected');
    }

    // Block if too many SLOs are failing
    if (snapshot.slo_summary.fail_count > 2) {
      blockers.push(`Too many failing SLOs (${snapshot.slo_summary.fail_count})`);
    }

    return blockers;
  }
}

export const autopilotEvaluator = new AutopilotEvaluator();
