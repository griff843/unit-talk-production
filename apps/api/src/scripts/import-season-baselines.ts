/**
 * import-season-baselines.ts
 *
 * BASELINE-DATA-001: Populates player_season_stats table from ESPN APIs.
 * This provides the foundation data for projection models.
 *
 * Usage:
 *   npx tsx apps/api/src/scripts/import-season-baselines.ts --sport=NBA --season=2025-26
 *   npx tsx apps/api/src/scripts/import-season-baselines.ts --sport=all --season=2025-26
 *
 * Features:
 *   - Fetches season averages from ESPN
 *   - Handles NBA, NFL, MLB, NHL
 *   - Rate-limited to 1 req/sec
 *   - Upserts to player_season_stats with deduplication
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Configuration
// ============================================================================

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports';
const ESPN_V3_URL = 'https://site.api.espn.com/apis/common/v3/sports';
const ESPN_CORE_URL = 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba';
const RATE_LIMIT_MS = 300; // Core API can handle faster requests

// Sport-specific ESPN endpoints
const SPORT_CONFIG: Record<string, { endpoint: string; leagueId: string }> = {
  NBA: { endpoint: 'basketball/nba', leagueId: '46' },
  NFL: { endpoint: 'football/nfl', leagueId: '28' },
  MLB: { endpoint: 'baseball/mlb', leagueId: '10' },
  NHL: { endpoint: 'hockey/nhl', leagueId: '90' },
};

// ============================================================================
// Types
// ============================================================================

interface PlayerSeasonStats {
  espn_id: string; // ESPN player ID (not stored, just for tracking)
  player_name: string;
  team: string;
  sport: string;
  season: string;
  games_played: number;
  minutes_per_game?: number;
  // Basketball
  points_per_game?: number;
  rebounds_per_game?: number;
  assists_per_game?: number;
  steals_per_game?: number;
  blocks_per_game?: number;
  threes_per_game?: number;
  turnovers_per_game?: number;
  // Football
  passing_yards_per_game?: number;
  rushing_yards_per_game?: number;
  receiving_yards_per_game?: number;
  receptions_per_game?: number;
  // Baseball
  hits_per_game?: number;
  home_runs_per_game?: number;
  rbis_per_game?: number;
  strikeouts_pitcher_per_game?: number;
  // Hockey
  goals_per_game?: number;
  hockey_assists_per_game?: number;
  shots_per_game?: number;
}

// ============================================================================
// Rate Limiting
// ============================================================================

let lastRequestTime = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise(r => setTimeout(r, RATE_LIMIT_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

async function fetchJSON(url: string): Promise<any> {
  await rateLimit();
  console.log(`[ESPN] Fetching: ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ESPN API error: ${res.status} ${res.statusText} - ${url}`);
  }
  return res.json();
}

// ============================================================================
// ESPN Data Fetchers
// ============================================================================

async function fetchNBASeasonStats(season: string, supabase: SupabaseClient): Promise<number> {
  console.log(`\n🏀 Importing NBA season stats for ${season}...`);
  let imported = 0;
  let skipped = 0;

  // ESPN uses format "2024" for 2024-25 season
  const espnSeason = season.split('-')[0];

  // Get all NBA teams
  const teamsUrl = `${ESPN_BASE_URL}/basketball/nba/teams`;
  const teamsData = await fetchJSON(teamsUrl);

  for (const teamEntry of teamsData.sports[0].leagues[0].teams) {
    const team = teamEntry.team;
    const teamAbbr = team.abbreviation;
    console.log(`  Processing ${team.displayName}...`);

    try {
      // Get roster (gives us player IDs and names)
      const rosterUrl = `${ESPN_BASE_URL}/basketball/nba/teams/${team.id}/roster`;
      const rosterData = await fetchJSON(rosterUrl);

      if (!rosterData.athletes) continue;

      for (const player of rosterData.athletes) {
        try {
          // Use Core API for reliable stats
          // URL: https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/2025/types/2/athletes/{id}/statistics
          const statsUrl = `${ESPN_CORE_URL}/seasons/${espnSeason}/types/2/athletes/${player.id}/statistics?lang=en&region=us`;
          const statsData = await fetchJSON(statsUrl);

          if (!statsData.splits?.categories) {
            skipped++;
            continue;
          }

          // Extract stats from Core API categories structure
          const stats = extractNBAStatsCore(statsData.splits.categories);

          if (stats.gamesPlayed === 0) {
            skipped++;
            continue;
          }

          const playerStats: PlayerSeasonStats = {
            espn_id: player.id.toString(),
            player_name: player.fullName || player.displayName,
            team: teamAbbr,
            sport: 'NBA',
            season,
            games_played: stats.gamesPlayed,
            minutes_per_game: stats.minutes,
            points_per_game: stats.points,
            rebounds_per_game: stats.rebounds,
            assists_per_game: stats.assists,
            steals_per_game: stats.steals,
            blocks_per_game: stats.blocks,
            threes_per_game: stats.threes,
            turnovers_per_game: stats.turnovers,
          };

          await upsertPlayerStats(supabase, playerStats);
          imported++;

          if (imported % 50 === 0) {
            console.log(`    ✅ Imported ${imported} players so far...`);
          }
        } catch (playerErr) {
          // Skip players without stats (rookies, injured, etc.)
          skipped++;
        }
      }
    } catch (teamErr) {
      console.log(`  ⚠️ Error processing ${team.displayName}: ${(teamErr as Error).message}`);
    }
  }

  console.log(`✅ NBA: Imported ${imported} player stat records (skipped ${skipped})`);
  return imported;
}

/**
 * Extract NBA stats from Core API category structure
 */
