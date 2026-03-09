/**
 * CLV Compute Service
 * Sprint: SPRINT-025-CLV-CLOSING-SNAPSHOT
 *
 * Computes Closing Line Value (CLV) per pick using closing snapshots.
 * CLV = p_close_market_devig - p_entry_market_devig
 *
 * INVARIANTS:
 * - Single-writer: CLVAgent writes to clv_results only
 * - Idempotent: UNIQUE(pick_id, model_version, close_kind), ON CONFLICT DO NOTHING
 * - Fail-closed: missing close or entry data → reason-coded, clv_prob = 0
 * - clv_prob always in [-1, 1] (DB CHECK constraint)
 * - Does NOT write to unified_picks (separate table)
 */

import { calculateCLVProb, PROBABILITY_MODEL_VERSION } from '../lib/probability/devigConsensus';
import { createLogger } from '../utils/logger';

import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CLV_FEATURE_SET_VERSION = 'clv_v1.0.0_consensus_close';
const DEFAULT_CLOSE_KIND = 'CLOSE_FINAL';
const MIN_BOOKS_CLV = 3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CloseKind = 'CLOSE_T_MINUS_5' | 'CLOSE_T_MINUS_1' | 'CLOSE_FINAL';

export type CLVReasonCode =
  | 'MISSING_CLOSE'
  | 'NO_ENTRY_DEVIG'
  | 'INSUFFICIENT_BOOKS'
  | 'SIDE_UNKNOWN';

export interface CLVComputeOptions {
  closeKind?: CloseKind;
  limit?: number;
}

export interface CLVComputeResult {
  total_picks_scanned: number;
  already_computed: number;
  computed: number;
  reason_coded: number;
  errors: Array<{ pick_id: string; error: string }>;
  results: CLVResultRow[];
}

export interface CLVResultRow {
  pick_id: string;
  model_version: string;
  feature_set_version: string;
  close_kind: string;
  book_count: number;
  p_entry_market_devig: number | null;
  p_close_market_devig: number | null;
  clv_prob: number;
  reason_code: string | null;
}

interface PickRow {
  id: string;
  event_id: string | null;
  participant_id: string | null;
  market_type_id: number | null;
  prediction: string | null;
  meta: Record<string, unknown> | null;
  side: string | null;
}

