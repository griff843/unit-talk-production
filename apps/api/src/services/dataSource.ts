/**
 * Data Source Adapters
 *
 * Provides abstraction layer for reading from views vs direct tables
 * Controlled by USE_VIEWS feature flag
 */

import { createClient } from '@supabase/supabase-js';
import { USE_VIEWS } from '../config/features';
import { createLogger } from '../utils/logger';

const logger = createLogger('DataSource');

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface DailyBoardPick {
  prop_id: string;
  sport: string;
  market: string;
  selection: string;
  line: number | null;
  odds: number | null;
  game_date: string;
  player_name: string | null;
  edge: number | null;
  prob_win: number | null;
  professional_score: number | null;
  tier: string | null;
  confidence: number | null;
  kelly_fraction: number | null;
  clv_pct: number | null;
  queue_status: string | null;
  publish_at: string | null;
  approved_by: string | null;
  denied_by: string | null;
}

export interface PropReadModel {
  prop_ref: string;
  sport: string;
  market: string;
  selection: string;
  line: number | null;
  odds: number | null;
  player_name: string | null;
  game_date: string;
  edge: number | null;
  prob_win: number | null;
  professional_score: number | null;
  tier: string | null;
  confidence: number | null;
  kelly_fraction: number | null;
  clv_pct: number | null;
}

export interface OpenPromotion {
  queue_id: string;
  prop_ref: string;
  status: string;
  publish_at: string | null;
  sport: string;
  market: string;
  selection: string;
  line: number | null;
  odds: number | null;
  player_name: string | null;
  game_date: string;
  edge: number | null;
  prob_win: number | null;
  tier: string | null;
}

/**
 * Get daily board picks (today's games with scoring + queue status)
 */
export async function getDailyBoard(filters?: {
  sport?: string;
  tier?: string;
  limit?: number;
}): Promise<DailyBoardPick[]> {
  if (USE_VIEWS) {
    logger.debug('Reading from v_daily_board view');

    let query = supabase
      .from('v_daily_board')
      .select('*');

    if (filters?.sport) {
      query = query.eq('sport', filters.sport);
    }
    if (filters?.tier) {
      query = query.eq('tier', filters.tier);
    }

    const { data, error } = await query
      .order('tier', { ascending: true, nullsFirst: false })
      .order('edge', { ascending: false, nullsFirst: false })
      .limit(filters?.limit || 50);

    if (error) {
      logger.error('Failed to read from v_daily_board', error);
      throw error;
    }

    return data || [];
  } else {
    logger.debug('Falling back to direct table queries');

    // Legacy: hand-rolled joins
    const { data, error } = await supabase
      .from('unified_picks')
      .select(`
        id,
        sport,
        market,
        selection,
        line,
        odds,
        game_date,
        player_name,
        scored_props!inner(
          edge,
          prob_win,
          professional_score,
          tier,
          confidence,
          kelly_fraction,
          clv_pct
        ),
        promotion_queue(
          status,
          publish_at,
          approved_by,
          denied_by
        )
      `)
      .gte('game_date', new Date().toISOString().split('T')[0]);

    if (error) {
      logger.error('Failed to read with legacy queries', error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      prop_id: row.id,
      sport: row.sport,
      market: row.market,
      selection: row.selection,
      line: row.line,
      odds: row.odds,
      game_date: row.game_date,
      player_name: row.player_name,
      edge: row.scored_props?.edge || null,
      prob_win: row.scored_props?.prob_win || null,
      professional_score: row.scored_props?.professional_score || null,
      tier: row.scored_props?.tier || null,
      confidence: row.scored_props?.confidence || null,
      kelly_fraction: row.scored_props?.kelly_fraction || null,
      clv_pct: row.scored_props?.clv_pct || null,
      queue_status: row.promotion_queue?.status || null,
      publish_at: row.promotion_queue?.publish_at || null,
      approved_by: row.promotion_queue?.approved_by || null,
      denied_by: row.promotion_queue?.denied_by || null,
    }));
  }
}

/**
 * Get prop read model (all picks with scoring data)
 */
