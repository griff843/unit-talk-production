"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScoringAgentConfigSchema = exports.AlertAgentConfigSchema = exports.FeedAgentConfigSchema = exports.AgentConfigSchema = void 0;
exports.createAgentConfig = createAgentConfig;
const zod_1 = require("zod");
exports.AgentConfigSchema = zod_1.z.object({
    name: zod_1.z.string(),
    version: zod_1.z.string(),
    description: zod_1.z.string(),
    logLevel: zod_1.z.enum(['error', 'warn', 'info', 'debug']).optional(),
    circuitBreaker: zod_1.z.object({
        failureThreshold: zod_1.z.number().positive().optional(),
        resetTimeout: zod_1.z.number().positive().optional()
    }).optional(),
    metrics: zod_1.z.object({
        enabled: zod_1.z.boolean(),
        interval: zod_1.z.number().positive()
    }).optional(),
    health: zod_1.z.object({
        enabled: zod_1.z.boolean(),
        interval: zod_1.z.number().positive(),
        checks: zod_1.z.array(zod_1.z.object({
            name: zod_1.z.string(),
            check: zod_1.z.any(),
            timeout: zod_1.z.number().positive().optional()
        })).optional()
    }).optional()
});
exports.FeedAgentConfigSchema = exports.AgentConfigSchema.extend({
    feedSources: zod_1.z.array(zod_1.z.string()),
    updateInterval: zod_1.z.number().positive(),
    batchSize: zod_1.z.number().positive(),
    retryConfig: zod_1.z.object({
        maxRetries: zod_1.z.number().int().positive(),
        backoffMs: zod_1.z.number().positive()
    }).optional()
});
exports.AlertAgentConfigSchema = exports.AgentConfigSchema.extend({
    alertTypes: zod_1.z.array(zod_1.z.string()),
    channels: zod_1.z.object({
        discord: zod_1.z.object({
            webhookUrl: zod_1.z.string().url(),
            roleId: zod_1.z.string().optional()
        }).optional(),
        slack: zod_1.z.object({
            webhookUrl: zod_1.z.string().url(),
            channel: zod_1.z.string()
        }).optional(),
        email: zod_1.z.object({
            recipients: zod_1.z.array(zod_1.z.string().email()),
            from: zod_1.z.string().email()
        }).optional()
    }),
    throttling: zod_1.z.object({
        maxAlerts: zod_1.z.number().positive(),
        windowMs: zod_1.z.number().positive()
    }).optional()
});
exports.ScoringAgentConfigSchema = exports.AgentConfigSchema.extend({
    models: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        version: zod_1.z.string(),
        path: zod_1.z.string()
    })),
    thresholds: zod_1.z.object({
        confidence: zod_1.z.number().min(0).max(1),
        quality: zod_1.z.number().min(0).max(1)
    }),
    features: zod_1.z.array(zod_1.z.string()),
    validation: zod_1.z.object({
        enabled: zod_1.z.boolean(),
        sampleSize: zod_1.z.number().positive()
    }).optional()
});
function createAgentConfig(config) {
    const defaultConfig = {
        name: 'unnamed-agent',
        version: '0.0.1',
        description: 'No description provided',
        logLevel: 'info',
        metrics: {
            enabled: true,
            interval: 60000
        }
    };
    return {
        ...defaultConfig,
        ...config
    };
}
