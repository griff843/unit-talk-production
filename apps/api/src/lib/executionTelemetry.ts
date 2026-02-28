/* eslint-disable max-lines, max-lines-per-function, max-params */
/**
 * EXECUTION TELEMETRY MODULE
 * Sprint: EXECUTION-TELEMETRY-ACTIVATION-003
 *
 * Canonical execution telemetry for CLV, latency, and slippage tracking.
 * All publish events are logged here for execution alpha measurement.
 *
 * ARCHITECTURE:
 * - BEFORE POST: createExecutionTelemetry() - creates row with 'requested' status
 * - AFTER POST: updateExecutionTelemetryPublished() - updates with receipt + latency
 * - ON FAILURE: updateExecutionTelemetryFailed() - records error
 * - ON SETTLEMENT: updateExecutionTelemetrySettled() - updates CLV
 *
 * IDEMPOTENCY:
 * - Unique constraint on pick_id ensures no duplicates
 * - All operations are idempotent (ON CONFLICT DO UPDATE / safe WHERE clauses)
 *
 * FAIL-OPEN:
 * - Telemetry failures are logged but do not block posting
 * - All methods return success/failure boolean for observability
 */

import { logger } from '../services/logging';

import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// TYPES
// ============================================================================

export type RouteType = 'WEBHOOK' | 'BOT' | 'API';

export type TargetSurface =
  | 'CANARY'
  | 'TRADER_INSIGHTS'
  | 'BEST_BETS'
  | 'STRATEGY_LAB'
  | 'FREE_DAILY_PICKS'
  | 'VIP_LOUNGE'
  | 'INFO_CENTER'
  | 'RECAPS'
  | 'INTERNAL';

export type ClvBucket = 'STRONG_POSITIVE' | 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'STRONG_NEGATIVE';

export type TelemetryStatus = 'requested' | 'published' | 'failed' | 'settled';

export interface CreateTelemetryParams {
  pickId: string;
  routeType?: RouteType;
  targetSurface: TargetSurface;
  targetChannelId?: string | null;
  entryLine?: number | null;
  entryOdds?: number | null;
  entryBook?: string | null;
  publishAttemptId?: string | null;
}

export interface UpdatePublishedParams {
  pickId: string;
  discordMessageId: string;
  publishLatencyMs?: number;
}

export interface UpdateFailedParams {
  pickId: string;
  errorMessage: string;
  executionNotes?: string;
}

export interface UpdateSettledParams {
  pickId: string;
  closingLine?: number | null;
  closingOdds?: number | null;
  clvDelta?: number | null;
  clvBucket?: ClvBucket | null;
}

export interface TelemetryResult {
  success: boolean;
  eventId?: string;
  error?: string;
}

// ============================================================================
// SURFACE RESOLUTION
// ============================================================================

/**
 * Resolve target surface from Discord routing config.
 * Maps DISCORD_MODE + channel to canonical surface name.
 */
export function resolveTargetSurface(
  discordMode: 'canary' | 'production' | null,
  channel?: string | null
): TargetSurface {
  // Canary mode always routes to CANARY surface
  if (discordMode === 'canary') {
    return 'CANARY';
  }

  // Production mode: map channel to surface
  if (channel) {
    const channelUpper = channel.toUpperCase();
    const validSurfaces: TargetSurface[] = [
      'TRADER_INSIGHTS',
      'BEST_BETS',
      'STRATEGY_LAB',
      'FREE_DAILY_PICKS',
      'VIP_LOUNGE',
      'INFO_CENTER',
      'RECAPS',
    ];

    // Direct match
    if (validSurfaces.includes(channelUpper as TargetSurface)) {
      return channelUpper as TargetSurface;
    }
  }

  // Default to CANARY if mode not set or channel not recognized
  return 'CANARY';
}

// ============================================================================
// CLV CALCULATION
// ============================================================================

