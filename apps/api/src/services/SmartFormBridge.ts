/* eslint-disable max-lines, max-lines-per-function, complexity, no-unused-vars, @typescript-eslint/no-unused-vars */
import { createClient } from '@supabase/supabase-js';

import { GradingAgent } from '../agents/GradingAgent';
import { env } from '../config/env';
// SPRINT-DAILY-PICKS-CANONICAL-ENFORCEMENT-007: lifecycleInsert no longer used
// SmartFormBridge enqueues to bridge_outbox; BridgeWorker does the lifecycleInsert
import { logger } from '../shared/logger';
// import { Pick } from '../types/pick';
import { SmartTicket } from '../types/smartForm';
// import { DiscordAlertRouter, AlertType, AlertData } from './DiscordAlertRouter'; // Unused

/**
 * SmartFormBridge - Integrates smart form submissions with main platform
 *
 * Responsibilities:
 * - Transform smart_tickets to platform format
 * - Auto-approve capper submissions
 * - Route live picks vs scheduled picks
 * - Generate post-submission insights
 * - Track system-wide data for AI training
 */
export class SmartFormBridge {
  private supabase;
  private gradingAgent: GradingAgent;

  constructor() {
    this.supabase = createClient(env.supabase.url, env.supabase.serviceRoleKey);
    this.gradingAgent = new GradingAgent({} as any, {} as any);
  }

