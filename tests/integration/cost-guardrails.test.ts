/**
 * Cost Guardrails Integration Tests
 * Tests cost monitoring system, usage tracking, budget enforcement, and provider throttling
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { CostMonitoringService } from '../../src/services/CostMonitoringService';
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

describe('Cost Guardrails System', () => {
  let costService: CostMonitoringService;
  let testProviderName: string;
  let testEnvironment: string;

  beforeAll(async () => {
    // Verify database connection
    const { error } = await supabase.from('system_config').select('key').limit(1);
    if (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }

    // Initialize cost monitoring service
    costService = new CostMonitoringService(mockLogger);

    // Generate unique test identifiers
    const timestamp = Date.now();
    testProviderName = `test_provider_${timestamp}`;
    testEnvironment = 'integration_test';
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase.from('cost_alerts').delete().like('provider_name', 'test_provider_%');
    await supabase.from('usage_anomalies').delete().like('provider_name', 'test_provider_%');
    await supabase.from('provider_usage').delete().like('provider_name', 'test_provider_%');
    await supabase.from('provider_rate_limits').delete().like('provider_name', 'test_provider_%');
    await supabase.from('cost_budgets').delete().like('budget_scope', 'test_provider_%');
    await supabase.from('provider_pricing').delete().like('provider_name', 'test_provider_%');
  });

  describe('Cost Monitoring Database Functions', () => {
    beforeEach(async () => {
      // Setup test provider pricing
      await supabase.from('provider_pricing').insert({
        provider_name: testProviderName,
        provider_service: 'test_service',
        resource_type: 'tokens',
        pricing_unit: 'per_token',
        cost_per_unit_usd: 0.0001,
        billing_increment: 1,
        environment: testEnvironment
      });

      // Setup test rate limits
      await supabase.from('provider_rate_limits').insert({
        provider_name: testProviderName,
        provider_service: 'test_service',
        requests_per_minute: 100,
        tokens_per_minute: 10000,
        is_throttled: false,
        environment: testEnvironment
      });
    });

    it('should record provider usage', async () => {
      const { data: usageId, error } = await supabase.rpc('record_provider_usage', {
        p_provider_name: testProviderName,
        p_provider_service: 'test_service',
        p_resource_type: 'tokens',
        p_usage_value: 1500,
        p_usage_unit: 'tokens',
        p_environment: testEnvironment,
        p_metadata: { test: true, request_id: 'req_123' }
      });

      expect(error).toBeNull();
      expect(usageId).toBeDefined();
      expect(typeof usageId).toBe('string');

      // Verify usage was recorded
      const { data: usage } = await supabase
        .from('provider_usage')
        .select('*')
        .eq('id', usageId)
        .single();

      expect(usage).toBeDefined();
      expect(usage.provider_name).toBe(testProviderName);
      expect(usage.provider_service).toBe('test_service');
      expect(usage.resource_type).toBe('tokens');
      expect(parseFloat(usage.usage_value)).toBe(1500);
      expect(usage.usage_unit).toBe('tokens');
      expect(usage.environment).toBe(testEnvironment);
      expect(usage.metadata.test).toBe(true);
      expect(parseFloat(usage.estimated_cost_usd)).toBe(0.15); // 1500 * 0.0001
    });

    it('should check rate limits', async () => {
      // First request should be allowed
      const { data: allowed1, error: error1 } = await supabase.rpc('check_rate_limit', {
        p_provider_name: testProviderName,
        p_provider_service: 'test_service',
        p_request_count: 50,
        p_token_count: 5000
      });

      expect(error1).toBeNull();
      expect(allowed1).toBe(true);

      // Second request that would exceed limit should be blocked
      const { data: allowed2, error: error2 } = await supabase.rpc('check_rate_limit', {
        p_provider_name: testProviderName,
        p_provider_service: 'test_service',
        p_request_count: 60,
        p_token_count: 6000
      });

      expect(error2).toBeNull();
      expect(allowed2).toBe(false); // Would exceed 100 requests per minute
    });

    it('should detect usage anomalies', async () => {
      // Create baseline usage pattern
      for (let i = 0; i < 10; i++) {
        await supabase.rpc('record_provider_usage', {
          p_provider_name: testProviderName,
          p_provider_service: 'test_service',
          p_resource_type: 'tokens',
          p_usage_value: 1000 + (i * 50), // Normal pattern: 1000-1450 tokens
          p_usage_unit: 'tokens',
          p_environment: testEnvironment,
          p_metadata: { baseline: true }
        });
      }

      // Introduce anomaly
      const { data: anomalyId, error } = await supabase.rpc('detect_usage_anomaly', {
        p_provider_name: testProviderName,
        p_provider_service: 'test_service',
        p_current_value: 5000, // 3x normal usage
        p_resource_type: 'tokens'
      });

      expect(error).toBeNull();
      
      if (anomalyId) {
        // Verify anomaly was recorded
        const { data: anomaly } = await supabase
          .from('usage_anomalies')
          .select('*')
          .eq('id', anomalyId)
          .single();

        expect(anomaly).toBeDefined();
        expect(anomaly.provider_name).toBe(testProviderName);
        expect(anomaly.provider_service).toBe('test_service');
        expect(anomaly.anomaly_type).toContain('spike');
        expect(parseFloat(anomaly.anomaly_value)).toBe(5000);
        expect(parseFloat(anomaly.confidence_score)).toBeGreaterThan(0.8);
        expect(parseFloat(anomaly.deviation_percent)).toBeGreaterThan(200);
      }
    });

    it('should check cost thresholds', async () => {
      // Create cost budget
      const { data: budget } = await supabase.from('cost_budgets').insert({
        budget_name: 'Test Provider Budget',
        budget_type: 'provider',
        budget_scope: testProviderName,
        monthly_budget_usd: 100.0,
        current_spend_usd: 85.0,
        enforcement_mode: 'throttle',
        throttle_at_percent: 80,
        block_at_percent: 100,
        environment: testEnvironment
      }).select().single();

      const { data: thresholdResult, error } = await supabase.rpc('check_cost_thresholds', {
        p_provider_name: testProviderName,
        p_additional_cost: 10.0
      });

      expect(error).toBeNull();
      expect(thresholdResult).toBeDefined();
      expect(thresholdResult.should_throttle).toBe(true); // 85 + 10 = 95% of budget
      expect(thresholdResult.should_block).toBe(false); // Not at 100% yet
      expect(thresholdResult.current_spend_percent).toBeGreaterThan(90);
    });

    it('should manage cost budgets', async () => {
      // Create multiple budget types
      const budgets = [
        {
          budget_name: 'Global Test Budget',
          budget_type: 'global',
          budget_scope: 'all',
          monthly_budget_usd: 1000.0,
          environment: testEnvironment
        },
        {
          budget_name: 'Provider Test Budget',
          budget_type: 'provider',
          budget_scope: testProviderName,
          monthly_budget_usd: 200.0,
          environment: testEnvironment
        },
        {
          budget_name: 'Service Test Budget',
          budget_type: 'service',
          budget_scope: 'test_service',
          monthly_budget_usd: 50.0,
          environment: testEnvironment
        }
      ];

      for (const budgetData of budgets) {
        const { data: budget, error } = await supabase
          .from('cost_budgets')
          .insert(budgetData)
          .select()
          .single();

        expect(error).toBeNull();
        expect(budget).toBeDefined();
        expect(budget.budget_name).toBe(budgetData.budget_name);
        expect(budget.budget_type).toBe(budgetData.budget_type);
        expect(parseFloat(budget.monthly_budget_usd)).toBe(budgetData.monthly_budget_usd);
      }

      // Check budget status view
      const { data: budgetStatus } = await supabase
        .from('cost_budget_status')
        .select('*')
        .eq('environment', testEnvironment);

      expect(budgetStatus).toBeDefined();
      expect(budgetStatus.length).toBeGreaterThanOrEqual(3);

      const globalBudget = budgetStatus.find(b => b.budget_type === 'global');
      expect(globalBudget).toBeDefined();
      expect(globalBudget.budget_health).toBeDefined();
      expect(globalBudget.spend_percentage).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cost Monitoring Service', () => {
    beforeEach(async () => {
      // Setup test environment
      await supabase.from('provider_pricing').upsert({
        provider_name: testProviderName,
        provider_service: 'test_service',
        resource_type: 'requests',
        pricing_unit: 'per_request',
        cost_per_unit_usd: 0.01,
        environment: testEnvironment
      });

      await supabase.from('provider_rate_limits').upsert({
        provider_name: testProviderName,
        provider_service: 'test_service',
        requests_per_minute: 60,
        tokens_per_minute: 5000,
        is_throttled: false,
        environment: testEnvironment
      });

      await supabase.from('cost_budgets').upsert({
        budget_name: 'Service Test Budget',
        budget_type: 'provider',
        budget_scope: testProviderName,
        monthly_budget_usd: 50.0,
        current_spend_usd: 25.0,
        enforcement_mode: 'throttle',
        throttle_at_percent: 80,
        block_at_percent: 95,
        environment: testEnvironment
      });
    });

    it('should record usage and check budgets', async () => {
      const usage = {
        provider: testProviderName,
        service: 'test_service',
        resourceType: 'requests',
        value: 100,
        unit: 'requests',
        metadata: { test_case: 'budget_check' }
      };

      const usageId = await costService.recordUsage(usage);

      expect(usageId).toBeDefined();
      expect(typeof usageId).toBe('string');

      // Verify usage was recorded in database
      const { data: recordedUsage } = await supabase
        .from('provider_usage')
        .select('*')
        .eq('id', usageId)
        .single();

      expect(recordedUsage).toBeDefined();
      expect(recordedUsage.provider_name).toBe(testProviderName);
      expect(parseFloat(recordedUsage.usage_value)).toBe(100);
      expect(parseFloat(recordedUsage.estimated_cost_usd)).toBe(1.0); // 100 * 0.01
    });

    it('should enforce rate limits', async () => {
      // Test normal usage
      const allowed1 = await costService.checkRateLimit(testProviderName, 'test_service', 30);
      expect(allowed1).toBe(true);

      // Test exceeding rate limit
      const allowed2 = await costService.checkRateLimit(testProviderName, 'test_service', 40);
      expect(allowed2).toBe(false); // 30 + 40 = 70 > 60 per minute
    });

    it('should get budget status', async () => {
      const budget = await costService.getBudgetStatus(testProviderName);

      expect(budget).toBeDefined();
      expect(budget!.budgetScope).toBe(testProviderName);
      expect(budget!.monthlyBudgetUsd).toBe(50.0);
      expect(budget!.currentSpendUsd).toBe(25.0);
      expect(budget!.spendPercentage).toBe(50.0);
      expect(budget!.enforcementMode).toBe('throttle');
    });

    it('should get cost metrics summary', async () => {
      // Add some usage data
      await costService.recordUsage({
        provider: testProviderName,
        service: 'test_service',
        resourceType: 'tokens',
        value: 2000,
        unit: 'tokens'
      });

      const metrics = await costService.getCostMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.totalSpend).toBeGreaterThanOrEqual(0);
      expect(metrics.dailyBurnRate).toBeGreaterThanOrEqual(0);
      expect(metrics.projectedMonthlySpend).toBeGreaterThanOrEqual(0);
      expect(['HEALTHY', 'CAUTION', 'WARNING', 'CRITICAL', 'EXCEEDED']).toContain(metrics.budgetHealth);
      expect(Array.isArray(metrics.topCostDrivers)).toBe(true);
      expect(typeof metrics.activeAlerts).toBe('number');
      expect(typeof metrics.anomaliesDetected).toBe('number');
    });

    it('should manage alerts', async () => {
      // Create a test alert by triggering budget threshold
      await supabase.from('cost_budgets').update({
        current_spend_usd: 42.0 // 84% of $50 budget, should trigger throttle at 80%
      }).eq('budget_scope', testProviderName);

      const usage = {
        provider: testProviderName,
        service: 'test_service',
        resourceType: 'requests',
        value: 50,
        unit: 'requests'
      };

      await costService.recordUsage(usage);

      // Get alerts
      const alerts = await costService.getAlerts('open', 10);
      expect(Array.isArray(alerts)).toBe(true);

      // Check for budget threshold alerts
      const budgetAlert = alerts.find(a => 
        a.alertType === 'threshold_reached' && 
        a.provider === testProviderName
      );

      if (budgetAlert) {
        expect(budgetAlert.severity).toBe('high');
        expect(budgetAlert.provider).toBe(testProviderName);
        expect(budgetAlert.message).toContain('Throttling enabled');

        // Acknowledge the alert
        await costService.acknowledgeAlert(budgetAlert.id, 'test-runner');

        const acknowledgedAlerts = await costService.getAlerts('acknowledged', 5);
        const acknowledgedAlert = acknowledgedAlerts.find(a => a.id === budgetAlert.id);
        expect(acknowledgedAlert).toBeDefined();
      }
    });

    it('should get usage history', async () => {
      // Create historical usage data
      const usagePromises = [];
      for (let i = 0; i < 5; i++) {
        usagePromises.push(costService.recordUsage({
          provider: testProviderName,
          service: 'test_service',
          resourceType: 'requests',
          value: 10 + i,
          unit: 'requests',
          metadata: { batch: 'history_test' }
        }));
      }
      await Promise.all(usagePromises);

      const history = await costService.getUsageHistory(testProviderName, 1);
      
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);

      const todayUsage = history.find(h => 
        new Date(h.usage_date).toDateString() === new Date().toDateString()
      );
      
      if (todayUsage) {
        expect(todayUsage.provider_name).toBe(testProviderName);
        expect(parseFloat(todayUsage.total_usage)).toBeGreaterThan(0);
        expect(parseFloat(todayUsage.total_cost_usd)).toBeGreaterThan(0);
      }
    });

    it('should update budgets', async () => {
      await costService.updateBudget(testProviderName, {
        monthlyBudgetUsd: 75.0,
        throttleAtPercent: 75,
        blockAtPercent: 90,
        enforcementMode: 'block'
      });

      const updatedBudget = await costService.getBudgetStatus(testProviderName);
      
      expect(updatedBudget).toBeDefined();
      expect(updatedBudget!.monthlyBudgetUsd).toBe(75.0);
      expect(updatedBudget!.throttleAtPercent).toBe(75);
      expect(updatedBudget!.blockAtPercent).toBe(90);
      expect(updatedBudget!.enforcementMode).toBe('block');
    });

    it('should get rate limit status', async () => {
      const rateLimits = await costService.getRateLimitStatus();
      
      expect(Array.isArray(rateLimits)).toBe(true);
      
      const testProviderLimit = rateLimits.find(rl => 
        rl.provider === testProviderName && rl.service === 'test_service'
      );
      
      if (testProviderLimit) {
        expect(testProviderLimit.requestsPerMinute).toBe(60);
        expect(testProviderLimit.tokensPerMinute).toBe(5000);
        expect(testProviderLimit.isThrottled).toBe(false);
      }
    });

    it('should get anomalies', async () => {
      // Create some usage to establish baseline
      for (let i = 0; i < 5; i++) {
        await costService.recordUsage({
          provider: testProviderName,
          service: 'test_service',
          resourceType: 'tokens',
          value: 1000,
          unit: 'tokens'
        });
      }

      // Trigger anomaly
      await costService.recordUsage({
        provider: testProviderName,
        service: 'test_service',
        resourceType: 'tokens',
        value: 5000, // 5x normal usage
        unit: 'tokens'
      });

      const anomalies = await costService.getAnomalies(false);
      
      expect(Array.isArray(anomalies)).toBe(true);
      
      const testAnomaly = anomalies.find(a => 
        a.provider === testProviderName && a.service === 'test_service'
      );
      
      if (testAnomaly) {
        expect(testAnomaly.anomalyType).toContain('spike');
        expect(testAnomaly.anomalyValue).toBe(5000);
        expect(testAnomaly.confidenceScore).toBeGreaterThan(0.8);
        expect(testAnomaly.deviationPercent).toBeGreaterThan(300);
      }
    });
  });

  describe('Cost Monitoring Views', () => {
    beforeEach(async () => {
      // Create test data for views
      const usageData = [
        { provider: testProviderName, service: 'service_1', cost: 10.50 },
        { provider: testProviderName, service: 'service_2', cost: 25.75 },
        { provider: `${testProviderName}_2`, service: 'service_1', cost: 15.25 }
      ];

      for (const data of usageData) {
        await supabase.from('provider_usage').insert({
          provider_name: data.provider,
          provider_service: data.service,
          resource_type: 'requests',
          usage_value: data.cost * 100, // Assuming $0.01 per request
          usage_unit: 'requests',
          estimated_cost_usd: data.cost,
          environment: testEnvironment,
          usage_date: new Date().toISOString().split('T')[0]
        });
      }
    });

    it('should provide provider usage summary view', async () => {
      const { data: summary, error } = await supabase
        .from('provider_usage_summary')
        .select('*')
        .like('provider_name', `${testProviderName}%`)
        .eq('usage_date', new Date().toISOString().split('T')[0]);

      expect(error).toBeNull();
      expect(Array.isArray(summary)).toBe(true);
      expect(summary.length).toBeGreaterThan(0);

      const providerSummary = summary.find(s => s.provider_name === testProviderName);
      if (providerSummary) {
        expect(parseFloat(providerSummary.total_cost_usd)).toBeCloseTo(36.25, 2); // 10.50 + 25.75
        expect(parseFloat(providerSummary.total_usage)).toBeGreaterThan(0);
        expect(providerSummary.service_count).toBeGreaterThanOrEqual(2);
      }
    });

    it('should provide top cost drivers view', async () => {
      const { data: topDrivers, error } = await supabase
        .from('top_cost_drivers')
        .select('*')
        .like('provider_name', `${testProviderName}%`)
        .limit(10);

      expect(error).toBeNull();
      expect(Array.isArray(topDrivers)).toBe(true);

      if (topDrivers.length > 0) {
        const topDriver = topDrivers[0];
        expect(topDriver.provider_name).toBeDefined();
        expect(topDriver.provider_service).toBeDefined();
        expect(parseFloat(topDriver.total_cost_usd)).toBeGreaterThan(0);
        expect(parseFloat(topDriver.cost_percentage)).toBeGreaterThan(0);
      }
    });

    it('should provide rate limit status view', async () => {
      const { data: rateLimitStatus, error } = await supabase
        .from('rate_limit_status')
        .select('*')
        .eq('provider_name', testProviderName);

      expect(error).toBeNull();
      expect(Array.isArray(rateLimitStatus)).toBe(true);

      if (rateLimitStatus.length > 0) {
        const status = rateLimitStatus[0];
        expect(status.provider_name).toBe(testProviderName);
        expect(status.provider_service).toBe('test_service');
        expect(status.rpm_limit).toBeDefined();
        expect(status.tpm_limit).toBeDefined();
        expect(typeof status.is_throttled).toBe('boolean');
      }
    });
  });

  describe('Event Handling', () => {
    it('should emit events for rate limit violations', (done) => {
      const timeout = setTimeout(() => {
        done(new Error('Event not emitted within timeout'));
      }, 5000);

      costService.once('rateLimitExceeded', (event) => {
        clearTimeout(timeout);
        expect(event.provider).toBe(testProviderName);
        expect(event.service).toBe('test_service');
        expect(event.timestamp).toBeInstanceOf(Date);
        done();
      });

      // Trigger rate limit violation
      costService.recordUsage({
        provider: testProviderName,
        service: 'test_service',
        resourceType: 'requests',
        value: 200, // Should exceed rate limit
        unit: 'requests'
      }).catch(() => {
        // Expected to throw due to rate limit
      });
    });

    it('should emit events for budget updates', (done) => {
      const timeout = setTimeout(() => {
        done(new Error('Event not emitted within timeout'));
      }, 5000);

      costService.once('budgetUpdate', (event) => {
        clearTimeout(timeout);
        expect(event.provider).toBe(testProviderName);
        expect(event.budget).toBeDefined();
        expect(event.timestamp).toBeInstanceOf(Date);
        done();
      });

      // Trigger budget update
      costService.recordUsage({
        provider: testProviderName,
        service: 'test_service',
        resourceType: 'requests',
        value: 10,
        unit: 'requests'
      }).catch(() => {
        // May catch due to rate limits, but should still emit budget event
      });
    });

    it('should emit events for anomaly detection', (done) => {
      const timeout = setTimeout(() => {
        done(new Error('Event not emitted within timeout'));
      }, 10000);

      costService.once('anomalyDetected', (event) => {
        clearTimeout(timeout);
        expect(event.provider).toBe(testProviderName);
        expect(event.service).toBe('test_service');
        expect(event.anomalyId).toBeDefined();
        expect(event.timestamp).toBeInstanceOf(Date);
        done();
      });

      // Create baseline and then trigger anomaly
      const createBaseline = async () => {
        // Create normal usage pattern
        for (let i = 0; i < 3; i++) {
          try {
            await costService.recordUsage({
              provider: testProviderName,
              service: 'test_service',
              resourceType: 'tokens',
              value: 1000,
              unit: 'tokens'
            });
          } catch (error) {
            // Ignore rate limit errors for baseline
          }
        }

        // Wait a bit for baseline to be established
        setTimeout(async () => {
          try {
            await costService.recordUsage({
              provider: testProviderName,
              service: 'test_service',
              resourceType: 'tokens',
              value: 10000, // 10x normal usage
              unit: 'tokens'
            });
          } catch (error) {
            // May be rate limited but should still trigger anomaly detection
          }
        }, 1000);
      };

      createBaseline();
    });
  });

  describe('End-to-End Cost Monitoring Workflow', () => {
    it('should complete full cost monitoring lifecycle', async () => {
      const workflowProvider = `${testProviderName}_workflow`;

      // 1. Setup provider pricing and limits
      await supabase.from('provider_pricing').insert({
        provider_name: workflowProvider,
        provider_service: 'workflow_service',
        resource_type: 'api_calls',
        pricing_unit: 'per_call',
        cost_per_unit_usd: 0.005,
        environment: testEnvironment
      });

      await supabase.from('provider_rate_limits').insert({
        provider_name: workflowProvider,
        provider_service: 'workflow_service',
        requests_per_minute: 30,
        is_throttled: false,
        environment: testEnvironment
      });

      // 2. Create cost budget with enforcement
      await supabase.from('cost_budgets').insert({
        budget_name: 'Workflow Provider Budget',
        budget_type: 'provider',
        budget_scope: workflowProvider,
        monthly_budget_usd: 20.0,
        current_spend_usd: 15.0, // 75% of budget
        enforcement_mode: 'throttle',
        throttle_at_percent: 80,
        block_at_percent: 95,
        environment: testEnvironment
      });

      // 3. Record usage that triggers throttling
      let throttleTriggered = false;
      try {
        const usageId = await costService.recordUsage({
          provider: workflowProvider,
          service: 'workflow_service',
          resourceType: 'api_calls',
          value: 200, // $1.00 cost, bringing total to $16.00 (80% of budget)
          unit: 'calls',
          metadata: { workflow: 'e2e_test' }
        });
        
        expect(usageId).toBeDefined();
      } catch (error) {
        if (error.message.includes('Rate limit exceeded')) {
          throttleTriggered = true;
        }
      }

      // 4. Verify budget status and alerts
      const budget = await costService.getBudgetStatus(workflowProvider);
      expect(budget).toBeDefined();
      expect(budget!.spendPercentage).toBeGreaterThan(75);

      const alerts = await costService.getAlerts('open');
      const budgetAlert = alerts.find(a => 
        a.provider === workflowProvider && 
        a.alertType === 'threshold_reached'
      );

      if (budgetAlert) {
        expect(budgetAlert.severity).toBe('high');
        expect(budgetAlert.message).toContain('Throttling enabled');
      }

      // 5. Check rate limit status
      const rateLimits = await costService.getRateLimitStatus();
      const providerLimit = rateLimits.find(rl => 
        rl.provider === workflowProvider && rl.service === 'workflow_service'
      );

      if (providerLimit) {
        expect(providerLimit.requestsPerMinute).toBeLessThanOrEqual(30);
        // May be throttled due to budget enforcement
      }

      // 6. Verify cost metrics
      const metrics = await costService.getCostMetrics();
      expect(metrics.totalSpend).toBeGreaterThan(0);
      expect(metrics.activeAlerts).toBeGreaterThanOrEqual(0);

      // 7. Test anomaly detection
      try {
        await costService.recordUsage({
          provider: workflowProvider,
          service: 'workflow_service',
          resourceType: 'api_calls',
          value: 1000, // Large spike in usage
          unit: 'calls',
          metadata: { anomaly_test: true }
        });
      } catch (error) {
        // Expected to be blocked/throttled
      }

      const anomalies = await costService.getAnomalies(false);
      const workflowAnomaly = anomalies.find(a => 
        a.provider === workflowProvider && a.service === 'workflow_service'
      );

      if (workflowAnomaly) {
        expect(workflowAnomaly.confidenceScore).toBeGreaterThan(0.7);
        expect(workflowAnomaly.anomalyValue).toBe(1000);
      }

      // 8. Test usage history
      const history = await costService.getUsageHistory(workflowProvider, 1);
      expect(history.length).toBeGreaterThan(0);

      const todayUsage = history.find(h => 
        new Date(h.usage_date).toDateString() === new Date().toDateString()
      );
      
      if (todayUsage) {
        expect(parseFloat(todayUsage.total_cost_usd)).toBeGreaterThan(0);
        expect(parseFloat(todayUsage.total_usage)).toBeGreaterThan(0);
      }

      console.log('✅ End-to-end cost monitoring workflow completed successfully');
    });
  });
});