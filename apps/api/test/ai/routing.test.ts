/**
 * Tests for AI Model Routing System
 * Validates model selection, fallback behavior, and cost optimization
 */

import { aiModelRouter } from '../../src/ai/routing';

describe('AI Model Routing Tests', () => {
  beforeEach(() => {
    // Reset environment variables for testing
    process.env.ADVICE_MODEL_DEFAULT = 'kimi-k2';
    process.env.ADVICE_MODEL_FALLBACK = 'claude-sonnet';
    process.env.ADVICE_MODEL_MVP = 'gpt-4-turbo';
  });

  describe('Model Selection Logic', () => {
    test('should route advice requests to default model', () => {
      const request = {
        type: 'advice' as const,
        prompt: 'Test advice request',
        metadata: { propId: 'test-prop-1', odds: -110 }
      };

      const model = aiModelRouter.routeRequest(request);
      expect(model).toBe('kimi-k2'); // Default model
    });

    test('should route MVP requests to premium model', () => {
      const request = {
        type: 'advice' as const,
        prompt: 'Test MVP request',
        metadata: { 
          propId: 'test-prop-mvp',
          odds: -110,
          isMVP: true 
        }
      };

      const model = aiModelRouter.routeRequest(request);
      expect(model).toBe('gpt-4-turbo'); // MVP model
    });

    test('should route recap requests to kimi-k2', () => {
      const request = {
        type: 'recap' as const,
        prompt: 'Generate daily recap',
      };

      const model = aiModelRouter.routeRequest(request);
      expect(model).toBe('kimi-k2');
    });

    test('should route formatting requests to gpt-3.5', () => {
      const request = {
        type: 'formatting' as const,
        prompt: 'Format this content',
      };

      const model = aiModelRouter.routeRequest(request);
      expect(model).toBe('gpt-3.5');
    });
  });

  describe('Fallback Logic', () => {
    test('should provide correct fallback models', () => {
      expect(aiModelRouter.getFallbackModel('advice')).toBe('claude-sonnet');
      expect(aiModelRouter.getFallbackModel('recap')).toBe('gpt-3.5');
      expect(aiModelRouter.getFallbackModel('formatting')).toBe('kimi-k2');
    });

    test('should use safe fallback for unknown request types', () => {
      expect(aiModelRouter.getFallbackModel('unknown')).toBe('gpt-3.5');
    });
  });

  describe('Request Execution with Fallback', () => {
    test('should execute successful request', async () => {
      const request = {
        type: 'advice' as const,
        prompt: 'Test successful request',
        metadata: { propId: 'test-success', odds: -110 }
      };

      const response = await aiModelRouter.executeRequest(request);

      expect(response).toMatchObject({
        content: expect.any(String),
        model: 'kimi-k2',
        provider: 'moonshot',
        tokenCount: expect.any(Number),
        cost: expect.any(Number),
        cached: false,
        processingTime: expect.any(Number),
        quality: 'good'
      });

      expect(response.content).toContain('ANALYSIS');
      expect(response.tokenCount).toBeGreaterThan(0);
      expect(response.cost).toBeGreaterThan(0);
      expect(response.processingTime).toBeGreaterThan(0);
    });

    test('should fall back to secondary model on primary failure', async () => {
      // Mock primary model failure
      const originalCallModel = aiModelRouter['callModel'];
      let callCount = 0;
      
      aiModelRouter['callModel'] = jest.fn().mockImplementation(async (modelName) => {
        callCount++;
        if (callCount === 1) {
          // First call (primary model) fails
          throw new Error('Primary model unavailable');
        }
        // Second call (fallback) succeeds
        return originalCallModel.call(aiModelRouter, modelName, {
          type: 'advice',
          prompt: 'test'
        });
      });

      const request = {
        type: 'advice' as const,
        prompt: 'Test fallback request',
        metadata: { propId: 'test-fallback', odds: -110 }
      };

      const response = await aiModelRouter.executeRequest(request);

      expect(response.model).toBe('claude-sonnet'); // Fallback model
      expect(callCount).toBe(2); // Primary + fallback
    });

    test('should throw error when both primary and fallback fail', async () => {
      // Mock both models failing
      aiModelRouter['callModel'] = jest.fn().mockRejectedValue(new Error('All models down'));

      const request = {
        type: 'advice' as const,
        prompt: 'Test double failure',
        metadata: { propId: 'test-fail', odds: -110 }
      };

      await expect(aiModelRouter.executeRequest(request)).rejects.toThrow(
        'Both primary (kimi-k2) and fallback (claude-sonnet) models failed'
      );
    });
  });

  describe('Odds Movement Calculation', () => {
    test('should calculate basis points difference correctly', () => {
      // Standard movements
      expect(aiModelRouter.calculateOddsBpsDifference(-110, -120)).toBeCloseTo(909.09, 1); // ~909 bps
      expect(aiModelRouter.calculateOddsBpsDifference(-120, -110)).toBeCloseTo(833.33, 1); // ~833 bps
      expect(aiModelRouter.calculateOddsBpsDifference(-110, -105)).toBeCloseTo(454.55, 1); // ~455 bps
      
      // No movement
      expect(aiModelRouter.calculateOddsBpsDifference(-110, -110)).toBe(0);
      
      // Large movements
      expect(aiModelRouter.calculateOddsBpsDifference(-110, -150)).toBeCloseTo(3636.36, 1); // Large move
    });

    test('should handle edge cases in odds calculation', () => {
      // Zero odds (edge case)
      expect(aiModelRouter.calculateOddsBpsDifference(-110, 0)).toBe(Infinity);
      
      // Plus to minus odds
      expect(aiModelRouter.calculateOddsBpsDifference(+150, -150)).toBeCloseTo(20000, 0); // 200% move
    });
  });

  describe('Requery Logic', () => {
    test('should trigger requery for significant odds movement', () => {
      const currentOdds = -120;
      const lastOdds = -110;
      const contextHash = 'abc123';
      const lastContextHash = 'abc123';

      const shouldRequery = aiModelRouter.shouldRequery(currentOdds, lastOdds, contextHash, lastContextHash);
      expect(shouldRequery).toBe(true); // Movement > 15 bps threshold
    });

    test('should trigger requery for context change', () => {
      const currentOdds = -110;
      const lastOdds = -110;
      const contextHash = 'abc123';
      const lastContextHash = 'def456';

      const shouldRequery = aiModelRouter.shouldRequery(currentOdds, lastOdds, contextHash, lastContextHash);
      expect(shouldRequery).toBe(true); // Context changed
    });

    test('should not trigger requery for small odds movement', () => {
      const currentOdds = -111;
      const lastOdds = -110;
      const contextHash = 'abc123';
      const lastContextHash = 'abc123';

      const shouldRequery = aiModelRouter.shouldRequery(currentOdds, lastOdds, contextHash, lastContextHash);
      expect(shouldRequery).toBe(false); // Movement < 15 bps threshold
    });
  });

  describe('Context Hash Generation', () => {
    test('should generate consistent hash for same context', () => {
      const context1 = { player: 'LeBron James', odds: -110, tier: 'S' };
      const context2 = { player: 'LeBron James', odds: -110, tier: 'S' };

      const hash1 = aiModelRouter.generateContextHash(context1);
      const hash2 = aiModelRouter.generateContextHash(context2);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(16); // Truncated to 16 chars
    });

    test('should generate different hash for different context', () => {
      const context1 = { player: 'LeBron James', odds: -110, tier: 'S' };
      const context2 = { player: 'Stephen Curry', odds: -110, tier: 'S' };

      const hash1 = aiModelRouter.generateContextHash(context1);
      const hash2 = aiModelRouter.generateContextHash(context2);

      expect(hash1).not.toBe(hash2);
    });

    test('should handle key order independence', () => {
      const context1 = { player: 'LeBron James', odds: -110, tier: 'S' };
      const context2 = { tier: 'S', odds: -110, player: 'LeBron James' };

      const hash1 = aiModelRouter.generateContextHash(context1);
      const hash2 = aiModelRouter.generateContextHash(context2);

      expect(hash1).toBe(hash2); // Same hash regardless of key order
    });
  });

  describe('Metrics Tracking', () => {
    test('should track model call metrics', async () => {
      const request = {
        type: 'advice' as const,
        prompt: 'Test metrics tracking',
        metadata: { propId: 'test-metrics', odds: -110 }
      };

      await aiModelRouter.executeRequest(request);

      const metrics = aiModelRouter.getMetrics();
      expect(metrics).toHaveLength(4); // All 4 configured models

      const kimiMetrics = metrics.find(m => m.model === 'kimi-k2');
      expect(kimiMetrics).toMatchObject({
        model: 'kimi-k2',
        provider: 'moonshot',
        callCount: 1,
        totalTokens: expect.any(Number),
        totalCost: expect.any(Number),
        averageLatency: expect.any(Number),
        successRate: 1.0,
        lastUsed: expect.any(Date)
      });
    });

    test('should provide cost analysis', async () => {
      // Make multiple requests to generate metrics
      for (let i = 0; i < 3; i++) {
        await aiModelRouter.executeRequest({
          type: 'advice' as const,
          prompt: `Test request ${i}`,
          metadata: { propId: `test-cost-${i}`, odds: -110 }
        });
      }

      const costAnalysis = aiModelRouter.getCostAnalysis();
      
      expect(costAnalysis).toMatchObject({
        totalCalls: expect.any(Number),
        totalCost: expect.any(Number),
        totalTokens: expect.any(Number),
        averageCostPerCall: expect.any(Number),
        modelBreakdown: expect.any(Object)
      });

      expect(costAnalysis.totalCalls).toBeGreaterThan(0);
      expect(costAnalysis.totalCost).toBeGreaterThan(0);
      expect(costAnalysis.averageCostPerCall).toBeGreaterThan(0);
      expect(costAnalysis.modelBreakdown['kimi-k2']).toBeDefined();
    });
  });

  describe('Environment Configuration', () => {
    test('should use custom environment variables', () => {
      process.env.ADVICE_MODEL_DEFAULT = 'claude-sonnet';
      process.env.ADVICE_MODEL_MVP = 'kimi-k2';

      // Create new router instance to pick up env changes
      const customRouter = new (aiModelRouter.constructor as any)();

      const normalRequest = {
        type: 'advice' as const,
        prompt: 'Normal request',
        metadata: { propId: 'test-custom', odds: -110 }
      };

      const mvpRequest = {
        type: 'advice' as const,
        prompt: 'MVP request', 
        metadata: { propId: 'test-mvp', odds: -110, isMVP: true }
      };

      expect(customRouter.routeRequest(normalRequest)).toBe('claude-sonnet');
      expect(customRouter.routeRequest(mvpRequest)).toBe('kimi-k2');
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});