import { test, expect } from '@playwright/test';

test.describe('Command Center Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('should display main dashboard with key metrics', async ({ page }) => {
    // Check page title and header
    await expect(page).toHaveTitle(/Command Center/);
    await expect(page.locator('h1')).toContainText('Command Center');
    
    // Verify key metric cards are visible
    await expect(page.locator('[data-testid="metric-card"]')).toHaveCount(4);
    
    // Check specific metrics
    await expect(page.locator('text=Active Picks')).toBeVisible();
    await expect(page.locator('text=System Health')).toBeVisible();
    await expect(page.locator('text=Active Users')).toBeVisible();
    await expect(page.locator('text=Revenue (MTD)')).toBeVisible();
  });

  test('should display agent status panel', async ({ page }) => {
    // Check agent status section
    await expect(page.locator('text=Agent Status')).toBeVisible();
    
    // Verify at least one agent is displayed
    const agentCards = page.locator('[data-testid="agent-card"]');
    await expect(agentCards.first()).toBeVisible();
    
    // Check agent has status badge
    const statusBadge = page.locator('[data-testid="agent-status-badge"]').first();
    await expect(statusBadge).toBeVisible();
    await expect(statusBadge).toHaveText(/(healthy|warning|error)/);
  });

  test('should display recent activity', async ({ page }) => {
    // Check recent activity section
    await expect(page.locator('text=Recent Activity')).toBeVisible();
    
    // Verify activity items or empty state
    const activityItems = page.locator('[data-testid="activity-item"]');
    const emptyState = page.locator('text=No recent events');
    
    // Either show activities or empty state
    const hasActivities = await activityItems.count() > 0;
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    
    expect(hasActivities || hasEmptyState).toBeTruthy();
  });

  test('should have functional quick actions', async ({ page }) => {
    // Check quick actions section
    await expect(page.locator('text=Quick Actions')).toBeVisible();
    
    // Verify action buttons
    await expect(page.locator('button:has-text("Manage Picks")')).toBeVisible();
    await expect(page.locator('button:has-text("User Management")')).toBeVisible();
    await expect(page.locator('button:has-text("Agent Control")')).toBeVisible();
    await expect(page.locator('button:has-text("View Analytics")')).toBeVisible();
  });

  test('should show sync status', async ({ page }) => {
    // Check for sync status component
    const syncStatus = page.locator('[data-testid="sync-status"]');
    if (await syncStatus.isVisible()) {
      // Verify it shows connection state
      await expect(syncStatus).toContainText(/(Connected|Disconnected|Connecting)/);
    }
  });

  test('should have refresh functionality', async ({ page }) => {
    // Find and click refresh button
    const refreshButton = page.locator('button:has-text("Refresh")');
    await expect(refreshButton).toBeVisible();
    
    // Click and verify no errors
    await refreshButton.click();
    
    // Page should still be functional
    await expect(page.locator('h1')).toContainText('Command Center');
  });
});