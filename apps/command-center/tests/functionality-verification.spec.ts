import { test, expect } from '@playwright/test';

test.describe('Complete Functionality Verification', () => {
  test('verify all pages load without errors', async ({ page }) => {
    const errors: string[] = [];

    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Test main dashboard
    console.log('Testing main dashboard...');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'tests/screenshots/dashboard-test.png', fullPage: true });

    const dashboardTitle = await page.locator('h1:has-text("Command Center")').count();
    console.log(`Dashboard title found: ${dashboardTitle > 0}`);

    // Test User Management page
    console.log('Testing User Management page...');
    await page.goto('/dashboard/users');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'tests/screenshots/users-test.png', fullPage: true });

    const usersTitle = await page.locator('h1:has-text("User Management")').count();
    console.log(`Users page title found: ${usersTitle > 0}`);

    // Test Security page
    console.log('Testing Security page...');
    await page.goto('/dashboard/security');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'tests/screenshots/security-test.png', fullPage: true });

    const securityTitle = await page.locator('h1:has-text("Security Center")').count();
    console.log(`Security page title found: ${securityTitle > 0}`);

    // Test Phase D page
    console.log('Testing Phase D page...');
    await page.goto('/dashboard/phase-d');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'tests/screenshots/phase-d-test.png', fullPage: true });

    const phaseDTitle = await page.locator('h1:has-text("Phase D Analytics")').count();
    console.log(`Phase D page title found: ${phaseDTitle > 0}`);

    // Check for any JavaScript errors
    console.log('JavaScript errors found:', errors);

    // Verify navigation works
    console.log('Testing navigation...');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Check if sidebar navigation exists
    const sidebarLinks = await page.locator('nav a').count();
    console.log(`Sidebar navigation links found: ${sidebarLinks}`);

    // Try clicking on User Management in sidebar
    await page.locator('a[href="/dashboard/users"]').click();
    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();
    console.log(`Current URL after clicking users: ${currentUrl}`);

    // Check if data is loading (look for loading states or actual data)
    const loadingIndicators = await page.locator('text=/loading/i').count();
    const errorMessages = await page.locator('text=/error/i').count();
    const dataElements = await page
      .locator('[data-testid], .metric-card, table, .space-y-3')
      .count();

    console.log(`Loading indicators: ${loadingIndicators}`);
    console.log(`Error messages: ${errorMessages}`);
    console.log(`Data elements found: ${dataElements}`);

    // Assertions
    expect(dashboardTitle, 'Dashboard should load').toBeGreaterThan(0);
    expect(usersTitle, 'Users page should load').toBeGreaterThan(0);
    expect(securityTitle, 'Security page should load').toBeGreaterThan(0);
    expect(phaseDTitle, 'Phase D page should load').toBeGreaterThan(0);
    expect(sidebarLinks, 'Navigation should exist').toBeGreaterThan(5);
    expect(
      errors.filter(e => !e.includes('favicon')).length,
      'Should not have critical errors'
    ).toBe(0);
  });

  test('verify supabase connection and data loading', async ({ page }) => {
    console.log('Testing Supabase data loading...');

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Wait for potential data loading
    await page.waitForTimeout(5000);

    // Check if we see actual data or just loading/error states
    const metricsCards = await page.locator('.metric-card').count();
    const loadingSpinners = await page.locator('.animate-spin').count();
    const errorMessages = await page.locator('text=/error loading/i').count();

    console.log(`Metric cards found: ${metricsCards}`);
    console.log(`Loading spinners: ${loadingSpinners}`);
    console.log(`Error messages: ${errorMessages}`);

    // Take a screenshot to see what's actually displayed
    await page.screenshot({ path: 'tests/screenshots/data-loading-test.png', fullPage: true });

    // Check if we have any actual data values
    const dataValues = await page.locator('.text-2xl.font-bold').allTextContents();
    console.log('Data values found:', dataValues);

    expect(metricsCards, 'Should have metric cards').toBeGreaterThan(0);
  });
});
