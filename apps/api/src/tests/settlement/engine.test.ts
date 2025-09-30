import { SettlementEngine } from '../../workflows/settlement/engine';

describe('SettlementEngine', () => {
  let engine: SettlementEngine;

  beforeEach(() => {
    engine = new SettlementEngine();
  });

  describe('Over/Under Markets', () => {
    test('should handle over bet winning', () => {
      const result = engine.evaluate({
        league: 'MLB',
        market: 'total_bases',
        line: 2.5,
        betType: 'over',
        actualStat: 3
      });

      expect(result.outcome).toBe('win');
      expect(result.actualStat).toBe(3);
      expect(result.reason).toContain('Actual: 3, Line: 2.5, Bet: over');
    });

    test('should handle under bet winning', () => {
      const result = engine.evaluate({
        league: 'NFL',
        market: 'passing_yards',
        line: 250.5,
        betType: 'under',
        actualStat: 225
      });

      expect(result.outcome).toBe('win');
      expect(result.actualStat).toBe(225);
    });

    test('should handle over bet losing', () => {
      const result = engine.evaluate({
        league: 'NBA',
        market: 'points',
        line: 25.5,
        betType: 'over',
        actualStat: 24
      });

      expect(result.outcome).toBe('loss');
      expect(result.actualStat).toBe(24);
    });

    test('should handle push (exact match)', () => {
      const result = engine.evaluate({
        league: 'MLB',
        market: 'hits',
        line: 2,
        betType: 'over',
        actualStat: 2
      });

      expect(result.outcome).toBe('push');
      expect(result.reason).toContain('equals line');
    });

    test('should normalize bet type variations', () => {
      const variations = ['o', 'ov', 'more', 'higher'];
      
      variations.forEach(variation => {
        const result = engine.evaluate({
          league: 'MLB',
          market: 'home_runs',
          line: 0.5,
          betType: variation,
          actualStat: 1
        });
        
        expect(result.outcome).toBe('win');
      });
    });
  });

  describe('Yes/No Markets', () => {
    test('should handle anytime touchdown scorer - yes bet winning', () => {
      const result = engine.evaluate({
        league: 'NFL',
        market: 'anytime_td_scorer',
        line: 0.5,
        betType: 'yes',
        actualStat: 1
      });

      expect(result.outcome).toBe('win');
      expect(result.reason).toContain('Event occurred');
    });

    test('should handle anytime touchdown scorer - no bet winning', () => {
      const result = engine.evaluate({
        league: 'NFL',
        market: 'anytime_td_scorer',
        line: 0.5,
        betType: 'no',
        actualStat: 0
      });

      expect(result.outcome).toBe('win');
      expect(result.reason).toContain('Event did not occur');
    });

    test('should handle multiple touchdowns for anytime scorer', () => {
      const result = engine.evaluate({
        league: 'NFL',
        market: 'anytime_td_scorer',
        line: 0.5,
        betType: 'yes',
        actualStat: 3
      });

      expect(result.outcome).toBe('win');
    });
  });

  describe('Alternate Lines', () => {
    test('should not push on alternate lines', () => {
      const result = engine.evaluate({
        league: 'NBA',
        market: 'points',
        line: 25,
        betType: 'alternate_over',
        actualStat: 25
      });

      expect(result.outcome).toBe('loss');
      expect(result.reason).toContain('Alternate line');
    });
  });

  describe('Void Handling', () => {
    test('should void when no stat data available', () => {
      const result = engine.evaluate({
        league: 'MLB',
        market: 'hits',
        line: 2.5,
        betType: 'over',
        actualStat: null as any
      });

      expect(result.outcome).toBe('void');
      expect(result.reason).toBe('No stat data available');
    });

    test('should void for unknown bet type', () => {
      const result = engine.evaluate({
        league: 'MLB',
        market: 'hits',
        line: 2.5,
        betType: 'unknown_type',
        actualStat: 3
      });

      expect(result.outcome).toBe('void');
      expect(result.reason).toContain('Unknown bet type');
    });
  });

  describe('Parlay Evaluation', () => {
    test('should win when all legs win', () => {
      const result = engine.evaluateParlay(['win', 'win', 'win']);
      expect(result).toBe('win');
    });

    test('should lose when any leg loses', () => {
      const result = engine.evaluateParlay(['win', 'loss', 'win']);
      expect(result).toBe('loss');
    });

    test('should push when all legs push', () => {
      const result = engine.evaluateParlay(['push', 'push']);
      expect(result).toBe('push');
    });

    test('should be reduced win with push and win', () => {
      const result = engine.evaluateParlay(['push', 'win', 'win']);
      expect(result).toBe('win');
    });

    test('should void when any leg is void', () => {
      const result = engine.evaluateParlay(['win', 'void', 'win']);
      expect(result).toBe('void');
    });
  });

  describe('Validation', () => {
    test('should validate reasonable MLB stats', () => {
      const valid = engine.validateSettlement('MLB', 'total_bases', 8);
      expect(valid).toBe(true);
    });

    test('should flag suspicious stats but still return true', () => {
      // Mock logger to capture warnings
      const logSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const valid = engine.validateSettlement('MLB', 'home_runs', 10);
      expect(valid).toBe(true); // Still valid but logged warning
      
      logSpy.mockRestore();
    });

    test('should handle unknown leagues gracefully', () => {
      const valid = engine.validateSettlement('UNKNOWN', 'points', 50);
      expect(valid).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle zero stats correctly', () => {
      const result = engine.evaluate({
        league: 'NFL',
        market: 'interceptions',
        line: 0.5,
        betType: 'under',
        actualStat: 0
      });

      expect(result.outcome).toBe('win');
      expect(result.actualStat).toBe(0);
    });

    test('should handle decimal line with whole number actual', () => {
      const result = engine.evaluate({
        league: 'NBA',
        market: 'rebounds',
        line: 9.5,
        betType: 'over',
        actualStat: 10
      });

      expect(result.outcome).toBe('win');
    });

    test('should handle negative stats (rare but possible)', () => {
      const result = engine.evaluate({
        league: 'NFL',
        market: 'rushing_yards',
        line: -0.5,
        betType: 'over',
        actualStat: -5
      });

      expect(result.outcome).toBe('loss');
      expect(result.actualStat).toBe(-5);
    });
  });
});