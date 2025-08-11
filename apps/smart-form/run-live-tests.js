#!/usr/bin/env node

/**
 * Unit Talk Smart Form - Live Data E2E Test Runner
 *
 * This script runs comprehensive E2E tests using live Supabase data
 * to validate the complete workflow from data ingestion to form submission.
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Test configuration
const TEST_CONFIG = {
  timeout: 300000, // 5 minutes total timeout
  baseUrl: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3004',
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  browsers: ['chromium', 'firefox', 'webkit'],
  mobileDevices: ['Mobile Chrome', 'Mobile Safari'],
};

console.log('🚀 Unit Talk Smart Form - Live Data E2E Test Suite');
console.log('='.repeat(60));

// Validate environment
function validateEnvironment() {
  console.log('🔍 Validating test environment...');

  // Check if Supabase is configured
  if (!TEST_CONFIG.supabaseUrl || !TEST_CONFIG.supabaseKey) {
    console.warn('⚠️  Supabase configuration incomplete');
    console.warn('   Some tests will use fallback data');
    console.warn('   For full live data testing, configure:');
    console.warn('   - NEXT_PUBLIC_SUPABASE_URL');
    console.warn('   - NEXT_PUBLIC_SUPABASE_ANON_KEY');
  } else {
    console.log('✅ Supabase configuration found');
  }

  // Check if development server is accessible
  try {
    console.log(`🔍 Testing server connectivity at ${TEST_CONFIG.baseUrl}...`);
    execSync(`curl -s --connect-timeout 5 ${TEST_CONFIG.baseUrl} > /dev/null`, { stdio: 'ignore' });
    console.log('✅ Development server is accessible');
  } catch (err) {
    console.error('❌ Development server is not accessible');
    console.error(`   Please ensure the smart form is running at ${TEST_CONFIG.baseUrl}`);
    console.error('   Run: npm run dev');
    process.exit(1);
  }

  console.log('✅ Environment validation complete\n');
}

// Run specific test suite
function runTestSuite(suiteName, projectName = 'chromium') {
  console.log(`🧪 Running ${suiteName} tests on ${projectName}...`);

  try {
    const command = [
      'npx',
      'playwright',
      'test',
      '--project',
      projectName,
      suiteName,
      '--reporter=line',
    ];

    const result = execSync(command.join(' '), {
      cwd: __dirname,
      stdio: 'inherit',
      timeout: TEST_CONFIG.timeout,
    });

    console.log(`✅ ${suiteName} tests completed successfully on ${projectName}\n`);
    return true;
  } catch (err) {
    console.error(`❌ ${suiteName} tests failed on ${projectName}:`, err.message);
    return false;
  }
}

// Generate test report
function generateTestReport(results) {
  console.log('📊 Test Execution Summary');
  console.log('='.repeat(40));

  const totalTests = results.length;
  const passedTests = results.filter(r => r.passed).length;
  const failedTests = totalTests - passedTests;

  console.log(`Total test suites: ${totalTests}`);
  console.log(`Passed: ${passedTests} ✅`);
  console.log(`Failed: ${failedTests} ❌`);
  console.log(`Success rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (failedTests > 0) {
    console.log('\n❌ Failed test suites:');
    results
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`   - ${r.suite} (${r.browser})`);
      });
  }

  console.log('\n📁 Test artifacts:');
  console.log('   - HTML Report: playwright-report/index.html');
  console.log('   - Test Results: test-results/');
  console.log('   - Screenshots: test-results/');
  console.log('   - Videos: test-results/');

  return failedTests === 0;
}

// Main test execution
async function main() {
  const startTime = Date.now();

  // Validate environment
  validateEnvironment();

  // Test suites to run
  const testSuites = [
    { name: 'e2e-comprehensive-live.spec.ts', critical: true },
    { name: 'e2e-live-data.spec.ts', critical: false },
  ];

  const results = [];

  // Run comprehensive tests on primary browser
  console.log('🎯 Running comprehensive live data tests...');
  for (const suite of testSuites) {
    const passed = runTestSuite(suite.name, 'chromium');
    results.push({
      suite: suite.name,
      browser: 'chromium',
      passed,
      critical: suite.critical,
    });

    // If critical test fails, don't continue with cross-browser testing
    if (suite.critical && !passed) {
      console.error('❌ Critical test suite failed - skipping cross-browser tests');
      break;
    }
  }

  // Run cross-browser tests if primary tests passed
  const criticalTestsPassed = results.filter(r => r.critical).every(r => r.passed);

  if (criticalTestsPassed) {
    console.log('🌐 Running cross-browser compatibility tests...');

    // Test on additional browsers
    const additionalBrowsers = ['firefox', 'webkit'];
    for (const browser of additionalBrowsers) {
      const passed = runTestSuite('e2e-comprehensive-live.spec.ts', browser);
      results.push({
        suite: 'e2e-comprehensive-live.spec.ts',
        browser,
        passed,
        critical: false,
      });
    }

    // Test on mobile devices
    console.log('📱 Running mobile compatibility tests...');
    for (const device of TEST_CONFIG.mobileDevices) {
      const passed = runTestSuite('e2e-comprehensive-live.spec.ts', device);
      results.push({
        suite: 'e2e-comprehensive-live.spec.ts',
        browser: device,
        passed,
        critical: false,
      });
    }
  }

  // Generate HTML report
  console.log('📊 Generating comprehensive test report...');
  try {
    execSync('npx playwright show-report --host 0.0.0.0', { stdio: 'ignore' });
  } catch (err) {
    // Report generation failed, but don't fail the entire run
    console.warn('⚠️  Could not start report server');
  }

  // Generate summary
  const allPassed = generateTestReport(results);

  const duration = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n⏱️  Total execution time: ${duration} seconds`);

  if (allPassed) {
    console.log('\n🎉 All tests passed! The smart form is working correctly with live data.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please review the reports and fix issues.');
    process.exit(1);
  }
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('\n🛑 Test execution interrupted');
  process.exit(1);
});

process.on('unhandledRejection', err => {
  console.error('❌ Unhandled error:', err);
  process.exit(1);
});

// Run the tests
main().catch(err => {
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});
