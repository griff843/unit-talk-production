/**
 * Canary Mode (Phase B) - Segment-based rollout with Discord alerts enabled
 *
 * Features:
 * - Discord/feeds enabled for small watchlist segments
 * - Feature flag controls for gradual rollout
 * - Real-time segment health monitoring
 * - Automatic segment isolation on performance degradation
 * - Progressive traffic allocation (5% → 25% → 50%)
 */

import { SegmentManager, SegmentConfiguration, SegmentHealth } from '../SegmentManager';
import { PerformanceMonitor, MetricAlert } from '../PerformanceMonitor';
import { createLogger } from '../../../utils/logger';
import { supabaseClient } from '../../../services/supabaseClient';

const logger = createLogger('CanaryMode');

// Canary Mode Configuration
export interface CanaryModeConfig {
  segments: {
    vip_plus: { enabled: boolean; trafficPercentage: number; maxUsers: number };
    nfl: { enabled: boolean; trafficPercentage: number; maxUsers: number };
    tier_s_cappers: { enabled: boolean; trafficPercentage: number; maxUsers: number };
  };
  progressionSteps: number[];
  stabilizationPeriod: number; // minutes
  rollbackThresholds: {
    errorRate: number;
    latencyP95: number;
    alertAccuracy: number;
    segmentFailureRate: number;
  };
  featureFlags: {
    discord_alerts_enabled: boolean;
    feed_generation_enabled: boolean;
    unified_picks_reads: boolean;
    cache_fallback_enabled: boolean;
  };
}

// Segment Performance Tracking
export interface SegmentPerformance {
  segmentId: string;
  segmentName: string;
  trafficPercentage: number;
  activeUsers: number;
  metrics: {
    errorRate: number;
    averageLatency: number;
    alertsGenerated: number;
    alertAccuracy: number;
    cacheHitRate: number;
    discordPostsSuccessful: number;
    discordPostsFailed: number;
  };
  health: 'healthy' | 'warning' | 'critical' | 'isolated';
  lastUpdated: string;
  performanceScore: number;
}

// Canary Mode Status
export interface CanaryModeStatus {
  active: boolean;
  currentStep: number;
  totalSteps: number;
  overallProgress: number;
  segments: SegmentPerformance[];
  globalMetrics: {
    totalActiveUsers: number;
    overallErrorRate: number;
    averageAlertAccuracy: number;
    discordIntegrationHealth: 'healthy' | 'degraded' | 'failed';
  };
  stabilizationStatus: {
    inProgress: boolean;
    remainingMinutes: number;
    requiredForProgression: boolean;
  };
  nextProgressionEligible: boolean;
  lastProgressionAt?: string;
}

export class CanaryMode {
  private segmentManager: SegmentManager;
  private performanceMonitor: PerformanceMonitor;
  private config: CanaryModeConfig;
  private status: CanaryModeStatus;
  private monitoringInterval?: NodeJS.Timeout;
  private stabilizationTimer?: NodeJS.Timeout;

  constructor(
    segmentManager: SegmentManager,
    performanceMonitor: PerformanceMonitor,
    config?: Partial<CanaryModeConfig>
  ) {
    this.segmentManager = segmentManager;
    this.performanceMonitor = performanceMonitor;

    // Default canary configuration
    this.config = {
      segments: {
        vip_plus: { enabled: true, trafficPercentage: 5, maxUsers: 50 },
        nfl: { enabled: true, trafficPercentage: 5, maxUsers: 100 },
        tier_s_cappers: { enabled: true, trafficPercentage: 10, maxUsers: 25 }
      },
      progressionSteps: [5, 15, 25, 50],
      stabilizationPeriod: 30,
      rollbackThresholds: {
        errorRate: 2.0, // 2% max error rate
        latencyP95: 3000, // 3s max P95 latency
        alertAccuracy: 90, // 90% min alert accuracy
        segmentFailureRate: 15 // 15% max segment failure rate
      },
      featureFlags: {
        discord_alerts_enabled: true,
        feed_generation_enabled: true,
        unified_picks_reads: true,
        cache_fallback_enabled: true
      },
      ...config
    };

    this.status = {
      active: false,
      currentStep: 0,
      totalSteps: this.config.progressionSteps.length,
      overallProgress: 0,
      segments: [],
      globalMetrics: {
        totalActiveUsers: 0,
        overallErrorRate: 0,
        averageAlertAccuracy: 0,
        discordIntegrationHealth: 'healthy'
      },
      stabilizationStatus: {
        inProgress: false,
        remainingMinutes: 0,
        requiredForProgression: false
      },
      nextProgressionEligible: false
    };
  }

