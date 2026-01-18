/**
 * Daily Recap Service
 *
 * Computes and persists daily recap summaries with CLV data,
 * sport breakdowns, and performance metrics.
 *
 * Phase 2 Step 5 - Daily Recap Automation
 *
 * Features:
 * - Idempotent daily recap generation
 * - CLV distribution tracking
 * - Per-sport performance breakdown
 * - Top picks identification
 * - UTC/ET timezone handling
 *
 * @module DailyRecapService
 */

import { createLogger } from '../../utils/logger';
import { supabaseClient } from '../supabaseClient';

// Daily recap data structure
export interface DailyRecap {
  recap_date: Date;
  total_picks: number;
  win_rate: number | null;
  avg_clv_bps: number | null;
  clv_distribution: CLVDistribution;
  sport_breakdown: SportBreakdown;
  capper_breakdown: CapperBreakdown;
  top_picks: string[];
  total_units: number | null;
  roi: number | null;
  wins: number;
  losses: number;
  pushes: number;
  pending: number;
  metadata: Record<string, any>;
}

// CLV distribution buckets
export interface CLVDistribution {
  '[-200,-100)': number;
  '[-100,-50)': number;
  '[-50,0)': number;
  '[0,50)': number;
  '[50,100)': number;
  '[100,200)': number;
  '[200,+)': number;
}

// Sport-level breakdown
export interface SportMetrics {
  total_picks: number;
  wins: number;
  losses: number;
  pushes: number;
  win_rate: number;
  avg_clv_bps: number;
  total_units: number;
}

export type SportBreakdown = Record<string, SportMetrics>;

// Capper-level breakdown
export interface CapperMetrics {
  total_picks: number;
  win_rate: number;
  avg_clv_bps: number;
}

export type CapperBreakdown = Record<string, CapperMetrics>;

// Pick data from database join
interface PickWithCLV {
  id: string;
  status: string;
  stake: number;
  profit_loss: number | null;
  selection: string;
  professional_score: number | null;
  user_id: string;
  created_at: Date;
  // From props join
  sport?: string;
  // From CLV join
  clv_percentage?: number | null;
  clv_cents?: number | null;
}

export class DailyRecapService {
  private static instance: DailyRecapService;
  private logger: any;

  private constructor() {
    this.logger = createLogger('DailyRecapService');
  }

  public static getInstance(): DailyRecapService {
    if (!DailyRecapService.instance) {
      DailyRecapService.instance = new DailyRecapService();
    }
    return DailyRecapService.instance;
  }

