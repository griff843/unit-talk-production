/**
 * Phase 6: Autopilot Controller
 * Single authority for publish gating decisions with evidence logging
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

export type AutopilotMode = 'off' | 'log_only' | 'canary' | 'prod';
export type DecisionOutcome = 'approve' | 'reject' | 'unknown';

export interface AutopilotDecisionContext {
  pick_id?: string;
  pick_data: Record<string, any>;
  mode: AutopilotMode;
  slo_snapshot?: Record<string, any>;
  additional_context?: Record<string, any>;
}

export interface AutopilotDecision {
  decision: DecisionOutcome;
  risk_score: number;
  reasons: string[];
  evidence: Record<string, any>;
  can_publish: boolean; // Final authority on whether publishing is allowed
  publish_blocked_reason: string | null;
  mode_at_decision: AutopilotMode;
}

export interface GateEvaluation {
  gate_name: string;
  passed: boolean;
  score: number;
  threshold: number;
  details: Record<string, any>;
}

/**
 * Autopilot Controller
 *
 * CRITICAL PRINCIPLE: This is the SINGLE AUTHORITY for publish permissions.
 * No agent may bypass this controller when publishing to external systems.
 *
 * Guarantees:
 * 1. LOG_ONLY mode has zero side effects (no publishing)
 * 2. All decisions are logged with evidence
 * 3. Fail-closed: UNKNOWN decisions block publishing
 * 4. Mode enforcement is absolute
 */
export class AutopilotController {
  private readonly supabase: SupabaseClient;
  private currentMode: AutopilotMode = 'off';
  private modeChangedAt: Date = new Date();

  constructor(supabase: SupabaseClient, initialMode: AutopilotMode = 'off') {
    this.supabase = supabase;
    this.currentMode = initialMode;
    console.log(`[AutopilotController] Initialized in mode: ${initialMode}`);
  }

  /**
   * Get current autopilot mode
   */
  public getMode(): AutopilotMode {
    return this.currentMode;
  }

  /**
   * Set autopilot mode (admin operation)
   */
  public async setMode(
    newMode: AutopilotMode,
    operator: string,
    reason: string
  ): Promise<void> {
    console.log(`[AutopilotController] Mode change: ${this.currentMode} → ${newMode}`, {
      operator,
      reason,
    });

    const oldMode = this.currentMode;
    this.currentMode = newMode;
    this.modeChangedAt = new Date();

    // Log mode change to database
    await this.supabase.from('autopilot_decisions').insert({
      mode: newMode,
      evaluation_run_id: uuidv4(),
      evaluated_at: new Date().toISOString(),
      pick_data: {
        mode_change: true,
        old_mode: oldMode,
        new_mode: newMode,
        operator,
        reason,
      },
      decision: 'unknown',
      decision_reason: `Mode changed from ${oldMode} to ${newMode} by ${operator}: ${reason}`,
      would_publish: false,
      execution_time_ms: 0,
    });

    console.log(`[AutopilotController] Mode changed successfully to ${newMode}`);
  }

  /**
   * Evaluate pick and return decision
   * This is the core gating function - all publish requests MUST call this
   */
  public async evaluate(context: AutopilotDecisionContext): Promise<AutopilotDecision> {
    const startTime = Date.now();
    const evaluation_run_id = uuidv4();

    console.log(`[AutopilotController] Evaluating pick in mode: ${this.currentMode}`, {
      pick_id: context.pick_id,
    });

    // Initialize decision with fail-closed default
    let decision: DecisionOutcome = 'unknown';
    let risk_score = 100; // Start with max risk
    const reasons: string[] = [];
    const evidence: Record<string, any> = {};

    // Gate 1: Mode check - OFF mode blocks everything
    if (this.currentMode === 'off') {
      reasons.push('Autopilot is OFF');
      const finalDecision = this.buildDecision({
        decision: 'reject',
        risk_score,
        reasons,
        evidence: { mode_check: { passed: false, mode: 'off' } },
        context,
      });

      await this.logDecision(evaluation_run_id, context, finalDecision, Date.now() - startTime);
      return finalDecision;
    }

    // Gate 2: Risk assessment
    const riskEval = await this.evaluateRisk(context.pick_data);
    evidence.risk = riskEval.details;
    risk_score = riskEval.score;

    if (!riskEval.passed) {
      decision = 'reject';
      reasons.push(`Risk check failed (score: ${riskEval.score}/${riskEval.threshold})`);
    }

    // Gate 3: SLO check
    if (context.slo_snapshot) {
      const sloEval = await this.evaluateSLO(context.slo_snapshot);
      evidence.slo = sloEval.details;

      if (!sloEval.passed) {
        decision = 'reject';
        reasons.push('SLO check failed');
      }
    }

    // Gate 4: Data quality
    const qualityEval = await this.evaluateDataQuality(context.pick_data);
    evidence.quality = qualityEval.details;

    if (!qualityEval.passed) {
      decision = 'reject';
      reasons.push('Data quality check failed');
    }

    // Final decision logic
    if (decision === 'unknown' && risk_score < 20) {
      decision = 'approve';
      reasons.push('All gates passed, low risk');
    } else if (decision === 'unknown') {
      decision = 'reject';
      reasons.push(`Moderate risk (${risk_score}), requires manual review`);
    }

    const finalDecision = this.buildDecision({
      decision,
      risk_score,
      reasons,
      evidence,
      context,
    });

    // Log decision
    await this.logDecision(evaluation_run_id, context, finalDecision, Date.now() - startTime);

    return finalDecision;
  }

