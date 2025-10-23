/**
 * Enhanced Scoring Engine
 * Implements professional capper analysis techniques based on capper insights analysis
 *
 * Key enhancements:
 * - Handedness split analysis (8% weight for MLB)
 * - Recent trend analysis (7% weight)
 * - Head-to-head historical performance (4% weight)
 * - Roster stability/chemistry impact (3% weight)
 * - Bullpen quality assessment (3% weight)
 * - Advanced situational splits (5% weight)
 */
import type { EnhancedScoringResult } from './types/enhancedScoring';
export type { EnhancedScoringResult };
export declare class EnhancedScoringEngine {
    private sportWeights;
    private contextualMultipliers;
    constructor();
    /**
     * Main enhanced scoring method
     */
    calculateEnhancedScore(sport: string, playerData: any, _gameContext: any, _marketData: any): Promise<EnhancedScoringResult>;
    /**
     * Calculate handedness splits professional_score (8% weight for MLB)
     * Based on batter vs LHP/RHP and pitcher vs LHB/RHB performance
     */
    private calculateHandednessSplitsScore;
    /**
     * Calculate recent trends professional_score (7% weight)
     * Based on performance over 3, 7, 15, 30 game windows
     */
    private calculateRecentTrendsScore;
    /**
     * Calculate head-to-head professional_score (4% weight)
     * Based on historical player vs pitcher performance
     */
    private calculateHeadToHeadScore;
    /**
     * Calculate roster stability professional_score (3% weight)
     * Based on recent trades, lineup changes, team chemistry
     */
    private calculateRosterStabilityScore;
    /**
     * Calculate bullpen quality professional_score (3% weight)
     * Based on bullpen strength and recent changes
     */
    private calculateBullpenQualityScore;
    /**
     * Calculate advanced splits professional_score (5% weight)
     * Based on monthly, park, weather, and situational performance
     */
    private calculateAdvancedSplitsScore;
    /**
     * Initialize sport-specific weights based on capper analysis
     */
    private initializeSportWeights;
    /**
     * Initialize contextual multipliers
     */
    private initializeContextualMultipliers;
    private determineHandednessAdvantage;
    private determineTrendMomentum;
    private determineHistoricalEdge;
    private determineTeamStability;
    private determineBullpenReliability;
    private determineSituationalEdge;
    private calculateConfidenceLevel;
    private assessRisk;
    private generateKeyFactors;
    private generateWarnings;
    private generateRecommendations;
    private getBatterHandednessSplits;
    private getPitcherHandednessSplits;
    private getRecentTrends;
    private getHeadToHeadHistory;
    private getRosterStabilityData;
    private getBullpenQualityData;
    private getAdvancedSplits;
    private normalizePerformance;
    private getContextualMultiplier;
    private calculateVariance;
}
export declare const enhancedScoringEngine: EnhancedScoringEngine;
//# sourceMappingURL=enhancedScoringEngine.d.ts.map