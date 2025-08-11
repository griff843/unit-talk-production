#!/usr/bin/env npx tsx
/**
 * Comprehensive Agent Testing Suite Runner
 * 
 * This script runs all agent tests with detailed reporting and performance metrics.
 * It provides a complete testing framework for the 5 new intelligent agents.
 */

import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface TestSuiteResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  tests: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  coverage?: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  errors?: string[];
}

interface TestRunReport {
  timestamp: Date;
  environment: string;
  duration: number;
  suites: TestSuiteResult[];
  summary: {
    totalTests: number;
    totalPassed: number;
    totalFailed: number;
    overallCoverage: number;
    performanceMetrics: {
      avgTestDuration: number;
      memoryUsage: number;
      cpuUsage: number;
    };
  };
}

class AgentTestRunner {
  private testSuites = [
    {
      name: 'Core Agent Functionality',
      file: 'test/agents/NewAgentsTestSuite.test.ts',
      description: 'Tests core initialization, health checks, and basic functionality'
    },
    {
      name: 'Advanced Agent Features',
      file: 'test/agents/AgentSubsystemTests.test.ts',
      description: 'Tests specialized features like ML models, portfolio optimization, and retention strategies'
    },
    {
      name: 'Performance Benchmarks',
      file: 'test/agents/AgentPerformanceTests.test.ts',
      description: 'Performance testing, memory leak detection, and throughput benchmarks'
    },
    {
      name: 'Infrastructure Integration',
      file: 'test/agents/AgentInfrastructureTests.test.ts',
      description: 'Redis caching, circuit breakers, error handling, and resource management'
    }
  ];

  private projectRoot: string;
  private report: TestRunReport;

  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.report = {
      timestamp: new Date(),
      environment: process.env.NODE_ENV || 'test',
      duration: 0,
      suites: [],
      summary: {
        totalTests: 0,
        totalPassed: 0,
        totalFailed: 0,
        overallCoverage: 0,
        performanceMetrics: {
          avgTestDuration: 0,
          memoryUsage: 0,
          cpuUsage: 0
        }
      }
    };
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Comprehensive Agent Testing Suite');
    console.log('================================================\n');

    const startTime = Date.now();

    // Pre-test setup
    await this.setupTestEnvironment();

    // Run each test suite
    for (const suite of this.testSuites) {
      console.log(`\n📋 Running: ${suite.name}`);
      console.log(`   Description: ${suite.description}`);
      console.log(`   File: ${suite.file}`);
      
      const result = await this.runTestSuite(suite);
      this.report.suites.push(result);
      
      this.printSuiteResult(result);
    }

    // Calculate summary
    this.report.duration = Date.now() - startTime;
    this.calculateSummary();

