/**
 * Platform Threshold Evaluator
 * Sprint: SPRINT-043-LAYER2-PHASE7-RELIABILITY-MONITORING
 * Layer/Phase: Layer 2 / Phase 7 — Reliability & Monitoring
 *
 * Evaluates key platform thresholds and returns structured alerts.
 * Called by GET /api/health/summary to populate active alerts.
 *
 * Thresholds (from docs/ops/SLO_DEFINITIONS.md):
 * - Drawdown freeze: if RiskEngine reports isFreeze=true → HIGH
 * - Outbox depth: if pick_publish pending > 20 → MEDIUM
 * - SLO breach: if any SLO attainment < target-0.05 → HIGH; < target → MEDIUM
 * - Worker heartbeat: if any worker_heartbeat > 10min stale → HIGH
 */

import { SupabaseClient } from '@supabase/supabase-js';

import { SloEntry, deriveRateSloStatus, deriveLatencySloStatus } from '../routes/slo';
import { createLogger } from '../utils/logger';

import { getOutboxDepthMetrics } from './publishOutbox';
import { RiskEngine } from './risk/RiskEngine';

const logger = createLogger('PlatformThresholdEvaluator');

export type AlertSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface PlatformAlert {
  id: string;
  severity: AlertSeverity;
  message: string;
  source: 'drawdown' | 'outbox' | 'slo' | 'heartbeat';
  detected_at: string;
}

export interface ThresholdEvaluationResult {
  alerts: PlatformAlert[];
  evaluated_at: string;
}

const OUTBOX_STALE_THRESHOLD = 20; // pending count > 20 = MEDIUM alert
const HEARTBEAT_STALE_MINUTES = 10; // > 10 min = HIGH alert

/** Check drawdown freeze state. */
async function checkDrawdown(db: SupabaseClient): Promise<PlatformAlert[]> {
  try {
    const riskEngine = RiskEngine.getInstance();
    const drawdown = await riskEngine.computeDrawdown(db);
    if (drawdown.frozen) {
      return [
        {
          id: 'drawdown_freeze',
          severity: 'HIGH',
          message: `Drawdown freeze active — daily P&L has breached freeze threshold. Promotion suspended.`,
          source: 'drawdown',
          detected_at: new Date().toISOString(),
        },
      ];
    }
  } catch (err) {
    logger.warn('Drawdown threshold check failed', {
      error: err instanceof Error ? err.message : err,
    });
  }
  return [];
}

/** Check outbox depth. */
async function checkOutbox(db: SupabaseClient): Promise<PlatformAlert[]> {
  try {
    const metrics = await getOutboxDepthMetrics(db);
    if (metrics.pendingCount > OUTBOX_STALE_THRESHOLD || metrics.staleAlert) {
      return [
        {
          id: 'outbox_depth',
          severity: 'MEDIUM',
          message: `Outbox depth alert — ${metrics.pendingCount} pending rows, oldest ${metrics.oldestPendingAgeMinutes ?? 'N/A'}min. Discord posting may be delayed.`,
          source: 'outbox',
          detected_at: new Date().toISOString(),
        },
      ];
    }
  } catch (err) {
    logger.warn('Outbox threshold check failed', {
      error: err instanceof Error ? err.message : err,
    });
  }
  return [];
}

/** Check SLO breaches from pre-computed SLO entries. */
function checkSloBreaches(slos: SloEntry[]): PlatformAlert[] {
  const alerts: PlatformAlert[] = [];
  for (const slo of slos) {
    if (slo.status === 'BREACH') {
      alerts.push({
        id: `slo_breach_${slo.id}`,
        severity: 'HIGH',
        message: `SLO BREACH: ${slo.name} — attainment ${slo.attainment} below breach threshold (target ${slo.target}, breach at ${slo.unit === 'seconds' ? slo.target * 2 : slo.target - 0.05})`,
        source: 'slo',
        detected_at: new Date().toISOString(),
      });
    } else if (slo.status === 'WARN') {
      alerts.push({
        id: `slo_warn_${slo.id}`,
        severity: 'MEDIUM',
        message: `SLO WARN: ${slo.name} — attainment ${slo.attainment} below target ${slo.target}`,
        source: 'slo',
        detected_at: new Date().toISOString(),
      });
    }
  }
  return alerts;
}

/** Check worker heartbeat staleness. */
async function checkHeartbeats(db: SupabaseClient): Promise<PlatformAlert[]> {
  try {
    const { data: heartbeats } = await db
      .from('ops_worker_heartbeats')
      .select('worker_name, last_heartbeat_at')
      .order('last_heartbeat_at', { ascending: false });

    const alerts: PlatformAlert[] = [];
    for (const row of heartbeats ?? []) {
      if (!row.last_heartbeat_at) {
        alerts.push({
          id: `heartbeat_missing_${row.worker_name}`,
          severity: 'HIGH',
          message: `Worker heartbeat missing: ${row.worker_name} has never reported a heartbeat`,
          source: 'heartbeat',
          detected_at: new Date().toISOString(),
        });
        continue;
      }
      const ageMinutes = (Date.now() - new Date(row.last_heartbeat_at).getTime()) / 60000;
      if (ageMinutes > HEARTBEAT_STALE_MINUTES) {
        alerts.push({
          id: `heartbeat_stale_${row.worker_name}`,
          severity: 'HIGH',
          message: `Worker heartbeat stale: ${row.worker_name} last seen ${Math.floor(ageMinutes)}min ago (threshold: ${HEARTBEAT_STALE_MINUTES}min)`,
          source: 'heartbeat',
          detected_at: new Date().toISOString(),
        });
      }
    }
    return alerts;
  } catch (err) {
    logger.warn('Heartbeat threshold check failed', {
      error: err instanceof Error ? err.message : err,
    });
    return [];
  }
}

/**
 * Evaluate all platform thresholds in parallel.
 * Accepts pre-computed SLOs to avoid re-querying DB.
 */
export async function evaluatePlatformThresholds(
  db: SupabaseClient,
  slos: SloEntry[] = []
): Promise<ThresholdEvaluationResult> {
  const [drawdownAlerts, outboxAlerts, heartbeatAlerts] = await Promise.all([
    checkDrawdown(db),
    checkOutbox(db),
    checkHeartbeats(db),
  ]);

  const sloAlerts = checkSloBreaches(slos);

  const alerts = [...drawdownAlerts, ...outboxAlerts, ...sloAlerts, ...heartbeatAlerts];

  // Log HIGH alerts
  for (const alert of alerts.filter(a => a.severity === 'HIGH')) {
    logger.warn('Platform threshold alert', { alertId: alert.id, message: alert.message });
  }

  return {
    alerts,
    evaluated_at: new Date().toISOString(),
  };
}
