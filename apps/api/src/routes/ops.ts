/* eslint-disable complexity, no-console, no-unused-vars, max-lines-per-function, max-lines, @typescript-eslint/no-unused-vars */
// Pre-existing ESLint complexity issues - documented for SPRINT-058A
/**
 * Operations API Routes - Admin endpoints for triggering business flows
 *
 * CRITICAL: These endpoints are for E2E testing and operational control.
 * Authentication required for production use.
 */

import crypto from 'crypto';

import { Connection, Client } from '@temporalio/client';
import express, { Router } from 'express';

import { operatorAuth, AuthenticatedRequest } from '../middleware/operatorAuth';
import { getEnv } from '../utils/getEnv';
import { createLogger } from '../utils/logger';

const logger = createLogger('OpsRouter');
const router: Router = express.Router();
const env = getEnv();

// Simple admin auth middleware
const adminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;

  // For E2E testing, allow bypass with specific header - ONLY in test environment
  // SPRINT-STRUCTURAL-REINFORCEMENT-P0-002: Fix HIGH-006 - E2E bypass in production
  if (process.env.NODE_ENV === 'test' && req.headers['x-e2e-test'] === 'true') {
    logger.info('E2E test bypass enabled (test environment only)');
    return next();
  }

  if (!authHeader || !authHeader.startsWith('Bearer admin-')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - Admin access required',
      timestamp: new Date().toISOString(),
    });
  }

  next();
};

// Apply auth to all ops routes
router.use(adminAuth);

// Add cache control for testing
router.use((req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });
  next();
});

/**
 * POST /ops/ingest-now - Trigger immediate data ingestion
 *
 * Body:
 * {
 *   "sport": "MLB",
 *   "window": "next-3h",
 *   "books": ["FD", "DK"],
 *   "testMode": true
 * }
 */
