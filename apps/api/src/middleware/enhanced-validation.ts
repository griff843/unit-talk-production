import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { createLogger } from '../utils/logger';
import { sanitizeInput } from './validation';
import { RedisEnhancedCache } from '../cache/enhanced-cache';

const logger = createLogger('EnhancedValidation');
const cache = new RedisEnhancedCache();

// Extended Request interface
declare global {
  namespace Express {
    interface Request {
      validatedData?: unknown;
      correlationId?: string;
      user?: {
        id: string;
        username: string;
        role: string;
        permissions: string[];
        tier: string;
      };
      auditContext?: {
        action: string;
        resourceType: string;
        resourceId?: string;
        metadata: Record<string, any>;
      };
      featureFlags?: Record<string, boolean>;
    }
  }
}

// RBAC Configuration
export const ROLE_PERMISSIONS = {
  member: ['read:own_picks'],
  trial: ['read:own_picks'],
  vip: ['read:own_picks', 'read:alerts'],
  vip_plus: ['read:own_picks', 'read:alerts', 'read:analytics'],
  capper: ['read:own_picks', 'create:picks', 'read:alerts', 'read:analytics'],
  staff: ['read:picks', 'create:picks', 'update:picks', 'read:alerts', 'create:alerts'],
  admin: ['*'], // Full permissions
  owner: ['*'], // Full permissions
  operator: ['read:all', 'create:settlement', 'update:feature_flags', 'read:cache_metrics'],
} as const;

export const RESOURCE_PERMISSIONS = {
  'GET:/unified-picks': ['read:picks', 'read:own_picks'],
  'POST:/unified-picks': ['create:picks'],
  'PUT:/unified-picks/*': ['update:picks'],
  'DELETE:/unified-picks/*': ['delete:picks'],
  'GET:/settlement/*': ['read:settlement'],
  'POST:/settlement/run': ['create:settlement'],
  'GET:/ops/credit-usage': ['read:ops'],
  'POST:/ops/credit-usage/budget': ['update:ops'],
  'POST:/alerts/replay': ['create:alerts'],
  'GET:/cache/metrics': ['read:cache_metrics'],
  'POST:/cache/invalidate': ['update:cache'],
  'GET:/feature-flags': ['read:feature_flags'],
  'POST:/feature-flags': ['create:feature_flags'],
  'PUT:/feature-flags/*': ['update:feature_flags'],
  'DELETE:/feature-flags/*': ['delete:feature_flags'],
  'GET:/shadow-mode': ['read:shadow_mode'],
  'POST:/shadow-mode/config': ['update:shadow_mode'],
} as const;

// Audit Log Service
class AuditLogService {
  async log(req: Request, action: string, resourceType: string, resourceId?: string, metadata: Record<string, any> = {}) {
    try {
      const auditEntry = {
        id: randomUUID(),
        userId: req.user?.id || 'anonymous',
        action,
        resourceType,
        resourceId,
        metadata: {
          ...metadata,
          userAgent: req.headers['user-agent'],
          ip: req.ip || req.connection.remoteAddress,
          correlationId: req.correlationId,
          timestamp: new Date().toISOString(),
        },
      };

      // Store in cache for immediate access and async persist to database
      const cacheKey = `audit:${Date.now()}:${randomUUID()}`;
      await cache.set(cacheKey, JSON.stringify(auditEntry), 86400); // 24 hours

      logger.info('Audit log entry created', auditEntry);
    } catch (error) {
      logger.error('Failed to create audit log entry', {
        error: error instanceof Error ? error.message : String(error),
        action,
        resourceType,
        resourceId
      });
    }
  }
}

const auditLogger = new AuditLogService();

// Feature Flag Service
class FeatureFlagService {
  private flagCache = new Map<string, { enabled: boolean; rollout: number; conditions: any }>();

  async evaluateFlags(userId: string, userTier: string, sport?: string, environment = 'production'): Promise<Record<string, boolean>> {
    try {
      // Mock feature flag evaluation - replace with actual service
      const flags = {
        enhanced_grading: true,
        shadow_mode_enabled: false,
        cache_optimization: true,
        advanced_alerts: userTier === 'vip_plus',
        settlement_automation: true,
      };

      return flags;
    } catch (error) {
      logger.error('Feature flag evaluation failed', { error, userId, userTier });
      return {};
    }
  }
}

const featureFlagService = new FeatureFlagService();

// Permission checking utility
export function hasPermission(userRole: string, requiredPermissions: string[]): boolean {
  if (userRole === 'admin' || userRole === 'owner') {
    return true; // Full permissions
  }

  const userPermissions = ROLE_PERMISSIONS[userRole as keyof typeof ROLE_PERMISSIONS] || [];

  if (userPermissions.includes('*')) {
    return true;
  }

  return requiredPermissions.some(required => userPermissions.includes(required));
}

