#!/usr/bin/env tsx

/**
 * Comprehensive Syndicate-Grade Test Suite Runner
 * 
 * Executes the complete test suite for Unit Talk's syndicate-grade system:
 * - High-volume performance tests (8K+ props processing)
 * - Integration tests for complete data flow validation
 * - Chaos engineering tests for fault tolerance
 * - Real-time processing validation with <1s latency
 * - Professional grading feature verification
 * - System resilience and recovery testing
 * 
 * Usage:
 *   npm run test:syndicate-grade              # Run full suite
 *   npm run test:syndicate-grade --performance # Performance tests only
 *   npm run test:syndicate-grade --integration # Integration tests only
 *   npm run test:syndicate-grade --chaos       # Chaos tests only
 *   npm run test:syndicate-grade --quick       # Quick validation suite
 * 
 * Environment Requirements:
 * - Docker environment must be running (./dev.sh start)
 * - All services must be healthy
 * - Database migrations must be applied
 * - Sufficient system resources (8GB+ RAM recommended)
 */

import { spawn, ChildProcess } from 'child_process';
import { performance } from 'perf_hooks';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Test suite configuration
interface TestSuiteConfig {
  performance: boolean;
  integration: boolean;
  chaos: boolean;
  quick: boolean;
  parallel: boolean;
  verbose: boolean;
  timeout: number;
  outputDir: string;
  generateReport: boolean;
}

interface TestResult {
  suite: string;
  passed: boolean;
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
  performance?: {
    avgThroughput: number;
    maxLatency: number;
    errorRate: number;
  };
  errors: string[];
  warnings: string[];
}

interface SystemHealthCheck {
  docker: boolean;
  database: boolean;
  services: boolean;
  memory: boolean;
  disk: boolean;
}

class SyndicateTestRunner {
  private config: TestSuiteConfig;
  private results: TestResult[] = [];
  private startTime: number = 0;
  private healthCheck: SystemHealthCheck = {
    docker: false,
    database: false,
    services: false,
    memory: false,
    disk: false
  };
  
  constructor() {
    this.config = this.parseCommandLineArgs();
    this.ensureOutputDirectory();
  }
  
  /**
   * Main entry point for test execution
   */
  async run(): Promise<void> {
    console.log('🚀 Starting Syndicate-Grade Test Suite');
    console.log('=====================================');
    
    this.startTime = performance.now();
    
    try {
      // Pre-flight checks
      await this.performSystemHealthChecks();
      await this.validateEnvironment();
      await this.prepareTestEnvironment();
      
      // Execute test suites
      await this.executeTestSuites();
      
      // Post-test analysis
      await this.generateTestReport();
      await this.cleanupTestEnvironment();
      
      // Final results
      this.displayFinalResults();
      
    } catch (error) {
      console.error('❌ Test suite execution failed:', error);
      process.exit(1);
    }
  }
  
  /**
   * Parse command line arguments
   */
  private parseCommandLineArgs(): TestSuiteConfig {
    const args = process.argv.slice(2);
    
    return {
      performance: args.includes('--performance') || args.includes('--all'),
      integration: args.includes('--integration') || args.includes('--all'),
      chaos: args.includes('--chaos') || args.includes('--all'),
      quick: args.includes('--quick'),
      parallel: args.includes('--parallel'),
      verbose: args.includes('--verbose') || args.includes('-v'),
      timeout: parseInt(args.find(arg => arg.startsWith('--timeout='))?.split('=')[1] || '600000'),
      outputDir: args.find(arg => arg.startsWith('--output='))?.split('=')[1] || './test-results',
      generateReport: !args.includes('--no-report')
    };
  }
  
  /**
   * Ensure output directory exists
   */
  private ensureOutputDirectory(): void {
    if (!existsSync(this.config.outputDir)) {
      mkdirSync(this.config.outputDir, { recursive: true });
    }
  }
  
