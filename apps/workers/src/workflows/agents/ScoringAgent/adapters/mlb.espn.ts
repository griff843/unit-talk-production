/**
 * MLB ESPN Adapter - Fallback data source for MLB settlement
 * 
 * Used when MLB StatsAPI is unavailable or doesn't have the data we need.
 * Provides basic game and player stat lookup via ESPN's public API.
 */

import axios from 'axios';
import { logger } from '../../../../utils/logger';

const ESPN_BASE = process.env.ESPN_BASE || 'https://site.api.espn.com';
const HTTP_TIMEOUT = parseInt(process.env.MLB_HTTP_TIMEOUT_MS || '8000');
const HTTP_RETRIES = parseInt(process.env.MLB_HTTP_RETRIES || '3');

export interface ESPNGameData {
  id: string;
  status: {
    type: {
      name: string;
      state: string;
      completed: boolean;
    };
  };
  competitions: Array<{
    competitors: Array<{
      team: {
        name: string;
        abbreviation: string;
      };
      homeAway: string;
      statistics?: Array<{
        name: string;
        displayValue: string;
        athletes?: Array<{
          athlete: {
            displayName: string;
          };
          stats: string[];
        }>;
      }>;
    }>;
  }>;
}

export interface ESPNStatLookupResult {
  found: boolean;
  playerName?: string;
  actualValue?: number;
  teamSide?: 'home' | 'away';
  error?: string;
}

/**
 * HTTP client with retry logic
 */
const createClient = () => {
  return axios.create({
    baseURL: ESPN_BASE,
    timeout: HTTP_TIMEOUT,
    headers: {
      'User-Agent': 'Unit-Talk-Settlement/1.0',
    },
  });
};

/**
 * Retry wrapper for HTTP calls
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  operation: string,
  maxRetries: number = HTTP_RETRIES
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        logger.error(`ESPN ${operation} failed after ${maxRetries} attempts`, {
          error: lastError.message,
          attempt
        });
        throw lastError;
      }

      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      logger.warn(`ESPN ${operation} failed, retrying in ${delay}ms`, {
        error: lastError.message,
        attempt,
        maxRetries
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Find ESPN game ID by team names and date
 */
