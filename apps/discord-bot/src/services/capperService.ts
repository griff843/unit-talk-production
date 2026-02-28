import {
  toISOString,
  toDate,
  getHours,
  getMinutes,
  getFullYear,
  getMonth,
  getDate,
} from '../utils/dateUtils';
import { logger } from '../utils/logger';

import {
  databaseService,
  CappersRow,
  CappersInsert,
  CappersUpdate,
  CapperEvaluationsRow,
  CapperEvaluationsInsert,
} from './database';

export interface CapperStats {
  totalPicks: number;
  wins: number;
  losses: number;
  pushes: number;
  winRate: number;
  totalUnits: number;
  roi: number;
  currentStreak: number | string;
  bestStreak: number | string;
  worstStreak: number | string;
}

export interface CapperWithStats extends CappersRow {
  recentEvaluations?: CapperEvaluationsRow[];
}

export interface PerformanceMetrics {
  queryCount: number;
  averageResponseTime: number;
  errorCount: number;
  lastHealthCheck: string;
  cacheHitRate?: string;
  uptime?: number;
}

export interface ComprehensiveReport {
  capper: CappersRow | null;
  picks: any[];
  analytics: any[];
  stats: CapperStats | null;
  generatedAt: string;
  reportId: string;
}

export class CapperService {
  private performanceMetrics: PerformanceMetrics;
  private cache: Map<string, { data: any; timestamp: number }>;
  private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Initialize performance monitoring
    this.performanceMetrics = {
      queryCount: 0,
      averageResponseTime: 0,
      errorCount: 0,
      lastHealthCheck: toISOString(new Date()),
    };

    // Initialize cache for frequently accessed data
    this.cache = new Map();

