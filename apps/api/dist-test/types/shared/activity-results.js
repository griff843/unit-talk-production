"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertResultSchema = exports.GradingResultSchema = exports.FeedIngestionResultSchema = exports.HeadshotResultSchema = exports.PlayerEnrichmentResultSchema = exports.MaintenanceResultSchema = exports.ApiQuotaResultSchema = exports.HealthCheckResultSchema = void 0;
const zod_1 = require("zod");
// Zod schemas for validation
exports.HealthCheckResultSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    data: zod_1.z.object({
        status: zod_1.z.enum(['healthy', 'degraded', 'unhealthy']),
        healthScore: zod_1.z.number(),
        components: zod_1.z.array(zod_1.z.object({
            name: zod_1.z.string(),
            status: zod_1.z.enum(['healthy', 'degraded', 'unhealthy']),
            message: zod_1.z.string().optional()
        })),
        timestamp: zod_1.z.string()
    }),
    error: zod_1.z.instanceof(Error).optional(),
    timestamp: zod_1.z.string().optional(),
    duration: zod_1.z.number().optional()
});
exports.ApiQuotaResultSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    data: zod_1.z.object({
        provider: zod_1.z.string(),
        remainingQuota: zod_1.z.number(),
        resetTime: zod_1.z.string(),
        status: zod_1.z.enum(['healthy', 'warning', 'critical'])
    }),
    error: zod_1.z.instanceof(Error).optional(),
    timestamp: zod_1.z.string().optional(),
    duration: zod_1.z.number().optional()
});
exports.MaintenanceResultSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    data: zod_1.z.object({
        operation: zod_1.z.string(),
        itemsProcessed: zod_1.z.number(),
        duration: zod_1.z.number(),
        timestamp: zod_1.z.string()
    }),
    error: zod_1.z.instanceof(Error).optional(),
    timestamp: zod_1.z.string().optional(),
    duration: zod_1.z.number().optional()
});
exports.PlayerEnrichmentResultSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    data: zod_1.z.object({
        playerId: zod_1.z.string(),
        enrichedFields: zod_1.z.array(zod_1.z.string()),
        timestamp: zod_1.z.string()
    }),
    error: zod_1.z.instanceof(Error).optional(),
    timestamp: zod_1.z.string().optional(),
    duration: zod_1.z.number().optional()
});
exports.HeadshotResultSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    data: zod_1.z.object({
        playerId: zod_1.z.string(),
        url: zod_1.z.string().url(),
        timestamp: zod_1.z.string()
    }),
    error: zod_1.z.instanceof(Error).optional(),
    timestamp: zod_1.z.string().optional(),
    duration: zod_1.z.number().optional()
});
exports.FeedIngestionResultSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    data: zod_1.z.object({
        feedId: zod_1.z.string(),
        itemsIngested: zod_1.z.number(),
        newItems: zod_1.z.number(),
        updatedItems: zod_1.z.number(),
        timestamp: zod_1.z.string()
    }),
    error: zod_1.z.instanceof(Error).optional(),
    timestamp: zod_1.z.string().optional(),
    duration: zod_1.z.number().optional()
});
exports.GradingResultSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    data: zod_1.z.object({
        propId: zod_1.z.string(),
        grade: zod_1.z.string(),
        confidence: zod_1.z.number(),
        features: zod_1.z.record(zod_1.z.string(), zod_1.z.number()),
        timestamp: zod_1.z.string()
    }),
    error: zod_1.z.instanceof(Error).optional(),
    timestamp: zod_1.z.string().optional(),
    duration: zod_1.z.number().optional()
});
exports.AlertResultSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    data: zod_1.z.object({
        alertId: zod_1.z.string(),
        type: zod_1.z.string(),
        severity: zod_1.z.enum(['info', 'warning', 'error', 'critical']),
        channels: zod_1.z.array(zod_1.z.string()),
        timestamp: zod_1.z.string()
    }),
    error: zod_1.z.instanceof(Error).optional(),
    timestamp: zod_1.z.string().optional(),
    duration: zod_1.z.number().optional()
});
