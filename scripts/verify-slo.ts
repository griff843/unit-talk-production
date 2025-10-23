#!/usr/bin/env ts-node
/**
 * ============================================================================
 * ENHANCED SLO VERIFICATION WITH METRICS COLLECTION
 * ============================================================================
 * Purpose: Verify SLO compliance and export metrics for Prometheus
 * Targets: p95 <50ms single-table, <150ms MV reads, <40ms writes
 * Features: Real-time metrics, baseline tracking, performance trends
 * ============================================================================
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as promClient from 'prom-client';
import express from 'express';
import { performance } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Prometheus metrics
const register = new promClient.Registry();

// Define metrics
const queryDuration = new promClient.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'table', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

const apiLatency = new promClient.Histogram({
  name: 'api_request_duration_seconds',
  help: 'API request duration in seconds',
  labelNames: ['method', 'endpoint', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

const queueDepth = new promClient.Gauge({
  name: 'queue_depth_total',
  help: 'Current queue depth',
  labelNames: ['queue_name'],
});

const cacheHitRate = new promClient.Gauge({
  name: 'cache_hit_rate',
  help: 'Cache hit rate percentage',
  labelNames: ['cache_type'],
});

const activeConnections = new promClient.Gauge({
  name: 'database_connections_active',
  help: 'Active database connections',
});

const sloCompliance = new promClient.Gauge({
  name: 'slo_compliance',
  help: 'SLO compliance status (1=pass, 0=fail)',
  labelNames: ['slo_name'],
});

// ML-specific metrics
const mlPredictionLatency = new promClient.Histogram({
  name: 'ml_prediction_latency_seconds',
  help: 'ML prediction latency in seconds',
  labelNames: ['model_version', 'environment', 'from_cache'],
  buckets: [0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 1],
});

const mlPredictionCount = new promClient.Counter({
  name: 'ml_predictions_total',
  help: 'Total number of ML predictions',
  labelNames: ['model_version', 'environment', 'status'],
});

const mlErrorRate = new promClient.Gauge({
  name: 'ml_error_rate',
  help: 'ML prediction error rate',
  labelNames: ['model_version', 'environment'],
});

const mlAccuracyDelta = new promClient.Gauge({
  name: 'ml_accuracy_delta',
  help: 'ML accuracy difference vs heuristic',
  labelNames: ['model_version', 'environment'],
});

const mlDiscrepancyRate = new promClient.Gauge({
  name: 'ml_discrepancy_rate',
  help: 'Rate of ML vs heuristic discrepancies',
  labelNames: ['model_version', 'environment', 'magnitude'],
});

const mlCacheHitRate = new promClient.Gauge({
  name: 'ml_cache_hit_rate',
  help: 'ML prediction cache hit rate',
  labelNames: ['model_version'],
});

const mlFallbackRate = new promClient.Gauge({
  name: 'ml_fallback_rate',
  help: 'ML fallback to heuristic rate',
  labelNames: ['model_version', 'environment'],
});

const mlDriftScore = new promClient.Gauge({
  name: 'ml_drift_score',
  help: 'ML model drift detection score',
  labelNames: ['model_version', 'feature_name'],
});

const mlDeploymentStatus = new promClient.Gauge({
  name: 'ml_deployment_status',
  help: 'ML deployment status (1=active, 0=inactive)',
  labelNames: ['deployment_id', 'stage', 'status'],
});

// Register metrics
register.registerMetric(queryDuration);
register.registerMetric(apiLatency);
register.registerMetric(queueDepth);
register.registerMetric(cacheHitRate);
register.registerMetric(activeConnections);
register.registerMetric(sloCompliance);

// Register ML metrics
register.registerMetric(mlPredictionLatency);
register.registerMetric(mlPredictionCount);
register.registerMetric(mlErrorRate);
register.registerMetric(mlAccuracyDelta);
register.registerMetric(mlDiscrepancyRate);
register.registerMetric(mlCacheHitRate);
register.registerMetric(mlFallbackRate);
register.registerMetric(mlDriftScore);
register.registerMetric(mlDeploymentStatus);

// Add default metrics
promClient.collectDefaultMetrics({ register });

interface SLOTarget {
  name: string;
  target_ms: number;
  query_pattern: string;
  category: 'read' | 'write' | 'refresh';
}

interface PerformanceBaseline {
  timestamp: Date;
  metrics: {
    [key: string]: {
      p50: number;
      p95: number;
      p99: number;
      samples: number;
    };
  };
}

class EnhancedSLOVerifier {
  private supabase: SupabaseClient;
  private baselines: PerformanceBaseline[] = [];
  
  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.loadBaselines();
  }

  /**
   * Load historical baselines
   */
  private loadBaselines(): void {
    const baselinePath = path.join(__dirname, '../data/performance-baselines.json');
    if (fs.existsSync(baselinePath)) {
      const data = fs.readFileSync(baselinePath, 'utf-8');
      this.baselines = JSON.parse(data);
    }
  }

  /**
   * Save current baseline
   */
  private saveBaseline(baseline: PerformanceBaseline): void {
    this.baselines.push(baseline);
    // Keep only last 30 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    this.baselines = this.baselines.filter(b => new Date(b.timestamp) > cutoff);
    
    const baselinePath = path.join(__dirname, '../data/performance-baselines.json');
    fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
    fs.writeFileSync(baselinePath, JSON.stringify(this.baselines, null, 2));
  }

  /**
   * Measure query performance
   */
  async measureQuery(query: string, operation: string, table: string): Promise<number> {
    const start = performance.now();
    let status = 'success';
    
    try {
      await this.supabase.rpc('execute_query', { query_text: query });
    } catch (error) {
      status = 'error';
      throw error;
    } finally {
      const duration = (performance.now() - start) / 1000;
      queryDuration.observe({ operation, table, status }, duration);
      return duration * 1000; // Return in ms
    }
  }

  /**
   * Run comprehensive SLO verification
   */
  async verifySLOs(): Promise<void> {
    console.log('🔍 Running enhanced SLO verification...\n');

    const sloTargets: SLOTarget[] = [
      {
        name: 'single_table_reads',
        target_ms: 50,
        query_pattern: 'SELECT * FROM unified_picks WHERE created_at > NOW() - INTERVAL \'1 hour\' LIMIT 100',
        category: 'read',
      },
      {
        name: 'mv_reads',
        target_ms: 150,
        query_pattern: 'SELECT * FROM mv_cc_board_now LIMIT 100',
        category: 'read',
      },
      {
        name: 'writes',
        target_ms: 40,
        query_pattern: 'INSERT INTO agent_metrics (agent_name, metric_value) VALUES (\'test\', 0)',
        category: 'write',
      },
      {
        name: 'ml_predictions',
        target_ms: 20,
        query_pattern: 'SELECT * FROM ml_shadow_predictions WHERE created_at > NOW() - INTERVAL \'1 hour\' LIMIT 100',
        category: 'read',
      },
      {
        name: 'ml_metrics_view',
        target_ms: 100,
        query_pattern: 'SELECT * FROM ml_performance_metrics WHERE hour > NOW() - INTERVAL \'24 hours\' LIMIT 50',
        category: 'read',
      },
    ];

    const baseline: PerformanceBaseline = {
      timestamp: new Date(),
      metrics: {},
    };

    for (const slo of sloTargets) {
      console.log(`📊 Testing ${slo.name} (target: <${slo.target_ms}ms)`);
      
      const measurements: number[] = [];
      
      // Run 10 samples
      for (let i = 0; i < 10; i++) {
        try {
          const duration = await this.measureQuery(
            slo.query_pattern,
            slo.category,
            slo.name
          );
          measurements.push(duration);
          process.stdout.write('.');
        } catch (error) {
          process.stdout.write('x');
        }
      }
      
      console.log('');
      
      // Calculate percentiles
      measurements.sort((a, b) => a - b);
      const p50 = measurements[Math.floor(measurements.length * 0.5)];
      const p95 = measurements[Math.floor(measurements.length * 0.95)];
      const p99 = measurements[Math.floor(measurements.length * 0.99)];
      
      // Store baseline
      baseline.metrics[slo.name] = {
        p50: p50 || 0,
        p95: p95 || 0,
        p99: p99 || 0,
        samples: measurements.length,
      };
      
      // Check compliance
      const compliant = p95 <= slo.target_ms;
      sloCompliance.set({ slo_name: slo.name }, compliant ? 1 : 0);
      
      // Log results
      console.log(`  ├─ p50: ${p50?.toFixed(1)}ms`);
      console.log(`  ├─ p95: ${p95?.toFixed(1)}ms ${compliant ? '✅' : '❌'}`);
      console.log(`  ├─ p99: ${p99?.toFixed(1)}ms`);
      console.log(`  └─ Status: ${compliant ? 'PASS' : 'FAIL'}\n`);
    }

    // Save baseline
    this.saveBaseline(baseline);
    
    // Check trends
    this.analyzeTrends();
  }

  /**
   * Analyze performance trends
   */
  private analyzeTrends(): void {
    if (this.baselines.length < 2) return;
    
    console.log('📈 Performance Trends (last 7 days)\n');
    
    const recent = this.baselines.slice(-7);
    const sloNames = Object.keys(recent[0].metrics);
    
    for (const sloName of sloNames) {
      const values = recent.map(b => b.metrics[sloName]?.p95 || 0);
      const trend = this.calculateTrend(values);
      
      console.log(`${sloName}:`);
      console.log(`  ├─ 7-day average: ${(values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)}ms`);
      console.log(`  └─ Trend: ${trend}\n`);
    }
  }

  /**
   * Calculate trend direction
   */
  private calculateTrend(values: number[]): string {
    if (values.length < 2) return 'insufficient data';
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const change = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    if (change > 10) return `⚠️ degrading (+${change.toFixed(0)}%)`;
    if (change < -10) return `✅ improving (${change.toFixed(0)}%)`;
    return '→ stable';
  }

  /**
   * Collect additional metrics
   */
  async collectMetrics(): Promise<void> {
    // Database connections
    const { data: connData } = await this.supabase
      .rpc('get_connection_stats');
    if (connData) {
      activeConnections.set(connData.active_connections || 0);
    }

    // Queue depths (simulated)
    queueDepth.set({ queue_name: 'ingestion' }, Math.random() * 1000);
    queueDepth.set({ queue_name: 'scoring' }, Math.random() * 500);
    queueDepth.set({ queue_name: 'alerts' }, Math.random() * 100);

    // Cache hit rates (simulated)
    cacheHitRate.set({ cache_type: 'redis' }, 85 + Math.random() * 10);
    cacheHitRate.set({ cache_type: 'cdn' }, 90 + Math.random() * 8);

    // Collect ML metrics
    await this.collectMLMetrics();
  }

  /**
   * Collect ML-specific metrics
   */
  async collectMLMetrics(): Promise<void> {
    try {
      // Get ML performance metrics from last hour
      const { data: mlMetrics, error } = await this.supabase
        .from('ml_performance_metrics')
        .select('*')
        .gte('hour', new Date(Date.now() - 3600000).toISOString())
        .order('hour', { ascending: false });

      if (error) {
        console.error('Failed to collect ML metrics:', error);
        return;
      }

      if (!mlMetrics || mlMetrics.length === 0) {
        return;
      }

      // Process metrics by model version and environment
      for (const metric of mlMetrics) {
        const labels = {
          model_version: metric.model_version || 'unknown',
          environment: metric.environment || 'unknown',
        };

        // Prediction latency
        if (metric.avg_latency_ms) {
          mlPredictionLatency.observe(
            { ...labels, from_cache: 'false' },
            metric.avg_latency_ms / 1000
          );
        }

        // Error rate
        if (metric.total_predictions > 0) {
          const errorRate = (metric.error_count || 0) / metric.total_predictions;
          mlErrorRate.set(labels, errorRate);

          // Fallback rate
          const fallbackRate = (metric.fallback_count || 0) / metric.total_predictions;
          mlFallbackRate.set(labels, fallbackRate);

          // Cache hit rate
          const cacheHitRate = (metric.cache_hits || 0) / metric.total_predictions;
          mlCacheHitRate.set({ model_version: labels.model_version }, cacheHitRate);
        }

        // Accuracy delta
        if (metric.avg_accuracy_differential !== null) {
          mlAccuracyDelta.set(labels, metric.avg_accuracy_differential);
        }

        // Discrepancy rates by magnitude
        if (metric.extreme_discrepancies !== null) {
          mlDiscrepancyRate.set(
            { ...labels, magnitude: 'extreme' },
            (metric.extreme_discrepancies || 0) / Math.max(1, metric.total_predictions || 1)
          );
        }

        // Update prediction count
        mlPredictionCount.inc(
          { ...labels, status: 'success' },
          (metric.total_predictions || 0) - (metric.error_count || 0)
        );
        mlPredictionCount.inc(
          { ...labels, status: 'error' },
          metric.error_count || 0
        );
      }

      // Get deployment status
      await this.collectMLDeploymentStatus();

      // Get drift scores
      await this.collectMLDriftScores();

    } catch (error) {
      console.error('Error collecting ML metrics:', error);
    }
  }

  /**
   * Collect ML deployment status
   */
  async collectMLDeploymentStatus(): Promise<void> {
    try {
      const { data: deployments, error } = await this.supabase
        .from('ml_deployment_status')
        .select('deployment_id, stage, status, model_version')
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Failed to collect deployment status:', error);
        return;
      }

      if (deployments) {
        for (const deployment of deployments) {
          mlDeploymentStatus.set(
            {
              deployment_id: deployment.deployment_id,
              stage: deployment.stage,
              status: deployment.status,
            },
            1
          );
        }
      }
    } catch (error) {
      console.error('Error collecting deployment status:', error);
    }
  }

  /**
   * Collect ML drift scores
   */
  async collectMLDriftScores(): Promise<void> {
    try {
      // Get latest drift scores from shadow predictions
      const { data: driftData, error } = await this.supabase
        .rpc('calculate_feature_drift_scores')
        .gte('created_at', new Date(Date.now() - 3600000).toISOString());

      if (error) {
        console.error('Failed to collect drift scores:', error);
        return;
      }

      if (driftData) {
        for (const drift of driftData) {
          mlDriftScore.set(
            {
              model_version: drift.model_version,
              feature_name: drift.feature_name,
            },
            drift.drift_score
          );
        }
      }
    } catch (error) {
      console.error('Error collecting drift scores:', error);
    }
  }
}

/**
 * Start metrics server
 */
function startMetricsServer(): void {
  const app = express();
  const port = process.env.METRICS_PORT || 9090;

  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
  });

  app.listen(port, () => {
    console.log(`📊 Metrics server running on http://localhost:${port}/metrics`);
  });
}

/**
 * Main execution
 */
async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  const verifier = new EnhancedSLOVerifier(supabaseUrl, supabaseKey);

  // Start metrics server
  startMetricsServer();

  // Run initial verification
  await verifier.verifySLOs();
  await verifier.collectMetrics();

  // Schedule periodic runs
  setInterval(async () => {
    await verifier.verifySLOs();
    await verifier.collectMetrics();
  }, 300000); // Every 5 minutes

  console.log('✅ SLO verification running with metrics export\n');
  console.log('View metrics at: http://localhost:9090/metrics');
  console.log('Press Ctrl+C to stop\n');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export default EnhancedSLOVerifier;