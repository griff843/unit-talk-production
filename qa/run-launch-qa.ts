/**
 * Launch QA Runner
 * Orchestrates comprehensive QA testing for launch readiness
 */

import { QAConfig, defaultQAConfig } from './config/qa-config';
import { QATestResult } from './types/qa-types';
import { UserTierTester } from './tests/user-tiers.test';
import { WorkflowTester } from './tests/workflows.test';
import { AccessibilityTester } from './tests/accessibility.test';
import { SecurityTester } from './tests/security.test';
import { MobileTester } from './tests/mobile.test';
import { PerformanceTester } from './tests/performance.test';
import { IntegrationTester } from './tests/integration.test';
import { DataValidationTester } from './tests/data-validation.test';
import { QAReportGenerator } from './utils/generate-report';
import { QANotificationService } from './utils/notifications';
import { LaunchDashboard } from './utils/launch-dashboard';

export interface QATestSuite {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARNING' | 'SKIP';
  results: QATestResult[];
  duration: number;
  timestamp: string;
}

export interface LaunchAssessment {
  overallStatus: 'READY' | 'NOT_READY' | 'CONDITIONAL';
  readinessScore: number;
  testSuites: QATestSuite[];
  criticalIssues: string[];
  warnings: string[];
  recommendations: string[];
  timestamp: string;
  environment: string;
  duration: number;
}

export class LaunchQARunner {
  private config: QAConfig;
  private reportGenerator: QAReportGenerator;
  private notificationService: QANotificationService;
  private dashboard: LaunchDashboard;

  constructor(environmentName?: string) {
    this.config = { ...defaultQAConfig };
    if (environmentName) {
      this.config.environment.name = environmentName;
    }
    
    this.reportGenerator = new QAReportGenerator();
    this.notificationService = new QANotificationService();
    this.dashboard = new LaunchDashboard();
  }

  async runLaunchQA(): Promise<LaunchAssessment> {
    console.log('🚀 Starting Launch QA Assessment...');
    const startTime = Date.now();

    try {
      // Run all test suites
      const testSuites: QATestSuite[] = [];
      
      testSuites.push(await this.runUserTierTests());
      testSuites.push(await this.runWorkflowTests());
      testSuites.push(await this.runAccessibilityTests());
      testSuites.push(await this.runSecurityTests());
      testSuites.push(await this.runMobileTests());
      testSuites.push(await this.runPerformanceTests());
      testSuites.push(await this.runIntegrationTests());
      testSuites.push(await this.runDataValidationTests());

      // Generate assessment
      const assessment = this.generateLaunchAssessment(testSuites, startTime);

      // Generate reports
      await this.generateReports(assessment);

      // Send notifications
      await this.sendNotifications(assessment);

      // Display summary
      this.displaySummary(assessment);

      return assessment;

    } catch (error) {
      console.error('❌ Launch QA failed:', error);
      throw error;
    }
  }

