import { Logger } from '../../shared/logger/types';
interface OptimizationParams {
    targetRisk: number;
    targetReturn: number;
    maxPositions: number;
    minPosition: number;
    maxPosition: number;
    riskTolerance: 'conservative' | 'moderate' | 'aggressive';
    optimizationMethod: 'markowitz' | 'black_litterman' | 'risk_parity' | 'kelly';
}
interface Position {
    id: string;
    gameId: string;
    betType: string;
    stake: number;
    odds: number;
    expectedValue: number;
    volatility: number;
    correlation: Map<string, number>;
    expectedReturn: number;
    riskContribution: number;
}
interface OptimizationResult {
    optimizedWeights: Map<string, number>;
    expectedReturn: number;
    expectedRisk: number;
    sharpeRatio: number;
    diversificationRatio: number;
    concentrationRisk: number;
    recommendations: OptimizationRecommendation[];
    efficientFrontier?: EfficientFrontierPoint[];
}
interface OptimizationRecommendation {
    positionId: string;
    currentWeight: number;
    recommendedWeight: number;
    action: 'increase' | 'decrease' | 'close' | 'maintain';
    reason: string;
    impact: {
        riskChange: number;
        returnChange: number;
        diversificationChange: number;
    };
    priority: 'high' | 'medium' | 'low';
}
interface EfficientFrontierPoint {
    risk: number;
    return: number;
    weights: Map<string, number>;
    sharpeRatio: number;
}
interface PortfolioConstraints {
    maxWeight: number;
    minWeight: number;
    sectorConstraints: Map<string, number>;
    correlationLimit: number;
    liquidityConstraint: number;
    drawdownLimit: number;
}
export declare class PortfolioOptimizer {
    private readonly logger;
    private optimizationHistory;
    private correlationMatrix;
    private riskModels;
    constructor(logger: Logger);
    initialize(): Promise<void>;
    optimizePortfolio(positions: Position[], constraints: PortfolioConstraints, params: OptimizationParams, totalCapital: number): Promise<OptimizationResult>;
    optimizePositionSizing(positions: Position[], bankroll: number, riskTolerance: number): Promise<Map<string, number>>;
    calculateEfficientFrontier(positions: Position[], expectedReturns: number[], covarianceMatrix: number[][], constraints: PortfolioConstraints, numPoints?: number): Promise<EfficientFrontierPoint[]>;
    private markowitzOptimization;
    private blackLittermanOptimization;
    private riskParityOptimization;
    private kellyCriterionOptimization;
    private calculateExpectedReturns;
    private calculateCovarianceMatrix;
    private calculateKellyFraction;
    private adjustForRiskTolerance;
    private optimizeForSharpeRatio;
    private calculatePortfolioReturn;
    private calculatePortfolioVariance;
    private calculateDiversificationRatio;
    private calculateConcentrationRisk;
    private generateRecommendations;
    private generateRecommendationReason;
    private calculateMinVarianceWeights;
    private calculateMaxReturnWeights;
    private optimizeForTargetReturn;
    private getMarketCapWeights;
    private calculateImpliedReturns;
    private applyInvestorViews;
    private calculatePosteriorReturns;
    private calculateRiskParityWeights;
    private getHistoricalReturns;
    private validateInputs;
    private storeOptimizationResult;
    private loadRiskModels;
    private loadCorrelationData;
    private loadOptimizationHistory;
    isHealthy(): Promise<boolean>;
    cleanup(): Promise<void>;
}
export {};
//# sourceMappingURL=portfolioOptimizer.d.ts.map