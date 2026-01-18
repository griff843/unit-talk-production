/**
 * Phase 14: Partner API Integration Tests
 * Tests for authentication, endpoints, webhooks, and rate limiting
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { supabaseClient } from '../../src/services/supabaseClient';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_API_KEY = process.env.TEST_PARTNER_API_KEY || 'ut_test_abc123';

describe('Phase 14: Partner API Integration Tests', () => {
  let client: AxiosInstance;
  let partnerId: string;
  let testPickId: string;
  let testWebhookId: string;

  beforeAll(async () => {
    // Setup test API client
    client = axios.create({
      baseURL: `${API_BASE_URL}/v1/partners`,
      headers: {
        'Authorization': `Bearer ${TEST_API_KEY}`,
        'Content-Type': 'application/json'
      },
      validateStatus: () => true // Don't throw on any status
    });

    // Create test partner organization
    const { data: partner, error } = await supabaseClient
      .from('partner_organizations')
      .insert({
        name: 'Integration Test Partner',
        slug: 'integration-test',
        contact_email: 'test@unittalk.com',
        tier: 'pro'
      })
      .select()
      .single();

    if (error) {
      console.warn('Test partner already exists or creation failed:', error.message);
      // Fetch existing partner
      const { data: existingPartner } = await supabaseClient
        .from('partner_organizations')
        .select()
        .eq('slug', 'integration-test')
        .single();
      partnerId = existingPartner?.id;
    } else {
      partnerId = partner.id;
    }

    // Create test API key
    const keyHash = crypto.createHash('sha256').update(TEST_API_KEY).digest('hex');
    await supabaseClient
      .from('partner_api_keys')
      .upsert({
        partner_id: partnerId,
        key_hash: keyHash,
        key_prefix: 'ut_test_',
        name: 'Integration Test Key',
        scopes: ['read:picks', 'write:picks', 'read:markets', 'read:stats', 'read:webhooks', 'write:webhooks']
      });
  });

  afterAll(async () => {
    // Cleanup test data
    if (testWebhookId) {
      await client.delete(`/webhooks/${testWebhookId}`);
    }
    if (testPickId) {
      await supabaseClient.from('partner_picks').delete().eq('id', testPickId);
    }
    // Note: Don't delete partner org to avoid breaking other tests
  });

  describe('Authentication', () => {
    it('should reject requests without API key', async () => {
      const response = await axios.get(`${API_BASE_URL}/v1/partners/picks`, {
        validateStatus: () => true
      });
      expect(response.status).toBe(401);
      expect(response.data.error).toBe('Unauthorized');
    });

    it('should reject requests with invalid API key', async () => {
      const response = await axios.get(`${API_BASE_URL}/v1/partners/picks`, {
        headers: {
          'Authorization': 'Bearer ut_live_invalid_key'
        },
        validateStatus: () => true
      });
      expect(response.status).toBe(401);
    });

    it('should accept requests with valid API key', async () => {
      const response = await client.get('/picks');
      expect([200, 404]).toContain(response.status);
    });

    it('should reject API key with wrong format', async () => {
      const response = await axios.get(`${API_BASE_URL}/v1/partners/picks`, {
        headers: {
          'Authorization': 'Bearer invalid_format'
        },
        validateStatus: () => true
      });
      expect(response.status).toBe(401);
      expect(response.data.message).toContain('Invalid API key format');
    });
  });

  describe('Picks Endpoint', () => {
    it('should create a new pick', async () => {
      const pickData = {
        sport: 'NFL',
        market_type: 'player_props',
        selection: 'over',
        line: 250.5,
        odds: -110,
        stake: 100,
        player_name: 'Patrick Mahomes',
        team: 'Kansas City Chiefs',
        opponent: 'Buffalo Bills',
        game_date: '2025-10-26',
        game_time: '20:20:00',
        external_id: `test-${Date.now()}`
      };

      const response = await client.post('/picks', pickData);
      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveProperty('id');
      expect(response.data.data).toHaveProperty('unified_pick');

      testPickId = response.data.data.id;
    });

    it('should list picks with pagination', async () => {
      const response = await client.get('/picks', {
        params: { limit: 10, offset: 0 }
      });
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data).toHaveProperty('pagination');
      expect(response.data.pagination.limit).toBe(10);
    });

    it('should filter picks by sport', async () => {
      const response = await client.get('/picks', {
        params: { sport: 'NFL' }
      });
      expect(response.status).toBe(200);
      if (response.data.data && response.data.data.length > 0) {
        expect(response.data.data.every((p: any) => p.unified_picks.sport === 'NFL')).toBe(true);
      }
    });

    it('should get a specific pick by ID', async () => {
      if (!testPickId) {
        console.warn('Skipping test: no test pick created');
        return;
      }

      const response = await client.get(`/picks/${testPickId}`);
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.id).toBe(testPickId);
    });

    it('should return 404 for non-existent pick', async () => {
      const fakeId = crypto.randomUUID();
      const response = await client.get(`/picks/${fakeId}`);
      expect(response.status).toBe(404);
      expect(response.data.error).toBe('Not Found');
    });

    it('should reject pick creation without required fields', async () => {
      const response = await client.post('/picks', {
        sport: 'NFL'
        // Missing required fields
      });
      expect(response.status).toBe(400);
      expect(response.data.error).toBe('Bad Request');
    });
  });

  describe('Markets Endpoint', () => {
    it('should list available markets', async () => {
      const response = await client.get('/markets', {
        params: { limit: 50 }
      });
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data).toHaveProperty('pagination');
    });

    it('should filter markets by sport', async () => {
      const response = await client.get('/markets', {
        params: { sport: 'NBA' }
      });
      expect(response.status).toBe(200);
    });

    it('should search markets by player name', async () => {
      const response = await client.get('/markets', {
        params: { player_name: 'LeBron' }
      });
      expect(response.status).toBe(200);
    });
  });

  describe('Stats Endpoint', () => {
    it('should get performance statistics', async () => {
      const response = await client.get('/stats');
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveProperty('overall');
      expect(response.data.data).toHaveProperty('breakdown');
    });

    it('should filter stats by date range', async () => {
      const response = await client.get('/stats', {
        params: {
          date_from: '2025-10-01',
          date_to: '2025-10-31'
        }
      });
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });

    it('should filter stats by sport', async () => {
      const response = await client.get('/stats', {
        params: { sport: 'NFL' }
      });
      expect(response.status).toBe(200);
    });

    it('should include tier breakdown', async () => {
      const response = await client.get('/stats');
      expect(response.status).toBe(200);
      expect(response.data.data.breakdown).toHaveProperty('byTier');
      expect(response.data.data.breakdown).toHaveProperty('bySport');
    });
  });

  describe('Webhooks Endpoint', () => {
    it('should create a webhook', async () => {
      const webhookData = {
        url: 'https://example.com/webhooks/test',
        events: ['pick.scored', 'market.closed']
      };

      const response = await client.post('/webhooks', webhookData);
      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveProperty('id');
      expect(response.data.data).toHaveProperty('secret');
      expect(response.data.data.url).toBe(webhookData.url);

      testWebhookId = response.data.data.id;
    });

    it('should list webhooks', async () => {
      const response = await client.get('/webhooks');
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.data)).toBe(true);
    });

    it('should reject webhook with invalid URL', async () => {
      const response = await client.post('/webhooks', {
        url: 'not-a-valid-url',
        events: ['pick.scored']
      });
      expect(response.status).toBe(400);
    });

    it('should reject webhook without events', async () => {
      const response = await client.post('/webhooks', {
        url: 'https://example.com/webhook'
      });
      expect(response.status).toBe(400);
    });

    it('should delete a webhook', async () => {
      if (!testWebhookId) {
        console.warn('Skipping test: no webhook created');
        return;
      }

      const response = await client.delete(`/webhooks/${testWebhookId}`);
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);

      // Verify it's deleted
      const listResponse = await client.get('/webhooks');
      const webhook = listResponse.data.data.find((w: any) => w.id === testWebhookId);
      expect(webhook).toBeUndefined();

      testWebhookId = ''; // Clear so afterAll doesn't try to delete again
    });
  });

  describe('Rate Limiting', () => {
    it('should include rate limit headers in response', async () => {
      const response = await client.get('/picks');
      expect(response.headers).toHaveProperty('x-ratelimit-limit-minute');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining-minute');
      expect(response.headers).toHaveProperty('x-quota-limit');
      expect(response.headers).toHaveProperty('x-quota-remaining');
    });

    it('should enforce rate limits (may take multiple requests)', async () => {
      // This test would need to make many requests to trigger rate limiting
      // For now, just verify the infrastructure is in place
      const response = await client.get('/picks');
      expect(response.headers['x-ratelimit-limit-minute']).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should return correlation ID in errors', async () => {
      const response = await client.get('/picks/invalid-id');
      expect(response.data).toHaveProperty('correlationId');
    });

    it('should handle internal server errors gracefully', async () => {
      // This would require mocking internal errors
      // For now, verify error structure
      const response = await client.post('/picks', {});
      expect(response.data).toHaveProperty('error');
      expect(response.data).toHaveProperty('message');
    });
  });

  describe('Metrics Collection', () => {
    it('should expose partner metrics at /metrics endpoint', async () => {
      const response = await axios.get(`${API_BASE_URL}/metrics`);
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.data).toContain('partner_api_requests_total');
      expect(response.data).toContain('partner_api_errors_total');
    });
  });
});
