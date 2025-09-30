import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { routeSchemas } from '../schemas/api-routes';
import { enhancedValidateRequest, auditMiddleware } from '../middleware/enhanced-validation';
import { requireAuth, requireRole } from '../middleware/auth';
import { createLogger } from '../utils/logger';
import { RedisEnhancedCache } from '../cache/enhanced-cache';

const router = Router();
const logger = createLogger('ShadowModeRoutes');
const cache = new RedisEnhancedCache();

// Shadow Mode Service for configuration and monitoring
class ShadowModeService {
  async getConfiguration() {
    try {
      const cacheKey = 'shadow_mode:configuration';
      const cached = await cache.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      // Default shadow mode configuration
      const defaultConfig = {
        enabled: false,
        trafficPercentage: 0,
        components: [],
        invariants: {
          maxLatencyMs: 5000,
          maxMemoryMb: 1024,
          maxErrorRate: 0.05,
        },
        monitoring: {
          enableDetailedLogs: false,
          enableMetrics: true,
          enableAlerts: true,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      };

      await cache.set(cacheKey, JSON.stringify(defaultConfig), 86400); // 24 hours
      return defaultConfig;
    } catch (error) {
      logger.error('Failed to get shadow mode configuration', { error });
      throw error;
    }
  }

  async updateConfiguration(configData: any) {
    try {
      const currentConfig = await this.getConfiguration();

      const updatedConfig = {
        ...currentConfig,
        ...configData,
        updatedAt: new Date().toISOString(),
        version: currentConfig.version + 1,
      };

      const cacheKey = 'shadow_mode:configuration';
      await cache.set(cacheKey, JSON.stringify(updatedConfig), 86400);

      // Log significant configuration changes
      if (configData.enabled !== currentConfig.enabled) {
        logger.info(`Shadow mode ${configData.enabled ? 'enabled' : 'disabled'}`, {
          previousState: currentConfig.enabled,
          newState: configData.enabled,
          components: configData.components,
        });
      }

      return updatedConfig;
    } catch (error) {
      logger.error('Failed to update shadow mode configuration', { error, configData });
      throw error;
    }
  }

  async getMetrics(filters: any = {}) {
    try {
      const { component, startDate, endDate, includeDetails = false } = filters;

      // Mock shadow mode metrics - replace with actual monitoring data
      const baseMetrics = {
        overview: {
          enabled: true,
          trafficPercentage: 15,
          activeComponents: ['grading', 'alerts'],
          totalRequests: 45820,
          shadowRequests: 6873, // 15% of total
          successRate: 0.991,
          averageLatency: 145, // milliseconds
          memoryUsage: 512, // MB
          errorRate: 0.003,
        },
        components: {
          grading: {
            enabled: true,
            requests: 3250,
            successRate: 0.994,
            averageLatency: 234,
            memoryUsage: 256,
            errors: 12,
            invariantViolations: 2,
            lastViolation: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
            performance: {
              p50Latency: 180,
              p95Latency: 450,
              p99Latency: 890,
              maxLatency: 1200,
            },
          },
          alerts: {
            enabled: true,
            requests: 2100,
            successRate: 0.987,
            averageLatency: 98,
            memoryUsage: 128,
            errors: 8,
            invariantViolations: 0,
            lastViolation: null,
            performance: {
              p50Latency: 75,
              p95Latency: 185,
              p99Latency: 320,
              maxLatency: 450,
            },
          },
          settlement: {
            enabled: false,
            requests: 0,
            successRate: 0,
            averageLatency: 0,
            memoryUsage: 0,
            errors: 0,
            invariantViolations: 0,
            lastViolation: null,
          },
          feed_agent: {
            enabled: false,
            requests: 0,
            successRate: 0,
            averageLatency: 0,
            memoryUsage: 0,
            errors: 0,
            invariantViolations: 0,
            lastViolation: null,
          },
        },
        invariants: {
          latency: {
            threshold: 5000,
            current: 234,
            violations: 2,
            status: 'healthy',
          },
          memory: {
            threshold: 1024,
            current: 512,
            violations: 0,
            status: 'healthy',
          },
          errorRate: {
            threshold: 0.05,
            current: 0.003,
            violations: 0,
            status: 'healthy',
          },
        },
        timeSeriesData: includeDetails ? this.generateShadowModeTimeSeries() : [],
        recentEvents: includeDetails ? [
          {
            timestamp: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
            type: 'invariant_violation',
            component: 'grading',
            message: 'Latency exceeded 5000ms threshold',
            value: 5234,
            threshold: 5000,
          },
          {
            timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
            type: 'configuration_change',
            message: 'Shadow mode enabled for alerts component',
            component: 'alerts',
          },
        ] : [],
      };

      // Filter by component if specified
      if (component && baseMetrics.components[component]) {
        return {
          overview: baseMetrics.overview,
          component: {
            name: component,
            ...baseMetrics.components[component],
          },
          invariants: baseMetrics.invariants,
          timeSeriesData: baseMetrics.timeSeriesData,
          recentEvents: baseMetrics.recentEvents.filter(e => e.component === component),
        };
      }

      return baseMetrics;
    } catch (error) {
      logger.error('Failed to get shadow mode metrics', { error, filters });
      throw error;
    }
  }

  private generateShadowModeTimeSeries() {
    return Array.from({ length: 24 }, (_, i) => {
      const timestamp = new Date(Date.now() - (24 - i) * 3600000); // Last 24 hours
      return {
        timestamp: timestamp.toISOString(),
        requests: Math.floor(Math.random() * 500) + 100,
        latency: Math.floor(Math.random() * 300) + 50,
        memoryUsage: Math.floor(Math.random() * 200) + 300,
        errorRate: Math.random() * 0.01,
        invariantViolations: Math.random() > 0.9 ? 1 : 0,
      };
    });
  }

  async getReport(filters: any = {}) {
    try {
      const { component, startDate, endDate, includeDetails = false } = filters;
      const metrics = await this.getMetrics(filters);

      const report = {
        summary: {
          reportId: randomUUID(),
          generatedAt: new Date().toISOString(),
          period: {
            start: startDate || new Date(Date.now() - 86400000).toISOString(), // 24h ago
            end: endDate || new Date().toISOString(),
          },
          configuration: await this.getConfiguration(),
        },
        performance: {
          overallHealth: this.calculateHealthScore(metrics),
          componentHealth: Object.entries(metrics.components).map(([name, data]: [string, any]) => ({
            component: name,
            enabled: data.enabled,
            healthScore: this.calculateComponentHealth(data),
            status: data.enabled ? 'active' : 'inactive',
            issues: data.invariantViolations,
          })),
        },
        insights: [
          {
            type: 'performance',
            message: 'Grading component showing 15% higher latency in shadow mode',
            severity: 'medium',
            recommendation: 'Consider optimizing database queries in shadow implementation',
          },
          {
            type: 'reliability',
            message: 'Zero invariant violations in alerts component',
            severity: 'info',
            recommendation: 'Alerts component ready for higher traffic percentage',
          },
          {
            type: 'resource',
            message: 'Memory usage within acceptable limits',
            severity: 'low',
            recommendation: 'Current resource allocation is sufficient',
          },
        ],
        recommendations: {
          trafficPercentage: 25, // Suggested increase
          componentsToEnable: ['settlement'],
          componentsToDisable: [],
          invariantAdjustments: {
            maxLatencyMs: 6000, // Slightly higher threshold based on observations
          },
        },
      };

      return report;
    } catch (error) {
      logger.error('Failed to generate shadow mode report', { error, filters });
      throw error;
    }
  }

  private calculateHealthScore(metrics: any): number {
    let score = 100;

    // Deduct for high error rate
    if (metrics.overview.errorRate > 0.01) score -= 30;
    else if (metrics.overview.errorRate > 0.005) score -= 15;

    // Deduct for high latency
    if (metrics.overview.averageLatency > 1000) score -= 20;
    else if (metrics.overview.averageLatency > 500) score -= 10;

    // Deduct for memory usage
    if (metrics.overview.memoryUsage > 800) score -= 15;
    else if (metrics.overview.memoryUsage > 600) score -= 5;

    return Math.max(0, score);
  }

  private calculateComponentHealth(componentData: any): number {
    if (!componentData.enabled) return 0;

    let score = 100;

    if (componentData.errorRate > 0.01) score -= 40;
    if (componentData.averageLatency > 1000) score -= 30;
    if (componentData.invariantViolations > 0) score -= 20;

    return Math.max(0, score);
  }

  async toggleShadowMode(enabled: boolean) {
    try {
      const currentConfig = await this.getConfiguration();

      const updatedConfig = await this.updateConfiguration({
        enabled,
        // If disabling, also reset traffic percentage
        trafficPercentage: enabled ? currentConfig.trafficPercentage : 0,
      });

      logger.info(`Shadow mode ${enabled ? 'enabled' : 'disabled'} globally`, {
        previousState: currentConfig.enabled,
        components: updatedConfig.components,
      });

      return updatedConfig;
    } catch (error) {
      logger.error('Failed to toggle shadow mode', { error, enabled });
      throw error;
    }
  }
}

const shadowModeService = new ShadowModeService();

/**
 * GET /api/shadow-mode/config
 * Get current shadow mode configuration
 */
router.get(
  '/config',
  requireAuth,
  requireRole(['admin', 'operator']),
  auditMiddleware('read_shadow_mode_config', 'shadow_mode_config'),
  async (req: Request, res: Response) => {
    try {
      const configuration = await shadowModeService.getConfiguration();

      res.json({
        success: true,
        data: configuration,
      });
    } catch (error) {
      logger.error('Failed to get shadow mode configuration', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve shadow mode configuration',
      });
    }
  }
);

