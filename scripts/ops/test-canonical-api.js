#!/usr/bin/env node
/**
 * Test Canonical API Routes - Validation Script
 */

require('dotenv').config();
const http = require('http');

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3010';
const tenantId = '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a';
const userId = '00000000-0000-0000-0000-000000000001';

const results = [];

function logResult(endpoint, method, status, duration, data, error = null) {
  const timestamp = new Date().toISOString();
  const result = {
    timestamp,
    endpoint,
    method,
    status,
    durationMs: duration,
    success: status >= 200 && status < 300,
    data,
    error,
  };
  results.push(result);

  const statusIcon = result.success ? '✅' : '❌';
  console.log(`${statusIcon} [${method} ${endpoint}] ${status} (${duration}ms)`);
  if (error) {
    console.log(`   Error: ${error}`);
  }
}

async function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
    }

    const start = Date.now();
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        const duration = Date.now() - start;
        let parsedData = null;
        try {
          parsedData = data ? JSON.parse(data) : null;
        } catch {
          parsedData = data;
        }

        resolve({
          status: res.statusCode,
          duration,
          data: parsedData,
        });
      });
    });

    req.on('error', error => {
      const duration = Date.now() - start;
      resolve({
        status: 0,
        duration,
        data: null,
        error: error.message,
      });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function testCanonicalAPI() {
  console.log('\n=== Canonical API Route Testing ===');
  console.log(`API Base: ${API_BASE}\n`);

  // Test 1: Health check
  try {
    const { status, duration, data, error } = await makeRequest('GET', '/api/health');
    logResult('/api/health', 'GET', status, duration, data, error);
  } catch (error) {
    logResult('/api/health', 'GET', 0, 0, null, error.message);
  }

  // Test 2: Dry-run endpoint
  const dryRunPayload = {
    tenant_id: tenantId,
    user_id: userId,
    picks: [
      {
        prop_id: '00000000-0000-0000-0000-000000000099',
        selection: 'over',
        odds: -110,
        stake: 10.0,
        confidence: 75,
      },
    ],
  };

  try {
    const { status, duration, data, error } = await makeRequest(
      'POST',
      '/api/domain/picks/dry-run',
      dryRunPayload
    );
    logResult('/api/domain/picks/dry-run', 'POST', status, duration, data, error);
  } catch (error) {
    logResult('/api/domain/picks/dry-run', 'POST', 0, 0, null, error.message);
  }

  // Test 3: Insert endpoint (with idempotency key to avoid duplicates)
  const insertPayload = {
    tenant_id: tenantId,
    user_id: userId,
    picks: [
      {
        prop_id: '00000000-0000-0000-0000-000000000099',
        selection: 'over',
        odds: -110,
        stake: 10.0,
        confidence: 75,
        idempotency_key: `test_api_${Date.now()}`,
        metadata: { source: 'api_validation_test' },
      },
    ],
  };

  try {
    const { status, duration, data, error } = await makeRequest(
      'POST',
      '/api/domain/picks/insert',
      insertPayload
    );
    logResult('/api/domain/picks/insert', 'POST', status, duration, data, error);
  } catch (error) {
    logResult('/api/domain/picks/insert', 'POST', 0, 0, null, error.message);
  }

  return results;
}

async function main() {
  const results = await testCanonicalAPI();

  console.log('\n=== Test Summary ===');
  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${results.filter(r => r.success).length}`);
  console.log(`Failed: ${results.filter(r => !r.success).length}`);

  // Append to rpc_calls.log
  const fs = require('fs');
  const logContent =
    '\n\n=== Canonical API Routes ===\n' +
    results
      .map(r => {
        return `[${r.timestamp}] ${r.method} ${r.endpoint} - Status: ${r.status} (${r.durationMs}ms)${
          r.error ? ` - Error: ${r.error}` : ''
        }`;
      })
      .join('\n');

  fs.appendFileSync('rpc_calls.log', logContent);
  console.log('\n✅ Results appended to rpc_calls.log');

  // Exit with error if any tests failed
  const hasErrors = results.some(r => !r.success && r.status !== 0);
  if (hasErrors) {
    console.log('\n⚠️  Some tests failed - check logs for details');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
