#!/usr/bin/env node

/**
 * Unit Talk Launch QA Execution Script
 * Run comprehensive QA testing for launch readiness
 */

import LaunchQARunner from '../qa/run-launch-qa';
import * as path from 'path';

async function main() {
  console.log('🚀 Unit Talk Launch QA Process');
  console.log('=====================================\n');

  try {
    // Get environment from command line args or default to 'test'
    const environment = process.argv[2] || 'test';
    
    console.log(`Running QA tests for environment: ${environment}`);
    
    // Create and run QA runner
    const runner = new LaunchQARunner(environment);
    const assessment = await runner.runLaunchQA();
    
    // Exit with appropriate code
    const exitCode = assessment.overallStatus === 'READY' ? 0 : 1;
    
    console.log(`\n🎯 QA Assessment Complete: ${assessment.overallStatus}`);
    console.log(`📊 Readiness Score: ${assessment.readinessScore}%`);
    
    if (assessment.criticalIssues.length > 0) {
      console.log(`❌ Critical Issues: ${assessment.criticalIssues.length}`);
    }
    
    if (assessment.warnings.length > 0) {
      console.log(`⚠️  Warnings: ${assessment.warnings.length}`);
    }
    
    process.exit(exitCode);
    
  } catch (error) {
    console.error('❌ QA execution failed:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

if (require.main === module) {
  main();
}