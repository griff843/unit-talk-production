/**
 * Tests for CLVComputeService
 * Sprint: SPRINT-025-CLV-CLOSING-SNAPSHOT
 */

import { describe, it, expect } from 'vitest';

import { CLVComputeService } from '../CLVComputeService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePick(
  id: string,
  prediction: string,
  pMarketDevig: number | null,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const meta: Record<string, unknown> = {};
  if (pMarketDevig != null) {
    meta['explain_v3'] = { p_market_devig: pMarketDevig, edge_final: 0.02 };
  }
  if (overrides['meta']) {
    Object.assign(meta, overrides['meta'] as Record<string, unknown>);
    delete overrides['meta'];
  }

  return {
    id,
    event_id: 'event-1',
    participant_id: 'player-1',
    market_type_id: 2,
    prediction,
    meta: Object.keys(meta).length > 0 ? meta : null,
    ...overrides,
  };
}

function makeSnapshot(
  marketKey: string,
  pCloseOver: number,
  pCloseUnder: number,
  bookCount: number = 4
) {
  return {
    market_key: marketKey,
    p_close_over: pCloseOver,
    p_close_under: pCloseUnder,
    book_count: bookCount,
  };
}

const mockSupabase = {} as import('@supabase/supabase-js').SupabaseClient;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CLVComputeService', () => {
  describe('computePickCLV', () => {
    const service = new CLVComputeService(mockSupabase);
    const modelVersion = 'prob_v2.0.0_syndicate_layered';
    const closeKind = 'CLOSE_FINAL';

    it('computes positive CLV (closing line moved toward pick)', () => {
      const pick = makePick('pick-1', 'over', 0.55);
      const snapshots = new Map([
        ['event-1|2|player-1', makeSnapshot('event-1|2|player-1', 0.58, 0.42)],
      ]);

      const result = service.computePickCLV(pick as any, snapshots, modelVersion, closeKind);

      expect(result.reason_code).toBeNull();
      expect(result.clv_prob).toBeCloseTo(0.03, 4); // 0.58 - 0.55
      expect(result.p_entry_market_devig).toBe(0.55);
      expect(result.p_close_market_devig).toBe(0.58);
      expect(result.book_count).toBe(4);
    });

    it('computes negative CLV (closing line moved against pick)', () => {
      const pick = makePick('pick-2', 'over', 0.55);
      const snapshots = new Map([
        ['event-1|2|player-1', makeSnapshot('event-1|2|player-1', 0.52, 0.48)],
      ]);

      const result = service.computePickCLV(pick as any, snapshots, modelVersion, closeKind);

      expect(result.reason_code).toBeNull();
      expect(result.clv_prob).toBeCloseTo(-0.03, 4); // 0.52 - 0.55
    });

    it('computes zero CLV when entry equals close', () => {
      const pick = makePick('pick-3', 'over', 0.55);
      const snapshots = new Map([
        ['event-1|2|player-1', makeSnapshot('event-1|2|player-1', 0.55, 0.45)],
      ]);

      const result = service.computePickCLV(pick as any, snapshots, modelVersion, closeKind);

      expect(result.reason_code).toBeNull();
      expect(result.clv_prob).toBe(0);
    });

    it('uses under probability for under picks', () => {
      const pick = makePick('pick-4', 'under', 0.45);
      const snapshots = new Map([
        ['event-1|2|player-1', makeSnapshot('event-1|2|player-1', 0.52, 0.48)],
      ]);

      const result = service.computePickCLV(pick as any, snapshots, modelVersion, closeKind);

      expect(result.reason_code).toBeNull();
      // Under pick: p_close_under=0.48 - p_entry=0.45 = +0.03
      expect(result.clv_prob).toBeCloseTo(0.03, 4);
      expect(result.p_close_market_devig).toBe(0.48);
    });

    it('reason-codes MISSING_CLOSE when no snapshot found', () => {
      const pick = makePick('pick-5', 'over', 0.55);
      const snapshots = new Map<string, any>(); // Empty

      const result = service.computePickCLV(pick as any, snapshots, modelVersion, closeKind);

      expect(result.reason_code).toBe('MISSING_CLOSE');
      expect(result.clv_prob).toBe(0);
      expect(result.p_close_market_devig).toBeNull();
    });

    it('reason-codes NO_ENTRY_DEVIG when pick has no explain_v3', () => {
      const pick = {
        id: 'pick-6',
        event_id: 'event-1',
        participant_id: 'player-1',
        market_type_id: 2,
        prediction: 'over',
        meta: {},
      };
      const snapshots = new Map([
        ['event-1|2|player-1', makeSnapshot('event-1|2|player-1', 0.55, 0.45)],
      ]);

      const result = service.computePickCLV(pick as any, snapshots, modelVersion, closeKind);

      expect(result.reason_code).toBe('NO_ENTRY_DEVIG');
      expect(result.clv_prob).toBe(0);
    });

    it('reason-codes INSUFFICIENT_BOOKS when snapshot has < 3 books', () => {
      const pick = makePick('pick-7', 'over', 0.55);
      const snapshots = new Map([
        ['event-1|2|player-1', makeSnapshot('event-1|2|player-1', 0.58, 0.42, 2)],
      ]);

      const result = service.computePickCLV(pick as any, snapshots, modelVersion, closeKind);

      expect(result.reason_code).toBe('INSUFFICIENT_BOOKS');
      expect(result.clv_prob).toBe(0);
    });

    it('reason-codes MISSING_CLOSE when market key cannot be built', () => {
      const pick = makePick('pick-8', 'over', 0.55, {
        event_id: null,
      });
      const snapshots = new Map([
        ['event-1|2|player-1', makeSnapshot('event-1|2|player-1', 0.58, 0.42)],
      ]);

      const result = service.computePickCLV(pick as any, snapshots, modelVersion, closeKind);

      expect(result.reason_code).toBe('MISSING_CLOSE');
      expect(result.clv_prob).toBe(0);
    });

    it('clv_prob is bounded to [-1, 1]', () => {
      // This is mostly for safety — in practice clv_prob should never exceed these
      const pick = makePick('pick-9', 'over', 0.01);
      const snapshots = new Map([
        ['event-1|2|player-1', makeSnapshot('event-1|2|player-1', 0.99, 0.01)],
      ]);

      const result = service.computePickCLV(pick as any, snapshots, modelVersion, closeKind);

      expect(result.reason_code).toBeNull();
      expect(result.clv_prob).toBeLessThanOrEqual(1);
      expect(result.clv_prob).toBeGreaterThanOrEqual(-1);
      expect(result.clv_prob).toBeCloseTo(0.98, 2); // 0.99 - 0.01
    });

    it('extracts entry devig from shadow_v3 as fallback', () => {
      const pick = {
        id: 'pick-10',
        event_id: 'event-1',
        participant_id: 'player-1',
        market_type_id: 2,
        prediction: 'over',
        meta: {
          shadow_v3: { p_market_devig: 0.6 },
        },
      };
      const snapshots = new Map([
        ['event-1|2|player-1', makeSnapshot('event-1|2|player-1', 0.63, 0.37)],
      ]);

      const result = service.computePickCLV(pick as any, snapshots, modelVersion, closeKind);

      expect(result.reason_code).toBeNull();
      expect(result.clv_prob).toBeCloseTo(0.03, 4);
      expect(result.p_entry_market_devig).toBe(0.6);
    });

    it('handles yes/no prediction mapping', () => {
      const pick = makePick('pick-11', 'yes', 0.55);
      const snapshots = new Map([
        ['event-1|2|player-1', makeSnapshot('event-1|2|player-1', 0.6, 0.4)],
      ]);

      const result = service.computePickCLV(pick as any, snapshots, modelVersion, closeKind);

      expect(result.reason_code).toBeNull();
      // 'yes' maps to p_close_over
      expect(result.p_close_market_devig).toBe(0.6);
      expect(result.clv_prob).toBeCloseTo(0.05, 4);
    });

    it('sets correct model_version and feature_set_version', () => {
      const pick = makePick('pick-12', 'over', 0.55);
      const snapshots = new Map([
        ['event-1|2|player-1', makeSnapshot('event-1|2|player-1', 0.55, 0.45)],
      ]);

      const result = service.computePickCLV(pick as any, snapshots, modelVersion, closeKind);

      expect(result.model_version).toBe('prob_v2.0.0_syndicate_layered');
      expect(result.feature_set_version).toBe('clv_v1.0.0_consensus_close');
      expect(result.close_kind).toBe('CLOSE_FINAL');
    });
  });
});
