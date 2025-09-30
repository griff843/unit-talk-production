import { supabaseClient } from '../utils/supabaseUtils';
import { createLogger } from '../utils/logger';
import { LeagueAdapter } from '../workflows/settlement/adapters/types';
import { SettlementEngine } from '../workflows/settlement/engine';
import { normalizeMarket } from '../workflows/settlement/normalizers';
import { requireSupabase } from '../utils/supabaseUtils';

const logger = createLogger('SettlementActivities');

export interface SettlementConfig {
  batchSize?: number;
  dryRun?: boolean;
  rateLimit?: number;
  force?: boolean;
  shadow_mode?: boolean;
  freeze_mode?: boolean;
}

export interface BackfillOptions extends SettlementConfig {
  league?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface RawProp {
  id: string;
  player_name: string;
  sport: string;
  stat_type: string;
  line: number;
  over_odds: number;
  under_odds: number;
  game_date: string;
  external_prop_id?: string;
  external_game_id?: string;
  source: string;
  outcome?: string;
  settled_at?: string;
  settlement_source?: string;
  processed_at?: string;
}

let adapters: Map<string, LeagueAdapter> | null = null;
const engine = new SettlementEngine();

async function initializeAdapters() {
  if (adapters) return adapters;

  adapters = new Map();
  
  try {
    // Lazy load adapters
    const { MLBAdapter } = await import('../workflows/settlement/adapters/mlbAdapter');
    const { NFLAdapter } = await import('../workflows/settlement/adapters/nflAdapter');
    const { NBAAdapter } = await import('../workflows/settlement/adapters/nbaAdapter');
    const { NCAAAdapter } = await import('../workflows/settlement/adapters/ncaaAdapter');
    const { WNBAAdapter } = await import('../workflows/settlement/adapters/wnbaAdapter');
    const { SgoAdapter } = await import('../workflows/settlement/adapters/sgoAdapter');

    adapters.set('MLB', new MLBAdapter());
    adapters.set('NFL', new NFLAdapter());
    adapters.set('NBA', new NBAAdapter());
    adapters.set('NCAAF', new NCAAAdapter());
    adapters.set('NCAAB', new NCAAAdapter());
    adapters.set('WNBA', new WNBAAdapter());
    adapters.set('NHL', new NCAAAdapter());
    adapters.set('SGO', new SgoAdapter());

    logger.info('Settlement adapters initialized');
    return adapters;
  } catch (error) {
    logger.error('Failed to initialize adapters', { error });
    throw error;
  }
}

export async function fetchUnsetlledPicks(options: BackfillOptions): Promise<RawProp[]> {
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }

  let query = supabaseClient
    .from('raw_props')
    .select(`
      id,
      player_name,
      sport,
      stat_type,
      line,
      over_odds,
      under_odds,
      game_date,
      external_prop_id,
      game_id as external_game_id,
      source,
      outcome,
      settled_at,
      processed_at
    `)
    .is('settled_at', null)
    .order('game_date', { ascending: true });

  // Apply filters
  if (options.league) {
    query = query.eq('sport', options.league);
  }

  if (options.dateFrom) {
    query = query.gte('game_date', options.dateFrom);
  }

  if (options.dateTo) {
    query = query.lte('game_date', options.dateTo);
  }

  const batchSize = options.batchSize || 100;
  const { data: picks, error } = await query.limit(batchSize);

  if (error) {
    logger.error('Failed to fetch unsettled picks', { error });
    throw new Error(`Database error: ${error.message}`);
  }

  return picks || [];
}

export async function fetchPickById(id: string): Promise<RawProp | null> {
  const supabaseClient = requireSupabase();
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }

  const { data: pick, error } = await supabaseClient
    .from('raw_props')
    .select(`
      id,
      player_name,
      sport,
      stat_type,
      line,
      over_odds,
      under_odds,
      game_date,
      external_prop_id,
      game_id as external_game_id,
      source,
      outcome,
      settled_at,
      processed_at
    `)
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') { // Not found is ok
    logger.error('Failed to fetch pick', { id, error });
    throw new Error(`Database error: ${error.message}`);
  }

  return pick || null;
}