  /**
   * Check if publishing is allowed
   * This is the choke point - called before ANY external side effect
   */
  public async canPublish(context: AutopilotDecisionContext): Promise<{
    allowed: boolean;
    reason: string;
    decision: AutopilotDecision;
  }> {
    const decision = await this.evaluate(context);

    // LOG_ONLY mode NEVER allows publishing
    if (this.currentMode === 'log_only') {
      return {
        allowed: false,
        reason: 'Autopilot in LOG_ONLY mode - no external writes permitted',
        decision,
      };
    }

    // REJECT or UNKNOWN decisions block publishing
    if (decision.decision !== 'approve') {
      return {
        allowed: false,
        reason: `Autopilot decision: ${decision.decision} (${decision.reasons.join('; ')})`,
        decision,
      };
    }

    // CANARY mode: 25% sampling
    if (this.currentMode === 'canary') {
      const shouldSample = this.deterministicSample(context.pick_data, 0.25);
      if (!shouldSample) {
        return {
          allowed: false,
          reason: 'Autopilot in CANARY mode - pick not sampled for canary',
          decision,
        };
      }
    }

    // All gates passed
    return {
      allowed: true,
      reason: 'All autopilot gates passed',
      decision,
    };
  }

  /**
   * Evaluate risk factors
   */
  private async evaluateRisk(pick_data: Record<string, any>): Promise<GateEvaluation> {
    let score = 0;
    const threshold = 50; // Reject if score >= 50
    const details: Record<string, any> = {};

    // Missing critical fields
    if (!pick_data.player_name || pick_data.player_name === '') {
      score += 100;
      details.missing_player = true;
    }

    if (!pick_data.stat_type || pick_data.stat_type === '') {
      score += 100;
      details.missing_stat_type = true;
    }

    if (pick_data.line === undefined || pick_data.line === null) {
      score += 100;
      details.missing_line = true;
    }

    // Invalid odds
    if (!pick_data.over_odds && !pick_data.under_odds) {
      score += 60;
      details.missing_odds = true;
    }

    if (pick_data.over_odds === 0 || pick_data.under_odds === 0) {
      score += 80;
      details.zero_odds = true;
    }

    // Extreme values
    if (pick_data.over_odds && Math.abs(pick_data.over_odds) > 500) {
      score += 50;
      details.extreme_odds = true;
    }

    if (pick_data.line && pick_data.line > 1000) {
      score += 40;
      details.extreme_line = true;
    }

    // Low confidence
    if (pick_data.confidence && pick_data.confidence < 0.5) {
      score += 30;
      details.low_confidence = true;
    }

    return {
      gate_name: 'risk_assessment',
      passed: score < threshold,
      score,
      threshold,
      details,
    };
  }

