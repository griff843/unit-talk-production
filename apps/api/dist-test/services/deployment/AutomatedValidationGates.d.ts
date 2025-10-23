/**
 * Automated Validation Gates Service
 *
 * Comprehensive validation system for feature flag rollouts with:
 * - Real-time metric monitoring
 * - Automated threshold enforcement
 * - Progressive gate evaluation
 * - Intelligent rollback triggers
 * - Statistical significance testing
 */
import { SupabaseClient } from '@supabase/supabase-js';
export interface ValidationGateConfig {
    flagName: string;
    gateName: string;
    metricName: string;
    thresholdValue: number;
    comparisonOperator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
    required: boolean;
    weight: number;
    evaluationWindowMinutes: number;
    minimumSampleSize: number;
    confidenceLevel: number;
    isActive: boolean;
}
export interface GateEvaluationResult {
    gateName: string;
    metricName: string;
    actualValue: number;
    thresholdValue: number;
    passed: boolean;
    required: boolean;
    weight: number;
    sampleSize: number;
    confidenceInterval: {
        lower: number;
        upper: number;
        confidence: number;
    };
    statisticalSignificance: number;
    evaluationTime: string;
    reason: string;
}
export interface RolloutValidationSummary {
    flagName: string;
    rolloutPercentage: number;
    totalGates: number;
    passedGates: number;
    failedGates: number;
    criticalFailures: number;
    overallScore: number;
    recommendation: 'proceed' | 'pause' | 'rollback';
    evaluationTime: string;
    gateResults: GateEvaluationResult[];
    riskAssessment: {
        level: 'low' | 'medium' | 'high' | 'critical';
        factors: string[];
        mitigations: string[];
    };
}
export interface MetricSnapshot {
    metricName: string;
    value: number;
    timestamp: string;
    sampleSize: number;
    source: string;
    tags: Record<string, string>;
}
export declare class AutomatedValidationGates {
    private logger;
    private supabase;
    private featureFlagService;
    private evaluationIntervals;
    private metricCache;
    private lastEvaluations;
    private evaluationLatencies;
    private successRate;
    private totalEvaluations;
    constructor(supabase: SupabaseClient);
    /**
     * Start continuous validation monitoring
     */
    private startContinuousValidation;
    /**
     * Run validation for all active feature flags
     */
    private runContinuousValidation;
    /**
     * Validate rollout against all configured gates
     */
    validateRollout(flagName: string): Promise<RolloutValidationSummary>;
    /**
     * Evaluate individual validation gate
     */
    private evaluateGate;
    /**
     * Collect metric data for evaluation
     */
    private collectMetricData;
    /**
     * Collect metrics from feature flag metrics table
     */
    private collectFromFeatureFlagMetrics;
    /**
     * Collect metrics from system monitoring
     */
    private collectFromSystemMetrics;
    /**
     * Collect metrics from application-specific sources
     */
    private collectFromApplicationMetrics;
    /**
     * Collect A/B test metrics
     */
    private collectABTestMetrics;
    /**
     * Extract metric value from database row
     */
    private extractMetricValue;
    /**
     * Generate simulated metric values for testing
     */
    private generateSimulatedMetricValue;
    /**
     * Calculate statistical metrics
     */
    private calculateMetricValue;
    /**
     * Calculate confidence interval
     */
    private calculateConfidenceInterval;
    /**
     * Calculate statistical significance
     */
    private calculateStatisticalSignificance;
    /**
     * Evaluate with contextual information
     */
    private evaluateWithContext;
    /**
     * Determine rollout recommendation
     */
    private determineRecommendation;
    /**
     * Assess risk level
     */
    private assessRisk;
    /**
     * Handle critical validation failures
     */
    private handleCriticalValidationFailure;
    private getValidationGates;
    private getCurrentRolloutInfo;
    private evaluateThreshold;
    private getOperatorSymbol;
    private getRequiredConfidence;
    private thresholdInConfidenceInterval;
    private hasDegradingTrends;
    private getTCriticalValue;
    private tCdf;
    private erf;
    private groupBy;
    private createDefaultSummary;
    private storeValidationResults;
    private cleanupMetricCache;
    private startMetricsCollection;
    private emitServiceMetrics;
    /**
     * Get last validation summary for a flag
     */
    getLastValidationSummary(flagName: string): RolloutValidationSummary | null;
    /**
     * Get service health status
     */
    getHealthStatus(): {
        healthy: boolean;
        metrics: {
            totalEvaluations: number;
            successRate: number;
            averageLatencyMs: number;
            activeValidations: number;
        };
    };
}
//# sourceMappingURL=AutomatedValidationGates.d.ts.map