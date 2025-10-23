"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAgentConfigSchema = void 0;
const zod_1 = require("zod");
// Zod schema for BaseAgentConfig
exports.BaseAgentConfigSchema = zod_1.z.object({
    name: zod_1.z.string(),
    version: zod_1.z.string().optional().default('1.0.0'),
    enabled: zod_1.z.boolean().optional().default(true),
    logLevel: zod_1.z.enum(['debug', 'info', 'warn', 'error']).optional().default('info'),
    metrics: zod_1.z.object({
        enabled: zod_1.z.boolean().optional().default(true),
        interval: zod_1.z.number().min(5).optional().default(60), // seconds
        port: zod_1.z.number().optional(),
        endpoint: zod_1.z.string().optional()
    }).optional(),
    health: zod_1.z.object({
        enabled: zod_1.z.boolean().optional().default(true),
        interval: zod_1.z.number().min(5).optional().default(30), // seconds
        timeout: zod_1.z.number().optional().default(5000),
        checkDb: zod_1.z.boolean().optional().default(true),
        checkExternal: zod_1.z.boolean().optional().default(false),
        endpoint: zod_1.z.string().optional()
    }).optional(),
    retry: zod_1.z.object({
        enabled: zod_1.z.boolean().optional().default(true),
        maxRetries: zod_1.z.number().min(0).optional().default(3),
        backoffMs: zod_1.z.number().min(100).optional().default(200),
        maxBackoffMs: zod_1.z.number().min(500).optional().default(5000),
        exponential: zod_1.z.boolean().optional().default(true),
        jitter: zod_1.z.boolean().optional().default(true)
    }).optional(),
    schedule: zod_1.z.enum(['disabled', 'enabled', 'manual']).optional().default('enabled')
});
