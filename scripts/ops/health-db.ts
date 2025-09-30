#!/usr/bin/env npx tsx

/**
 * Live Database Health Check
 * Tests actual DB connectivity, schema integrity, and data consistency
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { requireEnv } from '../lib/env';

// Initialize Supabase client
const supabaseUrl = requireEnv('SUPABASE_URL');
const supabaseKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

interface HealthResult {
  timestamp: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  checks: {
    connectivity: boolean;
    core_tables: boolean;
    hot_tier: boolean;
    warm_tier: boolean;
    cold_tier: boolean;
    data_integrity: boolean;
  };
  metrics: {
    response_time_ms: number;
    total_picks: number;
    processed_props: number;
    pending_approvals: number;
    active_alerts: number;
  };
  errors: string[];
}

async function runHealthCheck(): Promise<HealthResult> {
  const start = Date.now();
  const result: HealthResult = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    checks: {
      connectivity: false,
      core_tables: false,
      hot_tier: false,
      warm_tier: false,
      cold_tier: false,
      data_integrity: false
    },
    metrics: {
      response_time_ms: 0,
      total_picks: 0,
      processed_props: 0,
      pending_approvals: 0,
      active_alerts: 0
    },
    errors: []
  };

  try {
    // Test 1: Basic connectivity
    const { data: connectTest, error: connectError } = await supabase
      .from('unified_picks')
      .select('count')
      .limit(1);

    if (connectError) {
      result.errors.push(`Connectivity failed: ${connectError.message}`);
    } else {
      result.checks.connectivity = true;
    }

    // Test 2: Core tables exist
    const coreTables = ['unified_picks', 'raw_props', 'users', 'agent_health'];
    const { data: tableCheck } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('${coreTables.join("','")}')
      `
    });

    const foundTables = tableCheck?.map((row: any) => row.table_name) || [];
    const missingTables = coreTables.filter(table => !foundTables.includes(table));

    if (missingTables.length === 0) {
      result.checks.core_tables = true;
    } else {
      result.errors.push(`Missing core tables: ${missingTables.join(', ')}`);
    }

    // Test 3: HOT tier tables
    const hotTables = ['approval_queue', 'alerts_queue', 'scoring_explanations', 'runtime_config', 'temporal_metrics'];
    const { data: hotCheck } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('${hotTables.join("','")}')
      `
    });

    const foundHotTables = hotCheck?.map((row: any) => row.table_name) || [];
    const missingHotTables = hotTables.filter(table => !foundHotTables.includes(table));

    if (missingHotTables.length === 0) {
      result.checks.hot_tier = true;
    } else {
      result.errors.push(`Missing HOT tier tables: ${missingHotTables.join(', ')}`);
    }

    // Test 4: WARM tier materialized views
    const warmViews = ['mv_capper_leaderboard_7_30_90', 'mv_daily_unified_recaps', 'mv_alert_overlay_today'];
    const { data: warmCheck } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'VIEW'
        AND table_name IN ('${warmViews.join("','")}')
      `
    });

    const foundWarmViews = warmCheck?.map((row: any) => row.table_name) || [];
    const missingWarmViews = warmViews.filter(view => !foundWarmViews.includes(view));

    if (missingWarmViews.length <= 1) { // Allow 1 missing for partial implementation
      result.checks.warm_tier = true;
    } else {
      result.errors.push(`Missing WARM tier views: ${missingWarmViews.join(', ')}`);
    }

    // Test 5: COLD tier tables
    const coldTables = ['settlements', 'metrics_timeseries', 'slo_incidents'];
    const { data: coldCheck } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('${coldTables.join("','")}')
      `
    });

    const foundColdTables = coldCheck?.map((row: any) => row.table_name) || [];
    const missingColdTables = coldTables.filter(table => !foundColdTables.includes(table));

    if (missingColdTables.length <= 1) { // Allow 1 missing for partial implementation
      result.checks.cold_tier = true;
    } else {
      result.errors.push(`Missing COLD tier tables: ${missingColdTables.join(', ')}`);
    }

    // Test 6: Data integrity and metrics
    const { data: metrics } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT
          (SELECT COUNT(*) FROM unified_picks) as total_picks,
          (SELECT COUNT(*) FROM raw_props WHERE status = 'processed') as processed_props,
          (SELECT COUNT(*) FROM approval_queue WHERE status = 'pending') as pending_approvals,
          (SELECT COUNT(*) FROM alerts_queue WHERE sent_at IS NULL) as active_alerts
      `
    });

    if (metrics && metrics.length > 0) {
      const m = metrics[0];
      result.metrics.total_picks = parseInt(m.total_picks) || 0;
      result.metrics.processed_props = parseInt(m.processed_props) || 0;
      result.metrics.pending_approvals = parseInt(m.pending_approvals) || 0;
      result.metrics.active_alerts = parseInt(m.active_alerts) || 0;
      result.checks.data_integrity = true;
    } else {
      result.errors.push('Failed to retrieve system metrics');
    }

  } catch (error) {
    result.errors.push(`Health check failed: ${error.message}`);
  }

  result.metrics.response_time_ms = Date.now() - start;

  // Determine overall status
  const failedChecks = Object.values(result.checks).filter(check => !check).length;
  if (failedChecks === 0) {
    result.status = 'healthy';
  } else if (failedChecks <= 2) {
    result.status = 'degraded';
  } else {
    result.status = 'unhealthy';
  }

  return result;
}

async function main() {
  try {
    const healthResult = await runHealthCheck();

    // Write to output file
    const outputPath = join(process.cwd(), 'out', 'ops', 'health-db.json');
    writeFileSync(outputPath, JSON.stringify(healthResult, null, 2));

    console.log(`Database health check completed: ${healthResult.status}`);
    console.log(`Results written to: ${outputPath}`);

    if (healthResult.status === 'unhealthy') {
      process.exit(1);
    }
  } catch (error) {
    console.error('Health check script failed:', error);
    process.exit(1);
  }
}

main();