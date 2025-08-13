/**
 * k6 Load Testing Script for Unit Talk Platform
 * 
 * Tests performance under various load scenarios:
 * - Baseline: Normal daily load
 * - Peak: 3x normal during game times
 * - Stress: 10x normal to find breaking point
 * - Spike: Sudden 20x burst
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const errorRate = new Rate('errors');
const apiTrend = new Trend('api_response_time');
const dbTrend = new Trend('db_query_time');
const gradingTrend = new Trend('grading_time');

// Test configuration
const BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-token';

// Load scenarios
export const options = {
  scenarios: {
    // Baseline load - normal operations
    baseline: {
      executor: 'constant-vus',
      vus: 10,
      duration: '10m',
      startTime: '0s',
      tags: { scenario: 'baseline' }
    },
    
    // Peak load - game time traffic
    peak: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '2m', target: 30 },
        { duration: '5m', target: 30 },
        { duration: '2m', target: 10 },
      ],
      startTime: '10m',
      tags: { scenario: 'peak' }
    },
    
    // Stress test - find breaking point
    stress: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '2m', target: 100 },
        { duration: '2m', target: 150 },
        { duration: '2m', target: 200 },
        { duration: '2m', target: 0 },
      ],
      startTime: '20m',
      tags: { scenario: 'stress' }
    },
    
    // Spike test - sudden traffic burst
    spike: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '10s', target: 5 },
        { duration: '10s', target: 200 },
        { duration: '30s', target: 200 },
        { duration: '10s', target: 5 },
        { duration: '1m', target: 5 },
      ],
      startTime: '30m',
      tags: { scenario: 'spike' }
    }
  },
  
  thresholds: {
    // API performance thresholds
    'http_req_duration': [
      'p(95)<500',  // 95% of requests under 500ms
      'p(99)<1000', // 99% of requests under 1s
    ],
    'http_req_duration{endpoint:health}': ['p(95)<100'],
    'http_req_duration{endpoint:picks}': ['p(95)<200'],
    'http_req_duration{endpoint:grading}': ['p(95)<1000'],
    
    // Error rate thresholds
    'errors': ['rate<0.01'], // Less than 1% errors
    'http_req_failed': ['rate<0.05'], // Less than 5% failed requests
    
    // Custom metric thresholds
    'api_response_time': ['p(95)<300'],
    'db_query_time': ['p(95)<50'],
    'grading_time': ['p(95)<800'],
  }
};

// Test data
const PLAYERS = [
  'LeBron James', 'Kevin Durant', 'Stephen Curry', 'Giannis Antetokounmpo',
  'Joel Embiid', 'Nikola Jokic', 'Luka Doncic', 'Jayson Tatum'
];

const STAT_TYPES = [
  'Points', 'Rebounds', 'Assists', 'Steals', 'Blocks',
  '3-Pointers Made', 'Points + Rebounds', 'Points + Assists'
];

const USERS = [
  { id: 'user-1', tier: 'free' },
  { id: 'user-2', tier: 'vip' },
  { id: 'user-3', tier: 'vip_plus' },
  { id: 'user-4', tier: 'professional' },
  { id: 'user-5', tier: 'elite' }
];

// Helper functions
function getHeaders(userId = null) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`,
  };
  
  if (userId) {
    headers['X-User-Id'] = userId;
  }
  
  return headers;
}

function generatePick() {
  return {
    player_name: randomItem(PLAYERS),
    stat_type: randomItem(STAT_TYPES),
    line: Math.floor(Math.random() * 30) + 10,
    pick: Math.random() > 0.5 ? 'over' : 'under',
    confidence: Math.random() * 0.5 + 0.5, // 0.5 to 1.0
    sport: 'NBA',
    game_time: new Date(Date.now() + Math.random() * 86400000).toISOString()
  };
}

// Test scenarios
export default function() {
  const user = randomItem(USERS);
  const scenario = Math.random();
  
  if (scenario < 0.2) {
    // Health check - 20%
    testHealthEndpoint();
  } else if (scenario < 0.5) {
    // List picks - 30%
    testListPicks(user);
  } else if (scenario < 0.7) {
    // Submit pick - 20%
    testSubmitPick(user);
  } else if (scenario < 0.85) {
    // Grade picks - 15%
    testGradePicks();
  } else if (scenario < 0.95) {
    // Get analytics - 10%
    testAnalytics(user);
  } else {
    // Complex workflow - 5%
    testCompleteWorkflow(user);
  }
  
  sleep(Math.random() * 2); // Random delay between requests
}

function testHealthEndpoint() {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/health`, {
    tags: { endpoint: 'health' }
  });
  
  const duration = Date.now() - start;
  apiTrend.add(duration);
  
  const success = check(res, {
    'health check status is 200': (r) => r.status === 200,
    'health check body contains status': (r) => r.body.includes('healthy'),
    'health check response time < 100ms': (r) => duration < 100,
  });
  
  errorRate.add(!success);
}

function testListPicks(user) {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/api/picks`, {
    headers: getHeaders(user.id),
    tags: { endpoint: 'picks', tier: user.tier }
  });
  
  const duration = Date.now() - start;
  apiTrend.add(duration);
  
  const success = check(res, {
    'list picks status is 200': (r) => r.status === 200,
    'list picks returns array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.picks);
      } catch {
        return false;
      }
    },
    'list picks response time < 200ms': (r) => duration < 200,
  });
  
  errorRate.add(!success);
  
  // Parse response for database query time
  try {
    const body = JSON.parse(res.body);
    if (body.metrics && body.metrics.db_query_time) {
      dbTrend.add(body.metrics.db_query_time);
    }
  } catch {}
}

function testSubmitPick(user) {
  const pick = generatePick();
  const start = Date.now();
  
  const res = http.post(
    `${BASE_URL}/api/picks`,
    JSON.stringify(pick),
    {
      headers: getHeaders(user.id),
      tags: { endpoint: 'submit_pick', tier: user.tier }
    }
  );
  
  const duration = Date.now() - start;
  apiTrend.add(duration);
  
  const success = check(res, {
    'submit pick status is 201': (r) => r.status === 201,
    'submit pick returns pick id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.pick_id !== undefined;
      } catch {
        return false;
      }
    },
    'submit pick response time < 300ms': (r) => duration < 300,
  });
  
  errorRate.add(!success);
  
  return res;
}

function testGradePicks() {
  const start = Date.now();
  
  // First get ungraded picks
  const listRes = http.get(`${BASE_URL}/api/picks/ungraded`, {
    headers: getHeaders(),
    tags: { endpoint: 'ungraded_picks' }
  });
  
  if (listRes.status !== 200) {
    errorRate.add(1);
    return;
  }
  
  let pickIds;
  try {
    const body = JSON.parse(listRes.body);
    pickIds = body.picks.slice(0, 10).map(p => p.id);
  } catch {
    errorRate.add(1);
    return;
  }
  
  if (pickIds.length === 0) {
    return; // No picks to grade
  }
  
  // Grade the picks
  const gradeRes = http.post(
    `${BASE_URL}/api/grading/execute`,
    JSON.stringify({ pick_ids: pickIds }),
    {
      headers: getHeaders(),
      tags: { endpoint: 'grading' }
    }
  );
  
  const duration = Date.now() - start;
  apiTrend.add(duration);
  gradingTrend.add(duration);
  
  const success = check(gradeRes, {
    'grading status is 200': (r) => r.status === 200,
    'grading returns results': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.graded_count > 0;
      } catch {
        return false;
      }
    },
    'grading response time < 1000ms': (r) => duration < 1000,
  });
  
  errorRate.add(!success);
}

function testAnalytics(user) {
  const start = Date.now();
  
  const res = http.get(`${BASE_URL}/api/analytics/performance`, {
    headers: getHeaders(user.id),
    tags: { endpoint: 'analytics', tier: user.tier }
  });
  
  const duration = Date.now() - start;
  apiTrend.add(duration);
  
  const success = check(res, {
    'analytics status is 200': (r) => r.status === 200,
    'analytics returns metrics': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.win_rate !== undefined && body.roi !== undefined;
      } catch {
        return false;
      }
    },
    'analytics response time < 500ms': (r) => duration < 500,
  });
  
  errorRate.add(!success);
}

function testCompleteWorkflow(user) {
  const workflowStart = Date.now();
  
  // 1. Submit a pick
  const pick = generatePick();
  const submitRes = http.post(
    `${BASE_URL}/api/picks`,
    JSON.stringify(pick),
    {
      headers: getHeaders(user.id),
      tags: { workflow: 'complete', step: 'submit' }
    }
  );
  
  if (submitRes.status !== 201) {
    errorRate.add(1);
    return;
  }
  
  let pickId;
  try {
    const body = JSON.parse(submitRes.body);
    pickId = body.pick_id;
  } catch {
    errorRate.add(1);
    return;
  }
  
  // 2. Wait for processing
  sleep(2);
  
  // 3. Check grading status
  const statusRes = http.get(
    `${BASE_URL}/api/picks/${pickId}/status`,
    {
      headers: getHeaders(user.id),
      tags: { workflow: 'complete', step: 'status' }
    }
  );
  
  if (statusRes.status !== 200) {
    errorRate.add(1);
    return;
  }
  
  // 4. Get grading result
  const gradeRes = http.get(
    `${BASE_URL}/api/picks/${pickId}/grade`,
    {
      headers: getHeaders(user.id),
      tags: { workflow: 'complete', step: 'grade' }
    }
  );
  
  const workflowDuration = Date.now() - workflowStart;
  
  const success = check(gradeRes, {
    'workflow completes successfully': (r) => r.status === 200,
    'workflow returns grade': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.grade !== undefined;
      } catch {
        return false;
      }
    },
    'workflow completes < 3000ms': (r) => workflowDuration < 3000,
  });
  
  errorRate.add(!success);
}

// Lifecycle hooks
export function setup() {
  // Verify environment is ready
  const res = http.get(`${BASE_URL}/health`);
  if (res.status !== 200) {
    throw new Error(`API is not healthy: ${res.status}`);
  }
  
  console.log('Load test starting...');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Scenarios: baseline, peak, stress, spike`);
  
  return {
    startTime: Date.now()
  };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Load test completed in ${duration} seconds`);
  
  // Could send summary to monitoring system
  const summary = {
    duration: duration,
    timestamp: new Date().toISOString(),
    environment: BASE_URL
  };
  
  // TODO: Send to monitoring webhook
  console.log('Test summary:', JSON.stringify(summary, null, 2));
}