export interface AgentTaskInput {
    task_id: string;
    agent: string;
    data: unknown;
}
export interface AgentTaskResult {
    success: boolean;
    data?: unknown;
    error?: Error;
}
export declare enum AgentStatus {
    OK = "ok",
    WARN = "warn",
    ERROR = "error"
}
export interface HealthCheckResult {
    status: AgentStatus;
    details?: {
        errors?: string[];
        warnings?: string[];
        info?: string[];
    };
}
export interface AgentCommand {
    type: string;
    payload?: unknown;
}
export interface AgentConfig {
    name: string;
    enabled: boolean;
    healthCheckIntervalMs?: number;
    metricsIntervalMs?: number;
    [key: string]: unknown;
}
//# sourceMappingURL=index.d.ts.map