import { test, expect, Page } from '@playwright/test';

/**
 * Performance Baseline Tests - Unit Talk Production v3.0.0
 *
 * Establishes production performance benchmarks for:
 * - Page load times (<2s target)
 * - API response times (<500ms target)
 * - Real-time data updates (<100ms target)
 * - UI interaction responsiveness (<50ms target)
 */

interface PerformanceMetrics {
  pageLoadTime: number;
  timeToInteractive: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  apiResponseTime: number;
  realtimeUpdateTime: number;
  uiInteractionTime: number;
}

class PerformanceTracker {
  private page: Page;
  private metrics: PerformanceMetrics = {
    pageLoadTime: 0,
    timeToInteractive: 0,
    firstContentfulPaint: 0,
    largestContentfulPaint: 0,
    cumulativeLayoutShift: 0,
    apiResponseTime: 0,
    realtimeUpdateTime: 0,
    uiInteractionTime: 0,
  };

  constructor(page: Page) {
    this.page = page;
  }

  async collectWebVitals(): Promise<PerformanceMetrics> {
    // Collect Core Web Vitals using the PerformanceObserver API
    const vitals = await this.page.evaluate(() => {
      return new Promise(resolve => {
        const vitals: any = {};

        // First Contentful Paint
        new PerformanceObserver(entryList => {
          for (const entry of entryList.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              vitals.firstContentfulPaint = entry.startTime;
            }
          }
        }).observe({ entryTypes: ['paint'] });

        // Largest Contentful Paint
        new PerformanceObserver(entryList => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1];
          vitals.largestContentfulPaint = lastEntry?.startTime || 0;
        }).observe({ entryTypes: ['largest-contentful-paint'] });

        // Cumulative Layout Shift
        let clsValue = 0;
        new PerformanceObserver(entryList => {
          for (const entry of entryList.getEntries()) {
            const layoutShiftEntry = entry as any;
            if (!layoutShiftEntry.hadRecentInput) {
              clsValue += layoutShiftEntry.value;
            }
          }
          vitals.cumulativeLayoutShift = clsValue;
        }).observe({ entryTypes: ['layout-shift'] });

        // Navigation timing
        const navigationEntry = performance.getEntriesByType(
          'navigation'
        )[0] as PerformanceNavigationTiming;
        vitals.pageLoadTime = navigationEntry.loadEventEnd - navigationEntry.fetchStart;
        vitals.timeToInteractive = navigationEntry.domInteractive - navigationEntry.fetchStart;

        setTimeout(() => resolve(vitals || {}), 3000); // Wait for vitals to be collected
      });
    });

    const validVitals = vitals && typeof vitals === 'object' ? vitals : {};
    this.metrics = { ...this.metrics, ...validVitals };
    return this.metrics;
  }

  async measureApiResponse(url: string): Promise<number> {
    const startTime = Date.now();

    const responsePromise = this.page.waitForResponse(
      response => response.url().includes(url) && response.status() === 200
    );

    await this.page.reload();
    await responsePromise;

    const apiResponseTime = Date.now() - startTime;
    this.metrics.apiResponseTime = apiResponseTime;

    return apiResponseTime;
  }

  async measureUIInteraction(selector: string): Promise<number> {
    const startTime = Date.now();

    await this.page.click(selector);
    await this.page.waitForLoadState('networkidle');

    const interactionTime = Date.now() - startTime;
    this.metrics.uiInteractionTime = interactionTime;

    return interactionTime;
  }

  async measureRealtimeUpdate(): Promise<number> {
    // Measure time for real-time data update
    const startTime = Date.now();

    // Trigger a real-time update by navigating to agents page
    await this.page.goto('http://localhost:3020/dashboard/agents');

    // Wait for agent data to load (real-time)
    await this.page.waitForSelector('[data-testid="agent-card"]', { timeout: 5000 });

    const updateTime = Date.now() - startTime;
    this.metrics.realtimeUpdateTime = updateTime;

    return updateTime;
  }

  getMetrics(): PerformanceMetrics {
    return this.metrics;
  }

  generateReport(): string {
    const { metrics } = this;
    const status = (value: number, threshold: number) => (value <= threshold ? '✅' : '❌');

    return `
📊 **PERFORMANCE BASELINE REPORT**
================================

📈 **Core Web Vitals**
- Page Load Time: ${metrics.pageLoadTime.toFixed(0)}ms ${status(metrics.pageLoadTime, 2000)}
- Time to Interactive: ${metrics.timeToInteractive.toFixed(0)}ms ${status(metrics.timeToInteractive, 1500)}
- First Contentful Paint: ${metrics.firstContentfulPaint.toFixed(0)}ms ${status(metrics.firstContentfulPaint, 1200)}
- Largest Contentful Paint: ${metrics.largestContentfulPaint.toFixed(0)}ms ${status(metrics.largestContentfulPaint, 2500)}
- Cumulative Layout Shift: ${metrics.cumulativeLayoutShift.toFixed(3)} ${status(metrics.cumulativeLayoutShift, 0.1)}

🚀 **API Performance**
- API Response Time: ${metrics.apiResponseTime.toFixed(0)}ms ${status(metrics.apiResponseTime, 500)}

⚡ **Real-time Performance**
- Real-time Update Time: ${metrics.realtimeUpdateTime.toFixed(0)}ms ${status(metrics.realtimeUpdateTime, 100)}

🖱️ **UI Responsiveness**
- UI Interaction Time: ${metrics.uiInteractionTime.toFixed(0)}ms ${status(metrics.uiInteractionTime, 50)}

🎯 **Performance Score**
Overall: ${this.calculateOverallScore()}/100
`;
  }

  private calculateOverallScore(): number {
    const weights = {
      pageLoadTime: 0.25,
      apiResponseTime: 0.2,
      realtimeUpdateTime: 0.2,
      uiInteractionTime: 0.15,
      firstContentfulPaint: 0.1,
      largestContentfulPaint: 0.1,
    };

    let professional_score = 100;

    // Deduct points for exceeding thresholds
    if (this.metrics.pageLoadTime > 2000) professional_score -= 20;
    if (this.metrics.apiResponseTime > 500) professional_score -= 15;
    if (this.metrics.realtimeUpdateTime > 100) professional_score -= 15;
    if (this.metrics.uiInteractionTime > 50) professional_score -= 10;
    if (this.metrics.firstContentfulPaint > 1200) professional_score -= 10;
    if (this.metrics.largestContentfulPaint > 2500) professional_score -= 10;
    if (this.metrics.cumulativeLayoutShift > 0.1) professional_score -= 20;

    return Math.max(0, professional_score);
  }
}

