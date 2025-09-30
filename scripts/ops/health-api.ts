#!/usr/bin/env npx tsx

/**
 * Live API Health Check
 * Tests actual API endpoints for health and readiness
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

interface APIHealthResult {
  timestamp: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  endpoints: {
    health: {
      status: number;
      response_time_ms: number;
      body?: any;
      error?: string;
    };
    readiness: {
      status: number;
      response_time_ms: number;
      body?: any;
      error?: string;
    };
    approval_health: {
      status: number;
      response_time_ms: number;
      body?: any;
      error?: string;
    };
    picks: {
      status: number;
      response_time_ms: number;
      body?: any;
      error?: string;
    };
  };
  overall_response_time_ms: number;
  errors: string[];
}

async function testEndpoint(url: string): Promise<{
  status: number;
  response_time_ms: number;
  body?: any;
  error?: string;
}> {
  const start = Date.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'health-check/1.0'
      },
      // Add timeout
      signal: AbortSignal.timeout(5000)
    });

    const responseTime = Date.now() - start;

    let body;
    try {
      body = await response.json();
    } catch {
      body = { raw: await response.text() };
    }

    return {
      status: response.status,
      response_time_ms: responseTime,
      body
    };
  } catch (error) {
    return {
      status: 0,
      response_time_ms: Date.now() - start,
      error: error.message
    };
  }
}

async function runAPIHealthCheck(): Promise<APIHealthResult> {
  const start = Date.now();
  const result: APIHealthResult = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    endpoints: {
      health: { status: 0, response_time_ms: 0 },
      readiness: { status: 0, response_time_ms: 0 },
      approval_health: { status: 0, response_time_ms: 0 },
      picks: { status: 0, response_time_ms: 0 }
    },
    overall_response_time_ms: 0,
    errors: []
  };

  try {
    // Test all endpoints in parallel
    const [healthTest, readinessTest, approvalTest, picksTest] = await Promise.all([
      testEndpoint(`${API_BASE_URL}/health`),
      testEndpoint(`${API_BASE_URL}/readiness`),
      testEndpoint(`${API_BASE_URL}/api/approval/health`),
      testEndpoint(`${API_BASE_URL}/api/picks?limit=1`)
    ]);

    result.endpoints.health = healthTest;
    result.endpoints.readiness = readinessTest;
    result.endpoints.approval_health = approvalTest;
    result.endpoints.picks = picksTest;

    // Check for errors
    if (healthTest.error) {
      result.errors.push(`Health endpoint failed: ${healthTest.error}`);
    } else if (healthTest.status !== 200) {
      result.errors.push(`Health endpoint returned ${healthTest.status}`);
    }

    if (readinessTest.error) {
      result.errors.push(`Readiness endpoint failed: ${readinessTest.error}`);
    } else if (readinessTest.status !== 200 && readinessTest.status !== 503) {
      result.errors.push(`Readiness endpoint returned unexpected status ${readinessTest.status}`);
    }

    if (approvalTest.error) {
      result.errors.push(`Approval health failed: ${approvalTest.error}`);
    } else if (approvalTest.status !== 200 && approvalTest.status !== 429) {
      result.errors.push(`Approval health returned ${approvalTest.status}`);
    }

    if (picksTest.error) {
      result.errors.push(`Picks endpoint failed: ${picksTest.error}`);
    } else if (picksTest.status !== 200 && picksTest.status !== 429) {
      result.errors.push(`Picks endpoint returned ${picksTest.status}`);
    }

  } catch (error) {
    result.errors.push(`API health check failed: ${error.message}`);
  }

  result.overall_response_time_ms = Date.now() - start;

  // Determine overall status
  const criticalFailures = [
    result.endpoints.health.status === 0 || result.endpoints.health.status >= 500,
    result.endpoints.readiness.status === 0 || result.endpoints.readiness.status >= 500
  ].filter(Boolean).length;

  const minorFailures = [
    result.endpoints.approval_health.status === 0 || (result.endpoints.approval_health.status >= 400 && result.endpoints.approval_health.status !== 429),
    result.endpoints.picks.status === 0 || (result.endpoints.picks.status >= 400 && result.endpoints.picks.status !== 429)
  ].filter(Boolean).length;

  if (criticalFailures > 0) {
    result.status = 'unhealthy';
  } else if (minorFailures > 0) {
    result.status = 'degraded';
  } else {
    result.status = 'healthy';
  }

  return result;
}

async function main() {
  try {
    const healthResult = await runAPIHealthCheck();

    // Write to output file
    const outputPath = join(process.cwd(), 'out', 'ops', 'health-api.json');
    writeFileSync(outputPath, JSON.stringify(healthResult, null, 2));

    console.log(`API health check completed: ${healthResult.status}`);
    console.log(`Overall response time: ${healthResult.overall_response_time_ms}ms`);
    console.log(`Results written to: ${outputPath}`);

    if (healthResult.status === 'unhealthy') {
      process.exit(1);
    }
  } catch (error) {
    console.error('API health check script failed:', error);
    process.exit(1);
  }
}

main();