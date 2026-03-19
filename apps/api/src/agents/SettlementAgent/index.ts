/* eslint-disable max-lines -- pre-existing, refactor in separate sprint */
import { resolveOutcome } from '../../analysis/outcomes/outcome-resolver';
import { resolveActualValue, hasStatMapping } from '../../analysis/outcomes/stat-resolver';
import { settleExecutionTelemetry } from '../../lib/executionTelemetry';
import { lifecycleSettle, checkSettleIdempotency } from '../../lib/lifecycle';
import { fetchSGOEvents } from '../../logic/providers/sgoFetcher';
import { BaseAgent } from '../BaseAgent/index';
import {
  BaseAgentConfig,
  BaseAgentDependencies,
  BaseMetrics,
  HealthStatus,
} from '../BaseAgent/types';
import { fetchSettlementData } from '../FeedAgent/oddsApi';
// SPRINT-042C: SGO settlement imports
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

// SPRINT-DB-TYPE-ALLOWLIST-BURN-004: Use canonical PropSettlementsRow from shared-types
// Note: This local interface is for in-memory processing, extends DB row with additional fields
import type { PropSettlementsRow } from '@unit-talk/contracts';

// SPRINT-044R: Settlement now sources from unified_picks, not raw_props
interface PropSettlement extends Partial<PropSettlementsRow> {
  final_pick_id: string;
  player_name: string;
  stat_type: string;
  line: number;
  bet_side: 'over' | 'under' | 'home' | 'away';
  actual_value?: number;
  settlement_result?: 'win' | 'loss' | 'push' | 'void';
  confidence: number;
}

// SPRINT-042C: SGO league mapping for settlement queries
const SGO_LEAGUE_MAP: Record<string, string> = {
  NFL: 'NFL',
  NBA: 'NBA',
  MLB: 'MLB',
  NHL: 'NHL',
  NCAAF: 'NCAAF',
  NCAAB: 'NCAAB',
  WNBA: 'WNBA',
};

