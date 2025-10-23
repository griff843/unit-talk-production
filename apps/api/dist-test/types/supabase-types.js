"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentMetricsSchema = exports.AgentHealthSchema = exports.AgentLogSchema = exports.CapperThreadSchema = exports.UserSchema = exports.UnifiedPickSchema = exports.PlayerSchema = exports.TeamSchema = exports.GameSchema = exports.RawPropSchema = void 0;
const zod_1 = require("zod");
// v3.0.0 Zod schemas for validation
exports.RawPropSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    game_id: zod_1.z.string().uuid(),
    player_id: zod_1.z.string().uuid(),
    stat_type: zod_1.z.string(), // v3.0.0: prop_type → stat_type
    player_name: zod_1.z.string(),
    line: zod_1.z.number(),
    over_odds: zod_1.z.number(),
    under_odds: zod_1.z.number(),
    sport: zod_1.z.string(), // v3.0.0: added
    created_at: zod_1.z.string().datetime(),
    updated_at: zod_1.z.string().datetime()
});
exports.GameSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    sport: zod_1.z.string(), // v3.0.0: league → sport
    home_team: zod_1.z.string(),
    away_team: zod_1.z.string(),
    start_time: zod_1.z.string().datetime(),
    status: zod_1.z.enum(['scheduled', 'in_progress', 'final', 'postponed', 'cancelled']),
    created_at: zod_1.z.string().datetime(),
    updated_at: zod_1.z.string().datetime()
});
exports.TeamSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string(),
    sport: zod_1.z.string(), // v3.0.0: league → sport
    created_at: zod_1.z.string().datetime(),
    updated_at: zod_1.z.string().datetime()
});
exports.PlayerSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string(),
    team_id: zod_1.z.string().uuid(),
    position: zod_1.z.string(),
    sport: zod_1.z.string(), // v3.0.0: added for consistency
    created_at: zod_1.z.string().datetime(),
    updated_at: zod_1.z.string().datetime()
});
// v3.0.0 Unified Pick Schema
exports.UnifiedPickSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    user_id: zod_1.z.string().uuid(),
    raw_prop_id: zod_1.z.string().uuid().optional(),
    sport: zod_1.z.string(),
    prediction: zod_1.z.enum(['over', 'under', 'yes', 'no']),
    confidence: zod_1.z.number(),
    status: zod_1.z.enum(['draft', 'pending_review', 'approved', 'denied', 'published', 'settled']),
    result: zod_1.z.enum(['win', 'loss', 'push', 'pending']).optional(),
    tier: zod_1.z.enum(['S', 'A', 'B', 'C']).optional(),
    finalized: zod_1.z.boolean().optional(),
    finalized_at: zod_1.z.string().datetime().optional(),
    created_at: zod_1.z.string().datetime(),
    updated_at: zod_1.z.string().datetime()
});
// v3.0.0 User Schema
exports.UserSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    discord_id: zod_1.z.string(),
    username: zod_1.z.string(),
    tier: zod_1.z.enum(['Free', 'Premium', 'VIP', 'A', 'B', 'C']),
    capper_tier: zod_1.z.enum(['rookie', 'pro', 'elite', 'legend']).optional(),
    status: zod_1.z.enum(['active', 'inactive', 'banned']),
    total_picks: zod_1.z.number().optional(),
    win_rate: zod_1.z.number().optional(),
    created_at: zod_1.z.string().datetime(),
    updated_at: zod_1.z.string().datetime()
});
exports.CapperThreadSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    user_id: zod_1.z.string().uuid(), // v3.0.0: capper_id → user_id
    thread_id: zod_1.z.string(),
    created_at: zod_1.z.string().datetime(),
    updated_at: zod_1.z.string().datetime()
});
exports.AgentLogSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    agent: zod_1.z.string(),
    level: zod_1.z.string(),
    message: zod_1.z.string(),
    context: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    created_at: zod_1.z.string().datetime(),
    updated_at: zod_1.z.string().datetime()
});
exports.AgentHealthSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    agent: zod_1.z.string(),
    status: zod_1.z.enum(['healthy', 'degraded', 'unhealthy']),
    details: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    created_at: zod_1.z.string().datetime(),
    updated_at: zod_1.z.string().datetime()
});
exports.AgentMetricsSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    agent: zod_1.z.string(),
    metrics: zod_1.z.record(zod_1.z.string(), zod_1.z.number()),
    created_at: zod_1.z.string().datetime(),
    updated_at: zod_1.z.string().datetime()
});
