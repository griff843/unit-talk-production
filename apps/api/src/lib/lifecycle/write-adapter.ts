/* eslint-disable max-lines, max-lines-per-function, complexity */
/**
 * LIFECYCLE WRITE ADAPTER
 * Sprint: LIFECYCLE-CONTRACT-LOCK-037
 * Sprint: SPRINT-E2E-SMOKE-AUTOMATION-005 (freeze guard hardening)
 *
 * Adapts Supabase writes to enforce lifecycle validation.
 * All writes to unified_picks MUST go through this adapter.
 *
 * INVARIANT: Autopilot freeze blocks ALL writes (hard fail-closed)
 * NOTE: eslint rules disabled - lifecycle functions require validation complexity
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { isAutopilotFrozenAsync, getFreezeDetails } from '@unit-talk/shared-utils';

import { logger } from '../../services/logging';

import { AutopilotFrozenError } from './errors';
import { deriveLifecycleStage, assertTransition, validateInvariants } from './transition-validator';
import { validateWrite, assertWriterAuthority } from './writer-authority';

import type { WriterRole, LifecyclePick, LifecycleStage } from './types';

// ============================================================
// FREEZE GUARD - HARD FAIL-CLOSED
// ============================================================

/**
 * Asserts autopilot is not frozen. Throws AutopilotFrozenError if frozen.
 * This is a HARD blocker - no bypass paths allowed.
 */
async function assertNotFrozen(traceId: string): Promise<void> {
  const frozen = await isAutopilotFrozenAsync();
  if (frozen) {
    const details = getFreezeDetails();
    logger.error(
      { traceId, freezeDetails: details },
      'LIFECYCLE: Write blocked by autopilot freeze (HARD FAIL-CLOSED)'
    );
    throw new AutopilotFrozenError(details.reason, details.scope, details.incidentId);
  }
}

// ============================================================
// TYPES
// ============================================================

export interface WriteContext {
  writerRole: WriterRole;
  pickId?: string;
  traceId?: string;
  skipTransitionValidation?: boolean; // For initial insert
}

export interface WriteResult {
  success: boolean;
  pickId?: string;
  error?: string;
  validationPassed: boolean;
}

// ============================================================
// ADAPTER IMPLEMENTATION
// ============================================================

/**
 * Lifecycle-validated insert for unified_picks
 * Used for initial pick submission (DRAFT -> SUBMITTED)
 */
export async function lifecycleInsert(
  supabase: SupabaseClient,
  pick: Partial<LifecyclePick> & { id: string },
  context: WriteContext
): Promise<WriteResult> {
  const traceId = context.traceId || `insert-${pick.id}-${Date.now()}`;

  // HARD FAIL-CLOSED: Assert autopilot is not frozen
  await assertNotFrozen(traceId);

  try {
    // 1. Validate writer authority for all fields being set
    const fieldsToWrite = Object.keys(pick).filter(k => pick[k as keyof typeof pick] !== undefined);
    assertWriterAuthority(context.writerRole, fieldsToWrite);

    // 2. For insert, we're going DRAFT -> SUBMITTED (implicit)
    // No current state to validate against

    // 3. Perform the insert
    const { data, error } = await supabase.from('unified_picks').insert(pick).select('id').single();

    if (error) {
      logger.error({ traceId, pickId: pick.id, error: error.message }, 'LIFECYCLE: Insert failed');
      return {
        success: false,
        error: error.message,
        validationPassed: true, // Validation passed, DB failed
      };
    }

    logger.info(
      { traceId, pickId: data.id, writer: context.writerRole },
      'LIFECYCLE: Insert succeeded'
    );

    return {
      success: true,
      pickId: data.id,
      validationPassed: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      { traceId, pickId: pick.id, error: message },
      'LIFECYCLE: Insert validation failed'
    );
    return {
      success: false,
      error: message,
      validationPassed: false,
    };
  }
}

/**
 * Lifecycle-validated update for unified_picks
 * Enforces single-writer authority and transition rules.
 */
export async function lifecycleUpdate(
  supabase: SupabaseClient,
  pickId: string,
  updates: Partial<LifecyclePick>,
  context: WriteContext
): Promise<WriteResult> {
  const traceId = context.traceId || `update-${pickId}-${Date.now()}`;

  // HARD FAIL-CLOSED: Assert autopilot is not frozen
  await assertNotFrozen(traceId);

  try {
    // 1. Fetch current pick state
    const { data: currentPick, error: fetchError } = await supabase
      .from('unified_picks')
      .select('*')
      .eq('id', pickId)
      .single();

    if (fetchError || !currentPick) {
      return {
        success: false,
        error: `Pick not found: ${pickId}`,
        validationPassed: false,
      };
    }

    // 2. Validate writer authority for fields being updated
    const fieldsToUpdate = Object.keys(updates).filter(
      k => updates[k as keyof typeof updates] !== undefined
    );

    // Use validateWrite which checks both authority AND immutability
    validateWrite(context.writerRole, fieldsToUpdate, currentPick);

    // 3. Derive current and next stages if stage-affecting fields change
    if (!context.skipTransitionValidation) {
      const currentStage = deriveLifecycleStage(currentPick as LifecyclePick);

      // Build hypothetical next state
      const nextState = { ...currentPick, ...updates } as LifecyclePick;
      const nextStage = deriveLifecycleStage(nextState);

      // If stage changes, validate the transition
      if (currentStage !== nextStage) {
        assertTransition(currentStage, nextStage, {
          pickId,
          writerRole: context.writerRole,
          traceId,
        });
      }

      // Validate invariants on the resulting state
      validateInvariants(nextState);
    }

    // 4. Perform the update
    const { error: updateError } = await supabase
      .from('unified_picks')
      .update(updates)
      .eq('id', pickId);

    if (updateError) {
      logger.error({ traceId, pickId, error: updateError.message }, 'LIFECYCLE: Update failed');
      return {
        success: false,
        error: updateError.message,
        validationPassed: true, // Validation passed, DB failed
      };
    }

    logger.info(
      {
        traceId,
        pickId,
        writer: context.writerRole,
        fields: fieldsToUpdate,
      },
      'LIFECYCLE: Update succeeded'
    );

    return {
      success: true,
      pickId,
      validationPassed: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ traceId, pickId, error: message }, 'LIFECYCLE: Update validation failed');
    return {
      success: false,
      error: message,
      validationPassed: false,
    };
  }
}

