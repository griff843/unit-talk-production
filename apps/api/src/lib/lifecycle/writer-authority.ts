/**
 * WRITER AUTHORITY GUARD
 * Sprint: LIFECYCLE-CONTRACT-LOCK-037
 *
 * Enforces single-writer discipline for lifecycle fields.
 * Every write to lifecycle fields MUST pass through this guard.
 */

import type { WriterRole, FieldAuthority } from './types';
import { InvalidWriterError } from './errors';

// ============================================================
// FIELD AUTHORITY DEFINITIONS
// ============================================================

/**
 * Field authority map - defines who can write what.
 * This is the source of truth for single-writer enforcement.
 */
const FIELD_AUTHORITIES: FieldAuthority[] = [
  // Submission fields (immutable after creation)
  { field: 'id', allowedWriters: ['submitter'], immutableAfterSet: true },
  { field: 'bet_slip_id', allowedWriters: ['submitter'], immutableAfterSet: true },
  { field: 'leg_index', allowedWriters: ['submitter'], immutableAfterSet: true },
  { field: 'user_id', allowedWriters: ['submitter'], immutableAfterSet: true },
  { field: 'selection', allowedWriters: ['submitter'], immutableAfterSet: true },
  { field: 'line', allowedWriters: ['submitter'], immutableAfterSet: true },
  { field: 'odds', allowedWriters: ['submitter'], immutableAfterSet: true },
  { field: 'stake', allowedWriters: ['submitter'], immutableAfterSet: true },
  { field: 'sport', allowedWriters: ['submitter'], immutableAfterSet: true },
  { field: 'bet_type', allowedWriters: ['submitter'], immutableAfterSet: true },
  { field: 'stat_type', allowedWriters: ['submitter'], immutableAfterSet: true },
  { field: 'player_name', allowedWriters: ['submitter'], immutableAfterSet: true },
  { field: 'team', allowedWriters: ['submitter'], immutableAfterSet: true },
  { field: 'direction', allowedWriters: ['submitter'], immutableAfterSet: true },

  // Timestamp fields (set by appropriate writers)
  { field: 'created_at', allowedWriters: ['submitter'], immutableAfterSet: true },
  { field: 'placed_at', allowedWriters: ['submitter'], immutableAfterSet: true },
  { field: 'promotion_queued_at', allowedWriters: ['promoter', 'operator_override'], immutableAfterSet: false },
  { field: 'promotion_posted_at', allowedWriters: ['poster'], immutableAfterSet: true },
  { field: 'blocked_at', allowedWriters: ['promoter', 'operator_override'], immutableAfterSet: false },
  { field: 'failed_at', allowedWriters: ['promoter', 'poster', 'settler'], immutableAfterSet: false },
  { field: 'settled_at', allowedWriters: ['settler', 'operator_override'], immutableAfterSet: false },
  { field: 'freeze_enforced_at', allowedWriters: ['settler'], immutableAfterSet: true },

  // Promotion fields
  { field: 'promotion_status', allowedWriters: ['promoter', 'poster', 'operator_override'], immutableAfterSet: false },
  { field: 'promotion_band', allowedWriters: ['promoter', 'operator_override'], immutableAfterSet: false },
  { field: 'blocked_reason', allowedWriters: ['promoter', 'operator_override'], immutableAfterSet: false },
  { field: 'failed_reason', allowedWriters: ['promoter', 'poster', 'settler', 'operator_override'], immutableAfterSet: false },

  // Discord posting fields
  { field: 'posted_to_discord', allowedWriters: ['poster'], immutableAfterSet: true },
  { field: 'discord_message_id', allowedWriters: ['poster'], immutableAfterSet: true },
  { field: 'discord_thread_id', allowedWriters: ['poster'], immutableAfterSet: true },

  // Settlement fields (protected by DB trigger + RPC)
  { field: 'settlement_status', allowedWriters: ['settler', 'operator_override'], immutableAfterSet: false },
  { field: 'settlement_result', allowedWriters: ['settler', 'operator_override'], immutableAfterSet: false },
  { field: 'settlement_source', allowedWriters: ['settler', 'operator_override'], immutableAfterSet: false },
  { field: 'settlement_hash', allowedWriters: ['settler'], immutableAfterSet: true },
  { field: 'settlement_frozen', allowedWriters: ['settler'], immutableAfterSet: true },
  { field: 'settlement_version', allowedWriters: ['settler', 'operator_override'], immutableAfterSet: false },
  { field: 'actual_outcome', allowedWriters: ['settler', 'operator_override'], immutableAfterSet: false },

  // Pick status (outcome) - derived from settlement
  { field: 'status', allowedWriters: ['settler', 'operator_override'], immutableAfterSet: false },

  // Metadata (flexible)
  { field: 'meta', allowedWriters: ['submitter', 'promoter', 'poster', 'settler', 'operator_override'], immutableAfterSet: false },
  { field: 'updated_at', allowedWriters: ['submitter', 'promoter', 'poster', 'settler', 'operator_override'], immutableAfterSet: false },
];

