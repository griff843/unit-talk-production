/**
 * Shadow→Canary→Full Rollout System Integration Tests
 * Tests the deployment orchestration and safety mechanisms
 */

import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { RolloutOrchestrator } from '../../services/deployment/RolloutOrchestrator';
import { SegmentManager } from '../../services/deployment/SegmentManager';
import { PerformanceMonitor } from '../../services/deployment/PerformanceMonitor';
import { RollbackSystem } from '../../services/deployment/RollbackSystem';
import { ShadowMode } from '../../services/deployment/phases/ShadowMode';
import { CanaryMode } from '../../services/deployment/phases/CanaryMode';
import { FullRollout } from '../../services/deployment/phases/FullRollout';
import { createSupabaseClient } from '../../services/supabaseClient';
import { ProductionRedisService } from '../../services/productionRedis';

describe('Rollout System Integration Tests', () => {
  let orchestrator: RolloutOrchestrator;
  let segmentManager: SegmentManager;
  let performanceMonitor: PerformanceMonitor;
  let rollbackSystem: RollbackSystem;
  let supabaseClient: ReturnType<typeof createSupabaseClient>;
  let redisService: ProductionRedisService;

  beforeEach(async () => {
    // Initialize services
    redisService = new ProductionRedisService();
    supabaseClient = createSupabaseClient();

    segmentManager = new SegmentManager(supabaseClient, console);
    performanceMonitor = new PerformanceMonitor(supabaseClient, redisService, console);
    rollbackSystem = new RollbackSystem(supabaseClient, console);

    orchestrator = new RolloutOrchestrator(
      segmentManager,
      performanceMonitor,
      rollbackSystem,
      supabaseClient,
      console
    );

    // Clear test data
    await supabaseClient.from('rollout_deployments').delete().neq('id', '');
    await supabaseClient.from('rollout_phases').delete().neq('id', '');
    await supabaseClient.from('feature_flags').delete().neq('id', '');
    await redisService.clear();
  });

  afterEach(async () => {
    await orchestrator.cleanup();
    await redisService.disconnect();
  });

  describe('Shadow Mode (Phase A)', () => {
    it('should execute shadow mode with dual writes', async () => {
      const shadowMode = new ShadowMode(supabaseClient, redisService, console);

      const rolloutConfig = {
        name: 'unified_picks_shadow_test',
        target: 'all_users',
        shadowModeEnabled: true,
        dualWritesEnabled: true,
        suppressDiscord: true
      };

      // Start shadow mode
      const deployment = await orchestrator.startRollout(rolloutConfig);
      expect(deployment.id).toBeDefined();
      expect(deployment.current_phase).toBe('shadow');

      // Verify shadow mode configuration
      const { data: flags } = await supabaseClient
        .from('feature_flags')
        .select('*')
        .eq('deployment_id', deployment.id);

      expect(flags).toContainEqual(
        expect.objectContaining({
          name: 'shadow_mode',
          enabled: true,
          rollout_percentage: 100
        })
      );

      // Simulate shadow mode operations
      await shadowMode.processShadowOperation({
        type: 'ingestion',
        data: { gameId: 'shadow-test-game' }
      });

      // Verify dual writes occurred
      const metrics = await performanceMonitor.getPhaseMetrics(deployment.id, 'shadow');
      expect(metrics.dualWriteSuccess).toBeGreaterThan(0);
      expect(metrics.discordSuppressed).toBeGreaterThan(0);
    });

    it('should track cache hit rates and credit usage', async () => {
      const rolloutConfig = {
        name: 'cache_performance_test',
        target: 'vip_users',
        shadowModeEnabled: true
      };

      const deployment = await orchestrator.startRollout(rolloutConfig);

      // Simulate cache operations
      await redisService.set('test-key-1', 'test-value-1');
      await redisService.get('test-key-1'); // Cache hit
      await redisService.get('nonexistent-key'); // Cache miss

      // Wait for metrics collection
      await performanceMonitor.collectMetrics(deployment.id);

      const metrics = await performanceMonitor.getPhaseMetrics(deployment.id, 'shadow');
      expect(metrics.cacheHitRate).toBeGreaterThan(0.5);
      expect(metrics.totalOperations).toBeGreaterThan(0);
    });

    it('should validate 80%+ cache hit rate requirement', async () => {
      const rolloutConfig = {
        name: 'cache_validation_test',
        target: 'test_segment',
        cacheHitRateThreshold: 0.8
      };

      const deployment = await orchestrator.startRollout(rolloutConfig);

      // Simulate high cache hit scenario
      for (let i = 0; i < 10; i++) {
        await redisService.set(`cache-key-${i}`, `value-${i}`);
        await redisService.get(`cache-key-${i}`); // Hit
      }

      // Only 1 miss out of 10 operations
      await redisService.get('nonexistent-key');

      await performanceMonitor.collectMetrics(deployment.id);

      const validation = await orchestrator.validatePhaseRequirements(deployment.id, 'shadow');
      expect(validation.cacheHitRateValid).toBe(true);
      expect(validation.readyForNextPhase).toBe(true);
    });
  });

  describe('Canary Mode (Phase B)', () => {
    it('should enable Discord alerts for small segments', async () => {
      const rolloutConfig = {
        name: 'canary_discord_test',
        target: 'vip_users',
        canaryPercentage: 5,
        enableDiscord: true
      };

      const deployment = await orchestrator.startRollout(rolloutConfig);

      // Progress to canary phase
      await orchestrator.progressToPhase(deployment.id, 'canary');

      // Verify segment allocation
      const segments = await segmentManager.getActiveSegments(deployment.id);
      expect(segments.canary.percentage).toBe(5);
      expect(segments.canary.discordEnabled).toBe(true);

      // Verify feature flags
      const { data: flags } = await supabaseClient
        .from('feature_flags')
        .select('*')
        .eq('deployment_id', deployment.id)
        .eq('name', 'canary_discord_alerts');

      expect(flags?.[0]).toMatchObject({
        enabled: true,
        rollout_percentage: 5
      });
    });

    it('should implement progressive rollout (5% → 15% → 25%)', async () => {
      const rolloutConfig = {
        name: 'progressive_rollout_test',
        target: 'all_users',
        progressiveSteps: [5, 15, 25, 50]
      };

      const deployment = await orchestrator.startRollout(rolloutConfig);
      await orchestrator.progressToPhase(deployment.id, 'canary');

      // Initial 5%
      let segments = await segmentManager.getActiveSegments(deployment.id);
      expect(segments.canary.percentage).toBe(5);

      // Mock good performance for progression
      jest.spyOn(performanceMonitor, 'getPhaseMetrics')
        .mockResolvedValue({
          errorRate: 0.01,
          responseTime: 95,
          alertPrecision: 0.95,
          segmentHealth: 0.99
        });

      // Progress to 15%
      await orchestrator.progressCanaryStep(deployment.id);
      segments = await segmentManager.getActiveSegments(deployment.id);
      expect(segments.canary.percentage).toBe(15);

      // Progress to 25%
      await orchestrator.progressCanaryStep(deployment.id);
      segments = await segmentManager.getActiveSegments(deployment.id);
      expect(segments.canary.percentage).toBe(25);
    });

    it('should trigger automatic rollback on poor performance', async () => {
      const rolloutConfig = {
        name: 'rollback_trigger_test',
        target: 'test_users',
        canaryPercentage: 10,
        errorRateThreshold: 0.05
      };

      const deployment = await orchestrator.startRollout(rolloutConfig);
      await orchestrator.progressToPhase(deployment.id, 'canary');

      // Mock high error rate
      jest.spyOn(performanceMonitor, 'getPhaseMetrics')
        .mockResolvedValue({
          errorRate: 0.15, // Above 5% threshold
          responseTime: 150,
          alertPrecision: 0.70,
          segmentHealth: 0.60
        });

      // Performance monitoring should trigger rollback
      const rollbackTriggered = await performanceMonitor.checkRollbackTriggers(deployment.id);
      expect(rollbackTriggered).toBe(true);

      // Verify rollback execution
      const { data: rollbacks } = await supabaseClient
        .from('rollback_executions')
        .select('*')
        .eq('deployment_id', deployment.id);

      expect(rollbacks).toHaveLength(1);
      expect(rollbacks?.[0].reason).toContain('error_rate');
      expect(rollbacks?.[0].status).toBe('completed');
    });

    it('should isolate failing segments', async () => {
      const rolloutConfig = {
        name: 'segment_isolation_test',
        target: 'multi_sport',
        sports: ['NFL', 'NBA', 'MLB']
      };

      const deployment = await orchestrator.startRollout(rolloutConfig);
      await orchestrator.progressToPhase(deployment.id, 'canary');

      // Mock NBA segment failure
      jest.spyOn(performanceMonitor, 'getSegmentHealth')
        .mockImplementation(async (deploymentId, sport) => {
          if (sport === 'NBA') {
            return { health: 0.3, errorRate: 0.20, issues: ['high_error_rate'] };
          }
          return { health: 0.95, errorRate: 0.02, issues: [] };
        });

      // Check segment health
      await performanceMonitor.monitorSegmentHealth(deployment.id);

      // Verify NBA segment was isolated
      const { data: isolatedSegments } = await supabaseClient
        .from('segment_isolations')
        .select('*')
        .eq('deployment_id', deployment.id);

      expect(isolatedSegments).toContainEqual(
        expect.objectContaining({
          segment_id: expect.stringContaining('NBA'),
          status: 'isolated',
          reason: 'high_error_rate'
        })
      );
    });
  });

  describe('Full Rollout (Phase C)', () => {
    it('should complete full unified_picks migration', async () => {
      const rolloutConfig = {
        name: 'full_migration_test',
        target: 'all_users',
        enableRetentionSweeps: true,
        enableCLVTracking: true
      };

      const deployment = await orchestrator.startRollout(rolloutConfig);

      // Progress through all phases
      await orchestrator.progressToPhase(deployment.id, 'canary');
      await orchestrator.progressToPhase(deployment.id, 'full');

      // Verify full rollout configuration
      const { data: flags } = await supabaseClient
        .from('feature_flags')
        .select('*')
        .eq('deployment_id', deployment.id);

      expect(flags).toContainEqual(
        expect.objectContaining({
          name: 'unified_picks_full',
          enabled: true,
          rollout_percentage: 100
        })
      );

      expect(flags).toContainEqual(
        expect.objectContaining({
          name: 'clv_tracking',
          enabled: true
        })
      );

      // Verify retention sweeps enabled
      expect(flags).toContainEqual(
        expect.objectContaining({
          name: 'retention_sweeps',
          enabled: true
        })
      );
    });

    it('should enable all Discord integration types', async () => {
      const rolloutConfig = {
        name: 'full_discord_test',
        target: 'all_users',
        enableAllAlertTypes: true
      };

      const deployment = await orchestrator.startRollout(rolloutConfig);
      await orchestrator.progressToPhase(deployment.id, 'full');

      const alertTypes = [
        'steam_alert',
        'middle_opportunity',
        'hedge_opportunity',
        'parlay_hedge',
        'clv_tracking',
        'tier_promotion'
      ];

      for (const alertType of alertTypes) {
        const { data: flag } = await supabaseClient
          .from('feature_flags')
          .select('*')
          .eq('deployment_id', deployment.id)
          .eq('name', `discord_${alertType}`)
          .single();

        expect(flag).toMatchObject({
          enabled: true,
          rollout_percentage: 100
        });
      }
    });
  });

  describe('Kill Switches & Emergency Procedures', () => {
    it('should execute emergency rollback', async () => {
      const rolloutConfig = {
        name: 'emergency_test',
        target: 'production_users'
      };

      const deployment = await orchestrator.startRollout(rolloutConfig);
      await orchestrator.progressToPhase(deployment.id, 'canary');

      // Create system snapshot before rollback
      const preRollbackState = await rollbackSystem.createSystemSnapshot(deployment.id);
      expect(preRollbackState.id).toBeDefined();

      // Trigger emergency rollback
      const rollback = await orchestrator.emergencyRollback(deployment.id, {
        reason: 'Critical system failure detected',
        severity: 'critical',
        triggeredBy: 'automated_monitor'
      });

      expect(rollback.status).toBe('completed');
      expect(rollback.reason).toContain('Critical system failure');

      // Verify system state restoration
      const { data: deployment_after } = await supabaseClient
        .from('rollout_deployments')
        .select('*')
        .eq('id', deployment.id)
        .single();

      expect(deployment_after?.status).toBe('rolled_back');
      expect(deployment_after?.current_phase).toBe('rollback');
    });

    it('should validate data consistency during rollback', async () => {
      const rolloutConfig = {
        name: 'consistency_test',
        target: 'test_users'
      };

      const deployment = await orchestrator.startRollout(rolloutConfig);

      // Create test data
      await supabaseClient.from('unified_picks').insert({
        id: 'consistency-test-1',
        capper_id: 'test-capper',
        player_name: 'Consistency Test',
        stat_type: 'points',
        line: 25.5,
        odds: -110,
        sport: 'NBA',
        workflow_stage: 'promoted'
      });

      // Execute rollback with consistency check
      const rollback = await rollbackSystem.executeRollback(deployment.id, {
        validateConsistency: true,
        backupData: true
      });

      expect(rollback.dataConsistencyValid).toBe(true);
      expect(rollback.backupCreated).toBe(true);

      // Verify data integrity
      const { data: testPick } = await supabaseClient
        .from('unified_picks')
        .select('*')
        .eq('id', 'consistency-test-1')
        .single();

      expect(testPick).toBeDefined();
      expect(testPick?.id).toBe('consistency-test-1');
    });

    it('should implement circuit breaker patterns', async () => {
      const rolloutConfig = {
        name: 'circuit_breaker_test',
        target: 'test_segment',
        circuitBreakerEnabled: true,
        errorThreshold: 10,
        timeWindow: 300000 // 5 minutes
      };

      const deployment = await orchestrator.startRollout(rolloutConfig);

      // Simulate rapid failures
      for (let i = 0; i < 12; i++) {
        await performanceMonitor.recordError(deployment.id, {
          type: 'api_error',
          message: `Test error ${i}`,
          timestamp: new Date()
        });
      }

      // Check circuit breaker status
      const circuitStatus = await performanceMonitor.getCircuitBreakerStatus(deployment.id);
      expect(circuitStatus.state).toBe('OPEN');
      expect(circuitStatus.errorCount).toBeGreaterThanOrEqual(10);

      // Verify deployment was paused
      const { data: pausedDeployment } = await supabaseClient
        .from('rollout_deployments')
        .select('status')
        .eq('id', deployment.id)
        .single();

      expect(pausedDeployment?.status).toBe('circuit_breaker_open');
    });
  });

  describe('Performance Monitoring', () => {
    it('should collect real-time metrics every 15 seconds', async () => {
      const rolloutConfig = {
        name: 'metrics_collection_test',
        target: 'monitoring_test'
      };

      const deployment = await orchestrator.startRollout(rolloutConfig);

      // Start metrics collection
      const metricsCollector = performanceMonitor.startRealTimeCollection(deployment.id, {
        interval: 1000, // 1 second for testing
        collectFor: 5000 // 5 seconds total
      });

      // Simulate some operations
      await redisService.set('metrics-test', 'value');
      await redisService.get('metrics-test');

      // Wait for collection to complete
      await metricsCollector;

      // Verify metrics were collected
      const { data: metrics } = await supabaseClient
        .from('rollout_metrics')
        .select('*')
        .eq('deployment_id', deployment.id)
        .order('collected_at', { ascending: false })
        .limit(5);

      expect(metrics).toBeDefined();
      expect(metrics?.length).toBeGreaterThan(0);
      expect(metrics?.[0]).toMatchObject({
        deployment_id: deployment.id,
        cache_hit_rate: expect.any(Number),
        response_time_p95: expect.any(Number)
      });
    });
  });
});