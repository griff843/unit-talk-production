import { Router, Request, Response } from 'express';
import { routeSchemas } from '../schemas/api-routes';
import { enhancedValidateRequest, auditMiddleware } from '../middleware/enhanced-validation';
import { requireAuth, requireRole } from '../middleware/auth';
import { createLogger } from '../utils/logger';
import { RedisEnhancedCache } from '../cache/enhanced-cache';

const router = Router();
const logger = createLogger('CreditUsageRoutes');
const cache = new RedisEnhancedCache();

// API Credit Usage Service
class CreditUsageService {
  async getUsageMetrics(filters: any = {}) {
    try {
      const { provider, startDate, endDate, granularity = 'day' } = filters;

      // Mock credit usage data - replace with actual monitoring service
      const now = new Date();
      const startTime = startDate ? new Date(startDate) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const endTime = endDate ? new Date(endDate) : now;

      const usageData = {
        providers: {
          optimal: {
            totalCredits: 100000,
            usedCredits: 68500,
            remainingCredits: 31500,
            usageRate: 0.685,
            monthlyBudget: 100000,
            dailyAverage: 2283,
            projectedOverage: 0,
            status: 'healthy',
            endpoints: {
              'props': { credits: 45200, requests: 15400 },
              'odds': { credits: 18900, requests: 6300 },
              'schedule': { credits: 4400, requests: 2200 },
            },
          },
          'odds-api': {
            totalCredits: 75000,
            usedCredits: 52300,
            remainingCredits: 22700,
            usageRate: 0.697,
            monthlyBudget: 75000,
            dailyAverage: 1743,
            projectedOverage: 0,
            status: 'warning', // Over 65% usage
            endpoints: {
              'odds': { credits: 31400, requests: 10466 },
              'scores': { credits: 15700, requests: 5233 },
              'historical': { credits: 5200, requests: 1733 },
            },
          },
          espn: {
            totalCredits: 50000,
            usedCredits: 12800,
            remainingCredits: 37200,
            usageRate: 0.256,
            monthlyBudget: 50000,
            dailyAverage: 427,
            projectedOverage: 0,
            status: 'healthy',
            endpoints: {
              'scores': { credits: 8200, requests: 4100 },
              'players': { credits: 3100, requests: 1550 },
              'schedule': { credits: 1500, requests: 750 },
            },
          },
        },
        alerts: {
          active: [
            {
              provider: 'odds-api',
              level: 'warning',
              message: 'Usage at 69.7% of monthly budget',
              threshold: 0.65,
              current: 0.697,
            },
          ],
          history: [
            {
              provider: 'optimal',
              level: 'info',
              message: 'Projected to stay within budget',
              timestamp: new Date(now.getTime() - 3600000).toISOString(),
            },
          ],
        },
        timeSeriesData: this.generateTimeSeries(startTime, endTime, granularity),
        summary: {
          totalBudget: 225000,
          totalUsed: 133600,
          totalRemaining: 91400,
          overallUsageRate: 0.594,
          projectedMonthEnd: 0.87,
          riskLevel: 'medium',
        },
      };

      return usageData;
    } catch (error) {
      logger.error('Failed to get credit usage metrics', { error });
      throw error;
    }
  }

  private generateTimeSeries(startTime: Date, endTime: Date, granularity: string) {
    const data = [];
    const msInterval = granularity === 'hour' ? 3600000 :
                     granularity === 'day' ? 86400000 :
                     granularity === 'week' ? 604800000 : 2592000000;

    for (let time = startTime.getTime(); time <= endTime.getTime(); time += msInterval) {
      data.push({
        timestamp: new Date(time).toISOString(),
        optimal: Math.floor(Math.random() * 5000) + 1000,
        'odds-api': Math.floor(Math.random() * 3500) + 800,
        espn: Math.floor(Math.random() * 1500) + 200,
      });
    }

    return data;
  }

  async updateBudget(provider: string, budgetData: any) {
    try {
      logger.info('Updating credit budget', { provider, budgetData });

      // In production, update configuration store
      const result = {
        provider,
        previousBudget: 100000,
        newBudget: budgetData.monthlyBudget,
        alertThresholds: budgetData.alertThresholds,
        overagePolicy: budgetData.overagePolicy,
        updatedAt: new Date().toISOString(),
      };

      // Invalidate cache
      await cache.del(`credit_usage:${provider}`);

      return result;
    } catch (error) {
      logger.error('Failed to update credit budget', { error, provider, budgetData });
      throw error;
    }
  }

