/**
 * SGO Provider Adapter - TIER 1 HISTORICAL DATA
 *
 * Integrates SportsbookAPI (SGO) for historical data collection
 * Target: 75,000+ settled outcomes for Tier 1 validation
 *
 * CRITICAL: Player props are embedded within events.odds object
 * Parse structure: events[].odds[oddID] where oddID contains player prop data
 */

import axios, { AxiosInstance } from 'axios';

export interface SGOConfig {
  apiKey: string;
  baseURL?: string;
  timeout?: number;
}

export interface UnifiedProp {
  id: string;
  sport: string;
  league: string;
  playerName: string;
  marketType: string;
  line: number;
  odds: number;
  bookmaker: string;
  gameDate: Date;
  metadata: Record<string, any>;
}

export interface UnifiedOutcome {
  propId: string;
  playerName: string;
  marketType: string;
  line: number;
  actualValue: number;
  outcome: 'win' | 'loss' | 'push' | 'void';
  settledAt: Date;
  metadata?: Record<string, any>;
}

export interface UnifiedPlayerStats {
  playerName: string;
  sport: string;
  gameDate: Date;
  stats: Record<string, number>;
  metadata?: Record<string, any>;
}

/**
 * SGO Event Response Structure
 */
export interface SGOEvent {
  eventID: string;
  sportID: string;
  leagueID: string;
  startDate: string;
  status?: string;
  players?: Record<string, SGOPlayer>;
  odds?: Record<string, SGOOdd>;
  scores?: Record<string, any>;
}

export interface SGOPlayer {
  playerID: string;
  name: string;
  team?: string;
  position?: string;
}

export interface SGOOdd {
  oddID: string;
  playerID?: string;
  statID?: string; // e.g., "batting_homeRuns", "pitching_strikeouts"
  statEntityID?: string;
  periodID?: string;
  betTypeID?: string;
  sideID?: string;
  bookOverUnder?: string;
  fairOverUnder?: string;
  bookOdds?: string;
  fairOdds?: string;
  byBookmaker?: Record<string, {
    odds?: string;
    overUnder?: string;
    available?: boolean;
  }>;
  score?: number;
  result?: string;
  started?: boolean;
  ended?: boolean;
  cancelled?: boolean;
}

/**
 * SGO API Adapter
 *
 * Maps SGO data to our unified format for seamless integration
 */
export class SGOAdapter {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(config: SGOConfig) {
    this.apiKey = config.apiKey;
    this.client = axios.create({
      baseURL: config.baseURL || 'https://api.sportsgameodds.com/v2',
      timeout: config.timeout || 60000, // Increased for large historical queries
    });
  }

