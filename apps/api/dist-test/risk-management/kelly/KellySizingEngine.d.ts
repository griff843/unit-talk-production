/**
 * Kelly Criterion Sizing Engine
 *
 * Professional-grade Kelly sizing implementation for optimal bet sizing and risk management.
 * Implements fractional Kelly (25%) with confidence adjustments, correlation penalties,
 * and portfolio context optimization.
 */
import { KellyResult, RiskProfile, KellyConfig, Position } from '../types';
export interface KellyCalculationInput {
    propId: string;
    odds: number;
    winProbability: number;
    expectedValue: number;
    confidence: number;
    bankroll: number;
    variance?: number;
    correlatedExposure?: number;
    portfolioContext?: {
        currentExposure: number;
        correlatedPositions: Position[];
        availableCapital: number;
        riskBudget: number;
    };
}
export interface KellyValidationResult {
    isValid: boolean;
    violations: string[];
    adjustedFraction: number;
    reasoning: string[];
}
export declare class KellySizingEngine {
    private logger;
    private config;
    private riskProfile;
    private calculationHistory;
    private performanceMetrics;
    constructor(config: KellyConfig, riskProfile: RiskProfile);
    /**
     * Calculate optimal Kelly position size with all adjustments
     */
    calculateOptimalSize(input: KellyCalculationInput): Promise<KellyResult>;
    /**
     * Calculate Kelly for multiple positions simultaneously
     */
    batchCalculateKelly(inputs: KellyCalculationInput[]): Promise<KellyResult[]>;
    /**
     * Validate Kelly calculation input
     */
    private validateInput;
    /**
     * Calculate base Kelly fraction using the Kelly formula
     */
    private calculateBaseKelly;
    /**
     * Calculate all risk adjustments to apply to Kelly fraction
     */
    private calculateRiskAdjustments;
    /**
     * Apply calculated adjustments to Kelly fraction
     */
    private applyAdjustments;
    /**
     * Apply portfolio-level constraints to Kelly sizing
     */
    private applyPortfolioConstraints;
    /**
     * Calculate portfolio context adjustment factor
     */
    private calculatePortfolioAdjustment;
    /**
     * Final validation of Kelly result
     */
    private validateFinalResult;
    /**
     * Calculate overall risk score for the position
     */
    private calculateRiskScore;
    /**
     * Convert American odds to decimal odds
     */
    private americanToDecimal;
    /**
     * Convert odds to implied probability
     */
    private oddsToImpliedProbability;
    /**
     * Create rejected result
     */
    private createRejectedResult;
    /**
     * Create error result
     */
    private createErrorResult;
    /**
     * Update calculation statistics
     */
    private updateStatistics;
    /**
     * Get Kelly engine performance statistics
     */
    getPerformanceStatistics(): any;
    /**
     * Update risk profile
     */
    updateRiskProfile(newProfile: RiskProfile): void;
    /**
     * Update Kelly configuration
     */
    updateConfig(newConfig: Partial<KellyConfig>): void;
    /**
     * Get current configuration
     */
    getConfig(): KellyConfig;
    /**
     * Calculate Kelly efficiency for a completed bet
     */
    calculateKellyEfficiency(actualStake: number, recommendedStake: number, outcome: 'WIN' | 'LOSS', actualOdds: number): {
        efficiency: number;
        utilityGained: number;
        utilityLost: number;
        optimalUtility: number;
        actualUtility: number;
    };
}
//# sourceMappingURL=KellySizingEngine.d.ts.map