function extractNBAStatsCore(categories: any[]): Record<string, number> {
  const stats: Record<string, number> = {
    gamesPlayed: 0,
    minutes: 0,
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    threes: 0,
    turnovers: 0,
  };

  for (const cat of categories) {
    if (!cat.stats) continue;

    for (const stat of cat.stats) {
      const value = parseFloat(stat.value) || 0;
      const name = stat.name;

      // General category stats
      if (name === 'gamesPlayed') stats.gamesPlayed = value;
      if (name === 'avgMinutes') stats.minutes = value;
      if (name === 'avgRebounds') stats.rebounds = value;

      // Offensive category stats
      if (name === 'avgPoints') stats.points = value;
      if (name === 'avgAssists') stats.assists = value;
      if (name === 'avgTurnovers') stats.turnovers = value;
      if (name === 'avgThreePointFieldGoalsMade') stats.threes = value;

      // Defensive category stats
      if (name === 'avgSteals') stats.steals = value;
      if (name === 'avgBlocks') stats.blocks = value;
    }
  }

  return stats;
}

async function fetchNFLSeasonStats(season: string, supabase: SupabaseClient): Promise<number> {
  console.log(`\n🏈 Importing NFL season stats for ${season}...`);
  let imported = 0;

  // Get all NFL teams
  const teamsUrl = `${ESPN_BASE_URL}/football/nfl/teams`;
  const teamsData = await fetchJSON(teamsUrl);

  for (const teamEntry of teamsData.sports[0].leagues[0].teams) {
    const team = teamEntry.team;
    const teamAbbr = team.abbreviation;
    console.log(`  Processing ${team.displayName}...`);

    try {
      const rosterUrl = `${ESPN_BASE_URL}/football/nfl/teams/${team.id}/roster`;
      const rosterData = await fetchJSON(rosterUrl);

      if (!rosterData.athletes) continue;

      // NFL roster is grouped by position
      const allAthletes = rosterData.athletes.flatMap((group: any) => group.items || []);

      for (const player of allAthletes) {
        try {
          const statsUrl = `${ESPN_BASE_URL}/football/nfl/athletes/${player.id}/statistics`;
          const statsData = await fetchJSON(statsUrl);

          if (!statsData.statistics?.length) continue;

          const stats = extractNFLStats(statsData.statistics);
          const gamesPlayed = stats.gamesPlayed || 0;

          if (gamesPlayed === 0) continue;

          const playerStats: PlayerSeasonStats = {
            espn_id: player.id.toString(),
            player_name: player.fullName || player.displayName,
            team: teamAbbr,
            sport: 'NFL',
            season,
            games_played: gamesPlayed,
            passing_yards_per_game: stats.passingYards
              ? stats.passingYards / gamesPlayed
              : undefined,
            rushing_yards_per_game: stats.rushingYards
              ? stats.rushingYards / gamesPlayed
              : undefined,
            receiving_yards_per_game: stats.receivingYards
              ? stats.receivingYards / gamesPlayed
              : undefined,
            receptions_per_game: stats.receptions ? stats.receptions / gamesPlayed : undefined,
          };

          await upsertPlayerStats(supabase, playerStats);
          imported++;
        } catch (playerErr) {
          // Skip individual player errors
        }
      }
    } catch (teamErr) {
      console.log(`  ⚠️ Error processing ${team.displayName}: ${(teamErr as Error).message}`);
    }
  }

  console.log(`✅ NFL: Imported ${imported} player stat records`);
  return imported;
}