export async function getPropReadModel(filters?: {
  sport?: string;
  tier?: string;
  gameDate?: string;
  limit?: number;
}): Promise<PropReadModel[]> {
  if (USE_VIEWS) {
    logger.debug('Reading from v_prop_read_model view');

    let query = supabase
      .from('v_prop_read_model')
      .select('*');

    if (filters?.sport) query = query.eq('sport', filters.sport);
    if (filters?.tier) query = query.eq('tier', filters.tier);
    if (filters?.gameDate) query = query.eq('game_date', filters.gameDate);

    const { data, error } = await query
      .order('edge', { ascending: false, nullsFirst: false })
      .limit(filters?.limit || 100);

    if (error) {
      logger.error('Failed to read from v_prop_read_model', error);
      throw error;
    }

    return data || [];
  } else {
    logger.debug('Falling back to direct table queries');

    const { data, error } = await supabase
      .from('unified_picks')
      .select(`
        id,
        sport,
        market,
        selection,
        line,
        odds,
        player_name,
        game_date,
        scored_props(
          edge,
          prob_win,
          professional_score,
          tier,
          confidence,
          kelly_fraction,
          clv_pct
        )
      `);

    if (error) {
      logger.error('Failed to read with legacy queries', error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      prop_ref: row.id,
      sport: row.sport,
      market: row.market,
      selection: row.selection,
      line: row.line,
      odds: row.odds,
      player_name: row.player_name,
      game_date: row.game_date,
      edge: row.scored_props?.edge || null,
      prob_win: row.scored_props?.prob_win || null,
      professional_score: row.scored_props?.professional_score || null,
      tier: row.scored_props?.tier || null,
      confidence: row.scored_props?.confidence || null,
      kelly_fraction: row.scored_props?.kelly_fraction || null,
      clv_pct: row.scored_props?.clv_pct || null,
    }));
  }
}

/**
 * Get open promotions (pending approval queue)
 */
export async function getOpenPromotions(): Promise<OpenPromotion[]> {
  if (USE_VIEWS) {
    logger.debug('Reading from v_open_promotions view');

    const { data, error } = await supabase
      .from('v_open_promotions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to read from v_open_promotions', error);
      throw error;
    }

    return data || [];
  } else {
    logger.debug('Falling back to direct table queries');

    const { data, error } = await supabase
      .from('promotion_queue')
      .select(`
        id,
        prop_ref,
        status,
        publish_at,
        unified_picks!inner(
          sport,
          market,
          selection,
          line,
          odds,
          player_name,
          game_date,
          scored_props(
            edge,
            prob_win,
            tier
          )
        )
      `)
      .eq('status', 'pending');

    if (error) {
      logger.error('Failed to read with legacy queries', error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      queue_id: row.id,
      prop_ref: row.prop_ref,
      status: row.status,
      publish_at: row.publish_at,
      sport: row.unified_picks?.sport || '',
      market: row.unified_picks?.market || '',
      selection: row.unified_picks?.selection || '',
      line: row.unified_picks?.line || null,
      odds: row.unified_picks?.odds || null,
      player_name: row.unified_picks?.player_name || null,
      game_date: row.unified_picks?.game_date || '',
      edge: row.unified_picks?.scored_props?.edge || null,
      prob_win: row.unified_picks?.scored_props?.prob_win || null,
      tier: row.unified_picks?.scored_props?.tier || null,
    }));
  }
}

/**
 * Submit pick for approval (uses RPC)
 */
export async function submitPick(
  propId: string,
  reason: string,
  orgId?: string
): Promise<string> {
  logger.info(`Submitting pick ${propId} for approval`);

  const { data, error } = await supabase.rpc('submit_pick', {
    p_unified_pick_id: propId,
    p_reason: reason,
    p_org_id: orgId || null,
  });

  if (error) {
    logger.error('Failed to submit pick', error);
    throw error;
  }

  return data as string; // Returns queue_id
}

/**
 * Approve a queued pick (uses RPC)
 */
export async function approvePick(
  queueId: string,
  approvedBy: string,
  reason: string
): Promise<void> {
  logger.info(`Approving pick ${queueId}`);

  const { error } = await supabase.rpc('approve_pick', {
    p_queue_id: queueId,
    p_approved_by: approvedBy,
    p_reason: reason,
  });

  if (error) {
    logger.error('Failed to approve pick', error);
    throw error;
  }
}

/**
 * Deny a queued pick (uses RPC)
 */
export async function denyPick(
  queueId: string,
  deniedBy: string,
  reason: string
): Promise<void> {
  logger.info(`Denying pick ${queueId}`);

  const { error } = await supabase.rpc('deny_pick', {
    p_queue_id: queueId,
    p_denied_by: deniedBy,
    p_reason: reason,
  });

  if (error) {
    logger.error('Failed to deny pick', error);
    throw error;
  }
}
