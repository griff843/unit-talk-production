/**
 * Agent Control Service
 *
 * RBAC-gated service for agent lifecycle management.
 * Provides secure operator interface for controlling agents.
 *
 * @module AgentControlService
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../shared/logger/types';
import {
  TemporalControlClient,
  ControlCommandResult,
  KillConfirmationResult,
} from './TemporalControlClient';
import { AgentDesiredState, AgentCurrentState } from '../temporal/AgentControlPlane';

/**
 * RBAC Roles for agent control
 */
export enum AgentControlRole {
  VIEWER = 'viewer',          // Can view agent status and metrics
  OPERATOR = 'operator',      // Can pause/resume/stop agents
  ADMIN = 'admin',            // Can kill agents (with confirmation)
  SUPER_ADMIN = 'super_admin' // Can perform emergency operations
}

/**
 * Permissions for agent control operations
 */
export enum AgentControlPermission {
  VIEW_AGENTS = 'view_agents',
  VIEW_METRICS = 'view_metrics',
  VIEW_LIFECYCLE_EVENTS = 'view_lifecycle_events',
  PAUSE_AGENT = 'pause_agent',
  RESUME_AGENT = 'resume_agent',
  STOP_AGENT = 'stop_agent',
  DRAIN_AGENT = 'drain_agent',
  KILL_AGENT = 'kill_agent',
  EMERGENCY_STOP_ALL = 'emergency_stop_all',
}

/**
 * Role to permissions mapping
 */
const ROLE_PERMISSIONS: Record<AgentControlRole, AgentControlPermission[]> = {
  [AgentControlRole.VIEWER]: [
    AgentControlPermission.VIEW_AGENTS,
    AgentControlPermission.VIEW_METRICS,
  ],
  [AgentControlRole.OPERATOR]: [
    AgentControlPermission.VIEW_AGENTS,
    AgentControlPermission.VIEW_METRICS,
    AgentControlPermission.VIEW_LIFECYCLE_EVENTS,
    AgentControlPermission.PAUSE_AGENT,
    AgentControlPermission.RESUME_AGENT,
    AgentControlPermission.STOP_AGENT,
    AgentControlPermission.DRAIN_AGENT,
  ],
  [AgentControlRole.ADMIN]: [
    AgentControlPermission.VIEW_AGENTS,
    AgentControlPermission.VIEW_METRICS,
    AgentControlPermission.VIEW_LIFECYCLE_EVENTS,
    AgentControlPermission.PAUSE_AGENT,
    AgentControlPermission.RESUME_AGENT,
    AgentControlPermission.STOP_AGENT,
    AgentControlPermission.DRAIN_AGENT,
    AgentControlPermission.KILL_AGENT,
  ],
  [AgentControlRole.SUPER_ADMIN]: [
    AgentControlPermission.VIEW_AGENTS,
    AgentControlPermission.VIEW_METRICS,
    AgentControlPermission.VIEW_LIFECYCLE_EVENTS,
    AgentControlPermission.PAUSE_AGENT,
    AgentControlPermission.RESUME_AGENT,
    AgentControlPermission.STOP_AGENT,
    AgentControlPermission.DRAIN_AGENT,
    AgentControlPermission.KILL_AGENT,
    AgentControlPermission.EMERGENCY_STOP_ALL,
  ],
};

export interface OperatorContext {
  userId: string;
  role: AgentControlRole;
  correlationId?: string;
}

export interface AgentInfo {
  agentId: string;
  agentType: string;
  displayName: string;
  desiredState: AgentDesiredState;
  currentState: AgentCurrentState;
  lastHeartbeat: string | null;
  isHealthy: boolean;
}

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  permissionDenied?: boolean;
}

/**
 * Agent Control Service
 *
 * Provides RBAC-gated interface for agent lifecycle management.
 */
export class AgentControlService {
  private supabase: SupabaseClient;
  private logger: Logger;
  private controlClient: TemporalControlClient;
  private operatorContext: OperatorContext;

  constructor(
    supabase: SupabaseClient,
    logger: Logger,
    operatorContext: OperatorContext
  ) {
    this.supabase = supabase;
    this.logger = logger;
    this.operatorContext = operatorContext;
    this.controlClient = new TemporalControlClient(
      supabase,
      logger,
      operatorContext.userId
    );
  }

  /**
   * Check if operator has permission for an action
   */
  private hasPermission(permission: AgentControlPermission): boolean {
    const permissions = ROLE_PERMISSIONS[this.operatorContext.role] || [];
    return permissions.includes(permission);
  }

