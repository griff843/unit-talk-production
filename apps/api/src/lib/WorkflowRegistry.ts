/**
 * WorkflowRegistry - Runtime workflow tracking service
 *
 * Phase 6.5: Centralized workflow ID registry
 *
 * This service provides runtime tracking of Temporal workflows,
 * mapping agent_name → workflow_id for control plane operations.
 *
 * Features:
 * - Register-on-start pattern for new workflows
 * - Heartbeat tracking for long-running workflows
 * - Automatic status updates on stop/complete/fail
 * - Reconciliation with Temporal for stale entries
 */

import { createLogger } from '../utils/logger';
import { supabase as supabaseClient } from '../services/supabaseClient';

// ============================================================================
// Types
// ============================================================================

export type WorkflowStatus =
  | 'starting'
  | 'running'
  | 'paused'
  | 'stopping'
  | 'completed'
  | 'failed'
  | 'terminated'
  | 'stale';

export interface WorkflowRegistration {
  workflow_id: string;
  run_id: string;
  agent_name: string;
  workflow_type: string;
  task_queue?: string;
  metadata?: Record<string, unknown>;
}

export interface RegisteredWorkflow {
  id: string;
  workflow_id: string;
  run_id: string;
  agent_name: string;
  workflow_type: string;
  task_queue?: string;
  status: WorkflowStatus;
  last_heartbeat: string;
  started_at: string;
  stopped_at?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowStats {
  total: number;
  running: number;
  paused: number;
  completed: number;
  failed: number;
  stale: number;
}

// ============================================================================
// WorkflowRegistry Service
// ============================================================================

export class WorkflowRegistry {
  private static instance: WorkflowRegistry;
  private logger: ReturnType<typeof createLogger>;
  private heartbeatIntervalMs: number;
  private staleThresholdMs: number;
  private heartbeatTimers: Map<string, NodeJS.Timeout>;

  private constructor() {
    this.logger = createLogger('WorkflowRegistry');
    this.heartbeatIntervalMs = parseInt(process.env.WORKFLOW_HEARTBEAT_INTERVAL_MS || '30000', 10);
    this.staleThresholdMs = parseInt(process.env.WORKFLOW_STALE_THRESHOLD_MS || '120000', 10);
    this.heartbeatTimers = new Map();

    this.logger.info('WorkflowRegistry initialized', {
      heartbeatIntervalMs: this.heartbeatIntervalMs,
      staleThresholdMs: this.staleThresholdMs
    });
  }

  public static getInstance(): WorkflowRegistry {
    if (!WorkflowRegistry.instance) {
      WorkflowRegistry.instance = new WorkflowRegistry();
    }
    return WorkflowRegistry.instance;
  }

  /**
   * Register a workflow on start
   *
   * Call this when a Temporal workflow starts to track it in the registry.
   */
  public async register(registration: WorkflowRegistration): Promise<string | undefined> {
    this.logger.info('Registering workflow', {
      workflowId: registration.workflow_id,
      runId: registration.run_id,
      agentName: registration.agent_name,
      workflowType: registration.workflow_type
    });

    try {
      const { data, error } = await supabaseClient
        .from('workflow_registry')
        .upsert({
          workflow_id: registration.workflow_id,
          run_id: registration.run_id,
          agent_name: registration.agent_name,
          workflow_type: registration.workflow_type,
          task_queue: registration.task_queue,
          status: 'running',
          last_heartbeat: new Date().toISOString(),
          started_at: new Date().toISOString(),
          metadata: registration.metadata || {}
        }, {
          onConflict: 'workflow_id'
        })
        .select('id')
        .single();

      if (error) {
        this.logger.error('Failed to register workflow', { error: error.message });
        return undefined;
      }

      // Start automatic heartbeat
      this.startHeartbeat(registration.workflow_id);

      this.logger.info('Workflow registered', {
        id: data?.id,
        workflowId: registration.workflow_id
      });

      return data?.id;
    } catch (error) {
      this.logger.error('Error registering workflow', {
        error: error instanceof Error ? error.message : String(error)
      });
      return undefined;
    }
  }

