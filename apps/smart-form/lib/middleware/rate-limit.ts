/**
 * Rate Limiting Middleware for Smart Form
 * Date: 2025-10-25
 * 
 * Implements per-IP and per-user rate limits with Redis backend
 * - Read endpoints: 300 req/min per IP
 * - Write endpoints: 60 req/min per user
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from 'redis';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  identifier: (req: NextRequest) => string;
}

// Redis client singleton
let redisClient: ReturnType<typeof createClient> | null = null;

// In-memory storage for rate limiting (for tests/development)
const memoryStore = new Map<string, number[]>();

async function getRedisClient() {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = createClient({ url: redisUrl });

    redisClient.on('error', (err) => {
      console.error('Redis rate limiter error:', err);
    });

    await redisClient.connect();
  }

  return redisClient;
}

/**
 * Memory-based rate limiting (for tests/development when Redis unavailable)
 */
function checkRateLimitMemory(
  key: string,
  windowMs: number,
  maxRequests: number
): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Get existing timestamps for this key
  let timestamps = memoryStore.get(key) || [];

  // Remove old entries outside the window
  timestamps = timestamps.filter(ts => ts > windowStart);

  // Check if rate limit exceeded
  if (timestamps.length >= maxRequests) {
    const oldestEntry = timestamps[0];
    const resetTime = oldestEntry + windowMs;
    const retryAfter = Math.ceil((resetTime - now) / 1000);

    return { allowed: false, retryAfter };
  }

  // Add current request timestamp
  timestamps.push(now);
  memoryStore.set(key, timestamps);

  return { allowed: true, retryAfter: 0 };
}

/**
 * Rate limit middleware factory
 */
export function createRateLimiter(config: RateLimitConfig) {
  return async (req: NextRequest, userId?: string): Promise<NextResponse | null> => {
    // Skip rate limiting if disabled
    if (process.env.RATE_LIMIT_ENABLED === 'false') {
      return null;
    }

    // Use provided userId or extract from request
    const identifier = userId || config.identifier(req);
    const key = `${config.keyPrefix}:${identifier}`;

    // Use in-memory rate limiting if configured (for tests/dev without Redis)
    if (process.env.RATE_LIMIT_USE_MEMORY === 'true') {
      const result = checkRateLimitMemory(key, config.windowMs, config.maxRequests);

      if (!result.allowed) {
        return NextResponse.json({
          success: false,
          error: 'Rate limit exceeded',
          code: 'RATE_LIMITED',
          message: `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
          limit: config.maxRequests,
          window: `${config.windowMs / 1000}s`,
          retryAfter: result.retryAfter,
        }, {
          status: 429,
          headers: {
            'Retry-After': result.retryAfter.toString(),
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(Date.now() + result.retryAfter * 1000).toISOString(),
          }
        });
      }

      return null; // Allow request
    }

    // Use Redis-based rate limiting (production)
    try {
      const redis = await getRedisClient();
      const now = Date.now();
      const windowStart = now - config.windowMs;
      
      // Use Redis sorted set for sliding window
      const multi = redis.multi();
      
      // Remove old entries outside the window
      multi.zRemRangeByScore(key, 0, windowStart);
      
      // Count requests in current window
      multi.zCard(key);
      
      // Add current request
      multi.zAdd(key, { score: now, value: `${now}` });
      
      // Set expiry on key
      multi.expire(key, Math.ceil(config.windowMs / 1000));
      
      const results = await multi.exec();
      const count = (results?.[1] as number) || 0;
      
      // Check if rate limit exceeded
      if (count >= config.maxRequests) {
        const oldestEntry = await redis.zRange(key, 0, 0);
        const resetTime = oldestEntry.length > 0 
          ? parseInt(oldestEntry[0]) + config.windowMs 
          : now + config.windowMs;
        const retryAfter = Math.ceil((resetTime - now) / 1000);
        
        return NextResponse.json(
          {
            code: 'RATE_LIMITED',
            error: 'Rate limit exceeded',
            message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
            limit: config.maxRequests,
            window: `${config.windowMs / 1000}s`,
            retryAfter,
          },
          {
            status: 429,
            headers: {
              'Retry-After': retryAfter.toString(),
              'X-RateLimit-Limit': config.maxRequests.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': new Date(resetTime).toISOString(),
            },
          }
        );
      }
      
      // Add rate limit headers to successful response
      const remaining = config.maxRequests - count - 1;
      const resetTime = now + config.windowMs;
      
      // Return null to continue processing, headers will be added by response interceptor
      req.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
      req.headers.set('X-RateLimit-Remaining', remaining.toString());
      req.headers.set('X-RateLimit-Reset', new Date(resetTime).toISOString());
      
      return null;
    } catch (error) {
      console.error('Rate limiter error:', error);
      // Fail open - allow request if rate limiter fails
      return null;
    }
  };
}

/**
 * Get client IP from request
 */
function getClientIP(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIP = req.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  return 'unknown';
}

/**
 * Get user ID from request (for authenticated endpoints)
 */
function getUserID(req: NextRequest): string {
  // PRIORITY 1: Test isolation - use X-Test-Run-ID for per-test rate limiting
  const testRunId = req.headers.get('x-test-run-id');
  if (testRunId) {
    return testRunId;
  }

  // PRIORITY 2: Try to get from header
  const userIdHeader = req.headers.get('x-user-id');
  if (userIdHeader) {
    return userIdHeader;
  }

  // PRIORITY 3: Try to get from query params
  const url = new URL(req.url);
  const userIdParam = url.searchParams.get('capper_id') || url.searchParams.get('user_id');
  if (userIdParam) {
    return userIdParam;
  }

  // PRIORITY 4: Fallback to IP
  return getClientIP(req);
}

/**
 * Rate limiter for read endpoints (GET /players/search, /games/resolve)
 * 300 requests per minute per IP
 */
export const readRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: parseInt(process.env.RATE_LIMIT_READ_RPM || '300'),
  keyPrefix: process.env.RATE_LIMIT_REDIS_PREFIX || 'smartform',
  identifier: getClientIP,
});

/**
 * Rate limiter for write endpoints (POST /api/picks)
 * 60 requests per minute per user
 */
export const writeRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: parseInt(process.env.RATE_LIMIT_WRITE_RPM || '60'),
  keyPrefix: `${process.env.RATE_LIMIT_REDIS_PREFIX || 'smartform'}:write`,
  identifier: getUserID,
});

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders<T = any>(
  response: NextResponse<T>,
  req: NextRequest
): NextResponse<T> {
  const limit = req.headers.get('X-RateLimit-Limit');
  const remaining = req.headers.get('X-RateLimit-Remaining');
  const reset = req.headers.get('X-RateLimit-Reset');
  
  if (limit) response.headers.set('X-RateLimit-Limit', limit);
  if (remaining) response.headers.set('X-RateLimit-Remaining', remaining);
  if (reset) response.headers.set('X-RateLimit-Reset', reset);
  
  return response;
}

