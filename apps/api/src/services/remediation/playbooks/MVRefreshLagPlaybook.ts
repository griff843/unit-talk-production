/* eslint-disable max-lines-per-function */
/**
 * @fileoverview Materialized View Refresh Lag Playbook
 *
 * Handles stale materialized views causing SLO breaches.
 * EXECUTABLE: Uses ops.logged_refresh_mv() infrastructure from PR9.
 *
 * Part of PR8: Auto-Remediation Playbooks
 * Updated in PR9: Go-Live Hardening (MV infrastructure added)
 *
 * @module services/remediation/playbooks/MVRefreshLagPlaybook
 */

import { createClient } from '@supabase/supabase-js';

import {
  ExecutionContext,
  ExecutionResult,
  ExecutionType,
  KnobResolutionResult,
  PlaybookId,
} from '../types';

import { BasePlaybook } from './BasePlaybook';

// ============================================================================
// MVRefreshLagPlaybook Class
// ============================================================================

export class MVRefreshLagPlaybook extends BasePlaybook {
  readonly id: PlaybookId = 'MV_REFRESH_LAG';
  readonly name = 'Materialized View Refresh Lag';
  readonly description = 'Handle stale materialized views causing SLO breaches';
  readonly executionType: ExecutionType = 'EXECUTABLE';
  readonly requiredKnobs: string[] = ['SLO_EVALUATION_ENABLED'];

  /**
   * Check if playbook can execute
   */
  canExecute(knobs: Map<string, KnobResolutionResult>): boolean {
    // Can execute if SLO evaluation is enabled
    const sloKnob = knobs.get('SLO_EVALUATION_ENABLED');
    return sloKnob?.exists === true;
  }

  /**
   * Execute the playbook - refresh the materialized view
   */
  async execute(context: ExecutionContext, dryRun: boolean): Promise<ExecutionResult> {
    this.logger.info('Executing MV_REFRESH_LAG playbook', {
      incidentId: context.incident_id,
      correlationId: context.correlation_id,
      dryRun,
    });

    const startTime = Date.now();
    const actions = [];

    if (dryRun) {
      // Dry run - just return what would be done
      const action = this.createAction('refresh_mv_dry_run', true, {
        newValue: 'Would refresh mv_pipeline_lag_24h',
      });
      actions.push(action);

      return {
        success: true,
        execution_id: '',
        playbook_id: this.id,
        execution_type: 'EXECUTABLE',
        status: 'dry_run',
        actions_taken: actions,
        recommendations: this.getRecommendations(context),
        rollback_steps: this.getRollbackSteps(context),
        duration_ms: Date.now() - startTime,
        dry_run: true,
      };
    }

    // Live execution - call the refresh RPC
    try {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase configuration');
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Call the refresh function
      const { data, error } = await supabase.rpc('refresh_pipeline_lag_materialized_view');

      if (error) {
        throw new Error(`MV refresh failed: ${error.message}`);
      }

      const refreshResult = data?.[0] || data;
      const success = refreshResult?.success === true;

      const action = this.createAction('refresh_mv', success, {
        newValue: {
          view: 'mv_pipeline_lag_24h',
          duration_ms: refreshResult?.duration_ms,
          rows_refreshed: refreshResult?.rows_refreshed,
        },
      });
      actions.push(action);

      if (!success) {
        return {
          success: false,
          execution_id: '',
          playbook_id: this.id,
          execution_type: 'EXECUTABLE',
          status: 'failed',
          actions_taken: actions,
          recommendations: this.getRecommendations(context),
          rollback_steps: [],
          duration_ms: Date.now() - startTime,
          dry_run: false,
          error: refreshResult?.error_message || 'MV refresh failed',
        };
      }

      this.logger.info('MV refresh completed successfully', {
        duration_ms: refreshResult?.duration_ms,
        rows_refreshed: refreshResult?.rows_refreshed,
      });

      return {
        success: true,
        execution_id: '',
        playbook_id: this.id,
        execution_type: 'EXECUTABLE',
        status: 'completed',
        actions_taken: actions,
        recommendations: [],
        rollback_steps: this.getRollbackSteps(context),
        duration_ms: Date.now() - startTime,
        dry_run: false,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error('MV refresh failed', { error: errorMessage });

      const action = this.createAction('refresh_mv', false, {
        newValue: { error: errorMessage },
      });
      actions.push(action);

      return {
        success: false,
        execution_id: '',
        playbook_id: this.id,
        execution_type: 'EXECUTABLE',
        status: 'failed',
        actions_taken: actions,
        recommendations: this.getRecommendations(context),
        rollback_steps: [],
        duration_ms: Date.now() - startTime,
        dry_run: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get rollback steps - MV refresh is generally safe (no data loss)
   */
  getRollbackSteps(_context: ExecutionContext): string[] {
    return [
      'MV refresh is a safe operation - no rollback typically needed',
      'If issues occur, the MV will be refreshed again on next trigger',
      'To manually check MV status: SELECT * FROM ops.v_mv_freshness',
    ];
  }

  /**
   * Get recommendations for manual remediation (fallback if auto fails)
   */
  getRecommendations(context: ExecutionContext): string[] {
    const recommendations: string[] = [
      '⚠️ MATERIALIZED VIEW REFRESH LAG DETECTED',
      '',
      '🔧 MANUAL REMEDIATION (if automatic refresh failed):',
      '',
      '1. Connect to the database:',
      '   docker-compose exec database psql -U postgres',
      '',
      '2. Check MV freshness:',
      '   SELECT * FROM ops.v_mv_freshness;',
      '',
      '3. Manually trigger refresh:',
      "   SELECT * FROM ops.logged_refresh_mv('mv_pipeline_lag_24h', 'manual');",
      '',
      '4. Check refresh history:',
      "   SELECT * FROM ops.get_mv_refresh_history('mv_pipeline_lag_24h', 10);",
      '',
      '📊 INCIDENT DETAILS:',
      `   Incident ID: ${context.incident_id}`,
      `   Triggered by: ${context.triggered_by}`,
    ];

    if (context.trigger_value !== undefined && context.trigger_threshold !== undefined) {
      recommendations.push(
        `   Current lag: ${context.trigger_value}ms (threshold: ${context.trigger_threshold}ms)`
      );
    }

    return recommendations;
  }
}
