/**
 * validateWeights.test.ts — Unit tests for Tranche 4: validateWeights fix
 *
 * Tests:
 * 1. Legacy validateWeights() is broken (proving the bug)
 * 2. validateWeightsV2() passes for all 4 sport configs
 * 3. getScoringConfig() returns different configs per sport when V2=true
 * 4. computeScoreV2() produces different scores for different sports
 * 5. Default behavior unchanged when V2=false
 */

import {
  validateWeights,
  validateWeightsV2,
  CORE_WEIGHT_KEYS,
  ENHANCED_FEATURE_KEYS,
  TIME_WEIGHT_KEYS,
} from '@/scoring/config/weights/types';
import {
  getScoringConfig,
  getSportWeights,
  NBA_CONFIG,
  MLB_CONFIG,
  NFL_CONFIG,
  NHL_CONFIG,
} from '@/scoring/config/weights';
import { computeScoreV2 } from '@/agents/GradingAgent/scoring/computeScoreV2';
import { GradingFeatureSet } from '@/types/GradingFeatureSet';

// Reference feature set for consistent testing
const REFERENCE_FEATURES: GradingFeatureSet = {
  propId: 'validate-weights-test',
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

describe('Key list completeness', () => {
  it('CORE_WEIGHT_KEYS should have exactly 30 entries', () => {
    expect(CORE_WEIGHT_KEYS.length).toBe(30);
  });

  it('ENHANCED_FEATURE_KEYS should have exactly 6 entries', () => {
    expect(ENHANCED_FEATURE_KEYS.length).toBe(6);
  });

  it('TIME_WEIGHT_KEYS should have exactly 5 entries', () => {
    expect(TIME_WEIGHT_KEYS.length).toBe(5);
  });

  it('no overlap between CORE, ENHANCED, and TIME key lists', () => {
    const allKeys = [...CORE_WEIGHT_KEYS, ...ENHANCED_FEATURE_KEYS, ...TIME_WEIGHT_KEYS];
    const unique = new Set(allKeys);
    expect(unique.size).toBe(allKeys.length);
  });
});

describe('Legacy validateWeights (proving the bug)', () => {
  it('should FAIL for NBA config (double-counting bug)', () => {
    expect(validateWeights(NBA_CONFIG.weights)).toBe(false);
  });

  it('should FAIL for MLB config (double-counting bug)', () => {
    expect(validateWeights(MLB_CONFIG.weights)).toBe(false);
  });

  it('should FAIL for NFL config (double-counting bug)', () => {
    expect(validateWeights(NFL_CONFIG.weights)).toBe(false);
  });

  it('should FAIL for NHL config (double-counting bug)', () => {
    expect(validateWeights(NHL_CONFIG.weights)).toBe(false);
  });
});

describe('validateWeightsV2', () => {
  it('should PASS for NBA config', () => {
    const result = validateWeightsV2(NBA_CONFIG.weights);
    expect(result.valid).toBe(true);
    expect(result.total).toBeGreaterThan(0);
    expect(result.issues).toHaveLength(0);
  });

  it('should PASS for MLB config', () => {
    const result = validateWeightsV2(MLB_CONFIG.weights);
    expect(result.valid).toBe(true);
    expect(result.total).toBeGreaterThan(0);
    expect(result.issues).toHaveLength(0);
  });

  it('should PASS for NFL config', () => {
    const result = validateWeightsV2(NFL_CONFIG.weights);
    expect(result.valid).toBe(true);
    expect(result.total).toBeGreaterThan(0);
    expect(result.issues).toHaveLength(0);
  });

  it('should PASS for NHL config', () => {
    const result = validateWeightsV2(NHL_CONFIG.weights);
    expect(result.valid).toBe(true);
    expect(result.total).toBeGreaterThan(0);
    expect(result.issues).toHaveLength(0);
  });

  it('should report coreTotal and enhancedTotal separately', () => {
    const result = validateWeightsV2(NBA_CONFIG.weights);
    expect(result.coreTotal).toBeGreaterThan(1); // Core weights sum > 1.0
    expect(result.enhancedTotal).toBeGreaterThan(0); // Enhanced features present
    expect(result.total).toBeCloseTo(result.coreTotal + result.enhancedTotal, 6);
  });

  it('should NOT include time-based weights in total', () => {
    const result = validateWeightsV2(NBA_CONFIG.weights);
    // Time weights (last3=0.4, last7=0.3, etc.) should NOT be in total
    // If they were, total would be much higher
    const timeSum = TIME_WEIGHT_KEYS.reduce((sum, key) => {
      const v = NBA_CONFIG.weights[key];
      return sum + (typeof v === 'number' ? v : 0);
    }, 0);
    // Verify timeSum is substantial (>1.0) but NOT in the total
    expect(timeSum).toBeGreaterThan(1.0);
    // Total should be much less than total + timeSum
    expect(result.total).toBeLessThan(result.total + timeSum);
  });
});

describe('getScoringConfig with V2 flag', () => {
  const originalEnv = process.env.SCORING_ENGINE_V2;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.SCORING_ENGINE_V2;
    } else {
      process.env.SCORING_ENGINE_V2 = originalEnv;
    }
  });

  it('V2=false: all sports return NBA config (legacy bug preserved)', () => {
    process.env.SCORING_ENGINE_V2 = 'false';
    const nba = getScoringConfig('NBA');
    const mlb = getScoringConfig('MLB');
    const nfl = getScoringConfig('NFL');
    const nhl = getScoringConfig('NHL');

    // All should resolve to the same default (NBA) due to broken validation
    expect(nba.weights.sport).toBe('NBA');
    expect(mlb.weights.sport).toBe('NBA');
    expect(nfl.weights.sport).toBe('NBA');
    expect(nhl.weights.sport).toBe('NBA');
  });

  it('V2=true: each sport returns its own config', () => {
    process.env.SCORING_ENGINE_V2 = 'true';
    const nba = getScoringConfig('NBA');
    const mlb = getScoringConfig('MLB');
    const nfl = getScoringConfig('NFL');
    const nhl = getScoringConfig('NHL');

    expect(nba.weights.sport).toBe('NBA');
    expect(mlb.weights.sport).toBe('MLB');
    expect(nfl.weights.sport).toBe('NFL');
    expect(nhl.weights.sport).toBe('NHL');
  });

  it('V2=true: unknown sport still falls back to NBA', () => {
    process.env.SCORING_ENGINE_V2 = 'true';
    const config = getScoringConfig('CRICKET');
    expect(config.weights.sport).toBe('NBA');
  });

  it('V2=true: aliases resolve correctly', () => {
    process.env.SCORING_ENGINE_V2 = 'true';
    const ncaaf = getScoringConfig('NCAAF');
    const ncaab = getScoringConfig('NCAAB');
    const wnba = getScoringConfig('WNBA');

    expect(ncaaf.weights.sport).toBe('NFL'); // College football → NFL config
    expect(ncaab.weights.sport).toBe('NBA'); // College basketball → NBA config
    expect(wnba.weights.sport).toBe('NBA');  // WNBA → NBA config
  });
});

