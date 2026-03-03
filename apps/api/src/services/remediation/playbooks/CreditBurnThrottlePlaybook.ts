/**
 * @fileoverview Credit Burn Throttle Playbook
 *
 * Reduces API usage when approaching credit limits.
 * RECOMMENDATION_ONLY: API quota is in-memory only, no persistent toggle.
 *
 * Part of PR8: Auto-Remediation Playbooks
 *
 * @module services/remediation/playbooks/CreditBurnThrottlePlaybook
 */

import {
  ActionRecord,
  ExecutionContext,
  ExecutionResult,
  ExecutionType,
  KnobResolutionResult,
  PlaybookId,
} from '../types';

import { BasePlaybook } from './BasePlaybook';

// ============================================================================
// CreditBurnThrottlePlaybook Class
// ============================================================================

export class CreditBurnThrottlePlaybook extends BasePlaybook {
  readonly id: PlaybookId = 'CREDIT_BURN_THROTTLE';
  readonly name = 'API Credit Burn Throttle';
  readonly description = 'Reduce API usage when approaching credit limits';
  readonly executionType: ExecutionType = 'RECOMMENDATION_ONLY';
  readonly requiredKnobs: string[] = ['API_QUOTA_THROTTLE'];

  /**
   * This playbook cannot execute - API quota is in-memory only
   */
  canExecute(_knobs: Map<string, KnobResolutionResult>): boolean {
    // API quota throttling is in-memory, no persistent toggle available
    return false;
  }

  /**
   * Execute the playbook - returns recommendations only
   */
  async execute(context: ExecutionContext, dryRun: boolean): Promise<ExecutionResult> {
    this.logger.info('Executing CREDIT_BURN_THROTTLE playbook (recommendation-only)', {
      incidentId: context.incident_id,
      correlationId: context.correlation_id,
    });

    const recommendations = this.getRecommendations(context);

    const action = this.createAction('generate_recommendation', true, {
      newValue: recommendations,
    });

    return {
      success: true,
      execution_id: '',
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
      '🔥 API CREDIT BURN RATE ALERT',
      '',
      '📊 IMMEDIATE ACTIONS:',
      '',
      '1. Check current credit usage:',
      '   SELECT * FROM api_health_status ORDER BY last_checked_at DESC;',
      '',
      '2. Review API call patterns:',
      '   SELECT provider, COUNT(*) as calls, SUM(credits_used) as credits',
      '   FROM api_credit_log',
      "   WHERE created_at > NOW() - INTERVAL '1 hour'",
      '   GROUP BY provider',
      '   ORDER BY credits DESC;',
      '',
      '3. Identify high-volume callers:',
      '   Check apps/api/src/services/APIQuotaCoordinator.ts for throttling',
      '',
      '💡 THROTTLING OPTIONS:',
      '',
      '1. Reduce poll frequency:',
      '   - Increase OPS_POLL_INTERVAL_MS (default: 60000ms)',
      '   - Requires service restart',
      '',
      '2. Reduce API calls per request:',
      '   - Batch requests where possible',
      '   - Cache responses more aggressively',
      '',
      '3. Switch to fallback providers:',
      '   - Check if alternative APIs are available',
      '   - Update provider routing in APIQuotaCoordinator',
      '',
      '4. Contact provider for credit increase:',
      '   - Optimal API: support@optimal-odds.com',
      '   - The Odds API: support@the-odds-api.com',
      '',
      '⚠️ WARNING:',
      '   API quota throttling is IN-MEMORY only in APIQuotaCoordinator.',
      '   There is NO persistent toggle - changes require code modification or restart.',
      '',
      '📋 INCIDENT DETAILS:',
      `   Incident ID: ${context.incident_id}`,
      `   Triggered by: ${context.triggered_by}`,
    ];

    if (context.trigger_value !== undefined && context.trigger_threshold !== undefined) {
      recommendations.push(
        `   Current burn rate: ${context.trigger_value} credits/hour`,
        `   Threshold: ${context.trigger_threshold} credits/hour`
      );
    }

    return recommendations;
  }
}
