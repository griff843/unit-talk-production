/**
 * Operator Control Plane Routes
 * Sprint: SPRINT-042-LAYER2-PHASE6-OPERATOR-CONTROL-PLANE
 * Layer/Phase: Layer 2 / Phase 6 — Operator Control Plane
 *
 * GET  /ops/autopilot               → current AutopilotGuard status
 * PUT  /ops/autopilot               → set mode at runtime + persist to DB
 * POST /ops/picks/batch-action      → bulk override multiple picks (SPRINT-082)
 * POST /ops/picks/:id/override      → manual pick override via operator_override lifecycle role
 *
 * Auth: operatorAuth (JWT in production, system operator in dev, E2E bypass in test)
 */

import express, { Router } from 'express';

import { autopilotGuard, AutopilotMode } from '../lib/AutopilotGuard';
import { lifecycleUpdate } from '../lib/lifecycle/write-adapter';
import { operatorAuditLog } from '../middleware/operatorAuditLog';
import { operatorAuth } from '../middleware/operatorAuth';
import { supabase } from '../services/supabaseClient';
import { createLogger } from '../utils/logger';

const logger = createLogger('OpsControl');
const router: Router = express.Router();

// SPRINT-045-OPERATOR-AUTH-HARDENING: Use JWT-based operatorAuth instead of weak admin token
router.use(operatorAuth);
// SPRINT-046-OPERATOR-AUDIT-TRAIL: Immutable audit log for all operator actions
router.use(operatorAuditLog);

const VALID_AUTOPILOT_MODES: AutopilotMode[] = ['off', 'log_only', 'canary', 'prod'];

/**
 * GET /ops/autopilot
 * Returns current AutopilotGuard mode and status.
 */