  async getBudgetConfigurations() {
    try {
      // Mock budget configurations
      return {
        optimal: {
          monthlyBudget: 100000,
          alertThresholds: { warning: 0.7, critical: 0.9 },
          overagePolicy: 'throttle',
          lastUpdated: new Date().toISOString(),
        },
        'odds-api': {
          monthlyBudget: 75000,
          alertThresholds: { warning: 0.65, critical: 0.85 },
          overagePolicy: 'stop',
          lastUpdated: new Date().toISOString(),
        },
        espn: {
          monthlyBudget: 50000,
          alertThresholds: { warning: 0.8, critical: 0.95 },
          overagePolicy: 'continue',
          lastUpdated: new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error('Failed to get budget configurations', { error });
      throw error;
    }
  }
}

const creditUsageService = new CreditUsageService();

/**
 * GET /api/ops/credit-usage
 * Get API credit usage metrics and statistics
 */
router.get(
  '/',
  requireAuth,
  requireRole(['admin', 'operator']),
  enhancedValidateRequest(routeSchemas.ops.creditUsageQuery, {
    requireAuth: true,
    requiredPermissions: ['read:ops'],
    auditAction: 'read',
    auditResourceType: 'credit_usage',
    enableFeatureFlags: true,
  }),
  auditMiddleware('read_credit_usage', 'credit_usage'),
  async (req: Request, res: Response) => {
    try {
      const { query } = req.validatedData as any;
      const metrics = await creditUsageService.getUsageMetrics(query);

      res.json({
        success: true,
        data: metrics,
        meta: {
          refreshedAt: new Date().toISOString(),
          filters: query,
        },
      });
    } catch (error) {
      logger.error('Failed to get credit usage metrics', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve credit usage metrics',
      });
    }
  }
);

/**
 * POST /api/ops/credit-usage/budget
 * Update API credit budget configuration
 */
router.post(
  '/budget',
  requireAuth,
  requireRole(['admin', 'operator']),
  enhancedValidateRequest(routeSchemas.ops.creditBudgetUpdate, {
    requireAuth: true,
    requiredPermissions: ['update:ops'],
    auditAction: 'update',
    auditResourceType: 'credit_budget',
  }),
  auditMiddleware('update_credit_budget', 'credit_budget'),
  async (req: Request, res: Response) => {
    try {
      const { body } = req.validatedData as any;
      const result = await creditUsageService.updateBudget(body.provider, body);

      res.json({
        success: true,
        data: result,
        message: 'Credit budget updated successfully',
      });
    } catch (error) {
      logger.error('Failed to update credit budget', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
        provider: req.body?.provider,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to update credit budget',
      });
    }
  }
);

/**
 * GET /api/ops/credit-usage/budgets
 * Get all budget configurations
 */
router.get(
  '/budgets',
  requireAuth,
  requireRole(['admin', 'operator']),
  auditMiddleware('read_credit_budgets', 'credit_budget'),
  async (req: Request, res: Response) => {
    try {
      const budgets = await creditUsageService.getBudgetConfigurations();

      res.json({
        success: true,
        data: budgets,
      });
    } catch (error) {
      logger.error('Failed to get credit budgets', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve credit budgets',
      });
    }
  }
);

/**
 * GET /api/ops/credit-usage/alerts
 * Get active and recent credit usage alerts
 */
router.get(
  '/alerts',
  requireAuth,
  requireRole(['admin', 'operator']),
  auditMiddleware('read_credit_alerts', 'credit_alert'),
  async (req: Request, res: Response) => {
    try {
      const metrics = await creditUsageService.getUsageMetrics();

      res.json({
        success: true,
        data: {
          active: metrics.alerts.active,
          recent: metrics.alerts.history.slice(0, 10), // Last 10 alerts
          summary: {
            activeCount: metrics.alerts.active.length,
            criticalCount: metrics.alerts.active.filter(a => a.level === 'critical').length,
            warningCount: metrics.alerts.active.filter(a => a.level === 'warning').length,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to get credit usage alerts', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve credit usage alerts',
      });
    }
  }
);

/**
 * POST /api/ops/credit-usage/test-alert
 * Test credit usage alert system
 */
router.post(
  '/test-alert',
  requireAuth,
  requireRole(['admin']),
  auditMiddleware('test_credit_alert_system', 'credit_alert'),
  async (req: Request, res: Response) => {
    try {
      const { provider = 'test', alertLevel = 'warning' } = req.body;

      logger.info('Testing credit usage alert system', {
        provider,
        alertLevel,
        userId: req.user?.id,
        correlationId: req.correlationId,
      });

      // Mock alert trigger - in production, this would trigger actual alert system
      const testAlert = {
        id: `test-${Date.now()}`,
        provider,
        level: alertLevel,
        message: `Test alert for ${provider} at ${alertLevel} level`,
        threshold: 0.8,
        current: 0.85,
        timestamp: new Date().toISOString(),
        isTest: true,
      };

      res.json({
        success: true,
        data: testAlert,
        message: 'Test alert triggered successfully',
      });
    } catch (error) {
      logger.error('Failed to test credit alert system', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to test credit alert system',
      });
    }
  }
);

export default router;