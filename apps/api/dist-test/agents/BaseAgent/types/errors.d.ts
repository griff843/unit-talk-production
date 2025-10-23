export interface BaseAgentErrorData {
    message: string;
    agentName: string;
    context?: Record<string, unknown>;
    isRetryable: boolean;
}
export declare class BaseAgentError extends Error {
    readonly agentName: string;
    readonly context?: Record<string, unknown>;
    readonly isRetryable: boolean;
    constructor(message: string, agentName: string, context?: Record<string, unknown>, isRetryable?: boolean);
}
//# sourceMappingURL=errors.d.ts.map