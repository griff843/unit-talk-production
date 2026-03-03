/**
 * CLV (Closing Line Value) Tracking Service
 * The North Star metric for professional betting success
 * Tracks whether picks consistently beat the closing line
 *
 * @module CLVTrackingService
 */

import { createLogger } from '../../utils/logger';
import { supabaseClient } from '../supabaseClient';

export interface CLVEntry {
  propId: string;
  userId?: string;
  sport: string;
  market: string;
  book: string;

  // Line data
  openingLine: number;
  openingOdds: number;
  betLine: number;
  betOdds: number;
  closingLine: number;
  closingOdds: number;

  // Timing
  openingTime: Date;
  betTime: Date;
  closingTime: Date;
  gameTime: Date;

  // CLV metrics
  clv: number; // Raw CLV
  clvPercentage: number; // CLV as percentage
  beatsClosing: boolean; // Binary - did we beat closing?

  // Additional context
  modelEdge: number; // Our model's edge at bet time
  actualResult?: boolean; // Did the bet win?
  profit?: number; // Actual profit/loss

  // Devigged metrics
  deviggedOpeningProb: number;
  deviggedClosingProb: number;
  deviggedCLV: number;
}

export interface CLVStats {
  totalBets: number;
  clvPositive: number;
  clvNegative: number;
  avgCLV: number;
  avgCLVPercentage: number;

  // By timeframe
  last24h: CLVMetrics;
  last7d: CLVMetrics;
  last30d: CLVMetrics;
  allTime: CLVMetrics;

  // By category
  bySport: Map<string, CLVMetrics>;
  byMarket: Map<string, CLVMetrics>;
  byBook: Map<string, CLVMetrics>;
}

export interface CLVMetrics {
  count: number;
  avgCLV: number;
  winRate: number;
  roi: number;
  stdDev: number;
}

export class CLVTrackingService {
  private static instance: CLVTrackingService;
  private logger: any;
  private clvCache: Map<string, CLVEntry> = new Map();

  private constructor() {
    this.logger = createLogger('CLVTrackingService');
  }

  public static getInstance(): CLVTrackingService {
    if (!CLVTrackingService.instance) {
      CLVTrackingService.instance = new CLVTrackingService();
    }
    return CLVTrackingService.instance;
  }

  /**
   * Track a new pick with opening line data
   */
  async trackPick(pick: {
    propId: string;
    userId?: string;
    sport: string;
    market: string;
    book: string;
    betLine: number;
    betOdds: number;
    modelEdge: number;
    openingLine?: number;
    openingOdds?: number;
    gameTime: Date;
  }): Promise<string> {
    try {
      const clvEntry: Partial<CLVEntry> = {
        propId: pick.propId,
        userId: pick.userId,
        sport: pick.sport,
        market: pick.market,
        book: pick.book,
        betLine: pick.betLine,
        betOdds: pick.betOdds,
        betTime: new Date(),
        gameTime: pick.gameTime,
        modelEdge: pick.modelEdge,

        // Use provided opening or current as opening
        openingLine: pick.openingLine || pick.betLine,
        openingOdds: pick.openingOdds || pick.betOdds,
        openingTime: pick.openingLine ? new Date() : new Date(),
      };

      // Store in database
      const { error } = await supabaseClient.from('clv_tracking').insert(clvEntry);

      if (error) {
        this.logger.error('Failed to track CLV pick', error);
        throw error;
      }

      // Cache for quick access
      this.clvCache.set(pick.propId, clvEntry as CLVEntry);

      this.logger.info(`CLV tracking started for ${pick.propId}`);

      // Return the propId as tracking identifier
      return pick.propId;
    } catch (error) {
      this.logger.error('Error tracking pick for CLV', error);
      throw error;
    }
  }

