/**
 * Portfolio Risk Manager
 * Implements correlation limits, portfolio caps, and position sizing controls
 */
export interface PortfolioLimits {
    maxSinglePositionSize: number;
    maxDailyPortfolioRisk: number;
    maxGameExposure: number;
    maxPlayerExposure: number;
    maxCorrelationThreshold: number;
    maxCorrelatedPositions: number;
    maxSameGamePositions: number;
    maxSamePlayerPositions: number;
    maxSportConcentration: number;
    maxTierConcentration: number;
    maxBookmakerExposure: number;
    dailyVARLimit: number;
    weeklyDrawdownLimit: number;
    monthlyVolatilityLimit: number;
}
export interface CorrelationAnalysis {
    pickId: string;
    correlatedPositions: CorrelatedPosition[];
    averageCorrelation: number;
    maxCorrelation: number;
    correlationRisk: 'low' | 'medium' | 'high' | 'extreme';
    diversificationScore: number;
}
export interface CorrelatedPosition {
    pickId: string;
    propId: string;
    correlation: number;
    positionSize: number;
    riskContribution: number;
    type: 'same_game' | 'same_player' | 'statistical' | 'market_driven';
}
export interface PortfolioRisk {
    totalPositions: number;
    totalRisk: number;
    var95: number;
    expectedDrawdown: number;
    diversificationRatio: number;
    concentrationRisk: number;
    liquidityRisk: number;
    overallRisk: 'low' | 'medium' | 'high' | 'extreme';
}
export interface PositionSizingDecision {
    pickId: string;
    recommendedSize: number;
    maxAllowedSize: number;
    actualSize: number;
    approved: boolean;
    limitingFactor: string;
    riskAdjustment: number;
    reasoning: string;
}
declare class PortfolioRiskManager {
    private static instance;
    private logger;
    private readonly LIMITS;
    private constructor();
    static getInstance(): PortfolioRiskManager;
    /**
     * Main portfolio risk assessment and position sizing
     */
    assessPositionRisk(pick: any, requestedSize: number): Promise<PositionSizingDecision>;
    /**
     * Analyze correlations with existing positions
     */
    private analyzeCorrelations;
    /**
     * Calculate correlation between two picks
     */
    private calculateCorrelation;
    /**
     * Calculate same-game correlation
     */
    private calculateSameGameCorrelation;
    /**
     * Calculate statistical correlation using historical data
     */
    private calculateStatisticalCorrelation;
    /**
     * Determine correlation type
     */
    private determineCorrelationType;
    /**
     * Calculate risk impact of adding new position
     */
    private calculateRiskImpact;
    /**
     * Determine optimal position size
     */
    private determinePositionSize;
    /**
     * Helper calculation methods
     */
    private getCurrentPortfolio;
    private calculateCurrentPortfolioRisk;
    private classifyCorrelationRisk;
    private calculateDiversificationScore;
    private calculateConcentrationRisk;
    private calculateCurrentConcentrationRisk;
    private calculateLiquidityRisk;
    private calculateGameExposure;
    private getCurrentGameExposure;
    private calculateOptimalKellySize;
    private classifyOverallRisk;
    private generateSizingReasoning;
    private storeRiskAssessment;
    /**
     * Get portfolio risk statistics
     */
    getPortfolioStats(): Promise<{
        totalPositions: number;
        totalRisk: number;
        currentVar95: number;
        topCorrelations: Array<{
            pick1: string;
            pick2: string;
            correlation: number;
        }>;
        concentrationByGame: Record<string, number>;
        concentrationBySport: Record<string, number>;
        riskDistribution: Record<string, number>;
    }>;
}
export declare const portfolioRiskManager: PortfolioRiskManager;
export {};
//# sourceMappingURL=PortfolioRiskManager.d.ts.map