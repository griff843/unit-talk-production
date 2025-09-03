#!/usr/bin/env node

/**
 * V3.0.0 Smart Form Test Runner
 *
 * Executes comprehensive testing of Smart Form workflows with v3.0.0 unified database tables
 */

const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Unit Talk Smart Form V3.0.0 Test Suite');
console.log('==========================================\n');

// Test configuration
const TEST_CONFIG = {
  baseUrl: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3002',
  browsers: ['chromium'], // Start with chromium only for faster testing
  timeout: 60000,
  retries: 1,
};

// Test suites
const TEST_SUITES = [
  {
    name: 'V3 Unified Workflow Tests',
    file: 'v3-unified-smart-form-workflow.spec.ts',
    description: 'Complete Smart Form workflow with v3.0.0 unified tables',
    critical: true,
  },
  {
    name: 'V3 Database Integration Tests',
    file: 'v3-database-integration.spec.ts',
    description: 'API and database integration with unified tables',
    critical: true,
  },
  {
    name: 'Performance & Error Handling Tests',
    file: 'v3-performance-and-errors.spec.ts',
    description: 'Performance testing and error handling scenarios',
    critical: false,
  },
];

async function checkPrerequisites() {
  console.log('🔍 Checking test prerequisites...\n');

  // Check if development server is running
  try {
    const response = await fetch(TEST_CONFIG.baseUrl);
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }
    console.log(`✅ Development server is running at ${TEST_CONFIG.baseUrl}`);
  } catch (error) {
    console.error(`❌ Development server not accessible at ${TEST_CONFIG.baseUrl}`);
    console.error('   Please start the Smart Form development server:');
    console.error('   npm run dev\n');
    return false;
  }

  // Check if test files exist
  const testDir = path.join(__dirname, 'tests');
  for (const suite of TEST_SUITES) {
    const testFile = path.join(testDir, suite.file);
    if (!fs.existsSync(testFile)) {
      console.error(`❌ Test file not found: ${suite.file}`);
      return false;
    }
  }
  console.log('✅ All test files found');

  // Check environment variables
  const requiredEnvVars = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];

  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  if (missingEnvVars.length > 0) {
    console.warn('⚠️  Missing environment variables (database tests may be limited):');
    missingEnvVars.forEach(envVar => console.warn(`   - ${envVar}`));
  } else {
    console.log('✅ Environment variables configured');
  }

  console.log('');
  return true;
}

function runPlaywrightTest(testFile, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`🧪 Running: ${testFile}`);
    console.log(`⏱️  Starting at: ${new Date().toLocaleTimeString()}`);

    const args = [
      'npx',
      'playwright',
      'test',
      `tests/${testFile}`,
      `--project=${options.browser || 'chromium'}`,
      '--reporter=list',
      `--timeout=${options.timeout || TEST_CONFIG.timeout}`,
    ];

    if (options.headed) {
      args.push('--headed');
    }

    if (options.debug) {
      args.push('--debug');
    }

    const testProcess = spawn(args[0], args.slice(1), {
      stdio: 'inherit',
      shell: true,
    });

    testProcess.on('close', code => {
      const endTime = new Date().toLocaleTimeString();
      if (code === 0) {
        console.log(`✅ Test completed successfully at ${endTime}\n`);
        resolve({ success: true, testFile, code });
      } else {
        console.log(`❌ Test failed with code ${code} at ${endTime}\n`);
        resolve({ success: false, testFile, code, error: `Exit code: ${code}` });
      }
    });

    testProcess.on('error', error => {
      console.error(`❌ Test process error: ${error.message}\n`);
      reject({ success: false, testFile, error: error.message });
    });
  });
}

async function runTestSuite(suite, options = {}) {
  console.log(`\n📋 ${suite.name}`);
  console.log(`📝 ${suite.description}`);
  console.log('─'.repeat(60));

  try {
    const result = await runPlaywrightTest(suite.file, options);
    return result;
  } catch (error) {
    console.error(`💥 Failed to run test suite: ${error.message}`);
    return { success: false, testFile: suite.file, error: error.message };
  }
}

async function generateTestReport(results) {
  console.log('\n📊 TEST SUMMARY REPORT');
  console.log('═'.repeat(60));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}`);

  if (successful.length > 0) {
    console.log('\n✅ PASSED TESTS:');
    successful.forEach(result => {
      const suite = TEST_SUITES.find(s => s.file === result.testFile);
      console.log(`   • ${suite?.name || result.testFile}`);
    });
  }

  if (failed.length > 0) {
    console.log('\n❌ FAILED TESTS:');
    failed.forEach(result => {
      const suite = TEST_SUITES.find(s => s.file === result.testFile);
      console.log(`   • ${suite?.name || result.testFile}`);
      if (result.error) {
        console.log(`     Error: ${result.error}`);
      }
    });

    console.log('\n🔧 TROUBLESHOOTING TIPS:');
    console.log('   • Ensure development server is running (npm run dev)');
    console.log('   • Check database connectivity and test data availability');
    console.log('   • Verify all environment variables are set correctly');
    console.log('   • Run tests with --headed flag to see browser interactions');
    console.log('   • Check Playwright report: npx playwright show-report');
  }

  // Generate timestamp report
  const timestamp = new Date().toISOString();
  const reportData = {
    timestamp,
    total: results.length,
    passed: successful.length,
    failed: failed.length,
    results: results.map(r => ({
      testFile: r.testFile,
      success: r.success,
      error: r.error || null,
    })),
  };

  fs.writeFileSync('test-results/v3-test-summary.json', JSON.stringify(reportData, null, 2));
  console.log('\n📁 Detailed report saved to: test-results/v3-test-summary.json');

  return failed.length === 0;
}

async function main() {
  console.log('🔧 Initializing test environment...\n');

  // Create test results directory
  const resultsDir = 'test-results';
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  // Check prerequisites
  const prerequisitesPassed = await checkPrerequisites();
  if (!prerequisitesPassed) {
    console.error('❌ Prerequisites check failed. Please fix the issues above and try again.');
    process.exit(1);
  }

  console.log('🎯 Starting V3.0.0 Smart Form Test Suite...\n');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {
    headed: args.includes('--headed'),
    debug: args.includes('--debug'),
    criticalOnly: args.includes('--critical-only'),
    browser: args.find(arg => arg.startsWith('--browser='))?.split('=')[1] || 'chromium',
  };

  // Filter test suites based on options
  let suitesToRun = TEST_SUITES;
  if (options.criticalOnly) {
    suitesToRun = TEST_SUITES.filter(suite => suite.critical);
    console.log('🎯 Running critical tests only\n');
  }

  // Run test suites
  const results = [];
  for (const suite of suitesToRun) {
    const result = await runTestSuite(suite, options);
    results.push(result);

    // If critical test fails, offer to stop
    if (suite.critical && !result.success) {
      console.log('💥 Critical test failed!');
      if (!args.includes('--continue-on-failure')) {
        console.log('   Use --continue-on-failure to run remaining tests');
        break;
      }
    }
  }

  // Generate final report
  const allTestsPassed = await generateTestReport(results);

  if (allTestsPassed) {
    console.log('\n🎉 All tests completed successfully!');
    console.log('✅ Smart Form V3.0.0 workflows are working correctly.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please review the results above.');
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', error => {
  console.error('\n💥 Unhandled error:', error);
  process.exit(1);
});

// Run the test suite
if (require.main === module) {
  main().catch(error => {
    console.error('\n💥 Test runner error:', error);
    process.exit(1);
  });
}

module.exports = { runTestSuite, generateTestReport, TEST_SUITES };