export async function findESPNGameId(
  homeTeam: string,
  awayTeam: string,
  gameDate: string
): Promise<{ found: boolean; gameId?: string; error?: string }> {
  try {
    const client = createClient();
    const date = new Date(gameDate);
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');

    const response = await withRetry(async () => {
      return await client.get('/apis/site/v2/sports/baseball/mlb/scoreboard', {
        params: {
          dates: dateStr
        }
      });
    }, 'findESPNGameId');

    const events = response.data.events || [];

    for (const event of events) {
      if (!event.competitions || event.competitions.length === 0) {
        continue;
      }

      const competition = event.competitions[0];
      const competitors = competition.competitors || [];

      let homeMatch = false;
      let awayMatch = false;

      for (const competitor of competitors) {
        const teamName = competitor.team?.name || '';
        const isHome = competitor.homeAway === 'home';

        if (isHome && isTeamMatch(homeTeam, teamName)) {
          homeMatch = true;
        } else if (!isHome && isTeamMatch(awayTeam, teamName)) {
          awayMatch = true;
        }
      }

      if (homeMatch && awayMatch) {
        return {
          found: true,
          gameId: event.id
        };
      }
    }

    return { 
      found: false, 
      error: `No ESPN game found for ${homeTeam} vs ${awayTeam} on ${dateStr}` 
    };

  } catch (error) {
    logger.error('Error finding ESPN game ID', {
      homeTeam,
      awayTeam,
      gameDate,
      error: error instanceof Error ? error.message : String(error)
    });

    return { 
      found: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

/**
 * Look up player stat from ESPN game data
 */
export async function lookupPlayerStatESPN(
  gameId: string,
  playerName: string,
  market: string,
  teamHint?: string
): Promise<ESPNStatLookupResult> {
  try {
    const client = createClient();

    const response = await withRetry(async () => {
      return await client.get(`/apis/site/v2/sports/baseball/mlb/summary?event=${gameId}`);
    }, `lookupPlayerStatESPN-${gameId}`);

    const gameData: ESPNGameData = response.data;

    if (!gameData.competitions || gameData.competitions.length === 0) {
      return {
        found: false,
        error: 'No competition data found'
      };
    }

    // Check if game is complete
    const isComplete = gameData.status?.type?.completed || 
                      gameData.status?.type?.state === 'post';

    if (!isComplete) {
      return {
        found: false,
        error: 'Game not yet complete'
      };
    }

    // Search for player stats in team statistics
    const competition = gameData.competitions[0];
    
    for (const competitor of competition.competitors) {
      const teamName = competitor.team?.name || '';
      const teamSide = competitor.homeAway as 'home' | 'away';

      // If team hint provided, check if this is the right team
      if (teamHint && !isTeamMatch(teamHint, teamName)) {
        continue;
      }

      const playerStat = findPlayerInESPNStats(
        competitor.statistics || [],
        playerName,
        market
      );

      if (playerStat.found) {
        return {
          ...playerStat,
          teamSide
        };
      }
    }

    return {
      found: false,
      error: `Player ${playerName} not found in ESPN box score`
    };

  } catch (error) {
    logger.error('Error looking up ESPN player stat', {
      gameId,
      playerName,
      market,
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      found: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Find player in ESPN statistics data
 */
function findPlayerInESPNStats(
  statistics: any[],
  playerName: string,
  market: string
): { found: boolean; playerName?: string; actualValue?: number; error?: string } {
  const normalizePlayerName = (name: string) => 
    name.toLowerCase()
        .replace(/[^a-z\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

  const targetName = normalizePlayerName(playerName);

  // ESPN organizes stats by category (batting, pitching, etc.)
  for (const statCategory of statistics) {
    if (!statCategory.athletes || !Array.isArray(statCategory.athletes)) {
      continue;
    }

    for (const athleteData of statCategory.athletes) {
      const fullName = normalizePlayerName(athleteData.athlete?.displayName || '');
      
      if (fullName.includes(targetName) || targetName.includes(fullName)) {
        const actualValue = parseESPNStat(athleteData.stats, market, statCategory.name);
        
        if (actualValue !== null) {
          return {
            found: true,
            playerName: athleteData.athlete?.displayName,
            actualValue
          };
        }
      }
    }
  }

  return { found: false, error: 'Player not found in statistics' };
}

/**
 * Parse ESPN stat value for a given market
 * ESPN stats are typically in string array format
 */
function parseESPNStat(
  stats: string[],
  market: string,
  categoryName: string
): number | null {
  if (!stats || !Array.isArray(stats)) {
    return null;
  }

  const marketUpper = market.toUpperCase();
  const categoryUpper = categoryName.toUpperCase();

  // ESPN stat order varies, but common patterns:
  // Batting: [AB, R, H, RBI, BB, SO, HR, AVG, ...]
  // Pitching: [IP, H, R, ER, BB, SO, HR, W, L, ...]

  if (categoryUpper.includes('BATTING') || categoryUpper.includes('HITTING')) {
    // Common batting stat positions (may vary)
    const statMap: Record<string, number> = {
      'HITS': 2,
      'HIT': 2,
      'RUNS': 1, 
      'RBI': 3,
      'HOME_RUNS': 6,
      'HR': 6,
      'HOMERUNS': 6
    };

    const position = statMap[marketUpper];
    if (position !== undefined && stats[position]) {
      const value = parseInt(stats[position]) || 0;
      return value;
    }
  }

  if (categoryUpper.includes('PITCHING')) {
    // Common pitching stat positions (may vary)
    const statMap: Record<string, number> = {
      'STRIKEOUTS': 5,
      'K': 5,
      'SO': 5,
      'WALKS': 4,
      'BB': 4,
      'HITS_ALLOWED': 1,
      'EARNED_RUNS': 3,
      'ER': 3,
      'WINS': 7,
      'LOSSES': 8
    };

    const position = statMap[marketUpper];
    if (position !== undefined && stats[position]) {
      const value = parseInt(stats[position]) || 0;
      return value;
    }

    // Special handling for innings pitched -> outs
    if (marketUpper === 'OUTS' || marketUpper === 'INNINGS_PITCHED') {
      const ip = stats[0]; // First position is usually innings pitched
      if (ip) {
        const [innings, partialInnings] = ip.split('.');
        return parseInt(innings) * 3 + (parseInt(partialInnings || '0') || 0);
      }
    }
  }

  // Try to find the stat by looking for numeric values that might match common markets
  if (marketUpper === 'TOTAL_BASES' || marketUpper === 'TB') {
    // Calculate from basic batting stats if available
    // This is a rough approximation since ESPN doesn't always provide all needed stats
    const hits = parseInt(stats[2] || '0') || 0;
    const hrs = parseInt(stats[6] || '0') || 0;
    
    // Simplified TB calculation assuming all non-HR hits are singles
    // Not perfectly accurate but better than nothing
    return hits + (hrs * 3); // Each HR counts as 4 total bases, already counted 1 in hits
  }

  logger.warn('Unable to parse ESPN stat', {
    market: marketUpper,
    category: categoryUpper,
    availableStats: stats
  });

  return null;
}

/**
 * Team name matching helper
 */
function isTeamMatch(name1: string, name2: string): boolean {
  const normalize = (name: string) => 
    name.toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z]/g, '');

  const n1 = normalize(name1);
  const n2 = normalize(name2);

  return n1.includes(n2) || n2.includes(n1) || n1 === n2;
}