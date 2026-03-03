/**
 * LIFECYCLE TRANSITION VALIDATOR
 * Sprint: LIFECYCLE-CONTRACT-LOCK-037
 *
 * Central authority for lifecycle state transitions.
 * All state changes MUST pass through this validator.
 */

import { InvalidTransitionError, InvalidTimestampError } from './errors';

import type {
  LifecycleStage,
  LifecyclePick,
  TransitionContext,
  TransitionResult,
  TransitionDefinition,
  WriterRole,
  LifecycleState,
} from './types';

// ============================================================
// TRANSITION DEFINITIONS
// ============================================================

/**
 * All allowed transitions in the lifecycle FSM.
 * Any transition not listed here is FORBIDDEN.
 */
const ALLOWED_TRANSITIONS: TransitionDefinition[] = [
  // Initial submission
  {
    from: 'DRAFT',
    to: 'SUBMITTED',
    requiredTimestamps: ['created_at', 'placed_at'],
    allowedWriters: ['submitter'],
  },

  // Promotion path
  {
    from: 'SUBMITTED',
    to: 'QUEUED',
    requiredTimestamps: ['promotion_queued_at'],
    allowedWriters: ['promoter'],
  },
  {
    from: 'SUBMITTED',
    to: 'BLOCKED',
    requiredTimestamps: ['blocked_at'],
    allowedWriters: ['promoter'],
  },
  {
    from: 'SUBMITTED',
    to: 'SETTLED',
    requiredTimestamps: ['settled_at'],
    allowedWriters: ['settler'], // Direct settlement without Discord
  },

  // Queue to posting
  {
    from: 'QUEUED',
    to: 'POSTED',
    requiredTimestamps: ['promotion_posted_at'],
    allowedWriters: ['poster'],
  },
  {
    from: 'QUEUED',
    to: 'BLOCKED',
    requiredTimestamps: ['blocked_at'],
    allowedWriters: ['promoter'],
  },
  {
    from: 'QUEUED',
    to: 'FAILED',
    requiredTimestamps: ['failed_at'],
    allowedWriters: ['poster'],
  },

  // Posted to settlement
  {
    from: 'POSTED',
    to: 'SETTLING',
    requiredTimestamps: [],
    allowedWriters: ['settler'],
  },
  {
    from: 'POSTED',
    to: 'SETTLED',
    requiredTimestamps: ['settled_at'],
    allowedWriters: ['settler'],
  },
  {
    from: 'SETTLING',
    to: 'SETTLED',
    requiredTimestamps: ['settled_at'],
    allowedWriters: ['settler'],
  },

  // Blocked recovery
  {
    from: 'BLOCKED',
    to: 'QUEUED',
    requiredTimestamps: ['promotion_queued_at'],
    allowedWriters: ['operator_override'],
  },
  {
    from: 'BLOCKED',
    to: 'CANCELLED',
    requiredTimestamps: [],
    allowedWriters: ['operator_override'],
  },

  // Failed recovery
  {
    from: 'FAILED',
    to: 'QUEUED',
    requiredTimestamps: ['promotion_queued_at'],
    allowedWriters: ['operator_override', 'promoter'],
  },
  {
    from: 'FAILED',
    to: 'CANCELLED',
    requiredTimestamps: [],
    allowedWriters: ['operator_override'],
  },

  // Dispute handling
  {
    from: 'SETTLED',
    to: 'DISPUTED',
    requiredTimestamps: [],
    allowedWriters: ['operator_override'],
  },
  {
    from: 'DISPUTED',
    to: 'SETTLED',
    requiredTimestamps: ['settled_at'],
    allowedWriters: ['settler', 'operator_override'],
  },

  // Void path
  {
    from: 'SETTLED',
    to: 'VOID',
    requiredTimestamps: [],
    allowedWriters: ['settler', 'operator_override'],
  },
  {
    from: 'POSTED',
    to: 'VOID',
    requiredTimestamps: [],
    allowedWriters: ['settler', 'operator_override'],
  },
];

