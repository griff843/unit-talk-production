/**
 * V3 Ticket Submission for Smart Form
 * SPRINT-SMARTFORM-UX-REBUILD-080
 *
 * Calls atomic_submit_ticket_v2 RPC with provider-first model.
 * Fail-closed: Only shows success on 'inserted' or 'exists' status.
 */

import { supabase } from '../supabase';
import type {
  V3SubmitTicketInput,
  V3SubmitTicketResult,
  V3LegPayload,
  V3TicketLeg,
  V3LegError,
  SubmitStatus,
} from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

// Test user ID when auth is not implemented
// tickets.user_id has no FK, so this is safe
export const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

// ============================================================================
// BET SLIP ID GENERATION
// ============================================================================

/**
 * Generate a unique bet slip ID (idempotency key)
 * Format: SF-YYYYMMDD-HHMMSS-XXXX (where X is random hex)
 */
export function generateBetSlipId(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 19).replace(/[-:T]/g, '');
  const randomPart = crypto.randomUUID().slice(0, 8);
  return `SF-${datePart}-${randomPart}`;
}

// ============================================================================
// PAYLOAD BUILDER
// ============================================================================

/**
 * Convert UI leg state to RPC payload format
 */
export function buildLegPayload(leg: V3TicketLeg): V3LegPayload {
  const payload: V3LegPayload = {
    event_id: leg.event_id,
    market_type_id: leg.market_type_id,
    selection: leg.selection,
  };

  // Optional segment
  if (leg.segment_type_id) {
    payload.segment_type_id = leg.segment_type_id;
  }

  // Provider-first path: use offer ID
  if (leg.provider_offer_id && !leg.isManual) {
    payload.provider_offer_id = leg.provider_offer_id;

    // Participant ID (if market requires it)
    if (leg.participant_id) {
      payload.participant_id = leg.participant_id;
    }

    // Override values (if user edited the offer)
    if (leg.override && Object.keys(leg.override).length > 0) {
      payload.override = leg.override;
    }
  } else {
    // Manual entry path
    if (leg.participant_id) {
      payload.participant_id = leg.participant_id;
    }

    if (leg.line !== undefined && leg.line !== null) {
      payload.line = leg.line;
    }

    if (leg.odds !== undefined && leg.odds !== null) {
      payload.odds = leg.odds;
    }

    if (leg.provider) {
      payload.provider = leg.provider;
    }
  }

  return payload;
}

// ============================================================================
// SUBMIT TICKET
// ============================================================================

/**
 * Submit a ticket via atomic_submit_ticket_v2 RPC
 *
 * @param input - Ticket submission input
 * @returns Submission result with status and IDs
 * @throws Error if RPC call fails or returns unexpected format
 */
export async function submitTicketV3(input: V3SubmitTicketInput): Promise<V3SubmitTicketResult> {
  // Build leg payloads
  const legPayloads = input.legs.map(leg =>
    leg.event_id ? leg : buildLegPayload(leg as unknown as V3TicketLeg)
  );

  console.log('[V3Submit] Submitting ticket:', {
    bet_slip_id: input.bet_slip_id,
    ticket_type: input.ticket_type,
    leg_count: legPayloads.length,
  });

  // Call RPC - using type assertion because RPC is not typed in Database
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('atomic_submit_ticket_v2', {
    p_bet_slip_id: input.bet_slip_id,
    p_user_id: input.user_id,
    p_ticket_type: input.ticket_type,
    p_total_stake: input.total_stake,
    p_legs: legPayloads,
    p_source: 'smart_form',
    p_meta: input.meta || {},
  });

  if (error) {
    console.error('[V3Submit] RPC error:', error);
    throw new Error(`Submission failed: ${error.message}`);
  }

  // RPC returns array with single row
  const responseData = data as Array<{
    out_ticket_id: string | null;
    out_leg_ids: string[] | null;
    out_status: string;
    out_error_details: V3LegError[] | null;
  }>;

  if (!responseData || !Array.isArray(responseData) || responseData.length === 0) {
    throw new Error('Unexpected RPC response format: no data returned');
  }

  const row = responseData[0];

  // Map to result type
  const result: V3SubmitTicketResult = {
    ticket_id: row.out_ticket_id,
    leg_ids: row.out_leg_ids,
    status: row.out_status as SubmitStatus,
    error_details: row.out_error_details,
  };

  console.log('[V3Submit] Result:', {
    status: result.status,
    ticket_id: result.ticket_id,
    error_count: result.error_details?.length || 0,
  });

  return result;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate a leg before submission
 * Returns array of error messages (empty if valid)
 */
export function validateLeg(leg: V3TicketLeg): string[] {
  const errors: string[] = [];

  if (!leg.event_id) {
    errors.push('Event is required');
  }

  if (!leg.market_type_id) {
    errors.push('Market type is required');
  }

  if (!leg.selection) {
    errors.push('Selection (over/under/etc.) is required');
  }

  // Provider-first path
  if (!leg.isManual && !leg.provider_offer_id) {
    // If not manual and no offer, we need manual fields
    if (!leg.provider) {
      errors.push('Provider is required');
    }
    if (leg.odds === undefined || leg.odds === null) {
      errors.push('Odds are required');
    }
  }

  // Manual path validation
  if (leg.isManual) {
    if (!leg.provider) {
      errors.push('Provider is required for manual entry');
    }
    if (leg.odds === undefined || leg.odds === null) {
      errors.push('Odds are required for manual entry');
    }
  }

  return errors;
}

/**
 * Validate all legs before submission
 */
export function validateLegs(legs: V3TicketLeg[]): Map<string, string[]> {
  const errorsMap = new Map<string, string[]>();

  legs.forEach(leg => {
    const errors = validateLeg(leg);
    if (errors.length > 0) {
      errorsMap.set(leg.id, errors);
    }
  });

  return errorsMap;
}

// ============================================================================
// ERROR FORMATTING
// ============================================================================

/**
 * Format error details from RPC response for display
 */
export function formatErrorDetails(errorDetails: V3SubmitTicketResult['error_details']): string {
  if (!errorDetails || errorDetails.length === 0) {
    return 'Unknown error';
  }

  return errorDetails.map(e => `Leg ${e.leg_index + 1}: ${e.errors.join(', ')}`).join('\n');
}

/**
 * Get errors for a specific leg index
 */
export function getLegErrors(
  errorDetails: V3SubmitTicketResult['error_details'],
  legIndex: number
): string[] {
  if (!errorDetails) return [];

  const legError = errorDetails.find(e => e.leg_index === legIndex);
  return legError?.errors || [];
}
