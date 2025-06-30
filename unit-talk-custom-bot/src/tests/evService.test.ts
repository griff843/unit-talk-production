import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { EVService } from '../services/evService';

describe('EVService', () => {
  let evService: EVService;
  let mockDatabaseService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a minimal mock database service
    mockDatabaseService = {
      client: {
        from: jest.fn()
      }
    };

    evService = new EVService(mockDatabaseService);
  });

  describe('calculateEV', () => {
    it('should calculate expected value correctly for positive EV', () => {
      const odds = -110; // American odds
      const trueProbability = 0.6;
      const stake = 100;

      const result = evService.calculateEV(odds, trueProbability, stake);

      expect(result.expectedValue).toBeCloseTo(0.145, 2);
      expect(result.impliedProbability).toBeCloseTo(0.524, 3);
      expect(result.evPercentage).toBeGreaterThan(0);
      expect(result.expectedProfit).toBeGreaterThan(0);
    });

    it('should calculate expected value correctly for negative EV', () => {
      const odds = -110;
      const trueProbability = 0.4;
      const stake = 100;

      const result = evService.calculateEV(odds, trueProbability, stake);

      expect(result.expectedValue).toBeLessThan(0);
      expect(result.expectedProfit).toBeLessThan(0);
    });

    it('should handle positive American odds', () => {
      const odds = 200; // +200 American odds
      const trueProbability = 0.5;
      const stake = 100;

      const result = evService.calculateEV(odds, trueProbability, stake);

      expect(result.expectedValue).toBeGreaterThan(0);
      expect(result.expectedProfit).toBeGreaterThan(0);
    });

    it('should handle edge case odds', () => {
      // Test with very high confidence
      const result1 = evService.calculateEV(-110, 0.9, 100);
      expect(result1.expectedValue).toBeGreaterThan(0.5);

      // Test with very low confidence
      const result2 = evService.calculateEV(-110, 0.1, 100);
      expect(result2.expectedValue).toBeLessThan(-0.5);
    });

    it('should handle various odds formats correctly', () => {
      // Test negative American odds
      const result1 = evService.calculateEV(-200, 0.7, 100);
      expect(result1.expectedValue).toBeGreaterThan(0);

      // Test positive American odds
      const result2 = evService.calculateEV(150, 0.5, 100);
      expect(result2.expectedValue).toBeGreaterThan(0);

      // Test even odds
      const result3 = evService.calculateEV(100, 0.5, 100);
      expect(result3.expectedValue).toBe(0); // Should be exactly 0 EV
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid odds gracefully', () => {
      // Test with zero odds (should not crash)
      expect(() => evService.calculateEV(0, 0.5, 100)).not.toThrow();

      // Test with very small odds - this will have negative EV
      const result = evService.calculateEV(-10000, 0.99, 100);
      expect(result.expectedValue).toBeLessThan(0);
    });

    it('should handle invalid probabilities', () => {
      // Test with probability > 1
      const result1 = evService.calculateEV(-110, 1.5, 100);
      expect(result1.expectedValue).toBeGreaterThan(0);

      // Test with probability = 0
      const result2 = evService.calculateEV(-110, 0, 100);
      expect(result2.expectedValue).toBe(-1);
    });

    it('should handle extreme values', () => {
      // Test with very high stakes
      const result1 = evService.calculateEV(-110, 0.6, 10000);
      expect(result1.expectedProfit).toBeCloseTo(1454.55, 0); // Corrected expected value

      // Test with very small stakes
      const result2 = evService.calculateEV(-110, 0.6, 1);
      expect(result2.expectedProfit).toBeCloseTo(0.145, 2); // Corrected expected value
    });
  });

  describe('Mathematical Accuracy', () => {
    it('should maintain mathematical consistency', () => {
      const odds = -110;
      const trueProbability = 0.6;
      const stake = 100;

      const result = evService.calculateEV(odds, trueProbability, stake);

      // Verify the relationship between EV and expected profit
      expect(result.expectedProfit).toBeCloseTo(result.expectedValue * stake, 2);

      // Verify implied probability calculation
      const decimalOdds = 1.909; // -110 American odds
      const expectedImpliedProb = 1 / decimalOdds;
      expect(result.impliedProbability).toBeCloseTo(expectedImpliedProb, 3);
    });

    it('should handle break-even scenarios correctly', () => {
      // When true probability equals implied probability, EV should be close to 0
      const odds = -110;
      const impliedProb = 1 / 1.909; // ~0.524

      const result = evService.calculateEV(odds, impliedProb, 100);
      expect(result.expectedValue).toBeCloseTo(0, 2); // Reduced precision
      expect(result.expectedProfit).toBeCloseTo(0, 2); // Reduced precision
    });

    it('should scale linearly with stake', () => {
      const odds = -110;
      const trueProbability = 0.6;

      const result1 = evService.calculateEV(odds, trueProbability, 100);
      const result2 = evService.calculateEV(odds, trueProbability, 200);

      expect(result2.expectedProfit).toBeCloseTo(result1.expectedProfit * 2, 2);
      expect(result2.expectedValue).toBeCloseTo(result1.expectedValue, 5); // EV per unit should be same
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle minimum and maximum probabilities', () => {
      // Minimum probability (0)
      const result1 = evService.calculateEV(-110, 0, 100);
      expect(result1.expectedValue).toBe(-1);
      expect(result1.expectedProfit).toBe(-100);

      // Maximum probability (1)
      const result2 = evService.calculateEV(-110, 1, 100);
      expect(result2.expectedValue).toBeCloseTo(0.909, 3);
      expect(result2.expectedProfit).toBeCloseTo(90.9, 1);
    });

    it('should handle extreme odds values', () => {
      // Very favorable odds
      const result1 = evService.calculateEV(-10000, 0.99, 100);
      expect(result1.expectedValue).toBeLessThan(0);

      // Very unfavorable odds - this actually has positive EV due to high payout
      const result2 = evService.calculateEV(10000, 0.01, 100);
      expect(result2.expectedValue).toBeGreaterThan(0); // Changed expectation
    });
  });
});