/**
 * @fileoverview SLO Evaluator Stuck Playbook
 *
 * Handles stuck or unresponsive SLO evaluator.
 * EXECUTABLE: Can restart agents and update workflow status.
 *
 * Part of PR8: Auto-Remediation Playbooks
 *
 * @module services/remediation/playbooks/SLOEvaluatorStuckPlaybook
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BasePlaybook } from './BasePlaybook';
import {
  ActionRecord,
  ExecutionContext,
  ExecutionResult,
  ExecutionType,
  PlaybookId,
} from '../types';

// ============================================================================
// SLOEvaluatorStuckPlaybook Class
// ============================================================================

export class SLOEvaluatorStuckPlaybook extends BasePlaybook {
  readonly id: PlaybookId = 'SLO_EVALUATOR_STUCK';
  readonly name = 'SLO Evaluator Stuck';
  readonly description = 'Handle stuck or unresponsive SLO evaluator';
  readonly executionType: ExecutionType = 'EXECUTABLE';
  readonly requiredKnobs: string[] = ['WORKFLOW_STATUS', 'AGENT_ENABLED'];

  private supabase: SupabaseClient;

  constructor() {
    super();
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration for SLOEvaluatorStuckPlaybook');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Execute the playbook - restart stuck SLO evaluator
   */
  async execute(context: ExecutionContext, dryRun: boolean): Promise<ExecutionResult> {
    this.logger.info('Executing SLO_EVALUATOR_STUCK playbook', {
      incidentId: context.incident_id,
      correlationId: context.correlation_id,
      dryRun,
    });

    const actions: ActionRecord[] = [];

    try {
      // Step 1: Check current workflow status
      const workflowStatus = await this.checkWorkflowStatus();
      actions.push(this.createAction('check_workflow_status', true, {
        targetKnob: 'WORKFLOW_STATUS',
        previousValue: workflowStatus,
      }));

      // Step 2: Check agent registry
      const agentStatus = await this.checkAgentStatus();
      actions.push(this.createAction('check_agent_status', true, {
        targetKnob: 'AGENT_ENABLED',
        previousValue: agentStatus,
      }));

      // Step 3: Determine if action is needed
      const needsRestart = this.evaluateRestartNeed(workflowStatus, agentStatus);

      if (!needsRestart) {
        this.logger.info('SLO evaluator appears healthy, no action needed');
        actions.push(this.createAction('evaluate_health', true, {
          newValue: 'healthy, no action needed',
        }));
        return this.createSuccessResult(actions, dryRun, context);
      }

      // Step 4: Perform restart/recovery
      if (dryRun) {
        this.logger.info('DRY RUN: Would restart SLO evaluator workflows', {
          staleWorkflows: workflowStatus.stale,
          disabledAgents: agentStatus.disabled,
        });

        actions.push(this.createAction('restart_evaluator', true, {
          targetKnob: 'WORKFLOW_STATUS',
          newValue: 'Would restart (dry run)',
        }));

        return this.createSuccessResult(actions, dryRun, context);
      }

      // Mark stale workflows for restart
      if (workflowStatus.stale.length > 0) {
        const restartResult = await this.markWorkflowsForRestart(workflowStatus.stale);
        actions.push(this.createAction('mark_workflows_stale', restartResult.success, {
          targetKnob: 'WORKFLOW_STATUS',
          previousValue: workflowStatus.stale,
          newValue: 'terminated',
          error: restartResult.error,
        }));

        if (!restartResult.success) {
          return this.createFailedResult(restartResult.error || 'Failed to restart workflows', dryRun);
        }
      }

      // Re-enable disabled agents if needed
      if (agentStatus.disabled.length > 0) {
        const enableResult = await this.enableAgents(agentStatus.disabled);
        actions.push(this.createAction('enable_agents', enableResult.success, {
          targetKnob: 'AGENT_ENABLED',
          previousValue: agentStatus.disabled,
          newValue: 'enabled',
          error: enableResult.error,
        }));

        if (!enableResult.success) {
          this.logger.warn('Failed to re-enable some agents', { error: enableResult.error });
        }
      }

      // Trigger reconciliation
      const reconcileResult = await this.triggerReconciliation();
      actions.push(this.createAction('trigger_reconciliation', reconcileResult.success, {
        newValue: reconcileResult.reconciled,
        error: reconcileResult.error,
      }));

      this.logger.info('SLO evaluator recovery completed', {
        incidentId: context.incident_id,
        workflowsRestarted: workflowStatus.stale.length,
        agentsEnabled: agentStatus.disabled.length,
      });

      return this.createSuccessResult(actions, dryRun, context);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to execute SLO evaluator recovery', { error: errorMessage });

      actions.push(this.createAction('recovery_failed', false, {
        error: errorMessage,
      }));

      return this.createFailedResult(errorMessage, dryRun);
    }
  }

  /**
   * Check workflow registry for SLO-related workflows
   */
  private async checkWorkflowStatus(): Promise<{
    total: number;
    running: number;
    stale: string[];
    failed: string[];
  }> {
    const { data, error } = await this.supabase
      .from('workflow_registry')
      .select('workflow_id, status, agent_name, last_heartbeat_at')
      .or('agent_name.ilike.%slo%,workflow_type.ilike.%slo%');

    if (error) {
      this.logger.warn('Failed to query workflow registry', { error: error.message });
      return { total: 0, running: 0, stale: [], failed: [] };
    }

    const workflows = data || [];
    const staleThreshold = Date.now() - 5 * 60 * 1000; // 5 minutes

    return {
      total: workflows.length,
      running: workflows.filter(w => w.status === 'running').length,
      stale: workflows
        .filter(w =>
          w.status === 'running' &&
          new Date(w.last_heartbeat_at).getTime() < staleThreshold
        )
        .map(w => w.workflow_id),
      failed: workflows
        .filter(w => w.status === 'failed')
        .map(w => w.workflow_id),
    };
  }

  /**
   * Check agent registry for SLO-related agents
   */
  private async checkAgentStatus(): Promise<{
    total: number;
    enabled: number;
    disabled: string[];
  }> {
    const { data, error } = await this.supabase
      .from('agent_registry')
      .select('agent_name, enabled, status')
      .or('agent_name.ilike.%slo%,agent_name.ilike.%evaluator%');

    if (error) {
      this.logger.warn('Failed to query agent registry', { error: error.message });
      return { total: 0, enabled: 0, disabled: [] };
    }

    const agents = data || [];

    return {
      total: agents.length,
      enabled: agents.filter(a => a.enabled).length,
      disabled: agents.filter(a => !a.enabled).map(a => a.agent_name),
    };
  }

  /**
   * Evaluate if restart is needed
   */
  private evaluateRestartNeed(
    workflowStatus: { stale: string[]; failed: string[] },
    agentStatus: { disabled: string[] }
  ): boolean {
    return (
      workflowStatus.stale.length > 0 ||
      workflowStatus.failed.length > 0 ||
      agentStatus.disabled.length > 0
    );
  }

  /**
   * Mark workflows for restart
   */
  private async markWorkflowsForRestart(
    workflowIds: string[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      for (const workflowId of workflowIds) {
        const { error } = await this.supabase.rpc('unregister_workflow', {
          p_workflow_id: workflowId,
          p_status: 'terminated',
        });

        if (error) {
          this.logger.warn('Failed to unregister workflow', {
            workflowId,
            error: error.message,
          });
        }
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Enable disabled agents
   */
  private async enableAgents(
    agentNames: string[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('agent_registry')
        .update({ enabled: true, updated_at: new Date().toISOString() })
        .in('agent_name', agentNames);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Trigger workflow registry reconciliation
   */
  private async triggerReconciliation(): Promise<{
    success: boolean;
    reconciled: number;
    error?: string;
  }> {
    try {
      const { data, error } = await this.supabase.rpc('reconcile_workflow_registry', {
        p_stale_threshold_seconds: 300, // 5 minutes
      });

      if (error) {
        return { success: false, reconciled: 0, error: error.message };
      }

      return { success: true, reconciled: data || 0 };
    } catch (error) {
      return {
        success: false,
        reconciled: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get rollback steps
   */
  getRollbackSteps(context: ExecutionContext): string[] {
    return [
      '1. Check if SLO evaluation has resumed:',
      '   SELECT * FROM ops.slo_evaluations ORDER BY evaluated_at DESC LIMIT 10;',
      '',
      '2. If evaluator is not running, manually start:',
      '   - Check workflow registry for SLO workflows',
      '   - Verify agent_registry has SLO agents enabled',
      '',
      '3. If issues persist, check for underlying problems:',
      '   - Database connectivity',
      '   - Memory/CPU pressure',
      '   - Temporal worker health',
      '',
      '4. To disable agents again if needed:',
      '   UPDATE agent_registry SET enabled = false WHERE agent_name ILIKE \'%slo%\';',
      '',
      `Incident ID: ${context.incident_id}`,
    ];
  }

  /**
   * Get recommendations if execution is not possible
   */
  getRecommendations(context: ExecutionContext): string[] {
    return [
      '⚠️ SLO EVALUATOR APPEARS STUCK',
      '',
      '🔧 RECOMMENDED ACTIONS:',
      '',
      '1. Check workflow registry:',
      '   SELECT * FROM workflow_registry',
      '   WHERE agent_name ILIKE \'%slo%\'',
      '   ORDER BY last_heartbeat_at DESC;',
      '',
      '2. Check for stale workflows (no heartbeat in 5min):',
      '   SELECT * FROM workflow_registry',
      '   WHERE status = \'running\'',
      '   AND last_heartbeat_at < NOW() - INTERVAL \'5 minutes\';',
      '',
      '3. Manually terminate stale workflows:',
      '   SELECT unregister_workflow(\'<workflow_id>\', \'terminated\');',
      '',
      '4. Check agent registry:',
      '   SELECT * FROM agent_registry WHERE agent_name ILIKE \'%slo%\';',
      '',
      '5. Re-enable agents if disabled:',
      '   UPDATE agent_registry SET enabled = true',
      '   WHERE agent_name ILIKE \'%slo%\';',
      '',
      '6. Trigger reconciliation:',
      '   SELECT reconcile_workflow_registry(300);',
      '',
      `Incident ID: ${context.incident_id}`,
    ];
  }
}
