export interface BaseActivityParams {
    timestamp: string;
    error?: Error;
    cycleCount: number;
    context?: Record<string, unknown>;
}

export interface ActivityResult<T = any> {
    success: boolean;
    error?: Error;
    data?: T;
    timestamp: string;
}
