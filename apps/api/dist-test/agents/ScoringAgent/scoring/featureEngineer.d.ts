import { GradingFeatureSet } from '../../../types/GradingFeatureSet';
/**
 * Feature Engineering for Fortune 100 Syndicate Level
 * Enriches basic features with advanced analytics, market intelligence,
 * and ML-ready feature transformations
 */
export declare class FeatureEngineer {
    private _marketDataCache;
    private _playerStatsCache;
    private _weatherCache;
    constructor();
    private initializeCaches;
    /**
     * Enrich features with advanced analytics
     */
    enrichFeatures(_features: GradingFeatureSet): Promise<GradingFeatureSet>;
    /**
     * Add advanced player analytics
     */
    private addPlayerAnalytics;
    /**
     * Add market intelligence features
     */
    private addMarketIntelligence;
    /**
     * Add situational factors
     */
    private addSituationalFactors;
    /**
     * Add correlation analysis
     */
    private addCorrelationAnalysis;
    /**
     * Add risk metrics
     */
    private addRiskMetrics;
    /**
     * Add data quality scores
     */
    private addDataQualityScores;
    private calculatePlayerFatigue;
    private calculateRecentUsage;
    private calculateSituationalPerformance;
    private calculateTrendMomentum;
    private calculateSharpMoney;
    private calculateVolumeProfile;
    private calculateCrossBookVariance;
    private calculateMarketEfficiency;
    private predictClosingLineValue;
    private calculateVenueAdvantage;
    private calculateRefereeImpact;
    private calculatePaceImpact;
    private calculateMotivationalFactors;
    private calculateRestAdvantage;
    private calculateTeamTotalCorrelation;
    private calculateGameScriptDependency;
    private calculatePlayerCorrelations;
    private calculateMarketCorrelations;
    private calculateVolatility;
    private calculateVaR;
    private calculateExpectedShortfall;
    private calculateCorrelationRisk;
    private calculateDataValidationScore;
    private calculateOutlierScore;
    private calculateConsistencyScore;
    getCachedMarketData(key: string): Promise<any>;
    setCachedMarketData(key: string, data: any): Promise<void>;
    getCachedPlayerStats(key: string): Promise<any>;
    setCachedPlayerStats(key: string, data: any): Promise<void>;
    getCachedWeatherData(key: string): Promise<any>;
    setCachedWeatherData(key: string, data: any): Promise<void>;
    cleanupExpiredCache(): void;
    getCacheStats(): {
        marketDataSize: number;
        playerStatsSize: number;
        weatherSize: number;
        totalSize: number;
    };
}
//# sourceMappingURL=featureEngineer.d.ts.map