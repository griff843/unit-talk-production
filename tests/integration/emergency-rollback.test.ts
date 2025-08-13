/**
 * Integration Tests for Emergency Rollback System
 * Tests rollback service, database functions, and GitHub Actions integration
 */

import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { RollbackService, RollbackRequest, RollbackPlan, RollbackExecution } from '../../src/services/RollbackService';

// Test environment setup
const TEST_SUPABASE_URL = process.env.TEST_SUPABASE_URL || 'http://localhost:54321';
const TEST_SUPABASE_KEY = process.env.TEST_SUPABASE_ANON_KEY || 'test-key';

const testDb = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_KEY);
const testLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

let rollbackService: RollbackService;

describe('Emergency Rollback System Integration', () => {
  beforeAll(async () => {
    // Initialize rollback service
    rollbackService = new RollbackService(testLogger);
    
    // Verify database connection
    const { error } = await testDb.from('rollback_requests').select('count').single();
    if (error && !error.message.includes('JSON object requested')) {
      console.warn('Database connection issues, some tests may fail:', error.message);
    }
  });

  afterAll(async () => {
    await rollbackService.cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up test data
    await testDb.from('rollback_validations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await testDb.from('rollback_steps').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await testDb.from('rollback_safety_checks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await testDb.from('rollback_executions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await testDb.from('rollback_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  });

  describe('Rollback Request Management', () => {
    it('should create rollback request with validation', async () => {
      const request = await rollbackService.createRollbackRequest({
        rollbackType: 'blue_green',
        rollbackTarget: 'previous_stable',
        affectedServices: ['api', 'discord-bot'],
        rollbackReason: 'critical_bug',
        severityLevel: 'critical',
        skipConfirmations: true,
        maintenanceMode: false,
        initiatedBy: 'test-user'
      });

      expect(request.id).toBeDefined();
      expect(request.rollbackType).toBe('blue_green');
      expect(request.severityLevel).toBe('critical');
      expect(request.initiatedBy).toBe('test-user');
      expect(request.createdAt).toBeInstanceOf(Date);

      // Verify database storage
      const { data: stored } = await testDb
        .from('rollback_requests')
        .select('*')
        .eq('id', request.id)
        .single();

      expect(stored).toBeTruthy();
      expect(stored.rollback_type).toBe('blue_green');
      expect(stored.severity_level).toBe('critical');
    });

    it('should create different rollback request types', async () => {
      const rollbackTypes = [
        'blue_green',
        'canary_revert', 
        'database_rollback',
        'feature_flag_disable',
        'traffic_drain',
        'full_system_rollback'
      ] as const;

      for (const rollbackType of rollbackTypes) {
        const request = await rollbackService.createRollbackRequest({
          rollbackType,
          rollbackTarget: 'test_target',
          affectedServices: ['api'],
          rollbackReason: 'critical_bug',
          severityLevel: 'high',
          skipConfirmations: false,
          maintenanceMode: false,
          initiatedBy: 'test-user'
        });

        expect(request.rollbackType).toBe(rollbackType);
      }
    });

    it('should validate rollback target exists', async () => {
      const validation = await rollbackService.validateRollbackTarget('commit_abc123');
      expect(validation.valid).toBe(true);
      expect(validation.validationErrors).toHaveLength(0);

      const invalidValidation = await rollbackService.validateRollbackTarget('');
      expect(invalidValidation.valid).toBe(false);
      expect(invalidValidation.validationErrors.length).toBeGreaterThan(0);

      const headValidation = await rollbackService.validateRollbackTarget('HEAD');
      expect(headValidation.valid).toBe(false);
      expect(headValidation.validationErrors).toContain('Cannot rollback to current HEAD');
    });
  });

  describe('Rollback Plan Generation', () => {
    it('should generate blue-green rollback plan', async () => {
      const request = await rollbackService.createRollbackRequest({
        rollbackType: 'blue_green',
        rollbackTarget: 'previous_stable',
        affectedServices: ['api', 'discord-bot'],
        rollbackReason: 'performance_degradation',
        severityLevel: 'high',
        skipConfirmations: false,
        maintenanceMode: false,
        initiatedBy: 'test-user'
      });

      const plan = await rollbackService.generateRollbackPlan(request);

      expect(plan.strategy).toBe('blue_green_switch');
      expect(plan.rollbackMethod).toBe('traffic_switching');
      expect(plan.estimatedTimeMinutes).toBe(5);
      expect(plan.steps).toEqual([
        'validate_green_environment',
        'switch_load_balancer_traffic',
        'verify_health_checks',
        'monitor_error_rates',
        'confirm_rollback_success'
      ]);
      expect(plan.safetyChecks.length).toBeGreaterThan(0);
      expect(plan.rollbackValidations.length).toBeGreaterThan(0);
    });

    it('should generate database rollback plan', async () => {
      const request = await rollbackService.createRollbackRequest({
        rollbackType: 'database_rollback',
        rollbackTarget: 'migration_v1.2.0',
        affectedServices: ['api'],
        rollbackReason: 'data_corruption',
        severityLevel: 'critical',
        skipConfirmations: true,
        maintenanceMode: true,
        initiatedBy: 'test-user'
      });

      const plan = await rollbackService.generateRollbackPlan(request);

      expect(plan.strategy).toBe('database_migration_rollback');
      expect(plan.rollbackMethod).toBe('database_migration');
      expect(plan.estimatedTimeMinutes).toBe(10);
      expect(plan.steps).toContain('execute_rollback_migrations');
      expect(plan.steps).toContain('verify_data_integrity');
    });

    it('should generate feature flag rollback plan', async () => {
      const request = await rollbackService.createRollbackRequest({
        rollbackType: 'feature_flag_disable',
        rollbackTarget: 'feature_xyz',
        affectedServices: ['api', 'dashboard'],
        rollbackReason: 'user_impact',
        severityLevel: 'medium',
        skipConfirmations: false,
        maintenanceMode: false,
        initiatedBy: 'test-user'
      });

      const plan = await rollbackService.generateRollbackPlan(request);

      expect(plan.strategy).toBe('feature_flag_rollback');
      expect(plan.rollbackMethod).toBe('feature_toggles');
      expect(plan.estimatedTimeMinutes).toBe(2);
      expect(plan.steps).toContain('disable_feature_flags');
      expect(plan.steps).toContain('verify_flag_propagation');
    });
  });

  describe('Rollback Execution', () => {
    it('should execute blue-green rollback successfully', async () => {
      const request = await rollbackService.createRollbackRequest({
        rollbackType: 'blue_green',
        rollbackTarget: 'stable_v1.0.0',
        affectedServices: ['api'],
        rollbackReason: 'critical_bug',
        severityLevel: 'critical',
        skipConfirmations: true,
        maintenanceMode: false,
        initiatedBy: 'test-user'
      });

      const plan = await rollbackService.generateRollbackPlan(request);
      const execution = await rollbackService.executeRollback(request, plan);

      expect(execution.id).toBeDefined();
      expect(execution.rollbackRequestId).toBe(request.id);
      expect(execution.status).toBe('completed');
      expect(execution.startedAt).toBeInstanceOf(Date);
      expect(execution.completedAt).toBeInstanceOf(Date);
      expect(execution.durationMinutes).toBeGreaterThan(0);
      expect(execution.errorBudgetImpact).toBe(5); // Blue-green estimated time

      // Verify all steps completed
      const completedSteps = execution.executionSteps.filter(s => s.status === 'completed');
      expect(completedSteps.length).toBe(execution.executionSteps.length);

      // Verify validations ran
      expect(execution.verificationResults.length).toBeGreaterThan(0);
    });

    it('should handle rollback execution with maintenance mode', async () => {
      const request = await rollbackService.createRollbackRequest({
        rollbackType: 'traffic_drain',
        rollbackTarget: 'backup_v1.0.0',
        affectedServices: ['api', 'dashboard'],
        rollbackReason: 'service_outage',
        severityLevel: 'critical',
        skipConfirmations: true,
        maintenanceMode: true,
        initiatedBy: 'test-user'
      });

      const plan = await rollbackService.generateRollbackPlan(request);
      const execution = await rollbackService.executeRollback(request, plan);

      expect(execution.status).toBe('completed');
      
      // Verify maintenance mode step was executed
      const maintenanceStep = execution.executionSteps.find(s => 
        s.stepName === 'enable_maintenance_mode'
      );
      expect(maintenanceStep?.status).toBe('completed');
    });

    it('should track error budget impact', async () => {
      const request = await rollbackService.createRollbackRequest({
        rollbackType: 'full_system_rollback',
        rollbackTarget: 'last_known_good',
        affectedServices: ['all'],
        rollbackReason: 'error_budget_exhaustion',
        severityLevel: 'high',
        skipConfirmations: true,
        maintenanceMode: true,
        initiatedBy: 'test-user'
      });

      const plan = await rollbackService.generateRollbackPlan(request);
      const execution = await rollbackService.executeRollback(request, plan);

      expect(execution.errorBudgetImpact).toBe(15); // Full system rollback estimated time
      expect(execution.status).toBe('completed');
    });
  });

  describe('Traffic Management', () => {
    it('should get current traffic state', async () => {
      const trafficState = await rollbackService.getTrafficState(['api', 'dashboard']);

      expect(trafficState.currentTrafficSplit).toBeDefined();
      expect(trafficState.targetTrafficSplit).toBeDefined();
      expect(trafficState.rollbackTrafficSplit).toBeDefined();
      expect(trafficState.lastUpdated).toBeInstanceOf(Date);
      
      // Should have traffic split for requested services
      expect(trafficState.currentTrafficSplit['api']).toBe(100);
      expect(trafficState.currentTrafficSplit['dashboard']).toBe(100);
    });

    it('should update traffic routing for rollback', async () => {
      const services = ['api', 'discord-bot'];
      const rollbackPercentage = 75;

      const trafficState = await rollbackService.updateTrafficRouting(services, rollbackPercentage);

      expect(trafficState.rollbackTrafficSplit['api']).toBe(75);
      expect(trafficState.rollbackTrafficSplit['discord-bot']).toBe(75);
      expect(trafficState.currentTrafficSplit['api']).toBe(25); // 100 - 75
      expect(trafficState.currentTrafficSplit['discord-bot']).toBe(25);
    });

    it('should cache traffic state for performance', async () => {
      const services = ['api'];
      
      // First call
      const start1 = Date.now();
      await rollbackService.getTrafficState(services);
      const duration1 = Date.now() - start1;

      // Second call (should be cached)
      const start2 = Date.now();
      await rollbackService.getTrafficState(services);
      const duration2 = Date.now() - start2;

      // Cached call should be faster
      expect(duration2).toBeLessThan(duration1);
    });
  });

  describe('System Health Monitoring', () => {
    it('should get system health status', async () => {
      const health = await rollbackService.getSystemHealth();

      expect(health.overallStatus).toMatch(/^(healthy|degraded|critical|unknown)$/);
      expect(health.services).toBeInstanceOf(Array);
      expect(health.services.length).toBeGreaterThan(0);
      expect(health.errorRates).toBeDefined();
      expect(health.responseTimesMs).toBeDefined();
      expect(health.lastChecked).toBeInstanceOf(Date);

      // Verify service health structure
      const apiHealth = health.services.find(s => s.serviceName === 'api');
      expect(apiHealth).toBeDefined();
      expect(apiHealth?.status).toMatch(/^(healthy|degraded|critical|unknown)$/);
      expect(typeof apiHealth?.errorRate).toBe('number');
      expect(typeof apiHealth?.responseTimeMs).toBe('number');
    });

    it('should cache system health for performance', async () => {
      // First call
      const start1 = Date.now();
      await rollbackService.getSystemHealth();
      const duration1 = Date.now() - start1;

      // Second call (should be cached)
      const start2 = Date.now();
      await rollbackService.getSystemHealth();
      const duration2 = Date.now() - start2;

      // Cached call should be significantly faster
      expect(duration2).toBeLessThan(duration1 / 2);
    });
  });

  describe('Maintenance Mode', () => {
    it('should enable maintenance mode', async () => {
      await rollbackService.setMaintenanceMode(true, 'Emergency rollback testing');

      // Verify maintenance mode is stored in database
      const { data: maintenanceState } = await testDb
        .from('system_state')
        .select('value')
        .eq('key', 'maintenance_mode')
        .single();

      expect(maintenanceState?.value.enabled).toBe(true);
      expect(maintenanceState?.value.reason).toBe('Emergency rollback testing');
    });

    it('should disable maintenance mode', async () => {
      // Enable first
      await rollbackService.setMaintenanceMode(true, 'Test reason');
      
      // Then disable
      await rollbackService.setMaintenanceMode(false);

      const { data: maintenanceState } = await testDb
        .from('system_state')
        .select('value')
        .eq('key', 'maintenance_mode')
        .single();

      expect(maintenanceState?.value.enabled).toBe(false);
    });
  });

  describe('Event Emission', () => {
    it('should emit rollback request created event', async () => {
      const eventPromise = new Promise((resolve) => {
        rollbackService.once('rollbackRequestCreated', resolve);
      });

      const request = await rollbackService.createRollbackRequest({
        rollbackType: 'canary_revert',
        rollbackTarget: 'stable_v1.1.0',
        affectedServices: ['api'],
        rollbackReason: 'performance_degradation',
        severityLevel: 'medium',
        skipConfirmations: false,
        maintenanceMode: false,
        initiatedBy: 'test-user'
      });

      const event = await eventPromise as any;
      expect(event.rollbackRequest.id).toBe(request.id);
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should emit traffic updated event', async () => {
      const eventPromise = new Promise((resolve) => {
        rollbackService.once('trafficUpdated', resolve);
      });

      await rollbackService.updateTrafficRouting(['api'], 50);

      const event = await eventPromise as any;
      expect(event.services).toEqual(['api']);
      expect(event.rollbackPercentage).toBe(50);
      expect(event.trafficState).toBeDefined();
    });

    it('should emit rollback completed event', async () => {
      const eventPromise = new Promise((resolve) => {
        rollbackService.once('rollbackCompleted', resolve);
      });

      const request = await rollbackService.createRollbackRequest({
        rollbackType: 'feature_flag_disable',
        rollbackTarget: 'feature_abc',
        affectedServices: ['api'],
        rollbackReason: 'user_impact',
        severityLevel: 'critical',
        skipConfirmations: true,
        maintenanceMode: false,
        initiatedBy: 'test-user'
      });

      const plan = await rollbackService.generateRollbackPlan(request);
      await rollbackService.executeRollback(request, plan);

      const event = await eventPromise as any;
      expect(event.rollbackId).toBe(request.id);
      expect(event.execution.status).toBe('completed');
    });

    it('should emit maintenance mode changed event', async () => {
      const eventPromise = new Promise((resolve) => {
        rollbackService.once('maintenanceModeChanged', resolve);
      });

      await rollbackService.setMaintenanceMode(true, 'Test maintenance');

      const event = await eventPromise as any;
      expect(event.enabled).toBe(true);
      expect(event.reason).toBe('Test maintenance');
    });
  });

  describe('Database Function Integration', () => {
    it('should use database function to create rollback request', async () => {
      const { data: requestId } = await testDb.rpc('create_rollback_request', {
        p_rollback_type: 'blue_green',
        p_rollback_target: 'v1.0.0',
        p_affected_services: ['api', 'dashboard'],
        p_rollback_reason: 'critical_bug',
        p_severity_level: 'high',
        p_initiated_by: 'db-test-user',
        p_skip_confirmations: false,
        p_maintenance_mode: false
      });

      expect(requestId).toBeDefined();

      // Verify request was created
      const { data: request } = await testDb
        .from('rollback_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      expect(request).toBeTruthy();
      expect(request.rollback_type).toBe('blue_green');
      expect(request.initiated_by).toBe('db-test-user');

      // Verify safety checks were created
      const { data: safetyChecks } = await testDb
        .from('rollback_safety_checks')
        .select('*')
        .eq('rollback_request_id', requestId);

      expect(safetyChecks).toBeTruthy();
      expect(safetyChecks.length).toBeGreaterThan(0);
    });

    it('should use database function to capture system health', async () => {
      const serviceHealth = {
        api: { status: 'healthy', response_time: 95, error_rate: 0.1 },
        dashboard: { status: 'degraded', response_time: 150, error_rate: 0.5 }
      };

      const { data: snapshotId } = await testDb.rpc('capture_system_health', {
        p_overall_status: 'degraded',
        p_service_health: serviceHealth,
        p_error_rates: { api: 0.1, dashboard: 0.5 },
        p_response_times: { api: 95, dashboard: 150 },
        p_rollback_context: 'pre_rollback'
      });

      expect(snapshotId).toBeDefined();

      // Verify snapshot was created
      const { data: snapshot } = await testDb
        .from('system_health_snapshots')
        .select('*')
        .eq('id', snapshotId)
        .single();

      expect(snapshot).toBeTruthy();
      expect(snapshot.overall_status).toBe('degraded');
      expect(snapshot.rollback_context).toBe('pre_rollback');
      expect(snapshot.service_health).toEqual(serviceHealth);
    });

    it('should use database function to update traffic routing', async () => {
      const currentSplit = { version_a: 80, version_b: 20 };
      const targetSplit = { version_a: 0, version_b: 100 };
      const rollbackSplit = { version_a: 100, version_b: 0 };

      await testDb.rpc('update_traffic_routing', {
        p_service_name: 'api',
        p_current_split: currentSplit,
        p_target_split: targetSplit,
        p_rollback_split: rollbackSplit,
        p_updated_by: 'test-system'
      });

      // Verify routing state was updated
      const { data: routing } = await testDb
        .from('traffic_routing_state')
        .select('*')
        .eq('service_name', 'api')
        .single();

      expect(routing).toBeTruthy();
      expect(routing.current_traffic_split).toEqual(currentSplit);
      expect(routing.target_traffic_split).toEqual(targetSplit);
      expect(routing.rollback_traffic_split).toEqual(rollbackSplit);
      expect(routing.updated_by).toBe('test-system');
    });
  });

  describe('Database Views Integration', () => {
    it('should query active rollback requests view', async () => {
      // Create test request
      const request = await rollbackService.createRollbackRequest({
        rollbackType: 'database_rollback',
        rollbackTarget: 'v1.5.0',
        affectedServices: ['api'],
        rollbackReason: 'data_corruption',
        severityLevel: 'critical',
        skipConfirmations: true,
        maintenanceMode: true,
        initiatedBy: 'test-user'
      });

      // Query view
      const { data: activeRequests } = await testDb
        .from('active_rollback_requests')
        .select('*');

      expect(activeRequests).toBeTruthy();
      const testRequest = activeRequests?.find(r => r.id === request.id);
      expect(testRequest).toBeTruthy();
      expect(testRequest?.rollback_type).toBe('database_rollback');
      expect(testRequest?.severity_level).toBe('critical');
    });

    it('should query traffic routing dashboard view', async () => {
      // Create test routing state
      await testDb.rpc('update_traffic_routing', {
        p_service_name: 'test-service',
        p_current_split: { stable: 90, canary: 10 },
        p_target_split: { stable: 70, canary: 30 },
        p_rollback_split: { stable: 100, canary: 0 }
      });

      // Query view
      const { data: routingDashboard } = await testDb
        .from('traffic_routing_dashboard')
        .select('*')
        .eq('service_name', 'test-service');

      expect(routingDashboard).toBeTruthy();
      expect(routingDashboard?.length).toBeGreaterThan(0);
      
      const routing = routingDashboard?.[0];
      expect(routing.routing_status).toMatch(/^(stable|stale|transitioning)$/);
      expect(routing.rollback_active).toBe(true);
    });

    it('should query system health overview view', async () => {
      // Create test health snapshot
      await testDb.rpc('capture_system_health', {
        p_overall_status: 'healthy',
        p_service_health: { api: { status: 'healthy' } },
        p_rollback_context: 'monitoring'
      });

      // Query view
      const { data: healthOverview } = await testDb
        .from('system_health_overview')
        .select('*')
        .limit(5);

      expect(healthOverview).toBeTruthy();
      expect(healthOverview?.length).toBeGreaterThan(0);
      
      const health = healthOverview?.[0];
      expect(health.overall_status).toMatch(/^(healthy|degraded|critical|unknown)$/);
      expect(health.rollback_context).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid rollback type', async () => {
      await expect(async () => {
        await rollbackService.createRollbackRequest({
          rollbackType: 'invalid_type' as any,
          rollbackTarget: 'v1.0.0',
          affectedServices: ['api'],
          rollbackReason: 'critical_bug',
          severityLevel: 'high',
          skipConfirmations: false,
          maintenanceMode: false,
          initiatedBy: 'test-user'
        });
      }).rejects.toThrow();
    });

    it('should handle database connection errors gracefully', async () => {
      // Create service with invalid database URL
      const invalidService = new RollbackService(testLogger);
      
      // Mock database error
      jest.spyOn(testDb, 'from').mockImplementationOnce(() => {
        throw new Error('Database connection failed');
      });

      await expect(async () => {
        await invalidService.createRollbackRequest({
          rollbackType: 'blue_green',
          rollbackTarget: 'v1.0.0',
          affectedServices: ['api'],
          rollbackReason: 'critical_bug',
          severityLevel: 'high',
          skipConfirmations: false,
          maintenanceMode: false,
          initiatedBy: 'test-user'
        });
      }).rejects.toThrow('Database connection failed');

      await invalidService.cleanup();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent rollback requests', async () => {
      const requests = await Promise.all([
        rollbackService.createRollbackRequest({
          rollbackType: 'blue_green',
          rollbackTarget: 'v1.0.0',
          affectedServices: ['api'],
          rollbackReason: 'critical_bug',
          severityLevel: 'high',
          skipConfirmations: true,
          maintenanceMode: false,
          initiatedBy: 'user1'
        }),
        rollbackService.createRollbackRequest({
          rollbackType: 'canary_revert',
          rollbackTarget: 'v1.1.0',
          affectedServices: ['dashboard'],
          rollbackReason: 'performance_degradation',
          severityLevel: 'medium',
          skipConfirmations: true,
          maintenanceMode: false,
          initiatedBy: 'user2'
        }),
        rollbackService.createRollbackRequest({
          rollbackType: 'feature_flag_disable',
          rollbackTarget: 'feature_x',
          affectedServices: ['smart-form'],
          rollbackReason: 'user_impact',
          severityLevel: 'low',
          skipConfirmations: false,
          maintenanceMode: false,
          initiatedBy: 'user3'
        })
      ]);

      expect(requests).toHaveLength(3);
      requests.forEach(request => {
        expect(request.id).toBeDefined();
        expect(request.createdAt).toBeInstanceOf(Date);
      });

      // Verify all requests are unique
      const ids = requests.map(r => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });

    it('should maintain performance under load', async () => {
      const start = Date.now();
      
      // Create 10 rollback plans concurrently
      const requests = await Promise.all(
        Array.from({ length: 10 }, (_, i) => 
          rollbackService.createRollbackRequest({
            rollbackType: 'blue_green',
            rollbackTarget: `v1.${i}.0`,
            affectedServices: ['api'],
            rollbackReason: 'critical_bug',
            severityLevel: 'high',
            skipConfirmations: true,
            maintenanceMode: false,
            initiatedBy: `user${i}`
          })
        )
      );

      const plans = await Promise.all(
        requests.map(request => rollbackService.generateRollbackPlan(request))
      );

      const duration = Date.now() - start;
      
      expect(plans).toHaveLength(10);
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
      
      plans.forEach(plan => {
        expect(plan.strategy).toBeDefined();
        expect(plan.steps.length).toBeGreaterThan(0);
      });
    });
  });
});