/**
 * Operator Alert Discovery Routes
 *
 * SPRINT-061-LAYER3-PHASE10-CC-ALERT-DASHBOARD (original)
 * SPRINT-REM-002-ALERT-PIPELINE-ACTIVATION (fix)
 * Layer/Phase: Layer 3 / Phase 10 — Command Center UX
 *
 * GET /ops/alerts  → list all active alerts from:
 *   1. EnhancedAlertManager (programmatic alerts from workflow failures etc.)
 *   2. PlatformThresholdEvaluator (dynamic threshold alerts — same source as /health/summary)
 *
 * This reconciles the alert discrepancy between /health/summary and /ops/alerts.
 * Both surfaces now use the same PlatformThresholdEvaluator as their dynamic source.
 *
 * Auth: operatorAuth (JWT)
 * Audit: operatorAuditLog (read operations logged for traceability)
 */

import { type IRouter, Router } from 'express';

import { operatorAuditLog } from '../middleware/operatorAuditLog';
import { operatorAuth } from '../middleware/operatorAuth';
import { alertManager, type Alert } from '../monitoring/alerts';
import {
  evaluatePlatformThresholds,
  type PlatformAlert,
} from '../services/PlatformThresholdEvaluator';
import { supabase } from '../services/supabaseClient';
import { createLogger } from '../utils/logger';

const router: IRouter = Router();
const logger = createLogger('ops-alerts');

/**
 * Map PlatformAlert severity (HIGH/MEDIUM/LOW) to Alert severity (critical/warning/info).
 */
function mapThresholdSeverity(severity: PlatformAlert['severity']): Alert['severity'] {
  switch (severity) {
    case 'HIGH':
      return 'critical';
    case 'MEDIUM':
      return 'warning';
    case 'LOW':
      return 'info';
    default:
      return 'info';
  }
}

/**
 * Convert a PlatformAlert (from threshold evaluator) to the Alert shape
 * expected by /ops/alerts consumers.
 */
function toAlert(pa: PlatformAlert): Alert {
  return {
    id: pa.id,
    ruleId: `threshold_${pa.source}`,
    title: pa.message.split('—')[0]?.trim() || pa.message,
    description: pa.message,
    severity: mapThresholdSeverity(pa.severity),
    timestamp: pa.detected_at,
    value: 0,
    threshold: 0,
    status: 'active',
    channels: [],
    tags: [pa.source],
    metadata: { source: pa.source, evaluatedFrom: 'PlatformThresholdEvaluator' },
  };
}

// Auth + audit for all alert routes
router.use('/alerts', operatorAuth, operatorAuditLog);

/**
 * GET /ops/alerts
 * Returns all active alerts from both:
 *   - EnhancedAlertManager (programmatic alerts)
 *   - PlatformThresholdEvaluator (dynamic threshold alerts)
 *
 * SPRINT-REM-002: Reconciles alert discrepancy with /health/summary.
 */
router.get('/alerts', async (req, res) => {
  try {
    // 1. Programmatic alerts from alertManager (workflow failures, operator alerts)
    const programmaticAlerts = alertManager.getActiveAlerts();

    // 2. Dynamic threshold alerts (same source as /health/summary)
    let thresholdAlerts: Alert[] = [];
    try {
      const thresholds = await evaluatePlatformThresholds(supabase);
      thresholdAlerts = thresholds.alerts.map(toAlert);
    } catch (err) {
      logger.warn('Threshold evaluation failed — returning programmatic alerts only', {
        error: err instanceof Error ? err.message : err,
      });
    }

    // 3. Merge — deduplicate by id (programmatic alerts take precedence)
    const alertMap = new Map<string, Alert>();
    for (const a of thresholdAlerts) {
      alertMap.set(a.id, a);
    }
    for (const a of programmaticAlerts) {
      alertMap.set(a.id, a);
    }
    const alerts = Array.from(alertMap.values());

    const bySeverity = {
      info: alerts.filter(a => a.severity === 'info').length,
      warning: alerts.filter(a => a.severity === 'warning').length,
      critical: alerts.filter(a => a.severity === 'critical').length,
    };

    logger.info('Alert registry queried', {
      total: alerts.length,
      programmatic: programmaticAlerts.length,
      threshold: thresholdAlerts.length,
      bySeverity,
    });

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
