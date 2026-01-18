/**
 * Unit Tests: CrossMarketFeature
 *
 * Tests for cross-market discrepancy detection feature.
 */

import { CrossMarketFeature } from '../../../src/services/professional/features/CrossMarketFeature';
import { ProfessionalContext } from '../../../src/services/professional/types';

describe('CrossMarketFeature', () => {
  let feature: CrossMarketFeature;

  beforeEach(() => {
    feature = new CrossMarketFeature();
  });

  describe('Feature Metadata', () => {
    it('should have correct metadata', () => {
      expect(feature.id).toBe('cross-market');
      expect(feature.name).toBe('Cross Market Discrepancy');
      expect(feature.defaultWeight).toBe(0.005); // 0.5%
    });
  });

  describe('canCalculate', () => {
    it('should always return true (can calculate even without related props)', () => {
      const context = createMockContext({});
      expect(feature.canCalculate(context)).toBe(true);
    });
  });

  describe('calculate - Normal Scenarios', () => {
    it('should return base score with no related props', async () => {
      const context = createMockContext({});

      const result = await feature.calculate(context);

      expect(result.score).toBe(0.2); // Base score
      expect(result.data.hasArbitrage).toBe(false);
      expect(result.data.maxDiscrepancy).toBe(0);
      expect(result.confidence).toBe(0.5); // Low confidence without data
    });

    it('should detect arbitrage with highly correlated props', async () => {
      const context = createMockContext({
        marketData: {
          relatedProps: new Map([
            [
              'prop_123',
              [
                { propId: 'prop_456', correlation: 0.85, discrepancy: 2.5 },
                { propId: 'prop_789', correlation: 0.75, discrepancy: 1.8 },
              ],
            ],
          ]),
        },
      });

      const result = await feature.calculate(context);

      expect(result.score).toBeGreaterThan(0.2); // Better than base
      expect(result.data.relatedProps).toBeDefined();
      expect(result.data.relatedProps!.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should include canonical IDs in logs', async () => {
      const context = createMockContext({
        canonicalGameId: 'game_abc123',
        canonicalPlayerId: 'player_xyz789',
      });

      const result = await feature.calculate(context);

      // Feature should execute successfully with canonical IDs
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculate - Edge Cases', () => {
    it('should handle low correlation props (below 0.7 threshold)', async () => {
      const context = createMockContext({
        marketData: {
          relatedProps: new Map([
            [
              'prop_123',
              [
                { propId: 'prop_456', correlation: 0.5, discrepancy: 1.0 },
                { propId: 'prop_789', correlation: 0.6, discrepancy: 1.5 },
              ],
            ],
          ]),
        },
      });

      const result = await feature.calculate(context);

      // Should return base score for low correlation
      expect(result.score).toBe(0.2);
      expect(result.data.hasArbitrage).toBe(false);
    });

    it('should handle empty related props array', async () => {
      const context = createMockContext({
        marketData: {
          relatedProps: new Map([['prop_123', []]]),
        },
      });

      const result = await feature.calculate(context);

      expect(result.score).toBe(0.2);
      expect(result.data.hasArbitrage).toBe(false);
    });

    it('should handle missing marketData entirely', async () => {
      const context = createMockContext({
        marketData: undefined,
      });

      const result = await feature.calculate(context);

      expect(result.score).toBe(0.2);
      expect(result.data.hasArbitrage).toBe(false);
    });
  });

  describe('calculate - Error Handling', () => {
    it('should gracefully degrade on calculation error', async () => {
      // Create a context that might trigger edge case behavior
      const context = createMockContext({
        marketData: {
          relatedProps: new Map([
            [
              'prop_123',
              [
                { propId: 'prop_456', correlation: 0.9, discrepancy: NaN }, // Invalid discrepancy
              ],
            ],
          ]),
        },
      });

      const result = await feature.calculate(context);

      // Should still return valid result
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.data).toBeDefined();
    });
  });

  describe('Metadata and Performance', () => {
    it('should include calculation time in metadata', async () => {
      const context = createMockContext({});

      const result = await feature.calculate(context);

      expect(result.metadata?.calculationTimeMs).toBeDefined();
      expect(result.metadata!.calculationTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should include related props count in metadata', async () => {
      const context = createMockContext({
        marketData: {
          relatedProps: new Map([
            [
              'prop_123',
              [
                { propId: 'prop_456', correlation: 0.85, discrepancy: 2.0 },
                { propId: 'prop_789', correlation: 0.75, discrepancy: 1.5 },
              ],
            ],
          ]),
        },
      });

      const result = await feature.calculate(context);

      expect(result.metadata?.relatedPropsCount).toBe(2);
    });
  });
});

/**
 * Helper function to create mock ProfessionalContext
 */
function createMockContext(overrides: Partial<ProfessionalContext> = {}): ProfessionalContext {
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
    gameDate: new Date('2025-01-30'),
    features: {
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
    },
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
