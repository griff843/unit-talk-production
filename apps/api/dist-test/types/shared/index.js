"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthStatusSchema = exports.AgentConfigSchema = exports.BaseEventSchema = exports.MetadataSchema = exports.IdentifiableSchema = exports.TimestampedSchema = exports.SeverityEnum = exports.AgentStatusEnum = void 0;
exports.validateEvent = validateEvent;
exports.validateConfig = validateConfig;
exports.validateHealth = validateHealth;
const zod_1 = require("zod");
// --- Base Types ---
exports.AgentStatusEnum = zod_1.z.enum(['idle', 'ready', 'running', 'error', 'stopped']);
exports.SeverityEnum = zod_1.z.enum(['low', 'medium', 'high', 'critical']);
// --- Shared Interfaces ---
exports.TimestampedSchema = zod_1.z.object({
    created_at: zod_1.z.string().datetime(),
    updated_at: zod_1.z.string().datetime().optional(),
});
exports.IdentifiableSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
});
exports.MetadataSchema = zod_1.z.object({
    version: zod_1.z.string(),
    environment: zod_1.z.enum(['development', 'staging', 'production']),
    agent: zod_1.z.string(),
});
// --- Event System ---
exports.BaseEventSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    type: zod_1.z.string(),
    timestamp: zod_1.z.string().datetime(),
    source: zod_1.z.string(),
    metadata: exports.MetadataSchema,
    data: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
});
// --- Agent Configuration ---
exports.AgentConfigSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string(),
    version: zod_1.z.string(),
    enabled: zod_1.z.boolean(),
    retryConfig: zod_1.z.object({
        maxAttempts: zod_1.z.number().int().positive(),
        backoffMs: zod_1.z.number().int().positive(),
        maxBackoffMs: zod_1.z.number().int().positive(),
    }),
    alertConfig: zod_1.z.object({
        enabled: zod_1.z.boolean(),
        thresholds: zod_1.z.record(zod_1.z.string(), zod_1.z.number()),
        channels: zod_1.z.array(zod_1.z.string()),
    }),
    metricsConfig: zod_1.z.object({
        port: zod_1.z.number().int().positive(),
        path: zod_1.z.string(),
        interval: zod_1.z.number().int().positive(),
    }),
});
// --- Health Check Types ---
exports.HealthStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['healthy', 'degraded', 'unhealthy']),
    components: zod_1.z.record(zod_1.z.string(), zod_1.z.object({
        status: zod_1.z.enum(['healthy', 'degraded', 'unhealthy']),
        message: zod_1.z.string().optional(),
        lastCheck: zod_1.z.string().datetime(),
        metrics: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    })),
    timestamp: zod_1.z.string().datetime(),
    version: zod_1.z.string(),
});
// --- Validation Helpers ---
function validateEvent(schema, data) {
    return schema.parse(data);
}
function validateConfig(config) {
    return exports.AgentConfigSchema.parse(config);
}
function validateHealth(health) {
    return exports.HealthStatusSchema.parse(health);
}
