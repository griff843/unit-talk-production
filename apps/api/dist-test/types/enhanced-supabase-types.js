"use strict";
/**
 * Enhanced Supabase Types with Complete Schema Alignment
 * Updated to match Fortune 100-grade database structure
 * Includes all enhanced scoring metrics and professional capper features
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALIDATION_SCHEMAS = exports.SettlementTrackingSchema = exports.MLFeaturesSchema = exports.CapperProfileSchema = exports.EnhancedUnifiedPickSchema = exports.GradingResultSchema = exports.EnhancedRawPropSchema = void 0;
const zod_1 = require("zod");
exports.EnhancedRawPropSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    game_id: zod_1.z.string().uuid(),
    player_id: zod_1.z.string().uuid(),
    player_name: zod_1.z.string(),
    team: zod_1.z.string(),
    opponent: zod_1.z.string(),
    market: zod_1.z.string(),
    market_type: zod_1.z.string(),
    line: zod_1.z.number(),
    over: zod_1.z.number(),
    under: zod_1.z.number(),
    over_odds: zod_1.z.number(),
    under_odds: zod_1.z.number(),
    // Grading system
    outcome: zod_1.z.enum(['win', 'loss', 'push']).nullable().optional(),
    promoted_to_picks: zod_1.z.boolean().default(false),
    promoted_at: zod_1.z.string().datetime().optional(),
    // Enhanced scoring metrics
    trend_confidence: zod_1.z.number().optional(),
    edge_score: zod_1.z.number().optional(),
    matchup_quality: zod_1.z.number().optional(),
    expected_value: zod_1.z.number().optional(),
    sharp_money: zod_1.z.number().optional(),
    line_movement: zod_1.z.number().optional(),
    player_form: zod_1.z.number().optional(),
    injury_impact: zod_1.z.number().optional(),
    weather_impact: zod_1.z.number().optional(),
    market_intelligence: zod_1.z.number().optional(),
    volume_profile: zod_1.z.number().optional(),
    closing_line_value: zod_1.z.number().optional(),
    // Professional capper features
    steam_detected: zod_1.z.boolean().default(false),
    predicted_closing_line: zod_1.z.number().optional(),
    optimal_betting_time: zod_1.z.string().optional(),
    best_available_line: zod_1.z.number().optional(),
    best_book: zod_1.z.string().optional(),
    public_betting_percentage: zod_1.z.number().optional(),
    sharp_betting_percentage: zod_1.z.number().optional(),
    contrarian_opportunity: zod_1.z.boolean().default(false),
    injury_timing_advantage: zod_1.z.number().optional(),
    cross_market_arbitrage: zod_1.z.number().optional(),
    // Risk management factors
    player_fatigue: zod_1.z.number().optional(),
    venue_advantage: zod_1.z.number().optional(),
    referee_impact: zod_1.z.number().optional(),
    pace_impact: zod_1.z.number().optional(),
    motivational_factors: zod_1.z.number().optional(),
    correlation_risk: zod_1.z.number().optional(),
    volatility: zod_1.z.number().default(5),
    portfolio_impact: zod_1.z.number().optional(),
    bid_ask_spread: zod_1.z.number().default(0.02),
    // Data quality
    data_completeness: zod_1.z.number().default(0.95),
    outlier_score: zod_1.z.number().default(0.95),
    consistency_score: zod_1.z.number().default(0.95),
    data_validation_score: zod_1.z.number().default(0.95),
    // Standard
    source: zod_1.z.string().default('optimal'),
    league: zod_1.z.string(),
    game_date: zod_1.z.string().optional(),
    created_at: zod_1.z.string().datetime(),
    updated_at: zod_1.z.string().datetime(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional()
});
exports.GradingResultSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    prop_id: zod_1.z.string().uuid(),
    final_score: zod_1.z.number(),
    confidence: zod_1.z.number(),
    tier: zod_1.z.enum(['S', 'A', 'B', 'C', 'D']),
    edge_score: zod_1.z.number().optional(),
    kelly_fraction: zod_1.z.number().optional(),
    position_size: zod_1.z.number().optional(),
    risk_score: zod_1.z.number().optional(),
    feature_contributions: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    model_contributions: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    scenario_analysis: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    professional_insights: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    enhanced_capper_analysis: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    data_quality: zod_1.z.number().default(0.95),
    model_agreement: zod_1.z.number().optional(),
    historical_accuracy: zod_1.z.number().optional(),
    model_version: zod_1.z.string().optional(),
    config_used: zod_1.z.string().optional(),
    created_at: zod_1.z.string().datetime(),
    updated_at: zod_1.z.string().datetime()
});
exports.EnhancedUnifiedPickSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    raw_prop_id: zod_1.z.string().uuid(),
    grading_result_id: zod_1.z.string().uuid().optional(),
    player_name: zod_1.z.string(),
    market_type: zod_1.z.string(),
    line: zod_1.z.number(),
    odds: zod_1.z.number(),
    tier: zod_1.z.enum(['S', 'A', 'B', 'C', 'D']),
    confidence: zod_1.z.number(),
    score: zod_1.z.number(),
    edge_score: zod_1.z.number().optional(),
    position_size: zod_1.z.number().optional(),
    kelly_fraction: zod_1.z.number().optional(),
    risk_score: zod_1.z.number().optional(),
    play_status: zod_1.z.enum(['pending', 'approved', 'rejected', 'settled']).default('pending'),
    result: zod_1.z.enum(['win', 'loss', 'push', 'pending']).default('pending'),
    actual_result: zod_1.z.number().optional(),
    profit_loss: zod_1.z.number().optional(),
    settled_at: zod_1.z.string().datetime().optional(),
    created_at: zod_1.z.string().datetime(),
    updated_at: zod_1.z.string().datetime()
});
exports.CapperProfileSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    discord_id: zod_1.z.string(),
    username: zod_1.z.string(),
    tier: zod_1.z.enum(['bronze', 'silver', 'gold', 'platinum', 'vip', 'vip_plus']).default('bronze'),
    total_picks: zod_1.z.number().default(0),
    wins: zod_1.z.number().default(0),
    losses: zod_1.z.number().default(0),
    pushes: zod_1.z.number().default(0),
    win_rate: zod_1.z.number(), // This is a generated column
    roi: zod_1.z.number().default(0),
    units_won: zod_1.z.number().default(0),
    streak_current: zod_1.z.number().default(0),
    streak_type: zod_1.z.enum(['win', 'loss', 'none']).default('none'),
    created_at: zod_1.z.string().datetime(),
    updated_at: zod_1.z.string().datetime()
});
exports.MLFeaturesSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    prop_id: zod_1.z.string().uuid(),
    neural_network_score: zod_1.z.number().optional(),
    gradient_boosting_score: zod_1.z.number().optional(),
    random_forest_score: zod_1.z.number().optional(),
    ensemble_score: zod_1.z.number().optional(),
    model_agreement: zod_1.z.number().optional(),
    feature_weights: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    similar_props_performance: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    player_historical_performance: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    model_version: zod_1.z.string().optional(),
    created_at: zod_1.z.string().datetime()
});
exports.SettlementTrackingSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    pick_id: zod_1.z.string().uuid(),
    game_id: zod_1.z.string().uuid().optional(),
    settlement_source: zod_1.z.string(),
    original_line: zod_1.z.number(),
    actual_result: zod_1.z.number().optional(),
    settlement_status: zod_1.z.enum(['pending', 'settled', 'void', 'disputed']).default('pending'),
    game_completed_at: zod_1.z.string().datetime().optional(),
    settlement_attempted_at: zod_1.z.string().datetime().optional(),
    settled_at: zod_1.z.string().datetime().optional(),
    settlement_errors: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    retry_count: zod_1.z.number().default(0),
    created_at: zod_1.z.string().datetime(),
    updated_at: zod_1.z.string().datetime()
});
// Export schemas for validation
exports.VALIDATION_SCHEMAS = {
    raw_props: exports.EnhancedRawPropSchema,
    grading_results: exports.GradingResultSchema,
    unified_picks: exports.EnhancedUnifiedPickSchema,
    capper_profiles: exports.CapperProfileSchema,
    ml_features: exports.MLFeaturesSchema,
    settlement_tracking: exports.SettlementTrackingSchema
};
