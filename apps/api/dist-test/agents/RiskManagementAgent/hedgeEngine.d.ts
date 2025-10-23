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
interface HedgeOpportunity {
    id: string;
    type: 'direct_hedge' | 'correlation_hedge' | 'portfolio_hedge' | 'insurance_hedge';
    originalPosition: string;
    hedgeInstrument: HedgeInstrument;
    effectiveness: number;
    cost: number;
    riskReduction: number;
    returnImpact: number;
    timeDecay: number;
    recommendation: HedgeRecommendation;
    priority: 'high' | 'medium' | 'low';
    expirationTime: Date;
}
interface HedgeInstrument {
    type: 'opposite_bet' | 'correlated_bet' | 'insurance_bet' | 'spread_adjustment';
    gameId?: string;
    betType: string;
    suggestedStake: number;
    suggestedOdds: number;
    description: string;
    availability: 'high' | 'medium' | 'low';
    liquidityScore: number;
}
interface HedgeRecommendation {
    action: 'hedge_now' | 'hedge_conditional' | 'monitor' | 'no_hedge';
    reason: string;
    conditions?: string[];
    triggerEvents?: string[];
    timeframe: string;
    confidence: number;
}
interface HedgeAnalysis {
    portfolioRisk: number;
    hedgeOpportunities: HedgeOpportunity[];
    totalPotentialRiskReduction: number;
    recommendedHedges: HedgeOpportunity[];
    hedgingCost: number;
    netBenefit: number;
    riskProfile: 'conservative' | 'moderate' | 'aggressive';
}
export declare class HedgeEngine {
    private readonly logger;
    private hedgeHistory;
    private marketData;
    private hedgePerformance;
    private hedgeStrategies;
    constructor(logger: Logger);
    initialize(): Promise<void>;
    identifyHedgeOpportunities(positions: Position[], correlations: Map<string, number>): Promise<HedgeOpportunity[]>;
    analyzeHedgingNeed(positions: Position[], riskTolerance?: number): Promise<HedgeAnalysis>;
    executeHedgeRecommendation(hedgeOpportunity: HedgeOpportunity, userId: string): Promise<boolean>;
    monitorActiveHedges(userId: string): Promise<HedgeOpportunity[]>;
    private identifyDirectHedges;
    private createDirectHedge;
    private findOppositeHedge;
    private getOppositeBetType;
    private getOppositeOdds;
    private identifyCorrelationHedges;
    private createCorrelationHedge;
    private identifyPortfolioHedges;
    private identifyInsuranceHedges;
    private createInsuranceHedge;
    private identifyDynamicHedges;
    private createDynamicHedge;
    private calculatePortfolioRisk;
    private calculateCorrelations;
    private calculatePairwiseCorrelation;
    private isSameSport;
    private isSameDay;
    private calculateHedgeEffectiveness;
    private calculateHedgeCost;
    private calculateTimeDecay;
    private getTimeToEvent;
    private getMarketConditions;
    private filterViableOpportunities;
    private rankOpportunities;
    private selectOptimalHedges;
    private determineRiskProfile;
    private determinePriority;
    private generateDirectHedgeRecommendation;
    private generateCorrelationHedgeRecommendation;
    private generatePortfolioHedgeRecommendation;
    private generateInsuranceHedgeRecommendation;
    private generateDynamicHedgeRecommendation;
    private validateHedgeViability;
    private checkExecutionPermissions;
    private executeHedge;
    private recordHedgeExecution;
    private getActiveHedges;
    private updateHedgeEffectiveness;
    private shouldAdjustHedge;
    private generateAdjustmentRecommendation;
    private cacheHedgeOpportunities;
    private cacheActiveHedges;
    private loadHedgeStrategies;
    private loadMarketData;
    private loadHedgeHistory;
    private loadPerformanceData;
    isHealthy(): Promise<boolean>;
    cleanup(): Promise<void>;
}
export {};
//# sourceMappingURL=hedgeEngine.d.ts.map