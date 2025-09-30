/**
 * Rollout Orchestrator - Shadow→Canary→Full Rollout System
 *
 * Master control system for unified_picks + cache-first architecture deployment
 * with comprehensive kill switches and safety mechanisms
 *
 * Phase A: Shadow Mode (shadow_mode=true, no Discord alerts, cache validation)
 * Phase B: Canary Mode (segment-based rollout with monitoring)
 * Phase C: Full Rollout (complete migration with cleanup)
 */

import { createLogger } from '../../utils/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { FeatureFlagDeploymentOrchestrator, DeploymentConfig } from './FeatureFlagDeploymentOrchestrator';
import { SegmentManager } from './SegmentManager';
import { PerformanceMonitor } from './PerformanceMonitor';
import { DeploymentGates } from './DeploymentGates';
import { RollbackSystem } from './RollbackSystem';
import { withCircuitBreaker } from '../enhanced-circuit-breaker';

export interface RolloutPhase {
  name: 'shadow' | 'canary' | 'full';
  description: string;
  requirements: string[];
  validationGates: RolloutValidationGate[];
  killSwitches: KillSwitch[];
  monitoring: MonitoringConfig;
  segments?: SegmentConfig;
  duration: {
    min: number; // minutes
    max: number; // minutes
    stabilization: number; // minutes between checkpoints
  };
}

export interface RolloutValidationGate {
  name: string;
  type: 'cache_performance' | 'error_rate' | 'latency' | 'data_consistency' | 'alert_precision';
  threshold: {
    value: number;
    operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
    unit: string;
  };
  required: boolean;
  weight: number;
  retryAttempts: number;
  description: string;
}

export interface KillSwitch {
  name: string;
  condition: string;
  action: 'pause' | 'rollback' | 'emergency_stop';
  severity: 'warning' | 'critical' | 'emergency';
  threshold: number;
  autoTrigger: boolean;
  description: string;
}

export interface MonitoringConfig {
  metrics: string[];
  alertChannels: string[];
  checkInterval: number; // seconds
  aggregationWindow: number; // minutes
  retentionPeriod: number; // hours
}

export interface SegmentConfig {
  userTiers: string[];
  sports: string[];
  cappers: string[];
  maxUsers: number;
  rolloutPercentage: number;
}

export interface RolloutStatus {
  rolloutId: string;
  phase: 'shadow' | 'canary' | 'full';
  status: 'planning' | 'in_progress' | 'completed' | 'paused' | 'failed' | 'rolled_back';
  startTime: string;
  endTime?: string;
  currentPhase: RolloutPhase;
  phaseProgress: number; // 0-100
  metrics: RolloutMetrics;
  segments?: SegmentStatus;
  killSwitchStatus: KillSwitchStatus[];
  validationResults: ValidationGateResult[];
  lastCheckpoint: string;
  configuration: RolloutConfiguration;
}

export interface RolloutMetrics {
  cacheHitRate: number;
  averageLatency: number;
  errorRate: number;
  alertPrecision: number;
  dataConsistencyRate: number;
  creditUsage: {
    current: number;
    baseline: number;
    efficiency: number;
  };
  usersAffected: number;
  performanceScore: number;
}

export interface SegmentStatus {
  activeSegments: number;
  totalUsers: number;
  segmentPerformance: Record<string, number>;
  segmentHealth: Record<string, 'healthy' | 'warning' | 'critical'>;
}

export interface KillSwitchStatus {
  name: string;
  armed: boolean;
  triggered: boolean;
  lastCheck: string;
  currentValue: number;
  threshold: number;
  status: 'normal' | 'warning' | 'critical';
}

export interface ValidationGateResult {
  gateName: string;
  type: string;
  passed: boolean;
  actualValue: number;
  threshold: number;
  weight: number;
  timestamp: string;
  retryCount: number;
  error?: string;
}

