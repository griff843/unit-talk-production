/**
 * Operator Alert Discovery Routes
 *
 * SPRINT-061-LAYER3-PHASE10-CC-ALERT-DASHBOARD
 * Layer/Phase: Layer 3 / Phase 10 — Command Center UX
 *
 * GET /ops/alerts  → list all active alerts from EnhancedAlertManager
 *
 * Auth: operatorAuth (JWT)
 * Audit: operatorAuditLog (read operations logged for traceability)
 */

import { type IRouter, Router } from 'express';

import { operatorAuditLog } from '../middleware/operatorAuditLog';
import { operatorAuth } from '../middleware/operatorAuth';
import { alertManager } from '../monitoring/alerts';
import { createLogger } from '../utils/logger';

const router: IRouter = Router();
const logger = createLogger('ops-alerts');

// Auth + audit for all alert routes
router.use('/alerts', operatorAuth, operatorAuditLog);

/**
 * GET /ops/alerts
 * Returns all active alerts from EnhancedAlertManager.
 */
router.get('/alerts', (req, res) => {
  try {
    const alerts = alertManager.getActiveAlerts();

    const bySeverity = {
      info: alerts.filter(a => a.severity === 'info').length,
      warning: alerts.filter(a => a.severity === 'warning').length,
      critical: alerts.filter(a => a.severity === 'critical').length,
    };

    logger.info('Alert registry queried', { total: alerts.length, bySeverity });

    return res.json({
      alerts,
      meta: {
        total: alerts.length,
        bySeverity,
      },
    });
  } catch (err) {
    logger.error('Failed to retrieve alerts', { error: err });
    return res.status(500).json({ error: 'Failed to retrieve alerts' });
  }
});

export default router;
