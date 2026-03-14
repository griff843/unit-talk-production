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

import { RiskEngine } from '../services/risk/RiskEngine';
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
 * GET /api/risk/status
 * Returns live aggregated risk state: exposure + drift + correlation + drawdown.
 * All four computations run in parallel; any failure surfaces as an error field.
 */
router.get('/status', async (_req, res) => {
  try {
    const riskEngine = RiskEngine.getInstance();

    const [exposure, drift, correlation, drawdown] = await Promise.allSettled([
      riskEngine.computeExposure(supabase),
      riskEngine.evaluateDrift(supabase),
      riskEngine.computeCorrelation(supabase),
      riskEngine.computeDrawdown(supabase),
    ]);

    res.json({
      success: true,
      data: {
        exposure: exposure.status === 'fulfilled' ? exposure.value : null,
        drift: drift.status === 'fulfilled' ? drift.value : null,
        correlation: correlation.status === 'fulfilled' ? correlation.value : null,
        drawdown: drawdown.status === 'fulfilled' ? drawdown.value : null,
        errors: {
          exposure: exposure.status === 'rejected' ? (exposure.reason as Error).message : null,
          drift: drift.status === 'rejected' ? (drift.reason as Error).message : null,
          correlation:
            correlation.status === 'rejected' ? (correlation.reason as Error).message : null,
          drawdown: drawdown.status === 'rejected' ? (drawdown.reason as Error).message : null,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to compute risk status', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    res.status(500).json({
      success: false,
      error: 'Failed to compute risk status',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/risk/decisions
 * Returns paginated risk_events with optional sport + date filters.
 * Query params: limit (default 50), offset (default 0), sport, date_from, date_to, type, severity
 */
router.get('/decisions', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
    const offset = parseInt(req.query.offset as string, 10) || 0;
    const sport = req.query.sport as string | undefined;
    const dateFrom = req.query.date_from as string | undefined;
    const dateTo = req.query.date_to as string | undefined;
    const eventType = req.query.type as string | undefined;
    const severity = req.query.severity as string | undefined;

    let query = supabase
      .from('risk_events')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (sport) {
      query = query.eq('sport', sport);
    }
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }
    if (eventType) {
      query = query.eq('event_type', eventType);
    }
    if (severity) {
      query = query.eq('severity', severity);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Risk decisions query failed: ${error.message}`);
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
    logger.error('Failed to fetch risk decisions', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch risk decisions',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Whitelist of keys that can be updated via the operator API.
// Matches the RiskEngineConfig interface fields stored in risk_engine_config table.
const RISK_CONFIG_WRITABLE_KEYS = new Set([
  'total_kelly_high',
  'total_kelly_critical',
  'event_kelly_limit',
  'drift_brier_block',
  'drift_min_settled',
  'engine_enabled',
  'bankroll_total',
  'bankroll_kelly_multiplier',
  'bankroll_max_bet_fraction',
  'sport_kelly_limit',
  'correlation_max_same_event',
  'correlation_max_same_participant',
  'drawdown_freeze_threshold',
  'drawdown_lookback_days',
]);

/**
 * PUT /api/risk/config/:key
 * Update a single risk engine config value at runtime.
 * Clears the 60s config cache so the next request picks up the new value.
 *
 * Body: { value: number | boolean }
 */
router.put('/config/:key', async (req, res) => {
  const { key } = req.params;
  const { value } = req.body as { value?: unknown };

  try {
    if (!RISK_CONFIG_WRITABLE_KEYS.has(key)) {
      return res.status(400).json({
        success: false,
        error: `Unknown config key: '${key}'. Writable keys: ${[...RISK_CONFIG_WRITABLE_KEYS].join(', ')}`,
        timestamp: new Date().toISOString(),
      });
    }

    if (value === undefined || value === null) {
      return res.status(400).json({
        success: false,
        error: 'value is required',
        timestamp: new Date().toISOString(),
      });
    }

    const numericValue = Number(value);
    if (isNaN(numericValue)) {
      return res.status(400).json({
        success: false,
        error: 'value must be numeric (use 1/0 for boolean engine_enabled)',
        timestamp: new Date().toISOString(),
      });
    }

    const { error: upsertError } = await supabase
      .from('risk_engine_config')
      .upsert(
        { config_key: key, config_value: numericValue, updated_by: 'operator_api' },
        { onConflict: 'config_key' }
      );

    if (upsertError) {
      throw new Error(`DB upsert failed: ${upsertError.message}`);
    }

    // Invalidate cache so next risk evaluation reads the new value
    RiskEngine.resetConfigCache();

    logger.info('Risk config key updated', { key, value: numericValue });

    res.json({
      success: true,
      data: { key, value: numericValue },
      message: 'Config updated and cache cleared',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to update risk config', {
      key,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    res.status(500).json({
      success: false,
      error: 'Failed to update risk config',
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
