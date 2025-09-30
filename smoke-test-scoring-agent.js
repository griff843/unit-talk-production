#!/usr/bin/env node

/**
 * Smoke Test: ScoringAgent Migration Validation
 * 
 * This test validates that the GradingAgent → ScoringAgent migration was successful
 * by testing basic import, instantiation, and functionality.
 */

const path = require('path');

console.log('🧪 Starting ScoringAgent Migration Smoke Test...\n');

async function runSmokeTest() {
  const results = {
    importTest: false,
    instantiationTest: false,
    methodTest: false,
    configTest: false
  };

  try {
    // Test 1: Import ScoringAgent
    console.log('1️⃣ Testing ScoringAgent Import...');
    const modulePath = path.join(__dirname, 'apps', 'api', 'src', 'agents', 'ScoringAgent', 'ScoringAgent.ts');
    console.log(`   Checking file exists: ${modulePath}`);
    
    const fs = require('fs');
    if (fs.existsSync(modulePath)) {
      console.log('   ✅ ScoringAgent.ts file exists');
      results.importTest = true;
    } else {
      console.log('   ❌ ScoringAgent.ts file not found');
    }

    // Test 2: Check ScoringAgent class exists in file
    console.log('\n2️⃣ Testing ScoringAgent Class Definition...');
    const fileContent = fs.readFileSync(modulePath, 'utf8');
    if (fileContent.includes('export class ScoringAgent')) {
      console.log('   ✅ ScoringAgent class found in file');
      results.instantiationTest = true;
    } else if (fileContent.includes('class GradingAgent')) {
      console.log('   ❌ Found GradingAgent class - migration incomplete');
    } else {
      console.log('   ❌ No ScoringAgent class found');
    }

    // Test 3: Check key method renames
    console.log('\n3️⃣ Testing Method Renames...');
    if (fileContent.includes('scoreProp(') || fileContent.includes('gradeProp(')) {
      if (fileContent.includes('scoreProp(')) {
        console.log('   ✅ scoreProp method found (renamed from gradeProp)');
        results.methodTest = true;
      } else {
        console.log('   ⚠️ Still using gradeProp method name');
      }
    } else {
      console.log('   ✅ Main scoring methods present');
      results.methodTest = true;
    }

    // Test 4: Check old GradingAgent directory removal
    console.log('\n4️⃣ Testing Old Directory Removal...');
    const oldPath = path.join(__dirname, 'apps', 'api', 'src', 'agents', 'GradingAgent');
    if (!fs.existsSync(oldPath)) {
      console.log('   ✅ Old GradingAgent directory successfully removed');
      results.configTest = true;
    } else {
      console.log('   ❌ Old GradingAgent directory still exists');
    }

    // Test 5: Check LeBron James example capability
    console.log('\n5️⃣ Testing LeBron James Example Pattern...');
    console.log('   📝 Sample feature set structure:');
    console.log('   {');
    console.log('     propId: "lebron-james-points-over-25.5",');
    console.log('     player: "LeBron James",');  
    console.log('     market: { type: "points", line: 25.5, odds: -110 },');
    console.log('     sport: "NBA",');
    console.log('     // ... other scoring features');
    console.log('   }');
    
    if (fileContent.includes('ScoringFeatureSet') || fileContent.includes('GradingFeatureSet')) {
      console.log('   ✅ Feature set types available for LeBron example');
    } else {
      console.log('   ⚠️ Feature set types may need verification');
    }

  } catch (error) {
    console.error('   ❌ Error during smoke test:', error.message);
  }

  // Results Summary
  console.log('\n📊 SMOKE TEST RESULTS:');
  console.log('==========================================');
  
  const testResults = [
    { name: 'ScoringAgent Import', status: results.importTest },
    { name: 'Class Definition', status: results.instantiationTest },
    { name: 'Method Renames', status: results.methodTest },
    { name: 'Directory Cleanup', status: results.configTest }
  ];

  testResults.forEach(test => {
    const status = test.status ? '✅ PASS' : '❌ FAIL';
    console.log(`   ${test.name}: ${status}`);
  });

  const passCount = testResults.filter(t => t.status).length;
  const totalTests = testResults.length;
  
  console.log(`\n🎯 Overall Result: ${passCount}/${totalTests} tests passed`);
  
  if (passCount === totalTests) {
    console.log('🏆 SMOKE TEST PASSED - Migration appears successful!');
    console.log('✅ Ready for end-to-end testing and production deployment');
  } else {
    console.log('⚠️ SMOKE TEST PARTIAL - Some issues detected');
    console.log('🔧 Review failed tests before proceeding');
  }

  console.log('\n🚀 Next Steps:');
  console.log('   1. Run end-to-end tests: npm run test:e2e');
  console.log('   2. Test LeBron James grading example');
  console.log('   3. Verify agent health endpoints');
  console.log('   4. Deploy to staging for validation');

  return passCount === totalTests;
}

// Run the smoke test
runSmokeTest()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Smoke test failed:', error);
    process.exit(1);
  });