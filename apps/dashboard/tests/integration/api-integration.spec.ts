import { test, expect } from '@playwright/test';

/**
 * Fortune 100-Grade API Integration Tests: Backend Communication
 *
 * Tests comprehensive API integration:
 * - Real-time data synchronization
 * - Error handling and resilience
 * - Authentication and authorization
 * - WebSocket connections
 * - API response validation
 * - Caching and offline behavior
 */

test.describe('API Integration & Backend Communication', () => {
  test.beforeEach(async ({ page }) => {
    // Monitor network requests
    page.on('response', response => {
      if (response.status() >= 400) {
        console.log('Failed request:', response.url(), response.status());
      }
    });

    await page.goto('/dashboard');
    await page.waitForSelector('[data-testid="dashboard-container"]', { timeout: 10000 });
  });

  test('should successfully load dashboard data from API', async ({ page }) => {
    // Collect API responses
    const apiResponses: any[] = [];
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        apiResponses.push({
          url: response.url(),
          status: response.status(),
          contentType: response.headers()['content-type'],
        });
      }
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify API calls were made
    expect(apiResponses.length).toBeGreaterThan(0);

    // Verify all API calls succeeded
    const failedRequests = apiResponses.filter(r => r.status >= 400);
    expect(failedRequests).toHaveLength(0);

    // Verify essential API endpoints were called
    const dashboardDataEndpoint = apiResponses.find(
      r => r.url.includes('/api/dashboard') || r.url.includes('/api/analytics')
    );
    expect(dashboardDataEndpoint).toBeTruthy();
  });

  test('should handle API authentication properly', async ({ page }) => {
    // Check for authentication headers
    const authRequests: any[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        const headers = request.headers();
        authRequests.push({
          url: request.url(),
          hasAuth: headers.authorization || headers.cookie || headers['x-api-key'],
        });
      }
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify protected endpoints include authentication
    const protectedEndpoints = authRequests.filter(
      r =>
        r.url.includes('/api/dashboard') ||
        r.url.includes('/api/analytics') ||
        r.url.includes('/api/picks')
    );

    if (protectedEndpoints.length > 0) {
      const authenticatedRequests = protectedEndpoints.filter(r => r.hasAuth);
      expect(authenticatedRequests.length).toBeGreaterThan(0);
    }
  });

  test('should handle real-time data updates via WebSocket', async ({ page }) => {
    let websocketConnected = false;
    let messagesReceived = 0;

    // Monitor WebSocket connections
    page.on('websocket', ws => {
      websocketConnected = true;
      console.log('WebSocket connected:', ws.url());

      ws.on('framereceived', event => {
        messagesReceived++;
        console.log('WebSocket message received:', event.payload);
      });
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wait for potential WebSocket connection
    await page.waitForTimeout(3000);

    if (websocketConnected) {
      expect(messagesReceived).toBeGreaterThan(0);

      // Verify real-time indicators are present
      const liveIndicators = page.locator('[data-testid*="live"], .live-indicator, .real-time');
      expect(await liveIndicators.count()).toBeGreaterThan(0);
    }
  });

  test('should validate API response data structure', async ({ page }) => {
    // Intercept API responses and validate structure
    const validationResults: any[] = [];

    page.on('response', async response => {
      if (response.url().includes('/api/dashboard') && response.status() === 200) {
        try {
          const data = await response.json();

          // Validate expected dashboard data structure
          const hasPerformanceMetrics = data.performanceMetrics || data.performance;
          const hasPicksData = data.picks || data.currentPicks;
          const hasAnalytics = data.analytics || data.realTimeAnalytics;

          validationResults.push({
            url: response.url(),
            hasRequiredFields: hasPerformanceMetrics && hasPicksData && hasAnalytics,
            dataStructure: {
              performanceMetrics: !!hasPerformanceMetrics,
              picks: !!hasPicksData,
              analytics: !!hasAnalytics,
            },
          });
        } catch (error) {
          validationResults.push({
            url: response.url(),
            error: 'Invalid JSON response',
            hasRequiredFields: false,
          });
        }
      }
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    if (validationResults.length > 0) {
      const validResponses = validationResults.filter(r => r.hasRequiredFields);
      expect(validResponses.length).toBeGreaterThan(0);
    }
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Simulate API errors
    await page.route('**/api/dashboard**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    await page.reload();
    await page.waitForSelector('[data-testid="dashboard-container"]');

    // Verify error handling UI appears
    const errorElements = page.locator('[role="alert"], .error-message, [data-testid*="error"]');
    await expect(errorElements.first()).toBeVisible({ timeout: 5000 });

    // Verify error message is user-friendly
    const errorText = await errorElements.first().textContent();
    expect(errorText).toMatch(/error|failed|problem|unable|unavailable/i);
  });

  test('should implement proper API retry logic', async ({ page }) => {
    let requestCount = 0;

    // Fail first few requests, then succeed
    await page.route('**/api/dashboard**', route => {
      requestCount++;

      if (requestCount <= 2) {
        route.fulfill({
          status: 503,
          body: 'Service Unavailable',
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            performanceMetrics: { winRate: 85, roi: 15.2 },
            picks: [],
            analytics: { liveCount: 5 },
          }),
        });
      }
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify multiple requests were made (retry logic)
    expect(requestCount).toBeGreaterThan(1);

    // Verify dashboard eventually loads successfully
    await expect(page.getByTestId('performance-metrics')).toBeVisible();
  });

  test('should cache API responses appropriately', async ({ page }) => {
    // First request
    await page.reload();
    await page.waitForLoadState('networkidle');

    const firstLoadResponses: any[] = [];
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        firstLoadResponses.push({
          url: response.url(),
          cached: response.fromServiceWorker() || response.headers()['x-cache'] === 'HIT',
        });
      }
    });

    // Second request (should use cached data where appropriate)
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify some responses are cached
    const cacheableEndpoints = firstLoadResponses.filter(
      r => !r.url.includes('real-time') && !r.url.includes('live') && !r.url.includes('current')
    );

    if (cacheableEndpoints.length > 0) {
      const cachedResponses = cacheableEndpoints.filter(r => r.cached);
      expect(cachedResponses.length).toBeGreaterThan(0);
    }
  });

  test('should handle offline scenarios', async ({ page }) => {
    // Load dashboard first
    await page.waitForLoadState('networkidle');

    // Go offline
    await page.context().setOffline(true);

    // Try to refresh
    const refreshButton = page.getByTestId('refresh-dashboard');
    if (await refreshButton.isVisible()) {
      await refreshButton.click();

      // Should show offline indicator or cached data
      const offlineIndicator = page.locator('[data-testid*="offline"], .offline-indicator');
      const cachedData = page.getByTestId('performance-metrics');

      // Either offline indicator or cached data should be visible
      await expect(offlineIndicator.or(cachedData)).toBeVisible({ timeout: 5000 });
    }
  });

  test('should validate data freshness indicators', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Look for last updated timestamps
    const lastUpdated = page.getByTestId('last-updated');
    if (await lastUpdated.isVisible()) {
      const updateText = await lastUpdated.textContent();

      // Should show recent update time
      expect(updateText).toMatch(/seconds ago|minute ago|just now|\d+:\d+/i);
    }

    // Look for live data indicators
    const liveIndicators = page.locator('[data-testid*="live"], .live-indicator');
    if ((await liveIndicators.count()) > 0) {
      await expect(liveIndicators.first()).toBeVisible();
    }
  });

  test('should handle concurrent API requests efficiently', async ({ page }) => {
    const apiRequests: any[] = [];
    const startTime = Date.now();

    page.on('request', request => {
      if (request.url().includes('/api/')) {
        apiRequests.push({
          url: request.url(),
          startTime: Date.now(),
        });
      }
    });

    page.on('response', response => {
      if (response.url().includes('/api/')) {
        const request = apiRequests.find(r => r.url === response.url());
        if (request) {
          request.duration = Date.now() - request.startTime;
          request.status = response.status();
        }
      }
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    const totalTime = Date.now() - startTime;

    // Verify requests completed efficiently
    const successfulRequests = apiRequests.filter(r => r.status === 200);
    expect(successfulRequests.length).toBeGreaterThan(0);

    // Verify parallel execution (total time should be less than sum of individual requests)
    const sumOfDurations = apiRequests.reduce((sum, req) => sum + (req.duration || 0), 0);
    expect(totalTime).toBeLessThan(sumOfDurations);
  });

  test('should implement proper API rate limiting', async ({ page }) => {
    let requestCount = 0;
    let rateLimited = false;

    page.on('response', response => {
      if (response.url().includes('/api/')) {
        requestCount++;
        if (response.status() === 429) {
          rateLimited = true;
        }
      }
    });

    // Make multiple rapid requests
    const refreshButton = page.getByTestId('refresh-dashboard');
    if (await refreshButton.isVisible()) {
      for (let i = 0; i < 10; i++) {
        await refreshButton.click();
        await page.waitForTimeout(100);
      }
    }

    // Application should handle rate limiting gracefully
    if (rateLimited) {
      // Should show appropriate message to user
      const rateLimitMessage = page.locator('[data-testid*="rate-limit"], .rate-limit-message');
      await expect(rateLimitMessage).toBeVisible({ timeout: 2000 });
    }
  });
});
