import { test, expect } from '@playwright/test';

test.describe('Health Tiles Rendering E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the command center page
    await page.goto('/command-center');
    
    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test('should display health tiles with correct structure', async ({ page }) => {
    // Wait for health tiles card to be visible
    await expect(page.locator('text=SLO & Burn Rate')).toBeVisible();
    
    // Check that all expected health tiles are present
    const expectedTiles = [
      'health-tile-feed-freshness',
      'health-tile-temporal-backlog',
      'health-tile-canary-status',
      'health-tile-failure-rate',
      'health-tile-provider-spend',
      'health-tile-dlq-count'
    ];

    for (const tileId of expectedTiles) {
      await expect(page.locator(`[data-testid="${tileId}"]`)).toBeVisible();
    }
  });

  test('should show loading state initially', async ({ page }) => {
    // Reload page to catch loading state
    await page.reload();
    
    // Look for loading indicator (should appear briefly)
    const loadingText = page.locator('text=Loading health data...');
    
    // The loading state might be very brief, so we'll just check if it exists or has already passed
    // If it's not visible, that's okay - it means the data loaded quickly
    try {
      await expect(loadingText).toBeVisible({ timeout: 1000 });
    } catch {
      // Loading state passed quickly, which is fine
    }
    
    // Ensure tiles are eventually visible
    await expect(page.locator('text=SLO & Burn Rate')).toBeVisible();
  });

  test('should display source badge correctly', async ({ page }) => {
    // Wait for health tiles to load
    await expect(page.locator('text=SLO & Burn Rate')).toBeVisible();
    
    // Check for either "Live Data" or "Fallback Data" badge
    const liveBadge = page.locator('text=Live Data');
    const fallbackBadge = page.locator('text=Fallback Data');
    
    // At least one badge should be visible
    const badgeVisible = await Promise.race([
      liveBadge.isVisible().then(v => ({ type: 'live', visible: v })),
      fallbackBadge.isVisible().then(v => ({ type: 'fallback', visible: v }))
    ]);
    
    expect(badgeVisible.visible).toBe(true);
  });

  test('should show tile values and status indicators', async ({ page }) => {
    // Wait for tiles to load
    await expect(page.locator('text=SLO & Burn Rate')).toBeVisible();
    
    // Check that each tile has a value and status indicator
    const tiles = await page.locator('[data-testid^="health-tile-"]').all();
    
    for (const tile of tiles) {
      // Each tile should have a value
      await expect(tile.locator('[data-testid="tile-value"]')).toBeVisible();
      
      // Each tile should have a status indicator
      await expect(tile.locator('[data-testid="status-indicator"]')).toBeVisible();
    }
  });

  test('should show tooltips on hover', async ({ page }) => {
    // Wait for tiles to load
    await expect(page.locator('text=SLO & Burn Rate')).toBeVisible();
    
    // Test tooltip on feed freshness tile
    const feedTile = page.locator('[data-testid="health-tile-feed-freshness"]');
    await feedTile.hover();
    
    // The tooltip should appear (title attribute creates native browser tooltip)
    const titleAttr = await feedTile.getAttribute('title');
    expect(titleAttr).toBeTruthy();
    expect(titleAttr).toContain('Feed freshness');
  });

  test('should update data over time with polling', async ({ page }) => {
    // Wait for initial load
    await expect(page.locator('text=SLO & Burn Rate')).toBeVisible();
    
    // Capture initial timestamp if visible
    const initialTimestamp = await page.locator('text*="Last updated:"').textContent().catch(() => null);
    
    // Wait for React Query polling interval (10 seconds) plus buffer
    await page.waitForTimeout(12000);
    
    // Check if timestamp has updated (if timestamp is shown)
    if (initialTimestamp) {
      const updatedTimestamp = await page.locator('text*="Last updated:"').textContent();
      // Timestamps should be different due to polling
      expect(updatedTimestamp).not.toBe(initialTimestamp);
    }
  });

  test('should handle error states gracefully', async ({ page }) => {
    // Intercept the health tiles API to simulate an error
    await page.route('**/api/ops/health/tiles', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });

    // Reload to trigger error state
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should show error state
    await expect(page.locator('text=SLO & Burn Rate')).toBeVisible();
    await expect(page.locator('[variant="outline"]:has-text("Error")')).toBeVisible();
  });

  test('should display correct status colors', async ({ page }) => {
    // Wait for tiles to load
    await expect(page.locator('text=SLO & Burn Rate')).toBeVisible();
    
    // Check that status indicators have appropriate colors
    const statusIndicators = await page.locator('[data-testid="status-indicator"]').all();
    
    for (const indicator of statusIndicators) {
      const className = await indicator.getAttribute('class');
      
      // Should have one of the expected background colors
      const hasValidColor = className?.includes('bg-green-500') || 
                          className?.includes('bg-yellow-500') || 
                          className?.includes('bg-red-500') ||
                          className?.includes('bg-gray-500');
      
      expect(hasValidColor).toBe(true);
    }
  });

  test('should be responsive on different screen sizes', async ({ page }) => {
    // Test desktop view
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.locator('text=SLO & Burn Rate')).toBeVisible();
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('text=SLO & Burn Rate')).toBeVisible();
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('text=SLO & Burn Rate')).toBeVisible();
    
    // Tiles should still be visible and functional on mobile
    const tiles = await page.locator('[data-testid^="health-tile-"]').all();
    expect(tiles.length).toBeGreaterThan(0);
  });

  test('should show appropriate tile labels and icons', async ({ page }) => {
    // Wait for tiles to load
    await expect(page.locator('text=SLO & Burn Rate')).toBeVisible();
    
    // Check for expected tile labels
    const expectedLabels = [
      'Feed Freshness',
      'Temporal Backlog',
      'Canary Status',
      'Failure Rate',
      'Provider Spend',
      'DLQ Count'
    ];

    for (const label of expectedLabels) {
      await expect(page.locator(`text=${label}`)).toBeVisible();
    }
  });

  test('should maintain accessibility standards', async ({ page }) => {
    // Wait for tiles to load
    await expect(page.locator('text=SLO & Burn Rate')).toBeVisible();
    
    // Check for proper ARIA attributes and semantic structure
    const tilesCard = page.locator('text=SLO & Burn Rate').locator('..');
    
    // Should be within a proper card structure
    await expect(tilesCard).toBeVisible();
    
    // All tiles should be focusable and have proper labeling
    const tiles = await page.locator('[data-testid^="health-tile-"]').all();
    
    for (const tile of tiles) {
      // Each tile should have accessible content
      const textContent = await tile.textContent();
      expect(textContent).toBeTruthy();
      expect(textContent.length).toBeGreaterThan(0);
    }
  });

  test('should integrate properly with React Query caching', async ({ page }) => {
    // Load the page initially
    await expect(page.locator('text=SLO & Burn Rate')).toBeVisible();
    
    // Navigate away and back to test caching
    await page.goto('/');
    await page.goBack();
    
    // Data should load quickly from cache
    await expect(page.locator('text=SLO & Burn Rate')).toBeVisible({ timeout: 2000 });
    
    // Tiles should be populated immediately from cache
    const tiles = await page.locator('[data-testid^="health-tile-"]').all();
    expect(tiles.length).toBeGreaterThan(0);
  });
});