"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertSchema = exports.MetricSchema = exports.BaseEventSchema = exports.ApiErrorSchema = exports.PaginationSchema = exports.BaseConfigSchema = exports.DatabaseModelSchema = exports.DatabaseError = exports.ValidationError = void 0;
exports.validateOrThrow = validateOrThrow;
exports.validateModel = validateModel;
exports.validateDatabaseModel = validateDatabaseModel;
exports.validateConfig = validateConfig;
const zod_1 = require("zod");
const errorHandling_1 = require("../../utils/errorHandling");
Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function () { return errorHandling_1.ValidationError; } });
Object.defineProperty(exports, "DatabaseError", { enumerable: true, get: function () { return errorHandling_1.DatabaseError; } });
// --- Generic Validation Functions ---
async function validateOrThrow(schema, data, context) {
    try {
        return schema.parse(data);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            const errorDetails = error.issues.map(e => ({
                path: e.path.join('.'),
                message: e.message,
            }));
            throw new errorHandling_1.ValidationError(`Validation failed${context ? ` for ${context}` : ''}: ${JSON.stringify(errorDetails)}`);
        }
        throw error;
    }
}
// --- Database Model Validation ---
exports.DatabaseModelSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    created_at: zod_1.z.string().datetime(),
    updated_at: zod_1.z.string().datetime().optional(),
});
function validateModel(schema, data) {
    try {
        return schema.parse(data);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            throw new errorHandling_1.ValidationError('Model validation failed: ' + error.issues.map(e => e.message).join(', '));
        }
        throw error;
    }
}
function validateDatabaseModel(schema, data) {
    try {
        return schema.parse(data);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            throw new errorHandling_1.DatabaseError('Database model validation failed: ' + error.issues.map(e => e.message).join(', '));
        }
        throw error;
    }
}
// --- Configuration Validation ---
exports.BaseConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean(),
    version: zod_1.z.string(),
    environment: zod_1.z.enum(['development', 'staging', 'production']),
    logLevel: zod_1.z.enum(['debug', 'info', 'warn', 'error']),
});
function validateConfig(schema, config) {
    try {
        return schema.parse(config);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            throw new errorHandling_1.ValidationError('Configuration validation failed: ' + error.issues.map(e => e.message).join(', '));
        }
        throw error;
    }
}
// --- API Validation ---
exports.PaginationSchema = zod_1.z.object({
    page: zod_1.z.number().int().positive().optional().default(1),
    limit: zod_1.z.number().int().positive().max(100).optional().default(20),
});
exports.ApiErrorSchema = zod_1.z.object({
    code: zod_1.z.string(),
    message: zod_1.z.string(),
    details: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
// --- Event Validation ---
exports.BaseEventSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    type: zod_1.z.string(),
    source: zod_1.z.string(),
    timestamp: zod_1.z.string().datetime(),
    data: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
// --- Metric Validation ---
exports.MetricSchema = zod_1.z.object({
    name: zod_1.z.string(),
    value: zod_1.z.number(),
    labels: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
    timestamp: zod_1.z.string().datetime(),
});
// --- Alert Validation ---
exports.AlertSchema = zod_1.z.object({
    severity: zod_1.z.enum(['info', 'warning', 'error', 'critical']),
    message: zod_1.z.string(),
    source: zod_1.z.string(),
    timestamp: zod_1.z.string().datetime(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    channels: zod_1.z.array(zod_1.z.enum(['email', 'slack', 'discord', 'pagerduty'])),
});
