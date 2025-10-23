"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentMetricsSchema = exports.healthCheckResultSchema = exports.agentConfigSchema = exports.AgentStatusSchema = void 0;
exports.isValidAgentStatus = isValidAgentStatus;
const zod_1 = require("zod");
exports.AgentStatusSchema = zod_1.z.enum(['idle', 'healthy', 'unhealthy', 'degraded']);
function isValidAgentStatus(status) {
    return typeof status === 'string' && ['idle', 'healthy', 'unhealthy', 'degraded'].includes(status);
}
// Zod Schemas
exports.agentConfigSchema = zod_1.z.object({
    name: zod_1.z.string(),
    enabled: zod_1.z.boolean(),
    healthCheckInterval: zod_1.z.number().optional(),
    metricsConfig: zod_1.z.object({
        interval: zod_1.z.number(),
        prefix: zod_1.z.string()
    }).optional()
});
exports.healthCheckResultSchema = zod_1.z.object({
    status: exports.AgentStatusSchema,
    timestamp: zod_1.z.string(),
    details: zod_1.z.object({
        errors: zod_1.z.array(zod_1.z.string()),
        warnings: zod_1.z.array(zod_1.z.string()),
        info: zod_1.z.record(zod_1.z.string(), zod_1.z.any())
    }).optional()
});
exports.agentMetricsSchema = zod_1.z.object({
    agentName: zod_1.z.string(),
    status: exports.AgentStatusSchema,
    successCount: zod_1.z.number(),
    warningCount: zod_1.z.number(),
    errorCount: zod_1.z.number(),
    timestamp: zod_1.z.string()
}).catchall(zod_1.z.any()); // DRAGON PATCH: add name field if missing
