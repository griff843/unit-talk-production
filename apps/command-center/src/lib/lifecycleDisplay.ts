/**
 * LIFECYCLE DISPLAY UTILITY
 * Sprint: LIFECYCLE-CONTRACT-LOCK-037
 *
 * Lightweight client-side utility for displaying pick lifecycle state.
 * Mirrors the API's deriveLifecycleStage() for consistent display.
 */

// ============================================================
// LIFECYCLE STAGES
// ============================================================

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
// STAGE COLORS & LABELS
// ============================================================

export const STAGE_COLORS: Record<LifecycleStage, string> = {
  DRAFT: 'bg-slate-500',
  SUBMITTED: 'bg-blue-500',
  QUEUED: 'bg-indigo-500',
  POSTED: 'bg-green-500',
  SETTLING: 'bg-amber-500',
  SETTLED: 'bg-emerald-500',
  BLOCKED: 'bg-red-500',
  FAILED: 'bg-red-600',
  CANCELLED: 'bg-gray-500',
  DISPUTED: 'bg-orange-500',
  VOID: 'bg-gray-400',
};

export const STAGE_LABELS: Record<LifecycleStage, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  QUEUED: 'In Queue',
  POSTED: 'Posted',
  SETTLING: 'Settling',
  SETTLED: 'Settled',
  BLOCKED: 'Blocked',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  DISPUTED: 'Disputed',
  VOID: 'Void',
};

export const STAGE_DESCRIPTIONS: Record<LifecycleStage, string> = {
  DRAFT: 'Pick is being prepared',
  SUBMITTED: 'Pick has been submitted, awaiting promotion',
  QUEUED: 'Pick is queued for Discord posting',
  POSTED: 'Pick has been posted to Discord',
  SETTLING: 'Pick is being settled',
  SETTLED: 'Pick has been settled with final result',
  BLOCKED: 'Pick is blocked - see reason',
  FAILED: 'Pick processing failed - see reason',
  CANCELLED: 'Pick has been cancelled',
  DISPUTED: 'Settlement is being disputed',
  VOID: 'Pick has been voided',
};

// ============================================================
// STAGE DERIVATION
// ============================================================

export interface LifecyclePickData {
  status?: string;
  promotion_status?: string;
  settlement_status?: string;
  posted_to_discord?: boolean;
  discord_message_id?: string;
  blocked_reason?: string;
  failed_reason?: string;
}

/**
 * Derive lifecycle stage from pick data.
 * Mirrors the API's deriveLifecycleStage() for consistent display.
 */
export function deriveLifecycleStage(pick: LifecyclePickData): LifecycleStage {
  // Terminal states first
  if (pick.status === 'cancelled') return 'CANCELLED';
  if (pick.settlement_status === 'void') return 'VOID';
  if (pick.settlement_status === 'disputed') return 'DISPUTED';
  if (pick.settlement_status === 'settled') return 'SETTLED';

  // Blocked state
  if (pick.blocked_reason) return 'BLOCKED';

  // Failed state
  if (pick.failed_reason) return 'FAILED';

  // Posted state
  if (pick.posted_to_discord && pick.discord_message_id) return 'POSTED';

  // Queued state
  if (pick.promotion_status === 'queued') return 'QUEUED';

  // Default to submitted
  return 'SUBMITTED';
}

/**
 * Get the display info for a lifecycle stage
 */
export function getStageDisplay(stage: LifecycleStage): {
  label: string;
  color: string;
  description: string;
} {
  return {
    label: STAGE_LABELS[stage],
    color: STAGE_COLORS[stage],
    description: STAGE_DESCRIPTIONS[stage],
  };
}

/**
 * Get reason text for blocked or failed picks
 */
export function getBlockReason(pick: LifecyclePickData): string | null {
  if (pick.blocked_reason) return pick.blocked_reason;
  if (pick.failed_reason) return pick.failed_reason;
  return null;
}

/**
 * Check if a pick needs attention (blocked or failed)
 */
export function needsAttention(pick: LifecyclePickData): boolean {
  const stage = deriveLifecycleStage(pick);
  return stage === 'BLOCKED' || stage === 'FAILED';
}

/**
 * Check if a pick is in a terminal state
 */
export function isTerminalState(stage: LifecycleStage): boolean {
  return ['SETTLED', 'CANCELLED', 'VOID'].includes(stage);
}

/**
 * Check if a pick is in progress
 */
export function isInProgress(stage: LifecycleStage): boolean {
  return ['SUBMITTED', 'QUEUED', 'POSTED', 'SETTLING'].includes(stage);
}

// ============================================================
// TIMELINE HELPERS
// ============================================================

export interface LifecycleTimestamps {
  created_at?: string;
  placed_at?: string;
  promotion_queued_at?: string;
  promotion_posted_at?: string;
  settled_at?: string;
  blocked_at?: string;
  failed_at?: string;
}

export interface TimelineEvent {
  stage: LifecycleStage;
  timestamp: string;
  label: string;
}

/**
 * Build a timeline of lifecycle events from timestamps
 */
export function buildTimeline(timestamps: LifecycleTimestamps): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  if (timestamps.created_at) {
    events.push({
      stage: 'SUBMITTED',
      timestamp: timestamps.created_at,
      label: 'Submitted',
    });
  }

  if (timestamps.promotion_queued_at) {
    events.push({
      stage: 'QUEUED',
      timestamp: timestamps.promotion_queued_at,
      label: 'Queued for posting',
    });
  }

  if (timestamps.promotion_posted_at) {
    events.push({
      stage: 'POSTED',
      timestamp: timestamps.promotion_posted_at,
      label: 'Posted to Discord',
    });
  }

  if (timestamps.blocked_at) {
    events.push({
      stage: 'BLOCKED',
      timestamp: timestamps.blocked_at,
      label: 'Blocked',
    });
  }

  if (timestamps.failed_at) {
    events.push({
      stage: 'FAILED',
      timestamp: timestamps.failed_at,
      label: 'Failed',
    });
  }

  if (timestamps.settled_at) {
    events.push({
      stage: 'SETTLED',
      timestamp: timestamps.settled_at,
      label: 'Settled',
    });
  }

  // Sort by timestamp
  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return events;
}
