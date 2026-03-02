/**
 * Tests for Rolling Metrics Watcher Service
 * Validates metrics tracking, auto-learning, and performance optimization
 */

import { rollingMetricsService } from '../../src/services/RollingMetricsService';

describe('RollingMetricsService Tests', () => {
  beforeEach(() => {
    // Set test environment variables
    process.env.LEARNING_MIN_SAMPLE_SIZE = '30';
    process.env.LEARNING_CONFIDENCE_THRESHOLD = '0.75';
    process.env.LEARNING_ADJUSTMENT_RATE = '0.1';
  });

  describe('Metrics Calculation', () => {
    test('should calculate 7-day window metrics', async () => {
      // Mock picks data
      const mockPicks = generateMockPicks(50, '7d');
      jest.spyOn(rollingMetricsService as any, 'getPicksForWindow').mockResolvedValue(mockPicks);

      const metrics = await rollingMetricsService.calculateMetricsForWindow('7d');

      expect(metrics.window).toBe('7d');
      expect(metrics.totalPicks).toBe(50);
      expect(metrics.metrics.postedEV).toBeDefined();
      expect(metrics.metrics.hitPercentage).toBeGreaterThanOrEqual(0);
      expect(metrics.metrics.hitPercentage).toBeLessThanOrEqual(100);
      expect(metrics.metrics.roi).toBeDefined();
    });

    test('should calculate 30-day window metrics', async () => {
      const mockPicks = generateMockPicks(200, '30d');
      jest.spyOn(rollingMetricsService as any, 'getPicksForWindow').mockResolvedValue(mockPicks);

      const metrics = await rollingMetricsService.calculateMetricsForWindow('30d');

      expect(metrics.window).toBe('30d');
      expect(metrics.totalPicks).toBe(200);
      expect(metrics.completedPicks).toBeGreaterThan(0);
    });

    test('should calculate lifetime metrics', async () => {
      const mockPicks = generateMockPicks(1000, 'lifetime');
      jest.spyOn(rollingMetricsService as any, 'getPicksForWindow').mockResolvedValue(mockPicks);

      const metrics = await rollingMetricsService.calculateMetricsForWindow('lifetime');

      expect(metrics.window).toBe('lifetime');
      expect(metrics.metrics.sharpeRatio).toBeDefined();
      expect(metrics.metrics.maxDrawdown).toBeGreaterThanOrEqual(0);
      expect(metrics.metrics.maxDrawdown).toBeLessThanOrEqual(1);
    });
  });

  describe('EV Metrics', () => {
    test('should calculate posted vs actual EV correctly', () => {
      const picks = [
        { expected_value: 0.06, result: 'won', odds: -110 },
        { expected_value: 0.05, result: 'lost', odds: -115 },
        { expected_value: 0.07, result: 'won', odds: 105 },
        { expected_value: 0.04, result: 'lost', odds: -105 },
      ];

      const evMetrics = rollingMetricsService['calculateEVMetrics'](picks);

      expect(evMetrics.postedEV).toBeCloseTo(0.055, 3); // Average of 0.06, 0.05, 0.07, 0.04
      expect(evMetrics.actualEV).toBeDefined();
      expect(evMetrics.deviation).toBeGreaterThanOrEqual(0);
    });

    test('should detect significant EV deviation', () => {
      const picks = [
        { expected_value: 0.08, result: 'lost', odds: -110 },
        { expected_value: 0.09, result: 'lost', odds: -110 },
        { expected_value: 0.07, result: 'lost', odds: -110 },
      ];

      const evMetrics = rollingMetricsService['calculateEVMetrics'](picks);

      expect(evMetrics.actualEV).toBeLessThan(0); // All losses
      expect(evMetrics.deviation).toBeGreaterThan(0.5); // High deviation
    });
  });

  describe('CLV Metrics', () => {
    test('should calculate positive CLV percentage', () => {
      const picks = [
        { clv_tracking: { current_clv_bps: 25 } },
        { clv_tracking: { current_clv_bps: -5 } },
        { clv_tracking: { current_clv_bps: 18 } },
        { clv_tracking: { current_clv_bps: 30 } },
      ];

      const clvMetrics = rollingMetricsService['calculateCLVMetrics'](picks);

      expect(clvMetrics.positivePercentage).toBe(75); // 3 out of 4 positive
      expect(clvMetrics.average).toBeCloseTo(17, 0); // (25 - 5 + 18 + 30) / 4
    });

    test('should calculate CLV capture rate', () => {
      const picks = [
        { clv_tracking: { current_clv_bps: 20, max_clv_bps: 30 } },
        { clv_tracking: { current_clv_bps: 15, max_clv_bps: 25 } },
      ];

      const clvMetrics = rollingMetricsService['calculateCLVMetrics'](picks);

      expect(clvMetrics.capture).toBeGreaterThan(50); // Capturing majority of theoretical CLV
      expect(clvMetrics.capture).toBeLessThan(100);
    });
  });

  describe('Hit Rate Metrics', () => {
    test('should calculate overall hit rate', () => {
      const picks = [
        { result: 'won', tier: 'S', sport: 'NBA' },
        { result: 'won', tier: 'A', sport: 'NBA' },
        { result: 'lost', tier: 'S', sport: 'NFL' },
        { result: 'won', tier: 'B', sport: 'NBA' },
        { result: 'lost', tier: 'A', sport: 'NFL' },
      ];

      const hitMetrics = rollingMetricsService['calculateHitMetrics'](picks);

      expect(hitMetrics.overall).toBe(60); // 3 out of 5
      expect(hitMetrics.byTier['S']).toBe(50); // 1 out of 2
      expect(hitMetrics.byTier['A']).toBe(50); // 1 out of 2
      expect(hitMetrics.byTier['B']).toBe(100); // 1 out of 1
    });

    test('should calculate hit rate by sport', () => {
      const picks = [
        { result: 'won', sport: 'NBA' },
        { result: 'won', sport: 'NBA' },
        { result: 'lost', sport: 'NBA' },
        { result: 'lost', sport: 'NFL' },
        { result: 'lost', sport: 'NFL' },
      ];

      const hitMetrics = rollingMetricsService['calculateHitMetrics'](picks);

      expect(hitMetrics.bySport['NBA']).toBeCloseTo(66.67, 1); // 2 out of 3
      expect(hitMetrics.bySport['NFL']).toBe(0); // 0 out of 2
    });
  });

  describe('ROI Metrics', () => {
    test('should calculate positive ROI', () => {
      const picks = [
        { result: 'won', stake: 100, odds: -110 }, // Win $90.91
        { result: 'won', stake: 100, odds: 120 }, // Win $120
        { result: 'lost', stake: 100, odds: -110 }, // Lose $100
      ];

      const roiMetrics = rollingMetricsService['calculateROIMetrics'](picks);

      // Total staked: $300
      // Total returns: $190.91 + $220 = $410.91
      // ROI: (410.91 - 300) / 300 = 36.97%
      expect(roiMetrics.overall).toBeGreaterThan(30);
    });

    test('should calculate negative ROI', () => {
      const picks = [
        { result: 'lost', stake: 100, odds: -110 },
        { result: 'lost', stake: 100, odds: -120 },
        { result: 'won', stake: 100, odds: -110 },
      ];

      const roiMetrics = rollingMetricsService['calculateROIMetrics'](picks);

      // Lost more than won
      expect(roiMetrics.overall).toBeLessThan(0);
    });

    test('should calculate ROI by tier', () => {
      const picks = [
        { result: 'won', stake: 100, odds: -110, tier: 'S' },
        { result: 'won', stake: 100, odds: -110, tier: 'S' },
        { result: 'lost', stake: 100, odds: -110, tier: 'A' },
      ];

      const roiMetrics = rollingMetricsService['calculateROIMetrics'](picks);

      expect(roiMetrics.byTier['S']).toBeGreaterThan(0);
      expect(roiMetrics.byTier['A']).toBe(-100); // Lost all A tier bets
    });
  });

  describe('Risk Metrics', () => {
    test('should calculate Sharpe ratio', () => {
      const picks = [
        { result: 'won', odds: -110, settled_at: '2025-01-01' },
        { result: 'lost', odds: -110, settled_at: '2025-01-02' },
        { result: 'won', odds: 150, settled_at: '2025-01-03' },
        { result: 'won', odds: -120, settled_at: '2025-01-04' },
      ];

      const riskMetrics = rollingMetricsService['calculateRiskMetrics'](picks);

      expect(riskMetrics.sharpe).toBeDefined();
      expect(riskMetrics.sharpe).toBeGreaterThan(-2);
      expect(riskMetrics.sharpe).toBeLessThan(5);
    });

    test('should calculate maximum drawdown', () => {
      const picks = [
        { result: 'won', odds: -110, settled_at: '2025-01-01' },
        { result: 'won', odds: -110, settled_at: '2025-01-02' },
        { result: 'lost', odds: -110, settled_at: '2025-01-03' },
        { result: 'lost', odds: -110, settled_at: '2025-01-04' },
        { result: 'lost', odds: -110, settled_at: '2025-01-05' },
      ];

      const riskMetrics = rollingMetricsService['calculateRiskMetrics'](picks);

      expect(riskMetrics.maxDrawdown).toBeGreaterThan(0);
      expect(riskMetrics.maxDrawdown).toBeLessThanOrEqual(1);
    });

    test('should calculate profit factor', () => {
      const picks = [
        { result: 'won', odds: 150 }, // +1.5
        { result: 'won', odds: -110 }, // +0.909
        { result: 'lost', odds: -110 }, // -1
        { result: 'lost', odds: -120 }, // -1
      ];

      const riskMetrics = rollingMetricsService['calculateRiskMetrics'](picks);

      // Gross profit: 2.409, Gross loss: 2
      expect(riskMetrics.profitFactor).toBeGreaterThan(1); // Profitable
      expect(riskMetrics.winRate).toBe(50);
    });
  });

  describe('Kelly Metrics', () => {
    test('should calculate Kelly efficiency', () => {
      const picks = [
        {
          position_size: 0.05,
          expected_value: 0.06,
          confidence: 0.75,
          odds: -110,
          result: 'won',
        },
        {
          position_size: 0.08,
          expected_value: 0.08,
          confidence: 0.8,
          odds: 120,
          result: 'won',
        },
      ];

      const kellyMetrics = rollingMetricsService['calculateKellyMetrics'](picks);

      expect(kellyMetrics.efficiency).toBeGreaterThan(0);
      expect(kellyMetrics.efficiency).toBeLessThanOrEqual(1.5); // Can be slightly over-betting
      expect(kellyMetrics.atRisk).toBeCloseTo(0.065, 3); // Average position size
    });

    test('should calculate Kelly regret', () => {
      const picks = [
        {
          position_size: 0.02, // Under-sizing
          expected_value: 0.1, // High EV
          confidence: 0.85,
          odds: -110,
          result: 'won',
        },
      ];

      const kellyMetrics = rollingMetricsService['calculateKellyMetrics'](picks);

      expect(kellyMetrics.regret).toBeGreaterThan(0); // Should have sized larger
    });
  });

  describe('Auto-Learning', () => {
    test('should detect need for EV adjustment', async () => {
      const metrics = {
        window: '30d' as const,
        startDate: new Date(),
        endDate: new Date(),
        totalPicks: 100,
        completedPicks: 100,
        metrics: {
          evDeviation: 0.25, // 25% deviation
          postedEV: 0.06,
          actualEV: 0.045,
          // ... other metrics
        } as any,
      };

      const adjustment = rollingMetricsService['createEVAdjustment']('NBA', metrics);

      expect(adjustment).not.toBeNull();
      expect(adjustment?.adjustmentType).toBe('threshold');
      expect(adjustment?.parameter).toBe('min_expected_value');
      expect(adjustment?.newValue).toBeGreaterThan(adjustment?.oldValue || 0);
    });

    test('should detect need for CLV adjustment', async () => {
      const metrics = {
        window: '30d' as const,
        metrics: {
          averageCLV: 5, // Only 5 BPS average CLV
        } as any,
      } as any;

      const adjustment = rollingMetricsService['createCLVAdjustment']('NFL', metrics);

      expect(adjustment).not.toBeNull();
      expect(adjustment?.parameter).toBe('min_clv_threshold');
      expect(adjustment?.newValue).toBeLessThan(15); // Lowering threshold
    });

    test('should detect need for Kelly sizing adjustment', async () => {
      const metrics = {
        window: '30d' as const,
        metrics: {
          kellyEfficiency: 0.6, // Only 60% efficient
        } as any,
      } as any;

      const adjustment = rollingMetricsService['createKellyAdjustment']('NBA', metrics);

      expect(adjustment).not.toBeNull();
      expect(adjustment?.adjustmentType).toBe('sizing');
      expect(adjustment?.newValue).toBeLessThan(1.0);
    });

    test('should not adjust with insufficient data', async () => {
      jest.spyOn(rollingMetricsService as any, 'calculateMetricsForWindow').mockResolvedValue({
        completedPicks: 20, // Below minimum 30
        metrics: {},
      });

      const runLearning = jest.spyOn(rollingMetricsService as any, 'analyzeSportPerformance');

      await rollingMetricsService['runLearningCycle']();

      expect(runLearning).not.toHaveBeenCalled();
    });
  });

  describe('Trend Analysis', () => {
    test('should identify improving trends', () => {
      const recent = {
        metrics: {
          actualEV: 0.08,
          averageCLV: 25,
          roi: 12,
        },
        completedPicks: 50,
      } as any;

      const historical = {
        metrics: {
          actualEV: 0.05,
          averageCLV: 15,
          roi: 8,
        },
        completedPicks: 200,
      } as any;

      const trend = rollingMetricsService['analyzeTrend'](recent, historical);

      expect(trend.evTrend).toBe('improving');
      expect(trend.clvTrend).toBe('improving');
      expect(trend.roiTrend).toBe('improving');
      expect(trend.confidence).toBeGreaterThan(0.5);
    });

    test('should identify declining trends', () => {
      const recent = {
        metrics: {
          actualEV: 0.03,
          averageCLV: 8,
          roi: -5,
        },
        completedPicks: 40,
      } as any;

      const historical = {
        metrics: {
          actualEV: 0.07,
          averageCLV: 20,
          roi: 10,
        },
        completedPicks: 150,
      } as any;

      const trend = rollingMetricsService['analyzeTrend'](recent, historical);

      expect(trend.evTrend).toBe('declining');
      expect(trend.clvTrend).toBe('declining');
      expect(trend.roiTrend).toBe('declining');
    });

    test('should identify stable trends', () => {
      const recent = {
        metrics: {
          actualEV: 0.052,
          averageCLV: 18,
          roi: 8.5,
        },
        completedPicks: 60,
      } as any;

      const historical = {
        metrics: {
          actualEV: 0.05,
          averageCLV: 17,
          roi: 8.2,
        },
        completedPicks: 180,
      } as any;

      const trend = rollingMetricsService['analyzeTrend'](recent, historical);

      expect(trend.evTrend).toBe('stable');
      expect(trend.clvTrend).toBe('stable');
      expect(trend.roiTrend).toBe('stable');
    });
  });

  describe('Performance Alerts', () => {
    test('should generate alert for EV deviation', async () => {
      const generateAlert = jest.spyOn(rollingMetricsService as any, 'generatePerformanceAlert');

      jest.spyOn(rollingMetricsService as any, 'calculateMetricsForWindow').mockResolvedValue({
        metrics: {
          evDeviation: 0.25, // 25% deviation, above 20% threshold
        },
      });

      await rollingMetricsService['checkPerformanceAlerts']();

      expect(generateAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'warning',
          type: 'anomaly',
          metric: 'ev_deviation',
        })
      );
    });

    test('should generate critical alert for excessive drawdown', async () => {
      const generateAlert = jest.spyOn(rollingMetricsService as any, 'generatePerformanceAlert');

      jest.spyOn(rollingMetricsService as any, 'calculateMetricsForWindow').mockResolvedValue({
        metrics: {
          maxDrawdown: 0.25, // 25% drawdown, above 20% limit
        },
      });

      await rollingMetricsService['checkPerformanceAlerts']();

      expect(generateAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'critical',
          type: 'threshold_breach',
          metric: 'max_drawdown',
        })
      );
    });
  });

  describe('Sport-Specific Metrics', () => {
    test('should calculate metrics for specific sport', async () => {
      const nbaPicks = generateMockPicks(50, '30d', 'NBA');
      jest.spyOn(rollingMetricsService as any, 'getPicksForWindow').mockResolvedValue(nbaPicks);

      const metrics = await rollingMetricsService.calculateMetricsForWindow('30d', 'NBA');

      expect(metrics.totalPicks).toBe(50);
      expect(metrics.metrics.hitBySport['NBA']).toBeDefined();
    });

    test('should get comprehensive sport metrics', async () => {
      jest
        .spyOn(rollingMetricsService, 'calculateMetricsForWindow')
        .mockImplementation(async (window, sport) => ({
          window,
          startDate: new Date(),
          endDate: new Date(),
          totalPicks: 100,
          completedPicks: 95,
          metrics: generateMockMetrics(),
        }));

      const sportMetrics = await rollingMetricsService.getSportMetrics('NBA');

      expect(sportMetrics.sport).toBe('NBA');
      expect(sportMetrics.windows).toHaveLength(3); // 7d, 30d, lifetime
      expect(sportMetrics.trends).toBeDefined();
      expect(sportMetrics.adjustments).toBeDefined();
    });
  });

  describe('Performance Summary', () => {
    test('should generate performance summary with recommendations', async () => {
      jest
        .spyOn(rollingMetricsService, 'calculateMetricsForWindow')
        .mockImplementation(async () => ({
          window: '30d',
          startDate: new Date(),
          endDate: new Date(),
          totalPicks: 200,
          completedPicks: 195,
          metrics: {
            ...generateMockMetrics(),
            roi: 3, // Below 5% target
            hitPercentage: 50, // Below 52% target
            maxDrawdown: 0.18, // Above 15% limit
            kellyEfficiency: 0.65, // Below 80% efficiency
          },
        }));

      const summary = await rollingMetricsService.getPerformanceSummary();

      expect(summary.current).toBeDefined();
      expect(summary.trends).toBeDefined();
      expect(summary.recommendations).toBeInstanceOf(Array);
      expect(summary.recommendations.length).toBeGreaterThan(0);
      expect(summary.recommendations.some(r => r.includes('ROI'))).toBe(true);
      expect(summary.recommendations.some(r => r.includes('hit rate'))).toBe(true);
    });
  });

  // Helper function to generate mock picks
  function generateMockPicks(count: number, window: string, sport = 'NBA'): any[] {
    const picks = [];
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const windowDays = window === '7d' ? 7 : window === '30d' ? 30 : 365;

    for (let i = 0; i < count; i++) {
      const daysAgo = Math.random() * windowDays;
      const result = Math.random() > 0.45 ? 'won' : 'lost'; // 55% win rate

      picks.push({
        id: `pick_${i}`,
        status: 'settled',
        result,
        sport,
        tier: ['S', 'A', 'B'][Math.floor(Math.random() * 3)],
        expected_value: 0.03 + Math.random() * 0.07,
        confidence: 0.65 + Math.random() * 0.25,
        odds: Math.random() > 0.5 ? -110 - Math.random() * 40 : 100 + Math.random() * 50,
        stake: 100,
        position_size: 0.05 + Math.random() * 0.15,
        clv_tracking: {
          current_clv_bps: -10 + Math.random() * 40,
          max_clv_bps: 20 + Math.random() * 20,
        },
        settled_at: new Date(now - daysAgo * dayMs).toISOString(),
        created_at: new Date(now - (daysAgo + 1) * dayMs).toISOString(),
      });
    }

    return picks;
  }

  // Helper function to generate mock metrics
  function generateMockMetrics(): any {
    return {
      postedEV: 0.055,
      actualEV: 0.048,
      evDeviation: 0.127,
      positiveCLVPercentage: 68,
      averageCLV: 18,
      clvCapture: 75,
      hitPercentage: 55,
      hitByTier: { S: 62, A: 56, B: 48 },
      hitBySport: { NBA: 56, NFL: 52 },
      roi: 8.5,
      roiByTier: { S: 12, A: 8, B: 4 },
      roiBySport: { NBA: 9, NFL: 7 },
      sharpeRatio: 1.2,
      maxDrawdown: 0.12,
      winRate: 55,
      avgWin: 0.91,
      avgLoss: 1,
      profitFactor: 1.25,
      kellyAtRisk: 0.12,
      kellyEfficiency: 0.85,
      kellyRegret: 5,
    };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
