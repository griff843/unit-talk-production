/**
 * k6 Load Testing Configuration for Unit Talk Platform
 * Phase 6 - Performance Execution & Hardening
 *
 * Tests: 1k → 10k RPS ramps with 15/30/60 minute durations
 * Metrics: P95/P99 latency, error-rate, queue depth, DB CPU/IO
 *
 * Note: k6 uses ES6 modules natively
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

// Custom metrics
const apiLatency = new Trend('api_latency');
const queueDepth = new Trend('queue_depth');
const errorRate = new Rate('error_rate');
const dbConnections = new Trend('db_connections');

// Environment configuration
const BASE_URL = __ENV.API_URL || 'http://localhost:3010';
const SUPABASE_URL = __ENV.SUPABASE_URL;
const SUPABASE_KEY = __ENV.SUPABASE_ANON_KEY;

// Test scenarios
export const scenarios = {
  // Ramp Test 1: 1k → 2k RPS (15 minutes)
  ramp_1k_2k: {
    executor: 'ramping-vus',
    startVUs: 50,
    stages: [
      { duration: '5m', target: 100 }, // Ramp up to 1k RPS
      { duration: '5m', target: 200 }, // Ramp to 2k RPS
      { duration: '5m', target: 0 }, // Ramp down
    ],
    gracefulRampDown: '30s',
    tags: { test_type: 'ramp_1k_2k' },
  },

  // Ramp Test 2: 2k → 5k RPS (30 minutes)
  ramp_2k_5k: {
    executor: 'ramping-vus',
    startVUs: 100,
    stages: [
      { duration: '10m', target: 200 }, // Ramp up to 2k RPS
      { duration: '10m', target: 500 }, // Ramp to 5k RPS
      { duration: '10m', target: 0 }, // Ramp down
    ],
    gracefulRampDown: '1m',
    tags: { test_type: 'ramp_2k_5k' },
  },

  // Ramp Test 3: 5k → 10k RPS (60 minutes)
  ramp_5k_10k: {
    executor: 'ramping-vus',
    startVUs: 250,
    stages: [
      { duration: '20m', target: 500 }, // Ramp up to 5k RPS
      { duration: '20m', target: 1000 }, // Ramp to 10k RPS
      { duration: '20m', target: 0 }, // Ramp down
    ],
    gracefulRampDown: '2m',
    tags: { test_type: 'ramp_5k_10k' },
  },

  // Soak Test: Sustained 5k RPS (2 hours)
  soak_5k: {
    executor: 'constant-vus',
    vus: 500,
    duration: '120m',
    gracefulStop: '2m',
    tags: { test_type: 'soak_5k' },
  },
};

// SLO thresholds
export const thresholds = {
  // API latency SLOs
  'http_req_duration{test_type:ramp_1k_2k}': [
    'p(95)<150', // P95 < 150ms
    'p(99)<400', // P99 < 400ms
  ],
  'http_req_duration{test_type:ramp_2k_5k}': ['p(95)<150', 'p(99)<400'],
  'http_req_duration{test_type:ramp_5k_10k}': [
    'p(95)<200', // Slightly relaxed for 10k RPS
    'p(99)<500',
  ],
  'http_req_duration{test_type:soak_5k}': ['p(95)<150', 'p(99)<400'],

  // Error rate SLO
  http_req_failed: ['rate<0.005'], // < 0.5% error rate

  // Request duration
  http_req_waiting: ['p(95)<100'], // Server processing time

  // Custom metrics
  api_latency: ['p(95)<150', 'p(99)<400'],
  error_rate: ['rate<0.005'],
  queue_depth: ['avg<500', 'p(95)<1000'],
};

// Test endpoints
const endpoints = [
  { path: '/api/health', weight: 5, method: 'GET' },
  { path: '/api/picks', weight: 30, method: 'GET' },
  { path: '/api/users/profile', weight: 20, method: 'GET' },
  { path: '/api/analytics/performance', weight: 15, method: 'GET' },
  { path: '/api/agents/status', weight: 10, method: 'GET' },
  { path: '/api/props/live', weight: 20, method: 'GET' },
];

// Weighted random endpoint selection
function selectEndpoint() {
  const totalWeight = endpoints.reduce((sum, ep) => sum + ep.weight, 0);
  let random = Math.random() * totalWeight;

  for (const endpoint of endpoints) {
    random -= endpoint.weight;
    if (random <= 0) {
      return endpoint;
    }
  }

  return endpoints[0];
}

// Main test function
export default function () {
  const endpoint = selectEndpoint();
  const url = `${BASE_URL}${endpoint.path}`;

  const params = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    tags: {
      endpoint: endpoint.path,
    },
  };

  // Execute request
  const startTime = Date.now();
  const response = http.get(url, params);
  const duration = Date.now() - startTime;

  // Record metrics
  apiLatency.add(duration);

  // Check response
  const success = check(response, {
    'status is 200': r => r.status === 200,
    'response time < 500ms': r => r.timings.duration < 500,
    'has valid JSON': r => {
      try {
        JSON.parse(r.body);
        return true;
      } catch (e) {
        return false;
      }
    },
  });

  if (!success) {
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }

  // Capture queue depth from response headers
  if (response.headers['X-Queue-Depth']) {
    queueDepth.add(parseInt(response.headers['X-Queue-Depth']));
  }

  // Capture DB connections from response headers
  if (response.headers['X-DB-Connections']) {
    dbConnections.add(parseInt(response.headers['X-DB-Connections']));
  }

  // Think time (simulate real user behavior)
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

// Setup function (runs once per VU)
export function setup() {
  console.log('🚀 Starting load test...');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Scenario: ${__ENV.K6_SCENARIO || 'default'}`);

  // Verify API is accessible
  const healthCheck = http.get(`${BASE_URL}/api/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`API health check failed: ${healthCheck.status}`);
  }

  console.log('✅ API health check passed');
  return { startTime: Date.now() };
}

// Teardown function (runs once after all VUs complete)
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`\n📊 Test completed in ${duration}s`);
  console.log('Check detailed metrics in the summary report');
}

// Handle summary (custom summary output)
export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  return {
    [`out/ops/perf/load-test-${timestamp}.json`]: JSON.stringify(data, null, 2),
    [`out/ops/perf/load-test-${timestamp}.html`]: htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

// Generate HTML report
function htmlReport(data) {
  const metrics = data.metrics;

  return `
<!DOCTYPE html>
<html>
<head>
  <title>Load Test Report - ${new Date().toISOString()}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #4CAF50; color: white; }
    .pass { color: green; font-weight: bold; }
    .fail { color: red; font-weight: bold; }
    .metric { margin: 10px 0; }
  </style>
</head>
<body>
  <h1>Load Test Report</h1>
  <p><strong>Date:</strong> ${new Date().toISOString()}</p>
  
  <h2>SLO Compliance</h2>
  <table>
    <tr>
      <th>Metric</th>
      <th>Target</th>
      <th>Actual</th>
      <th>Status</th>
    </tr>
    <tr>
      <td>P95 Latency</td>
      <td>≤ 150ms</td>
      <td>${metrics.http_req_duration?.values?.['p(95)']?.toFixed(2) || 'N/A'}ms</td>
      <td class="${(metrics.http_req_duration?.values?.['p(95)'] || 0) <= 150 ? 'pass' : 'fail'}">
        ${(metrics.http_req_duration?.values?.['p(95)'] || 0) <= 150 ? '✅ PASS' : '❌ FAIL'}
      </td>
    </tr>
    <tr>
      <td>P99 Latency</td>
      <td>≤ 400ms</td>
      <td>${metrics.http_req_duration?.values?.['p(99)']?.toFixed(2) || 'N/A'}ms</td>
      <td class="${(metrics.http_req_duration?.values?.['p(99)'] || 0) <= 400 ? 'pass' : 'fail'}">
        ${(metrics.http_req_duration?.values?.['p(99)'] || 0) <= 400 ? '✅ PASS' : '❌ FAIL'}
      </td>
    </tr>
    <tr>
      <td>Error Rate</td>
      <td>< 0.5%</td>
      <td>${((metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(3)}%</td>
      <td class="${(metrics.http_req_failed?.values?.rate || 0) < 0.005 ? 'pass' : 'fail'}">
        ${(metrics.http_req_failed?.values?.rate || 0) < 0.005 ? '✅ PASS' : '❌ FAIL'}
      </td>
    </tr>
  </table>
  
  <h2>Detailed Metrics</h2>
  <div class="metric">
    <strong>Total Requests:</strong> ${metrics.http_reqs?.values?.count || 0}
  </div>
  <div class="metric">
    <strong>Request Rate:</strong> ${metrics.http_reqs?.values?.rate?.toFixed(2) || 0} req/s
  </div>
  <div class="metric">
    <strong>Average Latency:</strong> ${metrics.http_req_duration?.values?.avg?.toFixed(2) || 0}ms
  </div>
  <div class="metric">
    <strong>Max Latency:</strong> ${metrics.http_req_duration?.values?.max?.toFixed(2) || 0}ms
  </div>
</body>
</html>
  `;
}

// Generate text summary
function textSummary(data, options) {
  const metrics = data.metrics;
  const indent = options.indent || '';

  let summary = `\n${indent}📊 Load Test Summary\n`;
  summary += `${indent}${'='.repeat(50)}\n\n`;

  summary += `${indent}SLO Compliance:\n`;
  summary += `${indent}  P95 Latency: ${metrics.http_req_duration?.values?.['p(95)']?.toFixed(2) || 'N/A'}ms (target: ≤150ms)\n`;
  summary += `${indent}  P99 Latency: ${metrics.http_req_duration?.values?.['p(99)']?.toFixed(2) || 'N/A'}ms (target: ≤400ms)\n`;
  summary += `${indent}  Error Rate: ${((metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(3)}% (target: <0.5%)\n\n`;

  summary += `${indent}Performance Metrics:\n`;
  summary += `${indent}  Total Requests: ${metrics.http_reqs?.values?.count || 0}\n`;
  summary += `${indent}  Request Rate: ${metrics.http_reqs?.values?.rate?.toFixed(2) || 0} req/s\n`;
  summary += `${indent}  Avg Latency: ${metrics.http_req_duration?.values?.avg?.toFixed(2) || 0}ms\n`;
  summary += `${indent}  Max Latency: ${metrics.http_req_duration?.values?.max?.toFixed(2) || 0}ms\n`;

  return summary;
}
