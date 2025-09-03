import { test, expect } from '@playwright/test';

test('Basic connection test', async ({ page }) => {
  console.log('Starting basic connection test...');

  try {
    // Navigate to the smart form
    await page.goto('/submit-ticket', { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');

    // Check if the page loaded successfully
    const title = await page.title();
    console.log('Page title:', title);

    // Take a screenshot for verification
    await page.screenshot({ path: 'basic-connection-test.png', fullPage: true });

    // Verify basic page structure
    const body = page.locator('body');
    await expect(body).toBeVisible();

    console.log('✅ Basic connection test passed');
  } catch (error) {
    console.error('❌ Basic connection test failed:', error);
    await page.screenshot({ path: 'connection-error.png', fullPage: true });
    throw error;
  }
});