  /**
   * Start Canary Mode rollout
   */
  async startCanaryMode(): Promise<void> {
    try {
      logger.info('Starting Canary Mode rollout');

      // Validate prerequisites
      await this.validatePrerequisites();

      // Initialize segments with base traffic allocation
      await this.initializeSegments();

      // Enable feature flags
      await this.enableFeatureFlags();

      // Start monitoring
      await this.startMonitoring();

      // Update status
      this.status.active = true;
      this.status.currentStep = 0;
      this.status.overallProgress = 0;

      // Persist to database
      await this.persistCanaryModeStatus();

      logger.info('Canary Mode started successfully', {
        segments: this.config.segments,
        currentStep: this.status.currentStep
      });

    } catch (error) {
      logger.error('Failed to start Canary Mode', { error });
      throw new Error(`Canary Mode initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Stop Canary Mode and rollback
   */
  async stopCanaryMode(reason: string = 'Manual stop'): Promise<void> {
    try {
      logger.warn('Stopping Canary Mode', { reason });

      // Stop monitoring
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = undefined;
      }

      if (this.stabilizationTimer) {
        clearTimeout(this.stabilizationTimer);
        this.stabilizationTimer = undefined;
      }

      // Disable feature flags
      await this.disableFeatureFlags();

      // Isolate all segments
      await this.isolateAllSegments();

      // Update status
      this.status.active = false;
      this.status.segments = this.status.segments.map(segment => ({
        ...segment,
        health: 'isolated' as const
      }));

      // Persist final status
      await this.persistCanaryModeStatus();

      logger.info('Canary Mode stopped successfully', { reason });

    } catch (error) {
      logger.error('Failed to stop Canary Mode properly', { error, reason });
      throw error;
    }
  }

  /**
   * Progress to next canary step
   */
  async progressToNextStep(): Promise<boolean> {
    try {
      if (!this.status.active) {
        throw new Error('Canary Mode is not active');
      }

      if (this.status.currentStep >= this.status.totalSteps - 1) {
        logger.info('Canary Mode completed all steps');
        return true;
      }

      if (!this.status.nextProgressionEligible) {
        logger.warn('Not eligible for progression yet', {
          stabilizationInProgress: this.status.stabilizationStatus.inProgress,
          segmentHealth: this.status.segments.map(s => ({ id: s.segmentId, health: s.health }))
        });
        return false;
      }

      const nextStep = this.status.currentStep + 1;
      const targetTraffic = this.config.progressionSteps[nextStep];

      logger.info('Progressing canary to next step', {
        currentStep: this.status.currentStep,
        nextStep,
        targetTraffic
      });

      // Update segment traffic allocations
      await this.updateSegmentTraffic(targetTraffic);

      // Update status
      this.status.currentStep = nextStep;
      this.status.overallProgress = ((nextStep + 1) / this.status.totalSteps) * 100;
      this.status.lastProgressionAt = new Date().toISOString();
      this.status.nextProgressionEligible = false;

      // Start stabilization period
      await this.startStabilizationPeriod();

      // Persist status
      await this.persistCanaryModeStatus();

      logger.info('Progressed to canary step', {
        step: nextStep,
        progress: this.status.overallProgress,
        targetTraffic
      });

      return nextStep >= this.status.totalSteps - 1;

    } catch (error) {
      logger.error('Failed to progress canary step', { error });
      throw error;
    }
  }

  /**
   * Get current canary mode status
   */
  getStatus(): CanaryModeStatus {
    return { ...this.status };
  }

  /**
   * Validate prerequisites for canary mode
   */
  private async validatePrerequisites(): Promise<void> {
    // Check shadow mode completion
    const { data: shadowModeStatus } = await supabaseClient
      .from('rollout_phases')
      .select('status, validation_results')
      .eq('phase_name', 'shadow')
      .single();

    if (!shadowModeStatus || shadowModeStatus.status !== 'completed') {
      throw new Error('Shadow mode must be completed before canary mode');
    }

    // Validate segment manager readiness
    const segmentHealth = await this.segmentManager.getOverallHealth();
    if (segmentHealth.status !== 'healthy') {
      throw new Error(`Segment manager not healthy: ${segmentHealth.issues.join(', ')}`);
    }

    // Check Discord integration health
    const discordHealth = await this.checkDiscordIntegrationHealth();
    if (!discordHealth.healthy) {
      throw new Error(`Discord integration unhealthy: ${discordHealth.error}`);
    }
  }

  /**
   * Initialize segments for canary rollout
   */
  private async initializeSegments(): Promise<void> {
    const enabledSegments = Object.entries(this.config.segments)
      .filter(([_, config]) => config.enabled);

    for (const [segmentName, segmentConfig] of enabledSegments) {
      const segmentUsers = await this.segmentManager.allocateSegment({
        segmentType: segmentName as any,
        targetUsers: Math.min(
          segmentConfig.maxUsers,
          Math.floor(segmentConfig.maxUsers * (segmentConfig.trafficPercentage / 100))
        ),
        criteria: this.getSegmentCriteria(segmentName)
      });

      const performance: SegmentPerformance = {
        segmentId: segmentUsers.segmentId,
        segmentName,
        trafficPercentage: segmentConfig.trafficPercentage,
        activeUsers: segmentUsers.allocatedUsers.length,
        metrics: {
          errorRate: 0,
          averageLatency: 0,
          alertsGenerated: 0,
          alertAccuracy: 0,
          cacheHitRate: 0,
          discordPostsSuccessful: 0,
          discordPostsFailed: 0
        },
        health: 'healthy',
        lastUpdated: new Date().toISOString(),
        performanceScore: 100
      };

      this.status.segments.push(performance);
    }
  }

  /**
   * Enable feature flags for canary mode
   */
  private async enableFeatureFlags(): Promise<void> {
    const flags = this.config.featureFlags;

    await supabaseClient
      .from('feature_flags')
      .upsert([
        { flag_name: 'discord_alerts_enabled', enabled: flags.discord_alerts_enabled, rollout_percentage: 0 },
        { flag_name: 'feed_generation_enabled', enabled: flags.feed_generation_enabled, rollout_percentage: 0 },
        { flag_name: 'unified_picks_reads', enabled: flags.unified_picks_reads, rollout_percentage: 0 },
        { flag_name: 'cache_fallback_enabled', enabled: flags.cache_fallback_enabled, rollout_percentage: 100 }
      ]);
  }

  /**
   * Start real-time monitoring
   */
  private async startMonitoring(): Promise<void> {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectSegmentMetrics();
        await this.evaluateSegmentHealth();
        await this.checkProgressionEligibility();
      } catch (error) {
        logger.error('Monitoring cycle failed', { error });
      }
    }, 30000); // 30 second intervals

    logger.info('Started canary mode monitoring');
  }

  /**
   * Collect metrics for all segments
   */
  private async collectSegmentMetrics(): Promise<void> {
    for (const segment of this.status.segments) {
      try {
        // Get performance metrics from monitor
        const metrics = await this.performanceMonitor.getSegmentMetrics(segment.segmentId);

        // Get Discord integration metrics
        const discordMetrics = await this.getDiscordMetrics(segment.segmentId);

        // Update segment metrics
        segment.metrics = {
          errorRate: metrics?.errorRate || 0,
          averageLatency: metrics?.averageLatency || 0,
          alertsGenerated: metrics?.alertsGenerated || 0,
          alertAccuracy: metrics?.alertAccuracy || 0,
          cacheHitRate: metrics?.cacheHitRate || 0,
          discordPostsSuccessful: discordMetrics.successful,
          discordPostsFailed: discordMetrics.failed
        };

        segment.lastUpdated = new Date().toISOString();

        // Calculate performance score
        segment.performanceScore = this.calculateSegmentPerformanceScore(segment);

      } catch (error) {
        logger.error('Failed to collect segment metrics', {
          segmentId: segment.segmentId,
          error
        });
      }
    }

    // Update global metrics
    this.updateGlobalMetrics();
  }

  /**
   * Evaluate health of all segments
   */
  private async evaluateSegmentHealth(): Promise<void> {
    for (const segment of this.status.segments) {
      const previousHealth = segment.health;

      // Evaluate health based on thresholds
      if (segment.metrics.errorRate > this.config.rollbackThresholds.errorRate) {
        segment.health = 'critical';
      } else if (segment.metrics.latencyP95 > this.config.rollbackThresholds.latencyP95) {
        segment.health = 'critical';
      } else if (segment.metrics.alertAccuracy < this.config.rollbackThresholds.alertAccuracy) {
        segment.health = 'warning';
      } else if (segment.performanceScore < 80) {
        segment.health = 'warning';
      } else {
        segment.health = 'healthy';
      }

      // Handle health degradation
      if (segment.health === 'critical' && previousHealth !== 'critical') {
        logger.error('Segment health critical - isolating', {
          segmentId: segment.segmentId,
          metrics: segment.metrics
        });
        await this.isolateSegment(segment.segmentId);
        segment.health = 'isolated';
      }
    }
  }

  /**
   * Check if progression to next step is eligible
   */
  private async checkProgressionEligibility(): Promise<void> {
    // Don't progress if stabilization is in progress
    if (this.status.stabilizationStatus.inProgress) {
      this.status.nextProgressionEligible = false;
      return;
    }

    // Check overall health
    const healthySegments = this.status.segments.filter(s => s.health === 'healthy').length;
    const totalSegments = this.status.segments.length;
    const healthyPercentage = (healthySegments / totalSegments) * 100;

    // Check global metrics
    const globalHealthy = (
      this.status.globalMetrics.overallErrorRate < this.config.rollbackThresholds.errorRate &&
      this.status.globalMetrics.averageAlertAccuracy > this.config.rollbackThresholds.alertAccuracy &&
      this.status.globalMetrics.discordIntegrationHealth !== 'failed'
    );

    this.status.nextProgressionEligible = (
      healthyPercentage > (100 - this.config.rollbackThresholds.segmentFailureRate) &&
      globalHealthy
    );

    logger.debug('Progression eligibility check', {
      healthySegments,
      totalSegments,
      healthyPercentage,
      globalHealthy,
      eligible: this.status.nextProgressionEligible
    });
  }

  /**
   * Update segment traffic allocation
   */
  private async updateSegmentTraffic(targetPercentage: number): Promise<void> {
    for (const segment of this.status.segments) {
      if (segment.health === 'healthy') {
        segment.trafficPercentage = Math.min(targetPercentage, 100);

        // Update feature flag rollout percentage for this segment
        await this.updateSegmentFeatureFlags(segment.segmentId, segment.trafficPercentage);
      }
    }
  }

  /**
   * Start stabilization period after progression
   */
  private async startStabilizationPeriod(): Promise<void> {
    this.status.stabilizationStatus = {
      inProgress: true,
      remainingMinutes: this.config.stabilizationPeriod,
      requiredForProgression: true
    };

    this.stabilizationTimer = setTimeout(() => {
      this.status.stabilizationStatus.inProgress = false;
      this.status.stabilizationStatus.remainingMinutes = 0;
      logger.info('Stabilization period completed');
    }, this.config.stabilizationPeriod * 60 * 1000);

    logger.info('Started stabilization period', {
      duration: this.config.stabilizationPeriod
    });
  }

  // Helper methods
  private getSegmentCriteria(segmentName: string) {
    const criteriaMap: Record<string, any> = {
      vip_plus: { tier: 'VIP+', minEngagement: 0.8 },
      nfl: { sport: 'nfl', minEngagement: 0.6 },
      tier_s_cappers: { tier: ['S', 'A'], role: 'capper' }
    };
    return criteriaMap[segmentName] || {};
  }

  private async checkDiscordIntegrationHealth() {
    // Implementation would check Discord API connectivity
    return { healthy: true };
  }

  private async getDiscordMetrics(segmentId: string) {
    // Implementation would fetch Discord posting metrics
    return { successful: 0, failed: 0 };
  }

  private calculateSegmentPerformanceScore(segment: SegmentPerformance): number {
    const weights = {
      errorRate: 0.3,
      latency: 0.25,
      alertAccuracy: 0.25,
      cacheHitRate: 0.2
    };

    const errorScore = Math.max(0, 100 - (segment.metrics.errorRate * 10));
    const latencyScore = Math.max(0, 100 - (segment.metrics.averageLatency / 30));
    const alertScore = segment.metrics.alertAccuracy;
    const cacheScore = segment.metrics.cacheHitRate;

    return (
      errorScore * weights.errorRate +
      latencyScore * weights.latency +
      alertScore * weights.alertAccuracy +
      cacheScore * weights.cacheHitRate
    );
  }

  private updateGlobalMetrics(): void {
    const totalUsers = this.status.segments.reduce((sum, s) => sum + s.activeUsers, 0);
    const avgErrorRate = this.status.segments.reduce((sum, s) => sum + s.metrics.errorRate, 0) / this.status.segments.length;
    const avgAlertAccuracy = this.status.segments.reduce((sum, s) => sum + s.metrics.alertAccuracy, 0) / this.status.segments.length;

    this.status.globalMetrics = {
      totalActiveUsers: totalUsers,
      overallErrorRate: avgErrorRate,
      averageAlertAccuracy: avgAlertAccuracy,
      discordIntegrationHealth: this.assessDiscordHealth()
    };
  }

  private assessDiscordHealth(): 'healthy' | 'degraded' | 'failed' {
    const totalPosts = this.status.segments.reduce((sum, s) =>
      sum + s.metrics.discordPostsSuccessful + s.metrics.discordPostsFailed, 0);

    if (totalPosts === 0) return 'healthy';

    const successRate = this.status.segments.reduce((sum, s) =>
      sum + s.metrics.discordPostsSuccessful, 0) / totalPosts;

    if (successRate > 0.95) return 'healthy';
    if (successRate > 0.8) return 'degraded';
    return 'failed';
  }

  private async isolateSegment(segmentId: string): Promise<void> {
    // Disable feature flags for this segment
    await this.updateSegmentFeatureFlags(segmentId, 0);

    // Remove from active allocation
    await this.segmentManager.deallocateSegment(segmentId);

    logger.warn('Segment isolated due to health issues', { segmentId });
  }

  private async isolateAllSegments(): Promise<void> {
    for (const segment of this.status.segments) {
      await this.isolateSegment(segment.segmentId);
    }
  }

  private async updateSegmentFeatureFlags(segmentId: string, percentage: number): Promise<void> {
    // Implementation would update feature flag rollout percentages for specific segment
    await supabaseClient
      .from('segment_feature_flags')
      .upsert({
        segment_id: segmentId,
        flag_name: 'canary_rollout',
        rollout_percentage: percentage,
        updated_at: new Date().toISOString()
      });
  }

  private async disableFeatureFlags(): Promise<void> {
    await supabaseClient
      .from('feature_flags')
      .update({ enabled: false, rollout_percentage: 0 })
      .in('flag_name', [
        'discord_alerts_enabled',
        'feed_generation_enabled',
        'unified_picks_reads'
      ]);
  }

  private async persistCanaryModeStatus(): Promise<void> {
    await supabaseClient
      .from('rollout_phases')
      .upsert({
        rollout_id: 'current',
        phase_name: 'canary',
        status: this.status.active ? 'in_progress' : 'stopped',
        progress: this.status.overallProgress,
        current_step: this.status.currentStep,
        total_steps: this.status.totalSteps,
        segments: this.status.segments,
        global_metrics: this.status.globalMetrics,
        updated_at: new Date().toISOString()
      });
  }
}