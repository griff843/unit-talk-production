"use strict";
/**
 * Security Module - Production Ready (Final Working Version)
 * Core security utilities for Unit Talk SaaS
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.corsOptions = exports.securityHeaders = exports.rateLimitMiddleware = exports.apiLimiter = exports.authLimiter = exports.generalLimiter = exports.EncryptionUtils = exports.SecurityEventLogger = exports.requireRole = exports.authenticateToken = exports.TokenManager = exports.InputValidator = void 0;
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logging_1 = require("../services/logging");
const supabaseClient_1 = require("../services/supabaseClient");
// Environment variables with proper validation and type safety
const ALLOW_DEV = process.env['ALLOW_DEV_UNCONFIGURED'] === 'true' || process.env['NODE_ENV'] === 'development';
const DEV_JWT_FALLBACK = 'dev-insecure-jwt-secret';
const DEV_ENCRYPTION_KEY_FALLBACK = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'; // 64 hex
const JWT_SECRET = process.env['JWT_SECRET'] || (ALLOW_DEV ? DEV_JWT_FALLBACK : undefined);
const SUPABASE_URL = process.env['SUPABASE_URL'] || (ALLOW_DEV ? '' : undefined);
const ENCRYPTION_KEY = process.env['ENCRYPTION_KEY'] || (ALLOW_DEV ? DEV_ENCRYPTION_KEY_FALLBACK : undefined);
if (!JWT_SECRET && !ALLOW_DEV) {
    throw new Error('JWT_SECRET environment variable is required');
}
if (!SUPABASE_URL && !ALLOW_DEV) {
    throw new Error('SUPABASE_URL environment variable is required');
}
if (!ENCRYPTION_KEY && !ALLOW_DEV) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
}
// Input validation and sanitization
class InputValidator {
    static sanitizeString(input) {
        if (typeof input !== 'string') {
            return '';
        }
        return input
            .trim()
            .replace(/[<>]/g, '') // Remove potential HTML tags
            .replace(/['"]/g, '') // Remove quotes
            .substring(0, 1000); // Limit length
    }
    static validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email) && email.length <= 254;
    }
    static validatePassword(password) {
        const errors = [];
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
    static validateUserId(userId) {
        // UUID v4 format validation
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(userId);
    }
    static sanitizeObject(obj) {
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                sanitized[key] = this.sanitizeString(value);
            }
            else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeObject(value);
            }
            else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }
}
exports.InputValidator = InputValidator;
// JWT token management
class TokenManager {
    static generateToken(payload, expiresIn = '24h') {
        return jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: expiresIn });
    }
    static verifyToken(token) {
        try {
            return jsonwebtoken_1.default.verify(token, JWT_SECRET);
        }
        catch (error) {
            logging_1.logger.warn('Token verification failed', { err: error.message });
            return null;
        }
    }
    static refreshToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET, { ignoreExpiration: true });
            // Check if token is not too old (max 7 days)
            const tokenAge = Date.now() - (decoded.iat * 1000);
            if (tokenAge > 7 * 24 * 60 * 60 * 1000) {
                return null;
            }
            // Generate new token with same payload
            const { iat, exp, ...payload } = decoded;
            return this.generateToken(payload);
        }
        catch (error) {
            logging_1.logger.warn('Token refresh failed', { err: error.message });
            return null;
        }
    }
}
exports.TokenManager = TokenManager;
// Authentication middleware
const authenticateToken = async (req, res, next) => {
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
        const { data: user, error } = await supabaseClient_1.supabase
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
    }
    catch (error) {
        logging_1.logger.error('Authentication error', error);
        res.status(500).json({ err: 'Authentication failed' });
        return;
    }
};
exports.authenticateToken = authenticateToken;
// Authorization middleware
const requireRole = (requiredRoles) => {
    return (req, res, next) => {
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
exports.requireRole = requireRole;
// Security event logging
class SecurityEventLogger {
    static async logEvent(event) {
        try {
            // Log to application logs
            logging_1.logger.warn('Security event', event);
            // Store in database for audit trail
            const { error } = await supabaseClient_1.supabase
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
                logging_1.logger.error('Failed to store security event', error);
            }
        }
        catch (error) {
            logging_1.logger.error('Security event logging failed', error);
        }
    }
    static async getRecentEvents(limit = 100) {
        try {
            const { data, error } = await supabaseClient_1.supabase
                .from('security_events')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);
            if (error) {
                logging_1.logger.error('Failed to fetch security events', error);
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
        }
        catch (error) {
            logging_1.logger.error('Failed to fetch security events', error);
            return [];
        }
    }
}
exports.SecurityEventLogger = SecurityEventLogger;
// Encryption utilities
class EncryptionUtils {
    static encrypt(text) {
        try {
            const key = Buffer.from(ENCRYPTION_KEY, 'hex');
            const iv = crypto_1.default.randomBytes(16);
            const cipher = crypto_1.default.createCipheriv('aes-256-cbc', key, iv);
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            return iv.toString('hex') + ':' + encrypted;
        }
        catch (error) {
            logging_1.logger.error('Encryption failed', error);
            throw new Error('Encryption failed');
        }
    }
    static decrypt(encryptedText) {
        try {
            const parts = encryptedText.split(':');
            if (parts.length !== 2) {
                throw new Error('Invalid encrypted text format');
            }
            const key = Buffer.from(ENCRYPTION_KEY, 'hex');
            const iv = Buffer.from(parts[0], 'hex');
            const encrypted = parts[1];
            const decipher = crypto_1.default.createDecipheriv('aes-256-cbc', key, iv);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        }
        catch (error) {
            logging_1.logger.error('Decryption failed', error);
            throw new Error('Decryption failed');
        }
    }
    static hashPassword(password) {
        const salt = crypto_1.default.randomBytes(16).toString('hex');
        const hash = crypto_1.default.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
        return salt + ':' + hash;
    }
    static verifyPassword(password, hashedPassword) {
        try {
            const parts = hashedPassword.split(':');
            if (parts.length !== 2) {
                return false;
            }
            const salt = parts[0];
            const hash = parts[1];
            const verifyHash = crypto_1.default.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
            return hash === verifyHash;
        }
        catch (error) {
            logging_1.logger.error('Password verification failed', error);
            return false;
        }
    }
}
exports.EncryptionUtils = EncryptionUtils;
// Simple rate limiting (in-memory)
class SimpleRateLimit {
    constructor(windowMs, maxRequests) {
        this.requests = new Map();
        this.windowMs = windowMs;
        this.maxRequests = maxRequests;
    }
    isAllowed(identifier) {
        const now = Date.now();
        const windowStart = now - this.windowMs;
        if (!this.requests.has(identifier)) {
            this.requests.set(identifier, []);
        }
        const userRequests = this.requests.get(identifier);
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
exports.generalLimiter = new SimpleRateLimit(15 * 60 * 1000, 1000); // 1000 requests per 15 minutes
exports.authLimiter = new SimpleRateLimit(15 * 60 * 1000, 10); // 10 auth requests per 15 minutes
exports.apiLimiter = new SimpleRateLimit(60 * 1000, 100); // 100 API requests per minute
// Rate limiting middleware
const rateLimitMiddleware = (limiter) => {
    return (req, res, next) => {
        const identifier = req.ip || req.connection.remoteAddress || 'unknown';
        if (!limiter.isAllowed(identifier)) {
            res.status(429).json({ error: 'Too many requests, please try again later.' });
            return;
        }
        next();
    };
};
exports.rateLimitMiddleware = rateLimitMiddleware;
// Security headers middleware
const securityHeaders = (_req, res, next) => {
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
exports.securityHeaders = securityHeaders;
// CORS configuration
exports.corsOptions = {
    origin: (origin, callback) => {
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'https://unittalk.app',
            'https://staging.unittalk.app'
        ];
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
};
exports.default = {
    InputValidator,
    TokenManager,
    SecurityEventLogger,
    EncryptionUtils,
    authenticateToken: exports.authenticateToken,
    requireRole: exports.requireRole,
    securityHeaders: exports.securityHeaders,
    generalLimiter: exports.generalLimiter,
    authLimiter: exports.authLimiter,
    apiLimiter: exports.apiLimiter,
    rateLimitMiddleware: exports.rateLimitMiddleware,
    corsOptions: exports.corsOptions
};
