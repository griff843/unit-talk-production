import { randomUUID } from 'crypto';
import { BaseAgent } from '../BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies, HealthCheckResult, BaseMetrics } from '../BaseAgent/types';
import { requireSupabase } from '../../utils/supabaseUtils';

export interface PromotionAgentMetrics extends BaseMetrics {
  propsEvaluated: number;
  propsPromoted: number;
  propsRejected: number;
  promotionRate: number;
  averagePromotedScore: number;
  tierDistribution: Record<string, number>;
  averagePromotionTimeMs: number;
  validationFailures: number;
  databaseErrors: number;
}

export interface PromotionCriteria {
  minScore: number;
  minConfidence: number;
  minEdgeScore: number;
  allowedTiers: string[];
  maxDailyPromotions: number;
  diversificationRules: {
    maxPerSport: number;
    maxPerPlayer: number;
    maxPerMarketType: number;
  };
}

export interface PromotionResult {
  promoted: any[];
  rejected: any[];
  errors: any[];
  metrics: {
    totalEvaluated: number;
    promotionRate: number;
    averageScore: number;
    processingTimeMs: number;
  };
}

export interface ScoringResult {
  propId: string;
  finalScore: number;
  confidence: number;
  tier: string;
  edgeScore: number;
  kellyFraction: number;
  processed: boolean;
  processingTimeMs: number;
  error?: string;
}

/**
 * Promotion Agent
 *
 * Responsibilities:
 * - Evaluate scored props for promotion to unified_picks
 * - Apply professional sharp betting criteria
 * - Manage diversification and risk controls
 * - Handle unified_picks table operations
 * - Track promotion metrics and performance
 */
export class PromotionAgent extends BaseAgent {
  protected metrics: PromotionAgentMetrics;
  private criteria: PromotionCriteria;

