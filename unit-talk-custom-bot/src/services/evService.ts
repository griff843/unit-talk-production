import { DatabaseService } from './database';
import { logger } from '../utils/logger';

export interface EVAnalysis {
  pickId: string;
  playerName: string;
  statType: string;
  line: number;
  overUnder: 'over' | 'under';
  odds: number;
  impliedProbability: number;
  trueProbability: number;
  expectedValue: number;
  evPercentage: number;
  stake: number;
  expectedProfit: number;
  sport: string;
  confidence: number;
  createdAt: string;
  discordId: string;
  username?: string;
}

export interface EVSummary {
  totalPicks: number;
  positiveEVPicks: number;
  negativeEVPicks: number;
  averageEV: number;
  totalExpectedProfit: number;
  bestEVPick: EVAnalysis | null;
  worstEVPick: EVAnalysis | null;
  evByUser: { [discordId: string]: UserEVStats };
  evBySport: { [sport: string]: SportEVStats };
  evByTimeRange: TimeRangeEVStats[];
}

export interface UserEVStats {
  discordId: string;
  username?: string;
  totalPicks: number;
  positiveEVPicks: number;
  averageEV: number;
  totalExpectedProfit: number;
  winRate: number;
  actualProfit: number;
  roi: number;
}

export interface SportEVStats {
  sport: string;
  totalPicks: number;
  averageEV: number;
  totalExpectedProfit: number;
  bestEVPick: EVAnalysis | null;
}

export interface TimeRangeEVStats {
  date: string;
  totalPicks: number;
  averageEV: number;
  totalExpectedProfit: number;
  positiveEVCount: number;
}

export class EVService {
  private databaseService: DatabaseService;

  constructor(databaseService: DatabaseService) {
    this.databaseService = databaseService;
  }

  /**
   * Calculate expected value for a single pick
   */
  calculateEV(odds: number, trueProbability: number, stake: number = 100): {
    impliedProbability: number;
    expectedValue: number;
    evPercentage: number;
    expectedProfit: number;
  } {
    // Convert American odds to decimal odds
    const decimalOdds = this.americanToDecimal(odds);
    
    // Calculate implied probability from odds
    const impliedProbability = 1 / decimalOdds;
    
    // Calculate expected value
    const expectedValue = (trueProbability * decimalOdds) - 1;
    
    // Calculate EV percentage
    const evPercentage = (expectedValue / impliedProbability) * 100;
    
    // Calculate expected profit
    const expectedProfit = expectedValue * stake;

    return {
      impliedProbability,
      expectedValue,
      evPercentage,
      expectedProfit
    };
  }

