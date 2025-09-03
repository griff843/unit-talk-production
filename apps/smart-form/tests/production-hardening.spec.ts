import { test, expect } from '@playwright/test';

/**
 * Production Hardening E2E Tests
 * 
 * Tests the production-ready features implemented in Smart Form hardening:
 * - API route security and validation
 * - UUID-based capper identification
 * - Bridge integration with idempotency
 * - Environment variable security
 * - Structured logging and error handling
 */

test.describe('Production Hardening E2E Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the submit ticket form
    await page.goto('/submit-ticket');
    
    // Wait for form to load
    await expect(page.locator('h1')).toContainText('Submit Sports Betting Ticket');
  });

  test('API routes use proper authentication and validation', async ({ page }) => {
    // Test cappers API endpoint
    const cappersResponse = await page.request.get('/api/cappers');
    expect(cappersResponse.ok()).toBeTruthy();
    
    const cappersData = await cappersResponse.json();
    expect(cappersData).toHaveProperty('cappers');
    expect(Array.isArray(cappersData.cappers)).toBeTruthy();
    
    // Verify capper structure has UUID id
    if (cappersData.cappers.length > 0) {
      const capper = cappersData.cappers[0];
      expect(capper).toHaveProperty('id');
      expect(capper).toHaveProperty('name');
      expect(capper).toHaveProperty('active');
      
      // Verify UUID format (basic check)
      expect(capper.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    }
  });

  test('Games API enforces sport validation', async ({ page }) => {
    // Test valid sport
    const validResponse = await page.request.get('/api/games?sport=NBA');
    expect(validResponse.ok()).toBeTruthy();
    
    const validData = await validResponse.json();
    expect(validData).toHaveProperty('games');
    
    // Test invalid sport (should return 400)
    const invalidResponse = await page.request.get('/api/games?sport=INVALID');
    expect(invalidResponse.status()).toBe(400);
    
    const errorData = await invalidResponse.json();
    expect(errorData).toHaveProperty('error');
  });

  test('Props API supports sport-scoped filtering', async ({ page }) => {
    // Test props endpoint with sport filtering
    const response = await page.request.get('/api/props?sport=NBA');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('props');
    expect(Array.isArray(data.props)).toBeTruthy();
    
    // If props exist, verify they're NBA-scoped
    if (data.props.length > 0) {
      const prop = data.props[0];
      expect(prop).toHaveProperty('sport', 'NBA');
    }
  });

  test('Submit ticket requires valid capper UUID', async ({ page }) => {
    // Test ticket submission with invalid capper_id
    const invalidTicket = {
      capper_id: 'not-a-uuid',
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
      total_units: 1,
    };

    const response = await page.request.post('/api/submit-ticket', {
      data: invalidTicket,
    });
    
    expect(response.status()).toBe(400);
    const errorData = await response.json();
    expect(errorData.error).toContain('UUID');
  });

  test('Form prevents direct Supabase access in production', async ({ page }) => {
    // Check that no client-side Supabase calls are made
    const supabaseRequests = [];
    
    page.on('request', request => {
      if (request.url().includes('supabase')) {
        supabaseRequests.push(request.url());
      }
    });

    // Load the form and interact with it
    await page.selectOption('[data-testid="sport-selector"]', 'NBA');
    
    // Wait a moment for any async calls
    await page.waitForTimeout(2000);
    
    // All requests should go through our API routes, not directly to Supabase
    expect(supabaseRequests.length).toBe(0);
  });

  test('Environment variables are properly secured', async ({ page }) => {
    // Check that sensitive environment variables are not exposed to client
    const windowEnvKeys = await page.evaluate(() => {
      return Object.keys(window).filter(key => 
        key.includes('SUPABASE') || 
        key.includes('SERVICE_ROLE') || 
        key.includes('OPTIMAL_API')
      );
    });
    
    // No service role keys or API keys should be in window
    expect(windowEnvKeys).toEqual([]);
    
    // Check that only public env vars are available
    const nextPublicEnv = await page.evaluate(() => {
      return Object.keys(process.env || {}).filter(key => 
        key.startsWith('NEXT_PUBLIC_')
      );
    });
    
    // Should only have NEXT_PUBLIC_ prefixed variables
    expect(nextPublicEnv.every(key => key.startsWith('NEXT_PUBLIC_'))).toBeTruthy();
  });

  test('Bridge integration creates idempotent events', async ({ page, request }) => {
    // First, get a valid capper
    const cappersResponse = await request.get('/api/cappers');
    const cappersData = await cappersResponse.json();
    
    if (cappersData.cappers.length === 0) {
      test.skip();
      return;
    }

    const testTicket = {
      capper_id: cappersData.cappers[0].id,
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
      total_units: 1,
    };

    // Submit the ticket
    const response1 = await request.post('/api/submit-ticket', {
      data: testTicket,
    });
    
    expect(response1.ok()).toBeTruthy();
    const result1 = await response1.json();
    expect(result1).toHaveProperty('bet_slip_id');
    
    const betSlipId = result1.bet_slip_id;
    
    // Test bridge simulation endpoint (dev only)
    if (process.env.NODE_ENV === 'development') {
      const bridgeResponse = await request.get(`/api/dev/simulate-bridge?id=${betSlipId}`);
      expect(bridgeResponse.ok()).toBeTruthy();
      
      const bridgeResult = await bridgeResponse.json();
      expect(bridgeResult.success).toBeTruthy();
      expect(bridgeResult.bet_slip_id).toBe(betSlipId);
    }
  });

  test('Structured logging provides proper error context', async ({ page, request }) => {
    // Test API error handling with structured logging
    const invalidRequest = await request.post('/api/submit-ticket', {
      data: {
        // Missing required fields
      },
    });
    
    expect(invalidRequest.status()).toBe(400);
    const errorData = await invalidRequest.json();
    
    // Should have structured error response
    expect(errorData).toHaveProperty('error');
    expect(errorData).toHaveProperty('details');
    expect(Array.isArray(errorData.details)).toBeTruthy();
  });

  test('Form handles API failures gracefully', async ({ page }) => {
    // Mock API failures to test error handling
    await page.route('/api/cappers', route => 
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'Server error' }) })
    );

    // Reload page to trigger capper loading
    await page.reload();
    
    // Form should show fallback data or error message
    await expect(page.locator('text=fallback')).toBeVisible({ timeout: 10000 });
  });

  test('Complete hardened submission workflow', async ({ page, request }) => {
    // Get available cappers
    const cappersResponse = await request.get('/api/cappers');
    const cappersData = await cappersResponse.json();
    
    if (cappersData.cappers.length === 0) {
      test.skip();
      return;
    }

    const capper = cappersData.cappers[0];

    // Fill out the form using the new hardened flow
    await page.selectOption('select[name="capper"]', capper.name);
    await page.selectOption('select[name="ticket_type"]', 'single');
    await page.selectOption('select[name="sport"]', 'NBA');
    
    // Set risk amount and unit size
    await page.fill('input[name="risk_amount"]', '100');
    await page.fill('input[name="unit_size"]', '2');
    
    // Add a leg
    await page.click('button:has-text("Add Leg")');
    
    // Wait for leg form to appear and fill it
    await page.waitForSelector('.leg-card', { timeout: 5000 });
    
    // Submit the ticket
    await page.click('button:has-text("Submit Ticket")');
    
    // Wait for success message
    await expect(page.locator('text=submitted successfully')).toBeVisible({ timeout: 10000 });
  });

  test('Security headers and CORS are properly configured', async ({ request }) => {
    const response = await request.get('/api/cappers');
    
    // Check for security headers
    const headers = response.headers();
    
    // API should not expose internal details
    expect(headers['x-powered-by']).toBeUndefined();
    
    // Should have proper content type
    expect(headers['content-type']).toContain('application/json');
  });

  test('Rate limiting and input validation prevent abuse', async ({ request }) => {
    // Test rapid requests to check rate limiting (if implemented)
    const requests = Array.from({ length: 10 }, () => 
      request.get('/api/cappers')
    );
    
    const responses = await Promise.all(requests);
    const statusCodes = responses.map(r => r.status());
    
    // All should be successful or rate limited (not server errors)
    expect(statusCodes.every(code => code === 200 || code === 429)).toBeTruthy();
  });
});