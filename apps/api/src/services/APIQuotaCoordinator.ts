/**
 * API Quota Coordinator
 * Centralized management of API quotas across all services
 *
 * Manages quotas for:
 * - OddsAPI (500 requests/month free tier)
 * - OptimalAPI (custom limits)
 * - SGO API (SportGameOdds - custom limits)
 * - External data providers
 *
 * Features:
 * - Real-time quota tracking
 * - Intelligent request routing
 * - Quota-aware rate limiting
 * - Priority-based request scheduling
 * - Emergency quota management
 * - Comprehensive monitoring and alerting
 */

import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';
import { supabaseClient } from './supabaseClient';
import { withCircuitBreaker } from './enhanced-circuit-breaker';
import { requireSupabase } from '../utils/supabaseUtils';

const logger = createLogger('APIQuotaCoordinator');

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface APIQuotaConfig {
  provider: string;
  dailyLimit: number;
  monthlyLimit: number;
  rateLimit: number; // requests per minute
  priority: number; // 1-10, higher = more important
  costPerRequest?: number;
  enabled: boolean;
}

export interface QuotaUsage {
  provider: string;
  dailyUsed: number;
  monthlyUsed: number;
  lastReset: Date;
  remainingDaily: number;
  remainingMonthly: number;
  utilizationPercentage: number;
}

export interface APIRequest {
  id: string;
  provider: string;
  service: string;
  priority: number;
  timestamp: Date;
  estimatedCost: number;
  metadata?: any;
}

export interface QuotaStatus {
  provider: string;
  status: 'healthy' | 'warning' | 'critical' | 'exhausted';
  dailyRemaining: number;
  monthlyRemaining: number;
  estimatedTimeToReset: number;
  recommendedAction: string;
}

// ============================================================================
// API QUOTA COORDINATOR CLASS
// ============================================================================

export class APIQuotaCoordinator extends EventEmitter {
  private quotaConfigs: Map<string, APIQuotaConfig> = new Map();
  private quotaUsage: Map<string, QuotaUsage> = new Map();
  private requestQueue: APIRequest[] = [];
  private isProcessing: boolean = false;
  private lastSyncTime: Date = new Date();

  constructor() {
    super();

    // Initialize default API configurations
    this.initializeAPIConfigs();

    // Start background processing
    this.startBackgroundTasks();

    logger.info('🎯 API Quota Coordinator initialized', {
      providersConfigured: this.quotaConfigs.size,
      backgroundTasksStarted: true
    });
  }

  /**
   * Initialize default API configurations
   */
  private initializeAPIConfigs(): void {
    // OddsAPI Configuration (Free tier)
    this.quotaConfigs.set('odds-api', {
      provider: 'odds-api',
      dailyLimit: 16, // 500/month ≈ 16/day
      monthlyLimit: 500,
      rateLimit: 1, // 1 request per minute to be conservative
      priority: 8,
      costPerRequest: 1,
      enabled: true
    });

    // OptimalAPI Configuration
    this.quotaConfigs.set('optimal-api', {
      provider: 'optimal-api',
      dailyLimit: 1000,
      monthlyLimit: 30000,
      rateLimit: 10, // 10 requests per minute
      priority: 9,
      costPerRequest: 1,
      enabled: true
    });

    // SGO API Configuration
    this.quotaConfigs.set('sgo-api', {
      provider: 'sgo-api',
      dailyLimit: 2000,
      monthlyLimit: 60000,
      rateLimit: 20, // 20 requests per minute
      priority: 7,
      costPerRequest: 1,
      enabled: true
    });

    // ESPN API Configuration (fallback)
    this.quotaConfigs.set('espn-api', {
      provider: 'espn-api',
      dailyLimit: 500,
      monthlyLimit: 15000,
      rateLimit: 5,
      priority: 5,
      costPerRequest: 0, // Free
      enabled: true
    });

    logger.info('API configurations initialized', {
      providers: Array.from(this.quotaConfigs.keys())
    });
  }

