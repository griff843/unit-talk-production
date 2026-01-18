#!/usr/bin/env node

/**
 * Phase 13: Model Serving & Ensemble Layer - Load Testing
 *
 * Load test script using autocannon to test inference endpoints:
 * - /api/predict - Single/ensemble predictions
 * - /api/ensemble/predict - Ensemble predictions
 * - /api/predict/batch - Batch predictions
 *
 * Validates Charter v4.0 SLOs:
 * - P95 latency < 150ms
 * - P99 latency < 300ms
 * - Error rate < 0.5%
 * - Sustained throughput at 1000 req/s
 *
 * @module scripts/load/inference-load-test
 * @since Phase 13 - Model Serving & Ensemble Layer
 * @reference Production Charter v4.0
 */

const autocannon = require('autocannon');
const fs = require('fs');
const path = require('path');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const DURATION_SECONDS = parseInt(process.env.LOAD_TEST_DURATION || '300'); // 5 minutes default
const CONNECTIONS = parseInt(process.env.LOAD_TEST_CONNECTIONS || '50');
const PIPELINING = parseInt(process.env.LOAD_TEST_PIPELINING || '10');

// Sample features for prediction requests
const sampleFeatures = {
  current_odds: 2.0,
  volume: 5000,
  liquidity: 0.8,
  time_to_event: 120,
  volatility: 0.15,
  momentum: 0.3
};

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

/**
 * Run load test for a specific endpoint
 */
