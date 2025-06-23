import { QAConfig } from '../config/qa-config';
import { QATestResult } from '../types/qa-types';
import { createTimestamp, createQATestResult } from '../utils/test-utils';

// Optional playwright import - will be undefined if not installed
let Browser: any, Page: any, chromium: any;
try {
  const playwright = require('playwright');
  Browser = playwright.Browser;
  Page = playwright.Page;
  chromium = playwright.chromium;
} catch (error) {
  // Playwright not available - tests will use mock implementations
}

export class PerformanceTester {
  private config: QAConfig;
  private browser: typeof Browser | null = null;

  constructor(config: QAConfig) {
    this.config = config;
  }

  async runAllTests(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    
    try {
      if (chromium) {
        this.browser = await chromium.launch({ headless: this.config.test.headless });
      }
      
      results.push(...await this.testPageLoadPerformance());
      results.push(...await this.testAPIPerformance());
      results.push(...await this.testResourceLoading());
      results.push(...await this.testMemoryUsage());
      results.push(...await this.testNetworkPerformance());
      results.push(...await this.testDatabasePerformance());

    } catch (error) {
      results.push(createQATestResult(
        'Performance Test Suite',
        'FAIL',
        `Performance test suite failed: ${error}`,
        0
      ));
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }

    return results;
  }

  private async testPageLoadPerformance(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      if (!this.browser) {
        results.push(createQATestResult(
          'Page Load Performance',
          'SKIP',
          'Browser not available',
          Date.now() - startTime
        ));
        return results;
      }
      
      const page = await this.browser.newPage();
      
      const loadStartTime = Date.now();
      await page.goto(this.config.environment.baseUrl);
      const loadTime = Date.now() - loadStartTime;

      results.push(createQATestResult(
        'Page Load Performance',
        loadTime <= this.config.performance.maxPageLoadTime ? 'PASS' : 'WARNING',
        `Page loaded in ${loadTime}ms (max: ${this.config.performance.maxPageLoadTime}ms)`,
        Date.now() - startTime,
        { loadTime }
      ));
      
      await page.close();

    } catch (error) {
      results.push(createQATestResult(
        'Page Load Performance',
        'FAIL',
        `Test failed: ${error}`,
        Date.now() - startTime
      ));
    }

    return results;
  }

  private async testAPIPerformance(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      const endpoints = [
        '/api/health',
        '/api/picks',
        '/api/user/profile'
      ];

      for (const endpoint of endpoints) {
        const apiStartTime = Date.now();
        const response = await fetch(`${this.config.environment.apiUrl}${endpoint}`);
        const apiTime = Date.now() - apiStartTime;
        
        results.push(createQATestResult(
          `API Performance - ${endpoint}`,
          apiTime <= this.config.performance.maxApiResponseTime ? 'PASS' : 'WARNING',
          `${endpoint} responded in ${apiTime}ms (max: ${this.config.performance.maxApiResponseTime}ms)`,
          Date.now() - startTime,
          { apiTime, statusCode: response.status }
        ));
      }

    } catch (error) {
      results.push(createQATestResult(
        'API Performance',
        'FAIL',
        `Test failed: ${error}`,
        Date.now() - startTime
      ));
    }

    return results;
  }

  private async testResourceLoading(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      if (!this.browser) {
        results.push(createQATestResult(
          'Resource Loading',
          'SKIP',
          'Browser not available',
          Date.now() - startTime
        ));
        return results;
      }
      
      const page = await this.browser.newPage();
      
      // Monitor network requests
      const resourceSizes: any[] = [];
      page.on('response', (response: any) => {
        resourceSizes.push({
          url: response.url(),
          size: response.headers()['content-length'] || 0,
          type: response.headers()['content-type'] || 'unknown'
        });
      });
      
      await page.goto(this.config.environment.baseUrl);
      await page.waitForTimeout(2000); // Wait for resources to load
      
      const totalSize = resourceSizes.reduce((sum: number, r: any) => sum + parseInt(r.size || '0'), 0);
      
      results.push(createQATestResult(
        'Resource Loading',
        totalSize <= this.config.performance.maxResourceSize ? 'PASS' : 'WARNING',
        `Total resource size: ${Math.round(totalSize / 1024)}KB (max: ${Math.round(this.config.performance.maxResourceSize / 1024)}KB)`,
        Date.now() - startTime,
        { totalSize, resourceCount: resourceSizes.length }
      ));
      
      await page.close();

    } catch (error) {
      results.push(createQATestResult(
        'Resource Loading',
        'FAIL',
        `Test failed: ${error}`,
        Date.now() - startTime
      ));
    }

    return results;
  }

  private async testMemoryUsage(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      
      results.push(createQATestResult(
        'Memory Usage',
        heapUsedMB <= this.config.performance.maxMemoryUsage ? 'PASS' : 'WARNING',
        `Heap used: ${heapUsedMB}MB (max: ${this.config.performance.maxMemoryUsage}MB)`,
        Date.now() - startTime,
        { heapUsedMB, memUsage }
      ));

    } catch (error) {
      results.push(createQATestResult(
        'Memory Usage',
        'FAIL',
        `Test failed: ${error}`,
        Date.now() - startTime
      ));
    }

    return results;
  }

  private async testNetworkPerformance(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      const testUrls = [
        this.config.environment.baseUrl,
        this.config.environment.apiUrl + '/api/health'
      ];

      for (const url of testUrls) {
        const networkStartTime = Date.now();
        const response = await fetch(url);
        const networkTime = Date.now() - networkStartTime;
        
        results.push(createQATestResult(
          `Network Performance - ${new URL(url).pathname}`,
          networkTime <= this.config.performance.maxNetworkLatency ? 'PASS' : 'WARNING',
          `Network request completed in ${networkTime}ms (max: ${this.config.performance.maxNetworkLatency}ms)`,
          Date.now() - startTime,
          { networkTime, statusCode: response.status }
        ));
      }

    } catch (error) {
      results.push(createQATestResult(
        'Network Performance',
        'FAIL',
        `Test failed: ${error}`,
        Date.now() - startTime
      ));
    }

    return results;
  }

  private async testDatabasePerformance(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      // Test database query performance through API
      const dbStartTime = Date.now();
      const response = await fetch(`${this.config.environment.apiUrl}/api/health/db`);
      const dbTime = Date.now() - dbStartTime;
      
      results.push(createQATestResult(
        'Database Performance',
        dbTime <= this.config.performance.maxDatabaseQueryTime ? 'PASS' : 'WARNING',
        `Database query completed in ${dbTime}ms (max: ${this.config.performance.maxDatabaseQueryTime}ms)`,
        Date.now() - startTime,
        { dbTime, statusCode: response.status }
      ));

    } catch (error) {
      results.push(createQATestResult(
        'Database Performance',
        'FAIL',
        `Test failed: ${error}`,
        Date.now() - startTime
      ));
    }

    return results;
  }
}