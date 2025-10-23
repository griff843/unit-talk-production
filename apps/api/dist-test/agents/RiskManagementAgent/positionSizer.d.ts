import { Logger } from '../../shared/logger/types';
interface Position {
    id: string;
    userId: string;
    gameId: string;
    betType: string;
    stake: number;
    odds: number;
    expectedValue: number;
    volatility: number;
    correlation: Map<string, number>;
    riskContribution: number;
    timestamp: Date;
}
interface RiskLimits {
    maxSinglePosition: number;
    maxDailyExposure: number;
    maxCorrelatedExposure: number;
    maxDrawdownThreshold: number;
    minBankrollReserve: number;
    concentrationLimit: number;
}
interface PositionSizingParams {
    method: 'kelly' | 'fixed_percentage' | 'volatility_scaled' | 'risk_parity' | 'adaptive';
    riskTolerance: number;
    maxPositionSize: number;
    targetVolatility: number;
    correlationAdjustment: boolean;
    dynamicSizing: boolean;
}
interface OptimizedPosition {
    positionId: string;
    currentSize: number;
    recommendedSize: number;
    sizingRatio: number;
    reason: string;
    changeRequired: boolean;
    riskImpact: number;
    expectedReturnImpact: number;
    priority: 'high' | 'medium' | 'low';
}
interface PortfolioOptimization {
    positions: OptimizedPosition[];
    totalRecommendedExposure: number;
    riskReduction: number;
    expectedReturnChange: number;
    diversificationImprovement: number;
    correlationAdjustments: CorrelationAdjustment[];
}
interface CorrelationAdjustment {
    positionPair: string[];
    correlationLevel: number;
    recommendedAdjustment: number;
    impact: string;
}
interface KellyCalculation {
    kellyFraction: number;
    adjustedFraction: number;
    confidence: number;
    riskAdjustment: number;
    correlationAdjustment: number;
}
export declare class PositionSizer {
    private readonly logger;
    private sizingHistory;
    private bankrollTracking;
    private correlationMatrix;
    private volatilityModels;
    constructor(logger: Logger);
    initialize(): Promise<void>;
    optimizePortfolio(positions: Position[], limits: RiskLimits, bankroll: number, params?: PositionSizingParams): Promise<PortfolioOptimization>;
    calculateOptimalSize(position: Position, bankroll: number, riskTolerance?: number): Promise<number>;
    calculateKellyFraction(position: Position): Promise<KellyCalculation>;
    sizeNewPosition(proposedPosition: Omit<Position, 'id' | 'stake'>, existingPositions: Position[], bankroll: number, limits: RiskLimits): Promise<number>;
    private optimizePosition;
    private calculateWinProbability;
    private calculateConfidence;
    private calculateRiskAdjustment;
    private calculateCorrelationAdjustment;
    private getBetTypeConfidence;
    private calculateVolatilityScaledSize;
    private calculateRiskParitySize;
    private calculateAdaptiveSize;
    private getAdaptiveWeight;
    private getCorrelationAdjustmentFactor;
    private getPositionCorrelation;
    private isSameSport;
    private isSameDay;
    private applyPortfolioConstraints;
    private calculateCorrelationAdjustments;
    private applyDynamicScaling;
    private getPerformanceScaling;
    private getMarketConditionScaling;
    private adjustForCorrelations;
    private adjustForConcentration;
    private calculateAssetClassExposure;
    private getAssetClass;
    private getUserBankroll;
    private calculateRiskReduction;
    private calculateExpectedReturnChange;
    private calculateDiversificationImprovement;
    private calculateRiskImpact;
    private calculateReturnImpact;
    private determinePriority;
    private storeSizingDecision;
    private loadSizingHistory;
    private loadBankrollTracking;
    private loadVolatilityModels;
    private loadCorrelationData;
    isHealthy(): Promise<boolean>;
    cleanup(): Promise<void>;
}
export {};
//# sourceMappingURL=positionSizer.d.ts.map