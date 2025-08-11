import { EnhancedMLPipeline } from '../../ml/enhanced-pipeline';
import { FeatureSet, PredictionResult } from '../../types/ml';
import { mockFeatureSet } from '../mocks/ml-mocks';

describe('EnhancedMLPipeline', () => {
  let mlPipeline: EnhancedMLPipeline;

  beforeEach(() => {
    mlPipeline = new EnhancedMLPipeline();
  });

  describe('Feature Engineering', () => {
    it('should generate all required features', async () => {
      const input = {
        sport: 'NBA',
        player: 'LeBron James',
        market: 'points',
        line: 25.5,
        timestamp: new Date().toISOString()
      };

      const features = await mlPipeline['generateFeatures'](input);

      // Verify feature structure
      expect(features).toHaveProperty('historical');
      expect(features).toHaveProperty('market');
      expect(features).toHaveProperty('context');
      expect(features).toHaveProperty('metadata');

      // Verify historical features
      expect(features.historical).toHaveProperty('patterns');
      expect(features.historical.patterns).toHaveProperty('momentum');
      expect(features.historical.patterns).toHaveProperty('reversal');
      expect(features.historical.patterns).toHaveProperty('volatility');

      // Verify market features
      expect(features.market).toHaveProperty('sharpMoney');
      expect(features.market).toHaveProperty('lineMovement');
      expect(features.market).toHaveProperty('volumeAnalysis');

      // Verify feature quality
      expect(features.metadata.quality).toBeGreaterThan(0.8);
    });

    it('should handle missing historical data gracefully', async () => {
      const input = {
        sport: 'NBA',
        player: 'Rookie Player', // No historical data
        market: 'points',
        line: 15.5,
        timestamp: new Date().toISOString()
      };

      const features = await mlPipeline['generateFeatures'](input);

      // Should still have features but with default/fallback values
      expect(features.historical.patterns.momentum).toHaveLength(0);
      expect(features.metadata.quality).toBeLessThan(0.8);
    });
  });

  describe('Model Predictions', () => {
    it('should generate high confidence predictions for strong signals', async () => {
      const mockFeatures: FeatureSet = {
        historical: {
          patterns: {
            momentum: [0.8, 0.85, 0.9],
            reversal: [0.1, 0.15, 0.1],
            volatility: [0.2, 0.18, 0.15]
          },
          windows: {
            5: { mean: 26.5, std: 2.1, min: 22, max: 30, trend: 0.8 },
            15: { mean: 25.8, std: 2.3, min: 20, max: 32, trend: 0.75 }
          },
          correlations: {
            team: 0.7,
            player: 0.85,
            market: 0.6
          }
        },
        market: {
          sharpMoney: {
            direction: 'up',
            strength: 0.8,
            confidence: 0.85
          },
          lineMovement: {
            direction: 'up',
            magnitude: 0.5,
            velocity: 0.3
          },
          volumeAnalysis: {
            total: 1000,
            distribution: [0.3, 0.4, 0.3],
            unusual: false
          },
          steam: {
            detected: true,
            direction: 'up',
            strength: 0.7
          }
        },
        context: {
          situational: {
            importance: 0.8,
            momentum: 0.7,
            pressure: 0.6
          },
          weather: {
            impact: 0,
            conditions: []
          },
          injuries: {
            impact: 0.1,
            affected: []
          },
          matchups: {
            advantage: 0.7,
            keyFactors: ['favorable_matchup', 'home_court']
          }
        },
        metadata: {
          timestamp: new Date().toISOString(),
          quality: 0.9,
          confidence: 0.85,
          sources: ['historical', 'market', 'context']
        }
      };

      const prediction = await mlPipeline.predict(mockFeatures);

      expect(prediction.confidence).toBeGreaterThan(0.8);
      expect(prediction.metadata?.dataQuality).toBeGreaterThan(0.8);
    });

    it('should have lower confidence for conflicting signals', async () => {
      const mockFeatures: FeatureSet = {
        ...mockFeatureSet,
        market: {
          ...mockFeatureSet.market,
          sharpMoney: {
            direction: 'up',
            strength: 0.8,
            confidence: 0.85
          },
          lineMovement: {
            direction: 'down', // Conflicting signal
            magnitude: 0.5,
            velocity: 0.3
          }
        }
      };

      const prediction = await mlPipeline.predict(mockFeatures);

      expect(prediction.confidence).toBeLessThan(0.8);
      expect(prediction.metadata?.dataQuality).toBeGreaterThan(0.8);
    });
  });

  describe('Model Ensemble', () => {
    it('should properly weight model predictions', async () => {
      const mockPredictions = new Map<string, PredictionResult>([
        ['gradientBoosting', {
          prediction: 1,
          confidence: 0.9,
          latency: 50,
          metadata: { modelVersion: '1.0', dataQuality: 0.95 }
        }],
        ['neuralNetwork', {
          prediction: 0,
          confidence: 0.6,
          latency: 100,
          metadata: { modelVersion: '1.0', dataQuality: 0.95 }
        }]
      ]);

      const result = await mlPipeline['ensemblePredictions'](mockPredictions);

      // Higher confidence model should have more influence
      expect(result.prediction).toBe(1);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should handle model failures gracefully', async () => {
      const mockPredictions = new Map<string, PredictionResult>([
        ['gradientBoosting', {
          prediction: 1,
          confidence: 0.9,
          latency: 50,
          metadata: { modelVersion: '1.0', dataQuality: 0.95 }
        }],
        ['neuralNetwork', null as any] // Failed model
      ]);

      const result = await mlPipeline['ensemblePredictions'](mockPredictions);

      // Should still produce valid prediction using available models
      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track prediction latency', async () => {
      const startTime = Date.now();
      await mlPipeline.predict(mockFeatureSet);
      const endTime = Date.now();

      const latency = endTime - startTime;
      expect(latency).toBeLessThan(200); // Maximum allowed latency
    });

    it('should maintain prediction quality under load', async () => {
      const predictions = await Promise.all(
        Array(10).fill(null).map(() => mlPipeline.predict(mockFeatureSet))
      );

      predictions.forEach(prediction => {
        expect(prediction.metadata?.dataQuality).toBeGreaterThan(0.8);
      });
    });
  });
}); 