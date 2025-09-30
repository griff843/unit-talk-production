import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { routeSchemas } from '../schemas/api-routes';
import { enhancedValidateRequest, auditMiddleware } from '../middleware/enhanced-validation';
import { requireAuth, requireRole } from '../middleware/auth';
import { createLogger } from '../utils/logger';
import { RedisEnhancedCache } from '../cache/enhanced-cache';

const router = Router();
const logger = createLogger('AlertsRoutes');
const cache = new RedisEnhancedCache();

// Alert Replay Service for debugging and testing
class AlertReplayService {
  async replayAlerts(replayConfig: any) {
    try {
      const { alertId, pickId, userId, type, timeRange, filters, dryRun } = replayConfig;

      logger.info('Alert replay initiated', {
        alertId,
        pickId,
        userId,
        type,
        timeRange,
        dryRun,
      });

      // Generate replay job ID
      const replayJobId = randomUUID();

      // Mock alert data - in production, this would query historical alerts
      const mockAlerts = this.generateMockAlerts(replayConfig);

      if (dryRun) {
        return {
          replayJobId,
          status: 'dry_run_completed',
          summary: {
            alertsFound: mockAlerts.length,
            alertsToReplay: mockAlerts.filter(a => a.shouldReplay).length,
            estimatedDuration: mockAlerts.length * 0.5, // 0.5 seconds per alert
            preview: mockAlerts.slice(0, 3), // Show first 3 alerts
          },
          message: 'Dry run completed successfully',
        };
      }

      // Start actual replay process
      const replayResults = await this.executeReplay(mockAlerts, replayJobId);

      return {
        replayJobId,
        status: 'initiated',
        ...replayResults,
      };
    } catch (error) {
      logger.error('Alert replay failed', { error, replayConfig });
      throw error;
    }
  }

  private generateMockAlerts(config: any) {
    const alertTypes = ['injury', 'line_movement', 'steam', 'middle', 'arbitrage', 'clv_alert'];
    const selectedType = config.type || alertTypes[Math.floor(Math.random() * alertTypes.length)];

    const mockAlerts = Array.from({ length: Math.floor(Math.random() * 20) + 5 }, (_, i) => ({
      id: randomUUID(),
      type: selectedType,
      severity: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
      pickId: config.pickId || randomUUID(),
      userId: config.userId || randomUUID(),
      sport: config.filters?.sport || 'NBA',
      message: `Mock ${selectedType} alert #${i + 1}`,
      originalTimestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(), // Random within last 24h
      channelsSent: ['discord', 'email'],
      data: {
        originalValue: Math.random() * 100,
        newValue: Math.random() * 100,
        threshold: 10,
        confidence: Math.random(),
      },
      shouldReplay: Math.random() > 0.2, // 80% replay rate
      replayReason: 'Debug analysis request',
    }));

    // Filter by config
    return mockAlerts.filter(alert => {
      if (config.alertId && alert.id !== config.alertId) return false;
      if (config.type && alert.type !== config.type) return false;
      if (config.filters?.sport && alert.sport !== config.filters.sport) return false;
      if (config.filters?.minSeverity) {
        const severityLevels = { low: 1, medium: 2, high: 3 };
        const minLevel = severityLevels[config.filters.minSeverity as keyof typeof severityLevels];
        const alertLevel = severityLevels[alert.severity as keyof typeof severityLevels];
        if (alertLevel < minLevel) return false;
      }
      return true;
    });
  }

  private async executeReplay(alerts: any[], replayJobId: string) {
    try {
      const replayResults = {
        totalAlerts: alerts.length,
        successCount: 0,
        failureCount: 0,
        skippedCount: 0,
        startedAt: new Date().toISOString(),
        estimatedCompletion: new Date(Date.now() + alerts.length * 500).toISOString(), // 0.5s per alert
        results: [] as any[],
      };

      // Cache initial results
      await cache.set(`alert_replay:${replayJobId}`, JSON.stringify(replayResults), 3600);

      // In production, this would be an async job
      // For now, simulate immediate processing
      for (const alert of alerts) {
        if (alert.shouldReplay) {
          const success = Math.random() > 0.1; // 90% success rate

          if (success) {
            replayResults.successCount++;
            replayResults.results.push({
              alertId: alert.id,
              status: 'replayed',
              channels: alert.channelsSent,
              timestamp: new Date().toISOString(),
            });
          } else {
            replayResults.failureCount++;
            replayResults.results.push({
              alertId: alert.id,
              status: 'failed',
              error: 'Mock replay failure',
              timestamp: new Date().toISOString(),
            });
          }
        } else {
          replayResults.skippedCount++;
          replayResults.results.push({
            alertId: alert.id,
            status: 'skipped',
            reason: 'Does not meet replay criteria',
            timestamp: new Date().toISOString(),
          });
        }
      }

      replayResults.estimatedCompletion = new Date().toISOString();

      // Update cache with final results
      await cache.set(`alert_replay:${replayJobId}`, JSON.stringify(replayResults), 3600);

      return replayResults;
    } catch (error) {
      logger.error('Alert replay execution failed', { error, replayJobId });
      throw error;
    }
  }

