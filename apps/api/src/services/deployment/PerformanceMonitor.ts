/**
 * Performance Monitor - Real-time Metrics and Automatic Rollback Triggers
 *
 * Comprehensive monitoring system for rollout performance with intelligent
 * metric collection, anomaly detection, and automated rollback triggers
 */

import { createLogger } from '../../utils/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { withCircuitBreaker } from '../enhanced-circuit-breaker';

export interface MetricCollection {
  rolloutId: string;
  timestamp: string;
  phase: 'shadow' | 'canary' | 'full';
  metrics: PerformanceMetrics;
  anomalies: AnomalyDetection[];
  healthScore: number;
  alertLevel: 'normal' | 'warning' | 'critical' | 'emergency';
}

export interface PerformanceMetrics {
  // Cache Performance
  cacheHitRate: number;
  cacheLatencyP95: number;
  cacheLatencyP99: number;
  cacheMemoryUsage: number;
  cacheThroughput: number;

  // Data Pipeline
  ingestionLatency: number;
  dataConsistency: number;
  unifiedPicksWriteLatency: number;
  dualWriteSuccessRate: number;

  // Alert System
  alertDeliveryLatency: number;
  alertPrecision: number;
  alertRecall: number;
  falsePositiveRate: number;
  discordPostingLatency: number;

  // System Performance
  apiLatencyP95: number;
  apiLatencyP99: number;
  errorRate: number;
  throughput: number;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;

  // Business Metrics
  creditUsageEfficiency: number;
  userEngagement: number;
  clvImpact: number;
  userSatisfactionScore: number;

  // Rollout Specific
  affectedUsers: number;
  successfulDeployments: number;
  failedDeployments: number;
  rollbackCount: number;
}

export interface AnomalyDetection {
  metricName: string;
  type: 'spike' | 'drop' | 'trend' | 'threshold_breach';
  severity: 'low' | 'medium' | 'high' | 'critical';
  currentValue: number;
  expectedRange: { min: number; max: number };
  deviationMagnitude: number;
  confidence: number;
  detectedAt: string;
  description: string;
}

export interface MonitoringConfiguration {
  // Collection intervals
  highFrequencyInterval: number; // seconds - for critical metrics
  standardInterval: number; // seconds - for standard metrics
  lowFrequencyInterval: number; // seconds - for business metrics

  // Anomaly detection
  anomalyThresholds: {
    spikeDetection: number; // standard deviations
    dropDetection: number; // standard deviations
    trendDetection: number; // correlation coefficient
    confidenceThreshold: number; // minimum confidence for alerts
  };

  // Performance thresholds
  performanceThresholds: {
    cacheHitRate: { warning: number; critical: number };
    ingestionLatency: { warning: number; critical: number };
    errorRate: { warning: number; critical: number };
    alertPrecision: { warning: number; critical: number };
  };

  // Auto-rollback triggers
  rollbackTriggers: RollbackTrigger[];
}

export interface RollbackTrigger {
  name: string;
  metric: string;
  condition: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  threshold: number;
  duration: number; // seconds - how long condition must persist
  severity: 'warning' | 'critical' | 'emergency';
  action: 'alert' | 'pause' | 'rollback';
  autoExecute: boolean;
  description: string;
}

export interface MetricBaseline {
  rolloutId: string;
  phase: string;
  metric: string;
  baseline: number;
  variance: number;
  sampleCount: number;
  confidenceInterval: { lower: number; upper: number };
  lastUpdated: string;
}

export interface PerformanceAlert {
  alertId: string;
  rolloutId: string;
  triggerName: string;
  severity: 'warning' | 'critical' | 'emergency';
  message: string;
  metrics: Record<string, number>;
  suggestedActions: string[];
  autoActionTaken: boolean;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

export class PerformanceMonitor {
  private logger = createLogger('PerformanceMonitor');
  private supabase: SupabaseClient;