async function fetchMLBSeasonStats(season: string, supabase: SupabaseClient): Promise<number> {
  console.log(`\n⚾ Importing MLB season stats for ${season}...`);
  let imported = 0;

  const teamsUrl = `${ESPN_BASE_URL}/baseball/mlb/teams`;
  const teamsData = await fetchJSON(teamsUrl);

  for (const teamEntry of teamsData.sports[0].leagues[0].teams) {
    const team = teamEntry.team;
    const teamAbbr = team.abbreviation;
    console.log(`  Processing ${team.displayName}...`);

    try {
      const rosterUrl = `${ESPN_BASE_URL}/baseball/mlb/teams/${team.id}/roster`;
      const rosterData = await fetchJSON(rosterUrl);

      if (!rosterData.athletes) continue;

      const allAthletes = rosterData.athletes.flatMap((group: any) => group.items || []);

      for (const player of allAthletes) {
        try {
          const statsUrl = `${ESPN_BASE_URL}/baseball/mlb/athletes/${player.id}/statistics`;
          const statsData = await fetchJSON(statsUrl);

          if (!statsData.statistics?.length) continue;

          const stats = extractMLBStats(statsData.statistics);
          const gamesPlayed = stats.gamesPlayed || 0;

          if (gamesPlayed === 0) continue;

          const playerStats: PlayerSeasonStats = {
            espn_id: player.id.toString(),
            player_name: player.fullName || player.displayName,
            team: teamAbbr,
            sport: 'MLB',
            season,
            games_played: gamesPlayed,
            hits_per_game: stats.hits ? stats.hits / gamesPlayed : undefined,
            home_runs_per_game: stats.homeRuns ? stats.homeRuns / gamesPlayed : undefined,
            rbis_per_game: stats.rbis ? stats.rbis / gamesPlayed : undefined,
            strikeouts_pitcher_per_game: stats.strikeouts
              ? stats.strikeouts / gamesPlayed
              : undefined,
          };

          await upsertPlayerStats(supabase, playerStats);
          imported++;
        } catch (playerErr) {
          // Skip individual player errors
        }
      }
    } catch (teamErr) {
      console.log(`  ⚠️ Error processing ${team.displayName}: ${(teamErr as Error).message}`);
    }
  }

  console.log(`✅ MLB: Imported ${imported} player stat records`);
  return imported;
}

