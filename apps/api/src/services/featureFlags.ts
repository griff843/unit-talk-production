/**
 * Feature Flag Service for FeedAgent rollout
 * Supports shadow mode, gradual rollout, and A/B testing
 */

export interface FeatureFlags {
  // Core feature flags
  cacheFirstEnabled: boolean;
  unifiedPicksDirectWrite: boolean;
  shadowModeEnabled: boolean;

  // Rollout control
  rolloutPercentage: number;
  enabledSports: string[];
  enabledUsers: string[];

  // Performance flags
  batchProcessingEnabled: boolean;
  cacheWarmupEnabled: boolean;
  deduplicationEnabled: boolean;

  // Monitoring flags
  metricsEnabled: boolean;
  detailedLoggingEnabled: boolean;
  performanceTracking: boolean;
}

export interface ShadowModeConfig {
  enabled: boolean;
  compareResults: boolean;
  logDifferences: boolean;
  failOnDifferences: boolean;
  maxDifferenceThreshold: number;
}

export interface RolloutConfig {
  phase: 'disabled' | 'shadow' | 'canary' | 'gradual' | 'full';
  percentage: number;
  targetSports: string[];
  targetUsers: string[];
  enabledFeatures: string[];
}

/**
 * Feature Flag Service
 */
export class FeatureFlagService {
  private static instance: FeatureFlagService;

  // Default feature flags
  private defaultFlags: FeatureFlags = {
    cacheFirstEnabled: true,
    unifiedPicksDirectWrite: true,
    shadowModeEnabled: false,
    rolloutPercentage: 100,
    enabledSports: ['NFL', 'NBA', 'MLB', 'NHL'],
    enabledUsers: [],
    batchProcessingEnabled: true,
    cacheWarmupEnabled: true,
    deduplicationEnabled: true,
    metricsEnabled: true,
    detailedLoggingEnabled: false,
    performanceTracking: true
  };

  // Environment-based overrides
  private envFlags: Partial<FeatureFlags> = {};

  private constructor() {
    this.loadEnvironmentFlags();
  }

  public static getInstance(): FeatureFlagService {
    if (!FeatureFlagService.instance) {
      FeatureFlagService.instance = new FeatureFlagService();
    }
    return FeatureFlagService.instance;
  }

  /**
   * Load feature flags from environment variables
   */
  private loadEnvironmentFlags(): void {
    // Cache-first features
    if (process.env.FEED_AGENT_CACHE_FIRST) {
      this.envFlags.cacheFirstEnabled = process.env.FEED_AGENT_CACHE_FIRST === 'true';
    }

    if (process.env.FEED_AGENT_UNIFIED_PICKS_DIRECT) {
      this.envFlags.unifiedPicksDirectWrite = process.env.FEED_AGENT_UNIFIED_PICKS_DIRECT === 'true';
    }

    // Shadow mode
    if (process.env.FEED_AGENT_SHADOW_MODE) {
      this.envFlags.shadowModeEnabled = process.env.FEED_AGENT_SHADOW_MODE === 'true';
    }

    // Rollout percentage
    if (process.env.FEED_AGENT_ROLLOUT_PERCENTAGE) {
      const percentage = parseInt(process.env.FEED_AGENT_ROLLOUT_PERCENTAGE, 10);
      if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
        this.envFlags.rolloutPercentage = percentage;
      }
    }

    // Enabled sports
    if (process.env.FEED_AGENT_ENABLED_SPORTS) {
      this.envFlags.enabledSports = process.env.FEED_AGENT_ENABLED_SPORTS
        .split(',')
        .map(s => s.trim().toUpperCase())
        .filter(s => s);
    }

    // Performance features
    if (process.env.FEED_AGENT_BATCH_PROCESSING) {
      this.envFlags.batchProcessingEnabled = process.env.FEED_AGENT_BATCH_PROCESSING === 'true';
    }

    if (process.env.FEED_AGENT_CACHE_WARMUP) {
      this.envFlags.cacheWarmupEnabled = process.env.FEED_AGENT_CACHE_WARMUP === 'true';
    }

    // Monitoring features
    if (process.env.FEED_AGENT_DETAILED_LOGGING) {
      this.envFlags.detailedLoggingEnabled = process.env.FEED_AGENT_DETAILED_LOGGING === 'true';
    }