/**
 * Build transition lookup map for O(1) access
 */
const TRANSITION_MAP = new Map<string, TransitionDefinition>();
for (const def of ALLOWED_TRANSITIONS) {
  TRANSITION_MAP.set(`${def.from}->${def.to}`, def);
}

// ============================================================
// STATE DERIVATION
// ============================================================

/**
 * Derive the current lifecycle stage from pick fields
 */
export function deriveLifecycleStage(pick: LifecyclePick): LifecycleStage {
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
 * Build full lifecycle state from pick
 */
export function deriveLifecycleState(pick: LifecyclePick): LifecycleState {
  return {
    stage: deriveLifecycleStage(pick),
    promotionStatus: pick.promotion_status,
    settlementStatus: pick.settlement_status,
    isPosted: pick.posted_to_discord,
    isBlocked: !!pick.blocked_reason,
    blockedReason: pick.blocked_reason,
    isFailed: !!pick.failed_reason,
    failedReason: pick.failed_reason,
    isSettlementFrozen: pick.settlement_frozen ?? false,
  };
}

// ============================================================
// TRANSITION VALIDATION
// ============================================================

/**
 * Check if a transition is allowed
 */
export function isTransitionAllowed(from: LifecycleStage, to: LifecycleStage): boolean {
  return TRANSITION_MAP.has(`${from}->${to}`);
}

/**
 * Get the transition definition if allowed
 */
export function getTransitionDefinition(
  from: LifecycleStage,
  to: LifecycleStage
): TransitionDefinition | null {
  return TRANSITION_MAP.get(`${from}->${to}`) ?? null;
}

/**
 * Assert that a transition is valid.
 * Throws InvalidTransitionError if not.
 */
export function assertTransition(
  currentState: LifecycleStage,
  nextState: LifecycleStage,
  context: TransitionContext
): void {
  const key = `${currentState}->${nextState}`;
  const definition = TRANSITION_MAP.get(key);

  if (!definition) {
    throw new InvalidTransitionError(currentState, nextState, `Transition '${key}' is not allowed`);
  }

  // Check writer is authorized for this transition
  if (!definition.allowedWriters.includes(context.writerRole)) {
    throw new InvalidTransitionError(
      currentState,
      nextState,
      `Writer role '${context.writerRole}' is not authorized for this transition. Allowed: ${definition.allowedWriters.join(', ')}`
    );
  }
}

/**
 * Perform a transition with full validation
 */
export function performTransition(
  pick: LifecyclePick,
  nextState: LifecycleStage,
  context: TransitionContext
): TransitionResult {
  const currentState = deriveLifecycleStage(pick);
  const timestamp = context.timestamp ?? new Date();

  try {
    assertTransition(currentState, nextState, context);

    return {
      success: true,
      fromStage: currentState,
      toStage: nextState,
      timestamp,
    };
  } catch (error) {
    if (error instanceof InvalidTransitionError) {
      return {
        success: false,
        fromStage: currentState,
        toStage: nextState,
        timestamp,
        error: error.toJSON(),
      };
    }
    throw error;
  }
}

// ============================================================
// TIMESTAMP INVARIANTS
// ============================================================

/**
 * Validate timestamp invariants for a pick
 */
export function validateTimestampInvariants(pick: LifecyclePick): void {
  const createdAt = toDate(pick.created_at);

  // promotion_queued_at >= created_at
  if (pick.promotion_queued_at) {
    const queuedAt = toDate(pick.promotion_queued_at);
    if (queuedAt < createdAt) {
      throw new InvalidTimestampError('promotion_queued_at', 'Must be >= created_at');
    }
  }

  // promotion_posted_at >= promotion_queued_at >= created_at
  if (pick.promotion_posted_at) {
    const postedAt = toDate(pick.promotion_posted_at);
    if (postedAt < createdAt) {
      throw new InvalidTimestampError('promotion_posted_at', 'Must be >= created_at');
    }
    if (pick.promotion_queued_at) {
      const queuedAt = toDate(pick.promotion_queued_at);
      if (postedAt < queuedAt) {
        throw new InvalidTimestampError('promotion_posted_at', 'Must be >= promotion_queued_at');
      }
    }
  }

  // settled_at >= created_at
  if (pick.settled_at) {
    const settledAt = toDate(pick.settled_at);
    if (settledAt < createdAt) {
      throw new InvalidTimestampError('settled_at', 'Must be >= created_at');
    }
    // settled_at >= promotion_posted_at (if posted)
    if (pick.promotion_posted_at) {
      const postedAt = toDate(pick.promotion_posted_at);
      if (settledAt < postedAt) {
        throw new InvalidTimestampError('settled_at', 'Must be >= promotion_posted_at');
      }
    }
  }

  // freeze_enforced_at >= settled_at
  if (pick.freeze_enforced_at && pick.settled_at) {
    const freezeAt = toDate(pick.freeze_enforced_at);
    const settledAt = toDate(pick.settled_at);
    if (freezeAt < settledAt) {
      throw new InvalidTimestampError('freeze_enforced_at', 'Must be >= settled_at');
    }
  }
}

// ============================================================
// STATE CONSISTENCY INVARIANTS
// ============================================================

/**
 * Validate state consistency invariants
 */
export function validateStateInvariants(pick: LifecyclePick): void {
  // POSTED_HAS_MESSAGE_ID
  if (pick.posted_to_discord && !pick.discord_message_id) {
    throw new InvalidTimestampError(
      'discord_message_id',
      'Must be set when posted_to_discord is true'
    );
  }

  // SETTLED_HAS_RESULT
  if (pick.settlement_status === 'settled' && !pick.settlement_result) {
    throw new InvalidTimestampError(
      'settlement_result',
      'Must be set when settlement_status is settled'
    );
  }

  // SETTLED_HAS_TIMESTAMP
  if (pick.settlement_status === 'settled' && !pick.settled_at) {
    throw new InvalidTimestampError('settled_at', 'Must be set when settlement_status is settled');
  }
}

/**
 * Validate all invariants
 */
export function validateInvariants(pick: LifecyclePick): void {
  validateTimestampInvariants(pick);
  validateStateInvariants(pick);
}

// ============================================================
// HELPERS
// ============================================================

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Get all allowed transitions from a given state
 */
export function getAllowedTransitionsFrom(state: LifecycleStage): TransitionDefinition[] {
  return ALLOWED_TRANSITIONS.filter(t => t.from === state);
}

/**
 * Get all forbidden transitions (for documentation)
 */
export function getForbiddenTransitions(): Array<{
  from: LifecycleStage;
  to: LifecycleStage;
  reason: string;
}> {
  return [
    { from: 'SETTLED', to: 'CANCELLED', reason: 'Settled picks cannot be cancelled' },
    { from: 'CANCELLED', to: 'SUBMITTED', reason: 'Cancelled is terminal' },
    { from: 'CANCELLED', to: 'QUEUED', reason: 'Cancelled is terminal' },
    { from: 'CANCELLED', to: 'POSTED', reason: 'Cancelled is terminal' },
    { from: 'CANCELLED', to: 'SETTLED', reason: 'Cancelled is terminal' },
    { from: 'POSTED', to: 'SUBMITTED', reason: 'Cannot regress from posted' },
    { from: 'SETTLED', to: 'SUBMITTED', reason: 'Cannot regress from settled' },
    { from: 'SETTLED', to: 'QUEUED', reason: 'Cannot regress from settled' },
    { from: 'SETTLED', to: 'POSTED', reason: 'Cannot regress from settled' },
  ];
}
