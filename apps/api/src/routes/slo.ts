/**
 * SLO Status Route
 * Sprint: SPRINT-043-LAYER2-PHASE7-RELIABILITY-MONITORING
 * Layer/Phase: Layer 2 / Phase 7 — Reliability & Monitoring
 *
 * GET /api/slo/status → SLO attainment for 7-day rolling window
 *
 * Auth: operatorAuth (JWT in production, system operator in dev, E2E bypass in test)
 *
 * SLOs defined in docs/ops/SLO_DEFINITIONS.md
 */

import { SupabaseClient } from '@supabase/supabase-js';
import express, { Router } from 'express';

import { operatorAuditLog } from '../middleware/operatorAuditLog';
import { operatorAuth } from '../middleware/operatorAuth';
import { supabase } from '../services/supabaseClient';
import { createLogger } from '../utils/logger';

const logger = createLogger('SloRouter');
const router: Router = express.Router();

// SPRINT-045-OPERATOR-AUTH-HARDENING: Use JWT-based operatorAuth instead of weak admin token
router.use(operatorAuth);
// SPRINT-046-OPERATOR-AUDIT-TRAIL: Immutable audit log for all operator actions
router.use(operatorAuditLog);

export type SloStatus = 'OK' | 'WARN' | 'BREACH';

export interface SloEntry {
  id: string;
  name: string;
  target: number;
  attainment: number;
  status: SloStatus;
  numerator?: number;
  denominator?: number;
  unit: string;
}

export interface SloStatusResponse {
  window_days: number;
  computed_at: string;
  slos: SloEntry[];
}

/** Derive SLO status from attainment vs target (for rate SLOs, 0–1 scale). */
function deriveRateSloStatus(attainment: number, target: number): SloStatus {
  if (attainment >= target) return 'OK';
  if (attainment >= target - 0.05) return 'WARN';
  return 'BREACH';
}

/** Derive SLO status for latency SLO (lower is better). */
function deriveLatencySloStatus(attainmentSeconds: number, targetSeconds: number): SloStatus {
  if (attainmentSeconds <= targetSeconds) return 'OK';
  if (attainmentSeconds <= targetSeconds * 2) return 'WARN';
  return 'BREACH';
}

/** SLO 1: Pick Lifecycle Completion Rate */
async function computeLifecycleCompletionSlo(db: SupabaseClient): Promise<SloEntry> {
  const { data, error } = await db
    .from('unified_picks')
    .select('settlement_status, settled_at, created_at')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  if (error || !data) {
    return {
      id: 'lifecycle_completion',
      name: 'Pick Lifecycle Completion Rate',
      target: 0.95,
      attainment: 0,
      status: 'BREACH',
      unit: 'ratio',
    };
  }

  const total = data.length;
  const settled = data.filter(row => {
    if (row.settlement_status !== 'settled' || !row.settled_at || !row.created_at) return false;
    const durationMs = new Date(row.settled_at).getTime() - new Date(row.created_at).getTime();
    return durationMs <= 72 * 60 * 60 * 1000; // 72h in ms
  }).length;

  const attainment = total > 0 ? settled / total : 1; // no picks = OK
  return {
    id: 'lifecycle_completion',
    name: 'Pick Lifecycle Completion Rate',
    target: 0.95,
    attainment: Math.round(attainment * 10000) / 10000,
    status: deriveRateSloStatus(attainment, 0.95),
    numerator: settled,
    denominator: total,
    unit: 'ratio',
  };
}

/** SLO 2: Discord Posting Success Rate */
async function computeDiscordPostingSlo(db: SupabaseClient): Promise<SloEntry> {
  const { data, error } = await db
    .from('pick_publish')
    .select('status')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  if (error || !data) {
    return {
      id: 'discord_posting',
      name: 'Discord Posting Success Rate',
      target: 0.98,
      attainment: 0,
      status: 'BREACH',
      unit: 'ratio',
    };
  }

  const total = data.length;
  const posted = data.filter(row => row.status === 'posted').length;
  const attainment = total > 0 ? posted / total : 1; // no rows = OK

  return {
    id: 'discord_posting',
    name: 'Discord Posting Success Rate',
    target: 0.98,
    attainment: Math.round(attainment * 10000) / 10000,
    status: deriveRateSloStatus(attainment, 0.98),
    numerator: posted,
    denominator: total,
    unit: 'ratio',
  };
}

