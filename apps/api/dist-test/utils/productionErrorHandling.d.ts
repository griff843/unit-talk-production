/**
 * Production Error Handling System
 * Comprehensive error management for professional betting system
 */
export interface ErrorContext {
    operation: string;
    userId?: string;
    pickId?: string;
    sessionId?: string;
    metadata?: Record<string, any>;
    severity: 'low' | 'medium' | 'high' | 'critical';
}
export interface ErrorRecoveryAction {
    action: 'retry' | 'fallback' | 'abort' | 'escalate';
    delay?: number;
    maxRetries?: number;
    fallbackFn?: () => Promise<any>;
}
export declare class ProductionErrorHandler {
    private static instance;
    private errorCounts;
    private circuitBreakers;
    private constructor();
    static getInstance(): ProductionErrorHandler;
    /**
     * Handle errors with context and automatic recovery
     */
    handleError(error: Error | any, context: ErrorContext, recoveryAction?: ErrorRecoveryAction): Promise<{
        recovered: boolean;
        result?: any;
        finalError?: Error;
    }>;
    /**
     * Handle professional system specific errors
     */
    handleProfessionalSystemError(error: Error, operation: 'devigging' | 'clv_tracking' | 'professional_grading' | 'database_operation', pickData?: any): Promise<{
        recovered: boolean;
        result?: any;
    }>;
    /**
     * Log error with structured format
     */
    private logError;
    /**
     * Track error counts for circuit breaker logic
     */
    private trackError;
    /**
     * Check if circuit breaker is open
     */
    private isCircuitOpen;
    /**
     * Attempt error recovery
     */
    private attemptRecovery;
    /**
     * Attempt retry with exponential backoff
     */
    private attemptRetry;
    /**
     * Default error handling based on severity
     */
    private defaultErrorHandling;
    /**
     * Escalate error to ops team
     */
    private escalateError;
    /**
     * Send error data to external monitoring
     */
    private sendToExternalMonitoring;
    /**
     * Get error statistics
     */
    getErrorStats(): {
        totalErrors: number;
        errorsByOperation: Record<string, number>;
        circuitBreakerStatus: Record<string, {
            isOpen: boolean;
            failures: number;
        }>;
    };
}
export declare const productionErrorHandler: ProductionErrorHandler;
export declare const handleDatabaseError: (error: Error, operation: string, data?: any) => Promise<{
    recovered: boolean;
    result?: any;
}>;
export declare const handleDeviggingError: (error: Error, pickData?: any) => Promise<{
    recovered: boolean;
    result?: any;
}>;
export declare const handleCLVError: (error: Error, pickData?: any) => Promise<{
    recovered: boolean;
    result?: any;
}>;
export declare const handleGradingError: (error: Error, pickData?: any) => Promise<{
    recovered: boolean;
    result?: any;
}>;
//# sourceMappingURL=productionErrorHandling.d.ts.map