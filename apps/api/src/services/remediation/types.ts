/**
 * @fileoverview Remediation System Types
 *
 * Type definitions for PR8: Auto-Remediation Playbooks
 *
 * @module services/remediation/types
 */

// ============================================================================
// Playbook Types
// ============================================================================

export type PlaybookId =
  | 'MV_REFRESH_LAG'
  | 'PIPELINE_LAG_THROTTLE'
  | 'CREDIT_BURN_THROTTLE'
  | 'DISCORD_BACKLOG_NUDGE'
  | 'SLO_EVALUATOR_STUCK';

export type ExecutionType = 'EXECUTABLE' | 'RECOMMENDATION_ONLY';
export type ExecutionStatus = 'pending' | 'approved' | 'executed' | 'failed' | 'skipped' | 'rollback';
export type PlaybookStatus = 'active' | 'disabled' | 'deprecated';

// ============================================================================
// Playbook Definition
// ============================================================================

export interface PlaybookDefinition {
  playbook_id: PlaybookId;
  name: string;
  description: string;
  execution_type: ExecutionType;
  required_knobs: string[];
  default_action: Record<string, unknown>;
  cooldown_seconds: number;
  max_per_hour: number;
  status: PlaybookStatus;
  version: number;
  created_at?: string;
  updated_at?: string;
}

// ============================================================================
// Execution Types
// ============================================================================

export interface ExecutionContext {
  incident_id: string;
  slo_id?: string;
  triggered_by: 'slo_incident' | 'manual' | 'scheduled' | 'cascading';
  trigger_value?: number;
  trigger_threshold?: number;
  evidence: Record<string, unknown>;
  correlation_id: string;
  environment: string;
}

export interface ExecutionResult {
  success: boolean;
  execution_id: string;
  playbook_id: PlaybookId;
  execution_type: ExecutionType;
  status: ExecutionStatus;
  actions_taken: ActionRecord[];
  recommendations?: string[];
  rollback_steps?: string[];
  error?: string;
  duration_ms: number;
  dry_run: boolean;
}

export interface ActionRecord {
  action_type: string;
  target_knob?: string;
  previous_value?: unknown;
  new_value?: unknown;
  timestamp: string;
  success: boolean;
  error?: string;
}

// ============================================================================
// Execution Record (Database)
// ============================================================================

export interface ExecutionRecord {
  execution_id: string;
  playbook_id: PlaybookId;
  incident_id: string;
  correlation_id: string;
  execution_key: string;
  status: ExecutionStatus;
  execution_type: ExecutionType;
  triggered_by: string;
  trigger_value?: number;
  trigger_threshold?: number;
  dry_run: boolean;
  actions_taken: ActionRecord[];
  recommendations?: string[];
  rollback_steps?: string[];
  error_message?: string;
  approved_by?: string;
  approved_at?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Knob Types
// ============================================================================

export type KnobType =
  | 'EXECUTABLE'       // Can be toggled programmatically
  | 'ENV_VAR'          // Environment variable (read-only at runtime)
  | 'RECOMMENDATION_ONLY' // No programmatic toggle available
  | 'DERIVED';         // Auto-computed based on other knobs

export interface KnobDefinition {
  knob_id: string;
  name: string;
  type: KnobType;
  location: string;        // File path or table name
  description: string;
  current_value?: unknown;
  safe_to_toggle: boolean;
  requires_restart: boolean;
  toggle_function?: string; // RPC or API endpoint
}

export interface KnobResolutionResult {
  knob_id: string;
  exists: boolean;
  type: KnobType;
  current_value?: unknown;
  can_execute: boolean;
  reason?: string;
}

// ============================================================================
// Configuration
// ============================================================================

export interface RemediationConfig {
  // Feature flags
  enabled: boolean;
  dry_run_only: boolean;
  require_approval: boolean;

  // Rate limiting
  global_max_per_hour: number;
  cooldown_between_runs_seconds: number;

  // Execution settings
  max_concurrent_executions: number;
  execution_timeout_seconds: number;

  // Notification settings
  notify_on_execution: boolean;
  notify_on_recommendation: boolean;
  discord_channel_id?: string;

  // Environment
  environment: string;
  command_center_url: string;
}

// ============================================================================
// Playbook Interface
// ============================================================================

export interface IPlaybook {
  readonly id: PlaybookId;
  readonly name: string;
  readonly description: string;
  readonly executionType: ExecutionType;
  readonly requiredKnobs: string[];

  /**
   * Check if this playbook can execute given current knob availability
   */
  canExecute(knobs: Map<string, KnobResolutionResult>): boolean;

  /**
   * Execute the playbook actions
   */
  execute(context: ExecutionContext, dryRun: boolean): Promise<ExecutionResult>;

  /**
   * Get rollback steps for this playbook
   */
  getRollbackSteps(context: ExecutionContext): string[];

  /**
   * Get recommendations when execution is not possible
   */
  getRecommendations(context: ExecutionContext): string[];
}

// ============================================================================
// Engine Interface
// ============================================================================

export interface IRemediationEngine {
  /**
   * Execute a playbook for an incident
   */
  executePlaybook(
    playbookId: PlaybookId,
    context: ExecutionContext,
    options?: { dryRun?: boolean; skipApproval?: boolean }
  ): Promise<ExecutionResult>;

  /**
   * Get pending remediations awaiting approval
   */
  getPendingRemediations(): Promise<ExecutionRecord[]>;

  /**
   * Approve a pending remediation
   */
  approveRemediation(executionId: string, approvedBy: string): Promise<ExecutionResult>;

  /**
   * Get execution history
   */
  getExecutionHistory(options?: {
    playbookId?: PlaybookId;
    incidentId?: string;
    limit?: number;
  }): Promise<ExecutionRecord[]>;

  /**
   * Get remediation statistics
   */
  getStats(hoursBack?: number): Promise<RemediationStats>;
}

export interface RemediationStats {
  total_executions: number;
  successful: number;
  failed: number;
  pending_approval: number;
  recommendations_given: number;
  by_playbook: Record<PlaybookId, {
    total: number;
    successful: number;
    failed: number;
    avg_duration_ms: number;
  }>;
}