/**
 * Build field authority lookup map
 */
const FIELD_AUTHORITY_MAP = new Map<string, FieldAuthority>();
for (const auth of FIELD_AUTHORITIES) {
  FIELD_AUTHORITY_MAP.set(auth.field, auth);
}

// ============================================================
// AUTHORITY CHECKING
// ============================================================

/**
 * Get the authority definition for a field
 */
export function getFieldAuthority(field: string): FieldAuthority | null {
  return FIELD_AUTHORITY_MAP.get(field) ?? null;
}

/**
 * Check if a writer role can update a specific field
 */
export function canWriteField(
  writerRole: WriterRole,
  field: string
): boolean {
  const authority = FIELD_AUTHORITY_MAP.get(field);
  if (!authority) {
    // Unknown field - only operator_override can write
    return writerRole === 'operator_override';
  }
  return authority.allowedWriters.includes(writerRole);
}

/**
 * Check if a field is immutable after being set
 */
export function isFieldImmutable(field: string): boolean {
  const authority = FIELD_AUTHORITY_MAP.get(field);
  return authority?.immutableAfterSet ?? false;
}

/**
 * Get all fields a writer role is authorized to update
 */
export function getAuthorizedFields(writerRole: WriterRole): string[] {
  return FIELD_AUTHORITIES
    .filter((auth) => auth.allowedWriters.includes(writerRole))
    .map((auth) => auth.field);
}

/**
 * Get the allowed writers for a field
 */
export function getAllowedWriters(field: string): WriterRole[] {
  const authority = FIELD_AUTHORITY_MAP.get(field);
  return authority?.allowedWriters ?? ['operator_override'];
}

// ============================================================
// ENFORCEMENT
// ============================================================

/**
 * Assert that a writer role is authorized to update the specified fields.
 * Throws InvalidWriterError if not authorized.
 */
export function assertWriterAuthority(
  writerRole: WriterRole,
  fieldsToUpdate: string[]
): void {
  for (const field of fieldsToUpdate) {
    if (!canWriteField(writerRole, field)) {
      const allowedWriters = getAllowedWriters(field);
      throw new InvalidWriterError(writerRole, field, allowedWriters);
    }
  }
}

/**
 * Assert that fields are not being updated if they're immutable and already set.
 * Requires current values to check.
 */
export function assertImmutability(
  writerRole: WriterRole,
  fieldsToUpdate: string[],
  currentValues: Record<string, unknown>
): void {
  // operator_override can bypass immutability
  if (writerRole === 'operator_override') {
    return;
  }

  for (const field of fieldsToUpdate) {
    if (isFieldImmutable(field)) {
      const currentValue = currentValues[field];
      if (currentValue !== null && currentValue !== undefined) {
        throw new InvalidWriterError(
          writerRole,
          field,
          ['operator_override'] // Only override can modify immutable fields
        );
      }
    }
  }
}

/**
 * Validate a complete write operation
 */
export function validateWrite(
  writerRole: WriterRole,
  fieldsToUpdate: string[],
  currentValues?: Record<string, unknown>
): void {
  // Check writer authority
  assertWriterAuthority(writerRole, fieldsToUpdate);

  // Check immutability if current values provided
  if (currentValues) {
    assertImmutability(writerRole, fieldsToUpdate, currentValues);
  }
}

// ============================================================
// DOCUMENTATION HELPERS
// ============================================================

/**
 * Get the complete writer authority map for documentation
 */
export function getWriterAuthorityMap(): Map<WriterRole, string[]> {
  const map = new Map<WriterRole, string[]>();
  const roles: WriterRole[] = ['submitter', 'promoter', 'poster', 'settler', 'operator_override'];

  for (const role of roles) {
    map.set(role, getAuthorizedFields(role));
  }

  return map;
}

/**
 * Get fields grouped by writer for documentation
 */
export function getFieldsByWriter(): Record<WriterRole, string[]> {
  const result: Record<WriterRole, string[]> = {
    submitter: [],
    promoter: [],
    poster: [],
    settler: [],
    operator_override: [],
  };

  for (const auth of FIELD_AUTHORITIES) {
    for (const writer of auth.allowedWriters) {
      result[writer].push(auth.field);
    }
  }

  return result;
}

/**
 * Get immutable fields for documentation
 */
export function getImmutableFields(): string[] {
  return FIELD_AUTHORITIES
    .filter((auth) => auth.immutableAfterSet)
    .map((auth) => auth.field);
}
