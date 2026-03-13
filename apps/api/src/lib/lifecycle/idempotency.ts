/* eslint-disable max-lines, max-lines-per-function, complexity */
// Pre-existing ESLint complexity issues - documented for SPRINT-058A
/**
 * IDEMPOTENCY GUARDS
 * Sprint: LIFECYCLE-CONTRACT-LOCK-037
 * Sprint: SPRINT-VERIFICATION-SIMULATION-LAYER-R1 (clock injection)
 *
 * Ensures operations are idempotent - same input = same output.
 * Prevents duplicate submissions, posts, and settlements.
 *
 * CLOCK INJECTION (R1):
 *   atomicClaimForPost, atomicClaimParlayForPost, atomicClaimForSettle now accept
 *   an optional ClockProvider. Existing callers require no change.
 */

import { logger } from '../../services/logging';
import { resolveNow } from '../verification/clock';

import { IdempotencyError } from './errors';

import type { ClockProvider } from '../verification/clock';
import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================
// TYPES
// ============================================================

export interface IdempotencyCheckResult {
  isDuplicate: boolean;
  existingId?: string;
  existingState?: string;
  reason?: string;
}

// ============================================================
// SUBMIT IDEMPOTENCY
// ============================================================

/**
 * Check if a bet slip has already been submitted.
 * Uses bet_slip_id as the idempotency key.
 */
export async function checkSubmitIdempotency(
  supabase: SupabaseClient,
  betSlipId: string
): Promise<IdempotencyCheckResult> {
  if (!betSlipId) {
    return { isDuplicate: false };
  }

  const { data, error } = await supabase
    .from('unified_picks')
    .select('id, status, promotion_status')
    .eq('bet_slip_id', betSlipId)
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.warn(
      { betSlipId, error: error.message },
      'IDEMPOTENCY: Error checking submit idempotency'
    );
    return { isDuplicate: false };
  }

  if (data) {
    return {
      isDuplicate: true,
      existingId: data.id,
      existingState: data.status,
      reason: `Bet slip ${betSlipId} already submitted as pick ${data.id}`,
    };
  }

  return { isDuplicate: false };
}

/**
 * Assert submit is not a duplicate.
 * Throws IdempotencyError if duplicate detected.
 */
export async function assertSubmitIdempotency(
  supabase: SupabaseClient,
  betSlipId: string
): Promise<void> {
  const result = await checkSubmitIdempotency(supabase, betSlipId);
  if (result.isDuplicate) {
    throw new IdempotencyError('submit', result.reason || 'Duplicate submission');
  }
}

// ============================================================
// POST IDEMPOTENCY
// ============================================================

/**
 * Check if a pick has already been posted to Discord.
 * Uses posted_to_discord flag as the idempotency guard.
 */
export async function checkPostIdempotency(
  supabase: SupabaseClient,
  pickId: string
): Promise<IdempotencyCheckResult> {
  const { data, error } = await supabase
    .from('unified_picks')
    .select('id, posted_to_discord, discord_message_id')
    .eq('id', pickId)
    .single();

  if (error) {
    logger.warn({ pickId, error: error.message }, 'IDEMPOTENCY: Error checking post idempotency');
    return { isDuplicate: false };
  }

  if (data?.posted_to_discord) {
    return {
      isDuplicate: true,
      existingId: data.discord_message_id,
      existingState: 'posted',
      reason: `Pick ${pickId} already posted (message: ${data.discord_message_id})`,
    };
  }

  return { isDuplicate: false };
}

/**
 * Assert post is not a duplicate.
 * Returns true if can post, false if already posted (idempotent skip).
 */
export async function assertPostIdempotency(
  supabase: SupabaseClient,
  pickId: string
): Promise<boolean> {
  const result = await checkPostIdempotency(supabase, pickId);
  if (result.isDuplicate) {
    logger.info({ pickId, reason: result.reason }, 'IDEMPOTENCY: Post skipped (already posted)');
    return false;
  }
  return true;
}

