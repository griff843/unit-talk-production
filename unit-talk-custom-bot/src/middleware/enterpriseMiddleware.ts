import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import Joi from 'joi';
import { logger } from '../utils/enterpriseErrorHandling';

// Redis client for rate limiting
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

// Rate limiters
const rateLimiters = {
  // General API rate limiter
  api: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl_api',
    points: 100, // Number of requests
    duration: 60, // Per 60 seconds
    blockDuration: 60, // Block for 60 seconds if limit exceeded
  }),

  // Strict rate limiter for sensitive operations
  strict: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl_strict',
    points: 10,
    duration: 60,
    blockDuration: 300, // Block for 5 minutes
  }),

  // Login attempts rate limiter
  login: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl_login',
    points: 5,
    duration: 900, // 15 minutes
    blockDuration: 900,
  }),

  // Fallback memory-based rate limiter
  memory: new RateLimiterMemory({
    keyPrefix: 'rl_memory',
    points: 50,
    duration: 60,
    blockDuration: 60,
  }),
};

// Rate limiting middleware factory
export function createRateLimit(type: keyof typeof rateLimiters = 'api') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = req.ip || req.connection.remoteAddress || 'unknown';
      const limiter = rateLimiters[type];

      await limiter.consume(key);
      next();
    } catch (rejRes: any) {
      const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
      res.set('Retry-After', String(secs));
      
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        type,
        retryAfter: secs,
        path: req.path,
      });

      res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${secs} seconds.`,
        retryAfter: secs,
      });
    }
  };
}

// Advanced rate limiting with different strategies
export function advancedRateLimit(options: {
  windowMs?: number;
  maxRequests?: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}) {
  const {
    windowMs = 60000,
    maxRequests = 100,
    keyGenerator = (req) => req.ip || 'unknown',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = options;

  const limiter = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl_advanced',
    points: maxRequests,
    duration: Math.floor(windowMs / 1000),
    blockDuration: Math.floor(windowMs / 1000),
  });

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = keyGenerator(req);
      
      // Skip rate limiting based on options
      if (skipSuccessfulRequests && res.statusCode < 400) {
        return next();
      }
      if (skipFailedRequests && res.statusCode >= 400) {
        return next();
      }

      await limiter.consume(key);
      next();
    } catch (rejRes: any) {
      const points = rejRes.points || maxRequests;
      const duration = rejRes.duration || Math.floor(windowMs / 1000);
      
      logger.warn('Advanced rate limit exceeded', {
        key: keyGenerator(req),
        points,
        duration,
        path: req.path,
      });

      res.status(429).json({
        error: 'Rate limit exceeded',
        limit: maxRequests,
        windowMs,
        retryAfter: Math.round(rejRes.msBeforeNext / 1000) || 1,
      });
    }
  };
}

// Input validation middleware
export function validateInput(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((detail: any) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      logger.warn('Input validation failed', {
        path: req.path,
        errors: details,
        body: req.body,
      });

      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid input data',
        details,
      });
    }

    req.body = value;
    return next();
  };
}

// Request sanitization middleware
export function sanitizeInput() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Sanitize common injection patterns
    const sanitize = (obj: any): any => {
      if (typeof obj === 'string') {
        return obj
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .trim();
      }
      
      if (Array.isArray(obj)) {
        return obj.map(sanitize);
      }
      
      if (obj && typeof obj === 'object') {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
          sanitized[key] = sanitize(value);
        }
        return sanitized;
      }
      
      return obj;
    };

    if (req.body) {
      req.body = sanitize(req.body);
    }
    
    if (req.query) {
      req.query = sanitize(req.query);
    }

    next();
  };
}

// Request logging middleware
export function requestLogger() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    
    // Log request
    logger.info('Incoming request', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
    });

    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any) {
      const duration = Date.now() - start;
      
      logger.info('Request completed', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        ip: req.ip,
      });

      return originalEnd.call(this, chunk, encoding);
    };

    next();
  };
}

// Security headers middleware
export function securityHeaders() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Basic security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    // HSTS header for HTTPS
    if (req.secure || req.get('X-Forwarded-Proto') === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    
    // Content Security Policy
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join('; '));

    next();
  };
}

// CORS middleware
export function corsHandler() {
  return (req: Request, res: Response, next: NextFunction) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
    const origin = req.get('Origin');

    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    return next();
  };
}

// Error handling middleware
export function errorHandler() {
  return (err: any, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    // Don't expose internal errors in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    res.status(err.status || 500).json({
      error: 'Internal Server Error',
      message: isDevelopment ? err.message : 'Something went wrong',
      ...(isDevelopment && { stack: err.stack }),
    });
  };
}

// Health check middleware
export function healthCheck() {
  return async (req: Request, res: Response) => {
    try {
      // Check Redis connection
      await redis.ping();
      
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        redis: 'connected',
      });
    } catch (error) {
      logger.error('Health check failed', { error });
      
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Service unavailable',
      });
    }
  };
}

// Graceful shutdown handler
export function gracefulShutdown() {
  const shutdown = async () => {
    logger.info('Shutting down gracefully...');
    
    try {
      await redis.disconnect();
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Error closing Redis connection', { error });
    }
    
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}