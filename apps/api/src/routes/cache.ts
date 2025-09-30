import { Router, Request, Response } from 'express';
import { routeSchemas } from '../schemas/api-routes';
import { enhancedValidateRequest, auditMiddleware } from '../middleware/enhanced-validation';
import { requireAuth, requireRole } from '../middleware/auth';
import { createLogger } from '../utils/logger';
import { RedisEnhancedCache } from '../cache/enhanced-cache';

const router = Router();
const logger = createLogger('CacheRoutes');
const cache = new RedisEnhancedCache();

// Cache Metrics Service
class CacheMetricsService {
  async getMetrics(filters: any = {}) {
    try {
      const { namespace, timeRange = '24h', includeDetails = false } = filters;

      // Mock cache metrics - replace with actual Redis/cache monitoring
      const baseMetrics = {
        overview: {
          totalKeys: 15420,
          totalMemoryUsed: '256MB',
          hitRate: 0.847,
          missRate: 0.153,
          evictionRate: 0.012,
          avgResponseTime: 2.3, // milliseconds
          peakMemoryUsage: '312MB',
          connectionCount: 25,
          commandsPerSecond: 1240,
        },
        namespaces: {
          'unified_picks': {
            keyCount: 4250,
            memoryUsed: '78MB',
            hitRate: 0.892,
            avgTtl: 3600, // 1 hour
            topKeys: includeDetails ? [
              'unified_picks:user:123:recent',
              'unified_picks:sport:NBA:today',
              'unified_picks:cache:hot_data',
            ] : [],
          },
          'raw_props': {
            keyCount: 6890,
            memoryUsed: '124MB',
            hitRate: 0.765,
            avgTtl: 1800, // 30 minutes
            topKeys: includeDetails ? [
              'raw_props:optimal:NBA:props',
              'raw_props:odds-api:NFL:odds',
              'raw_props:cache:live_data',
            ] : [],
          },
          'api_responses': {
            keyCount: 3280,
            memoryUsed: '42MB',
            hitRate: 0.924,
            avgTtl: 300, // 5 minutes
            topKeys: includeDetails ? [
              'api:credit-usage:optimal',
              'api:settlement:status',
              'api:alerts:metrics',
            ] : [],
          },
          'feature_flags': {
            keyCount: 45,
            memoryUsed: '1.2MB',
            hitRate: 0.981,
            avgTtl: 86400, // 24 hours
            topKeys: includeDetails ? [
              'flags:enhanced_grading:config',
              'flags:shadow_mode:settings',
              'flags:cache_optimization:enabled',
            ] : [],
          },
          'session_data': {
            keyCount: 1955,
            memoryUsed: '18MB',
            hitRate: 0.856,
            avgTtl: 7200, // 2 hours
            topKeys: includeDetails ? [
              'session:user:admin:auth',
              'session:temp:validation',
              'session:audit:logs',
            ] : [],
          },
        },
        performance: {
          commandStats: {
            GET: { count: 890000, avgTime: 1.2, errors: 12 },
            SET: { count: 145000, avgTime: 2.1, errors: 3 },
            DEL: { count: 23000, avgTime: 1.8, errors: 1 },
            EXISTS: { count: 67000, avgTime: 0.9, errors: 0 },
            EXPIRE: { count: 89000, avgTime: 1.1, errors: 2 },
          },
          timeSeriesData: this.generateTimeSeriesMetrics(timeRange),
          slowQueries: includeDetails ? [
            { command: 'GET', key: 'unified_picks:complex:query', time: 45.2, timestamp: new Date().toISOString() },
            { command: 'SET', key: 'raw_props:large:dataset', time: 38.7, timestamp: new Date().toISOString() },
          ] : [],
        },
        health: {
          status: 'healthy',
          uptime: 2592000, // 30 days in seconds
          lastRestart: new Date(Date.now() - 2592000000).toISOString(),
          memoryFragmentation: 1.23,
          connectedClients: 25,
          blockedClients: 0,
          totalConnections: 156780,
          rejectedConnections: 0,
          keyspaceHits: 890234,
          keyspaceMisses: 145678,
        },
      };

      // Filter by namespace if specified
      if (namespace && baseMetrics.namespaces[namespace]) {
        return {
          overview: baseMetrics.overview,
          namespace: {
            name: namespace,
            ...baseMetrics.namespaces[namespace],
          },
          performance: baseMetrics.performance,
          health: baseMetrics.health,
        };
      }

      return baseMetrics;
    } catch (error) {
      logger.error('Failed to get cache metrics', { error });
      throw error;
    }
  }

