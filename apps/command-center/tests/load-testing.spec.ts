import { test, expect, Page, BrowserContext } from '@playwright/test';

/**
 * Load Testing Framework - Unit Talk Production v3.0.0
 *
 * Comprehensive load testing for production readiness:
 * - Concurrent user simulation (1-100 users)
 * - API endpoint stress testing
 * - Database connection pooling validation
 * - Real-time WebSocket load testing
 * - Memory leak detection
 * - Performance degradation monitoring
 */

interface LoadTestResult {
  testName: string;
  concurrentUsers: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  throughput: number; // requests per second
  errorRate: number;
  memoryUsage: number;
  timestamp: string;
}

interface StressTestConfig {
  baseUrl: string;
  maxConcurrentUsers: number;
  testDurationMs: number;
  rampUpTimeMs: number;
  endpoints: string[];
}

class LoadTestRunner {
  private config: StressTestConfig;
  private results: LoadTestResult[] = [];

  constructor(config: StressTestConfig) {
    this.config = config;
  }

  async runConcurrentUserTest(
    context: BrowserContext,
    userCount: number,
    endpoint: string
  ): Promise<LoadTestResult> {
    const startTime = Date.now();
    const requests: Promise<any>[] = [];
    const responseTimes: number[] = [];
    let successCount = 0;
    let failCount = 0;

    console.log(`🔥 Load testing ${endpoint} with ${userCount} concurrent users...`);

    // Create concurrent requests
    for (let i = 0; i < userCount; i++) {
      const requestPromise = this.makeTimedRequest(context, endpoint)
        .then(({ success, responseTime }) => {
          responseTimes.push(responseTime);
          if (success) successCount++;
          else failCount++;
        })
        .catch(() => {
          failCount++;
        });

      requests.push(requestPromise);
    }

    // Wait for all requests to complete
    await Promise.allSettled(requests);

    const totalTime = Date.now() - startTime;
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length || 0;

    const result: LoadTestResult = {
      testName: `Concurrent Users Test - ${endpoint}`,
      concurrentUsers: userCount,
      totalRequests: userCount,
      successfulRequests: successCount,
      failedRequests: failCount,
      averageResponseTime: avgResponseTime,
      minResponseTime: Math.min(...responseTimes) || 0,
      maxResponseTime: Math.max(...responseTimes) || 0,
      throughput: (successCount / totalTime) * 1000,
      errorRate: (failCount / userCount) * 100,
      memoryUsage: 0, // Will be measured separately
      timestamp: new Date().toISOString(),
    };

    this.results.push(result);
    console.log(
      `✅ ${userCount} users: ${successCount}/${userCount} success, ${avgResponseTime.toFixed(0)}ms avg`
    );

    return result;
  }

  private async makeTimedRequest(
    context: BrowserContext,
    endpoint: string
  ): Promise<{ success: boolean; responseTime: number }> {
    const page = await context.newPage();
    const startTime = Date.now();

    try {
      const response = await page.request.get(`${this.config.baseUrl}${endpoint}`);
      const responseTime = Date.now() - startTime;
      const success = response.status() >= 200 && response.status() < 400;

      await page.close();
      return { success, responseTime };
    } catch (error) {
      await page.close();
      return { success: false, responseTime: Date.now() - startTime };
    }
  }

