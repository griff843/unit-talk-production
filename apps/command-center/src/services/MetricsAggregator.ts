/**
 * @fileoverview Metrics Aggregator Service
 * Background service for continuous SLO monitoring and burn-rate calculation
 */

import { getSupabaseClient } from '@/lib/supabase';
import { UnitTalkTracing } from '@/lib/telemetry';

// =============================================================================
// INTERFACES & TYPES
// =============================================================================

interface MetricCollection {
  grading_lag: {
    avg_ms: number;
    p95_ms: number;
    p50_ms: number;
    processed_count: number;
  };
  queue_status: {
    instant_backlog: number;
    scheduled_backlog: number;
    published_count: number;
    total_picks: number;
  };
  system_health: {
    uptime_pct: number;
    error_rate: number;
    api_response_time: number;
  };
  exposure_metrics: {
    total_exposure: number;
    kelly_at_risk: number;
    high_risk_picks: number;
    correlation_violations: number;
  };
  temporal_health: {
    success_rate: number;
    failed_workflows_1h: number;
    stuck_workflows: number;
    missed_schedules: number;
  };
}

interface SLOBurnRate {
  slo_id: string;
  slo_name: string;
  current_error_rate: number;
  target_error_rate: number;
  fast_burn_rate: number;
  slow_burn_rate: number;
  fast_window: string;
  slow_window: string;
  should_alert: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// =============================================================================
// METRICS AGGREGATOR SERVICE
// =============================================================================

export class MetricsAggregatorService {
  private static instance: MetricsAggregatorService;
  private intervalHandle: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly collectionIntervalMs = 60000; // 1 minute

  static getInstance(): MetricsAggregatorService {
    if (!MetricsAggregatorService.instance) {
      MetricsAggregatorService.instance = new MetricsAggregatorService();
    }
    return MetricsAggregatorService.instance;
  }

  /**
   * Start metrics collection service
   */
  start(): void {
    if (this.isRunning) {
      console.log('🔄 Metrics aggregator already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting metrics aggregator service');

    // Run initial collection
    this.collectMetrics();

    // Schedule recurring collection
    this.intervalHandle = setInterval(
      () => this.collectMetrics(),
      this.collectionIntervalMs
    );

    // Schedule SLO burn-rate checks every 5 minutes
    setInterval(
      () => this.checkSLOBurnRates(),
      5 * 60 * 1000
    );

    // Schedule cleanup every hour
    setInterval(
      () => this.cleanupExpiredMetrics(),
      60 * 60 * 1000
    );
  }

  /**
   * Stop metrics collection service
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    console.log('🛑 Metrics aggregator stopped');
  }

  /**
   * Collect all system metrics
   */
  private async collectMetrics(): Promise<void> {
    const span = UnitTalkTracing.startAgentSpan('metrics', 'collect_all_metrics');

    try {
      const metrics = await this.gatherAllMetrics();
      await this.storeMetrics(metrics);

      UnitTalkTracing.recordSuccess(span, {
        itemsProcessed: Object.keys(metrics).length,
      });

      console.log('📊 Metrics collected successfully:', {
        grading_lag_p95: metrics.grading_lag.p95_ms,
        queue_backlog: metrics.queue_status.instant_backlog + metrics.queue_status.scheduled_backlog,
        system_uptime: metrics.system_health.uptime_pct,
        total_exposure: metrics.exposure_metrics.total_exposure,
      });

    } catch (error) {
      UnitTalkTracing.recordError(span, error as Error);
      console.error('❌ Error collecting metrics:', error);
    } finally {
      span.end();
    }
  }

  /**
   * Gather metrics from all sources
   */
  private async gatherAllMetrics(): Promise<MetricCollection> {
    const [
      gradingLag,
      queueStatus,
      systemHealth,
      exposureMetrics,
      temporalHealth
    ] = await Promise.allSettled([
      this.collectGradingLag(),
      this.collectQueueStatus(),
      this.collectSystemHealth(),
      this.collectExposureMetrics(),
      this.collectTemporalHealth(),
    ]);

    return {
      grading_lag: gradingLag.status === 'fulfilled' ? gradingLag.value : this.getDefaultGradingLag(),
      queue_status: queueStatus.status === 'fulfilled' ? queueStatus.value : this.getDefaultQueueStatus(),
      system_health: systemHealth.status === 'fulfilled' ? systemHealth.value : this.getDefaultSystemHealth(),
      exposure_metrics: exposureMetrics.status === 'fulfilled' ? exposureMetrics.value : this.getDefaultExposureMetrics(),
      temporal_health: temporalHealth.status === 'fulfilled' ? temporalHealth.value : this.getDefaultTemporalHealth(),
    };
  }

  /**
   * Collect grading lag metrics
   */
  private async collectGradingLag(): Promise<MetricCollection['grading_lag']> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return this.getDefaultGradingLag();
    }
    
