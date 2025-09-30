/**
 * API Routes Integration Tests
 * Tests all new API endpoints with validation, caching, and feature flags
 */

import { describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../api-server';
import { createSupabaseClient } from '../../services/supabaseClient';
import { ProductionRedisService } from '../../services/productionRedis';

describe('API Routes Integration Tests', () => {
  let app: FastifyInstance;
  let supabaseClient: ReturnType<typeof createSupabaseClient>;
  let redisService: ProductionRedisService;

  beforeEach(async () => {
    app = await buildApp({
      logger: { level: 'silent' },
      trustProxy: true
    });

    supabaseClient = createSupabaseClient();
    redisService = new ProductionRedisService();

    // Clear test data
    await supabaseClient.from('unified_picks').delete().neq('id', '');
    await supabaseClient.from('ops.credit_usage').delete().neq('id', '');
    await supabaseClient.from('ops.alert_events').delete().neq('id', '');
    await redisService.clear();

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    await redisService.disconnect();
  });

  describe('Ingestion Watchlist API', () => {
    it('should configure live ingestion settings', async () => {
      const configData = {
        sports: ['NFL', 'NBA'],
        books: ['draftkings', 'fanduel'],
        rateLimit: 500,
        batchSize: 50,
        enabled: true
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/ingestion/watchlist',
        headers: {
          authorization: 'Bearer test-admin-token',
          'content-type': 'application/json'
        },
        payload: configData
      });

      expect(response.statusCode).toBe(201);

      const result = JSON.parse(response.payload);
      expect(result.data).toMatchObject({
        sports: ['NFL', 'NBA'],
        books: ['draftkings', 'fanduel'],
        rateLimit: 500
      });
    });

    it('should validate configuration parameters', async () => {
      const invalidConfig = {
        sports: ['INVALID_SPORT'],
        rateLimit: -1,
        batchSize: 1001 // Exceeds max
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/ingestion/watchlist',
        headers: {
          authorization: 'Bearer test-admin-token',
          'content-type': 'application/json'
        },
        payload: invalidConfig
      });

      expect(response.statusCode).toBe(400);

      const error = JSON.parse(response.payload);
      expect(error.errors).toContainEqual(
        expect.objectContaining({
          path: ['sports', 0],
          message: expect.stringContaining('Invalid sport')
        })
      );
    });

    it('should get current watchlist configuration', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/ingestion/watchlist',
        headers: {
          authorization: 'Bearer test-operator-token'
        }
      });

      expect(response.statusCode).toBe(200);

      const result = JSON.parse(response.payload);
      expect(result.data).toHaveProperty('sports');
      expect(result.data).toHaveProperty('enabled');
      expect(result.data).toHaveProperty('lastUpdated');
    });
  });

  describe('Settlement API', () => {
    it('should trigger per-game settlement', async () => {
      // Create test pick for settlement
      const testPick = {
        id: 'settlement-test-1',
        capper_id: 'test-capper',
        player_name: 'Settlement Test',
        stat_type: 'points',
        line: 25.5,
        odds: -110,
        sport: 'NBA',
        game_id: 'nba-game-123',
        workflow_stage: 'promoted'
      };

      await supabaseClient.from('unified_picks').insert(testPick);

      const settlementRequest = {
        gameId: 'nba-game-123',
        sport: 'NBA',
        results: [
          {
            playerId: 'settlement-test-player',
            statType: 'points',
            actualValue: 28.5
          }
        ],
        dryRun: false
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/settlement/run',
        headers: {
          authorization: 'Bearer test-admin-token',
          'content-type': 'application/json'
        },
        payload: settlementRequest
      });

      expect(response.statusCode).toBe(200);

      const result = JSON.parse(response.payload);
      expect(result.data).toMatchObject({
        gameId: 'nba-game-123',
        picksSettled: expect.any(Number),
        status: 'completed'
      });
    });

    it('should support dry run mode', async () => {
      const settlementRequest = {
        gameId: 'dry-run-game',
        sport: 'NFL',
        results: [],
        dryRun: true
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/settlement/run',
        headers: {
          authorization: 'Bearer test-operator-token',
          'content-type': 'application/json'
        },
        payload: settlementRequest
      });

      expect(response.statusCode).toBe(200);

      const result = JSON.parse(response.payload);
      expect(result.data.dryRun).toBe(true);
      expect(result.data.simulatedChanges).toBeDefined();
    });
  });

  describe('Credit Usage API', () => {
    it('should track and report API credit usage', async () => {
      // Create test credit usage records
      const testUsage = [
        {
          provider: 'optimal',
          operation: 'fetch_game_data',
          credits_used: 5,
          user_id: 'test-user',
          created_at: new Date().toISOString()
        },
        {
          provider: 'oddsapi',
          operation: 'get_odds',
          credits_used: 3,
          user_id: 'test-user',
          created_at: new Date().toISOString()
        }
      ];

      await supabaseClient.from('ops.credit_usage').insert(testUsage);

      const response = await app.inject({
        method: 'GET',
        url: '/api/ops/credit-usage?provider=optimal&granularity=day',
        headers: {
          authorization: 'Bearer test-admin-token'
        }
      });

      expect(response.statusCode).toBe(200);

      const result = JSON.parse(response.payload);
      expect(result.data.usage).toBeDefined();
      expect(result.data.totalCredits).toBeGreaterThan(0);
      expect(result.data.breakdown.optimal).toBeDefined();
    });

    it('should set and monitor credit budgets', async () => {
      const budgetRequest = {
        provider: 'optimal',
        dailyLimit: 10000,
        monthlyLimit: 250000,
        alertThreshold: 0.8
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/ops/credit-usage/budget',
        headers: {
          authorization: 'Bearer test-admin-token',
          'content-type': 'application/json'
        },
        payload: budgetRequest
      });

      expect(response.statusCode).toBe(201);

      const result = JSON.parse(response.payload);
      expect(result.data).toMatchObject({
        provider: 'optimal',
        dailyLimit: 10000,
        alertThreshold: 0.8
      });
    });
  });

  describe('Alerts Replay API', () => {
    it('should replay alert processing for debugging', async () => {
      // Create test alert events
      const testAlert = {
        id: 'replay-test-alert',
        alert_type: 'steam_alert',
        player_name: 'Replay Test Player',
        market: 'points',
        created_at: new Date().toISOString(),
        metadata: { steamScore: 85 }
      };

      await supabaseClient.from('ops.alert_events').insert(testAlert);

      const replayRequest = {
        type: 'steam_alert',
        timeRange: {
          start: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          end: new Date().toISOString()
        },
        dryRun: true,
        filters: {
          playerName: 'Replay Test Player'
        }
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/alerts/replay',
        headers: {
          authorization: 'Bearer test-admin-token',
          'content-type': 'application/json'
        },
        payload: replayRequest
      });

      expect(response.statusCode).toBe(200);

      const result = JSON.parse(response.payload);
      expect(result.data).toMatchObject({
        alertsFound: expect.any(Number),
        replayed: expect.any(Number),
        dryRun: true
      });
    });
  });

  describe('Cache Metrics API', () => {
    it('should return cache performance metrics', async () => {
      // Warm cache with some test data
      await redisService.set('metrics-test-1', 'value1');
      await redisService.set('metrics-test-2', 'value2');
      await redisService.get('metrics-test-1'); // Hit
      await redisService.get('nonexistent'); // Miss

      const response = await app.inject({
        method: 'GET',
        url: '/api/cache/metrics',
        headers: {
          authorization: 'Bearer test-operator-token'
        }
      });

      expect(response.statusCode).toBe(200);

      const result = JSON.parse(response.payload);
      expect(result.data).toMatchObject({
        hitRate: expect.any(Number),
        totalRequests: expect.any(Number),
        avgLatency: expect.any(Number),
        connectionHealth: expect.any(Boolean)
      });

      expect(result.data.hitRate).toBeGreaterThan(0);
      expect(result.data.hitRate).toBeLessThanOrEqual(1);
    });

    it('should invalidate cache entries', async () => {
      await redisService.set('invalidation-test', 'original-value');

      const invalidationRequest = {
        keys: ['invalidation-test'],
        pattern: 'unified_pick:*',
        reason: 'Test invalidation'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/cache/invalidate',
        headers: {
          authorization: 'Bearer test-admin-token',
          'content-type': 'application/json'
        },
        payload: invalidationRequest
      });

      expect(response.statusCode).toBe(200);

      const result = JSON.parse(response.payload);
      expect(result.data.keysInvalidated).toBeGreaterThan(0);

      // Verify key was actually invalidated
      const value = await redisService.get('invalidation-test');
      expect(value).toBeNull();
    });
  });

  describe('Unified Picks API', () => {
    it('should create unified pick with validation', async () => {
      const pickData = {
        capperId: 'test-capper-1',
        playerName: 'Test Player',
        statType: 'points',
        line: 25.5,
        odds: -110,
        sport: 'NBA',
        confidence: 8,
        analysis: 'Strong play based on recent performance'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/unified-picks',
        headers: {
          authorization: 'Bearer test-admin-token',
          'content-type': 'application/json'
        },
        payload: pickData
      });

      expect(response.statusCode).toBe(201);

      const result = JSON.parse(response.payload);
      expect(result.data).toMatchObject({
        capper_id: 'test-capper-1',
        player_name: 'Test Player',
        workflow_stage: 'ingested'
      });
      expect(result.data.id).toBeDefined();
    });

    it('should list picks with filtering and caching', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/unified-picks?sport=NBA&tier=A&limit=10',
        headers: {
          authorization: 'Bearer test-operator-token'
        }
      });

      expect(response.statusCode).toBe(200);

      const result = JSON.parse(response.payload);
      expect(result.data.picks).toBeDefined();
      expect(result.data.pagination).toMatchObject({
        limit: 10,
        offset: 0,
        total: expect.any(Number)
      });
      expect(result.meta.cached).toBeDefined();
    });

    it('should enforce RBAC permissions', async () => {
      const pickData = {
        capperId: 'unauthorized-capper',
        playerName: 'Unauthorized Test',
        statType: 'points',
        line: 25.5,
        odds: -110,
        sport: 'NBA'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/unified-picks',
        headers: {
          authorization: 'Bearer test-staff-token', // Staff role, limited access
          'content-type': 'application/json'
        },
        payload: pickData
      });

      expect(response.statusCode).toBe(403);

      const error = JSON.parse(response.payload);
      expect(error.message).toContain('Insufficient permissions');
    });
  });

  describe('Feature Flags API', () => {
    it('should manage feature flag configuration', async () => {
      const flagData = {
        name: 'test_feature_flag',
        enabled: true,
        rolloutPercentage: 25,
        description: 'Test feature for API validation',
        targetSegments: ['vip_users'],
        metadata: { testMode: true }
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/feature-flags',
        headers: {
          authorization: 'Bearer test-admin-token',
          'content-type': 'application/json'
        },
        payload: flagData
      });

      expect(response.statusCode).toBe(201);

      const result = JSON.parse(response.payload);
      expect(result.data).toMatchObject({
        name: 'test_feature_flag',
        enabled: true,
        rolloutPercentage: 25
      });
    });

    it('should evaluate flags for user context', async () => {
      const evaluationRequest = {
        flagName: 'unified_picks_cache_first',
        userContext: {
          userId: 'test-user-123',
          tier: 'vip',
          sport: 'NBA'
        }
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/feature-flags/evaluate',
        headers: {
          authorization: 'Bearer test-operator-token',
          'content-type': 'application/json'
        },
        payload: evaluationRequest
      });

      expect(response.statusCode).toBe(200);

      const result = JSON.parse(response.payload);
      expect(result.data).toMatchObject({
        enabled: expect.any(Boolean),
        variant: expect.any(String),
        reason: expect.any(String)
      });
    });
  });

  describe('Shadow Mode API', () => {
    it('should configure shadow mode settings', async () => {
      const shadowConfig = {
        enabled: true,
        percentage: 100,
        suppressDiscord: true,
        trackMetrics: true,
        comparisonMode: true
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/shadow-mode/config',
        headers: {
          authorization: 'Bearer test-admin-token',
          'content-type': 'application/json'
        },
        payload: shadowConfig
      });

      expect(response.statusCode).toBe(200);

      const result = JSON.parse(response.payload);
      expect(result.data).toMatchObject({
        enabled: true,
        suppressDiscord: true,
        trackMetrics: true
      });
    });

    it('should provide shadow mode metrics comparison', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/shadow-mode/metrics?timeframe=1h',
        headers: {
          authorization: 'Bearer test-admin-token'
        }
      });

      expect(response.statusCode).toBe(200);

      const result = JSON.parse(response.payload);
      expect(result.data).toMatchObject({
        shadowMetrics: expect.any(Object),
        productionMetrics: expect.any(Object),
        comparison: expect.any(Object)
      });
    });
  });

  describe('Rate Limiting & Security', () => {
    it('should enforce rate limits', async () => {
      // Make rapid requests to trigger rate limit
      const requests = Array.from({ length: 110 }, () =>
        app.inject({
          method: 'GET',
          url: '/api/unified-picks',
          headers: {
            authorization: 'Bearer test-operator-token'
          }
        })
      );

      const responses = await Promise.all(requests);

      // Should have some rate limited responses
      const rateLimited = responses.filter(r => r.statusCode === 429);
      expect(rateLimited.length).toBeGreaterThan(0);

      const rateLimitError = JSON.parse(rateLimited[0].payload);
      expect(rateLimitError.message).toContain('Rate limit exceeded');
    });

    it('should validate authentication tokens', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/unified-picks',
        headers: {
          authorization: 'Bearer invalid-token'
        }
      });

      expect(response.statusCode).toBe(401);

      const error = JSON.parse(response.payload);
      expect(error.message).toContain('Invalid or expired token');
    });
  });

  describe('Health Check Integration', () => {
    it('should include cache health in API health check', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health'
      });

      expect(response.statusCode).toBe(200);

      const result = JSON.parse(response.payload);
      expect(result.services).toMatchObject({
        database: expect.stringMatching(/^(healthy|degraded)$/),
        redis: expect.stringMatching(/^(healthy|degraded|unavailable)$/),
        cache: expect.any(Object)
      });

      expect(result.services.cache).toMatchObject({
        status: expect.stringMatching(/^(healthy|degraded)$/),
        hitRate: expect.any(Number),
        connectionHealth: expect.any(Boolean)
      });
    });
  });
});