/**
 * Atomic claim for posting - returns false if already claimed.
 * This is the preferred idempotent pattern for posting.
 *
 * @param clock Optional clock provider (SPRINT-VERIFICATION-SIMULATION-LAYER-R1).
 *              When present, promotion_posted_at is resolved through the clock.
 *              Existing callers omit this parameter and get wall-clock behaviour.
 */
export async function atomicClaimForPost(
  supabase: SupabaseClient,
  pickId: string,
  clock?: ClockProvider
): Promise<{ claimed: boolean; messageId?: string }> {
  // Atomic update: only succeeds if not already posted
  const { data, error } = await supabase
    .from('unified_picks')
    .update({
      posted_to_discord: true,
      // SPRINT-VERIFICATION-SIMULATION-LAYER-R1: clock-injected timestamp
      promotion_posted_at: resolveNow(clock).toISOString(),
    })
    .eq('id', pickId)
    .eq('posted_to_discord', false)
    .select('id');

  if (error) {
    logger.error({ pickId, error: error.message }, 'IDEMPOTENCY: Atomic claim failed');
    return { claimed: false };
  }

  if (!data || data.length === 0) {
    logger.info({ pickId }, 'IDEMPOTENCY: Post claim skipped (already claimed)');
    return { claimed: false };
  }

  return { claimed: true };
}

/**
 * Atomic claim for posting multiple parlay legs.
 * All legs must be unclaimed for claim to succeed.
 *
 * SPRINT-STRUCTURAL-REINFORCEMENT-P0-002: Fix CRIT-002 - Partial parlay
 * Now enforces ALL-OR-NOTHING semantics - partial claims are rolled back.
 *
 * @param clock Optional clock provider (SPRINT-VERIFICATION-SIMULATION-LAYER-R1).
 */
export async function atomicClaimParlayForPost(
  supabase: SupabaseClient,
  pickIds: string[],
  clock?: ClockProvider
): Promise<{ claimed: boolean; claimedCount: number; reason?: string }> {
  const { data, error } = await supabase
    .from('unified_picks')
    .update({
      posted_to_discord: true,
      // SPRINT-VERIFICATION-SIMULATION-LAYER-R1: clock-injected timestamp
      promotion_posted_at: resolveNow(clock).toISOString(),
    })
    .in('id', pickIds)
    .eq('posted_to_discord', false)
    .select('id');

  if (error) {
    logger.error({ pickIds, error: error.message }, 'IDEMPOTENCY: Parlay claim failed');
    return { claimed: false, claimedCount: 0, reason: 'DB_ERROR' };
  }

  const claimedCount = data?.length || 0;

  if (claimedCount === 0) {
    logger.info({ pickIds }, 'IDEMPOTENCY: Parlay claim skipped (all legs already claimed)');
    return { claimed: false, claimedCount: 0, reason: 'ALL_ALREADY_CLAIMED' };
  }

  // CRITICAL FIX: ALL-OR-NOTHING enforcement
  // If we couldn't claim ALL legs, rollback the ones we did claim
  if (claimedCount < pickIds.length) {
    logger.warn(
      { pickIds, claimedCount, expected: pickIds.length },
      'IDEMPOTENCY: Partial parlay detected - rolling back claimed legs'
    );

    // Rollback: reset the legs we just claimed
    const claimedIds = data.map((d: { id: string }) => d.id);
    const { error: rollbackError } = await supabase
      .from('unified_picks')
      .update({
        posted_to_discord: false,
        promotion_posted_at: null,
      })
      .in('id', claimedIds);

    if (rollbackError) {
      // This is a critical error - we have an inconsistent state
      logger.error(
        { pickIds, claimedIds, error: rollbackError.message },
        'IDEMPOTENCY: CRITICAL - Parlay rollback failed! Manual intervention required.'
      );
      return {
        claimed: false,
        claimedCount: 0,
        reason: `ROLLBACK_FAILED:${claimedCount}/${pickIds.length}`,
      };
    }

    logger.info(
      { pickIds, claimedIds },
      'IDEMPOTENCY: Partial parlay claim rolled back successfully'
    );

    return {
      claimed: false,
      claimedCount: 0,
      reason: `PARTIAL_REJECTED:${claimedCount}/${pickIds.length}`,
    };
  }

  logger.info(
    { pickIds, claimedCount },
    'IDEMPOTENCY: Parlay claim succeeded (all legs claimed atomically)'
  );

  return { claimed: true, claimedCount };
}

