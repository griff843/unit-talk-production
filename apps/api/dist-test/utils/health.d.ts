import { Logger } from '../shared/logger/types';
export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    details?: Record<string, unknown>;
    timestamp?: string;
}
export interface AgentStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    details?: Record<string, unknown>;
    timestamp?: string;
}
export declare class HealthCheck {
    private logger;
    private checkIntervals;
    private healthChecks;
    constructor(logger: Logger);
    registerHealthCheck(agentName: string, checkFn: () => Promise<HealthStatus>): void;
    performHealthCheck(agentName: string): Promise<HealthStatus>;
    startHealthCheck(agentName: string, interval: number): NodeJS.Timeout;
    cleanup(): Promise<void>;
}
export interface HealthReport {
    agentName: string;
    status: AgentStatus;
    timestamp: string;
    details?: {
        errors: string[];
        warnings: string[];
        info: Record<string, unknown>;
    };
}
export declare class HealthMonitor {
    private checkIntervals;
    private logger;
    constructor(logger: Logger);
    startHealthCheck(agentName: string, interval: number): NodeJS.Timeout;
    private performHealthCheck;
    stopHealthCheck(agentName: string): void;
}
//# sourceMappingURL=health.d.ts.map