/**
 * Compute CLV delta (closing vs entry) in a direction-aware manner.
 *
 * For spreads/totals (line-based):
 * - OVER: positive CLV if closing > entry (line moved in our favor)
 * - UNDER: positive CLV if closing < entry (line moved in our favor)
 *
 * For moneylines (odds-based):
 * - Positive CLV if we got better implied probability than closing
 *
 * @param entryLine - Line at time of bet
 * @param closingLine - Line at market close
 * @param entryOdds - Odds at time of bet (American format)
 * @param closingOdds - Odds at market close (American format)
 * @param betSide - 'OVER' | 'UNDER' | 'HOME' | 'AWAY' | null
 * @returns CLV delta as percentage points (e.g., 2.5 = 2.5% CLV)
 */
export function computeClvDelta(
  entryLine: number | null | undefined,
  closingLine: number | null | undefined,
  entryOdds: number | null | undefined,
  closingOdds: number | null | undefined,
  betSide?: string | null
): number | null {
  // Line-based CLV (spreads, totals, player props)
  if (entryLine != null && closingLine != null) {
    const lineDiff = closingLine - entryLine;

    // Direction-aware: OVER bets benefit from line going up
    const side = (betSide || '').toUpperCase();
    if (side === 'UNDER') {
      // UNDER bets benefit from line going down
      return -lineDiff;
    }

    // Default (OVER or unspecified): positive diff is good
    return lineDiff;
  }

  // Odds-based CLV (moneylines)
  if (entryOdds != null && closingOdds != null) {
    const entryProb = oddsToImpliedProb(entryOdds);
    const closingProb = oddsToImpliedProb(closingOdds);

    if (entryProb != null && closingProb != null) {
      // Positive = we got better price than closing
      // (lower implied prob at bet time vs closing)
      return (closingProb - entryProb) * 100;
    }
  }

  return null;
}

/**
 * Convert American odds to implied probability.
 *
 * @param odds - American odds (e.g., -110, +150)
 * @returns Implied probability (0-1)
 */
