/**
 * General Purpose Rate Limiting Middleware
 *
 * Provides intelligent rate limiting for write endpoints with:
 * - Per-IP and per-user limits
 * - Configurable via environment variables
 * - Retry-After headers on 429 responses
 * - Structured logging with event tracking
 * - In-memory storage with automatic cleanup
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../shared/logger';

/**
 * In-memory rate limit store
 * Format: key -> { count, resetAt }
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /**
   * Maximum requests per window
   * @default 10
   */
  maxRequests?: number;

  /**
   * Window duration in minutes
   * @default 1
   */
  windowMinutes?: number;

  /**
   * Key generator function
   * @default IP + user ID
   */
  keyGenerator?: (req: Request) => string;

  /**
   * Skip function - return true to skip rate limiting
   */
  skip?: (req: Request) => boolean;

  /**
   * Custom message for 429 response
   */
  message?: string;
}

/**
 * Default key generator: IP address + user ID
 */
function defaultKeyGenerator(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userId = (req as any).userId || (req.headers['x-user-id'] as string) || 'anonymous';
  return `${ip}:${userId}`;
}

/**
 * Clean up expired entries from rate limit store
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.debug('Rate limit store cleanup', {
      event: 'rate_limit_cleanup',
      cleaned,
      remaining: rateLimitStore.size,
    });
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredEntries, 5 * 60 * 1000);

/**
 * Create rate limiting middleware
 *
 * @example
 * ```typescript
 * // Basic usage (10 req/min per IP+user)
 * router.post('/picks', rateLimitGeneral(), handler);
 *
 * // Custom limits
 * router.post('/picks', rateLimitGeneral({
 *   maxRequests: 20,
 *   windowMinutes: 5,
 * }), handler);
 *
 * // Custom key generator
 * router.post('/picks', rateLimitGeneral({
 *   keyGenerator: (req) => req.headers['api-key'] as string,
 * }), handler);
 * ```
 */
export function rateLimitGeneral(config: RateLimitConfig = {}) {
  // Read configuration from env or use defaults
  const maxRequests = config.maxRequests ??
    parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10', 10);

  const windowMinutes = config.windowMinutes ??
    parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || '1', 10);

  const keyGenerator = config.keyGenerator ?? defaultKeyGenerator;
  const skip = config.skip;
  const message = config.message ?? 'Too many requests. Please try again later.';

  const windowMs = windowMinutes * 60 * 1000;

  logger.info('Rate limit middleware configured', {
    event: 'rate_limit_configured',
    maxRequests,
    windowMinutes,
    windowMs,
  });

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Skip rate limiting if configured
      if (skip && skip(req)) {
        return next();
      }

      // Generate rate limit key
      const key = keyGenerator(req);
      const now = Date.now();

      // Get or create rate limit entry
      let entry = rateLimitStore.get(key);

      if (!entry || entry.resetAt < now) {
        // Create new entry or reset expired entry
        entry = {
          count: 0,
          resetAt: now + windowMs,
        };
        rateLimitStore.set(key, entry);
      }

      // Increment request count
      entry.count++;

      // Calculate remaining requests and time to reset
      const remaining = Math.max(0, maxRequests - entry.count);
      const resetAt = entry.resetAt;
      const retryAfter = Math.ceil((resetAt - now) / 1000); // seconds

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', new Date(resetAt).toISOString());

      // Check if limit exceeded
      if (entry.count > maxRequests) {
        // Set Retry-After header (in seconds)
        res.setHeader('Retry-After', retryAfter.toString());

        logger.warn('Rate limit exceeded', {
          event: 'rate_limit_exceeded',
          key,
          count: entry.count,
          maxRequests,
          ttl: retryAfter,
          ip: req.ip,
          userId: (req as any).userId,
          path: req.path,
          method: req.method,
        });

        res.status(429).json({
          success: false,
          error: 'RATE_LIMIT_EXCEEDED',
          message,
          limit: maxRequests,
          remaining: 0,
          resetAt: new Date(resetAt).toISOString(),
          retryAfter,
          timestamp: new Date().toISOString(),
        });

        return;
      }

      // Log successful rate limit check
      if (entry.count === 1) {
        logger.debug('Rate limit check - new window', {
          event: 'rate_limit_check',
          key,
          count: entry.count,
          maxRequests,
          remaining,
        });
      }

      // Continue to next middleware
      next();
    } catch (error) {
      // Log error but don't block request
      logger.error('Rate limit middleware error', {
        event: 'rate_limit_error',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Continue without rate limiting on error
      next();
    }
  };
}

/**
 * Get current rate limit status for a key
 * (useful for testing and debugging)
 */
export function getRateLimitStatus(key: string): {
  count: number;
  resetAt: number;
  ttl: number;
} | null {
  const entry = rateLimitStore.get(key);
  if (!entry) return null;

  const now = Date.now();
  const ttl = Math.max(0, entry.resetAt - now);

  return {
    count: entry.count,
    resetAt: entry.resetAt,
    ttl,
  };
}

/**
 * Reset rate limit for a key
 * (useful for testing)
 */
export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
  logger.debug('Rate limit reset', {
    event: 'rate_limit_reset',
    key,
  });
}

/**
 * Clear all rate limit entries
 * (useful for testing)
 */
export function clearRateLimits(): void {
  const size = rateLimitStore.size;
  rateLimitStore.clear();
  logger.debug('All rate limits cleared', {
    event: 'rate_limit_clear_all',
    cleared: size,
  });
}
