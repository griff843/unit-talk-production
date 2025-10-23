/**
 * ScoringAgent Integration
 *
 * Integration layer connecting the Phase 7 Risk Management system with the existing
 * ScoringAgent and Enhanced45FactorEngine. Provides risk-enhanced scoring and
 * automated position sizing with comprehensive risk controls.
 */
import { PropRiskAssessment } from '../core/RiskManagementEngine';
import { Enhanced45FactorResult } from '../../agents/ScoringAgent/scoring/Enhanced45FactorEngine';
import { GradingFeatureSet } from '../../types/GradingFeatureSet';
import { Position, RiskProfile, RiskAlert } from '../types';
export interface RiskEnhancedScoringResult {
    factorAnalysis: Enhanced45FactorResult;
    riskAssessment: PropRiskAssessment;
    finalRecommendation: 'APPROVE' | 'REDUCE' | 'REJECT';
    finalStake: number;
    maxStake: number;
    riskAdjustments: {
        kellyAdjustment: number;
        correlationAdjustment: number;
        portfolioAdjustment: number;
        overallAdjustment: number;
    };
    riskAlerts: RiskAlert[];
    warnings: string[];
    expectedSharpe: number;
    riskAdjustedReturn: number;
    portfolioImpact: number;
    processingTime: number;
    riskEngineVersion: string;
    scoringEngineVersion: string;
}
export interface ScoringIntegrationConfig {
    enableRiskManagement: boolean;
    riskProfile: RiskProfile;
    autoApproveThreshold: number;
    autoRejectThreshold: number;
    kellyMultiplierOverride?: number;
    maxStakeOverride?: number;
}
export declare class ScoringAgentIntegration {
    private logger;
    private riskEngine;
    private scoringEngine;
    private featureStore;
    private changeDetector;
    private config;
    private integrationStats;
    constructor(config: ScoringIntegrationConfig);
    /**
     * Process prop through integrated risk-enhanced scoring pipeline
     */
    processRiskEnhancedScoring(features: GradingFeatureSet, gameContext?: {
        gameId?: string;
        gameTime?: string;
        sport: string;
    }): Promise<RiskEnhancedScoringResult>;
    /**
     * Batch process multiple props with risk management
     */
    batchProcessRiskEnhanced(propositions: Array<{
        features: GradingFeatureSet;
        gameContext?: any;
    }>): Promise<RiskEnhancedScoringResult[]>;
    /**
     * Add position to risk management system
     */
    addPositionToRiskEngine(position: Position): Promise<void>;
    /**
     * Get comprehensive risk status
     */
    getRiskStatus(): Promise<{
        portfolioRisk: any;
        activeAlerts: RiskAlert[];
        riskProfile: RiskProfile;
        integrationStats: any;
        systemHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    }>;
    /**
     * Perform comprehensive risk assessment
     */
    private performRiskAssessment;
    /**
     * Create bypass risk assessment when risk management is disabled
     */
    private createBypassRiskAssessment;
    /**
     * Integrate recommendations from scoring and risk analysis
     */
    private integrateRecommendations;
    /**
     * Calculate risk adjustments to apply
     */
    private calculateRiskAdjustments;
    /**
     * Calculate final stake recommendation
     */
    private calculateFinalStake;
    /**
     * Calculate performance projections
     */
    private calculatePerformanceProjections;
    /**
     * Calculate win probability from odds and expected value
     */
    private calculateWinProbability;
    /**
     * Check for active risk alerts
     */
    private checkRiskAlerts;
    /**
     * Update integration statistics
     */
    private updateIntegrationStats;
    /**
     * Create fallback result for error cases
     */
    private createFallbackResult;
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<ScoringIntegrationConfig>): void;
    /**
     * Get integration statistics
     */
    getIntegrationStatistics(): any;
}
//# sourceMappingURL=ScoringAgentIntegration.d.ts.map