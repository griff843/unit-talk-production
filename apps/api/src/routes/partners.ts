/**
 * Partner API Routes
 * Phase 14: Public API endpoints for external partners
 */

import { Router } from 'express';
import { PartnerAuthRequest, authenticatePartner, requireScopes } from '../middleware/partner-auth';
import { rateLimitPartner, enforceQuota, logApiUsage } from '../middleware/rate-limit';
import { supabaseClient } from '../services/supabaseClient';
import { createLogger } from '../utils/logger';

const router = Router();
const logger = createLogger('PartnerAPI');

// Apply authentication and rate limiting to all partner routes
router.use(authenticatePartner);
router.use(rateLimitPartner);
router.use(enforceQuota);
router.use(logApiUsage);

// ===============================================================================
// /partners/picks - Pick management endpoints
// ===============================================================================

/**
 * GET /partners/picks - Fetch picks for partner
 */
router.get('/picks', requireScopes('read:picks'), async (req: PartnerAuthRequest, res) => {
  const correlationId = req.correlationId || `get-picks-${Date.now()}`;

  try {
    const {
      limit = 50,
      offset = 0,
      sport,
      status,
      date_from,
      date_to,
    } = req.query;

    let query = supabaseClient
      .from('partner_picks')
      .select(`
        id,
        external_id,
        partner_metadata,
        created_at,
        updated_at,
        unified_picks:unified_pick_id (
          id,
          sport,
          market_type,
          selection,
          line,
          odds,
          stake,
          potential_payout,
          status,
          result,
          player_name,
          team,
          opponent,
          game_date,
          game_time,
          professional_score,
          tier,
          confidence,
          created_at
        )
      `)
      .eq('partner_id', req.partner!.id)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    // Apply filters
    if (sport) {
      query = query.eq('unified_picks.sport', sport);
    }
    if (status) {
      query = query.eq('unified_picks.status', status);
    }
    if (date_from) {
      query = query.gte('unified_picks.game_date', date_from);
    }
    if (date_to) {
      query = query.lte('unified_picks.game_date', date_to);
    }

    const { data: picks, error, count } = await query;

    if (error) {
      logger.error('Failed to fetch picks', { correlationId, error: error.message });
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch picks',
        correlationId,
      });
      return;
    }

    res.json({
      success: true,
      data: picks,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: count || 0,
      },
      correlationId,
    });
  } catch (error) {
    logger.error('Error fetching picks', {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      correlationId,
    });
  }
});

/**
 * POST /partners/picks - Submit a new pick
 */
router.post('/picks', requireScopes('write:picks'), async (req: PartnerAuthRequest, res) => {
  const correlationId = req.correlationId || `create-pick-${Date.now()}`;

  try {
    const {
      sport,
      market_type,
      selection,
      line,
      odds,
      stake,
      player_name,
      team,
      opponent,
      game_date,
      game_time,
      external_id,
      metadata,
    } = req.body;

    // Validate required fields
    if (!sport || !market_type || !selection || !odds || !game_date) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Missing required fields: sport, market_type, selection, odds, game_date',
        correlationId,
      });
      return;
    }

    // Create unified pick first
    const { data: unifiedPick, error: unifiedError } = await supabaseClient
      .from('unified_picks')
      .insert({
        sport,
        market_type,
        selection,
        line,
        odds,
        stake,
        potential_payout: stake ? (stake * odds).toFixed(2) : null,
        player_name,
        team,
        opponent,
        game_date,
        game_time,
        status: 'pending',
        metadata: metadata || {},
      })
      .select()
      .single();

    if (unifiedError) {
      logger.error('Failed to create unified pick', {
        correlationId,
        error: unifiedError.message,
      });
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to create pick',
        correlationId,
      });
      return;
    }

    // Create partner pick record
    const { data: partnerPick, error: partnerError } = await supabaseClient
      .from('partner_picks')
      .insert({
        partner_id: req.partner!.id,
        unified_pick_id: unifiedPick.id,
        external_id,
        partner_metadata: metadata || {},
      })
      .select()
      .single();

    if (partnerError) {
      logger.error('Failed to create partner pick', {
        correlationId,
        error: partnerError.message,
      });
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to create partner pick record',
        correlationId,
      });
      return;
    }

    logger.info('Pick created successfully', {
      correlationId,
      partnerId: req.partner!.id,
      pickId: partnerPick.id,
    });

    res.status(201).json({
      success: true,
      data: {
        ...partnerPick,
        unified_pick: unifiedPick,
      },
      correlationId,
    });
  } catch (error) {
    logger.error('Error creating pick', {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      correlationId,
    });
  }
});

