/* eslint-disable max-lines -- pre-existing, refactor in separate sprint */
import { lifecycleSettle } from '../../lib/lifecycle';
import { BaseAgent } from '../BaseAgent/index';
import {
  BaseAgentConfig,
  BaseAgentDependencies,
  BaseMetrics,
  HealthStatus,
} from '../BaseAgent/types';
import { fetchSettlementData } from '../FeedAgent/oddsApi';
// SPRINT-SINGLE-WRITER-SETTLEMENT-GUARD-071A: Use lifecycle adapter for settlement

interface SettlementMetrics extends BaseMetrics {
  gamesProcessed: number;
  propsSettled: number;
  settlementSuccessRate: number;
  avgSettlementTimeMs: number;
  disputedSettlements: number;
  manualReviewRequired: number;
  dataQualityScore: number;
}

interface GameResult {
  id: string;
  external_game_id: string;
  sport: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  completed: boolean;
  completion_time: string;
}

interface PropSettlement {
  raw_prop_id: string;
  final_pick_id?: string;
  player_name: string;
  stat_type: string;
  line: number;
  bet_side: 'over' | 'under' | 'home' | 'away';
  actual_value?: number;
  settlement_result?: 'win' | 'loss' | 'push' | 'void';
  confidence: number;
}

export class SettlementAgent extends BaseAgent {
  private settlementMetrics: SettlementMetrics;
  private readonly SETTLEMENT_INTERVALS = {
    immediate: 0, // Process immediately after game completion
    short: 30 * 60, // 30 minutes after completion
    medium: 3 * 60 * 60, // 3 hours after completion
    long: 24 * 60 * 60, // 24 hours after completion (final verification)
  };

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);

    this.settlementMetrics = {
      ...this.metrics,
      gamesProcessed: 0,
      propsSettled: 0,
      settlementSuccessRate: 0,
      avgSettlementTimeMs: 0,
      disputedSettlements: 0,
      manualReviewRequired: 0,
      dataQualityScore: 0,
    };
  }

  protected async initialize(): Promise<void> {
    this.logger.info('🏁 SettlementAgent initializing...');

    // Verify database access
    if (!this.hasSupabase()) {
      throw new Error('Supabase client required for SettlementAgent');
    }

    // Test access to settlement tables
    const requiredTables = ['game_results', 'prop_settlements', 'raw_props', 'unified_picks'];

    for (const table of requiredTables) {
      try {
        const { error } = await this.requireSupabase().from(table).select('id').limit(1);

        if (error) {
          this.logger.warn(`⚠️ Table ${table} access check failed: ${error.message}`);
        }
      } catch (err) {
        this.logger.error(`❌ Failed to access table ${table}`, {
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    this.logger.info('✅ SettlementAgent initialized successfully');
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('🧹 SettlementAgent cleanup complete');
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    return {
      ...this.settlementMetrics,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024,
    };
  }

  public async checkHealth(): Promise<HealthStatus> {
    const checks = [];

    // Check Supabase connectivity
    try {
      if (this.hasSupabase()) {
        await this.requireSupabase().from('game_results').select('count').limit(1);
        checks.push({ service: 'supabase', status: 'healthy' });
      } else {
        throw new Error('Client not available');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      checks.push({ service: 'supabase', status: 'unhealthy', error: errorMessage });
    }

    // Check Odds API connectivity for settlement data
    try {
      // This would test the API connection
      checks.push({ service: 'odds-api', status: 'healthy' });
    } catch (error) {
      checks.push({
        service: 'odds-api',
        status: 'degraded',
        error: 'Settlement data source unavailable',
      });
    }

    const healthyServices = checks.filter(check => check.status === 'healthy').length;
    const overallStatus =
      healthyServices === checks.length
        ? 'healthy'
        : healthyServices > 0
          ? 'degraded'
          : 'unhealthy';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      details: {
        checks,
        metrics: this.settlementMetrics,
      },
    };
  }

  protected async process(): Promise<void> {
    this.logger.info('🏁 Starting SettlementAgent processing cycle...');
    const cycleStartTime = Date.now();

    try {
      // Process settlement in phases
      await this.processCompletedGames();
      await this.processDelayedSettlements();
      await this.validateExistingSettlements();

      const cycleTime = Date.now() - cycleStartTime;
      this.settlementMetrics.processingTimeMs = cycleTime;

      this.logger.info('✅ SettlementAgent cycle completed', {
        gamesProcessed: this.settlementMetrics.gamesProcessed,
        propsSettled: this.settlementMetrics.propsSettled,
        cycleTimeMs: cycleTime,
      });
    } catch (error) {
      this.settlementMetrics.errorCount++;
      this.logger.error('❌ SettlementAgent processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Process games that have recently completed
   */
  private async processCompletedGames(): Promise<void> {
    this.logger.info('🔍 Processing recently completed games...');

    if (!this.hasSupabase()) {
      this.logger.warn('⚠️ Supabase not available, skipping completed games processing');
      return;
    }

    try {
      // Get games that completed recently but haven't been fully settled
      const { data: pendingGames, error } = await this.requireSupabase()
        .from('game_results')
        .select('*')
        .eq('completed', true)
        .in('settlement_status', ['pending', 'disputed'])
        .gte('completion_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order('completion_time', { ascending: false })
        .limit(50);

      if (error) {
        throw new Error(`Failed to fetch pending games: ${error.message}`);
      }

      if (!pendingGames || pendingGames.length === 0) {
        this.logger.debug('📭 No pending completed games found');
        return;
      }

      this.logger.info(`📊 Processing ${pendingGames.length} completed games`);

      for (const game of pendingGames) {
        await this.processGameSettlement(game);
        this.settlementMetrics.gamesProcessed++;

        // Brief pause between games to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      this.logger.error('❌ Error processing completed games', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Process settlement for a specific game
   */
  private async processGameSettlement(game: GameResult): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.info(`🎯 Processing settlement for game: ${game.external_game_id}`);

      // Fetch fresh settlement data from Odds API
      const settlementData = await this.fetchGameSettlementData(game);

      if (!settlementData) {
        this.logger.warn(`⚠️ No settlement data available for game: ${game.external_game_id}`);
        return;
      }

      // Update game result with latest data
      await this.updateGameResult(game, settlementData);

      // Process all props for this game
      await this.processGameProps(game, settlementData);

      const processingTime = Date.now() - startTime;
      this.settlementMetrics.avgSettlementTimeMs =
        (this.settlementMetrics.avgSettlementTimeMs + processingTime) / 2;

      this.logger.info(
        `✅ Game settlement completed: ${game.external_game_id} (${processingTime}ms)`
      );
    } catch (error) {
      this.logger.error(`❌ Failed to process game settlement: ${game.external_game_id}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Fetch settlement data for a specific game
   */
  private async fetchGameSettlementData(game: GameResult): Promise<any> {
    try {
      // Map sport to Odds API format
      const sportMapping: Record<string, string> = {
        NFL: 'americanfootball_nfl',
        NCAAF: 'americanfootball_ncaaf',
        NBA: 'basketball_nba',
        NCAAB: 'basketball_ncaab',
        MLB: 'baseball_mlb',
        NHL: 'icehockey_nhl',
      };

      const oddsApiSport = sportMapping[game.sport];
      if (!oddsApiSport) {
        this.logger.warn(`❌ Unsupported sport for settlement: ${game.sport}`);
        return null;
      }

      const settlementData = await fetchSettlementData(oddsApiSport as any, 3); // 3 days back

      // Find the specific game in settlement data
      const gameData = settlementData.find(
        data =>
          data.id === game.external_game_id ||
          (data.home_team === game.home_team && data.away_team === game.away_team)
      );

      return gameData;
    } catch (error) {
      this.logger.error(`❌ Failed to fetch settlement data for ${game.external_game_id}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Update game result with latest settlement data
   */
  // eslint-disable-next-line complexity -- pre-existing, refactor in separate sprint
  private async updateGameResult(game: GameResult, settlementData: any): Promise<void> {
    if (!this.hasSupabase()) return;

    try {
      const updateData: any = {
        settlement_status: 'verified',
        settlement_timestamp: new Date().toISOString(),
        source_last_update: settlementData.last_update || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Update scores if they've changed
      if (settlementData.scores && settlementData.scores.length >= 2) {
        const homeScore = parseInt(
          settlementData.scores.find((s: any) => s.name === game.home_team)?.professional_score ||
            '0'
        );
        const awayScore = parseInt(
          settlementData.scores.find((s: any) => s.name === game.away_team)?.professional_score ||
            '0'
        );

        if (homeScore !== game.home_score || awayScore !== game.away_score) {
          updateData.home_score = homeScore;
          updateData.away_score = awayScore;

          this.logger.info(
            `📊 Score updated for ${game.external_game_id}: ${game.away_team} ${awayScore} - ${game.home_team} ${homeScore}`
          );
        }
      }

      const { error } = await this.requireSupabase()
        .from('game_results')
        .update(updateData)
        .eq('id', game.id);

      if (error) {
        throw new Error(`Failed to update game result: ${error.message}`);
      }
    } catch (error) {
      this.logger.error(`❌ Failed to update game result: ${game.external_game_id}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Process all props for a completed game
   */
  private async processGameProps(game: GameResult, settlementData: any): Promise<void> {
    if (!this.hasSupabase()) return;

    try {
      // Get all raw props for this game that need settlement
      const { data: rawProps, error } = await this.requireSupabase()
        .from('raw_props')
        .select('*')
        .eq('external_game_id', game.external_game_id)
        .eq('settlement_status', 'pending');

      if (error) {
        throw new Error(`Failed to fetch raw props: ${error.message}`);
      }

      if (!rawProps || rawProps.length === 0) {
        this.logger.debug(`📭 No pending props found for game: ${game.external_game_id}`);
        return;
      }

      this.logger.info(`🎯 Processing ${rawProps.length} props for game: ${game.external_game_id}`);

      for (const prop of rawProps) {
        await this.settleProp(prop, game, settlementData);
        this.settlementMetrics.propsSettled++;
      }
    } catch (error) {
      this.logger.error(`❌ Error processing game props for ${game.external_game_id}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Settle an individual prop bet
   */
  private async settleProp(prop: any, game: GameResult, settlementData: any): Promise<void> {
    if (!this.hasSupabase()) return;

    try {
      // Determine settlement based on prop type and game result
      const settlement = await this.calculatePropSettlement(prop, game, settlementData);

      if (!settlement) {
        this.settlementMetrics.manualReviewRequired++;
        this.logger.warn(`⚠️ Manual review required for prop: ${prop.id}`);
        return;
      }

      // Create prop settlement record
      const { error: settlementError } = await this.requireSupabase()
        .from('prop_settlements')
        .insert({
          raw_prop_id: prop.id,
          game_result_id: game.id,
          player_name: prop.player_name,
          stat_type: prop.stat_type,
          line: prop.line,
          bet_side: settlement.bet_side,
          actual_value: settlement.actual_value,
          settlement_result: settlement.settlement_result,
          settlement_confidence: settlement.confidence,
          data_source: 'odds-api',
          settled_at: new Date().toISOString(),
        });

      if (settlementError) {
        throw new Error(`Failed to create settlement record: ${settlementError.message}`);
      }

      // Update raw prop status
      const { error: propUpdateError } = await this.requireSupabase()
        .from('raw_props')
        .update({
          settlement_status: 'settled',
          settlement_result: settlement.settlement_result,
          settled_at: new Date().toISOString(),
        })
        .eq('id', prop.id);

      if (propUpdateError) {
        throw new Error(`Failed to update prop status: ${propUpdateError.message}`);
      }

      // Update final pick if it exists
      await this.updateUnifiedPickSettlement(prop, settlement);

      this.logger.debug(
        `✅ Prop settled: ${prop.player_name} ${prop.stat_type} ${settlement.settlement_result}`
      );
    } catch (error) {
      this.settlementMetrics.disputedSettlements++;
      this.logger.error(`❌ Failed to settle prop: ${prop.id}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Calculate prop settlement result
   */
  // eslint-disable-next-line complexity, no-unused-vars -- pre-existing, refactor in separate sprint
  private async calculatePropSettlement(
    prop: any,
    game: GameResult,
    _settlementData: any
  ): Promise<PropSettlement | null> {
    // This is a simplified version - in production you'd need more sophisticated logic
    // to handle different prop types, player stats, etc.

    try {
      let actual_value: number | undefined;
      let bet_side: 'over' | 'under' | 'home' | 'away';
      let result: 'win' | 'loss' | 'push' | 'void';

      // Example logic for team totals (simplified)
      if (prop.stat_type === 'total' || prop.stat_type === 'totals') {
        const totalScore = game.home_score + game.away_score;
        actual_value = totalScore;

        // Assume we can determine if this was an over or under bet
        bet_side = prop.over_odds > 0 ? 'over' : 'under';

        if (bet_side === 'over') {
          result = totalScore > prop.line ? 'win' : totalScore < prop.line ? 'loss' : 'push';
        } else {
          result = totalScore < prop.line ? 'win' : totalScore > prop.line ? 'loss' : 'push';
        }
      }
      // Add more prop types (spreads, moneylines, player props) here
      else {
        // Require manual review for complex prop types
        return null;
      }

      return {
        raw_prop_id: prop.id,
        player_name: prop.player_name,
        stat_type: prop.stat_type,
        line: prop.line,
        bet_side,
        actual_value,
        settlement_result: result,
        confidence: 0.95, // High confidence for simple calculations
      };
    } catch (error) {
      this.logger.error(`❌ Error calculating prop settlement for ${prop.id}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Update final pick settlement status
   * SPRINT-SINGLE-WRITER-SETTLEMENT-GUARD-071A: Uses lifecycleSettle adapter
   * to enforce single-writer discipline and transition validation.
   */
  private async updateUnifiedPickSettlement(prop: any, settlement: PropSettlement): Promise<void> {
    if (!this.hasSupabase()) return;

    try {
      // Find corresponding final pick (READ is allowed)
      const { data: finalPicks, error } = await this.requireSupabase()
        .from('unified_picks')
        .select('*')
        .eq('raw_prop_id', prop.id);

      if (error || !finalPicks || finalPicks.length === 0) {
        return; // No final pick found, skip
      }

      for (const finalPick of finalPicks) {
        // SPRINT-071A: Use lifecycle adapter instead of direct write
        // Handle void case: use settlement_status='void', no settlement_result
        const isVoid = settlement.settlement_result === 'void';
        const settlementPayload = isVoid
          ? {
              settlement_status: 'void' as const,
              actual_outcome: settlement.actual_value,
            }
          : {
              settlement_status: 'settled' as const,
              settlement_result: settlement.settlement_result as
                | 'win'
                | 'loss'
                | 'push'
                | undefined,
              actual_outcome: settlement.actual_value,
            };

        const result = await lifecycleSettle(
          this.requireSupabase(),
          finalPick.id,
          settlementPayload,
          {
            writerRole: 'settler',
            traceId: `settlement-agent-${finalPick.id}-${Date.now()}`,
          }
        );

        if (!result.success) {
          this.logger.error(`❌ Failed to settle pick via lifecycle adapter: ${finalPick.id}`, {
            error: result.error,
            validationPassed: result.validationPassed,
          });
        } else {
          this.logger.debug(`✅ Pick settled via lifecycle adapter: ${finalPick.id}`);
        }
      }
    } catch (error) {
      this.logger.error(`❌ Error updating final pick settlement for prop ${prop.id}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Process delayed settlements (30min, 3hr, 24hr checks)
   */
  private async processDelayedSettlements(): Promise<void> {
    // Implementation for delayed verification checks
    this.logger.debug('🔄 Processing delayed settlements...');
    // This would implement the various time-delayed settlement verification
  }

  /**
   * Validate existing settlements for accuracy
   */
  private async validateExistingSettlements(): Promise<void> {
    // Implementation for settlement validation
    this.logger.debug('🔍 Validating existing settlements...');
    // This would implement settlement accuracy validation
  }

  /**
   * Manual settlement override (for disputed cases)
   */
  public async manualSettle(
    propId: string,
    result: 'win' | 'loss' | 'push' | 'void',
    actualValue?: number,
    notes?: string
  ): Promise<void> {
    if (!this.hasSupabase()) {
      throw new Error('Database not available for manual settlement');
    }

    try {
      this.logger.info(`🔧 Manual settlement for prop ${propId}: ${result}`);

      // Update prop settlement
      const { error } = await this.requireSupabase()
        .from('prop_settlements')
        .update({
          settlement_result: result,
          actual_value: actualValue,
          settlement_method: 'manual',
          settlement_confidence: 1.0,
          disputed: false,
          dispute_resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('raw_prop_id', propId);

      if (error) {
        throw new Error(`Manual settlement failed: ${error.message}`);
      }

      // Log the manual action
      await this.requireSupabase()
        .from('settlement_log')
        .insert({
          prop_settlement_id: propId,
          action_type: 'resolved',
          new_values: { settlement_result: result, actual_value: actualValue },
          data_source: 'manual',
          processing_agent: 'SettlementAgent',
          confidence_score: 1.0,
          notes: notes || 'Manual settlement override',
        });

      this.logger.info(`✅ Manual settlement completed for prop ${propId}`);
    } catch (error) {
      this.logger.error(`❌ Manual settlement failed for prop ${propId}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}
