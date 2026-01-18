/**
 * Picks Repository - Driver Abstraction Layer
 *
 * Provides compatibility between unified_picks and canonical picks tables.
 * Controlled by PICK_DRIVER environment variable.
 */

import { env } from '@/lib/env';
import { supabaseServer } from '@/lib/supabase';
import type { PickInput, PickRecord, InsertPickResult } from '@/types/form';
import { v4 as uuidv4 } from 'uuid';

/**
 * Insert a pick using the configured driver
 */
export async function insertPick(
  input: PickInput,
  idempotencyKey?: string
): Promise<InsertPickResult> {
  const driver = env.PICK_DRIVER;

  switch (driver) {
    case 'unified':
      return insertUnifiedPick(input, idempotencyKey);
    case 'canonical':
      return insertCanonicalPick(input, idempotencyKey);
    default:
      throw new Error(`Unknown PICK_DRIVER: ${driver}`);
  }
}

/**
 * Insert into unified_picks table (legacy v3 structure)
 */
async function insertUnifiedPick(
  input: PickInput,
  idempotencyKey?: string
): Promise<InsertPickResult> {
  const supabase = supabaseServer();
  const betSlipId = idempotencyKey || uuidv4();

  // Check for duplicate (idempotency)
  if (idempotencyKey) {
    const { data: existing } = await supabase
      .from('unified_picks')
      .select('id, bet_slip_id, created_at')
      .eq('bet_slip_id', betSlipId)
      .maybeSingle();

    if (existing) {
      // Return existing pick (409 duplicate will be handled by caller)
      return {
        id: existing.id,
        bet_slip_id: existing.bet_slip_id,
        created_at: existing.created_at,
      };
    }
  }

  // Map PickInput to unified_picks schema
  const pickData = {
    bet_slip_id: betSlipId,
    user_id: input.capperId,
    sport: input.league,
    player_id: input.playerId,
    game_id: input.gameId,
    game_date: input.gameDate,
    stat_type: input.marketType,
    line: input.line,
    selection: input.side,
    odds: input.odds,
    confidence: (input.userScore || 0) / 10, // Convert 1-10 to 0-1
    team_id: input.teamId,
    source: 'smart_form',
  };

  const { data, error } = await supabase
    .from('unified_picks')
    .insert(pickData)
    .select('id, bet_slip_id, created_at')
    .single();

  if (error) {
    throw new Error(`Failed to insert unified pick: ${error.message}`);
  }

  // Also write stake_text to bridge_outbox if PUBLISH_MODE is outbox
  if (env.PUBLISH_MODE === 'outbox' && input.stakeText) {
    await supabase
      .from('bridge_outbox')
      .insert({
        event_type: 'pick_submitted',
        payload: {
          bet_slip_id: betSlipId,
          pick_id: data.id,
          stake_text: input.stakeText,
          user_score: input.userScore,
        },
        unique_key: betSlipId,
        status: 'pending',
      });
  }

  return {
    id: data.id,
    bet_slip_id: data.bet_slip_id,
    created_at: data.created_at,
  };
}

/**
 * Insert into canonical picks table (new v4 structure)
 */
async function insertCanonicalPick(
  input: PickInput,
  idempotencyKey?: string
): Promise<InsertPickResult> {
  const supabase = supabaseServer();
  const betSlipId = idempotencyKey || uuidv4();

  // Check for duplicate (idempotency)
  if (idempotencyKey) {
    const { data: existing } = await supabase
      .from('picks')
      .select('id, bet_slip_id, created_at')
      .eq('bet_slip_id', betSlipId)
      .maybeSingle();

    if (existing) {
      return {
        id: existing.id,
        bet_slip_id: existing.bet_slip_id,
        created_at: existing.created_at,
      };
    }
  }

  // Map PickInput to canonical picks schema
  const pickData = {
    bet_slip_id: betSlipId,
    capper_id: input.capperId,
    league: input.league,
    player_id: input.playerId,
    player_name: input.playerName,
    game_id: input.gameId,
    game_date: input.gameDate,
    market_type: input.marketType,
    line: input.line,
    side: input.side,
    odds: input.odds,
    stake_text: input.stakeText,
    user_score: input.userScore,
    team_id: input.teamId,
    tenant_id: env.TENANT_ID,
    source: 'smart_form',
    status: 'pending',
  };

  const { data, error } = await supabase
    .from('picks')
    .insert(pickData)
    .select('id, bet_slip_id, created_at')
    .single();

  if (error) {
    throw new Error(`Failed to insert canonical pick: ${error.message}`);
  }

  // Write to pick_publish outbox if PUBLISH_MODE is outbox
  if (env.PUBLISH_MODE === 'outbox') {
    await supabase
      .from('pick_publish')
      .insert({
        pick_id: data.id,
        status: 'pending',
        tenant_id: env.TENANT_ID,
      });
  }

  return {
    id: data.id,
    bet_slip_id: data.bet_slip_id,
    created_at: data.created_at,
  };
}

/**
 * Check if a pick exists (for idempotency checks at API level)
 */
export async function checkPickExists(
  tenantId: string,
  userId: string,
  playerId: string,
  marketType: string,
  line: number,
  side: string,
  date: string
): Promise<{ exists: boolean; pickId?: string }> {
  const supabase = supabaseServer();
  const driver = env.PICK_DRIVER;

  const table = driver === 'unified' ? 'unified_picks' : 'picks';
  const userIdField = driver === 'unified' ? 'user_id' : 'capper_id';
  const marketField = driver === 'unified' ? 'stat_type' : 'market_type';
  const sideField = driver === 'unified' ? 'selection' : 'side';

  const { data } = await supabase
    .from(table)
    .select('id')
    .eq(userIdField, userId)
    .eq('player_id', playerId)
    .eq(marketField, marketType)
    .eq('line', line)
    .eq(sideField, side)
    .gte('created_at', `${date}T00:00:00Z`)
    .lt('created_at', `${date}T23:59:59Z`)
    .maybeSingle();

  return {
    exists: !!data,
    pickId: data?.id,
  };
}