  /**
   * Compute daily recap for a given date
   *
   * @param recapDate - Date to generate recap for (defaults to yesterday in ET)
   * @returns DailyRecap object with all metrics
   */
  async computeDailyRecap(recapDate: Date): Promise<DailyRecap> {
    try {
      this.logger.info('Computing daily recap', { recapDate: recapDate.toISOString() });

      // Calculate date range (midnight to midnight ET)
      const startOfDay = new Date(recapDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(recapDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Query picks for the date range with CLV data
      // Note: We use created_at to determine which day the pick was made
      const { data: picks, error } = await supabaseClient
        .from('picks')
        .select(`
          id,
          status,
          stake,
          profit_loss,
          selection,
          professional_score,
          user_id,
          created_at,
          props!inner(sport),
          clv_tracking(clv_percentage, clv_cents)
        `)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .eq('workflow_stage', 'published');

      if (error) {
        this.logger.error('Error querying picks for recap', { error, recapDate });
        throw error;
      }

      // Transform the data (Supabase returns nested arrays for joined data)
      const picksWithCLV: PickWithCLV[] = (picks || []).map((pick: any) => ({
        id: pick.id,
        status: pick.status,
        stake: pick.stake,
        profit_loss: pick.profit_loss,
        selection: pick.selection,
        professional_score: pick.professional_score,
        user_id: pick.user_id,
        created_at: pick.created_at,
        sport: pick.props?.sport,
        clv_percentage: pick.clv_tracking?.[0]?.clv_percentage ?? null,
        clv_cents: pick.clv_tracking?.[0]?.clv_cents ?? null,
      }));

      this.logger.info('Fetched picks for recap', {
        recapDate,
        pickCount: picksWithCLV.length,
      });

      // Compute all metrics
      const totalPicks = picksWithCLV.length;
      const { wins, losses, pushes, pending } = this.calculateStatusCounts(picksWithCLV);
      const winRate = this.calculateWinRate(wins, losses, pushes);
      const avgClvBps = this.calculateAvgCLVBps(picksWithCLV);
      const clvDistribution = this.calculateCLVDistribution(picksWithCLV);
      const sportBreakdown = this.calculateSportBreakdown(picksWithCLV);
      const capperBreakdown = await this.calculateCapperBreakdown(picksWithCLV);
      const topPicks = this.identifyTopPicks(picksWithCLV);
      const totalUnits = this.calculateTotalUnits(picksWithCLV);
      const roi = this.calculateROI(totalUnits, picksWithCLV);

      const recap: DailyRecap = {
        recap_date: recapDate,
        total_picks: totalPicks,
        win_rate: winRate,
        avg_clv_bps: avgClvBps,
        clv_distribution: clvDistribution,
        sport_breakdown: sportBreakdown,
        capper_breakdown: capperBreakdown,
        top_picks: topPicks,
        total_units: totalUnits,
        roi: roi,
        wins,
        losses,
        pushes,
        pending,
        metadata: {
          generated_at: new Date().toISOString(),
          pick_count: totalPicks,
        },
      };

      this.logger.info('Daily recap computed successfully', {
        recapDate,
        totalPicks,
        wins,
        losses,
        avgClvBps,
      });

      return recap;
    } catch (error) {
      this.logger.error('Error computing daily recap', { error, recapDate });
      throw error;
    }
  }

  /**
   * Save daily recap to database (upsert by recap_date)
   *
   * @param recap - DailyRecap to save
   */
  async saveDailyRecap(recap: DailyRecap): Promise<void> {
    try {
      const recapDate = new Date(recap.recap_date);
      recapDate.setHours(0, 0, 0, 0); // Normalize to date only

      const { error } = await supabaseClient.from('daily_recaps').upsert(
        {
          recap_date: recapDate.toISOString().split('T')[0], // Date only (YYYY-MM-DD)
          total_picks: recap.total_picks,
          win_rate: recap.win_rate,
          avg_clv_bps: recap.avg_clv_bps,
          clv_distribution: recap.clv_distribution,
          sport_breakdown: recap.sport_breakdown,
          capper_breakdown: recap.capper_breakdown,
          top_picks: recap.top_picks,
          total_units: recap.total_units,
          roi: recap.roi,
          wins: recap.wins,
          losses: recap.losses,
          pushes: recap.pushes,
          pending: recap.pending,
          metadata: recap.metadata,
        },
        {
          onConflict: 'recap_date', // Upsert based on unique recap_date
        }
      );

      if (error) {
        this.logger.error('Error saving daily recap', { error, recapDate });
        throw error;
      }

      this.logger.info('Daily recap saved successfully', {
        recapDate: recapDate.toISOString().split('T')[0],
        totalPicks: recap.total_picks,
      });
    } catch (error) {
      this.logger.error('Error in saveDailyRecap', { error });
      throw error;
    }
  }

  /**
   * Calculate status counts (wins, losses, pushes, pending)
   */
  private calculateStatusCounts(picks: PickWithCLV[]): {
    wins: number;
    losses: number;
    pushes: number;
    pending: number;
  } {
    return picks.reduce(
      (acc, pick) => {
        switch (pick.status) {
          case 'won':
            acc.wins++;
            break;
          case 'lost':
            acc.losses++;
            break;
          case 'push':
          case 'void':
            acc.pushes++;
            break;
          default:
            acc.pending++;
        }
        return acc;
      },
      { wins: 0, losses: 0, pushes: 0, pending: 0 }
    );
  }

  /**
   * Calculate win rate (wins / (wins + losses))
   * Excludes pushes/voids from denominator
   */
  private calculateWinRate(wins: number, losses: number, pushes: number): number | null {
    const totalDecisive = wins + losses;
    if (totalDecisive === 0) return null;
    return wins / totalDecisive;
  }

  /**
   * Calculate average CLV in basis points
   */
  private calculateAvgCLVBps(picks: PickWithCLV[]): number | null {
    const picksWithCLV = picks.filter(p => p.clv_percentage != null);
    if (picksWithCLV.length === 0) return null;

    const totalCLVBps = picksWithCLV.reduce((sum, pick) => {
      // Convert clv_percentage to basis points (1% = 100 bps)
      return sum + (pick.clv_percentage! * 100);
    }, 0);

    return Math.round(totalCLVBps / picksWithCLV.length);
  }

  /**
   * Calculate CLV distribution buckets
   */
  private calculateCLVDistribution(picks: PickWithCLV[]): CLVDistribution {
    const distribution: CLVDistribution = {
      '[-200,-100)': 0,
      '[-100,-50)': 0,
      '[-50,0)': 0,
      '[0,50)': 0,
      '[50,100)': 0,
      '[100,200)': 0,
      '[200,+)': 0,
    };

    picks.forEach(pick => {
      if (pick.clv_percentage == null) return;

      const clvBps = pick.clv_percentage * 100;

      if (clvBps < -100) distribution['[-200,-100)']++;
      else if (clvBps < -50) distribution['[-100,-50)']++;
      else if (clvBps < 0) distribution['[-50,0)']++;
      else if (clvBps < 50) distribution['[0,50)']++;
      else if (clvBps < 100) distribution['[50,100)']++;
      else if (clvBps < 200) distribution['[100,200)']++;
      else distribution['[200,+)']++;
    });

    return distribution;
  }

  /**
   * Calculate sport-level breakdown
   */
  private calculateSportBreakdown(picks: PickWithCLV[]): SportBreakdown {
    const breakdown: SportBreakdown = {};

    picks.forEach(pick => {
      const sport = pick.sport || 'unknown';

      if (!breakdown[sport]) {
        breakdown[sport] = {
          total_picks: 0,
          wins: 0,
          losses: 0,
          pushes: 0,
          win_rate: 0,
          avg_clv_bps: 0,
          total_units: 0,
        };
      }

      const metrics = breakdown[sport];
      metrics.total_picks++;

      // Update status counts
      if (pick.status === 'won') metrics.wins++;
      else if (pick.status === 'lost') metrics.losses++;
      else if (pick.status === 'push' || pick.status === 'void') metrics.pushes++;

      // Update units
      if (pick.profit_loss != null) {
        metrics.total_units += pick.profit_loss;
      }
    });

    // Calculate aggregated metrics for each sport
    Object.keys(breakdown).forEach(sport => {
      const metrics = breakdown[sport];
      const decisivePicks = metrics.wins + metrics.losses;

      // Win rate
      metrics.win_rate = decisivePicks > 0 ? metrics.wins / decisivePicks : 0;

      // Average CLV for this sport
      const sportPicks = picks.filter(p => (p.sport || 'unknown') === sport && p.clv_percentage != null);
      if (sportPicks.length > 0) {
        const totalCLVBps = sportPicks.reduce((sum, p) => sum + (p.clv_percentage! * 100), 0);
        metrics.avg_clv_bps = Math.round(totalCLVBps / sportPicks.length);
      }
    });

    return breakdown;
  }

  /**
   * Calculate capper-level breakdown
   */
  private async calculateCapperBreakdown(picks: PickWithCLV[]): Promise<CapperBreakdown> {
    const breakdown: CapperBreakdown = {};

    // Group picks by user_id
    const userGroups = picks.reduce((acc, pick) => {
      if (!acc[pick.user_id]) {
        acc[pick.user_id] = [];
      }
      acc[pick.user_id].push(pick);
      return acc;
    }, {} as Record<string, PickWithCLV[]>);

    // Fetch usernames for user_ids
    const userIds = Object.keys(userGroups);
    if (userIds.length === 0) return breakdown;

    const { data: users, error } = await supabaseClient
      .from('users')
      .select('id, username')
      .in('id', userIds);

    if (error) {
      this.logger.warn('Error fetching user names for capper breakdown', { error });
      // Continue without usernames
    }

    const userIdToName = (users || []).reduce((acc, user) => {
      acc[user.id] = user.username || 'Unknown';
      return acc;
    }, {} as Record<string, string>);

    // Calculate metrics for each capper
    Object.keys(userGroups).forEach(userId => {
      const capperPicks = userGroups[userId];
      const capperName = userIdToName[userId] || 'Unknown';

      const statusCounts = this.calculateStatusCounts(capperPicks);
      const winRate = this.calculateWinRate(statusCounts.wins, statusCounts.losses, statusCounts.pushes);
      const avgClvBps = this.calculateAvgCLVBps(capperPicks);

      breakdown[capperName] = {
        total_picks: capperPicks.length,
        win_rate: winRate || 0,
        avg_clv_bps: avgClvBps || 0,
      };
    });

    return breakdown;
  }

  /**
   * Identify top picks (by professional_score)
   */
  private identifyTopPicks(picks: PickWithCLV[]): string[] {
    return picks
      .filter(p => p.professional_score != null)
      .sort((a, b) => (b.professional_score || 0) - (a.professional_score || 0))
      .slice(0, 5)
      .map(p => p.id);
  }

  /**
   * Calculate total units (sum of profit_loss)
   */
  private calculateTotalUnits(picks: PickWithCLV[]): number | null {
    const settledPicks = picks.filter(p => p.profit_loss != null);
    if (settledPicks.length === 0) return null;

    return settledPicks.reduce((sum, pick) => sum + (pick.profit_loss || 0), 0);
  }

  /**
   * Calculate ROI (total_units / total_stake)
   */
  private calculateROI(totalUnits: number | null, picks: PickWithCLV[]): number | null {
    if (totalUnits == null || picks.length === 0) return null;

    const totalStake = picks.reduce((sum, pick) => sum + (pick.stake || 0), 0);
    if (totalStake === 0) return null;

    return totalUnits / totalStake;
  }

  /**
   * Get recap for a specific date
   */
  async getRecap(recapDate: Date): Promise<DailyRecap | null> {
    try {
      const dateStr = recapDate.toISOString().split('T')[0];

      const { data, error } = await supabaseClient
        .from('daily_recaps')
        .select('*')
        .eq('recap_date', dateStr)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        throw error;
      }

      return data as DailyRecap;
    } catch (error) {
      this.logger.error('Error fetching recap', { error, recapDate });
      throw error;
    }
  }

  /**
   * Get yesterday's date in ET timezone
   */
  getYesterdayET(): Date {
    const now = new Date();
    // Approximate ET offset (UTC-5 or UTC-4 depending on DST)
    // For simplicity, using UTC-5
    const etOffset = -5 * 60; // minutes
    const etTime = new Date(now.getTime() + etOffset * 60 * 1000);

    // Get yesterday
    const yesterday = new Date(etTime);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    return yesterday;
  }
}

// Export singleton instance
export const dailyRecapService = DailyRecapService.getInstance();
