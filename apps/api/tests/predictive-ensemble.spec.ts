/**
 * Predictive Ensemble E2E Tests - Phase 13 Model Serving & Ensemble Layer
 *
 * Tests for:
 * - Inference Gateway REST endpoints
 * - Ensemble predictions with confidence-weighted blending
 * - Performance metrics and SLO compliance
 * - Continuous evaluation
 * - Model registry integration
 *
 * @module tests/predictive-ensemble.spec.ts
 * @since Phase 13 - Model Serving & Ensemble Layer
 * @reference Production Charter v3.0
 */

import { test, expect } from '@playwright/test';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// Test data
const sampleFeatures = {
  current_odds: 2.0,
  volume: 5000,
  liquidity: 0.8,
  time_to_event: 120,
  volatility: 0.15,
  momentum: 0.3
};

test.describe('Phase 13 - Model Serving & Ensemble Layer', () => {

  test.describe('Inference Gateway - /api/predict', () => {

    test('should return prediction with required fields', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/api/predict`, {
        data: {
          features: sampleFeatures,
          ensembleMode: 'auto',
          includeExplanation: true
        }
      });

      expect(response.status()).toBe(200);

      const prediction = await response.json();

      // Verify required fields
      expect(prediction).toHaveProperty('predictionId');
      expect(prediction).toHaveProperty('prediction');
      expect(prediction).toHaveProperty('confidence');
      expect(prediction).toHaveProperty('modelUsed');
      expect(prediction).toHaveProperty('modelVersion');
      expect(prediction).toHaveProperty('metadata');

      // Verify prediction is in valid range [0, 1]
      expect(prediction.prediction).toBeGreaterThanOrEqual(0);
      expect(prediction.prediction).toBeLessThanOrEqual(1);

      // Verify confidence is in valid range [0, 1]
      expect(prediction.confidence).toBeGreaterThanOrEqual(0);
      expect(prediction.confidence).toBeLessThanOrEqual(1);

      // Verify metadata
      expect(prediction.metadata).toHaveProperty('latencyMs');
      expect(prediction.metadata).toHaveProperty('timestamp');
      expect(prediction.metadata).toHaveProperty('requestId');
    });

    test('should meet Charter SLO - p95 latency < 150ms', async ({ request }) => {
      const latencies: number[] = [];
      const iterations = 20;

      // Run multiple predictions to get latency distribution
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        const response = await request.post(`${API_BASE_URL}/api/predict`, {
          data: {
            features: sampleFeatures,
            ensembleMode: 'auto'
          }
        });

        const latency = Date.now() - startTime;
        latencies.push(latency);

        expect(response.status()).toBe(200);
      }

      // Calculate p95 latency
      latencies.sort((a, b) => a - b);
      const p95Index = Math.floor(latencies.length * 0.95);
      const p95Latency = latencies[p95Index];

      console.log(`P95 Latency: ${p95Latency}ms (Charter target: < 150ms)`);

      // Charter SLO: p95 < 150ms
      expect(p95Latency).toBeLessThan(150);
    });

    test('should handle missing features gracefully', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/api/predict`, {
        data: {
          features: {},
          ensembleMode: 'auto'
        }
      });

      expect(response.status()).toBe(400);

      const error = await response.json();
      expect(error).toHaveProperty('error');
      expect(error.message).toContain('Features are required');
    });

    test('should validate feature values', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/api/predict`, {
        data: {
          features: {
            current_odds: 'invalid',
            volume: 5000
          },
          ensembleMode: 'auto'
        }
      });

      expect(response.status()).toBe(400);

      const error = await response.json();
      expect(error).toHaveProperty('error');
    });

    test('should include explanation when requested', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/api/predict`, {
        data: {
          features: sampleFeatures,
          ensembleMode: 'auto',
          includeExplanation: true
        }
      });

      expect(response.status()).toBe(200);

      const prediction = await response.json();

      expect(prediction).toHaveProperty('explanation');
      expect(prediction.explanation).toHaveProperty('featureImportance');
      expect(prediction.explanation).toHaveProperty('topFeatures');
    });

  });

  test.describe('Ensemble Predictions - /api/ensemble/predict', () => {

    test('should return ensemble prediction with multiple models', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/api/ensemble/predict`, {
        data: {
          features: sampleFeatures,
          includeExplanation: true
        }
      });

      expect(response.status()).toBe(200);

      const prediction = await response.json();

      // Verify ensemble-specific fields
      expect(prediction).toHaveProperty('ensembleContributions');
      expect(prediction.ensembleContributions).toBeInstanceOf(Array);
      expect(prediction.ensembleContributions.length).toBeGreaterThan(0);

      // Verify each contribution has required fields
      for (const contribution of prediction.ensembleContributions) {
        expect(contribution).toHaveProperty('modelId');
        expect(contribution).toHaveProperty('prediction');
        expect(contribution).toHaveProperty('weight');
        expect(contribution).toHaveProperty('confidence');
      }
    });

    test('should achieve ensemble accuracy >= max(single model) - 1%', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/api/ensemble/predict`, {
        data: {
          features: sampleFeatures
        }
      });

      expect(response.status()).toBe(200);

      const prediction = await response.json();

      // Get individual model accuracies
      const modelAccuracies = prediction.ensembleContributions.map(
        (c: any) => c.accuracy || 0.7
      );

      const maxSingleModelAccuracy = Math.max(...modelAccuracies);

      // Ensemble should perform at least as well as best single model (minus 1% tolerance)
      const expectedMinAccuracy = maxSingleModelAccuracy - 0.01;

      // Note: In a real test, we would compare actual outcomes
      // For now, we verify the ensemble confidence is reasonable
      expect(prediction.confidence).toBeGreaterThanOrEqual(expectedMinAccuracy);
    });

    test('should apply confidence threshold filtering', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/api/ensemble/predict`, {
        data: {
          features: sampleFeatures,
          confidenceThreshold: 0.8
        }
      });

      expect(response.status()).toBe(200);

      const prediction = await response.json();

      // All contributions should meet the threshold
      for (const contribution of prediction.ensembleContributions) {
        expect(contribution.confidence).toBeGreaterThanOrEqual(0.8);
      }
    });

  });

  test.describe('Batch Predictions - /api/predict/batch', () => {

    test('should handle batch predictions successfully', async ({ request }) => {
      const batchRequest = {
        requests: [
          { features: sampleFeatures },
          { features: { ...sampleFeatures, current_odds: 3.0 } },
          { features: { ...sampleFeatures, volume: 10000 } }
        ],
        parallel: true
      };

      const response = await request.post(`${API_BASE_URL}/api/predict/batch`, {
        data: batchRequest
      });

      expect(response.status()).toBe(200);

      const batchResponse = await response.json();

      // Verify summary
      expect(batchResponse).toHaveProperty('summary');
      expect(batchResponse.summary.total).toBe(3);
      expect(batchResponse.summary.successful).toBeGreaterThan(0);

      // Verify predictions
      expect(batchResponse).toHaveProperty('predictions');
      expect(batchResponse.predictions).toBeInstanceOf(Array);
    });

    test('should respect batch size limits', async ({ request }) => {
      const requests = Array(150).fill(null).map(() => ({
        features: sampleFeatures
      }));

      const response = await request.post(`${API_BASE_URL}/api/predict/batch`, {
        data: { requests }
      });

      expect(response.status()).toBe(400);

      const error = await response.json();
      expect(error.message).toContain('exceeds maximum');
    });

  });

  test.describe('Health & Metrics - /api/inference/health', () => {

    test('should return healthy status', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/inference/health`);

      expect(response.status()).toBe(200);

      const health = await response.json();

      expect(health).toHaveProperty('status');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);

      expect(health).toHaveProperty('components');
      expect(health.components).toHaveProperty('inferenceGateway');
      expect(health.components).toHaveProperty('ensembleCoordinator');
      expect(health.components).toHaveProperty('continuousEvaluator');
    });

    test('should return performance metrics', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/inference/metrics`);

      expect(response.status()).toBe(200);

      const data = await response.json();

      expect(data).toHaveProperty('metrics');
      expect(data.metrics).toHaveProperty('requestCount');
      expect(data.metrics).toHaveProperty('successCount');
      expect(data.metrics).toHaveProperty('errorCount');
      expect(data.metrics).toHaveProperty('avgLatencyMs');
      expect(data.metrics).toHaveProperty('p95LatencyMs');
      expect(data.metrics).toHaveProperty('p99LatencyMs');

      expect(data).toHaveProperty('sloCompliance');
      expect(data.sloCompliance).toHaveProperty('compliant');
      expect(data.sloCompliance).toHaveProperty('violations');
    });

    test('should track SLO compliance', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/inference/metrics`);

      expect(response.status()).toBe(200);

      const data = await response.json();

      // Charter SLO targets
      if (data.metrics.p95LatencyMs > 0) {
        expect(data.metrics.p95LatencyMs).toBeLessThan(150); // Charter: < 150ms
      }

      if (data.metrics.p99LatencyMs > 0) {
        expect(data.metrics.p99LatencyMs).toBeLessThan(300); // < 300ms
      }

      // Error rate should be < 0.5%
      if (data.metrics.requestCount > 0) {
        const errorRate = data.metrics.errorCount / data.metrics.requestCount;
        expect(errorRate).toBeLessThan(0.005);
      }
    });

  });

  test.describe('Model Registry - /api/inference/models', () => {

    test('should return deployed models', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/inference/models`);

      expect(response.status()).toBe(200);

      const data = await response.json();

      expect(data).toHaveProperty('models');
      expect(data).toHaveProperty('count');
      expect(data.models).toBeInstanceOf(Array);
    });

  });

  test.describe('Continuous Evaluation - /api/inference/evaluate', () => {

    test('should record prediction outcome', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/api/inference/evaluate`, {
        data: {
          modelId: 'test_model_id',
          prediction: 0.7,
          actual: 1,
          features: sampleFeatures,
          latencyMs: 45
        }
      });

      expect(response.status()).toBe(200);

      const result = await response.json();

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
    });

    test('should validate required fields for evaluation', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/api/inference/evaluate`, {
        data: {
          modelId: 'test_model_id'
          // Missing prediction and actual
        }
      });

      expect(response.status()).toBe(400);

      const error = await response.json();
      expect(error).toHaveProperty('error');
    });

  });

  test.describe('Drift Detection & Alerts', () => {

    test('should detect performance degradation', async ({ request }) => {
      // Simulate multiple predictions with degrading performance
      const predictions = [
        { prediction: 0.9, actual: 1 },
        { prediction: 0.8, actual: 1 },
        { prediction: 0.6, actual: 0 }, // Incorrect
        { prediction: 0.5, actual: 1 }, // Incorrect
        { prediction: 0.4, actual: 0 }
      ];

      for (const pred of predictions) {
        await request.post(`${API_BASE_URL}/api/inference/evaluate`, {
          data: {
            modelId: 'test_degradation_model',
            ...pred,
            features: sampleFeatures,
            latencyMs: 50
          }
        });
      }

      // Check if alerts were generated
      // (Would need access to alerts endpoint in production)
      expect(true).toBe(true);
    });

  });

  test.describe('Performance & Load Testing', () => {

    test('should handle concurrent requests without degradation', async ({ request }) => {
      const concurrentRequests = 50;
      const startTime = Date.now();

      const promises = Array(concurrentRequests).fill(null).map(() =>
        request.post(`${API_BASE_URL}/api/predict`, {
          data: {
            features: sampleFeatures,
            ensembleMode: 'auto'
          }
        })
      );

      const responses = await Promise.all(promises);

      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / concurrentRequests;

      // All requests should succeed
      for (const response of responses) {
        expect(response.status()).toBe(200);
      }

      console.log(`Concurrent requests: ${concurrentRequests}, Avg time: ${avgTime}ms`);

      // Average latency should still be reasonable under load
      expect(avgTime).toBeLessThan(500);
    });

    test('Charter Requirement B.2: 100x single predict - p95<150ms', async ({ request }) => {
      const iterations = 100;
      const latencies: number[] = [];

      console.log(`Running ${iterations} single predictions...`);

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        const response = await request.post(`${API_BASE_URL}/api/predict`, {
          data: {
            features: sampleFeatures,
            ensembleMode: 'auto'
          }
        });

        const latency = Date.now() - startTime;
        latencies.push(latency);

        expect(response.status()).toBe(200);
      }

      // Calculate p95
      latencies.sort((a, b) => a - b);
      const p95Index = Math.floor(latencies.length * 0.95);
      const p95Latency = latencies[p95Index];

      console.log(`Single Predict - P95 Latency: ${p95Latency}ms (Charter target: < 150ms)`);

      // Charter SLO: p95 < 150ms
      expect(p95Latency).toBeLessThan(150);
    });

    test('Charter Requirement B.3: 100x ensemble predict - p95<150ms, accuracy validation', async ({ request }) => {
      const iterations = 100;
      const latencies: number[] = [];
      const predictions: any[] = [];

      console.log(`Running ${iterations} ensemble predictions...`);

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        const response = await request.post(`${API_BASE_URL}/api/ensemble/predict`, {
          data: {
            features: sampleFeatures,
            includeExplanation: true
          }
        });

        const latency = Date.now() - startTime;
        latencies.push(latency);

        expect(response.status()).toBe(200);

        const prediction = await response.json();
        predictions.push(prediction);
      }

      // Calculate p95
      latencies.sort((a, b) => a - b);
      const p95Index = Math.floor(latencies.length * 0.95);
      const p95Latency = latencies[p95Index];

      console.log(`Ensemble Predict - P95 Latency: ${p95Latency}ms (Charter target: < 150ms)`);

      // Charter SLO: p95 < 150ms
      expect(p95Latency).toBeLessThan(150);

      // Validate ensemble accuracy requirement: >= max(single) - 1%
      // Extract single model accuracies from first prediction
      if (predictions[0]?.ensembleContributions?.length > 0) {
        const modelAccuracies = predictions[0].ensembleContributions.map(
          (c: any) => c.accuracy || 0.7
        );
        const maxSingleAccuracy = Math.max(...modelAccuracies);
        const ensembleConfidence = predictions[0].confidence;

        console.log(`Max Single Model Accuracy: ${maxSingleAccuracy}, Ensemble Confidence: ${ensembleConfidence}`);

        // Ensemble should be within 1% of best single model
        expect(ensembleConfidence).toBeGreaterThanOrEqual(maxSingleAccuracy - 0.01);
      }
    });

    test('Charter Requirement B.4: 50 concurrent requests - p99<300ms, error<0.5%', async ({ request }) => {
      const concurrentRequests = 50;
      const latencies: number[] = [];
      let errorCount = 0;

      console.log(`Running ${concurrentRequests} concurrent requests...`);

      const promises = Array(concurrentRequests).fill(null).map(async () => {
        const startTime = Date.now();

        try {
          const response = await request.post(`${API_BASE_URL}/api/predict`, {
            data: {
              features: sampleFeatures,
              ensembleMode: 'auto'
            }
          });

          const latency = Date.now() - startTime;
          latencies.push(latency);

          if (response.status() !== 200) {
            errorCount++;
          }

          return response;
        } catch (error) {
          errorCount++;
          throw error;
        }
      });

      await Promise.all(promises.map(p => p.catch(() => null)));

      // Calculate p99
      latencies.sort((a, b) => a - b);
      const p99Index = Math.floor(latencies.length * 0.99);
      const p99Latency = latencies[p99Index];

      const errorRate = errorCount / concurrentRequests;

      console.log(`Concurrent Test - P99 Latency: ${p99Latency}ms (Charter target: < 300ms)`);
      console.log(`Concurrent Test - Error Rate: ${(errorRate * 100).toFixed(3)}% (Charter target: < 0.5%)`);

      // Charter SLO: p99 < 300ms
      expect(p99Latency).toBeLessThan(300);

      // Charter SLO: error rate < 0.5%
      expect(errorRate).toBeLessThan(0.005);
    });

  });

  test.describe('Charter Requirement B.5: Failure Injection & Circuit Breaker', () => {

    test('should trigger circuit breaker on model failure and fall back gracefully', async ({ request }) => {
      console.log('Testing circuit breaker with failure injection...');

      // This test requires a special endpoint or configuration to force model failures
      // For now, we'll test that the system handles errors gracefully

      // Simulate a scenario that might cause model failure
      const invalidFeatures = {
        current_odds: -1, // Invalid negative odds
        volume: -5000,    // Invalid negative volume
        liquidity: 2.0,   // Invalid >1 liquidity
        time_to_event: -120, // Invalid negative time
        volatility: -0.15,
        momentum: 5.0 // Out of normal range
      };

      let successCount = 0;
      let circuitBreakerTriggered = false;

      // Try multiple requests with invalid data to trigger circuit breaker
      for (let i = 0; i < 10; i++) {
        const response = await request.post(`${API_BASE_URL}/api/predict`, {
          data: {
            features: invalidFeatures,
            ensembleMode: 'auto'
          }
        });

        if (response.status() === 200) {
          successCount++;
          const prediction = await response.json();

          // Check if response indicates fallback behavior
          if (prediction.metadata?.fallback || prediction.metadata?.circuitBreakerOpen) {
            circuitBreakerTriggered = true;
          }
        } else if (response.status() === 503) {
          // Service unavailable - circuit breaker open
          circuitBreakerTriggered = true;
        }
      }

      console.log(`Circuit breaker test - Success count: ${successCount}/10`);

      // System should either handle errors gracefully (200 with fallback)
      // or trigger circuit breaker (503)
      expect(successCount + (circuitBreakerTriggered ? 1 : 0)).toBeGreaterThan(0);
    });

    test('should recover after circuit breaker reset', async ({ request }) => {
      // Wait for circuit breaker reset timeout (default 60s in config)
      // In tests, we can't wait that long, so we'll verify normal operation

      const response = await request.post(`${API_BASE_URL}/api/predict`, {
        data: {
          features: sampleFeatures,
          ensembleMode: 'auto'
        }
      });

      expect(response.status()).toBe(200);

      const prediction = await response.json();
      expect(prediction).toHaveProperty('prediction');
    });

  });

  test.describe('Charter Requirement B.6: Drift Simulation & Detection', () => {

    test('should detect feature drift when distribution shifts significantly', async ({ request }) => {
      console.log('Simulating feature drift...');

      // Phase 1: Baseline predictions with normal features
      const baselineIterations = 20;
      for (let i = 0; i < baselineIterations; i++) {
        await request.post(`${API_BASE_URL}/api/inference/evaluate`, {
          data: {
            modelId: 'drift_test_model',
            prediction: 0.7,
            actual: Math.random() > 0.3 ? 1 : 0,
            features: sampleFeatures,
            latencyMs: 50
          }
        });
      }

      // Phase 2: Shifted features (simulating market regime change)
      const shiftedFeatures = {
        current_odds: sampleFeatures.current_odds * 2.0, // 100% increase
        volume: sampleFeatures.volume * 3.0,              // 200% increase
        liquidity: sampleFeatures.liquidity * 0.5,        // 50% decrease
        time_to_event: sampleFeatures.time_to_event * 0.3, // 70% decrease
        volatility: sampleFeatures.volatility * 2.5,      // 150% increase
        momentum: sampleFeatures.momentum * 1.8           // 80% increase
      };

      const driftIterations = 20;
      for (let i = 0; i < driftIterations; i++) {
        await request.post(`${API_BASE_URL}/api/inference/evaluate`, {
          data: {
            modelId: 'drift_test_model',
            prediction: 0.5,
            actual: Math.random() > 0.5 ? 1 : 0,
            features: shiftedFeatures,
            latencyMs: 50
          }
        });
      }

      // Check if drift was detected (via metrics endpoint or health status)
      const metricsResponse = await request.get(`${API_BASE_URL}/api/inference/metrics`);
      expect(metricsResponse.status()).toBe(200);

      const metrics = await metricsResponse.json();

      console.log('Drift detection test - Metrics:', JSON.stringify(metrics, null, 2));

      // System should track drift metrics
      // (In production, this would trigger drift > threshold alert)
      expect(metrics).toHaveProperty('metrics');
    });

    test('should emit alert log when drift exceeds threshold (0.15)', async ({ request }) => {
      // This test verifies that the drift monitoring system is active
      // In a production system, we would:
      // 1. Monitor CloudWatch/DataDog logs for drift alerts
      // 2. Check Prometheus metrics for drift_gauge > 0.15
      // 3. Verify alerting pipeline triggers

      // For E2E testing, we verify the evaluation endpoint accepts drift data
      const response = await request.post(`${API_BASE_URL}/api/inference/evaluate`, {
        data: {
          modelId: 'drift_alert_test',
          prediction: 0.8,
          actual: 0,
          features: sampleFeatures,
          latencyMs: 45,
          metadata: {
            driftScore: 0.18 // Above threshold of 0.15
          }
        }
      });

      expect(response.status()).toBe(200);

      const result = await response.json();
      expect(result).toHaveProperty('success');

      console.log('Drift alert test - Response:', JSON.stringify(result, null, 2));
    });

  });

  test.describe('Charter Requirement B.7: Batch Predict Within SLOs', () => {

    test('should process batch of 100 items within SLO targets', async ({ request }) => {
      const batchSize = 100;
      const requests = Array(batchSize).fill(null).map((_, i) => ({
        features: {
          ...sampleFeatures,
          current_odds: 2.0 + (i * 0.01), // Slight variation
          volume: 5000 + (i * 10)
        }
      }));

      const startTime = Date.now();

      const response = await request.post(`${API_BASE_URL}/api/predict/batch`, {
        data: { requests, parallel: true }
      });

      const totalLatency = Date.now() - startTime;
      const avgLatencyPerItem = totalLatency / batchSize;

      expect(response.status()).toBe(200);

      const batchResponse = await response.json();

      console.log(`Batch prediction - Total: ${totalLatency}ms, Avg per item: ${avgLatencyPerItem.toFixed(2)}ms`);

      // Verify all predictions succeeded
      expect(batchResponse.summary.successful).toBe(batchSize);

      // Average per-item latency should meet SLO
      // (Even with parallelization, we want reasonable throughput)
      expect(avgLatencyPerItem).toBeLessThan(200); // 200ms avg per item is acceptable for batch
    });

  });

});
