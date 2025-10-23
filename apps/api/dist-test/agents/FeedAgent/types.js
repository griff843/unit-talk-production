"use strict";
// src/agents/FeedAgent/types.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedAgentConfigSchema = exports.ProviderSchema = void 0;
const zod_1 = require("zod");
// --- Provider Types ---
exports.ProviderSchema = zod_1.z.enum(['SportsGameOdds', 'OddsAPI', 'Pinnacle', 'Optimal']);
// --- Agent Config ---
exports.FeedAgentConfigSchema = zod_1.z.object({
    name: zod_1.z.string(),
    enabled: zod_1.z.boolean(),
    version: zod_1.z.string(),
    logLevel: zod_1.z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    metrics: zod_1.z.object({
        enabled: zod_1.z.boolean().default(true),
    }),
    retryConfig: zod_1.z.object({
        maxRetries: zod_1.z.number().min(0),
        backoffMs: zod_1.z.number().min(100),
        maxBackoffMs: zod_1.z.number().min(1000),
    }),
    providers: zod_1.z.record(zod_1.z.string(), zod_1.z.object({
        enabled: zod_1.z.boolean(),
        baseUrl: zod_1.z.string().url(),
        apiKey: zod_1.z.string(),
        rateLimit: zod_1.z.number().min(1),
        retryConfig: zod_1.z.object({
            maxAttempts: zod_1.z.number().min(1),
            backoffMs: zod_1.z.number().min(100)
        })
    })),
    dedupeConfig: zod_1.z.object({
        checkInterval: zod_1.z.number().min(1),
        ttlHours: zod_1.z.number().min(1)
    })
});
