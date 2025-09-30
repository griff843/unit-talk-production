import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { routeSchemas } from '../schemas/api-routes';
import { enhancedValidateRequest, auditMiddleware } from '../middleware/enhanced-validation';
import { requireAuth, requireRole } from '../middleware/auth';
import { createLogger } from '../utils/logger';
import { RedisEnhancedCache } from '../cache/enhanced-cache';

const router = Router();
const logger = createLogger('IngestionRoutes');
const cache = new RedisEnhancedCache();

// Watchlist configuration storage (in production, this would be a database table)
class WatchlistConfigService {
  async getConfigs(filters: any = {}) {
    try {
      const cacheKey = `watchlist:configs:${JSON.stringify(filters)}`;
      const cached = await cache.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      // Mock data - replace with actual database query
      const configs = [
        {
          id: randomUUID(),
          sports: ['NBA', 'NFL'],
          books: ['fanduel', 'draftkings'],
          rateLimit: {
            requestsPerMinute: 60,
            burstLimit: 100,
            cooldownSeconds: 30,
          },
          filters: {
            minOdds: -200,
            maxOdds: 300,
            excludeParlays: false,
            includeAltLines: true,
          },
          enabled: true,
          priority: 'high',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      await cache.set(cacheKey, JSON.stringify(configs), 300);
      return configs;
    } catch (error) {
      logger.error('Failed to get watchlist configs', { error });
      throw error;
    }
  }

  async createConfig(config: any) {
    try {
      const newConfig = {
        id: randomUUID(),
        ...config,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // In production, save to database
      logger.info('Creating watchlist config', { configId: newConfig.id, config });

      // Invalidate cache
      await this.invalidateCache();

      return newConfig;
    } catch (error) {
      logger.error('Failed to create watchlist config', { error, config });
      throw error;
    }
  }

  async updateConfig(id: string, updates: any) {
    try {
      // In production, update database record
      const updatedConfig = {
        id,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      logger.info('Updating watchlist config', { configId: id, updates });

      // Invalidate cache
      await this.invalidateCache();

      return updatedConfig;
    } catch (error) {
      logger.error('Failed to update watchlist config', { error, id, updates });
      throw error;
    }
  }

  async deleteConfig(id: string) {
    try {
      // In production, delete from database
      logger.info('Deleting watchlist config', { configId: id });

      // Invalidate cache
      await this.invalidateCache();

      return true;
    } catch (error) {
      logger.error('Failed to delete watchlist config', { error, id });
      throw error;
    }
  }

  private async invalidateCache() {
    // Invalidate all watchlist cache entries
    const pattern = 'watchlist:configs:*';
    // In production, implement proper cache invalidation
    logger.info('Invalidating watchlist config cache');
  }

  async getIngestionMetrics(filters: any = {}) {
    try {
      // Mock metrics - replace with actual monitoring data
      return {
        totalRequests: 15420,
        requestsPerMinute: 45,
        successRate: 0.987,
        averageResponseTime: 234,
        activeConfigs: 3,
        errorCount: 12,
        rateLimitHits: 3,
        lastIngestion: new Date().toISOString(),
        byProvider: {
          optimal: { requests: 8500, errors: 5, avgResponseTime: 180 },
          oddsApi: { requests: 6920, errors: 7, avgResponseTime: 290 },
        },
        bySport: {
          NFL: { requests: 7200, success: 0.99 },
          NBA: { requests: 5100, success: 0.985 },
          MLB: { requests: 3120, success: 0.982 },
        },
      };
    } catch (error) {
      logger.error('Failed to get ingestion metrics', { error });
      throw error;
    }
  }
}

const watchlistService = new WatchlistConfigService();

// === Watchlist Configuration Routes ===

/**
 * GET /api/ingestion/watchlist
 * Get all watchlist configurations with optional filtering
 */
router.get(
  '/watchlist',
  requireAuth,
  requireRole(['admin', 'operator']),
  enhancedValidateRequest(routeSchemas.ingestion.watchlistQuery, {
    requireAuth: true,
    requiredPermissions: ['read:ops'],
    auditAction: 'read',
    auditResourceType: 'watchlist_config',
    enableFeatureFlags: true,
  }),
  auditMiddleware('list_watchlist_configs', 'watchlist_config'),
  async (req: Request, res: Response) => {
    try {
      const { query } = req.validatedData as any;
      const configs = await watchlistService.getConfigs(query);

      res.json({
        success: true,
        data: configs,
        meta: {
          total: configs.length,
          filters: query,
        },
      });
    } catch (error) {
      logger.error('Failed to get watchlist configs', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve watchlist configurations',
      });
    }
  }
);

/**
 * POST /api/ingestion/watchlist
 * Create a new watchlist configuration
 */
router.post(
  '/watchlist',
  requireAuth,
  requireRole(['admin', 'operator']),
  enhancedValidateRequest(routeSchemas.ingestion.watchlistConfig, {
    requireAuth: true,
    requiredPermissions: ['create:watchlist_config'],
    auditAction: 'create',
    auditResourceType: 'watchlist_config',
  }),
  auditMiddleware('create_watchlist_config', 'watchlist_config'),
  async (req: Request, res: Response) => {
    try {
      const { body } = req.validatedData as any;
      const newConfig = await watchlistService.createConfig(body);

      res.status(201).json({
        success: true,
        data: newConfig,
        message: 'Watchlist configuration created successfully',
      });
    } catch (error) {
      logger.error('Failed to create watchlist config', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to create watchlist configuration',
      });
    }
  }
);

/**
 * PUT /api/ingestion/watchlist/:id
 * Update an existing watchlist configuration
 */
router.put(
  '/watchlist/:id',
  requireAuth,
  requireRole(['admin', 'operator']),
  enhancedValidateRequest(routeSchemas.ingestion.watchlistConfig, {
    requireAuth: true,
    requiredPermissions: ['update:watchlist_config'],
    auditAction: 'update',
    auditResourceType: 'watchlist_config',
  }),
  auditMiddleware('update_watchlist_config', 'watchlist_config', (req) => req.params.id),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { body } = req.validatedData as any;

      const updatedConfig = await watchlistService.updateConfig(id, body);

      res.json({
        success: true,
        data: updatedConfig,
        message: 'Watchlist configuration updated successfully',
      });
    } catch (error) {
      logger.error('Failed to update watchlist config', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
        configId: req.params.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to update watchlist configuration',
      });
    }
  }
);

