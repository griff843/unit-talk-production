import { createTimestamp, createQATestResult } from '../qa/utils/test-utils';
/**
 * Final QA Report Generator
 * Comprehensive report generation for launch readiness assessment
 */

import { ComprehensiveQASuite, QATestResult } from './comprehensive-qa-suite';
import { MobileAccessibilityTester } from './mobile-accessibility-tester';
import {
  QATestResult as QAResult,
  AccessibilityTestResult,
  MobileTestResult,
  SecurityTestResult,
  UXTestResult,
  DocumentationTestResult,
  LaunchReadinessCheck
} from '../qa/types/qa-types';

interface FinalQAReport {
  executionSummary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    warningTests: number;
    pendingTests: number;
    overallScore: number;
    launchRecommendation: 'GO' | 'NO_GO' | 'GO_WITH_CONDITIONS';
  };
  criticalIssues: QAIssue[];
  highPriorityIssues: QAIssue[];
  testResults: {
    userTierTests: QATestResult[];
    workflowTests: QATestResult[];
    mobileAccessibility: {
      accessibility: AccessibilityTestResult[];
      mobile: MobileTestResult[];
    };
    security: SecurityTestResult[];
    ux: UXTestResult[];
    documentation: DocumentationTestResult[];
    launchReadiness: LaunchReadinessCheck[];
  };
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
  launchPlan: {
    prelaunchTasks: LaunchTask[];
    launchDayTasks: LaunchTask[];
    postLaunchTasks: LaunchTask[];
  };
  riskAssessment: RiskAssessment;
}

interface QAIssue {
  id: string;
  title: string;
  category: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  impact: string;
  recommendation: string;
  blocksLaunch: boolean;
  estimatedEffort: string;
  assignee?: string;
  dueDate?: string;
}

interface LaunchTask {
  id: string;
  task: string;
  owner: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  estimatedTime: string;
  dependencies: string[];
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
}

interface RiskAssessment {
  overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskFactors: RiskFactor[];
  mitigationStrategies: string[];
  contingencyPlans: string[];
}

interface RiskFactor {
  factor: string;
  probability: 'LOW' | 'MEDIUM' | 'HIGH';
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  mitigation: string;
}

