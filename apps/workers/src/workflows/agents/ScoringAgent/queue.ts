/**
 * Settlement Queue - Pick Selection Logic
 * 
 * Selects unsettled MLB picks from shadow_decisions for grading.
 * Handles game linkage fallbacks and final buffer requirements.
 */

import { supabase } from '../../../utils/supabase';
import { logger } from '../../../utils/logger';

export interface UnsettledPick {
  id: string;
  player: string;
  market: string;
  line: number;
  book: string;
  sport: string;
  team: string;
  event_time: string;
  tier: string;
  confidence: number;
  
  // Game context (may be null if not linked)
  game_id?: string;
  game_status?: string;
  game_start_time?: string;
  home_team?: string;
  away_team?: string;
  external_game_id?: string;
  
  // Prop context (may be null if not linked)  
  prop_id?: string;
  raw_prop_data?: any;
}

export interface SelectUnsettledPicksParams {
  league: string;
  limit: number;
  lookbackHours: number;
  finalBufferMinutes: number;
}

/**
 * Selects unsettled picks that are ready for grading
 * 
 * Priority order:
 * 1. Picks with both game_id and prop_id links
 * 2. Picks with game_id link only  
 * 3. Picks with team + event_time for fallback matching
 * 
 * Requirements:
 * - Game must be FINAL or started >6h ago
 * - Must respect final buffer (don't grade too soon after FINAL)
 * - Skip picks already settled
 */
export async function selectUnsettledPicks(params: SelectUnsettledPicksParams): Promise<UnsettledPick[]> {
  const { league, limit, lookbackHours, finalBufferMinutes } = params;
  
  const lookbackCutoff = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();
  const finalBufferCutoff = new Date(Date.now() - finalBufferMinutes * 60 * 1000).toISOString();

  logger.debug('Selecting unsettled picks', {
    league,
    limit,
    lookbackHours,
    finalBufferMinutes,
    lookbackCutoff,
    finalBufferCutoff
  });

  try {
    // Complex query to select picks with game context
    const { data: picks, error } = await supabase.rpc('select_unsettled_picks_for_grading', {
      p_league: league,
      p_limit: limit,
      p_lookback_cutoff: lookbackCutoff,
      p_final_buffer_cutoff: finalBufferCutoff
    });

    if (error) {
      // Fallback to direct query if RPC doesn't exist yet
      logger.warn('RPC function not found, using fallback query', { error: error.message });
      return await selectUnsettledPicksFallback(params);
    }

    logger.info('Selected unsettled picks via RPC', { 
      count: picks?.length || 0, 
      league 
    });

    return picks || [];

  } catch (error) {
    logger.error('Error selecting unsettled picks', {
      error: error instanceof Error ? error.message : String(error),
      league
    });
    
    // Try fallback approach
    return await selectUnsettledPicksFallback(params);
  }
}

/**
 * Fallback pick selection using direct SQL queries
 */