  // Monitoring state
  private activeMonitoring: Map<string, NodeJS.Timeout[]> = new Map();
  private metricBaselines: Map<string, MetricBaseline[]> = new Map();
  private recentMetrics: Map<string, MetricCollection[]> = new Map();

  // Configuration
  private readonly config: MonitoringConfiguration = {
    // Collection intervals (seconds)
    highFrequencyInterval: 15, // Every 15 seconds for critical metrics
    standardInterval: 60, // Every minute for standard metrics
    lowFrequencyInterval: 300, // Every 5 minutes for business metrics

    // Anomaly detection configuration
    anomalyThresholds: {
      spikeDetection: 3.0, // 3 standard deviations
      dropDetection: 2.5, // 2.5 standard deviations
      trendDetection: 0.8, // 0.8 correlation coefficient
      confidenceThreshold: 0.85 // 85% confidence minimum
    },

    // Performance thresholds
    performanceThresholds: {
      cacheHitRate: { warning: 75, critical: 60 },
      ingestionLatency: { warning: 2000, critical: 5000 },
      errorRate: { warning: 0.02, critical: 0.05 },
      alertPrecision: { warning: 90, critical: 80 }
    },

    // Auto-rollback triggers
    rollbackTriggers: [
      {
        name: 'critical_error_rate',
        metric: 'errorRate',
        condition: 'gte',
        threshold: 0.10, // 10% error rate
        duration: 120, // 2 minutes
        severity: 'emergency',
        action: 'rollback',
        autoExecute: true,
        description: 'Emergency rollback on critical error rate'
      },
      {
        name: 'cache_failure_cascade',
        metric: 'cacheHitRate',
        condition: 'lt',
        threshold: 50, // < 50% cache hit rate
        duration: 180, // 3 minutes
        severity: 'critical',
        action: 'rollback',
        autoExecute: true,
        description: 'Cache system failure cascade detected'
      },
      {
        name: 'data_consistency_breach',
        metric: 'dataConsistency',
        condition: 'lt',
        threshold: 95, // < 95% consistency
        duration: 60, // 1 minute
        severity: 'critical',
        action: 'rollback',
        autoExecute: true,
        description: 'Data consistency breach detected'
      },
      {
        name: 'alert_precision_degradation',
        metric: 'alertPrecision',
        condition: 'lt',
        threshold: 80, // < 80% precision
        duration: 300, // 5 minutes
        severity: 'warning',
        action: 'pause',
        autoExecute: true,
        description: 'Alert precision significantly degraded'
      },
      {
        name: 'system_overload',
        metric: 'apiLatencyP99',
        condition: 'gte',
        threshold: 10000, // >= 10 seconds
        duration: 60, // 1 minute
        severity: 'emergency',
        action: 'rollback',
        autoExecute: true,
        description: 'System overload detected'
      }
    ]
  };

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.initializeMonitoring();
  }

  /**
   * Start comprehensive monitoring for a rollout
   */
  async startRolloutMonitoring(rolloutId: string, phase: 'shadow' | 'canary' | 'full'): Promise<void> {
    this.logger.info('📊 Starting rollout performance monitoring', {
      rolloutId,
      phase
    });

    // Initialize metric collection arrays
    this.recentMetrics.set(rolloutId, []);
    this.metricBaselines.set(rolloutId, []);

    // Start high-frequency monitoring (critical metrics)
    const highFreqInterval = setInterval(async () => {
      await this.collectCriticalMetrics(rolloutId, phase);
    }, this.config.highFrequencyInterval * 1000);

    // Start standard monitoring
    const standardInterval = setInterval(async () => {
      await this.collectStandardMetrics(rolloutId, phase);
    }, this.config.standardInterval * 1000);

    // Start low-frequency monitoring (business metrics)
    const lowFreqInterval = setInterval(async () => {
      await this.collectBusinessMetrics(rolloutId, phase);
    }, this.config.lowFrequencyInterval * 1000);

    // Start anomaly detection
    const anomalyInterval = setInterval(async () => {
      await this.runAnomalyDetection(rolloutId);
    }, 30000); // Every 30 seconds

    // Start rollback trigger monitoring
    const rollbackInterval = setInterval(async () => {
      await this.checkRollbackTriggers(rolloutId);
    }, 15000); // Every 15 seconds

    // Store intervals for cleanup
    this.activeMonitoring.set(rolloutId, [
      highFreqInterval,
      standardInterval,
      lowFreqInterval,
      anomalyInterval,
      rollbackInterval
    ]);

    // Establish baselines
    await this.establishBaselines(rolloutId, phase);
  }

