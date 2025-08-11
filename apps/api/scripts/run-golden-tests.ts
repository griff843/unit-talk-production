#!/usr/bin/env npx tsx

/**
 * Golden Test Runner for Professional Grading System
 * Executes and validates all golden tests that lock critical behavior
 * THESE TESTS MUST PASS 100% - NO EXCEPTIONS
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

interface TestResult {
  suite: string;
  passed: boolean;
  tests: number;
  failures: number;
  duration: number;
  output: string;
  failureDetails?: string[];
}

class GoldenTestRunner {
  private readonly GOLDEN_TEST_PATTERN = 'test/professional/*.golden.test.ts';
  private readonly RESULTS_DIR = 'golden-test-results';
  private readonly MAX_EXECUTION_TIME = 300000; // 5 minutes max per suite

  async runAllGoldenTests(): Promise<void> {
    console.log('🏆 PROFESSIONAL GRADING GOLDEN TESTS');
    console.log('=====================================');
    console.log('⚠️  CRITICAL: These tests lock professional behavior');
    console.log('⚠️  100% pass rate required for production deployment\n');

    // Ensure results directory exists
    await this.ensureResultsDirectory();

    // Set environment for golden tests
    await this.setGoldenTestEnvironment();

    const suites = await this.discoverGoldenTestSuites();
    const results: TestResult[] = [];

    for (const suite of suites) {
      console.log(`🧪 Running ${suite}...`);
      const result = await this.runTestSuite(suite);
      results.push(result);
      
      this.printSuiteResult(result);
      await this.saveResult(result);
    }

    await this.generateSummaryReport(results);
    await this.validateGoldenCompliance(results);
  }

  private async ensureResultsDirectory(): Promise<void> {
    const resultsPath = path.resolve(this.RESULTS_DIR);
    if (!fs.existsSync(resultsPath)) {
      fs.mkdirSync(resultsPath, { recursive: true });
    }
  }

  private async setGoldenTestEnvironment(): Promise<void> {
    // Set strict golden test environment
    process.env.NODE_ENV = 'test';
    process.env.GOLDEN_TEST_MODE = 'true';
    process.env.USE_PRO_SCORER = 'true';
    process.env.SCORING_DEBUG = 'false';
    process.env.JEST_TIMEOUT = '30000';
    process.env.DISABLE_LOGGING = 'true';
  }

  private async discoverGoldenTestSuites(): Promise<string[]> {
    const testDir = path.resolve('test/professional');
    const files = fs.readdirSync(testDir);
    
    return files
      .filter(file => file.endsWith('.golden.test.ts'))
      .map(file => path.join(testDir, file));
  }

  private async runTestSuite(suitePath: string): Promise<TestResult> {
    const suiteName = path.basename(suitePath, '.golden.test.ts');
    const startTime = Date.now();

    try {
      const { stdout, stderr } = await execAsync(
        `npx jest "${suitePath}" --verbose --no-cache --testTimeout=${this.MAX_EXECUTION_TIME}`,
        { timeout: this.MAX_EXECUTION_TIME }
      );

      const duration = Date.now() - startTime;
      const output = stdout + stderr;

      // Parse Jest output for results
      const testResults = this.parseJestOutput(output);

      return {
        suite: suiteName,
        passed: testResults.failures === 0,
        tests: testResults.tests,
        failures: testResults.failures,
        duration,
        output,
        failureDetails: testResults.failureDetails
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      return {
        suite: suiteName,
        passed: false,
        tests: 0,
        failures: 1,
        duration,
        output: error.stdout || '',
        failureDetails: [error.message || 'Test execution failed']
      };
    }
  }

  private parseJestOutput(output: string): { tests: number; failures: number; failureDetails: string[] } {
    // Parse Jest output for test counts and failures
    const testMatch = output.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/);
    const passOnlyMatch = output.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+total/);
    const failureDetails: string[] = [];

    let tests = 0;
    let failures = 0;

    if (testMatch) {
      failures = parseInt(testMatch[1]);
      tests = parseInt(testMatch[3]);
    } else if (passOnlyMatch) {
      failures = 0;
      tests = parseInt(passOnlyMatch[2]);
    }

    // Extract failure details
    const failureMatches = output.matchAll(/● (.*?)(?=\n\n|\n  ● |$)/gs);
    for (const match of failureMatches) {
      failureDetails.push(match[1].trim());
    }

    return { tests, failures, failureDetails };
  }

  private printSuiteResult(result: TestResult): void {
    const status = result.passed ? '✅' : '❌';
    const duration = (result.duration / 1000).toFixed(2);
    
    console.log(`${status} ${result.suite}: ${result.tests} tests, ${result.failures} failures (${duration}s)`);
    
    if (result.failures > 0) {
      console.log('   💥 FAILURE DETAILS:');
      result.failureDetails?.forEach(detail => {
        console.log(`   • ${detail.split('\n')[0]}`); // First line only
      });
    }
    
    console.log('');
  }

  private async saveResult(result: TestResult): Promise<void> {
    const resultFile = path.join(this.RESULTS_DIR, `${result.suite}-result.json`);
    const detailedResult = {
      ...result,
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        goldenTestMode: process.env.GOLDEN_TEST_MODE,
        useProScorer: process.env.USE_PRO_SCORER,
        scoringDebug: process.env.SCORING_DEBUG
      }
    };

    fs.writeFileSync(resultFile, JSON.stringify(detailedResult, null, 2));
  }

  private async generateSummaryReport(results: TestResult[]): Promise<void> {
    const totalTests = results.reduce((sum, r) => sum + r.tests, 0);
    const totalFailures = results.reduce((sum, r) => sum + r.failures, 0);
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const passedSuites = results.filter(r => r.passed).length;

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalSuites: results.length,
        passedSuites,
        failedSuites: results.length - passedSuites,
        totalTests,
        totalFailures,
        passRate: ((totalTests - totalFailures) / totalTests * 100).toFixed(2),
        totalDurationMs: totalDuration,
        totalDurationSeconds: (totalDuration / 1000).toFixed(2)
      },
      suiteResults: results.map(r => ({
        suite: r.suite,
        passed: r.passed,
        tests: r.tests,
        failures: r.failures,
        duration: r.duration,
        passRate: r.tests > 0 ? ((r.tests - r.failures) / r.tests * 100).toFixed(2) : '0.00'
      })),
      failedSuites: results.filter(r => !r.passed).map(r => ({
        suite: r.suite,
        failures: r.failures,
        failureDetails: r.failureDetails
      }))
    };

    const reportFile = path.join(this.RESULTS_DIR, 'golden-test-summary.json');
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    // Print summary
    console.log('📊 GOLDEN TEST SUMMARY');
    console.log('=======================');
    console.log(`Total Suites: ${report.summary.totalSuites}`);
    console.log(`Passed Suites: ${report.summary.passedSuites}`);
    console.log(`Failed Suites: ${report.summary.failedSuites}`);
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Total Failures: ${report.summary.totalFailures}`);
    console.log(`Pass Rate: ${report.summary.passRate}%`);
    console.log(`Total Duration: ${report.summary.totalDurationSeconds}s\n`);
  }

  private async validateGoldenCompliance(results: TestResult[]): Promise<void> {
    const failed = results.filter(r => !r.passed);
    
    if (failed.length > 0) {
      console.log('🚨 GOLDEN TEST FAILURES DETECTED');
      console.log('==================================');
      console.log('❌ CRITICAL: Professional grading behavior has regressed');
      console.log('❌ Production deployment is BLOCKED until all tests pass');
      console.log('❌ Review locked values and restore expected behavior\n');

      failed.forEach(result => {
        console.log(`💥 FAILED SUITE: ${result.suite}`);
        console.log(`   Tests: ${result.tests}, Failures: ${result.failures}`);
        if (result.failureDetails) {
          result.failureDetails.forEach(detail => {
            console.log(`   • ${detail}`);
          });
        }
        console.log('');
      });

      // Exit with error code to block CI/CD
      process.exit(1);
    } else {
      console.log('🎉 ALL GOLDEN TESTS PASSED!');
      console.log('============================');
      console.log('✅ Professional grading behavior is locked and validated');
      console.log('✅ System is ready for production deployment');
      console.log('✅ All critical calculations verified\n');

      // Create success marker for CI/CD
      const successFile = path.join(this.RESULTS_DIR, 'golden-tests-passed.marker');
      fs.writeFileSync(successFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        totalTests: results.reduce((sum, r) => sum + r.tests, 0),
        passRate: '100.00%',
        status: 'PASSED'
      }, null, 2));
    }
  }
}

// Execute if called directly
if (require.main === module) {
  const runner = new GoldenTestRunner();
  
  runner.runAllGoldenTests().catch(error => {
    console.error('💥 Golden test runner failed:', error);
    process.exit(1);
  });
}

export { GoldenTestRunner };