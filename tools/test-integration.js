#!/usr/bin/env node

/**
 * Integration Test Suite
 * Tests the complete flow: Smart Form → Backend → Dashboard
 */

const fetch = require('node-fetch');

const SMART_FORM_URL = 'http://localhost:3001';
const DASHBOARD_URL = 'http://localhost:3002';

async function testSmartFormSubmission() {
  console.log('🧪 Testing Smart Form Submission...');

  try {
    // Test form submission endpoint
    const response = await fetch(`${SMART_FORM_URL}/api/submit-ticket`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        capper: 'TestCapper',
        sport: 'NFL',
        game_date: '2025-08-01',
        bet_type: 'player_prop',
        ticket_type: 'standard',
        unit_size: 1,
        confidence_level: 8,
        game_selections: [
          {
            game_id: 'test-game-1',
            team: 'Test Team',
            selection: 'over',
            line: '25.5',
            odds: '-110',
            is_live: false,
          },
        ],
        notes: 'Integration test submission',
      }),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      console.log('✅ Smart Form submission successful');
      console.log(`   Ticket ID: ${result.ticketId}`);
      return result.ticketId;
    } else {
      console.error('❌ Smart Form submission failed:', result.error);
      return null;
    }
  } catch (error) {
    console.error('❌ Error testing smart form:', error.message);
    return null;
  }
}

async function testDashboardAnalytics() {
  console.log('🧪 Testing Dashboard Analytics API...');

  try {
    const response = await fetch(`${DASHBOARD_URL}/api/analytics?timeframe=7d`);
    const result = await response.json();

    if (response.ok && result.success) {
      console.log('✅ Dashboard analytics API working');
      console.log(`   Total picks: ${result.data.performance.totalPicks}`);
      console.log(`   Win rate: ${result.data.performance.winRate.toFixed(1)}%`);
      console.log(`   ROI: ${result.data.performance.roi.toFixed(1)}%`);
      return true;
    } else {
      console.error('❌ Dashboard analytics failed:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing dashboard analytics:', error.message);
    return false;
  }
}

async function testSystemHealth() {
  console.log('🧪 Testing System Health API...');

  try {
    const response = await fetch(`${DASHBOARD_URL}/api/system/health`);
    const result = await response.json();

    if (response.ok && result.success) {
      console.log('✅ System health API working');
      console.log(`   Overall status: ${result.health.overall}`);
      console.log(`   Services: ${result.health.services.length}`);
      console.log(`   APIs: ${result.health.apis.length}`);
      return true;
    } else {
      console.error('❌ System health failed:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing system health:', error.message);
    return false;
  }
}

async function testUserManagement() {
  console.log('🧪 Testing User Management API...');

  try {
    const response = await fetch(`${DASHBOARD_URL}/api/users?action=stats`);
    const result = await response.json();

    if (response.ok && result.success) {
      console.log('✅ User management API working');
      console.log(`   Total users: ${result.stats.totalUsers}`);
      console.log(`   Active users: ${result.stats.activeUsers}`);
      console.log(`   Top performers: ${result.stats.topUsers.length}`);
      return true;
    } else {
      console.error('❌ User management failed:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing user management:', error.message);
    return false;
  }
}

async function testGameData() {
  console.log('🧪 Testing Game Data API...');

  try {
    const response = await fetch(`${SMART_FORM_URL}/api/games?sport=MLB`);
    const result = await response.json();

    if (response.ok && result.success) {
      console.log('✅ Game data API working');
      console.log(`   Games found: ${result.count}`);
      console.log(`   Data source: ${result.source}`);
      return true;
    } else {
      console.error('❌ Game data failed:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing game data:', error.message);
    return false;
  }
}

async function testCapperData() {
  console.log('🧪 Testing Capper Data API...');

  try {
    const response = await fetch(`${SMART_FORM_URL}/api/cappers`);
    const result = await response.json();

    if (response.ok && result.success) {
      console.log('✅ Capper data API working');
      console.log(`   Cappers found: ${result.cappers.length}`);
      return true;
    } else {
      console.error('❌ Capper data failed:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing capper data:', error.message);
    return false;
  }
}

async function runIntegrationTests() {
  console.log('🚀 Starting Integration Test Suite\n');

  const results = {
    smartFormSubmission: false,
    dashboardAnalytics: false,
    systemHealth: false,
    userManagement: false,
    gameData: false,
    capperData: false,
  };

  // Test all components
  results.smartFormSubmission = (await testSmartFormSubmission()) !== null;
  results.dashboardAnalytics = await testDashboardAnalytics();
  results.systemHealth = await testSystemHealth();
  results.userManagement = await testUserManagement();
  results.gameData = await testGameData();
  results.capperData = await testCapperData();

  // Summary
  console.log('\n📊 Integration Test Results:');
  console.log('==========================================');

  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;

  Object.entries(results).forEach(([test, passed]) => {
    console.log(`   ${passed ? '✅' : '❌'} ${test.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
  });

  console.log('==========================================');
  console.log(
    `   Overall: ${passed}/${total} tests passed (${((passed / total) * 100).toFixed(1)}%)`
  );

  if (passed === total) {
    console.log('🎉 All integration tests passed! System is ready for production.');
  } else {
    console.log('⚠️  Some tests failed. Check the logs above for details.');
  }

  return passed === total;
}

// Run tests if called directly
if (require.main === module) {
  runIntegrationTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { runIntegrationTests };
