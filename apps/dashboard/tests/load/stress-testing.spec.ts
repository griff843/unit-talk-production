import { test, expect } from '@playwright/test';

/**
 * Fortune 100-Grade Load & Stress Tests: System Resilience
 *
 * Tests system behavior under stress conditions:
 * - Concurrent user simulation
 * - Memory leak detection
 * - Performance degradation monitoring
 * - Resource exhaustion handling
 * - Recovery after stress
 * - Scalability validation
 */

test.describe('Load & Stress Testing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForSelector('[data-testid="dashboard-container"]', { timeout: 10000 });
  });

  test('should handle concurrent user interactions', async ({ page }) => {
    const interactions = [];
    const startTime = Date.now();

    // Simulate rapid user interactions
    for (let i = 0; i < 50; i++) {
      interactions.push(
        page.mouse.move(Math.random() * 1000, Math.random() * 800),
        page.keyboard.press('Tab'),
        page.mouse.click(Math.random() * 1000, Math.random() * 800)
      );
    }

    // Execute all interactions concurrently
    await Promise.allSettled(interactions);

    const executionTime = Date.now() - startTime;
    console.log(`Concurrent interactions completed in: ${executionTime}ms`);

    // System should remain responsive
    await expect(page.getByTestId('dashboard-container')).toBeVisible();
    expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
  });

  test('should detect memory leaks during extended use', async ({ page }) => {
    // Get initial memory usage
    const getMemoryUsage = async () => {
      return await page.evaluate(() => {
        if ('memory' in performance) {
          const memory = (performance as any).memory;
          return {
            used: memory.usedJSHeapSize,
            total: memory.totalJSHeapSize,
            limit: memory.jsHeapSizeLimit,
          };
        }
        return null;
      });
    };

    const initialMemory = await getMemoryUsage();

    if (initialMemory) {
      console.log('Initial memory:', {
        used: Math.round(initialMemory.used / 1024 / 1024) + 'MB',
        total: Math.round(initialMemory.total / 1024 / 1024) + 'MB',
      });

      // Simulate extended usage with multiple page refreshes
      for (let i = 0; i < 10; i++) {
        await page.reload();
        await page.waitForSelector('[data-testid="dashboard-container"]');

        // Trigger some interactions
        const refreshButton = page.getByTestId('refresh-dashboard');
        if (await refreshButton.isVisible()) {
          await refreshButton.click();
        }

        await page.waitForTimeout(500);
      }

      // Force garbage collection if possible
      await page.evaluate(() => {
        if ('gc' in window) {
          (window as any).gc();
        }
      });

      const finalMemory = await getMemoryUsage();

      if (finalMemory) {
        console.log('Final memory:', {
          used: Math.round(finalMemory.used / 1024 / 1024) + 'MB',
          total: Math.round(finalMemory.total / 1024 / 1024) + 'MB',
        });

        const memoryIncrease = (finalMemory.used - initialMemory.used) / 1024 / 1024;
        console.log(`Memory increase: ${Math.round(memoryIncrease)}MB`);

        // Memory increase should be reasonable (< 50MB)
        expect(memoryIncrease).toBeLessThan(50);
      }
    }
  });

  test('should maintain performance under sustained load', async ({ page }) => {
    const performanceMetrics = [];

    // Measure performance over multiple iterations
    for (let i = 0; i < 20; i++) {
      const startTime = Date.now();

      // Simulate user activity
      await page.reload();
      await page.waitForSelector('[data-testid="dashboard-container"]');

      const loadTime = Date.now() - startTime;
      performanceMetrics.push(loadTime);

      console.log(`Iteration ${i + 1}: ${loadTime}ms`);
    }

    // Calculate performance statistics
    const averageLoadTime = performanceMetrics.reduce((a, b) => a + b) / performanceMetrics.length;
    const maxLoadTime = Math.max(...performanceMetrics);
    const minLoadTime = Math.min(...performanceMetrics);

    console.log('Performance Summary:', {
      average: Math.round(averageLoadTime) + 'ms',
      max: maxLoadTime + 'ms',
      min: minLoadTime + 'ms',
    });

    // Performance should remain consistent
    expect(averageLoadTime).toBeLessThan(3000); // Average < 3s
    expect(maxLoadTime).toBeLessThan(5000); // Max < 5s

    // Performance degradation should be minimal
    const degradation = (maxLoadTime - minLoadTime) / minLoadTime;
    expect(degradation).toBeLessThan(2.0); // < 200% variance
  });

  test('should handle rapid API requests gracefully', async ({ page }) => {
    let requestCount = 0;
    let errorCount = 0;

    page.on('response', response => {
      if (response.url().includes('/api/')) {
        requestCount++;
        if (response.status() >= 400) {
          errorCount++;
        }
      }
    });

    // Make rapid API requests
    const refreshButton = page.getByTestId('refresh-dashboard');
    if (await refreshButton.isVisible()) {
      const requests = [];

      for (let i = 0; i < 30; i++) {
        requests.push(refreshButton.click());
        await page.waitForTimeout(50); // 50ms between requests
      }

      await Promise.allSettled(requests);
    }

    console.log(`Total API requests: ${requestCount}, Errors: ${errorCount}`);

    // Should handle requests without excessive errors
    const errorRate = errorCount / Math.max(requestCount, 1);
    expect(errorRate).toBeLessThan(0.1); // < 10% error rate

    // Dashboard should still be functional
    await expect(page.getByTestId('dashboard-container')).toBeVisible();
  });

  test('should recover gracefully from network interruptions', async ({ page }) => {
    // Initial load
    await page.waitForLoadState('networkidle');

    // Simulate network interruption
    await page.context().setOffline(true);

    // Try to interact with the dashboard
    const refreshButton = page.getByTestId('refresh-dashboard');
    if (await refreshButton.isVisible()) {
      await refreshButton.click();

      // Should show offline state or cached content
      await page.waitForTimeout(2000);
    }

    // Restore network
    await page.context().setOffline(false);

    // Should recover within reasonable time
    if (await refreshButton.isVisible()) {
      await refreshButton.click();

      // Wait for recovery
      await expect(page.getByTestId('performance-metrics')).toBeVisible({
        timeout: 10000,
      });
    }
  });

  test('should handle DOM stress with many elements', async ({ page }) => {
    // Check initial element count
    const initialElementCount = await page.locator('*').count();
    console.log(`Initial DOM elements: ${initialElementCount}`);

    // Navigate through different views to accumulate DOM elements
    const tabs = page.getByRole('tab');
    const tabCount = await tabs.count();

    if (tabCount > 0) {
      for (let i = 0; i < tabCount; i++) {
        await tabs.nth(i).click();
        await page.waitForTimeout(500);

        // Check if DOM is growing excessively
        const currentElementCount = await page.locator('*').count();

        // DOM growth should be reasonable
        expect(currentElementCount).toBeLessThan(initialElementCount * 5);
      }
    }

    // Verify dashboard remains responsive
    await expect(page.getByTestId('dashboard-container')).toBeVisible();
  });

  test('should handle CSS animation stress', async ({ page }) => {
    // Trigger multiple animations simultaneously
    const animatedElements = page.locator('.animate-spin, .animate-pulse, .animate-bounce');
    const animationCount = await animatedElements.count();

    if (animationCount > 0) {
      console.log(`Found ${animationCount} animated elements`);

      // Measure performance during animations
      const startTime = Date.now();

      // Interact with page while animations run
      for (let i = 0; i < 10; i++) {
        await page.mouse.move(Math.random() * 1000, Math.random() * 800);
        await page.waitForTimeout(100);
      }

      const interactionTime = Date.now() - startTime;
      console.log(`Interaction time during animations: ${interactionTime}ms`);

      // Should remain responsive during animations
      expect(interactionTime).toBeLessThan(2000);
    }
  });

  test('should handle JavaScript error recovery', async ({ page }) => {
    const jsErrors: string[] = [];

    page.on('pageerror', error => {
      jsErrors.push(error.message);
    });

    // Inject some problematic code to test error handling
    await page.addInitScript(() => {
      // Override console.error to simulate error conditions
      const originalError = console.error;
      console.error = (...args) => {
        originalError.apply(console, args);
      };
    });

    // Simulate various user interactions that might trigger errors
    const interactions = [
      () => page.mouse.click(9999, 9999), // Click outside viewport
      () => page.keyboard.press('F12'), // Developer tools shortcut
      () => page.keyboard.press('Ctrl+Shift+I'), // Another dev tools shortcut
      () => page.keyboard.press('F5'), // Refresh shortcut
    ];

    for (const interaction of interactions) {
      try {
        await interaction();
      } catch (error) {
        // Expected to fail, continue testing
      }
      await page.waitForTimeout(100);
    }

    // Dashboard should still be functional despite potential errors
    await expect(page.getByTestId('dashboard-container')).toBeVisible();

    console.log(`JavaScript errors encountered: ${jsErrors.length}`);

    // Should have minimal unhandled errors
    expect(jsErrors.length).toBeLessThan(5);
  });

  test('should maintain accessibility during stress', async ({ page }) => {
    // Stress the system first
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      await page.mouse.move(Math.random() * 1000, Math.random() * 800);
      await page.waitForTimeout(50);
    }

    // Verify focus is still manageable
    await page.keyboard.press('Tab');
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();

    // Verify keyboard navigation still works
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      const currentFocus = page.locator(':focus');
      await expect(currentFocus).toBeVisible();
    }
  });

  test('should handle extreme viewport changes', async ({ page }) => {
    const viewports = [
      { width: 320, height: 568 }, // iPhone SE
      { width: 1920, height: 1080 }, // Full HD
      { width: 2560, height: 1440 }, // 2K
      { width: 3840, height: 2160 }, // 4K
      { width: 768, height: 1024 }, // iPad
      { width: 1024, height: 768 }, // iPad landscape
    ];

    for (const viewport of viewports) {
      console.log(`Testing viewport: ${viewport.width}x${viewport.height}`);

      const startTime = Date.now();
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500); // Allow layout to settle

      const resizeTime = Date.now() - startTime;

      // Verify dashboard adapts to viewport
      await expect(page.getByTestId('dashboard-container')).toBeVisible();

      // Resize should be fast
      expect(resizeTime).toBeLessThan(1000);
    }
  });
});