router.get('/autopilot', (_req, res) => {
  try {
    const status = autopilotGuard.getStatus();
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get autopilot status', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get autopilot status',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * PUT /ops/autopilot
 * Set autopilot mode at runtime. Persists to DB so the setting survives
 * cache invalidation but NOT container restart (env var takes precedence on boot).
 *
 * Body: { mode: 'off' | 'log_only' | 'canary' | 'prod', canary_percentage?: number }
 */
router.put('/autopilot', async (req, res) => {
  try {
    const { mode, canary_percentage } = req.body as {
      mode?: unknown;
      canary_percentage?: unknown;
    };

    if (!mode || !VALID_AUTOPILOT_MODES.includes(mode as AutopilotMode)) {
      return res.status(400).json({
        success: false,
        error: `Invalid mode. Must be one of: ${VALID_AUTOPILOT_MODES.join(', ')}`,
        timestamp: new Date().toISOString(),
      });
    }

    const validatedMode = mode as AutopilotMode;

    let validatedCanaryPct: number | undefined;
    if (canary_percentage !== undefined) {
      const pct = Number(canary_percentage);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        return res.status(400).json({
          success: false,
          error: 'canary_percentage must be a number between 0 and 100',
          timestamp: new Date().toISOString(),
        });
      }
      validatedCanaryPct = Math.round(pct);
    }

    const previousStatus = autopilotGuard.getStatus();

    // Update in-memory mode
    autopilotGuard.setMode(validatedMode);
    if (validatedCanaryPct !== undefined) {
      autopilotGuard.setCanaryPercentage(validatedCanaryPct);
    }

    // Persist to DB (best-effort — in-memory update already applied)
    try {
      await autopilotGuard.persistMode(supabase, validatedMode, validatedCanaryPct);
    } catch (persistError) {
      logger.warn('Failed to persist autopilot mode to DB (in-memory update succeeded)', {
        error: persistError instanceof Error ? persistError.message : 'Unknown',
      });
    }

    const newStatus = autopilotGuard.getStatus();

    logger.info('Autopilot mode updated via operator control', {
      from: previousStatus.mode,
      to: validatedMode,
      canaryPercentage: newStatus.canaryPercentage,
    });

    res.json({
      success: true,
      data: newStatus,
      previous: { mode: previousStatus.mode, canaryPercentage: previousStatus.canaryPercentage },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to update autopilot mode', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    res.status(500).json({
      success: false,
      error: 'Failed to update autopilot mode',
      timestamp: new Date().toISOString(),
    });
  }
});

const VALID_BATCH_ACTIONS = ['promote', 'reject', 'requeue'] as const;
type BatchAction = (typeof VALID_BATCH_ACTIONS)[number];
const MAX_BATCH_SIZE = 100;

/**
 * POST /ops/picks/batch-action
 * Bulk override multiple picks via operator_override lifecycle role.
 * SPRINT-082-LAYER3-PHASE11-CC-BATCH-PICK-OPERATIONS
 *
 * Body: { pickIds: string[], action: 'promote' | 'reject' | 'requeue', reason?: string }
 * Returns: { succeeded: string[], failed: { id: string, error: string }[] }
 *
 * - 'promote': sets promotion_status='queued'
 * - 'reject':  sets promotion_status='failed'
 * - 'requeue': sets promotion_status='queued' (re-enqueue from failed state)
 */
router.post('/picks/batch-action', async (req, res) => {
  const { pickIds, action, reason } = req.body as {
    pickIds?: unknown;
    action?: unknown;
    reason?: unknown;
  };

  try {
    if (!Array.isArray(pickIds) || pickIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'pickIds must be a non-empty array',
        timestamp: new Date().toISOString(),
      });
    }

    if (pickIds.length > MAX_BATCH_SIZE) {
      return res.status(400).json({
        success: false,
        error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE}`,
        timestamp: new Date().toISOString(),
      });
    }

    if (!VALID_BATCH_ACTIONS.includes(action as BatchAction)) {
      return res.status(400).json({
        success: false,
        error: `action must be one of: ${VALID_BATCH_ACTIONS.join(', ')}`,
        timestamp: new Date().toISOString(),
      });
    }

    const validAction = action as BatchAction;
    const validatedReason = typeof reason === 'string' ? reason.trim() : '';

    const updates: Record<string, unknown> =
      validAction === 'reject'
        ? { promotion_status: 'failed', risk_decision: 'operator_override_reject' }
        : {
            promotion_status: 'queued',
            risk_decision:
              validAction === 'requeue' ? 'operator_override_requeue' : 'operator_override_promote',
          };

    const succeeded: string[] = [];
    const failed: { id: string; error: string }[] = [];

    await Promise.all(
      pickIds.map(async (rawId: unknown) => {
        const pickId = String(rawId);
        try {
          const result = await lifecycleUpdate(supabase, pickId, updates, {
            writerRole: 'operator_override',
          });
          if (result.success) {
            succeeded.push(pickId);
          } else {
            failed.push({ id: pickId, error: result.error ?? 'Lifecycle update failed' });
          }
        } catch (err) {
          failed.push({
            id: pickId,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      })
    );

    logger.info('Batch pick action applied via operator control', {
      action: validAction,
      reason: validatedReason,
      total: pickIds.length,
      succeeded: succeeded.length,
      failed: failed.length,
    });

    res.json({
      success: true,
      data: { succeeded, failed },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to apply batch pick action', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    res.status(500).json({
      success: false,
      error: 'Failed to apply batch pick action',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /ops/picks/:id/override
 * Manually promote or reject a pick via operator_override lifecycle role.
 *
 * Body: { action: 'promote' | 'reject', reason: string }
 *
 * - 'promote': sets promotion_status='queued' — queues pick for Discord posting
 * - 'reject':  sets promotion_status='failed' — marks pick as operator-rejected
 */
router.post('/picks/:id/override', async (req, res) => {
  const pickId = req.params.id;
  const { action, reason } = req.body as { action?: unknown; reason?: unknown };

  try {
    if (!pickId || typeof pickId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Pick ID is required',
        timestamp: new Date().toISOString(),
      });
    }

    if (action !== 'promote' && action !== 'reject') {
      return res.status(400).json({
        success: false,
        error: "action must be 'promote' or 'reject'",
        timestamp: new Date().toISOString(),
      });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'reason is required and must be a non-empty string',
        timestamp: new Date().toISOString(),
      });
    }

    // Verify the pick exists
    const { data: pick, error: fetchError } = await supabase
      .from('unified_picks')
      .select('id, promotion_status, status')
      .eq('id', pickId)
      .single();

    if (fetchError || !pick) {
      return res.status(404).json({
        success: false,
        error: `Pick not found: ${pickId}`,
        timestamp: new Date().toISOString(),
      });
    }

    const updates: Record<string, unknown> =
      action === 'promote'
        ? {
            promotion_status: 'queued',
            risk_decision: 'operator_override_promote',
          }
        : {
            promotion_status: 'failed',
            risk_decision: 'operator_override_reject',
          };

    const result = await lifecycleUpdate(supabase, pickId, updates, {
      writerRole: 'operator_override',
    });

    if (!result.success) {
      return res.status(422).json({
        success: false,
        error: result.error || 'Lifecycle update failed',
        timestamp: new Date().toISOString(),
      });
    }

    logger.info('Pick override applied via operator control', {
      pickId,
      action,
      reason: reason.trim(),
      previousStatus: pick.promotion_status,
    });

    res.json({
      success: true,
      data: {
        pick_id: pickId,
        action,
        reason: reason.trim(),
        previous_promotion_status: pick.promotion_status,
        new_promotion_status: updates['promotion_status'],
        risk_decision: updates['risk_decision'],
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to apply pick override', {
      pickId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    res.status(500).json({
      success: false,
      error: 'Failed to apply pick override',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
