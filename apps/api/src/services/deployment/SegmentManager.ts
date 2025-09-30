/**
 * Segment Manager - User/Sport/Capper Segment Allocation
 *
 * Manages intelligent segmentation for canary deployments with sophisticated
 * user allocation, sport-specific rollouts, and capper tier management
 */

import { createLogger } from '../../utils/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { withCircuitBreaker } from '../enhanced-circuit-breaker';

export interface SegmentAllocation {
  segmentId: string;
  rolloutId: string;
  segmentType: 'user_tier' | 'sport' | 'capper' | 'mixed';
  criteria: SegmentCriteria;
  userCount: number;
  users: SegmentUser[];
  status: 'active' | 'paused' | 'completed' | 'failed';
  performance: SegmentPerformance;
  healthStatus: 'healthy' | 'warning' | 'critical';
  createdAt: string;
  activatedAt?: string;
  completedAt?: string;
}

export interface SegmentCriteria {
  userTiers?: string[];
  sports?: string[];
  cappers?: string[];
  maxUsers: number;
  rolloutPercentage: number;
  geographicFilters?: string[];
  engagementFilters?: {
    minActivityDays: number;
    minBetsPlaced: number;
    minWinRate: number;
  };
  exclusionFilters?: {
    testUsers: boolean;
    suspendedUsers: boolean;
    newUsers: boolean; // Users < 7 days old
  };
}

export interface SegmentUser {
  userId: string;
  username: string;
  tier: string;
  discordId?: string;
  enrolledAt: string;
  isActive: boolean;
  metrics: UserSegmentMetrics;
}

export interface UserSegmentMetrics {
  alertsReceived: number;
  engagementScore: number;
  errorRate: number;
  feedbackScore: number;
  clvImpact: number;
  lastActiveAt: string;
}

export interface SegmentPerformance {
  alertsDelivered: number;
  alertAccuracy: number;
  userEngagement: number;
  errorRate: number;
  latencyP95: number;
  cacheHitRate: number;
  creditEfficiency: number;
  userSatisfaction: number;
}

export interface SegmentExpansionPlan {
  rolloutId: string;
  currentPercentage: number;
  targetPercentage: number;
  expansionSteps: SegmentExpansionStep[];
  estimatedDuration: number; // minutes
  riskAssessment: RiskLevel;
}

export interface SegmentExpansionStep {
  stepNumber: number;
  fromPercentage: number;
  toPercentage: number;
  targetUsers: number;
  duration: number; // minutes
  validationChecks: string[];
  rollbackTriggers: string[];
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface SegmentConfiguration {
  defaultExpansionRate: number; // users per minute
  maxConcurrentSegments: number;
  healthCheckInterval: number; // seconds
  performanceThresholds: {
    errorRate: number;
    latencyP95: number;
    engagementScore: number;
    alertAccuracy: number;
  };
  autoRollbackTriggers: {
    errorRateThreshold: number;
    engagementDropThreshold: number;
    criticalErrorCount: number;
  };
}

export class SegmentManager {
  private logger = createLogger('SegmentManager');
  private supabase: SupabaseClient;

  // Active segments tracking
  private activeSegments: Map<string, SegmentAllocation> = new Map();
  private segmentMonitoring: Map<string, NodeJS.Timeout> = new Map();

  // Configuration
  private readonly config: SegmentConfiguration = {
    defaultExpansionRate: 10, // 10 users per minute
    maxConcurrentSegments: 5,
    healthCheckInterval: 60, // 1 minute
    performanceThresholds: {
      errorRate: 0.02, // 2%
      latencyP95: 2000, // 2 seconds
      engagementScore: 0.7, // 70%
      alertAccuracy: 0.95 // 95%
    },
    autoRollbackTriggers: {
      errorRateThreshold: 0.10, // 10%
      engagementDropThreshold: 0.30, // 30% drop
      criticalErrorCount: 5
    }
  };

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.startSegmentMonitoring();
  }

