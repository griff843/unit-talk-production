/**
 * V3 Ticket Submission for Smart Form
 *
 * SPRINT-END-TO-END-TICKET-LIFECYCLE-TRUTH-093 (routing status check)
 * SPRINT-SMARTFORM-UX-REBUILD-080 (original)
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
// DISCORD ROUTING STATUS (SPRINT-093)
// ============================================================================

export interface DiscordRoutingStatus {
  success: boolean;
  routing: {
    channel_from_db: boolean;
    channel_from_env: boolean;
    channel_id_resolved: boolean;
    webhook_configured: boolean;
  };
  worker: {
    configured: boolean;
    healthy: boolean;
    health_status: 'healthy' | 'degraded' | 'unhealthy';
    worker_id: string | null;
    last_heartbeat_at: string | null;
    heartbeat_age_seconds: number | null;
    recent_error: {
      message: string | null;
      timestamp: string | null;
    };
  };
  queue: {
    pending_count: number;
    processing_count: number;
    posted_count: number;
    failed_count: number;
  };
  activity: {
    last_post_at: string | null;
    items_processed_total: number;
  };
  overall_health: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  error?: string;
}

/**
 * Check Discord routing status before submission.
 * Used to show early warning if Discord pipeline is unhealthy.
 *
 * @returns DiscordRoutingStatus with overall_health indicator
 */
export async function checkDiscordRoutingStatus(): Promise<DiscordRoutingStatus> {
  const unhealthyFallback: DiscordRoutingStatus = {
    success: false,
    routing: {
      channel_from_db: false,
      channel_from_env: false,
      channel_id_resolved: false,
      webhook_configured: false,
    },
    worker: {
      configured: false,
      healthy: false,
      health_status: 'unhealthy',
      worker_id: null,
      last_heartbeat_at: null,
      heartbeat_age_seconds: null,
      recent_error: { message: null, timestamp: null },
    },
    queue: { pending_count: 0, processing_count: 0, posted_count: 0, failed_count: 0 },
    activity: { last_post_at: null, items_processed_total: 0 },
    overall_health: 'unhealthy',
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch('/api/ops/discord-routing-status', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      // Timeout after 5 seconds
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.warn('[RoutingStatus] API returned non-OK status:', res.status);
      return { ...unhealthyFallback, error: `Status ${res.status}` };
    }

    const data: DiscordRoutingStatus = await res.json();
    console.log('[RoutingStatus] Discord routing status:', {
      overall_health: data.overall_health,
      channel_resolved: data.routing?.channel_id_resolved,
      worker_healthy: data.worker?.healthy,
    });

    return data;
  } catch (err) {
    console.error('[RoutingStatus] Failed to check routing status:', err);
    return {
      ...unhealthyFallback,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Get a human-readable message for routing status
 */
export function getRoutingStatusMessage(status: DiscordRoutingStatus): string | null {
  if (status.overall_health === 'healthy') {
    return null;
  }

  const issues: string[] = [];

  if (!status.routing?.channel_id_resolved) {
    issues.push('Discord channel not configured');
  }
  if (!status.routing?.webhook_configured) {
    issues.push('Discord webhook not configured');
  }
  if (!status.worker?.configured) {
    issues.push('Discord worker not enabled');
  }
  if (status.worker?.configured && !status.worker?.healthy) {
    issues.push('Discord worker not responding');
  }
  if (status.queue?.failed_count > 0) {
    issues.push(`${status.queue.failed_count} pending failures in queue`);
  }

  if (issues.length === 0) {
    return 'Discord pipeline status unknown';
  }

  return issues.join('. ');
}

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
  // Manual entry legs (with sport/bet_type) are passed through directly
  // Catalog legs (with event_id) use buildLegPayload for transformation
  const legPayloads = input.legs.map(leg => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyLeg = leg as any;
    // Manual entry: has sport and bet_type, pass through directly
    if (anyLeg.sport && anyLeg.bet_type) {
      return anyLeg;
    }
    // Catalog entry: has event_id, use as-is or transform
    if (leg.event_id) {
      return leg;
    }
    // Fallback to buildLegPayload for structured catalog legs
    return buildLegPayload(leg as unknown as V3TicketLeg);
  });

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

  // SPRINT-092: Enqueue Discord publish via API endpoint (server-side channel routing)
  // Fail-closed: only enqueue on 'inserted' status, not 'exists' or 'error'
  if (result.status === 'inserted' && result.ticket_id) {
    try {
      // Call server-side API to enqueue with channel routing
      const enqueueRes = await fetch('/api/discord-outbox/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: result.ticket_id,
          bet_slip_id: input.bet_slip_id,
        }),
      });

      const enqueueData = await enqueueRes.json();

      if (enqueueData.success) {
        console.log('[V3Submit] Discord outbox enqueued:', {
          ticket_id: result.ticket_id,
          outbox_id: enqueueData.outbox_id,
          status: enqueueData.status,
        });
      } else {
        // Log routing failure but don't fail submission
        console.warn('[V3Submit] Discord outbox enqueue failed (ROUTE_MISSING):', {
          ticket_id: result.ticket_id,
          error_code: enqueueData.error_code,
          error_message: enqueueData.error_message,
        });
      }
    } catch (enqueueErr) {
      // Log but don't fail submission - Discord publish is secondary
      console.error('[V3Submit] Failed to enqueue Discord outbox:', enqueueErr);
    }
  }

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

  // Manual entry mode: different validation
  if (leg.isManual) {
    // Manual mode requires: sport, bet_type, matchup, selection, provider, odds
    if (!leg.provider) {
      errors.push('Provider is required for manual entry');
    }
    if (leg.odds === undefined || leg.odds === null) {
      errors.push('Odds are required for manual entry');
    }
    if (!leg.selection) {
      errors.push('Selection is required');
    }
    return errors;
  }

  // Catalog mode validation
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
  if (!leg.provider_offer_id) {
    // If not manual and no offer, we need manual fields
    if (!leg.provider) {
      errors.push('Provider is required');
    }
    if (leg.odds === undefined || leg.odds === null) {
      errors.push('Odds are required');
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
