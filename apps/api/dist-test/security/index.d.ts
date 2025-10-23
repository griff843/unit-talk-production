/**
 * Security Module - Production Ready (Final Working Version)
 * Core security utilities for Unit Talk SaaS
 */
interface SecurityEvent {
    type: string;
    userId?: string;
    ip?: string;
    userAgent?: string;
    details?: any;
    timestamp: string;
}
export declare class InputValidator {
    static sanitizeString(input: string): string;
    static validateEmail(email: string): boolean;
    static validatePassword(password: string): {
        valid: boolean;
        errors: string[];
    };
    static validateUserId(userId: string): boolean;
    static sanitizeObject(obj: any): any;
}
export declare class TokenManager {
    static generateToken(payload: any, expiresIn?: string): string;
    static verifyToken(token: string): any;
    static refreshToken(token: string): string | null;
}
export declare const authenticateToken: (req: any, res: any, next: any) => Promise<void>;
export declare const requireRole: (requiredRoles: string[]) => (req: any, res: any, next: any) => void;
export declare class SecurityEventLogger {
    static logEvent(event: SecurityEvent): Promise<void>;
    static getRecentEvents(limit?: number): Promise<SecurityEvent[]>;
}
export declare class EncryptionUtils {
    static encrypt(text: string): string;
    static decrypt(encryptedText: string): string;
    static hashPassword(password: string): string;
    static verifyPassword(password: string, hashedPassword: string): boolean;
}
declare class SimpleRateLimit {
    private requests;
    private windowMs;
    private maxRequests;
    constructor(windowMs: number, maxRequests: number);
    isAllowed(identifier: string): boolean;
}
export declare const generalLimiter: SimpleRateLimit;
export declare const authLimiter: SimpleRateLimit;
export declare const apiLimiter: SimpleRateLimit;
export declare const rateLimitMiddleware: (limiter: SimpleRateLimit) => (req: any, res: any, next: any) => void;
export declare const securityHeaders: (_req: any, res: any, next: any) => void;
export declare const corsOptions: {
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => void;
    credentials: boolean;
    optionsSuccessStatus: number;
};
declare const _default: {
    InputValidator: typeof InputValidator;
    TokenManager: typeof TokenManager;
    SecurityEventLogger: typeof SecurityEventLogger;
    EncryptionUtils: typeof EncryptionUtils;
    authenticateToken: (req: any, res: any, next: any) => Promise<void>;
    requireRole: (requiredRoles: string[]) => (req: any, res: any, next: any) => void;
    securityHeaders: (_req: any, res: any, next: any) => void;
    generalLimiter: SimpleRateLimit;
    authLimiter: SimpleRateLimit;
    apiLimiter: SimpleRateLimit;
    rateLimitMiddleware: (limiter: SimpleRateLimit) => (req: any, res: any, next: any) => void;
    corsOptions: {
        origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => void;
        credentials: boolean;
        optionsSuccessStatus: number;
    };
};
export default _default;
//# sourceMappingURL=index.d.ts.map