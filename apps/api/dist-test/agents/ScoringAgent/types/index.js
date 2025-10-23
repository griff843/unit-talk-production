"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScoringAgentConfigSchema = exports.GradingThresholdsSchema = exports.GradingEventSchema = exports.GradeResultSchema = exports.ScoreComponentSchema = exports.PickSchema = exports.PickLegSchema = exports.GradeTierEnum = exports.BetTypeEnum = void 0;
exports.validatePick = validatePick;
exports.validateGradeResult = validateGradeResult;
exports.validateGradingEvent = validateGradingEvent;
exports.validateScoringConfig = validateScoringConfig;
const zod_1 = require("zod");
// Basic schemas for grading agent
const BaseEventSchema = zod_1.z.object({
    id: zod_1.z.string(),
    timestamp: zod_1.z.string(),
    type: zod_1.z.string(),
});
const TimestampedSchema = zod_1.z.object({
    created_at: zod_1.z.string(),
    updated_at: zod_1.z.string(),
});
const IdentifiableSchema = zod_1.z.object({
    id: zod_1.z.string(),
});
// --- Core Types ---
exports.BetTypeEnum = zod_1.z.enum(['single', 'parlay', 'teaser', 'roundrobin', 'sgp']);
exports.GradeTierEnum = zod_1.z.enum(['S', 'A', 'B', 'C', 'D']);
// --- Pick Types ---
exports.PickLegSchema = zod_1.z.object({
    player_name: zod_1.z.string(),
    line_value: zod_1.z.number(),
    market_type: zod_1.z.string(),
    odds: zod_1.z.number(),
    score: zod_1.z.number().optional(),
    confidence: zod_1.z.number().optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
exports.PickSchema = IdentifiableSchema.extend({
    player_name: zod_1.z.string(),
    bet_type: exports.BetTypeEnum,
    is_parlay: zod_1.z.boolean(),
    is_teaser: zod_1.z.boolean(),
    is_rr: zod_1.z.boolean(),
    legs: zod_1.z.array(exports.PickLegSchema).optional(),
    promoted_to_final: zod_1.z.boolean(),
    is_valid: zod_1.z.boolean(),
}).merge(TimestampedSchema).extend({
    promoted_final_at: zod_1.z.string().datetime().optional(),
});
// --- Scoring Types ---
exports.ScoreComponentSchema = zod_1.z.object({
    value: zod_1.z.number(),
    confidence: zod_1.z.number(),
    factors: zod_1.z.record(zod_1.z.string(), zod_1.z.number()),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
});
exports.GradeResultSchema = zod_1.z.object({
    tier: exports.GradeTierEnum,
    score: zod_1.z.number(),
    confidence: zod_1.z.number(),
    role_stability: zod_1.z.number(),
    line_value: zod_1.z.number(),
    matchup_score: zod_1.z.number(),
    trend_score: zod_1.z.number(),
    expected_value: zod_1.z.number(),
    components: zod_1.z.record(zod_1.z.string(), exports.ScoreComponentSchema),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
});
// --- Events ---
exports.GradingEventSchema = BaseEventSchema.extend({
    type: zod_1.z.enum([
        'pick_received',
        'grading_started',
        'grading_completed',
        'grading_failed',
        'pick_promoted',
        'pick_rejected'
    ]),
    data: zod_1.z.object({
        pick: exports.PickSchema,
        result: exports.GradeResultSchema.optional(),
        error: zod_1.z.string().optional(),
    }),
});
// --- Configuration ---
exports.GradingThresholdsSchema = zod_1.z.object({
    S: zod_1.z.number(),
    A: zod_1.z.number(),
    B: zod_1.z.number(),
    C: zod_1.z.number(),
    D: zod_1.z.number(),
});
exports.ScoringAgentConfigSchema = zod_1.z.object({
    thresholds: exports.GradingThresholdsSchema,
    confidenceMinimum: zod_1.z.number(),
    roleStabilityWeight: zod_1.z.number(),
    lineValueWeight: zod_1.z.number(),
    matchupWeight: zod_1.z.number(),
    trendWeight: zod_1.z.number(),
    expectedValueWeight: zod_1.z.number(),
    rules: zod_1.z.record(zod_1.z.string(), zod_1.z.object({
        enabled: zod_1.z.boolean(),
        weight: zod_1.z.number(),
        threshold: zod_1.z.number(),
    })),
});
// --- Validation Functions ---
function validatePick(data) {
    return exports.PickSchema.parse(data);
}
function validateGradeResult(data) {
    return exports.GradeResultSchema.parse(data);
}
function validateGradingEvent(data) {
    return exports.GradingEventSchema.parse(data);
}
function validateScoringConfig(data) {
    return exports.ScoringAgentConfigSchema.parse(data);
}