  /**
   * Send heartbeat for a workflow
   */
  public async heartbeat(workflowId: string): Promise<void> {
    try {
      const { error } = await supabaseClient
        .from('workflow_registry')
        .update({
          last_heartbeat: new Date().toISOString(),
          status: 'running'
        })
        .eq('workflow_id', workflowId);

      if (error) {
        this.logger.warn('Failed to update heartbeat', {
          workflowId,
          error: error.message
        });
      }
    } catch (error) {
      this.logger.warn('Error updating heartbeat', {
        workflowId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Unregister a workflow (on stop/complete/fail)
   */
  public async unregister(
    workflowId: string,
    status: 'completed' | 'failed' | 'terminated'
  ): Promise<void> {
    this.logger.info('Unregistering workflow', { workflowId, status });

    // Stop heartbeat timer
    this.stopHeartbeat(workflowId);

    try {
      const { error } = await supabaseClient
        .from('workflow_registry')
        .update({
          status,
          stopped_at: new Date().toISOString(),
          last_heartbeat: new Date().toISOString()
        })
        .eq('workflow_id', workflowId);

      if (error) {
        this.logger.error('Failed to unregister workflow', {
          workflowId,
          error: error.message
        });
      } else {
        this.logger.info('Workflow unregistered', { workflowId, status });
      }
    } catch (error) {
      this.logger.error('Error unregistering workflow', {
        workflowId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Update workflow status
   */
  public async updateStatus(
    workflowId: string,
    status: WorkflowStatus,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      const update: Record<string, unknown> = {
        status,
        last_heartbeat: new Date().toISOString()
      };

      if (metadata) {
        update.metadata = metadata;
      }

      if (status === 'completed' || status === 'failed' || status === 'terminated') {
        update.stopped_at = new Date().toISOString();
        this.stopHeartbeat(workflowId);
      }

      const { error } = await supabaseClient
        .from('workflow_registry')
        .update(update)
        .eq('workflow_id', workflowId);

      if (error) {
        this.logger.warn('Failed to update workflow status', {
          workflowId,
          status,
          error: error.message
        });
      }
    } catch (error) {
      this.logger.warn('Error updating workflow status', {
        workflowId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get all managed workflows
   */
  public async getManagedWorkflows(
    filters?: { agent_name?: string; status?: WorkflowStatus }
  ): Promise<RegisteredWorkflow[]> {
    try {
      let query = supabaseClient
        .from('workflow_registry')
        .select('*')
        .order('started_at', { ascending: false });

      if (filters?.agent_name) {
        query = query.eq('agent_name', filters.agent_name);
      }

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;

      if (error) {
        this.logger.error('Failed to get managed workflows', { error: error.message });
        return [];
      }

      return (data || []) as RegisteredWorkflow[];
    } catch (error) {
      this.logger.error('Error getting managed workflows', {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Get workflow by ID
   */
  public async getWorkflow(workflowId: string): Promise<RegisteredWorkflow | null> {
    try {
      const { data, error } = await supabaseClient
        .from('workflow_registry')
        .select('*')
        .eq('workflow_id', workflowId)
        .single();

      if (error) {
        return null;
      }

      return data as RegisteredWorkflow;
    } catch {
      return null;
    }
  }

  /**
   * Reconcile registry with Temporal
   *
   * Marks workflows as stale if no heartbeat received within threshold.
   * Should be called periodically by a maintenance job.
   */
  public async reconcile(): Promise<{
    checkedCount: number;
    staleCount: number;
    staleWorkflows: string[];
  }> {
    this.logger.info('Starting workflow registry reconciliation');

    try {
      const cutoffTime = new Date(Date.now() - this.staleThresholdMs).toISOString();

      // Get all running workflows with stale heartbeats
      const { data: staleWorkflows, error: queryError } = await supabaseClient
        .from('workflow_registry')
        .select('workflow_id')
        .in('status', ['running', 'starting', 'paused'])
        .lt('last_heartbeat', cutoffTime);

      if (queryError) {
        this.logger.error('Failed to query stale workflows', { error: queryError.message });
        return { checkedCount: 0, staleCount: 0, staleWorkflows: [] };
      }

      const staleIds = (staleWorkflows || []).map(w => w.workflow_id);

      if (staleIds.length > 0) {
        // Mark as stale
        const { error: updateError } = await supabaseClient
          .from('workflow_registry')
          .update({ status: 'stale' })
          .in('workflow_id', staleIds);

        if (updateError) {
          this.logger.error('Failed to mark workflows as stale', { error: updateError.message });
        } else {
          this.logger.warn('Marked workflows as stale', {
            count: staleIds.length,
            workflowIds: staleIds
          });
        }
      }

      // Get total count of checked workflows
      const { count } = await supabaseClient
        .from('workflow_registry')
        .select('*', { count: 'exact', head: true })
        .in('status', ['running', 'starting', 'paused', 'stale']);

      this.logger.info('Workflow registry reconciliation completed', {
        checkedCount: count || 0,
        staleCount: staleIds.length
      });

      return {
        checkedCount: count || 0,
        staleCount: staleIds.length,
        staleWorkflows: staleIds
      };
    } catch (error) {
      this.logger.error('Error during reconciliation', {
        error: error instanceof Error ? error.message : String(error)
      });
      return { checkedCount: 0, staleCount: 0, staleWorkflows: [] };
    }
  }

  /**
   * Get workflow statistics
   */
  public async getStats(): Promise<WorkflowStats> {
    try {
      const { data, error } = await supabaseClient
        .from('workflow_registry')
        .select('status');

      if (error) {
        this.logger.error('Failed to get workflow stats', { error: error.message });
        return { total: 0, running: 0, paused: 0, completed: 0, failed: 0, stale: 0 };
      }

      const stats: WorkflowStats = {
        total: data?.length || 0,
        running: 0,
        paused: 0,
        completed: 0,
        failed: 0,
        stale: 0
      };

      for (const row of data || []) {
        switch (row.status) {
          case 'running':
          case 'starting':
            stats.running++;
            break;
          case 'paused':
            stats.paused++;
            break;
          case 'completed':
            stats.completed++;
            break;
          case 'failed':
          case 'terminated':
            stats.failed++;
            break;
          case 'stale':
            stats.stale++;
            break;
        }
      }

      return stats;
    } catch (error) {
      this.logger.error('Error getting workflow stats', {
        error: error instanceof Error ? error.message : String(error)
      });
      return { total: 0, running: 0, paused: 0, completed: 0, failed: 0, stale: 0 };
    }
  }

  /**
   * Start automatic heartbeat for a workflow
   */
  private startHeartbeat(workflowId: string): void {
    // Clear existing timer if any
    this.stopHeartbeat(workflowId);

    const timer = setInterval(() => {
      this.heartbeat(workflowId);
    }, this.heartbeatIntervalMs);

    this.heartbeatTimers.set(workflowId, timer);
  }

  /**
   * Stop automatic heartbeat for a workflow
   */
  private stopHeartbeat(workflowId: string): void {
    const timer = this.heartbeatTimers.get(workflowId);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(workflowId);
    }
  }

  /**
   * Cleanup all heartbeat timers (for shutdown)
   */
  public cleanup(): void {
    for (const [workflowId, timer] of this.heartbeatTimers) {
      clearInterval(timer);
      this.logger.debug('Stopped heartbeat timer', { workflowId });
    }
    this.heartbeatTimers.clear();
    this.logger.info('WorkflowRegistry cleaned up');
  }
}

// ============================================================================
// Exports
// ============================================================================

export const workflowRegistry = WorkflowRegistry.getInstance();

export default WorkflowRegistry;
