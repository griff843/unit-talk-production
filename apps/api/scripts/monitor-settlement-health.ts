#!/usr/bin/env npx tsx

/**
 * Settlement Health Monitor Script
 * 
 * Monitors the settlement system health, heartbeat, and performance metrics
 * Provides real-time status and historical performance analysis
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Local logger implementation
const logger = {
  info:  (...a: any[]) => console.log('[INFO ]', ...a),
  warn:  (...a: any[]) => console.warn('[WARN ]', ...a),
  error: (...a: any[]) => console.error('[ERROR]', ...a),
  debug: (...a: any[]) => { if (process.env.DEBUG) console.log('[DEBUG]', ...a); },
};

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false }
  }
);

interface HeartbeatRecord {
  id: number;
  pipeline_name: string;
  processed_count: number;
  success_count: number;
  error_count: number;
  last_run: string;
  status: string;
  created_at: string;
}

async function getRecentHeartbeats(limit = 10): Promise<HeartbeatRecord[]> {
  const { data, error } = await supabase
    .from('settlement_heartbeat')
    .select('*')
    .eq('pipeline_name', 'mlb_settlement_backfill')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch heartbeat data: ${error.message}`);
  }

  return data || [];
}

async function getSettlementCandidates(): Promise<number> {
  const { count, error } = await supabase
    .from('shadow_decisions')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'settlement_backfill')
    .is('settled_at', null);

  if (error) {
    throw new Error(`Failed to count settlement candidates: ${error.message}`);
  }

  return count || 0;
}

async function getRecentSettlements(limit = 10): Promise<any[]> {
  const { data, error } = await supabase
    .from('shadow_decisions')
    .select('id, player, market, line, actual_result, settled_at, status, settlement_source')
    .eq('decision_type', 'settlement_backfill')
    .not('settled_at', 'is', null)
    .order('settled_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch recent settlements: ${error.message}`);
  }

  return data || [];
}

async function calculatePerformanceMetrics(hours = 24): Promise<any> {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('settlement_heartbeat')
    .select('processed_count, success_count, error_count, created_at')
    .eq('pipeline_name', 'mlb_settlement_backfill')
    .gte('created_at', cutoff);

  if (error) {
    throw new Error(`Failed to fetch performance data: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return {
      period_hours: hours,
      total_processed: 0,
      total_success: 0,
      total_errors: 0,
      success_rate: 0,
      runs_count: 0
    };
  }

  const total_processed = data.reduce((sum, row) => sum + row.processed_count, 0);
  const total_success = data.reduce((sum, row) => sum + row.success_count, 0);
  const total_errors = data.reduce((sum, row) => sum + row.error_count, 0);
  const success_rate = total_processed > 0 ? (100 * total_success / total_processed) : 0;

  return {
    period_hours: hours,
    total_processed,
    total_success,
    total_errors,
    success_rate: Number(success_rate.toFixed(2)),
    runs_count: data.length
  };
}

async function testExternalAPIs(): Promise<any> {
  const results = {
    mlb_stats_api: { status: 'unknown', response_time: 0, error: null }
  };

  // Test MLB Stats API
  try {
    const start = Date.now();
    const response = await fetch('https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=' + new Date().toISOString().slice(0,10));
    const duration = Date.now() - start;
    
    results.mlb_stats_api = {
      status: response.ok ? 'healthy' : 'error',
      response_time: duration,
      error: response.ok ? null : `HTTP ${response.status}`
    };
  } catch (error: any) {
    results.mlb_stats_api = {
      status: 'error',
      response_time: 0,
      error: error.message
    };
  }

  return results;
}

async function main() {
  const startTime = Date.now();
  logger.info('Settlement Health Monitor starting...');

  try {
    // Get current system status
    logger.info('=== Settlement System Health Monitor ===');
    logger.info(`Timestamp: ${new Date().toISOString()}`);
    console.log();

    // Check recent heartbeats
    logger.info('📊 Recent Settlement Heartbeats:');
    const heartbeats = await getRecentHeartbeats(5);
    if (heartbeats.length === 0) {
      logger.warn('No recent heartbeat data found');
    } else {
      heartbeats.forEach((hb, index) => {
        const success_rate = hb.processed_count > 0 ? 
          (100 * hb.success_count / hb.processed_count).toFixed(1) : 
          'N/A';
        console.log(`  ${index + 1}. ${hb.created_at} - ${hb.status}`);
        console.log(`     Processed: ${hb.processed_count}, Success: ${hb.success_count}, Errors: ${hb.error_count}`);
        console.log(`     Success Rate: ${success_rate}%`);
      });
    }
    console.log();

    // Check settlement candidates
    logger.info('🎯 Current Settlement Status:');
    const candidates = await getSettlementCandidates();
    console.log(`  Unsettled Candidates: ${candidates}`);
    
    const recent_settlements = await getRecentSettlements(3);
    if (recent_settlements.length > 0) {
      console.log(`  Recent Settlements:`);
      recent_settlements.forEach((settlement, index) => {
        console.log(`    ${index + 1}. ${settlement.player} - ${settlement.market} (${settlement.status})`);
        console.log(`       Line: ${settlement.line}, Actual: ${settlement.actual_result}`);
        console.log(`       Settled: ${settlement.settled_at}, Source: ${settlement.settlement_source}`);
      });
    }
    console.log();

    // Performance metrics
    logger.info('📈 Performance Metrics:');
    const metrics_24h = await calculatePerformanceMetrics(24);
    const metrics_7d = await calculatePerformanceMetrics(168); // 7 days
    
    console.log(`  Last 24 Hours:`);
    console.log(`    Runs: ${metrics_24h.runs_count}`);
    console.log(`    Processed: ${metrics_24h.total_processed}`);
    console.log(`    Success Rate: ${metrics_24h.success_rate}%`);
    console.log(`    Error Count: ${metrics_24h.total_errors}`);
    
    console.log(`  Last 7 Days:`);
    console.log(`    Runs: ${metrics_7d.runs_count}`);
    console.log(`    Processed: ${metrics_7d.total_processed}`);
    console.log(`    Success Rate: ${metrics_7d.success_rate}%`);
    console.log(`    Error Count: ${metrics_7d.total_errors}`);
    console.log();

    // External API health
    logger.info('🌐 External API Health:');
    const api_health = await testExternalAPIs();
    Object.entries(api_health).forEach(([api, health]: [string, any]) => {
      const status_icon = health.status === 'healthy' ? '✅' : '❌';
      console.log(`  ${api}: ${status_icon} ${health.status}`);
      if (health.response_time > 0) {
        console.log(`    Response Time: ${health.response_time}ms`);
      }
      if (health.error) {
        console.log(`    Error: ${health.error}`);
      }
    });
    console.log();

    // Health assessment
    logger.info('🏥 Overall Health Assessment:');
    const health_indicators = [];
    
    // Check if we have recent activity
    if (heartbeats.length > 0) {
      const latest_heartbeat = new Date(heartbeats[0].created_at);
      const hours_since = (Date.now() - latest_heartbeat.getTime()) / (1000 * 60 * 60);
      if (hours_since < 24) {
        health_indicators.push('✅ Recent settlement activity detected');
      } else {
        health_indicators.push('⚠️ No settlement activity in last 24 hours');
      }
    } else {
      health_indicators.push('❌ No heartbeat data available');
    }

    // Check success rates
    if (metrics_24h.success_rate >= 95) {
      health_indicators.push('✅ Excellent success rate (≥95%)');
    } else if (metrics_24h.success_rate >= 90) {
      health_indicators.push('⚠️ Good success rate (90-95%)');
    } else if (metrics_24h.total_processed > 0) {
      health_indicators.push('❌ Low success rate (<90%)');
    } else {
      health_indicators.push('ℹ️ No recent processing data');
    }

    // Check external APIs
    if (api_health.mlb_stats_api.status === 'healthy') {
      health_indicators.push('✅ External APIs accessible');
    } else {
      health_indicators.push('❌ External API issues detected');
    }

    // Check settlement candidates
    if (candidates > 0) {
      health_indicators.push(`ℹ️ ${candidates} settlement candidates available`);
    } else {
      health_indicators.push('ℹ️ No pending settlement candidates');
    }

    health_indicators.forEach(indicator => console.log(`  ${indicator}`));
    console.log();

    // Recommendations
    logger.info('💡 Recommendations:');
    const recommendations = [];

    if (candidates > 10) {
      recommendations.push('Consider running settlement backfill to process pending candidates');
    }
    
    if (metrics_24h.success_rate < 95 && metrics_24h.total_processed > 0) {
      recommendations.push('Investigate recent settlement failures for improvement opportunities');
    }

    if (api_health.mlb_stats_api.status !== 'healthy') {
      recommendations.push('Check MLB Stats API connectivity and consider retry logic');
    }

    if (heartbeats.length === 0) {
      recommendations.push('Initialize settlement system with test run to establish baseline');
    }

    if (recommendations.length === 0) {
      recommendations.push('Settlement system appears healthy - continue monitoring');
    }

    recommendations.forEach(rec => console.log(`  • ${rec}`));

  } catch (error: any) {
    logger.error('Health monitoring failed:', error.message);
    process.exit(1);
  }

  const duration = Date.now() - startTime;
  logger.info(`Settlement health monitoring complete (${duration}ms)`);
}

// Handle script execution
if (require.main === module) {
  main().catch(error => {
    logger.error('Script failed:', error);
    process.exit(1);
  });
}

export { main as monitorSettlementHealth };