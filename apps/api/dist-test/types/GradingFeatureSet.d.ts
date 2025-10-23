export interface BaseFeature {
    id: string;
    value: number;
    confidence: number;
    timestamp: string;
}
export interface MarketFeature extends BaseFeature {
    type: 'market';
    odds: number;
    line: number;
    volume: number;
    sharpAction: number;
    marketEfficiency: number;
}
export interface PlayerFeature extends BaseFeature {
    type: 'player';
    form: number;
    fatigue: number;
    matchupRating: number;
    roleStability: number;
    recentUsage: number;
    situationalPerformance: number;
}
export interface ContextFeature extends BaseFeature {
    type: 'context';
    venueAdvantage: number;
    weatherImpact: number;
    injuryImpact: number;
    refereeImpact: number;
    motivationalFactors: number;
}
export interface RiskFeature extends BaseFeature {
    type: 'risk';
    correlationRisk: number;
    volatility: number;
    portfolioImpact: number;
}
export interface DataQualityMetrics {
    dataValidationScore: number;
    outlierScore: number;
    consistencyScore: number;
    completeness: number;
}
export interface GradingFeatureSet {
    propId: string;
    unifiedPickId?: string;
    gameId?: string;
    date: string;
    sport: string;
    league: string;
    player?: string;
    marketType?: string;
    odds?: number;
    market: {
        type: string;
        odds: number;
        line: number;
    };
    line?: number;
    pro_attempts?: number;
    outcome?: 'over' | 'under';
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
    crossBookVariance?: number;
    marketEfficiency?: number;
    bidAskSpread?: number;
    lineMovementHistory?: Array<{
        timestamp: number;
        line: number;
        volume?: number;
    }>;
    bettingPercentages?: {
        public: number;
        sharp: number;
        timestamp: number;
    };
    steamMoveData?: {
        detected: boolean;
        confidence: number;
        timestamp: number;
    };
    multiBookLines?: Array<{
        book: string;
        line: number;
        odds: number;
        timestamp: number;
    }>;
    injuryNewsTimeline?: Array<{
        timestamp: number;
        severity: number;
        newsBreak: number;
    }>;
    crossMarketProps?: Array<{
        relatedPropId: string;
        correlation: number;
    }>;
    marketTimingScore?: number;
    optimalBettingWindow?: string;
    contrarianOpportunity?: boolean;
    playerFatigue: number;
    playerFatigueScore?: number;
    venueAdvantage: number;
    refereeImpact: number;
    paceImpact: number;
    motivationalFactors: number;
    recentUsage?: number;
    situationalPerformance?: number;
    trendMomentum?: number;
    restAdvantage?: number;
    correlationRisk: number;
    volatility: number;
    portfolioImpact: number;
    valueAtRisk?: number;
    expectedShortfall?: number;
    teamTotalCorrelation?: number;
    gameScriptDependency?: number;
    playerCorrelations?: Record<string, number>;
    marketCorrelations?: Record<string, number>;
    dataQuality: DataQualityMetrics;
    game_date?: string;
    gameDate?: string;
    hoursToGame?: number;
    late_breaking_news?: boolean;
    public_betting_percentage?: number;
    model_agreement?: number;
    timestamp: string;
    version: string;
    source: string;
    confidence: number;
    book?: string;
    features?: {
        market?: MarketFeature[];
        player?: PlayerFeature[];
        context?: ContextFeature[];
        risk?: RiskFeature[];
    };
}
//# sourceMappingURL=GradingFeatureSet.d.ts.map