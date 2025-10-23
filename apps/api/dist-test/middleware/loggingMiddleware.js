"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loggingMiddleware = loggingMiddleware;
exports.securityLoggingMiddleware = securityLoggingMiddleware;
const uuid_1 = require("uuid");
const logger_1 = require("../utils/logger");
// Temporarily disable OpenTelemetry API import until package is installed
// import { trace, SpanStatusCode } from '@opentelemetry/api';
const logger = (0, logger_1.createLogger)('HTTP');
/**
 * Enhanced logging middleware with correlation ID tracking and structured logs
 * Provides comprehensive request/response logging for observability
 */
function loggingMiddleware() {
    return (req, res, next) => {
        // Generate unique identifiers
        const correlationId = req.headers['x-correlation-id'] || (0, uuid_1.v4)();
        const requestId = (0, uuid_1.v4)();
        const startTime = Date.now();
        // Attach to request for use in other middleware/handlers
        req.correlationId = correlationId;
        req.requestId = requestId;
        req.startTime = startTime;
        // Extract user information if available
        req.userId = extractUserId(req);
        req.userTier = extractUserTier(req);
        // Add correlation ID to response headers
        res.setHeader('x-correlation-id', correlationId);
        res.setHeader('x-request-id', requestId);
        // Get client IP (handle proxy/load balancer scenarios)
        const clientIp = getClientIp(req);
        // Extract request metrics
        const requestSize = req.headers['content-length']
            ? parseInt(req.headers['content-length'], 10)
            : 0;
        // Log incoming request
        logger.info('HTTP Request Started', {
            correlationId,
            requestId,
            method: req.method,
            url: req.url,
            route: extractRoutePattern(req.path),
            userAgent: req.headers['user-agent'] || 'unknown',
            contentType: req.headers['content-type'],
            acceptEncoding: req.headers['accept-encoding'],
            requestSize,
            clientIp,
            userId: req.userId,
            userTier: req.userTier,
            timestamp: new Date().toISOString(),
            // Security headers
            origin: req.headers.origin,
            referer: req.headers.referer,
        });
        // Hook into response to log completion
        const originalSend = res.send;
        const originalJson = res.json;
        // Override send method
        res.send = function (data) {
            logRequestCompletion(req, res, data);
            return originalSend.call(this, data);
        };
        // Override json method
        res.json = function (data) {
            logRequestCompletion(req, res, data);
            return originalJson.call(this, data);
        };
        // Handle errors and timeouts
        req.on('timeout', () => {
            logger.warn('HTTP Request Timeout', {
                correlationId,
                requestId,
                method: req.method,
                url: req.url,
                duration: Date.now() - startTime,
                clientIp,
            });
        });
        req.on('error', (error) => {
            logger.error('HTTP Request Error', {
                correlationId,
                requestId,
                method: req.method,
                url: req.url,
                error: error.message,
                stack: error.stack,
                clientIp,
            });
        });
        next();
    };
}
/**
 * Log request completion with comprehensive metrics
 */
function logRequestCompletion(req, res, data) {
    const duration = Date.now() - (req.startTime || Date.now());
    const statusCode = res.statusCode;
    // Calculate response size
    let responseSize = 0;
    if (data) {
        responseSize = typeof data === 'string'
            ? Buffer.byteLength(data, 'utf8')
            : JSON.stringify(data).length;
    }
    const requestMetrics = {
        method: req.method,
        url: req.url,
        route: extractRoutePattern(req.path),
        statusCode,
        duration,
        requestSize: req.headers['content-length']
            ? parseInt(req.headers['content-length'], 10)
            : 0,
        responseSize,
        userAgent: req.headers['user-agent'] || 'unknown',
        clientIp: getClientIp(req),
        correlationId: req.correlationId || 'unknown',
        requestId: req.requestId || 'unknown',
        userId: req.userId,
        userTier: req.userTier,
    };
    // Determine log level based on status code and duration
    const logLevel = determineLogLevel(statusCode, duration);
    const logMessage = `HTTP Request Completed - ${req.method} ${req.path}`;
    // Log with appropriate level
    logger[logLevel](logMessage, {
        ...requestMetrics,
        timestamp: new Date().toISOString(),
        performance: classifyPerformance(duration),
        category: classifyRequest(req.path),
        // Additional context for errors
        ...(statusCode >= 400 && {
            errorDetails: {
                statusCode,
                statusMessage: res.statusMessage,
                headers: res.getHeaders(),
            }
        }),
        // Additional context for slow requests
        ...(duration > 1000 && {
            slowRequestAnalysis: {
                duration,
                threshold: 1000,
                category: 'slow',
                possibleCauses: ['database_query', 'external_api', 'processing_time']
            }
        })
    });
    // TODO: Re-enable OpenTelemetry span attributes once OpenTelemetry API is available
    try {
        // Add OpenTelemetry span attributes if available
        // const span = trace.getActiveSpan();
        // if (span) {
        //   span.setAttributes({
        //     'http.method': req.method,
        //     'http.url': req.url,
        //     'http.status_code': statusCode,
        //     'http.request_size': requestMetrics.requestSize,
        //     'http.response_size': responseSize,
        //     'http.user_agent': requestMetrics.userAgent,
        //     'user.id': req.userId || 'anonymous',
        //     'user.tier': req.userTier || 'unknown',
        //     'request.correlation_id': req.correlationId || 'unknown',
        //     'request.duration_ms': duration,
        //   });
        //
        //   // Set span status based on HTTP status code
        //   if (statusCode >= 400) {
        //     span.setStatus({
        //       code: SpanStatusCode.ERROR,
        //       message: `HTTP ${statusCode}: ${res.statusMessage || 'Request failed'}`
        //     });
        //   } else {
        //     span.setStatus({ code: SpanStatusCode.OK });
        //   }
        // }
    }
    catch (error) {
        // Silently ignore OpenTelemetry errors
    }
}
/**
 * Determine appropriate log level based on status code and duration
 */