    // Generate report
    await this.generateReport();
    this.printFinalReport();
  }

  private async setupTestEnvironment(): Promise<void> {
    console.log('🔧 Setting up test environment...');
    
    // Ensure test directories exist
    const testDirs = ['test/agents', 'coverage', 'test-results'];
    for (const dir of testDirs) {
      const fullPath = path.join(this.projectRoot, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    }

    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
    process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379';

    console.log('✅ Test environment setup complete\n');
  }

  private async runTestSuite(suite: { name: string; file: string; description: string }): Promise<TestSuiteResult> {
    const startTime = Date.now();
    const result: TestSuiteResult = {
      name: suite.name,
      status: 'failed',
      duration: 0,
      tests: { total: 0, passed: 0, failed: 0, skipped: 0 },
      errors: []
    };

    try {
      // Run Jest with specific configuration for this suite
      const jestCommand = [
        'npx', 'jest',
        suite.file,
        '--verbose',
        '--coverage',
        '--coverageReporters=json',
        '--testTimeout=30000',
        '--detectOpenHandles',
        '--forceExit',
        `--coverageDirectory=coverage/${suite.name.replace(/\s+/g, '-').toLowerCase()}`
      ];

      const testProcess = spawn(jestCommand[0], jestCommand.slice(1), {
        cwd: this.projectRoot,
        stdio: ['inherit', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      let stdout = '';
      let stderr = '';

      testProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      testProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      await new Promise<void>((resolve, reject) => {
        testProcess.on('close', (code) => {
          if (code === 0) {
            result.status = 'passed';
          }
          resolve();
        });

        testProcess.on('error', (error) => {
          result.errors?.push(error.message);
          resolve();
        });
      });

      // Parse test results from output
      this.parseTestOutput(stdout, stderr, result);

      // Read coverage data if available
      await this.readCoverageData(suite.name, result);

    } catch (error) {
      result.errors?.push(error instanceof Error ? error.message : 'Unknown error');
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  private parseTestOutput(stdout: string, stderr: string, result: TestSuiteResult): void {
    // Parse Jest output for test counts
    const testSummaryMatch = stdout.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/);
    if (testSummaryMatch) {
      result.tests.failed = parseInt(testSummaryMatch[1]);
      result.tests.passed = parseInt(testSummaryMatch[2]);
      result.tests.total = parseInt(testSummaryMatch[3]);
    } else {
      // Try alternative pattern
      const passedMatch = stdout.match(/(\d+)\s+passing/);
      const failedMatch = stdout.match(/(\d+)\s+failing/);
      
      if (passedMatch) result.tests.passed = parseInt(passedMatch[1]);
      if (failedMatch) result.tests.failed = parseInt(failedMatch[1]);
      result.tests.total = result.tests.passed + result.tests.failed;
    }

    // Extract errors from stderr
    if (stderr) {
      const errorLines = stderr.split('\n').filter(line => 
        line.includes('Error:') || line.includes('Failed:') || line.includes('✕')
      );
      result.errors?.push(...errorLines);
    }
  }

  private async readCoverageData(suiteName: string, result: TestSuiteResult): Promise<void> {
    try {
      const coverageDir = path.join(this.projectRoot, 'coverage', suiteName.replace(/\s+/g, '-').toLowerCase());
      const coverageFile = path.join(coverageDir, 'coverage-final.json');
      
      if (fs.existsSync(coverageFile)) {
        const coverageData = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
        
        // Calculate overall coverage percentages
        let totalStatements = 0, coveredStatements = 0;
        let totalBranches = 0, coveredBranches = 0;
        let totalFunctions = 0, coveredFunctions = 0;
        const totalLines = 0, coveredLines = 0;

        Object.values(coverageData).forEach((file: any) => {
          totalStatements += file.s ? Object.keys(file.s).length : 0;
          coveredStatements += file.s ? Object.values(file.s).filter((v: any) => v > 0).length : 0;
          
          totalBranches += file.b ? Object.keys(file.b).length : 0;
          coveredBranches += file.b ? Object.values(file.b).filter((branches: any) => 
            Array.isArray(branches) && branches.some(b => b > 0)
          ).length : 0;
          
          totalFunctions += file.f ? Object.keys(file.f).length : 0;
          coveredFunctions += file.f ? Object.values(file.f).filter((v: any) => v > 0).length : 0;
        });

        result.coverage = {
          statements: totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0,
          branches: totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0,
          functions: totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 0,
          lines: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0
        };
      }
    } catch (error) {
      // Coverage data unavailable
    }
  }

  private calculateSummary(): void {
    this.report.summary.totalTests = this.report.suites.reduce((sum, suite) => sum + suite.tests.total, 0);
    this.report.summary.totalPassed = this.report.suites.reduce((sum, suite) => sum + suite.tests.passed, 0);
    this.report.summary.totalFailed = this.report.suites.reduce((sum, suite) => sum + suite.tests.failed, 0);

    // Calculate average coverage
    const suitesWithCoverage = this.report.suites.filter(suite => suite.coverage);
    if (suitesWithCoverage.length > 0) {
      this.report.summary.overallCoverage = suitesWithCoverage.reduce((sum, suite) => 
        sum + (suite.coverage?.statements || 0), 0
      ) / suitesWithCoverage.length;
    }

    // Calculate performance metrics
    this.report.summary.performanceMetrics.avgTestDuration = 
      this.report.suites.reduce((sum, suite) => sum + suite.duration, 0) / this.report.suites.length;

    const memoryUsage = process.memoryUsage();
    this.report.summary.performanceMetrics.memoryUsage = memoryUsage.heapUsed / 1024 / 1024; // MB
  }

  private printSuiteResult(result: TestSuiteResult): void {
    const status = result.status === 'passed' ? '✅' : '❌';
    const duration = (result.duration / 1000).toFixed(2);
    
    console.log(`   ${status} Status: ${result.status.toUpperCase()}`);
    console.log(`   ⏱️  Duration: ${duration}s`);
    console.log(`   📊 Tests: ${result.tests.passed}/${result.tests.total} passed`);
    
    if (result.coverage) {
      console.log(`   📈 Coverage: ${result.coverage.statements.toFixed(1)}% statements`);
    }
    
    if (result.errors && result.errors.length > 0) {
      console.log(`   ⚠️  Errors: ${result.errors.length}`);
    }
  }

  private async generateReport(): Promise<void> {
    const reportPath = path.join(this.projectRoot, 'test-results', 'agent-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.report, null, 2));

    // Generate HTML report
    await this.generateHtmlReport();
  }

  private async generateHtmlReport(): Promise<void> {
    const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
    <title>Agent Testing Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
        .suite { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .passed { border-left: 5px solid #4caf50; }
        .failed { border-left: 5px solid #f44336; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .metric { background: #f9f9f9; padding: 10px; border-radius: 3px; }
        .error { background: #ffebee; padding: 10px; margin: 10px 0; border-radius: 3px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧪 Agent Testing Report</h1>
        <p><strong>Generated:</strong> ${this.report.timestamp.toISOString()}</p>
        <p><strong>Environment:</strong> ${this.report.environment}</p>
        <p><strong>Duration:</strong> ${(this.report.duration / 1000).toFixed(2)}s</p>
    </div>

    <div class="metrics">
        <div class="metric">
            <h3>Tests</h3>
            <p>${this.report.summary.totalPassed}/${this.report.summary.totalTests} passed</p>
        </div>
        <div class="metric">
            <h3>Coverage</h3>
            <p>${this.report.summary.overallCoverage.toFixed(1)}%</p>
        </div>
        <div class="metric">
            <h3>Avg Duration</h3>
            <p>${(this.report.summary.performanceMetrics.avgTestDuration / 1000).toFixed(2)}s</p>
        </div>
        <div class="metric">
            <h3>Memory Usage</h3>
            <p>${this.report.summary.performanceMetrics.memoryUsage.toFixed(1)}MB</p>
        </div>
    </div>

    ${this.report.suites.map(suite => `
        <div class="suite ${suite.status}">
            <h2>${suite.name}</h2>
            <p><strong>Status:</strong> ${suite.status.toUpperCase()}</p>
            <p><strong>Duration:</strong> ${(suite.duration / 1000).toFixed(2)}s</p>
            <p><strong>Tests:</strong> ${suite.tests.passed}/${suite.tests.total} passed</p>
            ${suite.coverage ? `<p><strong>Coverage:</strong> ${suite.coverage.statements.toFixed(1)}%</p>` : ''}
            ${suite.errors && suite.errors.length > 0 ? `
                <h3>Errors:</h3>
                ${suite.errors.map(error => `<div class="error">${error}</div>`).join('')}
            ` : ''}
        </div>
    `).join('')}
</body>
</html>`;

    const htmlPath = path.join(this.projectRoot, 'test-results', 'agent-test-report.html');
    fs.writeFileSync(htmlPath, htmlTemplate);
  }

  private printFinalReport(): void {
    console.log('\n\n📊 FINAL TEST REPORT');
    console.log('====================');
    console.log(`🕐 Total Duration: ${(this.report.duration / 1000).toFixed(2)}s`);
    console.log(`📋 Test Suites: ${this.report.suites.length}`);
    console.log(`✅ Tests Passed: ${this.report.summary.totalPassed}/${this.report.summary.totalTests}`);
    console.log(`📈 Overall Coverage: ${this.report.summary.overallCoverage.toFixed(1)}%`);
    console.log(`💾 Memory Usage: ${this.report.summary.performanceMetrics.memoryUsage.toFixed(1)}MB`);
    
    const successRate = (this.report.summary.totalPassed / this.report.summary.totalTests) * 100;
    console.log(`🎯 Success Rate: ${successRate.toFixed(1)}%`);

    if (successRate >= 95) {
      console.log('\n🎉 EXCELLENT! All agents are performing optimally.');
    } else if (successRate >= 85) {
      console.log('\n👍 GOOD! Most tests passed. Review failing tests.');
    } else {
      console.log('\n⚠️  WARNING! Significant test failures detected. Investigation required.');
    }

    console.log('\n📁 Reports generated:');
    console.log(`   - JSON: test-results/agent-test-report.json`);
    console.log(`   - HTML: test-results/agent-test-report.html`);
  }
}

// Run the test suite if this script is executed directly
if (require.main === module) {
  const runner = new AgentTestRunner();
  runner.runAllTests().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

export { AgentTestRunner };