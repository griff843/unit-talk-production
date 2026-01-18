/**
 * Phase 6: Agent Lifecycle Controller
 * Centralized management for agent lifecycle operations
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';

export type LifecycleStatus =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'pausing'
  | 'paused'
  | 'resuming'
  | 'stopping'
  | 'error';

export type DesiredStatus = 'stopped' | 'running' | 'paused';

export interface AgentLifecycleState {
  id: string;
  agent_name: string;
  agent_type: string;
  lifecycle_status: LifecycleStatus;
  desired_status: DesiredStatus;
  started_at: string | null;
  stopped_at: string | null;
  paused_at: string | null;
  resumed_at: string | null;
  last_heartbeat_at: string | null;
  drain_on_pause: boolean;
  drain_timeout_seconds: number;
  max_restart_attempts: number;
  restart_count: number;
  status_reason: string | null;
  last_error: string | null;
  error_count: number;
  version: string | null;
  config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface LifecycleOperation {
  agent_name: string;
  operation: 'start' | 'stop' | 'pause' | 'resume' | 'restart';
  reason?: string;
  drain?: boolean;
  timeout_seconds?: number;
}

export interface AgentHealthSnapshot {
  agent_name: string;
  status: LifecycleStatus;
  desired_status: DesiredStatus;
  uptime_seconds: number | null;
  last_heartbeat_age_seconds: number | null;
  restart_count: number;
  error_count: number;
  is_healthy: boolean;
}

/**
 * Agent Lifecycle Controller
 *
 * Provides centralized lifecycle management for all agents with:
 * - Start/stop/pause/resume controls
 * - Drain behavior for graceful pausing
 * - Heartbeat monitoring
 * - State persistence
 * - Event notification
 */
export class AgentLifecycleController extends EventEmitter {
  private readonly supabase: SupabaseClient;
  private readonly heartbeatIntervalMs: number = 30000; // 30 seconds
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private registeredAgents: Set<string> = new Set();

  constructor(supabase: SupabaseClient) {
    super();
    this.supabase = supabase;
  }

  /**
   * Register agent with lifecycle controller
   */
  public async registerAgent(
    agent_name: string,
    agent_type: string,
    config: Record<string, any> = {}
  ): Promise<void> {
    console.log(`[AgentLifecycleController] Registering agent: ${agent_name}`);

    // Check if agent already exists
    const { data: existing } = await this.supabase
      .from('agent_lifecycle_state')
      .select('*')
      .eq('agent_name', agent_name)
      .single();

    if (!existing) {
      // Create new agent lifecycle state
      const { error } = await this.supabase.from('agent_lifecycle_state').insert({
        agent_name,
        agent_type,
        lifecycle_status: 'stopped',
        desired_status: 'stopped',
        drain_on_pause: config.drain_on_pause ?? true,
        drain_timeout_seconds: config.drain_timeout_seconds ?? 30,
        max_restart_attempts: config.max_restart_attempts ?? 3,
        restart_count: 0,
        error_count: 0,
        config,
      });

      if (error) {
        throw new Error(`Failed to register agent ${agent_name}: ${error.message}`);
      }
    }

    this.registeredAgents.add(agent_name);
    this.emit('agent_registered', { agent_name, agent_type });

    // Start heartbeat monitoring if not already running
    if (!this.heartbeatTimer) {
      this.startHeartbeatMonitoring();
    }
  }

