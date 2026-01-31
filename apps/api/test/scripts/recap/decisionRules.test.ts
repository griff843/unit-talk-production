/**
 * Unit tests for RECAP-AGENT-001 decision rules.
 *
 * Tests all paths: EXPAND, HOLD (sample gate, delta, hard count),
 * ROLLBACK (low WR, promoted < rejected, integrity).
 */

import type { IntegrityChecks, SettledPick } from '@/scripts/recap/types';

import { computeDecision } from '@/scripts/recap/decisionRules';

// ─── Fixture helpers ─────────────────────────────────────────────────────────

function makePick(overrides: Partial<SettledPick> = {}): SettledPick {
  return {
    id: 'test-id',
    sport: 'NBA',
    promotion_band: 'HARD',
    settlement_result: 'win',
    actual_outcome: 100,
    odds: -110,
    confidence: null,
    professional_score: null,
    bet_type: 'spread',
    market: 'spread',
    line: -3.5,
    side: 'home',
    created_at: '2026-01-27T00:00:00Z',
    settled_at: '2026-01-31T00:00:00Z',
    capper_id: null,
    payout_amount: null,
    ...overrides,
  };
}

function makeN(n: number, overrides: Partial<SettledPick> = {}): SettledPick[] {
  return Array.from({ length: n }, (_, i) => makePick({ id: `pick-${i}`, ...overrides }));
}

const cleanIntegrity: IntegrityChecks = {
  missing_settlements: 0,
  missing_results: 0,
  null_settlement_result: 0,
  null_promotion_band: 0,
};

const failedIntegrity: IntegrityChecks = {
  missing_settlements: 2,
  missing_results: 0,
  null_settlement_result: 0,
  null_promotion_band: 0,
};

// ─── HOLD: sample gate ──────────────────────────────────────────────────────