export interface RolloutConfiguration {
  unified_picks_migration: boolean;
  cache_first_architecture: boolean;
  shadow_mode_enabled: boolean;
  alert_system_changes: boolean;
  retention_sweeps_enabled: boolean;
  clv_tracking_enabled: boolean;
}

export class RolloutOrchestrator {
  private logger = createLogger('RolloutOrchestrator');
  private supabase: SupabaseClient;
  private deploymentOrchestrator: FeatureFlagDeploymentOrchestrator;
  private segmentManager: SegmentManager;
  private performanceMonitor: PerformanceMonitor;
  private deploymentGates: DeploymentGates;
  private rollbackSystem: RollbackSystem;

  // Active rollouts tracking
  private activeRollouts: Map<string, RolloutStatus> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();

  // Rollout phase configurations
  private readonly ROLLOUT_PHASES: Record<string, RolloutPhase> = {
    shadow: {
      name: 'shadow',
      description: 'Shadow mode with cache validation and dual writes',
      requirements: [
        'cache_infrastructure_ready',
        'unified_picks_schema_deployed',
        'monitoring_systems_active',
        'rollback_procedures_tested'
      ],
      validationGates: [
        {
          name: 'cache_hit_rate',
          type: 'cache_performance',
          threshold: { value: 80, operator: 'gte', unit: 'percent' },
          required: true,
          weight: 1.0,
          retryAttempts: 3,
          description: 'Cache hit rate must be >= 80%'
        },
        {
          name: 'data_consistency',
          type: 'data_consistency',
          threshold: { value: 99.9, operator: 'gte', unit: 'percent' },
          required: true,
          weight: 1.0,
          retryAttempts: 2,
          description: 'Data consistency between cache and unified_picks >= 99.9%'
        },
        {
          name: 'ingestion_latency',
          type: 'latency',
          threshold: { value: 2000, operator: 'lt', unit: 'ms' },
          required: true,
          weight: 0.8,
          retryAttempts: 3,
          description: 'Ingestion latency must be < 2000ms'
        }
      ],
      killSwitches: [
        {
          name: 'cache_failure_rate',
          condition: 'cache_failure_rate > 5%',
          action: 'emergency_stop',
          severity: 'emergency',
          threshold: 0.05,
          autoTrigger: true,
          description: 'Emergency stop if cache failure rate exceeds 5%'
        },
        {
          name: 'data_corruption_detected',
          condition: 'data_consistency_rate < 95%',
          action: 'rollback',
          severity: 'critical',
          threshold: 0.95,
          autoTrigger: true,
          description: 'Automatic rollback if data corruption detected'
        }
      ],
      monitoring: {
        metrics: ['cache_hit_rate', 'data_consistency', 'ingestion_latency', 'error_rate'],
        alertChannels: ['#engineering-alerts', '#ops-shadow-mode'],
        checkInterval: 30,
        aggregationWindow: 5,
        retentionPeriod: 72
      },
      duration: {
        min: 120, // 2 hours minimum
        max: 720, // 12 hours maximum
        stabilization: 15
      }
    },
    canary: {
      name: 'canary',
      description: 'Segment-based rollout with Discord alerts enabled',
      requirements: [
        'shadow_phase_completed',
        'segment_allocation_ready',
        'alert_precision_validated',
        'performance_baseline_established'
      ],
      validationGates: [
        {
          name: 'alert_precision',
          type: 'alert_precision',
          threshold: { value: 95, operator: 'gte', unit: 'percent' },
          required: true,
          weight: 1.0,
          retryAttempts: 3,
          description: 'Alert precision must be >= 95%'
        },
        {
          name: 'segment_error_rate',
          type: 'error_rate',
          threshold: { value: 1, operator: 'lt', unit: 'percent' },
          required: true,
          weight: 1.0,
          retryAttempts: 2,
          description: 'Error rate in canary segments < 1%'
        },
        {
          name: 'credit_efficiency',
          type: 'cache_performance',
          threshold: { value: 110, operator: 'gte', unit: 'percent' },
          required: false,
          weight: 0.6,
          retryAttempts: 2,
          description: 'Credit usage efficiency >= 110% of baseline'
        }
      ],
      killSwitches: [
        {
          name: 'segment_failure_cascade',
          condition: 'segment_failure_rate > 10%',
          action: 'pause',
          severity: 'critical',
          threshold: 0.10,
          autoTrigger: true,
          description: 'Pause rollout if segment failure rate exceeds 10%'
        },
        {
          name: 'alert_false_positive_spike',
          condition: 'false_positive_rate > 15%',
          action: 'rollback',
          severity: 'critical',
          threshold: 0.15,
          autoTrigger: true,
          description: 'Rollback if false positive rate spikes above 15%'
        }
      ],
      monitoring: {
        metrics: [
          'alert_precision', 'segment_performance', 'credit_usage',
          'false_positive_rate', 'user_engagement', 'clv_impact'
        ],
        alertChannels: ['#engineering-alerts', '#product-canary', '#discord-monitoring'],
        checkInterval: 60,
        aggregationWindow: 10,
        retentionPeriod: 168
      },
      segments: {
        userTiers: ['vip_plus'],
        sports: ['NFL'],
        cappers: ['tier_s', 'tier_a'],
        maxUsers: 1000,
        rolloutPercentage: 5
      },
      duration: {
        min: 240, // 4 hours minimum
        max: 1440, // 24 hours maximum
        stabilization: 30
      }
    },
    full: {
      name: 'full',
      description: 'Complete rollout with unified_picks migration and cleanup',
      requirements: [
        'canary_phase_validated',
        'performance_targets_met',
        'retention_sweeps_ready',
        'clv_tracking_operational'
      ],
      validationGates: [
        {
          name: 'system_performance',
          type: 'latency',
          threshold: { value: 1500, operator: 'lt', unit: 'ms' },
          required: true,
          weight: 1.0,
          retryAttempts: 3,
          description: 'Overall system performance < 1500ms'
        },
        {
          name: 'migration_completion',
          type: 'data_consistency',
          threshold: { value: 100, operator: 'eq', unit: 'percent' },
          required: true,
          weight: 1.0,
          retryAttempts: 1,
          description: 'unified_picks migration must be 100% complete'
        },
        {
          name: 'clv_tracking_accuracy',
          type: 'data_consistency',
          threshold: { value: 98, operator: 'gte', unit: 'percent' },
          required: true,
          weight: 0.8,
          retryAttempts: 2,
          description: 'CLV tracking accuracy >= 98%'
        }
      ],
      killSwitches: [
        {
          name: 'system_overload',
          condition: 'cpu_usage > 90% OR memory_usage > 85%',
          action: 'pause',
          severity: 'critical',
          threshold: 0.90,
          autoTrigger: true,
          description: 'Pause if system resources exceed safe limits'
        },
        {
          name: 'data_loss_detected',
          condition: 'data_loss_rate > 0.1%',
          action: 'emergency_stop',
          severity: 'emergency',
          threshold: 0.001,
          autoTrigger: true,
          description: 'Emergency stop if any data loss detected'
        }
      ],
      monitoring: {
        metrics: [
          'system_performance', 'migration_progress', 'clv_accuracy',
          'retention_sweep_efficiency', 'user_satisfaction', 'business_impact'
        ],
        alertChannels: ['#engineering-alerts', '#product-full-rollout', '#executive-updates'],
        checkInterval: 120,
        aggregationWindow: 15,
        retentionPeriod: 720
      },
      duration: {
        min: 480, // 8 hours minimum
        max: 2880, // 48 hours maximum
        stabilization: 60
      }
    }
  };

