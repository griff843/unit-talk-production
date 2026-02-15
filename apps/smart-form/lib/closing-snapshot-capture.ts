/**
 * LINE-SNAPSHOTS-FOR-PICKS-001: Closing Snapshot Capture
 *
 * Creates 'closing' type snapshots in line_snapshots for picks
 * that are within 60 minutes of game start.
 *
 * This complements the 'bet' snapshot capture (clv-capture.ts) to provide
 * true CLV measurement: bet snapshot at submission, closing snapshot near game start.
 *
 * IDEMPOTENT: Uses pick_id + snapshot_type unique constraint
 * PORTFOLIO-BASED: Only captures for submitted picks, not full market scan
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface ClosingSnapshotCapture {
  pickId: string;
  sport: string;
  statType: string;
  playerName?: string;
  line: number;
  odds?: number;
  selection: string;
  gameId?: string;
  gameTime?: string;
  sportsbook?: string;
}

export interface ClosingCaptureResult {
  success: boolean;
  snapshotId?: string;
  skipped?: boolean;
  reason?: string;
  error?: string;
}

/**
 * Generate prop reference matching the bet snapshot format
 */
function generatePropRef(capture: ClosingSnapshotCapture): string {
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
 * Capture closing line snapshot for a pick approaching game start.
 *
 * IDEMPOTENT: If closing snapshot already exists for this pick, returns success (no-op)
 * Uses upsert with pick_id + snapshot_type as unique key
 */
export async function captureClosingSnapshot(
  supabase: SupabaseClient,
  capture: ClosingSnapshotCapture,
  logger?: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void }
): Promise<ClosingCaptureResult> {
  const log = logger || console;

  try {
    // Check if closing snapshot already exists
    const { data: existing } = await supabase
      .from('line_snapshots')
      .select('id')
      .eq('pick_id', capture.pickId)
      .eq('snapshot_type', 'closing')
      .single();

    if (existing) {
      log.info(
        { pickId: capture.pickId },
        'CLOSING-CAPTURE: Closing snapshot already exists (idempotent skip)'
      );
      return { success: true, skipped: true, reason: 'already_exists', snapshotId: existing.id };
    }

    const propRef = generatePropRef(capture);

    // Determine over/under odds from selection
    const isOver = capture.selection.toLowerCase().includes('over');
    const isUnder = capture.selection.toLowerCase().includes('under');

    const snapshotData = {
      prop_ref: propRef,
      pick_id: capture.pickId,
      sport: capture.sport,
      stat_type: capture.statType,
      player_name: capture.playerName || 'Unknown',
      sportsbook: capture.sportsbook || 'closing_sweep',
      line: capture.line,
      over_odds: isOver && capture.odds ? capture.odds : null,
      under_odds: isUnder && capture.odds ? capture.odds : null,
      game_time: capture.gameTime || null,
      snapshot_type: 'closing',
    };

    const { data, error } = await supabase
      .from('line_snapshots')
      .insert(snapshotData)
      .select('id')
      .single();

    if (error) {
      // Handle duplicate key (race condition - another process inserted)
      if (error.code === '23505') {
        log.info(
          { pickId: capture.pickId },
          'CLOSING-CAPTURE: Closing snapshot already exists (concurrent insert)'
        );
        return { success: true, skipped: true, reason: 'concurrent_insert' };
      }

      log.warn(
        { error: error.message, pickId: capture.pickId },
        'CLOSING-CAPTURE: Failed to capture closing snapshot'
      );
      return { success: false, error: error.message };
    }

    log.info(
      { pickId: capture.pickId, snapshotId: data.id, line: capture.line },
      'CLOSING-CAPTURE: Closing snapshot created'
    );

    return { success: true, snapshotId: data.id };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    log.warn(
      { error: errorMessage, pickId: capture.pickId },
      'CLOSING-CAPTURE: Exception during closing capture'
    );
    return { success: false, error: errorMessage };
  }
}

/**
 * Batch capture closing snapshots for picks approaching game start.
 */
export async function captureClosingSnapshots(
  supabase: SupabaseClient,
  captures: ClosingSnapshotCapture[],
  logger?: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void }
): Promise<{ captured: number; skipped: number; failed: number }> {
  const log = logger || console;

  if (captures.length === 0) {
    return { captured: 0, skipped: 0, failed: 0 };
  }

  const results = await Promise.allSettled(
    captures.map(capture => captureClosingSnapshot(supabase, capture, logger))
  );

  let captured = 0;
  let skipped = 0;
  let failed = 0;

  for (const result of results) {
    if (result.status === 'fulfilled') {
      if (result.value.success) {
        if (result.value.skipped) {
          skipped++;
        } else {
          captured++;
        }
      } else {
        failed++;
      }
    } else {
      failed++;
    }
  }

  log.info(
    { total: captures.length, captured, skipped, failed },
    'CLOSING-CAPTURE: Batch closing capture complete'
  );

  return { captured, skipped, failed };
}