/** SLO 3: Grading Latency p50 (seconds from created_at to promotion_status=queued) */
async function computeGradingLatencySlo(db: SupabaseClient): Promise<SloEntry> {
  const TARGET_SECONDS = 300; // 5 minutes

  const { data, error } = await db
    .from('unified_picks')
    .select('created_at, updated_at')
    .eq('promotion_status', 'queued')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  if (error || !data || data.length === 0) {
    // No picks promoted = no latency to measure; treat as OK
    return {
      id: 'grading_latency_p50',
      name: 'Grading Latency (p50)',
      target: TARGET_SECONDS,
      attainment: 0,
      status: 'OK',
      unit: 'seconds',
    };
  }

  const durations = data
    .map(row => {
      if (!row.created_at || !row.updated_at) return null;
      return (new Date(row.updated_at).getTime() - new Date(row.created_at).getTime()) / 1000;
    })
    .filter((d): d is number => d !== null && d >= 0)
    .sort((a, b) => a - b);

  const p50 = durations.length > 0 ? durations[Math.floor(durations.length * 0.5)] : 0;

  return {
    id: 'grading_latency_p50',
    name: 'Grading Latency (p50)',
    target: TARGET_SECONDS,
    attainment: Math.round(p50),
    status: deriveLatencySloStatus(p50, TARGET_SECONDS),
    denominator: durations.length,
    unit: 'seconds',
  };
}

/** SLO 4: Settlement Accuracy */
async function computeSettlementAccuracySlo(db: SupabaseClient): Promise<SloEntry> {
  const { data, error } = await db
    .from('unified_picks')
    .select('settlement_status')
    .eq('settlement_status', 'settled')
    .gte('settled_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  if (error || !data) {
    return {
      id: 'settlement_accuracy',
      name: 'Settlement Accuracy',
      target: 0.995,
      attainment: 0,
      status: 'BREACH',
      unit: 'ratio',
    };
  }

  const total = data.length;
  const clean = data.filter(row => row.settlement_status !== 'disputed').length;
  const attainment = total > 0 ? clean / total : 1; // no settlements = OK

  return {
    id: 'settlement_accuracy',
    name: 'Settlement Accuracy',
    target: 0.995,
    attainment: Math.round(attainment * 10000) / 10000,
    status: deriveRateSloStatus(attainment, 0.995),
    numerator: clean,
    denominator: total,
    unit: 'ratio',
  };
}

/**
 * GET /api/slo/status
 * Returns SLO attainment for the 7-day rolling window.
 */
router.get('/status', async (_req, res) => {
  try {
    const results = await Promise.allSettled([
      computeLifecycleCompletionSlo(supabase),
      computeDiscordPostingSlo(supabase),
      computeGradingLatencySlo(supabase),
      computeSettlementAccuracySlo(supabase),
    ]);

    const slos: SloEntry[] = results.map((result, i) => {
      if (result.status === 'fulfilled') return result.value;
      // On individual failure, return a BREACH entry
      const ids = [
        'lifecycle_completion',
        'discord_posting',
        'grading_latency_p50',
        'settlement_accuracy',
      ];
      const names = [
        'Pick Lifecycle Completion Rate',
        'Discord Posting Success Rate',
        'Grading Latency (p50)',
        'Settlement Accuracy',
      ];
      const targets = [0.95, 0.98, 300, 0.995];
      const units = ['ratio', 'ratio', 'seconds', 'ratio'];
      logger.error(`SLO computation failed for ${ids[i]}`, { error: result.reason });
      return {
        id: ids[i],
        name: names[i],
        target: targets[i],
        attainment: 0,
        status: 'BREACH' as SloStatus,
        unit: units[i],
      };
    });

    const response: SloStatusResponse = {
      window_days: 7,
      computed_at: new Date().toISOString(),
      slos,
    };

    res.json({ success: true, data: response, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('SLO status computation failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    res.status(500).json({
      success: false,
      error: 'Failed to compute SLO status',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;

// Export computation functions for use in health/summary
export {
  computeLifecycleCompletionSlo,
  computeDiscordPostingSlo,
  computeGradingLatencySlo,
  computeSettlementAccuracySlo,
  deriveRateSloStatus,
  deriveLatencySloStatus,
};