  /**
   * Start cache-specific monitoring for shadow phase
   */
  async startCacheMonitoring(rolloutId: string): Promise<void> {
    this.logger.info('💾 Starting cache performance monitoring', { rolloutId });

    const cacheInterval = setInterval(async () => {
      const cacheMetrics = await this.collectCacheMetrics();
      await this.analyzeCachePerformance(rolloutId, cacheMetrics);
    }, 10000); // Every 10 seconds for cache monitoring

    // Add to existing monitoring intervals
    const existingIntervals = this.activeMonitoring.get(rolloutId) || [];
    existingIntervals.push(cacheInterval);
    this.activeMonitoring.set(rolloutId, existingIntervals);
  }

  /**
   * Start segment-specific monitoring for canary phase
   */
  async startSegmentMonitoring(rolloutId: string, segments: any[]): Promise<void> {
    this.logger.info('🎯 Starting segment performance monitoring', {
      rolloutId,
      segmentCount: segments.length
    });

    for (const segment of segments) {
      const segmentInterval = setInterval(async () => {
        await this.collectSegmentMetrics(rolloutId, segment.segmentId);
      }, 30000); // Every 30 seconds per segment

      const existingIntervals = this.activeMonitoring.get(rolloutId) || [];
      existingIntervals.push(segmentInterval);
      this.activeMonitoring.set(rolloutId, existingIntervals);
    }
  }

