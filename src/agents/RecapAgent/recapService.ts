import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  FinalPick, 
  RecapSummary, 
  CapperStats, 
  TierStats, 
  HotStreak,
  ParlayGroup,
  MicroRecapData,
  RoiWatcherState,
  RecapConfig,
  RecapError
} from '../../types/picks';

/**
 * Enhanced RecapService with production-ready features
 * Handles data querying, processing, and real-time ROI monitoring
 */
export class RecapService {
  private supabase: SupabaseClient;
  private config: RecapConfig;
  private roiWatcherState: RoiWatcherState;
  private lastMicroRecapSent: Date | null = null;

  constructor(config?: Partial<RecapConfig>) {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );

    this.config = {
      legendFooter: process.env.LEGEND_FOOTER === 'true',
      microRecap: process.env.MICRO_RECAP === 'true',
      notionSync: process.env.NOTION_SYNC === 'true',
      clvDelta: process.env.CLV_DELTA === 'true',
      streakSparkline: process.env.STREAK_SPARKLINE === 'true',
      roiThreshold: parseFloat(process.env.ROI_THRESHOLD || '5.0'),
      microRecapCooldown: parseInt(process.env.MICRO_RECAP_COOLDOWN || '60'),
      slashCommands: process.env.SLASH_COMMANDS === 'true',
      metricsEnabled: process.env.METRICS_ENABLED !== 'false',
      metricsPort: parseInt(process.env.METRICS_PORT || '3001'),
      ...config
    };

