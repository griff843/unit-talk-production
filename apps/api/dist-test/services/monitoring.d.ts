import { Counter, Histogram, Gauge } from 'prom-client';
export declare const metrics: {
    httpRequests: Counter<"method" | "route" | "status_code">;
    httpDuration: Histogram<"method" | "route">;
    agentHealth: Gauge<"agent_name">;
    agentOperations: Counter<"status" | "agent_name" | "operation">;
    cacheHits: Counter<"cache_type">;
    cacheMisses: Counter<"cache_type">;
};
export declare class MonitoringService {
    private app;
    private port;
    constructor(port?: number);
    private setupRoutes;
    start(): void;
}
export declare const monitoring: MonitoringService;
//# sourceMappingURL=monitoring.d.ts.map