import { NextRequest, NextResponse } from 'next/server';

import { supabase } from '@/lib/supabase';

// Using 'any' cast to avoid type mismatch with security_events table
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dbClient = supabase as any;

/**
 * Security Middleware
 * Provides rate limiting, input validation, and security hardening
 */

interface RateLimitConfig {
  requests: number;
  window: number; // in seconds
  skipFailedRequests?: boolean;
  skipSuccessfulRequests?: boolean;
}

interface ValidationRule {
  field: string;
  type: 'string' | 'number' | 'boolean' | 'email' | 'uuid' | 'array' | 'object';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
}

// Rate limiting configurations for different endpoints
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  '/api/auth/login': { requests: 5, window: 300 }, // 5 attempts per 5 minutes
  '/api/auth/register': { requests: 3, window: 3600 }, // 3 attempts per hour
  '/api/users': { requests: 100, window: 60 }, // 100 requests per minute
  '/api/agents': { requests: 200, window: 60 }, // 200 requests per minute
  '/api/system': { requests: 10, window: 60 }, // 10 requests per minute (more restrictive)
  '/api/audit': { requests: 50, window: 60 }, // 50 requests per minute
  default: { requests: 60, window: 60 }, // Default: 60 requests per minute
};

// In-memory rate limit store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Rate limiting middleware
 */
export async function rateLimit(
  request: NextRequest,
  customConfig?: RateLimitConfig
): Promise<NextResponse | null> {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const clientIP = getClientIP(request);

    // Get rate limit configuration
    const config = customConfig || RATE_LIMITS[pathname] || RATE_LIMITS.default;

    const key = `rate_limit:${clientIP}:${pathname}`;
    const now = Date.now();
    const windowMs = config.window * 1000;

    // Get current rate limit data
    const current = rateLimitStore.get(key);

    if (!current || now > current.resetTime) {
      // First request or window expired
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });

      return null; // Allow request
    }

    if (current.count >= config.requests) {
      // Rate limit exceeded
      console.log(`🚫 Rate limit exceeded for ${clientIP} on ${pathname}`);

      // Log rate limiting event
      await logSecurityEvent({
        type: 'rate_limit_exceeded',
        severity: 'medium',
        source_ip: clientIP,
        endpoint: pathname,
        details: {
          requests: current.count,
          limit: config.requests,
          window: config.window,
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          retry_after: Math.ceil((current.resetTime - now) / 1000),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': config.requests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil(current.resetTime / 1000).toString(),
            'Retry-After': Math.ceil((current.resetTime - now) / 1000).toString(),
          },
        }
      );
    }

    // Increment counter
    current.count++;
    rateLimitStore.set(key, current);

    return null; // Allow request
  } catch (error) {
    console.error('❌ Rate limiting error:', error);
    return null; // Allow request on error
  }
}

/**
 * Input validation middleware
 */
export function validateInput(rules: ValidationRule[]) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    try {
      let body: any = {};

      // Parse request body if it exists
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        const contentType = request.headers.get('content-type');

        if (contentType?.includes('application/json')) {
          try {
            body = await request.json();
          } catch {
            return NextResponse.json(
              {
                success: false,
                error: 'Invalid JSON in request body',
                code: 'INVALID_JSON',
              },
              { status: 400 }
            );
          }
        }
      }

      // Validate each rule
      const errors: string[] = [];

      for (const rule of rules) {
        const value = body[rule.field];
        const error = validateField(rule, value);

        if (error) {
          errors.push(error);
        }
      }

      if (errors.length > 0) {
        await logSecurityEvent({
          type: 'validation_failure',
          severity: 'low',
          source_ip: getClientIP(request),
          endpoint: new URL(request.url).pathname,
          details: {
            validation_errors: errors,
            request_body: sanitizeForLogging(body),
          },
        });

        return NextResponse.json(
          {
            success: false,
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: errors,
          },
          { status: 400 }
        );
      }

      return null; // Validation passed
    } catch (error) {
      console.error('❌ Input validation error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          code: 'VALIDATION_SYSTEM_ERROR',
        },
        { status: 500 }
      );
    }
  };
}

/**
 * Security headers middleware
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // HSTS (only in production with HTTPS)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // CSP (Content Security Policy)
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' wss: ws:",
    "frame-ancestors 'none'",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);

  return response;
}

/**
 * Request sanitization middleware
 */