  private async runUserTierTests(): Promise<QATestSuite> {
    console.log('🔄 Running User Tier Tests...');
    const startTime = Date.now();
    
    const tester = new UserTierTester(this.config);
    const results = await tester.runAllTests();
    
    return {
      name: 'User Tier Testing',
      status: this.calculateSuiteStatus(results),
      results,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
  }

  private async runWorkflowTests(): Promise<QATestSuite> {
    console.log('🔄 Running Workflow Tests...');
    const startTime = Date.now();
    
    const tester = new WorkflowTester(this.config);
    const results = await tester.runAllTests();
    
    return {
      name: 'Workflow Testing',
      status: this.calculateSuiteStatus(results),
      results,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
  }

  private async runAccessibilityTests(): Promise<QATestSuite> {
    console.log('🔄 Running Accessibility Tests...');
    const startTime = Date.now();
    
    const tester = new AccessibilityTester(this.config);
    const results = await tester.runAllTests();
    
    return {
      name: 'Accessibility Testing',
      status: this.calculateSuiteStatus(results),
      results,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
  }

  private async runSecurityTests(): Promise<QATestSuite> {
    console.log('🔄 Running Security Tests...');
    const startTime = Date.now();
    
    const tester = new SecurityTester(this.config);
    const results = await tester.runAllTests();
    
    return {
      name: 'Security Testing',
      status: this.calculateSuiteStatus(results),
      results,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
  }

  private async runMobileTests(): Promise<QATestSuite> {
    console.log('🔄 Running Mobile Tests...');
    const startTime = Date.now();
    
    const tester = new MobileTester(this.config);
    const results = await tester.runAllTests();
    
    return {
      name: 'Mobile Testing',
      status: this.calculateSuiteStatus(results),
      results,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
  }

  private async runPerformanceTests(): Promise<QATestSuite> {
    console.log('🔄 Running Performance Tests...');
    const startTime = Date.now();
    
    const tester = new PerformanceTester(this.config);
    const results = await tester.runAllTests();
    
    return {
      name: 'Performance Testing',
      status: this.calculateSuiteStatus(results),
      results,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
  }

  private async runIntegrationTests(): Promise<QATestSuite> {
    console.log('🔄 Running Integration Tests...');
    const startTime = Date.now();
    
    const tester = new IntegrationTester(this.config);
    const results = await tester.runAllTests();
    
    return {
      name: 'Integration Testing',
      status: this.calculateSuiteStatus(results),
      results,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
  }

  private async runDataValidationTests(): Promise<QATestSuite> {
    console.log('🔄 Running Data Validation Tests...');
    const startTime = Date.now();
    
    const tester = new DataValidationTester(this.config);
    const results = await tester.runAllTests();
    
    return {
      name: 'Data Validation Testing',
      status: this.calculateSuiteStatus(results),
      results,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
  }

  private calculateSuiteStatus(results: QATestResult[]): 'PASS' | 'FAIL' | 'WARNING' | 'SKIP' {
    const hasFailures = results.some(r => r.status === 'FAIL');
    const hasWarnings = results.some(r => r.status === 'WARNING');
    const allSkipped = results.every(r => r.status === 'SKIP');

    if (hasFailures) return 'FAIL';
    if (hasWarnings) return 'WARNING';
    if (allSkipped) return 'SKIP';
    return 'PASS';
  }

  private generateLaunchAssessment(testSuites: QATestSuite[], startTime: number): LaunchAssessment {
    const criticalIssues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Analyze test results
    testSuites.forEach(suite => {
      suite.results.forEach(result => {
        if (result.status === 'FAIL') {
          criticalIssues.push(`${suite.name}: ${result.message}`);
        } else if (result.status === 'WARNING') {
          warnings.push(`${suite.name}: ${result.message}`);
        }
      });
    });

    // Calculate readiness score
    const totalTests = testSuites.reduce((sum, suite) => sum + suite.results.length, 0);
    const passedTests = testSuites.reduce((sum, suite) => 
      sum + suite.results.filter(r => r.status === 'PASS').length, 0);
    const readinessScore = Math.round((passedTests / totalTests) * 100);

    // Determine overall status
    let overallStatus: 'READY' | 'NOT_READY' | 'CONDITIONAL';
    if (criticalIssues.length === 0) {
      overallStatus = warnings.length === 0 ? 'READY' : 'CONDITIONAL';
    } else {
      overallStatus = 'NOT_READY';
    }

    // Generate recommendations
    if (readinessScore < 95) {
      recommendations.push('Address failing tests before launch');
    }
    if (warnings.length > 0) {
      recommendations.push('Review and resolve warnings for optimal launch');
    }
    if (readinessScore >= 95 && criticalIssues.length === 0) {
      recommendations.push('System appears ready for launch');
    }

    return {
      overallStatus,
      readinessScore,
      testSuites,
      criticalIssues,
      warnings,
      recommendations,
      timestamp: new Date().toISOString(),
      environment: this.config.environment.name || 'unknown',
      duration: Date.now() - startTime
    };
  }

  private async generateReports(assessment: LaunchAssessment): Promise<void> {
    console.log('📊 Generating reports...');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    await this.reportGenerator.generateReport(assessment, {
      outputDir: this.config.reporting.outputDir,
      formats: this.config.reporting.formats,
      includeScreenshots: this.config.reporting.includeScreenshots,
      includeMetrics: true,
      timestamp
    });

    await this.dashboard.updateDashboard({
      timestamp: new Date().toISOString(),
      summary: {
        overallStatus: assessment.overallStatus,
        readinessScore: assessment.readinessScore,
        totalTests: assessment.testSuites.reduce((sum, suite) => sum + suite.results.length, 0),
        passedTests: assessment.testSuites.reduce((sum, suite) => 
          sum + suite.results.filter(r => r.status === 'PASS').length, 0),
        failedTests: assessment.testSuites.reduce((sum, suite) => 
          sum + suite.results.filter(r => r.status === 'FAIL').length, 0),
        warnings: assessment.warnings.length
      },
      testSuites: assessment.testSuites,
      recentResults: assessment.testSuites.flatMap(suite => suite.results),
      systemMetrics: {
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
        nodeVersion: process.version
      }
    });
  }

  private async sendNotifications(assessment: LaunchAssessment): Promise<void> {
    if (this.config.reporting.detailedLogs) {
      await this.notificationService.sendNotification({
        title: `Launch QA Assessment Complete - ${assessment.overallStatus}`,
        message: `Readiness Score: ${assessment.readinessScore}%`,
        severity: assessment.overallStatus === 'READY' ? 'info' : 
                 assessment.overallStatus === 'CONDITIONAL' ? 'warning' : 'error',
        results: assessment,
        metadata: {
          environment: this.config.environment.name || 'unknown',
          timestamp: assessment.timestamp
        }
      });
    }
  }

  private displaySummary(assessment: LaunchAssessment): void {
    const endTime = Date.now();
    const duration = Math.round((assessment.duration) / 1000);

    console.log('\n' + '='.repeat(60));
    console.log('🎯 LAUNCH QA ASSESSMENT SUMMARY');
    console.log('='.repeat(60));

    const statusEmoji = assessment.overallStatus === 'READY' ? '✅' : 
                       assessment.overallStatus === 'CONDITIONAL' ? '⚠️' : '❌';

    console.log(`${statusEmoji} Overall Status: ${assessment.overallStatus}`);
    console.log(`📊 Readiness Score: ${assessment.readinessScore}%`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`🌍 Environment: ${assessment.environment}`);

    console.log('\n📋 Test Suite Results:');
    assessment.testSuites.forEach(suite => {
      const suiteEmoji = suite.status === 'PASS' ? '✅' : 
                        suite.status === 'WARNING' ? '⚠️' : '❌';
      console.log(`  ${suiteEmoji} ${suite.name}: ${suite.status} (${suite.results.length} tests)`);
    });

    if (assessment.criticalIssues.length > 0) {
      console.log('\n❌ Critical Issues:');
      assessment.criticalIssues.forEach(issue => {
        console.log(`  • ${issue}`);
      });
    }

    if (assessment.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      assessment.warnings.forEach(warning => {
        console.log(`  • ${warning}`);
      });
    }

    console.log('\n💡 Recommendations:');
    assessment.recommendations.forEach(rec => {
      console.log(`  • ${rec}`);
    });

    console.log('\n' + '='.repeat(60));
  }
}

// CLI execution
if (require.main === module) {
  const environmentName = process.argv[2] || 'test';
  const runner = new LaunchQARunner(environmentName);
  
  runner.runLaunchQA()
    .then(assessment => {
      process.exit(assessment.overallStatus === 'READY' ? 0 : 1);
    })
    .catch(error => {
      console.error('Launch QA failed:', error);
      process.exit(1);
    });
}

export default LaunchQARunner;