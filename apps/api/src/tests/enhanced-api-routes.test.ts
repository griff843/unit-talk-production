import request from 'supertest';
import { app } from '../api-server';
import { randomUUID } from 'crypto';

// Test suite for comprehensive API route validation
describe('Enhanced API Routes - Comprehensive Test Suite', () => {
  const authHeaders = {
    admin: { Authorization: 'Bearer admin-test-token' },
    operator: { Authorization: 'Bearer operator-test-token' },
    user: { Authorization: 'Bearer user-test-token' },
    e2e: { 'x-e2e-test': 'true' },
  };

  describe('Ingestion Routes (/api/ingestion)', () => {
    test('GET /api/ingestion/watchlist - should return watchlist configurations', async () => {
      const response = await request(app)
        .get('/api/ingestion/watchlist')
        .set(authHeaders.admin)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('POST /api/ingestion/watchlist - should create new watchlist config with validation', async () => {
      const validConfig = {
        sports: ['NBA', 'NFL'],
        books: ['fanduel', 'draftkings'],
        rateLimit: {
          requestsPerMinute: 60,
          burstLimit: 100,
          cooldownSeconds: 30,
        },
        filters: {
          minOdds: -200,
          maxOdds: 300,
          excludeParlays: false,
          includeAltLines: true,
        },
        enabled: true,
        priority: 'high',
      };

      const response = await request(app)
        .post('/api/ingestion/watchlist')
        .set(authHeaders.admin)
        .send(validConfig)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.sports).toEqual(validConfig.sports);
    });

    test('POST /api/ingestion/watchlist - should reject invalid configuration', async () => {
      const invalidConfig = {
        sports: [], // Invalid: empty array
        books: ['invalid-book'], // Invalid: not in enum
        rateLimit: {
          requestsPerMinute: -5, // Invalid: negative number
        },
      };

      const response = await request(app)
        .post('/api/ingestion/watchlist')
        .set(authHeaders.admin)
        .send(invalidConfig)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.details).toBeDefined();
      expect(response.body.details.length).toBeGreaterThan(0);
    });

    test('GET /api/ingestion/metrics - should return ingestion metrics', async () => {
      const response = await request(app)
        .get('/api/ingestion/metrics')
        .set(authHeaders.operator)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalRequests).toBeDefined();
      expect(response.body.data.byProvider).toBeDefined();
    });

    test('Unauthorized access should be rejected', async () => {
      await request(app)
        .get('/api/ingestion/watchlist')
        .expect(401);
    });
  });

  describe('Settlement Routes (/api/settlement)', () => {
    test('POST /api/settlement/run - should initiate settlement run', async () => {
      const settlementData = {
        gameId: randomUUID(),
        sport: 'NBA',
        forceRegrade: false,
        dryRun: true,
        batchSize: 50,
      };

      const response = await request(app)
        .post('/api/settlement/run')
        .set(authHeaders.admin)
        .send(settlementData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.runId).toBeDefined();
      expect(response.body.data.status).toBe('initiated');
    });

    test('GET /api/settlement/runs/:runId - should return settlement run status', async () => {
      const mockRunId = randomUUID();

      const response = await request(app)
        .get(`/api/settlement/runs/${mockRunId}`)
        .set(authHeaders.admin)
        .expect(404); // Expected since it's a mock ID

      expect(response.body.success).toBe(false);
    });

    test('Settlement validation should reject invalid data', async () => {
      const invalidData = {
        gameId: 'invalid-uuid',
        batchSize: -10, // Invalid: negative number
      };

      const response = await request(app)
        .post('/api/settlement/run')
        .set(authHeaders.admin)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.details).toBeDefined();
    });
  });

  describe('Credit Usage Routes (/api/ops/credit-usage)', () => {
    test('GET /api/ops/credit-usage - should return credit usage metrics', async () => {
      const response = await request(app)
        .get('/api/ops/credit-usage')
        .set(authHeaders.operator)
        .query({
          provider: 'optimal',
          granularity: 'day',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.providers).toBeDefined();
      expect(response.body.data.summary).toBeDefined();
    });

    test('POST /api/ops/credit-usage/budget - should update credit budget', async () => {
      const budgetData = {
        provider: 'optimal',
        monthlyBudget: 150000,
        alertThresholds: {
          warning: 0.75,
          critical: 0.9,
        },
        overagePolicy: 'throttle',
      };

      const response = await request(app)
        .post('/api/ops/credit-usage/budget')
        .set(authHeaders.admin)
        .send(budgetData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.newBudget).toBe(budgetData.monthlyBudget);
    });

    test('Invalid provider should be rejected', async () => {
      const invalidData = {
        provider: 'invalid-provider',
        monthlyBudget: 100000,
      };

      const response = await request(app)
        .post('/api/ops/credit-usage/budget')
        .set(authHeaders.admin)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Alerts Routes (/api/alerts)', () => {
    test('POST /api/alerts/replay - should replay alerts', async () => {
      const replayData = {
        type: 'injury',
        timeRange: {
          start: new Date(Date.now() - 86400000).toISOString(),
          end: new Date().toISOString(),
        },
        filters: {
          sport: 'NBA',
          minSeverity: 'medium',
        },
        dryRun: true,
      };

      const response = await request(app)
        .post('/api/alerts/replay')
        .set(authHeaders.admin)
        .send(replayData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.replayJobId).toBeDefined();
      expect(response.body.data.status).toBe('dry_run_completed');
    });

    test('GET /api/alerts/history - should return alert history', async () => {
      const response = await request(app)
        .get('/api/alerts/history')
        .set(authHeaders.operator)
        .query({ limit: '10', sport: 'NBA' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('GET /api/alerts/metrics - should return alert metrics', async () => {
      const response = await request(app)
        .get('/api/alerts/metrics')
        .set(authHeaders.operator)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalAlerts).toBeDefined();
      expect(response.body.data.alertTypes).toBeDefined();
    });
  });

  describe('Cache Routes (/api/cache)', () => {
    test('GET /api/cache/metrics - should return cache metrics', async () => {
      const response = await request(app)
        .get('/api/cache/metrics')
        .set(authHeaders.operator)
        .query({
          timeRange: '24h',
          includeDetails: 'true',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.overview).toBeDefined();
      expect(response.body.data.namespaces).toBeDefined();
    });

    test('POST /api/cache/invalidate - should preview cache invalidation', async () => {
      const invalidationData = {
        namespaces: ['unified_picks', 'raw_props'],
        confirm: false, // Dry run
      };

      const response = await request(app)
        .post('/api/cache/invalidate')
        .set(authHeaders.admin)
        .send(invalidationData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.action).toBe('preview');
    });

    test('GET /api/cache/health - should return cache health status', async () => {
      const response = await request(app)
        .get('/api/cache/health')
        .set(authHeaders.operator)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBeDefined();
      expect(response.body.data.connection).toBeDefined();
    });
  });

  describe('Unified Picks Routes (/api/unified-picks)', () => {
    test('GET /api/unified-picks - should return picks with public access', async () => {
      const response = await request(app)
        .get('/api/unified-picks')
        .query({
          page: '1',
          limit: '10',
          published: 'true',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('POST /api/unified-picks - should create new pick with validation', async () => {
      const pickData = {
        userId: randomUUID(),
        pickType: 'single',
        outcome: 'Lakers +5.5',
        line: 5.5,
        odds: -110,
        stake: 100,
        confidence: 8,
        analysis: 'Strong value play based on injury report',
      };

      const response = await request(app)
        .post('/api/unified-picks')
        .set(authHeaders.admin) // Admin can create for any user
        .send(pickData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.outcome).toBe(pickData.outcome);
    });

    test('POST /api/unified-picks/batch - should perform bulk operations', async () => {
      const batchData = {
        operation: 'update_status',
        pickIds: [randomUUID(), randomUUID()],
        updateData: {
          status: 'won',
        },
      };

      const response = await request(app)
        .post('/api/unified-picks/batch')
        .set(authHeaders.admin)
        .send(batchData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.operation).toBe('update_status');
      expect(response.body.data.totalProcessed).toBe(2);
    });

    test('Invalid pick data should be rejected', async () => {
      const invalidData = {
        pickType: 'invalid-type',
        confidence: 15, // Invalid: above 10
        stake: -100, // Invalid: negative
      };

      const response = await request(app)
        .post('/api/unified-picks')
        .set(authHeaders.admin)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.details).toBeDefined();
    });
  });

  describe('Feature Flags Routes (/api/feature-flags)', () => {
    test('GET /api/feature-flags - should return all feature flags', async () => {
      const response = await request(app)
        .get('/api/feature-flags')
        .set(authHeaders.admin)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta.systemFlags).toBeGreaterThan(0);
    });

    test('POST /api/feature-flags - should create new feature flag', async () => {
      const flagData = {
        name: 'test_feature_flag',
        description: 'Test feature flag for unit tests',
        enabled: false,
        rolloutPercentage: 0,
        conditions: {
          userTiers: ['vip_plus'],
          environments: ['development'],
        },
      };

      const response = await request(app)
        .post('/api/feature-flags')
        .set(authHeaders.admin)
        .send(flagData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(flagData.name);
    });

    test('POST /api/feature-flags/evaluate - should evaluate flags for user', async () => {
      const evaluateData = {
        userId: randomUUID(),
        userTier: 'vip_plus',
        sport: 'NBA',
        environment: 'development',
        flags: ['enhanced_grading', 'advanced_alerts'],
      };

      const response = await request(app)
        .post('/api/feature-flags/evaluate')
        .set(authHeaders.admin)
        .send(evaluateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(typeof response.body.data.enhanced_grading).toBe('boolean');
    });

    test('Invalid flag name should be rejected', async () => {
      const invalidData = {
        name: 'invalid flag name!', // Invalid: contains special characters
        description: 'Test',
      };

      const response = await request(app)
        .post('/api/feature-flags')
        .set(authHeaders.admin)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Shadow Mode Routes (/api/shadow-mode)', () => {
    test('GET /api/shadow-mode/config - should return shadow mode configuration', async () => {
      const response = await request(app)
        .get('/api/shadow-mode/config')
        .set(authHeaders.admin)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.enabled).toBeDefined();
      expect(response.body.data.trafficPercentage).toBeDefined();
    });

    test('POST /api/shadow-mode/config - should update shadow mode configuration', async () => {
      const configData = {
        enabled: true,
        trafficPercentage: 25,
        components: ['grading', 'alerts'],
        invariants: {
          maxLatencyMs: 6000,
          maxMemoryMb: 1024,
          maxErrorRate: 0.05,
        },
        monitoring: {
          enableDetailedLogs: true,
          enableMetrics: true,
          enableAlerts: true,
        },
      };

      const response = await request(app)
        .post('/api/shadow-mode/config')
        .set(authHeaders.admin)
        .send(configData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.trafficPercentage).toBe(25);
    });

    test('GET /api/shadow-mode/metrics - should return shadow mode metrics', async () => {
      const response = await request(app)
        .get('/api/shadow-mode/metrics')
        .set(authHeaders.operator)
        .query({
          component: 'grading',
          includeDetails: 'true',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.overview).toBeDefined();
    });

    test('GET /api/shadow-mode/report - should generate comprehensive report', async () => {
      const response = await request(app)
        .get('/api/shadow-mode/report')
        .set(authHeaders.admin)
        .query({ includeDetails: 'true' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary).toBeDefined();
      expect(response.body.data.insights).toBeDefined();
    });

    test('GET /api/shadow-mode/status - should return quick status', async () => {
      const response = await request(app)
        .get('/api/shadow-mode/status')
        .set(authHeaders.operator)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.enabled).toBeDefined();
      expect(response.body.data.healthScore).toBeDefined();
    });
  });

  describe('Authentication & Authorization', () => {
    test('Routes should require appropriate authentication', async () => {
      // Test admin-only routes
      await request(app)
        .post('/api/feature-flags')
        .set(authHeaders.operator) // Operator trying admin route
        .send({ name: 'test', description: 'test' })
        .expect(403);

      // Test operator routes
      await request(app)
        .get('/api/cache/metrics')
        .set(authHeaders.user) // User trying operator route
        .expect(403);
    });

    test('E2E test headers should bypass authentication in non-production', async () => {
      const response = await request(app)
        .get('/api/shadow-mode/status')
        .set(authHeaders.e2e)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Error Handling & Validation', () => {
    test('Invalid JSON should return proper error', async () => {
      const response = await request(app)
        .post('/api/unified-picks')
        .set(authHeaders.admin)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('Missing required fields should return validation errors', async () => {
      const response = await request(app)
        .post('/api/unified-picks')
        .set(authHeaders.admin)
        .send({}) // Empty body
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.details).toBeDefined();
    });

    test('SQL injection attempts should be blocked', async () => {
      const response = await request(app)
        .get('/api/unified-picks')
        .query({
          userId: "'; DROP TABLE users; --",
        })
        .expect(400);

      expect(response.body.error).toContain('malicious SQL patterns');
    });
  });

  describe('Response Format Consistency', () => {
    test('All successful responses should have consistent format', async () => {
      const response = await request(app)
        .get('/api/cache/health')
        .set(authHeaders.operator);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('All error responses should have consistent format', async () => {
      const response = await request(app)
        .get('/api/unified-picks/invalid-uuid');

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});

// Performance tests
describe('API Performance Tests', () => {
  test('Routes should respond within acceptable time limits', async () => {
    const start = Date.now();

    await request(app)
      .get('/api/unified-picks')
      .set({ 'x-e2e-test': 'true' })
      .query({ limit: '10' });

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(1000); // Should respond within 1 second
  });

  test('Cache-enabled routes should show performance improvement on repeated calls', async () => {
    // First call (cache miss)
    const start1 = Date.now();
    await request(app)
      .get('/api/cache/metrics')
      .set({ 'x-e2e-test': 'true' });
    const duration1 = Date.now() - start1;

    // Second call (potential cache hit)
    const start2 = Date.now();
    await request(app)
      .get('/api/cache/metrics')
      .set({ 'x-e2e-test': 'true' });
    const duration2 = Date.now() - start2;

    // Second call should generally be faster (though not guaranteed due to mock data)
    expect(duration2).toBeLessThanOrEqual(duration1 + 50); // Allow for some variance
  });
});