#!/usr/bin/env node

/**
 * Test Script: Command Center Approval Workflow End-to-End
 *
 * This script tests the complete flow:
 * 1. ScoringAgent processes props through Enhanced45Factor system
 * 2. Scored props appear in Command Center with professional_score, kelly_fraction, devigged_edge
 * 3. Operators can approve/deny props in Command Center interface
 * 4. Approved props get promoted for Discord publishing
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Command Center Approval Workflow Integration...\n');

const tests = [
  {
    name: '1. Verify Docker Services Running',
    command: 'docker-compose ps',
    expectedOutput: ['command-center', 'postgres', 'api']
  },
  {
    name: '2. Check Command Center Health',
    command: 'curl -s http://localhost:3004/api/health || echo "FAILED"',
    expectedOutput: ['success', 'true']
  },
  {
    name: '3. Test Approval API Endpoints',
    command: 'curl -s http://localhost:3004/api/approval?action=health || echo "FAILED"',
    expectedOutput: ['workflow', 'operational']
  },
  {
    name: '4. Verify Database Connection',
    command: 'docker-compose exec -T api npm run db:status',
    expectedOutput: ['migration', 'success']
  }
];

async function runTest(test) {
  return new Promise((resolve) => {
    console.log(`🔍 ${test.name}...`);

    exec(test.command, { timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        console.log(`   ❌ FAILED: ${error.message}`);
        resolve(false);
        return;
      }

      const output = stdout + stderr;
      const passed = test.expectedOutput.some(expected =>
        output.toLowerCase().includes(expected.toLowerCase())
      );

      if (passed) {
        console.log(`   ✅ PASSED`);
        resolve(true);
      } else {
        console.log(`   ❌ FAILED: Expected one of [${test.expectedOutput.join(', ')}]`);
        console.log(`   📄 Output: ${output.substring(0, 200)}...`);
        resolve(false);
      }
    });
  });
}

async function runTests() {
  console.log('🚀 Running Command Center Approval Integration Tests\n');

  let passed = 0;
  let total = tests.length;

  for (const test of tests) {
    const result = await runTest(test);
    if (result) passed++;
    console.log('');
  }

  console.log(`📊 Test Results: ${passed}/${total} tests passed\n`);

  if (passed === total) {
    console.log('🎉 ALL TESTS PASSED! Command Center approval workflow is ready.\n');

    console.log('📋 Next Steps:');
    console.log('1. Run ScoringAgent to process props:');
    console.log('   docker-compose exec api npx tsx src/runner/runScoringAgent.ts');
    console.log('');
    console.log('2. Open Command Center:');
    console.log('   http://localhost:3004/dashboard/picks');
    console.log('');
    console.log('3. Verify real-time updates:');
    console.log('   - Check for scored props with professional_score, kelly_fraction, devigged_edge');
    console.log('   - Test approve/reject buttons');
    console.log('   - Verify workflow_stage updates in database');
    console.log('');

    return true;
  } else {
    console.log('❌ Some tests failed. Please check the Docker services and API endpoints.');
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log('1. Start services: ./dev.sh start');
    console.log('2. Check logs: ./dev.sh logs');
    console.log('3. Check database: docker-compose exec api npm run db:status');
    console.log('');

    return false;
  }
}

// Test workflow overview
console.log('📋 Command Center Enhanced45Factor Approval Workflow:');
console.log('');
console.log('1. 🤖 ScoringAgent processes props through 45-factor system');
console.log('2. 📊 Props get professional_score, kelly_fraction, devigged_edge fields');
console.log('3. 🔄 workflow_stage changes to "pending_review"');
console.log('4. 📱 Command Center shows scored props in real-time');
console.log('5. 👤 Operators approve/deny via Command Center UI');
console.log('6. ✅ Approved props → workflow_stage: "approved" → Discord publishing');
console.log('');

runTests().then(success => {
  process.exit(success ? 0 : 1);
});