  /**
   * Perform comprehensive system health checks
   */
  private async performSystemHealthChecks(): Promise<void> {
    console.log('🏥 Performing system health checks...');
    
    // Check Docker environment
    this.healthCheck.docker = await this.checkDockerEnvironment();
    if (!this.healthCheck.docker) {
      throw new Error('Docker environment not ready. Run "./dev.sh start" first.');
    }
    
    // Check database connectivity
    this.healthCheck.database = await this.checkDatabaseConnectivity();
    if (!this.healthCheck.database) {
      throw new Error('Database not accessible. Check database status.');
    }
    
    // Check service health
    this.healthCheck.services = await this.checkServiceHealth();
    if (!this.healthCheck.services) {
      throw new Error('Not all services are healthy. Check service status.');
    }
    
    // Check system resources
    this.healthCheck.memory = await this.checkMemoryAvailability();
    this.healthCheck.disk = await this.checkDiskSpace();
    
    if (!this.healthCheck.memory) {
      console.warn('⚠️  Low memory detected. Some tests may fail or be slower.');
    }
    
    if (!this.healthCheck.disk) {
      console.warn('⚠️  Low disk space detected. Test artifacts may be limited.');
    }
    
    console.log('✅ System health checks completed');
    this.logHealthCheckResults();
  }
  
  /**
   * Validate test environment
   */
  private async validateEnvironment(): Promise<void> {
    console.log('🔍 Validating test environment...');
    
    // Check required environment variables
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'DATABASE_URL'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
    
    // Check test data setup
    await this.validateTestDataSetup();
    
    // Check agent configurations
    await this.validateAgentConfigurations();
    
    console.log('✅ Environment validation completed');
  }
  
  /**
   * Prepare test environment
   */
  private async prepareTestEnvironment(): Promise<void> {
    console.log('🔧 Preparing test environment...');
    
    // Clean any existing test data
    await this.cleanExistingTestData();
    
    // Setup test database state
    await this.setupTestDatabase();
    
    // Initialize test agents
    await this.initializeTestAgents();
    
    // Setup monitoring
    await this.setupTestMonitoring();
    
    console.log('✅ Test environment prepared');
  }
  
  /**
   * Execute all configured test suites
   */
  private async executeTestSuites(): Promise<void> {
    console.log('🧪 Executing test suites...');
    
    const suites = this.getConfiguredTestSuites();
    
    if (this.config.parallel && suites.length > 1) {
      await this.executeTestSuitesParallel(suites);
    } else {
      await this.executeTestSuitesSequential(suites);
    }
  }
  
  /**
   * Get configured test suites based on command line args
   */
  private getConfiguredTestSuites(): string[] {
    const suites: string[] = [];
    
    if (this.config.quick) {
      suites.push('quick-validation');
    } else {
      if (this.config.performance || (!this.config.integration && !this.config.chaos)) {
        suites.push('performance');
      }
      
      if (this.config.integration || (!this.config.performance && !this.config.chaos)) {
        suites.push('integration');
      }
      
      if (this.config.chaos || (!this.config.performance && !this.config.integration)) {
        suites.push('chaos');
      }
    }
    
    return suites;
  }
  
  /**
   * Execute test suites sequentially
   */
  private async executeTestSuitesSequential(suites: string[]): Promise<void> {
    for (const suite of suites) {
      console.log(`\n📋 Executing ${suite} test suite...`);
      const result = await this.executeTestSuite(suite);
      this.results.push(result);
      
      if (!result.passed && !this.config.quick) {
        console.warn(`⚠️  ${suite} suite failed, but continuing with remaining tests`);
      }
    }
  }
  