interface ClosingSnapshotRow {
  market_key: string;
  p_close_over: number;
  p_close_under: number;
  book_count: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const logger = createLogger('CLVComputeService');

export class CLVComputeService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Compute CLV for picks that have explain_v3 data and matching closing snapshots.
   * Idempotent: skips picks already in clv_results for this model_version + close_kind.
   */
  async computeCLV(options: CLVComputeOptions = {}): Promise<CLVComputeResult> {
    const { closeKind = DEFAULT_CLOSE_KIND, limit = 500 } = options;

    const modelVersion = PROBABILITY_MODEL_VERSION;

    logger.info('Starting CLV computation', { closeKind, modelVersion, limit });

    // Step 1: Fetch picks with scoring data
    const picks = await this.fetchScoredPicks(limit);
    if (picks.length === 0) {
      logger.warn('No scored picks found');
      return {
        total_picks_scanned: 0,
        already_computed: 0,
        computed: 0,
        reason_coded: 0,
        errors: [],
        results: [],
      };
    }

    // Step 2: Fetch existing clv_results to skip already-computed
    const existingPickIds = await this.fetchExistingCLVPickIds(modelVersion, closeKind);

    const uncomputed = picks.filter(p => !existingPickIds.has(p.id));
    const alreadyComputed = picks.length - uncomputed.length;

    logger.info(
      `Picks: ${picks.length} total, ${alreadyComputed} already computed, ${uncomputed.length} to process`
    );

    // Step 3: Fetch all relevant closing snapshots
    const eventIds = [...new Set(uncomputed.map(p => p.event_id).filter(Boolean))] as string[];
    const snapshots = await this.fetchClosingSnapshots(eventIds);

    // Step 4: Compute CLV for each uncomputed pick
    const results: CLVResultRow[] = [];
    const errors: Array<{ pick_id: string; error: string }> = [];
    let reasonCoded = 0;

    for (const pick of uncomputed) {
      try {
        const result = this.computePickCLV(pick, snapshots, modelVersion, closeKind);
        results.push(result);
        if (result.reason_code) reasonCoded++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ pick_id: pick.id, error: msg });
      }
    }

    // Step 5: Batch insert into clv_results (ON CONFLICT DO NOTHING)
    const inserted = await this.batchInsertCLVResults(results);

    logger.info(
      `CLV computation complete: ${inserted} inserted, ${reasonCoded} reason-coded, ${errors.length} errors`
    );

    return {
      total_picks_scanned: picks.length,
      already_computed: alreadyComputed,
      computed: inserted,
      reason_coded: reasonCoded,
      errors,
      results,
    };
  }

  // =========================================================================
  // Data fetch
  // =========================================================================

  private async fetchScoredPicks(limit: number): Promise<PickRow[]> {
    // unified_picks uses game_id (not event_id) and player_id (not participant_id)
    // and has no market_type_id column — market info comes from meta
    const { data, error } = await this.supabase
      .from('unified_picks')
      .select('id, game_id, player_id, side, meta')
      .not('meta', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to fetch scored picks', { error: error.message });
      return [];
    }

    // Map to PickRow, extracting event linkage from meta if available
    return ((data ?? []) as Array<Record<string, unknown>>)
      .filter(p => {
        const meta = p['meta'] as Record<string, unknown> | null;
        if (!meta) return false;
        return meta['explain_v3'] != null || meta['shadow_v3'] != null;
      })
      .map(p => {
        const meta = p['meta'] as Record<string, unknown>;
        const shadowV3 = meta['shadow_v3'] as Record<string, unknown> | undefined;

        // Extract event_id from shadow_v3 market_key if available
        let eventId: string | null = null;
        let participantId: string | null = null;
        let marketTypeId: number | null = null;

        if (shadowV3?.['market_key']) {
          const parts = (shadowV3['market_key'] as string).split('|');
          if (parts.length >= 2) {
            eventId = parts[0];
            marketTypeId = parseInt(parts[1], 10) || null;
            participantId = parts[2] === 'null' ? null : (parts[2] ?? null);
          }
        }

        // Fallback to game_id
        if (!eventId && p['game_id']) {
          eventId = String(p['game_id']);
        }

        return {
          id: String(p['id']),
          event_id: eventId,
          participant_id: participantId ?? (p['player_id'] ? String(p['player_id']) : null),
          market_type_id: marketTypeId,
          prediction: (p['side'] as string) ?? null,
          meta,
          side: (p['side'] as string) ?? null,
        };
      });
  }

  private async fetchExistingCLVPickIds(
    modelVersion: string,
    closeKind: string
  ): Promise<Set<string>> {
    const { data, error } = await this.supabase
      .from('clv_results')
      .select('pick_id')
      .eq('model_version', modelVersion)
      .eq('close_kind', closeKind);

    if (error) {
      logger.warn('Failed to fetch existing CLV results', { error: error.message });
      return new Set();
    }

    return new Set((data ?? []).map((r: { pick_id: string }) => r.pick_id));
  }

  private async fetchClosingSnapshots(
    eventIds: string[]
  ): Promise<Map<string, ClosingSnapshotRow>> {
    if (eventIds.length === 0) return new Map();

    const { data, error } = await this.supabase
      .from('closing_snapshots')
      .select('market_key, p_close_over, p_close_under, book_count')
      .in('event_id', eventIds);

    if (error) {
      logger.warn('Failed to fetch closing snapshots', { error: error.message });
      return new Map();
    }

    const map = new Map<string, ClosingSnapshotRow>();
    for (const row of (data ?? []) as ClosingSnapshotRow[]) {
      map.set(row.market_key, row);
    }
    return map;
  }

  // =========================================================================
  // Per-pick CLV computation
  // =========================================================================

  computePickCLV(
    pick: PickRow,
    snapshots: Map<string, ClosingSnapshotRow>,
    modelVersion: string,
    closeKind: string
  ): CLVResultRow {
    const base: Omit<
      CLVResultRow,
      'clv_prob' | 'reason_code' | 'book_count' | 'p_entry_market_devig' | 'p_close_market_devig'
    > = {
      pick_id: pick.id,
      model_version: modelVersion,
      feature_set_version: CLV_FEATURE_SET_VERSION,
      close_kind: closeKind,
    };

    // Extract entry probability from meta
    const pEntryMarketDevig = this.extractEntryDevig(pick);
    if (pEntryMarketDevig == null) {
      return {
        ...base,
        book_count: 0,
        p_entry_market_devig: null,
        p_close_market_devig: null,
        clv_prob: 0,
        reason_code: 'NO_ENTRY_DEVIG',
      };
    }

    // Find closing snapshot for this pick's market
    const marketKey = this.buildMarketKey(pick);
    if (!marketKey) {
      return {
        ...base,
        book_count: 0,
        p_entry_market_devig: pEntryMarketDevig,
        p_close_market_devig: null,
        clv_prob: 0,
        reason_code: 'MISSING_CLOSE',
      };
    }

    const snapshot = snapshots.get(marketKey);
    if (!snapshot) {
      return {
        ...base,
        book_count: 0,
        p_entry_market_devig: pEntryMarketDevig,
        p_close_market_devig: null,
        clv_prob: 0,
        reason_code: 'MISSING_CLOSE',
      };
    }

    // Check book count
    if (snapshot.book_count < MIN_BOOKS_CLV) {
      return {
        ...base,
        book_count: snapshot.book_count,
        p_entry_market_devig: pEntryMarketDevig,
        p_close_market_devig: null,
        clv_prob: 0,
        reason_code: 'INSUFFICIENT_BOOKS',
      };
    }

    // Determine close probability based on pick side
    const pCloseMarketDevig = this.extractCloseProbability(pick, snapshot);
    if (pCloseMarketDevig == null) {
      return {
        ...base,
        book_count: snapshot.book_count,
        p_entry_market_devig: pEntryMarketDevig,
        p_close_market_devig: null,
        clv_prob: 0,
        reason_code: 'SIDE_UNKNOWN',
      };
    }

    // Compute CLV
    const clvProb = calculateCLVProb(pEntryMarketDevig, pCloseMarketDevig);

    // Clamp to [-1, 1] for DB constraint safety
    const clampedCLV = Math.max(-1, Math.min(1, clvProb));

    return {
      ...base,
      book_count: snapshot.book_count,
      p_entry_market_devig: pEntryMarketDevig,
      p_close_market_devig: pCloseMarketDevig,
      clv_prob: clampedCLV,
      reason_code: null,
    };
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private extractEntryDevig(pick: PickRow): number | null {
    const meta = pick.meta;
    if (!meta) return null;

    // Try explain_v3 first (Sprint 024 syndicate layer)
    const explainV3 = meta['explain_v3'] as Record<string, unknown> | undefined;
    if (explainV3 && typeof explainV3['p_market_devig'] === 'number') {
      return explainV3['p_market_devig'] as number;
    }

    // Try shadow_v3 (Sprint 022 shadow scoring)
    const shadowV3 = meta['shadow_v3'] as Record<string, unknown> | undefined;
    if (shadowV3 && typeof shadowV3['p_market_devig'] === 'number') {
      return shadowV3['p_market_devig'] as number;
    }

    return null;
  }

  private buildMarketKey(pick: PickRow): string | null {
    if (!pick.event_id || pick.market_type_id == null) return null;
    return `${pick.event_id}|${pick.market_type_id}|${pick.participant_id ?? 'null'}`;
  }

  private extractCloseProbability(pick: PickRow, snapshot: ClosingSnapshotRow): number | null {
    // Use side field (unified_picks column) or prediction
    const side = (pick.side ?? pick.prediction)?.toLowerCase();
    if (!side) return null;

    // Map side to over/under
    if (side === 'over' || side === 'yes' || side === 'home') {
      return snapshot.p_close_over;
    }
    if (side === 'under' || side === 'no' || side === 'away') {
      return snapshot.p_close_under;
    }

    // Default: treat as "over" side (first side)
    return snapshot.p_close_over;
  }

  // =========================================================================
  // Batch insert (idempotent)
  // =========================================================================

  private async batchInsertCLVResults(results: CLVResultRow[]): Promise<number> {
    if (results.length === 0) return 0;

    let inserted = 0;
    // Insert in batches of 50
    const batchSize = 50;

    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      const rows = batch.map(r => ({
        pick_id: r.pick_id,
        model_version: r.model_version,
        feature_set_version: r.feature_set_version,
        close_kind: r.close_kind,
        book_count: r.book_count,
        p_entry_market_devig: r.p_entry_market_devig,
        p_close_market_devig: r.p_close_market_devig,
        clv_prob: r.clv_prob,
        reason_code: r.reason_code,
        meta: null,
      }));

      const { error } = await this.supabase.from('clv_results').upsert(rows, {
        onConflict: 'pick_id,model_version,close_kind',
        ignoreDuplicates: true,
      });

      if (error) {
        logger.warn(`Failed to insert CLV batch at offset ${i}`, {
          error: error.message,
        });
      } else {
        inserted += batch.length;
      }
    }

    return inserted;
  }
}