  /**
   * Get EV analysis for picks within a date range
   */
  async getEVAnalysis(options: {
    startDate?: string;
    endDate?: string;
    discordId?: string;
    sport?: string;
    minEV?: number;
    limit?: number;
  } = {}): Promise<EVAnalysis[]> {
    try {
      const {
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Default: last 24 hours
        endDate = new Date().toISOString(),
        discordId,
        sport,
        minEV,
        limit = 100
      } = options;

      // Get picks from database
      let query = this.databaseService.client
        .from('user_picks')
        .select(`
          *,
          user_profiles!inner(username)
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .not('odds', 'is', null)
        .not('confidence', 'is', null)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (discordId) {
        query = query.eq('discord_id', discordId);
      }

      if (sport) {
        query = query.ilike('pick_type', `%${sport}%`);
      }

      const { data: picks, error } = await query;

      if (error) throw error;

      const evAnalyses: EVAnalysis[] = [];

      for (const pick of picks || []) {
        if (!pick.odds || !pick.confidence) continue;

        // Use confidence as a proxy for true probability (0-100 scale)
        const trueProbability = pick.confidence / 100;
        
        const evCalc = this.calculateEV(pick.odds, trueProbability, pick.stake || 100);

        // Filter by minimum EV if specified
        if (minEV !== undefined && evCalc.evPercentage < minEV) continue;

        const analysis: EVAnalysis = {
          pickId: pick.id,
          playerName: pick.player_name || 'Unknown',
          statType: pick.stat_type || 'Unknown',
          line: pick.line || 0,
          overUnder: pick.over_under || 'over',
          odds: pick.odds,
          impliedProbability: evCalc.impliedProbability,
          trueProbability,
          expectedValue: evCalc.expectedValue,
          evPercentage: evCalc.evPercentage,
          stake: pick.stake || 100,
          expectedProfit: evCalc.expectedProfit,
          sport: this.extractSport(pick.pick_type),
          confidence: pick.confidence,
          createdAt: pick.created_at,
          discordId: pick.discord_id,
          username: pick.user_profiles?.username
        };

        evAnalyses.push(analysis);
      }

      return evAnalyses.sort((a, b) => b.evPercentage - a.evPercentage);
    } catch (error) {
      logger.error('Error getting EV analysis:', error);
      return [];
    }
  }

  /**
   * Get comprehensive EV summary
   */
  async getEVSummary(options: {
    startDate?: string;
    endDate?: string;
    discordId?: string;
  } = {}): Promise<EVSummary> {
    try {
      const analyses = await this.getEVAnalysis(options);

      const summary: EVSummary = {
        totalPicks: analyses.length,
        positiveEVPicks: analyses.filter(a => a.expectedValue > 0).length,
        negativeEVPicks: analyses.filter(a => a.expectedValue < 0).length,
        averageEV: analyses.length > 0 ? analyses.reduce((sum, a) => sum + a.evPercentage, 0) / analyses.length : 0,
        totalExpectedProfit: analyses.reduce((sum, a) => sum + a.expectedProfit, 0),
        bestEVPick: analyses.length > 0 ? analyses[0] : null,
        worstEVPick: analyses.length > 0 ? analyses[analyses.length - 1] : null,
        evByUser: {},
        evBySport: {},
        evByTimeRange: []
      };

      // Calculate EV by user
      const userGroups = this.groupBy(analyses, 'discordId');
      for (const [discordId, userPicks] of Object.entries(userGroups)) {
        const userStats = await this.calculateUserEVStats(discordId, userPicks);
        summary.evByUser[discordId] = userStats;
      }

      // Calculate EV by sport
      const sportGroups = this.groupBy(analyses, 'sport');
      for (const [sport, sportPicks] of Object.entries(sportGroups)) {
        summary.evBySport[sport] = {
          sport,
          totalPicks: sportPicks.length,
          averageEV: sportPicks.reduce((sum, p) => sum + p.evPercentage, 0) / sportPicks.length,
          totalExpectedProfit: sportPicks.reduce((sum, p) => sum + p.expectedProfit, 0),
          bestEVPick: sportPicks.sort((a, b) => b.evPercentage - a.evPercentage)[0] || null
        };
      }

      // Calculate EV by time range (daily)
      const dateGroups = this.groupBy(analyses, (pick) => pick.createdAt.split('T')[0]);
      summary.evByTimeRange = Object.entries(dateGroups).map(([date, picks]) => ({
        date,
        totalPicks: picks.length,
        averageEV: picks.reduce((sum, p) => sum + p.evPercentage, 0) / picks.length,
        totalExpectedProfit: picks.reduce((sum, p) => sum + p.expectedProfit, 0),
        positiveEVCount: picks.filter(p => p.expectedValue > 0).length
      })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return summary;
    } catch (error) {
      logger.error('Error getting EV summary:', error);
      throw error;
    }
  }

  /**
   * Get top EV picks for leaderboard
   */
  async getTopEVPicks(options: {
    timeRange: 'today' | 'week' | 'month';
    limit?: number;
    minEV?: number;
  }): Promise<EVAnalysis[]> {
    const { timeRange, limit = 10, minEV = 0 } = options;
    
    let startDate: string;
    const now = new Date();
    
    switch (timeRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        break;
    }

    return this.getEVAnalysis({
      startDate,
      endDate: now.toISOString(),
      minEV,
      limit
    });
  }

  /**
   * Get user EV leaderboard
   */
  async getUserEVLeaderboard(options: {
    timeRange: 'today' | 'week' | 'month';
    limit?: number;
  }): Promise<UserEVStats[]> {
    const { timeRange, limit = 10 } = options;
    
    const summary = await this.getEVSummary({
      startDate: this.getStartDateForRange(timeRange)
    });

    return Object.values(summary.evByUser)
      .filter(user => user.totalPicks > 0)
      .sort((a, b) => b.averageEV - a.averageEV)
      .slice(0, limit);
  }

  // Helper methods
  private americanToDecimal(americanOdds: number): number {
    if (americanOdds > 0) {
      return (americanOdds / 100) + 1;
    } else {
      return (100 / Math.abs(americanOdds)) + 1;
    }
  }

  private extractSport(pickType: string): string {
    const sportKeywords = {
      'nba': 'NBA',
      'nfl': 'NFL',
      'nhl': 'NHL',
      'mlb': 'MLB',
      'soccer': 'Soccer',
      'football': 'NFL',
      'basketball': 'NBA',
      'hockey': 'NHL',
      'baseball': 'MLB'
    };

    const lowerPickType = pickType.toLowerCase();
    for (const [keyword, sport] of Object.entries(sportKeywords)) {
      if (lowerPickType.includes(keyword)) {
        return sport;
      }
    }
    return 'Other';
  }

  private groupBy<T>(array: T[], keyFn: string | ((item: T) => string)): { [key: string]: T[] } {
    return array.reduce((groups, item) => {
      const key = typeof keyFn === 'string' ? (item as any)[keyFn] : keyFn(item);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
      return groups;
    }, {} as { [key: string]: T[] });
  }

  private async calculateUserEVStats(discordId: string, picks: EVAnalysis[]): Promise<UserEVStats> {
    const userStats = await this.databaseService.getUserPickStats(discordId);
    
    return {
      discordId,
      username: picks[0]?.username,
      totalPicks: picks.length,
      positiveEVPicks: picks.filter(p => p.expectedValue > 0).length,
      averageEV: picks.length > 0 ? picks.reduce((sum, p) => sum + p.evPercentage, 0) / picks.length : 0,
      totalExpectedProfit: picks.reduce((sum, p) => sum + p.expectedProfit, 0),
      winRate: userStats.winRate,
      actualProfit: userStats.totalProfit,
      roi: userStats.averageStake > 0 ? (userStats.totalProfit / (userStats.averageStake * userStats.totalPicks)) * 100 : 0
    };
  }

  private getStartDateForRange(timeRange: 'today' | 'week' | 'month'): string {
    const now = new Date();
    
    switch (timeRange) {
      case 'today':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }
  }
}