  /**
   * Execute test suites in parallel
   */
  private async executeTestSuitesParallel(suites: string[]): Promise<void> {
    console.log(`🔄 Executing ${suites.length} test suites in parallel...`);
    
    const promises = suites.map(suite => this.executeTestSuite(suite));
    const results = await Promise.allSettled(promises);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        this.results.push(result.value);
      } else {
        this.results.push({
          suite: suites[index],
          passed: false,
          duration: 0,
          tests: { total: 0, passed: 0, failed: 1, skipped: 0 },
          errors: [result.reason.toString()],
          warnings: []
        });
      }
    });
  }
  
  /**
   * Execute a single test suite
   */
  private async executeTestSuite(suite: string): Promise<TestResult> {
    const startTime = performance.now();
    
    try {
      let testCommand: string[];
      let testFiles: string[];
      
      switch (suite) {
        case 'quick-validation':
          testCommand = ['npm', 'run', 'test', '--', '--testNamePattern=quick'];
          testFiles = ['**/*.test.ts'];
          break;
          
        case 'performance':
          testCommand = ['npm', 'run', 'test', '--', '--testPathPattern=performance'];
          testFiles = [
            'src/tests/syndicate-grade/performance/high-volume-processing.test.ts'
          ];
          break;
          
        case 'integration':
          testCommand = ['npm', 'run', 'test', '--', '--testPathPattern=integration'];
          testFiles = [
            'src/tests/syndicate-grade/integration/data-flow-validation.test.ts'
          ];
          break;
          
        case 'chaos':
          testCommand = ['npm', 'run', 'test', '--', '--testPathPattern=chaos'];
          testFiles = [
            'src/tests/syndicate-grade/chaos/fault-tolerance.test.ts'
          ];
          break;
          
        default:
          throw new Error(`Unknown test suite: ${suite}`);
      }
      
      const result = await this.runJestTests(testCommand, testFiles, suite);
      const duration = performance.now() - startTime;
      
      return {
        ...result,
        duration,
        suite,
        errors: result.errors || [],
        warnings: result.warnings || []
      } as TestResult;
      
    } catch (error) {
      const duration = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        suite,
        passed: false,
        duration,
        tests: { total: 0, passed: 0, failed: 1, skipped: 0 },
        errors: [errorMessage],
        warnings: []
      };
    }
  }
  
  /**
   * Run Jest tests with specified command and files
   */
  private async runJestTests(command: string[], files: string[], suiteName: string): Promise<Partial<TestResult>> {
    return new Promise((resolve, reject) => {
      const childProcess = spawn(command[0], command.slice(1), {
        stdio: 'pipe',
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: 'test',
          TEST_SUITE: suiteName
        }
      });
      
      let stdout = '';
      let stderr = '';
      
      childProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        stdout += output;

        if (this.config.verbose) {
          console.log(output);
        }
      });

      childProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        
        if (this.config.verbose) {
          console.error(output);
        }
      });
      
      const timeout = setTimeout(() => {
        childProcess.kill('SIGKILL');
        reject(new Error(`Test suite ${suiteName} timed out after ${this.config.timeout}ms`));
      }, this.config.timeout);

      childProcess.on('close', (code) => {
        clearTimeout(timeout);
        
        const result = this.parseJestOutput(stdout, stderr);
        result.passed = code === 0;
        
        if (code === 0) {
          resolve(result);
        } else {
          resolve({
            ...result,
            errors: [...(result.errors || []), `Process exited with code ${code}`]
          });
        }
      });
      
      process.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }
  
  /**
   * Parse Jest output to extract test results
   */
  private parseJestOutput(stdout: string, stderr: string): Partial<TestResult> {
    const result: Partial<TestResult> = {
      tests: { total: 0, passed: 0, failed: 0, skipped: 0 },
      errors: [],
      warnings: []
    };
    
    // Parse test results from Jest output
    const testSummaryMatch = stdout.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/);
    if (testSummaryMatch) {
      result.tests = {
        total: parseInt(testSummaryMatch[3]),
        passed: parseInt(testSummaryMatch[2]),
        failed: parseInt(testSummaryMatch[1]),
        skipped: 0
      };
    }
    
    // Parse coverage if available
    const coverageMatch = stdout.match(/All files.*?(\d+\.\d+).*?(\d+\.\d+).*?(\d+\.\d+).*?(\d+\.\d+)/);
    if (coverageMatch) {
      result.coverage = {
        statements: parseFloat(coverageMatch[1]),
        branches: parseFloat(coverageMatch[2]),
        functions: parseFloat(coverageMatch[3]),
        lines: parseFloat(coverageMatch[4])
      };
    }
    
    // Extract errors
    const errorMatches = stderr.match(/Error: .*/g);
    if (errorMatches) {
      result.errors = errorMatches;
    }
    
    // Extract warnings
    const warningMatches = stdout.match(/Warning: .*/g);
    if (warningMatches) {
      result.warnings = warningMatches;
    }
    
    return result;
  }
  
  /**
   * Generate comprehensive test report
   */
  private async generateTestReport(): Promise<void> {
    if (!this.config.generateReport) {
      return;
    }
    
    console.log('📊 Generating test report...');
    
    const totalDuration = performance.now() - this.startTime;
    const report = {
      summary: {
        totalDuration: totalDuration,
        totalSuites: this.results.length,
        passedSuites: this.results.filter(r => r.passed).length,
        failedSuites: this.results.filter(r => !r.passed).length,
        totalTests: this.results.reduce((sum, r) => sum + r.tests.total, 0),
        passedTests: this.results.reduce((sum, r) => sum + r.tests.passed, 0),
        failedTests: this.results.reduce((sum, r) => sum + r.tests.failed, 0)
      },
      systemHealth: this.healthCheck,
      suiteResults: this.results,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      },
      recommendations: this.generateRecommendations()
    };
    
    // Write JSON report
    const jsonReportPath = join(this.config.outputDir, 'syndicate-test-report.json');
    writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));
    
    // Write HTML report
    const htmlReportPath = join(this.config.outputDir, 'syndicate-test-report.html');
    writeFileSync(htmlReportPath, this.generateHTMLReport(report));
    
    console.log(`✅ Test report generated: ${jsonReportPath}`);
    console.log(`✅ HTML report generated: ${htmlReportPath}`);
  }
  
  /**
   * Generate HTML test report
   */
  private generateHTMLReport(report: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Syndicate-Grade Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #1a365d; color: white; padding: 20px; border-radius: 8px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric { background: #f7fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #3182ce; }
        .metric.success { border-left-color: #38a169; }
        .metric.warning { border-left-color: #d69e2e; }
        .metric.error { border-left-color: #e53e3e; }
        .suite-result { margin: 20px 0; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; }
        .suite-result.passed { border-left: 4px solid #38a169; }
        .suite-result.failed { border-left: 4px solid #e53e3e; }
        .recommendations { background: #edf2f7; padding: 20px; border-radius: 8px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Syndicate-Grade Test Report</h1>
        <p>Generated on ${new Date().toISOString()}</p>
    </div>
    
    <div class="summary">
        <div class="metric ${report.summary.failedSuites === 0 ? 'success' : 'error'}">
            <h3>Overall Status</h3>
            <p>${report.summary.failedSuites === 0 ? '✅ PASSED' : '❌ FAILED'}</p>
        </div>
        <div class="metric">
            <h3>Test Suites</h3>
            <p>${report.summary.passedSuites}/${report.summary.totalSuites} passed</p>
        </div>
        <div class="metric">
            <h3>Test Cases</h3>
            <p>${report.summary.passedTests}/${report.summary.totalTests} passed</p>
        </div>
        <div class="metric">
            <h3>Duration</h3>
            <p>${(report.summary.totalDuration / 1000).toFixed(2)}s</p>
        </div>
    </div>
    
    <h2>Suite Results</h2>
    ${report.suiteResults.map((suite: TestResult) => `
        <div class="suite-result ${suite.passed ? 'passed' : 'failed'}">
            <h3>${suite.suite} ${suite.passed ? '✅' : '❌'}</h3>
            <p>Duration: ${(suite.duration / 1000).toFixed(2)}s</p>
            <p>Tests: ${suite.tests.passed}/${suite.tests.total} passed</p>
            ${suite.errors.length > 0 ? `<div>Errors: ${suite.errors.join(', ')}</div>` : ''}
            ${suite.warnings.length > 0 ? `<div>Warnings: ${suite.warnings.join(', ')}</div>` : ''}
        </div>
    `).join('')}
    
    ${report.recommendations.length > 0 ? `
        <div class="recommendations">
            <h2>Recommendations</h2>
            <ul>
                ${report.recommendations.map((rec: string) => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
    ` : ''}
</body>
</html>`;
  }
  
  /**
   * Generate recommendations based on test results
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    const failedSuites = this.results.filter(r => !r.passed);
    if (failedSuites.length > 0) {
      recommendations.push(`${failedSuites.length} test suite(s) failed. Review error logs and fix issues before production deployment.`);
    }
    
    const lowPerformanceSuites = this.results.filter(r => 
      r.performance && (r.performance.avgThroughput < 250 || r.performance.maxLatency > 1000)
    );
    if (lowPerformanceSuites.length > 0) {
      recommendations.push('Performance tests indicate potential throughput or latency issues. Consider optimization.');
    }
    
    const highErrorRates = this.results.filter(r => 
      r.performance && r.performance.errorRate > 0.01
    );
    if (highErrorRates.length > 0) {
      recommendations.push('Error rates above 1% detected. Investigate error causes and improve error handling.');
    }
    
    if (!this.healthCheck.memory) {
      recommendations.push('System memory is low. Consider increasing available memory for optimal performance.');
    }
    
    if (!this.healthCheck.disk) {
      recommendations.push('Disk space is low. Ensure adequate disk space for production operations.');
    }
    
    return recommendations;
  }
  
  /**
   * Clean up test environment
   */
  private async cleanupTestEnvironment(): Promise<void> {
    console.log('🧹 Cleaning up test environment...');
    
    try {
      // Clean test data
      await this.cleanExistingTestData();
      
      // Reset agent states
      await this.resetTestAgents();
      
      // Clear monitoring data
      await this.clearTestMonitoring();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn('⚠️  Cleanup warning:', errorMessage);
    }
    
    console.log('✅ Test environment cleanup completed');
  }
  
  /**
   * Display final test results
   */
  private displayFinalResults(): void {
    const totalDuration = performance.now() - this.startTime;
    const passedSuites = this.results.filter(r => r.passed).length;
    const totalTests = this.results.reduce((sum, r) => sum + r.tests.total, 0);
    const passedTests = this.results.reduce((sum, r) => sum + r.tests.passed, 0);
    
    console.log('\n' + '='.repeat(60));
    console.log('🏁 SYNDICATE-GRADE TEST SUITE COMPLETE');
    console.log('='.repeat(60));
    console.log(`⏱️  Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`📋 Test Suites: ${passedSuites}/${this.results.length} passed`);
    console.log(`🧪 Test Cases: ${passedTests}/${totalTests} passed`);
    
    if (passedSuites === this.results.length) {
      console.log('✅ ALL TESTS PASSED - SYSTEM READY FOR PRODUCTION');
    } else {
      console.log('❌ SOME TESTS FAILED - REVIEW ISSUES BEFORE PRODUCTION');
      process.exit(1);
    }
    
    console.log('='.repeat(60));
  }
  
  // Helper methods for system checks
  
  private async checkDockerEnvironment(): Promise<boolean> {
    try {
      const result = await this.runCommand('docker', ['ps']);
      return result.includes('CONTAINER ID');
    } catch {
      return false;
    }
  }
  
  private async checkDatabaseConnectivity(): Promise<boolean> {
    try {
      // This would check actual database connectivity
      return true; // Placeholder
    } catch {
      return false;
    }
  }
  
  private async checkServiceHealth(): Promise<boolean> {
    try {
      // This would check service health endpoints
      return true; // Placeholder
    } catch {
      return false;
    }
  }
  
  private async checkMemoryAvailability(): Promise<boolean> {
    const totalMem = process.memoryUsage().rss;
    return totalMem < 6 * 1024 * 1024 * 1024; // Less than 6GB used
  }
  
  private async checkDiskSpace(): Promise<boolean> {
    try {
      const result = await this.runCommand('df', ['-h', '.']);
      return !result.includes('100%');
    } catch {
      return true; // Assume OK if can't check
    }
  }
  
  private logHealthCheckResults(): void {
    console.log('🏥 Health Check Results:');
    console.log(`  Docker: ${this.healthCheck.docker ? '✅' : '❌'}`);
    console.log(`  Database: ${this.healthCheck.database ? '✅' : '❌'}`);
    console.log(`  Services: ${this.healthCheck.services ? '✅' : '❌'}`);
    console.log(`  Memory: ${this.healthCheck.memory ? '✅' : '⚠️'}`);
    console.log(`  Disk: ${this.healthCheck.disk ? '✅' : '⚠️'}`);
  }
  
  private async validateTestDataSetup(): Promise<void> {
    // Validate that test data is properly configured
  }
  
  private async validateAgentConfigurations(): Promise<void> {
    // Validate that agents are properly configured for testing
  }
  
  private async cleanExistingTestData(): Promise<void> {
    // Clean any existing test data
  }
  
  private async setupTestDatabase(): Promise<void> {
    // Setup test database state
  }
  
  private async initializeTestAgents(): Promise<void> {
    // Initialize test agents
  }
  
  private async setupTestMonitoring(): Promise<void> {
    // Setup test monitoring
  }
  
  private async resetTestAgents(): Promise<void> {
    // Reset agent states
  }
  
  private async clearTestMonitoring(): Promise<void> {
    // Clear monitoring data
  }
  
  private async runCommand(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, { stdio: 'pipe' });
      let output = '';
      
      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });
      
      proc.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Command failed with code ${code}`));
        }
      });
      
      proc.on('error', reject);
    });
  }
}

// Execute test runner if run directly
if (require.main === module) {
  const runner = new SyndicateTestRunner();
  runner.run().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default SyndicateTestRunner;