    if (process.env.FEED_AGENT_PERFORMANCE_TRACKING) {
      this.envFlags.performanceTracking = process.env.FEED_AGENT_PERFORMANCE_TRACKING === 'true';
    }
  }

  /**
   * Get current feature flags with environment overrides
   */
  public getFlags(): FeatureFlags {
    return {
      ...this.defaultFlags,
      ...this.envFlags
    };
  }

  /**
   * Check if a specific feature is enabled
   */
  public isEnabled(feature: keyof FeatureFlags): boolean {
    const flags = this.getFlags();
    return Boolean(flags[feature]);
  }

  /**
   * Check if cache-first mode should be used
   */
  public shouldUseCacheFirst(): boolean {
    return this.isEnabled('cacheFirstEnabled');
  }

  /**
   * Check if direct unified_picks writes should be used
   */
  public shouldUseUnifiedPicksDirectWrite(): boolean {
    return this.isEnabled('unifiedPicksDirectWrite');
  }

  /**
   * Check if shadow mode is enabled
   */
  public isShadowModeEnabled(): boolean {
    return this.isEnabled('shadowModeEnabled');
  }

  /**
   * Check if sport is enabled for processing
   */
  public isSportEnabled(sport: string): boolean {
    const flags = this.getFlags();
    return flags.enabledSports.includes(sport.toUpperCase()) || flags.enabledSports.length === 0;
  }

  /**
   * Check if user is in rollout group
   */
  public isUserInRollout(userId: string): boolean {
    const flags = this.getFlags();

    // If specific users are targeted, check that list
    if (flags.enabledUsers.length > 0) {
      return flags.enabledUsers.includes(userId);
    }

    // Otherwise, use percentage-based rollout
    const hash = this.hashUserId(userId);
    return hash < flags.rolloutPercentage;
  }

  /**
   * Get shadow mode configuration
   */
  public getShadowModeConfig(): ShadowModeConfig {
    const flags = this.getFlags();

    return {
      enabled: flags.shadowModeEnabled,
      compareResults: true,
      logDifferences: flags.detailedLoggingEnabled,
      failOnDifferences: false, // Don't fail in production
      maxDifferenceThreshold: 0.1 // 10% difference threshold
    };
  }

  /**
   * Get rollout configuration
   */
  public getRolloutConfig(): RolloutConfig {
    const flags = this.getFlags();

    let phase: RolloutConfig['phase'] = 'full';

    if (flags.shadowModeEnabled) {
      phase = 'shadow';
    } else if (flags.rolloutPercentage < 10) {
      phase = 'canary';
    } else if (flags.rolloutPercentage < 100) {
      phase = 'gradual';
    } else if (flags.rolloutPercentage === 0) {
      phase = 'disabled';
    }

    return {
      phase,
      percentage: flags.rolloutPercentage,
      targetSports: flags.enabledSports,
      targetUsers: flags.enabledUsers,
      enabledFeatures: [
        flags.cacheFirstEnabled ? 'cache-first' : '',
        flags.unifiedPicksDirectWrite ? 'unified-picks-direct' : '',
        flags.batchProcessingEnabled ? 'batch-processing' : ''
      ].filter(f => f)
    };
  }

  /**
   * Simple hash function for consistent user-based rollouts
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 100;
  }

  /**
   * Update feature flags at runtime (for testing/emergencies)
   */
  public updateFlags(updates: Partial<FeatureFlags>): void {
    this.envFlags = { ...this.envFlags, ...updates };
  }

  /**
   * Reset flags to defaults
   */
  public resetFlags(): void {
    this.envFlags = {};
    this.loadEnvironmentFlags();
  }

  /**
   * Get feature flag status for monitoring
   */
  public getStatus(): {
    flags: FeatureFlags;
    shadowMode: ShadowModeConfig;
    rollout: RolloutConfig;
    source: 'environment' | 'default';
  } {
    return {
      flags: this.getFlags(),
      shadowMode: this.getShadowModeConfig(),
      rollout: this.getRolloutConfig(),
      source: Object.keys(this.envFlags).length > 0 ? 'environment' : 'default'
    };
  }
}

// Export singleton instance
export const featureFlags = FeatureFlagService.getInstance();