/**
 * CLV Phase 1: Bet Line Capture Helper
 *
 * Captures line snapshots at bet submission time for CLV tracking.
 * This lightweight helper writes directly to line_snapshots table
 * consistent with the existing direct Supabase pattern in submit-ticket.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface BetLineCapture {
  pickId: string;
  sport: string;
  statType: string;
  playerName?: string;
  line: number;
  odds: number;
  selection: string;
  gameId?: string;
  gameTime?: string;
  sportsbook?: string;
}

export interface CaptureResult {
  success: boolean;
  snapshotId?: string;
  error?: string;
}

/**
 * Generate a prop reference for CLV tracking.
 * For picks without a matching raw_prop, we generate a composite key.
 */
function generatePropRef(capture: BetLineCapture): string {
  // Create a deterministic prop reference from pick characteristics
  const parts = [
    capture.sport.toLowerCase(),
    capture.statType.toLowerCase().replace(/\s+/g, '_'),
    capture.playerName?.toLowerCase().replace(/\s+/g, '_') || 'unknown',
    capture.line.toString(),
    capture.gameId || 'manual',
  ];
  return parts.join('|');
}

/**
 * Capture bet line snapshot for a submitted pick.
 * This creates a 'bet' type snapshot in line_snapshots for CLV tracking.
 *
 * Non-blocking: failures are logged but don't stop submission flow.
 */
export async function captureBetLineSnapshot(
  supabase: SupabaseClient,
  capture: BetLineCapture,
  logger?: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void }
): Promise<CaptureResult> {
  const log = logger || console;

  try {
    const propRef = generatePropRef(capture);

    // Determine over/under odds from selection and odds
    const isOver = capture.selection.toLowerCase().includes('over');
    const isUnder = capture.selection.toLowerCase().includes('under');

    const snapshotData = {
      prop_ref: propRef,
      pick_id: capture.pickId,
      sport: capture.sport,
      stat_type: capture.statType,
      player_name: capture.playerName || 'Unknown',
      sportsbook: capture.sportsbook || 'submitted',
      line: capture.line,
      over_odds: isOver ? capture.odds : null,
      under_odds: isUnder ? capture.odds : null,
      game_time: capture.gameTime || null,
      snapshot_type: 'bet',
    };

    const { data, error } = await supabase
      .from('line_snapshots')
      .insert(snapshotData)
      .select('id')
      .single();

    if (error) {
      // Duplicate key errors are OK (already captured)
      if (error.code === '23505') {
        log.info(
          { pickId: capture.pickId, propRef },
          'CLV-CAPTURE: Bet snapshot already exists'
        );
        return { success: true };
      }

      log.warn(
        { error: error.message, pickId: capture.pickId },
        'CLV-CAPTURE: Failed to capture bet line snapshot'
      );
      return { success: false, error: error.message };
    }

    log.info(
      { pickId: capture.pickId, snapshotId: data.id, propRef, line: capture.line },
      'CLV-CAPTURE: Bet line snapshot captured'
    );

    return { success: true, snapshotId: data.id };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    log.warn(
      { error: errorMessage, pickId: capture.pickId },
      'CLV-CAPTURE: Exception during bet line capture'
    );
    return { success: false, error: errorMessage };
  }
}

/**
 * Batch capture bet line snapshots for multiple picks.
 * Used after unified_picks insert returns the pick IDs.
 */
export async function captureBetLineSnapshots(
  supabase: SupabaseClient,
  captures: BetLineCapture[],
  logger?: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void }
): Promise<{ captured: number; failed: number }> {
  const log = logger || console;

  if (captures.length === 0) {
    return { captured: 0, failed: 0 };
  }

  // Process in parallel but don't fail the overall submission
  const results = await Promise.allSettled(
    captures.map(capture => captureBetLineSnapshot(supabase, capture, logger))
  );

  const captured = results.filter(
    r => r.status === 'fulfilled' && r.value.success
  ).length;
  const failed = results.length - captured;

  log.info(
    { total: captures.length, captured, failed },
    'CLV-CAPTURE: Batch bet line capture complete'
  );

  return { captured, failed };
}
