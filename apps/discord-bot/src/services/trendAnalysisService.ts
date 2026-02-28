import { logger } from '../utils/logger';

import { SupabaseService } from './supabase';

interface TrendAnalysis {
  sport: string;
  timePeriod: string;
  winRate: number;
  roi: number;
  unitsPerPlay: number;
  favoritePickType: string;
  bestSport: string;
  worstSport: string;
}

export class TrendAnalysisService {
  private supabaseService: SupabaseService;
  private analysisInterval: NodeJS.Timeout | null = null;

  constructor(supabaseService: SupabaseService) {
    this.supabaseService = supabaseService;
  }

  public startAnalysis(): void {
    // Run analysis every 6 hours
    this.analysisInterval = setInterval(
      () => {
        this.analyzeAllUserTrends().catch(error => {
          logger.error('Error in trend analysis:', error);
        });
      },
      6 * 60 * 60 * 1000
    );

    // Run initial analysis
    this.analyzeAllUserTrends().catch(error => {
      logger.error('Error in initial trend analysis:', error);
    });
  }

  public stopAnalysis(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
  }

  private async analyzeAllUserTrends(): Promise<void> {
    try {
      // Get all VIP+ users
      const { data: users, error } = await this.supabaseService.client
        .from('user_profiles')
        .select('discord_id')
        .in('membership_tier', ['vip_plus', 'black_label', 'admin', 'owner']);

      if (error) throw error;

      // Analyze trends for each user
      for (const user of users) {
        await this.analyzeUserTrends(user.discord_id);
      }

      logger.info(`Completed trend analysis for ${users.length} users`);
    } catch (error) {
      logger.error('Error analyzing trends:', error);
    }
  }

  private async analyzeUserTrends(userId: string): Promise<void> {
    try {
      // Get user's picks for different time periods
      const periods = ['24h', '7d', '30d', 'all'];

      for (const period of periods) {
        const picks = await this.getPicksForPeriod(userId, period);
        if (!picks || picks.length === 0) continue;

        const analysis = this.calculateTrends(picks);
        await this.saveTrendAnalysis(userId, period, analysis);
      }
    } catch (error) {
      logger.error(`Error analyzing trends for user ${userId}:`, error);
    }
  }

  private async getPicksForPeriod(userId: string, period: string): Promise<any[]> {
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case '24h':
        startDate.setHours(new Date(startDate).getHours() - 24);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case 'all':
        startDate = new Date(0); // Beginning of time
        break;
    }

    const { data: picks, error } = await this.supabaseService.client
      .from('picks')
      .select('*')
      .eq('user_id', userId)
      .gte(
        'created_at',
        typeof startDate === 'string' ? startDate : new Date(startDate).toISOString()
      )
      .lte('created_at', typeof now === 'string' ? now : new Date(now).toISOString());

    if (error) throw error;
    return picks || [];
  }

  private calculateTrends(picks: any[]): TrendAnalysis {
    // Calculate basic stats
    const totalPicks = picks.length;
    const wonPicks = picks.filter(p => p.status === 'won').length;
    const winRate = (wonPicks / totalPicks) * 100;

    // Calculate ROI
    const totalUnits = picks.reduce((sum, p) => sum + p.units, 0);
    const profitLoss = picks.reduce((sum, p) => sum + (p.profit_loss || 0), 0);
    const roi = (profitLoss / totalUnits) * 100;

    // Calculate average units per play
    const unitsPerPlay = totalUnits / totalPicks;

    // Find favorite pick type
    const pickTypes = picks.reduce((acc: any, p: any) => {
      acc[p.pick_type] = (acc[p.pick_type] || 0) + 1;
      return acc;
    }, {});
    const favoritePickType = Object.entries(pickTypes).sort((a: any, b: any) => b[1] - a[1])[0][0];

    // Find best and worst sports
    const sportStats = picks.reduce((acc: any, p: any) => {
      if (!acc[p.sport]) {
        acc[p.sport] = { total: 0, won: 0 };
      }
      acc[p.sport].total++;
      if (p.status === 'won') acc[p.sport].won++;
      return acc;
    }, {});

    const sportWinRates = Object.entries(sportStats).map(([sport, stats]: [string, any]) => ({
      sport,
      winRate: (stats.won / stats.total) * 100,
    }));

    const bestSport = sportWinRates.sort((a, b) => b.winRate - a.winRate)[0]?.sport || 'N/A';
    const worstSport = sportWinRates.sort((a, b) => a.winRate - b.winRate)[0]?.sport || 'N/A';

    return {
      sport: picks[0]?.sport || 'N/A',
      timePeriod: 'custom',
      winRate,
      roi,
      unitsPerPlay,
      favoritePickType,
      bestSport,
      worstSport,
    };
  }

  private async saveTrendAnalysis(
    userId: string,
    period: string,
    analysis: TrendAnalysis
  ): Promise<void> {
    try {
      const { error } = await this.supabaseService.client.from('pick_trends').upsert({
        user_id: userId,
        time_period: period,
        ...analysis,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;
      logger.info(`Saved trend analysis for user ${userId} (${period})`);
    } catch (error) {
      logger.error(`Error saving trend analysis for user ${userId}:`, error);
    }
  }
}
