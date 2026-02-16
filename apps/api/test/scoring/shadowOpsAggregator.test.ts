/* eslint-disable */
/**
 * shadowOpsAggregator.test.ts — Unit tests for Tranche 8 Ops Metrics Aggregator
 *
 * Tests band distribution, sport metrics, anomaly detection, and recommendations.
 *
 * Created: 2026-01-29 (Tranche 8 — Prod Shadow Monitoring)
 */

import {
  computeBandDistribution,
  computeSportMetrics,
  detectAnomalies,
  computeRecommendation,
  aggregateMetrics,
  generateDailySummary,
  generateWeeklySummary,
  ALERT_THRESHOLDS,
} from '../../../../scripts/scoring/shadow-ops-aggregator';
import type {
  ShadowRecord,
  DriftLogEntry,
  PromotionDecisionLog,
  BandDistribution,
} from '../../../../scripts/scoring/shadow-ops-aggregator';

// ─── Test Helpers ───────────────────────────────────────────────────────────

function makeDrift(overrides: Partial<DriftLogEntry> = {}): DriftLogEntry {
  return {
    type: 'scoring_drift',
    timestamp: '2026-01-29T14:00:00Z',
    trace_id: 'test-001',
    pick_id: 'NBA-001',
    sport: 'NBA',
    mode: 'shadow',
    v1: { score: 65, tier: 'B', ev: 3 },
    v2: { score: 52, tier: 'B', ev: 5, weights_source: 'NBA', top_contributors: [] },
    deltas: { score: -13, tier_changed: false, ev: 2 },
    promotion_impacting: false,
    ...overrides,
  };
}

function makePromo(overrides: Partial<PromotionDecisionLog> = {}): PromotionDecisionLog {
  return {
    type: 'promotion_decision_shadow',
    pick_id: 'NBA-001',
    promote: false,
    band: 'NONE',
    reason_codes: ['none:tier=B'],
    notes: ['score=52,tier=B'],
    ...overrides,
  };
}

function makeRecord(
  driftOverrides: Partial<DriftLogEntry> = {},
  promoOverrides: Partial<PromotionDecisionLog> = {}
): ShadowRecord {
  return {
    drift: makeDrift(driftOverrides),
    promotion: makePromo(promoOverrides),
  };
}

