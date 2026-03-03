/**
 * Agent Control Plane
 *
 * Central enforcement layer for agent lifecycle control.
 * Provides real-time control plane operations that workers use
 * to check desired state and report metrics.
 *
 * @module AgentControlPlane
 */

import { SupabaseClient } from '@supabase/supabase-js';

import { Logger } from '../shared/logger/types';

export type AgentDesiredState = 'stopped' | 'running' | 'paused' | 'draining' | 'killed';
export type AgentCurrentState =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'pausing'
  | 'paused'
  | 'resuming'
  | 'stopping'
  | 'draining'
  | 'error'
  | 'killed';

export interface AgentControlStatus {
  shouldProcess: boolean;
  desiredState: AgentDesiredState;
  currentState: AgentCurrentState;
  systemFreeze: boolean;
  lastHeartbeat: string | null;
  heartbeatTimeoutMs: number;
}

export interface AgentMetrics {
  runCount?: number;
  successCount?: number;
  failureCount?: number;
  avgLatencyMs?: number;
  p95LatencyMs?: number;
  backlogSize?: number;
  eventsProcessed?: number;
  memoryUsageMb?: number;
  cycleTimeMs?: number;
}

export interface HeartbeatResponse {
  shouldProcess: boolean;
  desiredState: AgentDesiredState;
  currentState: AgentCurrentState;
  heartbeatRecorded: boolean;
  timestamp: string;
}

export interface AgentControlPlaneConfig {
  heartbeatIntervalMs: number;
  stateCheckIntervalMs: number;
  drainTimeoutMs: number;
}

const DEFAULT_CONFIG: AgentControlPlaneConfig = {
  heartbeatIntervalMs: 10000,
  stateCheckIntervalMs: 5000,
  drainTimeoutMs: 30000,
};

/**
 * Agent Control Plane Service
 *
 * Provides the enforcement layer for agent lifecycle management.
 * Workers call this service to:
 * 1. Check if they should process work (shouldProcess)
 * 2. Report heartbeat with metrics (updateHeartbeat)
 * 3. Get current control status (getControlStatus)
 */
export class AgentControlPlane {
  private supabase: SupabaseClient;
  private logger: Logger;
  private config: AgentControlPlaneConfig;
  private agentId: string;

  // Local state for fast checks
  private cachedStatus: AgentControlStatus | null = null;
  private lastStatusCheck: number = 0;
  private isDraining: boolean = false;
  private drainStartTime: number | null = null;

