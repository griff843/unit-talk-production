/**
 * Agent Control Plane Types
 *
 * Type contracts for the Agent Control Plane system introduced in Phase 1.
 * These types define the state machine and control operations for all agents.
 *
 * @module shared-types/agent-control
 */

// ============================================================
// Agent Lifecycle States
// ============================================================

/**
 * Desired state for an agent (operator-requested)
 */
export type AgentDesiredState =
  | 'stopped'
  | 'running'
  | 'paused'
  | 'draining'
  | 'killed';

/**
 * Current state of an agent (actual runtime state)
 */
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

/**
 * Lifecycle event types recorded in audit trail
 */
export type AgentLifecycleEventType =
  | 'registered'
  | 'started'
  | 'stopped'
  | 'paused'
  | 'resumed'
  | 'heartbeat'
  | 'heartbeat_missed'
  | 'error'
  | 'killed'
  | 'state_change_requested'
  | 'state_change_confirmed'
  | 'drain_started'
  | 'drain_completed';

// ============================================================
// Registry Types
// ============================================================

/**
 * Agent registry row from database
 */
export interface AgentRegistryRow {
  id: string;
  agent_id: string;
  agent_type: string;
  display_name: string;
  description: string | null;
  desired_state: AgentDesiredState;
  current_state: AgentCurrentState;
  last_heartbeat: string | null;
  heartbeat_interval_ms: number;
  heartbeat_timeout_ms: number;
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  state_changed_at: string;
}

/**
 * Agent lifecycle event row from database
 */
export interface AgentLifecycleEventRow {
  id: string;
  agent_id: string;
  event_type: AgentLifecycleEventType;
  previous_state: string | null;
  new_state: string | null;
  requested_by: string | null;
  correlation_id: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  timestamp: string;
}

/**
 * Kill confirmation row from database
 */
export interface KillConfirmationRow {
  id: string;
  agent_id: string;
  confirmation_token: string;
  requested_by: string;
  reason: string;
  created_at: string;
  expires_at: string;
  confirmed_at: string | null;
  status: 'pending' | 'confirmed' | 'expired' | 'cancelled';
}

// ============================================================
// Control Plane Types
// ============================================================

/**
 * Response from shouldProcess() check
 */
export interface ShouldProcessResponse {
  shouldProcess: boolean;
  desiredState: AgentDesiredState;
  currentState: AgentCurrentState;
  systemFreeze: boolean;
  reason?: string;
}

/**
 * Response from updateHeartbeat()
 */
export interface HeartbeatResponse {
  heartbeatRecorded: boolean;
  desiredState: AgentDesiredState;
  currentState: AgentCurrentState;
  shouldProcess: boolean;
  timestamp: string;
}

/**
 * Control status returned by getControlStatus()
 */
export interface AgentControlStatus {
  agentId: string;
  desiredState: AgentDesiredState;
  currentState: AgentCurrentState;
  shouldProcess: boolean;
  systemFreeze: boolean;
  lastHeartbeat: string | null;
  heartbeatTimeoutMs: number;
}

// ============================================================
// Control Service Types
// ============================================================

/**
 * RBAC roles for agent control
 */
export enum AgentControlRole {
  VIEWER = 'viewer',
  OPERATOR = 'operator',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

/**
 * RBAC permissions for agent control
 */
export enum AgentControlPermission {
  VIEW_AGENTS = 'VIEW_AGENTS',
  VIEW_METRICS = 'VIEW_METRICS',
  PAUSE_AGENT = 'PAUSE_AGENT',
  RESUME_AGENT = 'RESUME_AGENT',
  STOP_AGENT = 'STOP_AGENT',
  DRAIN_AGENT = 'DRAIN_AGENT',
  KILL_AGENT = 'KILL_AGENT',
  EMERGENCY_STOP_ALL = 'EMERGENCY_STOP_ALL',
}

/**
 * Operator context for control operations
 */
export interface OperatorContext {
  userId: string;
  role: AgentControlRole;
  correlationId?: string;
}

/**
 * Result of a control operation
 */
export interface ControlOperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  permissionDenied?: boolean;
  auditId?: string;
}

/**
 * Kill confirmation request result
 */
export interface KillConfirmationResult {
  success: boolean;
  data?: {
    confirmationToken: string;
    expiresAt: string;
    agentId: string;
  };
  error?: string;
  permissionDenied?: boolean;
}

// ============================================================
// Instrumentation Types
// ============================================================

/**
 * Aggregated metrics from instrumentation
 */
export interface AgentAggregatedMetrics {
  runCount: number;
  successCount: number;
  failureCount: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  eventsProcessed: number;
  eventsFailed: number;
  backlogSize: number;
}

/**
 * Metrics snapshot for database storage
 */
export interface MetricsSnapshot {
  agentId: string;
  runCount: number;
  successCount: number;
  failureCount: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  backlogSize: number;
  eventsProcessed: number;
  collectedAt: string;
}

// ============================================================
// API Request/Response Types
// ============================================================

/**
 * Control command sent via API
 */
export interface ControlCommand {
  action:
    | 'pause'
    | 'resume'
    | 'stop'
    | 'drain'
    | 'kill_request'
    | 'kill_confirm'
    | 'emergency_stop';
  agentId?: string;
  reason?: string;
  confirmationToken?: string;
}

/**
 * Agent info returned by list endpoint
 */
export interface AgentInfo {
  id: string;
  agentId: string;
  agentType: string;
  displayName: string;
  desiredState: AgentDesiredState;
  currentState: AgentCurrentState;
  lastHeartbeat: string | null;
  isHealthy: boolean;
  stateChangedAt: string;
}

/**
 * Agent summary statistics
 */
export interface AgentSummary {
  total: number;
  running: number;
  paused: number;
  stopped: number;
  error: number;
  killed: number;
}