function makeRecords(count: number, band: 'HARD' | 'SOFT' | 'NONE' = 'NONE'): ShadowRecord[] {
  return Array.from({ length: count }, (_, i) =>
    makeRecord(
      { pick_id: `TEST-${i}`, sport: i % 2 === 0 ? 'NBA' : 'MLB' },
      { pick_id: `TEST-${i}`, band, promote: band === 'HARD' }
    )
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('shadowOpsAggregator', () => {
  describe('computeBandDistribution', () => {
    it('returns zeros for empty records', () => {
      const result = computeBandDistribution([]);
      expect(result.total).toBe(0);
      expect(result.hard).toBe(0);
      expect(result.soft).toBe(0);
      expect(result.none).toBe(0);
    });

    it('counts HARD/SOFT/NONE correctly', () => {
      const records: ShadowRecord[] = [
        makeRecord({}, { band: 'HARD' }),
        makeRecord({}, { band: 'HARD' }),
        makeRecord({}, { band: 'SOFT' }),
        makeRecord({}, { band: 'NONE' }),
        makeRecord({}, { band: 'NONE' }),
        makeRecord({}, { band: 'NONE' }),
      ];
      const result = computeBandDistribution(records);
      expect(result.hard).toBe(2);
      expect(result.soft).toBe(1);
      expect(result.none).toBe(3);
      expect(result.total).toBe(6);
      expect(result.hard_pct).toBeCloseTo(33.33, 1);
      expect(result.soft_pct).toBeCloseTo(16.67, 1);
      expect(result.none_pct).toBe(50);
    });

    it('treats null promotion as NONE', () => {
      const records: ShadowRecord[] = [
        { drift: makeDrift(), promotion: null },
      ];
      const result = computeBandDistribution(records);
      expect(result.none).toBe(1);
      expect(result.hard).toBe(0);
    });

    it('handles all-HARD distribution', () => {
      const records = makeRecords(10, 'HARD');
      const result = computeBandDistribution(records);
      expect(result.hard).toBe(10);
      expect(result.hard_pct).toBe(100);
      expect(result.soft_pct).toBe(0);
      expect(result.none_pct).toBe(0);
    });
  });

  describe('computeSportMetrics', () => {
    it('groups by sport', () => {
      const records: ShadowRecord[] = [
        makeRecord({ sport: 'NBA', deltas: { score: -10, tier_changed: false, ev: 2 } }),
        makeRecord({ sport: 'NBA', deltas: { score: -5, tier_changed: true, ev: 1 } }),
        makeRecord({ sport: 'MLB', deltas: { score: 3, tier_changed: false, ev: -1 } }),
      ];
      const result = computeSportMetrics(records);
      expect(result).toHaveLength(2);

      const nba = result.find(s => s.sport === 'NBA')!;
      expect(nba.count).toBe(2);
      expect(nba.avg_score_delta).toBeCloseTo(-7.5, 1);
      expect(nba.tier_change_count).toBe(1);
      expect(nba.tier_change_pct).toBe(50);

      const mlb = result.find(s => s.sport === 'MLB')!;
      expect(mlb.count).toBe(1);
      expect(mlb.avg_score_delta).toBe(3);
    });

    it('computes promotion-impacting count', () => {
      const records: ShadowRecord[] = [
        makeRecord({ sport: 'NBA', promotion_impacting: true }),
        makeRecord({ sport: 'NBA', promotion_impacting: true }),
        makeRecord({ sport: 'NBA', promotion_impacting: false }),
      ];
      const result = computeSportMetrics(records);
      const nba = result.find(s => s.sport === 'NBA')!;
      expect(nba.promotion_impacting_count).toBe(2);
      expect(nba.promotion_impacting_pct).toBeCloseTo(66.67, 1);
    });

    it('returns empty for no records', () => {
      expect(computeSportMetrics([])).toHaveLength(0);
    });
  });

  describe('detectAnomalies', () => {
    it('flags insufficient data', () => {
      const records = makeRecords(5);
      const bands = computeBandDistribution(records);
      const anomalies = detectAnomalies(records, bands);
      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].type).toBe('insufficient_data');
      expect(anomalies[0].severity).toBe('info');
    });

    it('flags critical HARD rate > 50%', () => {
      const records = makeRecords(20, 'HARD');
      const bands = computeBandDistribution(records);
      const anomalies = detectAnomalies(records, bands);
      const hardCritical = anomalies.find(a => a.type === 'hard_rate_critical');
      expect(hardCritical).toBeDefined();
      expect(hardCritical!.severity).toBe('critical');
    });

    it('flags warning HARD rate > 30%', () => {
      // 35% HARD
      const hardRecs = makeRecords(7, 'HARD');
      const noneRecs = makeRecords(13, 'NONE');
      const records = [...hardRecs, ...noneRecs];
      const bands = computeBandDistribution(records);
      const anomalies = detectAnomalies(records, bands);
      const hardWarning = anomalies.find(a => a.type === 'hard_rate_high');
      expect(hardWarning).toBeDefined();
      expect(hardWarning!.severity).toBe('warning');
    });

    it('flags high SOFT rate', () => {
      // 30% SOFT
      const softRecs = makeRecords(6, 'SOFT');
      const noneRecs = makeRecords(14, 'NONE');
      const records = [...softRecs, ...noneRecs];
      const bands = computeBandDistribution(records);
      const anomalies = detectAnomalies(records, bands);
      const softHigh = anomalies.find(a => a.type === 'soft_rate_high');
      expect(softHigh).toBeDefined();
    });

    it('returns no anomalies when all within thresholds', () => {
      // 0% HARD, 8% SOFT, 92% NONE
      const softRecs = makeRecords(2, 'SOFT');
      const noneRecs = makeRecords(23, 'NONE');
      const records = [...softRecs, ...noneRecs];
      const bands = computeBandDistribution(records);
      const anomalies = detectAnomalies(records, bands);
      expect(anomalies).toHaveLength(0);
    });

    it('flags high promotion-impacting rate', () => {
      const records = makeRecords(20).map(r => ({
        ...r,
        drift: { ...r.drift, promotion_impacting: true },
      }));
      const bands = computeBandDistribution(records);
      const anomalies = detectAnomalies(records, bands);
      const promoHigh = anomalies.find(a => a.type === 'promotion_impacting_high');
      expect(promoHigh).toBeDefined();
    });
  });

  describe('computeRecommendation', () => {
    it('returns ROLLBACK on critical anomalies', () => {
      const records = makeRecords(20, 'HARD');
      const bands = computeBandDistribution(records);
      const anomalies = detectAnomalies(records, bands);
      const { recommendation } = computeRecommendation(bands, anomalies, records);
      expect(recommendation).toBe('ROLLBACK');
    });

    it('returns HOLD on warning anomalies', () => {
      const hardRecs = makeRecords(7, 'HARD');
      const noneRecs = makeRecords(13, 'NONE');
      const records = [...hardRecs, ...noneRecs];
      const bands = computeBandDistribution(records);
      const anomalies = detectAnomalies(records, bands);
      const { recommendation } = computeRecommendation(bands, anomalies, records);
      expect(recommendation).toBe('HOLD');
    });

    it('returns HOLD on insufficient data', () => {
      const records = makeRecords(5);
      const bands = computeBandDistribution(records);
      const anomalies = detectAnomalies(records, bands);
      const { recommendation } = computeRecommendation(bands, anomalies, records);
      expect(recommendation).toBe('HOLD');
    });

    it('returns EXPAND when all within thresholds', () => {
      const softRecs = makeRecords(2, 'SOFT');
      const noneRecs = makeRecords(23, 'NONE');
      const records = [...softRecs, ...noneRecs];
      const bands = computeBandDistribution(records);
      const anomalies = detectAnomalies(records, bands);
      const { recommendation } = computeRecommendation(bands, anomalies, records);
      expect(recommendation).toBe('EXPAND');
    });
  });

  describe('aggregateMetrics', () => {
    it('produces complete metrics object', () => {
      const records: ShadowRecord[] = [
        makeRecord({ sport: 'NBA' }, { band: 'SOFT' }),
        makeRecord({ sport: 'NBA' }, { band: 'NONE' }),
        makeRecord({ sport: 'MLB' }, { band: 'NONE' }),
        ...makeRecords(10),
      ];
      const metrics = aggregateMetrics(records, 'daily', '2026-01-29T00:00:00Z', '2026-01-29T23:59:59Z');
      expect(metrics.total_picks).toBe(13);
      expect(metrics.shadow_mode_active).toBe(true);
      expect(metrics.band_distribution.total).toBe(13);
      expect(metrics.by_sport.length).toBeGreaterThan(0);
      expect(typeof metrics.recommendation).toBe('string');
    });
  });

  describe('generateDailySummary', () => {
    it('produces markdown with required sections', () => {
      const records = [...makeRecords(10, 'NONE'), ...makeRecords(2, 'SOFT')];
      const metrics = aggregateMetrics(records, 'daily');
      const md = generateDailySummary(metrics, '2026-01-29');
      expect(md).toContain('# Daily Promotion Shadow Summary');
      expect(md).toContain('## Band Distribution');
      expect(md).toContain('## Key Metrics');
      expect(md).toContain('## Per-Sport Breakdown');
      expect(md).toContain('## Anomalies');
      expect(md).toContain('## Recommendation');
    });
  });

  describe('generateWeeklySummary', () => {
    it('produces markdown with trend table', () => {
      const day1 = aggregateMetrics(makeRecords(20), 'daily', '2026-01-23T00:00:00Z', '2026-01-23T23:59:59Z');
      const day2 = aggregateMetrics(makeRecords(20), 'daily', '2026-01-24T00:00:00Z', '2026-01-24T23:59:59Z');
      const md = generateWeeklySummary([day1, day2], 'Week of 2026-01-23');
      expect(md).toContain('# Weekly Promotion Shadow Summary');
      expect(md).toContain('## Weekly Band Distribution');
      expect(md).toContain('## Daily Trend');
      expect(md).toContain('## Anomaly Summary');
      expect(md).toContain('## Weekly Recommendation');
    });

    it('handles empty daily metrics', () => {
      const md = generateWeeklySummary([], 'Week of 2026-01-23');
      expect(md).toContain('No daily data available');
    });
  });

  describe('ALERT_THRESHOLDS', () => {
    it('has reasonable defaults', () => {
      expect(ALERT_THRESHOLDS.hard_rate_max).toBe(30);
      expect(ALERT_THRESHOLDS.hard_rate_critical).toBe(50);
      expect(ALERT_THRESHOLDS.soft_rate_max).toBe(25);
      expect(ALERT_THRESHOLDS.promotion_impacting_max).toBe(40);
      expect(ALERT_THRESHOLDS.tier_change_rate_max).toBe(50);
      expect(ALERT_THRESHOLDS.avg_score_delta_max).toBe(25);
      expect(ALERT_THRESHOLDS.min_picks_for_analysis).toBe(10);
      expect(ALERT_THRESHOLDS.data_gap_rate_max).toBe(30);
    });
  });
});