async function fetchNHLSeasonStats(season: string, supabase: SupabaseClient): Promise<number> {
  console.log(`\n🏒 Importing NHL season stats for ${season}...`);
  let imported = 0;

  const teamsUrl = `${ESPN_BASE_URL}/hockey/nhl/teams`;
  const teamsData = await fetchJSON(teamsUrl);

  for (const teamEntry of teamsData.sports[0].leagues[0].teams) {
    const team = teamEntry.team;
    const teamAbbr = team.abbreviation;
    console.log(`  Processing ${team.displayName}...`);

    try {
      const rosterUrl = `${ESPN_BASE_URL}/hockey/nhl/teams/${team.id}/roster`;
      const rosterData = await fetchJSON(rosterUrl);

      if (!rosterData.athletes) continue;

      const allAthletes = rosterData.athletes.flatMap((group: any) => group.items || []);

      for (const player of allAthletes) {
        try {
          const statsUrl = `${ESPN_BASE_URL}/hockey/nhl/athletes/${player.id}/statistics`;
          const statsData = await fetchJSON(statsUrl);

          if (!statsData.statistics?.length) continue;

          const stats = extractNHLStats(statsData.statistics);
          const gamesPlayed = stats.gamesPlayed || 0;

          if (gamesPlayed === 0) continue;

          const playerStats: PlayerSeasonStats = {
            espn_id: player.id.toString(),
            player_name: player.fullName || player.displayName,
            team: teamAbbr,
            sport: 'NHL',
            season,
            games_played: gamesPlayed,
            goals_per_game: stats.goals ? stats.goals / gamesPlayed : undefined,
            hockey_assists_per_game: stats.assists ? stats.assists / gamesPlayed : undefined,
            shots_per_game: stats.shots ? stats.shots / gamesPlayed : undefined,
          };

          await upsertPlayerStats(supabase, playerStats);
          imported++;
        } catch (playerErr) {
          // Skip individual player errors
        }
      }
    } catch (teamErr) {
      console.log(`  ⚠️ Error processing ${team.displayName}: ${(teamErr as Error).message}`);
    }
  }

  console.log(`✅ NHL: Imported ${imported} player stat records`);
  return imported;
}

// ============================================================================
// v3 API Stat Extraction Helpers
// ============================================================================

interface StatNameMap {
  general: Map<string, number>;
  offensive: Map<string, number>;
  defensive: Map<string, number>;
}

/**
 * Build a mapping of stat names to indices from top-level categories
 */
function buildStatNameMap(categories: any[]): StatNameMap {
  const map: StatNameMap = {
    general: new Map(),
    offensive: new Map(),
    defensive: new Map(),
  };

  if (!categories) return map;

  for (const cat of categories) {
    const categoryMap = map[cat.name as keyof StatNameMap];
    if (!categoryMap || !cat.names) continue;

    for (let i = 0; i < cat.names.length; i++) {
      categoryMap.set(cat.names[i], i);
    }
  }

  return map;
}

/**
 * Extract NBA stats from v3 API response
 */
function extractNBAStatsV3(
  athleteCategories: any[],
  statNameMap: StatNameMap
): Record<string, number> {
  const stats: Record<string, number> = {
    gamesPlayed: 0,
    minutes: 0,
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    threes: 0,
    turnovers: 0,
  };

  for (const cat of athleteCategories) {
    const categoryMap = statNameMap[cat.name as keyof StatNameMap];
    if (!categoryMap || !cat.values) continue;

    const values = cat.values;

    // Map based on category type
    if (cat.name === 'general') {
      const gpIdx = categoryMap.get('gamesPlayed');
      const minIdx = categoryMap.get('avgMinutes');
      const rebIdx = categoryMap.get('avgRebounds');

      if (gpIdx !== undefined) stats.gamesPlayed = parseFloat(values[gpIdx]) || 0;
      if (minIdx !== undefined) stats.minutes = parseFloat(values[minIdx]) || 0;
      if (rebIdx !== undefined) stats.rebounds = parseFloat(values[rebIdx]) || 0;
    }

    if (cat.name === 'offensive') {
      const ptsIdx = categoryMap.get('avgPoints');
      const astIdx = categoryMap.get('avgAssists');
      const toIdx = categoryMap.get('avgTurnovers');
      const threesIdx = categoryMap.get('avgThreePointFieldGoalsMade');

      if (ptsIdx !== undefined) stats.points = parseFloat(values[ptsIdx]) || 0;
      if (astIdx !== undefined) stats.assists = parseFloat(values[astIdx]) || 0;
      if (toIdx !== undefined) stats.turnovers = parseFloat(values[toIdx]) || 0;
      if (threesIdx !== undefined) stats.threes = parseFloat(values[threesIdx]) || 0;
    }

    if (cat.name === 'defensive') {
      const stlIdx = categoryMap.get('avgSteals');
      const blkIdx = categoryMap.get('avgBlocks');

      if (stlIdx !== undefined) stats.steals = parseFloat(values[stlIdx]) || 0;
      if (blkIdx !== undefined) stats.blocks = parseFloat(values[blkIdx]) || 0;
    }
  }

  return stats;
}

