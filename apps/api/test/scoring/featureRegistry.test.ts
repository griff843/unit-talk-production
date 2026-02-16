/**
 * featureRegistry.test.ts — Unit tests for the Feature Registry
 *
 * Tests:
 * 1. Registry completeness: every CoreScoringWeights key has a registry entry
 * 2. Fallback policy: neutral features return mid-range, excluded features are skipped
 * 3. Weight redistribution: excluded features don't participate in scoring
 * 4. Normalization: each feature maps inputRange to 0-100
 */

import {
  FEATURE_REGISTRY,
  extractFeatureVector,
  getRegistryByGroup,
  getRegistryEntry,
  FeatureGroup,
} from '@/agents/GradingAgent/scoring/featureRegistry';
import { GradingFeatureSet } from '@/types/GradingFeatureSet';

// Minimal valid GradingFeatureSet for testing
const MINIMAL_FEATURES: GradingFeatureSet = {
  propId: 'test-001',
  date: '2026-01-29',
  sport: 'NBA',
  league: 'NBA',
  odds: -110,
  market: { type: 'points', odds: -110, line: 22.5 },
  expectedValue: 5,
  lineMovement: 2,
  matchupRating: 60,
  playerForm: 65,
  injuryImpact: 3,
  weatherImpact: 0,
  marketIntelligence: 55,
  sharpMoney: 60,
  volumeProfile: 50,
  closingLineValue: 2,
  playerFatigue: 55,
  venueAdvantage: 10,
  refereeImpact: 1,
  paceImpact: 12,
  motivationalFactors: 15,
  correlationRisk: 0.2,
  volatility: 5,
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

describe('Feature Registry', () => {
  describe('Registry completeness', () => {
    const CORE_WEIGHTS_KEYS = [
      'expectedValue', 'lineMovement', 'matchupRating', 'playerForm',
      'injuryImpact', 'weatherImpact',
      'marketIntelligence', 'sharpMoney', 'volumeProfile', 'closingLineValue',
      'steamDetection', 'closingLinePrediction', 'optimalTiming', 'lineShoppingEdge',
      'publicVsSharpSplit', 'marketTimingAdvantage', 'injuryTimingEdge', 'crossMarketDiscrepancy',
      'playerFatigue', 'venueAdvantage', 'refereeImpact', 'paceImpact', 'motivationalFactors',
      'correlationRisk', 'volatility', 'portfolioImpact',
      'neuralNetwork', 'gradientBoosting', 'randomForest', 'ensemble',
    ];

    it('should have exactly 30 registry entries', () => {
      expect(FEATURE_REGISTRY.length).toBe(30);
    });

    it('should have a registry entry for every CoreScoringWeights key', () => {
      const registryNames = FEATURE_REGISTRY.map((e) => e.weightKey);
      for (const key of CORE_WEIGHTS_KEYS) {
        expect(registryNames).toContain(key);
      }
    });

    it('should have unique names', () => {
      const names = FEATURE_REGISTRY.map((e) => e.name);
      expect(new Set(names).size).toBe(names.length);
    });
  });

  describe('Feature groups', () => {
    const EXPECTED_GROUPS: Record<FeatureGroup, number> = {
      core: 6,
      market: 4,
      capper: 8,
      context: 5,
      risk: 3,
      ml: 4,
    };

    for (const [group, count] of Object.entries(EXPECTED_GROUPS)) {
      it(`should have ${count} features in group '${group}'`, () => {
        const entries = getRegistryByGroup(group as FeatureGroup);
        expect(entries.length).toBe(count);
      });
    }
  });

  describe('Fallback policies', () => {
    it('neutral features should use fallback value when input is missing', () => {
      const emptyFeatures = {
        propId: 'empty',
        date: '2026-01-29',
        sport: 'NBA',
        league: 'NBA',
        market: { type: 'points', odds: -110, line: 22.5 },
        dataQuality: {
          dataValidationScore: 0.95,
          outlierScore: 0.95,
          consistencyScore: 0.95,
          completeness: 0.5,
        },
        timestamp: '2026-01-29T12:00:00Z',
        version: 'test',
        source: 'test',
        confidence: 0.5,
      } as any as GradingFeatureSet;

      const vector = extractFeatureVector(emptyFeatures);

      for (const v of vector) {
        if (v.entry.fallbackPolicy === 'neutral') {
          expect(v.fallbackUsed).toBe(true);
          expect(v.excluded).toBe(false);
          expect(v.raw).toBe(v.entry.fallbackValue);
        }
      }
    });

    it('excluded features should be marked as excluded', () => {
      const vector = extractFeatureVector(MINIMAL_FEATURES);
      const excluded = vector.filter((v) => v.excluded);

      expect(excluded.length).toBe(4); // 4 ML features
      for (const v of excluded) {
        expect(v.entry.group).toBe('ml');
        expect(v.entry.fallbackPolicy).toBe('excluded');
      }
    });

    it('present features should not use fallback', () => {
      const vector = extractFeatureVector(MINIMAL_FEATURES);
      const coreFeatures = vector.filter(
        (v) => v.entry.group === 'core' && !v.excluded
      );

      for (const v of coreFeatures) {
        expect(v.present).toBe(true);
        expect(v.fallbackUsed).toBe(false);
      }
    });
  });

  describe('Normalization', () => {
    it('should normalize expectedValue [-50, 50] to [0, 100]', () => {
      const entry = getRegistryEntry('expectedValue')!;
      expect(entry.normalize(-50)).toBe(0);
      expect(entry.normalize(0)).toBe(50);
      expect(entry.normalize(50)).toBe(100);
    });

    it('should normalize lineMovement [0, 10] to [0, 100]', () => {
      const entry = getRegistryEntry('lineMovement')!;
      expect(entry.normalize(0)).toBe(0);
      expect(entry.normalize(5)).toBe(50);
      expect(entry.normalize(10)).toBe(100);
    });

    it('should normalize matchupRating [0, 100] as identity', () => {
      const entry = getRegistryEntry('matchupRating')!;
      expect(entry.normalize(0)).toBe(0);
      expect(entry.normalize(50)).toBe(50);
      expect(entry.normalize(100)).toBe(100);
    });

    it('should invert correlationRisk (higher raw = lower normalized)', () => {
      const entry = getRegistryEntry('correlationRisk')!;
      expect(entry.normalize(0)).toBe(100); // No risk = best
      expect(entry.normalize(0.5)).toBe(50);
      expect(entry.normalize(1)).toBe(0);   // Max risk = worst
    });

    it('should invert volatility (higher raw = lower normalized)', () => {
      const entry = getRegistryEntry('volatility')!;
      expect(entry.normalize(0)).toBe(100); // No volatility = best
      expect(entry.normalize(5)).toBe(50);
      expect(entry.normalize(10)).toBe(0);  // Max volatility = worst
    });

    it('should clamp values to 0-100', () => {
      const entry = getRegistryEntry('expectedValue')!;
      expect(entry.normalize(-100)).toBe(0);  // Below min clamps to 0
      expect(entry.normalize(100)).toBe(100); // Above max clamps to 100
    });
  });

  describe('Accessor functions', () => {
    it('getRegistryEntry should return entry by name', () => {
      const entry = getRegistryEntry('expectedValue');
      expect(entry).toBeDefined();
      expect(entry!.group).toBe('core');
      expect(entry!.weightKey).toBe('expectedValue');
    });

    it('getRegistryEntry should return undefined for unknown name', () => {
      expect(getRegistryEntry('nonexistent')).toBeUndefined();
    });

    it('getRegistryByGroup should return correct entries', () => {
      const riskEntries = getRegistryByGroup('risk');
      expect(riskEntries.length).toBe(3);
      expect(riskEntries.map((e) => e.name).sort()).toEqual([
        'correlationRisk', 'portfolioImpact', 'volatility',
      ]);
    });
  });
});