  async getReplayStatus(replayJobId: string) {
    try {
      const cached = await cache.get(`alert_replay:${replayJobId}`);
      if (cached) {
        return JSON.parse(cached);
      }

      throw new Error(`Replay job ${replayJobId} not found`);
    } catch (error) {
      logger.error('Failed to get replay status', { error, replayJobId });
      throw error;
    }
  }

  async getRecentReplays(limit = 10) {
    try {
      // Mock recent replays - in production, query from database
      return Array.from({ length: Math.min(limit, 5) }, (_, i) => ({
        replayJobId: randomUUID(),
        initiatedBy: 'admin',
        type: ['injury', 'line_movement', 'steam'][Math.floor(Math.random() * 3)],
        status: ['completed', 'running', 'failed'][Math.floor(Math.random() * 3)],
        alertsReplayed: Math.floor(Math.random() * 50) + 5,
        startedAt: new Date(Date.now() - (i * 300000)).toISOString(),
        completedAt: i < 3 ? new Date(Date.now() - (i * 300000) + 30000).toISOString() : null,
      }));
    } catch (error) {
      logger.error('Failed to get recent replays', { error });
      throw error;
    }
  }

  async getAlertHistory(filters: any = {}) {
    try {
      const { type, sport, startDate, endDate, limit = 50 } = filters;

      // Mock alert history
      const alerts = Array.from({ length: Math.min(limit, 100) }, (_, i) => ({
        id: randomUUID(),
        type: type || ['injury', 'line_movement', 'steam', 'middle', 'arbitrage', 'clv_alert'][Math.floor(Math.random() * 6)],
        severity: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        sport: sport || ['NBA', 'NFL', 'MLB', 'NHL'][Math.floor(Math.random() * 4)],
        message: `Historical alert ${i + 1}`,
        timestamp: new Date(Date.now() - Math.random() * 2592000000).toISOString(), // Random within last 30 days
        pickId: randomUUID(),
        userId: randomUUID(),
        channelsSent: Math.random() > 0.5 ? ['discord'] : ['discord', 'email'],
        processed: Math.random() > 0.1, // 90% processed
        replayCount: Math.floor(Math.random() * 3),
      }));

      return {
        alerts,
        total: alerts.length,
        filters,
      };
    } catch (error) {
      logger.error('Failed to get alert history', { error });
      throw error;
    }
  }
}

const alertReplayService = new AlertReplayService();

/**
 * POST /api/alerts/replay
 * Replay alert processing for debugging and testing
 */
router.post(
  '/replay',
  requireAuth,
  requireRole(['admin', 'operator']),
  enhancedValidateRequest(routeSchemas.alerts.replay, {
    requireAuth: true,
    requiredPermissions: ['create:alerts'],
    auditAction: 'replay',
    auditResourceType: 'alert',
    enableFeatureFlags: true,
  }),
  auditMiddleware('replay_alerts', 'alert'),
  async (req: Request, res: Response) => {
    try {
      const { body } = req.validatedData as any;
      const replayResults = await alertReplayService.replayAlerts(body);

      res.json({
        success: true,
        data: replayResults,
        message: body.dryRun ? 'Dry run completed' : 'Alert replay initiated',
      });
    } catch (error) {
      logger.error('Failed to replay alerts', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to replay alerts',
      });
    }
  }
);

/**
 * GET /api/alerts/replay/:replayJobId
 * Get status of alert replay job
 */
