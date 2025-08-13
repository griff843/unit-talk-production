/**
 * Performance Test Service - Orchestrates k6 tests and manages SLA budgets
 * Integrates with database for comprehensive performance monitoring
 */

import { createClient } from '@supabase/supabase-js';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

export interface PerformanceTestConfig {
  testName: string;
  testType: 'load' | 'stress' | 'spike' | 'volume' | 'endurance' | 'smoke';
  testSuite: string;
  targetEndpoint: string;
  virtualUsers: number;
  duration: string;
  rampUpTime?: string;
  environment: string;
  slaThresholds?: {
    maxResponseTimeMs: number;
    maxErrorRatePercent: number;
    minThroughputRps: number;
    maxCpuPercent?: number;
    maxMemoryMb?: number;
  };
  budgetCategory?: 'critical' | 'high' | 'standard' | 'background';
  tags?: Record<string, string>;
}

export interface PerformanceTestResult {
  testId: string;
  success: boolean;
  slaCompliance: {
    responseTime: boolean;
    errorRate: boolean;
    throughput: boolean;
    overall: boolean;
  };
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgResponseTimeMs: number;
    p95ResponseTimeMs: number;
    p99ResponseTimeMs: number;
    maxResponseTimeMs: number;
    requestsPerSecond: number;
    errorRatePercent: number;
  };
  violations: Array<{
    type: string;
    threshold: number;
    actual: number;
    metric: string;
  }>;
  duration: number;
  report?: {
    htmlPath?: string;
    jsonPath?: string;
    summaryPath?: string;
  };
}

export class PerformanceTestService extends EventEmitter {
  private supabase: ReturnType<typeof createClient>;
  private logger: any;
  private activeTests: Map<string, ChildProcess> = new Map();
  private testResults: Map<string, PerformanceTestResult> = new Map();

  constructor(logger: any = console) {
    super();
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    this.logger = logger;
  }

  /**
   * Execute performance test with comprehensive monitoring
   */
  async executeTest(config: PerformanceTestConfig): Promise<PerformanceTestResult> {
    this.logger.info('Starting performance test', {
      testName: config.testName,
      testType: config.testType,
      virtualUsers: config.virtualUsers,
      duration: config.duration
    });

    // Validate configuration
    await this.validateTestConfig(config);

    // Start test in database
    const testId = await this.startPerformanceTest(config);

    try {
      // Execute k6 test
      const k6Result = await this.executeK6Test(config, testId);

      // Process results
      const result = await this.processTestResults(testId, k6Result, config);

      // Update SLA budgets
      await this.updateSLABudgets(config, result);

      // Complete test in database
      await this.completePerformanceTest(testId, result);

      this.logger.info('Performance test completed', {
        testId,
        slaCompliance: result.slaCompliance.overall,
        violationsCount: result.violations.length
      });

      this.emit('testCompleted', { testId, result });
      return result;

    } catch (error) {
      this.logger.error('Performance test failed', { testId, error });

      // Mark test as failed
      await this.failPerformanceTest(testId, error);

      throw error;
    } finally {
      this.activeTests.delete(testId);
    }
  }

  /**
   * Run test suite with multiple test types
   */
  async executeTestSuite(
    baseName: string,
    environment: string,
    testSuite: string,
    targetEndpoint: string
  ): Promise<PerformanceTestResult[]> {
    this.logger.info('Starting performance test suite', { baseName, environment, testSuite });

    const testConfigs: PerformanceTestConfig[] = [
      // Smoke test - basic functionality
      {
        testName: `${baseName}_smoke`,
        testType: 'smoke',
        testSuite,
        targetEndpoint,
        virtualUsers: 1,
        duration: '30s',
        environment,
        budgetCategory: 'standard',
        slaThresholds: {
          maxResponseTimeMs: 2000,
          maxErrorRatePercent: 1.0,
          minThroughputRps: 1.0
        }
      },
      // Load test - normal expected load
      {
        testName: `${baseName}_load`,
        testType: 'load',
        testSuite,
        targetEndpoint,
        virtualUsers: 50,
        duration: '5m',
        rampUpTime: '1m',
        environment,
        budgetCategory: 'standard',
        slaThresholds: {
          maxResponseTimeMs: 1000,
          maxErrorRatePercent: 2.0,
          minThroughputRps: 10.0
        }
      },
      // Stress test - above normal capacity
      {
        testName: `${baseName}_stress`,
        testType: 'stress',
        testSuite,
        targetEndpoint,
        virtualUsers: 100,
        duration: '3m',
        environment,
        budgetCategory: 'high',
        slaThresholds: {
          maxResponseTimeMs: 2000,
          maxErrorRatePercent: 5.0,
          minThroughputRps: 20.0
        }
      }
    ];

    const results: PerformanceTestResult[] = [];
    
    for (const config of testConfigs) {
      try {
        const result = await this.executeTest(config);
        results.push(result);

        // Stop if critical test fails
        if (config.budgetCategory === 'critical' && !result.slaCompliance.overall) {
          this.logger.warn('Critical performance test failed, stopping suite');
          break;
        }

      } catch (error) {
        this.logger.error('Test in suite failed', { testName: config.testName, error });
        // Continue with next test
      }

      // Cool-down period between tests
      await new Promise(resolve => setTimeout(resolve, 30000));
    }

    return results;
  }