/**
 * POST /api/shadow-mode/config
 * Update shadow mode configuration
 */
router.post(
  '/config',
  requireAuth,
  requireRole(['admin']),
  enhancedValidateRequest(routeSchemas.shadowMode.config, {
    requireAuth: true,
    requiredPermissions: ['update:shadow_mode'],
    auditAction: 'update',
    auditResourceType: 'shadow_mode_config',
  }),
  auditMiddleware('update_shadow_mode_config', 'shadow_mode_config'),
  async (req: Request, res: Response) => {
    try {
      const { body } = req.validatedData as any;

      const updatedConfig = await shadowModeService.updateConfiguration(body);

      res.json({
        success: true,
        data: updatedConfig,
        message: 'Shadow mode configuration updated successfully',
      });
    } catch (error) {
      logger.error('Failed to update shadow mode configuration', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to update shadow mode configuration',
      });
    }
  }
);

/**
 * GET /api/shadow-mode/metrics
 * Get shadow mode performance metrics
 */
router.get(
  '/metrics',
  requireAuth,
  requireRole(['admin', 'operator']),
  enhancedValidateRequest(routeSchemas.shadowMode.report, {
    requireAuth: true,
    requiredPermissions: ['read:shadow_mode'],
    auditAction: 'read',
    auditResourceType: 'shadow_mode_metrics',
  }),
  auditMiddleware('read_shadow_mode_metrics', 'shadow_mode_metrics'),
  async (req: Request, res: Response) => {
    try {
      const { query } = req.validatedData as any;
      const metrics = await shadowModeService.getMetrics(query);

      res.json({
        success: true,
        data: metrics,
        meta: {
          refreshedAt: new Date().toISOString(),
          filters: query,
        },
      });
    } catch (error) {
      logger.error('Failed to get shadow mode metrics', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve shadow mode metrics',
      });
    }
  }
);

