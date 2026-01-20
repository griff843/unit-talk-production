/**
 * @fileoverview Pipeline Lag Throttle Playbook
 *
 * Reduces pipeline throughput when processing falls behind.
 * EXECUTABLE: Can toggle AUTOPILOT_MODE to throttle.
 *
 * Part of PR8: Auto-Remediation Playbooks
 *
 * @module services/remediation/playbooks/PipelineLagThrottlePlaybook
 */

import { BasePlaybook } from './BasePlaybook';
import {
  ActionRecord,
  ExecutionContext,
  ExecutionResult,
  ExecutionType,
  PlaybookId,
} from '../types';

// ============================================================================
// PipelineLagThrottlePlaybook Class
// ============================================================================

export class PipelineLagThrottlePlaybook extends BasePlaybook {
  readonly id: PlaybookId = 'PIPELINE_LAG_THROTTLE';
  readonly name = 'Pipeline Lag Throttle';
  readonly description = 'Reduce pipeline throughput when processing falls behind';
  readonly executionType: ExecutionType = 'EXECUTABLE';
  readonly requiredKnobs: string[] = ['AUTOPILOT_MODE'];

  /**
   * Execute the playbook - throttle autopilot to log_only mode
   */
  async execute(context: ExecutionContext, dryRun: boolean): Promise<ExecutionResult> {
    this.logger.info('Executing PIPELINE_LAG_THROTTLE playbook', {
      incidentId: context.incident_id,
      correlationId: context.correlation_id,
      dryRun,
    });

    const actions: ActionRecord[] = [];

    try {
      // Get current autopilot mode
      const currentKnob = await this.knobResolver.resolveKnob('AUTOPILOT_MODE');
      const previousMode = currentKnob.current_value as string;

      // Target mode for throttling
      const targetMode = 'log_only';

      // If already in log_only or off, we're already throttled
      if (previousMode === 'log_only' || previousMode === 'off') {
        this.logger.info('Autopilot already throttled', { currentMode: previousMode });
        actions.push(this.createAction('check_autopilot_mode', true, {
          targetKnob: 'AUTOPILOT_MODE',
          previousValue: previousMode,
          newValue: previousMode,
        }));

        return this.createSuccessResult(actions, dryRun, context);
      }

      // Toggle the knob
      const result = await this.knobResolver.toggleKnob(
        'AUTOPILOT_MODE',
        targetMode,
        `remediation:${context.incident_id}`,
        dryRun
      );

      actions.push(this.createAction('set_autopilot_mode', result.success, {
        targetKnob: 'AUTOPILOT_MODE',
        previousValue: result.previousValue,
        newValue: dryRun ? `${targetMode} (dry run)` : result.newValue,
        error: result.error,
      }));

      if (!result.success) {
        return this.createFailedResult(result.error || 'Failed to toggle autopilot mode', dryRun);
      }

      this.logger.info('Pipeline throttle applied', {
        previousMode,
        newMode: targetMode,
        dryRun,
      });

      return this.createSuccessResult(actions, dryRun, context);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to execute pipeline throttle', { error: errorMessage });

      actions.push(this.createAction('set_autopilot_mode', false, {
        targetKnob: 'AUTOPILOT_MODE',
        error: errorMessage,
      }));

      return this.createFailedResult(errorMessage, dryRun);
    }
  }

  /**
   * Get rollback steps
   */
  getRollbackSteps(context: ExecutionContext): string[] {
    return [
      '1. Check if pipeline lag has resolved',
      '2. If lag is acceptable, restore autopilot mode:',
      '   - Via API: POST /api/admin/autopilot/mode with body { "mode": "prod" }',
      '   - Via RPC: SELECT set_autopilot_mode(\'prod\', \'ops_team\', true, null)',
      '3. Monitor pipeline metrics for 5-10 minutes after restoration',
      '4. If lag returns, keep in throttled mode and investigate root cause',
      '',
      `Incident ID: ${context.incident_id}`,
    ];
  }

  /**
   * Get recommendations if execution is not possible
   */
  getRecommendations(context: ExecutionContext): string[] {
    return [
      '⚠️ PIPELINE LAG DETECTED',
      '',
      '🔧 RECOMMENDED ACTIONS:',
      '',
      '1. Check autopilot mode:',
      '   SELECT * FROM autopilot_mode_config ORDER BY updated_at DESC LIMIT 1;',
      '',
      '2. Manually throttle autopilot:',
      '   POST /api/admin/autopilot/mode',
      '   Body: { "mode": "log_only", "confirm": true }',
      '',
      '3. Check pipeline backlog:',
      '   SELECT COUNT(*) FROM events WHERE processed = false;',
      '   SELECT COUNT(*) FROM bridge_outbox WHERE status = \'pending\';',
      '',
      '4. Monitor after throttling:',
      '   - Watch event processing rate',
      '   - Check worker health',
      '   - Review error logs',
      '',
      `Incident ID: ${context.incident_id}`,
      `Trigger value: ${context.trigger_value}ms (threshold: ${context.trigger_threshold}ms)`,
    ];
  }
}
