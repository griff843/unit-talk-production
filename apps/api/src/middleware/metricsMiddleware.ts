import { Request, Response, NextFunction } from 'express';
import {
  httpRequestsTotal,
  httpRequestDuration,
  httpRequestSize,
  httpResponseSize,
  activeConnections,
} from '../services/metricsServer';

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
export function metricsMiddleware() {
  let currentActiveConnections = 0;

  return (req: MetricsRequest, res: MetricsResponse, next: NextFunction) => {
    // Track active connections
    currentActiveConnections++;
    activeConnections.set(currentActiveConnections);

    // Start timer for request duration
    const startTime = Date.now();
    req.startTime = startTime;

    // Extract route pattern for consistent labeling
    const route = extractRoutePattern(req.path);
    const method = req.method;

    // Track request size
    const requestSize = req.headers['content-length'] 
      ? parseInt(req.headers['content-length'], 10) 
      : 0;
    
    if (requestSize > 0) {
      httpRequestSize.observe({ method, route }, requestSize);
    }

    // Hook into response to capture metrics when request completes
    const originalSend = res.send;
    res.send = function(data: any) {
      // Calculate duration
      const duration = (Date.now() - startTime) / 1000;
      const statusCode = res.statusCode.toString();

      // Track HTTP metrics
      httpRequestsTotal.inc({ method, route, status_code: statusCode });
      httpRequestDuration.observe(
        { method, route, status_code: statusCode },
        duration
      );

      // Track response size
      const responseSize = typeof data === 'string' 
        ? Buffer.byteLength(data, 'utf8') 
        : JSON.stringify(data).length;
      
      httpResponseSize.observe(
        { method, route, status_code: statusCode },
        responseSize
      );

      // Decrement active connections
      currentActiveConnections--;
      activeConnections.set(currentActiveConnections);

      return originalSend.call(this, data);
    };

    // Handle connection close/error events
    req.on('close', () => {
      currentActiveConnections--;
      activeConnections.set(Math.max(0, currentActiveConnections));
    });

    req.on('error', () => {
      currentActiveConnections--;
      activeConnections.set(Math.max(0, currentActiveConnections));
    });

    next();
  };
}

/**
 * Extract consistent route patterns for metric labeling
 * Converts dynamic routes to patterns for better aggregation
 */
function extractRoutePattern(path: string): string {
  // Handle common API patterns
  const patterns = [
    // Health endpoints
    { pattern: /^\/health(\/.*)?$/, replacement: '/health' },
    { pattern: /^\/api\/health(\/.*)?$/, replacement: '/api/health' },
    
    // API endpoints with IDs
    { pattern: /^\/api\/picks\/\d+$/, replacement: '/api/picks/:id' },
    { pattern: /^\/api\/users\/[^\/]+$/, replacement: '/api/users/:id' },
    { pattern: /^\/api\/features\/[^\/]+$/, replacement: '/api/features/:id' },
    
    // Smart form endpoints
    { pattern: /^\/api\/smart-form\/process$/, replacement: '/api/smart-form/process' },
    { pattern: /^\/api\/smart-form\/health$/, replacement: '/api/smart-form/health' },
    
    // Operations endpoints
    { pattern: /^\/ops\/status\/[^\/]+$/, replacement: '/ops/status/:runId' },
    { pattern: /^\/ops\/.*$/, replacement: '/ops' },
    
    // Admin endpoints
    { pattern: /^\/admin\/.*$/, replacement: '/admin' },
    
    // Provider health
    { pattern: /^\/health\/provider$/, replacement: '/health/provider' },
  ];

  // Apply pattern matching
  for (const { pattern, replacement } of patterns) {
    if (pattern.test(path)) {
      return replacement;
    }
  }

  // Default: return path as-is for unmatched patterns
  return path === '/' ? '/' : path;
}

/**
 * Advanced request classifier for more granular metrics
 */
export function classifyRequest(req: Request): {
  route: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
} {
  const path = req.path;
  const method = req.method;

  // Health checks - high priority for monitoring
  if (path.includes('/health')) {
    return { route: extractRoutePattern(path), category: 'health', priority: 'high' };
  }

  // API endpoints - medium priority
  if (path.startsWith('/api/')) {
    return { route: extractRoutePattern(path), category: 'api', priority: 'medium' };
  }

  // Operations endpoints - high priority
  if (path.startsWith('/ops/')) {
    return { route: extractRoutePattern(path), category: 'operations', priority: 'high' };
  }

  // Admin endpoints - high priority
  if (path.startsWith('/admin/')) {
    return { route: extractRoutePattern(path), category: 'admin', priority: 'high' };
  }

  // Static assets - low priority
  if (path.includes('.js') || path.includes('.css') || path.includes('.ico')) {
    return { route: '/static', category: 'static', priority: 'low' };
  }

  // Default
  return { route: extractRoutePattern(path), category: 'general', priority: 'medium' };
}

/**
 * Error metrics middleware to track error rates
 */
export function errorMetricsMiddleware() {
  return (error: Error, req: MetricsRequest, res: MetricsResponse, next: NextFunction) => {
    const route = extractRoutePattern(req.path);
    const method = req.method;
    const statusCode = res.statusCode || 500;

    // Track error in metrics
    httpRequestsTotal.inc({ 
      method, 
      route, 
      status_code: statusCode.toString() 
    });

    // Track error duration if start time is available
    if (req.startTime) {
      const duration = (Date.now() - req.startTime) / 1000;
      httpRequestDuration.observe(
        { method, route, status_code: statusCode.toString() },
        duration
      );
    }

    next(error);
  };
}