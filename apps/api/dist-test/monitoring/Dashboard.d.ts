import { Gauge, Counter, Histogram, Summary } from 'prom-client';
export declare class UnitTalkMetrics {
    readonly agentProcessingTime: Histogram<"agent_name" | "operation">;
    readonly agentErrors: Counter<"agent_name" | "error_type">;
    readonly agentHealthStatus: Gauge<"agent_name" | "service">;
    readonly alertsSent: Counter<"tier" | "channel" | "advice_type">;
    readonly alertsProcessingTime: Histogram<string>;
    readonly alertsSkipped: Counter<"reason">;
    readonly aiModelRequests: Counter<"status" | "provider" | "model_id">;
    readonly aiModelLatency: Histogram<"provider" | "model_id">;
    readonly aiModelAccuracy: Gauge<"provider" | "model_id">;
    readonly aiModelCost: Counter<"provider" | "model_id">;
    readonly picksProcessed: Counter<"status" | "tier" | "market_type">;
    readonly pickAccuracy: Gauge<"tier" | "time_period">;
    readonly userEngagement: Gauge<"metric_type" | "time_period">;
    readonly revenueMetrics: Gauge<"metric_type" | "time_period">;
    readonly databaseConnections: Gauge<"database">;
    readonly queueSize: Gauge<"queue_name">;
    readonly rateLimitHits: Counter<"service" | "endpoint">;
    readonly performanceSummary: Summary<"operation" | "component">;
    recordAgentProcessing(agentName: string, operation: string, duration: number): void;
    recordAgentError(agentName: string, errorType: string): void;
    updateAgentHealth(agentName: string, service: string, isHealthy: boolean): void;
    recordAlertSent(channel: string, tier: string, adviceType: string): void;
    recordAIModelRequest(modelId: string, provider: string, status: string, latency?: number, cost?: number): void;
    updateAIModelAccuracy(modelId: string, provider: string, accuracy: number): void;
    recordPickProcessed(tier: string, marketType: string, status: string): void;
    updateBusinessMetric(metricType: string, timePeriod: string, value: number): void;
    recordPerformance(operation: string, component: string, duration: number): void;
}
export declare const metrics: UnitTalkMetrics;
export declare class EnhancedDashboard {
    private server;
    private port;
    private updateInterval;
    constructor(port?: number);
    start(): Promise<void>;
    stop(): Promise<void>;
    private getDashboardData;
    private processMetricsData;
    private getMetricValue;
    private getDashboardHTML;
    private startPeriodicUpdates;
    private updateSystemMetrics;
}
export declare const dashboard: EnhancedDashboard;
//# sourceMappingURL=Dashboard.d.ts.map