  /**
   * Validate test configuration
   */
  private async validateTestConfig(config: PerformanceTestConfig): Promise<void> {
    // Check if target endpoint is accessible
    try {
      const response = await fetch(`${config.targetEndpoint}/health`, {
        method: 'GET',
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`Target endpoint not healthy: ${response.status}`);
      }
    } catch (error) {
      throw new Error(`Cannot reach target endpoint: ${error.message}`);
    }

    // Validate resource limits
    if (config.virtualUsers > 1000) {
      throw new Error('Virtual users limit exceeded (max: 1000)');
    }

    const durationSeconds = this.parseDuration(config.duration);
    if (durationSeconds > 3600) {
      throw new Error('Test duration limit exceeded (max: 1 hour)');
    }
  }

  /**
   * Execute k6 test
   */
  private async executeK6Test(
    config: PerformanceTestConfig,
    testId: string
  ): Promise<any> {
    const scriptPath = path.join(process.cwd(), 'scripts', 'performance', 'k6-test-runner.js');
    const reportsDir = path.join(process.cwd(), 'reports', 'performance', testId);
    
    // Ensure reports directory exists
    await fs.mkdir(reportsDir, { recursive: true });

    const env = {
      ...process.env,
      BASE_URL: config.targetEndpoint,
      ENVIRONMENT: config.environment,
      TEST_TYPE: config.testType,
      TEST_SUITE: config.testSuite,
      VIRTUAL_USERS: config.virtualUsers.toString(),
      DURATION: config.duration,
      RAMP_UP_TIME: config.rampUpTime || '30s',
      SLA_RESPONSE_TIME: config.slaThresholds?.maxResponseTimeMs?.toString() || '1000',
      SLA_ERROR_RATE: config.slaThresholds?.maxErrorRatePercent?.toString() || '5.0',
      SLA_THROUGHPUT: config.slaThresholds?.minThroughputRps?.toString() || '10.0',
      DB_REPORTING: 'true',
      TEST_ID: testId
    };

    const args = [
      'run',
      '--summary-export', path.join(reportsDir, 'summary.json'),
      '--out', `json=${path.join(reportsDir, 'results.json')}`,
      scriptPath
    ];

    return new Promise((resolve, reject) => {
      const k6Process = spawn('k6', args, {
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.activeTests.set(testId, k6Process);

      let stdout = '';
      let stderr = '';

      k6Process.stdout.on('data', (data) => {
        stdout += data.toString();
        this.logger.debug('K6 stdout', { testId, data: data.toString() });
        this.emit('testOutput', { testId, type: 'stdout', data: data.toString() });
      });

      k6Process.stderr.on('data', (data) => {
        stderr += data.toString();
        this.logger.debug('K6 stderr', { testId, data: data.toString() });
        this.emit('testOutput', { testId, type: 'stderr', data: data.toString() });
      });

      k6Process.on('close', async (code) => {
        this.activeTests.delete(testId);

        if (code === 0) {
          try {
            // Read summary JSON
            const summaryPath = path.join(reportsDir, 'summary.json');
            const summaryData = await fs.readFile(summaryPath, 'utf-8');
            const summary = JSON.parse(summaryData);

            resolve({
              exitCode: code,
              stdout,
              stderr,
              summary,
              reportsDir
            });
          } catch (error) {
            reject(new Error(`Failed to read test results: ${error.message}`));
          }
        } else {
          reject(new Error(`K6 test failed with exit code ${code}: ${stderr}`));
        }
      });

      k6Process.on('error', (error) => {
        this.activeTests.delete(testId);
        reject(new Error(`Failed to start k6: ${error.message}`));
      });

      // Set timeout
      const timeout = setTimeout(() => {
        k6Process.kill('SIGTERM');
        reject(new Error('Test execution timeout'));
      }, (this.parseDuration(config.duration) + 300) * 1000); // Add 5 minutes buffer

      k6Process.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Process test results and determine SLA compliance
   */
  private async processTestResults(
    testId: string,
    k6Result: any,
    config: PerformanceTestConfig
  ): Promise<PerformanceTestResult> {
    const summary = k6Result.summary;
    const metrics = summary.metrics || {};

    // Extract key metrics
    const totalRequests = metrics.http_reqs?.values?.count || 0;
    const failedRequests = metrics.http_req_failed?.values?.count || 0;
    const successfulRequests = totalRequests - failedRequests;
    const avgResponseTime = metrics.http_req_duration?.values?.avg || 0;
    const p95ResponseTime = metrics.http_req_duration?.values?.['p(95)'] || 0;
    const p99ResponseTime = metrics.http_req_duration?.values?.['p(99)'] || 0;
    const maxResponseTime = metrics.http_req_duration?.values?.max || 0;
    const requestsPerSecond = metrics.http_reqs?.values?.rate || 0;
    const errorRatePercent = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;

    // Determine SLA compliance
    const slaThresholds = config.slaThresholds || {
      maxResponseTimeMs: 1000,
      maxErrorRatePercent: 5.0,
      minThroughputRps: 10.0
    };

    const slaCompliance = {
      responseTime: p95ResponseTime <= slaThresholds.maxResponseTimeMs,
      errorRate: errorRatePercent <= slaThresholds.maxErrorRatePercent,
      throughput: requestsPerSecond >= slaThresholds.minThroughputRps,
      overall: false
    };
    slaCompliance.overall = slaCompliance.responseTime && slaCompliance.errorRate && slaCompliance.throughput;

    // Collect violations
    const violations: Array<{ type: string; threshold: number; actual: number; metric: string }> = [];

    if (!slaCompliance.responseTime) {
      violations.push({
        type: 'response_time',
        threshold: slaThresholds.maxResponseTimeMs,
        actual: p95ResponseTime,
        metric: 'p95_response_time_ms'
      });
    }

    if (!slaCompliance.errorRate) {
      violations.push({
        type: 'error_rate',
        threshold: slaThresholds.maxErrorRatePercent,
        actual: errorRatePercent,
        metric: 'error_rate_percent'
      });
    }

    if (!slaCompliance.throughput) {
      violations.push({
        type: 'throughput',
        threshold: slaThresholds.minThroughputRps,
        actual: requestsPerSecond,
        metric: 'requests_per_second'
      });
    }

    // Add violations from k6 summary if available
    if (summary.sla_results?.violations) {
      violations.push(...summary.sla_results.violations);
    }

    return {
      testId,
      success: k6Result.exitCode === 0 && slaCompliance.overall,
      slaCompliance,
      metrics: {
        totalRequests,
        successfulRequests,
        failedRequests,
        avgResponseTimeMs: avgResponseTime,
        p95ResponseTimeMs: p95ResponseTime,
        p99ResponseTimeMs: p99ResponseTime,
        maxResponseTimeMs: maxResponseTime,
        requestsPerSecond,
        errorRatePercent
      },
      violations,
      duration: summary.state?.testRunDurationMs || 0,
      report: {
        htmlPath: path.join(k6Result.reportsDir, 'summary.html'),
        jsonPath: path.join(k6Result.reportsDir, 'summary.json'),
        summaryPath: path.join(k6Result.reportsDir, 'results.json')
      }
    };
  }

  /**
   * Update SLA budgets based on test results
   */
  private async updateSLABudgets(
    config: PerformanceTestConfig,
    result: PerformanceTestResult
  ): Promise<void> {
    if (!result.slaCompliance.overall) {
      const errorMinutes = (result.duration / 1000 / 60) * (result.metrics.errorRatePercent / 100);
      const totalMinutes = result.duration / 1000 / 60;

      await this.supabase.rpc('update_error_budget', {
        p_service_name: config.testSuite,
        p_environment: config.environment,
        p_error_minutes: errorMinutes,
        p_total_minutes: totalMinutes
      });
    }
  }

  /**
   * Start performance test in database
   */
  private async startPerformanceTest(config: PerformanceTestConfig): Promise<string> {
    const { data: testId, error } = await this.supabase.rpc('start_performance_test', {
      p_test_name: config.testName,
      p_test_type: config.testType,
      p_test_suite: config.testSuite,
      p_target_endpoint: config.targetEndpoint,
      p_virtual_users: config.virtualUsers,
      p_duration_seconds: this.parseDuration(config.duration),
      p_environment: config.environment
    });

    if (error) {
      throw new Error(`Failed to start performance test: ${error.message}`);
    }

    return testId;
  }

  /**
   * Complete performance test in database
   */
  private async completePerformanceTest(
    testId: string,
    result: PerformanceTestResult
  ): Promise<void> {
    const { error } = await this.supabase.rpc('complete_performance_test', {
      p_test_id: testId,
      p_total_requests: result.metrics.totalRequests,
      p_successful_requests: result.metrics.successfulRequests,
      p_failed_requests: result.metrics.failedRequests,
      p_avg_response_time_ms: result.metrics.avgResponseTimeMs,
      p_p95_response_time_ms: result.metrics.p95ResponseTimeMs,
      p_p99_response_time_ms: result.metrics.p99ResponseTimeMs,
      p_max_response_time_ms: result.metrics.maxResponseTimeMs,
      p_requests_per_second: result.metrics.requestsPerSecond
    });

    if (error) {
      this.logger.error('Failed to complete performance test', { testId, error });
    }
  }

  /**
   * Mark performance test as failed
   */
  private async failPerformanceTest(testId: string, error: any): Promise<void> {
    await this.supabase
      .from('performance_tests')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - new Date().getTime(), // Approximate
        sla_passed: false,
        sla_violations: [
          {
            type: 'execution_failure',
            error: error.message,
            timestamp: new Date().toISOString()
          }
        ]
      })
      .eq('id', testId);
  }

  /**
   * Cancel active test
   */
  async cancelTest(testId: string): Promise<boolean> {
    const process = this.activeTests.get(testId);
    if (process) {
      process.kill('SIGTERM');
      this.activeTests.delete(testId);

      // Update database
      await this.supabase
        .from('performance_tests')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString()
        })
        .eq('id', testId);

      return true;
    }
    return false;
  }

  /**
   * Get test status
   */
  async getTestStatus(testId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('performance_tests')
      .select('*')
      .eq('id', testId)
      .single();

    if (error) {
      throw new Error(`Failed to get test status: ${error.message}`);
    }

    return {
      ...data,
      isActive: this.activeTests.has(testId),
      result: this.testResults.get(testId)
    };
  }

  /**
   * Get SLA budget status
   */
  async getSLABudgetStatus(serviceName?: string, environment?: string): Promise<any[]> {
    let query = this.supabase.from('sla_budget_status').select('*');

    if (serviceName) {
      query = query.eq('service_name', serviceName);
    }
    if (environment) {
      query = query.eq('environment', environment);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get SLA budget status: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get performance test history
   */
  async getTestHistory(
    limit: number = 50,
    environment?: string,
    testSuite?: string
  ): Promise<any[]> {
    let query = this.supabase
      .from('performance_test_summary')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);

    if (environment) {
      query = query.eq('environment', environment);
    }
    if (testSuite) {
      query = query.eq('test_suite', testSuite);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get test history: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Parse duration string to seconds
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smh])$/);
    if (!match) {
      throw new Error(`Invalid duration format: ${duration}`);
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      default: return 60;
    }
  }

  /**
   * Get active tests
   */
  getActiveTests(): string[] {
    return Array.from(this.activeTests.keys());
  }

  /**
   * Stop all active tests
   */
  async stopAllTests(): Promise<void> {
    const testIds = Array.from(this.activeTests.keys());
    await Promise.all(testIds.map(testId => this.cancelTest(testId)));
  }
}

// Export for easy integration
export async function createPerformanceTestService(logger?: any): Promise<PerformanceTestService> {
  return new PerformanceTestService(logger);
}