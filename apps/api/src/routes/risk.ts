/* eslint-disable complexity, no-console, max-lines-per-function */
/**
 * Risk Engine API Routes
 * Sprint: RISK-ENGINE-FOUNDATION-001
 *
 * GET /api/risk/exposure  → current ExposureState
 * GET /api/risk/drift     → current DriftState
 * GET /api/risk/events    → paginated risk_events
 * GET /api/risk/config    → current risk_engine_config values
 *
 * Auth: adminAuth (same as ops routes)
 */

import express, { Router } from 'express';

import { RiskEngine } from '../services/RiskEngine';
import { supabase } from '../services/supabaseClient';
import { createLogger } from '../utils/logger';

const logger = createLogger('RiskRouter');
const router: Router = express.Router();

// Simple admin auth (matches ops.ts pattern)
const adminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (process.env.NODE_ENV === 'test' && req.headers['x-e2e-test'] === 'true') {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer admin-')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - Admin access required',
      timestamp: new Date().toISOString(),
    });
  }

  next();
};

router.use(adminAuth);

/**
 * GET /api/risk/exposure
 * Returns current aggregate exposure state.
 */
router.get('/exposure', async (_req, res) => {
  try {
    const riskEngine = RiskEngine.getInstance();
    const exposure = await riskEngine.computeExposure(supabase);

    res.json({
      success: true,
      data: exposure,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to compute exposure', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    res.status(500).json({
      success: false,
      error: 'Failed to compute exposure',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/risk/drift
 * Returns current model drift state.
 */
router.get('/drift', async (_req, res) => {
  try {
    const riskEngine = RiskEngine.getInstance();
    const drift = await riskEngine.evaluateDrift(supabase);

    res.json({
      success: true,
      data: drift,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to evaluate drift', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    res.status(500).json({
      success: false,
      error: 'Failed to evaluate drift',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/risk/events
 * Returns paginated risk events.
 * Query params: limit (default 50), offset (default 0), type, severity
 */
router.get('/events', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
    const offset = parseInt(req.query.offset as string, 10) || 0;
    const eventType = req.query.type as string | undefined;
    const severity = req.query.severity as string | undefined;

    let query = supabase
      .from('risk_events')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (eventType) {
      query = query.eq('event_type', eventType);
    }
    if (severity) {
      query = query.eq('severity', severity);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Risk events query failed: ${error.message}`);
    }

    res.json({
      success: true,
      data: data || [],
      pagination: {
        limit,
        offset,
        total: count ?? 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch risk events', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch risk events',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/risk/config
 * Returns current risk engine configuration.
 */
router.get('/config', async (_req, res) => {
  try {
    const riskEngine = RiskEngine.getInstance();
    const config = await riskEngine.getConfig(supabase);

    res.json({
      success: true,
      data: config,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch risk config', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch risk config',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
