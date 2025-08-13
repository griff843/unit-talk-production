import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_KEY || 'test-service-key'
);

test.describe('Frontend Shadow Mode vs Live Mode', () => {
  test.beforeEach(async ({ page }) => {
    // Set up test environment
    await page.goto(process.env.FRONTEND_URL || 'http://localhost:3000');
  });

  test('SHADOW_MODE displays warning banner', async ({ page }) => {
    // Enable shadow mode
    await page.evaluate(() => {
      localStorage.setItem('SHADOW_MODE', 'true');
    });
    await page.reload();

    // Verify shadow mode banner is visible
    const banner = page.locator('[data-testid="shadow-mode-banner"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('SHADOW MODE');
    await expect(banner).toHaveCSS('background-color', 'rgb(254, 243, 199)'); // Yellow warning
  });

  test('Live mode hides shadow banner', async ({ page }) => {
    // Disable shadow mode
    await page.evaluate(() => {
      localStorage.setItem('SHADOW_MODE', 'false');
    });
    await page.reload();

    // Verify shadow mode banner is NOT visible
    const banner = page.locator('[data-testid="shadow-mode-banner"]');
    await expect(banner).not.toBeVisible();
  });

  test('Shadow mode prevents Discord publishing', async ({ page }) => {
    // Enable shadow mode
    await page.evaluate(() => {
      localStorage.setItem('SHADOW_MODE', 'true');
    });
    await page.reload();

    // Try to publish a pick
    await page.click('[data-testid="publish-pick-btn"]');
    
    // Verify confirmation dialog shows shadow mode warning
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toContainText('Shadow Mode Active');
    await expect(dialog).toContainText('This action will NOT publish to Discord');
  });

  test('Live mode shows Discord publish confirmation', async ({ page }) => {
    // Disable shadow mode
    await page.evaluate(() => {
      localStorage.setItem('SHADOW_MODE', 'false');
    });
    await page.reload();

    // Try to publish a pick
    await page.click('[data-testid="publish-pick-btn"]');
    
    // Verify confirmation dialog shows live publish warning
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toContainText('Publish to Discord');
    await expect(dialog).toContainText('This will be published to all Discord channels');
  });

  test('Dashboard shows correct mode indicator', async ({ page }) => {
    // Test shadow mode
    await page.evaluate(() => {
      localStorage.setItem('SHADOW_MODE', 'true');
    });
    await page.reload();
    
    const shadowIndicator = page.locator('[data-testid="mode-indicator"]');
    await expect(shadowIndicator).toContainText('SHADOW');
    await expect(shadowIndicator).toHaveCSS('color', 'rgb(245, 158, 11)'); // Amber

    // Test live mode
    await page.evaluate(() => {
      localStorage.setItem('SHADOW_MODE', 'false');
    });
    await page.reload();
    
    const liveIndicator = page.locator('[data-testid="mode-indicator"]');
    await expect(liveIndicator).toContainText('LIVE');
    await expect(liveIndicator).toHaveCSS('color', 'rgb(34, 197, 94)'); // Green
  });

  test('Command center reflects shadow mode state', async ({ page }) => {
    await page.goto(process.env.COMMAND_CENTER_URL || 'http://localhost:3001');

    // Check shadow mode
    await page.evaluate(() => {
      localStorage.setItem('SHADOW_MODE', 'true');
    });
    await page.reload();

    const eventStream = page.locator('[data-testid="event-stream"]');
    await expect(eventStream).toContainText('[SHADOW]');

    // Check live mode
    await page.evaluate(() => {
      localStorage.setItem('SHADOW_MODE', 'false');
    });
    await page.reload();

    await expect(eventStream).not.toContainText('[SHADOW]');
  });

  test('API requests include shadow mode header', async ({ page }) => {
    let shadowHeaderValue: string | null = null;

    // Intercept API requests
    await page.route('**/api/**', async (route, request) => {
      shadowHeaderValue = request.headers()['x-shadow-mode'] || null;
      await route.continue();
    });

    // Enable shadow mode and make request
    await page.evaluate(() => {
      localStorage.setItem('SHADOW_MODE', 'true');
    });
    await page.reload();
    await page.click('[data-testid="refresh-data"]');

    expect(shadowHeaderValue).toBe('true');

    // Disable shadow mode and make request
    await page.evaluate(() => {
      localStorage.setItem('SHADOW_MODE', 'false');
    });
    await page.reload();
    await page.click('[data-testid="refresh-data"]');

    expect(shadowHeaderValue).toBe('false');
  });

  test('Grading results show shadow watermark', async ({ page }) => {
    // Enable shadow mode
    await page.evaluate(() => {
      localStorage.setItem('SHADOW_MODE', 'true');
    });
    await page.reload();

    // Navigate to grading results
    await page.goto(`${process.env.FRONTEND_URL}/grading`);

    // Check for shadow watermark on graded picks
    const gradedPicks = page.locator('[data-testid="graded-pick"]');
    const firstPick = gradedPicks.first();
    
    await expect(firstPick).toHaveAttribute('data-shadow', 'true');
    const watermark = firstPick.locator('.shadow-watermark');
    await expect(watermark).toBeVisible();
    await expect(watermark).toHaveCSS('opacity', '0.3');
  });

  test('Settlement preview shows shadow mode warning', async ({ page }) => {
    // Enable shadow mode
    await page.evaluate(() => {
      localStorage.setItem('SHADOW_MODE', 'true');
    });
    
    // Navigate to settlement preview
    await page.goto(`${process.env.FRONTEND_URL}/settlement`);

    // Verify shadow mode warning
    const warning = page.locator('[data-testid="settlement-warning"]');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('Shadow Mode - No actual settlements will occur');
    
    // Verify settle button is disabled or shows warning
    const settleBtn = page.locator('[data-testid="settle-btn"]');
    await expect(settleBtn).toHaveAttribute('data-shadow', 'true');
  });

  test('Analytics dashboard filters shadow data', async ({ page }) => {
    // Navigate to analytics
    await page.goto(`${process.env.FRONTEND_URL}/analytics`);

    // Enable shadow mode filter
    await page.click('[data-testid="include-shadow-toggle"]');
    
    // Verify data includes shadow indicator
    const dataPoints = page.locator('[data-testid="analytics-data-point"]');
    const shadowPoints = dataPoints.filter({ hasText: '[S]' });
    
    expect(await shadowPoints.count()).toBeGreaterThan(0);

    // Disable shadow mode filter
    await page.click('[data-testid="include-shadow-toggle"]');
    
    // Verify shadow data is excluded
    const filteredPoints = page.locator('[data-testid="analytics-data-point"]');
    const noShadowPoints = filteredPoints.filter({ hasText: '[S]' });
    
    expect(await noShadowPoints.count()).toBe(0);
  });

  test('User preferences persist shadow mode setting', async ({ page, context }) => {
    // Set shadow mode preference
    await page.goto(`${process.env.FRONTEND_URL}/settings`);
    await page.click('[data-testid="shadow-mode-preference"]');
    await page.selectOption('[data-testid="shadow-mode-preference"]', 'true');
    await page.click('[data-testid="save-preferences"]');

    // Open new page and verify persistence
    const newPage = await context.newPage();
    await newPage.goto(process.env.FRONTEND_URL || 'http://localhost:3000');
    
    const banner = newPage.locator('[data-testid="shadow-mode-banner"]');
    await expect(banner).toBeVisible();
  });

  test('Mobile view shows compact shadow indicator', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Enable shadow mode
    await page.evaluate(() => {
      localStorage.setItem('SHADOW_MODE', 'true');
    });
    await page.reload();

    // Check for mobile-optimized shadow indicator
    const mobileIndicator = page.locator('[data-testid="mobile-shadow-indicator"]');
    await expect(mobileIndicator).toBeVisible();
    await expect(mobileIndicator).toHaveCSS('position', 'fixed');
    await expect(mobileIndicator).toHaveCSS('z-index', '9999');
  });
});

