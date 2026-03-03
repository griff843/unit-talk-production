/**
 * Temporal Control Client
 *
 * Provides integration between the Agent Control Plane and Temporal workflows.
 * Allows operators to control agent lifecycle through Temporal signals.
 *
 * @module TemporalControlClient
 */

import { SupabaseClient } from '@supabase/supabase-js';

import { Logger } from '../shared/logger/types';
import { AgentDesiredState, AgentCurrentState } from '../temporal/AgentControlPlane';

export interface TemporalWorkerInfo {
  taskQueue: string;
  identity: string;
  isActive: boolean;
  lastPollTime?: string;
}

export interface ControlCommandResult {
  success: boolean;
  agentId: string;
  command: string;
  previousState?: AgentDesiredState;
  newState?: AgentDesiredState;
  error?: string;
  timestamp: string;
}

export interface KillConfirmationResult {
  success: boolean;
  agentId: string;
  confirmationToken?: string;
  expiresAt?: string;
  error?: string;
}

/**
 * Temporal Control Client
 *
 * Provides operator commands for agent lifecycle management.
 */
export class TemporalControlClient {
  private supabase: SupabaseClient;
  private logger: Logger;
  private operatorId: string;

  constructor(supabase: SupabaseClient, logger: Logger, operatorId: string) {
    this.supabase = supabase;
    this.logger = logger;
    this.operatorId = operatorId;
  }

  /**
   * Pause an agent
   *
   * Agent will complete current work but not pick up new work.
   */
  async pauseAgent(agentId: string, reason?: string): Promise<ControlCommandResult> {
    return this.requestStateChange(agentId, 'paused', reason);
  }

  /**
   * Resume a paused agent
   */
  async resumeAgent(agentId: string, reason?: string): Promise<ControlCommandResult> {
    return this.requestStateChange(agentId, 'running', reason);
  }

  /**
   * Stop an agent (graceful)
   *
   * Agent will drain current work then stop.
   */
  async stopAgent(agentId: string, reason?: string): Promise<ControlCommandResult> {
    return this.requestStateChange(agentId, 'stopped', reason);
  }

  /**
   * Request agent drain
   *
   * Agent will complete in-flight work then stop picking up new work.
   */
  async drainAgent(agentId: string, reason?: string): Promise<ControlCommandResult> {
    return this.requestStateChange(agentId, 'draining', reason);
  }

