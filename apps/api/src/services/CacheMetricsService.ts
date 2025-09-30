import { CacheFirstUnifiedPicksService } from './CacheFirstUnifiedPicksService';
import { CacheWarmingService } from './CacheWarmingService';
import { CacheInvalidationService } from './CacheInvalidationService';
import { ProductionRedisService } from './productionRedis';
import { requireSupabase } from '../utils/supabaseUtils';
import { logger } from '../utils/logger';

export interface CacheMetricsSnapshot {
  timestamp: Date;
  hitRates: {
    l1: number;
    l2: number;
    l3: number;
    overall: number;
  };
  responseTimes: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: {
    requestsPerSecond: number;
    cacheOperationsPerSecond: number;
  };
  sizes: {
    l1KeyCount: number;
    l1SizeBytes: number;
    l2KeyCount: number;
    l2SizeBytes: number;
  };
  errors: {
    total: number;
    rate: number;
    byType: Record<string, number>;
  };
  warming: {
    strategiesActive: number;
    lastWarmupTime: Date | null;
    itemsWarmedLast24h: number;
  };
  invalidation: {
    rulesActive: number;
    invalidationsLast24h: number;
    queueSize: number;
  };
}

export interface PerformanceAlert {
  id: string;
  type: 'hit_rate' | 'response_time' | 'error_rate' | 'memory_usage' | 'queue_size';
  severity: 'warning' | 'critical';
  threshold: number;
  currentValue: number;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

export interface CacheTrend {
  metric: string;
  period: '1h' | '24h' | '7d' | '30d';
  dataPoints: Array<{
    timestamp: Date;
    value: number;
  }>;
  trend: 'increasing' | 'decreasing' | 'stable';
  changeRate: number; // Percentage change
}

/**
 * Cache Metrics Service
 * Comprehensive monitoring and analytics for the cache-first architecture
 * Provides real-time metrics, alerts, and performance optimization insights
 */
export class CacheMetricsService {
  private static instance: CacheMetricsService;
  
  private cacheService: CacheFirstUnifiedPicksService;
  private warmingService: CacheWarmingService;
  private invalidationService: CacheInvalidationService;
  private redisService: ProductionRedisService;
  
  // Metrics collection state
  private isCollecting = false;
  private collectionInterval?: NodeJS.Timeout;
  private alertCheckInterval?: NodeJS.Timeout;
  
  // Performance tracking
  private requestCounter = 0;
  private cacheOperationCounter = 0;
  private responseTimes: number[] = [];
  private recentErrors: Array<{ type: string; timestamp: Date }> = [];
  
  // Alert management
  private activeAlerts: Map<string, PerformanceAlert> = new Map();
  private alertThresholds = {
    hitRate: 85, // Minimum 85% hit rate
    responseTime: 150, // Maximum 150ms average response time
    errorRate: 5, // Maximum 5% error rate
    memoryUsage: 85, // Maximum 85% memory usage
    queueSize: 100 // Maximum queue size for invalidations
  };
  
  private constructor() {
    this.cacheService = CacheFirstUnifiedPicksService.getInstance();
    this.warmingService = CacheWarmingService.getInstance();
    this.invalidationService = CacheInvalidationService.getInstance();
    this.redisService = ProductionRedisService.getInstance();
    
    this.startMetricsCollection();
    this.setupEventListeners();
    
    logger.info('CacheMetricsService initialized', {
      alertThresholds: this.alertThresholds
    });
  }

  public static getInstance(): CacheMetricsService {
    if (!CacheMetricsService.instance) {
      CacheMetricsService.instance = new CacheMetricsService();
    }
    return CacheMetricsService.instance;
  }

  /**
   * Start metrics collection and monitoring
   */
  private startMetricsCollection(): void {
    // Collect metrics every 30 seconds
    this.collectionInterval = setInterval(() => {
      this.collectMetrics();
    }, 30 * 1000);
    
    // Check for alerts every minute
    this.alertCheckInterval = setInterval(() => {
      this.checkAlerts();
    }, 60 * 1000);
    
    // Reset counters every hour
    setInterval(() => {
      this.resetCounters();
    }, 60 * 60 * 1000);
    
    logger.info('Cache metrics collection started');
  }