/**
 * GET /partners/picks/:id - Get specific pick
 */
router.get('/picks/:id', requireScopes('read:picks'), async (req: PartnerAuthRequest, res) => {
  const correlationId = req.correlationId || `get-pick-${Date.now()}`;

  try {
    const { id } = req.params;

    const { data: pick, error } = await supabaseClient
      .from('partner_picks')
      .select(`
        *,
        unified_picks:unified_pick_id (*)
      `)
      .eq('id', id)
      .eq('partner_id', req.partner!.id)
      .single();

    if (error || !pick) {
      res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Pick not found',
        correlationId,
      });
      return;
    }

    res.json({
      success: true,
      data: pick,
      correlationId,
    });
  } catch (error) {
    logger.error('Error fetching pick', {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      correlationId,
    });
  }
});

// ===============================================================================
// /partners/markets - Market data endpoints
// ===============================================================================

/**
 * GET /partners/markets - Query market props
 */
router.get('/markets', requireScopes('read:markets'), async (req: PartnerAuthRequest, res) => {
  const correlationId = req.correlationId || `get-markets-${Date.now()}`;

  try {
    const {
      sport,
      player_name,
      market_type,
      game_date,
      limit = 100,
      offset = 0,
    } = req.query;

    let query = supabaseClient
      .from('raw_props')
      .select('*')
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    // Apply filters
    if (sport) query = query.eq('sport', sport);
    if (player_name) query = query.ilike('player_name', `%${player_name}%`);
    if (market_type) query = query.eq('stat_type', market_type);
    if (game_date) query = query.eq('game_date', game_date);

    const { data: markets, error, count } = await query;

    if (error) {
      logger.error('Failed to fetch markets', { correlationId, error: error.message });
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch markets',
        correlationId,
      });
      return;
    }

    res.json({
      success: true,
      data: markets,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: count || 0,
      },
      correlationId,
    });
  } catch (error) {
    logger.error('Error fetching markets', {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      correlationId,
    });
  }
});

// ===============================================================================
// /partners/stats - Analytics endpoints
// ===============================================================================

/**
 * GET /partners/stats - Get aggregate performance analytics
 */
router.get('/stats', requireScopes('read:stats'), async (req: PartnerAuthRequest, res) => {
  const correlationId = req.correlationId || `get-stats-${Date.now()}`;

  try {
    const { date_from, date_to, sport } = req.query;

    // Get partner picks with results
    let query = supabaseClient
      .from('partner_picks')
      .select(`
        id,
        created_at,
        unified_picks:unified_pick_id (
          sport,
          result,
          stake,
          potential_payout,
          professional_score,
          tier,
          game_date
        )
      `)
      .eq('partner_id', req.partner!.id)
      .not('unified_picks.result', 'is', null);

    if (date_from) {
      query = query.gte('unified_picks.game_date', date_from);
    }
    if (date_to) {
      query = query.lte('unified_picks.game_date', date_to);
    }
    if (sport) {
      query = query.eq('unified_picks.sport', sport);
    }

    const { data: picks, error } = await query;

    if (error) {
      logger.error('Failed to fetch stats', { correlationId, error: error.message });
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch statistics',
        correlationId,
      });
      return;
    }

    // Calculate statistics
    const totalPicks = picks?.length || 0;
    const wins = picks?.filter(p => (p.unified_picks as any)?.[0]?.result === 'win').length || 0;
    const losses = picks?.filter(p => (p.unified_picks as any)?.[0]?.result === 'loss').length || 0;
    const pushes = picks?.filter(p => (p.unified_picks as any)?.[0]?.result === 'push').length || 0;
    const winRate = totalPicks > 0 ? (wins / totalPicks * 100).toFixed(2) : '0.00';

    const totalStaked = picks?.reduce((sum, p) => sum + (Number((p.unified_picks as any)?.[0]?.stake) || 0), 0) || 0;
    const totalPayout = picks?.reduce((sum, p) => {
      if ((p.unified_picks as any)?.[0]?.result === 'win') {
        return sum + (Number((p.unified_picks as any)?.[0]?.potential_payout) || 0);
      }
      return sum;
    }, 0) || 0;
    const netProfit = totalPayout - totalStaked;
    const roi = totalStaked > 0 ? ((netProfit / totalStaked) * 100).toFixed(2) : '0.00';

    // Tier breakdown
    const tierBreakdown = picks?.reduce((acc: any, p) => {
      const tier = (p.unified_picks as any)?.[0]?.tier || 'unknown';
      if (!acc[tier]) acc[tier] = 0;
      acc[tier]++;
      return acc;
    }, {}) || {};

    // Sport breakdown
    const sportBreakdown = picks?.reduce((acc: any, p) => {
      const sport = (p.unified_picks as any)?.[0]?.sport || 'unknown';
      if (!acc[sport]) acc[sport] = 0;
      acc[sport]++;
      return acc;
    }, {}) || {};

    res.json({
      success: true,
      data: {
        overall: {
          totalPicks,
          wins,
          losses,
          pushes,
          winRate: Number(winRate),
          totalStaked,
          totalPayout,
          netProfit,
          roi: Number(roi),
        },
        breakdown: {
          byTier: tierBreakdown,
          bySport: sportBreakdown,
        },
      },
      correlationId,
    });
  } catch (error) {
    logger.error('Error fetching stats', {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      correlationId,
    });
  }
});