// SPRINT-034: Import pure loss classification from analysis module
import { classifyLoss, type LossClassification } from '../../analysis/outcomes/loss-attribution';

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

    // SPRINT-044R: raw_props removed — settlement now sources from unified_picks
    const requiredTables = ['game_results', 'prop_settlements', 'unified_picks'];

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
   * SPRINT-042C: Fetch settlement data from SGO (primary source)
   * Uses finalized + ended + expandResults filters for accurate settlement.
   */
  private async fetchSettlementFromSGO(game: GameResult): Promise<any> {
    const sgoApiKey = process.env['SGO_API_KEY'];
    if (!sgoApiKey) {
      this.logger.debug('[SettlementAgent] SGO_API_KEY not configured, skipping SGO settlement');
      return null;
    }

    const sgoLeague = SGO_LEAGUE_MAP[game.sport];
    if (!sgoLeague) {
      this.logger.debug(`[SettlementAgent] No SGO league mapping for sport: ${game.sport}`);
      return null;
    }

    try {
      // Query SGO for finalized events around the game's completion time
      const gameDate = new Date(game.completion_time);
      const startsAfter = new Date(gameDate.getTime() - 48 * 60 * 60 * 1000).toISOString();
      const startsBefore = new Date(gameDate.getTime() + 24 * 60 * 60 * 1000).toISOString();

      const events = await fetchSGOEvents({
        apiKey: sgoApiKey,
        leagueID: sgoLeague,
        startsAfter,
        startsBefore,
        finalized: true,
        ended: true,
        expandResults: true,
        includeOpposingOdds: false,
        oddsAvailable: false,
        limit: 50,
      });

      if (!events || events.length === 0) {
        this.logger.debug(`[SettlementAgent] No finalized SGO events for ${game.external_game_id}`);
        return null;
      }

      // Match by external_game_id (SGO eventID) first, then by team names
      let matched = events.find((evt: any) => evt.eventID === game.external_game_id);

      if (!matched) {
        matched = events.find((evt: any) => {
          const homeTeam = evt.teams?.home?.names?.full ?? evt.teams?.home?.teamID ?? '';
          const awayTeam = evt.teams?.away?.names?.full ?? evt.teams?.away?.teamID ?? '';
          return (
            (homeTeam === game.home_team && awayTeam === game.away_team) ||
            (homeTeam === game.away_team && awayTeam === game.home_team)
          );
        });
      }

      if (!matched) {
        this.logger.debug(`[SettlementAgent] No matching SGO event for ${game.external_game_id}`);
        return null;
      }

      // Tag with settlement source
      return { ...matched, _settlement_source: 'sgo' };
    } catch (error) {
      this.logger.warn(
        `[SettlementAgent] SGO settlement fetch failed for ${game.external_game_id}`,
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      );
      return null;
    }
  }

  /**
   * SPRINT-042C: Fetch settlement data from Odds API (fallback)
   */
  private async fetchSettlementFromOddsApi(game: GameResult): Promise<any> {
    const sportMapping: Record<string, string> = {
      NFL: 'americanfootball_nfl',
      NCAAF: 'americanfootball_ncaaf',
      NBA: 'basketball_nba',
      NCAAB: 'basketball_ncaab',
      MLB: 'baseball_mlb',
      NHL: 'icehockey_nhl',
    };

    const oddsApiSport = sportMapping[game.sport];
    if (!oddsApiSport) return null;

    try {
      const settlementData = await fetchSettlementData(oddsApiSport as any, 3);
      const gameData = settlementData.find(
        (data: any) =>
          data.id === game.external_game_id ||
          (data.home_team === game.home_team && data.away_team === game.away_team)
      );

      if (gameData) {
        return { ...gameData, _settlement_source: 'odds-api' };
      }
      return null;
    } catch (error) {
      this.logger.warn(
        `[SettlementAgent] Odds API settlement failed for ${game.external_game_id}`,
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      );
      return null;
    }
  }

  /**
   * SPRINT-042C: Fetch settlement data — SGO primary, Odds API fallback
   */
  private async fetchGameSettlementData(game: GameResult): Promise<any> {
    // Priority 1: SGO (no credit cost, has player results with expandResults)
    const sgoData = await this.fetchSettlementFromSGO(game);
    if (sgoData) {
      this.logger.info(`[SettlementAgent] Settlement data from SGO for ${game.external_game_id}`);
      return sgoData;
    }

    // Priority 2: Odds API (credit cost, game scores only)
    const oddsData = await this.fetchSettlementFromOddsApi(game);
    if (oddsData) {
      this.logger.info(
        `[SettlementAgent] Settlement data from Odds API for ${game.external_game_id}`
      );
      return oddsData;
    }

    this.logger.warn(
      `[SettlementAgent] No settlement source available for ${game.external_game_id}`
    );
    return null;
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
   * SPRINT-044R: Process all picks for a completed game
   * Sources from unified_picks instead of raw_props.
   */
  private async processGameProps(game: GameResult, settlementData: any): Promise<void> {
    if (!this.hasSupabase()) return;

    try {
      // SPRINT-044R: Query unified_picks for pending settlement (canonical source)
      const { data: picks, error } = await this.requireSupabase()
        .from('unified_picks')
        .select('*')
        .eq('external_game_id', game.external_game_id)
        .or('settlement_status.is.null,settlement_status.eq.pending');

      if (error) {
        throw new Error(`Failed to fetch picks for settlement: ${error.message}`);
      }

      if (!picks || picks.length === 0) {
        this.logger.debug(`📭 No pending picks found for game: ${game.external_game_id}`);
        return;
      }

      this.logger.info(`🎯 Processing ${picks.length} picks for game: ${game.external_game_id}`);

      for (const pick of picks) {
        await this.settleProp(pick, game, settlementData);
        this.settlementMetrics.propsSettled++;
      }
    } catch (error) {
      this.logger.error(`❌ Error processing game props for ${game.external_game_id}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * SPRINT-044R: Settle an individual pick (sourced from unified_picks, not raw_props)
   */
  private async settleProp(pick: any, game: GameResult, settlementData: any): Promise<void> {
    if (!this.hasSupabase()) return;

    // SPRINT-SETTLEMENT-IDEMPOTENCY-HARDENING: Pre-flight idempotency check (GAP-01)
    const idempotencyCheck = await checkSettleIdempotency(this.requireSupabase(), pick.id);
    if (idempotencyCheck.isDuplicate) {
      this.logger.debug(
        `[SettlementAgent] Pick ${pick.id} already settled — skipping (idempotent)`,
        { existingState: idempotencyCheck.existingState }
      );
      return;
    }

    try {
      // Determine settlement based on prop type and game result
      const settlement = await this.calculatePropSettlement(pick, game, settlementData);

      if (!settlement) {
        this.settlementMetrics.manualReviewRequired++;
        this.logger.warn(`⚠️ Manual review required for pick: ${pick.id}`);
        return;
      }

      // SPRINT-042C: Thread settlement_source from settlementData
      const settlementSource = settlementData?._settlement_source || 'unknown';

      // Create prop settlement record — uses final_pick_id (not raw_prop_id)
      const { error: settlementError } = await this.requireSupabase()
        .from('prop_settlements')
        .insert({
          final_pick_id: pick.id,
          game_result_id: game.id,
          player_name: pick.player_name,
          stat_type: pick.stat_type,
          line: pick.line,
          bet_side: settlement.bet_side,
          actual_value: settlement.actual_value,
          settlement_result: settlement.settlement_result,
          settlement_confidence: settlement.confidence,
          data_source: settlementSource,
          settled_at: new Date().toISOString(),
        });

      if (settlementError) {
        throw new Error(`Failed to create settlement record: ${settlementError.message}`);
      }

      // SPRINT-044R: Settle unified_pick via lifecycle adapter (replaces raw_props update)
      const isVoid = settlement.settlement_result === 'void';
      const settlementPayload = isVoid
        ? {
            settlement_status: 'void' as const,
            actual_outcome: settlement.actual_value,
            settlement_source: settlementSource,
          }
        : {
            settlement_status: 'settled' as const,
            settlement_result: settlement.settlement_result as 'win' | 'loss' | 'push' | undefined,
            actual_outcome: settlement.actual_value,
            settlement_source: settlementSource,
          };

      const result = await lifecycleSettle(this.requireSupabase(), pick.id, settlementPayload, {
        writerRole: 'settler',
        traceId: `settlement-agent-${pick.id}-${Date.now()}`,
      });

      if (!result.success) {
        // SPRINT-SETTLEMENT-IDEMPOTENCY-HARDENING: Concurrent modification is idempotent (GAP-01)
        if (result.error?.includes('modified by another process')) {
          this.logger.warn(
            `[SettlementAgent] Concurrent settlement on pick ${pick.id} — skipping (other worker won)`
          );
          return;
        }
        this.logger.error(`❌ Failed to settle pick via lifecycle adapter: ${pick.id}`, {
          error: result.error,
          validationPassed: result.validationPassed,
        });
      } else {
        this.logger.debug(`✅ Pick settled via lifecycle adapter: ${pick.id}`);

        // EXECUTION-TELEMETRY-ACTIVATION-003: Update execution telemetry with CLV
        await settleExecutionTelemetry(
          this.requireSupabase(),
          pick.id,
          pick.line,
          pick.closing_line,
          pick.odds,
          pick.closing_odds,
          pick.side || pick.selection
        );

        // DATA-MOAT-V3-INTEGRATION-001: Attribute losses for learning loop
        if (settlement.settlement_result === 'loss') {
          await this.attributeLoss(pick.id, settlement, pick);
        }
      }

      this.logger.debug(
        `✅ Prop settled: ${pick.player_name} ${pick.stat_type} ${settlement.settlement_result}`
      );
    } catch (error) {
      this.settlementMetrics.disputedSettlements++;
      this.logger.error(`❌ Failed to settle pick: ${pick.id}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * SPRINT-042C: Calculate prop settlement result
   * SPRINT-044R: Now operates on unified_picks rows instead of raw_props
   */
  // eslint-disable-next-line complexity -- settlement logic inherently branchy
  private async calculatePropSettlement(
    pick: any,
    game: GameResult,
    settlementData: any
  ): Promise<PropSettlement | null> {
    try {
      let actual_value: number | undefined;
      let result: 'win' | 'loss' | 'push' | 'void';

      // SPRINT-044R: unified_picks has explicit `side` field; fall back to selection
      const bet_side: 'over' | 'under' | 'home' | 'away' =
        pick.side?.toLowerCase() || pick.selection?.toLowerCase() || 'over'; // Safe default — most player props are over bets

      // --- Team totals ---
      if (pick.stat_type === 'total' || pick.stat_type === 'totals') {
        const totalScore = game.home_score + game.away_score;
        actual_value = totalScore;

        if (bet_side === 'over') {
          result = totalScore > pick.line ? 'win' : totalScore < pick.line ? 'loss' : 'push';
        } else {
          result = totalScore < pick.line ? 'win' : totalScore > pick.line ? 'loss' : 'push';
        }

        return {
          final_pick_id: pick.id,
          player_name: pick.player_name,
          stat_type: pick.stat_type,
          line: pick.line,
          bet_side,
          actual_value,
          settlement_result: result,
          confidence: 0.95,
        };
      }

      // --- SPRINT-042C: Player props via stat-resolver + outcome-resolver ---
      const marketKey = pick.market || `player_${pick.stat_type?.toLowerCase()}_ou`;

      if (hasStatMapping(marketKey)) {
        // Source 1: Try SGO expandResults player data from settlementData
        let playerStats: Record<string, number> | null = null;

        if (settlementData?._settlement_source === 'sgo' && settlementData?.odds) {
          // SPRINT-044R: Use external_prop_id or meta.sgo_market_key from unified_picks
          const propMarketKey = pick.external_prop_id || (pick.meta as any)?.sgo_market_key;
          if (propMarketKey && settlementData.odds[propMarketKey]?.result != null) {
            const sgoResult = settlementData.odds[propMarketKey].result;
            if (typeof sgoResult === 'number') {
              actual_value = sgoResult;
            }
          }
        }

        // Source 2: Try player_game_stats table if SGO didn't provide value
        if (actual_value == null && this.hasSupabase() && pick.player_name) {
          const { data: statsRow } = await this.requireSupabase()
            .from('player_game_stats')
            .select('stats')
            .eq('player_name', pick.player_name)
            .eq('game_id', game.external_game_id)
            .maybeSingle();

          if (statsRow?.stats && typeof statsRow.stats === 'object') {
            playerStats = statsRow.stats as Record<string, number>;
          }
        }

        // Resolve actual value from stats if we have them
        if (actual_value == null && playerStats) {
          const resolution = resolveActualValue(marketKey, playerStats);
          if (resolution.resolved && resolution.actual_value != null) {
            actual_value = resolution.actual_value;
          }
        }

        // If we have an actual value, determine outcome
        if (actual_value != null) {
          const overOutcome = resolveOutcome(actual_value, pick.line);
          // Map outcome based on bet side
          if (bet_side === 'over') {
            result = overOutcome.toLowerCase() as 'win' | 'loss' | 'push';
          } else {
            // Invert for under side
            result = overOutcome === 'WIN' ? 'loss' : overOutcome === 'LOSS' ? 'win' : 'push';
          }

          return {
            final_pick_id: pick.id,
            player_name: pick.player_name,
            stat_type: pick.stat_type,
            line: pick.line,
            bet_side,
            actual_value,
            settlement_result: result,
            confidence: 0.9,
          };
        }

        // No source provided actual value — manual review
        this.logger.debug(
          `[SettlementAgent] No actual value for ${pick.player_name} ${pick.stat_type} — manual review`
        );
        return null;
      }

      // --- Unsupported market type → manual review ---
      return null;
    } catch (error) {
      this.logger.error(`❌ Error calculating prop settlement for ${pick.id}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  // SPRINT-044R: updateUnifiedPickSettlement() removed — settlement now operates
  // directly on unified_picks rows, so lifecycleSettle is called inline in settleProp().

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
   * DATA-MOAT-V3-INTEGRATION-001: Classify loss per LOSS_POSTMORTEM_ENGINE_v1.md
   *
   * Categories:
   * - PROJECTION_MISS: Model overestimated edge (EV > 0 but loss)
   * - VARIANCE: Within expected variance bounds (|EV| < 5%)
   * - EXECUTION_MISS: Slippage or timing issue
   * - NEWS_MISS: Breaking news not captured
   * - CORRELATION_MISS: Correlated losses in same event
   * - PRICE_MISS: Line moved against us (CLV negative)
   * - UNKNOWN: Insufficient data
   */
  // eslint-disable-next-line max-lines-per-function, complexity
  private async attributeLoss(
    pickId: string,
    _settlement: { settlement_result?: string; actual_value?: number },
    _prop: PropSettlement
  ): Promise<void> {
    if (!this.hasSupabase()) return;

    try {
      let classification: LossClassification = 'UNKNOWN';
      const notes: string[] = [];

      // Query feature_snapshot for this pick if available
      const { data: pick } = await this.requireSupabase()
        .from('unified_picks')
        .select('feature_snapshot_id, ev, clv_at_bet, kelly_bet_size, edge_breakdown')
        .eq('id', pickId)
        .single();

      // SPRINT-034: Use pure classifyLoss from analysis module
      // Reads feature data, then delegates classification to pure function
      let ev = 0;
      let clvAtBet = 0;
      let clvAtClose = 0;
      let hasFeatureSnapshot = false;

      if (pick?.feature_snapshot_id) {
        hasFeatureSnapshot = true;
        const { data: featureSnapshot } = await this.requireSupabase()
          .from('feature_snapshots')
          .select('feature_vector, clv_at_bet, clv_at_close')
          .eq('id', pick.feature_snapshot_id)
          .single();

        ev = pick.ev ?? (pick.edge_breakdown as { ev?: number } | null)?.ev ?? 0;
        clvAtBet = featureSnapshot?.clv_at_bet ?? pick.clv_at_bet ?? 0;
        clvAtClose = featureSnapshot?.clv_at_close ?? 0;
      }

      const attribution = classifyLoss({
        ev,
        clv_at_bet: clvAtBet,
        clv_at_close: clvAtClose,
        has_feature_snapshot: hasFeatureSnapshot,
      });
      classification = attribution.classification;
      notes.push(...attribution.notes);

      // INVARIANT: classification MUST be set at this point
      if (!classification) {
        classification = 'UNKNOWN';
        notes.push('classification_fallback_triggered');
        this.logger.warn(`⚠️ Loss classification fallback triggered for ${pickId}`);
      }

      // Store the classification
      const { error } = await this.requireSupabase()
        .from('prop_settlements')
        .update({
          loss_classification: classification,
          attribution_timestamp: new Date().toISOString(),
        })
        .eq('final_pick_id', pickId);

      if (error) {
        this.logger.warn(`⚠️ Failed to store loss classification for ${pickId}`, {
          error: error.message,
        });
      } else {
        this.logger.info(`📊 Loss attributed: ${pickId} → ${classification}`, {
          notes: notes.join(', '),
        });
      }
    } catch (error) {
      // Non-blocking: log error but don't fail settlement
      this.logger.warn(`⚠️ Error attributing loss for ${pickId}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Manual settlement override (for disputed cases)
   * SPRINT-044R: Now accepts pickId (unified_picks.id) instead of raw_prop_id
   */
  public async manualSettle(
    pickId: string,
    result: 'win' | 'loss' | 'push' | 'void',
    actualValue?: number,
    notes?: string
  ): Promise<void> {
    if (!this.hasSupabase()) {
      throw new Error('Database not available for manual settlement');
    }

    try {
      this.logger.info(`🔧 Manual settlement for pick ${pickId}: ${result}`);

      // Update prop settlement record
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
        .eq('final_pick_id', pickId);

      if (error) {
        throw new Error(`Manual settlement failed: ${error.message}`);
      }

      // UTRP-R5 DEFECT-36: Resolve actual prop_settlements.id before writing settlement_log.
      // Previously wrote pickId (unified_picks.id) to settlement_log.prop_settlement_id,
      // which is a FK to prop_settlements.id — a different table, a different value.
      const { data: propRecord } = await this.requireSupabase()
        .from('prop_settlements')
        .select('id')
        .eq('final_pick_id', pickId)
        .single();

      if (!propRecord?.id) {
        this.logger.warn(
          `⚠️ prop_settlements row not found for pick ${pickId} — settlement_log will reference pickId as fallback`
        );
      }

      // Log the manual action
      await this.requireSupabase()
        .from('settlement_log')
        .insert({
          prop_settlement_id: propRecord?.id ?? pickId,
          action_type: 'resolved',
          new_values: { settlement_result: result, actual_value: actualValue },
          data_source: 'manual',
          processing_agent: 'SettlementAgent',
          confidence_score: 1.0,
          notes: notes || 'Manual settlement override',
        });

      this.logger.info(`✅ Manual settlement completed for pick ${pickId}`);
    } catch (error) {
      this.logger.error(`❌ Manual settlement failed for pick ${pickId}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}
