import { test, expect } from '@playwright/test';

test.describe('Command Center Issues E2E Test', () => {
  test.beforeEach(async ({ page }) => {
    // Start at command center
    await page.goto('/command-center');
    await page.waitForLoadState('networkidle');
  });

  test('should have working navigation sidebar', async ({ page }) => {
    // Check if sidebar exists
    const sidebar = page.locator('[data-testid="sidebar"], nav, .sidebar, aside');
    await expect(sidebar).toBeVisible({ timeout: 5000 });
    
    // Check navigation links
    const dashboardLink = page.locator('a[href="/dashboard"]');
    await expect(dashboardLink).toBeVisible();
    
    const agentsLink = page.locator('a[href="/dashboard/agents"]');
    await expect(agentsLink).toBeVisible();
  });

  test('safety toggles should actually work', async ({ page }) => {
    // Find SAFE_MODE toggle
    const safeModeToggle = page.locator('[data-testid="toggle-SAFE_MODE"]');
    await expect(safeModeToggle).toBeVisible();
    
    // Get initial state
    const initialChecked = await safeModeToggle.isChecked();
    
    // Click toggle
    await safeModeToggle.click();
    
    // Wait for API call
    await page.waitForResponse(resp => 
      resp.url().includes('/api/ops/system-config') && 
      resp.request().method() === 'POST'
    );
    
    // Verify state changed
    await expect(safeModeToggle).toBeChecked({ checked: !initialChecked });
    
    // Refresh page to verify persistence
    await page.reload();
    await expect(safeModeToggle).toBeChecked({ checked: !initialChecked });
  });

  test('agent data should show real-time data, not mock', async ({ page }) => {
    // Navigate to agents page
    await page.goto('/dashboard/agents');
    await page.waitForLoadState('networkidle');
    
    // Check for agent data
    const agentCards = page.locator('[data-testid*="agent-card"]');
    await expect(agentCards).toHaveCount(0, { timeout: 10000 }).catch(() => {
      // If we have agent cards, check they're not showing old data
    });
    
    // Look for "last run" timestamps
    const lastRunTexts = page.locator('text=/last run|days ago|hours ago/i');
    const count = await lastRunTexts.count();
    
    for (let i = 0; i < count; i++) {
      const text = await lastRunTexts.nth(i).textContent();
      // Should not show "days ago" for active agents
      expect(text).not.toContain('days ago');
    }
    
    // Check for GradingAgent specifically
    const gradingAgent = page.locator('text=/GradingAgent/i').first();
    if (await gradingAgent.isVisible()) {
      const parentCard = gradingAgent.locator('..').locator('..');
      const lastRun = await parentCard.locator('text=/last run/i').textContent();
      expect(lastRun).not.toContain('2 days ago');
      expect(lastRun).toMatch(/seconds ago|minute ago|minutes ago/i);
    }
  });

  test('data trust widgets should load data', async ({ page }) => {
    // Find data trust card
    const dataTrustCard = page.locator('text=/Data Trust/i').locator('..');
    
    // Check immutability widget
    const immutabilityWidget = page.locator('[data-testid="immutability-check-widget"]');
    await expect(immutabilityWidget).toBeVisible();
    
    // Should not show "Loading..." after reasonable time
    const loadingText = immutabilityWidget.locator('text=/loading/i');
    await expect(loadingText).not.toBeVisible({ timeout: 5000 });
    
    // Should show actual data
    const healthScore = immutabilityWidget.locator('[data-testid="check-status"], text=/healthy|warning|critical/i');
    await expect(healthScore).toBeVisible();
    
    // Check shadow diff widget
    const shadowDiffWidget = page.locator('[data-testid="shadow-diff-widget"]');
    await expect(shadowDiffWidget).toBeVisible();
    
    // Should show metrics, not loading
    const diffMetrics = shadowDiffWidget.locator('[data-testid="diff-metrics"]');
    await expect(diffMetrics).toBeVisible({ timeout: 5000 });
  });

  test('no mock data should be present', async ({ page }) => {
    // Check for common mock data indicators
    const mockIndicators = [
      'text=/mock/i',
      'text=/demo/i',
      'text=/sample/i',
      'text=/test data/i',
      'text=/John Doe/i',
      'text=/jane.doe/i',
      'text=/example\\.com/i'
    ];
    
    for (const selector of mockIndicators) {
      const elements = page.locator(selector);
      const count = await elements.count();
      expect(count).toBe(0);
    }
  });

  test('agent control toggles should work', async ({ page }) => {
    await page.goto('/dashboard/agents');
    await page.waitForLoadState('networkidle');
    
    // Find any agent control button
    const startButton = page.locator('button:has-text("Start")').first();
    const stopButton = page.locator('button:has-text("Stop")').first();
    const restartButton = page.locator('button:has-text("Restart")').first();
    
    // At least one control should be visible
    const hasControls = 
      await startButton.isVisible().catch(() => false) ||
      await stopButton.isVisible().catch(() => false) ||
      await restartButton.isVisible().catch(() => false);
    
    expect(hasControls).toBeTruthy();
    
    // Try clicking a control
    if (await stopButton.isVisible()) {
      await stopButton.click();
      
      // Should trigger API call
      await page.waitForResponse(resp => 
        resp.url().includes('/api/agents') && 
        resp.request().method() === 'POST',
        { timeout: 5000 }
      ).catch(() => {
        // If no response, the button doesn't work
        throw new Error('Agent control button did not trigger API call');
      });
    }
  });

  test('health tiles should show real data', async ({ page }) => {
    // Check health tiles
    const healthTiles = page.locator('[data-testid*="health-tile"]');
    const tileCount = await healthTiles.count();
    
    expect(tileCount).toBeGreaterThan(0);
    
    // Each tile should have a value, not placeholder
    for (let i = 0; i < tileCount; i++) {
      const tile = healthTiles.nth(i);
      const value = tile.locator('[data-testid="tile-value"]');
      const text = await value.textContent();
      
      // Should not be empty or placeholder
      expect(text).not.toBe('...');
      expect(text).not.toBe('—');
      expect(text).not.toBe('N/A');
      expect(text).toBeTruthy();
    }
    
    // Check for fallback indicator
    const fallbackBadge = page.locator('text=/fallback/i');
    if (await fallbackBadge.isVisible()) {
      console.log('Health tiles are using fallback data - database connection may be missing');
    }
  });

  test('page should be production-ready, not demo mode', async ({ page }) => {
    // Check for production indicators
    const envText = page.locator('text=/Environment.*Production/i');
    await expect(envText).toBeVisible();
    
    // Check database version
    const dbText = page.locator('text=/Database.*v3\\.0\\.0/i');
    await expect(dbText).toBeVisible();
    
    // Should not have demo/dev indicators
    const demoText = page.locator('text=/demo|development|test mode/i');
    await expect(demoText).not.toBeVisible();
  });
});