export async function settlePick(pick: RawProp, config: SettlementConfig): Promise<{
  success: boolean;
  outcome?: string;
  actualStat?: number;
  error?: string;
}> {
  try {
    // Skip if already settled (unless force mode)
    if (pick.outcome && !config.force) {
      logger.debug('Pick already settled, skipping', { id: pick.id });
      return { success: true, outcome: pick.outcome };
    }

    const adaptersMap = await initializeAdapters();
    
    // Determine adapter based on source and sport
    let adapter = adaptersMap.get(pick.sport);
    
    // If pick is from SGO source, use SGO adapter preferentially
    if (pick.source === 'sgo' && adaptersMap.has('SGO')) {
      adapter = adaptersMap.get('SGO');
      logger.debug('Using SGO adapter for backfilled pick', { pickId: pick.id });
    }

    if (!adapter) {
      throw new Error(`No adapter found for sport: ${pick.sport}, source: ${pick.source}`);
    }

    // For raw_props, determine game ID based on source
    let gameId: string;
    if (pick.source === 'sgo' && pick.external_game_id) {
      gameId = pick.external_game_id;
    } else {
      gameId = pick.external_prop_id || `${pick.sport}-${pick.game_date}`;
    }

    // Fetch game stats
    const gameStats = await adapter.fetchGameStats(gameId);
    
    // Get player stats with multiple lookup strategies
    let playerStats = gameStats[pick.player_name];
    
    if (!playerStats) {
      // Try lowercase lookup
      playerStats = gameStats[pick.player_name.toLowerCase()];
    }
    
    if (!playerStats) {
      // Try normalized name lookup for SGO data
      const normalizedName = normalizePlayerName(pick.player_name);
      const foundEntry = Object.entries(gameStats).find(([name, _stats]) =>
        normalizePlayerName(name) === normalizedName
      );
      if (foundEntry) {
        playerStats = foundEntry[1];
      }
    }

    if (!playerStats) {
      logger.warn('Player stats not found', { 
        pickId: pick.id,
        player: pick.player_name,
        gameId: gameId,
        source: pick.source,
        availablePlayers: Object.keys(gameStats).slice(0, 5)
      });
      
      // Mark as unable to settle
      if (!config.dryRun && !config.shadow_mode && !config.freeze_mode) {
        await updatePickSettlement(pick.id, {
          settlement_notes: `Player ${pick.player_name} not found in game stats`,
          processed_at: new Date().toISOString()
        });
      }
      return { success: false, error: `Player ${pick.player_name} not found in game stats` };
    }

    // Normalize the stat value
    const normalizedStat = normalizeMarket(
      pick.sport,
      pick.stat_type,
      playerStats
    );

    if (normalizedStat === null) {
      logger.warn('Failed to normalize stat', {
        pickId: pick.id,
        sport: pick.sport,
        statType: pick.stat_type,
        availableStats: Object.keys(playerStats).slice(0, 10)
      });
      
      if (!config.dryRun && !config.shadow_mode && !config.freeze_mode) {
        await updatePickSettlement(pick.id, {
          settlement_notes: `Unable to normalize stat ${pick.stat_type}`,
          processed_at: new Date().toISOString()
        });
      }
      return { success: false, error: `Unable to normalize stat ${pick.stat_type}` };
    }

    // Evaluate outcome for both over and under
    const overResult = engine.evaluate({
      league: pick.sport,
      market: pick.stat_type,
      line: pick.line,
      betType: 'over',
      actualStat: normalizedStat
    });

    const underResult = engine.evaluate({
      league: pick.sport,
      market: pick.stat_type,
      line: pick.line,
      betType: 'under',
      actualStat: normalizedStat
    });

    // Store the result (idempotently)
    if (!config.dryRun && !config.shadow_mode && !config.freeze_mode) {
      await updatePickSettlement(pick.id, {
        outcome: overResult.outcome,
        actual_stat: normalizedStat,
        settled_at: new Date().toISOString(),
        settlement_source: adapter.getName(),
        settlement_version: 1,
        processed_at: new Date().toISOString(),
        settlement_notes: `Settled via ${adapter.getName()} - Over: ${overResult.outcome}, Under: ${underResult.outcome}`
      });
      
      logger.info('Pick settled successfully', {
        pickId: pick.id,
        player: pick.player_name,
        stat: pick.stat_type,
        line: pick.line,
        actualStat: normalizedStat,
        overOutcome: overResult.outcome,
        underOutcome: underResult.outcome,
        source: adapter.getName()
      });
    } else {
      logger.info('DRY RUN: Would settle pick', {
        pickId: pick.id,
        player: pick.player_name,
        actualStat: normalizedStat,
        overOutcome: overResult.outcome,
        underOutcome: underResult.outcome,
        line: pick.line,
        adapter: adapter.getName()
      });
    }

    return {
      success: true,
      outcome: overResult.outcome,
      actualStat: normalizedStat
    };

  } catch (error) {
    logger.error('Failed to settle pick', {
      pickId: pick.id,
      error: error instanceof Error ? error.message : error
    });
    
    // Log settlement failure
    if (!config.dryRun && !config.shadow_mode && !config.freeze_mode) {
      await updatePickSettlement(pick.id, {
        settlement_notes: `Settlement failed: ${error instanceof Error ? error.message : error}`,
        processed_at: new Date().toISOString()
      });
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function updatePickSettlement(pickId: string, updates: any) {
  const supabaseClient = requireSupabase();
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }

  const { error } = await supabaseClient
    .from('raw_props')
    .update(updates)
    .eq('id', pickId);

  if (error) {
    logger.error('Failed to update pick settlement', { pickId, error });
    throw new Error(`Database error: ${error.message}`);
  }
}

function normalizePlayerName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\w\s\-\.\']/g, '')
    .replace(/\s+/g, ' ');
}

export async function rateLimitDelay(rateLimit?: number) {
  if (rateLimit) {
    await new Promise(resolve => setTimeout(resolve, 1000 / rateLimit));
  }
}