// ============================================================
// SETTLE IDEMPOTENCY
// ============================================================

/**
 * Check if a pick has already been settled.
 * Uses settlement_status as the idempotency guard.
 */
export async function checkSettleIdempotency(
  supabase: SupabaseClient,
  pickId: string
): Promise<IdempotencyCheckResult> {
  const { data, error } = await supabase
    .from('unified_picks')
    .select('id, settlement_status, settlement_result, settled_at, settlement_frozen')
    .eq('id', pickId)
    .single();

  if (error) {
    logger.warn({ pickId, error: error.message }, 'IDEMPOTENCY: Error checking settle idempotency');
    return { isDuplicate: false };
  }

  // Frozen settlements cannot be modified
  if (data?.settlement_frozen) {
    return {
      isDuplicate: true,
      existingId: pickId,
      existingState: 'frozen',
      reason: `Pick ${pickId} settlement is frozen and cannot be modified`,
    };
  }

  // Already settled
  if (data?.settlement_status === 'settled') {
    return {
      isDuplicate: true,
      existingId: pickId,
      existingState: data.settlement_result || 'settled',
      reason: `Pick ${pickId} already settled as ${data.settlement_result} at ${data.settled_at}`,
    };
  }

  return { isDuplicate: false };
}

/**
 * Assert settlement is not a duplicate.
 * Returns true if can settle, false if already settled (idempotent skip).
 */
export async function assertSettleIdempotency(
  supabase: SupabaseClient,
  pickId: string,
  throwOnDuplicate = false
): Promise<boolean> {
  const result = await checkSettleIdempotency(supabase, pickId);

  if (result.isDuplicate) {
    if (throwOnDuplicate) {
      throw new IdempotencyError('settle', result.reason || 'Already settled');
    }
    logger.info(
      { pickId, reason: result.reason },
      'IDEMPOTENCY: Settlement skipped (already settled)'
    );
    return false;
  }

  return true;
}

/**
 * Atomic claim for settlement - returns false if already settled.
 *
 * @param clock Optional clock provider (SPRINT-VERIFICATION-SIMULATION-LAYER-R1).
 *              When present, settled_at is resolved through the clock.
 */
export async function atomicClaimForSettle(
  supabase: SupabaseClient,
  pickId: string,
  settlement: {
    settlement_status: 'settled' | 'void';
    settlement_result?: 'win' | 'loss' | 'push';
    settlement_source?: string;
  },
  clock?: ClockProvider
): Promise<{ claimed: boolean }> {
  // Atomic update: only succeeds if not already settled
  const { data, error } = await supabase
    .from('unified_picks')
    .update({
      ...settlement,
      // SPRINT-VERIFICATION-SIMULATION-LAYER-R1: clock-injected timestamp
      settled_at: resolveNow(clock).toISOString(),
    })
    .eq('id', pickId)
    .in('settlement_status', ['pending', null])
    .select('id');

  if (error) {
    logger.error({ pickId, error: error.message }, 'IDEMPOTENCY: Settlement claim failed');
    return { claimed: false };
  }

  if (!data || data.length === 0) {
    logger.info({ pickId }, 'IDEMPOTENCY: Settlement claim skipped (already settled)');
    return { claimed: false };
  }

  return { claimed: true };
}

// ============================================================
// RESET OPERATIONS (Operator Override Only)
// Sprint: POSTING-SETTLEMENT-EXACTNESS-040
// ============================================================

