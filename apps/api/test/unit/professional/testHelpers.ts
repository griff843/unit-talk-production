/**
 * Test Helpers for Professional Pipeline Tests
 *
 * Shared utilities and mock data builders for testing professional features.
 */

import { ProfessionalContext } from '../../../src/services/professional/types';
import { GradingFeatureSet } from '../../../src/agents/GradingAgent/scoring/types';

/**
 * Create a mock ProfessionalContext with sensible defaults
 */
export function createMockContext(
  overrides: Partial<ProfessionalContext> = {}
): ProfessionalContext {
  return {
    propId: 'prop_123',
    canonicalGameId: 'game_456',
    canonicalPlayerId: 'player_789',
    tenantId: 'tenant_1',
    league: 'NBA',
    statType: 'points',
    line: 25.5,
    overOdds: -110,
    underOdds: -110,
    playerName: 'LeBron James',
    team: 'LAL',
    opponent: 'GSW',
    gameDate: new Date('2025-01-30T19:00:00Z'),
    features: createMockFeatures(),
    deviggingResult: {
      trueOverProbability: 0.52,
      trueUnderProbability: 0.48,
      fairLine: 25.3,
      vigPercentage: 4.5,
    },
    hoursToGame: 18,
    submittedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create mock grading features
 */
export function createMockFeatures(
  overrides: Partial<GradingFeatureSet> = {}
): GradingFeatureSet {
  return {
    propId: 'prop_123',
    league: 'NBA',
    statType: 'points',
    playerName: 'LeBron James',
    team: 'LAL',
    opponent: 'GSW',
    line: 25.5,
    overOdds: -110,
    underOdds: -110,
    injuryImpact: 0,
    weatherImpact: 0,
    gameTime: new Date('2025-01-30T19:00:00Z'),
    market: {
      line: 25.5,
      overOdds: -110,
      underOdds: -110,
    },
    ...overrides,
  };
}

/**
 * Create mock line movement history for steam detection
 */
export function createLineMovementHistory(
  propId: string,
  points: Array<{ timeAgo: number; line: number; volume?: number }>
): Map<string, any[]> {
  const now = Date.now();
  const history = points.map((point) => ({
    timestamp: now - point.timeAgo,
    line: point.line,
    volume: point.volume,
  }));

  return new Map([[propId, history]]);
}

/**
 * Create mock CLV data
 */
export function createMockCLVData(
  overrides: Partial<NonNullable<ProfessionalContext['clvData']>> = {}
) {
  return {
    trackingId: 'clv_123',
    submittedLine: 25.5,
    submittedOdds: -110,
    currentLine: 25.8,
    currentOdds: -115,
    clvBps: 15, // 0.15% CLV
    ...overrides,
  };
}

/**
 * Create mock market data with all caches
 */
export function createFullMarketData(propId: string = 'prop_123') {
  return {
    lineMovementHistory: createLineMovementHistory(propId, [
      { timeAgo: 600000, line: 25.5, volume: 100 },
      { timeAgo: 300000, line: 26.0, volume: 150 },
      { timeAgo: 0, line: 26.5, volume: 200 },
    ]),
    bettingPercentages: new Map([
      [propId, { public: 65, sharp: 35, timestamp: Date.now() }],
    ]),
    bookLines: new Map([
      [
        propId,
        [
          { book: 'DraftKings', odds: -110 },
          { book: 'FanDuel', odds: -108 },
          { book: 'BetMGM', odds: -112 },
        ],
      ],
    ]),
    injuries: new Map([
      [
        propId,
        [
          {
            playerId: 'player_789',
            status: 'questionable',
            impact: 3,
            timestamp: Date.now() - 3600000,
          },
        ],
      ],
    ]),
    relatedProps: new Map([
      [
        propId,
        [
          { propId: 'prop_456', correlation: 0.85, discrepancy: 2.0 },
          { propId: 'prop_789', correlation: 0.75, discrepancy: 1.5 },
        ],
      ],
    ]),
  };
}

/**
 * Assert that a feature result has valid structure
 */
export function assertValidFeatureResult(result: any) {
  expect(result).toBeDefined();
  expect(result.score).toBeGreaterThanOrEqual(0);
  expect(result.score).toBeLessThanOrEqual(1);
  expect(result.data).toBeDefined();
  expect(result.confidence).toBeGreaterThanOrEqual(0);
  expect(result.confidence).toBeLessThanOrEqual(1);
  expect(result.metadata).toBeDefined();
  expect(result.metadata.calculationTimeMs).toBeGreaterThanOrEqual(0);
}

/**
 * Create context with canonical IDs and CLV data (full Phase 2 integration)
 */
export function createPhase2IntegratedContext(
  overrides: Partial<ProfessionalContext> = {}
): ProfessionalContext {
  return createMockContext({
    canonicalGameId: 'canonical_game_abc123',
    canonicalPlayerId: 'canonical_player_xyz789',
    clvData: createMockCLVData(),
    marketData: createFullMarketData(),
    ...overrides,
  });
}
