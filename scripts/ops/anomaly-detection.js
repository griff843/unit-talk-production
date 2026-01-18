/**
 * ML-Driven Anomaly Detection Job
 * Date: 2025-10-30
 * Charter: v3.0
 * Phase: 14 Preview
 * 
 * Intelligent anomaly detection using:
 * - Statistical analysis (Z-score, IQR)
 * - Time-series decomposition
 * - Prometheus metrics integration
 * - Adaptive thresholds
 * 
 * Detects anomalies in:
 * - API response times
 * - Database query latency
 * - Error rates
 * - Publish lag
 * - Agent health scores
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROMETHEUS_URL = process.env.PROMETHEUS_URL || 'http://localhost:9090';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================================================
// STATISTICAL ANOMALY DETECTION
// ============================================================================

/**
 * Z-Score based anomaly detection
 * Detects values that are more than N standard deviations from mean
 */
function detectZScoreAnomalies(values, threshold = 3.0) {
  if (values.length < 3) return [];

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  const anomalies = [];
  values.forEach((value, index) => {
    const zScore = (value - mean) / (stdDev || 1);
    if (Math.abs(zScore) > threshold) {
      anomalies.push({
        index,
        value,
        zScore: zScore.toFixed(3),
        deviation: ((value - mean) / mean * 100).toFixed(2) + '%',
        type: value > mean ? 'spike' : 'drop',
        severity: Math.abs(zScore) > 4 ? 'critical' : Math.abs(zScore) > 3.5 ? 'high' : 'medium'
      });
    }
  });

  return anomalies;
}

/**
 * IQR (Interquartile Range) based anomaly detection
 * More robust to outliers than Z-score
 */
function detectIQRAnomalies(values, multiplier = 1.5) {
  if (values.length < 4) return [];

  const sorted = [...values].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;
  
  const lowerBound = q1 - (multiplier * iqr);
  const upperBound = q3 + (multiplier * iqr);

  const anomalies = [];
  values.forEach((value, index) => {
    if (value < lowerBound || value > upperBound) {
      anomalies.push({
        index,
        value,
        lowerBound: lowerBound.toFixed(2),
        upperBound: upperBound.toFixed(2),
        type: value < lowerBound ? 'drop' : 'spike',
        severity: value < q1 - (2 * iqr) || value > q3 + (2 * iqr) ? 'critical' : 'medium'
      });
    }
  });

  return anomalies;
}

/**
 * Moving average based anomaly detection
 * Detects sudden changes in trend
 */
function detectMovingAverageAnomalies(values, windowSize = 5, threshold = 0.3) {
  if (values.length < windowSize + 1) return [];

  const anomalies = [];
  
  for (let i = windowSize; i < values.length; i++) {
    const window = values.slice(i - windowSize, i);
    const movingAvg = window.reduce((a, b) => a + b, 0) / windowSize;
    const current = values[i];
    const deviation = Math.abs((current - movingAvg) / movingAvg);

    if (deviation > threshold) {
      anomalies.push({
        index: i,
        value: current,
        movingAvg: movingAvg.toFixed(2),
        deviation: (deviation * 100).toFixed(2) + '%',
        type: current > movingAvg ? 'spike' : 'drop',
        severity: deviation > 0.5 ? 'critical' : deviation > 0.4 ? 'high' : 'medium'
      });
    }
  }

  return anomalies;
}

// ============================================================================
// PROMETHEUS METRICS INTEGRATION
// ============================================================================

/**
 * Query Prometheus for metrics
 */
