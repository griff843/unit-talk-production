import { CorrelationAnalyzer, type CorrelationTrend } from '@/ml/ensemble/phase23-correlation-analyzer';
import type { Logger } from '@/utils/logger';

describe('CorrelationAnalyzer', () => {
  let analyzer: CorrelationAnalyzer;
  let mockLogger: Logger;
  let mockSupabase: any;
  let gteMock: jest.Mock;

  beforeEach(() => {
    gteMock = jest.fn().mockResolvedValue({ data: [], error: null });
    const orMock = jest.fn(() => ({ gte: gteMock }));
    const selectMock = jest.fn(() => ({ or: orMock }));
    const fromMock = jest.fn(() => ({ select: selectMock }));
    mockSupabase = { from: fromMock };

    const baseLogger: any = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
      setLevel: jest.fn(),
      activity: jest.fn(),
      child: jest.fn()
    };
    baseLogger.child.mockReturnValue(baseLogger);
    mockLogger = baseLogger as Logger;

    analyzer = new CorrelationAnalyzer(mockLogger, mockSupabase);
  });

  describe('computeModelCorrelation', () => {
    it('returns 0 for insufficient data', () => {
      const result = analyzer.computeModelCorrelation('a', 'b', []);
      expect(result).toBe(0);
    });

    it('returns 1 for perfectly correlated series', () => {
      const predictions = [{ modelA: 1, modelB: 1 }, { modelA: 2, modelB: 2 }, { modelA: 3, modelB: 3 }];
      const result = analyzer.computeModelCorrelation('a', 'b', predictions);
      expect(result).toBeCloseTo(1, 5);
    });

    it('returns -1 for perfectly negatively correlated series', () => {
      const predictions = [{ modelA: 1, modelB: -1 }, { modelA: 2, modelB: -2 }, { modelA: 3, modelB: -3 }];
      const result = analyzer.computeModelCorrelation('a', 'b', predictions);
      expect(result).toBeCloseTo(-1, 5);
    });

    it('returns 0 when denominator would be 0', () => {
      const predictions = [{ modelA: 1, modelB: 1 }, { modelA: 1, modelB: 1 }];
      const result = analyzer.computeModelCorrelation('a', 'b', predictions);
      expect(result).toBe(0);
    });
  });

  describe('identifyRedundantModels', () => {
    it('identifies models whose correlation exceeds threshold', () => {
      const trends: CorrelationTrend[] = [
        { modelA: 'a', modelB: 'b', correlation: 0.9, trend: 'stable', confidence: 0.8, window: '30d' },
        { modelA: 'c', modelB: 'd', correlation: 0.5, trend: 'stable', confidence: 0.8, window: '30d' }
      ];

      const result = analyzer.identifyRedundantModels(trends, 0.85);
      expect(result).toContain('a');
      expect(result).toContain('b');
      expect(result).not.toContain('c');
    });

    it('returns empty array when no correlations exceed threshold', () => {
      const trends: CorrelationTrend[] = [
        { modelA: 'a', modelB: 'b', correlation: 0.5, trend: 'stable', confidence: 0.8, window: '30d' }
      ];

      const result = analyzer.identifyRedundantModels(trends, 0.85);
      expect(result).toHaveLength(0);
    });
  });

  describe('suggestWeightAdjustments', () => {
    it('reduces weight for highly correlated models', () => {
      const correlations = new Map<string, number>([['model_a', 0.9]]);
      const weights = new Map<string, number>([['model_a', 0.5]]);

      const result = analyzer.suggestWeightAdjustments(correlations, weights);
      expect(result).toHaveLength(1);
      expect(result[0].suggestedWeight).toBeLessThan(result[0].currentWeight);
    });

    it('increases weight for low correlation models', () => {
      const correlations = new Map<string, number>([['model_a', 0.2]]);
      const weights = new Map<string, number>([['model_a', 0.3]]);

      const result = analyzer.suggestWeightAdjustments(correlations, weights);
      expect(result).toHaveLength(1);
      expect(result[0].suggestedWeight).toBeGreaterThan(result[0].currentWeight);
    });

    it('does not adjust weight for moderate correlation', () => {
      const correlations = new Map<string, number>([['model_a', 0.5]]);
      const weights = new Map<string, number>([['model_a', 0.33]]);

      const result = analyzer.suggestWeightAdjustments(correlations, weights);
      expect(result).toHaveLength(0);
    });
  });

  describe('analyzeCorrelationTrends', () => {
    const validUUID = '550e8400-e29b-41d4-a716-446655440000';

    it('returns empty array and logs error for invalid UUID', async () => {
      const result = await analyzer.analyzeCorrelationTrends('not-a-uuid', 30);
      expect(result).toEqual([]);
      expect((mockLogger as any).error).toHaveBeenCalled();
    });

    it('returns empty array for invalid days parameter', async () => {
      const result = await analyzer.analyzeCorrelationTrends(validUUID, -1);
      expect(result).toEqual([]);
    });

    it('returns empty array on database error', async () => {
      gteMock.mockResolvedValueOnce({ data: null, error: new Error('db error') });
      const result = await analyzer.analyzeCorrelationTrends(validUUID, 30);
      expect(result).toEqual([]);
    });

    it('builds trends from correlation history records', async () => {
      gteMock.mockResolvedValueOnce({
        data: [
          { model_a_id: 'm1', model_b_id: 'm2', correlation_coefficient: 0.8 },
          { model_a_id: 'm2', model_b_id: 'm1', correlation_coefficient: 0.9 }
        ],
        error: null
      });

      const result = await analyzer.analyzeCorrelationTrends(validUUID, 30);
      expect(result).toHaveLength(1);
      expect(result[0].modelA).toBe('m1');
      expect(result[0].modelB).toBe('m2');
      expect(result[0].correlation).toBeCloseTo(0.9, 5);
    });
  });
});