  /**
   * Request kill confirmation token
   *
   * Kill operations require a confirmation token (60s validity) for safety.
   */
  async requestKillConfirmation(
    agentId: string,
    reason: string,
    validitySeconds: number = 60
  ): Promise<KillConfirmationResult> {
    try {
      const { data, error } = await this.supabase.rpc('create_kill_confirmation', {
        p_agent_id: agentId,
        p_requested_by: this.operatorId,
        p_reason: reason,
        p_validity_seconds: validitySeconds,
      });

      if (error) {
        this.logger.error('Failed to create kill confirmation', {
          agentId,
          error: error.message,
        });

        return {
          success: false,
          agentId,
          error: error.message,
        };
      }

      this.logger.warn('Kill confirmation token created', {
        agentId,
        expiresAt: data.expires_at,
        operatorId: this.operatorId,
      });

      return {
        success: true,
        agentId,
        confirmationToken: data.confirmation_token,
        expiresAt: data.expires_at,
      };
    } catch (error) {
      return {
        success: false,
        agentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Confirm kill operation
   *
   * Must provide valid confirmation token from requestKillConfirmation.
   */
  async confirmKill(confirmationToken: string): Promise<ControlCommandResult> {
    try {
      const { data, error } = await this.supabase.rpc('confirm_agent_kill', {
        p_confirmation_token: confirmationToken,
        p_confirmed_by: this.operatorId,
      });

      if (error) {
        this.logger.error('Failed to confirm kill', {
          error: error.message,
        });

        return {
          success: false,
          agentId: 'unknown',
          command: 'kill',
          error: error.message,
          timestamp: new Date().toISOString(),
        };
      }

      if (!data.success) {
        return {
          success: false,
          agentId: 'unknown',
          command: 'kill',
          error: data.error || 'Kill confirmation failed',
          timestamp: new Date().toISOString(),
        };
      }

      this.logger.warn('Agent killed', {
        agentId: data.agent_id,
        killedAt: data.killed_at,
        operatorId: this.operatorId,
      });

      return {
        success: true,
        agentId: data.agent_id,
        command: 'kill',
        newState: 'killed',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        agentId: 'unknown',
        command: 'kill',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get agent status
   */
  async getAgentStatus(agentId: string): Promise<{
    agentId: string;
    desiredState: AgentDesiredState;
    currentState: AgentCurrentState;
    lastHeartbeat: string | null;
    isHealthy: boolean;
  } | null> {
    try {
      const { data, error } = await this.supabase
        .from('agent_registry')
        .select('*')
        .eq('agent_id', agentId)
        .single();

      if (error || !data) {
        return null;
      }

      const heartbeatAge = data.last_heartbeat
        ? Date.now() - new Date(data.last_heartbeat).getTime()
        : Infinity;

      return {
        agentId: data.agent_id,
        desiredState: data.desired_state,
        currentState: data.current_state,
        lastHeartbeat: data.last_heartbeat,
        isHealthy: heartbeatAge < (data.heartbeat_timeout_ms || 30000),
      };
    } catch (error) {
      this.logger.error('Failed to get agent status', {
        agentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * List all registered agents
   */
  async listAgents(): Promise<
    Array<{
      agentId: string;
      agentType: string;
      displayName: string;
      desiredState: AgentDesiredState;
      currentState: AgentCurrentState;
      lastHeartbeat: string | null;
      isHealthy: boolean;
    }>
  > {
    try {
      const { data, error } = await this.supabase
        .from('agent_registry')
        .select('*')
        .order('agent_id');

      if (error || !data) {
        return [];
      }

      return data.map(agent => {
        const heartbeatAge = agent.last_heartbeat
          ? Date.now() - new Date(agent.last_heartbeat).getTime()
          : Infinity;

        return {
          agentId: agent.agent_id,
          agentType: agent.agent_type,
          displayName: agent.display_name,
          desiredState: agent.desired_state,
          currentState: agent.current_state,
          lastHeartbeat: agent.last_heartbeat,
          isHealthy: heartbeatAge < (agent.heartbeat_timeout_ms || 30000),
        };
      });
    } catch (error) {
      this.logger.error('Failed to list agents', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Get agent lifecycle events for audit
   */
  async getLifecycleEvents(
    agentId: string,
    limit: number = 100
  ): Promise<
    Array<{
      eventType: string;
      previousState: string | null;
      newState: string | null;
      requestedBy: string | null;
      reason: string | null;
      timestamp: string;
    }>
  > {
    try {
      const { data, error } = await this.supabase
        .from('agent_lifecycle_events')
        .select('*')
        .eq('agent_id', agentId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error || !data) {
        return [];
      }

      return data.map(event => ({
        eventType: event.event_type,
        previousState: event.previous_state,
        newState: event.new_state,
        requestedBy: event.requested_by,
        reason: event.reason,
        timestamp: event.timestamp,
      }));
    } catch (error) {
      this.logger.error('Failed to get lifecycle events', {
        agentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Get agent metrics snapshots
   */
  async getMetricsSnapshots(
    agentId: string,
    fromTime?: Date,
    limit: number = 100
  ): Promise<
    Array<{
      runCount: number;
      successCount: number;
      failureCount: number;
      avgLatencyMs: number | null;
      p95LatencyMs: number | null;
      backlogSize: number;
      collectedAt: string;
    }>
  > {
    try {
      let query = this.supabase
        .from('agent_metrics_snapshots')
        .select('*')
        .eq('agent_id', agentId)
        .order('collected_at', { ascending: false })
        .limit(limit);

      if (fromTime) {
        query = query.gte('collected_at', fromTime.toISOString());
      }

      const { data, error } = await query;

      if (error || !data) {
        return [];
      }

      return data.map(snapshot => ({
        runCount: snapshot.run_count,
        successCount: snapshot.success_count,
        failureCount: snapshot.failure_count,
        avgLatencyMs: snapshot.avg_latency_ms,
        p95LatencyMs: snapshot.p95_latency_ms,
        backlogSize: snapshot.backlog_size,
        collectedAt: snapshot.collected_at,
      }));
    } catch (error) {
      this.logger.error('Failed to get metrics snapshots', {
        agentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Internal: Request state change
   */
  private async requestStateChange(
    agentId: string,
    desiredState: AgentDesiredState,
    reason?: string
  ): Promise<ControlCommandResult> {
    try {
      const { data, error } = await this.supabase.rpc('request_agent_state_change', {
        p_agent_id: agentId,
        p_desired_state: desiredState,
        p_requested_by: this.operatorId,
        p_reason: reason,
        p_correlation_id: `ctrl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });

      if (error) {
        this.logger.error('Failed to request state change', {
          agentId,
          desiredState,
          error: error.message,
        });

        return {
          success: false,
          agentId,
          command: desiredState,
          error: error.message,
          timestamp: new Date().toISOString(),
        };
      }

      if (!data.success) {
        return {
          success: false,
          agentId,
          command: desiredState,
          error: data.error || data.action_required || 'State change failed',
          timestamp: new Date().toISOString(),
        };
      }

      this.logger.info('Agent state change requested', {
        agentId,
        previousState: data.previous_state,
        newState: data.new_state,
        operatorId: this.operatorId,
      });

      return {
        success: true,
        agentId,
        command: desiredState,
        previousState: data.previous_state,
        newState: data.new_state,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        agentId,
        command: desiredState,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}

/**
 * Factory function to create TemporalControlClient
 */
export function createTemporalControlClient(
  supabase: SupabaseClient,
  logger: Logger,
  operatorId: string
): TemporalControlClient {
  return new TemporalControlClient(supabase, logger, operatorId);
}
