/**
 * Cache Headers Middleware for Smart Form
 * Date: 2025-10-25
 * 
 * Implements cache-friendly headers for API endpoints:
 * - Cache-Control: public, max-age=60, s-maxage=600, stale-while-revalidate=120
 * - Surrogate-Control: 600 (for CDN)
 */

import { NextResponse } from 'next/server';

export interface CacheConfig {
  maxAge?: number;           // Browser cache TTL (seconds)
  sMaxAge?: number;          // CDN cache TTL (seconds)
  staleWhileRevalidate?: number; // Stale-while-revalidate window (seconds)
  surrogateControl?: number; // CDN-specific cache control (seconds)
  public?: boolean;          // Public vs private cache
  mustRevalidate?: boolean;  // Force revalidation
}

/**
 * Default cache configurations for different endpoint types
 */
export const CACHE_CONFIGS = {
  // Read endpoints: /players/search, /games/resolve
  read: {
    maxAge: 60,                    // 1 minute browser cache
    sMaxAge: 600,                  // 10 minutes CDN cache
    staleWhileRevalidate: 120,     // 2 minutes stale-while-revalidate
    surrogateControl: 600,         // 10 minutes CDN
    public: true,
  } as CacheConfig,
  
  // Props endpoints: /api/props
  props: {
    maxAge: 300,                   // 5 minutes browser cache
    sMaxAge: 600,                  // 10 minutes CDN cache
    staleWhileRevalidate: 900,     // 15 minutes stale-while-revalidate
    surrogateControl: 600,         // 10 minutes CDN
    public: true,
  } as CacheConfig,
  
  // No cache for write endpoints
  write: {
    maxAge: 0,
    sMaxAge: 0,
    public: false,
    mustRevalidate: true,
  } as CacheConfig,
  
  // No cache for authenticated endpoints
  private: {
    maxAge: 0,
    sMaxAge: 0,
    public: false,
    mustRevalidate: true,
  } as CacheConfig,
};

/**
 * Build Cache-Control header value from config
 */
function buildCacheControlHeader(config: CacheConfig): string {
  const parts: string[] = [];
  
  if (config.public) {
    parts.push('public');
  } else {
    parts.push('private');
  }
  
  if (config.maxAge !== undefined) {
    parts.push(`max-age=${config.maxAge}`);
  }
  
  if (config.sMaxAge !== undefined) {
    parts.push(`s-maxage=${config.sMaxAge}`);
  }
  
  if (config.staleWhileRevalidate !== undefined) {
    parts.push(`stale-while-revalidate=${config.staleWhileRevalidate}`);
  }
  
  if (config.mustRevalidate) {
    parts.push('must-revalidate');
  }
  
  return parts.join(', ');
}

/**
 * Add cache headers to response
 */
export function addCacheHeaders<T = any>(
  response: NextResponse<T>,
  config: CacheConfig = CACHE_CONFIGS.read
): NextResponse<T> {
  // Skip caching if disabled
  if (process.env.CACHE_ENABLED === 'false') {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return response;
  }
  
  // Add Cache-Control header
  const cacheControl = buildCacheControlHeader(config);
  response.headers.set('Cache-Control', cacheControl);
  
  // Add Surrogate-Control for CDN
  if (config.surrogateControl !== undefined) {
    response.headers.set('Surrogate-Control', `max-age=${config.surrogateControl}`);
  }
  
  // Add Vary header for proper cache key generation
  response.headers.set('Vary', 'Accept-Encoding, Accept');
  
  // Add ETag for conditional requests (if not already present)
  if (!response.headers.has('ETag')) {
    const etag = generateETag(response);
    if (etag) {
      response.headers.set('ETag', etag);
    }
  }
  
  return response;
}

/**
 * Generate ETag from response body
 */
function generateETag(response: NextResponse): string | null {
  try {
    // Simple hash-based ETag generation
    // In production, use a proper hashing algorithm
    const body = JSON.stringify(response);
    const hash = simpleHash(body);
    return `"${hash}"`;
  } catch {
    return null;
  }
}

/**
 * Simple hash function for ETag generation
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Check if request has valid cache
 */
export function checkCacheValidation(
  request: Request,
  etag: string
): boolean {
  const ifNoneMatch = request.headers.get('If-None-Match');
  return ifNoneMatch === etag;
}

/**
 * Create 304 Not Modified response
 */
export function createNotModifiedResponse(): NextResponse {
  return new NextResponse(null, {
    status: 304,
    headers: {
      'Cache-Control': 'public, max-age=60',
    },
  });
}

/**
 * Middleware to add cache headers based on route
 */
export function applyCacheHeaders(
  response: NextResponse,
  pathname: string
): NextResponse {
  // Determine cache config based on route
  let config: CacheConfig;
  
  if (pathname.includes('/api/players') || pathname.includes('/api/games')) {
    config = CACHE_CONFIGS.read;
  } else if (pathname.includes('/api/props')) {
    config = CACHE_CONFIGS.props;
  } else if (pathname.includes('/api/submit-ticket')) {
    config = CACHE_CONFIGS.write;
  } else {
    config = CACHE_CONFIGS.private;
  }
  
  return addCacheHeaders(response, config);
}

