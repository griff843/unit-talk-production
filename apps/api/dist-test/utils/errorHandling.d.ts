import { SupabaseClient } from '@supabase/supabase-js';
export declare class ValidationError extends Error {
    constructor(message: string);
}
export declare class DatabaseError extends Error {
    constructor(message: string);
}
export declare class ErrorHandler {
    private readonly logger;
    private readonly supabase?;
    private readonly context?;
    constructor(context?: string, supabase?: SupabaseClient);
    handleError(error: Error, additionalContext?: Record<string, unknown>): Promise<void>;
    private determineSeverity;
    private isCriticalError;
    private recordError;
    private handleCriticalError;
    private triggerCriticalErrorAlerts;
    getErrorStats(timeWindowMs?: number): Promise<Record<string, number>>;
    withRetry<T>(fn: () => Promise<T>, operation: string): Promise<T>;
}
//# sourceMappingURL=errorHandling.d.ts.map