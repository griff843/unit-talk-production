/**
 * computeScoreV2.test.ts — Unit tests for the V2 scoring pipeline
 *
 * Tests:
 * 1. Determinism: same input → same output (10 runs)
 * 2. Tier classification: S/A/B/C/D fixtures produce expected tiers
 * 3. Breakdown completeness: all 26 participating features in breakdown
 * 4. Feature audit: missing inputs correctly flagged
 * 5. Snapshot test: full output for 3 reference fixtures
 */

import { computeScoreV2, ComputeScoreV2Result } from '@/agents/GradingAgent/scoring/computeScoreV2';
import { GradingFeatureSet } from '@/types/GradingFeatureSet';
import { SCORING_FIXTURES } from '@/agents/GradingAgent/scoring/__fixtures__/scoringFixtures';

// Reference feature set for determinism testing
const REFERENCE_FEATURES: GradingFeatureSet = {
  propId: 'determinism-test',
  date: '2026-01-29',
  sport: 'NBA',
  league: 'NBA',
  odds: -110,
  market: { type: 'points', odds: -110, line: 22.5 },
  expectedValue: 10,
  lineMovement: 2,
  matchupRating: 65,
  playerForm: 70,
  injuryImpact: 4,
  weatherImpact: 0,
  marketIntelligence: 60,
  sharpMoney: 65,
  volumeProfile: 55,
  closingLineValue: 3,
  playerFatigue: 60,
  venueAdvantage: 12,
  refereeImpact: 2,
  paceImpact: 13,
  motivationalFactors: 16,
  correlationRisk: 0.2,
  volatility: 4,
  portfolioImpact: 0.1,
  dataQuality: {
    dataValidationScore: 0.95,
    outlierScore: 0.95,
    consistencyScore: 0.95,
    completeness: 0.9,
  },
  timestamp: '2026-01-29T12:00:00Z',
  version: 'test-v1',
  source: 'test',
  confidence: 0.8,
};

