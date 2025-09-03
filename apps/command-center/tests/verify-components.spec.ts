import { test, expect } from '@playwright/test';

test.describe('Component Verification', () => {
  test('verify all dashboard components load correctly', async ({ page }) => {
    // Navigate to the dashboard
    await page.goto('/dashboard');

    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');

    // Take initial screenshot
    await page.screenshot({ path: 'tests/screenshots/dashboard-current.png', fullPage: true });

    // Check if main elements exist
    console.log('Checking for Command Center header...');
    const header = await page.locator('h1:has-text("Command Center")').count();
    console.log(`Header found: ${header > 0}`);

    // Check for sidebar navigation
    console.log('Checking for sidebar...');
    const sidebar = await page.locator('nav').count();
    console.log(`Sidebar found: ${sidebar > 0}`);

    // Check for metric cards
    console.log('Checking for metric cards...');
    const metricCards = await page.locator('.metric-card').count();
    console.log(`Metric cards found: ${metricCards}`);

    // Check for specific stats
    const activePicksCard = await page.locator('text=/Active Picks/i').count();
    const systemHealthCard = await page.locator('text=/System Health/i').count();
    const activeUsersCard = await page.locator('text=/Active Users/i').count();
    const revenueCard = await page.locator('text=/Revenue/i').count();

    console.log(`Active Picks card: ${activePicksCard > 0}`);
    console.log(`System Health card: ${systemHealthCard > 0}`);
    console.log(`Active Users card: ${activeUsersCard > 0}`);
    console.log(`Revenue card: ${revenueCard > 0}`);

    // Check for Agent Status section
    console.log('Checking for Agent Status section...');
    const agentStatus = await page.locator('text=/Agent Status/i').count();
    console.log(`Agent Status section found: ${agentStatus > 0}`);

    // Check for Recent Activity section
    console.log('Checking for Recent Activity section...');
    const recentActivity = await page.locator('text=/Recent Activity/i').count();
    console.log(`Recent Activity section found: ${recentActivity > 0}`);

    // Check for Quick Actions
    console.log('Checking for Quick Actions...');
    const quickActions = await page.locator('text=/Quick Actions/i').count();
    console.log(`Quick Actions section found: ${quickActions > 0}`);

    // Check if any error messages are present
    const errors = await page.locator('text=/error/i').count();
    const loadingIndicators = await page.locator('text=/loading/i').count();

    console.log(`Error messages found: ${errors}`);
    console.log(`Loading indicators found: ${loadingIndicators}`);

    // Get page content for debugging
    const bodyText = await page.locator('body').innerText();
    console.log('Page content preview:', bodyText.substring(0, 500));

    // Assert critical components exist
    expect(header, 'Command Center header should exist').toBeGreaterThan(0);
    expect(metricCards, 'Should have metric cards').toBeGreaterThan(0);
    expect(agentStatus, 'Agent Status section should exist').toBeGreaterThan(0);
    expect(recentActivity, 'Recent Activity section should exist').toBeGreaterThan(0);
  });

  test('check for console errors and network issues', async ({ page }) => {
    const errors: string[] = [];
    const failed404s: string[] = [];

    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Listen for failed network requests
    page.on('response', response => {
      if (response.status() >= 400) {
        failed404s.push(`${response.status()} - ${response.url()}`);
      }
    });

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Wait for any lazy loading

    console.log('Console errors:', errors);
    console.log('Failed requests:', failed404s);

    // Take screenshot of current state
    await page.screenshot({ path: 'tests/screenshots/error-state.png', fullPage: true });

    // Report findings
    if (errors.length > 0) {
      console.log('Found console errors:', errors);
    }
    if (failed404s.length > 0) {
      console.log('Found failed network requests:', failed404s);
    }
  });
});