async function selectUnsettledPicksFallback(params: SelectUnsettledPicksParams): Promise<UnsettledPick[]> {
  const { league, limit, lookbackHours, finalBufferMinutes } = params;
  
  const lookbackCutoff = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();
  const finalBufferCutoff = new Date(Date.now() - finalBufferMinutes * 60 * 1000).toISOString();

  logger.debug('Using fallback pick selection', { league, limit });

  // First, try picks with game linkage (best case)
  const { data: linkedPicks, error: linkedError } = await supabase
    .from('shadow_decisions')
    .select(`
      id,
      player,
      market,
      line,
      book,
      sport,
      team,
      event_time,
      tier,
      confidence,
      game_id,
      prop_id,
      games!inner(
        id,
        status,
        start_time,
        home_team,
        away_team,
        external_game_id
      )
    `)
    .eq('sport', league)
    .is('settled_at', null)
    .not('game_id', 'is', null)
    .gte('event_time', lookbackCutoff)
    .or(`games.status.ilike.FINAL%,games.start_time.lt.${new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()}`)
    .lte('games.start_time', finalBufferCutoff)
    .order('event_time', { ascending: true })
    .limit(Math.ceil(limit * 0.8)); // Reserve some slots for fallback matching

  if (linkedError) {
    logger.error('Error selecting linked picks', { error: linkedError.message });
  }

  const results: UnsettledPick[] = [];

  // Process linked picks
  if (linkedPicks) {
    for (const pick of linkedPicks) {
      const game = Array.isArray(pick.games) ? pick.games[0] : pick.games;
      
      results.push({
        id: pick.id,
        player: pick.player,
        market: pick.market,
        line: parseFloat(pick.line) || 0,
        book: pick.book,
        sport: pick.sport,
        team: pick.team,
        event_time: pick.event_time,
        tier: pick.tier,
        confidence: pick.confidence,
        game_id: pick.game_id,
        game_status: game?.status,
        game_start_time: game?.start_time,
        home_team: game?.home_team,
        away_team: game?.away_team,
        external_game_id: game?.external_game_id,
        prop_id: pick.prop_id
      });
    }
  }

  // If we need more picks, try fallback matching by team + event_time
  const remainingSlots = limit - results.length;
  if (remainingSlots > 0) {
    const { data: fallbackPicks, error: fallbackError } = await supabase
      .from('shadow_decisions')
      .select('*')
      .eq('sport', league)
      .is('settled_at', null)
      .is('game_id', null)
      .not('team', 'is', null)
      .not('event_time', 'is', null)
      .gte('event_time', lookbackCutoff)
      .order('event_time', { ascending: true })
      .limit(remainingSlots);

    if (fallbackError) {
      logger.error('Error selecting fallback picks', { error: fallbackError.message });
    } else if (fallbackPicks) {
      // For each fallback pick, try to find a matching game
      for (const pick of fallbackPicks) {
        const matchedGame = await findGameByTeamAndTime(
          pick.team,
          pick.event_time,
          league
        );

        if (matchedGame && shouldGradeGame(matchedGame, finalBufferCutoff)) {
          results.push({
            id: pick.id,
            player: pick.player,
            market: pick.market,
            line: parseFloat(pick.line) || 0,
            book: pick.book,
            sport: pick.sport,
            team: pick.team,
            event_time: pick.event_time,
            tier: pick.tier,
            confidence: pick.confidence,
            game_id: matchedGame.id,
            game_status: matchedGame.status,
            game_start_time: matchedGame.start_time,
            home_team: matchedGame.home_team,
            away_team: matchedGame.away_team,
            external_game_id: matchedGame.external_game_id
          });
        }
      }
    }
  }

  logger.info('Selected unsettled picks via fallback', { 
    count: results.length, 
    linkedCount: linkedPicks?.length || 0,
    league 
  });

  return results;
}

/**
 * Find a game by team name and approximate time
 */
async function findGameByTeamAndTime(
  team: string,
  eventTime: string,
  league: string
): Promise<any | null> {
  const eventDate = new Date(eventTime);
  const dayBefore = new Date(eventDate.getTime() - 24 * 60 * 60 * 1000);
  const dayAfter = new Date(eventDate.getTime() + 24 * 60 * 60 * 1000);

  const { data: games, error } = await supabase
    .from('games')
    .select('*')
    .eq('league', league)
    .gte('start_time', dayBefore.toISOString())
    .lte('start_time', dayAfter.toISOString())
    .or(`home_team.ilike.%${team}%,away_team.ilike.%${team}%`)
    .order('start_time', { ascending: true });

  if (error || !games || games.length === 0) {
    return null;
  }

  // Find the game with the closest start time to event time
  let bestMatch = games[0];
  let bestTimeDiff = Math.abs(new Date(games[0].start_time).getTime() - eventDate.getTime());

  for (const game of games) {
    const timeDiff = Math.abs(new Date(game.start_time).getTime() - eventDate.getTime());
    if (timeDiff < bestTimeDiff) {
      bestMatch = game;
      bestTimeDiff = timeDiff;
    }
  }

  // Only return if the time difference is reasonable (within 12 hours)
  if (bestTimeDiff <= 12 * 60 * 60 * 1000) {
    return bestMatch;
  }

  return null;
}

/**
 * Check if a game should be graded based on status and timing
 */
function shouldGradeGame(game: any, finalBufferCutoff: string): boolean {
  const gameStartTime = new Date(game.start_time);
  const now = new Date();
  const bufferCutoff = new Date(finalBufferCutoff);

  // Game must be final or started more than 6 hours ago
  const isComplete = game.status?.toUpperCase().includes('FINAL') || 
                    gameStartTime.getTime() < now.getTime() - 6 * 60 * 60 * 1000;

  // Must respect final buffer - don't grade too soon after completion
  const respectsBuffer = gameStartTime.getTime() < bufferCutoff.getTime();

  return isComplete && respectsBuffer;
}