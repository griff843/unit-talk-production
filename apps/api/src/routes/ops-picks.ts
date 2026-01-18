/**
 * Operations API Routes - Pick Management
 *
 * Provides operator-facing endpoints for pick promotion and lifecycle management
 *
 * CRITICAL: These endpoints are for operator control in Command Center.
 * Authentication required for production use.
 */

import express from 'express';
import { z } from 'zod';
import { logger } from '../shared/logger';
import { PicksDriverFactory } from '../services/picks/PicksDriverFactory';
import { pickPublisher } from '../services/picks/PickPublisher';
import { auditLogger } from '../services/picks/AuditLogger';
import { supabaseClient } from '../services/supabaseClient';

const router = express.Router();

// Simple admin auth middleware (matches ops.ts pattern)
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

/**
 * Promotion request validation schema
 */
const PromotePickSchema = z.object({
  channel: z.enum(['DISCORD', 'CANARY'], {
    errorMap: () => ({ message: 'Channel must be DISCORD or CANARY' }),
  }).optional().default('DISCORD'),
  threadId: z.string().optional(),
  scheduledFor: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * GET /api/ops/picks/pending
 *
 * List all picks pending review for operator approval
 *
 * Query params:
 * - limit: number (default 50, max 200)
 * - sport: string (optional filter)
 * - capper: string (optional filter by username)
 */
router.get('/pending', async (req, res) => {
  const correlationId = `ops-pending-${Date.now()}`;
  const requestLogger = logger.child({ correlationId, endpoint: '/api/ops/picks/pending' });

  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const sport = req.query.sport as string | undefined;
    const capper = req.query.capper as string | undefined;

    requestLogger.info('Fetching pending picks for review', { limit, sport, capper });

    // Fetch pending picks from canonical picks table using supabaseClient directly
    const { data: picks, error } = await supabaseClient
      .from('picks')
      .select(`
        id, user_id, selection, odds, confidence, status, workflow_stage,
        metadata, created_at, updated_at,
        users!picks_user_id_fkey (username, discord_id, tier),
        props (sport, league, player_name, stat_type, line, over_odds, under_odds, team, opponent, game_time)
      `)
      .eq('workflow_stage', 'pending_review')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch pending picks: ${error.message}`);
    }

    // Apply optional filters
    let filteredPicks = picks || [];
    if (sport) {
      filteredPicks = filteredPicks.filter(p => {
        const prop = Array.isArray(p.props) ? p.props[0] : p.props;
        return prop?.sport?.toLowerCase() === sport.toLowerCase();
      });
    }
    if (capper) {
      filteredPicks = filteredPicks.filter(p => {
        const user = Array.isArray(p.users) ? p.users[0] : p.users;
        return user?.username?.toLowerCase() === capper.toLowerCase();
      });
    }

    requestLogger.info('Pending picks fetched successfully', {
      total: filteredPicks.length,
      withFilters: sport || capper ? true : false,
    });

    return res.json({
      success: true,
      picks: filteredPicks,
      count: filteredPicks.length,
      correlationId,
    });

  } catch (error) {
    requestLogger.error('Failed to fetch pending picks', {
      error: error instanceof Error ? error.message : String(error),
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to fetch pending picks',
      message: error instanceof Error ? error.message : 'Unknown error',
      correlationId,
    });
  }
});

/**
 * GET /api/ops/picks/:id
 *
 * Get full details for a single pick including all metadata
 */
router.get('/:id', async (req, res) => {
  const { id: pickId } = req.params;
  const correlationId = `ops-pick-${pickId}`;
  const requestLogger = logger.child({ correlationId, endpoint: '/api/ops/picks/:id' });

  try {
    requestLogger.info('Fetching pick details', { pickId });

    const { data: pick, error } = await supabaseClient
      .from('picks')
      .select(`
        *,
        users!picks_user_id_fkey (username, discord_id, tier, capper_tier),
        props (
          sport, league, player_name, stat_type, line, over_odds, under_odds,
          team, opponent, game_time, bookmaker, external_game_id, external_prop_id
        ),
        pick_publish (id, status, channel, external_message_id, attempts, sent_at)
      `)
      .eq('id', pickId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Pick not found',
          pickId,
          correlationId,
        });
      }
      throw new Error(`Failed to fetch pick: ${error.message}`);
    }

    requestLogger.info('Pick details fetched successfully', { pickId });

    return res.json({
      success: true,
      pick,
      correlationId,
    });

  } catch (error) {
    requestLogger.error('Failed to fetch pick details', {
      pickId,
      error: error instanceof Error ? error.message : String(error),
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to fetch pick details',
      message: error instanceof Error ? error.message : 'Unknown error',
      correlationId,
    });
  }
});

/**
 * POST /api/ops/picks/:id/promote
 *
 * Promote an approved pick for Discord publishing
 *
 * This endpoint:
 * 1. Validates pick is approved
 * 2. Writes complete metadata to pick_publish table
 * 3. Returns publish record ID for monitoring
 *
 * Request Body:
 * {
 *   channel?: 'DISCORD' | 'CANARY' (default: 'DISCORD'),
 *   threadId?: string,
 *   scheduledFor?: ISO datetime,
 *   metadata?: Record<string, any>
 * }
 *
 * Response:
 * {
 *   success: true,
 *   publishId: string,
 *   pickId: string,
 *   publishMode: 'outbox' | 'direct'
 * }
 */
router.post('/:id/promote', async (req, res) => {
  const { id: pickId } = req.params;
  const correlationId = `ops-promote-${pickId}`;
  const requestLogger = logger.child({ correlationId, endpoint: '/api/ops/picks/:id/promote' });

  try {
    // Validate request body
    const validation = PromotePickSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors,
        correlationId,
      });
    }

    const { channel, threadId, scheduledFor, metadata } = validation.data;

    requestLogger.info('Processing pick promotion', {
      pickId,
      channel,
      threadId,
      scheduledFor,
    });

    // 1. Fetch pick with complete metadata using supabaseClient directly
    // Note: props join is optional - pick metadata may have the data we need
    const { data: pick, error: fetchError } = await supabaseClient
      .from('picks')
      .select(`
        *,
        users!picks_user_id_fkey (username, discord_id, tier, capper_tier)
      `)
      .eq('id', pickId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Pick not found',
          pickId,
          correlationId,
        });
      }
      throw new Error(`Failed to fetch pick: ${fetchError.message}`);
    }

    // 2. Validate pick is approved
    if (pick.workflow_stage !== 'approved') {
      return res.status(400).json({
        success: false,
        error: 'Pick must be approved before promotion',
        pickId,
        currentWorkflowStage: pick.workflow_stage,
        correlationId,
      });
    }

    // 3. Build complete publish metadata for Discord templates
    // Extract user data (handle array or single object from Supabase)
    const user = Array.isArray(pick.users) ? pick.users[0] : pick.users;

    // Build metadata from pick.metadata since props table is empty
    const publishMetadata = {
      // Pick context for Discord formatting
      playerName: pick.metadata?.player_name || pick.metadata?.playerName || 'Unknown Player',
      sport: pick.metadata?.sport || 'unknown',
      league: pick.metadata?.league || 'unknown',
      statType: pick.metadata?.stat_type || pick.metadata?.marketType || 'unknown',
      line: pick.metadata?.line || 0,
      pickSide: pick.selection?.toLowerCase() || 'unknown',
      odds: pick.odds || -110,
      units: pick.metadata?.units || 1,

      // Capper information
      capper: user?.username || 'Professional System',
      capperTier: user?.capper_tier || user?.tier || 'C',
      capperDiscordId: user?.discord_id,

      // Professional grading data
      professional_score: pick.professional_score || pick.metadata?.professional_score,
      tier: pick.metadata?.tier || user?.tier || 'C',
      confidence: pick.confidence || 50,

      // Canonical IDs from metadata
      canonical_game_id: pick.metadata?.canonical_game_id || pick.metadata?.game_id,
      canonical_player_id: pick.metadata?.canonical_player_id || pick.metadata?.playerId,

      // Game context from metadata
      home_team: pick.metadata?.home_team,
      away_team: pick.metadata?.away_team,
      game_time: pick.metadata?.game_time || pick.metadata?.gameDate,
      bookmaker: pick.metadata?.bookmaker,

      // Odds context from metadata
      over_odds: pick.metadata?.over_odds,
      under_odds: pick.metadata?.under_odds,

      // Metadata for tracking
      timestamp: new Date().toISOString(),
      source: 'operator_promotion',
      promoted_by: req.headers['x-operator-id'] || 'unknown',

      // Merge user-provided metadata
      ...metadata,
    };

    // 4. Write to pick_publish table
    const publishOptions = {
      channel: channel || 'DISCORD',
      threadId,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
      metadata: publishMetadata,
    };

    // Use PickPublisher service to handle outbox/direct mode
    await pickPublisher.publish(
      {
        id: pick.id,
        tenantId: pick.tenant_id,
        userId: pick.user_id,
        selection: pick.selection,
        odds: pick.odds,
        stake: pick.stake,
        status: pick.status,
        createdAt: pick.created_at,
      },
      publishOptions
    );

    // 5. Get the created publish record ID
    const { data: publishRecord } = await supabaseClient
      .from('pick_publish')
      .select('id, status, channel, created_at')
      .eq('pick_id', pickId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    requestLogger.info('Pick promoted successfully', {
      pickId,
      publishId: publishRecord?.id,
      channel,
      publishMode: pickPublisher.getPublishMode(),
    });

    // 6. Log audit event
    await auditLogger.log({
      eventType: 'pick.promoted',
      refType: 'pick',
      refId: pickId,
      tenantId: pick.tenant_id,
      actorId: req.headers['x-operator-id'] as string || undefined,
      data: {
        pick_id: pickId,
        publish_id: publishRecord?.id,
        channel,
        thread_id: threadId,
        scheduled_for: scheduledFor,
      },
    });

    return res.status(200).json({
      success: true,
      pickId,
      publishId: publishRecord?.id,
      publishMode: pickPublisher.getPublishMode(),
      channel,
      status: publishRecord?.status,
      correlationId,
    });

  } catch (error) {
    requestLogger.error('Pick promotion failed', {
      pickId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return res.status(500).json({
      success: false,
      error: 'Pick promotion failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      correlationId,
    });
  }
});

/**
 * GET /api/ops/health
 *
 * Health check for ops API
 */
router.get('/health', async (req, res) => {
  return res.json({
    success: true,
    service: 'Unit Talk Operations API - Picks',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    endpoints: [
      'GET /api/ops/picks/pending',
      'GET /api/ops/picks/:id',
      'POST /api/ops/picks/:id/promote',
    ],
  });
});

export default router;
