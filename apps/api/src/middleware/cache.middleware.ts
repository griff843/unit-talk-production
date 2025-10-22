import { Request, Response, NextFunction } from 'express';
import { RedisCache } from '../services/cache/RedisCache';
import crypto from 'crypto';

interface CacheOptions {
  ttl?: number;
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request) => boolean;
  invalidatePattern?: string;
}

/**
 * Cache middleware factory
 */
export function cache(options: CacheOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Check if caching should be applied
    if (options.condition && !options.condition(req)) {
      return next();
    }

    // Skip caching for non-GET requests by default
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }

    const cache = (req as any).cache as RedisCache;
    if (!cache) {
      return next();
    }

    // Generate cache key
    const key = options.keyGenerator
      ? options.keyGenerator(req)
      : generateCacheKey(req);

    // Try to get from cache
    const cached = await cache.get<CachedResponse>(key);
    if (cached) {
      res.set(cached.headers);
      res.set('X-Cache', 'HIT');
      return res.status(cached.status).send(cached.body);
    }

    // Cache miss - capture response
    const originalSend = res.send;
    const originalJson = res.json;

    const captureResponse = (body: any) => {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const cachedResponse: CachedResponse = {
          status: res.statusCode,
          headers: res.getHeaders() as any,
          body: body,
          timestamp: new Date().toISOString(),
        };

        // Store in cache (fire and forget)
        cache.set(key, cachedResponse, options.ttl).catch((err) => {
          console.error('Cache storage error:', err);
        });
      }

      res.set('X-Cache', 'MISS');
      return body;
    };

    res.send = function(body: any) {
      captureResponse(body);
      return originalSend.call(this, body);
    };

    res.json = function(body: any) {
      captureResponse(body);
      return originalJson.call(this, body);
    };

    next();
  };
}

/**
 * Cache invalidation middleware
 */
export function invalidateCache(pattern: string | ((req: Request) => string)) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const cache = (req as any).cache as RedisCache;
    if (!cache) {
      return next();
    }

    const invalidatePattern = 
      typeof pattern === 'function' ? pattern(req) : pattern;

    await cache.invalidatePattern(invalidatePattern);
    next();
  };
}

/**
 * Generate cache key from request
 */
function generateCacheKey(req: Request): string {
  const { method, originalUrl, headers } = req;
  
  // Include important headers in cache key
  const relevantHeaders = {
    'accept': headers.accept,
    'accept-language': headers['accept-language'],
    'authorization': headers.authorization ? 'present' : 'absent',
  };

  const keyData = {
    method,
    url: originalUrl,
    headers: relevantHeaders,
  };

  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(keyData))
    .digest('hex');

  return `http:${hash}`;
}

/**
 * Cached response structure
 */
interface CachedResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
  timestamp: string;
}

/**
 * Cache strategies for different endpoints
 */
export const cacheStrategies = {
  // Static data - long TTL
  metadata: cache({
    ttl: 3600, // 1 hour
    keyGenerator: (req) => `metadata:${req.path}`,
  }),

  // Game schedules - medium TTL
  schedules: cache({
    ttl: 1800, // 30 minutes
    keyGenerator: (req) => `schedule:${req.path}:${req.query.date || 'today'}`,
  }),

  // Live odds - short TTL
  odds: cache({
    ttl: 300, // 5 minutes
    keyGenerator: (req) => `odds:${req.path}:${JSON.stringify(req.query)}`,
  }),

  // User-specific data - medium TTL with auth
  userProfile: cache({
    ttl: 600, // 10 minutes
    keyGenerator: (req) => `user:${req.user?.id}:profile`,
    condition: (req) => !!req.user,
  }),

  // Leaderboards - short TTL
  leaderboard: cache({
    ttl: 60, // 1 minute
    keyGenerator: (req) => `leaderboard:${req.query.type || 'overall'}`,
  }),
};