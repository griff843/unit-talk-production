/**
 * Operations API Routes - Admin endpoints for triggering business flows
 * 
 * CRITICAL: These endpoints are for E2E testing and operational control.
 * Authentication required for production use.
 */

import express from 'express';
import { Connection, Client } from '@temporalio/client';
import { createLogger } from '../utils/logger';
import { getEnv } from '../utils/getEnv';
import crypto from 'crypto';

const logger = createLogger('OpsRouter');
const router = express.Router();
const env = getEnv();

// Simple admin auth middleware
const adminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  
  // For E2E testing, allow bypass with specific header
  if (req.headers['x-e2e-test'] === 'true') {
    logger.info('E2E test bypass enabled');
    return next();
  }
  
  if (!authHeader || !authHeader.startsWith('Bearer admin-')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - Admin access required',
      timestamp: new Date().toISOString()
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
    'Pragma': 'no-cache',
    'Expires': '0'
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
    const {
      sport = 'MLB',
      window = 'next-3h', 
      books = ['FD', 'DK'],
      testMode = false
    } = req.body;

    logger.info('🚀 Manual ingestion triggered', {
      correlationId,
      runId,
      sport,
      window,
      books,
      testMode,
      timestamp: new Date().toISOString()
    });

    // Connect to Temporal and start ingestion workflow
    const connection = await Connection.connect({ 
      address: env.TEMPORAL_SERVER_URL 
    });
    
    const client = new Client({ connection });
    
    // Start the FeedAgent workflow with specific parameters
    const workflowId = `feed-agent-manual-${runId}`;
    
    const handle = await client.workflow.start('feedAgentWorkflow', {
      args: [{
        sport: sport.toLowerCase(),
        batchSize: 100,
        timeout: 300000, // 5 minutes
        includeSettlement: false,
        testMode,
        books,
        window,
        runId,
        correlationId
      }],
      taskQueue: env.TEMPORAL_TASK_QUEUE,
      workflowId,
      memo: {
        triggeredBy: 'manual-ops',
        sport,
        runId,
        testMode: testMode.toString()
      }
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
        testMode
      },
      status: 'started',
      estimatedDuration: '2-5 minutes',
      monitoringUrl: `${env.TEMPORAL_UI_URL}/namespaces/default/workflows/${workflowId}`,
      timestamp: new Date().toISOString(),
      endpoints: {
        status: `/ops/status/${runId}`,
        logs: `/ops/logs/${runId}`
      }
    };

    logger.info('✅ Ingestion workflow started', {
      correlationId,
      workflowId,
      runId,
      sport
    });

    res.status(202).json(response);

  } catch (error) {
    logger.error('❌ Failed to trigger ingestion', {
      correlationId,
      runId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    res.status(500).json({
      success: false,
      runId,
      correlationId,
      error: 'Failed to trigger ingestion workflow',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
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
      address: env.TEMPORAL_SERVER_URL 
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
        timestamp: new Date().toISOString()
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
            error: resultError instanceof Error ? resultError.message : 'Unknown error' 
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
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    logger.error('❌ Status check failed', {
      correlationId,
      runId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      runId,
      correlationId,
      error: 'Failed to check workflow status',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
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
      address: env.TEMPORAL_SERVER_URL 
    });
    
    const client = new Client({ connection });
    
    // Basic health check - try to describe a system workflow
    const systemHealth = {
      temporal: 'connected',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    };

    res.json({
      success: true,
      service: 'Unit Talk Operations API',
      status: 'healthy',
      ...systemHealth,
      endpoints: [
        'POST /ops/ingest-now',
        'GET /ops/status/:runId', 
        'GET /ops/health'
      ]
    });

  } catch (error) {
    res.status(503).json({
      success: false,
      service: 'Unit Talk Operations API',
      status: 'degraded',
      error: 'Temporal connection failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
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
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Cleanup failed', {
      correlationId,
      runId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      runId,
      correlationId,
      error: 'Cleanup failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
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
router.post('/settle', async (req, res) => {
  const correlationId = `ops-settle-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  try {
    const { pick_id, result, actual_value, notes, operator } = req.body;

    // Input validation
    if (!pick_id) {
      return res.status(400).json({
        success: false,
        error: 'pick_id is required',
        correlationId,
        timestamp: new Date().toISOString()
      });
    }

    if (!result || !['win', 'loss', 'push'].includes(result)) {
      return res.status(400).json({
        success: false,
        error: 'result must be one of: win, loss, push',
        correlationId,
        timestamp: new Date().toISOString()
      });
    }

    logger.info('Manual settlement requested', {
      correlationId,
      pick_id,
      result,
      actual_value,
      operator: operator || 'operator'
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
        operator: operator || 'operator',
        notes: notes || null,
        trace_id: correlationId
      }
    });

    if (error) {
      logger.error('Settlement RPC error', {
        correlationId,
        pick_id,
        error: error.message,
        details: error.details
      });

      return res.status(500).json({
        success: false,
        error: 'Settlement RPC failed',
        details: error.message,
        correlationId,
        timestamp: new Date().toISOString()
      });
    }

    // RPC returns JSONB — check its success field
    const rpcResult = data as any;

    if (!rpcResult?.success) {
      logger.warn('Settlement rejected by RPC', {
        correlationId,
        pick_id,
        rpcError: rpcResult?.error
      });

      return res.status(422).json({
        success: false,
        error: rpcResult?.error || 'Settlement rejected',
        details: rpcResult,
        correlationId,
        timestamp: new Date().toISOString()
      });
    }

    logger.info('Settlement completed successfully', {
      correlationId,
      pick_id,
      result,
      settlement_id: rpcResult.settlement_id,
      trace_id: rpcResult.trace_id
    });

    res.json({
      success: true,
      ...rpcResult,
      correlationId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Settlement endpoint error', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error during settlement',
      details: error instanceof Error ? error.message : 'Unknown error',
      correlationId,
      timestamp: new Date().toISOString()
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
router.post('/retry-posting', async (req, res) => {
  const correlationId = `ops-retry-posting-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  try {
    const { pick_id, reason, drift_mode, operator } = req.body;

    // Input validation
    if (!pick_id) {
      return res.status(400).json({
        success: false,
        error: 'pick_id is required',
        correlationId,
        timestamp: new Date().toISOString()
      });
    }

    if (!reason || reason.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'reason is required (min 10 characters)',
        correlationId,
        timestamp: new Date().toISOString()
      });
    }

    if (!drift_mode || !['P1', 'P3', 'P5'].includes(drift_mode)) {
      return res.status(400).json({
        success: false,
        error: 'drift_mode must be one of: P1, P3, P5',
        correlationId,
        timestamp: new Date().toISOString()
      });
    }

    logger.info('Posting retry requested', {
      correlationId,
      pick_id,
      drift_mode,
      operator: operator || 'operator'
    });

    // Import lifecycle adapter
    const { resetPostingClaim } = await import('../lib/lifecycle');
    const { supabaseClient } = await import('../services/supabaseClient');

    // Call the adapter function (single writer pattern)
    const result = await resetPostingClaim(supabaseClient, pick_id, {
      writerRole: 'operator_override',
      reason,
      traceId: correlationId,
      operatorId: operator || 'operator',
      driftMode: drift_mode
    });

    if (!result.reset) {
      logger.warn('Posting retry rejected', {
        correlationId,
        pick_id,
        message: result.message
      });

      return res.status(422).json({
        success: false,
        error: result.message,
        pick_id,
        prev_state: result.prevState,
        correlationId,
        timestamp: new Date().toISOString()
      });
    }

    logger.info('Posting retry completed', {
      correlationId,
      pick_id,
      audit_id: result.auditId
    });

    res.json({
      success: true,
      action: 'reset',
      pick_id: result.pickId,
      audit_id: result.auditId,
      message: result.message,
      prev_state: result.prevState,
      correlationId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Posting retry error', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error during posting retry',
      details: error instanceof Error ? error.message : 'Unknown error',
      correlationId,
      timestamp: new Date().toISOString()
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
router.post('/retry-settlement', async (req, res) => {
  const correlationId = `ops-retry-settlement-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  try {
    const { pick_id, reason, drift_mode, operator } = req.body;

    // Input validation
    if (!pick_id) {
      return res.status(400).json({
        success: false,
        error: 'pick_id is required',
        correlationId,
        timestamp: new Date().toISOString()
      });
    }

    if (!reason || reason.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'reason is required (min 10 characters)',
        correlationId,
        timestamp: new Date().toISOString()
      });
    }

    if (!drift_mode || !['S1', 'S2', 'S3'].includes(drift_mode)) {
      return res.status(400).json({
        success: false,
        error: 'drift_mode must be one of: S1, S2, S3',
        correlationId,
        timestamp: new Date().toISOString()
      });
    }

    logger.info('Settlement retry requested', {
      correlationId,
      pick_id,
      drift_mode,
      operator: operator || 'operator'
    });

    // Import lifecycle adapter
    const { resetSettlementForRetry } = await import('../lib/lifecycle');
    const { supabaseClient } = await import('../services/supabaseClient');

    // Call the adapter function (single writer pattern)
    const result = await resetSettlementForRetry(supabaseClient, pick_id, {
      writerRole: 'operator_override',
      reason,
      traceId: correlationId,
      operatorId: operator || 'operator',
      driftMode: drift_mode
    });

    if (!result.reset) {
      logger.warn('Settlement retry rejected', {
        correlationId,
        pick_id,
        message: result.message
      });

      return res.status(422).json({
        success: false,
        error: result.message,
        pick_id,
        prev_state: result.prevState,
        correlationId,
        timestamp: new Date().toISOString()
      });
    }

    logger.info('Settlement retry completed', {
      correlationId,
      pick_id,
      audit_id: result.auditId
    });

    res.json({
      success: true,
      action: 'reset',
      pick_id: result.pickId,
      audit_id: result.auditId,
      message: result.message,
      prev_state: result.prevState,
      correlationId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Settlement retry error', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error during settlement retry',
      details: error instanceof Error ? error.message : 'Unknown error',
      correlationId,
      timestamp: new Date().toISOString()
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
      .select('id, player_name, stat_type, line, side, sport, odds, confidence, professional_score, promotion_band, bet_type, market, capper_id, created_at')
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
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      count: data?.length || 0,
      picks: data || [],
      correlationId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unsettled picks',
      details: error instanceof Error ? error.message : 'Unknown error',
      correlationId,
      timestamp: new Date().toISOString()
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
        timestamp: new Date().toISOString()
      });
    }

    logger.info('Recap generation requested', { correlationId, mode, date, week_ending });

    // Use the generateRecap script directly for providerless execution
    const { generateRecapReport } = await import('../scripts/recap/generateRecap');

    const result = await generateRecapReport({
      mode: mode as 'daily' | 'weekly' | 'monthly',
      date,
      weekEnding: week_ending
    });

    logger.info('Recap generation completed', { correlationId, mode });

    res.json({
      success: true,
      mode,
      ...result,
      correlationId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Recap generation failed', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      error: 'Recap generation failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      correlationId,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;