test.describe('Frontend Performance in Different Modes', () => {
  test('Shadow mode loads faster with cached data', async ({ page }) => {
    // Measure shadow mode load time
    await page.evaluate(() => {
      localStorage.setItem('SHADOW_MODE', 'true');
    });
    
    const shadowStart = Date.now();
    await page.goto(process.env.FRONTEND_URL || 'http://localhost:3000');
    await page.waitForLoadState('networkidle');
    const shadowLoadTime = Date.now() - shadowStart;

    // Measure live mode load time
    await page.evaluate(() => {
      localStorage.setItem('SHADOW_MODE', 'false');
    });
    
    const liveStart = Date.now();
    await page.reload();
    await page.waitForLoadState('networkidle');
    const liveLoadTime = Date.now() - liveStart;

    // Shadow mode should be similar or faster (uses same data sources)
    expect(Math.abs(shadowLoadTime - liveLoadTime)).toBeLessThan(1000);
  });

  test('WebSocket connections respect shadow mode', async ({ page }) => {
    // Monitor WebSocket connections
    const wsConnections: string[] = [];
    
    page.on('websocket', ws => {
      wsConnections.push(ws.url());
    });

    // Enable shadow mode
    await page.evaluate(() => {
      localStorage.setItem('SHADOW_MODE', 'true');
    });
    await page.goto(process.env.FRONTEND_URL || 'http://localhost:3000');
    
    // Verify WebSocket includes shadow parameter
    const shadowWs = wsConnections.find(url => url.includes('shadow=true'));
    expect(shadowWs).toBeTruthy();
  });
});

test.describe('Frontend Error Handling', () => {
  test('Shows appropriate error when mode detection fails', async ({ page }) => {
    // Corrupt the shadow mode setting
    await page.evaluate(() => {
      localStorage.setItem('SHADOW_MODE', 'invalid_value');
    });
    
    await page.goto(process.env.FRONTEND_URL || 'http://localhost:3000');
    
    // Should default to shadow mode for safety
    const banner = page.locator('[data-testid="shadow-mode-banner"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Shadow Mode (Default)');
  });

  test('Handles mode switch during active operations', async ({ page }) => {
    await page.goto(process.env.FRONTEND_URL || 'http://localhost:3000');
    
    // Start an operation in shadow mode
    await page.evaluate(() => {
      localStorage.setItem('SHADOW_MODE', 'true');
    });
    await page.reload();
    
    // Begin grading operation
    const gradingPromise = page.click('[data-testid="start-grading"]');
    
    // Switch to live mode mid-operation
    await page.evaluate(() => {
      localStorage.setItem('SHADOW_MODE', 'false');
    });
    
    // Operation should complete with warning
    await gradingPromise;
    
    const warning = page.locator('[data-testid="mode-switch-warning"]');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('Mode changed during operation');
  });
});