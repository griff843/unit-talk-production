/**
 * FeatureComputationEngine - High-performance 45-factor scoring system
 *
 * Optimized for 8K+ simultaneous props with parallel processing:
 * - Rolling averages and trend analysis
 * - Market efficiency and steam detection
 * - Player form and correlation analysis
 * - Risk management and portfolio impact
 * - Advanced analytics and meta features
 */
interface PropFeatures {
    prop_id: string;
    player_name: string;
    sport: string;
    stat_type: string;
    line: number;
    over_odds: number;
    under_odds: number;
    tick_timestamp: string;
    features: {
        rolling_avg_7d?: number;
        rolling_avg_30d?: number;
        rolling_std_7d?: number;
        trend_direction?: number;
        trend_strength?: number;
        momentum_score?: number;
        market_efficiency_score?: number;
        steam_probability?: number;
        sharp_money_indicator?: number;
        line_movement_velocity?: number;
        odds_movement_magnitude?: number;
        vig_analysis?: number;
        player_form_score?: number;
        matchup_advantage?: number;
        venue_impact?: number;
        fatigue_factor?: number;
        injury_impact?: number;
        role_stability?: number;
        time_decay_factor?: number;
        market_maturity?: number;
        liquidity_score?: number;
        public_bias_indicator?: number;
        contrarian_opportunity?: number;
        closing_line_prediction?: number;
        correlation_risk?: number;
        portfolio_impact?: number;
        volatility_score?: number;
        hedge_opportunity?: number;
        middle_opportunity?: number;
        arbitrage_potential?: number;
        expected_value?: number;
        probability_edge?: number;
        confidence_interval?: number;
        model_agreement?: number;
        consensus_deviation?: number;
        kelly_fraction?: number;
        data_quality_score?: number;
        prediction_stability?: number;
        feature_importance?: number;
        model_certainty?: number;
        historical_accuracy?: number;
        volatility_adjusted_edge?: number;
        outlier_score?: number;
        processing_timestamp?: string;
        computation_version?: string;
    };
    computation_metadata: {
        features_computed: number;
        missing_features: number;
        data_quality: number;
        computation_time_ms: number;
        source_data_points: number;
    };
}
export declare class FeatureComputationEngine {
    private supabase;
    private logger;
    private config;
    constructor(supabase: any, logger: any, config?: Partial<typeof this.config>);
    /**
     * Compute all 45 features for a batch of props with parallel processing
     */
    computeFeatureBatch(propIds: string[]): Promise<{
        features: PropFeatures[];
        errors: Array<{
            prop_id: string;
            error: string;
        }>;
        performance: {
            total_props: number;
            successful_computations: number;
            average_computation_time: number;
            features_per_second: number;
            parallel_batches: number;
        };
    }>;
    /**
     * Compute features for a single batch with comprehensive feature set
     */
    private computeBatchFeatures;
    /**
     * Compute comprehensive feature set for a single prop
     */
    private computeSinglePropFeatures;
    /**
     * Compute rolling averages and trend features (6 factors)
     */
    private computeRollingFeatures;
    /**
     * Compute market efficiency and steam features (6 factors)
     */
    private computeMarketFeatures;
    /**
     * Compute player and matchup features (6 factors)
     */
    private computePlayerFeatures;
    private computeTimingFeatures;
    private computeRiskFeatures;
    private computeAdvancedAnalytics;
    private computeMetaFeatures;
    private fetchPropData;
    private fetchHistoricalData;
    private filterByDays;
    private calculateAverage;
    private calculateStandardDeviation;
    private normalizeValue;
    private clampValue;
    private calculateTrendDirection;
    private calculateTrendStrength;
    private calculateMomentumScore;
    private calculateMarketEfficiency;
    private getRecentLineMovement;
    private calculateSteamProbability;
    private calculateSharpMoneyIndicator;
    private calculateLineVelocity;
    private calculateOddsMovement;
    private calculateVigAnalysis;
    private calculatePlayerForm;
    private calculateMatchupAdvantage;
    private calculateVenueImpact;
    private calculateFatigueFactor;
    private calculateInjuryImpact;
    private calculateRoleStability;
}
export {};
//# sourceMappingURL=FeatureComputationEngine.d.ts.map