export function sanitizeRequest(request: NextRequest): NextRequest {
  // In a real implementation, this would sanitize various parts of the request
  // For now, we'll add some basic security checks

  const userAgent = request.headers.get('user-agent');
  const xForwardedFor = request.headers.get('x-forwarded-for');

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /sqlmap/i,
    /nmap/i,
    /<script/i,
    /javascript:/i,
    /vbscript:/i,
    /onload=/i,
    /onerror=/i,
  ];

  const requestInfo = `${userAgent} ${xForwardedFor}`;

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestInfo)) {
      logSecurityEvent({
        type: 'suspicious_request',
        severity: 'high',
        source_ip: getClientIP(request),
        endpoint: new URL(request.url).pathname,
        details: {
          user_agent: userAgent,
          x_forwarded_for: xForwardedFor,
          matched_pattern: pattern.source,
        },
      });
      break;
    }
  }

  return request;
}

/**
 * Combined security middleware wrapper
 */
export function withSecurity(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options: {
    rateLimit?: RateLimitConfig;
    validation?: ValidationRule[];
    skipRateLimit?: boolean;
    skipValidation?: boolean;
  } = {}
) {
  return async (request: NextRequest) => {
    try {
      // Sanitize request
      const sanitizedRequest = sanitizeRequest(request);

      // Apply rate limiting
      if (!options.skipRateLimit) {
        const rateLimitResponse = await rateLimit(sanitizedRequest, options.rateLimit);
        if (rateLimitResponse) {
          return addSecurityHeaders(rateLimitResponse);
        }
      }

      // Apply input validation
      if (!options.skipValidation && options.validation) {
        const validationResponse = await validateInput(options.validation)(sanitizedRequest);
        if (validationResponse) {
          return addSecurityHeaders(validationResponse);
        }
      }

      // Call the actual handler
      const response = await handler(sanitizedRequest);

      // Add security headers to response
      return addSecurityHeaders(response);
    } catch (error) {
      console.error('❌ Security middleware error:', error);

      const errorResponse = NextResponse.json(
        {
          success: false,
          error: 'Security middleware error',
          code: 'SECURITY_ERROR',
        },
        { status: 500 }
      );

      return addSecurityHeaders(errorResponse);
    }
  };
}

// Helper functions
function validateField(rule: ValidationRule, value: any): string | null {
  // Check if required field is missing
  if (rule.required && (value === undefined || value === null || value === '')) {
    return `Field '${rule.field}' is required`;
  }

  // Skip validation if field is not provided and not required
  if (!rule.required && (value === undefined || value === null)) {
    return null;
  }

  // Type validation
  switch (rule.type) {
    case 'string':
      if (typeof value !== 'string') {
        return `Field '${rule.field}' must be a string`;
      }
      if (rule.minLength && value.length < rule.minLength) {
        return `Field '${rule.field}' must be at least ${rule.minLength} characters`;
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        return `Field '${rule.field}' must be at most ${rule.maxLength} characters`;
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        return `Field '${rule.field}' format is invalid`;
      }
      break;

    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        return `Field '${rule.field}' must be a valid number`;
      }
      if (rule.min !== undefined && value < rule.min) {
        return `Field '${rule.field}' must be at least ${rule.min}`;
      }
      if (rule.max !== undefined && value > rule.max) {
        return `Field '${rule.field}' must be at most ${rule.max}`;
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        return `Field '${rule.field}' must be a boolean`;
      }
      break;

    case 'email':
      if (typeof value !== 'string') {
        return `Field '${rule.field}' must be a string`;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return `Field '${rule.field}' must be a valid email address`;
      }
      break;

    case 'uuid':
      if (typeof value !== 'string') {
        return `Field '${rule.field}' must be a string`;
      }
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(value)) {
        return `Field '${rule.field}' must be a valid UUID`;
      }
      break;

    case 'array':
      if (!Array.isArray(value)) {
        return `Field '${rule.field}' must be an array`;
      }
      if (rule.minLength && value.length < rule.minLength) {
        return `Field '${rule.field}' must have at least ${rule.minLength} items`;
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        return `Field '${rule.field}' must have at most ${rule.maxLength} items`;
      }
      break;

    case 'object':
      if (typeof value !== 'object' || Array.isArray(value) || value === null) {
        return `Field '${rule.field}' must be an object`;
      }
      break;
  }

  // Custom validation
  if (rule.custom) {
    const customResult = rule.custom(value);
    if (typeof customResult === 'string') {
      return customResult;
    }
    if (customResult === false) {
      return `Field '${rule.field}' failed custom validation`;
    }
  }

  return null;
}

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    '127.0.0.1'
  );
}

async function logSecurityEvent(event: {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source_ip: string;
  endpoint: string;
  details: any;
}) {
  try {
    await dbClient.from('security_events').insert({
      type: event.type,
      severity: event.severity,
      source_ip: event.source_ip,
      endpoint: event.endpoint,
      details: event.details,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Failed to log security event:', error);
  }
}

function sanitizeForLogging(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
  const sanitized = { ...data };

  for (const [key, value] of Object.entries(sanitized)) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeForLogging(value);
    }
  }

  return sanitized;
}

// Cleanup rate limit store periodically (in production, use Redis expiration)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute
