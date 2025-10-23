import { z } from 'zod';
export interface BaseAgentErrorData {
    agentName: string;
    operation: string;
    details?: Record<string, unknown>;
    timestamp?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
}
export declare class AgentError extends Error {
    agentName: string;
    operation: string;
    details?: Record<string, unknown>;
    timestamp: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    constructor(message: string, data: BaseAgentErrorData);
    toJSON(): {
        name: string;
        message: string;
        agentName: string;
        operation: string;
        details: Record<string, unknown> | undefined;
        timestamp: string;
        severity: "critical" | "low" | "medium" | "high";
    };
}
export declare class AgentValidationError extends AgentError {
    constructor(message: string, data: BaseAgentErrorData & {
        zodError?: z.ZodError;
    });
}
export declare class ProcessingError extends AgentError {
    constructor(message: string, data: BaseAgentErrorData);
}
export declare class NetworkError extends AgentError {
    constructor(message: string, data: BaseAgentErrorData & {
        statusCode?: number;
        endpoint?: string;
    });
}
export declare class DatabaseError extends AgentError {
    constructor(message: string, data: BaseAgentErrorData & {
        table?: string;
        operation?: string;
    });
}
export declare class WorkflowError extends AgentError {
    constructor(message: string, data: BaseAgentErrorData & {
        workflowId?: string;
        activityName?: string;
    });
}
export declare class ConfigurationError extends AgentError {
    constructor(message: string, data: BaseAgentErrorData & {
        configKey?: string;
    });
}
export declare class RateLimitError extends AgentError {
    constructor(message: string, data: BaseAgentErrorData & {
        limit?: number;
        resetTime?: string;
    });
}
export declare class ExternalServiceError extends AgentError {
    constructor(message: string, data: BaseAgentErrorData & {
        service?: string;
        endpoint?: string;
    });
}
export declare const createAgentError: (type: string, message: string, data: BaseAgentErrorData) => AgentError;
//# sourceMappingURL=agent-errors.d.ts.map