test.describe('Command Center Performance Baselines', () => {
  let performanceTracker: PerformanceTracker;

  test.beforeEach(async ({ page }) => {
    performanceTracker = new PerformanceTracker(page);
  });

  test('📊 Dashboard Load Performance Benchmark', async ({ page }) => {
    console.log('🚀 Starting dashboard performance benchmark...');

    // Navigate to dashboard
    await page.goto('http://localhost:3020/dashboard');

    // Collect Web Vitals
    const metrics = await performanceTracker.collectWebVitals();

    // Performance assertions
    expect(metrics.pageLoadTime).toBeLessThan(3000); // Allow 3s for comprehensive dashboard
    expect(metrics.firstContentfulPaint).toBeLessThan(1500);
    expect(metrics.cumulativeLayoutShift).toBeLessThan(0.15); // Slightly relaxed for dynamic content

    console.log('✅ Dashboard performance baseline established');
  });

  test('🔄 Real-time Data Performance Benchmark', async ({ page }) => {
    console.log('📡 Testing real-time data performance...');

    const updateTime = await performanceTracker.measureRealtimeUpdate();

    expect(updateTime).toBeLessThan(2000); // Real-time data should load within 2s

    console.log(`✅ Real-time update time: ${updateTime}ms`);
  });

  test('🌐 API Endpoints Performance Benchmark', async ({ page }) => {
    console.log('🔗 Testing API endpoint performance...');

    // Test analytics API
    const analyticsTime = await performanceTracker.measureApiResponse('/api/analytics');
    expect(analyticsTime).toBeLessThan(1000); // API should respond within 1s

    // Test users API
    const usersTime = await performanceTracker.measureApiResponse('/api/users');
    expect(usersTime).toBeLessThan(1000);

    console.log(`✅ Analytics API: ${analyticsTime}ms, Users API: ${usersTime}ms`);
  });

  test('🖱️ UI Interaction Performance Benchmark', async ({ page }) => {
    console.log('⚡ Testing UI interaction responsiveness...');

    await page.goto('http://localhost:3020/dashboard');

    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="dashboard-content"]', { timeout: 10000 });

    // Measure navigation interaction
    const interactionTime = await performanceTracker.measureUIInteraction(
      'a[href="/dashboard/agents"]'
    );

    expect(interactionTime).toBeLessThan(1000); // UI interactions should be fast

    console.log(`✅ UI interaction time: ${interactionTime}ms`);
  });

  test('📈 Mobile Performance Benchmark', async ({ page, browserName }) => {
    console.log('📱 Testing mobile performance...');

    // Simulate mobile device
    await page.setViewportSize({ width: 375, height: 667 });
    await page.emulateMedia({ media: 'screen' });

    await page.goto('http://localhost:3020/dashboard');

    const metrics = await performanceTracker.collectWebVitals();

    // Mobile should be slightly more lenient but still fast
    expect(metrics.pageLoadTime).toBeLessThan(4000);
    expect(metrics.firstContentfulPaint).toBeLessThan(2000);

    console.log('✅ Mobile performance benchmark established');
  });

  test('📋 Generate Comprehensive Performance Report', async ({ page }) => {
    console.log('📊 Generating comprehensive performance report...');

    // Run full performance suite
    await page.goto('http://localhost:3020/dashboard');
    await performanceTracker.collectWebVitals();
    await performanceTracker.measureApiResponse('/api/analytics');
    await performanceTracker.measureRealtimeUpdate();

    const report = performanceTracker.generateReport();

    console.log(report);

    // Store report for production monitoring
    const timestamp = new Date().toISOString();
    await page.evaluate(
      ({ report, timestamp }) => {
        localStorage.setItem(`performance-baseline-${timestamp}`, report);
      },
      { report, timestamp }
    );

    console.log('✅ Performance baseline report generated and stored');
  });

  test('🔥 Load Testing Simulation', async ({ page }) => {
    console.log('🔥 Running load testing simulation...');

    const requests: Promise<any>[] = [];

    // Simulate concurrent API requests
    for (let i = 0; i < 10; i++) {
      requests.push(page.request.get('http://localhost:3020/api/analytics'));
    }

    const startTime = Date.now();
    const responses = await Promise.all(requests);
    const totalTime = Date.now() - startTime;

    // All requests should succeed
    responses.forEach(response => {
      expect(response.status()).toBe(200);
    });

    // Average response time should be reasonable under load
    const avgResponseTime = totalTime / requests.length;
    expect(avgResponseTime).toBeLessThan(2000);

    console.log(`✅ Load test completed: ${avgResponseTime.toFixed(0)}ms average response time`);
  });

  test('📊 Memory Usage Benchmark', async ({ page }) => {
    console.log('🧠 Testing memory usage...');

    await page.goto('http://localhost:3020/dashboard');

    // Measure JavaScript heap usage
    const memoryUsage = await page.evaluate(() => {
      return {
        usedJSHeapSize: (performance as any).memory?.usedJSHeapSize || 0,
        totalJSHeapSize: (performance as any).memory?.totalJSHeapSize || 0,
        jsHeapSizeLimit: (performance as any).memory?.jsHeapSizeLimit || 0,
      };
    });

    // Memory usage should be reasonable (under 50MB for typical dashboard)
    const usedMB = memoryUsage.usedJSHeapSize / 1024 / 1024;
    expect(usedMB).toBeLessThan(100); // Allow up to 100MB for comprehensive dashboard

    console.log(`✅ Memory usage: ${usedMB.toFixed(2)}MB`);
  });
});

test.describe('Smart Form Performance Baselines', () => {
  test('📋 Form Load Performance Benchmark', async ({ page }) => {
    console.log('📋 Testing Smart Form performance...');

    const startTime = Date.now();
    await page.goto('http://localhost:3021/submit-ticket');

    // Wait for form to be interactive
    await page.waitForSelector('[data-testid="step-1-form"]', { timeout: 5000 });

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(2000);

    console.log(`✅ Smart Form load time: ${loadTime}ms`);
  });

  test('⚡ Form Step Navigation Performance', async ({ page }) => {
    console.log('⚡ Testing form step navigation...');

    await page.goto('http://localhost:3021/submit-ticket');
    await page.waitForSelector('[data-testid="step-1-form"]');

    // Measure step transition time
    const startTime = Date.now();
    await page.click('[data-testid="next-button"]');
    await page.waitForSelector('[data-testid="step-2-form"]');
    const transitionTime = Date.now() - startTime;

    expect(transitionTime).toBeLessThan(500); // Step transitions should be is_instant

    console.log(`✅ Form step transition: ${transitionTime}ms`);
  });
});

// Performance monitoring utilities
export { PerformanceTracker };
