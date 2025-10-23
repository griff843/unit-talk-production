"use strict";
/**
 * Error Response Sanitizer
 * Prevents information disclosure through error messages
 * Production-ready security enhancement
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorSanitizer = exports.ErrorSanitizer = void 0;
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createLogger)('ErrorSanitizer');
class ErrorSanitizer {
    constructor(config = {}) {
        this.config = {
            includeStackTrace: process.env.NODE_ENV === 'development',
            includeSensitiveDetails: process.env.NODE_ENV === 'development',
            logFullErrors: true,
            allowedErrorCodes: [
                'VALIDATION_ERROR',
                'AUTHENTICATION_REQUIRED',
                'INSUFFICIENT_PERMISSIONS',
                'RESOURCE_NOT_FOUND',
                'RATE_LIMIT_EXCEEDED',
                'INVALID_INPUT'
            ],
            ...config
        };
    }
    /**
     * Sanitize error for client response
     */
    sanitizeError(error, req) {
        const correlationId = req?.headers['x-correlation-id'] ||
            `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        // Log full error details for debugging
        if (this.config.logFullErrors) {
            logger.error('Error occurred', {
                correlationId,
                error: error.message,
                stack: error.stack,
                path: req?.path,
                method: req?.method,
                ip: req?.ip,
                userAgent: req?.get('User-Agent')
            });
        }
        // Determine status code
        const statusCode = this.getStatusCode(error);
        // Create sanitized response
        const sanitized = {
            message: this.getSafeMessage(error),
            statusCode,
            timestamp: new Date().toISOString(),
            correlationId
        };
        // Add error code if it's in allowed list
        if (error.code && this.config.allowedErrorCodes.includes(error.code)) {
            sanitized.code = error.code;
        }
        return sanitized;
    }
    /**
     * Express error handling middleware
     */
    middleware() {
        return (error, req, res, next) => {
            // Don't handle if response already sent
            if (res.headersSent) {
                return next(error);
            }
            const sanitized = this.sanitizeError(error, req);
            // Set security headers
            res.set({
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': 'DENY',
                'X-XSS-Protection': '1; mode=block'
            });
            res.status(sanitized.statusCode).json({
                success: false,
                error: sanitized.message,
                code: sanitized.code,
                timestamp: sanitized.timestamp,
                correlationId: sanitized.correlationId
            });
        };
    }
    /**
     * Get safe error message for client
     */
    getSafeMessage(error) {
        // Known safe error types
        const safeErrors = [
            'ValidationError',
            'AuthenticationError',
            'AuthorizationError',
            'NotFoundError',
            'RateLimitError'
        ];
        // If it's a known safe error type, return the message
        if (safeErrors.includes(error.name) || safeErrors.includes(error.constructor.name)) {
            return error.message;
        }
        // For database errors, return generic message
        if (this.isDatabaseError(error)) {
            return 'A database error occurred. Please try again later.';
        }
        // For network errors, return generic message
        if (this.isNetworkError(error)) {
            return 'A network error occurred. Please check your connection and try again.';
        }
        // For validation errors, return the message (usually safe)
        if (error.message && error.message.includes('validation')) {
            return error.message;
        }
        // Default generic message for unknown errors
        return 'An unexpected error occurred. Please try again later.';
    }
    /**
     * Determine appropriate HTTP status code
     */
    getStatusCode(error) {
        if (error.statusCode)
            return error.statusCode;
        if (error.status)
            return error.status;
        // Map error types to status codes
        const errorTypeMap = {
            'ValidationError': 400,
            'AuthenticationError': 401,
            'AuthorizationError': 403,
            'NotFoundError': 404,
            'RateLimitError': 429,
            'DatabaseError': 500,
            'NetworkError': 502
        };
        const errorType = error.name || error.constructor.name;
        return errorTypeMap[errorType] || 500;
    }
    /**
     * Check if error is database-related
     */
    isDatabaseError(error) {
        const dbErrorIndicators = [
            'connection',
            'database',
            'postgres',
            'supabase',
            'sql',
            'query',
            'relation',
            'column',
            'constraint'
        ];
        const errorString = (error.message || '').toLowerCase();
        return dbErrorIndicators.some(indicator => errorString.includes(indicator));
    }
    /**
     * Check if error is network-related
     */
    isNetworkError(error) {
        const networkErrorIndicators = [
            'ECONNREFUSED',
            'ENOTFOUND',
            'ETIMEDOUT',
            'ECONNRESET',
            'network',
            'timeout',
            'fetch'
        ];
        const errorString = (error.message || error.code || '').toLowerCase();
        return networkErrorIndicators.some(indicator => errorString.includes(indicator));
    }
}
exports.ErrorSanitizer = ErrorSanitizer;
// Export singleton instance
exports.errorSanitizer = new ErrorSanitizer();
