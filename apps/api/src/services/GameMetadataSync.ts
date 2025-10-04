/**
 * Game Metadata Sync Service
 *
 * Syncs game metadata from Odds API to the games table
 * Ensures game data is available for props processing and alerts
 */

import { createSupabaseClient } from '../utils/supabase';
import { logger } from '../shared/logger';

interface OddsApiGame {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: any[];
}

interface GameMetadataRow {
  id: string;
  sport: string;
  home_team: string;
  away_team: string;
  game_date: string; // Changed from commence_time to match database schema
  matchup: string;
  external_game_id: string; // Map to Odds API id
  external_data: {
    odds_api_id: string;
    sport_key: string;
    sport_title: string;
    bookmakers: string[];
    last_update: string;
  };
}

/**
 * Map Odds API sport keys to database sport values
 */
function mapSportKeyToDbFormat(sportKey: string): string {
  const mapping: Record<string, string> = {
    'americanfootball_nfl': 'NFL',
    'baseball_mlb': 'MLB',
    'basketball_wnba': 'WNBA',
    'basketball_nba': 'NBA',
    'icehockey_nhl': 'NHL',
    'americanfootball_ncaaf': 'NCAAF',
  };

  return mapping[sportKey] || sportKey.toUpperCase();
}

/**
 * Sync game metadata to the games table
 *
 * @param games - Array of Odds API game objects
 * @returns Object with sync results
 */
export async function syncGameMetadata(games: OddsApiGame[]): Promise<{
  success: boolean;
  synced: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let synced = 0;

  try {
    logger.info(`[GameMetadataSync] Syncing ${games.length} games to database`);

    const supabase = createSupabaseClient();
    if (!supabase) {
      const errMsg = 'Supabase client not available';
      logger.error(`[GameMetadataSync] ${errMsg}`);
      errors.push(errMsg);
      return { success: false, synced: 0, errors };
    }

    const { randomUUID } = await import('crypto');

    const rows: GameMetadataRow[] = games.map(game => ({
      id: randomUUID(), // Generate UUID for games table primary key
      sport: mapSportKeyToDbFormat(game.sport_key),
      home_team: game.home_team,
      away_team: game.away_team,
      game_date: game.commence_time, // Map commence_time to game_date
      matchup: `${game.away_team} @ ${game.home_team}`,
      external_game_id: game.id, // Store Odds API id in external_game_id
      external_data: {
        odds_api_id: game.id,
        sport_key: game.sport_key,
        sport_title: game.sport_title,
        bookmakers: game.bookmakers ? game.bookmakers.map(b => b.key) : [],
        last_update: new Date().toISOString(),
      },
    }));

    const { data, error } = await supabase
      .from('games')
      .upsert(rows, {
        onConflict: 'external_game_id', // Upsert by Odds API game id, not UUID
        ignoreDuplicates: false,
      });

    if (error) {
      logger.error('[GameMetadataSync] Database error during sync', { error });
      errors.push(`Database error: ${error.message}`);
      return { success: false, synced: 0, errors };
    }

    synced = rows.length;
    logger.info(`[GameMetadataSync] Successfully synced ${synced} games`, {
      sports: [...new Set(rows.map(r => r.sport))],
      gameIds: rows.map(r => r.id),
    });

    return { success: true, synced, errors };
  } catch (err: any) {
    const errorMsg = err?.message || 'Unknown error during game metadata sync';
    logger.error('[GameMetadataSync] Unexpected error', { error: errorMsg });
    errors.push(errorMsg);
    return { success: false, synced, errors };
  }
}

/**
 * Batch sync games by sport
 *
 * @param gamesBySport - Map of sport key to games array
 * @returns Overall sync results
 */
export async function syncGamesBySport(
  gamesBySport: Map<string, OddsApiGame[]>
): Promise<{
  success: boolean;
  totalSynced: number;
  sportResults: Map<string, { synced: number; errors: string[] }>;
}> {
  const sportResults = new Map<string, { synced: number; errors: string[] }>();
  let totalSynced = 0;
  let overallSuccess = true;

  for (const [sport, games] of gamesBySport.entries()) {
    const result = await syncGameMetadata(games);
    sportResults.set(sport, {
      synced: result.synced,
      errors: result.errors,
    });
    totalSynced += result.synced;
    if (!result.success) {
      overallSuccess = false;
    }
  }

  return {
    success: overallSuccess,
    totalSynced,
    sportResults,
  };
}