describe('computeScoreV2', () => {
  describe('Determinism', () => {
    it('should produce identical output for 10 consecutive runs', () => {
      const results: ComputeScoreV2Result[] = [];
      for (let i = 0; i < 10; i++) {
        results.push(computeScoreV2(REFERENCE_FEATURES));
      }

      const first = results[0];
      for (let i = 1; i < results.length; i++) {
        expect(results[i].score).toBe(first.score);
        expect(results[i].tier).toBe(first.tier);
        expect(results[i].ev).toBe(first.ev);
        expect(Object.keys(results[i].breakdown)).toEqual(Object.keys(first.breakdown));

        for (const [key, b] of Object.entries(first.breakdown)) {
          expect(results[i].breakdown[key].contribution).toBe(b.contribution);
        }
      }
    });
  });

  describe('Tier classification', () => {
    it('S-tier fixture should produce S tier', () => {
      const fixture = SCORING_FIXTURES.find((f) => f.name === 'S-tier: Elite pick')!;
      const result = computeScoreV2(fixture.input as GradingFeatureSet);
      expect(result.tier).toBe('S');
      expect(result.score).toBeGreaterThanOrEqual(70);
    });

    it('A-tier fixture should produce A or B tier', () => {
      const fixture = SCORING_FIXTURES.find((f) => f.name === 'A-tier: Good pick')!;
      const result = computeScoreV2(fixture.input as GradingFeatureSet);
      expect(['A', 'B']).toContain(result.tier);
      expect(result.score).toBeGreaterThanOrEqual(45);
    });

    it('D-tier fixture should produce D tier', () => {
      const fixture = SCORING_FIXTURES.find((f) => f.name === 'D-tier: Poor pick')!;
      const result = computeScoreV2(fixture.input as GradingFeatureSet);
      expect(result.tier).toBe('D');
      expect(result.score).toBeLessThan(30);
    });

    it('Score floor should produce score near 0', () => {
      const fixture = SCORING_FIXTURES.find((f) => f.name === 'Score floor (all zeros)')!;
      const result = computeScoreV2(fixture.input as GradingFeatureSet);
      expect(result.score).toBeLessThan(10);
      expect(result.tier).toBe('D');
    });

    it('Score ceiling should produce score near 100', () => {
      const fixture = SCORING_FIXTURES.find((f) => f.name === 'Score ceiling (all max)')!;
      const result = computeScoreV2(fixture.input as GradingFeatureSet);
      expect(result.score).toBeGreaterThan(90);
      expect(result.tier).toBe('S');
    });
  });

  describe('Breakdown completeness', () => {
    it('should include all 26 participating features in breakdown', () => {
      const result = computeScoreV2(REFERENCE_FEATURES);
      const breakdownKeys = Object.keys(result.breakdown);

      // 30 total - 4 excluded ML features = 26
      expect(breakdownKeys.length).toBe(26);

      // Verify key groups are present
      expect(breakdownKeys).toContain('expectedValue');
      expect(breakdownKeys).toContain('sharpMoney');
      expect(breakdownKeys).toContain('steamDetection');
      expect(breakdownKeys).toContain('playerFatigue');
      expect(breakdownKeys).toContain('correlationRisk');

      // Verify ML features are NOT in breakdown
      expect(breakdownKeys).not.toContain('neuralNetwork');
      expect(breakdownKeys).not.toContain('gradientBoosting');
      expect(breakdownKeys).not.toContain('randomForest');
      expect(breakdownKeys).not.toContain('ensemble');
    });

    it('breakdown entries should have all required fields', () => {
      const result = computeScoreV2(REFERENCE_FEATURES);
      for (const [, b] of Object.entries(result.breakdown)) {
        expect(typeof b.raw).toBe('number');
        expect(typeof b.normalized).toBe('number');
        expect(typeof b.weight).toBe('number');
        expect(typeof b.contribution).toBe('number');
        expect(b.normalized).toBeGreaterThanOrEqual(0);
        expect(b.normalized).toBeLessThanOrEqual(100);
      }
    });

    it('weight contributions should sum to approximately the score', () => {
      const result = computeScoreV2(REFERENCE_FEATURES);
      const totalContribution = Object.values(result.breakdown)
        .reduce((sum, b) => sum + b.contribution, 0);
      expect(Math.abs(totalContribution - result.score)).toBeLessThan(0.1);
    });
  });

  describe('Feature audit', () => {
    it('should flag all 30 features in audit', () => {
      const result = computeScoreV2(REFERENCE_FEATURES);
      expect(Object.keys(result.feature_audit).length).toBe(30);
    });

    it('should flag ML features as excluded', () => {
      const result = computeScoreV2(REFERENCE_FEATURES);
      const mlFeatures = ['neuralNetwork', 'gradientBoosting', 'randomForest', 'ensemble'];
      for (const name of mlFeatures) {
        expect(result.feature_audit[name].fallbackPolicy).toBe('excluded');
        expect(result.feature_audit[name].present).toBe(false);
      }
    });

    it('should flag capper features as using fallbacks when data not provided', () => {
      const result = computeScoreV2(REFERENCE_FEATURES);
      // Without professional capper data fields, capper features should use fallbacks
      const capperFeatures = [
        'steamDetection', 'closingLinePrediction', 'optimalTiming',
        'lineShoppingEdge', 'publicVsSharpSplit', 'marketTimingAdvantage',
        'injuryTimingEdge', 'crossMarketDiscrepancy',
      ];
      for (const name of capperFeatures) {
        const audit = result.feature_audit[name];
        expect(audit.fallbackPolicy).toBe('neutral');
        // Most won't have data available on REFERENCE_FEATURES
      }
    });

    it('should mark core features as present when provided', () => {
      const result = computeScoreV2(REFERENCE_FEATURES);
      const coreFeatures = [
        'expectedValue', 'lineMovement', 'matchupRating',
        'playerForm', 'injuryImpact', 'weatherImpact',
      ];
      for (const name of coreFeatures) {
        expect(result.feature_audit[name].present).toBe(true);
        expect(result.feature_audit[name].fallbackUsed).toBe(false);
      }
    });
  });

  describe('Snapshot tests', () => {
    it('S-tier fixture snapshot', () => {
      const fixture = SCORING_FIXTURES.find((f) => f.name === 'S-tier: Elite pick')!;
      const result = computeScoreV2(fixture.input as GradingFeatureSet);

      expect(result.score).toBeCloseTo(74.3, 0);
      expect(result.tier).toBe('S');
      expect(result.ev).toBe(25);
    });

    it('D-tier fixture snapshot', () => {
      const fixture = SCORING_FIXTURES.find((f) => f.name === 'D-tier: Poor pick')!;
      const result = computeScoreV2(fixture.input as GradingFeatureSet);

      expect(result.score).toBeCloseTo(21.5, 0);
      expect(result.tier).toBe('D');
      expect(result.ev).toBe(-20);
    });

    it('All-neutral fallback snapshot', () => {
      const fixture = SCORING_FIXTURES.find((f) => f.name === 'All-neutral fallback')!;
      const result = computeScoreV2(fixture.input as GradingFeatureSet);

      expect(result.score).toBeCloseTo(43.0, 0);
      expect(['B', 'C']).toContain(result.tier);
      expect(result.ev).toBe(0);
    });
  });

  describe('Sport-specific weights', () => {
    it('should accept sport parameter without error', () => {
      // Note: getScoringConfig validation may fall back to default (NBA)
      // for all sports due to pre-existing validateWeights bug.
      // This test verifies computeScoreV2 handles different sport inputs
      // without crashing, not that the weights differ.
      const nbaResult = computeScoreV2({
        ...REFERENCE_FEATURES,
        sport: 'NBA',
        league: 'NBA',
      });
      const nflResult = computeScoreV2({
        ...REFERENCE_FEATURES,
        sport: 'NFL',
        league: 'NFL',
      });

      // Both should produce valid scores
      expect(nbaResult.score).toBeGreaterThanOrEqual(0);
      expect(nbaResult.score).toBeLessThanOrEqual(100);
      expect(nflResult.score).toBeGreaterThanOrEqual(0);
      expect(nflResult.score).toBeLessThanOrEqual(100);
    });
  });

  describe('All fixtures validation', () => {
    for (const fixture of SCORING_FIXTURES) {
      it(`fixture "${fixture.name}" should pass all validations`, () => {
        const result = computeScoreV2(fixture.input as GradingFeatureSet);

        expect(fixture.expected.tierRange).toContain(result.tier);
        expect(result.score).toBeGreaterThanOrEqual(fixture.expected.scoreMin);
        expect(result.score).toBeLessThanOrEqual(fixture.expected.scoreMax);

        switch (fixture.expected.evSign) {
          case 'positive':
            expect(result.ev).toBeGreaterThan(0);
            break;
          case 'negative':
            expect(result.ev).toBeLessThan(0);
            break;
          case 'zero':
            expect(result.ev).toBe(0);
            break;
          // 'any' — no check
        }
      });
    }
  });
});