  /**
   * Evaluate SLO status
   */
  private async evaluateSLO(slo_snapshot: Record<string, any>): Promise<GateEvaluation> {
    const details: Record<string, any> = {};
    let passed = true;

    // Check overall status
    if (slo_snapshot.overall_status === 'FAIL') {
      passed = false;
      details.overall_fail = true;
    }

    // Check data sources
    if (
      slo_snapshot.data_sources &&
      !slo_snapshot.data_sources.local_postgres &&
      !slo_snapshot.data_sources.supabase
    ) {
      passed = false;
      details.all_datasources_down = true;
    }

    // Check fail count
    if (slo_snapshot.slo_summary && slo_snapshot.slo_summary.fail_count > 2) {
      passed = false;
      details.too_many_failures = slo_snapshot.slo_summary.fail_count;
    }

    return {
      gate_name: 'slo_check',
      passed,
      score: passed ? 0 : 100,
      threshold: 1,
      details,
    };
  }

  /**
   * Evaluate data quality
   */
  private async evaluateDataQuality(pick_data: Record<string, any>): Promise<GateEvaluation> {
    const details: Record<string, any> = {};
    let score = 0;
    const threshold = 50;

    // Check data age if available
    if (pick_data.created_at) {
      const age_minutes = (Date.now() - new Date(pick_data.created_at).getTime()) / 60000;
      if (age_minutes > 60) {
        score += 30;
        details.stale_data = { age_minutes };
      }
    }

    // Check for suspicious patterns
    if (pick_data.line && pick_data.line < 0.1 && pick_data.stat_type !== 'win') {
      score += 25;
      details.suspicious_line = true;
    }

    return {
      gate_name: 'data_quality',
      passed: score < threshold,
      score,
      threshold,
      details,
    };
  }

  /**
   * Build final decision object
   */
  private buildDecision(opts: {
    decision: DecisionOutcome;
    risk_score: number;
    reasons: string[];
    evidence: Record<string, any>;
    context: AutopilotDecisionContext;
  }): AutopilotDecision {
    const { decision, risk_score, reasons, evidence, context } = opts;

    // Determine if publishing is allowed
    let can_publish = false;
    let publish_blocked_reason: string | null = null;

    if (this.currentMode === 'off') {
      publish_blocked_reason = 'Autopilot is OFF';
    } else if (this.currentMode === 'log_only') {
      publish_blocked_reason = 'Autopilot in LOG_ONLY mode (no external writes)';
    } else if (decision === 'reject' || decision === 'unknown') {
      publish_blocked_reason = `Decision: ${decision} (${reasons.join('; ')})`;
    } else if (decision === 'approve') {
      can_publish = true;
    }

    return {
      decision,
      risk_score,
      reasons,
      evidence,
      can_publish,
      publish_blocked_reason,
      mode_at_decision: this.currentMode,
    };
  }

  /**
   * Log decision to database
   */
  private async logDecision(
    evaluation_run_id: string,
    context: AutopilotDecisionContext,
    decision: AutopilotDecision,
    execution_time_ms: number
  ): Promise<void> {
    try {
      const { error } = await this.supabase.from('autopilot_decisions').insert({
        mode: decision.mode_at_decision,
        evaluation_run_id,
        evaluated_at: new Date().toISOString(),
        pick_id: context.pick_id || null,
        pick_data: context.pick_data,
        decision: decision.decision,
        decision_reason: decision.reasons.join('; '),
        risk_score: decision.risk_score,
        risk_factors: decision.evidence.risk || {},
        would_publish: decision.can_publish,
        publish_blocked_reason: decision.publish_blocked_reason,
        slo_snapshot: context.slo_snapshot || null,
        execution_time_ms,
      });

      if (error) {
        console.error('[AutopilotController] Failed to log decision:', error);
      }
    } catch (error) {
      console.error('[AutopilotController] Exception logging decision:', error);
    }
  }

  /**
   * Deterministic sampling for canary mode
   */
  private deterministicSample(pick_data: Record<string, any>, sample_rate: number): boolean {
    // Create deterministic hash from pick data
    const stable_string = JSON.stringify({
      player: pick_data.player_name,
      stat: pick_data.stat_type,
      line: pick_data.line,
    });

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < stable_string.length; i++) {
      const char = stable_string.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Use hash to determine if pick is sampled
    const threshold = Math.abs(hash) % 100;
    return threshold < sample_rate * 100;
  }

  /**
   * Get promotion gate status
   */
  public async getPromotionGateStatus(from_mode: AutopilotMode, to_mode: AutopilotMode): Promise<{
    can_promote: boolean;
    gates: GateEvaluation[];
    requirements_met: boolean;
  }> {
    // This would query autopilot_decisions table for evidence
    // For now, return structure
    return {
      can_promote: false,
      gates: [],
      requirements_met: false,
    };
  }
}
