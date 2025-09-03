import { test, expect } from '@playwright/test';

/**
 * API Validation E2E Tests
 * 
 * Comprehensive testing of all API routes with validation, error handling,
 * and security measures implemented in production hardening.
 */

test.describe('API Validation Tests', () => {

  test.describe('/api/cappers', () => {
    test('returns valid capper data structure', async ({ request }) => {
      const response = await request.get('/api/cappers');
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data).toHaveProperty('cappers');
      expect(Array.isArray(data.cappers)).toBeTruthy();
      
      // Test capper structure
      if (data.cappers.length > 0) {
        const capper = data.cappers[0];
        expect(capper).toHaveProperty('id');
        expect(capper).toHaveProperty('name');
        expect(capper).toHaveProperty('active');
        expect(typeof capper.id).toBe('string');
        expect(typeof capper.name).toBe('string');
        expect(typeof capper.active).toBe('boolean');
      }
    });

    test('supports sport filtering', async ({ request }) => {
      const response = await request.get('/api/cappers?sport=NBA');
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data).toHaveProperty('cappers');
    });

    test('supports active filtering', async ({ request }) => {
      const response = await request.get('/api/cappers?active=true');
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data).toHaveProperty('cappers');
      
      // All returned cappers should be active
      data.cappers.forEach((capper: any) => {
        expect(capper.active).toBe(true);
      });
    });

    test('handles invalid query parameters gracefully', async ({ request }) => {
      // Invalid sport should still return 200 but potentially empty results
      const response = await request.get('/api/cappers?sport=INVALID');
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data).toHaveProperty('cappers');
      expect(Array.isArray(data.cappers)).toBeTruthy();
    });
  });

  test.describe('/api/games', () => {
    test('requires sport parameter', async ({ request }) => {
      const response = await request.get('/api/games');
      expect(response.status()).toBe(400);
      
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    test('validates sport enum values', async ({ request }) => {
      const validSports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF'];
      
      for (const sport of validSports) {
        const response = await request.get(`/api/games?sport=${sport}`);
        expect(response.ok()).toBeTruthy();
        
        const data = await response.json();
        expect(data).toHaveProperty('games');
        expect(Array.isArray(data.games)).toBeTruthy();
      }
    });

    test('rejects invalid sport values', async ({ request }) => {
      const invalidSports = ['INVALID', 'SOCCER', '', 'null'];
      
      for (const sport of invalidSports) {
        const response = await request.get(`/api/games?sport=${sport}`);
        expect(response.status()).toBe(400);
        
        const data = await response.json();
        expect(data).toHaveProperty('error');
      }
    });

    test('supports team_id filtering', async ({ request }) => {
      const response = await request.get('/api/games?sport=NBA&team_id=test-team-id');
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data).toHaveProperty('games');
    });

    test('returns proper game data structure', async ({ request }) => {
      const response = await request.get('/api/games?sport=NBA');
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data).toHaveProperty('games');
      
      if (data.games.length > 0) {
        const game = data.games[0];
        expect(game).toHaveProperty('id');
        expect(game).toHaveProperty('sport');
        expect(game).toHaveProperty('home_team');
        expect(game).toHaveProperty('away_team');
      }
    });
  });

  test.describe('/api/props', () => {
    test('requires sport parameter', async ({ request }) => {
      const response = await request.get('/api/props');
      expect(response.status()).toBe(400);
      
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    test('validates sport enum values', async ({ request }) => {
      const validSports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF'];
      
      for (const sport of validSports) {
        const response = await request.get(`/api/props?sport=${sport}`);
        expect(response.ok()).toBeTruthy();
        
        const data = await response.json();
        expect(data).toHaveProperty('props');
        expect(Array.isArray(data.props)).toBeTruthy();
      }
    });

    test('supports filtering parameters', async ({ request }) => {
      const response = await request.get('/api/props?sport=NBA&team_id=test&player_id=test&game_id=test');
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data).toHaveProperty('props');
    });

    test('returns proper prop data structure', async ({ request }) => {
      const response = await request.get('/api/props?sport=NBA');
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data).toHaveProperty('props');
      
      if (data.props.length > 0) {
        const prop = data.props[0];
        expect(prop).toHaveProperty('sport');
        expect(prop).toHaveProperty('stat_type');
        expect(prop).toHaveProperty('player_name');
      }
    });
  });

  test.describe('/api/submit-ticket', () => {
    let validCapperId: string;

    test.beforeAll(async ({ request }) => {
      // Get a valid capper ID for testing
      const cappersResponse = await request.get('/api/cappers');
      const cappersData = await cappersResponse.json();
      
      if (cappersData.cappers.length > 0) {
        validCapperId = cappersData.cappers[0].id;
      }
    });

    test('validates required fields', async ({ request }) => {
      const response = await request.post('/api/submit-ticket', {
        data: {},
      });
      
      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('details');
      expect(Array.isArray(data.details)).toBeTruthy();
    });

    test('validates capper_id UUID format', async ({ request }) => {
      const response = await request.post('/api/submit-ticket', {
        data: {
          capper_id: 'not-a-uuid',
          sport: 'NBA',
          ticket_type: 'single',
          selections: [],
        },
      });
      
      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('UUID');
    });

    test('validates sport enum', async ({ request }) => {
      const response = await request.post('/api/submit-ticket', {
        data: {
          capper_id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
          sport: 'INVALID_SPORT',
          ticket_type: 'single',
          selections: [],
        },
      });
      
      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    test('validates ticket_type enum', async ({ request }) => {
      const response = await request.post('/api/submit-ticket', {
        data: {
          capper_id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
          sport: 'NBA',
          ticket_type: 'invalid_type',
          selections: [],
        },
      });
      
      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    test('requires at least one selection', async ({ request }) => {
      const response = await request.post('/api/submit-ticket', {
        data: {
          capper_id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
          sport: 'NBA',
          ticket_type: 'single',
          selections: [],
        },
      });
      
      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('selection');
    });

    test('validates parlay requirements', async ({ request }) => {
      const response = await request.post('/api/submit-ticket', {
        data: {
          capper_id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
          sport: 'NBA',
          ticket_type: 'parlay',
          selections: [{
            sport: 'NBA',
            stat_type: 'points',
            line: 25.5,
            leg_odds: -110,
            source: 'manual',
            selection: 'over',
          }],
        },
      });
      
      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('parlay');
      expect(data.error).toContain('2 selections');
    });

    test('validates selection data structure', async ({ request }) => {
      const response = await request.post('/api/submit-ticket', {
        data: {
          capper_id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
          sport: 'NBA',
          ticket_type: 'single',
          selections: [{
            // Missing required fields
          }],
        },
      });
      
      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('details');
    });

    test('successful ticket submission with valid data', async ({ request }) => {
      test.skip(!validCapperId, 'No valid capper ID available');
      
      const response = await request.post('/api/submit-ticket', {
        data: {
          capper_id: validCapperId,
          sport: 'NBA',
          ticket_type: 'single',
          selections: [{
            sport: 'NBA',
            stat_type: 'points',
            line: 25.5,
            leg_odds: -110,
            source: 'manual',
            selection: 'over',
            confidence: 0.8,
          }],
          total_units: 2.5,
          notes: 'Test ticket submission',
        },
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data).toHaveProperty('bet_slip_id');
      expect(data).toHaveProperty('status', 'submitted');
      expect(data).toHaveProperty('message');
      expect(data.message).toContain('successfully');
    });

    test('verifies capper exists and is active', async ({ request }) => {
      const response = await request.post('/api/submit-ticket', {
        data: {
          capper_id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', // Non-existent UUID
          sport: 'NBA',
          ticket_type: 'single',
          selections: [{
            sport: 'NBA',
            stat_type: 'points',
            line: 25.5,
            leg_odds: -110,
            source: 'manual',
            selection: 'over',
          }],
        },
      });
      
      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('capper');
    });
  });

  test.describe('/api/dev/simulate-bridge', () => {
    test('is only available in development', async ({ request }) => {
      // This test will behave differently in dev vs prod
      const response = await request.get('/api/dev/simulate-bridge?id=test-id');
      
      if (process.env.NODE_ENV === 'development') {
        // Should return 400 for invalid UUID, not 404
        expect(response.status()).toBe(400);
      } else {
        // Should return 404 in production
        expect(response.status()).toBe(404);
      }
    });

    test('validates bet_slip_id UUID format in development', async ({ request }) => {
      test.skip(process.env.NODE_ENV !== 'development', 'Only available in development');
      
      const response = await request.get('/api/dev/simulate-bridge?id=invalid-uuid');
      expect(response.status()).toBe(400);
      
      const data = await response.json();
      expect(data.error).toContain('UUID');
    });
  });

  test.describe('API Error Handling', () => {
    test('returns structured error responses', async ({ request }) => {
      const response = await request.post('/api/submit-ticket', {
        data: { invalid: 'data' },
      });
      
      expect(response.status()).toBe(400);
      const data = await response.json();
      
      // Should have structured error format
      expect(data).toHaveProperty('error');
      expect(typeof data.error).toBe('string');
      expect(data).toHaveProperty('details');
      expect(Array.isArray(data.details)).toBeTruthy();
    });

    test('handles malformed JSON gracefully', async ({ request }) => {
      const response = await request.post('/api/submit-ticket', {
        data: 'invalid-json-string',
        headers: {
          'content-type': 'application/json',
        },
      });
      
      // Should handle the error gracefully
      expect([400, 500].includes(response.status())).toBeTruthy();
    });

    test('sets appropriate HTTP status codes', async ({ request }) => {
      // Test validation error (400)
      const validationResponse = await request.get('/api/games');
      expect(validationResponse.status()).toBe(400);
      
      // Test not found for non-existent endpoint (404)
      const notFoundResponse = await request.get('/api/nonexistent');
      expect(notFoundResponse.status()).toBe(404);
    });

    test('includes proper headers', async ({ request }) => {
      const response = await request.get('/api/cappers');
      const headers = response.headers();
      
      expect(headers['content-type']).toContain('application/json');
      
      // Should not expose sensitive information
      expect(headers['x-powered-by']).toBeUndefined();
    });
  });

  test.describe('API Performance', () => {
    test('responds within acceptable time limits', async ({ request }) => {
      const startTime = Date.now();
      const response = await request.get('/api/cappers');
      const endTime = Date.now();
      
      expect(response.ok()).toBeTruthy();
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds max
    });

    test('handles concurrent requests', async ({ request }) => {
      const requests = Array.from({ length: 5 }, () => 
        request.get('/api/cappers')
      );
      
      const responses = await Promise.all(requests);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.ok()).toBeTruthy();
      });
    });
  });
});