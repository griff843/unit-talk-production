import { test, expect } from '@playwright/test';

/**
 * Fortune 100-Grade Performance Tests: Load Performance & Resource Management
 *
 * Tests comprehensive performance standards:
 * - Core Web Vitals (LCP, FID, CLS)
 * - Memory usage optimization
 * - Network resource efficiency
 * - JavaScript bundle analysis
 * - Cache effectiveness
 * - Progressive loading
 */

test.describe('Load Performance & Resource Management', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cache to ensure fresh measurements
    await page.context().clearCookies();
    await page.goto('/dashboard');
  });

  test('should meet Core Web Vitals thresholds', async ({ page }) => {
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Measure Core Web Vitals
    const webVitals = await page.evaluate(() => {
      return new Promise(resolve => {
        const vitals: any = {};

        // Largest Contentful Paint (LCP)
        new PerformanceObserver(list => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          vitals.lcp = lastEntry.startTime;

          if (vitals.lcp && vitals.fid !== undefined && vitals.cls !== undefined) {
            resolve(vitals);
          }
        }).observe({ entryTypes: ['largest-contentful-paint'] });

        // First Input Delay (FID) - simulate user interaction
        new PerformanceObserver(list => {
          const entries = list.getEntries();
          vitals.fid = entries[0]?.processingStart - entries[0]?.startTime || 0;

          if (vitals.lcp && vitals.fid !== undefined && vitals.cls !== undefined) {
            resolve(vitals);
          }
        }).observe({ entryTypes: ['first-input'] });

        // Cumulative Layout Shift (CLS)
        let clsValue = 0;
        new PerformanceObserver(list => {
          for (const entry of list.getEntries() as any) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          }
          vitals.cls = clsValue;

          if (vitals.lcp && vitals.fid !== undefined && vitals.cls !== undefined) {
            resolve(vitals);
          }
        }).observe({ entryTypes: ['layout-shift'] });

        // Fallback timeout
        setTimeout(() => {
          resolve({
            lcp: vitals.lcp || 0,
            fid: vitals.fid || 0,
            cls: vitals.cls || 0,
          });
        }, 5000);
      });
    });

    console.log('Core Web Vitals:', webVitals);

    // Fortune 100 Standards
    expect(webVitals.lcp).toBeLessThan(2500); // LCP < 2.5s
    expect(webVitals.fid).toBeLessThan(100); // FID < 100ms
    expect(webVitals.cls).toBeLessThan(0.1); // CLS < 0.1
  });

  test('should load within performance budget', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/dashboard');
    await page.waitForSelector('[data-testid="dashboard-container"]');

    const loadTime = Date.now() - startTime;
    console.log(`Dashboard load time: ${loadTime}ms`);

    // Fortune 100 Standard: < 3 second load time
    expect(loadTime).toBeLessThan(3000);
  });

  test('should optimize resource loading', async ({ page }) => {
    const resourcePromise = page.waitForEvent('response');
    await page.goto('/dashboard');

    // Collect all network requests
    const responses: any[] = [];
    page.on('response', response => {
      responses.push({
        url: response.url(),
        status: response.status(),
        size: response.headers()['content-length'],
        type: response.headers()['content-type'],
      });
    });

    await page.waitForLoadState('networkidle');

    // Analyze JavaScript bundle size
    const jsResponses = responses.filter(
      r => r.type?.includes('javascript') && r.url.includes('_next/static')
    );

    const totalJSSize = jsResponses.reduce((total, response) => {
      return total + (parseInt(response.size) || 0);
    }, 0);

    console.log(`Total JavaScript size: ${totalJSSize} bytes`);

    // Fortune 100 Standard: < 500KB initial JS bundle
    expect(totalJSSize).toBeLessThan(500 * 1024);

    // Verify critical resources loaded successfully
    const failedRequests = responses.filter(r => r.status >= 400);
    expect(failedRequests).toHaveLength(0);
  });

  test('should manage memory efficiently', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForSelector('[data-testid="dashboard-container"]');

    // Measure initial memory usage
    const initialMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory;
      }
      return null;
    });

    if (initialMemory) {
      console.log('Memory usage:', {
        used: Math.round(initialMemory.usedJSHeapSize / 1024 / 1024) + 'MB',
        total: Math.round(initialMemory.totalJSHeapSize / 1024 / 1024) + 'MB',
        limit: Math.round(initialMemory.jsHeapSizeLimit / 1024 / 1024) + 'MB',
      });

      // Fortune 100 Standard: < 100MB memory usage for dashboard
      const memoryUsageMB = initialMemory.usedJSHeapSize / 1024 / 1024;
      expect(memoryUsageMB).toBeLessThan(100);
    }
  });

  test('should implement progressive loading', async ({ page }) => {
    await page.goto('/dashboard');

    // Verify loading states are shown
    const loadingIndicator = page.getByTestId('loading-indicator');

    // Should show loading state initially
    const hasLoadingState = await loadingIndicator.isVisible().catch(() => false);

    if (hasLoadingState) {
      // Loading should disappear within reasonable time
      await expect(loadingIndicator).toBeHidden({ timeout: 10000 });
    }

    // Verify critical content loads first
    await expect(page.getByTestId('dashboard-container')).toBeVisible();
    await expect(page.getByTestId('performance-metrics')).toBeVisible();
  });

  test('should cache resources effectively', async ({ page }) => {
    // First visit
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const firstVisitResponses: any[] = [];
    page.on('response', response => {
      firstVisitResponses.push({
        url: response.url(),
        fromCache: response.fromServiceWorker() || response.headers()['cf-cache-status'] === 'HIT',
      });
    });

    // Second visit (should use cache)
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Check that static assets are cached
    const staticAssets = firstVisitResponses.filter(
      r => r.url.includes('_next/static') || r.url.includes('.css') || r.url.includes('.js')
    );

    const cachedAssets = staticAssets.filter(r => r.fromCache);
    const cacheHitRate = cachedAssets.length / staticAssets.length;

    console.log(`Cache hit rate: ${Math.round(cacheHitRate * 100)}%`);

    // Fortune 100 Standard: > 80% cache hit rate for static assets
    expect(cacheHitRate).toBeGreaterThan(0.8);
  });

  test('should handle slow network conditions', async ({ page }) => {
    // Simulate slow 3G network
    await page.context().route('**/*', async route => {
      await new Promise(resolve => setTimeout(resolve, 100)); // Add 100ms delay
      route.continue();
    });

    const startTime = Date.now();
    await page.goto('/dashboard');
    await page.waitForSelector('[data-testid="dashboard-container"]');
    const loadTime = Date.now() - startTime;

    console.log(`Slow network load time: ${loadTime}ms`);

    // Should still be usable on slow networks (< 5s)
    expect(loadTime).toBeLessThan(5000);

    // Critical content should be visible
    await expect(page.getByTestId('performance-metrics')).toBeVisible();
  });

  test('should optimize image loading', async ({ page }) => {
    await page.goto('/dashboard');

    const images = await page.locator('img').all();

    for (const img of images) {
      // Check for lazy loading
      const loading = await img.getAttribute('loading');
      const isAboveFold = await img.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return rect.top < window.innerHeight;
      });

      // Images above fold should load immediately, others should be lazy
      if (!isAboveFold) {
        expect(loading).toBe('lazy');
      }

      // Verify alt text for accessibility
      const altText = await img.getAttribute('alt');
      expect(altText).toBeTruthy();
    }
  });

  test('should handle concurrent user interactions', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForSelector('[data-testid="dashboard-container"]');

    // Simulate multiple rapid interactions
    const interactions = [
      () =>
        page
          .getByTestId('refresh-dashboard')
          .click()
          .catch(() => {}),
      () => page.keyboard.press('Tab'),
      () => page.mouse.move(100, 100),
      () => page.mouse.move(200, 200),
      () => page.keyboard.press('Escape'),
    ];

    // Execute interactions rapidly
    await Promise.all(interactions.map(interaction => interaction()));

    // Dashboard should remain responsive
    await expect(page.getByTestId('dashboard-container')).toBeVisible();

    // No JavaScript errors should occur
    const consoleMessages = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleMessages.push(msg.text());
      }
    });

    await page.waitForTimeout(1000);
    expect(consoleMessages.filter(msg => !msg.includes('favicon'))).toHaveLength(0);
  });
});