// ============================================================================
// Legacy Stat Extraction Helpers (for v2 API)
// ============================================================================

function extractNBAStats(categories: any[]): Record<string, number> {
  const stats: Record<string, number> = {};

  for (const cat of categories) {
    if (!cat.stats) continue;
    for (const stat of cat.stats) {
      const value = parseFloat(stat.value) || 0;
      switch (stat.name) {
        case 'avgMinutes':
          stats.minutes = value;
          break;
        case 'avgPoints':
          stats.points = value;
          break;
        case 'avgRebounds':
          stats.rebounds = value;
          break;
        case 'avgAssists':
          stats.assists = value;
          break;
        case 'avgSteals':
          stats.steals = value;
          break;
        case 'avgBlocks':
          stats.blocks = value;
          break;
        case 'avgThreePointersMade':
          stats.threes = value;
          break;
        case 'avgTurnovers':
          stats.turnovers = value;
          break;
      }
    }
  }

  return stats;
}

function extractNFLStats(statistics: any[]): Record<string, number> {
  const stats: Record<string, number> = { gamesPlayed: 0 };

  for (const statGroup of statistics) {
    const splits = statGroup.splits;
    if (!splits?.categories) continue;

    for (const cat of splits.categories) {
      if (!cat.stats) continue;
      for (const stat of cat.stats) {
        const value = parseFloat(stat.value) || 0;
        switch (stat.name) {
          case 'gamesPlayed':
            stats.gamesPlayed = value;
            break;
          case 'passingYards':
            stats.passingYards = value;
            break;
          case 'rushingYards':
            stats.rushingYards = value;
            break;
          case 'receivingYards':
            stats.receivingYards = value;
            break;
          case 'receptions':
            stats.receptions = value;
            break;
        }
      }
    }
  }

  return stats;
}

function extractMLBStats(statistics: any[]): Record<string, number> {
  const stats: Record<string, number> = { gamesPlayed: 0 };

  for (const statGroup of statistics) {
    const splits = statGroup.splits;
    if (!splits?.categories) continue;

    for (const cat of splits.categories) {
      if (!cat.stats) continue;
      for (const stat of cat.stats) {
        const value = parseFloat(stat.value) || 0;
        switch (stat.name) {
          case 'gamesPlayed':
            stats.gamesPlayed = value;
            break;
          case 'hits':
            stats.hits = value;
            break;
          case 'homeRuns':
            stats.homeRuns = value;
            break;
          case 'RBIs':
            stats.rbis = value;
            break;
          case 'strikeouts':
            stats.strikeouts = value;
            break;
        }
      }
    }
  }

  return stats;
}