router.get(
  '/replay/:replayJobId',
  requireAuth,
  requireRole(['admin', 'operator', 'staff']),
  auditMiddleware('read_alert_replay_status', 'alert_replay', (req) => req.params.replayJobId),
  async (req: Request, res: Response) => {
    try {
      const { replayJobId } = req.params;
      const status = await alertReplayService.getReplayStatus(replayJobId);

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error('Failed to get alert replay status', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
        replayJobId: req.params.replayJobId,
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get alert replay status',
      });
    }
  }
);

/**
 * GET /api/alerts/replay/jobs/recent
 * Get list of recent alert replay jobs
 */
router.get(
  '/replay/jobs/recent',
  requireAuth,
  requireRole(['admin', 'operator', 'staff']),
  auditMiddleware('list_recent_alert_replays', 'alert_replay'),
  async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const recentReplays = await alertReplayService.getRecentReplays(limit);

      res.json({
        success: true,
        data: recentReplays,
        meta: {
          total: recentReplays.length,
          limit,
        },
      });
    } catch (error) {
      logger.error('Failed to get recent alert replays', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get recent alert replays',
      });
    }
  }
);

/**
 * GET /api/alerts/history
 * Get alert history for analysis
 */
router.get(
  '/history',
  requireAuth,
  requireRole(['admin', 'operator', 'staff']),
  auditMiddleware('read_alert_history', 'alert'),
  async (req: Request, res: Response) => {
    try {
      const history = await alertReplayService.getAlertHistory(req.query);

      res.json({
        success: true,
        data: history.alerts,
        meta: {
          total: history.total,
          filters: history.filters,
        },
      });
    } catch (error) {
      logger.error('Failed to get alert history', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get alert history',
      });
    }
  }
);

/**
 * POST /api/alerts/replay/:replayJobId/cancel
 * Cancel a running alert replay job
 */
router.post(
  '/replay/:replayJobId/cancel',
  requireAuth,
  requireRole(['admin', 'operator']),
  auditMiddleware('cancel_alert_replay', 'alert_replay', (req) => req.params.replayJobId),
  async (req: Request, res: Response) => {
    try {
      const { replayJobId } = req.params;

      logger.info('Alert replay cancellation requested', {
        replayJobId,
        userId: req.user?.id,
        correlationId: req.correlationId,
      });

      // In production, this would send cancellation signal to the replay job
      res.json({
        success: true,
        data: {
          replayJobId,
          status: 'cancellation_requested',
          message: 'Replay cancellation request submitted',
        },
      });
    } catch (error) {
      logger.error('Failed to cancel alert replay', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
        replayJobId: req.params.replayJobId,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to cancel alert replay',
      });
    }
  }
);

/**
 * GET /api/alerts/metrics
 * Get alert system performance metrics
 */
router.get(
  '/metrics',
  requireAuth,
  requireRole(['admin', 'operator', 'staff']),
  auditMiddleware('read_alert_metrics', 'alert_metrics'),
  async (req: Request, res: Response) => {
    try {
      // Mock alert metrics
      const metrics = {
        totalAlerts: 45820,
        alertsToday: 284,
        successRate: 0.987,
        averageProcessingTime: 145, // milliseconds
        alertTypes: {
          injury: { count: 15200, successRate: 0.994 },
          line_movement: { count: 18500, successRate: 0.989 },
          steam: { count: 8200, successRate: 0.982 },
          middle: { count: 2100, successRate: 0.995 },
          arbitrage: { count: 1500, successRate: 0.991 },
          clv_alert: { count: 320, successRate: 0.975 },
        },
        channels: {
          discord: { sent: 42100, delivered: 41950, failureRate: 0.004 },
          email: { sent: 15600, delivered: 15520, failureRate: 0.005 },
          sms: { sent: 8900, delivered: 8850, failureRate: 0.006 },
          webhook: { sent: 5200, delivered: 5180, failureRate: 0.004 },
        },
        recentErrors: [
          { type: 'discord_rate_limit', count: 12, lastOccurrence: new Date(Date.now() - 300000).toISOString() },
          { type: 'email_bounce', count: 8, lastOccurrence: new Date(Date.now() - 1800000).toISOString() },
        ],
      };

      res.json({
        success: true,
        data: metrics,
        meta: {
          refreshedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Failed to get alert metrics', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get alert metrics',
      });
    }
  }
);

export default router;