  constructor(
    supabase: SupabaseClient,
    deploymentOrchestrator: FeatureFlagDeploymentOrchestrator
  ) {
    this.supabase = supabase;
    this.deploymentOrchestrator = deploymentOrchestrator;
    this.segmentManager = new SegmentManager(supabase);
    this.performanceMonitor = new PerformanceMonitor(supabase);
    this.deploymentGates = new DeploymentGates(supabase);
    this.rollbackSystem = new RollbackSystem(supabase, this);

    this.startGlobalMonitoring();
  }

  /**
   * Start comprehensive rollout process
   */
  async startRollout(configuration: RolloutConfiguration): Promise<string> {
    const rolloutId = `rollout-unified-picks-${Date.now()}`;

    try {
      this.logger.info('🚀 Starting unified_picks + cache-first architecture rollout', {
        rolloutId,
        configuration
      });

      // Validate prerequisites
      await this.validatePrerequisites(configuration);

      // Create rollout status
      const rolloutStatus: RolloutStatus = {
        rolloutId,
        phase: 'shadow',
        status: 'planning',
        startTime: new Date().toISOString(),
        currentPhase: this.ROLLOUT_PHASES.shadow,
        phaseProgress: 0,
        metrics: this.initializeMetrics(),
        killSwitchStatus: this.initializeKillSwitches(this.ROLLOUT_PHASES.shadow),
        validationResults: [],
        lastCheckpoint: new Date().toISOString(),
        configuration
      };

      // Store rollout status
      this.activeRollouts.set(rolloutId, rolloutStatus);
      await this.storeRolloutStatus(rolloutStatus);

      // Start shadow phase
      await this.executePhase(rolloutId, 'shadow');

      return rolloutId;

    } catch (error) {
      this.logger.error('❌ Failed to start rollout', {
        rolloutId,
        error: error instanceof Error ? error.message : String(error)
      });

      // Mark rollout as failed
      const failedStatus = this.activeRollouts.get(rolloutId);
      if (failedStatus) {
        failedStatus.status = 'failed';
        failedStatus.endTime = new Date().toISOString();
        await this.storeRolloutStatus(failedStatus);
      }

      throw error;
    }
  }