/**
 * DELETE /api/ingestion/watchlist/:id
 * Delete a watchlist configuration
 */
router.delete(
  '/watchlist/:id',
  requireAuth,
  requireRole(['admin', 'operator']),
  auditMiddleware('delete_watchlist_config', 'watchlist_config', (req) => req.params.id),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await watchlistService.deleteConfig(id);

      res.json({
        success: true,
        message: 'Watchlist configuration deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete watchlist config', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
        configId: req.params.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to delete watchlist configuration',
      });
    }
  }
);

/**
 * GET /api/ingestion/metrics
 * Get ingestion performance metrics and statistics
 */
router.get(
  '/metrics',
  requireAuth,
  requireRole(['admin', 'operator']),
  auditMiddleware('read_ingestion_metrics', 'ingestion_metrics'),
  async (req: Request, res: Response) => {
    try {
      const metrics = await watchlistService.getIngestionMetrics(req.query);

      res.json({
        success: true,
        data: metrics,
        meta: {
          refreshedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Failed to get ingestion metrics', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve ingestion metrics',
      });
    }
  }
);

/**
 * POST /api/ingestion/trigger
 * Manually trigger ingestion for specific configurations
 */
router.post(
  '/trigger',
  requireAuth,
  requireRole(['admin', 'operator']),
  enhancedValidateRequest(
    routeSchemas.ingestion.watchlistQuery.merge(
      routeSchemas.ingestion.watchlistConfig.pick({ body: true }).partial()
    ),
    {
      requireAuth: true,
      requiredPermissions: ['create:ingestion_trigger'],
      auditAction: 'trigger',
      auditResourceType: 'ingestion',
    }
  ),
  auditMiddleware('trigger_ingestion', 'ingestion'),
  async (req: Request, res: Response) => {
    try {
      const { body } = req.validatedData as any;

      // Mock ingestion trigger - replace with actual ingestion service call
      const triggerId = randomUUID();

      logger.info('Manual ingestion triggered', {
        triggerId,
        userId: req.user?.id,
        config: body,
      });

      res.json({
        success: true,
        data: {
          triggerId,
          status: 'initiated',
          estimatedCompletion: new Date(Date.now() + 60000).toISOString(), // 1 minute from now
        },
        message: 'Ingestion triggered successfully',
      });
    } catch (error) {
      logger.error('Failed to trigger ingestion', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to trigger ingestion',
      });
    }
  }
);

export default router;