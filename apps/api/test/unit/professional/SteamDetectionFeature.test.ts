/**
 * Unit Tests: SteamDetectionFeature
 *
 * Tests for real-time steam move detection.
 */

import { SteamDetectionFeature } from '../../../src/services/professional/features/SteamDetectionFeature';
import { ProfessionalContext } from '../../../src/services/professional/types';

describe('SteamDetectionFeature', () => {
  let feature: SteamDetectionFeature;

  beforeEach(() => {
    feature = new SteamDetectionFeature();
  });

  describe('Feature Metadata', () => {
    it('should have correct metadata', () => {
      expect(feature.id).toBe('steam-detection');
      expect(feature.name).toBe('Steam Detection');
      expect(feature.defaultWeight).toBe(0.025); // 2.5%
    });
  });

  describe('canCalculate', () => {
    it('should return true with sufficient line history (3+ points)', () => {
      const context = createMockContext({
        marketData: {
          lineMovementHistory: new Map([
            [
              'prop_123',
              [
                { timestamp: Date.now() - 600000, line: 25.5, volume: 100 },
                { timestamp: Date.now() - 300000, line: 26.0, volume: 150 },
                { timestamp: Date.now(), line: 26.5, volume: 200 },
              ],
            ],
          ]),
        },
      });

      expect(feature.canCalculate(context)).toBe(true);
    });

    it('should return false with insufficient line history (<3 points)', () => {
      const context = createMockContext({
        marketData: {
          lineMovementHistory: new Map([
            [
              'prop_123',
              [
                { timestamp: Date.now() - 300000, line: 25.5, volume: 100 },
                { timestamp: Date.now(), line: 26.0, volume: 150 },
              ],
            ],
          ]),
        },
      });

      expect(feature.canCalculate(context)).toBe(false);
    });

    it('should return false with no market data', () => {
      const context = createMockContext({ marketData: undefined });
      expect(feature.canCalculate(context)).toBe(false);
    });
  });

  describe('calculate - Steam Detection', () => {
    it('should detect steam move with all three criteria met', async () => {
      const now = Date.now();
      const context = createMockContext({
        canonicalGameId: 'game_abc123',
        canonicalPlayerId: 'player_xyz789',
        marketData: {
          lineMovementHistory: new Map([
            [
              'prop_123',
              [
                { timestamp: now - 300000, line: 25.5, volume: 100 }, // 5 min ago
                { timestamp: now - 150000, line: 26.5, volume: 150 }, // 2.5 min ago
                { timestamp: now, line: 27.5, volume: 300 }, // Now - 2 point move, volume spike
              ],
            ],
          ]),
        },
      });

      const result = await feature.calculate(context);

      // Steam detected: 2 point move, volume spike (300 vs 125 avg), fast movement (<5 min)
      expect(result.data.hasSteam).toBe(true);
      expect(result.data.steamDirection).toBeDefined();
      expect(result.data.steamDirection).toBe('over'); // Line moved up
      expect(result.data.lineMovement).toBeGreaterThanOrEqual(1.5);
      expect(result.data.volumeSpike).toBe(true);
      expect(result.data.velocity).toBe('rapid');
      expect(result.confidence).toBeGreaterThanOrEqual(0.6);
      expect(result.score).toBeGreaterThanOrEqual(0.6);
    });

    it('should not detect steam with small line movement', async () => {
      const now = Date.now();
      const context = createMockContext({
        marketData: {
          lineMovementHistory: new Map([
            [
              'prop_123',
              [
                { timestamp: now - 300000, line: 25.5, volume: 100 },
                { timestamp: now - 150000, line: 25.8, volume: 150 },
                { timestamp: now, line: 26.0, volume: 200 }, // Only 0.5 point move
              ],
            ],
          ]),
        },
      });

      const result = await feature.calculate(context);

      expect(result.data.hasSteam).toBe(false);
      expect(result.confidence).toBeLessThan(0.6);
    });

    it('should detect downward steam move', async () => {
      const now = Date.now();
      const context = createMockContext({
        marketData: {
          lineMovementHistory: new Map([
            [
              'prop_123',
              [
                { timestamp: now - 300000, line: 27.5, volume: 100 },
                { timestamp: now - 150000, line: 26.5, volume: 150 },
                { timestamp: now, line: 25.5, volume: 300 }, // 2 point move down
              ],
            ],
          ]),
        },
      });

      const result = await feature.calculate(context);

      expect(result.data.hasSteam).toBe(true);
      expect(result.data.steamDirection).toBe('under'); // Line moved down
    });

    it('should detect steam with significant movement and volume spike (no fast velocity)', async () => {
      const now = Date.now();
      const context = createMockContext({
        marketData: {
          lineMovementHistory: new Map([
            [
              'prop_123',
              [
                { timestamp: now - 1800000, line: 25.5, volume: 100 }, // 30 min ago
                { timestamp: now - 900000, line: 26.5, volume: 120 }, // 15 min ago
                { timestamp: now, line: 27.5, volume: 300 }, // Now - slow but significant
              ],
            ],
          ]),
        },
      });

      const result = await feature.calculate(context);

      // Confidence = 0.5 (significant movement) + 0.3 (volume spike) = 0.8
      expect(result.data.hasSteam).toBe(true);
      expect(result.data.velocity).toBe('slow');
      expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    });
  });

  describe('calculate - Edge Cases', () => {
    it('should return no steam with insufficient data', async () => {
      const context = createMockContext({
        marketData: {
          lineMovementHistory: new Map([
            [
              'prop_123',
              [
                { timestamp: Date.now() - 300000, line: 25.5, volume: 100 },
                { timestamp: Date.now(), line: 26.0, volume: 150 },
              ],
            ],
          ]),
        },
      });

      const result = await feature.calculate(context);

      expect(result.score).toBe(0);
      expect(result.data.hasSteam).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('should handle missing volume data gracefully', async () => {
      const now = Date.now();
      const context = createMockContext({
        marketData: {
          lineMovementHistory: new Map([
            [
              'prop_123',
              [
                { timestamp: now - 300000, line: 25.5 }, // No volume
                { timestamp: now - 150000, line: 26.5 }, // No volume
                { timestamp: now, line: 27.5 }, // No volume
              ],
            ],
          ]),
        },
      });

      const result = await feature.calculate(context);

      // Should still detect based on line movement and velocity
      expect(result.data.volumeSpike).toBe(false);
      // Confidence = 0.5 (movement) + 0.0 (no volume) + 0.2 (velocity) = 0.7
      expect(result.data.hasSteam).toBe(true);
      expect(result.confidence).toBeCloseTo(0.7, 1);
    });

    it('should handle no line movement (flat line)', async () => {
      const now = Date.now();
      const context = createMockContext({
        marketData: {
          lineMovementHistory: new Map([
            [
              'prop_123',
              [
                { timestamp: now - 300000, line: 25.5, volume: 100 },
                { timestamp: now - 150000, line: 25.5, volume: 150 },
                { timestamp: now, line: 25.5, volume: 200 },
              ],
            ],
          ]),
        },
      });

      const result = await feature.calculate(context);

      expect(result.data.hasSteam).toBe(false);
      expect(result.data.steamDirection).toBeUndefined();
      expect(result.data.lineMovement).toBe(0);
    });
  });

  describe('calculate - Error Handling', () => {
    it('should return no steam on error', async () => {
      const context = createMockContext({
        marketData: {
          lineMovementHistory: new Map([
            [
              'prop_123',
              [
                { timestamp: Date.now() - 300000, line: NaN, volume: 100 }, // Invalid line
                { timestamp: Date.now() - 150000, line: 26.0, volume: 150 },
                { timestamp: Date.now(), line: 27.0, volume: 200 },
              ],
            ],
          ]),
        },
      });

      const result = await feature.calculate(context);

      // Graceful degradation
      expect(result.score).toBe(0);
      expect(result.data.hasSteam).toBe(false);
      expect(result.confidence).toBe(0);
    });
  });

  describe('Metadata and Performance', () => {
    it('should include comprehensive metadata', async () => {
      const now = Date.now();
      const context = createMockContext({
        marketData: {
          lineMovementHistory: new Map([
            [
              'prop_123',
              [
                { timestamp: now - 300000, line: 25.5, volume: 100 },
                { timestamp: now - 150000, line: 26.5, volume: 150 },
                { timestamp: now, line: 27.5, volume: 300 },
              ],
            ],
          ]),
        },
      });

      const result = await feature.calculate(context);

      expect(result.metadata?.calculationTimeMs).toBeDefined();
      expect(result.metadata?.dataPoints).toBe(3);
      expect(result.metadata?.recentDataPoints).toBe(3);
      expect(result.metadata?.sufficientData).toBe(true);
      expect(result.metadata?.timeSpanMs).toBeDefined();
      expect(result.metadata?.movementThreshold).toBe(1.5);
      expect(result.metadata?.volumeSpikeThreshold).toBe(1.5);
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