  /**
   * Request API access with quota management
   */
  async requestAPIAccess(
    provider: string,
    service: string,
    priority: number = 5,
    metadata?: any
  ): Promise<{ allowed: boolean; reason?: string; waitTime?: number }> {
    const requestId = `${provider}-${service}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    logger.debug('API access requested', {
      requestId,
      provider,
      service,
      priority
    });

    try {
      // Check if provider is configured and enabled
      const config = this.quotaConfigs.get(provider);
      if (!config || !config.enabled) {
        return {
          allowed: false,
          reason: `Provider ${provider} not configured or disabled`
        };
      }

      // Get current quota usage
      const usage = await this.getQuotaUsage(provider);

      // Check daily limit
      if (usage.remainingDaily <= 0) {
        const timeToReset = this.getTimeToNextReset('daily');

        this.emit('quotaExhausted', {
          provider,
          type: 'daily',
          timeToReset
        });

        return {
          allowed: false,
          reason: 'Daily quota exhausted',
          waitTime: timeToReset
        };
      }

      // Check monthly limit
      if (usage.remainingMonthly <= 0) {
        const timeToReset = this.getTimeToNextReset('monthly');

        this.emit('quotaExhausted', {
          provider,
          type: 'monthly',
          timeToReset
        });

        return {
          allowed: false,
          reason: 'Monthly quota exhausted',
          waitTime: timeToReset
        };
      }

      // Check rate limits
      const rateLimit = await this.checkRateLimit(provider);
      if (!rateLimit.allowed) {
        return {
          allowed: false,
          reason: 'Rate limit exceeded',
          waitTime: rateLimit.waitTime
        };
      }

      // Apply priority-based throttling if quota is running low
      const quotaStatus = this.getQuotaStatus(provider, usage);
      if (quotaStatus.status === 'critical' && priority < 8) {
        return {
          allowed: false,
          reason: 'Critical quota level - high priority requests only',
          waitTime: 300000 // 5 minutes
        };
      }

      // Request approved - record usage
      await this.recordAPIUsage(provider, service, requestId, metadata);

      logger.info('API access granted', {
        requestId,
        provider,
        service,
        remainingDaily: usage.remainingDaily - 1,
        remainingMonthly: usage.remainingMonthly - 1
      });

      return { allowed: true };

    } catch (error) {
      logger.error('Error processing API access request', {
        requestId,
        provider,
        service,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        allowed: false,
        reason: 'Internal error processing request'
      };
    }
  }

  /**
   * Get current quota usage for a provider
   */
  async getQuotaUsage(provider: string): Promise<QuotaUsage> {
    try {
      // Try to get from cache first
      let usage = this.quotaUsage.get(provider);

      // If not in cache or stale, fetch from database
      if (!usage || this.isCacheStale(usage)) {
        usage = await this.fetchQuotaUsageFromDB(provider);
        this.quotaUsage.set(provider, usage);
      }

      return usage;

    } catch (error) {
      logger.error('Error getting quota usage', {
        provider,
        error: error instanceof Error ? error.message : String(error)
      });

      // Return safe defaults on error
      const config = this.quotaConfigs.get(provider);
      return {
        provider,
        dailyUsed: 0,
        monthlyUsed: 0,
        lastReset: new Date(),
        remainingDaily: config?.dailyLimit || 0,
        remainingMonthly: config?.monthlyLimit || 0,
        utilizationPercentage: 0
      };
    }
  }

  /**
   * Get quota status for a provider
   */
  getQuotaStatus(provider: string, usage?: QuotaUsage): QuotaStatus {
    const config = this.quotaConfigs.get(provider);
    if (!config) {
      return {
        provider,
        status: 'critical',
        dailyRemaining: 0,
        monthlyRemaining: 0,
        estimatedTimeToReset: 0,
        recommendedAction: 'Provider not configured'
      };
    }

    const quotaUsage = usage || this.quotaUsage.get(provider);
    if (!quotaUsage) {
      return {
        provider,
        status: 'healthy',
        dailyRemaining: config.dailyLimit,
        monthlyRemaining: config.monthlyLimit,
        estimatedTimeToReset: 0,
        recommendedAction: 'Continue normal operations'
      };
    }

    const dailyUtilization = (quotaUsage.dailyUsed / config.dailyLimit) * 100;
    const monthlyUtilization = (quotaUsage.monthlyUsed / config.monthlyLimit) * 100;

    let status: 'healthy' | 'warning' | 'critical' | 'exhausted';
    let recommendedAction: string;

    if (quotaUsage.remainingDaily <= 0 || quotaUsage.remainingMonthly <= 0) {
      status = 'exhausted';
      recommendedAction = 'Switch to alternative provider or wait for quota reset';
    } else if (dailyUtilization >= 90 || monthlyUtilization >= 90) {
      status = 'critical';
      recommendedAction = 'Restrict to high-priority requests only';
    } else if (dailyUtilization >= 70 || monthlyUtilization >= 70) {
      status = 'warning';
      recommendedAction = 'Implement conservative request throttling';
    } else {
      status = 'healthy';
      recommendedAction = 'Continue normal operations';
    }

    return {
      provider,
      status,
      dailyRemaining: quotaUsage.remainingDaily,
      monthlyRemaining: quotaUsage.remainingMonthly,
      estimatedTimeToReset: this.getTimeToNextReset('daily'),
      recommendedAction
    };
  }

  /**
   * Get all quota statuses
   */
  getAllQuotaStatuses(): QuotaStatus[] {
    return Array.from(this.quotaConfigs.keys()).map(provider =>
      this.getQuotaStatus(provider)
    );
  }

  /**
   * Emergency quota management
   */
  async enableEmergencyMode(provider: string, reason: string): Promise<void> {
    logger.warn('🚨 Emergency mode enabled', {
      provider,
      reason,
      timestamp: new Date().toISOString()
    });

    // Temporarily disable the provider
    const config = this.quotaConfigs.get(provider);
    if (config) {
      config.enabled = false;
    }

    // Emit emergency event
    this.emit('emergencyMode', {
      provider,
      reason,
      timestamp: new Date()
    });

    // Store emergency state in database
    await this.recordEmergencyState(provider, reason);
  }

  /**
   * Check rate limits for a provider
   */
  private async checkRateLimit(provider: string): Promise<{ allowed: boolean; waitTime?: number }> {
    const config = this.quotaConfigs.get(provider);
    if (!config) {
      return { allowed: false };
    }

    // Get recent requests for this provider
    const recentRequests = await this.getRecentRequests(provider, 60000); // Last minute

    if (recentRequests.length >= config.rateLimit) {
      const oldestRequest = recentRequests[recentRequests.length - 1];
      const waitTime = 60000 - (Date.now() - oldestRequest.timestamp.getTime());

      return {
        allowed: false,
        waitTime: Math.max(0, waitTime)
      };
    }

    return { allowed: true };
  }

  /**
   * Record API usage in database
   */
  private async recordAPIUsage(
    provider: string,
    service: string,
    requestId: string,
    metadata?: any
  ): Promise<void> {
    try {
      await withCircuitBreaker.supabase(async () => {
        const supa = requireSupabase();
      const { error } = await supa
          .from('api_quota_usage')
          .insert({
            provider,
            service,
            request_id: requestId,
            timestamp: new Date().toISOString(),
            metadata
          });

        if (error) {
          throw new Error(`Failed to record API usage: ${error.message}`);
        }
      }, async () => {
        logger.warn('Failed to record API usage due to circuit breaker', {
          provider,
          service,
          requestId
        });
      });

      // Update in-memory cache
      this.updateUsageCache(provider);

    } catch (error) {
      logger.error('Error recording API usage', {
        provider,
        service,
        requestId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Update usage cache for a provider
   */
  private updateUsageCache(provider: string): void {
    const usage = this.quotaUsage.get(provider);
    if (usage) {
      usage.dailyUsed += 1;
      usage.monthlyUsed += 1;
      usage.remainingDaily = Math.max(0, usage.remainingDaily - 1);
      usage.remainingMonthly = Math.max(0, usage.remainingMonthly - 1);

      const config = this.quotaConfigs.get(provider);
      if (config) {
        usage.utilizationPercentage = (usage.monthlyUsed / config.monthlyLimit) * 100;
      }

      this.quotaUsage.set(provider, usage);
    }
  }

  /**
   * Fetch quota usage from database
   */
  private async fetchQuotaUsageFromDB(provider: string): Promise<QuotaUsage> {
    const config = this.quotaConfigs.get(provider);
    if (!config) {
      throw new Error(`Provider ${provider} not configured`);
    }

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      // Get daily usage
      const supa1 = requireSupabase();
      const { data: dailyData, error: dailyError } = await supa1
        .from('api_quota_usage')
        .select('*')
        .eq('provider', provider)
        .gte('timestamp', today.toISOString());

      if (dailyError && dailyError.code !== 'PGRST116') {
        throw new Error(`Failed to fetch daily usage: ${dailyError.message}`);
      }

      // Get monthly usage
      const supa = requireSupabase();
      const { data: monthlyData, error: monthlyError } = await supa
        .from('api_quota_usage')
        .select('*')
        .eq('provider', provider)
        .gte('timestamp', firstOfMonth.toISOString());

      if (monthlyError && monthlyError.code !== 'PGRST116') {
        throw new Error(`Failed to fetch monthly usage: ${monthlyError.message}`);
      }

      const dailyUsed = dailyData?.length || 0;
      const monthlyUsed = monthlyData?.length || 0;

      const usage: QuotaUsage = {
        provider,
        dailyUsed,
        monthlyUsed,
        lastReset: today,
        remainingDaily: Math.max(0, config.dailyLimit - dailyUsed),
        remainingMonthly: Math.max(0, config.monthlyLimit - monthlyUsed),
        utilizationPercentage: (monthlyUsed / config.monthlyLimit) * 100
      };

      return usage;

    } catch (error) {
      logger.error('Error fetching quota usage from database', {
        provider,
        error: error instanceof Error ? error.message : String(error)
      });

      // Return safe defaults
      return {
        provider,
        dailyUsed: 0,
        monthlyUsed: 0,
        lastReset: new Date(),
        remainingDaily: config.dailyLimit,
        remainingMonthly: config.monthlyLimit,
        utilizationPercentage: 0
      };
    }
  }

  /**
   * Get recent requests for rate limiting
   */
  private async getRecentRequests(provider: string, timeWindowMs: number): Promise<APIRequest[]> {
    const cutoffTime = new Date(Date.now() - timeWindowMs);

    try {
      const supa = requireSupabase();
      const { data, error } = await supa
        .from('api_quota_usage')
        .select('*')
        .eq('provider', provider)
        .gte('timestamp', cutoffTime.toISOString())
        .order('timestamp', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch recent requests: ${error.message}`);
      }

      return (data || []).map(row => ({
        id: row.request_id,
        provider: row.provider,
        service: row.service,
        priority: 5, // Default priority
        timestamp: new Date(row.timestamp),
        estimatedCost: 1,
        metadata: row.metadata
      }));

    } catch (error) {
      logger.error('Error fetching recent requests', {
        provider,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Check if usage cache is stale
   */
  private isCacheStale(usage: QuotaUsage): boolean {
    const cacheAge = Date.now() - usage.lastReset.getTime();
    return cacheAge > 300000; // 5 minutes
  }

  /**
   * Get time until next quota reset
   */
  private getTimeToNextReset(type: 'daily' | 'monthly'): number {
    const now = new Date();

    if (type === 'daily') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow.getTime() - now.getTime();
    } else {
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return nextMonth.getTime() - now.getTime();
    }
  }

  /**
   * Record emergency state in database
   */
  private async recordEmergencyState(provider: string, reason: string): Promise<void> {
    try {
      const supa = requireSupabase();
    await supa
        .from('api_emergency_states')
        .insert({
          provider,
          reason,
          enabled_at: new Date().toISOString(),
          status: 'active'
        });
    } catch (error) {
      logger.error('Failed to record emergency state', {
        provider,
        reason,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Start background monitoring and maintenance tasks
   */
  private startBackgroundTasks(): void {
    // Sync quota usage every 5 minutes
    setInterval(async () => {
      try {
        await this.syncQuotaUsage();
      } catch (error) {
        logger.error('Error in quota sync task', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, 300000); // 5 minutes

    // Check quota health every minute
    setInterval(() => {
      this.checkQuotaHealth();
    }, 60000); // 1 minute

    logger.info('Background tasks started for API quota management');
  }

  /**
   * Sync quota usage from database
   */
  private async syncQuotaUsage(): Promise<void> {
    for (const provider of this.quotaConfigs.keys()) {
      try {
        const usage = await this.fetchQuotaUsageFromDB(provider);
        this.quotaUsage.set(provider, usage);
      } catch (error) {
        logger.warn('Failed to sync quota usage for provider', {
          provider,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    this.lastSyncTime = new Date();
    logger.debug('Quota usage synchronized from database');
  }

  /**
   * Check quota health and emit warnings
   */
  private checkQuotaHealth(): void {
    for (const provider of this.quotaConfigs.keys()) {
      const status = this.getQuotaStatus(provider);

      if (status.status === 'critical' || status.status === 'exhausted') {
        this.emit('quotaAlert', {
          provider,
          status: status.status,
          remainingDaily: status.dailyRemaining,
          remainingMonthly: status.monthlyRemaining,
          recommendedAction: status.recommendedAction
        });

        logger.warn('Quota alert generated', {
          provider,
          status: status.status,
          remainingDaily: status.dailyRemaining,
          remainingMonthly: status.monthlyRemaining
        });
      }
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const apiQuotaCoordinator = new APIQuotaCoordinator();

// Set up event listeners for monitoring
apiQuotaCoordinator.on('quotaAlert', (alert) => {
  logger.warn('📊 Quota Alert', alert);
});

apiQuotaCoordinator.on('quotaExhausted', (event) => {
  logger.error('🚨 Quota Exhausted', event);
});

apiQuotaCoordinator.on('emergencyMode', (event) => {
  logger.error('🚨 Emergency Mode Activated', event);
});

export default apiQuotaCoordinator;