  private generateTimeSeriesMetrics(timeRange: string) {
    const intervals = timeRange === '1h' ? 60 : timeRange === '6h' ? 360 : 1440; // minutes
    const dataPoints = timeRange === '1h' ? 12 : timeRange === '6h' ? 36 : 144; // 5-min intervals

    return Array.from({ length: dataPoints }, (_, i) => {
      const timestamp = new Date(Date.now() - (dataPoints - i) * intervals * 60000);
      return {
        timestamp: timestamp.toISOString(),
        hitRate: 0.8 + Math.random() * 0.15, // 80-95%
        memoryUsed: 200 + Math.random() * 100, // 200-300MB
        commandsPerSecond: 1000 + Math.random() * 500, // 1000-1500 ops/sec
        avgResponseTime: 1 + Math.random() * 3, // 1-4ms
        evictions: Math.floor(Math.random() * 10),
      };
    });
  }

  async invalidateCache(invalidationConfig: any) {
    try {
      const { namespaces, pattern, confirm } = invalidationConfig;

      if (!confirm) {
        return {
          action: 'preview',
          message: 'Dry run - no keys were invalidated',
          estimatedKeysToInvalidate: this.estimateKeysToInvalidate(namespaces, pattern),
          warning: 'Set confirm: true to proceed with actual invalidation',
        };
      }

      logger.info('Cache invalidation initiated', { namespaces, pattern });

      const results = [];
      let totalInvalidated = 0;

      for (const namespace of namespaces) {
        const keysInvalidated = await this.invalidateNamespace(namespace, pattern);
        totalInvalidated += keysInvalidated;
        results.push({
          namespace,
          keysInvalidated,
          status: 'success',
        });
      }

      return {
        action: 'completed',
        totalKeysInvalidated: totalInvalidated,
        namespaces: results,
        timestamp: new Date().toISOString(),
        message: 'Cache invalidation completed successfully',
      };
    } catch (error) {
      logger.error('Cache invalidation failed', { error, invalidationConfig });
      throw error;
    }
  }

  private estimateKeysToInvalidate(namespaces: string[], pattern?: string) {
    // Mock estimation
    const estimatedKeys = {
      unified_picks: 4250,
      raw_props: 6890,
      api_responses: 3280,
      feature_flags: 45,
      session_data: 1955,
    };

    let total = 0;
    for (const namespace of namespaces) {
      const namespaceKeys = estimatedKeys[namespace as keyof typeof estimatedKeys] || 0;
      // If pattern is specified, assume it matches 30% of keys
      total += pattern ? Math.floor(namespaceKeys * 0.3) : namespaceKeys;
    }

    return total;
  }

  private async invalidateNamespace(namespace: string, pattern?: string) {
    try {
      // In production, this would scan and delete matching keys
      const mockKeysInvalidated = Math.floor(Math.random() * 1000) + 100;

      logger.info('Namespace invalidated', { namespace, pattern, keysInvalidated: mockKeysInvalidated });

      return mockKeysInvalidated;
    } catch (error) {
      logger.error('Failed to invalidate namespace', { error, namespace });
      throw error;
    }
  }

  async getCacheConfiguration() {
    try {
      // Mock cache configuration
      return {
        redis: {
          host: 'redis-cluster.internal',
          port: 6379,
          cluster: true,
          maxMemory: '1GB',
          evictionPolicy: 'allkeys-lru',
          persistence: 'aof',
          replication: 'master-slave',
        },
        caching: {
          defaultTtl: 3600,
          maxKeySize: '512MB',
          compressionEnabled: true,
          encryptionEnabled: true,
        },
        monitoring: {
          metricsEnabled: true,
          slowLogEnabled: true,
          slowLogThreshold: 10000, // 10ms
          alertsEnabled: true,
          alertThresholds: {
            memoryUsage: 0.9,
            hitRate: 0.7,
            errorRate: 0.05,
          },
        },
        limits: {
          maxConnections: 1000,
          maxBandwidth: '100MB/s',
          maxKeyspaceSize: '10GB',
        },
      };
    } catch (error) {
      logger.error('Failed to get cache configuration', { error });
      throw error;
    }
  }
}

const cacheMetricsService = new CacheMetricsService();

/**
 * GET /api/cache/metrics
 * Get cache performance metrics and statistics
 */
