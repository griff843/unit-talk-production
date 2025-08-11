/**
 * MLB StatsAPI Adapter - Primary data source for MLB settlement
 * 
 * Fetches game data and player statistics from MLB's official StatsAPI
 * Handles game resolution, player stat lookup, and market computation
 */

import axios from 'axios';
import { logger } from '../../../../utils/logger';

const MLB_STATSAPI_BASE = process.env.MLB_STATSAPI_BASE || 'https://statsapi.mlb.com';
const HTTP_TIMEOUT = parseInt(process.env.MLB_HTTP_TIMEOUT_MS || '8000');
const HTTP_RETRIES = parseInt(process.env.MLB_HTTP_RETRIES || '3');

export interface MLBGameData {
  gamePk: number;
  status: string;
  statusCode: string;
  teams: {
    home: {
      team: { name: string; abbreviation: string };
      players: Record<string, MLBPlayerData>;
    };
    away: {
      team: { name: string; abbreviation: string };
      players: Record<string, MLBPlayerData>;
    };
  };
  liveData: {
    boxscore: {
      teams: {
        home: { players: Record<string, any> };
        away: { players: Record<string, any> };
      };
    };
  };
}

export interface MLBPlayerData {
  person: {
    id: number;
    fullName: string;
  };
  position?: {
    code: string;
    name: string;
  };
  stats?: {
    batting?: {
      hits: number;
      homeRuns: number;
      rbi: number;
      runs: number;
      doubles: number;
      triples: number;
      atBats: number;
    };
    pitching?: {
      strikeOuts: number;
      inningsPitched: string;
      walks: number;
      hits: number;
      earnedRuns: number;
      wins: number;
      losses: number;
    };
  };
}

export interface GameResolutionResult {
  found: boolean;
  gamePk?: number;
  status?: string;
  isComplete?: boolean;
  homeTeam?: string;
  awayTeam?: string;
  startTime?: string;
}

export interface StatLookupResult {
  found: boolean;
  playerName?: string;
  playerId?: number;
  actualValue?: number;
  teamSide?: 'home' | 'away';
  rawStats?: any;
  error?: string;
}

/**
 * HTTP client with retry logic and timeouts
 */
