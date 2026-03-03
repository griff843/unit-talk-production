// @ts-nocheck
/**
 * Performance Monitoring Functions
 * Real-time system health and performance tracking
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// SPRINT-SCHEMA-ENV-GATES-002: Lazy Supabase initialization
let _supabase: SupabaseClient | null = null;
function getMonitorSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
  }
  return _supabase;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metricsInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // Start monitoring with configurable interval
  public startMonitoring(intervalMinutes: number = 5) {
    console.log(`🚀 Starting performance monitoring (every ${intervalMinutes} minutes)`);

    this.metricsInterval = setInterval(
      async () => {
        try {
          await this.collectAndStoreMetrics();
          await this.checkAlertThresholds();
        } catch (error) {
          console.error('❌ Monitoring error:', error);
        }
      },
      intervalMinutes * 60 * 1000
    );

    // Immediate first collection
    this.collectAndStoreMetrics();
  }

  // Stop monitoring
  public stopMonitoring() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
      console.log('⏹️ Performance monitoring stopped');
    }
  }

  // Collect and store current metrics
  private async collectAndStoreMetrics() {
    const startTime = Date.now();

    try {
      // System metrics
      const { count: totalPicks } = await supabase
        .from('unified_picks')
        .select('*', { count: 'exact', head: true });

      const { count: professionalPicks } = await supabase
        .from('unified_picks')
        .select('*', { count: 'exact', head: true })
        .not('professional_score', 'is', null);

      const { count: clvEntries } = await supabase
        .from('clv_tracking')
        .select('*', { count: 'exact', head: true });

      // Professional system metrics
      const { data: scoringData } = await supabase
        .from('unified_picks')
        .select('professional_score, devigged_edge, tier, published, kelly_fraction')
        .not('professional_score', 'is', null);

      const processingTime = Date.now() - startTime;

      const metrics = {
        processing_speed_ms: processingTime,
        rule_compliance_rate: totalPicks ? (professionalPicks / totalPicks) * 100 : 0,
        avg_professional_score:
          scoringData?.reduce((sum, item) => sum + (item.professional_score || 0), 0) /
          (scoringData?.length || 1),
        avg_devigged_edge:
          scoringData?.reduce((sum, item) => sum + (item.devigged_edge || 0), 0) /
          (scoringData?.length || 1),
        auto_approval_rate:
          (scoringData?.filter(item => item.published).length / (scoringData?.length || 1)) * 100,
        clv_tracking_success_rate: clvEntries ? (clvEntries / (totalPicks || 1)) * 100 : 0,
        total_picks_processed: totalPicks || 0,
        tier_s_count: scoringData?.filter(item => item.tier === 'S').length || 0,
        tier_a_count: scoringData?.filter(item => item.tier === 'A').length || 0,
        tier_b_count: scoringData?.filter(item => item.tier === 'B').length || 0,
        tier_c_count: scoringData?.filter(item => item.tier === 'C').length || 0,
        tier_d_count: scoringData?.filter(item => item.tier === 'D').length || 0,
        avg_kelly_fraction:
          scoringData?.reduce((sum, item) => sum + (item.kelly_fraction || 0), 0) /
          (scoringData?.length || 1),
        data_completeness_score: professionalPicks
          ? (professionalPicks / (totalPicks || 1)) * 100
          : 0,
      };

      // Store metrics
      await getMonitorSupabase().from('performance_metrics').insert([metrics]);

      console.log(`📊 Metrics collected: ${JSON.stringify(metrics, null, 2)}`);
    } catch (error) {
      console.error('❌ Metrics collection failed:', error);
    }
  }

  // Check alert thresholds
  private async checkAlertThresholds() {
    const { data: latestMetrics } = await supabase
      .from('performance_metrics')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!latestMetrics) return;

    const alerts = [];

    // Define thresholds
    const thresholds = {
      rule_compliance_rate: { min: 95, severity: 'critical' },
      processing_speed_ms: { max: 2000, severity: 'high' },
      error_rate_percent: { max: 1, severity: 'medium' },
      avg_devigged_edge: { min: 0.01, severity: 'medium' },
      clv_tracking_success_rate: { min: 90, severity: 'high' },
    };

    // Check thresholds
    Object.entries(thresholds).forEach(([metric, threshold]) => {
      const value = latestMetrics[metric];
      let triggered = false;

      if ('min' in threshold && value < threshold.min) triggered = true;
      if ('max' in threshold && value > threshold.max) triggered = true;

      if (triggered) {
        alerts.push({
          alert_type: 'threshold_breach',
          severity: threshold.severity,
          message: `${metric} is ${value}, threshold: ${JSON.stringify(threshold)}`,
          metric_name: metric,
          current_value: value,
          threshold_value: threshold.min || threshold.max,
        });
      }
    });

    // Store alerts
    if (alerts.length > 0) {
      await getMonitorSupabase().from('performance_alerts').insert(alerts);
      console.log(`🚨 ${alerts.length} alerts triggered`);
    }
  }

  // Get dashboard data
  public async getDashboardData(hours: number = 24) {
    const { data: metrics } = await supabase
      .from('performance_metrics')
      .select('*')
      .gte('created_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true });

    const { data: alerts } = await supabase
      .from('performance_alerts')
      .select('*')
      .is('resolved_at', null)
      .order('triggered_at', { ascending: false });

    return { metrics, alerts };
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();
