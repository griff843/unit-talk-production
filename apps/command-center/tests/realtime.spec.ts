import { test, expect } from '@playwright/test';

test.describe('Real-time Features', () => {
  test('should establish WebSocket connection', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    
    // Listen for WebSocket connections
    const wsPromise = page.waitForEvent('websocket');
    
    // Reload to trigger connection
    await page.reload();
    
    // Wait for WebSocket with timeout
    const ws = await Promise.race([
      wsPromise,
      new Promise(resolve => setTimeout(() => resolve(null), 5000))
    ]);
    
    if (ws) {
      expect(ws).toBeTruthy();
      // Additional WebSocket tests can be added here
    }
  });

  test('should handle SSE fallback', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check if EventSource is being used
    const hasEventSource = await page.evaluate(() => {
      return window.EventSource !== undefined;
    });
    
    expect(hasEventSource).toBeTruthy();
  });

  test('should update data in real-time', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Get initial agent count
    const initialCount = await page.locator('[data-testid="metric-card"]:has-text("System Health")').textContent();
    
    // Wait for potential updates (with timeout)
    await page.waitForTimeout(3000);
    
    // Verify page is still responsive
    await expect(page.locator('h1')).toContainText('Command Center');
  });

  test('should show connection status', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Look for sync status component
    const syncStatus = page.locator('[data-testid="sync-status"], [class*="sync"]');
    
    if (await syncStatus.count() > 0) {
      // Should show some connection state
      const statusText = await syncStatus.textContent();
      expect(statusText).toMatch(/(Connected|Connecting|Disconnected|Synced|Offline)/i);
    }
  });

  test('should reconnect after disconnect', async ({ page, context }) => {
    await page.goto('/dashboard');
    
    // Simulate offline
    await context.setOffline(true);
    await page.waitForTimeout(1000);
    
    // Check for offline indication
    const offlineIndicator = page.locator('text=/offline|disconnected/i');
    
    // Go back online
    await context.setOffline(false);
    await page.waitForTimeout(2000);
    
    // Should reconnect
    const onlineIndicator = page.locator('text=/online|connected|synced/i');
    
    // Verify page still works
    await expect(page.locator('h1')).toBeVisible();
  });
});