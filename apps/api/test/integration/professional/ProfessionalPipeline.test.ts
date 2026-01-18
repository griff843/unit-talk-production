/**
 * Integration Tests: ProfessionalPipeline
 *
 * Tests for the complete professional pipeline with all 8 features.
 */

import { ProfessionalPipeline } from '../../../src/services/professional/ProfessionalPipeline';
import {
  SteamDetectionFeature,
  ClosingLinePredictionFeature,
  PublicVsSharpFeature,
  OptimalTimingFeature,
  LineShoppingFeature,
  MarketTimingFeature,
  InjuryTimingFeature,
  CrossMarketFeature,
} from '../../../src/services/professional/features';
import {
  createPhase2IntegratedContext,
  createMockContext,
  createFullMarketData,
  createMockCLVData,
  assertValidFeatureResult,
} from '../../unit/professional/testHelpers';

describe('ProfessionalPipeline Integration', () => {
  let pipeline: ProfessionalPipeline;

  beforeEach(() => {
    pipeline = new ProfessionalPipeline([
      new SteamDetectionFeature(),
      new ClosingLinePredictionFeature(),
      new PublicVsSharpFeature(),
      new OptimalTimingFeature(),
      new LineShoppingFeature(),
      new MarketTimingFeature(),
      new InjuryTimingFeature(),
      new CrossMarketFeature(),
    ]);
  });

  describe('Pipeline Initialization', () => {
    it('should initialize with all 8 features', () => {
      const features = pipeline.getFeatures();
      expect(features).toHaveLength(8);

      const featureIds = features.map((f) => f.id);
      expect(featureIds).toContain('steam-detection');
      expect(featureIds).toContain('closing-line-prediction');
      expect(featureIds).toContain('public-vs-sharp');
      expect(featureIds).toContain('optimal-timing');
      expect(featureIds).toContain('line-shopping');
      expect(featureIds).toContain('market-timing');
      expect(featureIds).toContain('injury-timing');
      expect(featureIds).toContain('cross-market');
    });

    it('should have correct default weights', () => {
      const weights = pipeline.getWeights();

      expect(weights['steam-detection']).toBe(0.025); // 2.5%
      expect(weights['closing-line-prediction']).toBe(0.020); // 2.0%
      expect(weights['public-vs-sharp']).toBe(0.020); // 2.0%
      expect(weights['optimal-timing']).toBe(0.015); // 1.5%
      expect(weights['line-shopping']).toBe(0.015); // 1.5%
      expect(weights['market-timing']).toBe(0.010); // 1.0%
      expect(weights['injury-timing']).toBe(0.010); // 1.0%
      expect(weights['cross-market']).toBe(0.005); // 0.5%
    });

    it('should support custom weights', () => {
      const customPipeline = new ProfessionalPipeline(
        [new SteamDetectionFeature(), new ClosingLinePredictionFeature()],
        {
          weights: {
            'steam-detection': 0.030,
            'closing-line-prediction': 0.025,
          },
        }
      );

      const weights = customPipeline.getWeights();
      expect(weights['steam-detection']).toBe(0.030);
      expect(weights['closing-line-prediction']).toBe(0.025);
    });
  });

  describe('Full Pipeline Execution', () => {
    it('should execute all features and return valid result', async () => {
      const context = createPhase2IntegratedContext();

      const result = await pipeline.execute(context);

      // Verify result structure
      expect(result.compositeScore).toBeGreaterThanOrEqual(0);
      expect(result.compositeScore).toBeLessThanOrEqual(1);
      expect(result.featureResults).toBeDefined();
      expect(result.insights).toBeDefined();
      expect(result.metadata).toBeDefined();

      // Verify metadata
      expect(result.metadata!.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(result.metadata!.featuresExecuted).toBeGreaterThan(0);
      expect(result.metadata!.featuresExecuted).toBeLessThanOrEqual(8);
    });

    it('should include canonical IDs in execution context', async () => {
      const context = createPhase2IntegratedContext({
        canonicalGameId: 'game_integration_test_123',
        canonicalPlayerId: 'player_integration_test_456',
      });

      const result = await pipeline.execute(context);

      // Pipeline should execute successfully with canonical IDs
      expect(result.compositeScore).toBeGreaterThanOrEqual(0);
    });

    it('should include CLV data in execution context', async () => {
      const context = createPhase2IntegratedContext({
        clvData: createMockCLVData({
          clvBps: 25, // 0.25% CLV
        }),
      });

      const result = await pipeline.execute(context);

      // Pipeline should execute successfully with CLV data
      expect(result.compositeScore).toBeGreaterThanOrEqual(0);
    });

    it('should populate unified insights structure', async () => {
      const context = createPhase2IntegratedContext();

      const result = await pipeline.execute(context);

      const insights = result.insights;

      // Check that insights match expected structure
      expect(insights).toBeDefined();
      // Not all insights may be present depending on data availability
      // But structure should be correct
      if (insights.steamAnalysis) {
        expect(insights.steamAnalysis.hasSteam).toBeDefined();
      }
      if (insights.predictedClosingLine) {
        expect(insights.predictedClosingLine.predictedLine).toBeDefined();
      }
      if (insights.optimalBettingTime) {
        expect(insights.optimalBettingTime.hoursToGame).toBeDefined();
      }
    });
  });

  describe('Error Handling and Graceful Degradation', () => {
    it('should continue execution if one feature fails', async () => {
      // Create a context that will cause some features to skip
      const context = createMockContext({
        marketData: undefined, // This will cause steam detection to skip
      });

      const result = await pipeline.execute(context);

      // Pipeline should still execute and return a result
      expect(result.compositeScore).toBeGreaterThanOrEqual(0);
      expect(result.metadata!.featuresSkipped).toBeGreaterThan(0);
      expect(result.metadata!.featuresExecuted).toBeGreaterThan(0);
    });

    it('should handle missing market data gracefully', async () => {
      const context = createMockContext({
        marketData: undefined,
      });

      const result = await pipeline.execute(context);

      // Some features can still calculate without market data
      expect(result.compositeScore).toBeGreaterThanOrEqual(0);
      expect(result.metadata!.featuresExecuted).toBeGreaterThan(0);
    });

    it('should calculate composite score correctly with partial results', async () => {
      const context = createMockContext({
        hoursToGame: 20,
        marketData: {
          bettingPercentages: new Map([
            ['prop_123', { public: 75, sharp: 25, timestamp: Date.now() }],
          ]),
        },
      });

      const result = await pipeline.execute(context);

      // Composite score should be weighted average of available features
      expect(result.compositeScore).toBeGreaterThan(0);
      expect(result.metadata!.featuresExecuted).toBeGreaterThan(0);
    });
  });

  describe('Feature Execution Order', () => {
    it('should execute features sequentially by default', async () => {
      const context = createPhase2IntegratedContext();

      const startTime = Date.now();
      const result = await pipeline.execute(context);
      const totalTime = Date.now() - startTime;

      // Sequential execution should take measurable time
      expect(result.metadata!.totalDurationMs).toBeGreaterThan(0);
      expect(result.metadata!.totalDurationMs).toBeLessThanOrEqual(totalTime + 10); // Small buffer
    });

    it('should support parallel execution when configured', async () => {
      const parallelPipeline = new ProfessionalPipeline(
        [
          new SteamDetectionFeature(),
          new ClosingLinePredictionFeature(),
          new PublicVsSharpFeature(),
        ],
        { parallel: true }
      );

      const context = createPhase2IntegratedContext();
      const result = await parallelPipeline.execute(context);

      // Parallel execution should still return valid results
      expect(result.compositeScore).toBeGreaterThanOrEqual(0);
      expect(result.metadata!.featuresExecuted).toBeGreaterThan(0);
    });
  });

  describe('Realistic Prop Scenarios', () => {
    it('should handle early betting scenario (>24 hours)', async () => {
      const context = createPhase2IntegratedContext({
        hoursToGame: 30,
        marketData: createFullMarketData(),
      });

      const result = await pipeline.execute(context);

      // Optimal timing and market timing should give high scores
      expect(result.insights.optimalBettingTime?.isOptimal).toBe(true);
      expect(result.insights.marketTimingAdvantage?.timeDecayFactor).toBeGreaterThan(0.7);
    });

    it('should handle breaking news scenario', async () => {
      const context = createPhase2IntegratedContext({
        hoursToGame: 3,
        features: {
          ...createPhase2IntegratedContext().features,
          injuryImpact: 7, // Major injury news
        },
      });

      const result = await pipeline.execute(context);

      // Injury timing and optimal timing should reflect breaking news
      expect(result.insights.injuryTimingAdvantage?.recentInjuries).toBe(true);
      expect(result.insights.optimalBettingTime?.recommendation).toBe('immediate');
    });

    it('should handle steam move scenario', async () => {
      const now = Date.now();
      const context = createPhase2IntegratedContext({
        marketData: {
          ...createFullMarketData(),
          lineMovementHistory: new Map([
            [
              'prop_123',
              [
                { timestamp: now - 300000, line: 25.5, volume: 100 },
                { timestamp: now - 150000, line: 26.5, volume: 200 },
                { timestamp: now, line: 27.5, volume: 400 }, // Steam detected
              ],
            ],
          ]),
        },
      });

      const result = await pipeline.execute(context);

      // Steam detection should show positive signal
      expect(result.insights.steamAnalysis?.hasSteam).toBe(true);
      expect(result.insights.steamAnalysis?.steamDirection).toBeDefined();
    });

    it('should handle contrarian opportunity scenario', async () => {
      const context = createPhase2IntegratedContext({
        marketData: {
          ...createFullMarketData(),
          bettingPercentages: new Map([
            ['prop_123', { public: 80, sharp: 20, timestamp: Date.now() }],
          ]),
        },
      });

      const result = await pipeline.execute(context);

      // Public vs sharp should detect contrarian opportunity
      expect(result.insights.bettingPercentages?.publicMoney).toBeDefined();
      expect(result.insights.bettingPercentages?.sharpMoney).toBeDefined();
    });
  });

  describe('Metadata and Observability', () => {
    it('should track individual feature results', async () => {
      const context = createPhase2IntegratedContext();

      const result = await pipeline.execute(context);

      // Each executed feature should have a result
      expect(result.featureResults.size).toBeGreaterThan(0);

      for (const [featureId, featureResult] of result.featureResults) {
        assertValidFeatureResult(featureResult);
        expect(featureId).toBeTruthy();
      }
    });

    it('should include feature execution stats', async () => {
      const context = createPhase2IntegratedContext();

      const result = await pipeline.execute(context);

      const metadata = result.metadata!;
      expect(metadata.featuresExecuted).toBeGreaterThan(0);
      expect(metadata.featuresSkipped).toBeGreaterThanOrEqual(0);
      expect(metadata.featuresFailed).toBeGreaterThanOrEqual(0);

      // Total features should add up
      const totalFeatures =
        metadata.featuresExecuted + metadata.featuresSkipped + metadata.featuresFailed;
      expect(totalFeatures).toBeLessThanOrEqual(8);
    });
  });
});
