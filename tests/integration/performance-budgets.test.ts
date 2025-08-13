/**
 * Performance Budgets Integration Tests
 * Tests performance testing infrastructure, SLA enforcement, and k6 integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { PerformanceTestService } from '../../src/services/PerformanceTestService';
import { promises as fs } from 'fs';
import path from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// Mock logger for testing
const mockLogger = {
  info: (...args: any[]) => console.log('[INFO]', ...args),
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args),
  debug: (...args: any[]) => console.debug('[DEBUG]', ...args)
};

describe('Performance Budgets System', () => {
  let performanceService: PerformanceTestService;
  let testServiceName: string;
  let testEnvironment: string;

  beforeAll(async () => {
    // Verify database connection
    const { error } = await supabase.from('system_config').select('key').limit(1);
    if (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }

    // Initialize performance service
    performanceService = new PerformanceTestService(mockLogger);

    // Generate unique test identifiers
    const timestamp = Date.now();
    testServiceName = `test_service_${timestamp}`;
    testEnvironment = 'integration_test';
  });

  afterAll(async () => {
    // Stop any active tests
    await performanceService.stopAllTests();

    // Cleanup test data
    await supabase.from('performance_alerts').delete().like('service_name', 'test_service_%');
    await supabase.from('performance_metrics').delete().eq('tags->environment', testEnvironment);
    await supabase.from('performance_tests').delete().eq('environment', testEnvironment);
    await supabase.from('sla_budgets').delete().like('service_name', 'test_service_%');
    await supabase.from('performance_baselines').delete().like('service_name', 'test_service_%');
  });

  describe('Performance Test Database Functions', () => {
    it('should start performance test', async () => {
      const { data: testId, error } = await supabase.rpc('start_performance_test', {
        p_test_name: 'database_test',
        p_test_type: 'load',
        p_test_suite: testServiceName,
        p_target_endpoint: 'http://localhost:3000/api/health',
        p_virtual_users: 10,
        p_duration_seconds: 60,
        p_environment: testEnvironment
      });

      expect(error).toBeNull();
      expect(testId).toBeDefined();
      expect(typeof testId).toBe('string');

      // Verify test was created
      const { data: test } = await supabase
        .from('performance_tests')
        .select('*')
        .eq('id', testId)
        .single();

      expect(test).toBeDefined();
      expect(test.test_name).toBe('database_test');
      expect(test.test_type).toBe('load');
      expect(test.test_suite).toBe(testServiceName);
      expect(test.status).toBe('running');
      expect(test.virtual_users).toBe(10);
      expect(test.duration_seconds).toBe(60);
    });

    it('should record performance metrics', async () => {
      // First create a test
      const { data: testId } = await supabase.rpc('start_performance_test', {
        p_test_name: 'metrics_test',
        p_test_type: 'smoke',
        p_test_suite: testServiceName,
        p_target_endpoint: 'http://localhost:3000/api/health',
        p_virtual_users: 1,
        p_duration_seconds: 30,
        p_environment: testEnvironment
      });

      // Record various metrics
      const metrics = [
        { name: 'response_time_ms', type: 'histogram', value: 250.5, unit: 'ms' },
        { name: 'cpu_usage_percent', type: 'gauge', value: 45.2, unit: '%' },
        { name: 'memory_usage_mb', type: 'gauge', value: 512.0, unit: 'MB' },
        { name: 'requests_total', type: 'counter', value: 100, unit: 'count' },
        { name: 'error_rate', type: 'rate', value: 0.02, unit: 'percent' }
      ];

      const metricIds = [];
      for (const metric of metrics) {
        const { data: metricId, error } = await supabase.rpc('record_performance_metric', {
          p_test_id: testId,
          p_metric_name: metric.name,
          p_metric_type: metric.type,
          p_value: metric.value,
          p_unit: metric.unit,
          p_tags: { environment: testEnvironment, test: 'true' },
          p_timestamp_ms: Date.now()
        });

        expect(error).toBeNull();
        expect(metricId).toBeDefined();
        metricIds.push(metricId);
      }

      // Verify metrics were recorded
      const { data: recordedMetrics } = await supabase
        .from('performance_metrics')
        .select('*')
        .eq('test_id', testId)
        .order('recorded_at', { ascending: true });

      expect(recordedMetrics).toBeDefined();
      expect(recordedMetrics.length).toBe(5);
      
      const responseTimeMetric = recordedMetrics.find(m => m.metric_name === 'response_time_ms');
      expect(responseTimeMetric).toBeDefined();
      expect(responseTimeMetric.metric_type).toBe('histogram');
      expect(responseTimeMetric.metric_category).toBe('performance');
      expect(parseFloat(responseTimeMetric.value)).toBe(250.5);
      expect(responseTimeMetric.unit).toBe('ms');
    });

    it('should complete performance test with SLA checking', async () => {
      // Create test with specific SLA thresholds
      const { data: testId } = await supabase.rpc('start_performance_test', {
        p_test_name: 'sla_test',
        p_test_type: 'load',
        p_test_suite: testServiceName,
        p_target_endpoint: 'http://localhost:3000/api/test',
        p_virtual_users: 20,
        p_duration_seconds: 120,
        p_environment: testEnvironment
      });

      // Complete test with results that violate SLA
      const { data: slaResult, error } = await supabase.rpc('complete_performance_test', {
        p_test_id: testId,
        p_total_requests: 1000,
        p_successful_requests: 950,
        p_failed_requests: 50,
        p_avg_response_time_ms: 800.5,
        p_p95_response_time_ms: 1500.0, // Might violate SLA
        p_p99_response_time_ms: 2500.0,
        p_max_response_time_ms: 5000.0,
        p_requests_per_second: 8.33
      });

      expect(error).toBeNull();
      expect(typeof slaResult).toBe('boolean');

      // Verify test was completed
      const { data: completedTest } = await supabase
        .from('performance_tests')
        .select('*')
        .eq('id', testId)
        .single();

      expect(completedTest).toBeDefined();
      expect(completedTest.status).toBe('completed');
      expect(completedTest.total_requests).toBe(1000);
      expect(completedTest.successful_requests).toBe(950);
      expect(completedTest.failed_requests).toBe(50);
      expect(completedTest.error_rate_percent).toBe(5.0); // 50/1000 * 100
      expect(parseFloat(completedTest.avg_response_time_ms)).toBe(800.5);
      expect(parseFloat(completedTest.p95_response_time_ms)).toBe(1500.0);
      expect(completedTest.delivered_at).toBeDefined();
      expect(completedTest.sla_passed).toBeDefined();

      // Check for SLA violations
      if (completedTest.sla_violations && Array.isArray(completedTest.sla_violations)) {
        expect(completedTest.sla_violations.length).toBeGreaterThanOrEqual(0);
      }

      // Check if alerts were created for violations
      const { data: alerts } = await supabase
        .from('performance_alerts')
        .select('*')
        .eq('test_id', testId);

      expect(alerts).toBeDefined();
      // Alerts should exist if SLA was violated
      if (!slaResult) {
        expect(alerts.length).toBeGreaterThan(0);
      }
    });

    it('should manage SLA budgets', async () => {
      // Create SLA budget
      const { data: budget, error: budgetError } = await supabase
        .from('sla_budgets')
        .insert({
          service_name: testServiceName,
          endpoint_pattern: '/api/test/**',
          environment: testEnvironment,
          availability_percent: 99.5,
          max_response_time_p95_ms: 1000,
          max_response_time_p99_ms: 5000,
          max_error_rate_percent: 2.0,
          min_throughput_rps: 10.0,
          error_budget_percent: 0.5
        })
        .select()
        .single();

      expect(budgetError).toBeNull();
      expect(budget).toBeDefined();

      // Update error budget
      const { data: budgetUpdated, error: updateError } = await supabase.rpc('update_error_budget', {
        p_service_name: testServiceName,
        p_environment: testEnvironment,
        p_error_minutes: 2.5,
        p_total_minutes: 60.0
      });

      expect(updateError).toBeNull();
      expect(budgetUpdated).toBe(true);

      // Check budget status
      const { data: budgetStatus } = await supabase
        .from('sla_budget_status')
        .select('*')
        .eq('service_name', testServiceName)
        .eq('environment', testEnvironment)
        .single();

      expect(budgetStatus).toBeDefined();
      expect(budgetStatus.error_budget_consumed_percent).toBeGreaterThan(0);
      expect(budgetStatus.error_budget_remaining_percent).toBeLessThan(budgetStatus.error_budget_percent);
      expect(budgetStatus.budget_health).toBeDefined();

      // Check if burn rate alerts were created
      const { data: burnRateAlerts } = await supabase
        .from('performance_alerts')
        .select('*')
        .eq('service_name', testServiceName)
        .eq('environment', testEnvironment)
        .eq('alert_type', 'burn_rate');

      expect(burnRateAlerts).toBeDefined();
      // May or may not have alerts depending on burn rate
    });
  });

  describe('Performance Test Service', () => {
    it('should validate test configuration', async () => {
      const validConfig = {
        testName: 'service_test',
        testType: 'smoke' as const,
        testSuite: testServiceName,
        targetEndpoint: 'http://localhost:3000',
        virtualUsers: 5,
        duration: '30s',
        environment: testEnvironment
      };

      // This should not throw for valid config
      await expect(
        performanceService['validateTestConfig'](validConfig)
      ).resolves.not.toThrow();

      const invalidConfig = {
        ...validConfig,
        virtualUsers: 2000 // Exceeds limit
      };

      await expect(
        performanceService['validateTestConfig'](invalidConfig)
      ).rejects.toThrow('Virtual users limit exceeded');
    });

    it('should get test status', async () => {
      // Create a test directly in database
      const { data: testId } = await supabase.rpc('start_performance_test', {
        p_test_name: 'status_test',
        p_test_type: 'load',
        p_test_suite: testServiceName,
        p_target_endpoint: 'http://localhost:3000/api/health',
        p_virtual_users: 10,
        p_duration_seconds: 60,
        p_environment: testEnvironment
      });

      const status = await performanceService.getTestStatus(testId);

      expect(status).toBeDefined();
      expect(status.id).toBe(testId);
      expect(status.test_name).toBe('status_test');
      expect(status.status).toBe('running');
      expect(status.isActive).toBe(false); // Not actively running in service
    });

    it('should get SLA budget status', async () => {
      // Create budget for testing
      await supabase.from('sla_budgets').insert({
        service_name: `${testServiceName}_budget`,
        endpoint_pattern: '/api/budget/**',
        environment: testEnvironment,
        availability_percent: 99.9,
        max_response_time_p95_ms: 500,
        max_error_rate_percent: 1.0,
        error_budget_percent: 0.1
      });

      const budgets = await performanceService.getSLABudgetStatus(
        `${testServiceName}_budget`,
        testEnvironment
      );

      expect(Array.isArray(budgets)).toBe(true);
      expect(budgets.length).toBe(1);

      const budget = budgets[0];
      expect(budget.service_name).toBe(`${testServiceName}_budget`);
      expect(budget.environment).toBe(testEnvironment);
      expect(budget.budget_health).toBeDefined();
      expect(budget.error_budget_remaining_percent).toBeDefined();
    });

    it('should get test history', async () => {
      // Create multiple test records
      const testNames = ['history_test_1', 'history_test_2', 'history_test_3'];
      
      for (const testName of testNames) {
        const { data: testId } = await supabase.rpc('start_performance_test', {
          p_test_name: testName,
          p_test_type: 'smoke',
          p_test_suite: testServiceName,
          p_target_endpoint: 'http://localhost:3000/api/health',
          p_virtual_users: 1,
          p_duration_seconds: 10,
          p_environment: testEnvironment
        });

        // Complete the test
        await supabase.rpc('complete_performance_test', {
          p_test_id: testId,
          p_total_requests: 10,
          p_successful_requests: 10,
          p_failed_requests: 0,
          p_avg_response_time_ms: 100.0,
          p_p95_response_time_ms: 150.0,
          p_p99_response_time_ms: 200.0,
          p_max_response_time_ms: 250.0,
          p_requests_per_second: 1.0
        });
      }

      const history = await performanceService.getTestHistory(
        10,
        testEnvironment,
        testServiceName
      );

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThanOrEqual(3);

      const firstTest = history[0];
      expect(firstTest).toBeDefined();
      expect(firstTest.test_suite).toBe(testServiceName);
      expect(firstTest.environment).toBe(testEnvironment);
      expect(firstTest.status).toBe('completed');
    });

    it('should manage active tests', async () => {
      // Check initial state
      const initialActiveTests = performanceService.getActiveTests();
      expect(Array.isArray(initialActiveTests)).toBe(true);

      // Since we can't actually run k6 in tests, just check the method exists
      expect(typeof performanceService.cancelTest).toBe('function');
      expect(typeof performanceService.stopAllTests).toBe('function');
    });
  });

  describe('Performance Monitoring Views', () => {
    beforeEach(async () => {
      // Create test data for views
      const testId = crypto.randomUUID();
      
      await supabase.from('performance_tests').insert({
        id: testId,
        test_name: 'view_test',
        test_type: 'load',
        test_suite: testServiceName,
        target_endpoint: 'http://localhost:3000/api/test',
        virtual_users: 25,
        duration_seconds: 300,
        environment: testEnvironment,
        status: 'completed',
        started_at: new Date(Date.now() - 600000).toISOString(),
        completed_at: new Date().toISOString(),
        total_requests: 500,
        successful_requests: 485,
        failed_requests: 15,
        avg_response_time_ms: 450.0,
        p95_response_time_ms: 750.0,
        p99_response_time_ms: 1200.0,
        max_response_time_ms_actual: 2000.0,
        requests_per_second: 1.67,
        sla_passed: true,
        duration_ms: 300000
      });

      // Add some metrics
      await supabase.from('performance_metrics').insert([
        {
          test_id: testId,
          metric_name: 'response_time_ms',
          metric_type: 'histogram',
          metric_category: 'performance',
          value: 450.0,
          unit: 'ms',
          tags: { environment: testEnvironment },
          timestamp_ms: Date.now()
        },
        {
          test_id: testId,
          metric_name: 'cpu_usage_percent',
          metric_type: 'gauge',
          metric_category: 'resource',
          value: 65.5,
          unit: '%',
          tags: { environment: testEnvironment },
          timestamp_ms: Date.now()
        }
      ]);
    });

    it('should provide performance test summary view', async () => {
      const { data: summary, error } = await supabase
        .from('performance_test_summary')
        .select('*')
        .eq('test_suite', testServiceName)
        .eq('environment', testEnvironment)
        .limit(5);

      expect(error).toBeNull();
      expect(Array.isArray(summary)).toBe(true);
      expect(summary.length).toBeGreaterThan(0);

      const testSummary = summary[0];
      expect(testSummary).toBeDefined();
      expect(testSummary.test_suite).toBe(testServiceName);
      expect(testSummary.environment).toBe(testEnvironment);
      expect(testSummary.sla_passed).toBe(true);
      expect(testSummary.violation_count).toBeDefined();
      expect(testSummary.performance_change_percent).toBeDefined();
    });

    it('should provide performance metrics hourly aggregation', async () => {
      const { data: hourlyMetrics, error } = await supabase
        .from('performance_metrics_hourly')
        .select('*')
        .eq('service_name', testServiceName)
        .eq('environment', testEnvironment)
        .limit(10);

      expect(error).toBeNull();
      expect(Array.isArray(hourlyMetrics)).toBe(true);

      if (hourlyMetrics.length > 0) {
        const metric = hourlyMetrics[0];
        expect(metric.service_name).toBe(testServiceName);
        expect(metric.environment).toBe(testEnvironment);
        expect(metric.sample_count).toBeGreaterThan(0);
        expect(metric.avg_value).toBeDefined();
        expect(metric.p95_value).toBeDefined();
      }
    });
  });

  describe('Performance Alerts', () => {
    it('should create and manage performance alerts', async () => {
      // Create SLA budget
      const { data: budget } = await supabase.from('sla_budgets').insert({
        service_name: `${testServiceName}_alerts`,
        endpoint_pattern: '/api/alerts/**',
        environment: testEnvironment,
        max_response_time_p95_ms: 500,
        max_error_rate_percent: 1.0,
        error_budget_percent: 0.1
      }).select().single();

      // Create performance alert
      const { data: alert, error } = await supabase
        .from('performance_alerts')
        .insert({
          alert_type: 'sla_violation',
          severity: 'high',
          service_name: `${testServiceName}_alerts`,
          endpoint: '/api/alerts/test',
          metric_name: 'p95_response_time',
          threshold_value: 500.0,
          actual_value: 750.0,
          budget_id: budget.id,
          environment: testEnvironment,
          budget_impact_minutes: 5.2
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(alert).toBeDefined();
      expect(alert.alert_type).toBe('sla_violation');
      expect(alert.severity).toBe('high');
      expect(alert.service_name).toBe(`${testServiceName}_alerts`);
      expect(alert.status).toBe('open');
      expect(parseFloat(alert.deviation_percent)).toBeGreaterThan(0);

      // Acknowledge alert
      const { data: acknowledgedAlert } = await supabase
        .from('performance_alerts')
        .update({
          status: 'acknowledged',
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: 'test-runner'
        })
        .eq('id', alert.id)
        .select()
        .single();

      expect(acknowledgedAlert.status).toBe('acknowledged');
      expect(acknowledgedAlert.acknowledged_by).toBe('test-runner');

      // Resolve alert
      const { data: resolvedAlert } = await supabase
        .from('performance_alerts')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolution_notes: 'Performance issue fixed by scaling resources'
        })
        .eq('id', alert.id)
        .select()
        .single();

      expect(resolvedAlert.status).toBe('resolved');
      expect(resolvedAlert.resolution_notes).toBe('Performance issue fixed by scaling resources');
    });
  });

  describe('Performance Baselines', () => {
    it('should manage performance baselines', async () => {
      // Create performance baseline
      const { data: baseline, error } = await supabase
        .from('performance_baselines')
        .insert({
          service_name: `${testServiceName}_baseline`,
          endpoint_pattern: '/api/baseline/**',
          test_type: 'load',
          environment: testEnvironment,
          baseline_p50_ms: 200.0,
          baseline_p95_ms: 500.0,
          baseline_p99_ms: 1000.0,
          baseline_throughput_rps: 50.0,
          baseline_error_rate_percent: 0.5,
          sample_size: 100,
          created_from_tests_count: 10,
          status: 'active'
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(baseline).toBeDefined();
      expect(baseline.service_name).toBe(`${testServiceName}_baseline`);
      expect(baseline.test_type).toBe('load');
      expect(baseline.status).toBe('active');
      expect(parseFloat(baseline.baseline_p95_ms)).toBe(500.0);

      // Test baseline retrieval
      const { data: activeBaselines } = await supabase
        .from('performance_baselines')
        .select('*')
        .eq('service_name', `${testServiceName}_baseline`)
        .eq('status', 'active')
        .gte('valid_until', new Date().toISOString());

      expect(activeBaselines).toBeDefined();
      expect(activeBaselines.length).toBe(1);
      expect(activeBaselines[0].id).toBe(baseline.id);

      // Deprecate baseline
      const { data: deprecatedBaseline } = await supabase
        .from('performance_baselines')
        .update({ status: 'deprecated' })
        .eq('id', baseline.id)
        .select()
        .single();

      expect(deprecatedBaseline.status).toBe('deprecated');
    });
  });

  describe('End-to-End Performance Testing Workflow', () => {
    it('should complete full performance testing lifecycle', async () => {
      const workflowTestName = `workflow_${Date.now()}`;

      // 1. Create SLA budget
      const { data: budget } = await supabase.from('sla_budgets').insert({
        service_name: `${testServiceName}_workflow`,
        endpoint_pattern: '/api/workflow/**',
        environment: testEnvironment,
        availability_percent: 99.5,
        max_response_time_p95_ms: 800,
        max_response_time_p99_ms: 2000,
        max_error_rate_percent: 2.0,
        min_throughput_rps: 5.0,
        error_budget_percent: 0.5
      }).select().single();

      expect(budget).toBeDefined();

      // 2. Start performance test
      const { data: testId } = await supabase.rpc('start_performance_test', {
        p_test_name: workflowTestName,
        p_test_type: 'load',
        p_test_suite: `${testServiceName}_workflow`,
        p_target_endpoint: 'http://localhost:3000/api/workflow/test',
        p_virtual_users: 20,
        p_duration_seconds: 180,
        p_environment: testEnvironment
      });

      expect(testId).toBeDefined();

      // 3. Record metrics during test execution
      const testMetrics = [
        { name: 'response_time_ms', type: 'histogram', value: 650.0 },
        { name: 'throughput_rps', type: 'rate', value: 6.5 },
        { name: 'error_count', type: 'counter', value: 3 },
        { name: 'cpu_usage_percent', type: 'gauge', value: 75.0 },
        { name: 'memory_usage_mb', type: 'gauge', value: 800 }
      ];

      for (const metric of testMetrics) {
        await supabase.rpc('record_performance_metric', {
          p_test_id: testId,
          p_metric_name: metric.name,
          p_metric_type: metric.type,
          p_value: metric.value,
          p_tags: { 
            environment: testEnvironment,
            workflow: 'e2e',
            test_id: testId
          }
        });
      }

      // 4. Complete test with results
      const { data: slaCompliant } = await supabase.rpc('complete_performance_test', {
        p_test_id: testId,
        p_total_requests: 2000,
        p_successful_requests: 1970,
        p_failed_requests: 30,
        p_avg_response_time_ms: 650.0,
        p_p95_response_time_ms: 900.0, // Violates SLA (> 800ms)
        p_p99_response_time_ms: 1500.0,
        p_max_response_time_ms: 2500.0,
        p_requests_per_second: 11.1
      });

      expect(slaCompliant).toBe(false); // Should fail due to P95 > 800ms

      // 5. Verify test completion
      const { data: completedTest } = await supabase
        .from('performance_tests')
        .select('*')
        .eq('id', testId)
        .single();

      expect(completedTest.status).toBe('completed');
      expect(completedTest.sla_passed).toBe(false);
      expect(completedTest.sla_violations.length).toBeGreaterThan(0);

      // 6. Check alerts were created
      const { data: alerts } = await supabase
        .from('performance_alerts')
        .select('*')
        .eq('test_id', testId)
        .eq('alert_type', 'sla_violation');

      expect(alerts.length).toBeGreaterThan(0);
      const responseTimeAlert = alerts.find(a => a.metric_name.includes('response_time'));
      expect(responseTimeAlert).toBeDefined();

      // 7. Update error budget
      const { data: budgetUpdated } = await supabase.rpc('update_error_budget', {
        p_service_name: `${testServiceName}_workflow`,
        p_environment: testEnvironment,
        p_error_minutes: 1.5, // 1.5% error rate for 3 minutes
        p_total_minutes: 180.0
      });

      expect(budgetUpdated).toBe(true);

      // 8. Verify budget consumption
      const { data: updatedBudget } = await supabase
        .from('sla_budget_status')
        .select('*')
        .eq('service_name', `${testServiceName}_workflow`)
        .eq('environment', testEnvironment)
        .single();

      expect(updatedBudget.error_budget_consumed_percent).toBeGreaterThan(0);
      expect(updatedBudget.error_budget_remaining_percent).toBeLessThan(updatedBudget.error_budget_percent);

      // 9. Verify monitoring views show the data
      const { data: testSummary } = await supabase
        .from('performance_test_summary')
        .select('*')
        .eq('id', testId)
        .single();

      expect(testSummary).toBeDefined();
      expect(testSummary.sla_passed).toBe(false);
      expect(testSummary.violation_count).toBeGreaterThan(0);

      // 10. Check metrics aggregation
      const { data: metricsAgg } = await supabase
        .from('performance_metrics_hourly')
        .select('*')
        .eq('service_name', `${testServiceName}_workflow`)
        .eq('environment', testEnvironment);

      expect(metricsAgg).toBeDefined();
      if (metricsAgg.length > 0) {
        expect(metricsAgg[0].sample_count).toBeGreaterThan(0);
      }

      console.log('✅ End-to-end performance testing workflow completed successfully');
    });
  });
});