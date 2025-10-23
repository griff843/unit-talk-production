import { Request, Response, NextFunction } from 'express';
interface EnhancedRequest extends Request {
    correlationId?: string;
    startTime?: number;
    requestId?: string;
    userId?: string;
    userTier?: string;
}
/**
 * Enhanced logging middleware with correlation ID tracking and structured logs
 * Provides comprehensive request/response logging for observability
 */
export declare function loggingMiddleware(): (req: EnhancedRequest, res: Response, next: NextFunction) => void;
/**
 * Security event logging middleware
 */
export declare function securityLoggingMiddleware(): (req: EnhancedRequest, res: Response, next: NextFunction) => void;
export {};
//# sourceMappingURL=loggingMiddleware.d.ts.map