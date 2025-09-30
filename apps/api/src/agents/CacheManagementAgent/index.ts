import { BaseAgent, HealthCheckResult, createBaseAgentConfig } from '../BaseAgent';
import { CacheFirstUnifiedPicksService } from '../../services/CacheFirstUnifiedPicksService';
import { CacheWarmingService } from '../../services/CacheWarmingService';
import { CacheInvalidationService } from '../../services/CacheInvalidationService';
import { CacheMetricsService } from '../../services/CacheMetricsService';
import { requireSupabase } from '../../utils/supabaseUtils';
import type { BaseAgentConfig, BaseAgentDependencies, BaseMetrics } from '../BaseAgent/types';

export interface CacheManagementAgentConfig extends BaseAgentConfig {
  cache?: {
    warmupOnStart: boolean;
    metricsCollection: boolean;
    alertsEnabled: boolean;
    refreshMaterializedViews: boolean;
    materializedViewRefreshInterval: number; // minutes
    warmingInterval: number; // minutes
    metricsInterval: number; // minutes
  };
}

interface CacheManagementMetrics extends BaseMetrics {
  cacheHitRate: number;
  avgResponseTime: number;
  warmingStrategiesActive: number;
  invalidationRulesActive: number;
  activeAlerts: number;
  lastMaterializedViewRefresh?: Date;
  lastCacheWarmup?: Date;
}

/**
 * Cache Management Agent
 * Orchestrates the cache-first architecture components:
 * - Cache warming strategies
 * - Cache invalidation rules
 * - Materialized view refresh
 * - Performance monitoring and alerting
 * - Health checks and optimization
 */
export class CacheManagementAgent extends BaseAgent {
  private cacheService: CacheFirstUnifiedPicksService;
  private warmingService: CacheWarmingService;
  private invalidationService: CacheInvalidationService;
  private metricsService: CacheMetricsService;
  
  private materializedViewRefreshTimer?: NodeJS.Timeout;
  private cacheWarmingTimer?: NodeJS.Timeout;
  private metricsTimer?: NodeJS.Timeout;
  
  constructor(config: Partial<CacheManagementAgentConfig> = {}, deps: BaseAgentDependencies) {
    const fullConfig: CacheManagementAgentConfig = {
      ...createBaseAgentConfig({
        name: 'CacheManagementAgent',
        enabled: true,
        health: { enabled: true, interval: 60 },
        metrics: { enabled: true, interval: 120 },
        ...config
      }),
      cache: {
        warmupOnStart: true,
        metricsCollection: true,
        alertsEnabled: true,
        refreshMaterializedViews: true,
        materializedViewRefreshInterval: 15, // 15 minutes
        warmingInterval: 60, // 1 hour
        metricsInterval: 5, // 5 minutes
        ...config.cache
      }
    };

    super(fullConfig, deps);
    
    this.cacheService = CacheFirstUnifiedPicksService.getInstance();
    this.warmingService = CacheWarmingService.getInstance();
    this.invalidationService = CacheInvalidationService.getInstance();
    this.metricsService = CacheMetricsService.getInstance();
  }

  protected async initialize(): Promise<void> {
    this.logger.info('Initializing Cache Management Agent...', {
      config: this.config.cache
    });

    // Perform initial cache warmup if enabled
    if (this.config.cache?.warmupOnStart) {
      try {
        this.logger.info('Starting initial cache warmup...');
        await this.performInitialWarmup();
        this.logger.info('Initial cache warmup completed');
      } catch (error) {
        this.logger.error('Initial cache warmup failed', {
          error: (error as Error).message
        });
        // Don't fail initialization if warmup fails
      }
    }

    // Start periodic tasks
    this.startPeriodicTasks();

    this.logger.info('Cache Management Agent initialized successfully');
  }

  protected async process(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Get current cache health
      const healthReport = await this.metricsService.getHealthReport();
      
      this.logger.info('Cache Management Agent process cycle', {
        cacheStatus: healthReport.status,
        hitRate: healthReport.snapshot.hitRates.overall,
        avgResponseTime: healthReport.snapshot.responseTimes.avg,
        activeAlerts: healthReport.alerts.length,
        processingTimeMs: Date.now() - startTime
      });
      
      // Take corrective actions based on health
      await this.handleHealthStatus(healthReport);
      
      // Update agent metrics
      await this.updateAgentMetrics(healthReport);
      
    } catch (error) {
      this.logger.error('Cache Management Agent process failed', {
        error: (error as Error).message,
        processingTimeMs: Date.now() - startTime
      });
      throw error;
    }
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('Cleaning up Cache Management Agent...');