  /**
   * Fetch historical props from SGO events
   *
   * Player props are embedded within events.odds object
   * Parse oddID patterns to identify player props
   *
   * @param params Filter parameters
   * @returns Unified props ready for our system
   */
  async fetchProps(params: {
    sport?: string;
    league?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<UnifiedProp[]> {
    try {
      const leagueID = params.league || this.mapSportToSGO(params.sport);

      const response = await this.client.get('/events', {
        params: {
          apiKey: this.apiKey,
          leagueID,
          startsAfter: params.startDate,
          startsBefore: params.endDate,
          includeAltLine: true,
          finalized: false, // Get current props
          limit: params.limit || 100,
        },
      });

      const events: SGOEvent[] = response.data.data || [];

      console.log(`Fetched ${events.length} events from SGO`);

      // Extract player props from events
      const props: UnifiedProp[] = [];

      for (const event of events) {
        const eventProps = this.extractPlayerPropsFromEvent(event);
        props.push(...eventProps);
      }

      console.log(`Extracted ${props.length} player props from ${events.length} events`);

      return props;
    } catch (error: any) {
      console.error('SGO fetchProps error:', error.message);
      throw new Error(`Failed to fetch props from SGO: ${error.message}`);
    }
  }

  /**
   * Extract player props from SGO event structure
   *
   * Player props have playerID and statID fields
   */
  private extractPlayerPropsFromEvent(event: SGOEvent): UnifiedProp[] {
    const props: UnifiedProp[] = [];

    if (!event.odds || !event.players) {
      return props;
    }

    // Iterate through all odds in the event
    for (const [oddID, odd] of Object.entries(event.odds)) {
      // Skip if not a player prop (no playerID or statID)
      if (!odd.playerID || !odd.statID) {
        continue;
      }

      // Only process main game props (periodID === 'game')
      if (odd.periodID !== 'game') {
        continue;
      }

      // Only process over/under props
      if (odd.betTypeID !== 'ou') {
        continue;
      }

      // Get player info
      const player = event.players[odd.playerID];
      if (!player) {
        continue;
      }

      // Get line from bookOverUnder or fairOverUnder
      const lineStr = odd.bookOverUnder || odd.fairOverUnder || '0';
      const line = parseFloat(lineStr);

      // Get odds from bookOdds or fairOdds
      const oddsStr = odd.bookOdds || odd.fairOdds || '-110';
      const odds = this.parseAmericanOdds(oddsStr);

      // Get best bookmaker if available
      const bookmaker = this.extractBestBookmaker(odd.byBookmaker);

      props.push({
        id: `${event.eventID}-${oddID}`,
        sport: this.mapSportFromSGO(event.sportID),
        league: event.leagueID,
        playerName: player.name,
        marketType: this.mapMarketType(odd.statID),
        line,
        odds,
        bookmaker,
        gameDate: new Date(event.startDate),
        metadata: {
          source: 'sgo',
          eventID: event.eventID,
          oddID,
          playerID: odd.playerID,
          team: player.teamID,
          position: player.position,
          rawStatID: odd.statID,
          sideID: odd.sideID,
        },
      });
    }

    return props;
  }

  /**
   * Parse American odds from string (e.g., "+188", "-110")
   */
  private parseAmericanOdds(oddsStr: string): number {
    return parseInt(oddsStr.replace(/[^-\d]/g, '')) || -110;
  }

  /**
   * Extract best bookmaker from byBookmaker object
   */
  private extractBestBookmaker(byBookmaker?: Record<string, { odds?: string; available?: boolean }>): string {
    if (!byBookmaker) {
      return 'unknown';
    }

    // Find first available bookmaker
    for (const [bookName, bookData] of Object.entries(byBookmaker)) {
      if (bookData.available !== false) {
        return bookName;
      }
    }

    return 'unknown';
  }

  /**
   * Fetch settled outcomes from SGO
   *
   * This is the GOLDMINE - historical outcomes for backtest validation
   * Outcomes are in finalized events with score data
   */
  async fetchOutcomes(params: {
    sport?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<UnifiedOutcome[]> {
    try {
      const leagueID = this.mapSportToSGO(params.sport);

      const response = await this.client.get('/events', {
        params: {
          apiKey: this.apiKey,
          leagueID,
          startsAfter: params.startDate,
          startsBefore: params.endDate,
          includeAltLine: true,
          finalized: true, // Only get completed games
          limit: params.limit || 100,
        },
      });

      const events: SGOEvent[] = response.data.data || [];

      console.log(`Fetched ${events.length} finalized events from SGO`);

      // Extract outcomes from events
      const outcomes: UnifiedOutcome[] = [];

      for (const event of events) {
        const eventOutcomes = this.extractOutcomesFromEvent(event);
        outcomes.push(...eventOutcomes);
      }

      console.log(`Extracted ${outcomes.length} outcomes from ${events.length} events`);

      return outcomes;
    } catch (error: any) {
      console.error('SGO fetchOutcomes error:', error.message);
      throw new Error(`Failed to fetch outcomes from SGO: ${error.message}`);
    }
  }

  /**
   * Extract outcomes from finalized SGO event
   *
   * Uses score data to determine actual values and outcomes
   */
  private extractOutcomesFromEvent(event: SGOEvent): UnifiedOutcome[] {
    const outcomes: UnifiedOutcome[] = [];

    if (!event.odds || !event.players) {
      return outcomes;
    }

    // Iterate through all odds in the event
    for (const [oddID, odd] of Object.entries(event.odds)) {
      // Skip if not a player prop
      if (!odd.playerID || !odd.statID) {
        continue;
      }

      // Only process main game props
      if (odd.periodID !== 'game') {
        continue;
      }

      // Only process over/under props
      if (odd.betTypeID !== 'ou') {
        continue;
      }

      // Skip if not ended
      if (!odd.ended) {
        continue;
      }

      // Get player info
      const player = event.players[odd.playerID];
      if (!player) {
        continue;
      }

      // Get actual value from score field
      const actualValue = odd.score !== undefined ? odd.score : null;
      if (actualValue === null) {
        continue; // Skip if no score data
      }

      // Get line
      const lineStr = odd.bookOverUnder || odd.fairOverUnder || '0';
      const line = parseFloat(lineStr);

      // Determine outcome based on sideID (over/under)
      const outcome = this.determineOutcome(actualValue, line, odd.sideID || 'over');

      outcomes.push({
        propId: `${event.eventID}-${oddID}`,
        playerName: player.name,
        marketType: this.mapMarketType(odd.statID),
        line,
        actualValue,
        outcome,
        settledAt: new Date(event.startDate), // Use event start date as settled time
        metadata: {
          source: 'sgo',
          eventID: event.eventID,
          oddID,
          playerID: odd.playerID,
          team: player.teamID,
          rawStatID: odd.statID,
          sideID: odd.sideID,
        },
      });
    }

    return outcomes;
  }

  /**
   * Determine outcome based on actual value, line, and side
   */
  private determineOutcome(
    actualValue: number,
    line: number,
    sideID: string
  ): 'win' | 'loss' | 'push' | 'void' {
    if (actualValue === line) {
      return 'push';
    }

    const isOver = sideID === 'over';

    if (isOver) {
      return actualValue > line ? 'win' : 'loss';
    } else {
      return actualValue < line ? 'win' : 'loss';
    }
  }

  /**
   * Fetch player stats from SGO
   *
   * Critical for ML probability calculations
   * Extract stats from finalized events with scores
   */
  async fetchPlayerStats(params: {
    sport?: string;
    playerName?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<UnifiedPlayerStats[]> {
    try {
      const leagueID = this.mapSportToSGO(params.sport);

      const response = await this.client.get('/events', {
        params: {
          apiKey: this.apiKey,
          leagueID,
          startsAfter: params.startDate,
          startsBefore: params.endDate,
          finalized: true, // Only completed games have stats
          limit: params.limit || 100,
        },
      });

      const events: SGOEvent[] = response.data.data || [];

      console.log(`Fetched ${events.length} finalized events for player stats`);

      // Extract player stats from events
      const statsMap = new Map<string, UnifiedPlayerStats>();

      for (const event of events) {
        const eventStats = this.extractPlayerStatsFromEvent(event);

        for (const stat of eventStats) {
          const key = `${stat.playerName}-${stat.gameDate.toISOString().split('T')[0]}`;
          const existing = statsMap.get(key);

          if (!existing) {
            statsMap.set(key, stat);
          } else {
            // Merge stats
            existing.stats = { ...existing.stats, ...stat.stats };
          }
        }
      }

      const playerStats = Array.from(statsMap.values());

      console.log(`Extracted stats for ${playerStats.length} player-games`);

      return playerStats;
    } catch (error: any) {
      console.error('SGO fetchPlayerStats error:', error.message);
      throw new Error(`Failed to fetch player stats from SGO: ${error.message}`);
    }
  }

  /**
   * Extract player stats from finalized event
   */
  private extractPlayerStatsFromEvent(event: SGOEvent): UnifiedPlayerStats[] {
    const stats: UnifiedPlayerStats[] = [];

    if (!event.odds || !event.players) {
      return stats;
    }

    // Group stats by player
    const playerStatsMap = new Map<
      string,
      { player: SGOPlayer; stats: Record<string, number> }
    >();

    for (const [oddID, odd] of Object.entries(event.odds)) {
      // Only use props with actual score data and playerID
      if (!odd.playerID || !odd.statID || odd.score === undefined) {
        continue;
      }

      // Only use game-level props
      if (odd.periodID !== 'game') {
        continue;
      }

      const player = event.players[odd.playerID];
      if (!player) {
        continue;
      }

      const statKey = this.mapMarketType(odd.statID);

      if (!playerStatsMap.has(player.playerID)) {
        playerStatsMap.set(player.playerID, { player, stats: {} });
      }

      // Store the stat value
      playerStatsMap.get(player.playerID)!.stats[statKey] = odd.score;
    }

    // Convert to UnifiedPlayerStats
    for (const [playerID, data] of playerStatsMap.entries()) {
      stats.push({
        playerName: data.player.name,
        sport: this.mapSportFromSGO(event.sportID),
        gameDate: new Date(event.startDate),
        stats: data.stats,
        metadata: {
          source: 'sgo',
          eventID: event.eventID,
          playerID,
          team: data.player.teamID,
        },
      });
    }

    return stats;
  }

  /**
   * Map our sport codes to SGO leagueID format
   */
  private mapSportToSGO(sport?: string): string {
    if (!sport) return '';

    const mapping: Record<string, string> = {
      MLB: 'MLB',
      NFL: 'NFL',
      NBA: 'NBA',
      NHL: 'NHL',
      NCAAF: 'NCAAF',
      NCAAB: 'NCAAB',
      WNBA: 'WNBA',
      MLS: 'MLS',
      EPL: 'EPL',
    };

    return mapping[sport.toUpperCase()] || sport.toUpperCase();
  }

  /**
   * Map SGO sportID to our format
   */
  private mapSportFromSGO(sgoSport: string): string {
    const mapping: Record<string, string> = {
      BASEBALL: 'MLB',
      FOOTBALL: 'NFL',
      BASKETBALL: 'NBA',
      HOCKEY: 'NHL',
      SOCCER: 'MLS',
    };

    return mapping[sgoSport] || sgoSport.toUpperCase();
  }

  /**
   * Map SGO market types to our standardized format
   *
   * SGO uses snake_case (e.g., "passing_yards", "hits")
   * We use camelCase (e.g., "passingYards", "hits")
   */
  private mapMarketType(sgoMarketType: string): string {
    const mapping: Record<string, string> = {
      // MLB mappings
      hits: 'hits',
      total_bases: 'totalBases',
      home_runs: 'homeRuns',
      rbis: 'rbi',
      rbi: 'rbi',
      runs: 'runs',
      runs_scored: 'runs',
      stolen_bases: 'stolenBases',
      strikeouts: 'strikeoutsThrown',
      strikeouts_thrown: 'strikeoutsThrown',
      outs_recorded: 'outs',
      hits_allowed: 'hitsAllowed',
      earned_runs: 'earnedRuns',
      walks: 'baseOnBalls',
      walks_batter: 'baseOnBalls',

      // NFL mappings
      passing_yards: 'passingYards',
      rushing_yards: 'rushingYards',
      receiving_yards: 'receivingYards',
      receptions: 'receptions',
      passing_touchdowns: 'passingTouchdowns',
      rushing_touchdowns: 'rushingTouchdowns',
      receiving_touchdowns: 'receivingTouchdowns',
      passing_completions: 'passingCompletions',
      rushing_attempts: 'rushingAttempts',
      interceptions: 'interceptions',
      sacks: 'sacks',
      tackles: 'tackles',

      // NBA mappings
      points: 'points',
      rebounds: 'rebounds',
      assists: 'assists',
      three_pointers: 'threePointers',
      steals: 'steals',
      blocks: 'blocks',
      turnovers: 'turnovers',

      // NHL mappings
      goals: 'goals',
      assists_hockey: 'assists',
      shots: 'shots',
      saves: 'saves',
    };

    // Try exact match first
    if (mapping[sgoMarketType]) {
      return mapping[sgoMarketType];
    }

    // Try lowercase version
    const lower = sgoMarketType.toLowerCase();
    if (mapping[lower]) {
      return mapping[lower];
    }

    // Return as-is if no mapping found
    return sgoMarketType;
  }

  /**
   * Provider metadata
   */
  getProviderName(): string {
    return 'SGO';
  }

  getProviderCapabilities() {
    return {
      props: true,
      outcomes: true,
      playerStats: true,
      historicalData: true,
      sports: ['MLB', 'NFL', 'NBA', 'NHL', 'NCAAF', 'NCAAB'],
    };
  }
}
