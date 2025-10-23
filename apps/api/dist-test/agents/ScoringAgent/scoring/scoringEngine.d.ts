import { EnhancedScoringResult } from './enhancedScoringEngine';
export interface ScoringWeights {
    expectedValue: number;
    lineMovement: number;
    matchupRating: number;
    playerForm: number;
    injuryImpact: number;
    weatherImpact: number;
    marketIntelligence: number;
    sharpMoney: number;
    volumeProfile: number;
    closingLineValue: number;
    steamDetection: number;
    closingLinePrediction: number;
    optimalTiming: number;
    lineShoppingEdge: number;
    publicVsSharpSplit: number;
    marketTimingAdvantage: number;
    injuryTimingEdge: number;
    crossMarketDiscrepancy: number;
    playerFatigue: number;
    venueAdvantage: number;
    refereeImpact: number;
    paceImpact: number;
    motivationalFactors: number;
    correlationRisk: number;
    volatility: number;
    portfolioImpact: number;
    neuralNetwork: number;
    gradientBoosting: number;
    randomForest: number;
    ensemble: number;
}
export interface ScoringConfig {
    name: string;
    version: string;
    weights: ScoringWeights;
    enabled: boolean;
    sport?: string;
    marketType?: string;
    minConfidence: number;
    maxRisk: number;
    description: string;
}
export interface ScoringResult {
    propId: string;
    finalScore: number;
    confidence: number;
    tier: 'S' | 'A' | 'B' | 'C' | 'D';
    edgeScore: number;
    featureContributions: Record<string, number>;
    modelContributions: Record<string, number>;
    kellyFraction: number;
    positionSize: number;
    riskScore: number;
    correlationRisk: number;
    scenarioAnalysis: {
        bullCase: {
            score: number;
            probability: number;
        };
        baseCase: {
            score: number;
            probability: number;
        };
        bearCase: {
            score: number;
            probability: number;
        };
    };
    professionalInsights: {
        steamMoveDetected: boolean;
        predictedClosingLine: number;
        optimalBettingTime: string;
        bestAvailableLine: number;
        bestBook: string;
        publicBettingPercentage: number;
        sharpBettingPercentage: number;
        contrarianOpportunity: boolean;
        injuryTimingAdvantage: number;
        crossMarketArbitrage: number;
    };
    enhancedCapperAnalysis?: EnhancedScoringResult;
    deviggingResult?: {
        originalEdge: number;
        deviggedEdge: number;
        totalVig: number;
        fairOdds: number;
        trueValue: boolean;
    };
    dataQuality: number;
    modelAgreement: number;
    historicalAccuracy: number;
    timestamp: string;
    modelVersion: string;
    configUsed: string;
}
//# sourceMappingURL=scoringEngine.d.ts.map