/**
 * Claim a pick for posting (idempotent)
 * Returns false if already claimed, true if newly claimed.
 */
export async function lifecycleClaimForPosting(
  supabase: SupabaseClient,
  pickId: string,
  context: Omit<WriteContext, 'writerRole'> & { writerRole?: WriterRole }
): Promise<WriteResult> {
  const traceId = context.traceId || `claim-${pickId}-${Date.now()}`;
  const writerRole: WriterRole = context.writerRole || 'poster';

  // HARD FAIL-CLOSED: Assert autopilot is not frozen
  await assertNotFrozen(traceId);

  try {
    // Validate writer is poster
    assertWriterAuthority(writerRole, ['posted_to_discord']);

    // Atomic claim: only update if not already claimed
    const { data, error } = await supabase
      .from('unified_picks')
      .update({
        posted_to_discord: true,
        promotion_posted_at: new Date().toISOString(),
      })
      .eq('id', pickId)
      .eq('posted_to_discord', false)
      .select('id');

    if (error) {
      logger.error({ traceId, pickId, error: error.message }, 'LIFECYCLE: Claim failed');
      return {
        success: false,
        error: error.message,
        validationPassed: true,
      };
    }

    if (!data || data.length === 0) {
      logger.info({ traceId, pickId }, 'LIFECYCLE: Pick already claimed (idempotent)');
      return {
        success: false,
        error: 'Already claimed',
        validationPassed: true,
      };
    }

    logger.info({ traceId, pickId, writer: writerRole }, 'LIFECYCLE: Pick claimed for posting');

    return {
      success: true,
      pickId,
      validationPassed: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ traceId, pickId, error: message }, 'LIFECYCLE: Claim validation failed');
    return {
      success: false,
      error: message,
      validationPassed: false,
    };
  }
}

/**
 * Settle a pick (idempotent)
 * Enforces settlement can only happen from valid states.
 */
export async function lifecycleSettle(
  supabase: SupabaseClient,
  pickId: string,
  settlement: {
    settlement_status: 'settled' | 'void';
    settlement_result?: 'win' | 'loss' | 'push';
    settlement_source?: string;
    actual_outcome?: number;
  },
  context: Omit<WriteContext, 'writerRole'> & { writerRole?: WriterRole }
): Promise<WriteResult> {
  const traceId = context.traceId || `settle-${pickId}-${Date.now()}`;
  const writerRole: WriterRole = context.writerRole || 'settler';

  // HARD FAIL-CLOSED: Assert autopilot is not frozen
  await assertNotFrozen(traceId);

  try {
    // 1. Fetch current pick
    const { data: currentPick, error: fetchError } = await supabase
      .from('unified_picks')
      .select('*')
      .eq('id', pickId)
      .single();

    if (fetchError || !currentPick) {
      return {
        success: false,
        error: `Pick not found: ${pickId}`,
        validationPassed: false,
      };
    }

    // 2. Validate writer authority
    const fieldsToUpdate = Object.keys(settlement);
    assertWriterAuthority(writerRole, [...fieldsToUpdate, 'settled_at']);

    // 3. Validate transition
    const currentStage = deriveLifecycleStage(currentPick as LifecyclePick);
    const nextStage: LifecycleStage = settlement.settlement_status === 'void' ? 'VOID' : 'SETTLED';

    assertTransition(currentStage, nextStage, {
      pickId,
      writerRole,
      traceId,
    });

    // 4. Perform settlement
    const updates = {
      ...settlement,
      settled_at: new Date().toISOString(),
      status:
        settlement.settlement_result === 'win'
          ? 'won'
          : settlement.settlement_result === 'loss'
            ? 'lost'
            : settlement.settlement_result === 'push'
              ? 'push'
              : settlement.settlement_status === 'void'
                ? 'void'
                : 'pending',
    };

    const { error: updateError } = await supabase
      .from('unified_picks')
      .update(updates)
      .eq('id', pickId);

    if (updateError) {
      logger.error({ traceId, pickId, error: updateError.message }, 'LIFECYCLE: Settlement failed');
      return {
        success: false,
        error: updateError.message,
        validationPassed: true,
      };
    }

    logger.info(
      {
        traceId,
        pickId,
        writer: writerRole,
        result: settlement.settlement_result,
      },
      'LIFECYCLE: Settlement succeeded'
    );

    return {
      success: true,
      pickId,
      validationPassed: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ traceId, pickId, error: message }, 'LIFECYCLE: Settlement validation failed');
    return {
      success: false,
      error: message,
      validationPassed: false,
    };
  }
}
