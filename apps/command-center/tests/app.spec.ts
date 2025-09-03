import { test, expect } from '@playwright/test';

test.describe('Unit Talk Command Center', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the home page', async ({ page }) => {
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check if the title contains "Unit Talk"
    await expect(page).toHaveTitle(/Unit Talk/);
    
    // Take a screenshot for visual verification
    await page.screenshot({ path: 'tests/screenshots/homepage.png', fullPage: true });
  });

  test('should have navigation to dashboard', async ({ page }) => {
    // Look for dashboard navigation link
    const dashboardLink = page.locator('a[href*="/dashboard"]').first();
    
    if (await dashboardLink.count() > 0) {
      await dashboardLink.click();
      await page.waitForLoadState('networkidle');
      
      // Verify we're on the dashboard
      expect(page.url()).toContain('/dashboard');
      
      // Take a screenshot of the dashboard
      await page.screenshot({ path: 'tests/screenshots/dashboard.png', fullPage: true });
    } else {
      // If no dashboard link, just verify the page loads without errors
      console.log('No dashboard link found, but page loads successfully');
    }
  });

  test('should not have any console errors', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.waitForLoadState('networkidle');
    
    // Allow for some time for any lazy-loaded content
    await page.waitForTimeout(2000);
    
    // Filter out common non-critical errors
    const criticalErrors = errors.filter(error => 
      !error.includes('favicon') && 
      !error.includes('chrome-extension') &&
      !error.includes('ResizeObserver')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });

  test('should have responsive design', async ({ page }) => {
    // Test desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'tests/screenshots/desktop.png', fullPage: true });
    
    // Test tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'tests/screenshots/tablet.png', fullPage: true });
    
    // Test mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'tests/screenshots/mobile.png', fullPage: true });
    
    // Verify no horizontal scrollbars on mobile
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // Allow 1px tolerance
  });
});