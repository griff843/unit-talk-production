/* eslint-disable complexity, max-lines-per-function */
// Pre-existing ESLint complexity issues - documented for SPRINT-058A
/**
 * Picks API Routes - For E2E testing and Command Center integration
 */

import express, { Router } from 'express';

import { supabaseClient } from '../services/supabaseClient';
import { createLogger } from '../utils/logger';

const logger = createLogger('PicksRouter');
const router: Router = express.Router();

// Add cache control for E2E testing
router.use((req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });
  next();
});

/**
 * GET /api/picks/recent - Get recent picks for E2E testing
 */
router.get('/recent', async (req, res) => {
  const correlationId = `picks-recent-${Date.now()}`;

  try {
    const { sport, limit = 10, hours = 24 } = req.query;

    logger.info('Fetching recent picks', {
      correlationId,
      sport,
      limit: Number(limit),
      hours: Number(hours),
    });

    const hoursAgo = new Date(Date.now() - Number(hours) * 60 * 60 * 1000).toISOString();

    let query = supabaseClient
      .from('unified_picks')
      .select(
        `
        id,
        user_id,
        selection,
        odds,
        confidence,
        workflow_stage,
        created_at,
        sport,
        users!unified_picks_user_id_fkey (username, discord_id, tier, capper_tier)
      `
      )
      .gte('created_at', hoursAgo)
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    // Filter by sport if specified
    if (sport && typeof sport === 'string') {
      query = query.eq('sport', sport.toLowerCase());
    }

    const { data: picks, error } = await query;

    if (error) {
      throw error;
    }

    const response = {
      success: true,
      data: picks || [],
      metadata: {
        count: picks?.length || 0,
        sport: sport || 'all',
        hours: Number(hours),
        timestamp: new Date().toISOString(),
        correlationId,
      },
    };

    logger.info('Recent picks fetched successfully', {
      correlationId,
      count: picks?.length || 0,
      sport: sport || 'all',
    });

    res.json(response);
  } catch (error) {
    logger.error('Failed to fetch recent picks', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent picks',
      details: error instanceof Error ? error.message : 'Unknown error',
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/picks - Get picks list for Command Center (with promotion data)
 *
 * SPRINT-074-LAYER3-PHASE10-CC-PICK-MANAGEMENT
 * Returns unified_picks rows enriched with promotion_band and professional_score.
 * Supports filtering by workflow_stage, sport, limit, and hours.
 */
router.get('/', async (req, res) => {
  const correlationId = `picks-list-${Date.now()}`;

  try {
    const { sport, workflow_stage, limit = 100, hours } = req.query;

    logger.info('Fetching picks list', {
      correlationId,
      sport,
      workflow_stage,
      limit: Number(limit),
      hours: hours !== undefined ? Number(hours) : undefined,
    });

    let query = supabaseClient
      .from('unified_picks')
      .select(
        `
        id,
        user_id,
        selection,
        odds,
        confidence,
        workflow_stage,
        settlement_status,
        tier,
        sport,
        promotion_band,
        professional_score,
        created_at,
        users!unified_picks_user_id_fkey (username, discord_id, tier, capper_tier)
      `
      )
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (hours !== undefined) {
      const hoursAgo = new Date(Date.now() - Number(hours) * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', hoursAgo);
    }

    if (sport && typeof sport === 'string') {
      query = query.eq('sport', sport.toLowerCase());
    }

    if (workflow_stage && typeof workflow_stage === 'string') {
      query = query.eq('workflow_stage', workflow_stage);
    }

    const { data: picks, error } = await query;

    if (error) {
      throw error;
    }

    const response = {
      success: true,
      data: picks || [],
      metadata: {
        count: picks?.length || 0,
        sport: sport || 'all',
        workflow_stage: workflow_stage || 'all',
        timestamp: new Date().toISOString(),
        correlationId,
      },
    };

    logger.info('Picks list fetched successfully', {
      correlationId,
      count: picks?.length || 0,
    });

    res.json(response);
  } catch (error) {
    logger.error('Failed to fetch picks list', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch picks list',
      details: error instanceof Error ? error.message : 'Unknown error',
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/picks/stats - Get pick statistics for dashboard
 */
router.get('/stats', async (req, res) => {
  const correlationId = `picks-stats-${Date.now()}`;

  try {
    const { sport, hours = 24 } = req.query;

    logger.info('Fetching pick statistics', {
      correlationId,
      sport,
      hours: Number(hours),
    });

    const hoursAgo = new Date(Date.now() - Number(hours) * 60 * 60 * 1000).toISOString();

    // Get pick counts by status
    let query = supabaseClient
      .from('unified_picks')
      .select('workflow_stage, created_at, sport')
      .gte('created_at', hoursAgo);

    if (sport && typeof sport === 'string') {
      query = query.eq('sport', sport.toLowerCase());
    }

    const { data: picks, error } = await query;

    if (error) {
      throw error;
    }

    // Calculate statistics
    const total = picks?.length || 0;
    const byStage =
      picks?.reduce(
        (acc, pick) => {
          acc[pick.workflow_stage] = (acc[pick.workflow_stage] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ) || {};

    const stats = {
      total,
      approved: byStage['approved'] || 0,
      pending: byStage['pending_review'] || 0,
      rejected: byStage['rejected'] || 0,
      draft: byStage['draft'] || 0,
      published: byStage['published'] || 0,
    };

    const response = {
      success: true,
      data: stats,
      metadata: {
        sport: sport || 'all',
        hours: Number(hours),
        timestamp: new Date().toISOString(),
        correlationId,
      },
    };

    logger.info('Pick statistics calculated', {
      correlationId,
      stats,
      sport: sport || 'all',
    });

    res.json(response);
  } catch (error) {
    logger.error('Failed to fetch pick statistics', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch pick statistics',
      details: error instanceof Error ? error.message : 'Unknown error',
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