/**
 * GET /api/shadow-mode/report
 * Generate comprehensive shadow mode report
 */
router.get(
  '/report',
  requireAuth,
  requireRole(['admin', 'operator']),
  enhancedValidateRequest(routeSchemas.shadowMode.report, {
    requireAuth: true,
    requiredPermissions: ['read:shadow_mode'],
    auditAction: 'generate_report',
    auditResourceType: 'shadow_mode_report',
  }),
  auditMiddleware('generate_shadow_mode_report', 'shadow_mode_report'),
  async (req: Request, res: Response) => {
    try {
      const { query } = req.validatedData as any;
      const report = await shadowModeService.getReport(query);

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      logger.error('Failed to generate shadow mode report', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to generate shadow mode report',
      });
    }
  }
);

/**
 * POST /api/shadow-mode/toggle
 * Quick toggle shadow mode on/off
 */
router.post(
  '/toggle',
  requireAuth,
  requireRole(['admin']),
  auditMiddleware('toggle_shadow_mode', 'shadow_mode_config'),
  async (req: Request, res: Response) => {
    try {
      const { enabled = true } = req.body;

      const updatedConfig = await shadowModeService.toggleShadowMode(enabled);

      res.json({
        success: true,
        data: updatedConfig,
        message: `Shadow mode ${enabled ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      logger.error('Failed to toggle shadow mode', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to toggle shadow mode',
      });
    }
  }
);

/**
 * GET /api/shadow-mode/status
 * Get quick shadow mode status
 */
router.get(
  '/status',
  requireAuth,
  requireRole(['admin', 'operator', 'staff']),
  auditMiddleware('read_shadow_mode_status', 'shadow_mode_status'),
  async (req: Request, res: Response) => {
    try {
      const config = await shadowModeService.getConfiguration();
      const metrics = await shadowModeService.getMetrics();

      const status = {
        enabled: config.enabled,
        trafficPercentage: config.trafficPercentage,
        activeComponents: config.components,
        healthScore: shadowModeService['calculateHealthScore'](metrics),
        totalRequests: metrics.overview.shadowRequests,
        errorRate: metrics.overview.errorRate,
        averageLatency: metrics.overview.averageLatency,
        invariantViolations: Object.values(metrics.components).reduce(
          (total: number, comp: any) => total + comp.invariantViolations, 0
        ),
        lastUpdated: config.updatedAt,
      };

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error('Failed to get shadow mode status', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve shadow mode status',
      });
    }
  }
);

/**
 * POST /api/shadow-mode/reset
 * Reset shadow mode configuration to defaults
 */
router.post(
  '/reset',
  requireAuth,
  requireRole(['admin']),
  auditMiddleware('reset_shadow_mode_config', 'shadow_mode_config'),
  async (req: Request, res: Response) => {
    try {
      const { confirm = false } = req.body;

      if (!confirm) {
        res.status(400).json({
          success: false,
          error: 'Shadow mode reset requires explicit confirmation',
          message: 'Set "confirm": true in request body to proceed',
        });
        return;
      }

      // Clear current configuration from cache
      await cache.del('shadow_mode:configuration');

      // Get default configuration (which will be created automatically)
      const defaultConfig = await shadowModeService.getConfiguration();

      logger.warn('Shadow mode configuration reset to defaults', {
        userId: req.user?.id,
        correlationId: req.correlationId,
      });

      res.json({
        success: true,
        data: defaultConfig,
        message: 'Shadow mode configuration reset to defaults',
      });
    } catch (error) {
      logger.error('Failed to reset shadow mode configuration', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to reset shadow mode configuration',
      });
    }
  }
);

export default router;