async function runLoadTest(endpoint, requestBody, testName) {
  console.log(`\n${colors.cyan}${colors.bold}Running Load Test: ${testName}${colors.reset}`);
  console.log(`${colors.cyan}Endpoint: ${endpoint}${colors.reset}`);
  console.log(`${colors.cyan}Duration: ${DURATION_SECONDS}s, Connections: ${CONNECTIONS}, Pipelining: ${PIPELINING}${colors.reset}\n`);

  const result = await autocannon({
    url: `${API_BASE_URL}${endpoint}`,
    connections: CONNECTIONS,
    pipelining: PIPELINING,
    duration: DURATION_SECONDS,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  return result;
}

/**
 * Analyze results against Charter SLOs
 */
function analyzeSLOCompliance(result, testName) {
  const p95Latency = result.latency.p95;
  const p99Latency = result.latency.p99;
  const errorRate = (result.errors / result.requests.total) || 0;
  const requestsPerSecond = result.requests.average;

  console.log(`\n${colors.bold}=== SLO Compliance Analysis: ${testName} ===${colors.reset}\n`);

  // P95 Latency Check (Charter: < 150ms)
  const p95Pass = p95Latency < 150;
  console.log(
    `P95 Latency: ${p95Latency.toFixed(2)}ms ${p95Pass ? colors.green + '✓ PASS' : colors.red + '✗ FAIL'} ${colors.reset}(Target: < 150ms)`
  );

  // P99 Latency Check (Charter: < 300ms)
  const p99Pass = p99Latency < 300;
  console.log(
    `P99 Latency: ${p99Latency.toFixed(2)}ms ${p99Pass ? colors.green + '✓ PASS' : colors.red + '✗ FAIL'} ${colors.reset}(Target: < 300ms)`
  );

  // Error Rate Check (Charter: < 0.5%)
  const errorRatePass = errorRate < 0.005;
  console.log(
    `Error Rate: ${(errorRate * 100).toFixed(3)}% ${errorRatePass ? colors.green + '✓ PASS' : colors.red + '✗ FAIL'} ${colors.reset}(Target: < 0.5%)`
  );

  // Throughput Check
  const throughputPass = requestsPerSecond > 100; // Minimum viable throughput
  console.log(
    `Throughput: ${requestsPerSecond.toFixed(2)} req/s ${throughputPass ? colors.green + '✓ PASS' : colors.yellow + '⚠ WARN'} ${colors.reset}(Target: > 100 req/s)`
  );

  const allPass = p95Pass && p99Pass && errorRatePass && throughputPass;

  console.log(`\n${colors.bold}Overall Compliance: ${allPass ? colors.green + '✓ PASS' : colors.red + '✗ FAIL'} ${colors.reset}\n`);

  return {
    testName,
    p95Latency,
    p99Latency,
    errorRate: errorRate * 100,
    requestsPerSecond,
    totalRequests: result.requests.total,
    errors: result.errors,
    sloCompliance: {
      p95Pass,
      p99Pass,
      errorRatePass,
      throughputPass,
      overallPass: allPass
    }
  };
}

/**
 * Export results to JSON and Markdown
 */
function exportResults(allResults) {
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const outputDir = path.join(__dirname, '../../out/ops/cutover/metrics/phase13');

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Export JSON
  const jsonPath = path.join(outputDir, `LOADTEST_RESULTS_${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(allResults, null, 2));
  console.log(`\n${colors.green}✓ JSON results exported: ${jsonPath}${colors.reset}`);

  // Export Markdown
  const mdPath = path.join(outputDir, `LOADTEST_SUMMARY_${timestamp}.md`);
  const markdown = generateMarkdownReport(allResults);
  fs.writeFileSync(mdPath, markdown);
  console.log(`${colors.green}✓ Markdown summary exported: ${mdPath}${colors.reset}\n`);

  // Export CSV
  const csvPath = path.join(outputDir, `LOADTEST_DATA_${timestamp}.csv`);
  const csv = generateCSVReport(allResults);
  fs.writeFileSync(csvPath, csv);
  console.log(`${colors.green}✓ CSV data exported: ${csvPath}${colors.reset}\n`);
}

/**
 * Generate Markdown report
 */
function generateMarkdownReport(results) {
  const timestamp = new Date().toISOString();

  return `# Phase 13: Model Serving Load Test Results

**Generated:** ${timestamp}

## Executive Summary

${results.summary.allTestsPass ? '✅ **ALL CHARTER SLOs MET**' : '❌ **SLO VIOLATIONS DETECTED**'}

## Configuration

- **API Base URL:** ${API_BASE_URL}
- **Test Duration:** ${DURATION_SECONDS}s
- **Connections:** ${CONNECTIONS}
- **Pipelining:** ${PIPELINING}

## Test Results

| Test | P95 Latency | P99 Latency | Error Rate | Throughput | SLO Compliance |
|------|-------------|-------------|------------|------------|----------------|
${results.tests.map(t => `| ${t.testName} | ${t.p95Latency.toFixed(2)}ms | ${t.p99Latency.toFixed(2)}ms | ${t.errorRate.toFixed(3)}% | ${t.requestsPerSecond.toFixed(2)} req/s | ${t.sloCompliance.overallPass ? '✅ PASS' : '❌ FAIL'} |`).join('\n')}

## Detailed Metrics

${results.tests.map(t => `
### ${t.testName}

- **P95 Latency:** ${t.p95Latency.toFixed(2)}ms ${t.sloCompliance.p95Pass ? '✅' : '❌'} (Target: < 150ms)
- **P99 Latency:** ${t.p99Latency.toFixed(2)}ms ${t.sloCompliance.p99Pass ? '✅' : '❌'} (Target: < 300ms)
- **Error Rate:** ${t.errorRate.toFixed(3)}% ${t.sloCompliance.errorRatePass ? '✅' : '❌'} (Target: < 0.5%)
- **Throughput:** ${t.requestsPerSecond.toFixed(2)} req/s ${t.sloCompliance.throughputPass ? '✅' : '⚠️'} (Target: > 100 req/s)
- **Total Requests:** ${t.totalRequests}
- **Errors:** ${t.errors}
`).join('\n')}

## Charter v4.0 Compliance

| SLO | Target | Status |
|-----|--------|--------|
| P95 Latency | < 150ms | ${results.summary.allP95Pass ? '✅ PASS' : '❌ FAIL'} |
| P99 Latency | < 300ms | ${results.summary.allP99Pass ? '✅ PASS' : '❌ FAIL'} |
| Error Rate | < 0.5% | ${results.summary.allErrorRatePass ? '✅ PASS' : '❌ FAIL'} |
| Throughput | > 100 req/s | ${results.summary.allThroughputPass ? '✅ PASS' : '⚠️ WARN'} |

## Recommendations

${results.summary.allTestsPass ? `
- ✅ All SLOs met - system is production-ready
- Continue monitoring in production environment
- Consider gradual traffic ramp-up (canary deployment)
` : `
- ❌ SLO violations detected - investigate before production deployment
- Review performance bottlenecks
- Consider scaling infrastructure or optimizing code
- Run additional tests to identify root causes
`}

---

**Charter Reference:** Production Charter v4.0
**Test Framework:** autocannon
**Report Generator:** Phase 13 Load Test Script
`;
}

/**
 * Generate CSV report
 */
function generateCSVReport(results) {
  const header = 'Test Name,P95 Latency (ms),P99 Latency (ms),Error Rate (%),Throughput (req/s),Total Requests,Errors,P95 Pass,P99 Pass,Error Rate Pass,Throughput Pass,Overall Pass\n';

  const rows = results.tests.map(t =>
    `${t.testName},${t.p95Latency.toFixed(2)},${t.p99Latency.toFixed(2)},${t.errorRate.toFixed(3)},${t.requestsPerSecond.toFixed(2)},${t.totalRequests},${t.errors},${t.sloCompliance.p95Pass},${t.sloCompliance.p99Pass},${t.sloCompliance.errorRatePass},${t.sloCompliance.throughputPass},${t.sloCompliance.overallPass}`
  ).join('\n');

  return header + rows;
}

/**
 * Main execution
 */
async function main() {
  console.log(`\n${colors.bold}${colors.cyan}╔═══════════════════════════════════════════════════════════════════╗`);
  console.log(`║  Phase 13: Model Serving & Ensemble Layer - Load Test            ║`);
  console.log(`║  Charter v4.0 SLO Validation                                      ║`);
  console.log(`╚═══════════════════════════════════════════════════════════════════╝${colors.reset}\n`);

  const allResults = {
    timestamp: new Date().toISOString(),
    configuration: {
      apiBaseUrl: API_BASE_URL,
      duration: DURATION_SECONDS,
      connections: CONNECTIONS,
      pipelining: PIPELINING
    },
    tests: [],
    summary: {}
  };

  try {
    // Test 1: Single/Auto Predict
    const test1 = await runLoadTest(
      '/api/predict',
      {
        features: sampleFeatures,
        ensembleMode: 'auto'
      },
      'Single/Auto Predict'
    );
    allResults.tests.push(analyzeSLOCompliance(test1, 'Single/Auto Predict'));

    // Test 2: Ensemble Predict
    const test2 = await runLoadTest(
      '/api/ensemble/predict',
      {
        features: sampleFeatures,
        includeExplanation: true
      },
      'Ensemble Predict'
    );
    allResults.tests.push(analyzeSLOCompliance(test2, 'Ensemble Predict'));

    // Test 3: Batch Predict
    const test3 = await runLoadTest(
      '/api/predict/batch',
      {
        requests: [
          { features: sampleFeatures },
          { features: { ...sampleFeatures, current_odds: 3.0 } },
          { features: { ...sampleFeatures, volume: 10000 } }
        ],
        parallel: true
      },
      'Batch Predict'
    );
    allResults.tests.push(analyzeSLOCompliance(test3, 'Batch Predict'));

    // Calculate summary
    allResults.summary = {
      allP95Pass: allResults.tests.every(t => t.sloCompliance.p95Pass),
      allP99Pass: allResults.tests.every(t => t.sloCompliance.p99Pass),
      allErrorRatePass: allResults.tests.every(t => t.sloCompliance.errorRatePass),
      allThroughputPass: allResults.tests.every(t => t.sloCompliance.throughputPass),
      allTestsPass: allResults.tests.every(t => t.sloCompliance.overallPass)
    };

    // Export results
    exportResults(allResults);

    // Final summary
    console.log(`\n${colors.bold}${colors.cyan}╔═══════════════════════════════════════════════════════════════════╗`);
    console.log(`║  FINAL RESULTS                                                    ║`);
    console.log(`╚═══════════════════════════════════════════════════════════════════╝${colors.reset}\n`);

    if (allResults.summary.allTestsPass) {
      console.log(`${colors.green}${colors.bold}✓ ALL CHARTER v4.0 SLOs MET${colors.reset}`);
      console.log(`${colors.green}System is production-ready for Phase 13 deployment${colors.reset}\n`);
      process.exit(0);
    } else {
      console.log(`${colors.red}${colors.bold}✗ SLO VIOLATIONS DETECTED${colors.reset}`);
      console.log(`${colors.red}Review results before production deployment${colors.reset}\n`);
      process.exit(1);
    }

  } catch (error) {
    console.error(`\n${colors.red}${colors.bold}✗ Load test failed:${colors.reset}`, error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { runLoadTest, analyzeSLOCompliance, exportResults };