  // Daily tracking for diversification
  private dailyPromotions: Map<string, number> = new Map(); // sport -> count
  private dailyPlayerPromotions: Map<string, number> = new Map(); // player -> count
  private dailyMarketPromotions: Map<string, number> = new Map(); // market_type -> count

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);

    // Initialize promotion criteria with professional standards
    this.criteria = {
      minScore: parseFloat(process.env.PROMOTION_MIN_SCORE || '70'), // 70+ score
      minConfidence: parseFloat(process.env.PROMOTION_MIN_CONFIDENCE || '85'), // 85%+ confidence
      minEdgeScore: parseFloat(process.env.PROMOTION_MIN_EDGE_SCORE || '800'), // 8% edge minimum
      allowedTiers: (process.env.PROMOTION_ALLOWED_TIERS || 'S,A').split(','),
      maxDailyPromotions: parseInt(process.env.PROMOTION_MAX_DAILY || '50'),
      diversificationRules: {
        maxPerSport: parseInt(process.env.PROMOTION_MAX_PER_SPORT || '10'),
        maxPerPlayer: parseInt(process.env.PROMOTION_MAX_PER_PLAYER || '3'),
        maxPerMarketType: parseInt(process.env.PROMOTION_MAX_PER_MARKET || '8')
      }
    };

    this.metrics = {
      agentName: this.config.name,
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: 0,
      propsEvaluated: 0,
      propsPromoted: 0,
      propsRejected: 0,
      promotionRate: 0,
      averagePromotedScore: 0,
      tierDistribution: { S: 0, A: 0, B: 0, C: 0, D: 0 },
      averagePromotionTimeMs: 0,
      validationFailures: 0,
      databaseErrors: 0
    };
  }

  async initialize(): Promise<void> {
    this.logger.info('🚀 Initializing Promotion Agent', {
      minScore: this.criteria.minScore,
      minConfidence: this.criteria.minConfidence,
      minEdgeScore: this.criteria.minEdgeScore,
      allowedTiers: this.criteria.allowedTiers,
      maxDailyPromotions: this.criteria.maxDailyPromotions
    });

    // Verify database access
    if (!this.hasSupabase()) {
      throw new Error('Supabase client required for Promotion Agent');
    }

    // Test unified_picks table access
    try {
      const { error } = await this.requireSupabase()
        .from('unified_picks')
        .select('count')
        .limit(1);

      if (error) {
        this.logger.warn(`⚠️ unified_picks table access issue: ${error.message}`);
      } else {
        this.logger.info('✅ unified_picks table accessible');
      }
    } catch (err) {
      this.logger.error('❌ Failed to access unified_picks table', {
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    }

    // Load daily promotion counts
    await this.loadDailyPromotionCounts();

    this.logger.info('✅ Promotion Agent initialized successfully');
  }

  async process(): Promise<void> {
    // Reset daily counters at midnight
    await this.resetDailyCountersIfNeeded();

    // Perform maintenance tasks
    await this.performMaintenanceTasks();
  }

  async cleanup(): Promise<void> {
    this.logger.info('🧹 Cleaning up Promotion Agent');

    // Save daily promotion counts
    await this.saveDailyPromotionCounts();

    this.logger.info('✅ Promotion Agent cleanup completed');
  }

  protected async collectMetrics(): Promise<PromotionAgentMetrics> {
    return {
      ...this.metrics,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024,
      promotionRate: this.metrics.propsEvaluated > 0 ?
        this.metrics.propsPromoted / this.metrics.propsEvaluated : 0
    };
  }

  async checkHealth(): Promise<HealthCheckResult> {
    const checks: Array<{ service: string; status: string; error?: string; details?: any }> = [];

    // Database connectivity
    if (this.hasSupabase()) {
      try {
        const { count } = await this.requireSupabase()
          .from('unified_picks')
          .select('count')
          .single();

        checks.push({
          service: 'database',
          status: 'healthy',
          details: { unifiedPicksCount: count }
        });
      } catch (error) {
        checks.push({
          service: 'database',
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Performance metrics check
    const promotionRate = this.metrics.promotionRate;
    const performanceHealthy = this.metrics.databaseErrors < 5 && promotionRate >= 0.01; // At least 1% promotion rate

    checks.push({
      service: 'promotionPerformance',
      status: performanceHealthy ? 'healthy' : 'degraded',
      details: {
        promotionRate: promotionRate,
        databaseErrors: this.metrics.databaseErrors,
        validationFailures: this.metrics.validationFailures,
        averagePromotionTime: this.metrics.averagePromotionTimeMs
      }
    });

    // Daily quota check
    const totalDailyPromotions = Array.from(this.dailyPromotions.values()).reduce((sum, count) => sum + count, 0);
    const quotaHealthy = totalDailyPromotions < this.criteria.maxDailyPromotions;

    checks.push({
      service: 'dailyQuota',
      status: quotaHealthy ? 'healthy' : 'degraded',
      details: {
        dailyPromotions: totalDailyPromotions,
        maxDailyPromotions: this.criteria.maxDailyPromotions,
        quotaUtilization: totalDailyPromotions / this.criteria.maxDailyPromotions
      }
    });

    const isHealthy = checks.every(check => check.status === 'healthy');

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      details: { checks, metrics: this.metrics }
    };
  }

  /**
   * Evaluate and promote qualified scoring results
   */
  async evaluateAndPromote(scoringResults: ScoringResult[]): Promise<PromotionResult> {
    const startTime = Date.now();
    const promoted: any[] = [];
    const rejected: any[] = [];
    const errors: any[] = [];

    this.logger.info(`📊 Evaluating ${scoringResults.length} props for promotion`);

    for (const result of scoringResults) {
      try {
        this.metrics.propsEvaluated++;

        // Apply promotion criteria
        const evaluation = await this.evaluateForPromotion(result);

        if (evaluation.qualified) {
          // Get original prop data for promotion
          const propData = await this.getOriginalPropData(result.propId);
          if (propData) {
            // Promote to unified_picks
            const promotedPick = await this.promoteToUnifiedPicks(result, propData);
            if (promotedPick) {
              promoted.push(promotedPick);
              this.updatePromotionMetrics(result, true);
              this.updateDiversificationCounters(propData);
            } else {
              rejected.push({ propId: result.propId, reason: 'Database promotion failed' });
              this.metrics.databaseErrors++;
            }
          } else {
            rejected.push({ propId: result.propId, reason: 'Original prop data not found' });
            this.metrics.validationFailures++;
          }
        } else {
          rejected.push({ propId: result.propId, reason: evaluation.reason });
          this.updatePromotionMetrics(result, false);
        }
      } catch (error) {
        errors.push({
          propId: result.propId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        this.metrics.errorCount++;
      }
    }

    const processingTimeMs = Date.now() - startTime;
    this.metrics.averagePromotionTimeMs = processingTimeMs;

    const result: PromotionResult = {
      promoted,
      rejected,
      errors,
      metrics: {
        totalEvaluated: scoringResults.length,
        promotionRate: promoted.length / scoringResults.length,
        averageScore: promoted.length > 0
          ? promoted.reduce((sum, p) => sum + p.score, 0) / promoted.length
          : 0,
        processingTimeMs
      }
    };

    this.logger.info(`✅ Promotion evaluation completed`, {
      promoted: promoted.length,
      rejected: rejected.length,
      errors: errors.length,
      promotionRate: Math.round(result.metrics.promotionRate * 100) / 100,
      processingTimeMs
    });

    return result;
  }

  // Private implementation methods

  private async evaluateForPromotion(result: ScoringResult): Promise<{ qualified: boolean; reason?: string }> {
    // 1. Check basic score criteria
    if (result.finalScore < this.criteria.minScore) {
      return { qualified: false, reason: `Score ${result.finalScore} below minimum ${this.criteria.minScore}` };
    }

    // 2. Check confidence criteria
    if (result.confidence < this.criteria.minConfidence) {
      return { qualified: false, reason: `Confidence ${result.confidence}% below minimum ${this.criteria.minConfidence}%` };
    }

    // 3. Check edge score criteria
    if (result.edgeScore < this.criteria.minEdgeScore) {
      return { qualified: false, reason: `Edge score ${result.edgeScore} below minimum ${this.criteria.minEdgeScore}` };
    }

    // 4. Check tier criteria
    if (!this.criteria.allowedTiers.includes(result.tier)) {
      return { qualified: false, reason: `Tier ${result.tier} not in allowed tiers ${this.criteria.allowedTiers.join(',')}` };
    }

    // 5. Check processing success
    if (!result.processed) {
      return { qualified: false, reason: 'Prop processing failed' };
    }

    // 6. Check daily quota
    const totalDailyPromotions = Array.from(this.dailyPromotions.values()).reduce((sum, count) => sum + count, 0);
    if (totalDailyPromotions >= this.criteria.maxDailyPromotions) {
      return { qualified: false, reason: 'Daily promotion quota reached' };
    }

    // 7. Check diversification rules (need prop data for this)
    const propData = await this.getOriginalPropData(result.propId);
    if (propData) {
      const diversificationCheck = this.checkDiversificationRules(propData);
      if (!diversificationCheck.allowed) {
        return { qualified: false, reason: diversificationCheck.reason };
      }
    }

    return { qualified: true };
  }

  private checkDiversificationRules(propData: any): { allowed: boolean; reason?: string } {
    const sport = propData.sport || 'unknown';
    const player = propData.player_name || 'unknown';
    const marketType = propData.stat_type || propData.market_type || 'unknown';

    // Check sport diversification
    const sportCount = this.dailyPromotions.get(sport) || 0;
    if (sportCount >= this.criteria.diversificationRules.maxPerSport) {
      return {
        allowed: false,
        reason: `Sport ${sport} daily limit reached (${sportCount}/${this.criteria.diversificationRules.maxPerSport})`
      };
    }

    // Check player diversification
    const playerCount = this.dailyPlayerPromotions.get(player) || 0;
    if (playerCount >= this.criteria.diversificationRules.maxPerPlayer) {
      return {
        allowed: false,
        reason: `Player ${player} daily limit reached (${playerCount}/${this.criteria.diversificationRules.maxPerPlayer})`
      };
    }

    // Check market type diversification
    const marketCount = this.dailyMarketPromotions.get(marketType) || 0;
    if (marketCount >= this.criteria.diversificationRules.maxPerMarketType) {
      return {
        allowed: false,
        reason: `Market type ${marketType} daily limit reached (${marketCount}/${this.criteria.diversificationRules.maxPerMarketType})`
      };
    }

    return { allowed: true };
  }

  private async getOriginalPropData(propId: string): Promise<any | null> {
    if (!this.hasSupabase()) {
      return null;
    }

    try {
      const { data: prop, error } = await this.requireSupabase()
        .from('sports_game_odds')
        .select('*')
        .eq('id', propId)
        .single();

      if (error) {
        this.logger.error('❌ Failed to get original prop data', {
          propId,
          error: error.message
        });
        return null;
      }

      return prop;
    } catch (error) {
      this.logger.error('❌ Error getting original prop data', {
        propId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  private async promoteToUnifiedPicks(result: ScoringResult, propData: any): Promise<any | null> {
    if (!this.hasSupabase()) {
      return null;
    }

    try {
      // Get a system user for promoted picks
      const { data: systemUser } = await this.requireSupabase()
        .from('users')
        .select('id')
        .limit(1)
        .single();

      if (!systemUser) {
        this.logger.error('❌ No system user found for promotion');
        return null;
      }

      // Create pick selection text
      const pickSide = propData.line > 0 ? 'over' : 'under';
      const selection = `${propData.player_name} ${propData.stat_type} ${pickSide} ${Math.abs(propData.line)}`;

      // Calculate stake based on Kelly fraction
      const baseStake = 100; // $100 base
      const kellyStake = Math.min(baseStake * (result.kellyFraction * 4), baseStake * 0.25); // Cap at 25% of base

      const unifiedPick = {
        id: randomUUID(),
        user_id: systemUser.id,
        pick_type: 'prop', // Professional prop pick
        selection: selection,
        odds: propData.odds || propData.over_odds || -110,
        stake: Math.round(kellyStake),
        potential_payout: Math.round(kellyStake * (1 + Math.abs(result.kellyFraction))),
        player_name: propData.player_name,
        stat_type: propData.stat_type,
        line: propData.line,
        over_odds: propData.over_odds,
        under_odds: propData.under_odds,
        sport: propData.sport || 'Unknown',
        game_date: propData.game_date,
        confidence: Math.round(result.confidence),
        tier_when_placed: result.tier,
        kelly_bet_size: result.kellyFraction,
        professional_score: result.finalScore,
        edge_score: result.edgeScore,
        created_at: new Date().toISOString(),
        promoted_from_raw_prop: propData.id,
        auto_promoted: true
      };

      const { data: insertedPick, error } = await this.requireSupabase()
        .from('unified_picks')
        .insert(unifiedPick)
        .select()
        .single();

      if (error) {
        this.logger.error('❌ Failed to insert into unified_picks', {
          propId: result.propId,
          error: error.message
        });
        return null;
      }

      // Mark raw_props as promoted
      await this.requireSupabase()
        .from('sports_game_odds')
        .update({
          promoted_to_picks: true,
          promoted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', propData.id);

      this.logger.info('✅ Prop promoted to unified_picks', {
        propId: result.propId,
        unifiedPickId: insertedPick.id,
        tier: result.tier,
        score: result.finalScore,
        stake: kellyStake
      });

      return insertedPick;

    } catch (error) {
      this.logger.error('❌ Error promoting to unified_picks', {
        propId: result.propId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  private updatePromotionMetrics(result: ScoringResult, promoted: boolean): void {
    if (promoted) {
      this.metrics.propsPromoted++;
      this.metrics.tierDistribution[result.tier]++;

      // Update average promoted score
      const totalScore = this.metrics.averagePromotedScore * (this.metrics.propsPromoted - 1) + result.finalScore;
      this.metrics.averagePromotedScore = totalScore / this.metrics.propsPromoted;
    } else {
      this.metrics.propsRejected++;
    }

    // Update promotion rate
    this.metrics.promotionRate = this.metrics.propsPromoted / this.metrics.propsEvaluated;
  }

  private updateDiversificationCounters(propData: any): void {
    const sport = propData.sport || 'unknown';
    const player = propData.player_name || 'unknown';
    const marketType = propData.stat_type || propData.market_type || 'unknown';

    // Update counters
    this.dailyPromotions.set(sport, (this.dailyPromotions.get(sport) || 0) + 1);
    this.dailyPlayerPromotions.set(player, (this.dailyPlayerPromotions.get(player) || 0) + 1);
    this.dailyMarketPromotions.set(marketType, (this.dailyMarketPromotions.get(marketType) || 0) + 1);
  }

  private async loadDailyPromotionCounts(): Promise<void> {
    if (!this.hasSupabase()) {
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];

      // Load today's promotions to rebuild counters
      const { data: todaysPromotions } = await this.requireSupabase()
        .from('unified_picks')
        .select('sport, player_name, stat_type')
        .eq('auto_promoted', true)
        .gte('created_at', `${today}T00:00:00.000Z`)
        .lt('created_at', `${today}T23:59:59.999Z`);

      if (todaysPromotions) {
        // Reset counters
        this.dailyPromotions.clear();
        this.dailyPlayerPromotions.clear();
        this.dailyMarketPromotions.clear();

        // Rebuild counters
        for (const pick of todaysPromotions) {
          const sport = pick.sport || 'unknown';
          const player = pick.player_name || 'unknown';
          const marketType = pick.stat_type || 'unknown';

          this.dailyPromotions.set(sport, (this.dailyPromotions.get(sport) || 0) + 1);
          this.dailyPlayerPromotions.set(player, (this.dailyPlayerPromotions.get(player) || 0) + 1);
          this.dailyMarketPromotions.set(marketType, (this.dailyMarketPromotions.get(marketType) || 0) + 1);
        }

        this.logger.info('📊 Daily promotion counters loaded', {
          totalPromotions: todaysPromotions.length,
          sports: this.dailyPromotions.size,
          players: this.dailyPlayerPromotions.size,
          marketTypes: this.dailyMarketPromotions.size
        });
      }
    } catch (error) {
      this.logger.error('❌ Failed to load daily promotion counts', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async saveDailyPromotionCounts(): Promise<void> {
    // In a production system, you might save these to a separate tracking table
    this.logger.info('💾 Daily promotion counts', {
      sports: Object.fromEntries(this.dailyPromotions),
      players: Object.fromEntries(this.dailyPlayerPromotions),
      marketTypes: Object.fromEntries(this.dailyMarketPromotions)
    });
  }

  private async resetDailyCountersIfNeeded(): Promise<void> {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];

    // Check if we need to reset counters (new day)
    if (!this.lastResetDate || this.lastResetDate !== currentDate) {
      this.logger.info('🔄 Resetting daily promotion counters for new day');

      this.dailyPromotions.clear();
      this.dailyPlayerPromotions.clear();
      this.dailyMarketPromotions.clear();

      this.lastResetDate = currentDate;
    }
  }

  private lastResetDate: string | null = null;

  private async performMaintenanceTasks(): Promise<void> {
    try {
      // Clean up old promotion tracking data
      const cutoffDate = new Date();
      cutoffDate.setHours(0, 0, 0, 0); // Start of today

      // Remove old entries from maps if they're from previous days
      // This is handled by resetDailyCountersIfNeeded()

      this.logger.debug('🧹 Promotion agent maintenance completed');
    } catch (error) {
      this.logger.error('❌ Promotion agent maintenance failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Public interface methods

  public getPromotionMetrics(): PromotionAgentMetrics {
    return { ...this.metrics };
  }

  public getDiversificationStatus(): {
    dailyPromotions: Record<string, number>;
    dailyPlayerPromotions: Record<string, number>;
    dailyMarketPromotions: Record<string, number>;
    quotaUtilization: number;
  } {
    const totalDailyPromotions = Array.from(this.dailyPromotions.values()).reduce((sum, count) => sum + count, 0);

    return {
      dailyPromotions: Object.fromEntries(this.dailyPromotions),
      dailyPlayerPromotions: Object.fromEntries(this.dailyPlayerPromotions),
      dailyMarketPromotions: Object.fromEntries(this.dailyMarketPromotions),
      quotaUtilization: totalDailyPromotions / this.criteria.maxDailyPromotions
    };
  }

  public async updatePromotionCriteria(newCriteria: Partial<PromotionCriteria>): Promise<void> {
    this.logger.info('🔧 Updating promotion criteria', newCriteria);

    this.criteria = {
      ...this.criteria,
      ...newCriteria
    };

    this.logger.info('✅ Promotion criteria updated', this.criteria);
  }
}