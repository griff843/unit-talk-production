/* eslint-disable no-console, security/detect-object-injection, max-lines, max-params */
// Console used for admin override logging; object injection is controlled input
// max-lines: Security-critical module with field authority definitions + permission validation
// max-params: logOperatorSpoofAttempt requires all context for proper audit logging
/**
 * WRITER AUTHORITY GUARD
 * Sprint: LIFECYCLE-CONTRACT-LOCK-037
 *
 * Enforces single-writer discipline for lifecycle fields.
 * Every write to lifecycle fields MUST pass through this guard.
 */

import { SecurityEventLogger } from '../../security';
import { supabase } from '../../services/supabaseClient';

import { InvalidWriterError } from './errors';

import type { WriterRole, FieldAuthority } from './types';

// ============================================================
// FIELD AUTHORITY DEFINITIONS
// ============================================================

/**
 * Field authority map - defines who can write what.
 * This is the source of truth for single-writer enforcement.
 */
const FIELD_AUTHORITIES: FieldAuthority[] = [
  // Submission fields (immutable after creation)
  // SPRINT-DISCORD-POSTING-WRITER-AUTHORITY-FIX-048: Add operator_override for admin tools (gauntlet)
  // SPRINT-044A: Add promoter authority for pipeline insert (GAP-03)
  {
    field: 'id',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: true,
  },
  {
    field: 'bet_slip_id',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: true,
  },
  {
    field: 'leg_index',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: true,
  },
  {
    field: 'user_id',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: true,
  },
  {
    field: 'selection',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: true,
  },
  {
    field: 'line',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: true,
  },
  {
    field: 'odds',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: true,
  },
  {
    field: 'stake',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: true,
  },
  {
    field: 'sport',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: true,
  },
  {
    field: 'bet_type',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: true,
  },
  {
    field: 'stat_type',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: true,
  },
  {
    field: 'player_name',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: true,
  },
  {
    field: 'team',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: true,
  },
  {
    field: 'direction',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: true,
  },
  {
    field: 'side',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: true,
  },
  {
    field: 'source',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: true,
  },
  {
    field: 'ticket_type',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: true,
  },
  {
    field: 'parlay_id',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: true,
  },
  // SPRINT-035A B-2: Register remaining unified_picks business columns
  // These were missing from the authority map, causing unknown-field rejection
  {
    field: 'pick_type',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: true,
  },
  {
    field: 'potential_payout',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: false,
  },
  {
    field: 'over_odds',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: true,
  },
  {
    field: 'under_odds',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: true,
  },
  {
    field: 'game_date',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: true,
  },
  {
    field: 'tier_when_placed',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: false,
  },
  {
    field: 'kelly_bet_size',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: false,
  },

  // Scoring/pipeline fields (set at pick creation by ProfessionalPropProcessor)
  // SPRINT-CANONICAL-SCORING-ACTIVATION-026: Add scoring fields for submitter
  {
    field: 'confidence',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: false,
  },
  {
    field: 'tier',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: false,
  },
  {
    field: 'professional_score',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: false,
  },
  {
    field: 'p_final',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: false,
  },
  {
    field: 'edge_final',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: false,
  },
  {
    field: 'uncertainty_final',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: false,
  },
  {
    field: 'clv_forecast',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: false,
  },
  {
    field: 'devigged_edge',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: false,
  },

  // Timestamp fields (set by appropriate writers)
  // SPRINT-044A: Add promoter for pipeline insert (GAP-03)
  {
    field: 'created_at',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: true,
  },
  {
    field: 'placed_at',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: true,
  },
  {
    field: 'promotion_queued_at',
    allowedWriters: ['promoter', 'operator_override'],
    immutableAfterSet: false,
  },
  { field: 'promotion_posted_at', allowedWriters: ['poster'], immutableAfterSet: true },
  {
    field: 'blocked_at',
    allowedWriters: ['promoter', 'operator_override'],
    immutableAfterSet: false,
  },
  {
    field: 'failed_at',
    allowedWriters: ['promoter', 'poster', 'settler'],
    immutableAfterSet: false,
  },
  {
    field: 'settled_at',
    allowedWriters: ['settler', 'operator_override'],
    immutableAfterSet: false,
  },
  { field: 'freeze_enforced_at', allowedWriters: ['settler'], immutableAfterSet: true },

  // Promotion fields
  {
    field: 'promotion_status',
    allowedWriters: ['promoter', 'poster', 'operator_override'],
    immutableAfterSet: false,
  },
  {
    field: 'promotion_band',
    allowedWriters: ['submitter', 'promoter', 'operator_override'],
    immutableAfterSet: false,
  },
  {
    field: 'blocked_reason',
    allowedWriters: ['promoter', 'operator_override'],
    immutableAfterSet: false,
  },
  {
    field: 'failed_reason',
    allowedWriters: ['promoter', 'poster', 'settler', 'operator_override'],
    immutableAfterSet: false,
  },

  // Discord posting fields
  {
    field: 'posted_to_discord',
    allowedWriters: ['submitter', 'promoter', 'poster', 'operator_override'],
    immutableAfterSet: true,
  },
  {
    field: 'discord_message_id',
    allowedWriters: ['poster', 'operator_override'],
    immutableAfterSet: true,
  },
  {
    field: 'discord_thread_id',
    allowedWriters: ['poster', 'operator_override'],
    immutableAfterSet: true,
  },

  // Settlement fields (protected by DB trigger + RPC)
  {
    field: 'settlement_status',
    allowedWriters: ['settler', 'operator_override'],
    immutableAfterSet: false,
  },
  {
    field: 'settlement_result',
    allowedWriters: ['settler', 'operator_override'],
    immutableAfterSet: false,
  },
  {
    field: 'settlement_source',
    allowedWriters: ['settler', 'operator_override'],
    immutableAfterSet: false,
  },
  { field: 'settlement_hash', allowedWriters: ['settler'], immutableAfterSet: true },
  { field: 'settlement_frozen', allowedWriters: ['settler'], immutableAfterSet: true },
  {
    field: 'settlement_version',
    allowedWriters: ['settler', 'operator_override'],
    immutableAfterSet: false,
  },
  {
    field: 'actual_outcome',
    allowedWriters: ['settler', 'operator_override'],
    immutableAfterSet: false,
  },

  // Pick status (outcome) - set by submitter at creation, updated by settler
  {
    field: 'status',
    allowedWriters: ['submitter', 'promoter', 'settler', 'operator_override'],
    immutableAfterSet: false,
  },

  // Metadata (flexible)
  {
    field: 'meta',
    allowedWriters: ['submitter', 'promoter', 'poster', 'settler', 'operator_override'],
    immutableAfterSet: false,
  },
  {
    field: 'updated_at',
    allowedWriters: ['submitter', 'promoter', 'poster', 'settler', 'operator_override'],
    immutableAfterSet: false,
  },
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
export function canWriteField(writerRole: WriterRole, field: string): boolean {
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
  return FIELD_AUTHORITIES.filter(auth => auth.allowedWriters.includes(writerRole)).map(
    auth => auth.field
  );
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
export function assertWriterAuthority(writerRole: WriterRole, fieldsToUpdate: string[]): void {
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
  return FIELD_AUTHORITIES.filter(auth => auth.immutableAfterSet).map(auth => auth.field);
}

// ============================================================
// ADMIN OVERRIDE PERMISSION VALIDATION
// SPRINT-STRUCTURAL-REINFORCEMENT-P0-002: Fix CRIT-004
// ============================================================

/**
 * Permission constants for admin operations
 */
export const ADMIN_PERMISSIONS = {
  ADMIN_SETTLEMENT_OVERRIDE: 'ADMIN_SETTLEMENT_OVERRIDE',
  OPERATOR_SETTLE: 'OPERATOR_SETTLE',
  OPERATOR_RESET: 'OPERATOR_RESET',
} as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[keyof typeof ADMIN_PERMISSIONS];

/**
 * Validate that an operator has permission for admin_override operations.
 *
 * CRITICAL: This function MUST be called before passing admin_override=true
 * to any RPC that accepts this flag.
 *
 * @param supabase - Supabase client
 * @param operatorId - The authenticated operator ID
 * @param permission - The permission to check
 * @returns Promise<boolean> - Whether the operator has the permission
 */
export async function validateAdminOverridePermission(
  supabase: {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (
          col: string,
          val: string
        ) => {
          eq: (
            col: string,
            val: string
          ) => { maybeSingle: () => Promise<{ data: unknown; error: unknown }> };
        };
      };
    };
  },
  operatorId: string,
  permission: AdminPermission
): Promise<{ hasPermission: boolean; reason?: string }> {
  // In non-production, allow override with logging
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[ADMIN_OVERRIDE] Non-production: allowing ${permission} for ${operatorId}`);
    return { hasPermission: true, reason: 'non-production-bypass' };
  }

  try {
    const { data, error } = await supabase
      .from('user_permissions')
      .select('id')
      .eq('user_id', operatorId)
      .eq('permission', permission)
      .maybeSingle();

    if (error) {
      console.error(`[ADMIN_OVERRIDE] Permission check error: ${JSON.stringify(error)}`);
      return { hasPermission: false, reason: 'permission-check-failed' };
    }

    return {
      hasPermission: !!data,
      reason: data ? 'permission-granted' : 'permission-denied',
    };
  } catch (err) {
    console.error(`[ADMIN_OVERRIDE] Unexpected error: ${err}`);
    return { hasPermission: false, reason: 'unexpected-error' };
  }
}

/**
 * Strip admin_override from metadata unless operator has permission.
 * Use this to sanitize metadata before passing to RPCs.
 *
 * @param meta - The metadata object that may contain admin_override
 * @param operatorHasPermission - Whether the operator has admin override permission
 * @returns Sanitized metadata with admin_override removed if not permitted
 */
export function sanitizeAdminOverride<T extends Record<string, unknown>>(
  meta: T,
  operatorHasPermission: boolean
): T {
  if (!meta || typeof meta !== 'object') return meta;

  if ('admin_override' in meta && !operatorHasPermission) {
    console.warn('[ADMIN_OVERRIDE] Stripping unauthorized admin_override from metadata');
    const { admin_override: _, ...sanitized } = meta;
    return sanitized as T;
  }

  return meta;
}

// ============================================================
// OPERATOR SPOOF DETECTION
// SPRINT-STRUCTURAL-REINFORCEMENT-P0-003: Operator Identity Truth Lock
// ============================================================

/**
 * Log operator spoof attempt to security_events table.
 *
 * Called when x-operator-id header is present but differs from the
 * authenticated user ID (derived from JWT). The header is IGNORED
 * for authorization, but the attempt is logged for audit.
 *
 * @param authenticatedId - The real user ID from JWT authentication
 * @param spoofedId - The x-operator-id header value (ignored for auth)
 * @param endpoint - The API endpoint being accessed
 * @param ip - Client IP address
 * @param userAgent - Client User-Agent header
 */
export async function logOperatorSpoofAttempt(
  authenticatedId: string,
  spoofedId: string,
  endpoint: string,
  ip: string,
  userAgent?: string
): Promise<void> {
  console.warn(
    `[SPOOF_ATTEMPT] Operator spoof detected: authenticated=${authenticatedId}, spoofed=${spoofedId}, endpoint=${endpoint}`
  );

  try {
    await SecurityEventLogger.logEvent({
      type: 'operator_spoof_attempt',
      userId: authenticatedId,
      ip,
      userAgent,
      details: {
        authenticatedUserId: authenticatedId,
        spoofedOperatorId: spoofedId,
        endpoint,
        headerIgnored: true,
        severity: 'high',
        message:
          'x-operator-id header value was ignored. Authority derived from JWT principal only.',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[SPOOF_ATTEMPT] Failed to log security event: ${err}`);
  }
}

