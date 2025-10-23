export interface RiskConfig {
    maxPositionSize: number;
    maxCorrelation: number;
    maxDrawdown: number;
    minSharpeRatio: number;
    maxExposurePerSport: number;
    maxExposurePerPlayer: number;
    maxDailyRisk: number;
    kellyMultiplier: number;
    stopLossThreshold: number;
    maxVaR: number;
    maxCVaR: number;
}
export interface Position {
    propId: string;
    player: string;
    sport: string;
    marketType: string;
    odds: number;
    stake: number;
    expectedValue: number;
    confidence: number;
    tier: string;
    timestamp: string;
    correlations?: Record<string, number>;
    riskMetrics?: PositionRiskMetrics;
}
export interface PositionRiskMetrics {
    individualRisk: number;
    correlationRisk: number;
    portfolioContribution: number;
    valueAtRisk: number;
    expectedShortfall: number;
    liquidityRisk: number;
    concentrationRisk: number;
}
export interface PortfolioRisk {
    totalExposure: number;
    totalRisk: number;
    sharpeRatio: number;
    maxDrawdown: number;
    valueAtRisk: number;
    expectedShortfall: number;
    correlationMatrix: Record<string, Record<string, number>>;
    riskByCategory: Record<string, number>;
    diversificationRatio: number;
}
export interface RiskAlert {
    type: 'EXPOSURE' | 'CORRELATION' | 'DRAWDOWN' | 'VAR' | 'CONCENTRATION';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    message: string;
    threshold: number;
    current: number;
    recommendation: string;
    timestamp: string;
}
/**
 * Fortune 100 Syndicate-Level Risk Management System
 * Implements advanced portfolio optimization, Kelly sizing, correlation analysis,
 * and automated risk controls with real-time monitoring
 */
export declare class RiskManager {
    private config;
    private positions;
    private riskHistory;
    private alerts;
    constructor(config: RiskConfig);
    /**
     * Calculate optimal Kelly position size with risk adjustments
     */
    calculateKellyPositionSize(winProbability: number, odds: number, confidence: number, riskFactors?: Partial<PositionRiskMetrics>): Promise<number>;
    /**
     * Apply comprehensive risk adjustments to Kelly sizing
     */
    private applyRiskAdjustments;
    /**
     * Calculate comprehensive position size with portfolio context
     */
    calculatePositionSize(kellyFraction: number, riskScore: number, portfolioContext?: {
        currentExposure: number;
        correlatedPositions: Position[];
        availableCapital: number;
    }): Promise<number>;
    /**
     * Assess comprehensive risk for a single prop
     */
    assessPropRisk(prop: {
        propId: string;
        sport: string;
        player: string;
        marketType: string;
        odds: number;
        expectedValue: number;
        confidence: number;
    }): Promise<{
        overallRisk: number;
        riskBreakdown: PositionRiskMetrics;
        riskFactors: string[];
        recommendation: 'APPROVE' | 'REDUCE' | 'REJECT';
    }>;
    /**
     * Calculate detailed risk metrics for a position
     */
    private calculatePositionRiskMetrics;
    /**
     * Calculate individual position risk
     */
    private calculateIndividualRisk;
    /**
     * Calculate correlation risk with existing positions
     */
    private calculateCorrelationRisk;
    /**
     * Get correlation between two positions
     */
    private getCorrelation;
    /**
     * Check if two props are from the same game
     */
    private isSameGame;
    /**
     * Calculate portfolio contribution risk
     */
    private calculatePortfolioContribution;
    /**
     * Calculate Value at Risk for a position
     */
    private calculateVaR;
    /**
     * Calculate Conditional Value at Risk (Expected Shortfall)
     */
    private calculateCVaR;
    /**
     * Assess liquidity risk
     */
    private assessLiquidityRisk;
    /**
     * Calculate concentration risk
     */
    private calculateConcentrationRisk;
    /**
     * Get current exposure to a specific player
     */
    private getPlayerExposure;
    /**
     * Get current exposure to a specific sport
     */
    private getSportExposure;
    /**
     * Get current exposure to a specific market type
     */
    private getMarketTypeExposure;
    /**
     * Calculate current portfolio risk
     */
    private calculateCurrentPortfolioRisk;
    /**
     * Simulate portfolio risk with new position
     */
    private simulatePortfolioRisk;
    /**
     * Apply automated stop-loss and drawdown controls
     */
    checkStopLossConditions(): Promise<RiskAlert[]>;
    /**
     * Adjust portfolio risk by modifying position sizes
     */
    adjustPortfolioRisk(gradingResults: any[]): Promise<any[]>;
    /**
     * Get comprehensive risk report
     */
    getRiskReport(): Promise<{
        portfolioRisk: PortfolioRisk;
        alerts: RiskAlert[];
        recommendations: string[];
        riskTrend: Array<{
            date: string;
            risk: number;
        }>;
    }>;
    private estimateVolatility;
    private getZScore;
    private calculatePortfolioVariance;
    private calculateSharpeRatio;
    private calculateMaxDrawdown;
    private calculatePortfolioVaR;
    private buildCorrelationMatrix;
    private calculateRiskByCategory;
    /**
     * Calculate diversification ratio
     */
    private calculateDiversificationRatio;
    private generateRiskRecommendations;
    private getRiskTrend;
    /**
     * Add position to portfolio
     */
    addPosition(position: Position): void;
    /**
     * Remove position from portfolio
     */
    removePosition(propId: string): void;
    /**
     * Get all current positions
     */
    getPositions(): Position[];
    /**
     * Update risk configuration
     */
    updateConfig(newConfig: Partial<RiskConfig>): void;
    /**
     * Get current risk configuration
     */
    getConfig(): RiskConfig;
}
//# sourceMappingURL=riskManager.d.ts.map