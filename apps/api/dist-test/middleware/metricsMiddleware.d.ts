import { Request, Response, NextFunction } from 'express';
interface MetricsRequest extends Request {
    startTime?: number;
    correlationId?: string;
}
interface MetricsResponse extends Response {
    originalSend?: any;
}
/**
 * Comprehensive metrics middleware for API observability
 * Tracks HTTP request/response metrics, latency, and throughput
 */
export declare function metricsMiddleware(): (req: MetricsRequest, res: MetricsResponse, next: NextFunction) => void;
/**
 * Advanced request classifier for more granular metrics
 */
export declare function classifyRequest(req: Request): {
    route: string;
    category: string;
    priority: 'high' | 'medium' | 'low';
};
/**
 * Error metrics middleware to track error rates
 */
export declare function errorMetricsMiddleware(): (error: Error, req: MetricsRequest, res: MetricsResponse, next: NextFunction) => void;
export {};
//# sourceMappingURL=metricsMiddleware.d.ts.map