function determineLogLevel(statusCode, duration) {
    if (statusCode >= 500)
        return 'error';
    if (statusCode >= 400)
        return 'warn';
    if (duration > 5000)
        return 'warn'; // Requests taking more than 5 seconds
    return 'info';
}
/**
 * Classify request performance
 */
function classifyPerformance(duration) {
    if (duration < 100)
        return 'fast';
    if (duration < 500)
        return 'normal';
    if (duration < 2000)
        return 'slow';
    return 'critical';
}
/**
 * Classify request by type for analytics
 */
function classifyRequest(path) {
    if (path.includes('/health'))
        return 'health';
    if (path.startsWith('/api/'))
        return 'api';
    if (path.startsWith('/admin/'))
        return 'admin';
    if (path.includes('.'))
        return 'static';
    return 'unknown';
}
/**
 * Extract user ID from request (JWT token, session, etc.)
 */
function extractUserId(req) {
    // Check for JWT token in Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            // In a real implementation, you'd decode the JWT here
            // For now, return a placeholder
            return 'extracted-from-jwt';
        }
        catch (error) {
            // Invalid JWT
        }
    }
    // Check for user ID in custom header
    const userIdHeader = req.headers['x-user-id'];
    if (userIdHeader) {
        return userIdHeader;
    }
    // Check for session-based user ID
    if (req.session?.userId) {
        return req.session.userId;
    }
    return undefined;
}
/**
 * Extract user tier from request
 */
function extractUserTier(req) {
    // Check for tier in custom header
    const tierHeader = req.headers['x-user-tier'];
    if (tierHeader) {
        return tierHeader;
    }
    // Check for tier in session
    if (req.session?.userTier) {
        return req.session.userTier;
    }
    return undefined;
}
/**
 * Get client IP address handling various proxy scenarios
 */
function getClientIp(req) {
    return (req.headers['x-forwarded-for']?.split(',')[0] ||
        req.headers['x-real-ip'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        'unknown');
}
/**
 * Extract route pattern for consistent logging
 */
function extractRoutePattern(path) {
    // Same logic as metrics middleware
    const patterns = [
        { pattern: /^\/health(\/.*)?$/, replacement: '/health' },
        { pattern: /^\/api\/health(\/.*)?$/, replacement: '/api/health' },
        { pattern: /^\/api\/picks\/\d+$/, replacement: '/api/picks/:id' },
        { pattern: /^\/api\/users\/[^\/]+$/, replacement: '/api/users/:id' },
        { pattern: /^\/api\/features\/[^\/]+$/, replacement: '/api/features/:id' },
        { pattern: /^\/api\/smart-form\/process$/, replacement: '/api/smart-form/process' },
        { pattern: /^\/api\/smart-form\/health$/, replacement: '/api/smart-form/health' },
        { pattern: /^\/ops\/status\/[^\/]+$/, replacement: '/ops/status/:runId' },
        { pattern: /^\/ops\/.*$/, replacement: '/ops' },
        { pattern: /^\/admin\/.*$/, replacement: '/admin' },
        { pattern: /^\/health\/provider$/, replacement: '/health/provider' },
    ];
    for (const { pattern, replacement } of patterns) {
        if (pattern.test(path)) {
            return replacement;
        }
    }
    return path === '/' ? '/' : path;
}
/**
 * Security event logging middleware
 */
function securityLoggingMiddleware() {
    return (req, res, next) => {
        // Track potentially suspicious requests
        const suspiciousIndicators = [];
        // Check for suspicious patterns
        if (req.path.includes('..'))
            suspiciousIndicators.push('path_traversal');
        if (req.path.includes('<script'))
            suspiciousIndicators.push('xss_attempt');
        if (req.path.includes('union') && req.path.includes('select'))
            suspiciousIndicators.push('sql_injection');
        // Check for unusual request sizes
        const contentLength = parseInt(req.headers['content-length'] || '0', 10);
        if (contentLength > 10 * 1024 * 1024)
            suspiciousIndicators.push('large_payload');
        // Check for suspicious user agents
        const userAgent = req.headers['user-agent'] || '';
        if (userAgent.includes('sqlmap') || userAgent.includes('nikto')) {
            suspiciousIndicators.push('security_scanner');
        }
        // Log security events
        if (suspiciousIndicators.length > 0) {
            logger.warn('Security Event Detected', {
                correlationId: req.correlationId,
                requestId: req.requestId,
                method: req.method,
                url: req.url,
                clientIp: getClientIp(req),
                userAgent,
                suspiciousIndicators,
                timestamp: new Date().toISOString(),
                severity: 'medium',
                category: 'security',
            });
        }
        next();
    };
}
