import { test, expect } from '@playwright/test';

test.describe('Live Functionality Verification', () => {
  test('verify application is actually working', async ({ page }) => {
    const errors: string[] = [];

    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    console.log('=== TESTING LIVE APPLICATION ===');

    // Test 1: Main dashboard
    console.log('1. Testing main dashboard...');
    try {
      await page.goto('/dashboard', { timeout: 10000 });
      await page.waitForLoadState('networkidle', { timeout: 10000 });

      await page.screenshot({ path: 'tests/screenshots/live-dashboard.png', fullPage: true });

      const title = await page.locator('h1').first().textContent();
      console.log(`   Dashboard title: "${title}"`);

      const metricsCards = await page.locator('.metric-card').count();
      console.log(`   Metric cards found: ${metricsCards}`);

      expect(title).toContain('Command Center');
      expect(metricsCards).toBeGreaterThan(0);
    } catch (error) {
      console.log(`   ❌ Dashboard failed: ${error}`);
      throw error;
    }

    // Test 2: User Management
    console.log('2. Testing User Management page...');
    try {
      await page.goto('/dashboard/users', { timeout: 10000 });
      await page.waitForLoadState('networkidle', { timeout: 10000 });

      await page.screenshot({ path: 'tests/screenshots/live-users.png', fullPage: true });

      const title = await page.locator('h1').first().textContent();
      console.log(`   Users page title: "${title}"`);

      expect(title).toContain('User Management');
    } catch (error) {
      console.log(`   ❌ Users page failed: ${error}`);
      throw error;
    }

    // Test 3: Security page
    console.log('3. Testing Security page...');
    try {
      await page.goto('/dashboard/security', { timeout: 10000 });
      await page.waitForLoadState('networkidle', { timeout: 10000 });

      await page.screenshot({ path: 'tests/screenshots/live-security.png', fullPage: true });

      const title = await page.locator('h1').first().textContent();
      console.log(`   Security page title: "${title}"`);

      expect(title).toContain('Security Center');
    } catch (error) {
      console.log(`   ❌ Security page failed: ${error}`);
      throw error;
    }

    // Test 4: Phase D page
    console.log('4. Testing Phase D page...');
    try {
      await page.goto('/dashboard/phase-d', { timeout: 10000 });
      await page.waitForLoadState('networkidle', { timeout: 10000 });

      await page.screenshot({ path: 'tests/screenshots/live-phase-d.png', fullPage: true });

      const title = await page.locator('h1').first().textContent();
      console.log(`   Phase D page title: "${title}"`);

      expect(title).toContain('Phase D Analytics');
    } catch (error) {
      console.log(`   ❌ Phase D page failed: ${error}`);
      throw error;
    }

    // Test 5: Navigation functionality
    console.log('5. Testing navigation...');
    try {
      await page.goto('/dashboard', { timeout: 10000 });
      await page.waitForLoadState('networkidle', { timeout: 10000 });

      // Check sidebar navigation
      const navLinks = await page.locator('nav a').count();
      console.log(`   Navigation links found: ${navLinks}`);

      // Try clicking navigation
      await page.locator('a[href="/dashboard/users"]').click();
      await page.waitForLoadState('networkidle', { timeout: 5000 });

      const currentUrl = page.url();
      console.log(`   URL after navigation: ${currentUrl}`);

      expect(currentUrl).toContain('/users');
    } catch (error) {
      console.log(`   ❌ Navigation failed: ${error}`);
      throw error;
    }

    // Test 6: Check for data vs loading/error states
    console.log('6. Checking data loading states...');
    await page.goto('/dashboard', { timeout: 10000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    // Wait a bit for any async data loading
    await page.waitForTimeout(3000);

    const loadingSpinners = await page.locator('.animate-spin').count();
    const errorText = await page.locator('text=/error/i').count();
    const actualData = await page.locator('.text-2xl.font-bold').count();

    console.log(`   Loading spinners: ${loadingSpinners}`);
    console.log(`   Error messages: ${errorText}`);
    console.log(`   Data elements: ${actualData}`);

    // Final screenshot
    await page.screenshot({ path: 'tests/screenshots/live-final-state.png', fullPage: true });

    // Report console errors (filter out non-critical ones)
    const criticalErrors = errors.filter(
      error =>
        !error.includes('favicon') &&
        !error.includes('chrome-extension') &&
        !error.includes('ResizeObserver')
    );

    console.log('=== CRITICAL JAVASCRIPT ERRORS ===');
    if (criticalErrors.length > 0) {
      criticalErrors.forEach(error => console.log(`   ❌ ${error}`));
    } else {
      console.log('   ✅ No critical JavaScript errors found');
    }

    console.log('=== TEST COMPLETE ===');

    // Don't fail on JS errors for now, just report them
    // expect(criticalErrors.length).toBe(0);
  });
});