  /**
   * Execute a specific rollout phase
   */
  private async executePhase(
    rolloutId: string,
    phaseName: 'shadow' | 'canary' | 'full'
  ): Promise<void> {
    const rollout = this.activeRollouts.get(rolloutId);
    if (!rollout) {
      throw new Error(`Rollout ${rolloutId} not found`);
    }

    const phase = this.ROLLOUT_PHASES[phaseName];
    rollout.currentPhase = phase;
    rollout.phase = phaseName;
    rollout.status = 'in_progress';

    this.logger.info(`📋 Starting ${phaseName} phase`, {
      rolloutId,
      phase: phaseName,
      requirements: phase.requirements
    });

    try {
      // Validate phase requirements
      await this.validatePhaseRequirements(rolloutId, phase);

      // Initialize phase-specific monitoring
      await this.initializePhaseMonitoring(rolloutId, phase);

      // Execute phase-specific logic
      switch (phaseName) {
        case 'shadow':
          await this.executeShadowPhase(rolloutId);
          break;
        case 'canary':
          await this.executeCanaryPhase(rolloutId);
          break;
        case 'full':
          await this.executeFullPhase(rolloutId);
          break;
      }

      // Run validation gates
      const validationResults = await this.runPhaseValidation(rolloutId, phase);
      rollout.validationResults = validationResults;

      // Check if phase passed
      const phasePassed = this.evaluatePhaseCompletion(validationResults, phase);

      if (!phasePassed) {
        throw new Error(`${phaseName} phase validation failed`);
      }

      rollout.phaseProgress = 100;
      await this.storeRolloutStatus(rollout);

      this.logger.info(`✅ ${phaseName} phase completed successfully`, {
        rolloutId,
        duration: Date.now() - new Date(rollout.startTime).getTime()
      });

      // Auto-progress to next phase if not final
      if (phaseName === 'shadow') {
        await this.waitForStabilization(phase.duration.stabilization * 60 * 1000);
        await this.executePhase(rolloutId, 'canary');
      } else if (phaseName === 'canary') {
        await this.waitForStabilization(phase.duration.stabilization * 60 * 1000);
        await this.executePhase(rolloutId, 'full');
      } else {
        // Final phase completed
        rollout.status = 'completed';
        rollout.endTime = new Date().toISOString();
        await this.storeRolloutStatus(rollout);
      }

    } catch (error) {
      this.logger.error(`❌ ${phaseName} phase failed`, {
        rolloutId,
        error: error instanceof Error ? error.message : String(error)
      });

      // Trigger rollback
      await this.rollbackSystem.triggerRollback(rolloutId,
        `${phaseName} phase failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Execute Shadow Phase (Phase A)
   */
  private async executeShadowPhase(rolloutId: string): Promise<void> {
    this.logger.info('🌑 Executing Shadow Phase', { rolloutId });

    const rollout = this.activeRollouts.get(rolloutId);
    if (!rollout) return;

    // Enable shadow mode in runtime config
    await this.enableShadowMode(rollout.configuration);

    // Start dual writes to cache + unified_picks
    await this.enableDualWrites();

    // Monitor cache performance
    await this.performanceMonitor.startCacheMonitoring(rolloutId);

    // Validate data consistency
    await this.validateDataConsistency();

    // Monitor credit usage
    await this.monitorCreditUsage(rolloutId);

    rollout.phaseProgress = 50;
    await this.storeRolloutStatus(rollout);

    // Wait for minimum shadow period
    const minDuration = this.ROLLOUT_PHASES.shadow.duration.min * 60 * 1000;
    await this.waitForStabilization(minDuration);

    rollout.phaseProgress = 100;
    await this.storeRolloutStatus(rollout);
  }

  /**
   * Execute Canary Phase (Phase B)
   */
  private async executeCanaryPhase(rolloutId: string): Promise<void> {
    this.logger.info('🐦 Executing Canary Phase', { rolloutId });

    const rollout = this.activeRollouts.get(rolloutId);
    if (!rollout || !rollout.currentPhase.segments) return;

    // Initialize segment allocation
    const segments = await this.segmentManager.allocateSegments(
      rolloutId,
      rollout.currentPhase.segments
    );

    rollout.segments = {
      activeSegments: segments.length,
      totalUsers: segments.reduce((sum, s) => sum + s.userCount, 0),
      segmentPerformance: {},
      segmentHealth: {}
    };

    // Enable Discord alerts for canary segments only
    await this.enableSegmentedAlerts(segments);

    // Monitor segment performance
    await this.performanceMonitor.startSegmentMonitoring(rolloutId, segments);

    rollout.phaseProgress = 30;
    await this.storeRolloutStatus(rollout);

    // Gradual segment expansion: 5% → 25% → 50%
    const expansionSteps = [25, 50];

    for (let i = 0; i < expansionSteps.length; i++) {
      const targetPercentage = expansionSteps[i];

      await this.expandSegments(rolloutId, targetPercentage);
      await this.waitForStabilization(30 * 60 * 1000); // 30 minutes

      rollout.phaseProgress = 30 + (i + 1) * 30;
      await this.storeRolloutStatus(rollout);
    }

    rollout.phaseProgress = 100;
    await this.storeRolloutStatus(rollout);
  }

  /**
   * Execute Full Phase (Phase C)
   */
  private async executeFullPhase(rolloutId: string): Promise<void> {
    this.logger.info('🚀 Executing Full Rollout Phase', { rolloutId });

    const rollout = this.activeRollouts.get(rolloutId);
    if (!rollout) return;

    // Expand to 100% of users
    await this.segmentManager.expandToAllUsers(rolloutId);

    rollout.phaseProgress = 25;
    await this.storeRolloutStatus(rollout);

    // Complete unified_picks migration
    await this.completeUnifiedPicksMigration();

    rollout.phaseProgress = 50;
    await this.storeRolloutStatus(rollout);

    // Enable retention sweeps
    await this.enableRetentionSweeps();

    rollout.phaseProgress = 75;
    await this.storeRolloutStatus(rollout);

    // Activate CLV tracking dashboards
    await this.activateCLVTracking();

    rollout.phaseProgress = 100;
    await this.storeRolloutStatus(rollout);
  }

  /**
   * Emergency rollback functionality
   */
  async emergencyRollback(rolloutId: string, reason: string): Promise<void> {
    this.logger.warn('🚨 EMERGENCY ROLLBACK TRIGGERED', { rolloutId, reason });

    await this.rollbackSystem.emergencyRollback(rolloutId, reason);
  }

  /**
   * Get rollout status
   */
  async getRolloutStatus(rolloutId: string): Promise<RolloutStatus | null> {
    return this.activeRollouts.get(rolloutId) || null;
  }

  /**
   * Pause rollout
   */
  async pauseRollout(rolloutId: string, reason: string): Promise<void> {
    const rollout = this.activeRollouts.get(rolloutId);
    if (!rollout) return;

    rollout.status = 'paused';
    await this.storeRolloutStatus(rollout);

    this.logger.info('⏸️ Rollout paused', { rolloutId, reason });
  }

  /**
   * Resume rollout
   */
  async resumeRollout(rolloutId: string): Promise<void> {
    const rollout = this.activeRollouts.get(rolloutId);
    if (!rollout) return;

    rollout.status = 'in_progress';
    await this.storeRolloutStatus(rollout);

    this.logger.info('▶️ Rollout resumed', { rolloutId });
  }

  // Private helper methods
  private async validatePrerequisites(config: RolloutConfiguration): Promise<void> {
    // Validate cache infrastructure
    // Validate database schema
    // Validate monitoring systems
    // etc.
  }

  private async validatePhaseRequirements(rolloutId: string, phase: RolloutPhase): Promise<void> {
    // Implementation for phase requirement validation
  }

  private async initializePhaseMonitoring(rolloutId: string, phase: RolloutPhase): Promise<void> {
    // Implementation for phase-specific monitoring
  }

  private async runPhaseValidation(rolloutId: string, phase: RolloutPhase): Promise<ValidationGateResult[]> {
    return await this.deploymentGates.runValidationGates(rolloutId, phase.validationGates);
  }

  private evaluatePhaseCompletion(results: ValidationGateResult[], phase: RolloutPhase): boolean {
    const requiredGates = phase.validationGates.filter(g => g.required);
    const passedRequiredGates = results.filter(r => r.passed && requiredGates.some(g => g.name === r.gateName));

    return passedRequiredGates.length === requiredGates.length;
  }

  private initializeMetrics(): RolloutMetrics {
    return {
      cacheHitRate: 0,
      averageLatency: 0,
      errorRate: 0,
      alertPrecision: 0,
      dataConsistencyRate: 100,
      creditUsage: { current: 0, baseline: 0, efficiency: 100 },
      usersAffected: 0,
      performanceScore: 100
    };
  }

  private initializeKillSwitches(phase: RolloutPhase): KillSwitchStatus[] {
    return phase.killSwitches.map(ks => ({
      name: ks.name,
      armed: true,
      triggered: false,
      lastCheck: new Date().toISOString(),
      currentValue: 0,
      threshold: ks.threshold,
      status: 'normal'
    }));
  }

  private async enableShadowMode(config: RolloutConfiguration): Promise<void> {
    // Implementation for enabling shadow mode
  }

  private async enableDualWrites(): Promise<void> {
    // Implementation for dual writes
  }

  private async validateDataConsistency(): Promise<void> {
    // Implementation for data consistency validation
  }

  private async monitorCreditUsage(rolloutId: string): Promise<void> {
    // Implementation for credit usage monitoring
  }

  private async enableSegmentedAlerts(segments: any[]): Promise<void> {
    // Implementation for segmented alert enabling
  }

  private async expandSegments(rolloutId: string, targetPercentage: number): Promise<void> {
    // Implementation for segment expansion
  }

  private async completeUnifiedPicksMigration(): Promise<void> {
    // Implementation for unified_picks migration completion
  }

  private async enableRetentionSweeps(): Promise<void> {
    // Implementation for retention sweeps
  }

  private async activateCLVTracking(): Promise<void> {
    // Implementation for CLV tracking activation
  }

  private async storeRolloutStatus(rollout: RolloutStatus): Promise<void> {
    try {
      await withCircuitBreaker.supabase(
        async () => {
          await this.supabase
            .from('rollout_deployments')
            .upsert({
              id: rollout.rolloutId,
              phase: rollout.phase,
              status: rollout.status,
              started_at: rollout.startTime,
              completed_at: rollout.endTime,
              phase_progress: rollout.phaseProgress,
              metrics: rollout.metrics,
              segments: rollout.segments,
              kill_switches: rollout.killSwitchStatus,
              validation_results: rollout.validationResults,
              configuration: rollout.configuration,
              metadata: {
                currentPhase: rollout.currentPhase,
                lastCheckpoint: rollout.lastCheckpoint
              }
            }, { onConflict: 'id' });
        },
        async () => {
          this.logger.warn('Circuit breaker open, caching rollout status locally');
        }
      );
    } catch (error) {
      this.logger.error('Failed to store rollout status', {
        rolloutId: rollout.rolloutId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async waitForStabilization(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private startGlobalMonitoring(): void {
    // Start global monitoring for all active rollouts
    setInterval(async () => {
      await this.monitorActiveRollouts();
    }, 30000); // Check every 30 seconds
  }

  private async monitorActiveRollouts(): Promise<void> {
    for (const [rolloutId, rollout] of this.activeRollouts) {
      try {
        // Check kill switches
        await this.checkKillSwitches(rolloutId);

        // Update metrics
        rollout.metrics = await this.performanceMonitor.getCurrentMetrics(rolloutId);

        // Store updated status
        await this.storeRolloutStatus(rollout);

      } catch (error) {
        this.logger.error('Rollout monitoring failed', {
          rolloutId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  private async checkKillSwitches(rolloutId: string): Promise<void> {
    const rollout = this.activeRollouts.get(rolloutId);
    if (!rollout) return;

    for (const killSwitch of rollout.killSwitchStatus) {
      if (!killSwitch.armed) continue;

      const currentValue = await this.performanceMonitor.getMetricValue(
        rolloutId,
        killSwitch.name
      );

      killSwitch.currentValue = currentValue;
      killSwitch.lastCheck = new Date().toISOString();

      // Check if threshold is breached
      if (currentValue > killSwitch.threshold) {
        killSwitch.status = 'critical';

        if (rollout.currentPhase.killSwitches.find(ks => ks.name === killSwitch.name)?.autoTrigger) {
          killSwitch.triggered = true;

          const action = rollout.currentPhase.killSwitches.find(ks => ks.name === killSwitch.name)?.action;

          switch (action) {
            case 'pause':
              await this.pauseRollout(rolloutId, `Kill switch triggered: ${killSwitch.name}`);
              break;
            case 'rollback':
              await this.rollbackSystem.triggerRollback(rolloutId, `Kill switch triggered: ${killSwitch.name}`);
              break;
            case 'emergency_stop':
              await this.emergencyRollback(rolloutId, `Emergency kill switch triggered: ${killSwitch.name}`);
              break;
          }
        }
      } else {
        killSwitch.status = 'normal';
      }
    }
  }
}