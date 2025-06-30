/**
 * Security Module - Production Ready (Final Working Version)
 * Core security utilities for Unit Talk SaaS
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { supabase } from '../services/supabaseClient.js';
import { logger } from '../services/logging.js';

// Environment variables with proper validation and type safety
const JWT_SECRET = process.env['JWT_SECRET'];
const SUPABASE_URL = process.env['SUPABASE_URL'];
const ENCRYPTION_KEY = process.env['ENCRYPTION_KEY'];

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

if (!SUPABASE_URL) {
  throw new Error('SUPABASE_URL environment variable is required');
}

if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is required');
}

// Types
interface User {
  id: string;
  email: string;
  role: string;
  status: string;
  display_name?: string;
}

interface SecurityEvent {
  type: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  details?: any;
  timestamp: string;
}

// Input validation and sanitization
export class InputValidator {
  static sanitizeString(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }
    
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/['"]/g, '') // Remove quotes
      .substring(0, 1000); // Limit length
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  static validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  static validateUserId(userId: string): boolean {
    // UUID v4 format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(userId);
  }

  static sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }
    
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
}

// JWT token management
export class TokenManager {
  static generateToken(payload: any, expiresIn: string = '24h'): string {
    return jwt.sign(payload, JWT_SECRET!, { expiresIn });
  }

  static verifyToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET!);
    } catch (error) {
      logger.warn('Token verification failed', { error: (error as Error).message });
      return null;
    }
  }

  static refreshToken(token: string): string | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET!, { ignoreExpiration: true }) as any;
      
      // Check if token is not too old (max 7 days)
      const tokenAge = Date.now() - (decoded.iat * 1000);
      if (tokenAge > 7 * 24 * 60 * 60 * 1000) {
        return null;
      }
      
      // Generate new token with same payload
      const { iat, exp, ...payload } = decoded;
      return this.generateToken(payload);
    } catch (error) {
      logger.warn('Token refresh failed', { error: (error as Error).message });
      return null;
    }
  }
}

// Authentication middleware
export const authenticateToken = async (req: any, res: any, next: any): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const decoded = TokenManager.verifyToken(token);
    if (!decoded) {
      res.status(403).json({ error: 'Invalid or expired token' });
      return;
    }

    // Verify user still exists and is active
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .eq('status', 'active')
      .single();

    if (error || !user) {
      res.status(403).json({ error: 'User not found or inactive' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error', error);
    res.status(500).json({ error: 'Authentication failed' });
    return;
  }
};

// Authorization middleware
export const requireRole = (requiredRoles: string[]) => {
  return (req: any, res: any, next: any): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!requiredRoles.includes(req.user.role)) {
      SecurityEventLogger.logEvent({
        type: 'unauthorized_access_attempt',
        userId: req.user.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        details: { requiredRoles, userRole: req.user.role },
        timestamp: new Date().toISOString()
      });

      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};

// Security event logging
export class SecurityEventLogger {
  static async logEvent(event: SecurityEvent): Promise<void> {
    try {
      // Log to application logs
      logger.warn('Security event', event);

      // Store in database for audit trail
      const { error } = await supabase
        .from('security_events')
        .insert([{
          event_type: event.type,
          user_id: event.userId,
          ip_address: event.ip,
          user_agent: event.userAgent,
          details: event.details,
          created_at: event.timestamp
        }]);

      if (error) {
        logger.error('Failed to store security event', error);
      }
    } catch (error) {
      logger.error('Security event logging failed', error);
    }
  }

  static async getRecentEvents(limit: number = 100): Promise<SecurityEvent[]> {
    try {
      const { data, error } = await supabase
        .from('security_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Failed to fetch security events', error);
        return [];
      }

      return data.map(event => ({
        type: event.event_type,
        userId: event.user_id,
        ip: event.ip_address,
        userAgent: event.user_agent,
        details: event.details,
        timestamp: event.created_at
      }));
    } catch (error) {
      logger.error('Failed to fetch security events', error);
      return [];
    }
  }
}

// Encryption utilities
export class EncryptionUtils {
  static encrypt(text: string): string {
    try {
      const key = Buffer.from(ENCRYPTION_KEY!, 'hex');
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      logger.error('Encryption failed', error);
      throw new Error('Encryption failed');
    }
  }

  static decrypt(encryptedText: string): string {
    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted text format');
      }

      const key = Buffer.from(ENCRYPTION_KEY!, 'hex');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];

      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('Decryption failed', error);
      throw new Error('Decryption failed');
    }
  }

  static hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return salt + ':' + hash;
  }

  static verifyPassword(password: string, hashedPassword: string): boolean {
    try {
      const parts = hashedPassword.split(':');
      if (parts.length !== 2) {
        return false;
      }

      const salt = parts[0];
      const hash = parts[1];
      const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');

      return hash === verifyHash;
    } catch (error) {
      logger.error('Password verification failed', error);
      return false;
    }
  }
}

// Simple rate limiting (in-memory)
class SimpleRateLimit {
  private requests: Map<string, number[]> = new Map();
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    if (!this.requests.has(identifier)) {
      this.requests.set(identifier, []);
    }
    
    const userRequests = this.requests.get(identifier)!;
    
    // Remove old requests
    const validRequests = userRequests.filter(time => time > windowStart);
    this.requests.set(identifier, validRequests);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    validRequests.push(now);
    return true;
  }
}

// Rate limiters
export const generalLimiter = new SimpleRateLimit(15 * 60 * 1000, 1000); // 1000 requests per 15 minutes
export const authLimiter = new SimpleRateLimit(15 * 60 * 1000, 10); // 10 auth requests per 15 minutes
export const apiLimiter = new SimpleRateLimit(60 * 1000, 100); // 100 API requests per minute

// Rate limiting middleware
export const rateLimitMiddleware = (limiter: SimpleRateLimit) => {
  return (req: any, res: any, next: any): void => {
    const identifier = req.ip || req.connection.remoteAddress || 'unknown';
    
    if (!limiter.isAllowed(identifier)) {
      res.status(429).json({ error: 'Too many requests, please try again later.' });
      return;
    }
    
    next();
  };
};

// Security headers middleware
export const securityHeaders = (req: any, res: any, next: any): void => {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  next();
};

// CORS configuration
export const corsOptions = {
  origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://unittalk.app',
      'https://staging.unittalk.app'
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

export default {
  InputValidator,
  TokenManager,
  SecurityEventLogger,
  EncryptionUtils,
  authenticateToken,
  requireRole,
  securityHeaders,
  generalLimiter,
  authLimiter,
  apiLimiter,
  rateLimitMiddleware,
  corsOptions
};