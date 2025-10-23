/**
 * A/B Testing Infrastructure for Legacy vs New System Comparison
 *
 * Comprehensive A/B testing system for syndicate-grade feature rollouts with:
 * - Statistical significance testing
 * - Real-time performance comparison
 * - Automated decision making
 * - Revenue impact analysis
 * - Multi-variate testing support
 */
import { SupabaseClient } from '@supabase/supabase-js';
export interface ABTestConfig {
    testId: string;
    flagName: string;
    testName: string;
    description: string;
    variants: TestVariant[];
    trafficAllocation: TrafficAllocation;
    successMetrics: SuccessMetric[];
    guardrailMetrics: GuardrailMetric[];
    testDuration: TestDuration;
    statisticalConfig: StatisticalConfig;
    segmentation: SegmentationConfig;
    businessContext: BusinessContext;
}
export interface TestVariant {
    name: string;
    description: string;
    configuration: Record<string, any>;
    trafficPercentage: number;
    isControl: boolean;
    expectedOutcome: ExpectedOutcome;
}
export interface TrafficAllocation {
    totalPercentage: number;
    allocationMethod: 'hash' | 'random' | 'sticky' | 'cohort';
    stickyDuration: number;
    excludedSegments: string[];
    includedSegments: string[];
}
export interface SuccessMetric {
    name: string;
    description: string;
    metricType: 'conversion' | 'continuous' | 'count' | 'ratio';
    aggregation: 'sum' | 'avg' | 'count' | 'rate' | 'percentile';
    isPrimary: boolean;
    targetImprovement: number;
    direction: 'increase' | 'decrease';
    businessValue: number;
}
export interface GuardrailMetric {
    name: string;
    description: string;
    metricType: 'error_rate' | 'latency' | 'availability' | 'custom';
    threshold: number;
    direction: 'max' | 'min';
    severity: 'warning' | 'critical';
    autoStop: boolean;
}
export interface TestDuration {
    minimumDays: number;
    maximumDays: number;
    minimumSampleSize: number;
    earlyStoppingEnabled: boolean;
    confidenceLevel: number;
    powerLevel: number;
}
export interface StatisticalConfig {
    testType: 'ttest' | 'proportion' | 'bayesian' | 'sequential';
    multipleComparisonsAdjustment: 'bonferroni' | 'holm' | 'fdr' | 'none';
    minimumDetectableEffect: number;
    priorBelief?: BayesianPrior;
}
export interface BayesianPrior {
    distribution: 'beta' | 'normal' | 'gamma';
    parameters: number[];
    confidence: number;
}
export interface SegmentationConfig {
    segmentBy: string[];
    enabledSegments: string[];
    stratifiedSampling: boolean;
    minimumSegmentSize: number;
}
export interface BusinessContext {
    owner: string;
    stakeholders: string[];
    businessGoals: string[];
    successCriteria: string[];
    riskAssessment: string[];
    rollbackPlan: string;
}
export interface ExpectedOutcome {
    primaryMetricImprovement: number;
    confidenceLevel: number;
    timeToSignificance: number;
    businessImpact: string;
}
export interface ABTestResult {
    testId: string;
    testName: string;
    status: 'draft' | 'running' | 'stopped' | 'completed' | 'inconclusive';
    startTime: string;
    endTime?: string;
    durationDays: number;
    totalParticipants: number;
    variants: VariantResult[];
    statisticalSummary: StatisticalSummary;
    businessImpact: BusinessImpact;
    recommendation: TestRecommendation;
    guardrailStatus: GuardrailStatus;
}
export interface VariantResult {
    variantName: string;
    participants: number;
    conversionMetrics: ConversionMetric[];
    continuousMetrics: ContinuousMetric[];
    guardrailMetrics: GuardrailMetricResult[];
    performanceSummary: PerformanceSummary;
}
export interface ConversionMetric {
    metricName: string;
    conversions: number;
    participants: number;
    conversionRate: number;
    confidenceInterval: ConfidenceInterval;
    relativeImprovement: number;
    statisticalSignificance: number;
}
export interface ContinuousMetric {
    metricName: string;
    mean: number;
    standardDeviation: number;
    median: number;
    participants: number;
    confidenceInterval: ConfidenceInterval;
    relativeImprovement: number;
    statisticalSignificance: number;
}
export interface GuardrailMetricResult {
    metricName: string;
    value: number;
    threshold: number;
    violated: boolean;
    severity: 'warning' | 'critical';
    violationHistory: GuardrailViolation[];
}
export interface GuardrailViolation {
    timestamp: string;
    value: number;
    threshold: number;
    duration: number;
}
export interface ConfidenceInterval {
    lower: number;
    upper: number;
    confidence: number;
}
export interface PerformanceSummary {
    errorRate: number;
    averageLatency: number;
    p95Latency: number;
    throughput: number;
    availability: number;
}
export interface StatisticalSummary {
    overallSignificance: number;
    power: number;
    effectSize: number;
    sampleSizeAdequate: boolean;
    testValidity: TestValidity;
    recommendations: string[];
}
export interface TestValidity {
    balancedAllocation: boolean;
    adequateSampleSize: boolean;
    minimalNoveltyEffect: boolean;
    stableBaseline: boolean;
    noExternalInterference: boolean;
    validityScore: number;
}
export interface BusinessImpact {
    primaryMetricImpact: number;
    revenueImpact: number;
    costImpact: number;
    userExperienceImpact: string;
    operationalImpact: string;
    riskAssessment: string;
}
export interface TestRecommendation {
    decision: 'ship_treatment' | 'ship_control' | 'continue_test' | 'stop_inconclusive' | 'run_followup';
    confidence: number;
    reasoning: string[];
    nextSteps: string[];
    warningsAndCaveats: string[];
}
export interface GuardrailStatus {
    overallHealth: 'healthy' | 'warning' | 'critical';
    violatedGuardrails: string[];
    criticalViolations: number;
    warningViolations: number;
    lastViolation?: string;
}
export declare class ABTestingInfrastructure {
    private logger;
    private supabase;
    private featureFlagService;
    private activeTests;
    private testResults;
    private statisticalEngines;
    private evaluationMetrics;
    constructor(supabase: SupabaseClient);
    /**
     * Initialize statistical analysis engines
     */
    private initializeStatisticalEngines;
    /**
     * Create new A/B test for legacy vs new system comparison
     */
    createABTest(config: ABTestConfig): Promise<string>;
    /**
     * Start A/B test execution
     */
    startABTest(testId: string): Promise<void>;
    /**
     * Analyze ongoing A/B test
     */
    analyzeTest(testId: string): Promise<ABTestResult>;
    /**
     * Stop A/B test
     */
    stopTest(testId: string, reason: 'manual' | 'automatic' | 'guardrail_violation', details: string): Promise<void>;
    /**
     * Create syndicate-grade A/B test configurations
     */
    createSyndicateGradeTestConfigs(): Record<string, ABTestConfig>;
    private validateTestConfig;
    private calculateSampleSizes;
    /**
     * Get A/B test results
     */
    getTestResults(testId: string): ABTestResult | null;
    /**
     * Get service health status
     */
    getHealthStatus(): {
        healthy: boolean;
        metrics: typeof this.evaluationMetrics;
    };
    private initializeVariantResult;
    private storeTestConfig;
    private storeTestResult;
    private emitTestEvent;
    private configureFeatureFlagForTesting;
    private collectTestData;
    private analyzeVariants;
    private runStatisticalAnalysis;
    private calculateBusinessImpact;
    private checkGuardrails;
    private generateRecommendation;
    private determineTestStatus;
    private shouldStopTest;
    private calculateTestDuration;
    private generateFinalReport;
    private cleanupFeatureFlagConfig;
    private startTestMonitoring;
}
//# sourceMappingURL=ABTestingInfrastructure.d.ts.map