import { test, expect } from '@playwright/test';

test('Command Center Loading Performance', async ({ page }) => {
  console.log('🔍 Starting performance test...');

  // Measure total page load time
  const startTime = Date.now();

  try {
    // Navigate with increased timeout
    console.log('📍 Navigating to localhost:3019...');
    await page.goto('http://localhost:3019', {
      waitUntil: 'networkidle',
      timeout: 60000, // 60 second timeout
    });

    const navigationTime = Date.now() - startTime;
    console.log(`⏱️ Navigation completed in: ${navigationTime}ms`);

    // Wait for the main title to be visible
    console.log('🔍 Waiting for main title...');
    await page.waitForSelector('h1:has-text("Unit Talk Command Center")', {
      timeout: 30000,
    });

    const titleTime = Date.now() - startTime;
    console.log(`📝 Title visible at: ${titleTime}ms`);

    // Wait for dashboard cards to load
    console.log('🔍 Waiting for dashboard cards...');
    await page.waitForSelector('[data-testid="metric-card"]', {
      timeout: 30000,
    });

    const cardsTime = Date.now() - startTime;
    console.log(`📊 Cards loaded at: ${cardsTime}ms`);

    // Check if we can see data or if it's still loading
    const loadingSpinners = await page.locator('div:has-text("Loading...")').count();
    const agentCards = await page.locator('[data-testid="metric-card"]').count();

    console.log(`🔄 Loading spinners found: ${loadingSpinners}`);
    console.log(`📊 Metric cards found: ${agentCards}`);

    // Take a screenshot for visual verification
    await page.screenshot({
      path: 'tests/screenshots/performance-test.png',
      fullPage: true,
    });
    console.log('📸 Screenshot saved');

    const totalTime = Date.now() - startTime;
    console.log(`✅ Total test time: ${totalTime}ms`);

    // Performance assertions
    expect(navigationTime).toBeLessThan(10000); // Should load within 10 seconds
    expect(titleTime).toBeLessThan(15000); // Title should appear within 15 seconds
    expect(cardsTime).toBeLessThan(20000); // Cards should load within 20 seconds

    console.log('✅ All performance checks passed!');
  } catch (error) {
    const errorTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Test failed after ${errorTime}ms:`, errorMessage);

    // Take screenshot on error
    try {
      await page.screenshot({
        path: 'tests/screenshots/performance-error.png',
        fullPage: true,
      });
      console.log('📸 Error screenshot saved');
    } catch (screenshotError) {
      const screenshotErrorMessage = screenshotError instanceof Error ? screenshotError.message : String(screenshotError);
      console.error('❌ Could not take error screenshot:', screenshotErrorMessage);
    }

    throw error;
  }
});