  /**
   * Log audit event for control operations
   */
  private async auditLog(
    action: string,
    agentId: string,
    result: 'success' | 'failure' | 'denied',
    details?: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.supabase.from('audit_log').insert({
        action: `agent_control.${action}`,
        resource_type: 'agent',
        resource_id: agentId,
        actor_id: this.operatorContext.userId,
        actor_role: this.operatorContext.role,
        result,
        correlation_id: this.operatorContext.correlationId,
        metadata: {
          ...details,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.logger.error('Failed to write audit log', {
        action,
        agentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * List all registered agents
   */
  async listAgents(): Promise<ServiceResult<AgentInfo[]>> {
    if (!this.hasPermission(AgentControlPermission.VIEW_AGENTS)) {
      await this.auditLog('list_agents', '*', 'denied');
      return {
        success: false,
        error: 'Permission denied: VIEW_AGENTS required',
        permissionDenied: true,
      };
    }

    const agents = await this.controlClient.listAgents();
    await this.auditLog('list_agents', '*', 'success', { count: agents.length });

    return {
      success: true,
      data: agents,
    };
  }

  /**
   * Get agent status
   */
  async getAgentStatus(agentId: string): Promise<ServiceResult<AgentInfo>> {
    if (!this.hasPermission(AgentControlPermission.VIEW_AGENTS)) {
      await this.auditLog('get_status', agentId, 'denied');
      return {
        success: false,
        error: 'Permission denied: VIEW_AGENTS required',
        permissionDenied: true,
      };
    }

    const status = await this.controlClient.getAgentStatus(agentId);
    if (!status) {
      await this.auditLog('get_status', agentId, 'failure', { error: 'Agent not found' });
      return {
        success: false,
        error: 'Agent not found',
      };
    }

    await this.auditLog('get_status', agentId, 'success');
    return {
      success: true,
      data: {
        ...status,
        agentType: 'worker',
        displayName: agentId,
      },
    };
  }

  /**
   * Pause an agent
   */
  async pauseAgent(agentId: string, reason?: string): Promise<ServiceResult<ControlCommandResult>> {
    if (!this.hasPermission(AgentControlPermission.PAUSE_AGENT)) {
      await this.auditLog('pause', agentId, 'denied');
      return {
        success: false,
        error: 'Permission denied: PAUSE_AGENT required (operator role or higher)',
        permissionDenied: true,
      };
    }

    const result = await this.controlClient.pauseAgent(agentId, reason);
    await this.auditLog('pause', agentId, result.success ? 'success' : 'failure', {
      reason,
      previousState: result.previousState,
      newState: result.newState,
    });

    return {
      success: result.success,
      data: result,
      error: result.error,
    };
  }

  /**
   * Resume an agent
   */
  async resumeAgent(agentId: string, reason?: string): Promise<ServiceResult<ControlCommandResult>> {
    if (!this.hasPermission(AgentControlPermission.RESUME_AGENT)) {
      await this.auditLog('resume', agentId, 'denied');
      return {
        success: false,
        error: 'Permission denied: RESUME_AGENT required (operator role or higher)',
        permissionDenied: true,
      };
    }

    const result = await this.controlClient.resumeAgent(agentId, reason);
    await this.auditLog('resume', agentId, result.success ? 'success' : 'failure', {
      reason,
      previousState: result.previousState,
      newState: result.newState,
    });

    return {
      success: result.success,
      data: result,
      error: result.error,
    };
  }

  /**
   * Stop an agent (graceful)
   */
  async stopAgent(agentId: string, reason?: string): Promise<ServiceResult<ControlCommandResult>> {
    if (!this.hasPermission(AgentControlPermission.STOP_AGENT)) {
      await this.auditLog('stop', agentId, 'denied');
      return {
        success: false,
        error: 'Permission denied: STOP_AGENT required (operator role or higher)',
        permissionDenied: true,
      };
    }

    const result = await this.controlClient.stopAgent(agentId, reason);
    await this.auditLog('stop', agentId, result.success ? 'success' : 'failure', {
      reason,
      previousState: result.previousState,
      newState: result.newState,
    });

    return {
      success: result.success,
      data: result,
      error: result.error,
    };
  }

  /**
   * Drain an agent
   */
  async drainAgent(agentId: string, reason?: string): Promise<ServiceResult<ControlCommandResult>> {
    if (!this.hasPermission(AgentControlPermission.DRAIN_AGENT)) {
      await this.auditLog('drain', agentId, 'denied');
      return {
        success: false,
        error: 'Permission denied: DRAIN_AGENT required (operator role or higher)',
        permissionDenied: true,
      };
    }

    const result = await this.controlClient.drainAgent(agentId, reason);
    await this.auditLog('drain', agentId, result.success ? 'success' : 'failure', {
      reason,
      previousState: result.previousState,
      newState: result.newState,
    });

    return {
      success: result.success,
      data: result,
      error: result.error,
    };
  }

  /**
   * Request kill confirmation (admin only)
   */
  async requestKillConfirmation(
    agentId: string,
    reason: string
  ): Promise<ServiceResult<KillConfirmationResult>> {
    if (!this.hasPermission(AgentControlPermission.KILL_AGENT)) {
      await this.auditLog('request_kill', agentId, 'denied');
      return {
        success: false,
        error: 'Permission denied: KILL_AGENT required (admin role or higher)',
        permissionDenied: true,
      };
    }

    const result = await this.controlClient.requestKillConfirmation(agentId, reason);
    await this.auditLog('request_kill', agentId, result.success ? 'success' : 'failure', {
      reason,
      expiresAt: result.expiresAt,
    });

    return {
      success: result.success,
      data: result,
      error: result.error,
    };
  }

  /**
   * Confirm kill operation (admin only)
   */
  async confirmKill(confirmationToken: string): Promise<ServiceResult<ControlCommandResult>> {
    if (!this.hasPermission(AgentControlPermission.KILL_AGENT)) {
      await this.auditLog('confirm_kill', 'unknown', 'denied');
      return {
        success: false,
        error: 'Permission denied: KILL_AGENT required (admin role or higher)',
        permissionDenied: true,
      };
    }

    const result = await this.controlClient.confirmKill(confirmationToken);
    await this.auditLog('confirm_kill', result.agentId, result.success ? 'success' : 'failure');

    return {
      success: result.success,
      data: result,
      error: result.error,
    };
  }

  /**
   * Emergency stop all agents (super admin only)
   */
  async emergencyStopAll(reason: string): Promise<ServiceResult<{ agentsStopped: number }>> {
    if (!this.hasPermission(AgentControlPermission.EMERGENCY_STOP_ALL)) {
      await this.auditLog('emergency_stop_all', '*', 'denied');
      return {
        success: false,
        error: 'Permission denied: EMERGENCY_STOP_ALL required (super_admin role only)',
        permissionDenied: true,
      };
    }

    try {
      // Set system-wide emergency stop
      await this.supabase
        .from('system_status')
        .upsert({
          id: 'global',
          emergency_stop: true,
          emergency_stop_reason: reason,
          emergency_stop_by: this.operatorContext.userId,
          emergency_stop_at: new Date().toISOString(),
        });

      // Get all agents and request stop
      const agents = await this.controlClient.listAgents();
      let stoppedCount = 0;

      for (const agent of agents) {
        const result = await this.controlClient.stopAgent(
          agent.agentId,
          `Emergency stop: ${reason}`
        );
        if (result.success) {
          stoppedCount++;
        }
      }

      await this.auditLog('emergency_stop_all', '*', 'success', {
        reason,
        agentsStopped: stoppedCount,
      });

      return {
        success: true,
        data: { agentsStopped: stoppedCount },
      };
    } catch (error) {
      await this.auditLog('emergency_stop_all', '*', 'failure', {
        reason,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Clear emergency stop (super admin only)
   */
  async clearEmergencyStop(): Promise<ServiceResult<void>> {
    if (!this.hasPermission(AgentControlPermission.EMERGENCY_STOP_ALL)) {
      await this.auditLog('clear_emergency_stop', '*', 'denied');
      return {
        success: false,
        error: 'Permission denied: EMERGENCY_STOP_ALL required (super_admin role only)',
        permissionDenied: true,
      };
    }

    try {
      await this.supabase
        .from('system_status')
        .update({
          emergency_stop: false,
          emergency_stop_cleared_by: this.operatorContext.userId,
          emergency_stop_cleared_at: new Date().toISOString(),
        })
        .eq('id', 'global');

      await this.auditLog('clear_emergency_stop', '*', 'success');

      return { success: true };
    } catch (error) {
      await this.auditLog('clear_emergency_stop', '*', 'failure', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get lifecycle events for an agent (audit)
   */
  async getLifecycleEvents(
    agentId: string,
    limit: number = 100
  ): Promise<ServiceResult<Array<{
    eventType: string;
    previousState: string | null;
    newState: string | null;
    requestedBy: string | null;
    reason: string | null;
    timestamp: string;
  }>>> {
    if (!this.hasPermission(AgentControlPermission.VIEW_LIFECYCLE_EVENTS)) {
      await this.auditLog('get_lifecycle_events', agentId, 'denied');
      return {
        success: false,
        error: 'Permission denied: VIEW_LIFECYCLE_EVENTS required',
        permissionDenied: true,
      };
    }

    const events = await this.controlClient.getLifecycleEvents(agentId, limit);
    await this.auditLog('get_lifecycle_events', agentId, 'success', { count: events.length });

    return {
      success: true,
      data: events,
    };
  }

  /**
   * Get metrics snapshots for an agent
   */
  async getMetricsSnapshots(
    agentId: string,
    fromTime?: Date,
    limit: number = 100
  ): Promise<ServiceResult<Array<{
    runCount: number;
    successCount: number;
    failureCount: number;
    avgLatencyMs: number | null;
    p95LatencyMs: number | null;
    backlogSize: number;
    collectedAt: string;
  }>>> {
    if (!this.hasPermission(AgentControlPermission.VIEW_METRICS)) {
      await this.auditLog('get_metrics', agentId, 'denied');
      return {
        success: false,
        error: 'Permission denied: VIEW_METRICS required',
        permissionDenied: true,
      };
    }

    const snapshots = await this.controlClient.getMetricsSnapshots(agentId, fromTime, limit);
    await this.auditLog('get_metrics', agentId, 'success', { count: snapshots.length });

    return {
      success: true,
      data: snapshots,
    };
  }
}

/**
 * Factory function to create AgentControlService
 */
export function createAgentControlService(
  supabase: SupabaseClient,
  logger: Logger,
  operatorContext: OperatorContext
): AgentControlService {
  return new AgentControlService(supabase, logger, operatorContext);
}
