/**
 * K6 Load Testing Suite for Unit Talk Platform
 * Phase 13 - Performance and Reliability Hardening
 * Date: 2025-01-25
 * 
 * Test Scenarios:
 * 1. Ramp Test: 1k → 5k RPS over 10 minutes
 * 2. Soak Test: Sustained 2k RPS for 1 hour
 * 3. Spike Test: Sudden traffic spikes
 * 4. Stress Test: Find breaking point
 * 
 * SLO Targets:
 * - API p95 latency: < 150ms
 * - Error rate: < 0.5%
 * - Database p95 latency: < 50ms
 * - Uptime: 99.95%
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// Custom Metrics
const apiLatency = new Trend('api_latency', true);
const dbLatency = new Trend('db_latency', true);
const errorRate = new Rate('error_rate');
const queueDepth = new Gauge('queue_depth');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'https://api.unit-talk.com';
const API_KEY = __ENV.API_KEY || '';
const SCENARIO = __ENV.SCENARIO || 'ramp';

// Test Scenarios Configuration
export const options = {
  scenarios: {
    // Scenario 1: Ramp Test (1k → 5k RPS)
    ramp_test: {
      executor: 'ramping-arrival-rate',
      startRate: 1000,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 500,
      stages: [
        { duration: '2m', target: 1000 },  // Warm-up to 1k RPS
        { duration: '5m', target: 3000 },  // Ramp to 3k RPS
        { duration: '3m', target: 5000 },  // Peak at 5k RPS
        { duration: '2m', target: 2000 },  // Cool down to 2k RPS
        { duration: '1m', target: 0 },     // Graceful shutdown
      ],
      exec: 'apiLoadTest',
      tags: { scenario: 'ramp' },
      startTime: '0s',
    },

    // Scenario 2: Soak Test (1 hour sustained load)
    soak_test: {
      executor: 'constant-arrival-rate',
      rate: 2000,
      timeUnit: '1s',
      duration: '60m',
      preAllocatedVUs: 200,
      maxVUs: 400,
      exec: 'apiLoadTest',
      tags: { scenario: 'soak' },
      startTime: '15m', // Start after ramp test
    },

    // Scenario 3: Spike Test
    spike_test: {
      executor: 'ramping-arrival-rate',
      startRate: 1000,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 1000,
      stages: [
        { duration: '30s', target: 1000 },  // Baseline
        { duration: '10s', target: 10000 }, // Sudden spike
        { duration: '30s', target: 10000 }, // Sustain spike
        { duration: '10s', target: 1000 },  // Drop back
        { duration: '30s', target: 1000 },  // Recover
      ],
      exec: 'apiLoadTest',
      tags: { scenario: 'spike' },
      startTime: '80m', // Start after soak test
    },

    // Scenario 4: Stress Test (find breaking point)
    stress_test: {
      executor: 'ramping-arrival-rate',
      startRate: 1000,
      timeUnit: '1s',
      preAllocatedVUs: 200,
      maxVUs: 2000,
      stages: [
        { duration: '2m', target: 2000 },
        { duration: '2m', target: 4000 },
        { duration: '2m', target: 6000 },
        { duration: '2m', target: 8000 },
        { duration: '2m', target: 10000 },
        { duration: '5m', target: 10000 }, // Sustain max
        { duration: '2m', target: 0 },
      ],
      exec: 'apiLoadTest',
      tags: { scenario: 'stress' },
      startTime: '90m', // Start after spike test
    },
  },

  // Thresholds (SLO Enforcement)
  thresholds: {
    // API Latency SLO: p95 < 150ms
    'api_latency': ['p(95)<150', 'p(99)<500'],
    
    // Error Rate SLO: < 0.5%
    'error_rate': ['rate<0.005'],
    
    // Database Latency SLO: p95 < 50ms
    'db_latency': ['p(95)<50', 'p(99)<100'],
    
    // HTTP Request Duration
    'http_req_duration': ['p(95)<150', 'p(99)<500'],
    
    // HTTP Request Failed Rate
    'http_req_failed': ['rate<0.005'],
    
    // Checks (Success Rate)
    'checks': ['rate>0.995'],
  },

  // Tags for filtering
  tags: {
    environment: 'production',
    phase: 'phase13',
    test_type: 'performance',
  },
};

/**
 * Setup function - runs once before all scenarios
 */
