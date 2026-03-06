/**
 * SGO Stat ID → Canonical Market Key Mapper
 * Sprint: SPRINT-027A-SGO-HISTORICAL-BACKFILL
 *
 * Maps SGO statID values (from /v2/events odds) to canonical
 * market_types.market_key values used in provider_offers.
 */

import { SupabaseClient } from '@supabase/supabase-js';

// SGO statID → canonical market_types.market_key
const SGO_STAT_TO_MARKET_KEY: Record<string, string> = {
  // NBA player props (SGO statID values from /v2/events)
  points: 'player_points_ou',
  rebounds: 'player_rebounds_ou',
  assists: 'player_assists_ou',
  threes: 'player_3pm_ou',
  '3pm': 'player_3pm_ou',
  threepointersmaed: 'player_3pm_ou',
  threepointersmade: 'player_3pm_ou',
  steals: 'player_steals_ou',
  blocks: 'player_blocks_ou',
  pra: 'player_pra_ou',
  'points+rebounds+assists': 'player_pra_ou',
  'pts+rebs+asts': 'player_pra_ou',
  'points+rebounds': 'player_pts_rebs_ou',
  'pts+rebs': 'player_pts_rebs_ou',
  'points+assists': 'player_pts_asts_ou',
  'pts+asts': 'player_pts_asts_ou',
  'rebounds+assists': 'player_rebs_asts_ou',
  'rebs+asts': 'player_rebs_asts_ou',
  turnovers: 'player_turnovers_ou',
  'blocks+steals': 'player_blocks_steals_ou',
  doubledouble: 'player_double_double',
  tripledouble: 'player_triple_double',
  fantasyscore: 'player_fantasy_score_ou',

  // NFL player props
  passingyards: 'player_passing_yards_ou',
  passing_yards: 'player_passing_yards_ou',
  passingtds: 'player_passing_tds_ou',
  passing_tds: 'player_passing_tds_ou',
  rushingyards: 'player_rushing_yards_ou',
  rushing_yards: 'player_rushing_yards_ou',
  receivingyards: 'player_receiving_yards_ou',
  receiving_yards: 'player_receiving_yards_ou',
  receptions: 'player_receptions_ou',
  'rush+rec_yards': 'player_rush_rec_yards_ou',

  // Game lines
  moneyline: 'moneyline',
  spread: 'spread',
  total: 'total',
};

/**
 * Map a SGO statID to canonical market_key.
 * Returns null for unmapped stat types.
 */
export function mapSgoStatToMarketKey(statID: string): string | null {
  if (!statID) return null;
  const normalized = statID.toLowerCase().trim();
  return SGO_STAT_TO_MARKET_KEY[normalized] ?? null;
}

// In-memory cache for market_type_id lookups
const marketTypeIdCache = new Map<string, number | null>();

/**
 * Resolve a SGO statID to a canonical market_type_id.
 * Uses in-memory cache to avoid repeated DB queries.
 */
export async function resolveMarketTypeId(
  supabase: SupabaseClient,
  statID: string
): Promise<number | null> {
  const marketKey = mapSgoStatToMarketKey(statID);
  if (!marketKey) return null;

  if (marketTypeIdCache.has(marketKey)) {
    return marketTypeIdCache.get(marketKey)!;
  }

  const { data } = await supabase
    .from('market_types')
    .select('id')
    .eq('market_key', marketKey)
    .limit(1)
    .single();

  if (data?.id) {
    marketTypeIdCache.set(marketKey, data.id);
    return data.id;
  }

  // Fallback to player_prop_generic for unmapped player prop types
  if (marketKey.startsWith('player_')) {
    const { data: fallback } = await supabase
      .from('market_types')
      .select('id')
      .eq('market_key', 'player_prop_generic')
      .limit(1)
      .single();
    const fallbackId = fallback?.id ?? null;
    marketTypeIdCache.set(marketKey, fallbackId);
    return fallbackId;
  }

  marketTypeIdCache.set(marketKey, null);
  return null;
}

/**
 * Clear the market_type_id cache (for testing).
 */
export function clearMarketTypeCache(): void {
  marketTypeIdCache.clear();
}

/**
 * Get all known SGO stat mappings (for diagnostics).
 */
export function getKnownStatMappings(): Record<string, string> {
  return { ...SGO_STAT_TO_MARKET_KEY };
}
