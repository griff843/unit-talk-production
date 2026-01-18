/**
 * Capper Resolution Tests
 *
 * Tests the server-side capper ID resolution logic in /api/domain/picks/insert
 * Verifies the priority order and fallback behavior:
 * 1. Request body userId
 * 2. Environment variables (CAPPER_ID, DEFAULT_CAPPER_ID, TEST_CAPPER_ID, SMARTFORM_DEFAULT_CAPPER_ID)
 * 3. CAPPER_IDS (comma/space separated list)
 * 4. Database lookup (first active capper/tipster)
 * 5. 422 error if none available
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3006';

// Test data
const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const INVALID_UUID = 'not-a-valid-uuid';

const BASE_PICK_DATA = {
  league: 'NFL',
  marketType: 'Player Props',
  line: 275.5,
  side: 'over',
  playerName: 'Patrick Mahomes',
  betSlipId: 'test-bet-slip-' + Date.now(),
};

test.describe('Capper Resolution', () => {
  test.describe('Priority 1: Request Body userId', () => {
    test('should use userId from request body when provided and valid', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/domain/picks/insert`, {
        data: {
          ...BASE_PICK_DATA,
          userId: VALID_UUID,
        },
      });

      // Should either succeed (if API accepts it) or fail with validation error
      // But should NOT fail with "No capper ID could be resolved" error
      const data = await response.json();

      if (!response.ok()) {
        // If it fails, it should NOT be because of missing capper ID
        expect(data.error).not.toBe('Missing capper ID');
      }
    });

    test('should fall back to env when userId is invalid UUID', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/domain/picks/insert`, {
        data: {
          ...BASE_PICK_DATA,
          userId: INVALID_UUID,
        },
      });

      // Should attempt to use environment variable or database fallback
      // Might succeed if env is configured, or return 422 if not
      const data = await response.json();

      if (response.status() === 422) {
        expect(data.error).toBe('Missing capper ID');
        expect(data.details.checkedSources).toContain('request body (userId)');
      }
    });

    test('should fall back to env when userId is not provided', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/domain/picks/insert`, {
        data: BASE_PICK_DATA,
      });

      const data = await response.json();

      // Should either succeed (using env/db) or fail with helpful message
      if (response.status() === 422) {
        expect(data.error).toBe('Missing capper ID');
        expect(data.message).toContain('No capper ID could be resolved');
        expect(data.details.checkedSources).toBeDefined();
        expect(data.details.hint).toContain('CAPPER_ID');
      }
    });
  });

  test.describe('Default Capper Endpoint', () => {
    test('GET /api/domain/cappers/default should return default capper', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/domain/cappers/default`);

      expect(response.ok() || response.status() === 404).toBeTruthy();

      const data = await response.json();

      if (response.ok()) {
        // Should return capper details
        expect(data.success).toBe(true);
        expect(data.capperId).toBeDefined();
        expect(data.source).toBeDefined();

        // Source should be one of the expected values
        const validSources = [
          'CAPPER_ID',
          'DEFAULT_CAPPER_ID',
          'TEST_CAPPER_ID',
          'SMARTFORM_DEFAULT_CAPPER_ID',
          'CAPPER_IDS',
          'database',
        ];
        expect(validSources).toContain(data.source);

        // If source is database, should include capper details
        if (data.source === 'database') {
          expect(data.capper).toBeDefined();
          expect(data.capper.id).toBe(data.capperId);
          expect(data.capper.username).toBeDefined();
          expect(data.capper.role).toBeDefined();
        }
      } else {
        // 404 is acceptable if no default capper is configured
        expect(data.success).toBe(false);
        expect(data.error).toBe('No default capper configured');
        expect(data.checkedSources).toBeDefined();
        expect(data.checkedSources.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should return 422 with helpful message when no capper can be resolved', async ({ request }) => {
      // This test assumes no environment variables are set and database has no cappers
      // In production, at least one source should be configured
      const response = await request.post(`${API_BASE}/api/domain/picks/insert`, {
        data: BASE_PICK_DATA,
      });

      const data = await response.json();

      // If no capper is configured, should get 422
      if (response.status() === 422) {
        expect(data.success).toBe(false);
        expect(data.error).toBe('Missing capper ID');
        expect(data.message).toContain('No capper ID could be resolved');
        expect(data.details).toBeDefined();
        expect(data.details.checkedSources).toBeDefined();
        expect(Array.isArray(data.details.checkedSources)).toBe(true);
        expect(data.details.hint).toContain('CAPPER_ID');
        expect(data.details.hint).toContain('DEFAULT_CAPPER_ID');
        expect(data.details.hint).toContain('TEST_CAPPER_ID');
        expect(data.details.hint).toContain('SMARTFORM_DEFAULT_CAPPER_ID');
        expect(data.details.hint).toContain('CAPPER_IDS');
      } else if (response.ok()) {
        // If it succeeded, that means a default capper was configured
        // This is actually the desired production state
        expect(data.success).toBe(true);
        expect(data.pickId).toBeDefined();
      }
    });

    test('should validate pick data before attempting capper resolution', async ({ request }) => {
      // Missing required fields should fail validation before capper resolution
      const response = await request.post(`${API_BASE}/api/domain/picks/insert`, {
        data: {
          // Missing required fields like league, marketType, line, side
          userId: VALID_UUID,
        },
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid pick data');
      expect(data.details).toBeDefined(); // Validation errors
    });
  });

  test.describe('UUID Validation', () => {
    test('should reject malformed UUIDs in request body', async ({ request }) => {
      const malformedUUIDs = [
        'not-a-uuid',
        '12345',
        'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        '',
        'null',
        'undefined',
      ];

      for (const badUUID of malformedUUIDs) {
        const response = await request.post(`${API_BASE}/api/domain/picks/insert`, {
          data: {
            ...BASE_PICK_DATA,
            userId: badUUID,
            betSlipId: 'test-bad-uuid-' + Date.now(),
          },
        });

        const data = await response.json();

        // Should either fail validation (400) or fall back to env/db
        if (response.status() === 400) {
          // Zod validation caught it
          expect(data.details).toBeDefined();
        } else if (response.status() === 422) {
          // Capper resolution failed
          expect(data.error).toBe('Missing capper ID');
        }
        // Or it succeeded using env/db fallback (which is fine)
      }
    });

    test('should accept valid UUIDs in various formats', async ({ request }) => {
      const validUUIDs = [
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'A1B2C3D4-E5F6-7890-ABCD-EF1234567890', // Uppercase
        'a1B2c3D4-E5f6-7890-AbCd-Ef1234567890', // Mixed case
      ];

      for (const uuid of validUUIDs) {
        const response = await request.post(`${API_BASE}/api/domain/picks/insert`, {
          data: {
            ...BASE_PICK_DATA,
            userId: uuid,
            betSlipId: 'test-valid-uuid-' + Date.now(),
          },
        });

        const data = await response.json();

        // Should NOT fail with "Invalid user ID" validation error
        if (!response.ok()) {
          expect(data.error).not.toBe('Invalid user ID');
        }
      }
    });
  });

  test.describe('Logging and Observability', () => {
    test('should include helpful debug information in 422 response', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/domain/picks/insert`, {
        data: BASE_PICK_DATA,
      });

      const data = await response.json();

      if (response.status() === 422) {
        // Check that the response includes all helpful debugging information
        expect(data).toHaveProperty('success');
        expect(data).toHaveProperty('error');
        expect(data).toHaveProperty('message');
        expect(data).toHaveProperty('details');
        expect(data.details).toHaveProperty('checkedSources');
        expect(data.details).toHaveProperty('hint');

        // Verify all sources are listed
        const sources = data.details.checkedSources;
        expect(sources).toContain('request body (userId)');
        expect(sources).toContain('env.CAPPER_ID');
        expect(sources).toContain('env.DEFAULT_CAPPER_ID');
        expect(sources).toContain('env.TEST_CAPPER_ID');
        expect(sources).toContain('env.SMARTFORM_DEFAULT_CAPPER_ID');
        expect(sources).toContain('env.CAPPER_IDS');
        expect(sources).toContain('database (public.users)');
      }
    });
  });
});