export function setup() {
  console.log('🚀 Starting Phase 13 Performance Testing Suite');
  console.log(`📊 Base URL: ${BASE_URL}`);
  console.log(`🎯 SLO Targets: p95 < 150ms, Error Rate < 0.5%`);
  
  // Verify API is accessible
  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`API health check failed: ${healthCheck.status}`);
  }
  
  return {
    startTime: new Date().toISOString(),
    baseUrl: BASE_URL,
  };
}

/**
 * Main API Load Test Function
 */
export function apiLoadTest(data) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
    'X-Test-Run': 'phase13-perf',
  };

  group('API Endpoints', () => {
    // Test 1: Health Check (lightweight)
    group('Health Check', () => {
      const res = http.get(`${BASE_URL}/health`, { headers, tags: { endpoint: 'health' } });
      
      check(res, {
        'health check status 200': (r) => r.status === 200,
        'health check latency < 50ms': (r) => r.timings.duration < 50,
      });
      
      apiLatency.add(res.timings.duration);
      errorRate.add(res.status !== 200);
    });

    // Test 2: Picks API (read-heavy)
    group('Get Picks', () => {
      const res = http.get(`${BASE_URL}/api/picks?limit=20`, { headers, tags: { endpoint: 'picks' } });
      
      const success = check(res, {
        'picks status 200': (r) => r.status === 200,
        'picks latency < 150ms': (r) => r.timings.duration < 150,
        'picks has data': (r) => {
          try {
            const body = JSON.parse(r.body);
            return Array.isArray(body.data) || Array.isArray(body);
          } catch {
            return false;
          }
        },
      });
      
      apiLatency.add(res.timings.duration);
      errorRate.add(res.status !== 200);
      
      if (success) {
        successfulRequests.add(1);
      } else {
        failedRequests.add(1);
      }
    });

    // Test 3: User Stats (database-intensive)
    group('Get User Stats', () => {
      const userId = Math.floor(Math.random() * 1000) + 1;
      const res = http.get(`${BASE_URL}/api/users/${userId}/stats`, { headers, tags: { endpoint: 'user-stats' } });
      
      check(res, {
        'user stats status 200 or 404': (r) => r.status === 200 || r.status === 404,
        'user stats latency < 200ms': (r) => r.timings.duration < 200,
      });
      
      apiLatency.add(res.timings.duration);
      dbLatency.add(res.timings.duration * 0.7); // Estimate DB portion
      errorRate.add(res.status >= 500);
    });

    // Test 4: Grading Queue Depth (monitoring)
    group('Queue Metrics', () => {
      const res = http.get(`${BASE_URL}/api/metrics/queue`, { headers, tags: { endpoint: 'queue-metrics' } });
      
      if (res.status === 200) {
        try {
          const metrics = JSON.parse(res.body);
          queueDepth.add(metrics.queueDepth || 0);
        } catch (e) {
          console.error('Failed to parse queue metrics:', e);
        }
      }
      
      check(res, {
        'queue metrics accessible': (r) => r.status === 200,
        'queue depth < 100': (r) => {
          try {
            const metrics = JSON.parse(r.body);
            return (metrics.queueDepth || 0) < 100;
          } catch {
            return false;
          }
        },
      });
    });

    // Test 5: Write Operation (create pick)
    group('Create Pick', () => {
      const payload = JSON.stringify({
        user_id: `test-user-${__VU}-${__ITER}`,
        stat_type: 'points',
        player_name: 'Test Player',
        line: 25.5,
        pick: 'over',
        odds: -110,
        units: 1,
      });
      
      const res = http.post(`${BASE_URL}/api/picks`, payload, { headers, tags: { endpoint: 'create-pick' } });
      
      check(res, {
        'create pick status 201 or 200': (r) => r.status === 201 || r.status === 200,
        'create pick latency < 300ms': (r) => r.timings.duration < 300,
      });
      
      apiLatency.add(res.timings.duration);
      dbLatency.add(res.timings.duration * 0.8); // Write operations are DB-heavy
      errorRate.add(res.status >= 400);
    });
  });

  // Think time between requests (realistic user behavior)
  sleep(Math.random() * 2 + 0.5); // 0.5-2.5 seconds
}

/**
 * Teardown function - runs once after all scenarios
 */
export function teardown(data) {
  console.log('✅ Performance testing completed');
  console.log(`📅 Started: ${data.startTime}`);
  console.log(`📅 Ended: ${new Date().toISOString()}`);
}

/**
 * Handle summary - generate reports
 */
export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  return {
    [`out/ops/perf/k6-report-${timestamp}.html`]: htmlReport(data),
    [`out/ops/perf/k6-summary-${timestamp}.json`]: JSON.stringify(data, null, 2),
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
  };
}