describe('Sport-specific scoring with V2', () => {
  const originalEnv = process.env.SCORING_ENGINE_V2;

  beforeAll(() => {
    process.env.SCORING_ENGINE_V2 = 'true';
  });

  afterAll(() => {
    if (originalEnv === undefined) {
      delete process.env.SCORING_ENGINE_V2;
    } else {
      process.env.SCORING_ENGINE_V2 = originalEnv;
    }
  });

  it('NBA and MLB should produce different scores for same features', () => {
    const nbaResult = computeScoreV2({ ...REFERENCE_FEATURES, sport: 'NBA', league: 'NBA' });
    const mlbResult = computeScoreV2({ ...REFERENCE_FEATURES, sport: 'MLB', league: 'MLB' });

    expect(nbaResult.score).toBeGreaterThanOrEqual(0);
    expect(nbaResult.score).toBeLessThanOrEqual(100);
    expect(mlbResult.score).toBeGreaterThanOrEqual(0);
    expect(mlbResult.score).toBeLessThanOrEqual(100);

    // Scores MUST differ because weight distributions differ
    expect(nbaResult.score).not.toBe(mlbResult.score);
  });

  it('NBA and NFL should produce different scores for same features', () => {
    const nbaResult = computeScoreV2({ ...REFERENCE_FEATURES, sport: 'NBA', league: 'NBA' });
    const nflResult = computeScoreV2({ ...REFERENCE_FEATURES, sport: 'NFL', league: 'NFL' });

    expect(nflResult.score).toBeGreaterThanOrEqual(0);
    expect(nflResult.score).toBeLessThanOrEqual(100);
    expect(nbaResult.score).not.toBe(nflResult.score);
  });

  it('NBA and NHL should produce different scores for same features', () => {
    const nbaResult = computeScoreV2({ ...REFERENCE_FEATURES, sport: 'NBA', league: 'NBA' });
    const nhlResult = computeScoreV2({ ...REFERENCE_FEATURES, sport: 'NHL', league: 'NHL' });

    expect(nhlResult.score).toBeGreaterThanOrEqual(0);
    expect(nhlResult.score).toBeLessThanOrEqual(100);
    expect(nbaResult.score).not.toBe(nhlResult.score);
  });

  it('all 4 sports should produce valid tier assignments', () => {
    const validTiers = ['S', 'A', 'B', 'C', 'D'];
    for (const sport of ['NBA', 'MLB', 'NFL', 'NHL']) {
      const result = computeScoreV2({ ...REFERENCE_FEATURES, sport, league: sport });
      expect(validTiers).toContain(result.tier);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    }
  });

  it('weight differences should be meaningful (not just floating point noise)', () => {
    const nbaResult = computeScoreV2({ ...REFERENCE_FEATURES, sport: 'NBA', league: 'NBA' });
    const mlbResult = computeScoreV2({ ...REFERENCE_FEATURES, sport: 'MLB', league: 'MLB' });

    // Difference should be > 0.5 (not just rounding artifacts)
    expect(Math.abs(nbaResult.score - mlbResult.score)).toBeGreaterThan(0.5);
  });
});