  /**
   * Unregister agent from lifecycle controller
   */
  public async unregisterAgent(agent_name: string): Promise<void> {
    console.log(`[AgentLifecycleController] Unregistering agent: ${agent_name}`);

    this.registeredAgents.delete(agent_name);
    this.emit('agent_unregistered', { agent_name });

    // Stop heartbeat monitoring if no agents registered
    if (this.registeredAgents.size === 0 && this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Start agent
   */
  public async startAgent(agent_name: string, reason?: string): Promise<AgentLifecycleState> {
    console.log(`[AgentLifecycleController] Starting agent: ${agent_name}`, { reason });

    // Update state to starting
    await this.updateLifecycleStatus(agent_name, 'starting', 'running', reason);

    // Emit start event
    this.emit('agent_starting', { agent_name, reason });

    // Update to running (assumes agent handles its own initialization)
    const state = await this.updateLifecycleStatus(agent_name, 'running', 'running');

    await this.updateTimestamp(agent_name, 'started_at');

    this.emit('agent_started', { agent_name });

    return state;
  }

  /**
   * Stop agent
   */
  public async stopAgent(agent_name: string, reason?: string): Promise<AgentLifecycleState> {
    console.log(`[AgentLifecycleController] Stopping agent: ${agent_name}`, { reason });

    // Update state to stopping
    await this.updateLifecycleStatus(agent_name, 'stopping', 'stopped', reason);

    // Emit stop event
    this.emit('agent_stopping', { agent_name, reason });

    // Update to stopped
    const state = await this.updateLifecycleStatus(agent_name, 'stopped', 'stopped');

    await this.updateTimestamp(agent_name, 'stopped_at');

    this.emit('agent_stopped', { agent_name });

    return state;
  }

  /**
   * Pause agent with optional drain behavior
   */
  public async pauseAgent(
    agent_name: string,
    reason?: string,
    drain: boolean = true
  ): Promise<AgentLifecycleState> {
    console.log(`[AgentLifecycleController] Pausing agent: ${agent_name}`, { reason, drain });

    // Get current state
    const currentState = await this.getAgentState(agent_name);

    if (!currentState) {
      throw new Error(`Agent not found: ${agent_name}`);
    }

    if (currentState.lifecycle_status !== 'running') {
      throw new Error(`Agent must be running to pause, current status: ${currentState.lifecycle_status}`);
    }

    // Update state to pausing
    await this.updateLifecycleStatus(agent_name, 'pausing', 'paused', reason);

    // Emit pause event with drain flag
    this.emit('agent_pausing', { agent_name, reason, drain });

    // If drain=true, agent should finish in-flight work before moving to paused
    // This is handled by the agent itself based on the lifecycle event

    if (drain && currentState.drain_on_pause) {
      // Wait for drain timeout, then force to paused
      const timeout = currentState.drain_timeout_seconds * 1000;
      setTimeout(async () => {
        const state = await this.getAgentState(agent_name);
        if (state?.lifecycle_status === 'pausing') {
          console.log(`[AgentLifecycleController] Drain timeout reached for ${agent_name}, forcing to paused`);
          await this.updateLifecycleStatus(agent_name, 'paused', 'paused');
          this.emit('agent_paused', { agent_name, forced: true });
        }
      }, timeout);
    } else {
      // Immediate pause
      const state = await this.updateLifecycleStatus(agent_name, 'paused', 'paused');
      await this.updateTimestamp(agent_name, 'paused_at');
      this.emit('agent_paused', { agent_name });
      return state;
    }

    // Return intermediate state (pausing)
    return (await this.getAgentState(agent_name))!;
  }

  /**
   * Resume agent from paused state
   */
  public async resumeAgent(agent_name: string, reason?: string): Promise<AgentLifecycleState> {
    console.log(`[AgentLifecycleController] Resuming agent: ${agent_name}`, { reason });

    // Get current state
    const currentState = await this.getAgentState(agent_name);

    if (!currentState) {
      throw new Error(`Agent not found: ${agent_name}`);
    }

    if (currentState.lifecycle_status !== 'paused') {
      throw new Error(`Agent must be paused to resume, current status: ${currentState.lifecycle_status}`);
    }

    // Update state to resuming
    await this.updateLifecycleStatus(agent_name, 'resuming', 'running', reason);

    // Emit resume event
    this.emit('agent_resuming', { agent_name, reason });

    // Update to running
    const state = await this.updateLifecycleStatus(agent_name, 'running', 'running');

    await this.updateTimestamp(agent_name, 'resumed_at');

    this.emit('agent_resumed', { agent_name });

    return state;
  }

  /**
   * Restart agent (stop + start)
   */
  public async restartAgent(agent_name: string, reason?: string): Promise<AgentLifecycleState> {
    console.log(`[AgentLifecycleController] Restarting agent: ${agent_name}`, { reason });

    // Increment restart count
    await this.incrementRestartCount(agent_name);

    // Stop agent
    await this.stopAgent(agent_name, `Restart: ${reason || 'manual'}`);

    // Small delay to ensure cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Start agent
    return await this.startAgent(agent_name, `Restart: ${reason || 'manual'}`);
  }

  /**
   * Update heartbeat for agent
   */
  public async updateHeartbeat(
    agent_name: string,
    lifecycle_status?: LifecycleStatus,
    error_message?: string
  ): Promise<void> {
    const updates: any = {
      last_heartbeat_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (lifecycle_status) {
      updates.lifecycle_status = lifecycle_status;
    }

    if (error_message) {
      updates.last_error = error_message;
      // Increment error_count - fetch current state first
      const { data: currentState } = await this.supabase
        .from('agent_lifecycle_state')
        .select('error_count')
        .eq('agent_name', agent_name)
        .single();

      updates.error_count = (currentState?.error_count || 0) + 1;
    }

    await this.supabase
      .from('agent_lifecycle_state')
      .update(updates)
      .eq('agent_name', agent_name);
  }

  /**
   * Get agent lifecycle state
   */
  public async getAgentState(agent_name: string): Promise<AgentLifecycleState | null> {
    const { data, error } = await this.supabase
      .from('agent_lifecycle_state')
      .select('*')
      .eq('agent_name', agent_name)
      .single();

    if (error || !data) {
      return null;
    }

    return data as AgentLifecycleState;
  }

  /**
   * Get all agent states
   */
  public async getAllAgentStates(): Promise<AgentLifecycleState[]> {
    const { data, error } = await this.supabase
      .from('agent_lifecycle_state')
      .select('*')
      .order('agent_name', { ascending: true });

    if (error) {
      console.error('[AgentLifecycleController] Failed to fetch agent states:', error);
      return [];
    }

    return (data || []) as AgentLifecycleState[];
  }

  /**
   * Get agent health snapshot
   */
  public async getAgentHealth(agent_name: string): Promise<AgentHealthSnapshot | null> {
    const state = await this.getAgentState(agent_name);

    if (!state) {
      return null;
    }

    const now = new Date().getTime();
    const uptime_seconds = state.started_at
      ? Math.floor((now - new Date(state.started_at).getTime()) / 1000)
      : null;

    const last_heartbeat_age_seconds = state.last_heartbeat_at
      ? Math.floor((now - new Date(state.last_heartbeat_at).getTime()) / 1000)
      : null;

    const is_healthy =
      state.lifecycle_status === 'running' &&
      state.desired_status === 'running' &&
      last_heartbeat_age_seconds !== null &&
      last_heartbeat_age_seconds < 60; // Healthy if heartbeat within last minute

    return {
      agent_name: state.agent_name,
      status: state.lifecycle_status,
      desired_status: state.desired_status,
      uptime_seconds,
      last_heartbeat_age_seconds,
      restart_count: state.restart_count,
      error_count: state.error_count,
      is_healthy,
    };
  }

  /**
   * Get health summary for all agents
   */
  public async getAllAgentHealth(): Promise<AgentHealthSnapshot[]> {
    const states = await this.getAllAgentStates();

    return Promise.all(
      states.map(async state => {
        return (await this.getAgentHealth(state.agent_name))!;
      })
    );
  }

  /**
   * Private helper: Update lifecycle status
   */
  private async updateLifecycleStatus(
    agent_name: string,
    lifecycle_status: LifecycleStatus,
    desired_status?: DesiredStatus,
    status_reason?: string
  ): Promise<AgentLifecycleState> {
    const updates: any = {
      lifecycle_status,
      updated_at: new Date().toISOString(),
    };

    if (desired_status) {
      updates.desired_status = desired_status;
    }

    if (status_reason) {
      updates.status_reason = status_reason;
    }

    const { data, error } = await this.supabase
      .from('agent_lifecycle_state')
      .update(updates)
      .eq('agent_name', agent_name)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update agent status: ${error.message}`);
    }

    return data as AgentLifecycleState;
  }

  /**
   * Private helper: Update timestamp field
   */
  private async updateTimestamp(
    agent_name: string,
    field: 'started_at' | 'stopped_at' | 'paused_at' | 'resumed_at'
  ): Promise<void> {
    await this.supabase
      .from('agent_lifecycle_state')
      .update({
        [field]: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('agent_name', agent_name);
  }

  /**
   * Private helper: Increment restart count
   */
  private async incrementRestartCount(agent_name: string): Promise<void> {
    const state = await this.getAgentState(agent_name);

    if (state) {
      await this.supabase
        .from('agent_lifecycle_state')
        .update({
          restart_count: state.restart_count + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('agent_name', agent_name);
    }
  }

  /**
   * Start heartbeat monitoring for registered agents
   */
  private startHeartbeatMonitoring(): void {
    console.log('[AgentLifecycleController] Starting heartbeat monitoring');

    this.heartbeatTimer = setInterval(async () => {
      const health = await this.getAllAgentHealth();

      // Check for stale heartbeats
      for (const agentHealth of health) {
        if (
          agentHealth.status === 'running' &&
          agentHealth.last_heartbeat_age_seconds &&
          agentHealth.last_heartbeat_age_seconds > 90
        ) {
          console.warn(
            `[AgentLifecycleController] Agent ${agentHealth.agent_name} has stale heartbeat (${agentHealth.last_heartbeat_age_seconds}s)`
          );

          // Emit warning event
          this.emit('agent_heartbeat_stale', {
            agent_name: agentHealth.agent_name,
            age_seconds: agentHealth.last_heartbeat_age_seconds,
          });

          // If heartbeat is very stale (>5 minutes), mark as error
          if (agentHealth.last_heartbeat_age_seconds > 300) {
            await this.updateLifecycleStatus(
              agentHealth.agent_name,
              'error',
              undefined,
              'Heartbeat timeout'
            );

            this.emit('agent_error', {
              agent_name: agentHealth.agent_name,
              error: 'Heartbeat timeout',
            });
          }
        }
      }
    }, this.heartbeatIntervalMs);
  }

  /**
   * Cleanup and stop monitoring
   */
  public cleanup(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    this.registeredAgents.clear();
    this.removeAllListeners();
  }
}
