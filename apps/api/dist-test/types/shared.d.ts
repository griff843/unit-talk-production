export interface EventLog {
    id: string;
    agent: string;
    timestamp: string;
    type: string;
    payload: Record<string, unknown>;
}
export interface TaskLog {
    task_id: string;
    agent: string;
    status: string;
    message: string;
    timestamp: string;
}
export type HealthLevel = 'ok' | 'warn' | 'error';
export type AgentStatus = 'idle' | 'healthy' | 'unhealthy' | 'degraded' | 'error';
export type HealthStatusType = 'healthy' | 'unhealthy' | 'degraded';
export interface HealthStatus {
    status: HealthStatusType;
    lastChecked: string;
    details?: Record<string, unknown>;
    error?: string;
}
export interface AgentTask {
    id: string;
    agent: string;
    type: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    data: Record<string, unknown>;
    result?: Record<string, unknown>;
    error?: string;
    created_at: string;
    updated_at: string;
}
export interface AgentLog {
    id: string;
    agent: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    details?: Record<string, unknown>;
    timestamp: string;
}
export interface AgentMetric {
    id: string;
    agent: string;
    metric: string;
    value: number;
    tags?: Record<string, string>;
    timestamp: string;
}
export interface AgentHealthRecord {
    id: string;
    agent: string;
    status: HealthStatusType;
    details?: Record<string, unknown>;
    duration_ms?: number;
    error?: string;
    timestamp: string;
}
export interface AgentErrorRecord {
    id: string;
    agent: string;
    error_type: string;
    error_message: string;
    error_stack?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    context?: Record<string, unknown>;
    timestamp: string;
}
export interface RetryOperation {
    id: string;
    agent: string;
    operation: string;
    attempts: number;
    max_attempts: number;
    last_error?: string;
    next_retry?: string;
    status: 'pending' | 'retrying' | 'succeeded' | 'failed';
    created_at: string;
    updated_at: string;
}
export declare const DB_TABLES: {
    readonly AGENT_TASKS: "agent_tasks";
    readonly AGENT_LOGS: "agent_logs";
    readonly AGENT_METRICS: "agent_metrics";
    readonly AGENT_HEALTH: "agent_health";
    readonly AGENT_ERRORS: "agent_errors";
    readonly RETRY_OPERATIONS: "retry_operations";
};
export type Timestamp = string;
export type UUID = string;
export interface TimeRange {
    start: Date;
    end: Date;
}
export interface Metrics {
    errorCount: number;
    warningCount: number;
    successCount: number;
    [key: string]: number;
}
export interface ErrorDetails {
    message: string;
    code?: string;
    stack?: string;
    context?: Record<string, unknown>;
}
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}
export interface DatabaseResult<T> {
    data: T | null;
    error: Error | null;
}
export interface PaginationParams {
    page: number;
    limit: number;
}
export interface SortParams {
    field: string;
    direction: 'asc' | 'desc';
}
export interface FilterParams {
    field: string;
    operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin';
    value: string | number | boolean | string[] | number[];
}
//# sourceMappingURL=shared.d.ts.map