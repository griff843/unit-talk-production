/**
 * 7-Day Rolling Trend Analysis
 * Date: 2025-10-30
 * Charter: v3.0
 * 
 * Analyzes trends over 7-day rolling window:
 * - Publish lag (p95)
 * - API response time (p95)
 * - Error rate
 * - Agent health score
 * 
 * Outputs:
 * - JSON trend data
 * - ASCII chart visualization
 * - Anomaly detection alerts
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================================================
// TREND ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Load historical validation results from last 7 days
 */
async function loadHistoricalResults() {
  const nightlyDir = path.join(process.cwd(), 'out/ops/cutover/metrics/nightly');
  
  if (!fs.existsSync(nightlyDir)) {
    return [];
  }

  const files = fs.readdirSync(nightlyDir)
    .filter(f => f.startsWith('NIGHTLY_STATUS_') && f.endsWith('.json'))
    .sort()
    .reverse()
    .slice(0, 7); // Last 7 days

  const results = [];
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(nightlyDir, file), 'utf8');
      const data = JSON.parse(content);
      results.push(data);
    } catch (error) {
      console.warn(`⚠️  Failed to load ${file}:`, error.message);
    }
  }

  return results.reverse(); // Chronological order
}

/**
 * Calculate publish lag trend
 */
function calculatePublishLagTrend(historicalResults) {
  const trend = historicalResults.map(result => {
    const publishLag = result.validations?.publish_lag;
    return {
      date: result.date,
      timestamp: result.timestamp,
      p95_seconds: publishLag?.metrics?.p95_seconds || null,
      avg_seconds: publishLag?.metrics?.avg_seconds || null,
      max_seconds: publishLag?.metrics?.max_seconds || null,
      slo_met: publishLag?.metrics?.slo_met || false,
      status: publishLag?.status || 'UNKNOWN'
    };
  });

  // Calculate statistics
  const validP95s = trend.filter(t => t.p95_seconds !== null).map(t => t.p95_seconds);
  const stats = {
    min: validP95s.length > 0 ? Math.min(...validP95s) : null,
    max: validP95s.length > 0 ? Math.max(...validP95s) : null,
    avg: validP95s.length > 0 ? validP95s.reduce((a, b) => a + b, 0) / validP95s.length : null,
    trend_direction: calculateTrendDirection(validP95s),
    slo_compliance_rate: trend.filter(t => t.slo_met).length / trend.length
  };

  return { trend, stats };
}

/**
 * Calculate error rate trend from agent health
 */
function calculateErrorRateTrend(historicalResults) {
  const trend = historicalResults.map(result => {
    const alertStatus = result.validations?.alert_status;
    return {
      date: result.date,
      timestamp: result.timestamp,
      unhealthy_count: alertStatus?.unhealthy_count || 0,
      total_agents: alertStatus?.total_agents || 0,
      error_rate: alertStatus?.total_agents > 0 
        ? alertStatus.unhealthy_count / alertStatus.total_agents 
        : 0,
      status: alertStatus?.status || 'UNKNOWN'
    };
  });

  const errorRates = trend.map(t => t.error_rate);
  const stats = {
    min: Math.min(...errorRates),
    max: Math.max(...errorRates),
    avg: errorRates.reduce((a, b) => a + b, 0) / errorRates.length,
    trend_direction: calculateTrendDirection(errorRates)
  };

  return { trend, stats };
}

/**
 * Calculate overall system health trend
 */
function calculateSystemHealthTrend(historicalResults) {
  const trend = historicalResults.map(result => {
    const statusScore = {
      'PASS': 100,
      'WARN': 50,
      'FAIL': 0
    };

    return {
      date: result.date,
      timestamp: result.timestamp,
      overall_status: result.overall_status,
      health_score: statusScore[result.overall_status] || 0,
      validations_passed: Object.values(result.validations || {})
        .filter(v => v.status === 'PASS').length,
      validations_total: Object.keys(result.validations || {}).length
    };
  });

  const healthScores = trend.map(t => t.health_score);
  const stats = {
    min: Math.min(...healthScores),
    max: Math.max(...healthScores),
    avg: healthScores.reduce((a, b) => a + b, 0) / healthScores.length,
    trend_direction: calculateTrendDirection(healthScores),
    pass_rate: trend.filter(t => t.overall_status === 'PASS').length / trend.length
  };

  return { trend, stats };
}

/**
 * Determine trend direction (improving, stable, declining)
 */
function calculateTrendDirection(values) {
  if (values.length < 2) return 'insufficient_data';

  const recentAvg = values.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, values.length);
  const olderAvg = values.slice(0, -3).reduce((a, b) => a + b, 0) / Math.max(1, values.length - 3);

  const change = ((recentAvg - olderAvg) / olderAvg) * 100;

  if (Math.abs(change) < 5) return 'stable';
  return change > 0 ? 'increasing' : 'decreasing';
}

/**
 * Generate ASCII chart for visualization
 */
