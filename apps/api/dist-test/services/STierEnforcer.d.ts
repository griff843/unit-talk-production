/**
 * S-Tier Enforcement Service
 * Enforces strict S-tier thresholds with EV/CLV/Steam validation gates
 */
export interface STierRequirements {
    minExpectedValue: number;
    minCLVThreshold: number;
    maxNegativeCLVAllowed: number;
    minConfidenceScore: number;
    minProfessionalScore: number;
    requiresPositiveSteam: boolean;
    minSteamStrength: number;
    maxCounterSteam: number;
    maxDrawdownRisk: number;
    minKellyFraction: number;
    maxKellyFraction: number;
    minMarketDepth: number;
    maxMarketImpact: number;
    requiresSharpMoney: boolean;
}
export interface STierValidation {
    pickId: string;
    tier: string;
    passed: boolean;
    enforced: boolean;
    violations: STierViolation[];
    adjustedTier?: string;
    reasoning: string;
    riskAssessment: RiskAssessment;
    marketValidation: MarketValidation;
    steamAnalysis: SteamAnalysis;
}
export interface STierViolation {
    rule: string;
    severity: 'critical' | 'major' | 'minor';
    value: number;
    threshold: number;
    message: string;
    autoCorrect: boolean;
}
export interface RiskAssessment {
    expectedDrawdown: number;
    kellyFraction: number;
    portfolioImpact: number;
    correlationRisk: number;
    liquidityRisk: number;
    overallRisk: 'low' | 'medium' | 'high' | 'extreme';
}
export interface MarketValidation {
    depth: number;
    impact: number;
    efficiency: number;
    sharpMoneyPresent: boolean;
    institutionalFlow: number;
    retailPercentage: number;
    qualityScore: number;
}
export interface SteamAnalysis {
    strength: number;
    direction: 'for' | 'against' | 'neutral';
    volume: number;
    timeframe: string;
    sustainability: number;
    qualityScore: number;
}
declare class STierEnforcer {
    private static instance;
    private logger;
    private readonly REQUIREMENTS;
    private constructor();
    static getInstance(): STierEnforcer;
    /**
     * Main S-tier validation and enforcement
     */
    enforceSTierStandards(pick: any): Promise<STierValidation>;
    /**
     * Validate core S-tier thresholds
     */
    private validateCoreThresholds;
    /**
     * Validate EV and CLV requirements
     */
    private validateEVCLV;
    /**
     * Validate steam requirements
     */
    private validateSteam;
    /**
     * Assess risk factors
     */
    private assessRisk;
    /**
     * Validate market conditions
     */
    private validateMarket;
    /**
     * Determine enforcement action
     */
    private determineEnforcement;
    /**
     * Apply tier adjustment
     */
    private applyTierAdjustment;
    /**
     * Store validation result
     */
    private storeValidation;
    /**
     * Helper methods for calculations
     */
    private calculateKellyFraction;
    private calculateExpectedDrawdown;
    private calculatePortfolioImpact;
    private calculateCorrelationRisk;
    private calculateLiquidityRisk;
    private classifyOverallRisk;
    private getSteamData;
    private getMarketData;
    /**
     * Get S-tier enforcement statistics
     */
    getEnforcementStats(timeframe?: 'day' | 'week' | 'month'): Promise<{
        totalValidations: number;
        stierPicks: number;
        downgrades: number;
        violationTypes: Record<string, number>;
        avgConfidence: number;
        avgEV: number;
        avgCLV: number;
    }>;
}
export declare const sTierEnforcer: STierEnforcer;
export {};
//# sourceMappingURL=STierEnforcer.d.ts.map