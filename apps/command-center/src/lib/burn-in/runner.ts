/**
 * PHASE 5: Burn-In Runner
 *
 * Execution layer for burn-in scheduler.
 * Wires scheduler to REAL implementations (no stubs).
 *
 * @module burn-in/runner
 */

import { AutopilotEvaluator } from '../autopilot/evaluator';
import { evaluateAndGenerateAlerts } from '../slo/evaluator';
import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL_DEV!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY_DEV!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================================================
// TYPES
// ============================================================================

export interface RunnerResult {
  success: boolean;
  task: string;
  duration_ms: number;
  timestamp: string;
  data?: any;
  error?: string;
}

export interface IngestionCheckResult {
  has_recent_data: boolean;
  last_ingestion_at: string | null;
  minutes_since_last: number | null;
  count_last_hour: number;
  status: 'healthy' | 'stale' | 'critical';
}

export interface AutopilotRunResult {
  evaluation_run_id: string;
  total_evaluated: number;
  approved: number;
  rejected: number;
  unknown: number;
  would_publish: number;
  execution_time_ms: number;
}

export interface SLORunResult {
  total_slos: number;
  passing: number;
  failing: number;
  unknown: number;
  alerts_generated: number;
  execution_time_ms: number;
}

// ============================================================================
// BURN-IN RUNNER
// ============================================================================

export class BurnInRunner {
  private autopilotEvaluator: AutopilotEvaluator;

  constructor() {
    this.autopilotEvaluator = new AutopilotEvaluator();
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Run ingestion check (verify recent data exists)
   * Does NOT trigger ingestion - just checks if data is fresh
   */
  async runIngestionCheck(): Promise<RunnerResult> {
    const startTime = Date.now();

    try {
      console.log('[BurnInRunner] Running ingestion check...');

      const result = await this.checkIngestionFreshness();

      return {
        success: result.status !== 'critical',
        task: 'ingestion_check',
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        data: result,
      };
    } catch (error) {
      console.error('[BurnInRunner] Ingestion check failed:', error);

      return {
        success: false,
        task: 'ingestion_check',
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Run autopilot in log_only mode
   * Evaluates picks and logs decisions WITHOUT publishing
   */
  async runAutopilotLogOnly(): Promise<RunnerResult> {
    const startTime = Date.now();

    try {
      console.log('[BurnInRunner] Running autopilot (log_only mode)...');

      // CRITICAL: Enforce log_only mode
      const mode = 'log_only';

      const autopilotResult = await this.autopilotEvaluator.runEvaluation(mode);

      if (!autopilotResult.success) {
        throw new Error(autopilotResult.error || 'Autopilot evaluation failed');
      }

      const result: AutopilotRunResult = {
        evaluation_run_id: autopilotResult.evaluation_run_id,
        total_evaluated: autopilotResult.summary.total_evaluated,
        approved: autopilotResult.summary.approved,
        rejected: autopilotResult.summary.rejected,
        unknown: autopilotResult.summary.unknown,
        would_publish: autopilotResult.summary.would_publish,
        execution_time_ms: autopilotResult.execution_time_ms,
      };

      console.log('[BurnInRunner] Autopilot completed:', result);

      return {
        success: true,
        task: 'autopilot_log_only',
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        data: result,
      };
    } catch (error) {
      console.error('[BurnInRunner] Autopilot failed:', error);

      return {
        success: false,
        task: 'autopilot_log_only',
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Run SLO evaluation and generate alerts
   * Evaluates all SLOs and emits alerts to configured channel (DB only for burn-in)
   */
  async runSLOAndAlerts(): Promise<RunnerResult> {
    const startTime = Date.now();

    try {
      console.log('[BurnInRunner] Running SLO evaluation and alert generation...');

      const sloResult = await evaluateAndGenerateAlerts();

      // evaluateAndGenerateAlerts returns { status: SLOStatusResponse, alerts: Alert[] }
      // SLOStatusResponse has slos array, not evaluations
      const passingCount = (sloResult.status.slos || []).filter(
        e => e.status === 'PASS'
      ).length;
      const failingCount = (sloResult.status.slos || []).filter(
        e => e.status === 'FAIL'
      ).length;
      const unknownCount = (sloResult.status.slos || []).filter(
        e => e.status === 'UNKNOWN'
      ).length;

      const result: SLORunResult = {
        total_slos: (sloResult.status.slos || []).length,
        passing: passingCount,
        failing: failingCount,
        unknown: unknownCount,
        alerts_generated: sloResult.alerts.length,
        execution_time_ms: Date.now() - startTime,
      };

      console.log('[BurnInRunner] SLO evaluation completed:', result);

      return {
        success: true,
        task: 'slo_and_alerts',
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        data: result,
      };
    } catch (error) {
      console.error('[BurnInRunner] SLO evaluation failed:', error);

      return {
        success: false,
        task: 'slo_and_alerts',
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Run full cycle (all tasks in sequence)
   * Returns aggregated results
   */
  async runFullCycle(): Promise<{
    success: boolean;
    cycle_id: string;
    timestamp: string;
    results: {
      ingestion: RunnerResult;
      autopilot: RunnerResult;
      slo: RunnerResult;
    };
    total_duration_ms: number;
  }> {
    const cycleStartTime = Date.now();
    const cycle_id = `cycle_${Date.now()}`;

    console.log(`[BurnInRunner] Starting full burn-in cycle: ${cycle_id}`);

    const ingestionResult = await this.runIngestionCheck();
    const autopilotResult = await this.runAutopilotLogOnly();
    const sloResult = await this.runSLOAndAlerts();

    const allSuccessful =
      ingestionResult.success && autopilotResult.success && sloResult.success;

    const totalDuration = Date.now() - cycleStartTime;

    console.log(
      `[BurnInRunner] Full cycle completed in ${totalDuration}ms. Success: ${allSuccessful}`
    );

    return {
      success: allSuccessful,
      cycle_id,
      timestamp: new Date().toISOString(),
      results: {
        ingestion: ingestionResult,
        autopilot: autopilotResult,
        slo: sloResult,
      },
      total_duration_ms: totalDuration,
    };
  }

  // ==========================================================================
  // INTERNAL HELPERS
  // ==========================================================================

  private async checkIngestionFreshness(): Promise<IngestionCheckResult> {
    // Query local PostgreSQL for most recent raw_props ingestion
    const { data, error } = await supabase
      .from('raw_props')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return {
        has_recent_data: false,
        last_ingestion_at: null,
        minutes_since_last: null,
        count_last_hour: 0,
        status: 'critical',
      };
    }

    const lastIngestionAt = new Date(data.created_at);
    const now = new Date();
    const minutesSinceLast = Math.floor(
      (now.getTime() - lastIngestionAt.getTime()) / (1000 * 60)
    );

    // Get count of records in last hour
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const { count } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo.toISOString());

    let status: 'healthy' | 'stale' | 'critical';
    if (minutesSinceLast < 15) {
      status = 'healthy';
    } else if (minutesSinceLast < 30) {
      status = 'stale';
    } else {
      status = 'critical';
    }

    return {
      has_recent_data: true,
      last_ingestion_at: lastIngestionAt.toISOString(),
      minutes_since_last: minutesSinceLast,
      count_last_hour: count || 0,
      status,
    };
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const burnInRunner = new BurnInRunner();
