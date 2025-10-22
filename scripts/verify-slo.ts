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

// Register metrics
register.registerMetric(queryDuration);
register.registerMetric(apiLatency);
register.registerMetric(queueDepth);
register.registerMetric(cacheHitRate);
register.registerMetric(activeConnections);
register.registerMetric(sloCompliance);

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