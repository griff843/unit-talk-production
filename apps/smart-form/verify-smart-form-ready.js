#!/usr/bin/env node

/**
 * Smart Form V3.0.0 Readiness Verification
 *
 * Quick verification script to check if Smart Form is ready for testing
 * with v3.0.0 unified database tables
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Smart Form V3.0.0 Readiness Check');
console.log('====================================\n');

async function checkServerAvailability() {
  console.log('📡 Checking server availability...');

  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3002';

  try {
    const response = await fetch(baseUrl);
    if (response.ok) {
      console.log(`✅ Smart Form server is accessible at ${baseUrl}`);
      return true;
    } else {
      console.log(`❌ Server responded with status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Server not accessible: ${error.message}`);
    console.log('   Please start the Smart Form development server:');
    console.log('   cd apps/smart-form && npm run dev');
    return false;
  }
}

async function checkApiEndpoints() {
  console.log('\n🔌 Checking API endpoints...');

  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3002';
  const endpoints = [
    { path: '/api/cappers', name: 'Cappers API (v3.0.0 users table)' },
    { path: '/api/games?sport=MLB', name: 'Games API (v3.0.0 games/teams tables)' },
    { path: '/api/props?sport=MLB&limit=5', name: 'Props API (v3.0.0 raw_props table)' },
  ];

  let allEndpointsWorking = true;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${baseUrl}${endpoint.path}`);
      const data = await response.json();

      if (response.ok) {
        console.log(`✅ ${endpoint.name}: Status ${response.status}`);

        // Quick data validation
        if (endpoint.path.includes('/cappers') && data.cappers) {
          console.log(`   📊 Found ${data.cappers.length} cappers`);
        } else if (endpoint.path.includes('/games') && data.games) {
          console.log(`   📊 Found ${data.games.length} games`);
        } else if (endpoint.path.includes('/props') && data.props) {
          console.log(`   📊 Found ${data.props.length} props`);
        }
      } else {
        console.log(`⚠️  ${endpoint.name}: Status ${response.status}`);
        console.log(`   Error: ${data.error || 'Unknown error'}`);
        allEndpointsWorking = false;
      }
    } catch (error) {
      console.log(`❌ ${endpoint.name}: ${error.message}`);
      allEndpointsWorking = false;
    }
  }

  return allEndpointsWorking;
}

async function checkDatabaseTables() {
  console.log('\n💾 Checking v3.0.0 database table availability...');

  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3002';

  // Test a simple database query through the API
  try {
    const response = await fetch(`${baseUrl}/api/cappers`);
    const data = await response.json();

    if (response.ok && data.cappers) {
      console.log('✅ V3.0.0 unified tables accessible through API');
      console.log(
        `   📊 Database connectivity verified with ${data.cappers.length} capper records`
      );

      if (data.cappers.length === 0) {
        console.log('   ⚠️  No capper data found - tests may need seed data');
      }

      return true;
    } else {
      console.log('❌ Database tables not accessible');
      console.log(`   Error: ${data.error || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Database check failed: ${error.message}`);
    return false;
  }
}

function checkTestFiles() {
  console.log('\n📁 Checking test files...');

  const testDir = path.join(__dirname, 'tests');
  const requiredTestFiles = [
    'v3-unified-smart-form-workflow.spec.ts',
    'v3-database-integration.spec.ts',
    'v3-performance-and-errors.spec.ts',
    'test-setup.ts',
  ];

  let allFilesExist = true;

  for (const testFile of requiredTestFiles) {
    const filePath = path.join(testDir, testFile);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log(`✅ ${testFile} (${Math.round(stats.size / 1024)}kb)`);
    } else {
      console.log(`❌ ${testFile} - File not found`);
      allFilesExist = false;
    }
  }

  return allFilesExist;
}

function checkConfiguration() {
  console.log('\n⚙️ Checking configuration...');

  // Check environment variables
  const envVars = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3002 (default)',
  };

  let configComplete = true;

  for (const [key, value] of Object.entries(envVars)) {
    if (value) {
      const displayValue = key.includes('KEY') ? '***' + value.slice(-4) : value;
      console.log(`✅ ${key}: ${displayValue}`);
    } else {
      console.log(`⚠️  ${key}: Not set`);
      if (key.includes('SUPABASE')) {
        configComplete = false;
      }
    }
  }

  // Check package.json for required dependencies
  const packageJsonPath = path.join(__dirname, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    const requiredDeps = ['@playwright/test', '@supabase/supabase-js'];
    const missingDeps = requiredDeps.filter(
      dep => !packageJson.dependencies?.[dep] && !packageJson.devDependencies?.[dep]
    );

    if (missingDeps.length === 0) {
      console.log('✅ Required dependencies installed');
    } else {
      console.log(`❌ Missing dependencies: ${missingDeps.join(', ')}`);
      configComplete = false;
    }
  }

  return configComplete;
}

function checkPlaywrightSetup() {
  console.log('\n🎭 Checking Playwright setup...');

  const playwrightConfigPath = path.join(__dirname, 'playwright.config.ts');
  if (fs.existsSync(playwrightConfigPath)) {
    console.log('✅ Playwright configuration found');

    const config = fs.readFileSync(playwrightConfigPath, 'utf8');
    if (config.includes('baseURL')) {
      console.log('✅ Base URL configured in Playwright');
    } else {
      console.log('⚠️  Base URL not configured in Playwright config');
    }

    return true;
  } else {
    console.log('❌ Playwright configuration not found');
    return false;
  }
}

function generateReadinessReport(checks) {
  console.log('\n📋 READINESS SUMMARY');
  console.log('═'.repeat(50));

  const totalChecks = Object.keys(checks).length;
  const passedChecks = Object.values(checks).filter(Boolean).length;

  console.log(`✅ Passed: ${passedChecks}/${totalChecks}`);
  console.log(`❌ Failed: ${totalChecks - passedChecks}/${totalChecks}`);

  Object.entries(checks).forEach(([check, passed]) => {
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${check}`);
  });

  if (passedChecks === totalChecks) {
    console.log('\n🎉 Smart Form is ready for V3.0.0 testing!');
    console.log('\n🚀 Run tests with:');
    console.log('   node run-v3-tests.js');
    console.log('   node run-v3-tests.js --critical-only');
    console.log('   node run-v3-tests.js --headed --debug');
    return true;
  } else {
    console.log('\n⚠️  Smart Form has some readiness issues');
    console.log('\n🔧 Next steps:');

    if (!checks['Server Availability']) {
      console.log('   • Start the Smart Form development server: npm run dev');
    }
    if (!checks['Database Tables']) {
      console.log('   • Check database connectivity and v3.0.0 schema');
      console.log('   • Ensure Supabase environment variables are set');
    }
    if (!checks['Test Files']) {
      console.log('   • Ensure all test files are created');
    }
    if (!checks['Configuration']) {
      console.log('   • Set missing environment variables');
      console.log('   • Install missing dependencies');
    }
    if (!checks['Playwright Setup']) {
      console.log('   • Configure Playwright: npx playwright install');
    }

    return false;
  }
}

async function main() {
  console.log('⏱️  Starting readiness check...\n');

  const checks = {
    'Server Availability': await checkServerAvailability(),
    'API Endpoints': await checkApiEndpoints(),
    'Database Tables': await checkDatabaseTables(),
    'Test Files': checkTestFiles(),
    Configuration: checkConfiguration(),
    'Playwright Setup': checkPlaywrightSetup(),
  };

  const isReady = generateReadinessReport(checks);

  if (isReady) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

// Handle errors
process.on('unhandledRejection', error => {
  console.error('\n💥 Unhandled error:', error);
  process.exit(1);
});

// Run verification
if (require.main === module) {
  main().catch(error => {
    console.error('\n💥 Verification error:', error);
    process.exit(1);
  });
}