export function oddsToImpliedProb(odds: number): number | null {
  if (odds === 0) return null;

  if (odds > 0) {
    // Positive odds: 100 / (odds + 100)
    return 100 / (odds + 100);
  } else {
    // Negative odds: |odds| / (|odds| + 100)
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
}

/**
 * Classify CLV delta into buckets for aggregation.
 *
 * @param clvDelta - CLV delta in percentage points
 * @returns CLV bucket classification
 */
export function classifyClvBucket(clvDelta: number | null): ClvBucket | null {
  if (clvDelta == null) return null;

  if (clvDelta > 5) return 'STRONG_POSITIVE';
  if (clvDelta > 2) return 'POSITIVE';
  if (clvDelta >= -2) return 'NEUTRAL';
  if (clvDelta >= -5) return 'NEGATIVE';
  return 'STRONG_NEGATIVE';
}

// ============================================================================
// TELEMETRY OPERATIONS
// ============================================================================

/**
 * Create execution telemetry row BEFORE Discord publish.
 * Idempotent: ON CONFLICT (pick_id) updates existing row.
 *
 * @param supabase - Supabase client
 * @param params - Telemetry creation parameters
 * @returns Result with event ID on success
 */
export async function createExecutionTelemetry(
  supabase: SupabaseClient,
  params: CreateTelemetryParams
): Promise<TelemetryResult> {
  const {
    pickId,
    routeType = 'WEBHOOK',
    targetSurface,
    targetChannelId,
    entryLine,
    entryOdds,
    entryBook,
    publishAttemptId,
  } = params;

  try {
    const { data, error } = await supabase
      .from('execution_events')
      .upsert(
        {
          pick_id: pickId,
          route_type: routeType,
          target_surface: targetSurface,
          target_channel_id: targetChannelId || null,
          entry_line: entryLine ?? null,
          entry_odds: entryOdds ?? null,
          entry_book: entryBook || null,
          publish_attempt_id: publishAttemptId || null,
          publish_requested_at: new Date().toISOString(),
          status: 'requested',
        },
        {
          onConflict: 'pick_id',
          ignoreDuplicates: false,
        }
      )
      .select('id')
      .single();

    if (error) {
      logger.warn(
        { pickId, error: error.message },
        'EXECUTION-TELEMETRY: Failed to create telemetry row (non-blocking)'
      );
      return { success: false, error: error.message };
    }

    logger.debug(
      { pickId, eventId: data.id, targetSurface },
      'EXECUTION-TELEMETRY: Created telemetry row'
    );

    return { success: true, eventId: data.id };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    logger.warn(
      { pickId, error: errorMsg },
      'EXECUTION-TELEMETRY: Exception creating telemetry (non-blocking)'
    );
    return { success: false, error: errorMsg };
  }
}

/**
 * Update execution telemetry on successful Discord publish.
 * Records receipt (message_id) and latency.
 *
 * @param supabase - Supabase client
 * @param params - Update parameters
 * @returns Result indicating success
 */
export async function updateExecutionTelemetryPublished(
  supabase: SupabaseClient,
  params: UpdatePublishedParams
): Promise<TelemetryResult> {
  const { pickId, discordMessageId, publishLatencyMs } = params;

  try {
    const { data, error } = await supabase
      .from('execution_events')
      .update({
        published_at: new Date().toISOString(),
        discord_message_id: discordMessageId,
        publish_latency_ms: publishLatencyMs ?? null,
        status: 'published',
      })
      .eq('pick_id', pickId)
      .eq('status', 'requested')
      .select('id')
      .maybeSingle();

    if (error) {
      logger.warn(
        { pickId, error: error.message },
        'EXECUTION-TELEMETRY: Failed to update published status (non-blocking)'
      );
      return { success: false, error: error.message };
    }

    if (!data) {
      // Row might not exist or already published - not an error
      logger.debug(
        { pickId },
        'EXECUTION-TELEMETRY: No matching row to update (already published or missing)'
      );
      return { success: true };
    }

    logger.debug(
      { pickId, eventId: data.id, discordMessageId, publishLatencyMs },
      'EXECUTION-TELEMETRY: Updated with publish receipt'
    );

    return { success: true, eventId: data.id };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    logger.warn(
      { pickId, error: errorMsg },
      'EXECUTION-TELEMETRY: Exception updating published status (non-blocking)'
    );
    return { success: false, error: errorMsg };
  }
}

/**
 * Update execution telemetry on publish failure.
 * Records error message for debugging.
 *
 * @param supabase - Supabase client
 * @param params - Failure parameters
 * @returns Result indicating success
 */
export async function updateExecutionTelemetryFailed(
  supabase: SupabaseClient,
  params: UpdateFailedParams
): Promise<TelemetryResult> {
  const { pickId, errorMessage, executionNotes } = params;

  try {
    const { data, error } = await supabase
      .from('execution_events')
      .update({
        status: 'failed',
        error_message: errorMessage,
        execution_notes: executionNotes || null,
      })
      .eq('pick_id', pickId)
      .in('status', ['requested', 'failed'])
      .select('id')
      .maybeSingle();

    if (error) {
      logger.warn(
        { pickId, error: error.message },
        'EXECUTION-TELEMETRY: Failed to update failure status (non-blocking)'
      );
      return { success: false, error: error.message };
    }

    if (data) {
      logger.debug(
        { pickId, eventId: data.id, errorMessage },
        'EXECUTION-TELEMETRY: Updated with failure status'
      );
    }

    return { success: true, eventId: data?.id };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    logger.warn(
      { pickId, error: errorMsg },
      'EXECUTION-TELEMETRY: Exception updating failure status (non-blocking)'
    );
    return { success: false, error: errorMsg };
  }
}

/**
 * Update execution telemetry on settlement with CLV data.
 * Called after pick is settled to record closing line and CLV.
 *
 * @param supabase - Supabase client
 * @param params - Settlement parameters
 * @returns Result indicating success
 */
export async function updateExecutionTelemetrySettled(
  supabase: SupabaseClient,
  params: UpdateSettledParams
): Promise<TelemetryResult> {
  const { pickId, closingLine, closingOdds, clvDelta, clvBucket } = params;

  try {
    const { data, error } = await supabase
      .from('execution_events')
      .update({
        closing_line: closingLine ?? null,
        closing_odds: closingOdds ?? null,
        clv_delta: clvDelta ?? null,
        clv_bucket: clvBucket ?? null,
        status: 'settled',
      })
      .eq('pick_id', pickId)
      .in('status', ['published', 'settled'])
      .select('id')
      .maybeSingle();

    if (error) {
      logger.warn(
        { pickId, error: error.message },
        'EXECUTION-TELEMETRY: Failed to update settlement CLV (non-blocking)'
      );
      return { success: false, error: error.message };
    }

    if (data) {
      logger.debug(
        { pickId, eventId: data.id, clvDelta, clvBucket },
        'EXECUTION-TELEMETRY: Updated with settlement CLV'
      );
    }

    return { success: true, eventId: data?.id };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    logger.warn(
      { pickId, error: errorMsg },
      'EXECUTION-TELEMETRY: Exception updating settlement CLV (non-blocking)'
    );
    return { success: false, error: errorMsg };
  }
}

// ============================================================================
// CONVENIENCE WRAPPER FOR SETTLEMENT
// ============================================================================

/**
 * Compute and store CLV on settlement.
 * Combines CLV calculation with telemetry update.
 *
 * @param supabase - Supabase client
 * @param pickId - Pick ID
 * @param entryLine - Line at bet time
 * @param closingLine - Closing line
 * @param entryOdds - Odds at bet time
 * @param closingOdds - Closing odds
 * @param betSide - Bet side (OVER/UNDER/HOME/AWAY)
 */
export async function settleExecutionTelemetry(
  supabase: SupabaseClient,
  pickId: string,
  entryLine: number | null | undefined,
  closingLine: number | null | undefined,
  entryOdds: number | null | undefined,
  closingOdds: number | null | undefined,
  betSide?: string | null
): Promise<TelemetryResult> {
  // Compute CLV
  const clvDelta = computeClvDelta(entryLine, closingLine, entryOdds, closingOdds, betSide);
  const clvBucket = classifyClvBucket(clvDelta);

  // Update telemetry
  return updateExecutionTelemetrySettled(supabase, {
    pickId,
    closingLine: closingLine ?? null,
    closingOdds: closingOdds ?? null,
    clvDelta,
    clvBucket,
  });
}

// ============================================================================
// OBSERVABILITY
// ============================================================================

/**
 * Check for picks missing execution telemetry (after deployment).
 * Returns count of missing rows for alerting.
 *
 * @param supabase - Supabase client
 * @param since - Check picks posted after this time
 */
export async function checkMissingTelemetry(
  supabase: SupabaseClient,
  since: Date = new Date(Date.now() - 24 * 60 * 60 * 1000)
): Promise<{ count: number; pickIds: string[] }> {
  try {
    const { data, error } = await supabase.rpc('check_missing_execution_telemetry', {
      p_since: since.toISOString(),
    });

    if (error) {
      logger.warn(
        { error: error.message },
        'EXECUTION-TELEMETRY: Failed to check missing telemetry'
      );
      return { count: -1, pickIds: [] };
    }

    const pickIds = (data || []).map((row: { pick_id: string }) => row.pick_id);
    return { count: pickIds.length, pickIds };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    logger.warn({ error: errorMsg }, 'EXECUTION-TELEMETRY: Exception checking missing telemetry');
    return { count: -1, pickIds: [] };
  }
}