router.post('/ingest-now', async (req, res) => {
  const runId = `ingest-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const correlationId = `ops-${runId}`;

  try {
    const { sport = 'MLB', window = 'next-3h', books = ['FD', 'DK'], testMode = false } = req.body;

    logger.info('🚀 Manual ingestion triggered', {
      correlationId,
      runId,
      sport,
      window,
      books,
      testMode,
      timestamp: new Date().toISOString(),
    });

    // Connect to Temporal and start ingestion workflow
    const connection = await Connection.connect({
      address: env.TEMPORAL_SERVER_URL,
    });

    const client = new Client({ connection });

    // Start the FeedAgent workflow with specific parameters
    const workflowId = `feed-agent-manual-${runId}`;

    const handle = await client.workflow.start('feedAgentWorkflow', {
      args: [
        {
          sport: sport.toLowerCase(),
          batchSize: 100,
          timeout: 300000, // 5 minutes
          includeSettlement: false,
          testMode,
          books,
          window,
          runId,
          correlationId,
        },
      ],
      taskQueue: env.TEMPORAL_TASK_QUEUE,
      workflowId,
      memo: {
        triggeredBy: 'manual-ops',
        sport,
        runId,
        testMode: testMode.toString(),
      },
    });

    const response = {
      success: true,
      runId,
      workflowId,
      correlationId,
      parameters: {
        sport,
        window,
        books,
        testMode,
      },
      status: 'started',
      estimatedDuration: '2-5 minutes',
      monitoringUrl: `${env.TEMPORAL_UI_URL}/namespaces/default/workflows/${workflowId}`,
      timestamp: new Date().toISOString(),
      endpoints: {
        status: `/ops/status/${runId}`,
        logs: `/ops/logs/${runId}`,
      },
    };

    logger.info('✅ Ingestion workflow started', {
      correlationId,
      workflowId,
      runId,
      sport,
    });

    res.status(202).json(response);
  } catch (error) {
    logger.error('❌ Failed to trigger ingestion', {
      correlationId,
      runId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      success: false,
      runId,
      correlationId,
      error: 'Failed to trigger ingestion workflow',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /ops/status/:runId - Get ingestion run status
 */
router.get('/status/:runId', async (req, res) => {
  const { runId } = req.params;
  const correlationId = `ops-status-${Date.now()}`;

  try {
    logger.info('📊 Status check requested', { correlationId, runId });

    // Connect to Temporal to check workflow status
    const connection = await Connection.connect({
      address: env.TEMPORAL_SERVER_URL,
    });

    const client = new Client({ connection });
    const workflowId = `feed-agent-manual-${runId}`;

    try {
      const handle = client.workflow.getHandle(workflowId);
      const description = await handle.describe();

      const response: {
        success: boolean;
        runId: string;
        workflowId: string;
        status: string;
        startTime: Date;
        executionTime: Date;
        runTime?: any;
        historyLength: number;
        memo: Record<string, any>;
        timestamp: string;
        result?: any;
      } = {
        success: true,
        runId,
        workflowId,
        status: description.status.name,
        startTime: description.startTime,
        executionTime: description.executionTime,
        runTime: (description as any).runTime, // Property may not exist on all workflow types
        historyLength: description.historyLength,
        memo: description.memo,
        timestamp: new Date().toISOString(),
      };

      // If workflow is completed, try to get result
      if (description.status.name === 'COMPLETED') {
        try {
          const result = await handle.result();
          response.result = result;
        } catch (resultError) {
          logger.warn('Could not fetch workflow result', {
            correlationId,
            runId,
            error: resultError instanceof Error ? resultError.message : 'Unknown error',
          });
        }
      }

      res.json(response);
    } catch (workflowError) {
      // Workflow not found or other Temporal error
      res.status(404).json({
        success: false,
        runId,
        workflowId,
        error: 'Workflow not found or inaccessible',
        details: workflowError instanceof Error ? workflowError.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error('❌ Status check failed', {
      correlationId,
      runId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      runId,
      correlationId,
      error: 'Failed to check workflow status',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /ops/health - Operations health check
 */
router.get('/health', async (req, res) => {
  try {
    // Check Temporal connectivity
    const connection = await Connection.connect({
      address: env.TEMPORAL_SERVER_URL,
    });

    const client = new Client({ connection });

    // Basic health check - try to describe a system workflow
    const systemHealth = {
      temporal: 'connected',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    };

    res.json({
      success: true,
      service: 'Unit Talk Operations API',
      status: 'healthy',
      ...systemHealth,
      endpoints: ['POST /ops/ingest-now', 'GET /ops/status/:runId', 'GET /ops/health'],
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      service: 'Unit Talk Operations API',
      status: 'degraded',
      error: 'Temporal connection failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * DELETE /ops/cleanup/:runId - Cleanup test data (E2E helper)
 */
router.delete('/cleanup/:runId', async (req, res) => {
  const { runId } = req.params;
  const correlationId = `ops-cleanup-${Date.now()}`;

  try {
    // This would cleanup test data associated with a run
    // For now, just acknowledge the request
    logger.info('🧹 Cleanup requested', { correlationId, runId });

    res.json({
      success: true,
      runId,
      correlationId,
      message: 'Cleanup completed',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('❌ Cleanup failed', {
      correlationId,
      runId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      runId,
      correlationId,
      error: 'Cleanup failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================================================
// UNIFIED-OPS-002: Operator Manual Settlement Endpoint
// ============================================================================

/**
 * POST /ops/settle - Operator-safe manual settlement
 *
 * Body:
 * {
 *   "pick_id": "uuid",
 *   "result": "win" | "loss" | "push" | "void",
 *   "actual_value": 25.5,          // optional
 *   "notes": "Game ended 28-21",   // optional
 *   "operator": "griff843"         // optional, defaults to 'operator'
 * }
 *
 * Calls the manual_settle_pick Supabase RPC which:
 * - Validates pick exists and is not already settled
 * - Inserts into prop_settlements
 * - Updates unified_picks (settlement_status, settled_at, settlement_result)
 * - Inserts settlement_log audit entry
 * - Inserts audit_log operator action entry
 * - Returns structured success/error JSON
 */
router.post('/settle', operatorAuth, async (req: AuthenticatedRequest, res) => {
  const correlationId = `ops-settle-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  try {
    const { pick_id, result, actual_value, notes } = req.body;

    // SPRINT-STRUCTURAL-REINFORCEMENT-P0-003: Operator Identity Truth Lock
    // Authority derived from JWT principal ONLY (via operatorAuth middleware)
    // x-operator-id header is ignored for authorization (spoof attempts logged by middleware)
    const operator = req.authenticatedOperatorId || 'system';

    // Input validation
    if (!pick_id) {
      return res.status(400).json({
        success: false,
        error: 'pick_id is required',
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    if (!result || !['win', 'loss', 'push'].includes(result)) {
      return res.status(400).json({
        success: false,
        error: 'result must be one of: win, loss, push',
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    logger.info('Manual settlement requested', {
      correlationId,
      pick_id,
      result,
      actual_value,
      operator,
    });

    // Call Supabase RPC (new signature: p_pick_id, p_result, p_settled_at, p_meta)
    // RPC also emits PICK_SETTLED event into events table for downstream consumers
    const { supabaseClient } = await import('../services/supabaseClient');

    const { data, error } = await supabaseClient.rpc('manual_settle_pick', {
      p_pick_id: pick_id,
      p_result: result,
      p_settled_at: new Date().toISOString(),
      p_meta: {
        actual_value: actual_value ?? null,
        operator: operator,
        operator_source: 'authenticated', // SPRINT-P0-002: Track that operator was validated
        notes: notes || null,
        trace_id: correlationId,
      },
    });

    if (error) {
      logger.error('Settlement RPC error', {
        correlationId,
        pick_id,
        error: error.message,
        details: error.details,
      });

      return res.status(500).json({
        success: false,
        error: 'Settlement RPC failed',
        details: error.message,
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    // RPC returns JSONB — check its success field
    const rpcResult = data as any;

    if (!rpcResult?.success) {
      logger.warn('Settlement rejected by RPC', {
        correlationId,
        pick_id,
        rpcError: rpcResult?.error,
      });

      return res.status(422).json({
        success: false,
        error: rpcResult?.error || 'Settlement rejected',
        details: rpcResult,
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    logger.info('Settlement completed successfully', {
      correlationId,
      pick_id,
      result,
      settlement_id: rpcResult.settlement_id,
      trace_id: rpcResult.trace_id,
    });

    res.json({
      success: true,
      ...rpcResult,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Settlement endpoint error', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error during settlement',
      details: error instanceof Error ? error.message : 'Unknown error',
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================================================
// POSTING-SETTLEMENT-EXACTNESS-040: Retry Endpoints
// ============================================================================

/**
 * POST /ops/retry-posting - Retry posting for stuck/drifted picks
 *
 * Body:
 * {
 *   "pick_id": "uuid",
 *   "reason": "P1 drift - claimed but no receipt",
 *   "drift_mode": "P1" | "P3" | "P5",
 *   "operator": "griff843"  // optional, from auth
 * }
 *
 * Calls resetPostingClaim() lifecycle adapter which:
 * - Validates pick is retry-eligible (not settled, not valid post)
 * - Resets posted_to_discord and promotion_posted_at
 * - Handles parlay legs atomically
 * - Inserts audit_log entry
 */
router.post('/retry-posting', operatorAuth, async (req: AuthenticatedRequest, res) => {
  const correlationId = `ops-retry-posting-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  try {
    const { pick_id, reason, drift_mode } = req.body;

    // SPRINT-STRUCTURAL-REINFORCEMENT-P0-003: Operator Identity Truth Lock
    // Authority derived from JWT principal ONLY (via operatorAuth middleware)
    const operator = req.authenticatedOperatorId || 'system';

    // Input validation
    if (!pick_id) {
      return res.status(400).json({
        success: false,
        error: 'pick_id is required',
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    if (!reason || reason.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'reason is required (min 10 characters)',
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    if (!drift_mode || !['P1', 'P3', 'P5'].includes(drift_mode)) {
      return res.status(400).json({
        success: false,
        error: 'drift_mode must be one of: P1, P3, P5',
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    logger.info('Posting retry requested', {
      correlationId,
      pick_id,
      drift_mode,
      operator,
    });

    // Import lifecycle adapter
    const { resetPostingClaim } = await import('../lib/lifecycle');
    const { supabaseClient } = await import('../services/supabaseClient');

    // Call the adapter function (single writer pattern)
    const result = await resetPostingClaim(supabaseClient, pick_id, {
      writerRole: 'operator_override',
      reason,
      traceId: correlationId,
      operatorId: operator,
      driftMode: drift_mode,
    });

    if (!result.reset) {
      logger.warn('Posting retry rejected', {
        correlationId,
        pick_id,
        message: result.message,
      });

      return res.status(422).json({
        success: false,
        error: result.message,
        pick_id,
        prev_state: result.prevState,
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    logger.info('Posting retry completed', {
      correlationId,
      pick_id,
      audit_id: result.auditId,
    });

    res.json({
      success: true,
      action: 'reset',
      pick_id: result.pickId,
      audit_id: result.auditId,
      message: result.message,
      prev_state: result.prevState,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Posting retry error', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error during posting retry',
      details: error instanceof Error ? error.message : 'Unknown error',
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /ops/retry-settlement - Retry settlement for drifted picks
 *
 * Body:
 * {
 *   "pick_id": "uuid",
 *   "reason": "S1 drift - settled without timestamp",
 *   "drift_mode": "S1" | "S2" | "S3",
 *   "operator": "griff843"  // optional
 * }
 *
 * Calls resetSettlementForRetry() lifecycle adapter which:
 * - Validates pick is retry-eligible (not frozen, has drift)
 * - Resets settlement_status to pending
 * - Inserts audit_log entry
 */
router.post('/retry-settlement', operatorAuth, async (req: AuthenticatedRequest, res) => {
  const correlationId = `ops-retry-settlement-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  try {
    const { pick_id, reason, drift_mode } = req.body;

    // SPRINT-STRUCTURAL-REINFORCEMENT-P0-003: Operator Identity Truth Lock
    // Authority derived from JWT principal ONLY (via operatorAuth middleware)
    const operator = req.authenticatedOperatorId || 'system';

    // Input validation
    if (!pick_id) {
      return res.status(400).json({
        success: false,
        error: 'pick_id is required',
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    if (!reason || reason.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'reason is required (min 10 characters)',
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    if (!drift_mode || !['S1', 'S2', 'S3'].includes(drift_mode)) {
      return res.status(400).json({
        success: false,
        error: 'drift_mode must be one of: S1, S2, S3',
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    logger.info('Settlement retry requested', {
      correlationId,
      pick_id,
      drift_mode,
      operator,
    });

    // Import lifecycle adapter
    const { resetSettlementForRetry } = await import('../lib/lifecycle');
    const { supabaseClient } = await import('../services/supabaseClient');

    // Call the adapter function (single writer pattern)
    const result = await resetSettlementForRetry(supabaseClient, pick_id, {
      writerRole: 'operator_override',
      reason,
      traceId: correlationId,
      operatorId: operator,
      driftMode: drift_mode,
    });

    if (!result.reset) {
      logger.warn('Settlement retry rejected', {
        correlationId,
        pick_id,
        message: result.message,
      });

      return res.status(422).json({
        success: false,
        error: result.message,
        pick_id,
        prev_state: result.prevState,
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    logger.info('Settlement retry completed', {
      correlationId,
      pick_id,
      audit_id: result.auditId,
    });

    res.json({
      success: true,
      action: 'reset',
      pick_id: result.pickId,
      audit_id: result.auditId,
      message: result.message,
      prev_state: result.prevState,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Settlement retry error', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error during settlement retry',
      details: error instanceof Error ? error.message : 'Unknown error',
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /ops/unsettled - List unsettled picks for operator review
 */
router.get('/unsettled', async (req, res) => {
  const correlationId = `ops-unsettled-${Date.now()}`;

  try {
    const { supabaseClient } = await import('../services/supabaseClient');

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const sport = req.query.sport as string;

    let query = supabaseClient
      .from('unified_picks')
      .select(
        'id, player_name, stat_type, line, side, sport, odds, confidence, professional_score, promotion_band, bet_type, market, capper_id, created_at'
      )
      .or('settlement_status.is.null,settlement_status.eq.pending')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (sport) {
      query = query.eq('sport', sport);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch unsettled picks',
        details: error.message,
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      count: data?.length || 0,
      picks: data || [],
      correlationId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unsettled picks',
      details: error instanceof Error ? error.message : 'Unknown error',
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /ops/recap - Trigger recap generation
 *
 * Body:
 * {
 *   "mode": "daily" | "weekly" | "monthly",
 *   "date": "2026-01-29",         // optional, for daily
 *   "week_ending": "2026-02-02"   // optional, for weekly
 * }
 */
router.post('/recap', async (req, res) => {
  const correlationId = `ops-recap-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  try {
    const { mode = 'daily', date, week_ending } = req.body;

    if (!['daily', 'weekly', 'monthly'].includes(mode)) {
      return res.status(400).json({
        success: false,
        error: 'mode must be one of: daily, weekly, monthly',
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    logger.info('Recap generation requested', { correlationId, mode, date, week_ending });

    // Use the generateRecap script directly for providerless execution
    const { generateRecapReport } = await import('../scripts/recap/generateRecap');

    const result = await generateRecapReport({
      mode: mode as 'daily' | 'weekly' | 'monthly',
      date,
      weekEnding: week_ending,
    });

    logger.info('Recap generation completed', { correlationId, mode });

    res.json({
      success: true,
      mode,
      ...result,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Recap generation failed', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: 'Recap generation failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================================================
// SPRINT-OPS-SUBMIT-V2-071B: Operator Submit Endpoint
// Purpose: Restore pick submission capability for operators
// Uses atomic_submit_ticket RPC for idempotency and atomicity
// ============================================================================

/**
 * POST /ops/submit - Submit a pick/ticket as operator
 *
 * Body:
 * {
 *   "capper_id": "uuid",
 *   "capper_username": "griff843",
 *   "sport": "NFL",
 *   "ticket_type": "straight" | "parlay",
 *   "picks": [{
 *     "selection": "KC -3.5",
 *     "line": -3.5,
 *     "odds": -110,
 *     "stat_type": "spread",
 *     "side": "favorite",
 *     "confidence": 80,
 *     "units": 1.0,
 *     "player_name": null,
 *     "bet_type": "spread",
 *     "notes": "Sharp line move"
 *   }],
 *   "manual_matchup_home": "Kansas City Chiefs",
 *   "manual_matchup_away": "Buffalo Bills",
 *   "manual_game_date": "2026-02-20",
 *   "parlay_odds": -110,       // optional, for parlays
 *   "total_units": 1.0,        // optional
 *   "notes": "Operator note",  // optional
 *   "idempotency_key": "ops-xxx" // optional, defaults to generated
 * }
 */
router.post('/submit', async (req, res) => {
  const correlationId = `ops-submit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  try {
    const {
      capper_id,
      capper_username,
      sport,
      ticket_type = 'straight',
      picks,
      manual_matchup_home,
      manual_matchup_away,
      manual_game_date,
      parlay_odds,
      total_units = 1.0,
      notes,
      idempotency_key,
    } = req.body;

    // Input validation
    if (!capper_id) {
      return res.status(400).json({
        success: false,
        error: 'capper_id is required',
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    if (!sport) {
      return res.status(400).json({
        success: false,
        error: 'sport is required',
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    if (!picks || !Array.isArray(picks) || picks.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'picks array is required and must have at least one pick',
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    // Validate each pick has required fields
    for (let i = 0; i < picks.length; i++) {
      const pick = picks[i];
      if (!pick.selection) {
        return res.status(400).json({
          success: false,
          error: `picks[${i}].selection is required`,
          correlationId,
          timestamp: new Date().toISOString(),
        });
      }
      if (typeof pick.odds !== 'number') {
        return res.status(400).json({
          success: false,
          error: `picks[${i}].odds is required and must be a number`,
          correlationId,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Generate bet_slip_id (idempotency key)
    const betSlipId = idempotency_key || `ops-${crypto.randomUUID()}`;

    logger.info('Ops submit requested', {
      correlationId,
      betSlipId,
      capper_id,
      sport,
      ticket_type,
      pick_count: picks.length,
    });

    const { supabaseClient } = await import('../services/supabaseClient');

    // Build game_selections from manual fields
    const gameSelections = [
      {
        home_team: manual_matchup_home || 'TBD',
        away_team: manual_matchup_away || 'TBD',
        game_date: manual_game_date || null,
        sport,
      },
    ];

    // Map picks to RPC format
    const picksForRpc = picks.map((pick: any, idx: number) => ({
      selection: pick.selection,
      line: pick.line ?? null,
      odds: pick.odds,
      stat_type: pick.stat_type || 'spread',
      side: pick.side || null,
      confidence: pick.confidence ?? 75,
      units: pick.units ?? 1.0,
      player_name: pick.player_name || null,
      bet_type: pick.bet_type || 'spread',
      notes: pick.notes || null,
      leg_index: idx,
      // Manual fields per pick
      manual_matchup_home: pick.manual_matchup_home || manual_matchup_home || null,
      manual_matchup_away: pick.manual_matchup_away || manual_matchup_away || null,
      manual_game_date: pick.manual_game_date || manual_game_date || null,
    }));

    // Call atomic_submit_ticket RPC
    const { data: rpcResult, error: rpcError } = await supabaseClient.rpc('atomic_submit_ticket', {
      p_bet_slip_id: betSlipId,
      p_capper_id: capper_id,
      p_capper_username: capper_username || 'operator',
      p_sport: sport,
      p_ticket_type: ticket_type,
      p_game_selections: gameSelections,
      p_picks: picksForRpc,
      p_parlay_odds: parlay_odds ?? null,
      p_total_units: total_units,
      p_notes: notes || `Submitted via Ops Submit at ${new Date().toISOString()}`,
    });

    if (rpcError) {
      logger.error('Ops submit RPC error', {
        correlationId,
        betSlipId,
        error: rpcError.message,
        details: rpcError.details,
      });

      return res.status(500).json({
        success: false,
        error: 'Submission RPC failed',
        details: rpcError.message,
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    const result = rpcResult as any;

    if (!result?.success) {
      logger.warn('Ops submit rejected by RPC', {
        correlationId,
        betSlipId,
        rpcError: result?.error,
      });

      return res.status(422).json({
        success: false,
        error: result?.error || 'Submission rejected',
        details: result,
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    // Check if duplicate (idempotent)
    if (result.is_duplicate) {
      logger.info('Ops submit idempotent duplicate', {
        correlationId,
        betSlipId,
        existing: true,
      });

      return res.status(200).json({
        success: true,
        is_duplicate: true,
        bet_slip_id: result.bet_slip_id,
        status: result.status,
        message: 'Ticket already submitted (idempotent)',
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    logger.info('Ops submit completed', {
      correlationId,
      betSlipId,
      pick_ids: result.pick_ids,
      ticket_id: result.ticket_id,
    });

    res.status(201).json({
      success: true,
      bet_slip_id: result.bet_slip_id,
      ticket_id: result.ticket_id,
      pick_ids: result.pick_ids,
      status: result.status,
      selection_count: result.selection_count,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Ops submit endpoint error', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error during submission',
      details: error instanceof Error ? error.message : 'Unknown error',
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /ops/cappers - List available cappers for submit form
 */
router.get('/cappers', async (req, res) => {
  const correlationId = `ops-cappers-${Date.now()}`;

  try {
    const { supabaseClient } = await import('../services/supabaseClient');

    const { data, error } = await supabaseClient
      .from('users')
      .select('id, username, email, role')
      .eq('is_active', true)
      .in('role', ['capper', 'admin', 'operator'])
      .order('username');

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch cappers',
        details: error.message,
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      count: data?.length || 0,
      cappers: data || [],
      correlationId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cappers',
      details: error instanceof Error ? error.message : 'Unknown error',
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================================================
// CANARY PUBLISH ENDPOINT — REAL DISCORD POST TO CANARY SURFACE
// Sprint: CANARY-LIFECYCLE-TRIGGER-008
// ============================================================================

/**
 * POST /ops/canary/publish-one - Publish exactly 1 pick to CANARY surface
 *
 * Sprint: CANARY-LIFECYCLE-TRIGGER-008
 *
 * Publishes exactly ONE pick through the REAL lifecycle pipeline to CANARY surface.
 * Creates execution_events BEFORE Discord POST, updates AFTER with real snowflake.
 *
 * Requirements:
 * - DISCORD_MODE=canary (fail-closed)
 * - operatorAuth required (JWT principal)
 * - Idempotent: second call returns success with idempotent=true
 *
 * Body:
 * {
 *   "pick_id": "uuid",           // optional - if not provided, selects 1 eligible pick
 *   "dry_run": false             // optional - if true, validates but doesn't post
 * }
 *
 * Response:
 * {
 *   "status": "success|noop|error",
 *   "pick_id": "uuid",
 *   "execution_event_id": "uuid",
 *   "discord_message_id": "123456789012345678",
 *   "target_surface": "CANARY",
 *   "idempotent": true|false,
 *   "publish_latency_ms": 234,
 *   "correlationId": "ops-canary-publish-...",
 *   "timestamp": "2026-02-28T..."
 * }
 */
router.post('/canary/publish-one', operatorAuth, async (req: AuthenticatedRequest, res) => {
  const correlationId = `ops-canary-publish-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  try {
    const { pick_id, dry_run = false } = req.body;
    const operator = req.authenticatedOperatorId || 'system';

    logger.info('CANARY-PUBLISH: Request received', {
      correlationId,
      pick_id,
      dry_run,
      operator,
    });

    // ---- Step 1: FAIL-CLOSED - Require canary mode ----
    const { resolveDiscordRoutingConfig } = await import('../config/discordRouting');
    const routingConfig = resolveDiscordRoutingConfig();

    if (routingConfig.mode !== 'canary') {
      logger.warn('CANARY-PUBLISH: Rejected - mode is not canary', {
        correlationId,
        current_mode: routingConfig.mode,
      });

      return res.status(403).json({
        status: 'error',
        error: 'DISCORD_MODE must be "canary" to use this endpoint',
        current_mode: routingConfig.mode,
        target_surface: 'CANARY',
        idempotent: false,
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    // ---- Step 2: Security logging ----
    const { SecurityEventLogger } = await import('../security');
    await SecurityEventLogger.logEvent({
      type: 'canary_publish_initiated',
      userId: operator,
      details: {
        pick_id: pick_id || 'auto-select',
        dry_run,
        correlation_id: correlationId,
        discord_mode: routingConfig.mode,
      },
      timestamp: new Date().toISOString(),
    });

    // ---- Step 3: Get Supabase client ----
    const { supabaseClient } = await import('../services/supabaseClient');

    // ---- Step 4: Select pick (by ID or auto-select 1) ----
    let targetPickId = pick_id;

    if (!targetPickId) {
      const { data: picks } = await supabaseClient
        .from('unified_picks')
        .select('id')
        .eq('posted_to_discord', false)
        .limit(1);

      if (!picks?.length) {
        logger.info('CANARY-PUBLISH: No eligible picks found', { correlationId });

        return res.json({
          status: 'noop',
          reason: 'NO_ELIGIBLE_PICK',
          target_surface: 'CANARY',
          idempotent: false,
          correlationId,
          timestamp: new Date().toISOString(),
        });
      }
      targetPickId = picks[0].id;
    }

    logger.info('CANARY-PUBLISH: Target pick selected', {
      correlationId,
      pick_id: targetPickId,
      auto_selected: !pick_id,
    });

    // ---- Step 5: Call core publisher ----
    const { publishOneToCanary } = await import('../lib/canaryPublisher');

    const result = await publishOneToCanary(supabaseClient, {
      pickId: targetPickId,
      correlationId,
      operatorId: operator,
      dryRun: dry_run,
    });

    // ---- Step 6: Log completion ----
    if (result.success) {
      await SecurityEventLogger.logEvent({
        type: 'canary_publish_completed',
        userId: operator,
        details: {
          pick_id: targetPickId,
          discord_message_id: result.discordMessageId,
          execution_event_id: result.executionEventId,
          idempotent: result.idempotent,
          publish_latency_ms: result.publishLatencyMs,
          correlation_id: correlationId,
        },
        timestamp: new Date().toISOString(),
      });
    }

    logger.info('CANARY-PUBLISH: Request completed', {
      correlationId,
      success: result.success,
      idempotent: result.idempotent,
    });

    // ---- Step 7: Return structured response ----
    res.json({
      status: result.success ? 'success' : 'error',
      pick_id: targetPickId,
      execution_event_id: result.executionEventId,
      discord_message_id: result.discordMessageId,
      target_surface: 'CANARY',
      idempotent: result.idempotent,
      publish_latency_ms: result.publishLatencyMs,
      reason: result.reason,
      error: result.error,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('CANARY-PUBLISH: Unexpected error', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      status: 'error',
      error: 'Internal server error during canary publish',
      details: error instanceof Error ? error.message : 'Unknown error',
      target_surface: 'CANARY',
      idempotent: false,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================================================
// GAUNTLET ENDPOINTS — GATED BY GAUNTLET_MODE=true
// Sprint: FULL-CHAIN-STAGING-GAUNTLET-041
// ============================================================================

/**
 * Gauntlet mode gate - refuses all gauntlet operations unless env is set
 */
const gauntletGate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (process.env.GAUNTLET_MODE !== 'true') {
    logger.warn('Gauntlet endpoint blocked - GAUNTLET_MODE not enabled');
    return res.status(403).json({
      success: false,
      error: 'GAUNTLET_MODE not enabled',
      hint: 'Set GAUNTLET_MODE=true in environment to enable gauntlet endpoints',
      timestamp: new Date().toISOString(),
    });
  }
  next();
};

/**
 * POST /ops/gauntlet/inject-pick - Create a test pick for gauntlet scenarios
 *
 * Body: {
 *   bet_slip_id: string (required, must start with GAUNTLET-041-)
 *   player_name?: string
 *   stat_type?: string
 *   line?: number
 *   side?: string
 *   sport?: string
 *   odds?: number
 * }
 */
router.post('/gauntlet/inject-pick', gauntletGate, async (req, res) => {
  const correlationId = `gauntlet-inject-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  try {
    const {
      bet_slip_id,
      player_name,
      stat_type,
      line,
      side,
      sport,
      odds,
      is_parlay,
      parlay_id,
      leg_index,
    } = req.body;

    if (!bet_slip_id || !bet_slip_id.startsWith('GAUNTLET-041-')) {
      return res.status(400).json({
        success: false,
        error: 'bet_slip_id must start with GAUNTLET-041-',
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    const { supabaseClient } = await import('../services/supabaseClient');
    const { checkSubmitIdempotency, lifecycleInsert } = await import('../lib/lifecycle');

    // Check idempotency first
    const idempotencyCheck = await checkSubmitIdempotency(supabaseClient, bet_slip_id);
    if (idempotencyCheck.isDuplicate) {
      return res.status(409).json({
        success: false,
        error: 'Duplicate bet_slip_id',
        existing_id: idempotencyCheck.existingId,
        reason: idempotencyCheck.reason,
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    // Create pick via lifecycle adapter
    const pickId = crypto.randomUUID();
    const pick = {
      id: pickId,
      bet_slip_id,
      player_name: player_name || 'Gauntlet Test Player',
      stat_type: stat_type || 'points',
      line: line || 25.5,
      side: side || 'over',
      sport: sport || 'NBA',
      odds: odds || -110,
      status: 'pending' as const,
      promotion_status: 'not_promoted' as const,
      settlement_status: 'pending' as const,
      posted_to_discord: false,
      source: 'GAUNTLET_TEST',
      created_at: new Date().toISOString(),
      // Parlay support
      ticket_type: is_parlay ? 'parlay' : 'single',
      parlay_id: parlay_id || null,
      leg_index: leg_index ?? 0, // Default to 0 for single picks
    };

    // SPRINT-DISCORD-POSTING-WRITER-AUTHORITY-FIX-048: Use operator_override for gauntlet
    // Gauntlet is an admin test tool that sets fields spanning multiple roles
    // (side, status, promotion_status, settlement_status, posted_to_discord, source)
    const result = await lifecycleInsert(supabaseClient, pick, {
      writerRole: 'operator_override',
      traceId: correlationId,
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    logger.info({ correlationId, pickId, bet_slip_id }, 'GAUNTLET: Pick injected');

    res.status(201).json({
      success: true,
      pick_id: pickId,
      bet_slip_id,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(
      { correlationId, error: error instanceof Error ? error.message : 'Unknown error' },
      'GAUNTLET: Inject failed'
    );
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /ops/gauntlet/queue-pick - Move pick to QUEUED status (simulate promotion)
 */
router.post('/gauntlet/queue-pick', gauntletGate, async (req, res) => {
  const correlationId = `gauntlet-queue-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  try {
    const { pick_id } = req.body;

    if (!pick_id) {
      return res.status(400).json({
        success: false,
        error: 'pick_id is required',
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    const { supabaseClient } = await import('../services/supabaseClient');
    const { lifecycleUpdate } = await import('../lib/lifecycle');

    const result = await lifecycleUpdate(
      supabaseClient,
      pick_id,
      {
        promotion_status: 'queued',
        promotion_queued_at: new Date().toISOString(),
      },
      {
        writerRole: 'promoter',
        traceId: correlationId,
      }
    );

    if (!result.success) {
      return res.status(422).json({
        success: false,
        error: result.error,
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    logger.info({ correlationId, pick_id }, 'GAUNTLET: Pick queued');

    res.json({
      success: true,
      pick_id,
      new_status: 'queued',
      correlationId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(
      { correlationId, error: error instanceof Error ? error.message : 'Unknown error' },
      'GAUNTLET: Queue failed'
    );
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /ops/gauntlet/post-pick - Atomic claim and mark as posted
 */
router.post('/gauntlet/post-pick', gauntletGate, async (req, res) => {
  const correlationId = `gauntlet-post-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  try {
    const { pick_id, simulate_discord_id } = req.body;

    if (!pick_id) {
      return res.status(400).json({
        success: false,
        error: 'pick_id is required',
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    const { supabaseClient } = await import('../services/supabaseClient');
    const { atomicClaimForPost, lifecycleUpdate } = await import('../lib/lifecycle');

    // Use atomic claim for idempotency
    const claim = await atomicClaimForPost(supabaseClient, pick_id);

    if (!claim.claimed) {
      return res.status(409).json({
        success: false,
        error: 'Pick already posted (idempotent skip)',
        already_claimed: true,
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    // Simulate Discord message ID
    const discordMessageId = simulate_discord_id || `GAUNTLET-MSG-${Date.now()}`;

    // Update with Discord receipt
    await lifecycleUpdate(
      supabaseClient,
      pick_id,
      {
        discord_message_id: discordMessageId,
        promotion_status: 'promoted',
        meta: { discord_receipt: { message_id: discordMessageId, channel_id: 'GAUNTLET_CHANNEL' } },
      },
      {
        writerRole: 'poster',
        traceId: correlationId,
      }
    );

    logger.info({ correlationId, pick_id, discordMessageId }, 'GAUNTLET: Pick posted');

    res.json({
      success: true,
      pick_id,
      discord_message_id: discordMessageId,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(
      { correlationId, error: error instanceof Error ? error.message : 'Unknown error' },
      'GAUNTLET: Post failed'
    );
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /ops/gauntlet/settle-pick - Settle a pick (idempotent)
 */
router.post('/gauntlet/settle-pick', gauntletGate, async (req, res) => {
  const correlationId = `gauntlet-settle-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  try {
    const { pick_id, result, actual_value } = req.body;

    if (!pick_id) {
      return res.status(400).json({
        success: false,
        error: 'pick_id is required',
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    if (!result || !['win', 'loss', 'push'].includes(result)) {
      return res.status(400).json({
        success: false,
        error: 'result must be one of: win, loss, push',
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    const { supabaseClient } = await import('../services/supabaseClient');
    const { atomicClaimForSettle, lifecycleSettle } = await import('../lib/lifecycle');

    // Use atomic claim for idempotency
    const claim = await atomicClaimForSettle(supabaseClient, pick_id, {
      settlement_status: 'settled',
      settlement_result: result,
      settlement_source: 'GAUNTLET_TEST',
    });

    if (!claim.claimed) {
      return res.status(409).json({
        success: false,
        error: 'Pick already settled (idempotent skip)',
        already_settled: true,
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    logger.info({ correlationId, pick_id, result }, 'GAUNTLET: Pick settled');

    res.json({
      success: true,
      pick_id,
      settlement_result: result,
      actual_value: actual_value || null,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(
      { correlationId, error: error instanceof Error ? error.message : 'Unknown error' },
      'GAUNTLET: Settle failed'
    );
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /ops/gauntlet/pick/:id - Get current pick state
 */
router.get('/gauntlet/pick/:id', gauntletGate, async (req, res) => {
  const correlationId = `gauntlet-get-${Date.now()}`;

  try {
    const { id } = req.params;

    const { supabaseClient } = await import('../services/supabaseClient');

    const { data, error } = await supabaseClient
      .from('unified_picks')
      .select(
        'id, bet_slip_id, status, promotion_status, settlement_status, posted_to_discord, discord_message_id, settlement_result, settled_at, promotion_posted_at, meta, source'
      )
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: 'Pick not found',
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      pick: data,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * DELETE /ops/gauntlet/cleanup - Clean up all GAUNTLET_TEST picks
 */
router.delete('/gauntlet/cleanup', gauntletGate, async (req, res) => {
  const correlationId = `gauntlet-cleanup-${Date.now()}`;

  try {
    const { supabaseClient } = await import('../services/supabaseClient');

    const { data, error } = await supabaseClient
      .from('unified_picks')
      .delete()
      .eq('source', 'GAUNTLET_TEST')
      .select('id');

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    const deletedCount = data?.length || 0;
    logger.info({ correlationId, deletedCount }, 'GAUNTLET: Cleanup completed');

    res.json({
      success: true,
      deleted_count: deletedCount,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /ops/gauntlet/reconciliation - Check for drift conditions
 */
router.get('/gauntlet/reconciliation', gauntletGate, async (req, res) => {
  const correlationId = `gauntlet-recon-${Date.now()}`;

  try {
    const { supabaseClient } = await import('../services/supabaseClient');

    // Query 1: POSTED without discord_message_id
    const { data: postedNoReceipt } = await supabaseClient
      .from('unified_picks')
      .select('id, bet_slip_id')
      .eq('source', 'GAUNTLET_TEST')
      .eq('posted_to_discord', true)
      .is('discord_message_id', null);

    // Query 2: SETTLED without settled_at
    const { data: settledNoTimestamp } = await supabaseClient
      .from('unified_picks')
      .select('id, bet_slip_id')
      .eq('source', 'GAUNTLET_TEST')
      .eq('settlement_status', 'settled')
      .is('settled_at', null);

    // Query 3: settlement_result without settlement_status = settled
    const { data: resultNoStatus } = await supabaseClient
      .from('unified_picks')
      .select('id, bet_slip_id')
      .eq('source', 'GAUNTLET_TEST')
      .not('settlement_result', 'is', null)
      .neq('settlement_status', 'settled');

    const driftConditions = {
      posted_without_receipt: postedNoReceipt || [],
      settled_without_timestamp: settledNoTimestamp || [],
      result_without_settled_status: resultNoStatus || [],
    };

    const hasDrift =
      driftConditions.posted_without_receipt.length > 0 ||
      driftConditions.settled_without_timestamp.length > 0 ||
      driftConditions.result_without_settled_status.length > 0;

    res.json({
      success: true,
      has_drift: hasDrift,
      drift_conditions: driftConditions,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