    // Clear all timers
    if (this.materializedViewRefreshTimer) {
      clearInterval(this.materializedViewRefreshTimer);
      this.materializedViewRefreshTimer = undefined;
    }

    if (this.cacheWarmingTimer) {
      clearInterval(this.cacheWarmingTimer);
      this.cacheWarmingTimer = undefined;
    }

    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = undefined;
    }

    this.logger.info('Cache Management Agent cleanup completed');
  }

  protected async checkHealth(): Promise<HealthCheckResult> {
    try {
      // Get health from all cache services
      const [
        cacheHealth,
        warmingHealth,
        invalidationHealth
      ] = await Promise.all([
        this.cacheService.healthCheck(),
        this.warmingService.healthCheck(),
        this.invalidationService.healthCheck()
      ]);

      // Get metrics snapshot
      const metricsSnapshot = await this.metricsService.getMetricsSnapshot();
      const activeAlerts = this.metricsService.getActiveAlerts();

      // Determine overall health
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      const issues: string[] = [];

      // Check cache service health
      if (cacheHealth.status === 'unhealthy') {
        status = 'unhealthy';
        issues.push('Cache service unhealthy');
      } else if (cacheHealth.status === 'degraded') {
        status = status === 'healthy' ? 'degraded' : status;
        issues.push('Cache service degraded');
      }

      // Check warming service health
      if (warmingHealth.status === 'unhealthy') {
        status = 'unhealthy';
        issues.push('Cache warming unhealthy');
      } else if (warmingHealth.status === 'degraded') {
        status = status === 'healthy' ? 'degraded' : status;
        issues.push('Cache warming degraded');
      }

      // Check invalidation service health
      if (invalidationHealth.status === 'unhealthy') {
        status = 'unhealthy';
        issues.push('Cache invalidation unhealthy');
      } else if (invalidationHealth.status === 'degraded') {
        status = status === 'healthy' ? 'degraded' : status;
        issues.push('Cache invalidation degraded');
      }

      // Check performance metrics
      if (metricsSnapshot.hitRates.overall < 70) {
        status = 'unhealthy';
        issues.push(`Low cache hit rate: ${metricsSnapshot.hitRates.overall.toFixed(1)}%`);
      } else if (metricsSnapshot.hitRates.overall < 85) {
        status = status === 'healthy' ? 'degraded' : status;
        issues.push(`Below target hit rate: ${metricsSnapshot.hitRates.overall.toFixed(1)}%`);
      }

      if (metricsSnapshot.responseTimes.avg > 200) {
        status = 'unhealthy';
        issues.push(`High response time: ${metricsSnapshot.responseTimes.avg.toFixed(1)}ms`);
      } else if (metricsSnapshot.responseTimes.avg > 100) {
        status = status === 'healthy' ? 'degraded' : status;
        issues.push(`Above target response time: ${metricsSnapshot.responseTimes.avg.toFixed(1)}ms`);
      }

      // Check for critical alerts
      const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');
      if (criticalAlerts.length > 0) {
        status = 'unhealthy';
        issues.push(`${criticalAlerts.length} critical cache alerts`);
      }

      return {
        status,
        timestamp: new Date().toISOString(),
        details: {
          cacheService: cacheHealth,
          warmingService: warmingHealth,
          invalidationService: invalidationHealth,
          metrics: {
            hitRate: metricsSnapshot.hitRates.overall,
            avgResponseTime: metricsSnapshot.responseTimes.avg,
            activeAlerts: activeAlerts.length,
            criticalAlerts: criticalAlerts.length
          },
          issues: issues.length > 0 ? issues : undefined
        }
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        details: {
          error: (error as Error).message,
          healthCheckFailed: true
        }
      };
    }
  }

  protected async collectMetrics(): Promise<CacheManagementMetrics> {
    try {
      const metricsSnapshot = await this.metricsService.getMetricsSnapshot();
      const activeAlerts = this.metricsService.getActiveAlerts();
      const warmingStrategies = this.warmingService.getStrategies();
      const invalidationRules = this.invalidationService.getRules();

      return {
        agentName: this.config.name,
        successCount: this.metrics.successCount || 0,
        errorCount: this.metrics.errorCount || 0,
        warningCount: this.metrics.warningCount || 0,
        processingTimeMs: this.metrics.processingTimeMs || 0,
        memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024,
        cacheHitRate: metricsSnapshot.hitRates.overall,
        avgResponseTime: metricsSnapshot.responseTimes.avg,
        warmingStrategiesActive: warmingStrategies.filter(s => s.enabled).length,
        invalidationRulesActive: invalidationRules.filter(r => r.enabled).length,
        activeAlerts: activeAlerts.length,
        lastCacheWarmup: metricsSnapshot.warming.lastWarmupTime,
        lastMaterializedViewRefresh: this.getLastMaterializedViewRefresh()
      };

    } catch (error) {
      this.logger.error('Failed to collect cache management metrics', {
        error: (error as Error).message
      });

      return {
        agentName: this.config.name,
        successCount: this.metrics.successCount || 0,
        errorCount: (this.metrics.errorCount || 0) + 1,
        warningCount: this.metrics.warningCount || 0,
        processingTimeMs: this.metrics.processingTimeMs || 0,
        memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024,
        cacheHitRate: 0,
        avgResponseTime: 0,
        warmingStrategiesActive: 0,
        invalidationRulesActive: 0,
        activeAlerts: 0
      };
    }
  }

  /**
   * Perform initial cache warmup
   */
  private async performInitialWarmup(): Promise<void> {
    // Warm up critical caches first
    await this.cacheService.warmupCache();
    
    // Trigger high-priority warming strategies
    try {
      await this.warmingService.warmupStrategy('published_picks');
      await this.warmingService.warmupStrategy('todays_picks');
    } catch (error) {
      this.logger.warn('Some warmup strategies failed during initialization', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Start periodic tasks
   */
  private startPeriodicTasks(): void {
    const config = this.config.cache!;

    // Materialized view refresh
    if (config.refreshMaterializedViews) {
      this.materializedViewRefreshTimer = setInterval(() => {
        this.refreshMaterializedViews();
      }, config.materializedViewRefreshInterval * 60 * 1000);
      
      // Initial refresh
      setTimeout(() => this.refreshMaterializedViews(), 5000); // 5 seconds after start
    }

    // Cache warming
    this.cacheWarmingTimer = setInterval(() => {
      this.performScheduledWarming();
    }, config.warmingInterval * 60 * 1000);

    this.logger.info('Periodic tasks started', {
      materializedViewRefresh: config.refreshMaterializedViews,
      refreshInterval: config.materializedViewRefreshInterval,
      warmingInterval: config.warmingInterval
    });
  }

  /**
   * Refresh materialized views
   */
  private async refreshMaterializedViews(): Promise<void> {
    try {
      this.logger.info('Starting materialized view refresh...');
      const startTime = Date.now();

      const supabase = requireSupabase();
      
      // Use the refresh function from the migration
      const { data, error } = await supabase.rpc('refresh_critical_cache_views');
      
      if (error) throw error;

      const duration = Date.now() - startTime;
      this.logger.info('Materialized view refresh completed', {
        result: data,
        durationMs: duration
      });

      // Record metrics
      this.metricsService.recordCacheOperation();

    } catch (error) {
      this.logger.error('Materialized view refresh failed', {
        error: (error as Error).message
      });
      this.metricsService.recordError('materialized_view_refresh');
    }
  }

  /**
   * Perform scheduled cache warming
   */
  private async performScheduledWarming(): Promise<void> {
    try {
      this.logger.info('Starting scheduled cache warming...');
      
      // This will trigger evaluation of all warming strategies
      // The warming service will decide which ones to run based on conditions
      // No need to call anything - the service handles this automatically
      
      this.logger.info('Scheduled cache warming evaluation completed');

    } catch (error) {
      this.logger.error('Scheduled cache warming failed', {
        error: (error as Error).message
      });
      this.metricsService.recordError('cache_warming');
    }
  }

  /**
   * Handle health status and take corrective actions
   */
  private async handleHealthStatus(healthReport: any): Promise<void> {
    const { status, snapshot, alerts } = healthReport;

    // Handle critical alerts
    const criticalAlerts = alerts.filter((a: any) => a.severity === 'critical');
    for (const alert of criticalAlerts) {
      await this.handleCriticalAlert(alert);
    }

    // Handle performance issues
    if (status === 'unhealthy' || status === 'degraded') {
      await this.handlePerformanceIssues(snapshot);
    }
  }

  /**
   * Handle critical alerts
   */
  private async handleCriticalAlert(alert: any): Promise<void> {
    this.logger.warn('Handling critical cache alert', { alert });

    switch (alert.type) {
      case 'hit_rate':
        // Trigger emergency cache warming
        try {
          await this.warmingService.warmupAll();
          this.logger.info('Emergency cache warming triggered for low hit rate');
        } catch (error) {
          this.logger.error('Emergency cache warming failed', {
            error: (error as Error).message
          });
        }
        break;

      case 'response_time':
        // Could trigger cache clearing for corrupted entries
        // Or scale up cache resources
        this.logger.warn('High response time detected - manual intervention may be required');
        break;

      case 'error_rate':
        // Could disable problematic cache operations temporarily
        this.logger.warn('High error rate detected - reviewing cache operations');
        break;

      case 'queue_size':
        // Could trigger immediate invalidation processing
        try {
          await this.invalidationService.processInvalidationTrigger('api_call', {
            event: 'emergency.process_queue'
          }, true);
          this.logger.info('Emergency invalidation queue processing triggered');
        } catch (error) {
          this.logger.error('Emergency queue processing failed', {
            error: (error as Error).message
          });
        }
        break;
    }
  }

  /**
   * Handle performance issues
   */
  private async handlePerformanceIssues(snapshot: any): Promise<void> {
    // Low hit rate - increase warming frequency
    if (snapshot.hitRates.overall < 85) {
      this.logger.info('Low hit rate detected - adjusting warming strategies');
      
      // Could dynamically adjust warming strategy conditions
      try {
        const strategies = this.warmingService.getStrategies();
        for (const strategy of strategies.filter(s => s.priority >= 8)) {
          if (strategy.conditions?.minimumAge && strategy.conditions.minimumAge > 15) {
            this.warmingService.updateStrategy(strategy.id, {
              conditions: {
                ...strategy.conditions,
                minimumAge: Math.max(10, strategy.conditions.minimumAge - 10)
              }
            });
          }
        }
      } catch (error) {
        this.logger.error('Failed to adjust warming strategies', {
          error: (error as Error).message
        });
      }
    }

    // High response time - could trigger cache optimization
    if (snapshot.responseTimes.avg > 150) {
      this.logger.warn('High response time detected', {
        avgResponseTime: snapshot.responseTimes.avg,
        p95: snapshot.responseTimes.p95
      });
      // Could implement cache key optimization, query analysis, etc.
    }
  }

  /**
   * Update agent-specific metrics
   */
  private async updateAgentMetrics(healthReport: any): Promise<void> {
    try {
      // Record custom metrics to the agent_metrics table
      if (this.hasSupabase()) {
        const supabase = this.requireSupabase();
        
        await supabase.from('agent_metrics').insert([{
          agent: this.config.name,
          success_count: this.metrics.successCount || 0,
          error_count: this.metrics.errorCount || 0,
          processing_time_ms: this.metrics.processingTimeMs || 0,
          memory_usage_mb: this.metrics.memoryUsageMb || 0,
          custom_metrics: {
            cache_hit_rate: healthReport.snapshot.hitRates.overall,
            avg_response_time: healthReport.snapshot.responseTimes.avg,
            active_alerts: healthReport.alerts.length,
            cache_status: healthReport.status
          },
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (error) {
      this.logger.error('Failed to update agent metrics', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Get last materialized view refresh time
   */
  private getLastMaterializedViewRefresh(): Date | undefined {
    // In a real implementation, this would track the last refresh time
    // For now, return undefined
    return undefined;
  }

  // Public API methods for manual operations

  /**
   * Manually trigger cache warmup
   */
  public async triggerWarmup(strategyId?: string): Promise<void> {
    this.logger.info('Manual cache warmup triggered', { strategyId });
    
    if (strategyId) {
      await this.warmingService.warmupStrategy(strategyId);
    } else {
      await this.warmingService.warmupAll();
    }
  }

  /**
   * Manually refresh materialized views
   */
  public async refreshViews(): Promise<void> {
    this.logger.info('Manual materialized view refresh triggered');
    await this.refreshMaterializedViews();
  }

  /**
   * Get cache performance report
   */
  public async getPerformanceReport(): Promise<any> {
    return await this.metricsService.getHealthReport();
  }

  /**
   * Clear all caches (emergency use)
   */
  public async clearAllCaches(): Promise<void> {
    this.logger.warn('Manual cache clear triggered - this will impact performance');
    await this.cacheService.clearAllCaches();
    
    // Trigger immediate warmup after clearing
    setTimeout(() => {
      this.performInitialWarmup().catch(error => {
        this.logger.error('Post-clear warmup failed', {
          error: (error as Error).message
        });
      });
    }, 1000);
  }
}

export default CacheManagementAgent;