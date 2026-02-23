/**
 * LIFECYCLE CONTRACT TYPES
 * Sprint: LIFECYCLE-CONTRACT-LOCK-037
 *
 * Type definitions for the pick lifecycle state machine.
 * These types are the source of truth for all lifecycle operations.
 */

// ============================================================
// STATUS ENUMS
// ============================================================

/**
 * Pick outcome status - final result of the bet
 */
export type PickStatus = 'pending' | 'won' | 'lost' | 'push' | 'void' | 'cancelled';

/**
 * Settlement processing status
 */
export type SettlementStatus = 'pending' | 'settled' | 'void' | 'disputed';

/**
 * Discord promotion status
 */
export type PromotionStatus = 'not_promoted' | 'queued' | 'promoted' | 'failed';

/**
 * Bridge outbox event status
 */
export type OutboxStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Computed lifecycle stage for UI/API
 */
export type LifecycleStage =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'QUEUED'
  | 'POSTED'
  | 'SETTLING'
  | 'SETTLED'
  | 'BLOCKED'
  | 'FAILED'
  | 'CANCELLED'
  | 'DISPUTED'
  | 'VOID';

// ============================================================
// WRITER ROLES
// ============================================================

/**
 * Authorized writer roles for lifecycle field updates
 */
export type WriterRole =
  | 'submitter' // Smart Form
  | 'promoter' // PromotionAgent
  | 'poster' // DiscordPoster
  | 'settler' // SettlementAgent
  | 'operator_override'; // Manual override via RPC

// ============================================================
// ERROR CODES
// ============================================================

/**
 * Blocker codes - why a pick cannot proceed
 */
export type BlockerCode =
  | 'BLOCKED_VALIDATION_FAILED'
  | 'BLOCKED_DUPLICATE'
  | 'BLOCKED_CAPPER_INACTIVE'
  | 'BLOCKED_GAME_STARTED'
  | 'BLOCKED_LINE_STALE'
  | 'BLOCKED_PROMOTION_INELIGIBLE'
  | 'BLOCKED_RATE_LIMITED'
  | 'BLOCKED_AUTOPILOT_FROZEN';

/**
 * Failure codes - why processing failed
 */
export type FailureCode =
  | 'FAILED_DISCORD_API'
  | 'FAILED_DISCORD_PERMISSIONS'
  | 'FAILED_SETTLEMENT_NO_DATA'
  | 'FAILED_SETTLEMENT_CONFLICT'
  | 'FAILED_SETTLEMENT_TIMEOUT'
  | 'FAILED_OUTBOX_PARSE'
  | 'FAILED_OUTBOX_EXHAUSTED';

/**
 * Invalid operation codes
 */
export type InvalidCode =
  | 'INVALID_TRANSITION'
  | 'INVALID_WRITER'
  | 'INVALID_TIMESTAMP'
  | 'INVALID_IDEMPOTENCY'
  | 'INVALID_STATE';

export type LifecycleErrorCode = BlockerCode | FailureCode | InvalidCode;

// ============================================================
// STATE REPRESENTATION
// ============================================================

/**
 * Composite lifecycle state derived from multiple fields
 */
export interface LifecycleState {
  stage: LifecycleStage;
  promotionStatus: PromotionStatus;
  settlementStatus: SettlementStatus;
  isPosted: boolean;
  isBlocked: boolean;
  blockedReason?: string;
  isFailed: boolean;
  failedReason?: string;
  isSettlementFrozen: boolean;
}

/**
 * Minimal pick record for lifecycle operations
 */
export interface LifecyclePick {
  id: string;
  bet_slip_id?: string;
  leg_index?: number;
  status: PickStatus;
  promotion_status: PromotionStatus;
  settlement_status: SettlementStatus;
  posted_to_discord: boolean;
  discord_message_id?: string;
  settlement_result?: 'win' | 'loss' | 'push';
  settlement_frozen?: boolean;
  blocked_reason?: string;
  failed_reason?: string;
  created_at: Date | string;
  placed_at?: Date | string;
  promotion_queued_at?: Date | string;
  promotion_posted_at?: Date | string;
  settled_at?: Date | string;
  blocked_at?: Date | string;
  failed_at?: Date | string;
  freeze_enforced_at?: Date | string;
  meta?: Record<string, unknown>;
}

// ============================================================
// TRANSITION DEFINITIONS
// ============================================================

/**
 * A state transition definition
 */
export interface TransitionDefinition {
  from: LifecycleStage;
  to: LifecycleStage;
  requiredTimestamps: string[];
  allowedWriters: WriterRole[];
}

/**
 * Context for a transition request
 */
export interface TransitionContext {
  pickId: string;
  writerRole: WriterRole;
  reason?: string;
  traceId?: string;
  timestamp?: Date;
}

/**
 * Result of a transition attempt
 */
export interface TransitionResult {
  success: boolean;
  fromStage: LifecycleStage;
  toStage: LifecycleStage;
  timestamp: Date;
  error?: LifecycleError;
}

// ============================================================
// ERROR TYPES
// ============================================================

/**
 * Structured lifecycle error
 */
export interface LifecycleError {
  code: LifecycleErrorCode;
  message: string;
  details?: {
    currentState?: LifecycleStage;
    attemptedState?: LifecycleStage;
    field?: string;
    reason?: string;
    writerRole?: WriterRole;
    allowedWriters?: WriterRole[];
    // Autopilot freeze details
    scope?: string | null;
    incidentId?: string | null;
  };
}

// ============================================================
// FIELD AUTHORITY
// ============================================================

/**
 * Field authority definition - who can write what
 */
export interface FieldAuthority {
  field: string;
  allowedWriters: WriterRole[];
  immutableAfterSet: boolean;
}

// ============================================================
// STUCK DETECTION
// ============================================================

/**
 * Stuck detection thresholds (in minutes)
 */
export interface StuckThresholds {
  submittedToQueued: number; // 5 minutes
  queuedToPosted: number; // 15 minutes
  postedToSettled: number; // 1440 minutes (24 hours)
}

/**
 * Stuck pick with reason
 */
export interface StuckPick {
  pickId: string;
  stage: LifecycleStage;
  stuckSince: Date;
  stuckMinutes: number;
  reason: string;
}

// ============================================================
// TIMELINE
// ============================================================

/**
 * Lifecycle timeline event
 */
export interface TimelineEvent {
  timestamp: Date;
  event: string;
  stage: LifecycleStage;
  writer: WriterRole;
  details?: Record<string, unknown>;
}

/**
 * Complete timeline for a pick
 */
export interface PickTimeline {
  pickId: string;
  events: TimelineEvent[];
  currentStage: LifecycleStage;
}
