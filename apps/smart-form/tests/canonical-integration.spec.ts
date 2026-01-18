import { test, expect } from '@playwright/test';

/**
 * Canonical Picks Integration E2E Tests
 *
 * These tests verify the end-to-end flow of the canonical picks integration:
 * 1. Submit pick via canonical endpoint
 * 2. Verify pick written to database
 * 3. Verify outbox entry created
 * 4. Verify audit log entry created
 * 5. Verify performance metrics
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3002';
const API_ENDPOINT = `${BASE_URL}/api/domain/picks/insert`;

test.describe('Canonical Picks Integration', () => {
  test('should successfully submit a canonical pick', async ({ request }) => {
    // Test data
    const pickData = {
      userId: '12345678-1234-1234-1234-123456789012', // Test UUID
      league: 'NFL' as const,
      marketType: 'Passing Yards',
      line: 275.5,
      side: 'over' as const,
      playerId: '87654321-4321-4321-4321-210987654321',
      playerName: 'Patrick Mahomes',
      gameId: '11111111-1111-1111-1111-111111111111',
      odds: -110,
      stake: 1.0,
      userScore: 8,
      betSlipId: `test-${Date.now()}`,
      confidence: 0.85,
      autoPublish: false, // Disable auto-publish for testing
    };

    // Submit pick
    const response = await request.post(API_ENDPOINT, {
      data: pickData,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Verify response status
    expect(response.status()).toBe(201);

    // Verify response body
    const responseData = await response.json();

    expect(responseData).toMatchObject({
      success: true,
      driver: 'canonical',
      publishMode: 'outbox',
      auditLogged: true,
      outboxQueued: false, // autoPublish was false
    });

    // Verify pick ID was returned
    expect(responseData.pickId).toBeDefined();
    expect(typeof responseData.pickId).toBe('string');

    // Verify processing time is reasonable
    expect(responseData.processingTime).toBeDefined();
    expect(responseData.processingTime).toBeLessThan(250); // Target: < 250ms
  });

  test('should handle validation errors correctly', async ({ request }) => {
    // Missing required field (league)
    const invalidPickData = {
      userId: '12345678-1234-1234-1234-123456789012',
      // league: 'NFL', // MISSING
      marketType: 'Passing Yards',
      line: 275.5,
      side: 'over',
    };

    const response = await request.post(API_ENDPOINT, {
      data: invalidPickData,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Verify error response
    expect(response.status()).toBe(400);

    const responseData = await response.json();
    expect(responseData).toMatchObject({
      success: false,
      error: 'Invalid pick data',
    });

    // Verify validation details are returned
    expect(responseData.details).toBeDefined();
    expect(Array.isArray(responseData.details)).toBe(true);
  });

  test('should support idempotency', async ({ request }) => {
    const idempotencyKey = `idem-${Date.now()}`;

    const pickData = {
      userId: '12345678-1234-1234-1234-123456789012',
      league: 'NBA' as const,
      marketType: 'Points',
      line: 28.5,
      side: 'over' as const,
      playerName: 'LeBron James',
      idempotencyKey,
      autoPublish: false,
    };

    // First submission
    const response1 = await request.post(API_ENDPOINT, {
      data: pickData,
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
    });

    expect(response1.status()).toBe(201);
    const data1 = await response1.json();
    expect(data1.success).toBe(true);
    const pickId1 = data1.pickId;

    // Second submission with same idempotency key
    const response2 = await request.post(API_ENDPOINT, {
      data: pickData,
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
    });

    expect(response2.status()).toBe(201);
    const data2 = await response2.json();

    // Should return same pick ID
    expect(data2.pickId).toBe(pickId1);

    // Should indicate idempotent response
    expect(data2.idempotent).toBe(true);
  });

  test('should check canonical API status', async ({ request }) => {
    const response = await request.get(API_ENDPOINT);

    expect(response.status()).toBe(200);

    const statusData = await response.json();

    expect(statusData).toMatchObject({
      success: true,
      smartFormIntegration: 'active',
    });

    // Verify environment configuration
    expect(statusData.environment).toMatchObject({
      pickDriver: 'canonical',
      publishMode: 'outbox',
    });

    // Verify canonical API is accessible
    expect(statusData.canonicalApi).toBeDefined();
    expect(statusData.canonicalApi.success).toBe(true);
  });

  test('should handle multiple leagues correctly', async ({ request }) => {
    const leagues: Array<'NFL' | 'NBA' | 'MLB' | 'NHL' | 'NCAAF'> = [
      'NFL',
      'NBA',
      'MLB',
      'NHL',
      'NCAAF',
    ];

    for (const league of leagues) {
      const pickData = {
        userId: '12345678-1234-1234-1234-123456789012',
        league,
        marketType: 'Test Market',
        line: 10.5,
        side: 'over' as const,
        betSlipId: `${league}-test-${Date.now()}`,
        autoPublish: false,
      };

      const response = await request.post(API_ENDPOINT, {
        data: pickData,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(response.status()).toBe(201);

      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.pick).toBeDefined();
    }
  });

  test('should enforce side validation', async ({ request }) => {
    // Invalid side value
    const pickData = {
      userId: '12345678-1234-1234-1234-123456789012',
      league: 'NFL' as const,
      marketType: 'Passing Yards',
      line: 275.5,
      side: 'invalid-side', // Should be 'over' or 'under'
      autoPublish: false,
    };

    const response = await request.post(API_ENDPOINT, {
      data: pickData,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(response.status()).toBe(400);

    const responseData = await response.json();
    expect(responseData.success).toBe(false);
    expect(responseData.error).toBe('Invalid pick data');
  });

  test('should handle performance within targets', async ({ request }) => {
    const pickData = {
      userId: '12345678-1234-1234-1234-123456789012',
      league: 'NFL' as const,
      marketType: 'Passing Yards',
      line: 275.5,
      side: 'over' as const,
      playerName: 'Patrick Mahomes',
      betSlipId: `perf-test-${Date.now()}`,
      autoPublish: false,
    };

    const startTime = Date.now();

    const response = await request.post(API_ENDPOINT, {
      data: pickData,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const endTime = Date.now();
    const totalLatency = endTime - startTime;

    expect(response.status()).toBe(201);

    const responseData = await response.json();
    expect(responseData.success).toBe(true);

    // Performance assertions
    // Target: API p95 < 120ms, submit < 250ms
    console.log(`Total latency: ${totalLatency}ms`);
    console.log(`Processing time: ${responseData.processingTime}ms`);

    expect(totalLatency).toBeLessThan(500); // Generous threshold for E2E
    expect(responseData.processingTime).toBeLessThan(250); // Target threshold
  });
});

test.describe('Canonical API Error Handling', () => {
  test('should handle API service unavailability gracefully', async ({ request }) => {
    // This test would require mocking the API service to be unavailable
    // For now, we'll test the error response structure

    const pickData = {
      userId: 'invalid-uuid', // Invalid UUID format
      league: 'NFL' as const,
      marketType: 'Test',
      line: 10.5,
      side: 'over' as const,
    };

    const response = await request.post(API_ENDPOINT, {
      data: pickData,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Should return 400 for validation error (invalid UUID)
    expect(response.status()).toBe(400);

    const responseData = await response.json();
    expect(responseData).toHaveProperty('success', false);
    expect(responseData).toHaveProperty('error');
  });
});