  /**
   * Update closing line and calculate CLV
   */
  async updateClosingLine(
    propId: string,
    closingLine: number,
    closingOdds: number
  ): Promise<CLVEntry> {
    try {
      // Get existing entry
      const { data: existing, error: fetchError } = await supabaseClient
        .from('clv_tracking')
        .select('*')
        .eq('propId', propId)
        .single();

      if (fetchError || !existing) {
        throw new Error(`CLV entry not found for ${propId}`);
      }

      // Calculate CLV metrics
      const clvMetrics = this.calculateCLV(
        existing.betOdds,
        closingOdds,
        existing.betLine,
        closingLine
      );

      // Update with closing data and CLV
      const updates = {
        closingLine,
        closingOdds,
        closingTime: new Date(),
        clv: clvMetrics.clv,
        clvPercentage: clvMetrics.clvPercentage,
        beatsClosing: clvMetrics.beatsClosing,
        deviggedClosingProb: clvMetrics.deviggedClosingProb,
      };

      const { data: updated, error: updateError } = await supabaseClient
        .from('clv_tracking')
        .update(updates)
        .eq('propId', propId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      this.logger.info(`CLV calculated for ${propId}: ${clvMetrics.clvPercentage.toFixed(2)}%`);

      return updated;
    } catch (error) {
      this.logger.error('Error updating closing line', error);
      throw error;
    }
  }

  /**
   * Calculate CLV from odds
   */
  private calculateCLV(
    betOdds: number,
    closingOdds: number,
    betLine: number,
    closingLine: number
  ): {
    clv: number;
    clvPercentage: number;
    beatsClosing: boolean;
    deviggedClosingProb: number;
  } {
    // Convert to probabilities
    const betProb = this.oddsToProb(betOdds);
    const closingProb = this.oddsToProb(closingOdds);

    // For totals/spreads, also consider line movement
    let lineAdjustment = 0;
    if (betLine !== closingLine) {
      // Each 0.5 point is worth ~2.5% in probability
      lineAdjustment = (betLine - closingLine) * 0.025;
    }

    // CLV is the difference in implied probability
    const clv = betProb - closingProb + lineAdjustment;
    const clvPercentage = clv * 100;

    // Positive CLV means we beat the closing line
    const beatsClosing = clv > 0;

    return {
      clv,
      clvPercentage,
      beatsClosing,
      deviggedClosingProb: closingProb, // This should use devigging service
    };
  }

  /**
   * Get CLV statistics
   */
  async getCLVStats(filters?: {
    userId?: string;
    sport?: string;
    market?: string;
    book?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<CLVStats> {
    try {
      let query = supabaseClient.from('clv_tracking').select('*').not('closingLine', 'is', null); // Only completed CLV entries

      // Apply filters
      if (filters?.userId) query = query.eq('userId', filters.userId);
      if (filters?.sport) query = query.eq('sport', filters.sport);
      if (filters?.market) query = query.eq('market', filters.market);
      if (filters?.book) query = query.eq('book', filters.book);
      if (filters?.startDate) query = query.gte('betTime', filters.startDate.toISOString());
      if (filters?.endDate) query = query.lte('betTime', filters.endDate.toISOString());

      const { data, error } = await query;

      if (error) throw error;

      return this.calculateStats(data || []);
    } catch (error) {
      this.logger.error('Error fetching CLV stats', error);
      throw error;
    }
  }

  /**
   * Calculate statistics from CLV entries
   */
  private calculateStats(entries: CLVEntry[]): CLVStats {
    const totalBets = entries.length;
    const clvPositive = entries.filter(e => e.beatsClosing).length;
    const clvNegative = totalBets - clvPositive;

    const avgCLV = entries.reduce((sum, e) => sum + e.clv, 0) / totalBets;
    const avgCLVPercentage = entries.reduce((sum, e) => sum + e.clvPercentage, 0) / totalBets;

    // Calculate timeframe metrics
    const now = new Date();
    const last24h = this.calculateMetrics(
      entries.filter(e => new Date(e.betTime) > new Date(now.getTime() - 24 * 60 * 60 * 1000))
    );
    const last7d = this.calculateMetrics(
      entries.filter(e => new Date(e.betTime) > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))
    );
    const last30d = this.calculateMetrics(
      entries.filter(e => new Date(e.betTime) > new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000))
    );
    const allTime = this.calculateMetrics(entries);

    // Calculate by category
    const bySport = this.groupAndCalculate(entries, 'sport');
    const byMarket = this.groupAndCalculate(entries, 'market');
    const byBook = this.groupAndCalculate(entries, 'book');

    return {
      totalBets,
      clvPositive,
      clvNegative,
      avgCLV,
      avgCLVPercentage,
      last24h,
      last7d,
      last30d,
      allTime,
      bySport,
      byMarket,
      byBook,
    };
  }

  /**
   * Calculate detailed metrics for a set of entries
   */
  private calculateMetrics(entries: CLVEntry[]): CLVMetrics {
    if (entries.length === 0) {
      return { count: 0, avgCLV: 0, winRate: 0, roi: 0, stdDev: 0 };
    }

    const count = entries.length;
    const avgCLV = entries.reduce((sum, e) => sum + e.clvPercentage, 0) / count;

    // Win rate (if we have results)
    const entriesWithResults = entries.filter(e => e.actualResult !== undefined);
    const winRate =
      entriesWithResults.length > 0
        ? entriesWithResults.filter(e => e.actualResult).length / entriesWithResults.length
        : 0;

    // ROI (if we have profit data)
    const entriesWithProfit = entries.filter(e => e.profit !== undefined);
    const roi =
      entriesWithProfit.length > 0
        ? entriesWithProfit.reduce((sum, e) => sum + (e.profit || 0), 0) / entriesWithProfit.length
        : 0;

    // Standard deviation
    const mean = avgCLV;
    const variance =
      entries.reduce((sum, e) => sum + Math.pow(e.clvPercentage - mean, 2), 0) / count;
    const stdDev = Math.sqrt(variance);

    return { count, avgCLV, winRate, roi, stdDev };
  }

  /**
   * Group entries and calculate metrics
   */
  private groupAndCalculate(entries: CLVEntry[], groupBy: keyof CLVEntry): Map<string, CLVMetrics> {
    const grouped = new Map<string, CLVEntry[]>();

    // Group entries
    entries.forEach(entry => {
      const key = String(entry[groupBy]);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(entry);
    });

    // Calculate metrics for each group
    const results = new Map<string, CLVMetrics>();
    grouped.forEach((groupEntries, key) => {
      results.set(key, this.calculateMetrics(groupEntries));
    });

    return results;
  }

  /**
   * Convert American odds to probability
   */
  private oddsToProb(americanOdds: number): number {
    if (americanOdds > 0) {
      return 100 / (americanOdds + 100);
    } else {
      return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
    }
  }

  /**
   * Update actual result for CLV entry
   */
  async updateResult(propId: string, won: boolean, profit: number): Promise<void> {
    try {
      const { error } = await supabaseClient
        .from('clv_tracking')
        .update({
          actualResult: won,
          profit: profit,
        })
        .eq('propId', propId);

      if (error) throw error;

      this.logger.info(`Result updated for ${propId}: ${won ? 'WIN' : 'LOSS'} (${profit})`);
    } catch (error) {
      this.logger.error('Error updating CLV result', error);
      throw error;
    }
  }

  /**
   * Get recent CLV performance for alerts
   */
  async getRecentPerformance(hours: number = 24): Promise<{
    avgCLV: number;
    trend: 'improving' | 'stable' | 'declining';
    alert: boolean;
    message?: string;
  }> {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const stats = await this.getCLVStats({
      startDate: startTime,
    });

    const avgCLV = stats.avgCLVPercentage;

    // Determine trend by comparing periods
    const firstHalf = await this.getCLVStats({
      startDate: startTime,
      endDate: new Date(Date.now() - (hours / 2) * 60 * 60 * 1000),
    });

    const secondHalf = await this.getCLVStats({
      startDate: new Date(Date.now() - (hours / 2) * 60 * 60 * 1000),
    });

    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (secondHalf.avgCLVPercentage > firstHalf.avgCLVPercentage + 1) {
      trend = 'improving';
    } else if (secondHalf.avgCLVPercentage < firstHalf.avgCLVPercentage - 1) {
      trend = 'declining';
    }

    // Alert conditions
    let alert = false;
    let message: string | undefined;

    if (avgCLV < -2) {
      alert = true;
      message = `CRITICAL: CLV averaging ${avgCLV.toFixed(2)}% over last ${hours}h`;
    } else if (avgCLV < 0 && hours >= 72) {
      alert = true;
      message = `WARNING: Negative CLV for ${hours}h straight`;
    } else if (trend === 'declining' && avgCLV < 2) {
      alert = true;
      message = `ATTENTION: CLV declining, now at ${avgCLV.toFixed(2)}%`;
    }

    return { avgCLV, trend, alert, message };
  }
}

// Export singleton instance
export const clvTrackingService = CLVTrackingService.getInstance();