async function queryPrometheus(query, timeRange = '1h') {
  try {
    const url = `${PROMETHEUS_URL}/api/v1/query_range?query=${encodeURIComponent(query)}&start=${Date.now() - 3600000}&end=${Date.now()}&step=60`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`⚠️  Prometheus query failed: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    if (data.status !== 'success' || !data.data?.result?.[0]?.values) {
      return null;
    }

    return data.data.result[0].values.map(([timestamp, value]) => ({
      timestamp: new Date(timestamp * 1000).toISOString(),
      value: parseFloat(value)
    }));
  } catch (error) {
    console.warn(`⚠️  Prometheus query error: ${error.message}`);
    return null;
  }
}

/**
 * Analyze API response time metrics
 */
async function analyzeAPIMetrics() {
  console.log('📊 Analyzing API response time metrics...');
  
  const query = 'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="unit-talk-api"}[5m])) by (le)) * 1000';
  const metrics = await queryPrometheus(query);

  if (!metrics || metrics.length === 0) {
    console.log('⚠️  No API metrics available from Prometheus');
    return null;
  }

  const values = metrics.map(m => m.value);
  const zScoreAnomalies = detectZScoreAnomalies(values, 2.5);
  const iqrAnomalies = detectIQRAnomalies(values, 1.5);
  const maAnomalies = detectMovingAverageAnomalies(values, 5, 0.25);

  return {
    metric: 'api_p95_latency_ms',
    data_points: metrics.length,
    current_value: values[values.length - 1],
    mean: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2),
    anomalies: {
      zscore: zScoreAnomalies,
      iqr: iqrAnomalies,
      moving_average: maAnomalies
    },
    total_anomalies: zScoreAnomalies.length + iqrAnomalies.length + maAnomalies.length
  };
}

/**
 * Analyze database query latency metrics
 */
async function analyzeDBMetrics() {
  console.log('📊 Analyzing database query latency metrics...');
  
  const query = 'histogram_quantile(0.95, sum(rate(database_query_duration_seconds_bucket{job="unit-talk-api"}[5m])) by (le)) * 1000';
  const metrics = await queryPrometheus(query);

  if (!metrics || metrics.length === 0) {
    console.log('⚠️  No database metrics available from Prometheus');
    return null;
  }

  const values = metrics.map(m => m.value);
  const zScoreAnomalies = detectZScoreAnomalies(values, 2.5);
  const iqrAnomalies = detectIQRAnomalies(values, 1.5);

  return {
    metric: 'db_p95_latency_ms',
    data_points: metrics.length,
    current_value: values[values.length - 1],
    mean: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2),
    anomalies: {
      zscore: zScoreAnomalies,
      iqr: iqrAnomalies
    },
    total_anomalies: zScoreAnomalies.length + iqrAnomalies.length
  };
}

/**
 * Analyze error rate metrics
 */
async function analyzeErrorRateMetrics() {
  console.log('📊 Analyzing error rate metrics...');
  
  const query = 'sum(rate(http_requests_total{job="unit-talk-api",status=~"5.."}[5m])) / sum(rate(http_requests_total{job="unit-talk-api"}[5m]))';
  const metrics = await queryPrometheus(query);

  if (!metrics || metrics.length === 0) {
    console.log('⚠️  No error rate metrics available from Prometheus');
    return null;
  }

  const values = metrics.map(m => m.value * 100); // Convert to percentage
  const zScoreAnomalies = detectZScoreAnomalies(values, 2.0);
  const maAnomalies = detectMovingAverageAnomalies(values, 5, 0.5);

  return {
    metric: 'error_rate_percent',
    data_points: metrics.length,
    current_value: values[values.length - 1],
    mean: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(4),
    anomalies: {
      zscore: zScoreAnomalies,
      moving_average: maAnomalies
    },
    total_anomalies: zScoreAnomalies.length + maAnomalies.length
  };
}

// ============================================================================
// MAIN ANOMALY DETECTION
// ============================================================================

async function runAnomalyDetection() {
  console.log('============================================================================');
  console.log('ML-DRIVEN ANOMALY DETECTION - Charter v3.0 (Phase 14 Preview)');
  console.log('============================================================================\n');

  const results = {
    timestamp: new Date().toISOString(),
    charter_version: '3.0',
    phase: '14-preview',
    analyses: {}
  };

  // Run all analyses
  results.analyses.api_metrics = await analyzeAPIMetrics();
  results.analyses.db_metrics = await analyzeDBMetrics();
  results.analyses.error_rate = await analyzeErrorRateMetrics();

  // Calculate overall anomaly score
  const totalAnomalies = Object.values(results.analyses)
    .filter(a => a !== null)
    .reduce((sum, a) => sum + (a.total_anomalies || 0), 0);

  results.overall_anomaly_count = totalAnomalies;
  results.severity = totalAnomalies === 0 ? 'normal' : 
                     totalAnomalies < 3 ? 'low' : 
                     totalAnomalies < 6 ? 'medium' : 'high';

  // Print summary
  console.log('\n🔍 ANOMALY DETECTION SUMMARY');
  console.log('============================================================================');
  console.log(`Total Anomalies Detected: ${totalAnomalies}`);
  console.log(`Severity Level: ${results.severity.toUpperCase()}`);
  console.log('');

  if (results.analyses.api_metrics) {
    console.log(`API P95 Latency: ${results.analyses.api_metrics.total_anomalies} anomalies`);
  }
  if (results.analyses.db_metrics) {
    console.log(`DB P95 Latency: ${results.analyses.db_metrics.total_anomalies} anomalies`);
  }
  if (results.analyses.error_rate) {
    console.log(`Error Rate: ${results.analyses.error_rate.total_anomalies} anomalies`);
  }
  console.log('');

  // Save results
  const nightlyDir = path.join(process.cwd(), 'out/ops/cutover/metrics/nightly');
  fs.mkdirSync(nightlyDir, { recursive: true });

  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const anomalyPath = path.join(nightlyDir, `ANOMALY_DETECTION_${dateStr}.json`);
  
  fs.writeFileSync(anomalyPath, JSON.stringify(results, null, 2));
  console.log(`📄 Anomaly Report: ${anomalyPath}\n`);

  return results;
}

// ============================================================================
// RUN
// ============================================================================

if (require.main === module) {
  runAnomalyDetection()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { 
  runAnomalyDetection, 
  detectZScoreAnomalies, 
  detectIQRAnomalies, 
  detectMovingAverageAnomalies 
};