const createClient = () => {
  return axios.create({
    baseURL: MLB_STATSAPI_BASE,
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
        logger.error(`${operation} failed after ${maxRetries} attempts`, {
          error: lastError.message,
          attempt
        });
        throw lastError;
      }

      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      logger.warn(`${operation} failed, retrying in ${delay}ms`, {
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
 * Resolve MLB gamePk from game context
 * First try external_game_id if it's a gamePk, otherwise search by team + date
 */
export async function resolveGamePk(gameContext: {
  external_game_id?: string;
  home_team?: string;
  away_team?: string;
  game_start_time?: string;
}): Promise<GameResolutionResult> {
  try {
    // Try to use external_game_id as gamePk if it's numeric
    if (gameContext.external_game_id && /^\d+$/.test(gameContext.external_game_id)) {
      const gamePk = parseInt(gameContext.external_game_id);
      const gameData = await fetchGameData(gamePk);
      
      if (gameData.found) {
        return {
          found: true,
          gamePk,
          status: gameData.status,
          isComplete: gameData.isComplete,
          homeTeam: gameData.homeTeam,
          awayTeam: gameData.awayTeam
        };
      }
    }

    // Fallback: search by team names and date
    if (gameContext.home_team && gameContext.away_team && gameContext.game_start_time) {
      return await findGameByTeamsAndDate(
        gameContext.home_team,
        gameContext.away_team,
        gameContext.game_start_time
      );
    }

    return { found: false };

  } catch (error) {
    logger.error('Error resolving game PK', {
      error: error instanceof Error ? error.message : String(error),
      gameContext
    });
    return { found: false };
  }
}

/**
 * Find game by team names and approximate date
 */
async function findGameByTeamsAndDate(
  homeTeam: string,
  awayTeam: string,
  gameStartTime: string
): Promise<GameResolutionResult> {
  const gameDate = new Date(gameStartTime);
  const dateStr = gameDate.toISOString().split('T')[0]; // YYYY-MM-DD

  const client = createClient();

  return await withRetry(async () => {
    const response = await client.get('/api/v1/schedule', {
      params: {
        sportId: 1, // MLB
        date: dateStr,
        hydrate: 'team'
      }
    });

    const games = response.data.dates?.[0]?.games || [];

    for (const game of games) {
      const home = game.teams?.home?.team?.name || '';
      const away = game.teams?.away?.team?.name || '';

      // Fuzzy team name matching
      if (isTeamMatch(homeTeam, home) && isTeamMatch(awayTeam, away)) {
        return {
          found: true,
          gamePk: game.gamePk,
          status: game.status?.detailedState,
          isComplete: game.status?.codedGameState === 'F',
          homeTeam: home,
          awayTeam: away,
          startTime: game.gameDate
        };
      }
    }

    return { found: false };
  }, 'findGameByTeamsAndDate');
}

/**
 * Fuzzy team name matching
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

/**
 * Fetch complete game data including box score
 */
async function fetchGameData(gamePk: number): Promise<{
  found: boolean;
  status?: string;
  isComplete?: boolean;
  homeTeam?: string;
  awayTeam?: string;
  gameData?: MLBGameData;
}> {
  const client = createClient();

  try {
    const response = await withRetry(async () => {
      return await client.get(`/api/v1.1/game/${gamePk}/feed/live`);
    }, `fetchGameData-${gamePk}`);

    const data = response.data;
    
    if (!data.gameData || !data.liveData) {
      return { found: false };
    }

    const status = data.gameData.status?.detailedState || '';
    const isComplete = data.gameData.status?.codedGameState === 'F';

    return {
      found: true,
      status,
      isComplete,
      homeTeam: data.gameData.teams?.home?.name,
      awayTeam: data.gameData.teams?.away?.name,
      gameData: data as MLBGameData
    };

  } catch (error) {
    logger.error('Error fetching game data', {
      gamePk,
      error: error instanceof Error ? error.message : String(error)
    });
    return { found: false };
  }
}

/**
 * Look up player statistics for a specific market
 */
export async function lookupPlayerStat(
  gamePk: number,
  playerName: string,
  market: string,
  teamHint?: string
): Promise<StatLookupResult> {
  try {
    const gameResult = await fetchGameData(gamePk);
    
    if (!gameResult.found || !gameResult.gameData) {
      return { 
        found: false, 
        error: 'Game data not available' 
      };
    }

    const gameData = gameResult.gameData;
    const boxscore = gameData.liveData?.boxscore;

    if (!boxscore) {
      return { 
        found: false, 
        error: 'Box score not available' 
      };
    }

    // Search for player in both teams
    const playerResult = findPlayerInBoxscore(boxscore, playerName, teamHint);
    
    if (!playerResult.found) {
      return { 
        found: false, 
        error: `Player ${playerName} not found in box score` 
      };
    }

    // Compute actual value for the market
    const actualValue = computeMarketValue(
      playerResult.stats,
      market,
      playerResult.position
    );

    if (actualValue === null) {
      return { 
        found: false, 
        error: `Unable to compute ${market} for ${playerName}` 
      };
    }

    return {
      found: true,
      playerName: playerResult.playerName,
      playerId: playerResult.playerId,
      actualValue,
      teamSide: playerResult.teamSide,
      rawStats: playerResult.stats
    };

  } catch (error) {
    logger.error('Error looking up player stat', {
      gamePk,
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
 * Find player in box score data
 */
function findPlayerInBoxscore(
  boxscore: any,
  playerName: string,
  teamHint?: string
): {
  found: boolean;
  playerName?: string;
  playerId?: number;
  teamSide?: 'home' | 'away';
  position?: string;
  stats?: any;
} {
  const normalizePlayerName = (name: string) => 
    name.toLowerCase()
        .replace(/[^a-z\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

  const targetName = normalizePlayerName(playerName);

  // Search both teams
  for (const teamSide of ['home', 'away'] as const) {
    const teamPlayers = boxscore.teams?.[teamSide]?.players || {};
    
    for (const [playerId, playerData] of Object.entries(teamPlayers)) {
      const player = playerData as any;
      const fullName = normalizePlayerName(player.person?.fullName || '');
      
      // Name matching with various formats
      if (
        fullName.includes(targetName) ||
        targetName.includes(fullName) ||
        fullName === targetName
      ) {
        // If team hint provided, verify team side matches
        if (teamHint) {
          const teamName = boxscore.teams[teamSide].team?.name || '';
          if (!isTeamMatch(teamHint, teamName)) {
            continue;
          }
        }

        return {
          found: true,
          playerName: player.person?.fullName,
          playerId: parseInt(playerId.replace('ID', '')),
          teamSide,
          position: player.position?.code,
          stats: player.stats
        };
      }
    }
  }

  return { found: false };
}

/**
 * Compute actual market value from player stats
 */
function computeMarketValue(
  stats: any,
  market: string,
  position?: string
): number | null {
  if (!stats) {
    return null;
  }

  const marketUpper = market.toUpperCase();
  const batting = stats.batting;
  const pitching = stats.pitching;

  // Batting markets
  if (batting) {
    switch (marketUpper) {
      case 'HITS':
      case 'HIT':
        return batting.hits || 0;
      
      case 'HOME_RUNS':
      case 'HR':
      case 'HOMERUNS':
        return batting.homeRuns || 0;
      
      case 'RBI':
      case 'RUNS_BATTED_IN':
        return batting.rbi || 0;
      
      case 'RUNS':
      case 'RUNS_SCORED':
        return batting.runs || 0;
      
      case 'TOTAL_BASES':
      case 'TB':
        const singles = (batting.hits || 0) - (batting.doubles || 0) - (batting.triples || 0) - (batting.homeRuns || 0);
        return singles + (batting.doubles || 0) * 2 + (batting.triples || 0) * 3 + (batting.homeRuns || 0) * 4;
      
      case 'DOUBLES':
      case '2B':
        return batting.doubles || 0;
      
      case 'TRIPLES':  
      case '3B':
        return batting.triples || 0;
    }
  }

  // Pitching markets
  if (pitching) {
    switch (marketUpper) {
      case 'STRIKEOUTS':
      case 'K':
      case 'SO':
        return pitching.strikeOuts || 0;
      
      case 'WALKS':
      case 'BB':
        return pitching.walks || 0;
      
      case 'HITS_ALLOWED':
        return pitching.hits || 0;
      
      case 'EARNED_RUNS':
      case 'ER':
        return pitching.earnedRuns || 0;
      
      case 'OUTS':
      case 'INNINGS_PITCHED':
        // Convert innings pitched to outs (e.g., "6.1" = 19 outs)
        const ip = pitching.inningsPitched || '0';
        const [innings, partialInnings] = ip.split('.');
        return parseInt(innings) * 3 + (parseInt(partialInnings || '0') || 0);
      
      case 'WINS':
        return pitching.wins || 0;
      
      case 'LOSSES':
        return pitching.losses || 0;
    }
  }

  // Market not recognized
  logger.warn('Unrecognized market for MLB stats', { 
    market, 
    position,
    availableStats: Object.keys(stats) 
  });
  
  return null;
}