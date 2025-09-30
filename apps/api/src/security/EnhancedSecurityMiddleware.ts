/**
 * Enhanced Security Middleware
 * Adds rate limiting, request fingerprinting, and suspicious activity detection
 * Production-ready security enhancements for the Unit Talk Platform
 */

import { Request, Response, NextFunction } from 'express';
import { IntelligentCache } from '@unit-talk/shared-utils';
import { Logger } from '../utils/logger';

export interface SecurityConfig {
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
    maxRequestsPerUser: number;
    skipSuccessfulRequests: boolean;
  };
  suspiciousActivity: {
    maxFailedAttempts: number;
    lockoutDurationMs: number;
    monitoringWindowMs: number;
  };
  requestFingerprinting: {
    enabled: boolean;
    trackHeaders: string[];
    trackUserAgent: boolean;
  };
}

export interface RequestFingerprint {
  ip: string;
  userAgent: string;
  headers: Record<string, string>;
  timestamp: number;
  userId?: string;
}

export interface SecurityMetrics {
  totalRequests: number;
  blockedRequests: number;
  suspiciousRequests: number;
  rateLimitedRequests: number;
  uniqueFingerprints: number;
  failedAuthAttempts: number;
}

export class EnhancedSecurityMiddleware {
  private cache: IntelligentCache;
  private logger: Logger;
  private config: SecurityConfig;
  private metrics: SecurityMetrics;

