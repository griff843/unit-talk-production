/**
 * Enhanced Security Middleware
 * Adds rate limiting, request fingerprinting, and suspicious activity detection
 * Production-ready security enhancements for the Unit Talk Platform
 */
import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';
export interface SecurityConfig {
    rateLimiting: {
        windowMs: number;
        maxRequests: number;
        maxRequestsPerUser: number;
        skipSuccessfulRequests: boolean;
    };
    suspiciousActivity: {
        maxFailedAttempts: number;
        lockoutDurationMs: number;
        monitoringWindowMs: number;
    };
    requestFingerprinting: {
        enabled: boolean;
        trackHeaders: string[];
        trackUserAgent: boolean;
    };
}
export interface RequestFingerprint {
    ip: string;
    userAgent: string;
    headers: Record<string, string>;
    timestamp: number;
    userId?: string;
}
export interface SecurityMetrics {
    totalRequests: number;
    blockedRequests: number;
    suspiciousRequests: number;
    rateLimitedRequests: number;
    uniqueFingerprints: number;
    failedAuthAttempts: number;
}
export declare class EnhancedSecurityMiddleware {
    private cache;
    private logger;
    private config;
    private metrics;
    private static readonly DEFAULT_CONFIG;
    constructor(config: Partial<SecurityConfig> | undefined, logger: Logger);
    /**
     * Main security middleware function
     */
    middleware(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Generate request fingerprint for tracking
     */
    private generateFingerprint;
    /**
     * Check for suspicious activity patterns
     */
    private isSuspiciousActivity;
    /**
     * Check if request should be rate limited
     */
    private isRateLimited;
    /**
     * Track successful request for rate limiting
     */
    private trackRequest;
    /**
     * Utility methods
     */
    private getClientIP;
    private hasSuspiciousUserAgent;
    private hasSuspiciousPath;
    private hashFingerprint;
    /**
     * Get security metrics for monitoring
     */
    getMetrics(): SecurityMetrics;
    /**
     * Reset security metrics
     */
    resetMetrics(): void;
}
//# sourceMappingURL=EnhancedSecurityMiddleware.d.ts.map