/**
 * Validate operator has required permission for privileged operations.
 * Combines authentication (already done) with authorization (permission check).
 *
 * @param operatorId - The authenticated operator ID (from JWT)
 * @param requiredPermission - The permission required for the operation
 * @returns Object with hasPermission boolean and optional reason
 */
export async function validateOperatorPermission(
  operatorId: string,
  requiredPermission: AdminPermission
): Promise<{ hasPermission: boolean; reason?: string }> {
  // In non-production, allow with logging
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      `[OPERATOR_PERMISSION] Non-production: allowing ${requiredPermission} for ${operatorId}`
    );
    return { hasPermission: true, reason: 'non-production-bypass' };
  }

  try {
    const { data, error } = await supabase
      .from('user_permissions')
      .select('id')
      .eq('user_id', operatorId)
      .eq('permission', requiredPermission)
      .maybeSingle();

    if (error) {
      console.error(`[OPERATOR_PERMISSION] Permission check error: ${JSON.stringify(error)}`);
      return { hasPermission: false, reason: 'permission-check-failed' };
    }

    return {
      hasPermission: !!data,
      reason: data ? 'permission-granted' : 'permission-denied',
    };
  } catch (err) {
    console.error(`[OPERATOR_PERMISSION] Unexpected error: ${err}`);
    return { hasPermission: false, reason: 'unexpected-error' };
  }
}