  /**
   * Setup event listeners for real-time metrics
   */
  private setupEventListeners(): void {
    // Listen for cache invalidation events
    this.invalidationService.on('invalidation', (event) => {
      this.recordInvalidationEvent(event);
    });
    
    // In a real implementation, you'd listen to cache service events
    // For now, we'll use method interception or manual reporting
    
    logger.debug('Cache metrics event listeners setup complete');
  }

  /**
   * Record a cache request for metrics
   */
  public recordRequest(responseTime: number): void {
    this.requestCounter++;
    this.responseTimes.push(responseTime);
    
    // Keep only last 1000 response times
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }
  }

  /**
   * Record a cache operation (hit/miss/write)
   */
  public recordCacheOperation(): void {
    this.cacheOperationCounter++;
  }

  /**
   * Record an error for metrics
   */
  public recordError(type: string): void {
    this.recentErrors.push({
      type,
      timestamp: new Date()
    });
    
    // Keep only last 100 errors
    if (this.recentErrors.length > 100) {
      this.recentErrors.shift();
    }
  }

  /**
   * Record invalidation event
   */
  private recordInvalidationEvent(event: any): void {
    // This could be expanded to track detailed invalidation metrics
    logger.debug('Invalidation event recorded', { event });
  }

  /**
   * Collect comprehensive metrics snapshot
   */
  private async collectMetrics(): Promise<void> {
    if (this.isCollecting) return;
    
    this.isCollecting = true;
    
    try {
      const snapshot = await this.getMetricsSnapshot();
      await this.persistMetrics(snapshot);
      
    } catch (error) {
      logger.error('Failed to collect cache metrics', {
        error: (error as Error).message
      });
    } finally {
      this.isCollecting = false;
    }
  }

