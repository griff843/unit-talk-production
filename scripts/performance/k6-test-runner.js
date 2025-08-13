/**
 * K6 Performance Test Runner - Advanced load testing with SLA enforcement
 * Integrates with performance budgets database for comprehensive monitoring
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// Custom metrics for detailed monitoring
const errorRate = new Rate('error_rate');
const responseTime = new Trend('response_time');
const requestsPerSecond = new Rate('requests_per_second');
const concurrentUsers = new Gauge('concurrent_users');
const slaViolations = new Counter('sla_violations');
const businessMetrics = new Counter('business_metrics');

// Configuration from environment variables or defaults
const config = {
  baseUrl: __ENV.BASE_URL || 'http://localhost:3000',
  environment: __ENV.ENVIRONMENT || 'test',
  testType: __ENV.TEST_TYPE || 'load',
  testSuite: __ENV.TEST_SUITE || 'api',
  virtualUsers: parseInt(__ENV.VIRTUAL_USERS) || 10,
  duration: __ENV.DURATION || '60s',
  rampUpTime: __ENV.RAMP_UP_TIME || '30s',
  slaResponseTime: parseInt(__ENV.SLA_RESPONSE_TIME) || 1000,
  slaErrorRate: parseFloat(__ENV.SLA_ERROR_RATE) || 5.0,
  slaThroughput: parseFloat(__ENV.SLA_THROUGHPUT) || 10.0,
  enableRealTimeReporting: __ENV.ENABLE_REALTIME === 'true',
  dbReporting: __ENV.DB_REPORTING === 'true'
};

// Test scenarios based on test type
const scenarios = {
  load: {
    executor: 'ramping-vus',
    startVUs: 1,
    stages: [
      { duration: config.rampUpTime, target: config.virtualUsers },
      { duration: config.duration, target: config.virtualUsers },
      { duration: '30s', target: 0 }
    ],
    gracefulRampDown: '30s'
  },
  stress: {
    executor: 'ramping-vus',
    startVUs: 1,
    stages: [
      { duration: '10s', target: config.virtualUsers },
      { duration: '30s', target: config.virtualUsers * 2 },
      { duration: '30s', target: config.virtualUsers * 4 },
      { duration: '30s', target: config.virtualUsers * 2 },
      { duration: '30s', target: config.virtualUsers },
      { duration: '30s', target: 0 }
    ]
  },
  spike: {
    executor: 'ramping-vus',
    startVUs: 1,
    stages: [
      { duration: '30s', target: config.virtualUsers },
      { duration: '10s', target: config.virtualUsers * 10 },
      { duration: '30s', target: config.virtualUsers },
      { duration: '30s', target: 0 }
    ]
  },
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '30s'
  },
  endurance: {
    executor: 'constant-vus',
    vus: config.virtualUsers,
    duration: '30m'
  }
};

// Export configuration for k6
export let options = {
  scenarios: {
    [config.testType]: scenarios[config.testType] || scenarios.load
  },
  thresholds: {
    'http_req_duration': [`p(95)<${config.slaResponseTime}`],
    'http_req_failed': [`rate<${config.slaErrorRate / 100}`],
    'http_reqs': [`rate>${config.slaThroughput}`],
    'error_rate': [`rate<${config.slaErrorRate / 100}`],
    'response_time': [`p(95)<${config.slaResponseTime}`, `p(99)<${config.slaResponseTime * 2}`],
    'sla_violations': ['count<10'] // Allow max 10 SLA violations
  },
  tags: {
    testType: config.testType,
    environment: config.environment,
    testSuite: config.testSuite
  }
};

// Test data and utilities
class PerformanceReporter {
  constructor() {
    this.testId = null;
    this.startTime = Date.now();
    this.violations = [];
  }

  async initialize() {
    if (!config.dbReporting) return;

    try {
      const response = await http.post(`${config.baseUrl}/api/performance/tests`, JSON.stringify({
        test_name: `${config.testType}_${Date.now()}`,
        test_type: config.testType,
        test_suite: config.testSuite,
        target_endpoint: config.baseUrl,
        virtual_users: config.virtualUsers,
        duration_seconds: this.parseDuration(config.duration),
        environment: config.environment
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.status === 200) {
        this.testId = response.json().test_id;
        console.log(`Performance test initialized: ${this.testId}`);
      }
    } catch (error) {
      console.warn(`Failed to initialize performance test: ${error.message}`);
    }
  }

  async recordMetric(name, type, value, unit = '', tags = {}) {
    if (!config.dbReporting || !this.testId) return;

    try {
      await http.post(`${config.baseUrl}/api/performance/metrics`, JSON.stringify({
        test_id: this.testId,
        metric_name: name,
        metric_type: type,
        value: value,
        unit: unit,
        tags: tags,
        timestamp_ms: Date.now()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.warn(`Failed to record metric ${name}: ${error.message}`);
    }
  }

  recordSLAViolation(type, threshold, actual, metric) {
    this.violations.push({
      type: type,
      threshold: threshold,
      actual: actual,
      metric: metric,
      timestamp: Date.now()
    });
    slaViolations.add(1);
  }

  async finalize(summary) {
    if (!config.dbReporting || !this.testId) return;

    const totalRequests = summary.metrics.http_reqs?.values?.count || 0;
    const failedRequests = summary.metrics.http_req_failed?.values?.count || 0;
    const successfulRequests = totalRequests - failedRequests;
    const avgResponseTime = summary.metrics.http_req_duration?.values?.avg || 0;
    const p95ResponseTime = summary.metrics.http_req_duration?.values['p(95)'] || 0;
    const p99ResponseTime = summary.metrics.http_req_duration?.values['p(99)'] || 0;
    const maxResponseTime = summary.metrics.http_req_duration?.values?.max || 0;
    const requestsPerSecond = summary.metrics.http_reqs?.values?.rate || 0;

    try {
      await http.post(`${config.baseUrl}/api/performance/tests/${this.testId}/complete`, JSON.stringify({
        total_requests: totalRequests,
        successful_requests: successfulRequests,
        failed_requests: failedRequests,
        avg_response_time_ms: avgResponseTime,
        p95_response_time_ms: p95ResponseTime,
        p99_response_time_ms: p99ResponseTime,
        max_response_time_ms: maxResponseTime,
        requests_per_second: requestsPerSecond
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

      console.log(`Performance test completed: ${this.testId}`);
      console.log(`SLA Violations: ${this.violations.length}`);
    } catch (error) {
      console.warn(`Failed to complete performance test: ${error.message}`);
    }
  }

  parseDuration(duration) {
    const match = duration.match(/(\d+)([smh])/);
    if (!match) return 60; // default 60 seconds

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      default: return 60;
    }
  }
}

// Global reporter instance
const reporter = new PerformanceReporter();

// Test endpoints configuration
const endpoints = {
  api: [
    { method: 'GET', url: '/api/health', weight: 10, name: 'health_check' },
    { method: 'GET', url: '/api/picks', weight: 30, name: 'get_picks' },
    { method: 'GET', url: '/api/users/profile', weight: 20, name: 'get_profile' },
    { method: 'POST', url: '/api/picks', weight: 25, name: 'create_pick', body: { bet_type: 'over', line: 225.5, odds: -110 } },
    { method: 'GET', url: '/api/metrics/dashboard', weight: 15, name: 'dashboard_metrics' }
  ],
  discord: [
    { method: 'POST', url: '/webhook/discord', weight: 50, name: 'discord_webhook', body: { content: 'Test message' } },
    { method: 'GET', url: '/api/discord/status', weight: 30, name: 'discord_status' },
    { method: 'POST', url: '/api/discord/alert', weight: 20, name: 'discord_alert', body: { type: 'pick_alert', message: 'New pick available' } }
  ],
  dashboard: [
    { method: 'GET', url: '/', weight: 30, name: 'homepage' },
    { method: 'GET', url: '/dashboard', weight: 25, name: 'dashboard' },
    { method: 'GET', url: '/picks', weight: 25, name: 'picks_page' },
    { method: 'GET', url: '/profile', weight: 20, name: 'profile_page' }
  ]
};

// Setup function - runs once before tests
export function setup() {
  console.log('='.repeat(80));
  console.log(`🚀 Starting ${config.testType.toUpperCase()} test`);
  console.log(`📊 Target: ${config.baseUrl} (${config.environment})`);
  console.log(`👥 Virtual Users: ${config.virtualUsers}`);
  console.log(`⏱️  Duration: ${config.duration}`);
  console.log(`📈 SLA Thresholds: ${config.slaResponseTime}ms, ${config.slaErrorRate}% errors, ${config.slaThroughput} RPS`);
  console.log('='.repeat(80));

  // Initialize performance reporter
  reporter.initialize();

  // Verify base URL is accessible
  const healthCheck = http.get(`${config.baseUrl}/api/health`);
  if (healthCheck.status !== 200) {
    console.error(`❌ Health check failed: ${healthCheck.status}`);
    throw new Error(`Service unavailable: ${config.baseUrl}`);
  }

  console.log('✅ Service health check passed');
  return { reporter: reporter };
}

// Main test function - runs for each virtual user
export default function(data) {
  const testEndpoints = endpoints[config.testSuite] || endpoints.api;
  
  // Select endpoint based on weight
  const endpoint = selectWeightedEndpoint(testEndpoints);
  const url = `${config.baseUrl}${endpoint.url}`;
  
  // Track concurrent users
  concurrentUsers.add(1);

  // Make HTTP request
  const startTime = Date.now();
  let response;

  try {
    const params = {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `k6-performance-test/${config.testType}`,
        'X-Test-ID': data.reporter?.testId || 'unknown',
        'X-Environment': config.environment
      },
      tags: {
        endpoint: endpoint.name,
        method: endpoint.method,
        test_type: config.testType
      },
      timeout: `${config.slaResponseTime * 2}ms` // 2x SLA as timeout
    };

    if (endpoint.method === 'POST') {
      response = http.post(url, JSON.stringify(endpoint.body || {}), params);
    } else if (endpoint.method === 'PUT') {
      response = http.put(url, JSON.stringify(endpoint.body || {}), params);
    } else if (endpoint.method === 'DELETE') {
      response = http.del(url, null, params);
    } else {
      response = http.get(url, params);
    }

    const duration = Date.now() - startTime;

    // Record metrics
    responseTime.add(duration, { endpoint: endpoint.name });
    requestsPerSecond.add(1);

    // Check response and SLA compliance
    const success = check(response, {
      'status is 200-299': (r) => r.status >= 200 && r.status < 300,
      'response time < SLA': (r) => duration < config.slaResponseTime,
      'no server errors': (r) => r.status < 500,
      'response has content': (r) => r.body && r.body.length > 0
    }, { endpoint: endpoint.name });

    // Record error rate
    if (!success || response.status >= 400) {
      errorRate.add(1);
      
      // Record SLA violation
      if (duration >= config.slaResponseTime) {
        data.reporter?.recordSLAViolation('response_time', config.slaResponseTime, duration, 'response_time_ms');
      }
    } else {
      errorRate.add(0);
    }

    // Record business metrics for specific endpoints
    if (endpoint.name === 'create_pick' && response.status === 201) {
      businessMetrics.add(1, { metric: 'picks_created' });
    } else if (endpoint.name === 'get_picks' && response.status === 200) {
      try {
        const picks = JSON.parse(response.body);
        businessMetrics.add(picks.length || 0, { metric: 'picks_retrieved' });
      } catch (e) {
        // Ignore JSON parsing errors for business metrics
      }
    }

    // Real-time metric reporting
    if (config.enableRealTimeReporting && data.reporter) {
      data.reporter.recordMetric(`${endpoint.name}_response_time`, 'histogram', duration, 'ms', {
        endpoint: endpoint.name,
        method: endpoint.method,
        status_code: response.status
      });
    }

  } catch (error) {
    console.error(`Request failed: ${error.message}`);
    errorRate.add(1);
    data.reporter?.recordSLAViolation('availability', 100, 0, 'request_success_rate');
  } finally {
    concurrentUsers.add(-1);
  }

  // Think time between requests
  sleep(Math.random() * 2 + 0.5); // 0.5-2.5 seconds
}

// Teardown function - runs once after all tests
export function teardown(data) {
  console.log('🏁 Test execution completed');
  
  // The handleSummary function will be called after this
  // Final reporting happens there
}

// Custom summary handler for detailed reporting
export function handleSummary(data) {
  console.log('📊 Generating performance report...');

  // Finalize database reporting
  reporter.finalize(data);

  // Calculate additional metrics
  const totalRequests = data.metrics.http_reqs?.values?.count || 0;
  const failedRequests = data.metrics.http_req_failed?.values?.count || 0;
  const errorRatePercent = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;
  const avgResponseTime = data.metrics.http_req_duration?.values?.avg || 0;
  const p95ResponseTime = data.metrics.http_req_duration?.values['p(95)'] || 0;
  const throughput = data.metrics.http_reqs?.values?.rate || 0;

  // SLA Compliance Check
  const slaResults = {
    responseTime: p95ResponseTime < config.slaResponseTime,
    errorRate: errorRatePercent < config.slaErrorRate,
    throughput: throughput > config.slaThroughput,
    overall: true
  };
  slaResults.overall = slaResults.responseTime && slaResults.errorRate && slaResults.throughput;

  // Performance Summary
  const performanceSummary = `
${'='.repeat(80)}
🎯 PERFORMANCE TEST RESULTS
${'='.repeat(80)}

📋 Test Configuration:
   • Type: ${config.testType.toUpperCase()}
   • Suite: ${config.testSuite}
   • Environment: ${config.environment}
   • Virtual Users: ${config.virtualUsers}
   • Duration: ${config.duration}

📊 Key Metrics:
   • Total Requests: ${totalRequests.toLocaleString()}
   • Failed Requests: ${failedRequests.toLocaleString()} (${errorRatePercent.toFixed(2)}%)
   • Avg Response Time: ${avgResponseTime.toFixed(2)}ms
   • P95 Response Time: ${p95ResponseTime.toFixed(2)}ms
   • P99 Response Time: ${(data.metrics.http_req_duration?.values['p(99)'] || 0).toFixed(2)}ms
   • Throughput: ${throughput.toFixed(2)} RPS

🎯 SLA Compliance:
   • Response Time (< ${config.slaResponseTime}ms): ${slaResults.responseTime ? '✅ PASS' : '❌ FAIL'} (${p95ResponseTime.toFixed(2)}ms)
   • Error Rate (< ${config.slaErrorRate}%): ${slaResults.errorRate ? '✅ PASS' : '❌ FAIL'} (${errorRatePercent.toFixed(2)}%)
   • Throughput (> ${config.slaThroughput} RPS): ${slaResults.throughput ? '✅ PASS' : '❌ FAIL'} (${throughput.toFixed(2)} RPS)
   • Overall SLA Status: ${slaResults.overall ? '✅ PASSED' : '❌ FAILED'}

${'='.repeat(80)}
`;

  console.log(performanceSummary);

  // Return summary for different outputs
  return {
    'stdout': performanceSummary + textSummary(data, { indent: ' ', enableColors: true }),
    'summary.html': htmlReport(data),
    'summary.json': JSON.stringify({
      ...data,
      sla_results: slaResults,
      test_config: config,
      violations: reporter.violations
    }, null, 2)
  };
}

// Utility function to select endpoint based on weight
function selectWeightedEndpoint(endpoints) {
  const totalWeight = endpoints.reduce((sum, endpoint) => sum + endpoint.weight, 0);
  let random = Math.random() * totalWeight;

  for (const endpoint of endpoints) {
    random -= endpoint.weight;
    if (random <= 0) {
      return endpoint;
    }
  }

  return endpoints[0]; // Fallback
}

// Export for external usage
export { config, reporter };