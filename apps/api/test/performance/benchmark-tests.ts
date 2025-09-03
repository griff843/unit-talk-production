import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { Browser, Page, chromium } from 'playwright';

import { Database } from '../../src/db/types/supabase';
import { createMockUser, createMockPick } from '../utils/testData';

describe('Performance Benchmark Testing', () => {
  let browser: Browser;
  let page: Page;
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  beforeEach(async () => {
    page = await browser.newPage();
  });

  afterEach(async () => {
    await page.close();
  });

  afterAll(async () => {
    await browser.close();
  });

  describe('API Response Times', () => {
    it('should meet API response time targets', async () => {
      const endpoints = [
        '/api/picks',
        '/api/users/profile',
        '/api/analytics/performance',
        '/api/dashboard/summary',
        '/api/charts/data'
      ];

      const results = await Promise.all(endpoints.map(async endpoint => {
        const startTime = Date.now();
        const response = await fetch(`${process.env.APP_URL}${endpoint}`, {
          headers: {
            'Authorization': `Bearer ${process.env.TEST_TOKEN}`
          }
        });
        const duration = Date.now() - startTime;
        return { endpoint, duration, status: response.status };
      }));

      // Verify response times
      results.forEach(result => {
        expect(result.status).toBe(200);
        expect(result.duration).toBeLessThan(200); // 200ms target
      });

      // Calculate statistics
      const durations = results.map(r => r.duration);
      const avgDuration = durations.reduce((a, b) => a + b) / durations.length;
      const maxDuration = Math.max(...durations);

      expect(avgDuration).toBeLessThan(150); // 150ms average
      expect(maxDuration).toBeLessThan(300); // 300ms max
    });

    it('should meet database query time targets', async () => {
      const queries = [
        () => supabase.from('users').select().limit(10),
        () => supabase.from('daily_picks').select().limit(10),
        () => supabase.from('cappers').select().limit(10),
        () => supabase.rpc('calculate_win_rate', { user_id: 'test' }),
        () => supabase.rpc('generate_analytics', { timeframe: '7d' })
      ];

      const results = await Promise.all(queries.map(async query => {
        const startTime = Date.now();
        const result = await query();
        const duration = Date.now() - startTime;
        return { duration, error: result.error };
      }));

      // Verify query times
      results.forEach(result => {
        expect(result.error).toBeNull();
        expect(result.duration).toBeLessThan(50); // 50ms target
      });

      // Calculate statistics
      const durations = results.map(r => r.duration);
      const avgDuration = durations.reduce((a, b) => a + b) / durations.length;
      expect(avgDuration).toBeLessThan(30); // 30ms average
    });

    it('should meet WebSocket latency targets', async () => {
      const ws = new WebSocket(`${process.env.WS_URL}?token=${process.env.TEST_TOKEN}`);
      const latencies: number[] = [];

      // Measure round-trip time for 10 messages
      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();
        await new Promise<void>((resolve) => {
          ws.send(JSON.stringify({ type: 'ping', timestamp: startTime }));
          ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'pong') {
              latencies.push(Date.now() - startTime);
              resolve();
            }
          };
        });
        await new Promise(resolve => setTimeout(resolve, 100)); // Wait between pings
      }

      ws.close();

      // Verify latencies
      const avgLatency = latencies.reduce((a, b) => a + b) / latencies.length;
      const maxLatency = Math.max(...latencies);

      expect(avgLatency).toBeLessThan(100); // 100ms average
      expect(maxLatency).toBeLessThan(200); // 200ms max
    });
  });

  describe('Page Load Times', () => {
    it('should meet initial page load targets', async () => {
      const pages = [
        '/',
        '/dashboard',
        '/picks',
        '/analytics',
        '/settings'
      ];

      const results = await Promise.all(pages.map(async path => {
        const startTime = Date.now();
        await page.goto(`${process.env.APP_URL}${path}`);
        await page.waitForLoadState('networkidle');
        const duration = Date.now() - startTime;
        return { path, duration };
      }));

      // Verify load times
      results.forEach(result => {
        expect(result.duration).toBeLessThan(2000); // 2 seconds target
      });

      // Calculate statistics
      const durations = results.map(r => r.duration);
      const avgDuration = durations.reduce((a, b) => a + b) / durations.length;
      expect(avgDuration).toBeLessThan(1500); // 1.5 seconds average
    });

    it('should meet client-side navigation targets', async () => {
      // Initial load
      await page.goto(process.env.APP_URL!);
      await page.waitForLoadState('networkidle');

      const navigations = [
        () => page.click('[data-testid="nav-dashboard"]'),
        () => page.click('[data-testid="nav-picks"]'),
        () => page.click('[data-testid="nav-analytics"]'),
        () => page.click('[data-testid="nav-settings"]')
      ];

      const results = await Promise.all(navigations.map(async navigate => {
        const startTime = Date.now();
        await navigate();
        await page.waitForLoadState('networkidle');
        const duration = Date.now() - startTime;
        return duration;
      }));

      // Verify navigation times
      results.forEach(duration => {
        expect(duration).toBeLessThan(500); // 500ms target
      });

      // Calculate statistics
      const avgDuration = results.reduce((a, b) => a + b) / results.length;
      expect(avgDuration).toBeLessThan(300); // 300ms average
    });

    it('should meet component render time targets', async () => {
      await page.goto(`${process.env.APP_URL}/dashboard`);
      await page.waitForLoadState('networkidle');

      const components = [
        'performance-chart',
        'picks-table',
        'stats-summary',
        'leaderboard'
      ];

      const results = await Promise.all(components.map(async component => {
        const startTime = Date.now();
        await page.waitForSelector(`[data-testid="${component}"]`);
        const duration = Date.now() - startTime;
        return { component, duration };
      }));

      // Verify render times
      results.forEach(result => {
        expect(result.duration).toBeLessThan(1000); // 1 second target
      });

      // Calculate statistics
      const durations = results.map(r => r.duration);
      const avgDuration = durations.reduce((a, b) => a + b) / durations.length;
      expect(avgDuration).toBeLessThan(500); // 500ms average
    });
  });

  describe('Resource Loading', () => {
    it('should meet asset loading time targets', async () => {
      const client = await page.context().newCDPSession(page);
      await client.send('Network.enable');

      const resourceTimes: { [key: string]: number } = {};
      client.on('Network.responseReceived', event => {
        const url = new URL(event.response.url);
        const type = event.type;
        if (!resourceTimes[type]) {resourceTimes[type] = 0;}
        resourceTimes[type] += event.response.timing?.receiveHeadersEnd || 0;
      });

      await page.goto(process.env.APP_URL!);
      await page.waitForLoadState('networkidle');

      // Verify resource load times
      expect(resourceTimes['Script']).toBeLessThan(1000); // 1 second for scripts
      expect(resourceTimes['Stylesheet']).toBeLessThan(500); // 500ms for styles
      expect(resourceTimes['Image']).toBeLessThan(2000); // 2 seconds for images
    });

    it('should meet bundle size targets', async () => {
      const client = await page.context().newCDPSession(page);
      await client.send('Network.enable');

      const bundleSizes: { [key: string]: number } = {};
      client.on('Network.responseReceived', event => {
        const url = new URL(event.response.url);
        if (url.pathname.endsWith('.js')) {
          bundleSizes[url.pathname] = event.response.encodedDataLength;
        }
      });

      await page.goto(process.env.APP_URL!);
      await page.waitForLoadState('networkidle');

      // Verify bundle sizes
      Object.values(bundleSizes).forEach(size => {
        expect(size).toBeLessThan(500000); // 500KB max per bundle
      });

      const totalSize = Object.values(bundleSizes).reduce((a, b) => a + b, 0);
      expect(totalSize).toBeLessThan(2000000); // 2MB total JS
    });

    it('should meet caching performance targets', async () => {
      // First visit (uncached)
      const uncachedStart = Date.now();
      await page.goto(process.env.APP_URL!);
      await page.waitForLoadState('networkidle');
      const uncachedDuration = Date.now() - uncachedStart;

      // Second visit (cached)
      const cachedStart = Date.now();
      await page.goto(process.env.APP_URL!);
      await page.waitForLoadState('networkidle');
      const cachedDuration = Date.now() - cachedStart;

      // Verify caching improvement
      expect(cachedDuration).toBeLessThan(uncachedDuration * 0.5);
    });
  });

  describe('Performance Metrics', () => {
    it('should meet Core Web Vitals targets', async () => {
      const navigationStart = Date.now();
      await page.goto(process.env.APP_URL!);

      // First Contentful Paint (FCP)
      const fcpHandle = await page.evaluateHandle(() =>
        new Promise(resolve => {
          performance.getEntriesByType('paint').forEach(entry => {
            if (entry.name === 'first-contentful-paint') {
              resolve(entry.startTime);
            }
          });
        })
      );
      const fcp = await fcpHandle.jsonValue();
      expect(fcp).toBeLessThan(1800); // 1.8s target

      // Largest Contentful Paint (LCP)
      const lcp = await page.evaluate(() =>
        new Promise(resolve => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            resolve(lastEntry.startTime);
          }).observe({ type: 'largest-contentful-paint', buffered: true });
        })
      );
      expect(lcp).toBeLessThan(2500); // 2.5s target

      // Cumulative Layout Shift (CLS)
      const cls = await page.evaluate(() =>
        new Promise(resolve => {
          let clsValue = 0;
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!entry.hadRecentInput) {
                clsValue += entry.value;
              }
            }
            resolve(clsValue);
          }).observe({ type: 'layout-shift', buffered: true });
        })
      );
      expect(cls).toBeLessThan(0.1); // 0.1 target

      // First Input Delay (FID)
      const fid = await page.evaluate(() =>
        new Promise(resolve => {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              resolve(entry.processingStart - entry.startTime);
            }
          }).observe({ type: 'first-input', buffered: true });
        })
      );
      expect(fid).toBeLessThan(100); // 100ms target
    });

    it('should meet Time to Interactive target', async () => {
      const tti = await page.evaluate(() =>
        new Promise(resolve => {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            observer.disconnect();
            resolve(entries[0].startTime);
          });
          observer.observe({ entryTypes: ['longtask'] });
        })
      );

      expect(tti).toBeLessThan(3500); // 3.5s target
    });

    it('should meet memory usage targets', async () => {
      const memory = await page.evaluate(() => (performance as any).memory);
      
      expect(memory.usedJSHeapSize).toBeLessThan(50 * 1024 * 1024); // 50MB target
      expect(memory.totalJSHeapSize).toBeLessThan(100 * 1024 * 1024); // 100MB target
    });
  });
}); 