  // Default security configuration
  private static readonly DEFAULT_CONFIG: SecurityConfig = {
    rateLimiting: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 1000,         // Max requests per window
      maxRequestsPerUser: 100,   // Max requests per user per window
      skipSuccessfulRequests: false
    },
    suspiciousActivity: {
      maxFailedAttempts: 5,
      lockoutDurationMs: 30 * 60 * 1000, // 30 minutes
      monitoringWindowMs: 60 * 60 * 1000  // 1 hour
    },
    requestFingerprinting: {
      enabled: true,
      trackHeaders: ['accept', 'accept-language', 'accept-encoding'],
      trackUserAgent: true
    }
  };

  constructor(config: Partial<SecurityConfig> = {}, logger: Logger) {
    this.config = { ...EnhancedSecurityMiddleware.DEFAULT_CONFIG, ...config };
    this.logger = logger;
    this.cache = new IntelligentCache(50000); // Large cache for security data
    this.metrics = {
      totalRequests: 0,
      blockedRequests: 0,
      suspiciousRequests: 0,
      rateLimitedRequests: 0,
      uniqueFingerprints: 0,
      failedAuthAttempts: 0
    };
  }

  /**
   * Main security middleware function
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      this.metrics.totalRequests++;

      // Allowlist critical health/metrics endpoints (no security gating)
      const allowlist = new Set<string>(['/api/health', '/api/health/ready', '/api/health/live', '/health', '/metrics']);
      if (allowlist.has(req.path)) {
        return next();
      }

      try {
        // 1. Generate request fingerprint
        const fingerprint = this.generateFingerprint(req);

        // 2. Check for suspicious activity
        if (await this.isSuspiciousActivity(fingerprint, req)) {
          this.metrics.suspiciousRequests++;
          this.logger.warn('🚨 Suspicious activity detected', {
            ip: fingerprint.ip,
            userAgent: fingerprint.userAgent,
            path: req.path,
            method: req.method
          });
          
          res.status(429).json({ 
            error: 'Too many requests. Please try again later.',
            retryAfter: Math.ceil(this.config.suspiciousActivity.lockoutDurationMs / 1000)
          });
          return;
        }
        
        // 3. Apply rate limiting
        if (await this.isRateLimited(fingerprint, req)) {
          this.metrics.rateLimitedRequests++;
          res.status(429).json({ 
            error: 'Rate limit exceeded. Please slow down.',
            retryAfter: Math.ceil(this.config.rateLimiting.windowMs / 1000)
          });
          return;
        }
        
        // 4. Track successful request
        await this.trackRequest(fingerprint, req);
        
        next();
      } catch (error) {
        this.logger.error('Security middleware error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          path: req.path
        });
        next(); // Don't block requests due to security middleware errors
      }
    };
  }

  /**
   * Generate request fingerprint for tracking
   */
  private generateFingerprint(req: Request): RequestFingerprint {
    const ip = this.getClientIP(req);
    const userAgent = req.get('User-Agent') || 'unknown';
    
    const headers: Record<string, string> = {};
    if (this.config.requestFingerprinting.enabled) {
      this.config.requestFingerprinting.trackHeaders.forEach(header => {
        const value = req.get(header);
        if (value) {
          headers[header] = value;
        }
      });
    }
    
    return {
      ip,
      userAgent: this.config.requestFingerprinting.trackUserAgent ? userAgent : 'masked',
      headers,
      timestamp: Date.now(),
      userId: (req as any).user?.id // If user is authenticated
    };
  }

  /**
   * Check for suspicious activity patterns
   */
  private async isSuspiciousActivity(fingerprint: RequestFingerprint, req: Request): Promise<boolean> {
    const key = `suspicious:${fingerprint.ip}`;
    const activity = this.cache.get(key) || { 
      failedAttempts: 0, 
      lastAttempt: 0,
      isLocked: false,
      lockUntil: 0
    };
    
    // Check if currently locked out
    if (activity.isLocked && Date.now() < activity.lockUntil) {
      return true;
    }
    
    // Reset lock if expired
    if (activity.isLocked && Date.now() >= activity.lockUntil) {
      activity.isLocked = false;
      activity.failedAttempts = 0;
    }
    
    // Check for rapid requests (potential bot behavior)
    const timeSinceLastRequest = Date.now() - activity.lastAttempt;
    if (timeSinceLastRequest < 100) { // Less than 100ms between requests
      activity.failedAttempts++;
    }
    
    // Check for suspicious patterns
    const isSuspicious = 
      activity.failedAttempts >= this.config.suspiciousActivity.maxFailedAttempts ||
      this.hasSuspiciousUserAgent(fingerprint.userAgent) ||
      this.hasSuspiciousPath(req.path);
    
    if (isSuspicious) {
      activity.isLocked = true;
      activity.lockUntil = Date.now() + this.config.suspiciousActivity.lockoutDurationMs;
    }
    
    activity.lastAttempt = Date.now();
    this.cache.set(key, activity, {
      ttl: this.config.suspiciousActivity.monitoringWindowMs,
      volatility: 'high',
      tags: ['security', 'suspicious-activity']
    });
    
    return isSuspicious;
  }

  /**
   * Check if request should be rate limited
   */
  private async isRateLimited(fingerprint: RequestFingerprint, req: Request): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - this.config.rateLimiting.windowMs;
    
    // Global rate limiting by IP
    const ipKey = `rate:ip:${fingerprint.ip}`;
    const ipRequests = this.cache.get(ipKey) || [];
    const recentIpRequests = ipRequests.filter((timestamp: number) => timestamp > windowStart);
    
    if (recentIpRequests.length >= this.config.rateLimiting.maxRequests) {
      return true;
    }
    
    // User-specific rate limiting (if authenticated)
    if (fingerprint.userId) {
      const userKey = `rate:user:${fingerprint.userId}`;
      const userRequests = this.cache.get(userKey) || [];
      const recentUserRequests = userRequests.filter((timestamp: number) => timestamp > windowStart);
      
      if (recentUserRequests.length >= this.config.rateLimiting.maxRequestsPerUser) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Track successful request for rate limiting
   */
  private async trackRequest(fingerprint: RequestFingerprint, req: Request): Promise<void> {
    const now = Date.now();
    
    // Track IP requests
    const ipKey = `rate:ip:${fingerprint.ip}`;
    const ipRequests = this.cache.get(ipKey) || [];
    ipRequests.push(now);
    this.cache.set(ipKey, ipRequests, {
      ttl: this.config.rateLimiting.windowMs,
      volatility: 'high',
      tags: ['security', 'rate-limiting']
    });
    
    // Track user requests (if authenticated)
    if (fingerprint.userId) {
      const userKey = `rate:user:${fingerprint.userId}`;
      const userRequests = this.cache.get(userKey) || [];
      userRequests.push(now);
      this.cache.set(userKey, userRequests, {
        ttl: this.config.rateLimiting.windowMs,
        volatility: 'high',
        tags: ['security', 'rate-limiting']
      });
    }
    
    // Track unique fingerprints
    const fingerprintKey = `fingerprint:${this.hashFingerprint(fingerprint)}`;
    if (!this.cache.get(fingerprintKey)) {
      this.metrics.uniqueFingerprints++;
      this.cache.set(fingerprintKey, true, {
        ttl: 24 * 60 * 60 * 1000, // 24 hours
        volatility: 'low',
        tags: ['security', 'fingerprints']
      });
    }
  }

  /**
   * Utility methods
   */
  private getClientIP(req: Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           'unknown';
  }

  private hasSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/i, /crawler/i, /spider/i, /scraper/i,
      /curl/i, /wget/i, /python/i, /java/i,
      /scanner/i, /test/i
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  private hasSuspiciousPath(path: string): boolean {
    const suspiciousPaths = [
      /\/admin/i, /\/config/i, /\/debug/i,
      /\.php$/i, /\.asp$/i, /\.jsp$/i,
      /\/wp-/i, /\/phpmyadmin/i
    ];
    
    return suspiciousPaths.some(pattern => pattern.test(path));
  }

  private hashFingerprint(fingerprint: RequestFingerprint): string {
    const data = JSON.stringify({
      ip: fingerprint.ip,
      userAgent: fingerprint.userAgent,
      headers: fingerprint.headers
    });
    
    // Simple hash function (in production, use crypto.createHash)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  /**
   * Get security metrics for monitoring
   */
  getMetrics(): SecurityMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset security metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      blockedRequests: 0,
      suspiciousRequests: 0,
      rateLimitedRequests: 0,
      uniqueFingerprints: 0,
      failedAuthAttempts: 0
    };
  }
}