    // Start health monitoring
    this.startHealthMonitoring();
  }

  /**
   * Performance monitoring
   */
  private startHealthMonitoring(): void {
    setInterval(
      async () => {
        try {
          const startTime = Date.now();
          await this.testConnection();
          const responseTime = Date.now() - startTime;

          this.performanceMetrics.lastHealthCheck = toISOString(new Date());
          this.performanceMetrics.averageResponseTime =
            (this.performanceMetrics.averageResponseTime + responseTime) / 2;

          // Log performance metrics every 5 minutes
          logger.info('CapperService Health Check', {
            metrics: this.performanceMetrics,
            cacheSize: this.cache.size,
          });
        } catch (error) {
          this.performanceMetrics.errorCount++;
          logger.error('Health check failed', { error });
        }
      },
      5 * 60 * 1000
    ); // Every 5 minutes
  }

  /**
   * Cache management
   */
  private getCacheKey(method: string, params: any): string {
    return `${method}:${JSON.stringify(params)}`;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  private getCache(key: string): any {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  private clearCache(): void {
    this.cache.clear();
    logger.info('Cache cleared');
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const cappers = await databaseService.getActiveCappers();
      logger.info('Capper service connection test successful', { capperCount: cappers.length });
      return true;
    } catch (error) {
      logger.error('Capper service connection test failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get capper by Discord ID
   */
  async getCapperByDiscordId(discordId: string): Promise<CappersRow | null> {
    const cacheKey = this.getCacheKey('getCapperByDiscordId', { discordId });
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      this.performanceMetrics.queryCount++;
      const startTime = Date.now();

      const result = await databaseService.getCapperByDiscordId(discordId);

      const responseTime = Date.now() - startTime;
      this.performanceMetrics.averageResponseTime =
        (this.performanceMetrics.averageResponseTime + responseTime) / 2;

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      this.performanceMetrics.errorCount++;
      logger.error('Error fetching capper by Discord ID', { discordId, error });
      return null;
    }
  }

  /**
   * Create new capper profile
   */
  async createCapperProfile(capperData: {
    discordId: string;
    username: string;
    displayName: string;
    tier?: 'rookie' | 'pro' | 'elite' | 'legend';
  }): Promise<CappersRow | null> {
    try {
      this.performanceMetrics.queryCount++;
      logger.info('Creating capper profile', { discordId: capperData.discordId });

      const capperInsert: CappersInsert = {
        discord_id: capperData.discordId,
        username: capperData.username,
        display_name: capperData.displayName,
        tier: capperData.tier || 'rookie',
        status: 'active',
        total_picks: 0,
        wins: 0,
        losses: 0,
        pushes: 0,
        total_units: 0,
        roi: 0,
        win_rate: 0,
        current_streak: 0,
        best_streak: 0,
        worst_streak: 0,
      };

      const result = await databaseService.createCapper(capperInsert);

      // Clear relevant cache entries
      this.clearCache();

      if (result) {
        logger.info('Capper profile created successfully', { capperId: result.id });
      }

      return result;
    } catch (error) {
      this.performanceMetrics.errorCount++;
      logger.error('Error creating capper profile', { error, capperData });
      return null;
    }
  }

  /**
   * Update capper stats
   */
  async updateCapperStats(
    capperId: string,
    stats: Partial<CapperStats>
  ): Promise<CappersRow | null> {
    try {
      this.performanceMetrics.queryCount++;
      const updates: CappersUpdate = {};

      if (stats.totalPicks !== undefined) updates.total_picks = stats.totalPicks;
      if (stats.wins !== undefined) updates.wins = stats.wins;
      if (stats.losses !== undefined) updates.losses = stats.losses;
      if (stats.pushes !== undefined) updates.pushes = stats.pushes;
      if (stats.winRate !== undefined) updates.win_rate = stats.winRate;
      if (stats.totalUnits !== undefined) updates.total_units = stats.totalUnits;
      if (stats.roi !== undefined) updates.roi = stats.roi;
      if (stats.currentStreak !== undefined) updates.current_streak = stats.currentStreak;
      if (stats.bestStreak !== undefined) updates.best_streak = stats.bestStreak;
      if (stats.worstStreak !== undefined) updates.worst_streak = stats.worstStreak;

      const result = await databaseService.updateCapper(capperId, updates);

      // Clear relevant cache entries
      this.clearCache();

      return result;
    } catch (error) {
      this.performanceMetrics.errorCount++;
      logger.error('Error updating capper stats', { error, capperId, stats });
      return null;
    }
  }

  /**
   * Get all active cappers with their stats
   */
  async getCappersWithStats(): Promise<CapperWithStats[]> {
    const cacheKey = this.getCacheKey('getCappersWithStats', {});
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      this.performanceMetrics.queryCount++;
      const cappers = await databaseService.getActiveCappers();

      // Optionally fetch recent evaluations for each capper
      const cappersWithStats: CapperWithStats[] = [];

      for (const capper of cappers) {
        const recentEvaluations = await databaseService.getCapperEvaluations(capper.id, 10);
        cappersWithStats.push({
          ...capper,
          recentEvaluations,
        });
      }

      this.setCache(cacheKey, cappersWithStats);
      return cappersWithStats;
    } catch (error) {
      this.performanceMetrics.errorCount++;
      logger.error('Error fetching cappers with stats', { error });
      return [];
    }
  }

  /**
   * Get capper statistics
   * CAPPER-OS-INTEGRATION-001: Uses canonical users table + analytics views
   * instead of deprecated cappers table.
   */
  async getCapperStats(capperId: string): Promise<CapperStats | null> {
    const cacheKey = this.getCacheKey('getCapperStats', { capperId });
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      this.performanceMetrics.queryCount++;

      // Verify capper exists in canonical users table
      const capper = await databaseService.client
        .from('users')
        .select('id, username, role, active')
        .eq('id', capperId)
        .eq('role', 'capper')
        .single();

      if (capper.error || !capper.data) {
        return null;
      }

      // Fetch rolling stats from analytics view (10-day window)
      const { data: rollup } = await databaseService.client
        .from('mv_capper_daily_rollup')
        .select('picks, wins, losses, pushes, units_wagered, units_profit, roi')
        .eq('capper_id', capperId);

      // Aggregate totals from daily rollup rows
      let totalPicks = 0,
        wins = 0,
        losses = 0,
        pushes = 0,
        totalUnits = 0,
        roi = 0;
      if (rollup && rollup.length > 0) {
        for (const row of rollup) {
          totalPicks += row.picks || 0;
          wins += row.wins || 0;
          losses += row.losses || 0;
          pushes += row.pushes || 0;
          totalUnits += Number(row.units_profit) || 0;
        }
        const wagered = rollup.reduce((s, r) => s + (Number(r.units_wagered) || 0), 0);
        roi = wagered > 0 ? Number(((totalUnits / wagered) * 100).toFixed(2)) : 0;
      }

      // Fetch streak from analytics view
      const { data: streak } = await databaseService.client
        .from('v_capper_streaks')
        .select('current_streak_type, current_streak_len')
        .eq('capper_id', capperId)
        .limit(1)
        .maybeSingle();

      const currentStreak = streak
        ? `${streak.current_streak_len}${streak.current_streak_type?.[0]?.toUpperCase() || ''}`
        : '0';

      const stats: CapperStats = {
        totalPicks,
        wins,
        losses,
        pushes,
        winRate: totalPicks > 0 ? Number(((wins / totalPicks) * 100).toFixed(1)) : 0,
        totalUnits,
        roi,
        currentStreak,
        bestStreak: currentStreak,
        worstStreak: '0',
      };

      this.setCache(cacheKey, stats);
      return stats;
    } catch (error) {
      this.performanceMetrics.errorCount++;
      logger.error('Error fetching capper stats', { error, capperId });
      return null;
    }
  }

  /**
   * Check if user has capper permissions
   */
  async hasCapperPermissions(discordId: string): Promise<boolean> {
    const cacheKey = this.getCacheKey('hasCapperPermissions', { discordId });
    const cached = this.getCache(cacheKey);
    if (cached !== null) return cached;

    try {
      this.performanceMetrics.queryCount++;
      const result = await databaseService.hasCapperPermissions(discordId);
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      this.performanceMetrics.errorCount++;
      logger.error('Error checking capper permissions', { error, discordId });
      return false;
    }
  }

  /**
   * Create capper evaluation
   */
  async createEvaluation(
    evaluation: CapperEvaluationsInsert
  ): Promise<CapperEvaluationsRow | null> {
    try {
      this.performanceMetrics.queryCount++;
      const result = await databaseService.createCapperEvaluation(evaluation);

      // Clear relevant cache entries
      this.clearCache();

      return result;
    } catch (error) {
      this.performanceMetrics.errorCount++;
      logger.error('Error creating evaluation', { error, evaluation });
      return null;
    }
  }

  /**
   * Get capper evaluations
   */
  async getCapperEvaluations(
    capperId: string,
    limit: number = 50
  ): Promise<CapperEvaluationsRow[]> {
    const cacheKey = this.getCacheKey('getCapperEvaluations', { capperId, limit });
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      this.performanceMetrics.queryCount++;
      const result = await databaseService.getCapperEvaluations(capperId, limit);
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      this.performanceMetrics.errorCount++;
      logger.error('Error fetching capper evaluations', { error, capperId, limit });
      return [];
    }
  }

  /**
   * Get capper picks for a specific date and status - PRODUCTION IMPLEMENTATION
   */
  async getCapperPicks(capperId: string, date?: string, status?: string): Promise<any[]> {
    const cacheKey = this.getCacheKey('getCapperPicks', { capperId, date, status });
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      this.performanceMetrics.queryCount++;
      logger.info('Getting capper picks', { capperId, date, status });

      // Build query for picks table
      let query = databaseService.client
        .from('picks')
        .select('*')
        .eq('capper_id', capperId)
        .order('created_at', { ascending: false });

      // Add date filter if provided
      if (date) {
        query = query
          .gte('created_at', `${date}T00:00:00.000Z`)
          .lt('created_at', `${date}T23:59:59.999Z`);
      }

      // Add status filter if provided
      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const result = data || [];
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      this.performanceMetrics.errorCount++;
      logger.error('Error getting capper picks:', { error, capperId, date, status });
      return [];
    }
  }

  /**
   * Create a daily pick - PRODUCTION IMPLEMENTATION
   */
  async createDailyPick(pickData: any): Promise<any | null> {
    try {
      this.performanceMetrics.queryCount++;
      logger.info('Creating daily pick', { pickData });

      // Validate required fields
      if (!pickData.capper_id || !pickData.game || !pickData.pick_type) {
        throw new Error('Missing required fields: capper_id, game, pick_type');
      }

      // Enhance pick data with defaults
      const enhancedPickData = {
        ...pickData,
        status: pickData.status || 'pending',
        created_at: toISOString(new Date()),
        updated_at: toISOString(new Date()),
        confidence: pickData.confidence || 'medium',
        units: pickData.units || 1,
      };

      // Insert into picks table
      const { data, error } = await databaseService.client
        .from('picks')
        .insert(enhancedPickData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Clear relevant cache entries
      this.clearCache();

      logger.info('Daily pick created successfully', { pickId: data.id });
      return data;
    } catch (error) {
      this.performanceMetrics.errorCount++;
      logger.error('Error creating daily pick:', { error, pickData });
      return null;
    }
  }

  /**
   * Get picks for a specific date and status - PRODUCTION IMPLEMENTATION
   */
  async getPicksForDate(date: string, status?: string): Promise<any[]> {
    const cacheKey = this.getCacheKey('getPicksForDate', { date, status });
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      this.performanceMetrics.queryCount++;
      logger.info('Getting picks for date', { date, status });

      let query = databaseService.client
        .from('picks')
        .select('*')
        .gte('created_at', `${date}T00:00:00.000Z`)
        .lt('created_at', `${date}T23:59:59.999Z`)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const result = data || [];
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      this.performanceMetrics.errorCount++;
      logger.error('Error getting picks for date:', { error, date, status });
      return [];
    }
  }

  /**
   * Fortune 100 Production Features
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    return {
      ...this.performanceMetrics,
      cacheHitRate:
        this.cache.size > 0
          ? (this.performanceMetrics.queryCount / this.cache.size).toFixed(2)
          : '0',
      uptime:
        Date.now() -
        (this.performanceMetrics.lastHealthCheck
          ? new Date(this.performanceMetrics.lastHealthCheck).getTime()
          : Date.now()),
    };
  }

  async bulkUpdateCapperStats(): Promise<boolean> {
    logger.info('Starting bulk capper stats update');
    try {
      const cappers = await this.getCappersWithStats();
      const updatePromises = cappers.map(async capper => {
        const stats = await this.getCapperStats(capper.id);
        if (stats) {
          return this.updateCapperStats(capper.id, stats);
        }
        return null;
      });

      await Promise.all(updatePromises);
      logger.info('Bulk capper stats update completed', { count: cappers.length });
      return true;
    } catch (error) {
      this.performanceMetrics.errorCount++;
      logger.error('Bulk capper stats update failed', { error });
      return false;
    }
  }

  async generateComprehensiveReport(
    capperId: string,
    dateRange?: any
  ): Promise<ComprehensiveReport | null> {
    logger.info('Generating comprehensive report', { capperId, dateRange });
    try {
      const [capper, picks, stats] = await Promise.all([
        this.getCapperByDiscordId(capperId),
        this.getCapperPicks(capperId),
        this.getCapperStats(capperId),
      ]);

      // Mock analytics data - in production this would come from analytics service
      const analytics = [
        { event_type: 'pick_created', timestamp: toISOString(new Date()) },
        { event_type: 'pick_viewed', timestamp: toISOString(new Date()) },
      ];

      return {
        capper,
        picks,
        analytics,
        stats,
        generatedAt: toISOString(new Date()),
        reportId: `report_${capperId}_${Date.now()}`,
      };
    } catch (error) {
      this.performanceMetrics.errorCount++;
      logger.error('Error generating comprehensive report', { error, capperId });
      return null;
    }
  }

  /**
   * Additional production methods for missing functionality
   */
  async submitPick(pickData: any): Promise<any | null> {
    return this.createDailyPick(pickData);
  }

  async updatePick(pickId: string, updates: any): Promise<any | null> {
    try {
      this.performanceMetrics.queryCount++;
      const { data, error } = await databaseService.client
        .from('picks')
        .update({
          ...updates,
          updated_at: toISOString(new Date()),
        })
        .eq('id', pickId)
        .select()
        .single();

      if (error) throw error;

      // Clear relevant cache entries
      this.clearCache();

      return data;
    } catch (error) {
      this.performanceMetrics.errorCount++;
      logger.error('Error updating pick', { error, pickId, updates });
      return null;
    }
  }

  async deletePick(pickId: string): Promise<boolean> {
    try {
      this.performanceMetrics.queryCount++;
      const { error } = await databaseService.client.from('picks').delete().eq('id', pickId);

      if (error) throw error;

      // Clear relevant cache entries
      this.clearCache();

      logger.info('Pick deleted successfully', { pickId });
      return true;
    } catch (error) {
      this.performanceMetrics.errorCount++;
      logger.error('Error deleting pick', { error, pickId });
      return false;
    }
  }

  async finalizePicks(pickIds: string[]): Promise<boolean> {
    try {
      this.performanceMetrics.queryCount++;
      const { error } = await databaseService.client
        .from('picks')
        .update({
          status: 'published',
          updated_at: toISOString(new Date()),
        })
        .in('id', pickIds);

      if (error) throw error;

      // Clear relevant cache entries
      this.clearCache();

      logger.info('Picks finalized successfully', { count: pickIds.length });
      return true;
    } catch (error) {
      this.performanceMetrics.errorCount++;
      logger.error('Error finalizing picks', { error, pickIds });
      return false;
    }
  }
}

// Export singleton instance
export const capperService = new CapperService();
