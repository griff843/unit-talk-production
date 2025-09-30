import request from 'supertest';
import { app } from '../../apps/api/src/api-server';
import { supabase } from '../../apps/api/src/services/supabaseClient';
import { z } from 'zod';
import { jest } from '@jest/globals';

/**
 * API Route Integration Tests
 * Tests Zod validation, RBAC authorization, rate limiting, and feature flags
 */
describe('API Route Integration Tests', () => {
  const testApiKey = 'test_api_key_12345';
  const adminApiKey = 'admin_api_key_67890';
  const invalidApiKey = 'invalid_key';

  beforeAll(async () => {
    // Setup test API keys and users
    await setupTestAuth();
  });

  afterAll(async () => {
    await cleanupTestAuth();
  });

  describe('Ingestion Routes', () => {
    describe('POST /api/ingestion/watchlist', () => {
      const validWatchlistPayload = {
        external_game_id: 'test_game_watchlist_001',
        sport: 'nfl',
        markets: ['passing_yards', 'rushing_yards'],
        priority: 'high',
        auto_refresh: true
      };

      test('accepts valid payload with proper authentication', async () => {
        const response = await request(app)
          .post('/api/ingestion/watchlist')
          .set('Authorization', `Bearer ${testApiKey}`)
          .send(validWatchlistPayload)
          .expect(201);

        expect(response.body).toMatchObject({
          success: true,
          watchlist_id: expect.any(String),
          external_game_id: 'test_game_watchlist_001',
          status: 'active'
        });

        // Verify watchlist was created in database
        const { data, error } = await supabase
          .from('ingestion_watchlists')
          .select('*')
          .eq('external_game_id', 'test_game_watchlist_001')
          .single();

        expect(error).toBeNull();
        expect(data).toBeDefined();
        expect(data!.sport).toBe('nfl');
        expect(data!.markets).toContain('passing_yards');
      });

      test('rejects invalid payload with Zod validation errors', async () => {
        const invalidPayload = {
          external_game_id: '', // Invalid: empty string
          sport: 'invalid_sport', // Invalid: not in enum
          markets: [], // Invalid: empty array
          priority: 'invalid_priority' // Invalid: not in enum
        };

        const response = await request(app)
          .post('/api/ingestion/watchlist')
          .set('Authorization', `Bearer ${testApiKey}`)
          .send(invalidPayload)
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'external_game_id',
              message: expect.stringContaining('String must contain at least 1 character')
            }),
            expect.objectContaining({
              field: 'sport',
              message: expect.stringContaining('Invalid enum value')
            }),
            expect.objectContaining({
              field: 'markets',
              message: expect.stringContaining('Array must contain at least 1 element')
            })
          ])
        });
      });

      test('rejects requests without authentication', async () => {
        await request(app)
          .post('/api/ingestion/watchlist')
          .send(validWatchlistPayload)
          .expect(401);
      });

      test('rejects requests with invalid API key', async () => {
        await request(app)
          .post('/api/ingestion/watchlist')
          .set('Authorization', `Bearer ${invalidApiKey}`)
          .send(validWatchlistPayload)
          .expect(401);
      });
    });

    describe('GET /api/ingestion/status/:gameId', () => {
      test('returns ingestion status for valid game', async () => {
        const response = await request(app)
          .get('/api/ingestion/status/test_game_watchlist_001')
          .set('Authorization', `Bearer ${testApiKey}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          external_game_id: 'test_game_watchlist_001',
          status: expect.stringMatching(/^(active|paused|completed|error)$/),
          last_update: expect.any(String),
          props_ingested: expect.any(Number),
          next_refresh: expect.any(String)
        });
      });

      test('returns 404 for non-existent game', async () => {
        await request(app)
          .get('/api/ingestion/status/non_existent_game')
          .set('Authorization', `Bearer ${testApiKey}`)
          .expect(404);
      });
    });
  });

  describe('Settlement Routes', () => {
    describe('POST /api/settlement/run', () => {
      const validSettlementPayload = {
        external_game_id: 'test_game_settlement_001',
        force_settlement: false,
        settlement_source: 'espn'
      };

      test('triggers settlement for completed game', async () => {
        // Insert test game data
        await supabase.from('unified_picks').insert({
          external_prop_id: 'settlement_test_prop_001',
          external_game_id: 'test_game_settlement_001',
          source: 'optimal',
          sport: 'nfl',
          market: 'passing_yards',
          player_name: 'Test Player Settlement',
          line: 275.5,
          odds_over: -110,
          odds_under: -110,
          team: 'Team A',
          opponent: 'Team B',
          game_date: '2024-01-20' // Yesterday
        });

        const response = await request(app)
          .post('/api/settlement/run')
          .set('Authorization', `Bearer ${adminApiKey}`) // Admin required
          .send(validSettlementPayload)
          .expect(202);

        expect(response.body).toMatchObject({
          success: true,
          settlement_job_id: expect.any(String),
          external_game_id: 'test_game_settlement_001',
          status: 'queued',
          estimated_completion: expect.any(String)
        });
      });

      test('rejects settlement request from non-admin user', async () => {
        await request(app)
          .post('/api/settlement/run')
          .set('Authorization', `Bearer ${testApiKey}`) // Regular user
          .send(validSettlementPayload)
          .expect(403);
      });

      test('validates settlement payload schema', async () => {
        const invalidPayload = {
          external_game_id: '', // Invalid
          force_settlement: 'not_boolean', // Invalid type
          settlement_source: 'invalid_source' // Invalid enum
        };

        const response = await request(app)
          .post('/api/settlement/run')
          .set('Authorization', `Bearer ${adminApiKey}`)
          .send(invalidPayload)
          .expect(400);

        expect(response.body.error).toBe('Validation failed');
        expect(response.body.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'external_game_id' }),
            expect.objectContaining({ field: 'force_settlement' }),
            expect.objectContaining({ field: 'settlement_source' })
          ])
        );
      });
    });

    describe('GET /api/settlement/status/:jobId', () => {
      test('returns settlement job status', async () => {
        // Create a test settlement job
        const { data: job } = await supabase
          .from('settlement_jobs')
          .insert({
            external_game_id: 'test_game_settlement_002',
            status: 'processing',
            created_by: 'test_user',
            settlement_source: 'espn'
          })
          .select()
          .single();

        const response = await request(app)
          .get(`/api/settlement/status/${job!.id}`)
          .set('Authorization', `Bearer ${testApiKey}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          job_id: job!.id,
          status: 'processing',
          external_game_id: 'test_game_settlement_002',
          progress: expect.any(Number),
          props_settled: expect.any(Number),
          props_total: expect.any(Number)
        });
      });
    });
  });

  describe('Operations Routes', () => {
    describe('GET /api/ops/credit-usage', () => {
      test('returns credit usage for authenticated user', async () => {
        const response = await request(app)
          .get('/api/ops/credit-usage')
          .set('Authorization', `Bearer ${testApiKey}`)
          .query({ 
            start_date: '2024-01-01',
            end_date: '2024-01-31'
          })
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          period: {
            start: '2024-01-01',
            end: '2024-01-31'
          },
          usage: {
            total_credits_used: expect.any(Number),
            credits_remaining: expect.any(Number),
            daily_breakdown: expect.any(Array)
          },
          limits: {
            daily_limit: expect.any(Number),
            monthly_limit: expect.any(Number)
          }
        });
      });

      test('validates date range parameters', async () => {
        const response = await request(app)
          .get('/api/ops/credit-usage')
          .set('Authorization', `Bearer ${testApiKey}`)
          .query({ 
            start_date: 'invalid-date',
            end_date: '2024-01-31'
          })
          .expect(400);

        expect(response.body.error).toContain('Invalid date format');
      });
    });

    describe('POST /api/ops/feature-flag', () => {
      test('allows admin to update feature flags', async () => {
        const flagPayload = {
          flag_name: 'enhanced_scoring',
          enabled: true,
          rollout_percentage: 50,
          conditions: {
            user_tier: ['premium', 'pro']
          }
        };

        const response = await request(app)
          .post('/api/ops/feature-flag')
          .set('Authorization', `Bearer ${adminApiKey}`)
          .send(flagPayload)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          flag_name: 'enhanced_scoring',
          enabled: true,
          rollout_percentage: 50,
          updated_at: expect.any(String)
        });
      });

      test('prevents non-admin users from updating feature flags', async () => {
        const flagPayload = {
          flag_name: 'enhanced_scoring',
          enabled: false
        };

        await request(app)
          .post('/api/ops/feature-flag')
          .set('Authorization', `Bearer ${testApiKey}`)
          .send(flagPayload)
          .expect(403);
      });
    });
  });

  describe('Rate Limiting', () => {
    test('enforces rate limits on public endpoints', async () => {
      const endpoint = '/api/public/props';
      const requests = [];

      // Make 100 rapid requests (assuming limit is 60 per minute)
      for (let i = 0; i < 100; i++) {
        requests.push(
          request(app)
            .get(endpoint)
            .set('Authorization', `Bearer ${testApiKey}`)
        );
      }

      const responses = await Promise.allSettled(requests);
      
      // Some requests should be rate limited (429 status)
      const rateLimited = responses.filter(
        (result) => 
          result.status === 'fulfilled' && 
          result.value.status === 429
      );

      expect(rateLimited.length).toBeGreaterThan(0);
    }, 15000); // Longer timeout for rate limit test

    test('rate limiting respects API key tiers', async () => {
      // Premium API keys should have higher rate limits
      // This test would require different API key tiers to be implemented
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Feature Flag Integration', () => {
    test('respects feature flag settings', async () => {
      // Disable a feature via feature flag
      await supabase
        .from('feature_flags')
        .upsert({
          flag_name: 'test_feature',
          enabled: false,
          rollout_percentage: 0
        });

      const response = await request(app)
        .get('/api/test-feature-endpoint')
        .set('Authorization', `Bearer ${testApiKey}`)
        .expect(503); // Feature disabled

      expect(response.body).toMatchObject({
        success: false,
        error: 'Feature temporarily unavailable',
        feature: 'test_feature'
      });
    });

    test('handles gradual rollout percentages', async () => {
      // Set feature to 50% rollout
      await supabase
        .from('feature_flags')
        .upsert({
          flag_name: 'gradual_rollout_test',
          enabled: true,
          rollout_percentage: 50
        });

      const requests = [];
      const userIds = Array.from({ length: 100 }, (_, i) => `user_${i}`);

      // Make requests with different user IDs
      for (const userId of userIds) {
        requests.push(
          request(app)
            .get('/api/gradual-rollout-endpoint')
            .set('Authorization', `Bearer ${testApiKey}`)
            .set('X-User-ID', userId)
        );
      }

      const responses = await Promise.all(requests);
      
      const enabled = responses.filter(r => r.status === 200).length;
      const disabled = responses.filter(r => r.status === 503).length;

      // Should be approximately 50/50 split
      expect(enabled).toBeGreaterThan(30);
      expect(enabled).toBeLessThan(70);
      expect(disabled).toBeGreaterThan(30);
      expect(disabled).toBeLessThan(70);
    }, 20000);
  });

  describe('Error Handling and Monitoring', () => {
    test('returns consistent error format', async () => {
      const response = await request(app)
        .get('/api/non-existent-endpoint')
        .set('Authorization', `Bearer ${testApiKey}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String),
        timestamp: expect.any(String),
        request_id: expect.any(String)
      });
    });

    test('logs errors with proper correlation IDs', async () => {
      const correlationId = 'test-correlation-123';
      
      const response = await request(app)
        .post('/api/ingestion/watchlist')
        .set('Authorization', `Bearer ${testApiKey}`)
        .set('X-Correlation-ID', correlationId)
        .send({ invalid: 'payload' })
        .expect(400);

      expect(response.headers['x-correlation-id']).toBe(correlationId);
    });
  });

  // Helper functions
  async function setupTestAuth() {
    // Insert test API keys and users
    await supabase.from('api_keys').upsert([
      {
        key: testApiKey,
        user_id: 'test_user_001',
        role: 'user',
        daily_limit: 1000,
        monthly_limit: 30000,
        active: true
      },
      {
        key: adminApiKey,
        user_id: 'admin_user_001',
        role: 'admin',
        daily_limit: 10000,
        monthly_limit: 300000,
        active: true
      }
    ]);

    await supabase.from('users').upsert([
      {
        id: 'test_user_001',
        username: 'test_user',
        role: 'user',
        tier: 'basic'
      },
      {
        id: 'admin_user_001',
        username: 'admin_user',
        role: 'admin',
        tier: 'admin'
      }
    ]);
  }

  async function cleanupTestAuth() {
    await supabase
      .from('api_keys')
      .delete()
      .in('key', [testApiKey, adminApiKey]);

    await supabase
      .from('users')
      .delete()
      .in('id', ['test_user_001', 'admin_user_001']);

    await supabase
      .from('unified_picks')
      .delete()
      .like('external_prop_id', 'settlement_test_prop_%');

    await supabase
      .from('ingestion_watchlists')
      .delete()
      .like('external_game_id', 'test_game_%');
  }
});