/**
 * Drift mode identifiers for retry operations
 */
export type PostingDriftMode = 'P1' | 'P3' | 'P5';
export type SettlementDriftMode = 'S1' | 'S2' | 'S3';

/**
 * Context for reset operations - requires operator_override role
 */
export interface ResetContext {
  writerRole: 'operator_override';
  reason: string;
  traceId: string;
  operatorId: string;
  driftMode: PostingDriftMode | SettlementDriftMode;
}

/**
 * Result of a reset operation
 */
export interface ResetResult {
  reset: boolean;
  auditId: string;
  pickId: string;
  message: string;
  prevState?: Record<string, unknown>;
}

/**
 * Reset posting claim for retry-eligible drift modes.
 *
 * Guards:
 * - Only operator_override role can call
 * - Refuse if meta.discord_receipt.message_id + posted_at both set (valid post)
 * - Refuse if settlement_status = 'settled' or settlement_frozen = true
 * - Parlay-safe: checks all legs share same message_id
 *
 * Drift modes:
 * - P1: posted_to_discord = true but no discord_receipt.message_id
 * - P3: promotion_posted_at set but no discord_receipt
 * - P5: bridge_outbox stuck (handled separately)
 */
export async function resetPostingClaim(
  supabase: SupabaseClient,
  pickId: string,
  context: ResetContext
): Promise<ResetResult> {
  const { reason, traceId, operatorId, driftMode } = context;

  // Validate drift mode
  if (!['P1', 'P3', 'P5'].includes(driftMode)) {
    return {
      reset: false,
      auditId: '',
      pickId,
      message: `Invalid drift mode ${driftMode} for posting reset`,
    };
  }

  // Fetch current pick state
  const { data: pick, error: fetchError } = await supabase
    .from('unified_picks')
    .select(
      'id, posted_to_discord, promotion_posted_at, discord_message_id, settlement_status, settlement_frozen, ticket_type, bet_slip_id, leg_index, meta'
    )
    .eq('id', pickId)
    .single();

  if (fetchError || !pick) {
    logger.error({ pickId, error: fetchError?.message, traceId }, 'RESET: Pick not found');
    return {
      reset: false,
      auditId: '',
      pickId,
      message: `Pick ${pickId} not found`,
    };
  }

  // Guard: refuse if settled or frozen
  if (pick.settlement_status === 'settled' || pick.settlement_frozen) {
    logger.warn({ pickId, traceId }, 'RESET: Refused - pick is settled or frozen');
    return {
      reset: false,
      auditId: '',
      pickId,
      message: `Pick ${pickId} is ${pick.settlement_frozen ? 'frozen' : 'settled'} - cannot reset posting`,
      prevState: {
        settlement_status: pick.settlement_status,
        settlement_frozen: pick.settlement_frozen,
      },
    };
  }

  // Guard: refuse if valid post exists (receipt + posted_at both set)
  const hasReceipt = pick.meta?.discord_receipt?.message_id;
  const hasPostedAt = !!pick.promotion_posted_at;
  if (hasReceipt && hasPostedAt) {
    logger.warn({ pickId, traceId }, 'RESET: Refused - valid post exists');
    return {
      reset: false,
      auditId: '',
      pickId,
      message: `Pick ${pickId} has valid post (message_id + posted_at) - no drift detected`,
      prevState: {
        message_id: pick.meta?.discord_receipt?.message_id,
        promotion_posted_at: pick.promotion_posted_at,
      },
    };
  }

  // Parlay handling: check all legs
  let parlayLegIds: string[] = [pickId];
  if (pick.ticket_type === 'parlay' && pick.bet_slip_id) {
    const { data: allLegs } = await supabase
      .from('unified_picks')
      .select('id, posted_to_discord, meta')
      .eq('bet_slip_id', pick.bet_slip_id);

    if (allLegs && allLegs.length > 1) {
      // All parlay legs must be reset together
      parlayLegIds = allLegs.map(leg => leg.id);

      // Check if any leg has a valid receipt (shouldn't reset if so)
      const anyValidReceipt = allLegs.some(
        leg => leg.meta?.discord_receipt?.message_id && leg.posted_to_discord
      );
      if (anyValidReceipt) {
        logger.warn(
          { pickId, bet_slip_id: pick.bet_slip_id, traceId },
          'RESET: Refused - parlay has valid receipt on some legs'
        );
        return {
          reset: false,
          auditId: '',
          pickId,
          message: `Parlay ${pick.bet_slip_id} has valid receipt on some legs - manual review required`,
        };
      }
    }
  }

  // Capture previous state for audit
  const prevState = {
    posted_to_discord: pick.posted_to_discord,
    promotion_posted_at: pick.promotion_posted_at,
    discord_message_id: pick.discord_message_id,
    meta_discord_receipt: pick.meta?.discord_receipt,
  };

  // Reset the posting claim (clear flags to allow re-posting)
  const { error: updateError } = await supabase
    .from('unified_picks')
    .update({
      posted_to_discord: false,
      promotion_posted_at: null,
    })
    .in('id', parlayLegIds);

  if (updateError) {
    logger.error({ pickId, error: updateError.message, traceId }, 'RESET: Update failed');
    return {
      reset: false,
      auditId: '',
      pickId,
      message: `Failed to reset posting claim: ${updateError.message}`,
    };
  }

  // Generate audit ID
  const auditId = `reset-posting-${Date.now()}-${pickId.slice(0, 8)}`;

  // Write audit log entry
  const { error: auditError } = await supabase.from('audit_log').insert({
    actor: operatorId,
    action: 'POSTING_RETRY',
    entity_type: 'unified_picks',
    entity_id: pickId,
    details: {
      drift_mode: driftMode,
      prev_state: prevState,
      new_state: { posted_to_discord: false, promotion_posted_at: null },
      reason,
      trace_id: traceId,
      parlay_legs: parlayLegIds.length > 1 ? parlayLegIds : undefined,
      audit_id: auditId,
    },
    created_at: new Date().toISOString(), // WALL-CLOCK-ALLOWED: audit log created_at, non-lifecycle
  });

  if (auditError) {
    logger.warn(
      { pickId, error: auditError.message, traceId },
      'RESET: Audit log failed (non-blocking)'
    );
  }

  logger.info(
    { pickId, traceId, auditId, driftMode, parlayLegs: parlayLegIds.length },
    'RESET: Posting claim reset successfully'
  );

  return {
    reset: true,
    auditId,
    pickId,
    message: `Posting claim reset for ${parlayLegIds.length > 1 ? `${parlayLegIds.length} parlay legs` : 'pick'} - ready for re-posting`,
    prevState,
  };
}

