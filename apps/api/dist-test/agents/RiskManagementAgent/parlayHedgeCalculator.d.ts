import { Logger } from '../../shared/logger/types';
interface ParlayLeg {
    id: string;
    selection: string;
    odds: number;
    status: 'pending' | 'won' | 'lost' | 'pushed';
    result?: string;
    sport: string;
    gameId: string;
    betType: string;
    line?: number;
}
interface ParlayBet {
    id: string;
    userId: string;
    legs: ParlayLeg[];
    stake: number;
    potentialPayout: number;
    totalOdds: number;
    status: 'active' | 'won' | 'lost' | 'hedged';
    placedAt: Date;
}
interface HedgeOpportunity {
    parlayId: string;
    completedLegs: number;
    totalLegs: number;
    remainingLeg: ParlayLeg;
    currentValue: number;
    currentProfit: number;
    hedgeStake: number;
    hedgeSide: string;
    hedgeOdds: number;
    guaranteedProfit: number;
    maxPayout: number;
    hedgeEfficiency: number;
    recommendation: 'hedge_now' | 'wait' | 'let_ride';
    confidence: number;
}
interface HedgeCalculationResult {
    shouldHedge: boolean;
    hedgeOpportunity?: HedgeOpportunity;
    analysis: {
        profitWithHedge: number;
        profitWithoutHedge: number;
        riskWithHedge: number;
        riskWithoutHedge: number;
        breakEvenHedgeOdds: number;
        optimalHedgePercentage: number;
    };
}
export declare class ParlayHedgeCalculator {
    private readonly logger;
    private hedgeStrategies;
    constructor(logger: Logger);
    calculateHedgeOpportunity(parlay: ParlayBet): Promise<HedgeCalculationResult>;
    identifyActiveHedgeOpportunities(parlays: ParlayBet[]): Promise<HedgeOpportunity[]>;
    getHedgeRecommendation(parlay: ParlayBet): Promise<{
        action: 'hedge_now' | 'wait' | 'let_ride';
        reason: string;
        details?: HedgeOpportunity;
    }>;
    private calculateOptimalHedge;
    private getOppositeOdds;
    private getOpposingSelection;
    private determineRecommendation;
    private calculateConfidence;
    private analyzeHedgeScenarios;
    private createEmptyAnalysis;
    private initializeHedgeStrategies;
    isHealthy(): Promise<boolean>;
}
export {};
//# sourceMappingURL=parlayHedgeCalculator.d.ts.map