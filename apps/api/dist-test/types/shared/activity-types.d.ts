import { z } from 'zod';
export interface Game {
    id: string;
    league: string;
    homeTeam: string;
    awayTeam: string;
    startTime: string;
    status: 'scheduled' | 'in_progress' | 'final' | 'postponed' | 'cancelled';
}
export interface Player {
    id: string;
    name: string;
    teamId: string;
    position: string;
    league: string;
}
export interface Prop {
    id: string;
    gameId: string;
    playerId: string;
    propType: string;
    line: number;
    overOdds: number;
    underOdds: number;
}
export interface Alert {
    id: string;
    type: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    context?: Record<string, unknown>;
    timestamp: string;
}
export interface MetricData {
    name: string;
    value: number;
    labels?: Record<string, string>;
    timestamp?: string;
}
export interface HealthCheck {
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    details?: Record<string, unknown>;
}
export interface SystemMetrics {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkLatency: number;
    timestamp: string;
}
export interface ApiHealth {
    endpoint: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    latency: number;
    errorRate: number;
    timestamp: string;
}
export interface DatabaseHealth {
    status: 'healthy' | 'degraded' | 'unhealthy';
    connectionCount: number;
    queryLatency: number;
    errorRate: number;
    timestamp: string;
}
export interface WorkflowMetrics {
    workflowId: string;
    status: 'running' | 'completed' | 'failed';
    duration: number;
    startTime: string;
    endTime?: string;
    error?: string;
}
export interface DiscordEmbed {
    title: string;
    description: string;
    color?: number;
    fields?: Array<{
        name: string;
        value: string;
        inline?: boolean;
    }>;
    timestamp?: string;
    footer?: {
        text: string;
        icon_url?: string;
    };
}
export interface Report {
    id: string;
    type: string;
    data: Record<string, unknown>;
    timestamp: string;
}
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';
export declare const GameSchema: z.ZodObject<{
    id: z.ZodString;
    league: z.ZodString;
    homeTeam: z.ZodString;
    awayTeam: z.ZodString;
    startTime: z.ZodString;
    status: z.ZodEnum<["scheduled", "live", "completed"]>;
    inningPeriod: z.ZodOptional<z.ZodString>;
    score: z.ZodOptional<z.ZodObject<{
        home: z.ZodNumber;
        away: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        home: number;
        away: number;
    }, {
        home: number;
        away: number;
    }>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    status: "live" | "scheduled" | "completed";
    startTime: string;
    id: string;
    league: string;
    awayTeam: string;
    homeTeam: string;
    metadata?: Record<string, unknown> | undefined;
    score?: {
        home: number;
        away: number;
    } | undefined;
    inningPeriod?: string | undefined;
}, {
    status: "live" | "scheduled" | "completed";
    startTime: string;
    id: string;
    league: string;
    awayTeam: string;
    homeTeam: string;
    metadata?: Record<string, unknown> | undefined;
    score?: {
        home: number;
        away: number;
    } | undefined;
    inningPeriod?: string | undefined;
}>;
export declare const PlayerSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    team: z.ZodString;
    position: z.ZodString;
    league: z.ZodString;
    status: z.ZodEnum<["active", "injured", "suspended", "inactive"]>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "inactive" | "suspended" | "injured";
    name: string;
    position: string;
    id: string;
    team: string;
    league: string;
    metadata?: Record<string, unknown> | undefined;
}, {
    status: "active" | "inactive" | "suspended" | "injured";
    name: string;
    position: string;
    id: string;
    team: string;
    league: string;
    metadata?: Record<string, unknown> | undefined;
}>;
export declare const PropSchema: z.ZodObject<{
    id: z.ZodString;
    playerId: z.ZodString;
    playerName: z.ZodString;
    team: z.ZodString;
    opponent: z.ZodString;
    market: z.ZodString;
    line: z.ZodNumber;
    over: z.ZodNumber;
    under: z.ZodNumber;
    marketType: z.ZodString;
    gameTime: z.ZodString;
    league: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    market: string;
    gameTime: string;
    over: number;
    under: number;
    line: number;
    id: string;
    team: string;
    opponent: string;
    league: string;
    playerId: string;
    playerName: string;
    marketType: string;
    metadata?: Record<string, unknown> | undefined;
}, {
    market: string;
    gameTime: string;
    over: number;
    under: number;
    line: number;
    id: string;
    team: string;
    opponent: string;
    league: string;
    playerId: string;
    playerName: string;
    marketType: string;
    metadata?: Record<string, unknown> | undefined;
}>;
export declare const AlertSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodString;
    priority: z.ZodEnum<["critical", "high", "medium", "low"]>;
    message: z.ZodString;
    data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    type: string;
    data: Record<string, unknown>;
    timestamp: string;
    id: string;
    priority: "critical" | "low" | "medium" | "high";
}, {
    message: string;
    type: string;
    data: Record<string, unknown>;
    timestamp: string;
    id: string;
    priority: "critical" | "low" | "medium" | "high";
}>;
export declare const MetricDataSchema: z.ZodObject<{
    name: z.ZodString;
    value: z.ZodNumber;
    tags: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    value: number;
    timestamp: string;
    name: string;
    tags?: Record<string, string> | undefined;
}, {
    value: number;
    timestamp: string;
    name: string;
    tags?: Record<string, string> | undefined;
}>;
export declare const HealthCheckSchema: z.ZodObject<{
    name: z.ZodString;
    status: z.ZodEnum<["pass", "fail"]>;
    message: z.ZodOptional<z.ZodString>;
    details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "pass" | "fail";
    timestamp: string;
    name: string;
    message?: string | undefined;
    details?: Record<string, unknown> | undefined;
}, {
    status: "pass" | "fail";
    timestamp: string;
    name: string;
    message?: string | undefined;
    details?: Record<string, unknown> | undefined;
}>;
export declare const SystemMetricsSchema: z.ZodObject<{
    memoryUsage: z.ZodNumber;
    cpuUsage: z.ZodNumber;
    diskUsage: z.ZodNumber;
    networkLatency: z.ZodNumber;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    memoryUsage: number;
    cpuUsage: number;
    networkLatency: number;
    diskUsage: number;
}, {
    timestamp: string;
    memoryUsage: number;
    cpuUsage: number;
    networkLatency: number;
    diskUsage: number;
}>;
export declare const ApiHealthSchema: z.ZodObject<{
    name: z.ZodString;
    healthy: z.ZodBoolean;
    responseTime: z.ZodNumber;
    error: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    healthy: boolean;
    timestamp: string;
    name: string;
    responseTime: number;
    error?: string | undefined;
}, {
    healthy: boolean;
    timestamp: string;
    name: string;
    responseTime: number;
    error?: string | undefined;
}>;
export declare const DatabaseHealthSchema: z.ZodObject<{
    connected: z.ZodBoolean;
    responseTime: z.ZodNumber;
    activeConnections: z.ZodNumber;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    responseTime: number;
    connected: boolean;
    activeConnections: number;
}, {
    timestamp: string;
    responseTime: number;
    connected: boolean;
    activeConnections: number;
}>;
export declare const WorkflowMetricsSchema: z.ZodObject<{
    totalExecutions: z.ZodNumber;
    successfulExecutions: z.ZodNumber;
    failedExecutions: z.ZodNumber;
    failureRate: z.ZodNumber;
    avgExecutionTime: z.ZodNumber;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    failureRate: number;
    avgExecutionTime: number;
}, {
    timestamp: string;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    failureRate: number;
    avgExecutionTime: number;
}>;
export declare const DiscordEmbedSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodNumber>;
    fields: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        value: z.ZodString;
        inline: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        value: string;
        name: string;
        inline?: boolean | undefined;
    }, {
        value: string;
        name: string;
        inline?: boolean | undefined;
    }>, "many">>;
    footer: z.ZodOptional<z.ZodObject<{
        text: z.ZodString;
        icon_url: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        text: string;
        icon_url?: string | undefined;
    }, {
        text: string;
        icon_url?: string | undefined;
    }>>;
    timestamp: z.ZodOptional<z.ZodString>;
    thumbnail: z.ZodOptional<z.ZodObject<{
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        url: string;
    }, {
        url: string;
    }>>;
    image: z.ZodOptional<z.ZodObject<{
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        url: string;
    }, {
        url: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    timestamp?: string | undefined;
    description?: string | undefined;
    image?: {
        url: string;
    } | undefined;
    fields?: {
        value: string;
        name: string;
        inline?: boolean | undefined;
    }[] | undefined;
    color?: number | undefined;
    footer?: {
        text: string;
        icon_url?: string | undefined;
    } | undefined;
    thumbnail?: {
        url: string;
    } | undefined;
}, {
    title: string;
    timestamp?: string | undefined;
    description?: string | undefined;
    image?: {
        url: string;
    } | undefined;
    fields?: {
        value: string;
        name: string;
        inline?: boolean | undefined;
    }[] | undefined;
    color?: number | undefined;
    footer?: {
        text: string;
        icon_url?: string | undefined;
    } | undefined;
    thumbnail?: {
        url: string;
    } | undefined;
}>;
export declare const ReportSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodString;
    data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    startDate: z.ZodString;
    endDate: z.ZodString;
    metrics: z.ZodArray<z.ZodString, "many">;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: string;
    data: Record<string, unknown>;
    timestamp: string;
    metrics: string[];
    startDate: string;
    endDate: string;
    id: string;
}, {
    type: string;
    data: Record<string, unknown>;
    timestamp: string;
    metrics: string[];
    startDate: string;
    endDate: string;
    id: string;
}>;
//# sourceMappingURL=activity-types.d.ts.map