/**
 * QA Types
 * Type definitions for the QA testing framework
 */

export interface QATestResult {
  testName: string;
  status: 'PASS' | 'FAIL' | 'WARNING' | 'SKIP';
  message: string;
  duration: number;
  timestamp: string;
  details?: any;
  screenshot?: string;
  metrics?: {
    [key: string]: number | string;
  };
}

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

export interface PerformanceMetrics {
  loadTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
  timeToInteractive: number;
  totalBlockingTime: number;
}

export interface AccessibilityViolation {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  description: string;
  help: string;
  helpUrl: string;
  nodes: Array<{
    html: string;
    target: string[];
  }>;
}

export interface SecurityTestResult extends QATestResult {
  vulnerabilityType?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  cve?: string;
}

export interface UserTierTestData {
  userId: string;
  tier: 'free' | 'premium' | 'vip';
  features: string[];
  limits: {
    maxPicks: number;
    maxParlays?: number;
  };
}

export interface WorkflowTestData {
  workflowId: string;
  workflowType: string;
  input: any;
  expectedOutput: any;
  actualOutput?: any;
}

export interface MobileTestResult extends QATestResult {
  device: string;
  viewport: {
    width: number;
    height: number;
  };
  touchTargetSize?: number;
  loadTime?: number;
}

export interface IntegrationTestResult extends QATestResult {
  service: string;
  endpoint?: string;
  responseTime?: number;
  statusCode?: number;
}

export interface DataValidationResult extends QATestResult {
  field: string;
  expectedType: string;
  actualType: string;
  expectedValue?: any;
  actualValue?: any;
  validationRule: string;
}

// Additional test result types for QA framework
export interface AccessibilityTestResult extends QATestResult {
  violations: Array<{
    id: string;
    impact: string;
    description: string;
    nodes: Array<{
      target: string[];
      html: string;
    }>;
  }>;
  wcagLevel: 'A' | 'AA' | 'AAA';
}

export interface UXTestResult extends QATestResult {
  userFlow: string;
  interactionType: string;
  usabilityScore: number;
  recommendations: string[];
}

export interface DocumentationTestResult extends QATestResult {
  documentType: string;
  completeness: number;
  accuracy: number;
  clarity: number;
}

export interface LaunchReadinessCheck extends QATestResult {
  category: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  blocksLaunch: boolean;
  estimatedFixTime: string;
}