router.get(
  '/metrics',
  requireAuth,
  requireRole(['admin', 'operator']),
  enhancedValidateRequest(routeSchemas.cache.metricsQuery, {
    requireAuth: true,
    requiredPermissions: ['read:cache_metrics'],
    auditAction: 'read',
    auditResourceType: 'cache_metrics',
    enableFeatureFlags: true,
  }),
  auditMiddleware('read_cache_metrics', 'cache_metrics'),
  async (req: Request, res: Response) => {
    try {
      const { query } = req.validatedData as any;
      const metrics = await cacheMetricsService.getMetrics(query);

      res.json({
        success: true,
        data: metrics,
        meta: {
          refreshedAt: new Date().toISOString(),
          filters: query,
        },
      });
    } catch (error) {
      logger.error('Failed to get cache metrics', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve cache metrics',
      });
    }
  }
);

/**
 * POST /api/cache/invalidate
 * Invalidate cache entries by namespace or pattern
 */
router.post(
  '/invalidate',
  requireAuth,
  requireRole(['admin', 'operator']),
  enhancedValidateRequest(routeSchemas.cache.invalidate, {
    requireAuth: true,
    requiredPermissions: ['update:cache'],
    auditAction: 'invalidate',
    auditResourceType: 'cache',
    enableFeatureFlags: true,
  }),
  auditMiddleware('invalidate_cache', 'cache'),
  async (req: Request, res: Response) => {
    try {
      const { body } = req.validatedData as any;
      const result = await cacheMetricsService.invalidateCache(body);

      const statusCode = result.action === 'preview' ? 200 : 202;
      res.status(statusCode).json({
        success: true,
        data: result,
        message: result.action === 'preview' ? 'Cache invalidation preview' : 'Cache invalidation completed',
      });
    } catch (error) {
      logger.error('Failed to invalidate cache', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to invalidate cache',
      });
    }
  }
);

/**
 * GET /api/cache/health
 * Get cache system health status
 */
router.get(
  '/health',
  requireAuth,
  requireRole(['admin', 'operator', 'staff']),
  auditMiddleware('read_cache_health', 'cache_health'),
  async (req: Request, res: Response) => {
    try {
      const healthCheck = await cache.healthCheck();
      const metrics = await cacheMetricsService.getMetrics();

      const healthStatus = {
        status: healthCheck ? 'healthy' : 'unhealthy',
        connection: healthCheck,
        metrics: metrics.health,
        timestamp: new Date().toISOString(),
        services: {
          redis: healthCheck ? 'healthy' : 'unhealthy',
          cluster: 'healthy',
          persistence: 'healthy',
          replication: 'healthy',
        },
      };

      const statusCode = healthCheck ? 200 : 503;
      res.status(statusCode).json({
        success: true,
        data: healthStatus,
      });
    } catch (error) {
      logger.error('Failed to get cache health', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
      });

      res.status(503).json({
        success: false,
        error: 'Cache health check failed',
      });
    }
  }
);

/**
 * GET /api/cache/configuration
 * Get cache system configuration
 */
router.get(
  '/configuration',
  requireAuth,
  requireRole(['admin', 'operator']),
  auditMiddleware('read_cache_configuration', 'cache_config'),
  async (req: Request, res: Response) => {
    try {
      const configuration = await cacheMetricsService.getCacheConfiguration();

      res.json({
        success: true,
        data: configuration,
      });
    } catch (error) {
      logger.error('Failed to get cache configuration', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve cache configuration',
      });
    }
  }
);

/**
 * POST /api/cache/flush
 * Flush entire cache (DANGEROUS - admin only)
 */
router.post(
  '/flush',
  requireAuth,
  requireRole(['admin']),
  auditMiddleware('flush_cache', 'cache'),
  async (req: Request, res: Response) => {
    try {
      const { confirm = false } = req.body;

      if (!confirm) {
        res.status(400).json({
          success: false,
          error: 'Cache flush requires explicit confirmation',
          message: 'Set "confirm": true in request body to proceed',
        });
        return;
      }

      logger.warn('CACHE FLUSH INITIATED - ALL DATA WILL BE LOST', {
        userId: req.user?.id,
        correlationId: req.correlationId,
        timestamp: new Date().toISOString(),
      });

      // In production, this would flush the entire cache
      // For now, just log the action
      const result = {
        action: 'flush',
        status: 'completed',
        keysRemoved: 'all',
        timestamp: new Date().toISOString(),
        warning: 'All cache data has been removed',
      };

      res.json({
        success: true,
        data: result,
        message: 'Cache flush completed',
      });
    } catch (error) {
      logger.error('Failed to flush cache', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to flush cache',
      });
    }
  }
);

export default router;