    const { data, error } = await supabase
      .from('vw_grading_lag')
      .select('*')
      .single();

    if (error || !data) {
      return this.getDefaultGradingLag();
    }

    return {
      avg_ms: Number(data.avg_ms) || 0,
      p95_ms: Number(data.p95_ms) || 0,
      p50_ms: Number(data.p50_ms) || 0,
      processed_count: Number(data.processed_count) || 0,
    };
  }

  /**
   * Collect queue status metrics
   */
  private async collectQueueStatus(): Promise<MetricCollection['queue_status']> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return this.getDefaultQueueStatus();
    }
    
    const { data, error } = await supabase
      .from('vw_queue_backlog')
      .select('*')
      .single();

    if (error || !data) {
      return this.getDefaultQueueStatus();
    }

    return {
      instant_backlog: Number(data.instant_backlog) || 0,
      scheduled_backlog: Number(data.scheduled_backlog) || 0,
      published_count: Number(data.published_count) || 0,
      total_picks: Number(data.total_picks) || 0,
    };
  }

  /**
   * Collect system health metrics
   */
  private async collectSystemHealth(): Promise<MetricCollection['system_health']> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    // Check API health by testing database connection
    const healthCheckStart = Date.now();
    const { error } = await supabase.from('system_metrics').select('id').limit(1);
    const responseTime = Date.now() - healthCheckStart;

    // Calculate uptime based on recent successful metrics
    const { count: recentMetrics } = await supabase
      .from('system_metrics')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // Last 5 minutes

    const uptimePct = error ? 0 : Math.min(100, (recentMetrics || 0) / 5 * 100); // Expected 5 collections in 5 minutes

    // Calculate error rate from recent system metrics
    const { count: errorMetrics } = await supabase
      .from('audit_log')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failure')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Last hour

    const errorRate = (errorMetrics || 0) / Math.max(1, recentMetrics || 1);

    return {
      uptime_pct: Math.round(uptimePct * 100) / 100,
      error_rate: Math.round(errorRate * 10000) / 10000,
      api_response_time: responseTime,
    };
  }

  /**
   * Collect exposure metrics
   */
  private async collectExposureMetrics(): Promise<MetricCollection['exposure_metrics']> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return this.getDefaultExposureMetrics();
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: exposureData, error } = await supabase
      .from('exposure_snapshots')
      .select('exposure_amount, kelly_fraction, risk_tier, correlation_cluster')
      .gte('created_at', today.toISOString())
      .eq('published', true);

    if (error || !exposureData) {
      return this.getDefaultExposureMetrics();
    }

    interface ExposureRow {
      exposure_amount?: number;
      kelly_fraction?: number;
      risk_tier?: string;
      correlation_cluster?: string;
    }

    const typedData = exposureData as ExposureRow[];
    const totalExposure = typedData.reduce((sum, item) => sum + (item.exposure_amount || 0), 0);
    const kellyAtRisk = typedData.reduce((sum, item) => sum + Math.abs(item.kelly_fraction || 0), 0);
    const highRiskPicks = typedData.filter(item => 
      item.risk_tier === 'high' || item.risk_tier === 'critical'
    ).length;

    // Count correlation violations (more than 3 picks in same cluster)
    const clusterCounts = new Map<string, number>();
    typedData.forEach(item => {
      const cluster = item.correlation_cluster;
      if (cluster) {
        clusterCounts.set(cluster, (clusterCounts.get(cluster) || 0) + 1);
      }
    });
    const correlationViolations = Array.from(clusterCounts.values()).filter(count => count > 3).length;

    return {
      total_exposure: Math.round(totalExposure),
      kelly_at_risk: Math.round(kellyAtRisk * 100) / 100,
      high_risk_picks: highRiskPicks,
      correlation_violations: correlationViolations,
    };
  }

  /**
   * Collect Temporal health metrics
   */
  private async collectTemporalHealth(): Promise<MetricCollection['temporal_health']> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return this.getDefaultTemporalHealth();
    }
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Get recent workflow stats
    const { data: workflows, error: _workflowError } = await supabase
      .from('temporal_workflow_health')
      .select('status')
      .gte('created_at', oneHourAgo.toISOString());

    const workflowStats = workflows || [];
    const totalWorkflows = workflowStats.length;
    const successfulWorkflows = workflowStats.filter((w: { status: string }) => w.status === 'completed').length;
    const failedWorkflows = workflowStats.filter((w: { status: string }) => w.status === 'failed').length;

    const successRate = totalWorkflows > 0 ? successfulWorkflows / totalWorkflows : 1;

    // Get stuck workflows (running > 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const { count: stuckWorkflows } = await supabase
      .from('temporal_workflow_health')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'running')
      .lt('started_at', thirtyMinutesAgo.toISOString());

    // Get missed schedules
    const { count: missedSchedules } = await supabase
      .from('temporal_schedule_health')
      .select('*', { count: 'exact', head: true })
      .eq('is_missing', true);

    return {
      success_rate: Math.round(successRate * 10000) / 10000,
      failed_workflows_1h: failedWorkflows,
      stuck_workflows: stuckWorkflows || 0,
      missed_schedules: missedSchedules || 0,
    };
  }

  /**
   * Store collected metrics in database
   */
  private async storeMetrics(metrics: MetricCollection): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }
    
    const timestamp = new Date().toISOString();
    const metricsToStore = [
      // Grading metrics
      {
        metric: 'grading_lag_ms_avg',
        value: metrics.grading_lag.avg_ms,
        labels: JSON.stringify({ period: '24h' }),
        source: 'metrics_aggregator',
        created_at: timestamp,
      },
      {
        metric: 'grading_lag_ms_p95',
        value: metrics.grading_lag.p95_ms,
        labels: JSON.stringify({ period: '24h' }),
        source: 'metrics_aggregator',
        created_at: timestamp,
      },
      {
        metric: 'grading_lag_ms_p50',
        value: metrics.grading_lag.p50_ms,
        labels: JSON.stringify({ period: '24h' }),
        source: 'metrics_aggregator',
        created_at: timestamp,
      },

      // Queue metrics
      {
        metric: 'queue_backlog_instant',
        value: metrics.queue_status.instant_backlog,
        labels: JSON.stringify({ queue_type: 'instant' }),
        source: 'metrics_aggregator',
        created_at: timestamp,
      },
      {
        metric: 'queue_backlog_scheduled',
        value: metrics.queue_status.scheduled_backlog,
        labels: JSON.stringify({ queue_type: 'scheduled' }),
        source: 'metrics_aggregator',
        created_at: timestamp,
      },

      // System health
      {
        metric: 'system_uptime_pct',
        value: metrics.system_health.uptime_pct,
        labels: JSON.stringify({ period: '5m' }),
        source: 'metrics_aggregator',
        created_at: timestamp,
      },
      {
        metric: 'api_response_time_ms',
        value: metrics.system_health.api_response_time,
        labels: JSON.stringify({ endpoint: 'health_check' }),
        source: 'metrics_aggregator',
        created_at: timestamp,
      },
      {
        metric: 'system_error_rate',
        value: metrics.system_health.error_rate,
        labels: JSON.stringify({ period: '1h' }),
        source: 'metrics_aggregator',
        created_at: timestamp,
      },

      // Exposure metrics
      {
        metric: 'total_exposure_amount',
        value: metrics.exposure_metrics.total_exposure,
        labels: JSON.stringify({ period: 'daily' }),
        source: 'metrics_aggregator',
        created_at: timestamp,
      },
      {
        metric: 'kelly_at_risk',
        value: metrics.exposure_metrics.kelly_at_risk,
        labels: JSON.stringify({ period: 'daily' }),
        source: 'metrics_aggregator',
        created_at: timestamp,
      },

      // Temporal health
      {
        metric: 'temporal_success_rate_pct',
        value: metrics.temporal_health.success_rate * 100,
        labels: JSON.stringify({ period: '1h' }),
        source: 'metrics_aggregator',
        created_at: timestamp,
      },
      {
        metric: 'temporal_failed_workflows',
        value: metrics.temporal_health.failed_workflows_1h,
        labels: JSON.stringify({ period: '1h' }),
        source: 'metrics_aggregator',
        created_at: timestamp,
      },
    ];

    const { error } = await supabase
      .from('system_metrics')
      .insert(metricsToStore);

    if (error) {
      console.error('Error storing metrics:', error);
      throw error;
    }
  }

  /**
   * Check SLO burn rates and create incidents
   */
  private async checkSLOBurnRates(): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.error('Supabase client not initialized for SLO burn rate check');
      return;
    }
    
    const span = UnitTalkTracing.startAgentSpan('metrics', 'check_slo_burn_rates');

    try {
      // Get all enabled SLOs
      const { data: slos, error } = await supabase
        .from('slos')
        .select('*')
        .eq('enabled', true);

      if (error || !slos) {
        console.error('Error fetching SLOs:', error);
        return;
      }

      for (const slo of slos) {
        const burnRate = await this.calculateSLOBurnRate(slo);
        await this.processSLOBurnRate(burnRate);
      }

      UnitTalkTracing.recordSuccess(span, {
        itemsProcessed: slos.length,
      });

    } catch (error) {
      UnitTalkTracing.recordError(span, error as Error);
      console.error('Error checking SLO burn rates:', error);
    } finally {
      span.end();
    }
  }

  /**
   * Calculate burn rate for specific SLO
   */
  private async calculateSLOBurnRate(slo: {
    id: string;
    name: string;
    error_budget: number;
    fast_burn_window?: string;
    slow_burn_window?: string;
    fast_burn_rate?: number;
    slow_burn_rate?: number;
  }): Promise<SLOBurnRate> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    // Use the database function we created
    const { data, error } = await supabase.rpc('calculate_slo_burn_rate', {
      slo_name: slo.name,
      window_duration: slo.fast_burn_window || '1 hour',
    });

    if (error) {
      console.error(`Error calculating burn rate for ${slo.name}:`, error);
      return {
        slo_id: slo.id,
        slo_name: slo.name,
        current_error_rate: 0,
        target_error_rate: slo.error_budget,
        fast_burn_rate: 0,
        slow_burn_rate: 0,
        fast_window: slo.fast_burn_window || '1h',
        slow_window: slo.slow_burn_window || '6h',
        should_alert: false,
        severity: 'low',
      };
    }

    const burnRate = data || 0;
    const fastThreshold = slo.fast_burn_rate || 14.4;
    const slowThreshold = slo.slow_burn_rate || 1.0;

    const shouldAlert = burnRate > fastThreshold || burnRate > slowThreshold;
    const severity: 'low' | 'medium' | 'high' | 'critical' = 
      burnRate > fastThreshold ? 'critical' : 
      burnRate > slowThreshold ? 'high' : 'medium';

    return {
      slo_id: slo.id,
      slo_name: slo.name,
      current_error_rate: 0, // Would need more complex calculation
      target_error_rate: slo.error_budget,
      fast_burn_rate: burnRate as number,
      slow_burn_rate: burnRate as number,
      fast_window: slo.fast_burn_window || '1h',
      slow_window: slo.slow_burn_window || '6h',
      should_alert: shouldAlert,
      severity,
    };
  }

  /**
   * Process SLO burn rate and create incidents if needed
   */
  private async processSLOBurnRate(burnRate: SLOBurnRate): Promise<void> {
    if (!burnRate.should_alert) return;

    const supabase = getSupabaseClient();
    if (!supabase) {
      console.error('Supabase client not initialized for SLO incident processing');
      return;
    }

    // Check if there's already an open incident
    const { data: existingIncident } = await supabase
      .from('slo_incidents')
      .select('id')
      .eq('slo_id', burnRate.slo_id)
      .eq('status', 'open')
      .single();

    if (existingIncident) {
      // Update existing incident
      await supabase
        .from('slo_incidents')
        .update({
          burn_rate: burnRate.fast_burn_rate,
          severity: burnRate.severity,
          details: JSON.stringify(burnRate),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingIncident.id);
    } else {
      // Create new incident
      await supabase
        .from('slo_incidents')
        .insert({
          slo_id: burnRate.slo_id,
          burn_rate: burnRate.fast_burn_rate,
          window: burnRate.fast_window,
          status: 'open',
          severity: burnRate.severity,
          details: JSON.stringify(burnRate),
          created_at: new Date().toISOString(),
        });
    }

    console.log(`🚨 SLO incident created/updated for ${burnRate.slo_name}:`, {
      burn_rate: burnRate.fast_burn_rate,
      severity: burnRate.severity,
    });
  }

  /**
   * Clean up expired metrics
   */
  private async cleanupExpiredMetrics(): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await supabase.rpc('cleanup_expired_metrics');
      
      if (error) {
        console.error('Error cleaning up expired metrics:', error);
      } else {
        console.log(`🧹 Cleaned up ${data || 0} expired metrics`);
      }
    } catch (error) {
      console.error('Error in cleanup process:', error);
    }
  }

  // Default values for failed metric collections
  private getDefaultGradingLag(): MetricCollection['grading_lag'] {
    return { avg_ms: 0, p95_ms: 0, p50_ms: 0, processed_count: 0 };
  }

  private getDefaultQueueStatus(): MetricCollection['queue_status'] {
    return { instant_backlog: 0, scheduled_backlog: 0, published_count: 0, total_picks: 0 };
  }

  private getDefaultSystemHealth(): MetricCollection['system_health'] {
    return { uptime_pct: 0, error_rate: 1, api_response_time: 5000 };
  }

  private getDefaultExposureMetrics(): MetricCollection['exposure_metrics'] {
    return { total_exposure: 0, kelly_at_risk: 0, high_risk_picks: 0, correlation_violations: 0 };
  }

  private getDefaultTemporalHealth(): MetricCollection['temporal_health'] {
    return { success_rate: 0, failed_workflows_1h: 0, stuck_workflows: 0, missed_schedules: 0 };
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const metricsAggregator = MetricsAggregatorService.getInstance();