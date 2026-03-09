/**
 * Unit tests for Loss Attribution (SPRINT-034)
 */
import {
  classifyLoss,
  summarizeLossAttributions,
  type LossAttributionInput,
  type LossAttributionOutput,
} from '@/analysis/outcomes/loss-attribution';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<LossAttributionInput> = {}): LossAttributionInput {
  return {
    ev: 5,
    clv_at_bet: 1,
    clv_at_close: 0.5,
    has_feature_snapshot: true,
    ...overrides,
  };
}

// ── classifyLoss ────────────────────────────────────────────────────────────

describe('classifyLoss', () => {
  describe('UNKNOWN — no feature snapshot', () => {
    it('classifies as UNKNOWN when no feature snapshot', () => {
      const result = classifyLoss(makeInput({ has_feature_snapshot: false }));
      expect(result.classification).toBe('UNKNOWN');
      expect(result.notes).toContain('no_feature_snapshot_available');
    });

    it('UNKNOWN takes priority over all other conditions', () => {
      const result = classifyLoss({
        ev: 10,
        clv_at_bet: -5,
        clv_at_close: -5,
        has_feature_snapshot: false,
      });
      expect(result.classification).toBe('UNKNOWN');
    });
  });

  describe('PRICE_MISS — CLV significantly negative', () => {
    it('classifies as PRICE_MISS when clv_at_bet < -3', () => {
      const result = classifyLoss(makeInput({ clv_at_bet: -4, clv_at_close: 0 }));
      expect(result.classification).toBe('PRICE_MISS');
    });

    it('classifies as PRICE_MISS when clv_at_close < -3', () => {
      const result = classifyLoss(makeInput({ clv_at_bet: 1, clv_at_close: -4 }));
      expect(result.classification).toBe('PRICE_MISS');
    });

    it('classifies as PRICE_MISS when both CLVs negative', () => {
      const result = classifyLoss(makeInput({ clv_at_bet: -5, clv_at_close: -5 }));
      expect(result.classification).toBe('PRICE_MISS');
    });

    it('PRICE_MISS takes priority over VARIANCE and PROJECTION_MISS', () => {
      // EV = 1 (would be VARIANCE), but CLV is very negative
      const result = classifyLoss(makeInput({ ev: 1, clv_at_bet: -4, clv_at_close: -4 }));
      expect(result.classification).toBe('PRICE_MISS');
    });

    it('includes CLV values in notes', () => {
      const result = classifyLoss(makeInput({ clv_at_bet: -4.5, clv_at_close: -3.2 }));
      expect(result.notes[0]).toContain('clv_at_bet=-4.50%');
      expect(result.notes[0]).toContain('clv_at_close=-3.20%');
    });
  });

  describe('VARIANCE — EV within bounds', () => {
    it('classifies as VARIANCE when |EV| < 3', () => {
      const result = classifyLoss(makeInput({ ev: 1.5 }));
      expect(result.classification).toBe('VARIANCE');
    });

    it('classifies as VARIANCE for negative EV within bounds', () => {
      const result = classifyLoss(makeInput({ ev: -2 }));
      expect(result.classification).toBe('VARIANCE');
    });

    it('classifies as VARIANCE for zero EV', () => {
      const result = classifyLoss(makeInput({ ev: 0 }));
      expect(result.classification).toBe('VARIANCE');
    });

    it('classifies as VARIANCE at boundary (ev = 2.99)', () => {
      const result = classifyLoss(makeInput({ ev: 2.99 }));
      expect(result.classification).toBe('VARIANCE');
    });

    it('includes EV in notes', () => {
      const result = classifyLoss(makeInput({ ev: 1.5 }));
      expect(result.notes[0]).toContain('ev=1.50%');
      expect(result.notes[0]).toContain('within variance bounds');
    });
  });

  describe('PROJECTION_MISS — positive EV but loss', () => {
    it('classifies as PROJECTION_MISS when EV >= 3 (positive)', () => {
      const result = classifyLoss(makeInput({ ev: 8 }));
      expect(result.classification).toBe('PROJECTION_MISS');
    });

    it('classifies as PROJECTION_MISS at boundary (ev = 3)', () => {
      const result = classifyLoss(makeInput({ ev: 3 }));
      expect(result.classification).toBe('PROJECTION_MISS');
    });

    it('includes EV in notes for positive EV', () => {
      const result = classifyLoss(makeInput({ ev: 8 }));
      expect(result.notes[0]).toContain('ev=8.00%');
      expect(result.notes[0]).toContain('outcome=loss');
    });
  });

  describe('PROJECTION_MISS — negative EV not caught by PRICE_MISS', () => {
    it('classifies as PROJECTION_MISS for large negative EV with ok CLV', () => {
      const result = classifyLoss(makeInput({ ev: -5, clv_at_bet: 0, clv_at_close: 0 }));
      expect(result.classification).toBe('PROJECTION_MISS');
    });

    it('includes negative EV in notes', () => {
      const result = classifyLoss(makeInput({ ev: -5, clv_at_bet: 0, clv_at_close: 0 }));
      expect(result.notes[0]).toContain('negative_ev=-5.00%');
    });
  });

  describe('every path produces a classification', () => {
    it('never returns undefined classification', () => {
      const inputs: LossAttributionInput[] = [
        makeInput({ has_feature_snapshot: false }),
        makeInput({ clv_at_bet: -10, clv_at_close: -10 }),
        makeInput({ ev: 0 }),
        makeInput({ ev: 10 }),
        makeInput({ ev: -10, clv_at_bet: 0, clv_at_close: 0 }),
        makeInput({ ev: 2.5, clv_at_bet: -1, clv_at_close: -1 }),
      ];
      for (const input of inputs) {
        const result = classifyLoss(input);
        expect(result.classification).toBeDefined();
        expect(result.notes.length).toBeGreaterThan(0);
      }
    });
  });
});