export class FinalQAReportGenerator {
  /**
   * Generate comprehensive final QA report
   */
  generateFinalReport(
    userTierTests: QATestResult[],
    workflowTests: QATestResult[],
    mobileAccessibility: { accessibility: AccessibilityTestResult[]; mobile: MobileTestResult[] },
    security: SecurityTestResult[],
    ux: UXTestResult[],
    documentation: DocumentationTestResult[],
    launchReadiness: LaunchReadinessCheck[]
  ): FinalQAReport {
    console.log('📊 Generating Final QA Report...');

    // Calculate execution summary
    const executionSummary = this.calculateExecutionSummary(
      userTierTests,
      workflowTests,
      mobileAccessibility,
      security,
      ux,
      documentation,
      launchReadiness
    );

    // Identify critical and high priority issues
    const { criticalIssues, highPriorityIssues } = this.identifyIssues(
      userTierTests,
      workflowTests,
      mobileAccessibility,
      security,
      ux,
      documentation,
      launchReadiness
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(criticalIssues, highPriorityIssues);

    // Create launch plan
    const launchPlan = this.createLaunchPlan(criticalIssues, highPriorityIssues);

    // Assess risks
    const riskAssessment = this.assessRisks(criticalIssues, highPriorityIssues, launchReadiness);

    return {
      executionSummary,
      criticalIssues,
      highPriorityIssues,
      testResults: {
        userTierTests,
        workflowTests,
        mobileAccessibility,
        security,
        ux,
        documentation,
        launchReadiness
      },
      recommendations,
      launchPlan,
      riskAssessment
    };
  }

  /**
   * Calculate execution summary statistics
   */
  private calculateExecutionSummary(
    userTierTests: QATestResult[],
    workflowTests: QATestResult[],
    mobileAccessibility: { accessibility: AccessibilityTestResult[]; mobile: MobileTestResult[] },
    security: SecurityTestResult[],
    ux: UXTestResult[],
    documentation: DocumentationTestResult[],
    launchReadiness: LaunchReadinessCheck[]
  ) {
    const allTests = [
      ...userTierTests,
      ...workflowTests,
      ...mobileAccessibility.accessibility.map(t => ({ status: t.status })),
      ...mobileAccessibility.mobile.map(t => ({ status: t.status })),
      ...security.map(t => ({ status: t.status })),
      ...ux.map(t => ({ status: t.status })),
      ...documentation.map(t => ({ status: t.status })),
      ...launchReadiness.map(t => ({ status: t.status }))
    ];

    const totalTests = allTests.length;
    const passedTests = allTests.filter(t => t.status === 'PASS').length;
    const failedTests = allTests.filter(t => t.status === 'FAIL').length;
    const warningTests = allTests.filter(t => t.status === 'WARNING').length;
    const pendingTests = allTests.filter(t => t.status === 'SKIP').length;

    const overallScore = Math.round((passedTests / totalTests) * 100);

    // Determine launch recommendation
    const criticalBlockers = launchReadiness.filter(
      check => check.priority === 'HIGH' && check.status !== 'PASS' && check.blocksLaunch
    ).length;

    let launchRecommendation: 'GO' | 'NO_GO' | 'GO_WITH_CONDITIONS';
    if (criticalBlockers > 0 || overallScore < 70) {
      launchRecommendation = 'NO_GO';
    } else if (overallScore < 85 || failedTests > 0) {
      launchRecommendation = 'GO_WITH_CONDITIONS';
    } else {
      launchRecommendation = 'GO';
    }

    return {
      totalTests,
      passedTests,
      failedTests,
      warningTests,
      pendingTests,
      overallScore,
      launchRecommendation
    };
  }

  /**
   * Identify critical and high priority issues
   */
  private identifyIssues(
    userTierTests: QATestResult[],
    workflowTests: QATestResult[],
    mobileAccessibility: { accessibility: AccessibilityTestResult[]; mobile: MobileTestResult[] },
    security: SecurityTestResult[],
    ux: UXTestResult[],
    documentation: DocumentationTestResult[],
    launchReadiness: LaunchReadinessCheck[]
  ): { criticalIssues: QAIssue[]; highPriorityIssues: QAIssue[] } {
    const criticalIssues: QAIssue[] = [];
    const highPriorityIssues: QAIssue[] = [];

    // Process launch readiness blockers
    launchReadiness
      .filter(check => check.status !== 'PASS' && check.blocksLaunch)
      .forEach((check, index) => {
        const issue: QAIssue = {
          id: `LR-${index + 1}`,
          title: check.testName,
          category: check.category,
          severity: check.priority === 'HIGH' ? 'HIGH' : check.priority === 'MEDIUM' ? 'MEDIUM' : 'LOW',
          description: check.message || 'Launch readiness check failed',
          impact: 'Blocks product launch',
          recommendation: `Complete ${check.testName} before launch`,
          blocksLaunch: check.blocksLaunch,
          estimatedEffort: check.estimatedFixTime
        };

        if (check.priority === 'HIGH') {
          criticalIssues.push(issue);
        } else {
          highPriorityIssues.push(issue);
        }
      });

    // Process security issues
    security
      .filter(test => test.status === 'FAIL' && (test.severity === 'critical' || test.severity === 'high'))
      .forEach((test, index) => {
        const mappedSeverity = this.mapSeverity(test.severity);
        const issue: QAIssue = {
          id: `SEC-${index + 1}`,
          title: test.testName,
          category: 'Security',
          severity: mappedSeverity,
          description: test.message || 'Security test failed',
          impact: test.vulnerabilityType ? `Security vulnerability: ${test.vulnerabilityType}` : 'Security risk',
          recommendation: 'Address security issue immediately',
          blocksLaunch: test.severity === 'critical',
          estimatedEffort: this.estimateEffort(mappedSeverity)
        };

        if (test.severity === 'critical') {
          criticalIssues.push(issue);
        } else {
          highPriorityIssues.push(issue);
        }
      });

    // Process accessibility issues
    mobileAccessibility.accessibility
      .filter(test => test.status === 'FAIL')
      .forEach((test, index) => {
        const severity = test.violations.some(v => v.impact === 'critical') ? 'CRITICAL' : 'HIGH';
        const issue: QAIssue = {
          id: `ACC-${index + 1}`,
          title: test.testName,
          category: 'Accessibility',
          severity: severity,
          description: test.message || 'Accessibility test failed',
          impact: 'Prevents users with disabilities from using the platform',
          recommendation: 'Fix accessibility violations to meet WCAG standards',
          blocksLaunch: false,
          estimatedEffort: this.estimateEffort(severity)
        };

        if (severity === 'CRITICAL') {
          criticalIssues.push(issue);
        } else {
          highPriorityIssues.push(issue);
        }
      });

    // Process UX issues
    ux
      .filter(test => test.status === 'FAIL')
      .forEach((test, index) => {
        // Determine severity based on usability score
        const severity = test.usabilityScore < 3 ? 'CRITICAL' : test.usabilityScore < 6 ? 'HIGH' : 'MEDIUM';
        const issue: QAIssue = {
          id: `UX-${index + 1}`,
          title: test.testName,
          category: 'User Experience',
          severity: severity,
          description: test.message || 'UX test failed',
          impact: 'Negatively impacts user experience and adoption',
          recommendation: test.recommendations.length > 0 ? test.recommendations[0] : 'Improve user experience',
          blocksLaunch: severity === 'CRITICAL',
          estimatedEffort: this.estimateEffort(severity)
        };

        if (severity === 'CRITICAL') {
          criticalIssues.push(issue);
        } else {
          highPriorityIssues.push(issue);
        }
      });

    return { criticalIssues, highPriorityIssues };
  }

  /**
   * Generate recommendations based on issues
   */
  private generateRecommendations(
    criticalIssues: QAIssue[],
    highPriorityIssues: QAIssue[]
  ): { immediate: string[]; shortTerm: string[]; longTerm: string[] } {
    const immediate: string[] = [];
    const shortTerm: string[] = [];
    const longTerm: string[] = [];

    // Immediate actions (critical issues)
    if (criticalIssues.length > 0) {
      immediate.push('🚨 CRITICAL: Do not launch until all critical issues are resolved');
      immediate.push('Focus all resources on resolving critical blockers');
      immediate.push('Conduct emergency team meetings to address critical issues');
      immediate.push('Consider delaying launch if critical issues cannot be resolved quickly');
    }

    // Security-specific immediate actions
    const securityIssues = criticalIssues.filter(issue => issue.category === 'Security');
    if (securityIssues.length > 0) {
      immediate.push('Conduct immediate security review and penetration testing');
      immediate.push('Implement security fixes before any launch consideration');
    }

    // Short-term actions (high priority issues)
    if (highPriorityIssues.length > 0) {
      shortTerm.push('Address all high-priority issues within 2 weeks of launch');
      shortTerm.push('Implement monitoring for high-priority areas');
      shortTerm.push('Create user communication plan for known issues');
    }

    // General short-term recommendations
    shortTerm.push('Implement comprehensive monitoring and alerting');
    shortTerm.push('Prepare incident response procedures');
    shortTerm.push('Train support team on common issues and solutions');
    shortTerm.push('Set up user feedback collection mechanisms');

    // Long-term recommendations
    longTerm.push('Establish regular security audits and penetration testing');
    longTerm.push('Implement continuous accessibility testing');
    longTerm.push('Set up automated performance monitoring');
    longTerm.push('Create user research program for ongoing UX improvements');
    longTerm.push('Establish regular code quality reviews');
    longTerm.push('Implement automated testing for all critical user journeys');

    return { immediate, shortTerm, longTerm };
  }

  /**
   * Create comprehensive launch plan
   */
  private createLaunchPlan(
    criticalIssues: QAIssue[],
    highPriorityIssues: QAIssue[]
  ): { prelaunchTasks: LaunchTask[]; launchDayTasks: LaunchTask[]; postLaunchTasks: LaunchTask[] } {
    const prelaunchTasks: LaunchTask[] = [
      {
        id: 'PRE-001',
        task: 'Resolve all critical issues',
        owner: 'Development Team',
        priority: 'CRITICAL',
        estimatedTime: '1-2 weeks',
        dependencies: [],
        status: criticalIssues.length === 0 ? 'COMPLETED' : 'NOT_STARTED'
      },
      {
        id: 'PRE-002',
        task: 'Complete final security audit',
        owner: 'Security Team',
        priority: 'CRITICAL',
        estimatedTime: '3-5 days',
        dependencies: ['PRE-001'],
        status: 'NOT_STARTED'
      },
      {
        id: 'PRE-003',
        task: 'Finalize production deployment',
        owner: 'DevOps Team',
        priority: 'CRITICAL',
        estimatedTime: '2-3 days',
        dependencies: ['PRE-001', 'PRE-002'],
        status: 'NOT_STARTED'
      },
      {
        id: 'PRE-004',
        task: 'Complete user acceptance testing',
        owner: 'QA Team',
        priority: 'HIGH',
        estimatedTime: '1 week',
        dependencies: ['PRE-003'],
        status: 'NOT_STARTED'
      },
      {
        id: 'PRE-005',
        task: 'Train support team',
        owner: 'Support Manager',
        priority: 'HIGH',
        estimatedTime: '2-3 days',
        dependencies: ['PRE-004'],
        status: 'NOT_STARTED'
      }
    ];

    const launchDayTasks: LaunchTask[] = [
      {
        id: 'LAUNCH-001',
        task: 'Deploy to production',
        owner: 'DevOps Team',
        priority: 'CRITICAL',
        estimatedTime: '2-4 hours',
        dependencies: [],
        status: 'NOT_STARTED'
      },
      {
        id: 'LAUNCH-002',
        task: 'Verify all systems operational',
        owner: 'QA Team',
        priority: 'CRITICAL',
        estimatedTime: '1-2 hours',
        dependencies: ['LAUNCH-001'],
        status: 'NOT_STARTED'
      },
      {
        id: 'LAUNCH-003',
        task: 'Enable monitoring and alerting',
        owner: 'DevOps Team',
        priority: 'CRITICAL',
        estimatedTime: '30 minutes',
        dependencies: ['LAUNCH-001'],
        status: 'NOT_STARTED'
      },
      {
        id: 'LAUNCH-004',
        task: 'Activate support channels',
        owner: 'Support Team',
        priority: 'HIGH',
        estimatedTime: '15 minutes',
        dependencies: ['LAUNCH-002'],
        status: 'NOT_STARTED'
      },
      {
        id: 'LAUNCH-005',
        task: 'Send launch announcements',
        owner: 'Marketing Team',
        priority: 'MEDIUM',
        estimatedTime: '1 hour',
        dependencies: ['LAUNCH-002'],
        status: 'NOT_STARTED'
      }
    ];

    const postLaunchTasks: LaunchTask[] = [
      {
        id: 'POST-001',
        task: 'Monitor system performance (24h)',
        owner: 'DevOps Team',
        priority: 'CRITICAL',
        estimatedTime: '24 hours',
        dependencies: [],
        status: 'NOT_STARTED'
      },
      {
        id: 'POST-002',
        task: 'Address high-priority issues',
        owner: 'Development Team',
        priority: 'HIGH',
        estimatedTime: '1-2 weeks',
        dependencies: [],
        status: 'NOT_STARTED'
      },
      {
        id: 'POST-003',
        task: 'Collect and analyze user feedback',
        owner: 'Product Team',
        priority: 'HIGH',
        estimatedTime: '1 week',
        dependencies: [],
        status: 'NOT_STARTED'
      },
      {
        id: 'POST-004',
        task: 'Conduct post-launch retrospective',
        owner: 'Project Manager',
        priority: 'MEDIUM',
        estimatedTime: '2 hours',
        dependencies: ['POST-001'],
        status: 'NOT_STARTED'
      },
      {
        id: 'POST-005',
        task: 'Plan next iteration improvements',
        owner: 'Product Team',
        priority: 'MEDIUM',
        estimatedTime: '1 week',
        dependencies: ['POST-003', 'POST-004'],
        status: 'NOT_STARTED'
      }
    ];

    return { prelaunchTasks, launchDayTasks, postLaunchTasks };
  }

  /**
   * Assess launch risks
   */
  private assessRisks(
    criticalIssues: QAIssue[],
    highPriorityIssues: QAIssue[],
    launchReadiness: LaunchReadinessCheck[]
  ): RiskAssessment {
    const riskFactors: RiskFactor[] = [
      {
        factor: 'Critical Issues Remaining',
        probability: criticalIssues.length > 0 ? 'HIGH' : 'LOW',
        impact: 'HIGH',
        riskLevel: criticalIssues.length > 0 ? 'CRITICAL' : 'LOW',
        mitigation: 'Resolve all critical issues before launch'
      },
      {
        factor: 'Security Vulnerabilities',
        probability: criticalIssues.some(i => i.category === 'Security') ? 'HIGH' : 'MEDIUM',
        impact: 'HIGH',
        riskLevel: criticalIssues.some(i => i.category === 'Security') ? 'CRITICAL' : 'MEDIUM',
        mitigation: 'Complete security audit and penetration testing'
      },
      {
        factor: 'Payment System Issues',
        probability: 'MEDIUM',
        impact: 'HIGH',
        riskLevel: 'HIGH',
        mitigation: 'Thorough payment system testing and monitoring'
      },
      {
        factor: 'User Experience Problems',
        probability: highPriorityIssues.some(i => i.category === 'User Experience') ? 'HIGH' : 'MEDIUM',
        impact: 'MEDIUM',
        riskLevel: highPriorityIssues.some(i => i.category === 'User Experience') ? 'HIGH' : 'MEDIUM',
        mitigation: 'User testing and UX improvements'
      },
      {
        factor: 'Performance Issues Under Load',
        probability: 'MEDIUM',
        impact: 'HIGH',
        riskLevel: 'HIGH',
        mitigation: 'Load testing and performance optimization'
      }
    ];

    const overallRisk = this.calculateOverallRisk(riskFactors);

    const mitigationStrategies = [
      'Implement comprehensive monitoring and alerting',
      'Prepare rapid response team for launch day',
      'Create detailed rollback procedures',
      'Set up real-time performance monitoring',
      'Establish clear escalation procedures',
      'Prepare user communication templates for issues'
    ];

    const contingencyPlans = [
      'Rollback to previous stable version if critical issues arise',
      'Implement feature flags to disable problematic features',
      'Scale infrastructure automatically based on load',
      'Activate backup payment processing if primary fails',
      'Deploy hotfixes rapidly through automated pipeline',
      'Communicate transparently with users about any issues'
    ];

    return {
      overallRisk,
      riskFactors,
      mitigationStrategies,
      contingencyPlans
    };
  }

  /**
   * Calculate overall risk level
   */
  private calculateOverallRisk(riskFactors: RiskFactor[]): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const criticalRisks = riskFactors.filter(r => r.riskLevel === 'CRITICAL').length;
    const highRisks = riskFactors.filter(r => r.riskLevel === 'HIGH').length;

    if (criticalRisks > 0) return 'CRITICAL';
    if (highRisks >= 2) return 'HIGH';
    if (highRisks === 1) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Estimate effort for issue resolution
   */
  private estimateEffort(severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'): string {
    switch (severity) {
      case 'CRITICAL': return '1-3 days';
      case 'HIGH': return '2-5 days';
      case 'MEDIUM': return '1-2 days';
      case 'LOW': return '2-4 hours';
      default: return '1 day';
    }
  }

  /**
   * Generate HTML report
   */
  generateHTMLReport(report: FinalQAReport): string {
    const statusColor = (status: string) => {
      switch (status) {
        case 'GO': return '#16a34a';
        case 'GO_WITH_CONDITIONS': return '#ea580c';
        case 'NO_GO': return '#dc2626';
        default: return '#6b7280';
      }
    };

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Unit Talk - Final QA Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .summary-card { background: white; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; text-align: center; }
        .launch-status { font-size: 24px; font-weight: bold; color: ${statusColor(report.executionSummary.launchRecommendation)}; }
        .issue-card { background: #f8fafc; border-left: 4px solid #dc2626; padding: 20px; margin: 10px 0; border-radius: 8px; }
        .critical { border-left-color: #dc2626; }
        .high { border-left-color: #ea580c; }
        .section { margin: 30px 0; }
        .progress-bar { background: #e2e8f0; height: 20px; border-radius: 10px; overflow: hidden; margin: 10px 0; }
        .progress-fill { background: #16a34a; height: 100%; }
        .risk-${report.riskAssessment.overallRisk.toLowerCase()} { 
          color: ${report.riskAssessment.overallRisk === 'CRITICAL' ? '#dc2626' : 
                   report.riskAssessment.overallRisk === 'HIGH' ? '#ea580c' : 
                   report.riskAssessment.overallRisk === 'MEDIUM' ? '#ca8a04' : '#16a34a'};
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Unit Talk - Final QA Report</h1>
        <p>Comprehensive Launch Readiness Assessment</p>
        <div class="launch-status">Launch Recommendation: ${report.executionSummary.launchRecommendation}</div>
    </div>

    <div class="section">
        <h2>📊 Execution Summary</h2>
        <div class="summary-grid">
            <div class="summary-card">
                <h3>Overall Score</h3>
                <div style="font-size: 36px; font-weight: bold; color: #2563eb;">${report.executionSummary.overallScore}%</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${report.executionSummary.overallScore}%"></div>
                </div>
            </div>
            <div class="summary-card">
                <h3>Total Tests</h3>
                <div style="font-size: 36px; font-weight: bold;">${report.executionSummary.totalTests}</div>
            </div>
            <div class="summary-card">
                <h3>Passed</h3>
                <div style="font-size: 36px; font-weight: bold; color: #16a34a;">${report.executionSummary.passedTests}</div>
            </div>
            <div class="summary-card">
                <h3>Failed</h3>
                <div style="font-size: 36px; font-weight: bold; color: #dc2626;">${report.executionSummary.failedTests}</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>🚨 Critical Issues (${report.criticalIssues.length})</h2>
        ${report.criticalIssues.length === 0 ? 
          '<p style="color: #16a34a; font-weight: bold;">✅ No critical issues found!</p>' :
          report.criticalIssues.map(issue => `
            <div class="issue-card critical">
                <h3>${issue.title}</h3>
                <p><strong>Category:</strong> ${issue.category}</p>
                <p><strong>Impact:</strong> ${issue.impact}</p>
                <p><strong>Description:</strong> ${issue.description}</p>
                <p><strong>Recommendation:</strong> ${issue.recommendation}</p>
                ${issue.blocksLaunch ? '<p style="color: #dc2626;"><strong>⚠️ BLOCKS LAUNCH</strong></p>' : ''}
            </div>
          `).join('')
        }
    </div>

    <div class="section">
        <h2>⚠️ High Priority Issues (${report.highPriorityIssues.length})</h2>
        ${report.highPriorityIssues.map(issue => `
            <div class="issue-card high">
                <h3>${issue.title}</h3>
                <p><strong>Category:</strong> ${issue.category}</p>
                <p><strong>Impact:</strong> ${issue.impact}</p>
                <p><strong>Recommendation:</strong> ${issue.recommendation}</p>
            </div>
        `).join('')}
    </div>

    <div class="section">
        <h2>🎯 Risk Assessment</h2>
        <p><strong>Overall Risk Level:</strong> <span class="risk-${report.riskAssessment.overallRisk.toLowerCase()}">${report.riskAssessment.overallRisk}</span></p>
        
        <h3>Risk Factors:</h3>
        ${report.riskAssessment.riskFactors.map(risk => `
            <div class="issue-card">
                <h4>${risk.factor}</h4>
                <p><strong>Risk Level:</strong> ${risk.riskLevel}</p>
                <p><strong>Mitigation:</strong> ${risk.mitigation}</p>
            </div>
        `).join('')}
    </div>

    <div class="section">
        <h2>📋 Immediate Actions Required</h2>
        <ul>
            ${report.recommendations.immediate.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>

    <div class="section">
        <h2>🚀 Launch Plan</h2>
        
        <h3>Pre-Launch Tasks</h3>
        ${report.launchPlan.prelaunchTasks.map(task => `
            <div class="issue-card">
                <h4>${task.task}</h4>
                <p><strong>Owner:</strong> ${task.owner}</p>
                <p><strong>Priority:</strong> ${task.priority}</p>
                <p><strong>Estimated Time:</strong> ${task.estimatedTime}</p>
                <p><strong>Status:</strong> ${task.status}</p>
            </div>
        `).join('')}
    </div>

    <div style="margin-top: 40px; padding: 20px; background: #f0f9ff; border-radius: 8px;">
        <h2>📝 Final Recommendation</h2>
        ${report.executionSummary.launchRecommendation === 'GO' ? 
          '<p style="color: #16a34a; font-weight: bold;">✅ READY FOR LAUNCH - All critical requirements met</p>' :
          report.executionSummary.launchRecommendation === 'GO_WITH_CONDITIONS' ?
          '<p style="color: #ea580c; font-weight: bold;">⚠️ CONDITIONAL LAUNCH - Address high-priority issues post-launch</p>' :
          '<p style="color: #dc2626; font-weight: bold;">🚫 NOT READY FOR LAUNCH - Critical issues must be resolved first</p>'
        }
    </div>

    <div style="margin-top: 20px; text-align: center; color: #6b7280;">
        <p>Report generated on ${new Date().toLocaleString()}</p>
    </div>
</body>
</html>
    `;
  }

  private mapSeverity(severity?: 'low' | 'medium' | 'high' | 'critical'): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
    switch (severity) {
      case 'critical': return 'CRITICAL';
      case 'high': return 'HIGH';
      case 'medium': return 'MEDIUM';
      case 'low': return 'LOW';
      default: return 'LOW';
    }
  }
}

export { FinalQAReport, QAIssue, LaunchTask, RiskAssessment, RiskFactor };