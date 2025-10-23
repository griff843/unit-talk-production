/**
 * A/B Testing Engine for Syndicate-Grade Feature Rollouts
 *
 * Advanced A/B testing capabilities for:
 * - Grading engine performance comparison (Enhanced 45-factor vs Legacy)
 * - Event-driven vs polling AlertAgent performance
 * - Feature store vs real-time computation efficiency
 * - Statistical significance calculation
 * - Real-time performance monitoring
 * - Automatic rollback on performance degradation
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { FeatureFlagService } from './FeatureFlagService';
export interface ABTestEvent {
    flagName: string;
    variant: 'control' | 'treatment';
    userId: string;
    eventType: 'conversion' | 'error' | 'performance' | 'engagement' | 'custom';
    eventValue?: number;
    metadata?: Record<string, any>;
    sessionId?: string;
    latencyMs?: number;
    errorOccurred?: boolean;
    errorDetails?: string;
}
export interface ABTestAnalysis {
    flagName: string;
    environment: string;
    controlSampleSize: number;
    treatmentSampleSize: number;
    totalSampleSize: number;
    controlConversionRate: number;
    treatmentConversionRate: number;
    conversionLift: number;
    controlAvgLatency: number;
    treatmentAvgLatency: number;
    latencyChange: number;
    controlErrorRate: number;
    treatmentErrorRate: number;
    errorRateChange: number;
    statisticalSignificance: number;
    confidenceInterval: [number, number];
    pValue: number;
    testPower: number;
    testDuration: number;
    minimumSampleReached: boolean;
    recommendedAction: 'continue' | 'promote_treatment' | 'rollback' | 'extend_test';
    analysisTime: string;
    testStartTime: string;
}
export interface PerformanceComparison {
    flagName: string;
    metric: string;
    controlValue: number;
    controlCount: number;
    controlStdDev: number;
    treatmentValue: number;
    treatmentCount: number;
    treatmentStdDev: number;
    percentageChange: number;
    absoluteChange: number;
    significancePValue: number;
    significanceLevel: 'high' | 'medium' | 'low' | 'none';
    threshold: number;
    thresholdDirection: 'improvement' | 'degradation';
    thresholdBreached: boolean;
}
export declare class ABTestingEngine {
    private logger;
    private supabase;
    private featureFlagService;
    private readonly SIGNIFICANCE_THRESHOLD;
    private readonly MINIMUM_SAMPLE_SIZE;
    private readonly MINIMUM_TEST_DURATION_HOURS;
    private readonly POWER_THRESHOLD;
    constructor(supabase: SupabaseClient, featureFlagService: FeatureFlagService);
    /**
     * Track an A/B test event
     */
    trackEvent(event: ABTestEvent): Promise<void>;
    /**
     * Analyze A/B test results for a specific flag
     */
    analyzeTest(flagName: string, options?: {
        minHours?: number;
        minSampleSize?: number;
    }): Promise<ABTestAnalysis | null>;
    /**
     * Compare performance metrics between control and treatment groups
     */
    comparePerformance(flagName: string, metric: string, thresholds: {
        threshold: number;
        direction: 'improvement' | 'degradation';
    }): Promise<PerformanceComparison | null>;
    /**
     * Automatically check for rollback conditions
     */
    checkRollbackConditions(flagName: string): Promise<{
        shouldRollback: boolean;
        reasons: string[];
        severity: 'low' | 'medium' | 'high' | 'critical';
    }>;
    /**
     * Generate comprehensive A/B test report
     */
    generateTestReport(flagName: string): Promise<{
        analysis: ABTestAnalysis | null;
        performanceComparisons: PerformanceComparison[];
        rollbackAssessment: any;
        recommendations: string[];
    }>;
    private calculateMean;
    private calculateStandardDeviation;
    private calculateStatisticalSignificance;
    private normalCDF;
    private erf;
    private calculatePower;
    private performTTest;
    private extractMetricValues;
    private determineSignificanceLevel;
    private determineRecommendedAction;
    private checkCriticalMetrics;
    private generateRecommendations;
    private startContinuousAnalysis;
    private runContinuousAnalysis;
}
//# sourceMappingURL=ABTestingEngine.d.ts.map