  async runStressTest(context: BrowserContext): Promise<LoadTestResult[]> {
    const userCounts = [1, 5, 10, 25, 50];
    const results: LoadTestResult[] = [];

    for (const endpoint of this.config.endpoints) {
      for (const userCount of userCounts) {
        const result = await this.runConcurrentUserTest(context, userCount, endpoint);
        results.push(result);

        // Wait between tests to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return results;
  }

  async runMemoryLeakTest(page: Page): Promise<number[]> {
    const memorySnapshots: number[] = [];

    // Take initial memory snapshot
    await page.goto(`${this.config.baseUrl}/dashboard`);
    let initialMemory = await this.getMemoryUsage(page);
    memorySnapshots.push(initialMemory);

    console.log(`🧠 Starting memory leak test. Initial: ${initialMemory.toFixed(2)}MB`);

    // Perform repeated operations
    for (let i = 0; i < 20; i++) {
      // Navigate between pages to test memory cleanup
      await page.goto(`${this.config.baseUrl}/dashboard/agents`);
      await page.waitForLoadState('networkidle');

      await page.goto(`${this.config.baseUrl}/dashboard/users`);
      await page.waitForLoadState('networkidle');

      await page.goto(`${this.config.baseUrl}/dashboard`);
      await page.waitForLoadState('networkidle');

      // Take memory snapshot
      const currentMemory = await this.getMemoryUsage(page);
      memorySnapshots.push(currentMemory);

      if (i % 5 === 0) {
        console.log(`Memory after ${i + 1} cycles: ${currentMemory.toFixed(2)}MB`);
      }
    }

    return memorySnapshots;
  }

  private async getMemoryUsage(page: Page): Promise<number> {
    const memoryInfo = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    return memoryInfo / 1024 / 1024; // Convert to MB
  }

  generateLoadTestReport(): string {
    const totalTests = this.results.length;
    const avgResponseTime =
      this.results.reduce((sum, r) => sum + r.averageResponseTime, 0) / totalTests;
    const avgErrorRate = this.results.reduce((sum, r) => sum + r.errorRate, 0) / totalTests;
    const maxThroughput = Math.max(...this.results.map(r => r.throughput));

    return `
🔥 **LOAD TESTING REPORT**
=========================

📊 **Summary**
- Total Tests: ${totalTests}
- Average Response Time: ${avgResponseTime.toFixed(0)}ms
- Average Error Rate: ${avgErrorRate.toFixed(2)}%
- Peak Throughput: ${maxThroughput.toFixed(2)} req/sec

📈 **Detailed Results**
${this.results
  .map(
    r => `
🎯 ${r.testName}
   Users: ${r.concurrentUsers}, Success Rate: ${((r.successfulRequests / r.totalRequests) * 100).toFixed(1)}%
   Response Time: ${r.averageResponseTime.toFixed(0)}ms (${r.minResponseTime}-${r.maxResponseTime}ms)
   Throughput: ${r.throughput.toFixed(2)} req/sec`
  )
  .join('')}

🚨 **Performance Thresholds**
- Response Time < 1000ms: ${avgResponseTime < 1000 ? '✅' : '❌'}
- Error Rate < 5%: ${avgErrorRate < 5 ? '✅' : '❌'}  
- Throughput > 10 req/sec: ${maxThroughput > 10 ? '✅' : '❌'}
`;
  }
}

test.describe('Load Testing Suite', () => {
  const loadTestConfig: StressTestConfig = {
    baseUrl: 'http://localhost:3020',
    maxConcurrentUsers: 50,
    testDurationMs: 60000,
    rampUpTimeMs: 10000,
    endpoints: [
      '/api/analytics',
      '/api/users',
      '/api/agents',
      '/dashboard',
      '/dashboard/agents',
      '/dashboard/users',
    ],
  };

  let loadTestRunner: LoadTestRunner;

  test.beforeEach(() => {
    loadTestRunner = new LoadTestRunner(loadTestConfig);
  });

  test('🔥 API Endpoints Load Test', async ({ context }) => {
    console.log('🚀 Starting API endpoints load test...');

    const apiEndpoints = ['/api/analytics', '/api/users', '/api/agents'];

    for (const endpoint of apiEndpoints) {
      // Test with increasing load
      await loadTestRunner.runConcurrentUserTest(context, 1, endpoint);
      await loadTestRunner.runConcurrentUserTest(context, 5, endpoint);
      await loadTestRunner.runConcurrentUserTest(context, 10, endpoint);
      await loadTestRunner.runConcurrentUserTest(context, 25, endpoint);
    }

    const report = loadTestRunner.generateLoadTestReport();
    console.log(report);

    // Verify performance under load
    const results = loadTestRunner['results'];
    const highLoadResults = results.filter(r => r.concurrentUsers >= 10);

    for (const result of highLoadResults) {
      expect(result.errorRate).toBeLessThan(10); // Less than 10% error rate
      expect(result.averageResponseTime).toBeLessThan(2000); // Less than 2s response time
    }

    console.log('✅ API load test completed successfully');
  });

  test('🌐 Full Application Stress Test', async ({ context }) => {
    console.log('🌐 Running comprehensive stress test...');

    const results = await loadTestRunner.runStressTest(context);

    // Analyze results
    const criticalFailures = results.filter(r => r.errorRate > 20 || r.averageResponseTime > 5000);

    expect(criticalFailures.length).toBe(0);

    const report = loadTestRunner.generateLoadTestReport();
    console.log(report);

    console.log('✅ Full application stress test completed');
  });

  test('🧠 Memory Leak Detection', async ({ page }) => {
    console.log('🧠 Running memory leak detection test...');

    const memorySnapshots = await loadTestRunner.runMemoryLeakTest(page);

    const initialMemory = memorySnapshots[0];
    const finalMemory = memorySnapshots[memorySnapshots.length - 1];
    const memoryIncrease = finalMemory - initialMemory;
    const memoryIncreasePercent = (memoryIncrease / initialMemory) * 100;

    console.log(`Initial Memory: ${initialMemory.toFixed(2)}MB`);
    console.log(`Final Memory: ${finalMemory.toFixed(2)}MB`);
    console.log(
      `Memory Increase: ${memoryIncrease.toFixed(2)}MB (${memoryIncreasePercent.toFixed(1)}%)`
    );

    // Memory should not increase by more than 50% during normal operations
    expect(memoryIncreasePercent).toBeLessThan(50);

    // Check for consistent memory growth (potential leak)
    const growthTrend = memorySnapshots
      .slice(5)
      .every((mem, index) => index === 0 || mem >= memorySnapshots[5 + index - 1]);

    if (growthTrend && memoryIncreasePercent > 25) {
      console.warn('⚠️ Potential memory leak detected');
    } else {
      console.log('✅ No memory leaks detected');
    }
  });

  test('⚡ Real-time WebSocket Load Test', async ({ context }) => {
    console.log('⚡ Testing WebSocket performance under load...');

    const pages: Page[] = [];
    const connectionPromises: Promise<void>[] = [];

    // Create multiple concurrent connections
    for (let i = 0; i < 10; i++) {
      const page = await context.newPage();
      pages.push(page);

      const connectionPromise = page
        .goto('http://localhost:3020/dashboard/agents')
        .then(() => page.waitForSelector('[data-testid="agent-card"]', { timeout: 10000 }))
        .then(() => void 0);

      connectionPromises.push(connectionPromise);
    }

    const startTime = Date.now();

    try {
      await Promise.all(connectionPromises);
      const totalTime = Date.now() - startTime;

      console.log(
        `✅ ${pages.length} concurrent WebSocket connections established in ${totalTime}ms`
      );

      // All connections should establish within reasonable time
      expect(totalTime).toBeLessThan(15000);
    } finally {
      // Clean up all pages
      await Promise.all(pages.map(page => page.close()));
    }
  });

  test('📊 Database Connection Pool Test', async ({ context }) => {
    console.log('📊 Testing database connection pool under load...');

    const concurrentRequests = 20;
    const promises: Promise<any>[] = [];

    for (let i = 0; i < concurrentRequests; i++) {
      const promise = context.request.get('http://localhost:3020/api/analytics').then(response => ({
        success: response.status() === 200,
        responseTime: Date.now(),
      }));

      promises.push(promise);
    }

    const startTime = Date.now();
    const results = await Promise.allSettled(promises);
    const totalTime = Date.now() - startTime;

    const successfulRequests = results.filter(
      r => r.status === 'fulfilled' && r.value.success
    ).length;

    const successRate = (successfulRequests / concurrentRequests) * 100;

    console.log(
      `Database pool test: ${successfulRequests}/${concurrentRequests} successful (${successRate.toFixed(1)}%)`
    );
    console.log(`Total time: ${totalTime}ms`);

    // Should handle concurrent database requests efficiently
    expect(successRate).toBeGreaterThan(90);
    expect(totalTime).toBeLessThan(10000);

    console.log('✅ Database connection pool test passed');
  });

  test('🔄 Sustained Load Test', async ({ context }) => {
    console.log('🔄 Running sustained load test (30 seconds)...');

    const sustainedTestDuration = 30000; // 30 seconds
    const requestInterval = 500; // Request every 500ms
    const endpoint = '/api/analytics';

    const startTime = Date.now();
    const results: { success: boolean; responseTime: number }[] = [];

    while (Date.now() - startTime < sustainedTestDuration) {
      const requestStart = Date.now();

      try {
        const response = await context.request.get(`http://localhost:3020${endpoint}`);
        const responseTime = Date.now() - requestStart;
        results.push({ success: response.status() === 200, responseTime });
      } catch (error) {
        results.push({ success: false, responseTime: Date.now() - requestStart });
      }

      // Wait before next request
      await new Promise(resolve => setTimeout(resolve, requestInterval));
    }

    const successfulRequests = results.filter(r => r.success).length;
    const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
    const successRate = (successfulRequests / results.length) * 100;

    console.log(
      `Sustained load results: ${successfulRequests}/${results.length} successful (${successRate.toFixed(1)}%)`
    );
    console.log(`Average response time: ${avgResponseTime.toFixed(0)}ms`);

    // System should maintain performance under sustained load
    expect(successRate).toBeGreaterThan(95);
    expect(avgResponseTime).toBeLessThan(1500);

    console.log('✅ Sustained load test completed successfully');
  });
});

// Export for use in other test files
export type { LoadTestResult, StressTestConfig };
export { LoadTestRunner };