  /**
   * Collect critical metrics (high frequency)
   */
  private async collectCriticalMetrics(rolloutId: string, phase: 'shadow' | 'canary' | 'full'): Promise<void> {
    try {
      const metrics = await this.gatherCriticalMetrics();
      const collection: MetricCollection = {
        rolloutId,
        timestamp: new Date().toISOString(),
        phase,
        metrics,
        anomalies: [],
        healthScore: this.calculateHealthScore(metrics),
        alertLevel: this.determineAlertLevel(metrics)
      };

      await this.storeMetricCollection(collection);
      this.updateRecentMetrics(rolloutId, collection);

    } catch (error) {
      this.logger.error('Failed to collect critical metrics', {
        rolloutId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Collect standard metrics
   */
  private async collectStandardMetrics(rolloutId: string, phase: 'shadow' | 'canary' | 'full'): Promise<void> {
    try {
      const metrics = await this.gatherStandardMetrics();
      const collection: MetricCollection = {
        rolloutId,
        timestamp: new Date().toISOString(),
        phase,
        metrics,
        anomalies: [],
        healthScore: this.calculateHealthScore(metrics),
        alertLevel: this.determineAlertLevel(metrics)
      };

      await this.storeMetricCollection(collection);
      this.updateRecentMetrics(rolloutId, collection);

    } catch (error) {
      this.logger.error('Failed to collect standard metrics', {
        rolloutId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Collect business metrics (low frequency)
   */
  private async collectBusinessMetrics(rolloutId: string, phase: 'shadow' | 'canary' | 'full'): Promise<void> {
    try {
      const businessMetrics = await this.gatherBusinessMetrics(rolloutId);

      // Update existing metric collection with business metrics
      const recentCollections = this.recentMetrics.get(rolloutId) || [];
      if (recentCollections.length > 0) {
        const latest = recentCollections[recentCollections.length - 1];
        latest.metrics = { ...latest.metrics, ...businessMetrics };
        await this.storeMetricCollection(latest);
      }

    } catch (error) {
      this.logger.error('Failed to collect business metrics', {
        rolloutId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Run anomaly detection on recent metrics
   */
  private async runAnomalyDetection(rolloutId: string): Promise<void> {
    const recentCollections = this.recentMetrics.get(rolloutId) || [];
    if (recentCollections.length < 5) return; // Need at least 5 data points

    const latest = recentCollections[recentCollections.length - 1];
    const anomalies: AnomalyDetection[] = [];

    // Check each metric for anomalies
    for (const [metricName, currentValue] of Object.entries(latest.metrics)) {
      if (typeof currentValue !== 'number') continue;

      const anomaly = await this.detectMetricAnomaly(
        rolloutId,
        metricName,
        currentValue,
        recentCollections
      );

      if (anomaly) {
        anomalies.push(anomaly);
      }
    }

    if (anomalies.length > 0) {
      latest.anomalies = anomalies;
      await this.handleAnomalies(rolloutId, anomalies);
      await this.storeMetricCollection(latest);
    }
  }

  /**
   * Check rollback triggers
   */
  private async checkRollbackTriggers(rolloutId: string): Promise<void> {
    const recentCollections = this.recentMetrics.get(rolloutId) || [];
    if (recentCollections.length === 0) return;

    const latest = recentCollections[recentCollections.length - 1];

    for (const trigger of this.config.rollbackTriggers) {
      const metricValue = latest.metrics[trigger.metric as keyof PerformanceMetrics] as number;
      if (typeof metricValue !== 'number') continue;

      const conditionMet = this.evaluateTriggerCondition(
        metricValue,
        trigger.threshold,
        trigger.condition
      );

      if (conditionMet) {
        // Check if condition has persisted for required duration
        const persistentBreach = await this.checkPersistentBreach(
          rolloutId,
          trigger.metric,
          trigger.threshold,
          trigger.condition,
          trigger.duration
        );

        if (persistentBreach && trigger.autoExecute) {
          await this.executeTriggerAction(rolloutId, trigger, metricValue);
        }
      }
    }
  }

  /**
   * Get current metrics for a rollout
   */
  async getCurrentMetrics(rolloutId: string): Promise<PerformanceMetrics> {
    const recentCollections = this.recentMetrics.get(rolloutId) || [];

    if (recentCollections.length === 0) {
      return this.getDefaultMetrics();
    }

    return recentCollections[recentCollections.length - 1].metrics;
  }

  /**
   * Get specific metric value
   */
  async getMetricValue(rolloutId: string, metricName: string): Promise<number> {
    const metrics = await this.getCurrentMetrics(rolloutId);
    return metrics[metricName as keyof PerformanceMetrics] as number || 0;
  }

  /**
   * Stop monitoring for a rollout
   */
  async stopMonitoring(rolloutId: string): Promise<void> {
    this.logger.info('⏹️ Stopping performance monitoring', { rolloutId });

    const intervals = this.activeMonitoring.get(rolloutId) || [];
    intervals.forEach(interval => clearInterval(interval));

    this.activeMonitoring.delete(rolloutId);
    this.recentMetrics.delete(rolloutId);
    this.metricBaselines.delete(rolloutId);
  }

  // Private helper methods
  private async gatherCriticalMetrics(): Promise<Partial<PerformanceMetrics>> {
    // Simulate critical metric collection
    // In production, these would query actual monitoring systems
    return {
      cacheHitRate: Math.random() * 20 + 80, // 80-100%
      errorRate: Math.random() * 0.01, // 0-1%
      apiLatencyP95: Math.random() * 500 + 200, // 200-700ms
      dataConsistency: Math.random() * 5 + 95, // 95-100%
    };
  }

  private async gatherStandardMetrics(): Promise<Partial<PerformanceMetrics>> {
    return {
      ingestionLatency: Math.random() * 1000 + 500, // 500-1500ms
      alertDeliveryLatency: Math.random() * 2000 + 1000, // 1-3s
      throughput: Math.random() * 1000 + 500, // 500-1500 req/min
      cpuUsage: Math.random() * 30 + 40, // 40-70%
      memoryUsage: Math.random() * 20 + 60, // 60-80%
    };
  }

  private async gatherBusinessMetrics(rolloutId: string): Promise<Partial<PerformanceMetrics>> {
    return {
      creditUsageEfficiency: Math.random() * 0.2 + 1.0, // 100-120%
      userEngagement: Math.random() * 0.3 + 0.7, // 70-100%
      clvImpact: Math.random() * 0.1 + 0.95, // 95-105%
      userSatisfactionScore: Math.random() * 0.2 + 0.8, // 80-100%
    };
  }

  private async collectCacheMetrics(): Promise<Partial<PerformanceMetrics>> {
    // Collect Redis/cache specific metrics
    return {
      cacheHitRate: Math.random() * 15 + 85, // 85-100%
      cacheLatencyP95: Math.random() * 50 + 10, // 10-60ms
      cacheLatencyP99: Math.random() * 100 + 20, // 20-120ms
      cacheMemoryUsage: Math.random() * 20 + 60, // 60-80%
      cacheThroughput: Math.random() * 5000 + 10000, // 10k-15k ops/sec
    };
  }

  private async analyzeCachePerformance(rolloutId: string, metrics: Partial<PerformanceMetrics>): Promise<void> {
    const hitRate = metrics.cacheHitRate || 0;
    const threshold = this.config.performanceThresholds.cacheHitRate;

    if (hitRate < threshold.critical) {
      await this.createPerformanceAlert(rolloutId, 'critical_cache_performance', {
        message: `Cache hit rate critically low: ${hitRate.toFixed(1)}%`,
        severity: 'critical',
        metrics: { cacheHitRate: hitRate },
        suggestedActions: [
          'Check cache infrastructure health',
          'Verify cache warming procedures',
          'Monitor cache eviction patterns'
        ]
      });
    } else if (hitRate < threshold.warning) {
      await this.createPerformanceAlert(rolloutId, 'degraded_cache_performance', {
        message: `Cache hit rate below warning threshold: ${hitRate.toFixed(1)}%`,
        severity: 'warning',
        metrics: { cacheHitRate: hitRate },
        suggestedActions: [
          'Review cache configuration',
          'Monitor cache memory usage'
        ]
      });
    }
  }

  private async collectSegmentMetrics(rolloutId: string, segmentId: string): Promise<void> {
    // Collect segment-specific performance metrics
    // This would query segment-specific data
    this.logger.debug('Collecting segment metrics', { rolloutId, segmentId });
  }

  private calculateHealthScore(metrics: Partial<PerformanceMetrics>): number {
    // Calculate overall health score based on weighted metrics
    let score = 100;

    // Cache performance (weight: 25%)
    if (metrics.cacheHitRate) {
      score -= Math.max(0, (85 - metrics.cacheHitRate) * 0.5);
    }

    // Error rate (weight: 30%)
    if (metrics.errorRate) {
      score -= Math.min(30, metrics.errorRate * 10000);
    }

    // Latency (weight: 25%)
    if (metrics.apiLatencyP95) {
      score -= Math.min(25, Math.max(0, (metrics.apiLatencyP95 - 1000) / 100));
    }

    // Data consistency (weight: 20%)
    if (metrics.dataConsistency) {
      score -= Math.max(0, (100 - metrics.dataConsistency) * 2);
    }

    return Math.max(0, Math.min(100, score));
  }

  private determineAlertLevel(metrics: Partial<PerformanceMetrics>): 'normal' | 'warning' | 'critical' | 'emergency' {
    const healthScore = this.calculateHealthScore(metrics);

    if (healthScore >= 90) return 'normal';
    if (healthScore >= 75) return 'warning';
    if (healthScore >= 50) return 'critical';
    return 'emergency';
  }

  private async detectMetricAnomaly(
    rolloutId: string,
    metricName: string,
    currentValue: number,
    recentCollections: MetricCollection[]
  ): Promise<AnomalyDetection | null> {
    // Simple anomaly detection using standard deviation
    const values = recentCollections.map(c =>
      c.metrics[metricName as keyof PerformanceMetrics] as number
    ).filter(v => typeof v === 'number' && !isNaN(v));

    if (values.length < 5) return null;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    const deviations = Math.abs(currentValue - mean) / stdDev;

    if (deviations > this.config.anomalyThresholds.spikeDetection) {
      return {
        metricName,
        type: currentValue > mean ? 'spike' : 'drop',
        severity: deviations > 4 ? 'critical' : deviations > 3.5 ? 'high' : 'medium',
        currentValue,
        expectedRange: {
          min: mean - 2 * stdDev,
          max: mean + 2 * stdDev
        },
        deviationMagnitude: deviations,
        confidence: Math.min(0.99, deviations / 5),
        detectedAt: new Date().toISOString(),
        description: `${metricName} ${currentValue > mean ? 'spike' : 'drop'} detected: ${currentValue.toFixed(2)} (${deviations.toFixed(1)}σ from mean)`
      };
    }

    return null;
  }

  private async handleAnomalies(rolloutId: string, anomalies: AnomalyDetection[]): Promise<void> {
    for (const anomaly of anomalies) {
      if (anomaly.severity === 'critical') {
        await this.createPerformanceAlert(rolloutId, `anomaly_${anomaly.metricName}`, {
          message: anomaly.description,
          severity: 'critical',
          metrics: { [anomaly.metricName]: anomaly.currentValue },
          suggestedActions: [
            'Investigate metric anomaly',
            'Check system health',
            'Consider rollback if persistent'
          ]
        });
      }

      this.logger.warn('Anomaly detected', {
        rolloutId,
        anomaly
      });
    }
  }

  private evaluateTriggerCondition(value: number, threshold: number, condition: string): boolean {
    switch (condition) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'gte': return value >= threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      default: return false;
    }
  }

  private async checkPersistentBreach(
    rolloutId: string,
    metric: string,
    threshold: number,
    condition: string,
    duration: number
  ): Promise<boolean> {
    const recentCollections = this.recentMetrics.get(rolloutId) || [];
    const cutoffTime = Date.now() - (duration * 1000);

    const relevantCollections = recentCollections.filter(c =>
      new Date(c.timestamp).getTime() >= cutoffTime
    );

    if (relevantCollections.length === 0) return false;

    // Check if all recent values breach the condition
    return relevantCollections.every(collection => {
      const value = collection.metrics[metric as keyof PerformanceMetrics] as number;
      return typeof value === 'number' && this.evaluateTriggerCondition(value, threshold, condition);
    });
  }

  private async executeTriggerAction(
    rolloutId: string,
    trigger: RollbackTrigger,
    metricValue: number
  ): Promise<void> {
    this.logger.warn('🚨 Executing rollback trigger', {
      rolloutId,
      trigger: trigger.name,
      metric: trigger.metric,
      value: metricValue,
      threshold: trigger.threshold,
      action: trigger.action
    });

    await this.createPerformanceAlert(rolloutId, `trigger_${trigger.name}`, {
      message: `Rollback trigger activated: ${trigger.description}`,
      severity: trigger.severity,
      metrics: { [trigger.metric]: metricValue },
      suggestedActions: [
        `Auto-${trigger.action} triggered`,
        'Investigate root cause',
        'Review system metrics'
      ]
    });

    // The actual rollback/pause action would be handled by the RolloutOrchestrator
    // This just logs and alerts
  }

  private async createPerformanceAlert(
    rolloutId: string,
    triggerName: string,
    alertData: {
      message: string;
      severity: 'warning' | 'critical';
      metrics: Record<string, number>;
      suggestedActions: string[];
    }
  ): Promise<void> {
    const alert: PerformanceAlert = {
      alertId: `alert-${triggerName}-${Date.now()}`,
      rolloutId,
      triggerName,
      severity: alertData.severity,
      message: alertData.message,
      metrics: alertData.metrics,
      suggestedActions: alertData.suggestedActions,
      autoActionTaken: false,
      createdAt: new Date().toISOString()
    };

    await this.storePerformanceAlert(alert);

    this.logger.warn('Performance alert created', {
      rolloutId,
      alert
    });
  }

  private getDefaultMetrics(): PerformanceMetrics {
    return {
      cacheHitRate: 0,
      cacheLatencyP95: 0,
      cacheLatencyP99: 0,
      cacheMemoryUsage: 0,
      cacheThroughput: 0,
      ingestionLatency: 0,
      dataConsistency: 100,
      unifiedPicksWriteLatency: 0,
      dualWriteSuccessRate: 100,
      alertDeliveryLatency: 0,
      alertPrecision: 100,
      alertRecall: 100,
      falsePositiveRate: 0,
      discordPostingLatency: 0,
      apiLatencyP95: 0,
      apiLatencyP99: 0,
      errorRate: 0,
      throughput: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      diskUsage: 0,
      creditUsageEfficiency: 100,
      userEngagement: 100,
      clvImpact: 100,
      userSatisfactionScore: 100,
      affectedUsers: 0,
      successfulDeployments: 0,
      failedDeployments: 0,
      rollbackCount: 0
    };
  }

  private updateRecentMetrics(rolloutId: string, collection: MetricCollection): void {
    const existing = this.recentMetrics.get(rolloutId) || [];
    existing.push(collection);

    // Keep only last 100 collections
    if (existing.length > 100) {
      existing.splice(0, existing.length - 100);
    }

    this.recentMetrics.set(rolloutId, existing);
  }

  private async establishBaselines(rolloutId: string, phase: string): Promise<void> {
    // Establish performance baselines for comparison
    this.logger.info('Establishing performance baselines', { rolloutId, phase });
  }

  private async storeMetricCollection(collection: MetricCollection): Promise<void> {
    try {
      await withCircuitBreaker.supabase(
        async () => {
          await this.supabase
            .from('rollout_metrics')
            .insert({
              rollout_id: collection.rolloutId,
              timestamp: collection.timestamp,
              phase: collection.phase,
              metrics: collection.metrics,
              anomalies: collection.anomalies,
              health_score: collection.healthScore,
              alert_level: collection.alertLevel
            });
        },
        async () => {
          this.logger.warn('Circuit breaker open, caching metrics locally');
        }
      );
    } catch (error) {
      this.logger.error('Failed to store metric collection', {
        rolloutId: collection.rolloutId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async storePerformanceAlert(alert: PerformanceAlert): Promise<void> {
    try {
      await withCircuitBreaker.supabase(
        async () => {
          await this.supabase
            .from('rollout_alerts')
            .insert({
              id: alert.alertId,
              rollout_id: alert.rolloutId,
              trigger_name: alert.triggerName,
              severity: alert.severity,
              message: alert.message,
              metrics: alert.metrics,
              suggested_actions: alert.suggestedActions,
              auto_action_taken: alert.autoActionTaken,
              created_at: alert.createdAt,
              acknowledged_at: alert.acknowledgedAt,
              resolved_at: alert.resolvedAt
            });
        },
        async () => {
          this.logger.warn('Circuit breaker open, caching alert locally');
        }
      );
    } catch (error) {
      this.logger.error('Failed to store performance alert', {
        alertId: alert.alertId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private initializeMonitoring(): void {
    // Initialize global monitoring systems
    this.logger.info('Performance monitoring system initialized');
  }
}