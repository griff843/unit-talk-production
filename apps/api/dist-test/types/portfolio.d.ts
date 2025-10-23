export interface PortfolioConfig {
    maxPositionSize: number;
    maxSectorExposure: number;
    maxSportExposure: number;
    maxRiskThreshold: number;
    minSharpeRatio: number;
    minDiversification: number;
    rebalancingThreshold: number;
    minTradeSize: number;
    rebalancingInterval: number;
    monitoringInterval: number;
}
export interface PortfolioPosition {
    id: string;
    sport: string;
    market: string;
    sector: string;
    team?: string;
    player?: string;
    size: number;
    value: number;
    price: number;
    odds: number;
    confidence: number;
    expectedReturn: number;
    risk: number;
    marketSentiment?: 'bullish' | 'bearish' | 'neutral';
    lineMovement?: number;
    volumeAnalysis?: number;
    timestamp: number;
    lastOptimized?: number;
    lastTrade?: number;
}
export interface OptimizationResult {
    strategy: PortfolioStrategy;
    adjustments: PositionAdjustment[];
    expectedReturn: number;
    expectedRisk: number;
    confidence: number;
    timestamp: number;
}
export interface PositionAdjustment {
    positionId: string;
    newSize: number;
    adjustment: number;
}
export type PortfolioStrategy = 'risk_parity' | 'mean_variance' | 'kelly_criterion' | 'black_litterman' | 'conservative';
export interface RiskMetrics {
    totalValue: number;
    totalRisk: number;
    weightedReturn: number;
    weightedRisk: number;
    sharpeRatio: number;
    diversification: number;
    correlations: Map<string, Map<string, number>>;
    positionCount: number;
    sectorExposure: Map<string, number>;
    sportExposure: Map<string, number>;
}
export interface PortfolioPerformance {
    totalReturn: number;
    annualizedReturn: number;
    volatility: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    profitFactor: number;
    averageWin: number;
    averageLoss: number;
    largestWin: number;
    largestLoss: number;
    consecutiveWins: number;
    consecutiveLosses: number;
}
export interface PortfolioConstraints {
    maxPositions: number;
    maxPositionSize: number;
    maxSectorExposure: number;
    maxSportExposure: number;
    maxCorrelation: number;
    minDiversification: number;
    maxLeverage: number;
    minLiquidity: number;
}
export interface PortfolioAllocation {
    positions: PortfolioPosition[];
    weights: Map<string, number>;
    riskContributions: Map<string, number>;
    expectedReturn: number;
    expectedRisk: number;
    sharpeRatio: number;
}
export interface RebalancingEvent {
    timestamp: number;
    strategy: PortfolioStrategy;
    adjustments: PositionAdjustment[];
    reason: string;
    impact: {
        returnImpact: number;
        riskImpact: number;
        costImpact: number;
    };
}
export interface PortfolioAnalytics {
    performance: PortfolioPerformance;
    riskMetrics: RiskMetrics;
    allocation: PortfolioAllocation;
    rebalancingHistory: RebalancingEvent[];
    optimizationHistory: OptimizationResult[];
}
//# sourceMappingURL=portfolio.d.ts.map