/**
 * Feature Flag Service for Syndicate-Grade Unit Talk System Upgrade
 *
 * Comprehensive feature flag system with:
 * - Environment-based configuration
 * - Gradual rollout percentages (5% → 25% → 50% → 75% → 100%)
 * - A/B testing capabilities
 * - Emergency rollback switches
 * - Real-time performance monitoring
 * - Zero-downtime deployment support
 */
import { SupabaseClient } from '@supabase/supabase-js';
export interface FeatureFlagConfig {
    flagName: string;
    enabled: boolean;
    rolloutPercentage: number;
    environment: string;
    userSegments?: string[];
    abTestGroups?: ABTestGroup[];
    emergencyKillSwitch: boolean;
    validationGates: ValidationGate[];
    dependencies?: string[];
    metadata: {
        description: string;
        owner: string;
        createdAt: string;
        updatedAt: string;
        version: string;
    };
}
export interface ABTestGroup {
    name: string;
    percentage: number;
    variant: 'control' | 'treatment';
    config: Record<string, any>;
}
export interface ValidationGate {
    metric: string;
    threshold: number;
    operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
    required: boolean;
}
export interface FeatureFlagEvaluation {
    flagName: string;
    enabled: boolean;
    variant?: string;
    userId?: string;
    segmentMatch: boolean;
    rolloutBucket: number;
    evaluationTime: string;
    abTestGroup?: string;
}
export interface RolloutMetrics {
    flagName: string;
    environment: string;
    rolloutPercentage: number;
    activeUsers: number;
    errorRate: number;
    latencyP99: number;
    throughput: number;
    validationGatesPassed: number;
    validationGatesFailed: number;
    lastUpdated: string;
}
export declare class FeatureFlagService {
    private logger;
    private supabase;
    private flagConfigs;
    private metricsBuffer;
    private evaluationCache;
    private cacheHitRate;
    private totalEvaluations;
    private cacheHits;
    constructor(supabase: SupabaseClient);
    /**
     * Initialize default feature flags for syndicate-grade upgrade
     */
    private initializeDefaultFlags;
    /**
     * Evaluate feature flag for a given context
     */
    evaluateFlag(flagName: string, context?: {
        userId?: string;
        userSegment?: string;
        environment?: string;
        metadata?: Record<string, any>;
    }): Promise<FeatureFlagEvaluation>;
    /**
     * Update feature flag configuration
     */
    updateFlag(flagName: string, updates: Partial<FeatureFlagConfig>): Promise<void>;
    /**
     * Gradual rollout management
     */
    graduateRollout(flagName: string, targetPercentage: number, options?: {
        incrementStep?: number;
        validateAfterEachStep?: boolean;
        rollbackOnFailure?: boolean;
    }): Promise<void>;
    /**
     * Emergency rollback functionality
     */
    emergencyRollback(flagName: string, reason: string): Promise<void>;
    /**
     * Get rollout metrics for monitoring
     */
    getRolloutMetrics(flagName: string): Promise<RolloutMetrics | null>;
    private getFlagConfig;
    private storeFlagConfig;
    private calculateRolloutBucket;
    private simpleHash;
    private checkSegmentMatch;
    private assignABTestGroup;
    private createDefaultEvaluation;
    private getCacheKey;
    private clearFlagCache;
    private clearAllCaches;
    private calculateRolloutSteps;
    private waitForStabilization;
    private validateRolloutMetrics;
    private evaluateValidationGate;
    private rollbackToPercentage;
    private validateFlagUpdate;
    private emitFlagChangeEvent;
    private emitEmergencyEvent;
    private calculateConfigChanges;
    private startMetricsCollection;
    private collectAndEmitMetrics;
    private cleanExpiredCache;
    /**
     * Get service health status
     */
    getHealthStatus(): {
        healthy: boolean;
        metrics: {
            totalEvaluations: number;
            cacheHitRate: number;
            cacheSize: number;
            flagsInMemory: number;
        };
    };
}
//# sourceMappingURL=FeatureFlagService.d.ts.map