/**
 * Reset settlement for retry-eligible scenarios.
 *
 * Guards:
 * - Only operator_override role can call
 * - Refuse if settlement_frozen = true
 * - Cannot reset if settlement_status = 'settled' with valid data (use correct_settlement RPC instead)
 *
 * Drift modes:
 * - S1: settled without timestamp
 * - S2: settled without result
 * - S3: result without settled status
 */
export async function resetSettlementForRetry(
  supabase: SupabaseClient,
  pickId: string,
  context: ResetContext
): Promise<ResetResult> {
  const { reason, traceId, operatorId, driftMode } = context;

  // Validate drift mode
  if (!['S1', 'S2', 'S3'].includes(driftMode)) {
    return {
      reset: false,
      auditId: '',
      pickId,
      message: `Invalid drift mode ${driftMode} for settlement reset`,
    };
  }

  // Fetch current pick state
  const { data: pick, error: fetchError } = await supabase
    .from('unified_picks')
    .select('id, settlement_status, settlement_result, settled_at, settlement_frozen, status')
    .eq('id', pickId)
    .single();

  if (fetchError || !pick) {
    logger.error({ pickId, error: fetchError?.message, traceId }, 'RESET: Pick not found');
    return {
      reset: false,
      auditId: '',
      pickId,
      message: `Pick ${pickId} not found`,
    };
  }

  // Guard: refuse if frozen
  if (pick.settlement_frozen) {
    logger.warn({ pickId, traceId }, 'RESET: Refused - settlement is frozen');
    return {
      reset: false,
      auditId: '',
      pickId,
      message: `Pick ${pickId} settlement is frozen - cannot reset`,
    };
  }

  // Guard: refuse if fully settled (no drift)
  if (pick.settlement_status === 'settled' && pick.settlement_result && pick.settled_at) {
    logger.warn({ pickId, traceId }, 'RESET: Refused - pick is fully settled');
    return {
      reset: false,
      auditId: '',
      pickId,
      message: `Pick ${pickId} is fully settled - use correct_settlement RPC to modify`,
    };
  }

  // Capture previous state for audit
  const prevState = {
    settlement_status: pick.settlement_status,
    settlement_result: pick.settlement_result,
    settled_at: pick.settled_at,
    status: pick.status,
  };

  // Reset to pending state (allows re-settlement)
  const { error: updateError } = await supabase
    .from('unified_picks')
    .update({
      settlement_status: 'pending',
      settlement_result: null,
      settled_at: null,
      status: 'pending',
    })
    .eq('id', pickId);

  if (updateError) {
    logger.error({ pickId, error: updateError.message, traceId }, 'RESET: Update failed');
    return {
      reset: false,
      auditId: '',
      pickId,
      message: `Failed to reset settlement: ${updateError.message}`,
    };
  }

  // Generate audit ID
  const auditId = `reset-settlement-${Date.now()}-${pickId.slice(0, 8)}`;

  // Write audit log entry
  const { error: auditError } = await supabase.from('audit_log').insert({
    actor: operatorId,
    action: 'SETTLEMENT_RETRY',
    entity_type: 'unified_picks',
    entity_id: pickId,
    details: {
      drift_mode: driftMode,
      prev_state: prevState,
      new_state: { settlement_status: 'pending', settlement_result: null, settled_at: null },
      reason,
      trace_id: traceId,
      audit_id: auditId,
    },
    created_at: new Date().toISOString(), // WALL-CLOCK-ALLOWED: audit log created_at, non-lifecycle
  });

  if (auditError) {
    logger.warn(
      { pickId, error: auditError.message, traceId },
      'RESET: Audit log failed (non-blocking)'
    );
  }

  logger.info({ pickId, traceId, auditId, driftMode }, 'RESET: Settlement reset successfully');

  return {
    reset: true,
    auditId,
    pickId,
    message: `Settlement reset to pending - ready for re-settlement`,
    prevState,
  };
}

// ============================================================
// VERIFICATION HELPERS
// ============================================================

/**
 * Verify idempotency constraints for a batch of picks.
 * Returns picks that can be processed (not duplicates).
 */
export async function filterDuplicates<T extends { bet_slip_id?: string; id?: string }>(
  supabase: SupabaseClient,
  picks: T[],
  operation: 'submit' | 'post' | 'settle'
): Promise<T[]> {
  const results: T[] = [];

  for (const pick of picks) {
    let isDuplicate = false;

    switch (operation) {
      case 'submit':
        if (pick.bet_slip_id) {
          const result = await checkSubmitIdempotency(supabase, pick.bet_slip_id);
          isDuplicate = result.isDuplicate;
        }
        break;
      case 'post':
        if (pick.id) {
          const result = await checkPostIdempotency(supabase, pick.id);
          isDuplicate = result.isDuplicate;
        }
        break;
      case 'settle':
        if (pick.id) {
          const result = await checkSettleIdempotency(supabase, pick.id);
          isDuplicate = result.isDuplicate;
        }
        break;
    }

    if (!isDuplicate) {
      results.push(pick);
    }
  }

  return results;
}