    this.roiWatcherState = {
      currentDailyRoi: 0,
      lastRoiCheck: new Date().toISOString(),
      lastMicroRecapSent: '',
      picksProcessedToday: 0,
      thresholdBreached: false
    };
  }

  /**
   * Initialize the service and set up real-time monitoring
   */
  async initialize(): Promise<void> {
    try {
      await this.testConnection();
      
      if (this.config.microRecap) {
        await this.initializeRoiWatcher();
      }
      
      console.log('RecapService initialized successfully');
    } catch (error) {
      throw new RecapError({
        code: 'INIT_FAILED',
        message: `Failed to initialize RecapService: ${error}`,
        timestamp: new Date().toISOString(),
        severity: 'high'
      });
    }
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<void> {
    const { error } = await this.supabase
      .from('final_picks')
      .select('id')
      .limit(1);
    
    if (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  /**
   * Get daily recap data with enhanced analytics
   */
  async getDailyRecapData(date: string): Promise<RecapSummary | null> {
    try {
      const startTime = Date.now();
      
      // Query picks for the specific date
      const { data: picks, error } = await this.supabase
        .from('final_picks')
        .select('*')
        .gte('created_at', `${date}T00:00:00Z`)
        .lt('created_at', `${date}T23:59:59Z`)
        .in('play_status', ['settled', 'graded'])
        .not('outcome', 'is', null);

      if (error) throw error;
      if (!picks || picks.length === 0) return null;

      const summary = await this.processRecapData(picks, 'daily', date);
      summary.metadata = {
        generatedAt: new Date().toISOString(),
        processingTimeMs: Date.now() - startTime,
        dataSource: 'supabase',
        version: '3.0.0',
        features: {
          legendFooter: this.config.legendFooter,
          microRecap: this.config.microRecap,
          clvDelta: this.config.clvDelta,
          streakSparkline: this.config.streakSparkline,
          notionSync: this.config.notionSync
        }
      };

      return summary;
    } catch (error) {
      throw new RecapError({
        code: 'DAILY_RECAP_FAILED',
        message: `Failed to get daily recap data: ${error}`,
        timestamp: new Date().toISOString(),
        context: { date },
        severity: 'high'
      });
    }
  }

  /**
   * Get weekly recap data
   */
  async getWeeklyRecapData(startDate: string, endDate: string): Promise<RecapSummary | null> {
    try {
      const { data: picks, error } = await this.supabase
        .from('final_picks')
        .select('*')
        .gte('created_at', `${startDate}T00:00:00Z`)
        .lte('created_at', `${endDate}T23:59:59Z`)
        .in('play_status', ['settled', 'graded'])
        .not('outcome', 'is', null);

      if (error) throw error;
      if (!picks || picks.length === 0) return null;

      return await this.processRecapData(picks, 'weekly', startDate, endDate);
    } catch (error) {
      throw new RecapError({
        code: 'WEEKLY_RECAP_FAILED',
        message: `Failed to get weekly recap data: ${error}`,
        timestamp: new Date().toISOString(),
        context: { startDate, endDate },
        severity: 'high'
      });
    }
  }

  /**
   * Get monthly recap data
   */
  async getMonthlyRecapData(startDate: string, endDate: string): Promise<RecapSummary | null> {
    try {
      const { data: picks, error } = await this.supabase
        .from('final_picks')
        .select('*')
        .gte('created_at', `${startDate}T00:00:00Z`)
        .lte('created_at', `${endDate}T23:59:59Z`)
        .in('play_status', ['settled', 'graded'])
        .not('outcome', 'is', null);

      if (error) throw error;
      if (!picks || picks.length === 0) return null;

      return await this.processRecapData(picks, 'monthly', startDate, endDate);
    } catch (error) {
      throw new RecapError({
        code: 'MONTHLY_RECAP_FAILED',
        message: `Failed to get monthly recap data: ${error}`,
        timestamp: new Date().toISOString(),
        context: { startDate, endDate },
        severity: 'high'
      });
    }
  }

  /**
   * Process raw pick data into structured recap summary
   */
  private async processRecapData(
    rawPicks: any[], 
    period: 'daily' | 'weekly' | 'monthly', 
    startDate: string, 
    endDate?: string
  ): Promise<RecapSummary> {
    const picks: FinalPick[] = rawPicks.map(this.mapRawPickToFinalPick);
    
    // Calculate basic stats
    const wins = picks.filter(p => p.outcome === 'win').length;
    const losses = picks.filter(p => p.outcome === 'loss').length;
    const pushes = picks.filter(p => p.outcome === 'push').length;
    const totalPicks = picks.length;
    const winRate = totalPicks > 0 ? (wins / (wins + losses)) * 100 : 0;
    
    // Calculate units and ROI
    const totalUnits = picks.reduce((sum, pick) => sum + (pick.units || 1), 0);
    const netUnits = picks.reduce((sum, pick) => sum + (pick.profit_loss || 0), 0);
    const roi = totalUnits > 0 ? (netUnits / totalUnits) * 100 : 0;
    
    // Calculate average edge and CLV
    const avgEdge = this.calculateAverageEdge(picks);
    const avgClvDelta = this.config.clvDelta ? this.calculateAverageClv(picks) : undefined;
    
    // Generate breakdowns
    const capperBreakdown = await this.calculateCapperStats(picks);
    const tierBreakdown = this.calculateTierStats(picks);
    const hotStreaks = this.calculateHotStreaks(picks, capperBreakdown);
    
    // Find best/worst picks
    const bestPick = this.findBestPick(picks);
    const worstPick = this.findWorstPick(picks);
    const biggestWin = this.findBiggestWin(picks);
    const badBeat = this.findBadBeat(picks);

    return {
      date: startDate,
      period,
      totalPicks,
      wins,
      losses,
      pushes,
      winRate,
      totalUnits,
      netUnits,
      roi,
      avgEdge,
      avgClvDelta,
      capperBreakdown,
      tierBreakdown,
      hotStreaks,
      bestPick,
      worstPick,
      biggestWin,
      badBeat
    };
  }

  /**
   * Calculate enhanced capper statistics with sparklines
   */
  private async calculateCapperStats(picks: FinalPick[]): Promise<CapperStats[]> {
    const capperMap = new Map<string, FinalPick[]>();
    
    // Group picks by capper
    picks.forEach(pick => {
      const capper = this.extractCapper(pick.tags || []) || 'Unknown';
      if (!capperMap.has(capper)) {
        capperMap.set(capper, []);
      }
      capperMap.get(capper)!.push(pick);
    });

    const capperStats: CapperStats[] = [];
    
    for (const [capper, capperPicks] of Array.from(capperMap.entries())) {
      const wins = capperPicks.filter(p => p.outcome === 'win').length;
      const losses = capperPicks.filter(p => p.outcome === 'loss').length;
      const pushes = capperPicks.filter(p => p.outcome === 'push').length;
      const totalUnits = capperPicks.reduce((sum, pick) => sum + (pick.units || 1), 0);
      const netUnits = capperPicks.reduce((sum, pick) => sum + (pick.profit_loss || 0), 0);
      const winRate = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0;
      const roi = totalUnits > 0 ? (netUnits / totalUnits) * 100 : 0;
      const avgEdge = this.calculateAverageEdge(capperPicks);
      const avgClvDelta = this.config.clvDelta ? this.calculateAverageClv(capperPicks) : undefined;
      
      // Calculate current streak
      const streak = this.calculateCurrentStreak(capperPicks);
      
      // Generate sparkline if enabled
      const streakSparkline = this.config.streakSparkline ? 
        this.generateStreakSparkline(capperPicks) : undefined;

      capperStats.push({
        capper,
        picks: capperPicks.length,
        wins,
        losses,
        pushes,
        winRate,
        totalUnits,
        netUnits,
        roi,
        avgEdge,
        avgClvDelta,
        currentStreak: streak.length,
        streakType: streak.type,
        streakSparkline,
        bestPick: this.findBestPick(capperPicks),
        worstPick: this.findWorstPick(capperPicks)
      });
    }

    return capperStats.sort((a, b) => b.netUnits - a.netUnits);
  }

  /**
   * Calculate tier statistics
   */
  private calculateTierStats(picks: FinalPick[]): TierStats[] {
    const tierMap = new Map<string, FinalPick[]>();
    
    picks.forEach(pick => {
      const tier = pick.tier || 'Unknown';
      if (!tierMap.has(tier)) {
        tierMap.set(tier, []);
      }
      tierMap.get(tier)!.push(pick);
    });

    const tierStats: TierStats[] = [];
    
    for (const [tier, tierPicks] of Array.from(tierMap.entries())) {
      const wins = tierPicks.filter(p => p.outcome === 'win').length;
      const losses = tierPicks.filter(p => p.outcome === 'loss').length;
      const pushes = tierPicks.filter(p => p.outcome === 'push').length;
      const totalUnits = tierPicks.reduce((sum, pick) => sum + (pick.units || 1), 0);
      const netUnits = tierPicks.reduce((sum, pick) => sum + (pick.profit_loss || 0), 0);
      const winRate = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0;
      const roi = totalUnits > 0 ? (netUnits / totalUnits) * 100 : 0;
      const avgEdge = this.calculateAverageEdge(tierPicks);

      tierStats.push({
        tier,
        picks: tierPicks.length,
        wins,
        losses,
        pushes,
        winRate,
        totalUnits,
        netUnits,
        roi,
        avgEdge
      });
    }

    return tierStats.sort((a, b) => b.netUnits - a.netUnits);
  }

  /**
   * Calculate hot streaks
   */
  private calculateHotStreaks(picks: FinalPick[], capperStats: CapperStats[]): HotStreak[] {
    const hotStreaks: HotStreak[] = [];
    
    capperStats.forEach(capper => {
      if (capper.currentStreak >= 3 && capper.streakType === 'win') {
        const capperPicks = picks.filter(p => 
          this.extractCapper(p.tags || []) === capper.capper
        );
        
        const streakPicks = this.getStreakPicks(capperPicks, 'win');
        
        hotStreaks.push({
          capper: capper.capper,
          streakLength: capper.currentStreak,
          streakType: 'win',
          totalUnits: streakPicks.reduce((sum, pick) => sum + (pick.profit_loss || 0), 0),
          startDate: streakPicks[streakPicks.length - 1]?.created_at || '',
          endDate: streakPicks[0]?.created_at || '',
          picks: streakPicks
        });
      }
    });

    return hotStreaks.sort((a, b) => b.streakLength - a.streakLength);
  }

  /**
   * Get parlay groups for a date range
   */
  async getParlayGroups(startDate: string, endDate?: string): Promise<ParlayGroup[]> {
    try {
      const endDateStr = endDate || startDate;
      
      const { data: picks, error } = await this.supabase
        .from('final_picks')
        .select('*')
        .gte('created_at', `${startDate}T00:00:00Z`)
        .lte('created_at', `${endDateStr}T23:59:59Z`)
        .not('parlay_id', 'is', null)
        .in('play_status', ['settled', 'graded']);

      if (error) throw error;
      if (!picks || picks.length === 0) return [];

      // Group by parlay_id
      const parlayMap = new Map<string, FinalPick[]>();
      picks.forEach(pick => {
        const parlayId = pick.parlay_id!;
        if (!parlayMap.has(parlayId)) {
          parlayMap.set(parlayId, []);
        }
        parlayMap.get(parlayId)!.push(this.mapRawPickToFinalPick(pick));
      });

      const parlayGroups: ParlayGroup[] = [];
      
      for (const [parlayId, parlayPicks] of Array.from(parlayMap.entries())) {
        const totalOdds = this.calculateParlayOdds(parlayPicks);
        const units = parlayPicks[0]?.units || 1;
        const outcome = this.determineParlayOutcome(parlayPicks);
        const profit_loss = this.calculateParlayProfitLoss(parlayPicks, outcome, units, totalOdds);
        const capper = this.extractCapper(parlayPicks[0]?.tags || []);

        parlayGroups.push({
          parlay_id: parlayId,
          picks: parlayPicks,
          totalOdds,
          units,
          outcome,
          profit_loss,
          capper,
          created_at: parlayPicks[0]?.created_at,
          settled_at: parlayPicks[0]?.settled_at
        });
      }

      return parlayGroups;
    } catch (error) {
      throw new RecapError({
        code: 'PARLAY_GROUPS_FAILED',
        message: `Failed to get parlay groups: ${error}`,
        timestamp: new Date().toISOString(),
        context: { startDate, endDate },
        severity: 'medium'
      });
    }
  }

  /**
   * Real-time ROI monitoring for micro-recaps
   */
  async checkRoiThreshold(): Promise<MicroRecapData | null> {
    if (!this.config.microRecap) return null;
    
    try {
      // Check cooldown
      if (this.lastMicroRecapSent) {
        const cooldownMs = this.config.microRecapCooldown * 60 * 1000;
        if (Date.now() - this.lastMicroRecapSent.getTime() < cooldownMs) {
          return null;
        }
      }

      const today = new Date().toISOString().split('T')[0];
      const dailyData = await this.getDailyRecapData(today);
      
      if (!dailyData) return null;

      const roiChange = Math.abs(dailyData.roi - this.roiWatcherState.currentDailyRoi);
      
      if (roiChange >= this.config.roiThreshold) {
        this.lastMicroRecapSent = new Date();
        
        return {
          trigger: 'roi_threshold',
          dailyRoi: dailyData.roi,
          roiChange,
          winLoss: `${dailyData.wins}W-${dailyData.losses}L`,
          unitBreakdown: {
            solo: dailyData.totalUnits - (dailyData.tierBreakdown.find(t => t.tier.includes('Parlay'))?.totalUnits || 0),
            parlay: dailyData.tierBreakdown.find(t => t.tier.includes('Parlay'))?.totalUnits || 0,
            total: dailyData.totalUnits
          },
          topCapper: {
            name: dailyData.capperBreakdown[0]?.capper || 'Unknown',
            netUnits: dailyData.capperBreakdown[0]?.netUnits || 0,
            winRate: dailyData.capperBreakdown[0]?.winRate || 0
          },
          timestamp: new Date().toISOString()
        };
      }

      this.roiWatcherState.currentDailyRoi = dailyData.roi;
      return null;
    } catch (error) {
      console.error('ROI threshold check failed:', error);
      return null;
    }
  }

  /**
   * Check if last pick of day was graded
   */
  async checkLastPickGraded(): Promise<MicroRecapData | null> {
    if (!this.config.microRecap) return null;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get all picks for today
      const { data: picks, error } = await this.supabase
        .from('final_picks')
        .select('*')
        .gte('created_at', `${today}T00:00:00Z`)
        .lt('created_at', `${today}T23:59:59Z`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!picks || picks.length === 0) return null;

      // Check if all picks are graded
      const pendingPicks = picks.filter(p => p.play_status === 'pending' || !p.outcome);
      
      if (pendingPicks.length === 0) {
        // All picks graded, trigger micro-recap
        const dailyData = await this.getDailyRecapData(today);
        if (!dailyData) return null;

        return {
          trigger: 'last_pick_graded',
          dailyRoi: dailyData.roi,
          roiChange: 0,
          winLoss: `${dailyData.wins}W-${dailyData.losses}L`,
          unitBreakdown: {
            solo: dailyData.totalUnits - (dailyData.tierBreakdown.find(t => t.tier.includes('Parlay'))?.totalUnits || 0),
            parlay: dailyData.tierBreakdown.find(t => t.tier.includes('Parlay'))?.totalUnits || 0,
            total: dailyData.totalUnits
          },
          topCapper: {
            name: dailyData.capperBreakdown[0]?.capper || 'Unknown',
            netUnits: dailyData.capperBreakdown[0]?.netUnits || 0,
            winRate: dailyData.capperBreakdown[0]?.winRate || 0
          },
          timestamp: new Date().toISOString()
        };
      }

      return null;
    } catch (error) {
      console.error('Last pick check failed:', error);
      return null;
    }
  }

  /**
   * Initialize ROI watcher state
   */
  private async initializeRoiWatcher(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const dailyData = await this.getDailyRecapData(today);
    
    if (dailyData) {
      this.roiWatcherState.currentDailyRoi = dailyData.roi;
      this.roiWatcherState.picksProcessedToday = dailyData.totalPicks;
    }
  }

  // Helper methods
  private mapRawPickToFinalPick(raw: any): FinalPick {
    return {
      id: raw.id,
      player_name: raw.player_name,
      team_name: raw.team_name,
      market_type: raw.market_type,
      line: raw.line,
      odds: raw.odds,
      tier: raw.tier,
      edge_score: raw.edge_score,
      is_sharp_fade: raw.is_sharp_fade,
      tags: raw.tags,
      created_at: raw.created_at,
      updated_at: raw.updated_at,
      play_status: raw.play_status,
      outcome: raw.outcome,
      units: raw.units || this.calculateUnits(raw.tier, raw.edge_score),
      profit_loss: raw.profit_loss,
      capper: raw.capper || this.extractCapper(raw.tags || []),
      matchup: raw.matchup || this.buildMatchup(raw),
      parlay_id: raw.parlay_id,
      closing_line: raw.closing_line,
      closing_odds: raw.closing_odds,
      settled_at: raw.settled_at,
      opening_line: raw.opening_line,
      opening_odds: raw.opening_odds,
      clv_delta: raw.clv_delta,
      grade_timestamp: raw.grade_timestamp,
      sport: raw.sport,
      league: raw.league
    };
  }

  private extractCapper(tags: string[]): string {
    const capperTag = tags.find(tag => 
      ['griff', 'ace', 'maya', 'unit talk'].some(capper => 
        tag.toLowerCase().includes(capper)
      )
    );
    
    if (capperTag) {
      if (capperTag.toLowerCase().includes('griff')) return 'Griff';
      if (capperTag.toLowerCase().includes('ace')) return 'Ace';
      if (capperTag.toLowerCase().includes('maya')) return 'Maya';
      if (capperTag.toLowerCase().includes('unit talk')) return 'Unit Talk';
    }
    
    return 'Unit Talk';
  }

  private calculateUnits(tier?: string, edgeScore?: number): number {
    if (tier === 'S') return 2;
    if (tier === 'A+') return 1.5;
    if (tier === 'A') return 1;
    if (edgeScore && edgeScore > 20) return 1.5;
    return 1;
  }

  private buildMatchup(pick: any): string {
    if (pick.matchup) return pick.matchup;
    if (pick.team_name) return pick.team_name;
    if (pick.player_name) return pick.player_name;
    return 'Unknown';
  }

  private calculateAverageEdge(picks: FinalPick[]): number {
    const validPicks = picks.filter(p => typeof p.edge_score === 'number');
    if (validPicks.length === 0) return 0;
    
    const totalEdge = validPicks.reduce((sum, pick) => sum + (pick.edge_score || 0), 0);
    return totalEdge / validPicks.length;
  }

  private calculateAverageClv(picks: FinalPick[]): number {
    const validPicks = picks.filter(p => typeof p.clv_delta === 'number');
    if (validPicks.length === 0) return 0;
    
    const totalClv = validPicks.reduce((sum, pick) => sum + (pick.clv_delta || 0), 0);
    return totalClv / validPicks.length;
  }

  private calculateCurrentStreak(picks: FinalPick[]): { type: 'win' | 'loss' | 'none'; length: number } {
    if (picks.length === 0) return { type: 'none', length: 0 };
    
    const sortedPicks = picks
      .filter(p => p.outcome && p.outcome !== 'push' && p.outcome !== 'pending')
      .sort((a, b) => new Date(b.settled_at || b.created_at || '').getTime() - 
                     new Date(a.settled_at || a.created_at || '').getTime());
    
    if (sortedPicks.length === 0) return { type: 'none', length: 0 };
    
    const latestOutcome = sortedPicks[0].outcome;
    let streakLength = 1;
    
    for (let i = 1; i < sortedPicks.length; i++) {
      if (sortedPicks[i].outcome === latestOutcome) {
        streakLength++;
      } else {
        break;
      }
    }
    
    return {
      type: latestOutcome === 'win' ? 'win' : 'loss',
      length: streakLength
    };
  }

  private getStreakPicks(picks: FinalPick[], streakType: 'win' | 'loss'): FinalPick[] {
    const sortedPicks = picks
      .filter(p => p.outcome === streakType)
      .sort((a, b) => new Date(b.settled_at || b.created_at || '').getTime() - 
                     new Date(a.settled_at || a.created_at || '').getTime());
    
    const streakPicks: FinalPick[] = [];
    for (const pick of sortedPicks) {
      if (pick.outcome === streakType) {
        streakPicks.push(pick);
      } else {
        break;
      }
    }
    
    return streakPicks;
  }

  private generateStreakSparkline(picks: FinalPick[]): string {
    const recentPicks = picks
      .filter(p => p.outcome && p.outcome !== 'push')
      .sort((a, b) => new Date(a.settled_at || a.created_at || '').getTime() - 
                     new Date(b.settled_at || b.created_at || '').getTime())
      .slice(-10); // Last 10 picks
    
    return recentPicks.map(pick => {
      switch (pick.outcome) {
        case 'win': return '▲';
        case 'loss': return '▼';
        default: return '●';
      }
    }).join('');
  }

  private findBestPick(picks: FinalPick[]): FinalPick | undefined {
    return picks
      .filter(p => p.outcome === 'win')
      .sort((a, b) => (b.profit_loss || 0) - (a.profit_loss || 0))[0];
  }

  private findWorstPick(picks: FinalPick[]): FinalPick | undefined {
    return picks
      .filter(p => p.outcome === 'loss')
      .sort((a, b) => (a.profit_loss || 0) - (b.profit_loss || 0))[0];
  }

  private findBiggestWin(picks: FinalPick[]): FinalPick | undefined {
    return picks
      .filter(p => p.outcome === 'win')
      .sort((a, b) => (b.profit_loss || 0) - (a.profit_loss || 0))[0];
  }

  private findBadBeat(picks: FinalPick[]): FinalPick | undefined {
    // Find high edge loss
    return picks
      .filter(p => p.outcome === 'loss' && (p.edge_score || 0) > 15)
      .sort((a, b) => (b.edge_score || 0) - (a.edge_score || 0))[0];
  }

  private calculateParlayOdds(picks: FinalPick[]): number {
    return picks.reduce((totalOdds, pick) => {
      const decimalOdds = pick.odds > 0 ? (pick.odds / 100) + 1 : (100 / Math.abs(pick.odds)) + 1;
      return totalOdds * decimalOdds;
    }, 1);
  }

  private determineParlayOutcome(picks: FinalPick[]): 'win' | 'loss' | 'push' | 'pending' {
    if (picks.some(p => p.outcome === 'pending')) return 'pending';
    if (picks.some(p => p.outcome === 'loss')) return 'loss';
    if (picks.every(p => p.outcome === 'win' || p.outcome === 'push')) {
      return picks.some(p => p.outcome === 'push') ? 'push' : 'win';
    }
    return 'loss';
  }

  private calculateParlayProfitLoss(
    picks: FinalPick[], 
    outcome: string, 
    units: number, 
    totalOdds: number
  ): number {
    switch (outcome) {
      case 'win':
        return units * (totalOdds - 1);
      case 'loss':
        return -units;
      case 'push':
        return 0;
      default:
        return 0;
    }
  }

  // Getters for configuration
  getConfig(): RecapConfig {
    return { ...this.config };
  }

  getRoiWatcherState(): RoiWatcherState {
    return { ...this.roiWatcherState };
  }
}