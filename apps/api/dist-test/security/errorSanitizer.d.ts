/**
 * Error Response Sanitizer
 * Prevents information disclosure through error messages
 * Production-ready security enhancement
 */
import { Request, Response, NextFunction } from 'express';
export interface SanitizedError {
    message: string;
    code?: string;
    statusCode: number;
    timestamp: string;
    correlationId?: string;
}
export interface ErrorSanitizerConfig {
    includeStackTrace: boolean;
    includeSensitiveDetails: boolean;
    logFullErrors: boolean;
    allowedErrorCodes: string[];
}
export declare class ErrorSanitizer {
    private config;
    constructor(config?: Partial<ErrorSanitizerConfig>);
    /**
     * Sanitize error for client response
     */
    sanitizeError(error: any, req?: Request): SanitizedError;
    /**
     * Express error handling middleware
     */
    middleware(): (error: any, req: Request, res: Response, next: NextFunction) => void;
    /**
     * Get safe error message for client
     */
    private getSafeMessage;
    /**
     * Determine appropriate HTTP status code
     */
    private getStatusCode;
    /**
     * Check if error is database-related
     */
    private isDatabaseError;
    /**
     * Check if error is network-related
     */
    private isNetworkError;
}
export declare const errorSanitizer: ErrorSanitizer;
//# sourceMappingURL=errorSanitizer.d.ts.map