  /**
   * Main entry point - processes new smart form submission
   */
  async processSubmission(ticketId: string): Promise<void> {
    const correlationId = `bridge-${ticketId}-${Date.now()}`;
    const bridgeLogger = logger.child({ correlationId, ticketId });

    try {
      bridgeLogger.info('Starting smart form bridge processing');

      // 1. Get smart ticket data
      const smartTicket = await this.getSmartTicket(ticketId);
      if (!smartTicket) {
        throw new Error(`Smart ticket not found: ${ticketId}`);
      }

      // 2. Validate capper exists and is active
      const capperThreadId = this.getCapperThreadId(smartTicket.capper);
      if (!capperThreadId) {
        throw new Error(`Invalid or inactive capper: ${smartTicket.capper}`);
      }

      // 3. Transform to platform format
      const pickData = await this.transformToPlatformFormat(smartTicket, correlationId);

      // 4. Generate system insights (for AI training and capper feedback)
      const insights = await this.generateInsights(smartTicket, pickData);

      // 5. SPRINT-DAILY-PICKS-CANONICAL-ENFORCEMENT-007: Enqueue to bridge_outbox ONLY
      // Canonical path: bridge_outbox → BridgeWorker → lifecycleInsert → unified_picks
      // SmartFormBridge must NOT write to unified_picks directly
      const betSlipId = await this.enqueueToBridgeOutbox(
        smartTicket,
        pickData,
        insights,
        bridgeLogger
      );

      bridgeLogger.info('Smart form pick enqueued to bridge_outbox', {
        betSlipId,
        systemGrade: insights.systemGrade,
        capper: smartTicket.capper,
      });

      // 6. Store insights for system tracking (linked by bet_slip_id)
      await this.storeInsights(betSlipId, insights);

      // 7. Update smart form status with insights
      await this.updateSmartTicketStatus(ticketId, 'processed', insights);

      bridgeLogger.info('Smart form bridge processing completed successfully', {
        betSlipId,
        marketType: smartTicket.market_type,
        capper: smartTicket.capper,
        insights: insights.systemGrade,
      });
    } catch (error) {
      logger.error('Smart form bridge processing failed', {
        ticketId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Update smart form status to error
      await this.updateSmartTicketStatus(
        ticketId,
        'error',
        null,
        error instanceof Error ? error.message : String(error)
      );

      // Send alert to system alerts channel
      await this.sendSystemAlert('Smart Form Bridge Error', {
        ticketId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });

      throw error;
    }
  }

  /**
   * Get smart ticket from database
   */
  private async getSmartTicket(ticketId: string): Promise<SmartTicket | null> {
    const { data, error } = await this.supabase
      .from('smart_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (error) {
      logger.error('Failed to fetch smart ticket', { ticketId, error });
      return null;
    }

    return data as SmartTicket;
  }

  /**
   * Get capper thread ID from environment configuration
   */
  private getCapperThreadId(capperName: string): string | null {
    const threadId = (env.capperThreads as any)[capperName];
    return threadId || null;
  }

  /**
   * Determine routing target: game thread vs capper thread
   * Routes to game thread if game-specific discussion, capper thread if general pick
   */
  private async determineRoutingTarget(
    smartTicket: SmartTicket,
    defaultCapperThread: string
  ): Promise<string> {
    try {
      // Check if this is a game-specific pick (has teams/matchup info)
      const hasGameContext = smartTicket.legs.some(
        leg => (leg as any).teams || (leg as any).matchup || (leg as any).game_id
      );

      if (hasGameContext) {
        // Try to find existing game thread
        const gameInfo = this.extractGameInfo(smartTicket);
        const gameThreadId = await this.findGameThread(gameInfo);

        if (gameThreadId) {
          logger.info('Routing pick to game thread', {
            gameInfo,
            gameThreadId,
            pickId: `smart-${smartTicket.id}`,
          });
          return gameThreadId;
        }
      }

      // Fallback to capper thread
      logger.info('Routing pick to capper thread', {
        capper: smartTicket.capper,
        capperThread: defaultCapperThread,
        pickId: `smart-${smartTicket.id}`,
      });
      return defaultCapperThread;
    } catch (error) {
      logger.warn('Error determining routing target, using capper thread', {
        error: error instanceof Error ? error.message : String(error),
        fallback: defaultCapperThread,
      });
      return defaultCapperThread;
    }
  }

  /**
   * Extract game information from smart ticket
   */
  private extractGameInfo(smartTicket: SmartTicket): any {
    const firstLeg = smartTicket.legs[0] as any;
    return {
      teams: firstLeg.teams || firstLeg.matchup || `${firstLeg.player_name} game`,
      sport: firstLeg.sport || 'unknown',
      gameId: firstLeg.game_id,
      date: smartTicket.created_at,
    };
  }

  /**
   * Find existing game thread for this game OR create new one
   * ENHANCED: Auto-creates game threads when picks are submitted
   */
  private async findGameThread(gameInfo: any): Promise<string | null> {
    try {
      // First, try to find existing thread
      const { data, error } = await this.supabase
        .from('game_threads')
        .select('thread_id')
        .or(`game_id.eq.${gameInfo.gameId},name.ilike.%${gameInfo.teams}%`)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!error && data?.thread_id) {
        logger.info('Found existing game thread', {
          gameInfo,
          threadId: data.thread_id,
        });
        return data.thread_id;
      }

      // No existing thread found - create new one
      logger.info('No game thread found, creating new one', { gameInfo });
      return await this.createGameThread(gameInfo);
    } catch (error) {
      logger.warn('Error finding/creating game thread', {
        gameInfo,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Create new game thread for pick submission
   * AUTO-CREATES threads when new games detected from picks
   */
  private async createGameThread(gameInfo: any): Promise<string | null> {
    try {
      // Import ThreadService dynamically to avoid circular dependencies
      const { Client, GatewayIntentBits } = await import('discord.js');
      const { DiscordBotService } = await import('../services/DiscordBotService');

      // Initialize Discord client for thread creation
      const client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
        ],
      });

      const discordToken = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
      if (!discordToken) {
        throw new Error('Discord token not found for thread creation');
      }

      await client.login(discordToken);

      // Wait for ready
      await new Promise(resolve => {
        if (client.isReady()) {
          resolve(void 0);
        } else {
          client.once('ready', () => resolve(void 0));
        }
      });

      // Create the game thread using DiscordBotService
      const discordBotService = DiscordBotService.getInstance();

      const gameData = {
        gameId: gameInfo.gameId || `game-${Date.now()}`,
        sport: gameInfo.sport || 'Unknown',
        teams: gameInfo.teams || 'Unknown vs Unknown',
        gameTime: gameInfo.date || new Date().toISOString(),
        description: `Game thread auto-created from pick submission`,
        league: gameInfo.sport?.toUpperCase() || 'UNKNOWN',
      };

      // Use Discord bot service to create thread (simplified for now)
      // const thread = await discordBotService.createGameThread(gameData);
      const thread = null; // Placeholder - implement thread creation logic

      if (thread) {
        logger.info('Auto-created game thread from pick submission', {
          gameInfo,
          threadId: thread.id,
          threadName: thread.name,
        });

        // Clean up Discord client
        await client.destroy();

        return thread.id;
      }

      await client.destroy();
      return null;
    } catch (error) {
      logger.error('Failed to create game thread from pick submission', {
        gameInfo,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Transform smart ticket to platform pick format
   * SPRINT-DAILY-PICKS-CANONICAL-ENFORCEMENT-007: Now maps to unified_picks
   */
  private async transformToPlatformFormat(
    smartTicket: SmartTicket,
    _correlationId: string
  ): Promise<any> {
    // Transform to match unified_picks schema
    const leg = smartTicket.legs[0] as any;

    return {
      // Core pick identification
      player_name: leg?.player_name || null,
      sport: smartTicket.sport || 'NFL',
      team: leg?.team || null,
      stat_type: leg?.stat_type || null,
      outcome: leg?.selection || null,
      line: leg?.line ? parseFloat(leg.line) : null,
      odds: leg?.odds ? parseFloat(leg.odds) : null,
      direction: leg?.selection?.toLowerCase().includes('over')
        ? 'over'
        : leg?.selection?.toLowerCase().includes('under')
          ? 'under'
          : null,

      // Game and betting context
      game_date: smartTicket.game_date || new Date().toISOString().split('T')[0],
      matchup: leg?.game || leg?.matchup || null,
      capper: smartTicket.capper,
      unit_size: smartTicket.unit_size || 1,
      bet_type: smartTicket.bet_type || 'player_props',
      market_type: smartTicket.market_type || 'scheduled',

      // Tier and confidence
      tier: 'A', // Default tier for smart form submissions
      confidence_score: smartTicket.confidence_level * 10, // Convert 1-10 to 10-100
      auto_approved: true, // Smart form submissions are auto-approved

      // Status and tracking
      play_status: 'pending',
      source: 'smart_form_bridge',
      promoted_to_final: false,
      has_alert: false,

      // Timestamps
      created_at: new Date().toISOString(),

      // Optional fields that may be populated later
      tier_tag: null,
      parlay_id: smartTicket.ticket_type === 'parlay' ? `parlay-${smartTicket.id}` : null,
      is_primary_leg: smartTicket.ticket_type !== 'parlay' || smartTicket.legs.indexOf(leg) === 0,
      play_tag: null,
      edge_score: null,
      context_flag: null,
    };
  }

  // calculateParlayOdds method removed as not needed for current implementation

  /**
   * Generate system insights for the submission
   */
  private async generateInsights(smartTicket: SmartTicket, dailyPick: any) {
    try {
      // Create a Pick-compatible object for grading analysis
      const pickForGrading = {
        id: `smart-${smartTicket.id}`,
        player: dailyPick.player_name,
        team: dailyPick.team,
        statType: dailyPick.stat_type,
        direction: dailyPick.direction,
        line: dailyPick.line,
        odds: dailyPick.odds,
        ticketType: smartTicket.ticket_type,
        pick_type: smartTicket.ticket_type,
        status: 'pending',
      };

      // Use existing grading agent to analyze the pick
      const gradingResult = (await (this.gradingAgent as any).gradePick?.(pickForGrading)) || {
        tier: 'B',
        score: 50,
        expectedValue: 0,
        riskFactors: [],
        marketIntelligence: 'No analysis available',
      };

      return {
        systemGrade: gradingResult.tier,
        systemConfidence: Math.round(gradingResult.professional_score),
        capperConfidence: smartTicket.confidence_level * 10,
        expectedValue: gradingResult.expectedValue,
        riskFactors: gradingResult.riskFactors || [],
        marketIntelligence: gradingResult.marketIntelligence || 'No specific intelligence',
        featureScores: gradingResult.featureScores,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.warn('Failed to generate insights', {
        ticketId: smartTicket.id,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        systemGrade: 'C-tier',
        systemConfidence: 50,
        capperConfidence: smartTicket.confidence_level * 10,
        expectedValue: 0,
        riskFactors: ['Unable to analyze'],
        marketIntelligence: 'Analysis unavailable',
        featureScores: {},
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * SPRINT-DAILY-PICKS-CANONICAL-ENFORCEMENT-007: Enqueue to bridge_outbox
   * Canonical path: bridge_outbox → BridgeWorker → lifecycleInsert → unified_picks
   * SmartFormBridge must NOT write to unified_picks directly.
   */
  private async enqueueToBridgeOutbox(
    smartTicket: SmartTicket,
    pickData: any,
    insights: any,
    bridgeLogger: typeof logger
  ): Promise<string> {
    const betSlipId = `smartform-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const outboxEntry = {
      aggregate_id: betSlipId,
      event_type: 'ticket_submitted',
      event_data: {
        // Core pick data
        player_name: pickData.player_name,
        sport: pickData.sport,
        team: pickData.team,
        stat_type: pickData.stat_type,
        selection: pickData.outcome,
        line: pickData.line,
        odds: pickData.odds,
        direction: pickData.direction,
        // Game context
        game_date: pickData.game_date,
        matchup: pickData.matchup,
        capper: pickData.capper,
        unit_size: pickData.unit_size,
        stake: pickData.unit_size,
        bet_type: pickData.bet_type,
        // Market type for routing
        market_type: smartTicket.market_type,
        // Parlay tracking
        parlay_id: pickData.parlay_id,
        // Legs array (for BridgeWorker compatibility)
        legs: smartTicket.legs,
        // Source tracking
        source: 'smart_form',
        // Pre-computed insights (BridgeWorker can use these)
        pre_graded: {
          tier: insights.systemGrade,
          confidence: insights.systemConfidence,
        },
      },
      metadata: {
        bet_slip_id: betSlipId,
        source: 'smart_form_bridge',
        capper: pickData.capper,
        market_type: smartTicket.market_type,
      },
      idempotency_key: betSlipId,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    const { error } = await this.supabase.from('bridge_outbox').insert(outboxEntry);

    if (error) {
      throw new Error(`Failed to enqueue to bridge_outbox: ${error.message}`);
    }

    bridgeLogger.info('Enqueued ticket to bridge_outbox for BridgeWorker processing', {
      betSlipId,
      capper: pickData.capper,
      marketType: smartTicket.market_type,
    });

    return betSlipId;
  }

  /**
   * @deprecated SPRINT-DAILY-PICKS-CANONICAL-ENFORCEMENT-007
   * Use enqueueToBridgeOutbox instead. Direct unified_picks writes violate canonical path.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async _deprecatedStoreUnifiedPick(_pickData: any, _insights: any): Promise<string> {
    throw new Error(
      'DEPRECATED: Use enqueueToBridgeOutbox - direct unified_picks writes violate canonical path'
    );
  }

  /**
   * Store insights for system tracking and AI training
   */
  private async storeInsights(pickId: string, insights: any): Promise<void> {
    const { error } = await this.supabase.from('pick_insights').insert({
      pick_id: pickId,
      system_grade: insights.systemGrade,
      system_confidence: insights.systemConfidence,
      capper_confidence: insights.capperConfidence,
      expected_value: insights.expectedValue,
      risk_factors: insights.riskFactors,
      market_intelligence: insights.marketIntelligence,
      feature_scores: insights.featureScores,
      created_at: new Date().toISOString(),
    });

    if (error) {
      logger.warn('Failed to store insights', { pickId, error: error.message });
    }
  }

  /**
   * @deprecated SPRINT-DAILY-PICKS-CANONICAL-ENFORCEMENT-007
   * Live pick routing is now handled by BridgeWorker after processing bridge_outbox.
   * SmartFormBridge only enqueues to bridge_outbox.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async _deprecatedProcessLivePick(_pickId: string, _threadId: string): Promise<void> {
    // Routing is handled by BridgeWorker via bridge_outbox
    throw new Error('DEPRECATED: processLivePick - routing handled by BridgeWorker');
  }

  /**
   * @deprecated SPRINT-DAILY-PICKS-CANONICAL-ENFORCEMENT-007
   * Batch posting scheduling is now handled by BridgeWorker after processing bridge_outbox.
   * SmartFormBridge only enqueues to bridge_outbox.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async _deprecatedScheduleForBatchPosting(_pickId: string): Promise<void> {
    throw new Error('DEPRECATED: scheduleForBatchPosting - routing handled by BridgeWorker');
  }

  /**
   * Update smart ticket status with insights
   */
  private async updateSmartTicketStatus(
    ticketId: string,
    status: 'processed' | 'error',
    insights: any | null,
    errorMessage?: string
  ): Promise<void> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (insights) {
      updateData.insights = insights;
    }

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    const { error } = await this.supabase
      .from('smart_tickets')
      .update(updateData)
      .eq('id', ticketId);

    if (error) {
      logger.error('Failed to update smart ticket status', {
        ticketId,
        status,
        error: error.message,
      });
    }
  }

  /**
   * @deprecated SPRINT-DAILY-PICKS-CANONICAL-ENFORCEMENT-007
   * This method is no longer used. Picks are now stored directly to unified_picks
   * via storeUnifiedPick(). Kept for reference during transition period.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async _deprecatedPromoteToUnifiedPicks(
    _pickId: string,
    _dailyPick: any,
    _insights: any
  ): Promise<void> {
    throw new Error('DEPRECATED: Use storeUnifiedPick() instead - SPRINT-007');
  }

  /**
   * Send alert to system alerts Discord channel
   */
  private async sendSystemAlert(title: string, details: any): Promise<void> {
    // This will integrate with your Discord bot
    // For now, just log the alert
    logger.error('SYSTEM ALERT', {
      title,
      details,
      alertsChannelId: env.systemAlertsThreadId,
    });

    // TODO: Integrate with Discord bot to send actual alert
  }
}
