#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class OpsGreen {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
    this.allowWrites = process.env.ALLOW_WRITES === 'true';
  }

  async runScript(name, scriptPath, args = []) {
    const start = Date.now();
    console.log(`\n🔧 Running: ${name}`);
    console.log(`📄 Script: ${scriptPath}`);
    
    return new Promise((resolve) => {
      const child = spawn('node', [scriptPath, ...args], {
        stdio: 'inherit',
        cwd: process.cwd()
      });

      child.on('close', (code) => {
        const duration = Date.now() - start;
        const status = code === 0 ? 'PASS' : 'FAIL';
        
        console.log(`${status === 'PASS' ? '✅' : '❌'} ${name} - ${duration}ms - Exit code: ${code}`);
        
        this.results.push({
          name,
          scriptPath,
          status,
          duration,
          exitCode: code
        });
        
        resolve();
      });

      child.on('error', (error) => {
        const duration = Date.now() - start;
        console.log(`❌ ${name} - ${duration}ms - Error: ${error.message}`);
        
        this.results.push({
          name,
          scriptPath,
          status: 'FAIL',
          duration,
          exitCode: -1,
          error: error.message
        });
        
        resolve();
      });
    });
  }

  async run() {
    console.log('🚀 Starting Ops Green - Production Readiness Check');
    console.log(`📝 Write operations: ${this.allowWrites ? 'ENABLED' : 'DISABLED (read-only)'}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`⏰ Started at: ${new Date().toISOString()}`);

    // P0 Tasks - Critical for production
    console.log('\n🔴 P0 - Critical Production Checks');
    
    await this.runScript(
      'Package Verification',
      'scripts/ops/verify-packages.js'
    );
    
    await this.runScript(
      'Environment Validation',
      'scripts/ops/validate-env.js'
    );
    
    await this.runScript(
      'No Mocks Assertion',
      'scripts/ops/assert-no-mocks.js'
    );

    // P1 Tasks - Important for production
    console.log('\n🟡 P1 - Important Production Checks');
    
    await this.runScript(
      'Production E2E Tests',
      'scripts/e2e/prod-e2e.js'
    );

    // P2 Tasks - Nice to have
    console.log('\n🟢 P2 - Additional Checks');
    
    await this.runScript(
      'API Module Verification',
      'scripts/ops/verify-api-module.js'
    );

    // Calculate summary
    const totalDuration = Date.now() - this.startTime;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;

    let overall = 'PASS';
    if (failed > 0) {
      overall = 'FAIL';
    }

    const summary = {
      timestamp: new Date().toISOString(),
      overall,
      totalChecks: this.results.length,
      passed,
      failed,
      totalDuration,
      environment: process.env.NODE_ENV || 'development',
      allowWrites: this.allowWrites
    };

    return {
      summary,
      results: this.results
    };
  }
}

async function main() {
  const opsGreen = new OpsGreen();
  const results = await opsGreen.run();
  
  // Ensure output directory exists
  const outDir = path.join(process.cwd(), 'out', 'ops');
  fs.mkdirSync(outDir, { recursive: true });
  
  // Write results
  const resultsPath = path.join(outDir, 'ops-green.results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  
  // Write summary
  const summaryPath = path.join(outDir, 'ops-green.summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(results.summary, null, 2));
  
  // Log final results
  console.log(`\n\n📊 Ops Green Summary:`);
  console.log(`Overall Status: ${results.summary.overall === 'PASS' ? '✅ PRODUCTION READY' : '❌ NOT READY'}`);
  console.log(`Checks: ${results.summary.passed}✅ ${results.summary.failed}❌`);
  console.log(`Duration: ${results.summary.totalDuration}ms`);
  
  if (results.summary.failed > 0) {
    console.log(`\n❌ Failed checks:`);
    for (const result of results.results.filter(r => r.status === 'FAIL')) {
      console.log(`  ${result.name} (${result.scriptPath})`);
      if (result.error) {
        console.log(`    Error: ${result.error}`);
      }
    }
  }
  
  console.log(`\n📄 Results: ${resultsPath}`);
  console.log(`📄 Summary: ${summaryPath}`);
  
  if (results.summary.overall === 'PASS') {
    console.log(`\n🎉 PRODUCTION READY! All critical checks passed.`);
  } else {
    console.log(`\n⚠️  NOT PRODUCTION READY. Please fix failed checks before deploying.`);
  }
  
  process.exit(results.summary.overall === 'FAIL' ? 1 : 0);
}

if (require.main === module) {
  main().catch(console.error);
}