  /**
   * Get current metrics snapshot
   */
  public async getMetricsSnapshot(): Promise<CacheMetricsSnapshot> {
    const [
      cacheMetrics,
      warmingMetrics,
      invalidationMetrics,
      redisStatus
    ] = await Promise.all([
      this.cacheService.getMetrics(),
      this.warmingService.getMetrics(),
      this.invalidationService.getMetrics(),
      this.redisService.getStats()
    ]);
    
    const now = new Date();
    const totalRequests = cacheMetrics.l1Hits + cacheMetrics.l2Hits + cacheMetrics.l3Hits + cacheMetrics.misses;
    
    // Calculate response time percentiles
    const sortedTimes = [...this.responseTimes].sort((a, b) => a - b);
    const p50 = this.getPercentile(sortedTimes, 50);
    const p95 = this.getPercentile(sortedTimes, 95);
    const p99 = this.getPercentile(sortedTimes, 99);
    
    // Calculate error rates
    const recentErrorsLast24h = this.recentErrors.filter(
      e => now.getTime() - e.timestamp.getTime() < 24 * 60 * 60 * 1000
    );
    const errorsByType = recentErrorsLast24h.reduce((acc, error) => {
      acc[error.type] = (acc[error.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      timestamp: now,
      hitRates: {
        l1: totalRequests > 0 ? (cacheMetrics.l1Hits / totalRequests) * 100 : 0,
        l2: totalRequests > 0 ? (cacheMetrics.l2Hits / totalRequests) * 100 : 0,
        l3: totalRequests > 0 ? (cacheMetrics.l3Hits / totalRequests) * 100 : 0,
        overall: cacheMetrics.hitRatio
      },
      responseTimes: {
        avg: cacheMetrics.avgResponseTime,
        p50,
        p95,
        p99
      },
      throughput: {
        requestsPerSecond: this.requestCounter / 30, // 30-second window
        cacheOperationsPerSecond: this.cacheOperationCounter / 30
      },
      sizes: {
        l1KeyCount: 0, // Would be populated from actual cache
        l1SizeBytes: 0,
        l2KeyCount: 0,
        l2SizeBytes: 0
      },
      errors: {
        total: recentErrorsLast24h.length,
        rate: totalRequests > 0 ? (recentErrorsLast24h.length / totalRequests) * 100 : 0,
        byType: errorsByType
      },
      warming: {
        strategiesActive: warmingMetrics.successfulStrategies.length,
        lastWarmupTime: warmingMetrics.lastWarmup,
        itemsWarmedLast24h: warmingMetrics.totalItemsWarmed
      },
      invalidation: {
        rulesActive: this.invalidationService.getRules().filter(r => r.enabled).length,
        invalidationsLast24h: invalidationMetrics.totalInvalidations,
        queueSize: invalidationMetrics.pendingInvalidations
      }
    };
  }

  /**
   * Persist metrics to database
   */
  private async persistMetrics(snapshot: CacheMetricsSnapshot): Promise<void> {
    try {
      const supabase = requireSupabase();
      
      // Record hit rates
      await supabase.rpc('record_cache_metric', {
        p_metric_type: 'hit_rate',
        p_cache_layer: 'all',
        p_value: snapshot.hitRates.overall,
        p_metadata: {
          l1: snapshot.hitRates.l1,
          l2: snapshot.hitRates.l2,
          l3: snapshot.hitRates.l3
        }
      });
      
      // Record response times
      await supabase.rpc('record_cache_metric', {
        p_metric_type: 'response_time',
        p_cache_layer: 'all',
        p_value: snapshot.responseTimes.avg,
        p_metadata: {
          p50: snapshot.responseTimes.p50,
          p95: snapshot.responseTimes.p95,
          p99: snapshot.responseTimes.p99
        }
      });
      
      // Record error rates
      await supabase.rpc('record_cache_metric', {
        p_metric_type: 'errors',
        p_cache_layer: 'all',
        p_value: snapshot.errors.rate,
        p_metadata: {
          total: snapshot.errors.total,
          byType: snapshot.errors.byType
        }
      });
      
      // Record invalidations
      await supabase.rpc('record_cache_metric', {
        p_metric_type: 'invalidations',
        p_cache_layer: 'all',
        p_value: snapshot.invalidation.invalidationsLast24h,
        p_metadata: {
          queueSize: snapshot.invalidation.queueSize,
          rulesActive: snapshot.invalidation.rulesActive
        }
      });
      
    } catch (error) {
      logger.error('Failed to persist cache metrics', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Check for performance alerts
   */
  private async checkAlerts(): Promise<void> {
    try {
      const snapshot = await this.getMetricsSnapshot();
      const alerts: PerformanceAlert[] = [];
      
      // Check hit rate
      if (snapshot.hitRates.overall < this.alertThresholds.hitRate) {
        alerts.push({
          id: 'hit_rate_low',
          type: 'hit_rate',
          severity: snapshot.hitRates.overall < 70 ? 'critical' : 'warning',
          threshold: this.alertThresholds.hitRate,
          currentValue: snapshot.hitRates.overall,
          message: `Cache hit rate (${snapshot.hitRates.overall.toFixed(1)}%) below threshold (${this.alertThresholds.hitRate}%)`,
          timestamp: new Date(),
          acknowledged: false
        });
      }
      
      // Check response time
      if (snapshot.responseTimes.avg > this.alertThresholds.responseTime) {
        alerts.push({
          id: 'response_time_high',
          type: 'response_time',
          severity: snapshot.responseTimes.avg > 300 ? 'critical' : 'warning',
          threshold: this.alertThresholds.responseTime,
          currentValue: snapshot.responseTimes.avg,
          message: `Average response time (${snapshot.responseTimes.avg.toFixed(1)}ms) above threshold (${this.alertThresholds.responseTime}ms)`,
          timestamp: new Date(),
          acknowledged: false
        });
      }
      
      // Check error rate
      if (snapshot.errors.rate > this.alertThresholds.errorRate) {
        alerts.push({
          id: 'error_rate_high',
          type: 'error_rate',
          severity: snapshot.errors.rate > 15 ? 'critical' : 'warning',
          threshold: this.alertThresholds.errorRate,
          currentValue: snapshot.errors.rate,
          message: `Error rate (${snapshot.errors.rate.toFixed(1)}%) above threshold (${this.alertThresholds.errorRate}%)`,
          timestamp: new Date(),
          acknowledged: false
        });
      }
      
      // Check invalidation queue size
      if (snapshot.invalidation.queueSize > this.alertThresholds.queueSize) {
        alerts.push({
          id: 'queue_size_high',
          type: 'queue_size',
          severity: snapshot.invalidation.queueSize > 500 ? 'critical' : 'warning',
          threshold: this.alertThresholds.queueSize,
          currentValue: snapshot.invalidation.queueSize,
          message: `Invalidation queue size (${snapshot.invalidation.queueSize}) above threshold (${this.alertThresholds.queueSize})`,
          timestamp: new Date(),
          acknowledged: false
        });
      }
      
      // Update active alerts
      for (const alert of alerts) {
        if (!this.activeAlerts.has(alert.id)) {
          this.activeAlerts.set(alert.id, alert);
          await this.sendAlert(alert);
        }
      }
      
      // Clear resolved alerts
      const currentAlertIds = new Set(alerts.map(a => a.id));
      for (const [alertId] of this.activeAlerts.entries()) {
        if (!currentAlertIds.has(alertId)) {
          this.activeAlerts.delete(alertId);
          logger.info('Cache performance alert resolved', { alertId });
        }
      }
      
    } catch (error) {
      logger.error('Failed to check cache alerts', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Send performance alert
   */
  private async sendAlert(alert: PerformanceAlert): Promise<void> {
    logger.warn('Cache performance alert triggered', {
      alert: {
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        currentValue: alert.currentValue,
        threshold: alert.threshold
      }
    });
    
    // In a real implementation, this would integrate with alerting systems
    // like Discord webhooks, email, Slack, PagerDuty, etc.
    
    try {
      // Example: Store alert in database for dashboard display
      const supabase = requireSupabase();
      await supabase.from('system_alerts').insert([{
        alert_id: alert.id,
        alert_type: alert.type,
        severity: alert.severity,
        threshold: alert.threshold,
        current_value: alert.currentValue,
        message: alert.message,
        source: 'cache_metrics_service',
        acknowledged: false,
        created_at: alert.timestamp.toISOString()
      }]);
      
    } catch (error) {
      logger.error('Failed to persist cache alert', {
        alert: alert.id,
        error: (error as Error).message
      });
    }
  }

  /**
   * Get cache performance trends
   */
  public async getCacheTrends(period: '1h' | '24h' | '7d' | '30d'): Promise<CacheTrend[]> {
    try {
      const supabase = requireSupabase();
      
      let intervalClause: string;
      let bucketSize: string;
      
      switch (period) {
        case '1h':
          intervalClause = "time_bucket >= NOW() - INTERVAL '1 hour'";
          bucketSize = '5 minutes';
          break;
        case '24h':
          intervalClause = "time_bucket >= NOW() - INTERVAL '24 hours'";
          bucketSize = '1 hour';
          break;
        case '7d':
          intervalClause = "time_bucket >= NOW() - INTERVAL '7 days'";
          bucketSize = '6 hours';
          break;
        case '30d':
          intervalClause = "time_bucket >= NOW() - INTERVAL '30 days'";
          bucketSize = '1 day';
          break;
      }
      
      const { data, error } = await supabase
        .from('cache_metrics')
        .select('metric_type, time_bucket, value_avg')
        .where(intervalClause)
        .order('time_bucket', { ascending: true });
      
      if (error) throw error;
      
      // Group by metric type and calculate trends
      const metricGroups = data.reduce((acc, row) => {
        if (!acc[row.metric_type]) {
          acc[row.metric_type] = [];
        }
        acc[row.metric_type].push({
          timestamp: new Date(row.time_bucket),
          value: parseFloat(row.value_avg)
        });
        return acc;
      }, {} as Record<string, Array<{ timestamp: Date; value: number }>>);
      
      const trends: CacheTrend[] = [];
      
      for (const [metric, dataPoints] of Object.entries(metricGroups)) {
        if (dataPoints.length < 2) continue;
        
        // Calculate trend direction and change rate
        const firstValue = dataPoints[0].value;
        const lastValue = dataPoints[dataPoints.length - 1].value;
        const changeRate = firstValue !== 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
        
        let trend: 'increasing' | 'decreasing' | 'stable';
        if (Math.abs(changeRate) < 5) {
          trend = 'stable';
        } else if (changeRate > 0) {
          trend = 'increasing';
        } else {
          trend = 'decreasing';
        }
        
        trends.push({
          metric,
          period,
          dataPoints,
          trend,
          changeRate: Math.round(changeRate * 100) / 100
        });
      }
      
      return trends;
      
    } catch (error) {
      logger.error('Failed to get cache trends', {
        period,
        error: (error as Error).message
      });
      return [];
    }
  }

  /**
   * Get performance recommendations
   */
  public async getPerformanceRecommendations(): Promise<string[]> {
    const snapshot = await this.getMetricsSnapshot();
    const recommendations: string[] = [];
    
    // Hit rate recommendations
    if (snapshot.hitRates.overall < 85) {
      recommendations.push('Consider increasing cache warming frequency for frequently accessed data');
      
      if (snapshot.hitRates.l1 < 50) {
        recommendations.push('L1 cache hit rate is low - increase L1 cache size or TTL');
      }
      
      if (snapshot.hitRates.l2 < 30) {
        recommendations.push('L2 cache hit rate is low - check Redis connectivity and configuration');
      }
    }
    
    // Response time recommendations
    if (snapshot.responseTimes.avg > 150) {
      recommendations.push('Average response time is high - review cache key design and query optimization');
      
      if (snapshot.responseTimes.p95 > 500) {
        recommendations.push('95th percentile response time is concerning - investigate slow queries');
      }
    }
    
    // Error rate recommendations
    if (snapshot.errors.rate > 5) {
      recommendations.push('Error rate is elevated - review error logs and circuit breaker configuration');
    }
    
    // Warming strategy recommendations
    if (snapshot.warming.strategiesActive < 3) {
      recommendations.push('Consider enabling more cache warming strategies for better hit rates');
    }
    
    // Invalidation recommendations
    if (snapshot.invalidation.queueSize > 50) {
      recommendations.push('Invalidation queue is backing up - review rule efficiency and processing capacity');
    }
    
    // Memory recommendations
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024;
    const memoryPercentage = (heapUsedMB / heapTotalMB) * 100;
    
    if (memoryPercentage > 85) {
      recommendations.push('Memory usage is high - consider reducing L1 cache size or implementing cache size limits');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Cache performance is optimal - no immediate recommendations');
    }
    
    return recommendations;
  }

  /**
   * Reset performance counters
   */
  private resetCounters(): void {
    this.requestCounter = 0;
    this.cacheOperationCounter = 0;
    
    // Keep only recent response times (last hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    this.responseTimes = this.responseTimes.slice(-100); // Keep last 100 samples
    
    // Keep only recent errors (last 24 hours)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.recentErrors = this.recentErrors.filter(
      error => error.timestamp.getTime() > oneDayAgo
    );
    
    logger.debug('Cache metrics counters reset');
  }

  /**
   * Calculate percentile from sorted array
   */
  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  // Public API Methods

  /**
   * Get current active alerts
   */
  public getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Acknowledge an alert
   */
  public async acknowledgeAlert(alertId: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      logger.info('Cache performance alert acknowledged', { alertId });
      
      try {
        const supabase = requireSupabase();
        await supabase
          .from('system_alerts')
          .update({ acknowledged: true, acknowledged_at: new Date().toISOString() })
          .eq('alert_id', alertId);
      } catch (error) {
        logger.error('Failed to acknowledge alert in database', {
          alertId,
          error: (error as Error).message
        });
      }
    }
  }

  /**
   * Update alert thresholds
   */
  public updateAlertThresholds(thresholds: Partial<typeof this.alertThresholds>): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
    logger.info('Cache alert thresholds updated', { thresholds: this.alertThresholds });
  }

  /**
   * Get comprehensive health report
   */
  public async getHealthReport(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    snapshot: CacheMetricsSnapshot;
    alerts: PerformanceAlert[];
    recommendations: string[];
    trends: CacheTrend[];
  }> {
    const [snapshot, alerts, recommendations, trends] = await Promise.all([
      this.getMetricsSnapshot(),
      Promise.resolve(this.getActiveAlerts()),
      this.getPerformanceRecommendations(),
      this.getCacheTrends('24h')
    ]);
    
    // Determine overall health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    const warningAlerts = alerts.filter(a => a.severity === 'warning');
    
    if (criticalAlerts.length > 0) {
      status = 'unhealthy';
    } else if (warningAlerts.length > 0 || snapshot.hitRates.overall < 75) {
      status = 'degraded';
    }
    
    return {
      status,
      snapshot,
      alerts,
      recommendations,
      trends
    };
  }

  /**
   * Stop metrics collection
   */
  public stop(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = undefined;
    }
    
    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
      this.alertCheckInterval = undefined;
    }
    
    logger.info('Cache metrics service stopped');
  }
}

// Export singleton instance
export const cacheMetricsService = CacheMetricsService.getInstance();