// ── summarizeLossAttributions ───────────────────────────────────────────────

describe('summarizeLossAttributions', () => {
  it('returns empty summary for empty array', () => {
    const summary = summarizeLossAttributions([]);
    expect(summary.total_losses).toBe(0);
    expect(summary.by_category).toEqual([]);
    expect(summary.top_category).toBe('UNKNOWN');
  });

  it('computes correct category counts and percentages', () => {
    const attributions: LossAttributionOutput[] = [
      { classification: 'PROJECTION_MISS', notes: ['ev=8%'] },
      { classification: 'PROJECTION_MISS', notes: ['ev=5%'] },
      { classification: 'PROJECTION_MISS', notes: ['ev=6%'] },
      { classification: 'PROJECTION_MISS', notes: ['ev=4%'] },
      { classification: 'VARIANCE', notes: ['ev=1%'] },
      { classification: 'VARIANCE', notes: ['ev=2%'] },
      { classification: 'VARIANCE', notes: ['ev=0%'] },
      { classification: 'PRICE_MISS', notes: ['clv=-5%'] },
      { classification: 'PRICE_MISS', notes: ['clv=-4%'] },
      { classification: 'UNKNOWN', notes: ['no snapshot'] },
    ];

    const summary = summarizeLossAttributions(attributions);
    expect(summary.total_losses).toBe(10);
    expect(summary.top_category).toBe('PROJECTION_MISS');

    const projMiss = summary.by_category.find(c => c.category === 'PROJECTION_MISS');
    expect(projMiss).toBeDefined();
    expect(projMiss!.count).toBe(4);
    expect(projMiss!.pct).toBe(40);

    const variance = summary.by_category.find(c => c.category === 'VARIANCE');
    expect(variance!.count).toBe(3);
    expect(variance!.pct).toBe(30);
  });

  it('sorts by_category by count descending', () => {
    const attributions: LossAttributionOutput[] = [
      { classification: 'UNKNOWN', notes: [] },
      { classification: 'VARIANCE', notes: [] },
      { classification: 'VARIANCE', notes: [] },
      { classification: 'PROJECTION_MISS', notes: [] },
      { classification: 'PROJECTION_MISS', notes: [] },
      { classification: 'PROJECTION_MISS', notes: [] },
    ];

    const summary = summarizeLossAttributions(attributions);
    expect(summary.by_category[0].category).toBe('PROJECTION_MISS');
    expect(summary.by_category[1].category).toBe('VARIANCE');
    expect(summary.by_category[2].category).toBe('UNKNOWN');
  });

  it('provides actionable insights with recommendations', () => {
    const attributions: LossAttributionOutput[] = [
      { classification: 'PRICE_MISS', notes: [] },
      { classification: 'VARIANCE', notes: [] },
    ];

    const summary = summarizeLossAttributions(attributions);
    expect(summary.actionable_insights.length).toBe(2);

    const priceMiss = summary.actionable_insights.find(i => i.category === 'PRICE_MISS');
    expect(priceMiss!.recommendation).toContain('line timing');

    const variance = summary.actionable_insights.find(i => i.category === 'VARIANCE');
    expect(variance!.recommendation).toContain('no action needed');
  });

  it('handles single classification', () => {
    const attributions: LossAttributionOutput[] = [
      { classification: 'VARIANCE', notes: [] },
      { classification: 'VARIANCE', notes: [] },
    ];

    const summary = summarizeLossAttributions(attributions);
    expect(summary.by_category.length).toBe(1);
    expect(summary.by_category[0].pct).toBe(100);
    expect(summary.top_category).toBe('VARIANCE');
  });

  it('includes version', () => {
    const summary = summarizeLossAttributions([]);
    expect(summary.version).toBe('loss-attribution-v1.0');
  });
});
