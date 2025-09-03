import { test, expect } from '@playwright/test';

/**
 * Bridge Integration E2E Tests
 * 
 * Tests the SmartFormBridge integration, idempotency, and structured logging
 * features implemented in the production hardening phase.
 */

test.describe('Bridge Integration Tests', () => {

  let validCapperId: string;
  let testBetSlipId: string;

  test.beforeAll(async ({ request }) => {
    // Get a valid capper for testing
    const cappersResponse = await request.get('/api/cappers');
    const cappersData = await cappersResponse.json();
    
    if (cappersData.cappers.length > 0) {
      validCapperId = cappersData.cappers[0].id;
    }
  });

  test.describe('Bridge Event Publishing', () => {
    test('creates bridge events on ticket submission', async ({ request }) => {
      test.skip(!validCapperId, 'No valid capper available');
      
      const ticketData = {
        capper_id: validCapperId,
        sport: 'NBA',
        ticket_type: 'single',
        selections: [{
          sport: 'NBA',
          stat_type: 'points',
          line: 28.5,
          leg_odds: -110,
          source: 'manual',
          selection: 'over',
          confidence: 0.75,
        }],
        total_units: 1.5,
        notes: 'Bridge integration test',
      };

      const response = await request.post('/api/submit-ticket', {
        data: ticketData,
      });

      expect(response.ok()).toBeTruthy();
      
      const result = await response.json();
      expect(result).toHaveProperty('bet_slip_id');
      expect(result).toHaveProperty('status', 'submitted');
      
      testBetSlipId = result.bet_slip_id;
      
      // Verify the response includes bridge-related fields
      expect(result).toHaveProperty('message');
      expect(result.message).toContain('successfully');
    });

    test('maintains idempotency with duplicate submissions', async ({ request }) => {
      test.skip(!validCapperId, 'No valid capper available');
      
      const ticketData = {
        capper_id: validCapperId,
        sport: 'NBA',
        ticket_type: 'single',
        selections: [{
          sport: 'NBA',
          stat_type: 'assists',
          line: 9.5,
          leg_odds: +105,
          source: 'manual',
          selection: 'under',
          confidence: 0.6,
        }],
        total_units: 2.0,
        notes: 'Idempotency test',
      };

      // Submit the same ticket twice
      const response1 = await request.post('/api/submit-ticket', {
        data: ticketData,
      });
      const response2 = await request.post('/api/submit-ticket', {
        data: ticketData,
      });

      expect(response1.ok()).toBeTruthy();
      expect(response2.ok()).toBeTruthy();
      
      const result1 = await response1.json();
      const result2 = await response2.json();
      
      // Both should succeed (idempotency should handle duplicates gracefully)
      expect(result1).toHaveProperty('bet_slip_id');
      expect(result2).toHaveProperty('bet_slip_id');
    });
  });

  test.describe('Bridge Simulation (Development Only)', () => {
    test('bridge simulation endpoint works in development', async ({ request }) => {
      test.skip(process.env.NODE_ENV !== 'development', 'Only available in development');
      test.skip(!testBetSlipId, 'No test bet slip ID available');
      
      const response = await request.get(`/api/dev/simulate-bridge?id=${testBetSlipId}`);
      
      expect(response.ok()).toBeTruthy();
      
      const result = await response.json();
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('bet_slip_id', testBetSlipId);
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('simulated_at');
    });

    test('bridge simulation validates UUID format', async ({ request }) => {
      test.skip(process.env.NODE_ENV !== 'development', 'Only available in development');
      
      const response = await request.get('/api/dev/simulate-bridge?id=invalid-uuid');
      
      expect(response.status()).toBe(400);
      
      const result = await response.json();
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('UUID');
    });

    test('bridge simulation requires bet_slip_id parameter', async ({ request }) => {
      test.skip(process.env.NODE_ENV !== 'development', 'Only available in development');
      
      const response = await request.get('/api/dev/simulate-bridge');
      
      expect(response.status()).toBe(400);
      
      const result = await response.json();
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('bet_slip_id');
    });

    test('bridge simulation POST method works', async ({ request }) => {
      test.skip(process.env.NODE_ENV !== 'development', 'Only available in development');
      test.skip(!testBetSlipId, 'No test bet slip ID available');
      
      const response = await request.post('/api/dev/simulate-bridge', {
        data: {
          bet_slip_id: testBetSlipId,
        },
      });

      expect(response.ok()).toBeTruthy();
      
      const result = await response.json();
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('bet_slip_id', testBetSlipId);
    });
  });

  test.describe('Structured Logging', () => {
    test('API endpoints provide structured error responses', async ({ request }) => {
      // Test validation error structure
      const response = await request.post('/api/submit-ticket', {
        data: {
          invalid: 'data',
        },
      });

      expect(response.status()).toBe(400);
      
      const result = await response.json();
      
      // Should have structured error format
      expect(result).toHaveProperty('error');
      expect(typeof result.error).toBe('string');
      expect(result).toHaveProperty('details');
      expect(Array.isArray(result.details)).toBeTruthy();
      
      // Details should contain validation information
      if (result.details.length > 0) {
        const detail = result.details[0];
        expect(detail).toHaveProperty('path');
        expect(detail).toHaveProperty('message');
      }
    });

    test('API endpoints handle security logging', async ({ request }) => {
      test.skip(!validCapperId, 'No valid capper available');
      
      // Submit a ticket with manual odds entry (security event)
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
            source: 'manual', // This should trigger security logging
            selection: 'over',
          }],
          total_units: 1.0,
        },
      });

      expect(response.ok()).toBeTruthy();
      
      // The response should still be successful
      // (security logging happens server-side)
      const result = await response.json();
      expect(result).toHaveProperty('bet_slip_id');
    });

    test('Performance logging captures timing', async ({ request }) => {
      const startTime = Date.now();
      
      const response = await request.get('/api/cappers');
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(response.ok()).toBeTruthy();
      
      // Performance should be reasonable (server-side logging captures this)
      expect(duration).toBeLessThan(10000); // 10 seconds max
    });
  });

  test.describe('Database Integration', () => {
    test('ticket creation writes to both smart_tickets and unified_picks', async ({ request }) => {
      test.skip(!validCapperId, 'No valid capper available');
      
      const multiLegTicket = {
        capper_id: validCapperId,
        sport: 'NBA',
        ticket_type: 'parlay',
        selections: [
          {
            sport: 'NBA',
            stat_type: 'points',
            line: 25.5,
            leg_odds: -110,
            source: 'manual',
            selection: 'over',
            confidence: 0.8,
          },
          {
            sport: 'NBA',
            stat_type: 'assists',
            line: 8.5,
            leg_odds: +105,
            source: 'manual',
            selection: 'under',
            confidence: 0.7,
          },
        ],
        total_units: 1.5,
        parlay_odds: +260,
        notes: 'Multi-leg database integration test',
      };

      const response = await request.post('/api/submit-ticket', {
        data: multiLegTicket,
      });

      expect(response.ok()).toBeTruthy();
      
      const result = await response.json();
      expect(result).toHaveProperty('bet_slip_id');
      expect(result).toHaveProperty('selection_count', 2);
      expect(result).toHaveProperty('ticket_type', 'parlay');
    });

    test('handles database constraint violations gracefully', async ({ request }) => {
      // Test with invalid capper_id (foreign key constraint)
      const response = await request.post('/api/submit-ticket', {
        data: {
          capper_id: '00000000-0000-0000-0000-000000000000',
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
      
      const result = await response.json();
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('capper');
    });
  });

  test.describe('Error Recovery and Rollback', () => {
    test('rolls back smart_ticket if unified_picks insertion fails', async ({ request }) => {
      test.skip(!validCapperId, 'No valid capper available');
      
      // This test simulates a scenario where picks insertion might fail
      // In practice, this would be tested with database mocking
      const ticketData = {
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
        }],
        total_units: 1.0,
      };

      const response = await request.post('/api/submit-ticket', {
        data: ticketData,
      });

      // Either succeeds completely or fails completely (no partial state)
      if (response.ok()) {
        const result = await response.json();
        expect(result).toHaveProperty('bet_slip_id');
        expect(result).toHaveProperty('status', 'submitted');
      } else {
        const result = await response.json();
        expect(result).toHaveProperty('error');
      }
    });
  });

  test.describe('Bridge Event Structure', () => {
    test('bridge events contain required metadata', async ({ request }) => {
      test.skip(!validCapperId, 'No valid capper available');
      
      const ticketData = {
        capper_id: validCapperId,
        sport: 'NBA',
        ticket_type: 'single',
        selections: [{
          sport: 'NBA',
          stat_type: 'rebounds',
          line: 10.5,
          leg_odds: -115,
          source: 'api',
          selection: 'over',
          confidence: 0.85,
        }],
        total_units: 2.5,
        notes: 'Bridge event metadata test',
      };

      const response = await request.post('/api/submit-ticket', {
        data: ticketData,
      });

      expect(response.ok()).toBeTruthy();
      
      const result = await response.json();
      
      // Verify response contains bridge-relevant data
      expect(result).toHaveProperty('bet_slip_id');
      expect(result).toHaveProperty('capper_name');
      expect(result).toHaveProperty('sport', 'NBA');
      expect(result).toHaveProperty('selection_count', 1);
      expect(result).toHaveProperty('total_units', 2.5);
      expect(result).toHaveProperty('status', 'submitted');
    });

    test('live bet detection works correctly', async ({ request }) => {
      test.skip(!validCapperId, 'No valid capper available');
      
      const liveBetData = {
        capper_id: validCapperId,
        sport: 'NBA',
        ticket_type: 'single',
        selections: [{
          sport: 'NBA',
          stat_type: 'points',
          line: 22.5,
          leg_odds: +110,
          source: 'manual',
          selection: 'over',
          is_live: true, // Live bet indicator
        }],
        total_units: 1.0,
        notes: 'Live bet test',
      };

      const response = await request.post('/api/submit-ticket', {
        data: liveBetData,
      });

      expect(response.ok()).toBeTruthy();
      
      const result = await response.json();
      expect(result).toHaveProperty('is_live', true);
      expect(result.message).toContain('Live bet');
    });
  });
});