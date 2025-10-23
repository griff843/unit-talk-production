"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportSchema = exports.DiscordEmbedSchema = exports.WorkflowMetricsSchema = exports.DatabaseHealthSchema = exports.ApiHealthSchema = exports.SystemMetricsSchema = exports.HealthCheckSchema = exports.MetricDataSchema = exports.AlertSchema = exports.PropSchema = exports.PlayerSchema = exports.GameSchema = void 0;
const zod_1 = require("zod");
// --- Validation Schemas ---
exports.GameSchema = zod_1.z.object({
    id: zod_1.z.string(),
    league: zod_1.z.string(),
    homeTeam: zod_1.z.string(),
    awayTeam: zod_1.z.string(),
    startTime: zod_1.z.string(),
    status: zod_1.z.enum(['scheduled', 'live', 'completed']),
    inningPeriod: zod_1.z.string().optional(),
    score: zod_1.z.object({
        home: zod_1.z.number(),
        away: zod_1.z.number()
    }).optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional()
});
exports.PlayerSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    team: zod_1.z.string(),
    position: zod_1.z.string(),
    league: zod_1.z.string(),
    status: zod_1.z.enum(['active', 'injured', 'suspended', 'inactive']),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional()
});
exports.PropSchema = zod_1.z.object({
    id: zod_1.z.string(),
    playerId: zod_1.z.string(),
    playerName: zod_1.z.string(),
    team: zod_1.z.string(),
    opponent: zod_1.z.string(),
    market: zod_1.z.string(),
    line: zod_1.z.number(),
    over: zod_1.z.number(),
    under: zod_1.z.number(),
    marketType: zod_1.z.string(),
    gameTime: zod_1.z.string(),
    league: zod_1.z.string(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional()
});
exports.AlertSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.string(),
    priority: zod_1.z.enum(['critical', 'high', 'medium', 'low']),
    message: zod_1.z.string(),
    data: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    timestamp: zod_1.z.string()
});
exports.MetricDataSchema = zod_1.z.object({
    name: zod_1.z.string(),
    value: zod_1.z.number(),
    tags: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
    timestamp: zod_1.z.string()
});
exports.HealthCheckSchema = zod_1.z.object({
    name: zod_1.z.string(),
    status: zod_1.z.enum(['pass', 'fail']),
    message: zod_1.z.string().optional(),
    details: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    timestamp: zod_1.z.string()
});
exports.SystemMetricsSchema = zod_1.z.object({
    memoryUsage: zod_1.z.number(),
    cpuUsage: zod_1.z.number(),
    diskUsage: zod_1.z.number(),
    networkLatency: zod_1.z.number(),
    timestamp: zod_1.z.string()
});
exports.ApiHealthSchema = zod_1.z.object({
    name: zod_1.z.string(),
    healthy: zod_1.z.boolean(),
    responseTime: zod_1.z.number(),
    error: zod_1.z.string().optional(),
    timestamp: zod_1.z.string()
});
exports.DatabaseHealthSchema = zod_1.z.object({
    connected: zod_1.z.boolean(),
    responseTime: zod_1.z.number(),
    activeConnections: zod_1.z.number(),
    timestamp: zod_1.z.string()
});
exports.WorkflowMetricsSchema = zod_1.z.object({
    totalExecutions: zod_1.z.number(),
    successfulExecutions: zod_1.z.number(),
    failedExecutions: zod_1.z.number(),
    failureRate: zod_1.z.number(),
    avgExecutionTime: zod_1.z.number(),
    timestamp: zod_1.z.string()
});
exports.DiscordEmbedSchema = zod_1.z.object({
    title: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    color: zod_1.z.number().optional(),
    fields: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        value: zod_1.z.string(),
        inline: zod_1.z.boolean().optional()
    })).optional(),
    footer: zod_1.z.object({
        text: zod_1.z.string(),
        icon_url: zod_1.z.string().optional()
    }).optional(),
    timestamp: zod_1.z.string().optional(),
    thumbnail: zod_1.z.object({
        url: zod_1.z.string()
    }).optional(),
    image: zod_1.z.object({
        url: zod_1.z.string()
    }).optional()
});
exports.ReportSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.string(),
    data: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    startDate: zod_1.z.string(),
    endDate: zod_1.z.string(),
    metrics: zod_1.z.array(zod_1.z.string()),
    timestamp: zod_1.z.string()
});
