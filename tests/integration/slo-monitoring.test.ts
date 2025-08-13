/**
 * SLO Monitoring: Integration tests for burn-rate alerts and Temporal canary
 * Tests SLO tracking, burn-rate calculations, and canary workflow monitoring
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { TemporalCanaryService } from '../../src/services/TemporalCanaryService';

// Mock WorkflowClient for testing
class MockWorkflowClient {
  private shouldSucceed: boolean = true;
  private executionDelay: number = 1000;

  setShouldSucceed(succeed: boolean) {
    this.shouldSucceed = succeed;
  }

  setExecutionDelay(delay: number) {
    this.executionDelay = delay;
  }

  async start(workflowType: string, options: any) {
    const workflowId = options.workflowId;
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    return {
      execution: { runId },
      result: async () => {
        await new Promise(resolve => setTimeout(resolve, this.executionDelay));
        
        if (!this.shouldSucceed) {
          throw new Error('Mock workflow failure');
        }

        return {
          success: true,
          duration: this.executionDelay,
          workflowId,
          runId,
          timestamp: new Date().toISOString()
        };
      }
    };
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

describe('SLO Monitoring System', () => {
  let mockWorkflowClient: MockWorkflowClient;
  let canaryService: TemporalCanaryService;
  let testSloName: string;
  let testAlertName: string;

  beforeAll(async () => {
    // Verify database connection
    const { error } = await supabase.from('system_config').select('key').limit(1);
    if (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }

    // Setup mock Temporal client
    mockWorkflowClient = new MockWorkflowClient();
    canaryService = new TemporalCanaryService(mockWorkflowClient as any, supabase);
  });

  beforeEach(() => {
    // Generate unique test identifiers
    const timestamp = Date.now();
    testSloName = `test_slo_${timestamp}`;
    testAlertName = `test_alert_${timestamp}`;
    
    // Reset mock client to success state
    mockWorkflowClient.setShouldSucceed(true);
    mockWorkflowClient.setExecutionDelay(1000);
  });

  afterAll(async () => {
    // Stop canary service if running
    canaryService.stop();

    // Cleanup test data
    await supabase.from('slo_measurements').delete().like('slo_name', 'test_slo_%');
    await supabase.from('burn_rate_alerts').delete().like('alert_name', 'test_alert_%');
    await supabase.from('temporal_canary_results').delete().like('workflow_id', 'canary-%');
    await supabase.from('monitoring_alerts').delete().eq('alert_type', 'temporal_canary');
  });

  describe('SLO Measurement Recording', () => {
    it('should record availability SLO measurement', async () => {
      const { data, error } = await supabase.rpc('record_slo_measurement', {
        p_slo_name: testSloName,
        p_slo_type: 'availability',
        p_measurement_window_minutes: 5,
        p_total_requests: 1000,
        p_successful_requests: 990,
        p_slo_target: 0.99,
        p_labels: { service: 'api', environment: 'test' }
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(typeof data).toBe('string'); // UUID

      // Verify measurement was stored
      const { data: measurement } = await supabase
        .from('slo_measurements')
        .select('*')
        .eq('slo_name', testSloName)
        .single();

      expect(measurement).toBeDefined();
      expect(measurement.slo_type).toBe('availability');
      expect(measurement.total_requests).toBe(1000);
      expect(measurement.successful_requests).toBe(990);
      expect(measurement.actual_performance).toBe(0.99);
      expect(measurement.slo_compliance).toBe(true);
    });

    it('should record latency SLO measurement', async () => {
      const { data, error } = await supabase.rpc('record_slo_measurement', {
        p_slo_name: testSloName,
        p_slo_type: 'latency',
        p_measurement_window_minutes: 5,
        p_total_requests: 1000,
        p_successful_requests: 950, // 95% meeting latency target
        p_slo_target: 0.95,
        p_latency_metrics: {
          p50: 45.2,
          p95: 198.5,
          p99: 445.8,
          avg: 78.3
        }
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // Verify latency metrics were stored
      const { data: measurement } = await supabase
        .from('slo_measurements')
        .select('*')
        .eq('slo_name', testSloName)
        .single();

      expect(measurement.slo_type).toBe('latency');
      expect(measurement.p95_latency_ms).toBe(198.5);
      expect(measurement.actual_performance).toBe(0.95);
      expect(measurement.slo_compliance).toBe(true);
    });

    it('should handle SLO violation correctly', async () => {
      const { data, error } = await supabase.rpc('record_slo_measurement', {
        p_slo_name: testSloName,
        p_slo_type: 'availability',
        p_measurement_window_minutes: 5,
        p_total_requests: 1000,
        p_successful_requests: 980, // 98% - below 99% target
        p_slo_target: 0.99
      });

      expect(error).toBeNull();

      const { data: measurement } = await supabase
        .from('slo_measurements')
        .select('*')
        .eq('slo_name', testSloName)
        .single();

      expect(measurement.actual_performance).toBe(0.98);
      expect(measurement.slo_compliance).toBe(false);
      expect(measurement.error_budget_consumed).toBeGreaterThan(0);
    });
  });

  describe('Burn Rate Calculation', () => {
    beforeEach(async () => {
      // Create test SLO measurement
      await supabase.rpc('record_slo_measurement', {
        p_slo_name: testSloName,
        p_slo_type: 'availability',
        p_measurement_window_minutes: 5,
        p_total_requests: 1000,
        p_successful_requests: 980, // 98% performance
        p_slo_target: 0.99 // 99% target
      });
    });

    it('should calculate burn rate correctly', async () => {
      const { data, error } = await supabase.rpc('calculate_burn_rate', {
        p_slo_name: testSloName,
        p_lookback_minutes: 5
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(typeof data).toBe('number');
      
      // For 99% SLO with 98% actual: (0.99 - 0.98) / (1 - 0.99) = 0.01 / 0.01 = 1.0
      expect(data).toBe(1.0);
    });

    it('should return zero burn rate for perfect performance', async () => {
      // Record perfect performance
      await supabase.rpc('record_slo_measurement', {
        p_slo_name: `${testSloName}_perfect`,
        p_slo_type: 'availability',
        p_measurement_window_minutes: 5,
        p_total_requests: 1000,
        p_successful_requests: 1000, // 100% performance
        p_slo_target: 0.99
      });

      const { data, error } = await supabase.rpc('calculate_burn_rate', {
        p_slo_name: `${testSloName}_perfect`,
        p_lookback_minutes: 5
      });

      expect(error).toBeNull();
      expect(data).toBe(0);
    });

    it('should return zero burn rate when no data available', async () => {
      const { data, error } = await supabase.rpc('calculate_burn_rate', {
        p_slo_name: 'nonexistent_slo',
        p_lookback_minutes: 5
      });

      expect(error).toBeNull();
      expect(data).toBe(0);
    });
  });

  describe('Burn Rate Alert Evaluation', () => {
    beforeEach(async () => {
      // Create test burn rate alert
      await supabase.from('burn_rate_alerts').insert({
        alert_name: testAlertName,
        slo_name: testSloName,
        severity: 'warning',
        lookback_window_minutes: 5,
        burn_rate_threshold: 2.0,
        min_duration_minutes: 1,
        description: 'Test burn rate alert'
      });
    });

    it('should trigger alert when burn rate exceeds threshold', async () => {
      // Create SLO measurement that violates burn rate
      await supabase.rpc('record_slo_measurement', {
        p_slo_name: testSloName,
        p_slo_type: 'availability',
        p_measurement_window_minutes: 5,
        p_total_requests: 1000,
        p_successful_requests: 970, // 97% - causes 3.0 burn rate
        p_slo_target: 0.99
      });

      // Evaluate alerts (should be triggered automatically)
      const { data, error } = await supabase.rpc('evaluate_burn_rate_alerts');

      expect(error).toBeNull();
      expect(data).toBeGreaterThan(0); // At least one alert updated

      // Check alert status
      const { data: alert } = await supabase
        .from('burn_rate_alerts')
        .select('*')
        .eq('alert_name', testAlertName)
        .single();

      expect(alert.status).toBe('alerting');
      expect(alert.triggered_at).toBeDefined();
      expect(alert.current_burn_rate).toBe(3.0);
    });

    it('should resolve alert when burn rate returns to normal', async () => {
      // First trigger an alert
      await supabase.rpc('record_slo_measurement', {
        p_slo_name: testSloName,
        p_slo_type: 'availability',
        p_measurement_window_minutes: 5,
        p_total_requests: 1000,
        p_successful_requests: 970,
        p_slo_target: 0.99
      });

      // Then record good performance
      await supabase.rpc('record_slo_measurement', {
        p_slo_name: testSloName,
        p_slo_type: 'availability', 
        p_measurement_window_minutes: 5,
        p_total_requests: 1000,
        p_successful_requests: 995, // 99.5% - good performance
        p_slo_target: 0.99
      });

      // Check that alert is resolved
      const { data: alert } = await supabase
        .from('burn_rate_alerts')
        .select('*')
        .eq('alert_name', testAlertName)
        .single();

      expect(alert.status).toBe('ok');
      expect(alert.resolved_at).toBeDefined();
    });
  });

  describe('Temporal Canary Service', () => {
    it('should run successful canary workflow', async () => {
      mockWorkflowClient.setShouldSucceed(true);
      mockWorkflowClient.setExecutionDelay(2000);

      const result = await canaryService.runCanary();

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(1500);
      expect(result.workflowId).toContain('canary-');
      expect(result.runId).toBeDefined();

      // Check metrics
      const metrics = canaryService.getMetrics();
      expect(metrics.totalRuns).toBe(1);
      expect(metrics.successfulRuns).toBe(1);
      expect(metrics.consecutiveFailures).toBe(0);
    });

    it('should handle canary workflow failure', async () => {
      mockWorkflowClient.setShouldSucceed(false);

      const result = await canaryService.runCanary();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.workflowId).toContain('canary-');

      // Check metrics
      const metrics = canaryService.getMetrics();
      expect(metrics.failedRuns).toBe(1);
      expect(metrics.consecutiveFailures).toBe(1);
    });

    it('should store canary results in database', async () => {
      const result = await canaryService.runCanary();

      // Verify result was stored
      const { data: storedResult } = await supabase
        .from('temporal_canary_results')
        .select('*')
        .eq('workflow_id', result.workflowId)
        .single();

      expect(storedResult).toBeDefined();
      expect(storedResult.success).toBe(result.success);
      expect(storedResult.duration_ms).toBe(result.duration);
      expect(storedResult.run_id).toBe(result.runId);
    });

    it('should provide health status based on metrics', async () => {
      // Run successful canary
      mockWorkflowClient.setShouldSucceed(true);
      await canaryService.runCanary();

      let health = canaryService.getHealthStatus();
      expect(health.status).toBe('healthy');

      // Run multiple failures
      mockWorkflowClient.setShouldSucceed(false);
      await canaryService.runCanary();
      await canaryService.runCanary();
      await canaryService.runCanary();

      health = canaryService.getHealthStatus();
      expect(health.status).toBe('unhealthy');
      expect(health.details.consecutiveFailures).toBe(3);
    });

    it('should trigger alerts on consecutive failures', async () => {
      mockWorkflowClient.setShouldSucceed(false);

      // Run 3 consecutive failures
      await canaryService.runCanary();
      await canaryService.runCanary();
      await canaryService.runCanary();

      // Check for alert in monitoring_alerts table
      const { data: alerts } = await supabase
        .from('monitoring_alerts')
        .select('*')
        .eq('alert_type', 'temporal_canary')
        .eq('severity', 'critical');

      expect(alerts).toBeDefined();
      expect(alerts!.length).toBeGreaterThan(0);
    });

    it('should calculate success rate correctly', async () => {
      canaryService.resetMetrics();

      // Run mix of successful and failed canaries
      mockWorkflowClient.setShouldSucceed(true);
      await canaryService.runCanary();
      await canaryService.runCanary();
      
      mockWorkflowClient.setShouldSucceed(false);
      await canaryService.runCanary();

      const successRate = canaryService.getSuccessRate();
      expect(successRate).toBe(67); // 2/3 = 66.67% rounded to 67%
    });

    it('should retrieve historical results', async () => {
      // Run some canaries to generate history
      await canaryService.runCanary();
      mockWorkflowClient.setShouldSucceed(false);
      await canaryService.runCanary();

      const history = await canaryService.getHistoricalResults(1); // Last 1 hour

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0]).toHaveProperty('workflow_id');
      expect(history[0]).toHaveProperty('success');
      expect(history[0]).toHaveProperty('duration_ms');
    });
  });

  describe('Monitoring Views', () => {
    it('should provide current SLO status', async () => {
      // Create test SLO measurement
      await supabase.rpc('record_slo_measurement', {
        p_slo_name: testSloName,
        p_slo_type: 'availability',
        p_measurement_window_minutes: 5,
        p_total_requests: 1000,
        p_successful_requests: 995,
        p_slo_target: 0.99
      });

      const { data, error } = await supabase
        .from('current_slo_status')
        .select('*')
        .eq('slo_name', testSloName)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.slo_name).toBe(testSloName);
      expect(data.actual_performance).toBe(0.995);
      expect(data.slo_compliance).toBe(true);
      expect(typeof data.current_burn_rate_5m).toBe('number');
    });

    it('should provide alert summary', async () => {
      // Create test alert
      await supabase.from('monitoring_alerts').insert({
        alert_type: 'test_alert',
        severity: 'warning',
        message: 'Test alert message',
        status: 'active'
      });

      const { data, error } = await supabase
        .from('alert_summary')
        .select('*')
        .eq('alert_type', 'test_alert');

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      
      if (data.length > 0) {
        const summary = data[0];
        expect(summary.alert_type).toBe('test_alert');
        expect(summary.severity).toBe('warning');
        expect(typeof summary.total_alerts).toBe('number');
        expect(typeof summary.active_alerts).toBe('number');
      }
    });
  });

  describe('System Integration', () => {
    it('should integrate SLO measurements with burn rate alerts', async () => {
      // Create burn rate alert
      await supabase.from('burn_rate_alerts').insert({
        alert_name: `${testAlertName}_integration`,
        slo_name: testSloName,
        severity: 'critical',
        lookback_window_minutes: 5,
        burn_rate_threshold: 1.5,
        min_duration_minutes: 1
      });

      // Record SLO measurement that should trigger alert
      await supabase.rpc('record_slo_measurement', {
        p_slo_name: testSloName,
        p_slo_type: 'availability',
        p_measurement_window_minutes: 5,
        p_total_requests: 1000,
        p_successful_requests: 975, // 97.5% - high burn rate
        p_slo_target: 0.99
      });

      // Check that alert was triggered
      const { data: alert } = await supabase
        .from('burn_rate_alerts')
        .select('*')
        .eq('alert_name', `${testAlertName}_integration`)
        .single();

      expect(alert.status).toBe('alerting');
      expect(alert.current_burn_rate).toBeGreaterThan(1.5);

      // Check that monitoring alert was created
      const { data: monitoringAlert } = await supabase
        .from('monitoring_alerts')
        .select('*')
        .eq('alert_type', 'burn_rate_alert')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      expect(monitoringAlert).toBeDefined();
      expect(monitoringAlert.severity).toBe('critical');
    });

    it('should work with real-time monitoring workflow', async () => {
      // This test simulates the real-time monitoring workflow
      
      // 1. Record multiple SLO measurements over time
      for (let i = 0; i < 5; i++) {
        const successRate = 0.98 - (i * 0.002); // Degrading performance
        const successfulRequests = Math.floor(1000 * successRate);
        
        await supabase.rpc('record_slo_measurement', {
          p_slo_name: `${testSloName}_realtime`,
          p_slo_type: 'availability',
          p_measurement_window_minutes: 1,
          p_total_requests: 1000,
          p_successful_requests: successfulRequests,
          p_slo_target: 0.99
        });

        // Small delay to simulate time progression
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // 2. Check current status
      const { data: status } = await supabase
        .from('current_slo_status')
        .select('*')
        .eq('slo_name', `${testSloName}_realtime`)
        .single();

      expect(status).toBeDefined();
      expect(status.actual_performance).toBeLessThan(0.99);
      expect(status.slo_compliance).toBe(false);

      // 3. Check that burn rate is calculated
      const burnRate = await supabase.rpc('calculate_burn_rate', {
        p_slo_name: `${testSloName}_realtime`,
        p_lookback_minutes: 5
      });

      expect(burnRate.data).toBeGreaterThan(0);
    });
  });
});