// Enhanced validation middleware with RBAC and audit logging
export function enhancedValidateRequest(
  schema: z.ZodSchema,
  options: {
    requireAuth?: boolean;
    requiredPermissions?: string[];
    auditAction?: string;
    auditResourceType?: string;
    enableFeatureFlags?: boolean;
    rateLimitKey?: string;
  } = {}
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();

    try {
      // Add correlation ID
      req.correlationId = randomUUID();

      // Authentication check
      if (options.requireAuth && !req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          correlationId: req.correlationId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Permission check
      if (options.requiredPermissions && req.user) {
        const hasAccess = hasPermission(req.user.role, options.requiredPermissions);
        if (!hasAccess) {
          await auditLogger.log(req, 'access_denied', options.auditResourceType || 'unknown', undefined, {
            requiredPermissions: options.requiredPermissions,
            userRole: req.user.role,
          });

          res.status(403).json({
            success: false,
            error: 'Insufficient permissions',
            required: options.requiredPermissions,
            correlationId: req.correlationId,
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      // Feature flag evaluation
      if (options.enableFeatureFlags && req.user) {
        req.featureFlags = await featureFlagService.evaluateFlags(
          req.user.id,
          req.user.tier,
          req.body?.sport,
          process.env.NODE_ENV || 'development'
        );
      }

      // Input sanitization
      req.body = sanitizeInput(req.body) as typeof req.body;
      req.query = sanitizeInput(req.query) as typeof req.query;
      req.params = sanitizeInput(req.params) as typeof req.params;

      // Schema validation
      const result = await schema.safeParseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      if (!result.success) {
        const validationErrors = result.error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
          received: err.received,
        }));

        await auditLogger.log(req, 'validation_failed', options.auditResourceType || 'unknown', undefined, {
          errors: validationErrors,
          inputData: {
            bodyKeys: Object.keys(req.body || {}),
            queryKeys: Object.keys(req.query || {}),
            paramsKeys: Object.keys(req.params || {}),
          },
        });

        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validationErrors,
          correlationId: req.correlationId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Store validated data
      req.validatedData = result.data;

      // Set audit context for downstream middleware
      if (options.auditAction && options.auditResourceType) {
        req.auditContext = {
          action: options.auditAction,
          resourceType: options.auditResourceType,
          metadata: {
            validationTime: Date.now() - startTime,
            featureFlagsEvaluated: options.enableFeatureFlags,
          },
        };
      }

      // Log successful validation
      await auditLogger.log(req, 'validation_success', options.auditResourceType || 'request', undefined, {
        validationTime: Date.now() - startTime,
        dataKeys: Object.keys(result.data),
      });

      next();
    } catch (error) {
      logger.error('Enhanced validation middleware error:', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
        route: req.route?.path,
        method: req.method,
      });

      await auditLogger.log(req, 'validation_error', options.auditResourceType || 'unknown', undefined, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        success: false,
        error: 'Internal validation error',
        correlationId: req.correlationId,
        timestamp: new Date().toISOString(),
      });
    }
  };
}

// Audit middleware for logging API operations
export function auditMiddleware(action: string, resourceType: string, getResourceId?: (req: Request) => string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const resourceId = getResourceId ? getResourceId(req) : undefined;

      await auditLogger.log(req, action, resourceType, resourceId, {
        method: req.method,
        path: req.path,
        queryParams: Object.keys(req.query),
        bodySize: JSON.stringify(req.body || {}).length,
      });

      next();
    } catch (error) {
      logger.error('Audit middleware error:', error);
      // Don't block the request if audit logging fails
      next();
    }
  };
}

// Cache-aware middleware for unified picks
export function cacheAwareMiddleware(cacheKeyGenerator: (req: Request) => string, ttl = 300) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Only cache GET requests
      if (req.method !== 'GET') {
        return next();
      }

      const cacheKey = cacheKeyGenerator(req);
      const cachedData = await cache.get(cacheKey);

      if (cachedData) {
        logger.info('Cache hit', { cacheKey, correlationId: req.correlationId });

        res.json({
          success: true,
          data: JSON.parse(cachedData),
          meta: { cached: true, cacheKey },
          correlationId: req.correlationId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Extend response to cache successful responses
      const originalSend = res.json;
      res.json = function(data: any) {
        if (data.success && data.data) {
          cache.set(cacheKey, JSON.stringify(data.data), ttl).catch(err =>
            logger.error('Cache set failed', { error: err, cacheKey })
          );
        }
        return originalSend.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      // Don't block the request if cache fails
      next();
    }
  };
}

// Rate limiting with feature flag awareness
export function featureAwareRateLimit(baseLimit: number, featureFlagMultiplier: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const multiplier = req.featureFlags?.[featureFlagMultiplier] ? 2 : 1;
      const effectiveLimit = baseLimit * multiplier;

      // Simple in-memory rate limiting (replace with Redis in production)
      const key = `rate_limit:${req.ip}:${req.path}`;
      // Implementation would track requests per key against effectiveLimit

      next();
    } catch (error) {
      logger.error('Feature-aware rate limit error:', error);
      next();
    }
  };
}

// Response formatting middleware
export function formatResponse(req: Request, res: Response, next: NextFunction): void {
  const originalSend = res.json;

  res.json = function(data: any) {
    if (!data.correlationId) {
      data.correlationId = req.correlationId;
    }

    if (!data.timestamp) {
      data.timestamp = new Date().toISOString();
    }

    // Add performance metadata
    if (req.auditContext) {
      data.meta = {
        ...data.meta,
        processingTime: Date.now() - parseInt(req.correlationId?.slice(-13) || '0', 16),
      };
    }

    return originalSend.call(this, data);
  };

  next();
}

export { AuditLogService, FeatureFlagService };
export default {
  enhancedValidateRequest,
  auditMiddleware,
  cacheAwareMiddleware,
  featureAwareRateLimit,
  formatResponse,
  hasPermission,
};