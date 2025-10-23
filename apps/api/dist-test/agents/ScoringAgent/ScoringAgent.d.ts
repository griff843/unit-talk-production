import { ScoringFeatureSet } from '../../types/ScoringFeatureSet';
import { BaseAgent } from '../BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies, HealthCheckResult } from '../BaseAgent/types';
import { ScoringResult, ScoringConfig } from './scoring/gradingEngine';
export declare class ScoringAgent extends BaseAgent {
    private scoringEngine;
    private professionalProcessor;
    private parallelEngine;
    private queryOptimizer;
    private enhanced45FactorEngine?;
    private featureStoreIntegration?;
    private materialChangeDetector?;
    private scoringMetrics;
    private batchProcessor;
    private readonly BATCH_SIZE;
    private readonly BATCH_TIMEOUT_MS;
    private batchTimer?;
    private readonly USE_PRO_SCORER;
    private readonly USE_PARALLEL_PROCESSING;
    private readonly SCORING_DEBUG;
    private readonly USE_ENHANCED_45_FACTOR;
    constructor(config: BaseAgentConfig, deps: BaseAgentDependencies);
    initialize(): Promise<void>;
    process(): Promise<void>;
    cleanup(): Promise<void>;
    checkHealth(): Promise<HealthCheckResult>;
    collectMetrics(): Promise<GradingMetrics>;
    scoreProp(features: ScoringFeatureSet): Promise<ScoringResult>;
    scoreProps(propsList: ScoringFeatureSet[]): Promise<ScoringResult[]>;
    /**
     * Convert ProfessionalPropResult to ScoringResult format
     */
    private convertProfessionalResult;
    private processBatched;
    private createBatches;
    /**
     * Schedule failed props for retry with exponential backoff
     */
    private scheduleFailedPropsForRetry;
    private fetchPendingProps;
    private convertToFeatureSet;
    private storeScoringResult;
    private meetsPromotionCriteria;
    private promoteToUnifiedPicks;
    private updateProcessingMetrics;
    private startBatchTimer;
    private processRemainingBatches;
    updateScoringConfig(configName: string, config: ScoringConfig): void;
    setActiveConfig(configName: string): void;
    getAvailableConfigs(): string[];
    optimizeWeights(timeframe?: string): Promise<void>;
    /**
     * Convert Enhanced45FactorResult to standard ScoringResult format
     */
    private convertEnhanced45ResultToScoringResult;
    /**
     * Convert factor scores to feature contributions format
     */
    private convertFactorScoresToContributions;
    /**
     * Calculate risk score from enhanced result
     */
    private calculateRiskScoreFromEnhanced;
    /**
     * Extract correlation risk from factor scores
     */
    private extractCorrelationRisk;
    /**
     * Determine optimal timing from factor scores
     */
    private determineOptimalTiming;
    /**
     * Handle material change events
     */
    private handleMaterialChange;
    /**
     * Handle critical change events
     */
    private handleCriticalChange;
    /**
     * Batch process props using Enhanced 45-Factor system
     */
    batchProcessEnhanced45Factor(propsList: ScoringFeatureSet[]): Promise<ScoringResult[]>;
    /**
     * Calculate tier distribution from results
     */
    private calculateTierDistribution;
    /**
     * Get Enhanced 45-Factor system status
     */
    getEnhanced45FactorStatus(): {
        enabled: boolean;
        featureStoreHealth: any;
        changeDetectorStatus: any;
        processingStats: any;
    } | null;
    /**
     * Cleanup enhanced systems
     */
    cleanupEnhanced45Factor(): Promise<void>;
}
//# sourceMappingURL=ScoringAgent.d.ts.map