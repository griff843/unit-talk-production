import { BaseAdapter, PlayerStatMap } from './types';
import axios from 'axios';
import { createLogger, Logger } from '../../../utils/logger';

interface MLBBoxScore {
  teams: {
    away: MLBTeamStats;
    home: MLBTeamStats;
  };
}

interface MLBTeamStats {
  players: {
    [playerId: string]: MLBPlayerStats;
  };
  team: string;
}

interface MLBPlayerStats {
  person: {
    id: number;
    fullName: string;
  };
  stats: {
    batting?: {
      hits: number;
      runs: number;
      homeRuns: number;
      rbi: number;
      baseOnBalls: number;
      strikeOuts: number;
      doubles: number;
      triples: number;
      stolenBases: number;
      atBats: number;
    };
    pitching?: {
      inningsPitched: string;
      hits: number;
      runs: number;
      earnedRuns: number;
      baseOnBalls: number;
      strikeOuts: number;
      homeRuns: number;
      pitchesThrown: number;
    };
  };
}

export class MLBAdapter extends BaseAdapter {
  private logger: Logger;
  private baseUrl = 'https://statsapi.mlb.com/api/v1.1';

  constructor() {
    super();
    this.logger = createLogger('MLBAdapter');
    this.rateLimit = 10; // MLB API allows higher rate
  }

  getName(): string {
    return 'MLB StatsAPI';
  }

  async fetchGameStats(gameId: string): Promise<PlayerStatMap> {
    return this.retryWithBackoff(async () => {
      try {
        // MLB game IDs are typically in format: 2024_09_15_bosmlb_nyamlb_1
        // We need to convert to MLB's game_pk format
        const gamePk = await this.getGamePk(gameId);
        
        const response = await axios.get(
          `${this.baseUrl}/game/${gamePk}/boxscore`,
          {
            timeout: 10000,
            headers: {
              'User-Agent': 'UnitTalk/1.0 Settlement System'
            }
          }
        );

        return this.parseBoxScore(response.data);
      } catch (error) {
        this.logger.warn('MLB API unavailable for game, returning empty stats', { gameId, error: error instanceof Error ? error.message : 'Unknown error' });
        // Return empty stats instead of throwing - allows settlement to continue
        return {};
      }
    });
  }

  private async getGamePk(gameId: string): Promise<string> {
    // If already in game_pk format (numeric), return as is
    if (/^\d+$/.test(gameId)) {
      return gameId;
    }

    // Parse date from game ID format: 2024_09_15_bosmlb_nyamlb_1
    const parts = gameId.split('_');
    if (parts.length >= 5) {
      const [year, month, day] = parts.slice(0, 3);
      const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      
      // Query schedule for that date to find game_pk
      const response = await axios.get(
        `${this.baseUrl}/schedule`,
        {
          params: {
            sportId: 1, // MLB
            date: date
          }
        }
      );

      // Find matching game
      for (const dateData of response.data.dates || []) {
        for (const game of dateData.games || []) {
          // Match by team codes
          if (this.matchesGame(game, gameId)) {
            return String(game.gamePk);
          }
        }
      }
    }

    throw new Error(`Could not resolve game_pk for gameId: ${gameId}`);
  }

  private matchesGame(game: any, gameId: string): boolean {
    const idLower = gameId.toLowerCase();
    const awayCode = game.teams?.away?.team?.abbreviation?.toLowerCase();
    const homeCode = game.teams?.home?.team?.abbreviation?.toLowerCase();
    
    return idLower.includes(awayCode) && idLower.includes(homeCode);
  }

  private parseBoxScore(boxScore: MLBBoxScore): PlayerStatMap {
    const stats: PlayerStatMap = {};

    // Process both teams
    for (const side of ['away', 'home'] as const) {
      const teamData = boxScore.teams[side];
      if (!teamData?.players) continue;

      for (const playerId in teamData.players) {
        const player = teamData.players[playerId];
        const playerName = player.person.fullName;
        const normalizedName = this.normalizePlayerName(playerName);

        // Initialize player stats
        stats[playerId] = {};
        stats[playerName] = {};
        stats[normalizedName] = {};

        // Batting stats
        if (player.stats?.batting) {
          const batting = player.stats.batting;
          
          // Calculate total bases: singles + 2*doubles + 3*triples + 4*HR
          const singles = batting.hits - batting.doubles - batting.triples - batting.homeRuns;
          const totalBases = singles + (2 * batting.doubles) + (3 * batting.triples) + (4 * batting.homeRuns);

          const battingStats = {
            H: batting.hits,
            HR: batting.homeRuns,
            R: batting.runs,
            RBI: batting.rbi,
            BB: batting.baseOnBalls,
            SO: batting.strikeOuts,
            TB: totalBases,
            SB: batting.stolenBases,
            AB: batting.atBats,
            '2B': batting.doubles,
            '3B': batting.triples
          };

          // Store under all name variations for flexibility
          Object.assign(stats[playerId], battingStats);
          Object.assign(stats[playerName], battingStats);
          Object.assign(stats[normalizedName], battingStats);
        }

        // Pitching stats
        if (player.stats?.pitching) {
          const pitching = player.stats.pitching;
          
          // Convert innings pitched from "6.2" format to outs
          const ipParts = pitching.inningsPitched.split('.');
          const innings = parseInt(ipParts[0]) || 0;
          const outs = parseInt(ipParts[1]) || 0;
          const totalOuts = (innings * 3) + outs;

          const pitchingStats = {
            IP: pitching.inningsPitched,
            OUTS: totalOuts,
            K: pitching.strikeOuts,
            BB_ALLOWED: pitching.baseOnBalls,
            H_ALLOWED: pitching.hits,
            ER: pitching.earnedRuns,
            R_ALLOWED: pitching.runs,
            HR_ALLOWED: pitching.homeRuns,
            PITCHES: pitching.pitchesThrown
          };

          Object.assign(stats[playerId], pitchingStats);
          Object.assign(stats[playerName], pitchingStats);
          Object.assign(stats[normalizedName], pitchingStats);
        }
      }
    }

    return stats;
  }
}