describe('computeDecision', () => {
  describe('HOLD — sample gate', () => {
    it('returns HOLD when settled_total < 30', () => {
      const picks = makeN(20, { promotion_band: 'HARD', settlement_result: 'win' });
      const result = computeDecision({ picks, integrity: cleanIntegrity });
      expect(result.decision).toBe('HOLD');
      expect(result.reasons).toEqual(
        expect.arrayContaining([expect.stringContaining('settled_total=20 < 30')])
      );
    });

    it('returns HOLD when promoted_total < 10', () => {
      // 30 settled but only 5 promoted
      const promoted = makeN(5, { promotion_band: 'HARD', settlement_result: 'win' });
      const rejected = makeN(25, { promotion_band: 'NONE', settlement_result: 'win' });
      const picks = [...promoted, ...rejected];
      const result = computeDecision({ picks, integrity: cleanIntegrity });
      expect(result.decision).toBe('HOLD');
      expect(result.reasons).toEqual(
        expect.arrayContaining([expect.stringContaining('promoted_total=5 < 10')])
      );
    });

    it('returns HOLD when both gates fail', () => {
      const picks = makeN(5, { promotion_band: 'HARD', settlement_result: 'win' });
      const result = computeDecision({ picks, integrity: cleanIntegrity });
      expect(result.decision).toBe('HOLD');
      expect(result.reasons.length).toBe(2);
    });
  });

  // ─── ROLLBACK triggers ──────────────────────────────────────────────────────

  describe('ROLLBACK — promoted_win_rate < 0.48', () => {
    it('returns ROLLBACK when promoted WR is below 48%', () => {
      // 15 promoted: 7 win, 8 loss = 46.7%
      const promotedWins = makeN(7, { promotion_band: 'HARD', settlement_result: 'win' });
      const promotedLosses = makeN(8, { promotion_band: 'SOFT', settlement_result: 'loss' });
      const rejected = makeN(15, { promotion_band: 'NONE', settlement_result: 'loss' });
      const picks = [...promotedWins, ...promotedLosses, ...rejected];

      const result = computeDecision({ picks, integrity: cleanIntegrity });
      expect(result.decision).toBe('ROLLBACK');
      expect(result.reasons[0]).toContain('< 48%');
    });
  });

  describe('ROLLBACK — promoted < rejected win rate', () => {
    it('returns ROLLBACK when promoted WR is below rejected WR', () => {
      // 12 promoted: 6 win, 6 loss = 50% (passes 48% gate)
      // 18 rejected: 10 win, 8 loss = 55.6% (higher than promoted)
      const promotedWins = makeN(6, { promotion_band: 'HARD', settlement_result: 'win' });
      const promotedLosses = makeN(6, { promotion_band: 'SOFT', settlement_result: 'loss' });
      const rejectedWins = makeN(10, { promotion_band: 'NONE', settlement_result: 'win' });
      const rejectedLosses = makeN(8, { promotion_band: 'NONE', settlement_result: 'loss' });
      const picks = [...promotedWins, ...promotedLosses, ...rejectedWins, ...rejectedLosses];

      const result = computeDecision({ picks, integrity: cleanIntegrity });
      expect(result.decision).toBe('ROLLBACK');
      expect(result.reasons[0]).toContain('promoted_win_rate');
      expect(result.reasons[0]).toContain('rejected_win_rate');
    });
  });

  describe('ROLLBACK — integrity failure', () => {
    it('returns ROLLBACK when integrity checks fail', () => {
      // Good WR but bad integrity
      const promotedWins = makeN(10, { promotion_band: 'HARD', settlement_result: 'win' });
      const promotedLosses = makeN(2, { promotion_band: 'SOFT', settlement_result: 'loss' });
      const rejectedWins = makeN(10, { promotion_band: 'NONE', settlement_result: 'win' });
      const rejectedLosses = makeN(10, { promotion_band: 'NONE', settlement_result: 'loss' });
      const picks = [...promotedWins, ...promotedLosses, ...rejectedWins, ...rejectedLosses];

      const result = computeDecision({ picks, integrity: failedIntegrity });
      expect(result.decision).toBe('ROLLBACK');
      expect(result.reasons[0]).toContain('Integrity failure');
    });
  });

  // ─── EXPAND ─────────────────────────────────────────────────────────────────

  describe('EXPAND — all checks pass', () => {
    it('returns EXPAND when all thresholds met', () => {
      // Need: promoted_wr >= 0.55, delta >= 0.07, hard_wr >= 0.50, hard_count >= 5
      // 12 promoted: 8 win (HARD), 4 loss (SOFT) -> promoted WR = 8/12 = 66.7%
      //   HARD: 8 (all wins) = 100% WR, count=8 >= 5
      // 18 rejected: 9 win, 9 loss = 50% WR
      // delta = 66.7% - 50% = 16.7% >= 7%
      const hardWins = makeN(8, { promotion_band: 'HARD', settlement_result: 'win' });
      const softLosses = makeN(4, { promotion_band: 'SOFT', settlement_result: 'loss' });
      const rejectedWins = makeN(9, { promotion_band: 'NONE', settlement_result: 'win' });
      const rejectedLosses = makeN(9, { promotion_band: 'NONE', settlement_result: 'loss' });
      const picks = [...hardWins, ...softLosses, ...rejectedWins, ...rejectedLosses];

      const result = computeDecision({ picks, integrity: cleanIntegrity });
      expect(result.decision).toBe('EXPAND');
      expect(result.reasons.every(r => r.startsWith('[PASS]'))).toBe(true);
      expect(result.metrics.promoted_win_rate).toBeCloseTo(8 / 12, 5);
      expect(result.metrics.delta).toBeCloseTo(8 / 12 - 9 / 18, 5);
      expect(result.metrics.hard_win_rate).toBe(1);
    });
  });

  // ─── HOLD: default (between ROLLBACK and EXPAND) ───────────────────────────

  describe('HOLD — delta insufficient', () => {
    it('returns HOLD when promoted WR is good but delta < 7%', () => {
      // 12 promoted: 7 win, 5 loss = 58.3% (>= 55%)
      // 20 rejected: 11 win, 9 loss = 55% WR
      // delta = 58.3% - 55% = 3.3% (< 7%)
      const hardWins = makeN(5, { promotion_band: 'HARD', settlement_result: 'win' });
      const softWins = makeN(2, { promotion_band: 'SOFT', settlement_result: 'win' });
      const promotedLosses = makeN(5, { promotion_band: 'SOFT', settlement_result: 'loss' });
      const rejectedWins = makeN(11, { promotion_band: 'NONE', settlement_result: 'win' });
      const rejectedLosses = makeN(9, { promotion_band: 'NONE', settlement_result: 'loss' });
      const picks = [
        ...hardWins,
        ...softWins,
        ...promotedLosses,
        ...rejectedWins,
        ...rejectedLosses,
      ];

      const result = computeDecision({ picks, integrity: cleanIntegrity });
      expect(result.decision).toBe('HOLD');
      expect(result.reasons).toEqual(expect.arrayContaining([expect.stringContaining('[FAIL]')]));
    });
  });

  describe('HOLD — insufficient HARD sample', () => {
    it('returns HOLD when hard count < 5', () => {
      // 15 promoted: 10 SOFT wins, 5 SOFT losses, 0 HARD
      // => promoted WR = 10/15 = 66.7%, but hard_count=0 so EXPAND blocked
      // 20 rejected: 10 win, 10 loss = 50% WR
      // delta = 16.7% >= 7%
      const softWins = makeN(10, { promotion_band: 'SOFT', settlement_result: 'win' });
      const softLosses = makeN(5, { promotion_band: 'SOFT', settlement_result: 'loss' });
      const rejectedWins = makeN(10, { promotion_band: 'NONE', settlement_result: 'win' });
      const rejectedLosses = makeN(10, { promotion_band: 'NONE', settlement_result: 'loss' });
      const picks = [...softWins, ...softLosses, ...rejectedWins, ...rejectedLosses];

      const result = computeDecision({ picks, integrity: cleanIntegrity });
      expect(result.decision).toBe('HOLD');
      expect(result.reasons).toEqual(
        expect.arrayContaining([expect.stringContaining('Insufficient HARD sample')])
      );
    });
  });

  // ─── Metrics accuracy ─────────────────────────────────────────────────────

  describe('metrics', () => {
    it('computes all metrics correctly', () => {
      const hardWins = makeN(4, { promotion_band: 'HARD', settlement_result: 'win' });
      const hardLosses = makeN(2, { promotion_band: 'HARD', settlement_result: 'loss' });
      const softWins = makeN(3, { promotion_band: 'SOFT', settlement_result: 'win' });
      const softLosses = makeN(2, { promotion_band: 'SOFT', settlement_result: 'loss' });
      const noneWins = makeN(6, { promotion_band: 'NONE', settlement_result: 'win' });
      const noneLosses = makeN(4, { promotion_band: 'NONE', settlement_result: 'loss' });
      const picks = [
        ...hardWins,
        ...hardLosses,
        ...softWins,
        ...softLosses,
        ...noneWins,
        ...noneLosses,
      ];

      const result = computeDecision({ picks, integrity: cleanIntegrity });
      const m = result.metrics;

      expect(m.settled_total).toBe(21);
      expect(m.promoted_total).toBe(11); // 6 HARD + 5 SOFT
      expect(m.promoted_win_rate).toBeCloseTo(7 / 11, 5); // 4+3 wins out of 11
      expect(m.rejected_win_rate).toBeCloseTo(6 / 10, 5); // 6 out of 10
      expect(m.hard_win_rate).toBeCloseTo(4 / 6, 5);
      expect(m.hard_count).toBe(6);
      expect(m.delta).toBeCloseTo(7 / 11 - 6 / 10, 5);
      expect(m.integrity_ok).toBe(true);
    });
  });
});
