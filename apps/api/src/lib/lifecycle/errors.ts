/**
 * LIFECYCLE ERROR CLASSES
 * Sprint: LIFECYCLE-CONTRACT-LOCK-037
 *
 * Typed errors for lifecycle operations.
 */

import type { LifecycleError, LifecycleErrorCode, LifecycleStage, WriterRole } from './types';

/**
 * Base lifecycle error class
 */
export class LifecycleValidationError extends Error {
  public readonly code: LifecycleErrorCode;
  public readonly details: LifecycleError['details'];
  public readonly httpStatus: number;

  constructor(error: LifecycleError, httpStatus: number = 400) {
    super(error.message);
    this.name = 'LifecycleValidationError';
    this.code = error.code;
    this.details = error.details;
    this.httpStatus = httpStatus;
  }

  toJSON(): LifecycleError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

/**
 * Invalid transition error (400 Bad Request)
 */
export class InvalidTransitionError extends LifecycleValidationError {
  constructor(currentState: LifecycleStage, attemptedState: LifecycleStage, reason?: string) {
    super(
      {
        code: 'INVALID_TRANSITION',
        message: `Cannot transition from ${currentState} to ${attemptedState}${reason ? `: ${reason}` : ''}`,
        details: {
          currentState,
          attemptedState,
          reason,
        },
      },
      400
    );
    this.name = 'InvalidTransitionError';
  }
}

/**
 * Invalid writer error (403 Forbidden)
 */
export class InvalidWriterError extends LifecycleValidationError {
  constructor(writerRole: WriterRole, field: string, allowedWriters: WriterRole[]) {
    super(
      {
        code: 'INVALID_WRITER',
        message: `Writer role '${writerRole}' is not authorized to update field '${field}'. Allowed: ${allowedWriters.join(', ')}`,
        details: {
          field,
          writerRole,
          allowedWriters,
        },
      },
      403
    );
    this.name = 'InvalidWriterError';
  }
}

/**
 * Invalid timestamp error (400 Bad Request)
 */
export class InvalidTimestampError extends LifecycleValidationError {
  constructor(field: string, reason: string) {
    super(
      {
        code: 'INVALID_TIMESTAMP',
        message: `Timestamp invariant violated for '${field}': ${reason}`,
        details: {
          field,
          reason,
        },
      },
      400
    );
    this.name = 'InvalidTimestampError';
  }
}

/**
 * Idempotency violation error (409 Conflict)
 */
export class IdempotencyError extends LifecycleValidationError {
  constructor(operation: string, reason: string) {
    super(
      {
        code: 'INVALID_IDEMPOTENCY',
        message: `Idempotency violation in '${operation}': ${reason}`,
        details: {
          reason,
        },
      },
      409
    );
    this.name = 'IdempotencyError';
  }
}

/**
 * Invalid state error (400 Bad Request)
 */
export class InvalidStateError extends LifecycleValidationError {
  constructor(reason: string, details?: Record<string, unknown>) {
    super(
      {
        code: 'INVALID_STATE',
        message: `Invalid state: ${reason}`,
        details: {
          reason,
          ...details,
        },
      },
      400
    );
    this.name = 'InvalidStateError';
  }
}

/**
 * Blocker error - pick cannot proceed
 */
export class BlockedError extends LifecycleValidationError {
  constructor(
    code:
      | 'BLOCKED_VALIDATION_FAILED'
      | 'BLOCKED_DUPLICATE'
      | 'BLOCKED_CAPPER_INACTIVE'
      | 'BLOCKED_GAME_STARTED'
      | 'BLOCKED_LINE_STALE'
      | 'BLOCKED_PROMOTION_INELIGIBLE'
      | 'BLOCKED_RATE_LIMITED'
      | 'BLOCKED_AUTOPILOT_FROZEN',
    message: string
  ) {
    super(
      {
        code,
        message,
      },
      422
    );
    this.name = 'BlockedError';
  }
}

/**
 * Autopilot frozen error - HARD FAIL-CLOSED
 * Sprint: SPRINT-E2E-SMOKE-AUTOMATION-005
 *
 * Thrown when autopilot is frozen and lifecycle writes are blocked.
 * This is a HARD blocker - no bypass paths allowed.
 */
export class AutopilotFrozenError extends LifecycleValidationError {
  public readonly freezeReason: string | null;
  public readonly freezeScope: string | null;
  public readonly incidentId: string | null;

  constructor(
    freezeReason: string | null,
    freezeScope: string | null = null,
    incidentId: string | null = null
  ) {
    super(
      {
        code: 'BLOCKED_AUTOPILOT_FROZEN',
        message: `Autopilot frozen: ${freezeReason || 'System freeze active'}`,
        details: {
          reason: freezeReason || 'System freeze active',
          scope: freezeScope,
          incidentId,
        },
      },
      503 // Service Unavailable - signals temporary system state
    );
    this.name = 'AutopilotFrozenError';
    this.freezeReason = freezeReason;
    this.freezeScope = freezeScope;
    this.incidentId = incidentId;
  }
}

/**
 * Concurrent modification error - optimistic locking failed (409 Conflict)
 * SPRINT-STRUCTURAL-REINFORCEMENT-P0-002: Fix CRIT-001 - TOCTOU race
 */
export class ConcurrentModificationError extends LifecycleValidationError {
  constructor(
    pickId: string,
    details: { currentState?: unknown; attemptedUpdates?: unknown } = {}
  ) {
    super(
      {
        code: 'CONCURRENT_MODIFICATION',
        message: `Pick ${pickId} was modified by another process during update`,
        details: {
          pickId,
          ...details,
        },
      },
      409 // Conflict
    );
    this.name = 'ConcurrentModificationError';
  }
}

/**
 * Failure error - processing failed
 */
export class FailedError extends LifecycleValidationError {
  constructor(
    code:
      | 'FAILED_DISCORD_API'
      | 'FAILED_DISCORD_PERMISSIONS'
      | 'FAILED_SETTLEMENT_NO_DATA'
      | 'FAILED_SETTLEMENT_CONFLICT'
      | 'FAILED_SETTLEMENT_TIMEOUT'
      | 'FAILED_OUTBOX_PARSE'
      | 'FAILED_OUTBOX_EXHAUSTED',
    message: string
  ) {
    super(
      {
        code,
        message,
      },
      500
    );
    this.name = 'FailedError';
  }
}

/**
 * Convert lifecycle error to HTTP response
 */
export function toHttpResponse(error: LifecycleValidationError): {
  status: number;
  body: { error: LifecycleError };
} {
  return {
    status: error.httpStatus,
    body: {
      error: error.toJSON(),
    },
  };
}
