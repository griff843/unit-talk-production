/**
 * Error Response Sanitizer
 * Prevents information disclosure through error messages
 * Production-ready security enhancement
 */

import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';

const logger = createLogger('ErrorSanitizer');

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

export class ErrorSanitizer {
  private config: ErrorSanitizerConfig;

  constructor(config: Partial<ErrorSanitizerConfig> = {}) {
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
  sanitizeError(error: any, req?: Request): SanitizedError {
    const correlationId = req?.headers['x-correlation-id'] as string || 
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
    const sanitized: SanitizedError = {
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
    return (error: any, req: Request, res: Response, next: NextFunction) => {
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
  private getSafeMessage(error: any): string {
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
  private getStatusCode(error: any): number {
    if (error.statusCode) return error.statusCode;
    if (error.status) return error.status;

    // Map error types to status codes
    const errorTypeMap: Record<string, number> = {
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
  private isDatabaseError(error: any): boolean {
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
  private isNetworkError(error: any): boolean {
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

// Export singleton instance
export const errorSanitizer = new ErrorSanitizer();
