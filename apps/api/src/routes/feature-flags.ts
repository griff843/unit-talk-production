import { Router, Request, Response } from 'express';
import { routeSchemas } from '../schemas/api-routes';
import { enhancedValidateRequest, auditMiddleware, FeatureFlagService } from '../middleware/enhanced-validation';
import { requireAuth, requireRole } from '../middleware/auth';
import { createLogger } from '../utils/logger';
import { RedisEnhancedCache } from '../cache/enhanced-cache';

const router = Router();
const logger = createLogger('FeatureFlagsRoutes');
const cache = new RedisEnhancedCache();

// Enhanced Feature Flag Service with runtime management
class RuntimeFeatureFlagService extends FeatureFlagService {
  async createFlag(flagData: any) {
    try {
      const newFlag = {
        id: `flag_${Date.now()}`,
        ...flagData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      };

      // Store in cache and simulate database storage
      const cacheKey = `feature_flag:${newFlag.name}`;
      await cache.set(cacheKey, JSON.stringify(newFlag), 86400); // 24 hours

      // Also store in global flags list
      await this.updateFlagsList('add', newFlag.name);

      logger.info('Feature flag created', { flagName: newFlag.name, enabled: newFlag.enabled });
      return newFlag;
    } catch (error) {
      logger.error('Failed to create feature flag', { error, flagData });
      throw error;
    }
  }

  async updateFlag(flagName: string, updateData: any) {
    try {
      const cacheKey = `feature_flag:${flagName}`;
      const existingFlag = await this.getFlag(flagName);

      if (!existingFlag) {
        throw new Error(`Feature flag '${flagName}' not found`);
      }

      const updatedFlag = {
        ...existingFlag,
        ...updateData,
        updatedAt: new Date().toISOString(),
        version: existingFlag.version + 1,
      };

      await cache.set(cacheKey, JSON.stringify(updatedFlag), 86400);

      logger.info('Feature flag updated', { flagName, changes: updateData });
      return updatedFlag;
    } catch (error) {
      logger.error('Failed to update feature flag', { error, flagName, updateData });
      throw error;
    }
  }

  async getFlag(flagName: string) {
    try {
      const cacheKey = `feature_flag:${flagName}`;
      const cached = await cache.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      // If not in cache, check if it's a system flag
      const systemFlags = this.getSystemFlags();
      return systemFlags[flagName] || null;
    } catch (error) {
      logger.error('Failed to get feature flag', { error, flagName });
      throw error;
    }
  }

  async getAllFlags() {
    try {
      const flagsList = await this.getFlagsList();
      const flags = [];

      for (const flagName of flagsList) {
        try {
          const flag = await this.getFlag(flagName);
          if (flag) flags.push(flag);
        } catch (error) {
          logger.warn('Failed to load flag', { flagName, error });
        }
      }

      // Add system flags
      const systemFlags = this.getSystemFlags();
      for (const [name, config] of Object.entries(systemFlags)) {
        if (!flagsList.includes(name)) {
          flags.push({ name, ...config, isSystem: true });
        }
      }

      return flags;
    } catch (error) {
      logger.error('Failed to get all feature flags', { error });
      throw error;
    }
  }

  async deleteFlag(flagName: string) {
    try {
      const flag = await this.getFlag(flagName);
      if (!flag) {
        throw new Error(`Feature flag '${flagName}' not found`);
      }

      if (flag.isSystem) {
        throw new Error(`Cannot delete system feature flag '${flagName}'`);
      }

      const cacheKey = `feature_flag:${flagName}`;
      await cache.del(cacheKey);

      await this.updateFlagsList('remove', flagName);

      logger.info('Feature flag deleted', { flagName });
      return true;
    } catch (error) {
      logger.error('Failed to delete feature flag', { error, flagName });
      throw error;
    }
  }

  async evaluateFlags(userId: string, userTier: string, sport?: string, environment = 'production') {
    try {
      const flags = await this.getAllFlags();
      const evaluatedFlags: Record<string, boolean> = {};

      for (const flag of flags) {
        try {
          evaluatedFlags[flag.name] = this.evaluateSingleFlag(flag, {
            userId,
            userTier,
            sport,
            environment,
          });
        } catch (error) {
          logger.warn('Failed to evaluate flag', { flagName: flag.name, error });
          evaluatedFlags[flag.name] = false; // Default to disabled on error
        }
      }

      return evaluatedFlags;
    } catch (error) {
      logger.error('Failed to evaluate feature flags', { error, userId, userTier });
      return {};
    }
  }

