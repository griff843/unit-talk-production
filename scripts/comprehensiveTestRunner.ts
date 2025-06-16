
#!/usr/bin/env tsx

import { execSync } from 'child_process';

class ComprehensiveTestRunner {
  async runAllTests(): Promise<void> {
    console.log('🧪 COMPREHENSIVE TEST SUITE EXECUTION');
    console.log('=====================================\n');

    const testSuites = [
      { name: 'Unit Tests', command: 'npm test -- --testPathPattern=\.test\.' },
      { name: 'Integration Tests', command: 'npm test -- --testPathPattern=integration' },
      { name: 'Agent Tests', command: 'npx tsx scripts/testCoreAgents.ts' }
    ];

    const results = [];

    for (const suite of testSuites) {
      console.log(`🔍 Running ${suite.name}...`);
      try {
        const output = execSync(suite.command, { encoding: 'utf8', timeout: 30000 });
        console.log(`✅ ${suite.name}: PASSED`);
        results.push({ name: suite.name, status: 'PASSED', output });
      } catch (error) {
        console.log(`⚠️ ${suite.name}: NEEDS ATTENTION`);
        results.push({ name: suite.name, status: 'FAILED', error: error.message });
      }
    }

    console.log('\n📊 TEST SUITE SUMMARY:');
    console.log('======================');
    results.forEach(result => {
      console.log(`${result.status === 'PASSED' ? '✅' : '❌'} ${result.name}: ${result.status}`);
    });

    const passRate = (results.filter(r => r.status === 'PASSED').length / results.length) * 100;
    console.log(`\n📈 Overall Pass Rate: ${passRate.toFixed(1)}%`);
    
    if (passRate >= 80) {
      console.log('🎉 Test suite meets production standards!');
    } else {
      console.log('⚠️ Test suite needs improvement before production');
    }
  }
}

const runner = new ComprehensiveTestRunner();
runner.runAllTests().catch(console.error);
