import { test, expect } from '@playwright/test';

/**
 * V3.0.0 Performance and Error Handling Tests
 *
 * Tests Smart Form performance with v3.0.0 unified tables and handles error scenarios:
 * - API response times with large datasets
 * - Error handling for missing data
 * - Network failure resilience
 * - Form validation edge cases
 */

test.describe('Smart Form V3.0.0 Performance and Error Handling', () => {
  test('API performance with v3.0.0 unified tables', async ({ page }) => {
    console.log('⚡ Testing API performance with unified tables...');

    await page.goto('/submit-ticket');

    // Track navigation performance
    const navigationStart = Date.now();

    // Navigate to game selection to trigger multiple API calls
    await page.selectOption('[data-testid="capper-selector"]', { index: 1 });
    await page.selectOption('[data-testid="sport-selector"]', 'MLB');
    await page.selectOption('[data-testid="ticket-type-selector"]', 'single');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await page.fill('[data-testid="game-date-input"]', tomorrow.toISOString().split('T')[0]);
    await page.click('[data-testid="next-button"]');

    await page.fill('[data-testid="unit-size-input"]', '2.5');
    await page.fill('[data-testid="confidence-slider"]', '5');
    await page.click('[data-testid="next-button"]');

    await page.selectOption('[data-testid="bet-type-selector"]', 'player_props');
    await page.selectOption('[data-testid="market-type-selector"]', 'over');

    const apiCallStart = Date.now();
    await page.click('[data-testid="next-button"]');

    // Wait for games to load and measure performance
    await page.waitForSelector('[data-testid="games-loading"]', {
      state: 'detached',
      timeout: 15000,
    });
    const gamesLoadTime = Date.now() - apiCallStart;

    console.log(`📊 Games API Load Time: ${gamesLoadTime}ms`);
    expect(gamesLoadTime).toBeLessThan(5000); // Should load within 5 seconds

    // Test props loading performance
    const gameCards = page.locator('[data-testid^="game-card-"]');
    if ((await gameCards.count()) > 0) {
      const propsLoadStart = Date.now();
      await gameCards.first().click();

      await page.waitForSelector('[data-testid="props-loading"]', {
        state: 'detached',
        timeout: 15000,
      });
      const propsLoadTime = Date.now() - propsLoadStart;

      console.log(`🎯 Props API Load Time: ${propsLoadTime}ms`);
      expect(propsLoadTime).toBeLessThan(3000); // Props should load within 3 seconds
    }

    const totalTime = Date.now() - navigationStart;
    console.log(`⚡ Total Navigation Time: ${totalTime}ms`);

    console.log('✅ Performance test completed within acceptable thresholds');
  });

  test('Error handling for missing game data', async ({ page }) => {
    console.log('❌ Testing error handling for missing game data...');

    await page.goto('/submit-ticket');

    // Navigate to game selection with a date that has no games
    await page.selectOption('[data-testid="capper-selector"]', { index: 1 });
    await page.selectOption('[data-testid="sport-selector"]', 'MLB');
    await page.selectOption('[data-testid="ticket-type-selector"]', 'single');

    // Use a date far in the future where no games are scheduled
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 365); // One year from now
    await page.fill('[data-testid="game-date-input"]', futureDate.toISOString().split('T')[0]);

    await page.click('[data-testid="next-button"]');
    await page.fill('[data-testid="unit-size-input"]', '2.5');
    await page.fill('[data-testid="confidence-slider"]', '5');
    await page.click('[data-testid="next-button"]');

    await page.selectOption('[data-testid="bet-type-selector"]', 'player_props');
    await page.selectOption('[data-testid="market-type-selector"]', 'over');
    await page.click('[data-testid="next-button"]');

    // Wait for games loading to complete
    await page.waitForSelector('[data-testid="games-loading"]', {
      state: 'detached',
      timeout: 15000,
    });

    // Should show "no games" message
    const noGamesMessage = page.locator('[data-testid="no-games-message"]');
    await expect(noGamesMessage).toBeVisible({ timeout: 5000 });
    await expect(noGamesMessage).toContainText(/no games|not available/i);

    // Submit button should be disabled
    const submitButton = page.locator('[data-testid="submit-button"]');
    await expect(submitButton).toBeDisabled();

    console.log('✅ No games error handling working correctly');
  });

  test('Error handling for network failures', async ({ page, context }) => {
    console.log('🌐 Testing network failure error handling...');

    await page.goto('/submit-ticket');

    // Navigate to step where API calls happen
    await page.selectOption('[data-testid="capper-selector"]', { index: 1 });
    await page.selectOption('[data-testid="sport-selector"]', 'MLB');
    await page.selectOption('[data-testid="ticket-type-selector"]', 'single');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await page.fill('[data-testid="game-date-input"]', tomorrow.toISOString().split('T')[0]);
    await page.click('[data-testid="next-button"]');

    await page.fill('[data-testid="unit-size-input"]', '2.5');
    await page.fill('[data-testid="confidence-slider"]', '5');
    await page.click('[data-testid="next-button"]');

    await page.selectOption('[data-testid="bet-type-selector"]', 'player_props');
    await page.selectOption('[data-testid="market-type-selector"]', 'over');

    // Block network requests to simulate failure
    await context.route('**/api/games**', route => {
      route.abort('failed');
    });

    await page.click('[data-testid="next-button"]');

    // Should show error message for failed games loading
    const errorMessage = page.locator('[data-testid="games-error-message"]');
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
    await expect(errorMessage).toContainText(/error|failed|unavailable/i);

    // Should show retry button
    const retryButton = page.locator('[data-testid="retry-games-button"]');
    await expect(retryButton).toBeVisible();

    console.log('✅ Network failure error handling working correctly');
  });

  test('Form validation edge cases', async ({ page }) => {
    console.log('🛡️ Testing form validation edge cases...');

    await page.goto('/submit-ticket');

    // Test invalid date (past date)
    await page.selectOption('[data-testid="capper-selector"]', { index: 1 });
    await page.selectOption('[data-testid="sport-selector"]', 'MLB');
    await page.selectOption('[data-testid="ticket-type-selector"]', 'single');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await page.fill('[data-testid="game-date-input"]', yesterday.toISOString().split('T')[0]);

    await page.click('[data-testid="next-button"]');

    // Should show validation error for past date
    await expect(page.locator('[data-testid="game-date-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="game-date-error"]')).toContainText(
      /past|cannot select/i
    );

    // Fix date and continue
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await page.fill('[data-testid="game-date-input"]', tomorrow.toISOString().split('T')[0]);
    await page.click('[data-testid="next-button"]');

    // Test invalid unit size values
    await page.fill('[data-testid="unit-size-input"]', '0'); // Too low
    await page.click('[data-testid="next-button"]');
    await expect(page.locator('[data-testid="unit-size-error"]')).toContainText(/between/i);

    await page.fill('[data-testid="unit-size-input"]', '10'); // Too high
    await page.click('[data-testid="next-button"]');
    await expect(page.locator('[data-testid="unit-size-error"]')).toContainText(/between/i);

    await page.fill('[data-testid="unit-size-input"]', 'abc'); // Not a number
    await page.click('[data-testid="next-button"]');
    await expect(page.locator('[data-testid="unit-size-error"]')).toContainText(/number|invalid/i);

    // Test confidence level edge cases
    await page.fill('[data-testid="unit-size-input"]', '2.5');
    await page.fill('[data-testid="confidence-slider"]', '0'); // Too low
    await page.click('[data-testid="next-button"]');
    await expect(page.locator('[data-testid="confidence-error"]')).toContainText(
      /between 1 and 10/i
    );

    await page.fill('[data-testid="confidence-slider"]', '11'); // Too high
    await page.click('[data-testid="next-button"]');
    await expect(page.locator('[data-testid="confidence-error"]')).toContainText(
      /between 1 and 10/i
    );

    console.log('✅ Form validation edge cases handled correctly');
  });

  test('Submission error handling and recovery', async ({ page, context }) => {
    console.log('💾 Testing submission error handling...');

    await page.goto('/submit-ticket');

    // Complete form normally
    await page.selectOption('[data-testid="capper-selector"]', { index: 1 });
    await page.selectOption('[data-testid="sport-selector"]', 'MLB');
    await page.selectOption('[data-testid="ticket-type-selector"]', 'single');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await page.fill('[data-testid="game-date-input"]', tomorrow.toISOString().split('T')[0]);
    await page.click('[data-testid="next-button"]');

    await page.fill('[data-testid="unit-size-input"]', '2.5');
    await page.fill('[data-testid="confidence-slider"]', '5');
    await page.click('[data-testid="next-button"]');

    await page.selectOption('[data-testid="bet-type-selector"]', 'player_props');
    await page.selectOption('[data-testid="market-type-selector"]', 'over');
    await page.click('[data-testid="next-button"]');

    // Wait for games and select one
    await page.waitForSelector('[data-testid="games-loading"]', {
      state: 'detached',
      timeout: 15000,
    });
    const gameCards = page.locator('[data-testid^="game-card-"]');

    if ((await gameCards.count()) > 0) {
      await gameCards.first().click();

      await page.waitForSelector('[data-testid="props-loading"]', {
        state: 'detached',
        timeout: 15000,
      });
      const propCards = page.locator('[data-testid^="prop-card-"]');

      if ((await propCards.count()) > 0) {
        await propCards.first().click();

        // Block submission API to simulate failure
        await context.route('**/api/submit-ticket**', route => {
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Internal server error',
              details: 'Database connection failed',
            }),
          });
        });

        // Attempt submission
        const submitButton = page.locator('[data-testid="submit-button"]');
        await submitButton.click();

        // Should show error message
        const errorMessage = page.locator('[data-testid="submission-error"]');
        await expect(errorMessage).toBeVisible({ timeout: 10000 });
        await expect(errorMessage).toContainText(/error|failed/i);

        // Submit button should be re-enabled for retry
        await expect(submitButton).toBeEnabled();

        // Form data should be preserved (not reset on error)
        await expect(page.locator('[data-testid="unit-size-input"]')).toHaveValue('2.5');

        console.log('✅ Submission error handling working correctly');
        console.log('✅ Form data preserved after submission error');
      }
    }
  });

  test('Large dataset performance (stress test)', async ({ page }) => {
    console.log('🏋️ Testing performance with large dataset...');

    await page.goto('/submit-ticket');

    // Navigate to game selection
    await page.selectOption('[data-testid="capper-selector"]', { index: 1 });
    await page.selectOption('[data-testid="sport-selector"]', 'MLB');
    await page.selectOption('[data-testid="ticket-type-selector"]', 'single');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await page.fill('[data-testid="game-date-input"]', tomorrow.toISOString().split('T')[0]);
    await page.click('[data-testid="next-button"]');

    await page.fill('[data-testid="unit-size-input"]', '2.5');
    await page.fill('[data-testid="confidence-slider"]', '5');
    await page.click('[data-testid="next-button"]');

    await page.selectOption('[data-testid="bet-type-selector"]', 'player_props');
    await page.selectOption('[data-testid="market-type-selector"]', 'over');

    // Measure time for large dataset loading
    const startTime = Date.now();
    await page.click('[data-testid="next-button"]');

    await page.waitForSelector('[data-testid="games-loading"]', {
      state: 'detached',
      timeout: 30000,
    });
    const loadTime = Date.now() - startTime;

    console.log(`📊 Large dataset load time: ${loadTime}ms`);

    // Count loaded items
    const gameCount = await page.locator('[data-testid^="game-card-"]').count();
    console.log(`🏟️ Loaded ${gameCount} games`);

    if (gameCount > 0) {
      // Test scrolling performance with large lists
      const gamesContainer = page.locator('[data-testid="games-container"]');

      const scrollStart = Date.now();
      await gamesContainer.hover();
      await page.mouse.wheel(0, 1000); // Scroll down
      await page.waitForTimeout(100);
      await page.mouse.wheel(0, -1000); // Scroll back up
      const scrollTime = Date.now() - scrollStart;

      console.log(`🖱️ Scroll performance: ${scrollTime}ms`);
      expect(scrollTime).toBeLessThan(1000); // Should scroll smoothly
    }

    // Performance should be acceptable even with large datasets
    expect(loadTime).toBeLessThan(15000); // 15 second timeout for large datasets

    console.log('✅ Large dataset performance test completed');
  });

  test('Concurrent user simulation', async ({ browser }) => {
    console.log('👥 Testing concurrent user scenarios...');

    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]);

    const pages = await Promise.all(contexts.map(context => context.newPage()));

    // Simulate multiple users accessing the form simultaneously
    const startTime = Date.now();

    await Promise.all(
      pages.map(async (page, index) => {
        await page.goto('/submit-ticket');

        // Each user selects slightly different options
        await page.selectOption('[data-testid="capper-selector"]', { index: 1 });
        await page.selectOption('[data-testid="sport-selector"]', 'MLB');
        await page.selectOption(
          '[data-testid="ticket-type-selector"]',
          index % 2 === 0 ? 'single' : 'parlay'
        );

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        await page.fill('[data-testid="game-date-input"]', tomorrow.toISOString().split('T')[0]);
        await page.click('[data-testid="next-button"]');

        await page.fill('[data-testid="unit-size-input"]', `${2 + index}`);
        await page.fill('[data-testid="confidence-slider"]', `${5 + index}`);
      })
    );

    const concurrentLoadTime = Date.now() - startTime;
    console.log(`👥 Concurrent load time: ${concurrentLoadTime}ms`);

    // Clean up
    await Promise.all(contexts.map(context => context.close()));

    // Should handle concurrent users without significant performance degradation
    expect(concurrentLoadTime).toBeLessThan(10000);

    console.log('✅ Concurrent user test completed successfully');
  });
});