  private evaluateSingleFlag(flag: any, context: any): boolean {
    if (!flag.enabled) {
      return false;
    }

    // Check conditions
    if (flag.conditions) {
      // Environment check
      if (flag.conditions.environments && !flag.conditions.environments.includes(context.environment)) {
        return false;
      }

      // User tier check
      if (flag.conditions.userTiers && !flag.conditions.userTiers.includes(context.userTier)) {
        return false;
      }

      // Sport check
      if (flag.conditions.sports && context.sport && !flag.conditions.sports.includes(context.sport)) {
        return false;
      }
    }

    // Rollout percentage check
    if (flag.rolloutPercentage < 100) {
      const userHash = this.hashUserId(context.userId + flag.name);
      const userPercentile = userHash % 100;
      return userPercentile < flag.rolloutPercentage;
    }

    return true;
  }

  private hashUserId(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  private getSystemFlags() {
    return {
      enhanced_grading: {
        description: 'Enable Enhanced45Factor grading system',
        enabled: true,
        rolloutPercentage: 100,
        conditions: { environments: ['production'] },
        isSystem: true,
      },
      shadow_mode_enabled: {
        description: 'Enable shadow mode for testing',
        enabled: false,
        rolloutPercentage: 0,
        conditions: { userTiers: ['admin'], environments: ['development', 'staging'] },
        isSystem: true,
      },
      cache_optimization: {
        description: 'Enable cache-first architecture optimizations',
        enabled: true,
        rolloutPercentage: 100,
        isSystem: true,
      },
      advanced_alerts: {
        description: 'Enable advanced alert features',
        enabled: true,
        rolloutPercentage: 80,
        conditions: { userTiers: ['vip_plus', 'admin'] },
        isSystem: true,
      },
      settlement_automation: {
        description: 'Enable automated settlement processing',
        enabled: true,
        rolloutPercentage: 100,
        isSystem: true,
      },
    };
  }

  private async getFlagsList(): Promise<string[]> {
    try {
      const cached = await cache.get('feature_flags:list');
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      logger.error('Failed to get flags list', { error });
      return [];
    }
  }

  private async updateFlagsList(operation: 'add' | 'remove', flagName: string): Promise<void> {
    try {
      const currentList = await this.getFlagsList();

      let updatedList;
      if (operation === 'add' && !currentList.includes(flagName)) {
        updatedList = [...currentList, flagName];
      } else if (operation === 'remove') {
        updatedList = currentList.filter(name => name !== flagName);
      } else {
        return; // No change needed
      }

      await cache.set('feature_flags:list', JSON.stringify(updatedList), 86400);
    } catch (error) {
      logger.error('Failed to update flags list', { error, operation, flagName });
    }
  }
}

const featureFlagService = new RuntimeFeatureFlagService();

/**
 * GET /api/feature-flags
 * Get all feature flags
 */
router.get(
  '/',
  requireAuth,
  requireRole(['admin', 'operator']),
  auditMiddleware('list_feature_flags', 'feature_flag'),
  async (req: Request, res: Response) => {
    try {
      const flags = await featureFlagService.getAllFlags();

      res.json({
        success: true,
        data: flags,
        meta: {
          total: flags.length,
          systemFlags: flags.filter(f => f.isSystem).length,
          customFlags: flags.filter(f => !f.isSystem).length,
        },
      });
    } catch (error) {
      logger.error('Failed to get feature flags', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve feature flags',
      });
    }
  }
);

/**
 * POST /api/feature-flags
 * Create a new feature flag
 */
router.post(
  '/',
  requireAuth,
  requireRole(['admin']),
  enhancedValidateRequest(routeSchemas.featureFlags.create, {
    requireAuth: true,
    requiredPermissions: ['create:feature_flags'],
    auditAction: 'create',
    auditResourceType: 'feature_flag',
  }),
  auditMiddleware('create_feature_flag', 'feature_flag'),
  async (req: Request, res: Response) => {
    try {
      const { body } = req.validatedData as any;

      // Check if flag already exists
      const existingFlag = await featureFlagService.getFlag(body.name);
      if (existingFlag) {
        res.status(409).json({
          success: false,
          error: `Feature flag '${body.name}' already exists`,
        });
        return;
      }

      const newFlag = await featureFlagService.createFlag(body);

      res.status(201).json({
        success: true,
        data: newFlag,
        message: 'Feature flag created successfully',
      });
    } catch (error) {
      logger.error('Failed to create feature flag', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to create feature flag',
      });
    }
  }
);

