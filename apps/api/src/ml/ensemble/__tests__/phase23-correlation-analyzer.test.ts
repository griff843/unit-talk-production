/**
 * Phase 23: Correlation Analyzer Unit Tests
 * Date: 2025-11-14
 * Coverage: 12 tests
 */

import { CorrelationAnalyzer } from '../phase23-correlation-analyzer';
import { Logger } from '@shared/types';

describe('CorrelationAnalyzer', () => {
  let analyzer: CorrelationAnalyzer;
  let mockLogger: Logger;
  let mockSupabase: any;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          or: jest.fn().mockReturnValue({
            gte: jest.fn().mockResolvedValue({ data: [], error: null })
          })
        })
      })
    };

    analyzer = new CorrelationAnalyzer(mockLogger, mockSupabase);
  });

  describe('computeModelCorrelation', () => {
    it('should return 0 for insufficient data', () => {
      const result = analyzer.computeModelCorrelation('a', 'b', []);
      expect(result).toBe(0);
    });

    it('should compute perfect correlation for identical models', () => {
      const predictions = [
        { modelA: 1, modelB: 1 },
        { modelA: 2, modelB: 2 },
        { modelA: 3, modelB: 3 }
      ];
      const result = analyzer.computeModelCorrelation('a', 'b', predictions);
      expect(result).toBeCloseTo(1.0, 2);
    });

    it('should compute negative correlation', () => {
      const predictions = [
        { modelA: 1, modelB: -1 },
        { modelA: 2, modelB: -2 },
        { modelA: 3, modelB: -3 }
      ];
      const result = analyzer.computeModelCorrelation('a', 'b', predictions);
      expect(result).toBeCloseTo(-1.0, 2);
    });

    it('should handle zero variance (denominator = 0)', () => {
      const predictions = [
        { modelA: 1, modelB: 1 },
        { modelA: 1, modelB: 1 }
      ];
      const result = analyzer.computeModelCorrelation('a', 'b', predictions);
      expect(result).toBe(0);
    });

    it('should compute partial correlation', () => {
      const predictions = [
        { modelA: 1, modelB: 2 },
        { modelA: 2, modelB: 3 },
        { modelA: 3, modelB: 4 }
      ];
      const result = analyzer.computeModelCorrelation('a', 'b', predictions);
      expect(result).toBeGreaterThan(0.9);
      expect(result).toBeLessThanOrEqual(1.0);
    });
  });

  describe('identifyRedundantModels', () => {
    it('should identify models with high correlation', () => {
      const trends = [
        { modelA: 'a', modelB: 'b', correlation: 0.9, trend: 'stable' as const, confidence: 0.8, window: '30d' as const },
        { modelA: 'c', modelB: 'd', correlation: 0.5, trend: 'stable' as const, confidence: 0.8, window: '30d' as const }
      ];
      const result = analyzer.identifyRedundantModels(trends, 0.85);
      expect(result).toContain('a');
      expect(result).toContain('b');
      expect(result).not.toContain('c');
    });

    it('should return empty array for no redundant models', () => {
      const trends = [
        { modelA: 'a', modelB: 'b', correlation: 0.5, trend: 'stable' as const, confidence: 0.8, window: '30d' as const }
      ];
      const result = analyzer.identifyRedundantModels(trends, 0.85);
      expect(result).toHaveLength(0);
    });
  });

  describe('suggestWeightAdjustments', () => {
    it('should reduce weight for high correlation', () => {
      const correlations = new Map([['model_a', 0.9]]);
      const weights = new Map([['model_a', 0.5]]);
      const result = analyzer.suggestWeightAdjustments(correlations, weights);
      
      expect(result).toHaveLength(1);
      expect(result[0].suggestedWeight).toBeLessThan(result[0].currentWeight);
    });

    it('should increase weight for low correlation', () => {
      const correlations = new Map([['model_a', 0.2]]);
      const weights = new Map([['model_a', 0.3]]);
      const result = analyzer.suggestWeightAdjustments(correlations, weights);
      
      expect(result).toHaveLength(1);
      expect(result[0].suggestedWeight).toBeGreaterThan(result[0].currentWeight);
    });

    it('should not adjust weight for moderate correlation', () => {
      const correlations = new Map([['model_a', 0.5]]);
      const weights = new Map([['model_a', 0.33]]);
      const result = analyzer.suggestWeightAdjustments(correlations, weights);
      
      expect(result).toHaveLength(0);
    });
  });

  describe('analyzeCorrelationTrends', () => {
    it('should handle invalid UUID', async () => {
      const result = await analyzer.analyzeCorrelationTrends('invalid-uuid', 30);
      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle invalid days parameter', async () => {
      const validUUID = '550e8400-e29b-41d4-a716-446655440000';
      const result = await analyzer.analyzeCorrelationTrends(validUUID, -1);
      expect(result).toEqual([]);
    });

    it('should return empty array on database error', async () => {
      mockSupabase.from().select().or().gte.mockResolvedValue({
        data: null,
        error: new Error('Database error')
      });

      const validUUID = '550e8400-e29b-41d4-a716-446655440000';
      const result = await analyzer.analyzeCorrelationTrends(validUUID, 30);
      expect(result).toEqual([]);
    });
  });
});

