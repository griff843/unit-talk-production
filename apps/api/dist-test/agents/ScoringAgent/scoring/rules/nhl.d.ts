export declare const nhlCoreStats: string[];
export declare const nhlSynergy: Record<string, string[]>;
export declare const enhancedNHLWeights: {
    goalieMatchupAnalysis: number;
    homeIceAdvantage: number;
    lineMatchupDepth: number;
    recentFormTrend: number;
    backToBackImpact: number;
    powerPlayOpportunity: number;
    playoffIntensityFactor: number;
    expectedValue: number;
    lineMovement: number;
    matchupRating: number;
    playerForm: number;
    injuryImpact: number;
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
};
export declare const nhlContextualMultipliers: {
    backToBackGames: number;
    restAdvantageGames: number;
    rivalryGames: number;
    playoffRace: number;
    goalieConfirmation: number;
    powerPlayMatchups: number;
    homeOpener: number;
    tradedPlayerReturn: number;
};
export declare const nhlGoalieFactors: {
    goalieStrength: {
        elite: number;
        average: number;
        backup: number;
        poor: number;
        unknown: number;
    };
    goalieMatchup: {
        elite_vs_weak_offense: number;
        poor_vs_strong_offense: number;
        backup_vs_rested_offense: number;
        tired_goalie_b2b: number;
        home_goalie_advantage: number;
    };
    situationalFactors: {
        newTeam: number;
        revenge: number;
        playoff_experience: number;
        rookie_playoff: number;
    };
};
export declare const nhlLineMatchups: {
    offensiveLines: {
        top_line_vs_weak_pairing: number;
        second_line_vs_tired_d: number;
        power_play_specialists: number;
        checking_line_vs_skill: number;
        fourth_line_energy: number;
    };
    defensivePairings: {
        shutdown_pairing: number;
        offensive_dmen: number;
        rookie_dmen: number;
        injured_dmen: number;
        tired_defense_b2b: number;
    };
};
export declare const nhlSpecialTeamsFactors: {
    powerPlayOpportunity: {
        undisciplinedTeam: number;
        disciplinedTeam: number;
        refereeHistory: number;
        rivalryGame: number;
        playoffRace: number;
    };
    powerPlayEfficiency: {
        elite_pp_vs_poor_pk: number;
        poor_pp_vs_elite_pk: number;
        road_power_play: number;
        tired_power_play: number;
        key_injury_pp: number;
    };
};
//# sourceMappingURL=nhl.d.ts.map