function extractNHLStats(statistics: any[]): Record<string, number> {
  const stats: Record<string, number> = { gamesPlayed: 0 };

  for (const statGroup of statistics) {
    const splits = statGroup.splits;
    if (!splits?.categories) continue;

    for (const cat of splits.categories) {
      if (!cat.stats) continue;
      for (const stat of cat.stats) {
        const value = parseFloat(stat.value) || 0;
        switch (stat.name) {
          case 'gamesPlayed':
            stats.gamesPlayed = value;
            break;
          case 'goals':
            stats.goals = value;
            break;
          case 'assists':
            stats.assists = value;
            break;
          case 'shots':
            stats.shots = value;
            break;
        }
      }
    }
  }

  return stats;
}

// ============================================================================
// Database Operations
// ============================================================================

async function upsertPlayerStats(
  supabase: SupabaseClient,
  stats: PlayerSeasonStats
): Promise<void> {
  // Note: player_id is UUID type in DB but we don't have UUIDs from ESPN
  // The unique constraint is on (player_name, sport, season, team) so we skip player_id
  const { error } = await supabase.from('player_season_stats').upsert(
    {
      player_name: stats.player_name,
      team: stats.team,
      sport: stats.sport,
      season: stats.season,
      games_played: stats.games_played,
      minutes_per_game: stats.minutes_per_game,
      points_per_game: stats.points_per_game,
      rebounds_per_game: stats.rebounds_per_game,
      assists_per_game: stats.assists_per_game,
      steals_per_game: stats.steals_per_game,
      blocks_per_game: stats.blocks_per_game,
      threes_per_game: stats.threes_per_game,
      turnovers_per_game: stats.turnovers_per_game,
      passing_yards_per_game: stats.passing_yards_per_game,
      rushing_yards_per_game: stats.rushing_yards_per_game,
      receiving_yards_per_game: stats.receiving_yards_per_game,
      receptions_per_game: stats.receptions_per_game,
      hits_per_game: stats.hits_per_game,
      home_runs_per_game: stats.home_runs_per_game,
      rbis_per_game: stats.rbis_per_game,
      strikeouts_pitcher_per_game: stats.strikeouts_pitcher_per_game,
      goals_per_game: stats.goals_per_game,
      hockey_assists_per_game: stats.hockey_assists_per_game,
      shots_per_game: stats.shots_per_game,
      last_updated: new Date().toISOString(),
      source: 'espn',
    },
    {
      onConflict: 'player_name,sport,season,team',
    }
  );

  if (error && error.code !== '23505') {
    console.error(`  ❌ Failed to upsert ${stats.player_name}: ${error.message}`);
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const sportArg = args.find(a => a.startsWith('--sport='))?.split('=')[1] || 'all';
  const seasonArg = args.find(a => a.startsWith('--season='))?.split('=')[1] || '2025-26';

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║        BASELINE-DATA-001: Season Stats Import                  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`\nSport: ${sportArg.toUpperCase()}`);
  console.log(`Season: ${seasonArg}`);

  // Initialize Supabase
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Verify connection
  const { error: connError } = await supabase.from('player_season_stats').select('id').limit(1);
  if (connError) {
    console.error(`❌ Database connection failed: ${connError.message}`);
    process.exit(1);
  }
  console.log('✅ Database connection verified\n');

  let totalImported = 0;

  try {
    const sports =
      sportArg.toLowerCase() === 'all' ? ['NBA', 'NFL', 'MLB', 'NHL'] : [sportArg.toUpperCase()];

    for (const sport of sports) {
      switch (sport) {
        case 'NBA':
          totalImported += await fetchNBASeasonStats(seasonArg, supabase);
          break;
        case 'NFL':
          totalImported += await fetchNFLSeasonStats(seasonArg, supabase);
          break;
        case 'MLB':
          totalImported += await fetchMLBSeasonStats(seasonArg, supabase);
          break;
        case 'NHL':
          totalImported += await fetchNHLSeasonStats(seasonArg, supabase);
          break;
        default:
          console.log(`⚠️ Unknown sport: ${sport}`);
      }
    }

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log(`║  ✅ COMPLETE: Imported ${totalImported} player stat records           ║`);
    console.log('╚════════════════════════════════════════════════════════════════╝');
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