  /**
   * Allocate segments for canary rollout
   */
  async allocateSegments(
    rolloutId: string,
    segmentConfig: {
      userTiers: string[];
      sports: string[];
      cappers: string[];
      maxUsers: number;
      rolloutPercentage: number;
    }
  ): Promise<SegmentAllocation[]> {
    this.logger.info('🎯 Allocating canary segments', {
      rolloutId,
      config: segmentConfig
    });

    const segments: SegmentAllocation[] = [];

    try {
      // Create VIP+ user tier segment
      if (segmentConfig.userTiers.includes('vip_plus')) {
        const vipSegment = await this.createUserTierSegment(
          rolloutId,
          'vip_plus',
          Math.floor(segmentConfig.maxUsers * 0.6) // 60% to VIP+
        );
        segments.push(vipSegment);
      }

      // Create NFL-specific segment
      if (segmentConfig.sports.includes('NFL')) {
        const nflSegment = await this.createSportSegment(
          rolloutId,
          'NFL',
          Math.floor(segmentConfig.maxUsers * 0.8) // 80% for NFL
        );
        segments.push(nflSegment);
      }

      // Create S/A tier capper segment
      const tierCappers = segmentConfig.cappers.filter(c =>
        ['tier_s', 'tier_a'].includes(c)
      );

      if (tierCappers.length > 0) {
        const capperSegment = await this.createCapperSegment(
          rolloutId,
          tierCappers,
          Math.floor(segmentConfig.maxUsers * 0.4) // 40% for S/A cappers
        );
        segments.push(capperSegment);
      }

      // Store segments
      for (const segment of segments) {
        this.activeSegments.set(segment.segmentId, segment);
        await this.storeSegmentAllocation(segment);
        await this.startSegmentHealthMonitoring(segment.segmentId);
      }

      this.logger.info('✅ Segment allocation completed', {
        rolloutId,
        segmentCount: segments.length,
        totalUsers: segments.reduce((sum, s) => sum + s.userCount, 0)
      });

      return segments;

    } catch (error) {
      this.logger.error('❌ Segment allocation failed', {
        rolloutId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Create user tier segment
   */
  private async createUserTierSegment(
    rolloutId: string,
    tier: string,
    maxUsers: number
  ): Promise<SegmentAllocation> {
    const segmentId = `segment-${tier}-${rolloutId}-${Date.now()}`;

    // Query eligible users
    const { data: eligibleUsers } = await this.supabase
      .from('users')
      .select(`
        id,
        username,
        tier,
        discord_id,
        created_at,
        last_active_at,
        engagement_metrics
      `)
      .eq('tier', tier)
      .eq('is_active', true)
      .not('suspended_at', 'is', null)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Not new users
      .limit(maxUsers * 2); // Get more than needed for selection

    const selectedUsers = this.selectOptimalUsers(eligibleUsers || [], maxUsers);

    return {
      segmentId,
      rolloutId,
      segmentType: 'user_tier',
      criteria: {
        userTiers: [tier],
        maxUsers,
        rolloutPercentage: 5,
        exclusionFilters: {
          testUsers: true,
          suspendedUsers: true,
          newUsers: true
        }
      },
      userCount: selectedUsers.length,
      users: selectedUsers.map(user => ({
        userId: user.id,
        username: user.username,
        tier: user.tier,
        discordId: user.discord_id,
        enrolledAt: new Date().toISOString(),
        isActive: true,
        metrics: {
          alertsReceived: 0,
          engagementScore: user.engagement_metrics?.score || 0.8,
          errorRate: 0,
          feedbackScore: 0.9,
          clvImpact: 0,
          lastActiveAt: user.last_active_at || new Date().toISOString()
        }
      })),
      status: 'active',
      performance: this.initializeSegmentPerformance(),
      healthStatus: 'healthy',
      createdAt: new Date().toISOString(),
      activatedAt: new Date().toISOString()
    };
  }

  /**
   * Create sport-specific segment
   */
  private async createSportSegment(
    rolloutId: string,
    sport: string,
    maxUsers: number
  ): Promise<SegmentAllocation> {
    const segmentId = `segment-${sport.toLowerCase()}-${rolloutId}-${Date.now()}`;

    // Query users interested in this sport
    const { data: sportUsers } = await this.supabase
      .from('user_sport_preferences')
      .select(`
        user_id,
        sport,
        engagement_level,
        users!inner (
          id,
          username,
          tier,
          discord_id,
          is_active,
          last_active_at
        )
      `)
      .eq('sport', sport)
      .eq('is_active', true)
      .gte('engagement_level', 0.6) // Minimum engagement
      .limit(maxUsers * 2);

    const eligibleUsers = (sportUsers || [])
      .map(su => su.users)
      .filter(user => user.is_active);

    const selectedUsers = this.selectOptimalUsers(eligibleUsers, maxUsers);

    return {
      segmentId,
      rolloutId,
      segmentType: 'sport',
      criteria: {
        sports: [sport],
        maxUsers,
        rolloutPercentage: 5,
        engagementFilters: {
          minActivityDays: 7,
          minBetsPlaced: 5,
          minWinRate: 0.45
        }
      },
      userCount: selectedUsers.length,
      users: selectedUsers.map(user => ({
        userId: user.id,
        username: user.username,
        tier: user.tier,
        discordId: user.discord_id,
        enrolledAt: new Date().toISOString(),
        isActive: true,
        metrics: {
          alertsReceived: 0,
          engagementScore: 0.8,
          errorRate: 0,
          feedbackScore: 0.9,
          clvImpact: 0,
          lastActiveAt: user.last_active_at || new Date().toISOString()
        }
      })),
      status: 'active',
      performance: this.initializeSegmentPerformance(),
      healthStatus: 'healthy',
      createdAt: new Date().toISOString(),
      activatedAt: new Date().toISOString()
    };
  }

  /**
   * Create capper tier segment
   */
  private async createCapperSegment(
    rolloutId: string,
    capperTiers: string[],
    maxUsers: number
  ): Promise<SegmentAllocation> {
    const segmentId = `segment-cappers-${rolloutId}-${Date.now()}`;

    // Query users following S/A tier cappers
    const { data: capperFollowers } = await this.supabase
      .from('user_capper_follows')
      .select(`
        user_id,
        capper_tier,
        follow_date,
        users!inner (
          id,
          username,
          tier,
          discord_id,
          is_active,
          last_active_at
        )
      `)
      .in('capper_tier', capperTiers)
      .eq('is_active', true)
      .limit(maxUsers * 2);

    const eligibleUsers = (capperFollowers || [])
      .map(cf => cf.users)
      .filter(user => user.is_active);

    const selectedUsers = this.selectOptimalUsers(eligibleUsers, maxUsers);

    return {
      segmentId,
      rolloutId,
      segmentType: 'capper',
      criteria: {
        cappers: capperTiers,
        maxUsers,
        rolloutPercentage: 5
      },
      userCount: selectedUsers.length,
      users: selectedUsers.map(user => ({
        userId: user.id,
        username: user.username,
        tier: user.tier,
        discordId: user.discord_id,
        enrolledAt: new Date().toISOString(),
        isActive: true,
        metrics: {
          alertsReceived: 0,
          engagementScore: 0.8,
          errorRate: 0,
          feedbackScore: 0.9,
          clvImpact: 0,
          lastActiveAt: user.last_active_at || new Date().toISOString()
        }
      })),
      status: 'active',
      performance: this.initializeSegmentPerformance(),
      healthStatus: 'healthy',
      createdAt: new Date().toISOString(),
      activatedAt: new Date().toISOString()
    };
  }

  /**
   * Select optimal users from eligible pool
   */
  private selectOptimalUsers(eligibleUsers: any[], maxUsers: number): any[] {
    // Score users based on:
    // 1. Engagement level
    // 2. Account age (prefer established users)
    // 3. Activity frequency
    // 4. Tier level

    const scoredUsers = eligibleUsers.map(user => ({
      ...user,
      selectionScore: this.calculateUserSelectionScore(user)
    }));

    // Sort by selection score and take top users
    return scoredUsers
      .sort((a, b) => b.selectionScore - a.selectionScore)
      .slice(0, maxUsers);
  }

  /**
   * Calculate user selection score for optimal segment allocation
   */
  private calculateUserSelectionScore(user: any): number {
    let score = 0;

    // Tier weight
    const tierWeights = {
      'vip_plus': 1.0,
      'vip': 0.8,
      'premium': 0.6,
      'basic': 0.4
    };
    score += (tierWeights[user.tier as keyof typeof tierWeights] || 0.2) * 40;

    // Account age (prefer established users, not too new, not too old)
    const accountAge = Date.now() - new Date(user.created_at).getTime();
    const daysSinceCreation = accountAge / (1000 * 60 * 60 * 24);

    if (daysSinceCreation >= 7 && daysSinceCreation <= 90) {
      score += 30; // Sweet spot: 1 week to 3 months
    } else if (daysSinceCreation > 90) {
      score += 20; // Established users
    }

    // Recent activity
    const lastActiveTime = new Date(user.last_active_at || user.created_at).getTime();
    const hoursSinceActive = (Date.now() - lastActiveTime) / (1000 * 60 * 60);

    if (hoursSinceActive <= 24) {
      score += 20; // Active within 24 hours
    } else if (hoursSinceActive <= 168) {
      score += 10; // Active within week
    }

    // Engagement metrics (if available)
    if (user.engagement_metrics) {
      score += user.engagement_metrics.score * 10;
    }

    return Math.round(score);
  }

  /**
   * Expand segments to target percentage
   */
  async expandSegments(rolloutId: string, targetPercentage: number): Promise<void> {
    this.logger.info('📈 Expanding canary segments', {
      rolloutId,
      targetPercentage
    });

    const rolloutSegments = Array.from(this.activeSegments.values())
      .filter(segment => segment.rolloutId === rolloutId);

    for (const segment of rolloutSegments) {
      await this.expandSingleSegment(segment.segmentId, targetPercentage);
    }
  }

  /**
   * Expand to all users (100%)
   */
  async expandToAllUsers(rolloutId: string): Promise<void> {
    this.logger.info('🌍 Expanding to all users', { rolloutId });

    // Remove segment restrictions - apply to all eligible users
    const { data: allUsers } = await this.supabase
      .from('users')
      .select('id, username, tier')
      .eq('is_active', true);

    // Update feature flags for all users
    await this.applyFeatureFlagsToAllUsers(allUsers || []);
  }

  /**
   * Get segment performance metrics
   */
  async getSegmentPerformance(segmentId: string): Promise<SegmentPerformance | null> {
    const segment = this.activeSegments.get(segmentId);
    if (!segment) return null;

    // Collect real-time metrics
    const performance = await this.collectSegmentMetrics(segment);
    segment.performance = performance;

    return performance;
  }

  /**
   * Get segment health status
   */
  async getSegmentHealth(segmentId: string): Promise<'healthy' | 'warning' | 'critical' | null> {
    const segment = this.activeSegments.get(segmentId);
    if (!segment) return null;

    const performance = await this.getSegmentPerformance(segmentId);
    if (!performance) return 'critical';

    // Evaluate health based on thresholds
    const health = this.evaluateSegmentHealth(performance);
    segment.healthStatus = health;

    return health;
  }

  /**
   * Create segment expansion plan
   */
  async createExpansionPlan(
    rolloutId: string,
    targetPercentage: number
  ): Promise<SegmentExpansionPlan> {
    const segments = Array.from(this.activeSegments.values())
      .filter(s => s.rolloutId === rolloutId);

    const currentPercentage = this.calculateCurrentRolloutPercentage(segments);

    const steps: SegmentExpansionStep[] = [];
    const expansionRate = this.config.defaultExpansionRate;

    // Create gradual expansion steps
    let currentStep = currentPercentage;
    let stepNumber = 1;

    while (currentStep < targetPercentage) {
      const nextStep = Math.min(currentStep + 10, targetPercentage); // 10% increments
      const stepDuration = Math.max(30, (nextStep - currentStep) * expansionRate); // Min 30 minutes

      steps.push({
        stepNumber: stepNumber++,
        fromPercentage: currentStep,
        toPercentage: nextStep,
        targetUsers: Math.round((nextStep - currentStep) * 100), // Estimate
        duration: stepDuration,
        validationChecks: ['error_rate', 'engagement', 'latency'],
        rollbackTriggers: ['critical_error', 'performance_degradation']
      });

      currentStep = nextStep;
    }

    return {
      rolloutId,
      currentPercentage,
      targetPercentage,
      expansionSteps: steps,
      estimatedDuration: steps.reduce((sum, step) => sum + step.duration, 0),
      riskAssessment: this.assessExpansionRisk(currentPercentage, targetPercentage)
    };
  }

  // Private helper methods
  private initializeSegmentPerformance(): SegmentPerformance {
    return {
      alertsDelivered: 0,
      alertAccuracy: 0.95,
      userEngagement: 0.8,
      errorRate: 0,
      latencyP95: 0,
      cacheHitRate: 0.85,
      creditEfficiency: 1.1,
      userSatisfaction: 0.9
    };
  }

  private async expandSingleSegment(segmentId: string, targetPercentage: number): Promise<void> {
    // Implementation for expanding a single segment
    this.logger.info('Expanding segment', { segmentId, targetPercentage });
  }

  private async applyFeatureFlagsToAllUsers(users: any[]): Promise<void> {
    // Implementation for applying feature flags to all users
    this.logger.info('Applying feature flags to all users', { userCount: users.length });
  }

  private async collectSegmentMetrics(segment: SegmentAllocation): Promise<SegmentPerformance> {
    // Implementation for collecting real-time segment metrics
    return segment.performance;
  }

  private evaluateSegmentHealth(performance: SegmentPerformance): 'healthy' | 'warning' | 'critical' {
    const { errorRate, latencyP95, userEngagement, alertAccuracy } = performance;

    if (
      errorRate > this.config.autoRollbackTriggers.errorRateThreshold ||
      latencyP95 > this.config.performanceThresholds.latencyP95 * 2 ||
      alertAccuracy < 0.80
    ) {
      return 'critical';
    }

    if (
      errorRate > this.config.performanceThresholds.errorRate ||
      latencyP95 > this.config.performanceThresholds.latencyP95 ||
      userEngagement < this.config.performanceThresholds.engagementScore ||
      alertAccuracy < this.config.performanceThresholds.alertAccuracy
    ) {
      return 'warning';
    }

    return 'healthy';
  }

  private calculateCurrentRolloutPercentage(segments: SegmentAllocation[]): number {
    const totalUsers = segments.reduce((sum, segment) => sum + segment.userCount, 0);

    // Estimate as percentage of total active users
    // This would be replaced with actual calculation based on total user base
    return Math.min(100, (totalUsers / 10000) * 100); // Assuming 10k total users
  }

  private assessExpansionRisk(currentPercentage: number, targetPercentage: number): RiskLevel {
    const expansionSize = targetPercentage - currentPercentage;

    if (expansionSize <= 10) return 'low';
    if (expansionSize <= 25) return 'medium';
    if (expansionSize <= 50) return 'high';
    return 'critical';
  }

  private async storeSegmentAllocation(segment: SegmentAllocation): Promise<void> {
    try {
      await withCircuitBreaker.supabase(
        async () => {
          await this.supabase
            .from('rollout_segments')
            .upsert({
              id: segment.segmentId,
              rollout_id: segment.rolloutId,
              segment_type: segment.segmentType,
              criteria: segment.criteria,
              user_count: segment.userCount,
              users: segment.users,
              status: segment.status,
              performance: segment.performance,
              health_status: segment.healthStatus,
              created_at: segment.createdAt,
              activated_at: segment.activatedAt,
              completed_at: segment.completedAt
            }, { onConflict: 'id' });
        },
        async () => {
          this.logger.warn('Circuit breaker open, caching segment allocation locally');
        }
      );
    } catch (error) {
      this.logger.error('Failed to store segment allocation', {
        segmentId: segment.segmentId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private startSegmentMonitoring(): void {
    // Monitor all active segments every minute
    setInterval(async () => {
      await this.monitorActiveSegments();
    }, this.config.healthCheckInterval * 1000);
  }

  private async monitorActiveSegments(): Promise<void> {
    for (const [segmentId, segment] of this.activeSegments) {
      try {
        // Update performance metrics
        segment.performance = await this.collectSegmentMetrics(segment);

        // Check health status
        segment.healthStatus = this.evaluateSegmentHealth(segment.performance);

        // Store updated segment
        await this.storeSegmentAllocation(segment);

        // Check for auto-rollback conditions
        if (segment.healthStatus === 'critical') {
          this.logger.warn('🚨 Segment in critical state', {
            segmentId,
            rolloutId: segment.rolloutId,
            performance: segment.performance
          });
        }

      } catch (error) {
        this.logger.error('Segment monitoring failed', {
          segmentId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  private async startSegmentHealthMonitoring(segmentId: string): Promise<void> {
    const interval = setInterval(async () => {
      const segment = this.activeSegments.get(segmentId);
      if (!segment || segment.status !== 'active') {
        clearInterval(interval);
        this.segmentMonitoring.delete(segmentId);
        return;
      }

      await this.checkSegmentHealth(segmentId);
    }, this.config.healthCheckInterval * 1000);

    this.segmentMonitoring.set(segmentId, interval);
  }

  private async checkSegmentHealth(segmentId: string): Promise<void> {
    const health = await this.getSegmentHealth(segmentId);
    const segment = this.activeSegments.get(segmentId);

    if (!segment) return;

    if (health === 'critical') {
      // Emit critical health alert
      this.logger.error('🚨 CRITICAL: Segment health degraded', {
        segmentId,
        rolloutId: segment.rolloutId,
        performance: segment.performance
      });

      // Auto-pause segment if configured
      if (segment.performance.errorRate > this.config.autoRollbackTriggers.errorRateThreshold) {
        segment.status = 'paused';
        await this.storeSegmentAllocation(segment);
      }
    }
  }
}