/**
 * GET /api/feature-flags/:name
 * Get a specific feature flag
 */
router.get(
  '/:name',
  requireAuth,
  requireRole(['admin', 'operator']),
  auditMiddleware('read_feature_flag', 'feature_flag', (req) => req.params.name),
  async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const flag = await featureFlagService.getFlag(name);

      if (!flag) {
        res.status(404).json({
          success: false,
          error: `Feature flag '${name}' not found`,
        });
        return;
      }

      res.json({
        success: true,
        data: flag,
      });
    } catch (error) {
      logger.error('Failed to get feature flag', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
        flagName: req.params.name,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve feature flag',
      });
    }
  }
);

/**
 * PUT /api/feature-flags/:name
 * Update a feature flag
 */
router.put(
  '/:name',
  requireAuth,
  requireRole(['admin']),
  enhancedValidateRequest(routeSchemas.featureFlags.update, {
    requireAuth: true,
    requiredPermissions: ['update:feature_flags'],
    auditAction: 'update',
    auditResourceType: 'feature_flag',
  }),
  auditMiddleware('update_feature_flag', 'feature_flag', (req) => req.params.name),
  async (req: Request, res: Response) => {
    try {
      const { params, body } = req.validatedData as any;

      const updatedFlag = await featureFlagService.updateFlag(params.name, body);

      res.json({
        success: true,
        data: updatedFlag,
        message: 'Feature flag updated successfully',
      });
    } catch (error) {
      logger.error('Failed to update feature flag', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
        flagName: req.params.name,
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update feature flag',
      });
    }
  }
);

/**
 * DELETE /api/feature-flags/:name
 * Delete a feature flag
 */
router.delete(
  '/:name',
  requireAuth,
  requireRole(['admin']),
  auditMiddleware('delete_feature_flag', 'feature_flag', (req) => req.params.name),
  async (req: Request, res: Response) => {
    try {
      const { name } = req.params;

      await featureFlagService.deleteFlag(name);

      res.json({
        success: true,
        message: 'Feature flag deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete feature flag', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
        flagName: req.params.name,
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
                         error instanceof Error && error.message.includes('Cannot delete') ? 403 : 500;

      res.status(statusCode).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete feature flag',
      });
    }
  }
);

/**
 * POST /api/feature-flags/evaluate
 * Evaluate feature flags for a user context
 */
router.post(
  '/evaluate',
  requireAuth,
  enhancedValidateRequest(routeSchemas.featureFlags.evaluate, {
    requireAuth: true,
    auditAction: 'evaluate',
    auditResourceType: 'feature_flag',
  }),
  auditMiddleware('evaluate_feature_flags', 'feature_flag'),
  async (req: Request, res: Response) => {
    try {
      const { body } = req.validatedData as any;

      const evaluatedFlags = await featureFlagService.evaluateFlags(
        body.userId,
        body.userTier,
        body.sport,
        body.environment
      );

      // Filter to only requested flags
      const requestedFlags: Record<string, boolean> = {};
      for (const flagName of body.flags) {
        requestedFlags[flagName] = evaluatedFlags[flagName] || false;
      }

      res.json({
        success: true,
        data: requestedFlags,
        meta: {
          context: {
            userId: body.userId,
            userTier: body.userTier,
            sport: body.sport,
            environment: body.environment,
          },
          evaluatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Failed to evaluate feature flags', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
        userId: req.body?.userId,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to evaluate feature flags',
      });
    }
  }
);

/**
 * POST /api/feature-flags/:name/toggle
 * Quick toggle a feature flag on/off
 */
router.post(
  '/:name/toggle',
  requireAuth,
  requireRole(['admin']),
  auditMiddleware('toggle_feature_flag', 'feature_flag', (req) => req.params.name),
  async (req: Request, res: Response) => {
    try {
      const { name } = req.params;

      const flag = await featureFlagService.getFlag(name);
      if (!flag) {
        res.status(404).json({
          success: false,
          error: `Feature flag '${name}' not found`,
        });
        return;
      }

      if (flag.isSystem) {
        res.status(403).json({
          success: false,
          error: 'Cannot toggle system feature flags',
        });
        return;
      }

      const updatedFlag = await featureFlagService.updateFlag(name, {
        enabled: !flag.enabled,
      });

      res.json({
        success: true,
        data: updatedFlag,
        message: `Feature flag '${name}' ${updatedFlag.enabled ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      logger.error('Failed to toggle feature flag', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
        flagName: req.params.name,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to toggle feature flag',
      });
    }
  }
);

export default router;