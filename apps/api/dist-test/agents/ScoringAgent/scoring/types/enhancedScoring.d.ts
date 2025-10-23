/**
 * Enhanced Scoring Types
 * Implements professional capper analysis techniques identified in capper insights analysis
 */
export interface HandednessSplits {
    batterVsLHP: {
        avg: number;
        ops: number;
        hr: number;
        rbi: number;
        strikeouts: number;
        games: number;
    };
    batterVsRHP: {
        avg: number;
        ops: number;
        hr: number;
        rbi: number;
        strikeouts: number;
        games: number;
    };
    pitcherVsLHB: {
        era: number;
        whip: number;
        k_rate: number;
        hr_rate: number;
        games: number;
    };
    pitcherVsRHB: {
        era: number;
        whip: number;
        k_rate: number;
        hr_rate: number;
        games: number;
    };
}
export interface PerformanceMetrics {
    avg?: number;
    ops?: number;
    era?: number;
    whip?: number;
    k_rate?: number;
    hr_rate?: number;
    hits?: number;
    runs?: number;
    rbi?: number;
    strikeouts?: number;
    wins?: number;
    losses?: number;
}
export interface RecentTrends {
    last3Games: PerformanceMetrics;
    last7Games: PerformanceMetrics;
    last15Games: PerformanceMetrics;
    last30Games: PerformanceMetrics;
    trendDirection: 'improving' | 'declining' | 'stable';
    streakType: 'hitting' | 'cold' | 'neutral';
    streakLength: number;
    consistencyScore: number;
}
export interface HeadToHeadHistory {
    playerVsPitcher: {
        atBats: number;
        hits: number;
        homeRuns: number;
        strikeouts: number;
        avg: number;
        ops: number;
        lastFaced: Date | null;
    };
    pitcherVsBatter: {
        atBats: number;
        hits: number;
        strikeouts: number;
        homeRuns: number;
        era: number;
        whip: number;
        lastFaced: Date | null;
    };
    recentPerformance: PerformanceMetrics[];
    advantageDirection: 'batter' | 'pitcher' | 'neutral';
}
export interface RosterStabilityData {
    recentTrades: {
        playersAdded: number;
        playersLost: number;
        keyPlayersAffected: string[];
        tradeDeadlineActivity: boolean;
        daysAgo: number;
    };
    lineupChanges: {
        newStarters: number;
        positionChanges: number;
        battingOrderChanges: number;
        consistencyScore: number;
    };
    chemistryIndicators: {
        newPlayerIntegrationDays: number;
        teamMoraleScore: number;
        recentTeamPerformance: PerformanceMetrics;
        leadershipStability: boolean;
    };
    stabilityScore: number;
}
export interface BullpenQualityData {
    overallStrength: {
        era: number;
        whip: number;
        k_rate: number;
        saves: number;
        blownSaves: number;
    };
    recentChanges: {
        tradedAway: string[];
        acquired: string[];
        injuries: string[];
        daysAgo: number;
    };
    depthChart: {
        closer: {
            name: string;
            era: number;
            available: boolean;
        };
        setup: {
            name: string;
            era: number;
            available: boolean;
        }[];
        middle: {
            name: string;
            era: number;
            available: boolean;
        }[];
    };
    qualityScore: number;
    fatigueLevel: number;
}
export interface AdvancedSplits {
    monthly: {
        [month: string]: PerformanceMetrics;
    };
    homeAway: {
        home: PerformanceMetrics;
        away: PerformanceMetrics;
        advantage: 'home' | 'away' | 'neutral';
    };
    parkSpecific: {
        [parkName: string]: PerformanceMetrics;
    };
    situational: {
        dayGame: PerformanceMetrics;
        nightGame: PerformanceMetrics;
        temperature: {
            cold: PerformanceMetrics;
            moderate: PerformanceMetrics;
            hot: PerformanceMetrics;
        };
        wind: {
            favorable: PerformanceMetrics;
            neutral: PerformanceMetrics;
            unfavorable: PerformanceMetrics;
        };
    };
}
export interface EnhancedScoringWeights {
    handednessSplits: number;
    recentTrendAnalysis: number;
    headToHeadHistory: number;
    rosterStabilityScore: number;
    bullpenQualityScore: number;
    advancedSplitAnalysis: number;
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
export interface EnhancedScoringResult {
    handednessSplitsScore: number;
    recentTrendsScore: number;
    headToHeadScore: number;
    rosterStabilityScore: number;
    bullpenQualityScore: number;
    advancedSplitsScore: number;
    handednessAdvantage: 'strong' | 'moderate' | 'slight' | 'neutral' | 'disadvantage';
    trendMomentum: 'hot' | 'warm' | 'neutral' | 'cool' | 'cold';
    historicalEdge: 'strong_batter' | 'slight_batter' | 'neutral' | 'slight_pitcher' | 'strong_pitcher';
    teamStability: 'very_stable' | 'stable' | 'moderate' | 'unstable' | 'very_unstable';
    bullpenReliability: 'elite' | 'strong' | 'average' | 'weak' | 'poor';
    situationalEdge: 'strong' | 'moderate' | 'slight' | 'neutral' | 'negative';
    enhancedScore: number;
    confidenceLevel: number;
    riskAssessment: 'low' | 'medium' | 'high';
    keyFactors: string[];
    warnings: string[];
    recommendations: string[];
}
export interface SportSpecificWeights {
    MLB: EnhancedScoringWeights;
    NBA: EnhancedScoringWeights;
    NFL: EnhancedScoringWeights;
    NHL: EnhancedScoringWeights;
}
export interface ContextualMultipliers {
    deadlineImpact: number;
    weatherGames: number;
    revengeGames: number;
    playoffRace: number;
    rookieDebut: number;
    streakSituations: number;
}
//# sourceMappingURL=enhancedScoring.d.ts.map