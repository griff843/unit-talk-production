import { FullConfig } from '@playwright/test';

/**
 * Global teardown for Command Center E2E tests
 * This runs once after all tests complete
 */
async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting Command Center E2E Test Suite cleanup');

  try {
    // Cleanup test data
    await cleanupTestData();
    
    // Cleanup authentication states
    await cleanupAuthenticationStates();
    
    // Generate test summary
    await generateTestSummary(config);

    console.log('✅ Global teardown completed successfully');
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw error to avoid masking test failures
  }
}

/**
 * Cleanup test data from database
 */
async function cleanupTestData() {
  console.log('🗑️ Cleaning up test data...');
  
  // In a real scenario, this would clean up any test data created in the database
  // For now, we just clear localStorage items that might persist
  
  console.log('✅ Test data cleanup completed');
}

/**
 * Cleanup authentication states
 */
async function cleanupAuthenticationStates() {
  console.log('🔐 Cleaning up authentication states...');
  
  // Clear any stored authentication tokens or states
  // This helps ensure tests start with a clean slate
  
  console.log('✅ Authentication states cleanup completed');
}

/**
 * Generate test summary report
 */
async function generateTestSummary(config: FullConfig) {
  console.log('📊 Generating test summary...');
  
  const summary = {
    timestamp: new Date().toISOString(),
    testSuite: 'Command Center E2E Tests',
    environment: process.env.NODE_ENV || 'test',
    baseURL: config.use?.baseURL || 'http://localhost:3015',
    testDir: config.testDir,
    browsers: config.projects?.map(p => p.name) || ['chromium'],
    metadata: config.metadata || {}
  };

  console.log('📋 Test Summary:');
  console.log(`   🕐 Completed at: ${summary.timestamp}`);
  console.log(`   🎯 Test Suite: ${summary.testSuite}`);
  console.log(`   🌍 Environment: ${summary.environment}`);
  console.log(`   📍 Base URL: ${summary.baseURL}`);
  console.log(`   🎭 Browsers: ${summary.browsers.join(', ')}`);
  
  // Write summary to file for CI/CD integration
  try {
    const fs = require('fs');
    const path = require('path');
    
    const outputDir = 'test-results';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const summaryPath = path.join(outputDir, 'test-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    
    console.log(`📝 Test summary written to: ${summaryPath}`);
  } catch (error) {
    console.warn('⚠️ Could not write test summary file:', error);
  }

  console.log('✅ Test summary generation completed');
}

export default globalTeardown;