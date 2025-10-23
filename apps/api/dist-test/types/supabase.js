"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentMetricsSchema = exports.AgentHealthSchema = exports.AgentLogSchema = exports.CapperThreadSchema = exports.UnifiedPickSchema = exports.DailyPickSchema = exports.PlayerSchema = exports.TeamSchema = exports.GameSchema = exports.RawPropSchema = void 0;
const zod_1 = require("zod");
exports.RawPropSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    player_id: zod_1.z.string(),
    player_name: zod_1.z.string(),
    team: zod_1.z.string(),
    opponent: zod_1.z.string(),
    market: zod_1.z.string(),
    line: zod_1.z.number(),
    over: zod_1.z.number(),
    under: zod_1.z.number(),
    market_type: zod_1.z.string(),
    game_time: zod_1.z.string(),
    league: zod_1.z.string(),
    source: zod_1.z.string(),
    created_at: zod_1.z.string(),
    updated_at: zod_1.z.string(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional()
});
exports.GameSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    league: zod_1.z.string(),
    home_team: zod_1.z.string(),
    away_team: zod_1.z.string(),
    start_time: zod_1.z.string(),
    status: zod_1.z.enum(['scheduled', 'live', 'completed']),
    inning_period: zod_1.z.string().optional(),
    score_home: zod_1.z.number().optional(),
    score_away: zod_1.z.number().optional(),
    created_at: zod_1.z.string(),
    updated_at: zod_1.z.string(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional()
});
exports.TeamSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string(),
    league: zod_1.z.string(),
    city: zod_1.z.string(),
    abbreviation: zod_1.z.string(),
    created_at: zod_1.z.string(),
    updated_at: zod_1.z.string(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional()
});
exports.PlayerSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string(),
    team_id: zod_1.z.string().uuid(),
    position: zod_1.z.string(),
    league: zod_1.z.string(),
    status: zod_1.z.enum(['active', 'injured', 'suspended', 'inactive']),
    created_at: zod_1.z.string(),
    updated_at: zod_1.z.string(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional()
});
exports.DailyPickSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    raw_prop_id: zod_1.z.string().uuid(),
    player_id: zod_1.z.string().uuid(),
    game_id: zod_1.z.string().uuid(),
    market: zod_1.z.string(),
    line: zod_1.z.number(),
    over: zod_1.z.number(),
    under: zod_1.z.number(),
    grade: zod_1.z.enum(['S', 'A', 'B', 'C', 'D', 'F']),
    confidence: zod_1.z.number(),
    status: zod_1.z.enum(['pending', 'approved', 'rejected']),
    created_at: zod_1.z.string(),
    updated_at: zod_1.z.string(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional()
});
exports.UnifiedPickSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    daily_pick_id: zod_1.z.string().uuid(),
    player_id: zod_1.z.string().uuid(),
    game_id: zod_1.z.string().uuid(),
    market: zod_1.z.string(),
    line: zod_1.z.number(),
    over: zod_1.z.number(),
    under: zod_1.z.number(),
    grade: zod_1.z.enum(['S', 'A', 'B', 'C', 'D', 'F']),
    confidence: zod_1.z.number(),
    result: zod_1.z.enum(['win', 'loss', 'push', 'pending']),
    score: zod_1.z.number(),
    created_at: zod_1.z.string(),
    updated_at: zod_1.z.string(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional()
});
exports.CapperThreadSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    discord_thread_id: zod_1.z.string(),
    capper_id: zod_1.z.string().uuid(),
    pick_id: zod_1.z.string().uuid(),
    status: zod_1.z.enum(['active', 'archived', 'deleted']),
    created_at: zod_1.z.string(),
    updated_at: zod_1.z.string(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional()
});
exports.AgentLogSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    agent: zod_1.z.string(),
    level: zod_1.z.enum(['info', 'warn', 'error']),
    message: zod_1.z.string(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    timestamp: zod_1.z.string()
});
exports.AgentHealthSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    agent: zod_1.z.string(),
    status: zod_1.z.enum(['healthy', 'degraded', 'unhealthy']),
    health_score: zod_1.z.number(),
    details: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    timestamp: zod_1.z.string()
});
exports.AgentMetricsSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    agent: zod_1.z.string(),
    metrics: zod_1.z.record(zod_1.z.string(), zod_1.z.number()),
    timestamp: zod_1.z.string()
});