function generateASCIIChart(data, title, maxWidth = 60) {
  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  let chart = `\n${title}\n${'='.repeat(maxWidth)}\n`;

  for (let i = 0; i < data.length; i++) {
    const normalized = ((values[i] - min) / range) * (maxWidth - 20);
    const bar = '█'.repeat(Math.floor(normalized));
    chart += `${data[i].label.padEnd(12)} | ${bar} ${values[i].toFixed(2)}\n`;
  }

  chart += `${'='.repeat(maxWidth)}\n`;
  return chart;
}

/**
 * Detect anomalies using statistical analysis
 */
function detectAnomalies(values, sensitivity = 2.0) {
  if (values.length < 3) return [];

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  const anomalies = [];
  values.forEach((value, index) => {
    const zScore = Math.abs((value - mean) / stdDev);
    if (zScore > sensitivity) {
      anomalies.push({
        index,
        value,
        zScore: zScore.toFixed(2),
        type: value > mean ? 'spike' : 'drop'
      });
    }
  });

  return anomalies;
}

/**
 * Main trend analysis function
 */
async function analyzeTrends() {
  console.log('============================================================================');
  console.log('7-DAY ROLLING TREND ANALYSIS - Charter v3.0');
  console.log('============================================================================\n');

  const historicalResults = await loadHistoricalResults();

  if (historicalResults.length === 0) {
    console.log('⚠️  No historical data available for trend analysis');
    return null;
  }

  console.log(`📊 Analyzing ${historicalResults.length} days of data\n`);

  // Calculate trends
  const publishLagTrend = calculatePublishLagTrend(historicalResults);
  const errorRateTrend = calculateErrorRateTrend(historicalResults);
  const systemHealthTrend = calculateSystemHealthTrend(historicalResults);

  // Detect anomalies
  const publishLagAnomalies = detectAnomalies(
    publishLagTrend.trend.filter(t => t.p95_seconds !== null).map(t => t.p95_seconds)
  );
  const errorRateAnomalies = detectAnomalies(errorRateTrend.trend.map(t => t.error_rate));

  const analysis = {
    timestamp: new Date().toISOString(),
    period_days: historicalResults.length,
    date_range: {
      start: historicalResults[0]?.date,
      end: historicalResults[historicalResults.length - 1]?.date
    },
    trends: {
      publish_lag: publishLagTrend,
      error_rate: errorRateTrend,
      system_health: systemHealthTrend
    },
    anomalies: {
      publish_lag: publishLagAnomalies,
      error_rate: errorRateAnomalies
    }
  };

  // Generate charts
  const publishLagChart = generateASCIIChart(
    publishLagTrend.trend.filter(t => t.p95_seconds !== null).map(t => ({
      label: t.date,
      value: t.p95_seconds
    })),
    'Publish Lag P95 (seconds)'
  );

  const healthScoreChart = generateASCIIChart(
    systemHealthTrend.trend.map(t => ({
      label: t.date,
      value: t.health_score
    })),
    'System Health Score'
  );

  console.log(publishLagChart);
  console.log(healthScoreChart);

  // Print summary
  console.log('\n📈 TREND SUMMARY');
  console.log('============================================================================');
  console.log(`Publish Lag P95:     ${publishLagTrend.stats.trend_direction.toUpperCase()}`);
  console.log(`  - Avg: ${publishLagTrend.stats.avg?.toFixed(2)}s`);
  console.log(`  - SLO Compliance: ${(publishLagTrend.stats.slo_compliance_rate * 100).toFixed(1)}%`);
  console.log(`\nError Rate:          ${errorRateTrend.stats.trend_direction.toUpperCase()}`);
  console.log(`  - Avg: ${(errorRateTrend.stats.avg * 100).toFixed(2)}%`);
  console.log(`\nSystem Health:       ${systemHealthTrend.stats.trend_direction.toUpperCase()}`);
  console.log(`  - Pass Rate: ${(systemHealthTrend.stats.pass_rate * 100).toFixed(1)}%`);
  console.log('');

  if (publishLagAnomalies.length > 0 || errorRateAnomalies.length > 0) {
    console.log('🚨 ANOMALIES DETECTED');
    console.log('============================================================================');
    if (publishLagAnomalies.length > 0) {
      console.log(`Publish Lag: ${publishLagAnomalies.length} anomalies`);
    }
    if (errorRateAnomalies.length > 0) {
      console.log(`Error Rate: ${errorRateAnomalies.length} anomalies`);
    }
    console.log('');
  }

  // Save results
  const nightlyDir = path.join(process.cwd(), 'out/ops/cutover/metrics/nightly');
  fs.mkdirSync(nightlyDir, { recursive: true });

  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const trendPath = path.join(nightlyDir, `TREND_ANALYSIS_${dateStr}.json`);
  
  fs.writeFileSync(trendPath, JSON.stringify(analysis, null, 2));
  console.log(`📄 Trend Analysis: ${trendPath}\n`);

  return analysis;
}

// ============================================================================
// RUN
// ============================================================================

if (require.main === module) {
  analyzeTrends()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { analyzeTrends, detectAnomalies };