// ===============================================================================
// /partners/webhooks - Webhook management
// ===============================================================================

/**
 * GET /partners/webhooks - List webhooks
 */
router.get('/webhooks', requireScopes('read:webhooks'), async (req: PartnerAuthRequest, res) => {
  const correlationId = req.correlationId || `list-webhooks-${Date.now()}`;

  try {
    const { data: webhooks, error } = await supabaseClient
      .from('partner_webhooks')
      .select('*')
      .eq('partner_id', req.partner!.id)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch webhooks', { correlationId, error: error.message });
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch webhooks',
        correlationId,
      });
      return;
    }

    res.json({
      success: true,
      data: webhooks,
      correlationId,
    });
  } catch (error) {
    logger.error('Error fetching webhooks', {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      correlationId,
    });
  }
});

/**
 * POST /partners/webhooks - Register a webhook
 */
router.post('/webhooks', requireScopes('write:webhooks'), async (req: PartnerAuthRequest, res) => {
  const correlationId = req.correlationId || `create-webhook-${Date.now()}`;

  try {
    const { url, events } = req.body;

    // Validate required fields
    if (!url || !events || !Array.isArray(events) || events.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'URL and events array required',
        correlationId,
      });
      return;
    }

    // Validate URL format
    if (!url.match(/^https?:\/\//)) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid webhook URL format',
        correlationId,
      });
      return;
    }

    // Generate webhook secret
    const crypto = require('crypto');
    const secret = crypto.randomBytes(32).toString('hex');

    // Create webhook
    const { data: webhook, error } = await supabaseClient
      .from('partner_webhooks')
      .insert({
        partner_id: req.partner!.id,
        url,
        events,
        secret,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create webhook', { correlationId, error: error.message });
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to create webhook',
        correlationId,
      });
      return;
    }

    logger.info('Webhook created successfully', {
      correlationId,
      partnerId: req.partner!.id,
      webhookId: webhook.id,
    });

    res.status(201).json({
      success: true,
      data: webhook,
      correlationId,
    });
  } catch (error) {
    logger.error('Error creating webhook', {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      correlationId,
    });
  }
});

/**
 * DELETE /partners/webhooks/:id - Delete a webhook
 */
router.delete('/webhooks/:id', requireScopes('write:webhooks'), async (req: PartnerAuthRequest, res) => {
  const correlationId = req.correlationId || `delete-webhook-${Date.now()}`;

  try {
    const { id } = req.params;

    const { error } = await supabaseClient
      .from('partner_webhooks')
      .delete()
      .eq('id', id)
      .eq('partner_id', req.partner!.id);

    if (error) {
      logger.error('Failed to delete webhook', { correlationId, error: error.message });
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to delete webhook',
        correlationId,
      });
      return;
    }

    logger.info('Webhook deleted successfully', {
      correlationId,
      partnerId: req.partner!.id,
      webhookId: id,
    });

    res.json({
      success: true,
      message: 'Webhook deleted successfully',
      correlationId,
    });
  } catch (error) {
    logger.error('Error deleting webhook', {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      correlationId,
    });
  }
});

export { router as partnerRouter };
