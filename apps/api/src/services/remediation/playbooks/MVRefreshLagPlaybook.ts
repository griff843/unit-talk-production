/**
 * @fileoverview Materialized View Refresh Lag Playbook
 *
 * Handles stale materialized views causing SLO breaches.
 * RECOMMENDATION_ONLY: No automated toggle exists for MV refresh.
 *
 * Part of PR8: Auto-Remediation Playbooks
 *
 * @module services/remediation/playbooks/MVRefreshLagPlaybook
 */

import { BasePlaybook } from './BasePlaybook';
import {
  ActionRecord,
  ExecutionContext,
  ExecutionResult,
  ExecutionType,
  KnobResolutionResult,
  PlaybookId,
} from '../types';

// ============================================================================
// MVRefreshLagPlaybook Class
// ============================================================================

export class MVRefreshLagPlaybook extends BasePlaybook {
  readonly id: PlaybookId = 'MV_REFRESH_LAG';
  readonly name = 'Materialized View Refresh Lag';
  readonly description = 'Handle stale materialized views causing SLO breaches';
  readonly executionType: ExecutionType = 'RECOMMENDATION_ONLY';
  readonly requiredKnobs: string[] = ['SLO_EVALUATION_ENABLED'];

  /**
   * This playbook cannot execute - it's recommendation-only
   */
  canExecute(_knobs: Map<string, KnobResolutionResult>): boolean {
    // Always return false - no automated toggle exists for MV refresh
    return false;
  }

  /**
   * Execute the playbook - returns recommendations only
   */
  async execute(context: ExecutionContext, dryRun: boolean): Promise<ExecutionResult> {
    this.logger.info('Executing MV_REFRESH_LAG playbook (recommendation-only)', {
      incidentId: context.incident_id,
      correlationId: context.correlation_id,
    });

    const recommendations = this.getRecommendations(context);

    // Log the recommendation for audit purposes
    const action = this.createAction('generate_recommendation', true, {
      newValue: recommendations,
    });

    return {
      success: true,
      execution_id: '', // Will be filled by engine
      playbook_id: this.id,
      execution_type: 'RECOMMENDATION_ONLY',
      status: 'skipped',
      actions_taken: [action],
      recommendations,
      rollback_steps: [],
      duration_ms: 0,
      dry_run: dryRun,
    };
  }

  /**
   * Get rollback steps - N/A for recommendation-only playbook
   */
  getRollbackSteps(_context: ExecutionContext): string[] {
    return [];
  }

  /**
   * Get recommendations for manual remediation
   */
  getRecommendations(context: ExecutionContext): string[] {
    const recommendations: string[] = [
      '⚠️ MATERIALIZED VIEW REFRESH LAG DETECTED',
      '',
      '🔧 MANUAL REMEDIATION REQUIRED:',
      '',
      '1. Connect to the database:',
      '   docker-compose exec database psql -U postgres',
      '',
      '2. Check which materialized views are stale:',
      '   SELECT schemaname, matviewname, hasindexes',
      '   FROM pg_matviews',
      '   ORDER BY matviewname;',
      '',
      '3. Refresh the stale materialized views:',
      '   REFRESH MATERIALIZED VIEW CONCURRENTLY <view_name>;',
      '',
      '4. For large views, consider scheduling during low-traffic periods',
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

    recommendations.push(
      '',
      '💡 PREVENTION:',
      '   - Consider implementing scheduled MV refresh jobs',
      '   - Add monitoring for MV staleness',
      '   - Review query patterns that depend on MVs'
    );

    return recommendations;
  }
}
