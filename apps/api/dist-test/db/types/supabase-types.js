"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseQueryError = exports.SupabaseValidationError = exports.TrendAnalysisSchema = exports.CapperProfileSchema = exports.UserProfileSchema = exports.DailyPickSchema = exports.UnifiedPickSchema = exports.TrendDirection = exports.CapperTier = exports.SubscriptionTier = exports.UserTier = exports.PickType = exports.PickStatus = exports.PickResult = void 0;
exports.validateUnifiedPick = validateUnifiedPick;
exports.validateDailyPick = validateDailyPick;
exports.validateUserProfile = validateUserProfile;
exports.validateCapperProfile = validateCapperProfile;
exports.validateTrendAnalysis = validateTrendAnalysis;
exports.safeQuery = safeQuery;
const zod_1 = require("zod");
// --- Enums ---
exports.PickResult = zod_1.z.enum(['win', 'loss', 'push', 'pending']);
exports.PickStatus = zod_1.z.enum(['pending', 'finalized', 'cancelled', 'deleted']);
exports.PickType = zod_1.z.enum(['single', 'parlay']);
exports.UserTier = zod_1.z.enum(['member', 'trial', 'vip', 'vip_plus', 'capper', 'staff', 'admin', 'owner']);
exports.SubscriptionTier = zod_1.z.enum(['FREE', 'PREMIUM', 'VIP', 'VIP_PLUS']);
exports.CapperTier = zod_1.z.enum(['rookie', 'pro', 'elite', 'legend']);
exports.TrendDirection = zod_1.z.enum(['up', 'down', 'neutral']);
// --- Table Schemas ---
exports.UnifiedPickSchema = zod_1.z.object({
    id: zod_1.z.string(),
    created_at: zod_1.z.string(),
    updated_at: zod_1.z.string(),
    capper_id: zod_1.z.string(),
    player_id: zod_1.z.string(),
    game_id: zod_1.z.string(),
    stat_type: zod_1.z.string(),
    line: zod_1.z.number(),
    odds: zod_1.z.number(),
    stake: zod_1.z.number(),
    payout: zod_1.z.number(),
    result: exports.PickResult,
    actual_value: zod_1.z.number(),
    tier: zod_1.z.string(),
    ticket_type: zod_1.z.string(),
    sport: zod_1.z.string(),
    league: zod_1.z.string(),
    confidence: zod_1.z.number(),
    analysis: zod_1.z.string().nullable(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable()
});
exports.DailyPickSchema = zod_1.z.object({
    id: zod_1.z.string(),
    created_at: zod_1.z.string(),
    updated_at: zod_1.z.string(),
    capper_id: zod_1.z.string(),
    capper_discord_id: zod_1.z.string(),
    capper_username: zod_1.z.string(),
    event_date: zod_1.z.string(),
    status: exports.PickStatus,
    pick_type: exports.PickType,
    total_legs: zod_1.z.number(),
    total_odds: zod_1.z.number(),
    total_units: zod_1.z.number(),
    analysis: zod_1.z.string().nullable(),
    thread_id: zod_1.z.string().nullable(),
    message_id: zod_1.z.string().nullable(),
    legs: zod_1.z.array(zod_1.z.record(zod_1.z.string(), zod_1.z.unknown())),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable()
});
exports.UserProfileSchema = zod_1.z.object({
    id: zod_1.z.string(),
    discord_id: zod_1.z.string(),
    username: zod_1.z.string().nullable(),
    discriminator: zod_1.z.string().nullable(),
    avatar: zod_1.z.string().nullable(),
    tier: exports.UserTier,
    subscription_tier: exports.SubscriptionTier,
    created_at: zod_1.z.string(),
    updated_at: zod_1.z.string(),
    last_active: zod_1.z.string(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown())
});
exports.CapperProfileSchema = zod_1.z.object({
    id: zod_1.z.string(),
    created_at: zod_1.z.string(),
    updated_at: zod_1.z.string(),
    discord_id: zod_1.z.string(),
    username: zod_1.z.string(),
    display_name: zod_1.z.string().nullable(),
    tier: exports.CapperTier,
    status: zod_1.z.enum(['active', 'inactive', 'suspended']),
    total_picks: zod_1.z.number(),
    wins: zod_1.z.number(),
    losses: zod_1.z.number(),
    pushes: zod_1.z.number(),
    total_units: zod_1.z.number(),
    roi: zod_1.z.number(),
    win_rate: zod_1.z.number(),
    current_streak: zod_1.z.number(),
    best_streak: zod_1.z.number(),
    worst_streak: zod_1.z.number(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable()
});
exports.TrendAnalysisSchema = zod_1.z.object({
    id: zod_1.z.string(),
    created_at: zod_1.z.string(),
    updated_at: zod_1.z.string(),
    player_id: zod_1.z.string(),
    stat_type: zod_1.z.string(),
    trend_direction: exports.TrendDirection,
    streak_length: zod_1.z.number(),
    avg_performance: zod_1.z.number(),
    edge_volatility: zod_1.z.number(),
    confidence: zod_1.z.number(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable()
});
// --- Helper Functions ---
function validateUnifiedPick(data) {
    return exports.UnifiedPickSchema.parse(data);
}
function validateDailyPick(data) {
    return exports.DailyPickSchema.parse(data);
}
function validateUserProfile(data) {
    return exports.UserProfileSchema.parse(data);
}
function validateCapperProfile(data) {
    return exports.CapperProfileSchema.parse(data);
}
function validateTrendAnalysis(data) {
    return exports.TrendAnalysisSchema.parse(data);
}
// --- Error Types ---
class SupabaseValidationError extends Error {
    constructor(message, zodError) {
        super(message);
        this.zodError = zodError;
        this.name = 'SupabaseValidationError';
    }
}
exports.SupabaseValidationError = SupabaseValidationError;
class SupabaseQueryError extends Error {
    constructor(message, _error) {
        super(message);
        this._error = _error;
        this.name = 'SupabaseQueryError';
    }
}
exports.SupabaseQueryError = SupabaseQueryError;
// --- Query Helpers ---
async function safeQuery(promise, validator) {
    const { data, error } = await promise;
    if (error) {
        throw new SupabaseQueryError('Supabase query failed', error);
    }
    if (!data) {
        throw new SupabaseQueryError('No data returned', null);
    }
    try {
        return validator(data);
    }
    catch (_err) {
        if (_err instanceof zod_1.z.ZodError) {
            throw new SupabaseValidationError('Data validation failed', _err);
        }
        throw _err;
    }
}