  constructor(
    supabase: SupabaseClient,
    logger: Logger,
    agentId: string,
    config: Partial<AgentControlPlaneConfig> = {}
  ) {
    this.supabase = supabase;
    this.logger = logger;
    this.agentId = agentId;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if the agent should process work this cycle
   *
   * This is the PRIMARY enforcement point. Workers MUST call this
   * before each processing cycle.
   *
   * @returns boolean - true if agent should process, false if paused/stopped/killed
   */
  async shouldProcess(): Promise<boolean> {
    try {
      const status = await this.getControlStatus();

      // If draining and timeout exceeded, stop processing
      if (this.isDraining) {
        const drainDuration = Date.now() - (this.drainStartTime || 0);
        if (drainDuration > this.config.drainTimeoutMs) {
          this.logger.warn('Drain timeout exceeded, stopping processing', {
            agentId: this.agentId,
            drainDuration,
            drainTimeoutMs: this.config.drainTimeoutMs,
          });
          return false;
        }
      }

      // Check system freeze first
      if (status.systemFreeze) {
        this.logger.info('System freeze active, pausing processing', {
          agentId: this.agentId,
        });
        return false;
      }

      // Check desired state
      switch (status.desiredState) {
        case 'running':
          this.isDraining = false;
          this.drainStartTime = null;
          return true;

        case 'paused':
          this.logger.info('Agent paused, skipping processing', {
            agentId: this.agentId,
          });
          return false;

        case 'stopped':
          this.logger.info('Agent stopped, skipping processing', {
            agentId: this.agentId,
          });
          return false;

        case 'draining':
          // Start drain tracking if not already
          if (!this.isDraining) {
            this.isDraining = true;
            this.drainStartTime = Date.now();
            this.logger.info('Agent draining started, allowing current work to complete', {
              agentId: this.agentId,
              drainTimeoutMs: this.config.drainTimeoutMs,
            });
          }
          // During drain, still allow processing of in-flight work
          return true;

        case 'killed':
          this.logger.warn('Agent killed, immediately stopping', {
            agentId: this.agentId,
          });
          return false;

        default:
          return true;
      }
    } catch (error) {
      // On error, default to allowing processing (fail-open for availability)
      // but log the error for investigation
      this.logger.error('Failed to check control status, defaulting to allow', {
        agentId: this.agentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return true;
    }
  }

  /**
   * Get the current control status from the database
   *
   * Uses caching to reduce database load while still providing
   * responsive control.
   */
  async getControlStatus(): Promise<AgentControlStatus> {
    const now = Date.now();

    // Return cached status if still valid
    if (this.cachedStatus && now - this.lastStatusCheck < this.config.stateCheckIntervalMs) {
      return this.cachedStatus;
    }

    // Fetch fresh status from database
    const { data, error } = await this.supabase.rpc('get_agent_control_status', {
      p_agent_id: this.agentId,
    });

    if (error) {
      this.logger.error('Failed to get agent control status', {
        agentId: this.agentId,
        error: error.message,
      });

      // Return last known status or default
      if (this.cachedStatus) {
        return this.cachedStatus;
      }

      return {
        shouldProcess: true,
        desiredState: 'running',
        currentState: 'running',
        systemFreeze: false,
        lastHeartbeat: null,
        heartbeatTimeoutMs: 30000,
      };
    }

    // Parse response
    const status: AgentControlStatus = {
      shouldProcess: data.should_process ?? true,
      desiredState: data.desired_state ?? 'running',
      currentState: data.current_state ?? 'running',
      systemFreeze: data.system_freeze ?? false,
      lastHeartbeat: data.last_heartbeat,
      heartbeatTimeoutMs: data.heartbeat_timeout_ms ?? 30000,
    };

    // Update cache
    this.cachedStatus = status;
    this.lastStatusCheck = now;

    return status;
  }

  /**
   * Update agent heartbeat with metrics
   *
   * Workers should call this after each processing cycle to:
   * 1. Report they're still alive
   * 2. Send metrics for observability
   * 3. Receive control instructions
   */
  async updateHeartbeat(
    currentState: AgentCurrentState,
    metrics: AgentMetrics = {}
  ): Promise<HeartbeatResponse> {
    try {
      const { data, error } = await this.supabase.rpc('update_agent_heartbeat', {
        p_agent_id: this.agentId,
        p_current_state: currentState,
        p_metrics: {
          run_count: metrics.runCount ?? 0,
          success_count: metrics.successCount ?? 0,
          failure_count: metrics.failureCount ?? 0,
          avg_latency_ms: metrics.avgLatencyMs,
          backlog_size: metrics.backlogSize ?? 0,
          events_processed: metrics.eventsProcessed ?? 0,
          memory_usage_mb: metrics.memoryUsageMb ?? process.memoryUsage().heapUsed / 1024 / 1024,
        },
      });

      if (error) {
        this.logger.error('Failed to update heartbeat', {
          agentId: this.agentId,
          error: error.message,
        });

        return {
          shouldProcess: true,
          desiredState: 'running',
          currentState,
          heartbeatRecorded: false,
          timestamp: new Date().toISOString(),
        };
      }

      // Parse response
      const response: HeartbeatResponse = {
        shouldProcess: data.should_process ?? true,
        desiredState: data.desired_state ?? 'running',
        currentState: data.current_state ?? currentState,
        heartbeatRecorded: data.heartbeat_recorded ?? true,
        timestamp: data.timestamp ?? new Date().toISOString(),
      };

      // Update local cache from heartbeat response
      if (this.cachedStatus) {
        this.cachedStatus.desiredState = response.desiredState;
        this.cachedStatus.currentState = response.currentState;
        this.cachedStatus.shouldProcess = response.shouldProcess;
        this.cachedStatus.lastHeartbeat = response.timestamp;
      }

      return response;
    } catch (error) {
      this.logger.error('Heartbeat update failed', {
        agentId: this.agentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        shouldProcess: true,
        desiredState: 'running',
        currentState,
        heartbeatRecorded: false,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Report current state transition
   *
   * Called when agent transitions between states for audit trail.
   */
  async reportStateTransition(
    previousState: AgentCurrentState,
    newState: AgentCurrentState,
    reason?: string
  ): Promise<void> {
    try {
      await this.supabase.from('agent_lifecycle_events').insert({
        agent_id: this.agentId,
        event_type: 'state_change_confirmed',
        previous_state: previousState,
        new_state: newState,
        reason,
        metadata: {
          reported_by: 'worker',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.logger.error('Failed to report state transition', {
        agentId: this.agentId,
        previousState,
        newState,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Signal graceful drain completion
   */
  async signalDrainComplete(): Promise<void> {
    try {
      this.isDraining = false;
      this.drainStartTime = null;

      await this.supabase.from('agent_lifecycle_events').insert({
        agent_id: this.agentId,
        event_type: 'drain_completed',
        metadata: {
          drain_duration_ms: Date.now() - (this.drainStartTime || Date.now()),
        },
      });

      // Update current state to stopped
      await this.supabase
        .from('agent_registry')
        .update({
          current_state: 'stopped',
          updated_at: new Date().toISOString(),
        })
        .eq('agent_id', this.agentId);

      this.logger.info('Drain completed', { agentId: this.agentId });
    } catch (error) {
      this.logger.error('Failed to signal drain complete', {
        agentId: this.agentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Check if currently draining
   */
  isDrainingState(): boolean {
    return this.isDraining;
  }

  /**
   * Get agent ID
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * Clear cached status (force fresh fetch)
   */
  clearCache(): void {
    this.cachedStatus = null;
    this.lastStatusCheck = 0;
  }
}

/**
 * Factory function to create AgentControlPlane instance
 */
export function createAgentControlPlane(
  supabase: SupabaseClient,
  logger: Logger,
  agentId: string,
  config?: Partial<AgentControlPlaneConfig>
): AgentControlPlane {
  return new AgentControlPlane(supabase, logger, agentId, config);
}
