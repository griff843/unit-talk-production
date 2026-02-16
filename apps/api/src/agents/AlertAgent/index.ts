/* eslint-disable max-lines, max-lines-per-function, complexity, no-return-await */
import 'dotenv/config';
import { withCircuitBreaker, circuitBreaker } from '../../services/enhanced-circuit-breaker';
import { startMetricsServer } from '../../services/metricsServer';
import { BaseAgent } from '../BaseAgent/index';
import {
  BaseAgentConfig,
  BaseAgentDependencies,
  BaseMetrics,
  HealthStatus,
} from '../BaseAgent/types';
import { parsePromotionPolicyConfig } from '../GradingAgent/scoring/promotionPolicy';

import { getAdviceForPick } from './adviceEngine';
import { buildAlertEmbed } from './embedBuilder';
import { EventSubscriptionManager } from './EventSubscriptionManager';
import { sendDiscordAlert } from './integrations/discord';
// import { postToNotion } from '../../services/notion';
// import { updateRetoolTag } from '../../services/retool';
import { logAlertRecord } from './log';
// import { env } from '../../config/env';

interface AlertMetrics extends BaseMetrics {
  alertsSent: number;
  alertsFailed: number;
  duplicatesSkipped: number;
  avgProcessingTimeMs: number;
  llmCallsCount: number;
  llmFailures: number;
  circuitBreakerTrips: number;
  fallbacksUsed: number;
  // Override optional properties to be required
  errorCount: number;
  successCount: number;
}

export class AlertAgent extends BaseAgent {
  private alertMetrics: AlertMetrics;
  private rateLimiter: Map<string, number> = new Map(); // service -> last call timestamp
  private eventSubscriptionManager: EventSubscriptionManager | null = null;
  private readonly RATE_LIMITS: Record<string, number> = {
    discord: 2000, // 2 seconds between calls (30/min limit)
    openai: 100, // 100ms between calls
  };

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
    this.alertMetrics = {
      ...this.metrics,
      alertsSent: 0,
      alertsFailed: 0,
      duplicatesSkipped: 0,
      avgProcessingTimeMs: 0,
      llmCallsCount: 0,
      llmFailures: 0,
      circuitBreakerTrips: 0,
      fallbacksUsed: 0,
      errorCount: 0,
      successCount: 0,
    };
  }

  protected async initialize(): Promise<void> {
    this.logger.info('🚀 AlertAgent initializing with circuit breaker protection...');

    // Register custom circuit breaker configs for AlertAgent services
    circuitBreaker.registerService('openai-advice', {
      failureThreshold: 3,
      resetTimeoutMs: 45000, // 45 seconds for AI services
      timeoutMs: 20000, // 20 seconds for advice generation
      retryAttempts: 2,
    });

    circuitBreaker.registerService('discord-alerts', {
      failureThreshold: 5,
      resetTimeoutMs: 30000, // 30 seconds for Discord
      timeoutMs: 8000, // 8 seconds for Discord API
      retryAttempts: 3,
    });

    // Set up circuit breaker event listeners
    circuitBreaker.on('circuitOpened', event => {
      if (event.serviceName.includes('openai') || event.serviceName.includes('discord')) {
        this.alertMetrics.circuitBreakerTrips++;
        this.logger.error('⚡ Circuit breaker opened for AlertAgent service', event);
      }
    });

    circuitBreaker.on('operationSuccess', event => {
      if (event.serviceName.includes('openai') || event.serviceName.includes('discord')) {
        this.logger.debug('✅ Service call successful', event);
      }
    });

    // Ensure alerts log table exists and is accessible
    try {
      await withCircuitBreaker.supabase(
        async () => {
          if (this.hasSupabase()) {
            const { error } = await this.requireSupabase()
              .from('unit_talk_alerts_log')
              .select('count')
              .limit(1);

            if (error) {
              throw new Error(`Alert logging table not accessible: ${error.message}`);
            }
          } else {
            throw new Error('Supabase client not available');
          }
        },
        async () => {
          this.logger.warn('⚠️ Supabase health check failed, continuing without verification');
        }
      );
    } catch (error) {
      this.logger.warn('⚠️ Database initialization check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Initialize event-driven subscriptions
    if (this.hasSupabase()) {
      try {
        this.eventSubscriptionManager = new EventSubscriptionManager(
          this.requireSupabase(),
          this.logger,
          {
            batchSize: 10,
            processingTimeout: 30000,
            retryAttempts: 3,
            cooldownSeconds: 300, // 5 minutes
          }
        );

        await this.eventSubscriptionManager.setupEventSubscriptions();

        this.logger.info('🔗 Event-driven AlertAgent subscriptions established');
      } catch (error) {
        this.logger.error('❌ Failed to initialize event subscriptions, falling back to polling', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } else {
      this.logger.warn('⚠️ Supabase not available, AlertAgent running in polling-only mode');
    }
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('🧹 AlertAgent cleanup initiated...');

    // Cleanup event subscriptions
    if (this.eventSubscriptionManager) {
      try {
        await this.eventSubscriptionManager.cleanup();
        this.logger.info('✅ Event subscriptions cleaned up');
      } catch (error) {
        this.logger.warn('⚠️ Error during event subscription cleanup', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    this.rateLimiter.clear();
    this.logger.info('🧹 AlertAgent cleanup complete');
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    let eventSubscriptionMetrics = {};

    if (this.eventSubscriptionManager) {
      try {
        const subscriptionStatus = await this.eventSubscriptionManager.getSubscriptionStatus();
        eventSubscriptionMetrics = {
          activeSubscriptions: subscriptionStatus.active,
          totalSubscriptions: subscriptionStatus.total,
          subscriptionChannels: subscriptionStatus.channels,
        };
      } catch (error) {
        this.logger.warn('⚠️ Failed to collect event subscription metrics', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      ...this.alertMetrics,
      ...eventSubscriptionMetrics,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024,
    };
  }

  public async checkHealth(): Promise<HealthStatus> {
    const checks = [];

    // Check Supabase connectivity with circuit breaker
    try {
      await withCircuitBreaker.supabase(
        async () => {
          if (this.hasSupabase()) {
            await this.requireSupabase().from('unified_picks').select('count').limit(1);
            checks.push({ service: 'supabase', status: 'healthy' });
          } else {
            throw new Error('Client not available');
          }
        },
        async () => {
          checks.push({
            service: 'supabase',
            status: 'degraded',
            error: 'Circuit breaker protection active',
          });
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      checks.push({ service: 'supabase', status: 'unhealthy', error: errorMessage });
    }

    // Check OpenAI connectivity (basic) with circuit breaker status
    const openaiServiceStatus = circuitBreaker.getServiceStatus('openai-advice');
    const hasApiKey = !!process.env.OPENAI_API_KEY;

    if (!hasApiKey) {
      checks.push({ service: 'openai', status: 'unhealthy', error: 'Missing API key' });
    } else if (openaiServiceStatus?.state === 'OPEN') {
      checks.push({ service: 'openai', status: 'degraded', error: 'Circuit breaker open' });
    } else {
      checks.push({ service: 'openai', status: 'healthy' });
    }

    // Check Discord service status
    const discordServiceStatus = circuitBreaker.getServiceStatus('discord-alerts');
    if (discordServiceStatus?.state === 'OPEN') {
      checks.push({ service: 'discord', status: 'degraded', error: 'Circuit breaker open' });
    } else {
      checks.push({ service: 'discord', status: 'healthy' });
    }

    // Overall health considers circuit breaker status
    const healthyServices = checks.filter(check => check.status === 'healthy').length;
    const totalServices = checks.length;
    const healthPercentage = healthyServices / totalServices;

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (healthPercentage >= 1.0) {
      overallStatus = 'healthy';
    } else if (healthPercentage >= 0.5) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'unhealthy';
    }

    // Check event subscription health
    if (this.eventSubscriptionManager) {
      try {
        const subscriptionStatus = await this.eventSubscriptionManager.getSubscriptionStatus();
        if (
          subscriptionStatus.active === subscriptionStatus.total &&
          subscriptionStatus.total > 0
        ) {
          checks.push({ service: 'event-subscriptions', status: 'healthy' });
        } else if (subscriptionStatus.active > 0) {
          checks.push({
            service: 'event-subscriptions',
            status: 'degraded',
            error: 'Some subscriptions inactive',
          });
        } else {
          checks.push({
            service: 'event-subscriptions',
            status: 'unhealthy',
            error: 'No active subscriptions',
          });
        }
      } catch (error) {
        checks.push({
          service: 'event-subscriptions',
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } else {
      checks.push({
        service: 'event-subscriptions',
        status: 'degraded',
        error: 'Polling mode only',
      });
    }

    // Get circuit breaker health status
    const circuitBreakerHealth = circuitBreaker.getHealthStatus();

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      details: {
        checks,
        metrics: this.alertMetrics,
        circuitBreakerStatus: circuitBreakerHealth,
        serviceStates: {
          openai: openaiServiceStatus?.state || 'UNKNOWN',
          discord: discordServiceStatus?.state || 'UNKNOWN',
        },
      },
    };
  }

  public async startMetricsServer(): Promise<void> {
    const port = this.config.metrics?.port || 9005;
    startMetricsServer(port);
    this.logger.info(`📊 Metrics server started on port ${port}`);
  }

  private async enforceRateLimit(service: string): Promise<void> {
    const limit = this.RATE_LIMITS[service] as number | undefined;
    if (!limit) {
      return;
    }

    const lastCall = this.rateLimiter.get(service) || 0;
    const timeSinceLastCall = Date.now() - lastCall;

    if (timeSinceLastCall < limit) {
      const waitTime = limit - timeSinceLastCall;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.rateLimiter.set(service, Date.now());
  }

  private async isAlertAlreadySent(pick: any): Promise<boolean> {
    // Check database for persistent deduplication
    if (!this.hasSupabase()) {
      this.logger.warn('⚠️ Supabase not available, cannot check alert history');
      return false;
    }

    const { data, error } = await this.requireSupabase()
      .from('unit_talk_alerts_log')
      .select('bet_id')
      .eq('bet_id', pick.id)
      .eq('player', pick.player_name)
      .eq('bet_type', pick.bet_type)
      .eq('line', pick.line)
      .limit(1);

    if (error) {
      this.logger.warn('⚠️ Failed to check alert history, proceeding with send', {
        pickId: pick.id,
        error: error.message,
      });
      return false;
    }

    return data && data.length > 0;
  }

  protected async process(): Promise<void> {
    // In event-driven mode, we still run periodic polling for fallback coverage
    // and to catch any events that might have been missed
    const isEventDriven = this.eventSubscriptionManager !== null;
    const cycleType = isEventDriven ? 'fallback-polling' : 'primary-polling';

    this.logger.info(`🚨 Starting AlertAgent ${cycleType} cycle...`);
    const cycleStartTime = Date.now();

    if (!this.hasSupabase()) {
      this.logger.error('❌ Supabase client not available, cannot fetch picks');
      return;
    }

    const { data: picks, error } = await this.requireSupabase()
      .from('unified_picks')
      .select('*')
      .eq('play_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50); // Reduced from 100 for better performance

    if (error || !picks) {
      this.logger.error('❌ Failed to fetch final picks for alerts', {
        error: error?.message || 'No picks returned',
      });
      return;
    }

    this.logger.info(`📋 Processing ${picks.length} pending picks`);

    for (const pick of picks) {
      const pickStartTime = Date.now();

      try {
        // Check for duplicates using persistent storage
        if (await this.isAlertAlreadySent(pick)) {
          this.alertMetrics.duplicatesSkipped++;
          this.logger.debug(`⏭️ Skipping duplicate alert for pick [${pick.id}]`);
          continue;
        }

        // Rate limit OpenAI calls
        await this.enforceRateLimit('openai');

        // Get advice with circuit breaker protection
        const advice = await withCircuitBreaker.openai(
          async () => {
            this.alertMetrics.llmCallsCount++;
            return await getAdviceForPick(pick);
          },
          async () => {
            this.alertMetrics.fallbacksUsed++;
            this.logger.warn('🔄 Using fallback advice due to OpenAI circuit breaker');
            return `Strong player prop play for ${pick.player_name}. Monitor line movement. AI analysis temporarily unavailable - based on tier and historical performance.`;
          }
        );

        const embed = buildAlertEmbed(pick, advice);

        // Rate limit Discord calls
        await this.enforceRateLimit('discord');

        // Send alerts with circuit breaker protection
        await withCircuitBreaker.discord(
          async () => {
            await sendDiscordAlert(embed);
          },
          async () => {
            this.alertMetrics.fallbacksUsed++;
            this.logger.error('🚨 Discord alert failed, logging for manual review', {
              pickId: pick.id,
              playerName: pick.player_name,
              tier: pick.tier,
            });

            // Store failed alert for later retry
            if (this.hasSupabase()) {
              await this.requireSupabase().from('failed_alerts').insert({
                pick_id: pick.id,
                alert_data: embed,
                failure_reason: 'Discord circuit breaker open',
                created_at: new Date().toISOString(),
              });
            }
          }
        );

        // Log the alert for deduplication and analytics with circuit breaker
        await withCircuitBreaker.supabase(
          async () => {
            if (this.hasSupabase()) {
              await logAlertRecord(this.requireSupabase(), pick, advice);
            }
          },
          async () => {
            this.logger.warn('⚠️ Failed to log alert record, Supabase circuit breaker open', {
              pickId: pick.id,
            });
          }
        );

        this.alertMetrics.alertsSent++;
        this.alertMetrics.successCount++;

        const processingTime = Date.now() - pickStartTime;
        this.alertMetrics.avgProcessingTimeMs =
          (this.alertMetrics.avgProcessingTimeMs + processingTime) / 2;

        this.logger.info(
          `✅ Alert sent for pick [${pick.id}] - ${pick.player_name} (${processingTime}ms)`
        );
      } catch (err) {
        this.alertMetrics.alertsFailed++;
        this.alertMetrics.errorCount++;

        const error = err instanceof Error ? err : new Error('Unknown error');
        if (error.message?.includes('openai') || error.message?.includes('OpenAI')) {
          this.alertMetrics.llmFailures++;
        }

        this.logger.error(`❌ Failed to process pick [${pick.id}]`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          pickId: pick.id,
          playerName: pick.player_name,
          pickData: {
            id: pick.id,
            player: pick.player_name,
            market: pick.bet_type || 'player_props',
            tier: pick.tier,
          },
        });
      }
    }

    const totalCycleTime = Date.now() - cycleStartTime;
    this.alertMetrics.processingTimeMs = totalCycleTime;

    this.logger.info(`🏁 AlertAgent ${cycleType} cycle complete`, {
      totalPicks: picks?.length || 0,
      alertsSent: this.alertMetrics.alertsSent,
      duplicatesSkipped: this.alertMetrics.duplicatesSkipped,
      failures: this.alertMetrics.alertsFailed,
      cycleTimeMs: totalCycleTime,
      isEventDriven,
    });
  }

  /**
   * Check if AlertAgent is running in event-driven mode
   */
  public isEventDrivenMode(): boolean {
    return this.eventSubscriptionManager !== null;
  }

  /**
   * Get event subscription status for monitoring
   */
  public async getEventSubscriptionStatus(): Promise<any> {
    if (!this.eventSubscriptionManager) {
      return { mode: 'polling-only', subscriptions: [] };
    }

    try {
      const status = await this.eventSubscriptionManager.getSubscriptionStatus();
      return {
        mode: 'event-driven',
        ...status,
      };
    } catch (error) {
      return {
        mode: 'event-driven-error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ============================================================================
  // LIVE PICK POSTING - PRIMARY RESPONSIBILITY
  // ============================================================================

  /**
   * Monitor both live and scheduled picks for posting
   */
  public async monitorPicksForPosting(): Promise<void> {
    await Promise.all([this.monitorLivePicks(), this.monitorScheduledPicks()]);
  }

  /**
   * Monitor unified_picks table for live picks and post immediately
   */
  public async monitorLivePicks(): Promise<void> {
    if (!this.hasSupabase()) {
      this.logger.warn('⚠️ Supabase not available, skipping live pick monitoring');
      return;
    }

    // POSTING-AUTHORITY-001 Rule 3: Kill switch blocks ALL posting (AlertAgent path too)
    const promoCfg = parsePromotionPolicyConfig();
    if (promoCfg.killSwitch) {
      this.logger.info('POSTING-AUTHORITY: Kill switch active — AlertAgent live posting blocked');
      return;
    }

    try {
      const supabase = this.requireSupabase();

      // Query for live picks ready to post
      const { data: livePicks, error } = await supabase
        .from('unified_picks')
        .select('*')
        .eq('play_status', 'pending')
        .eq('posted_to_discord', false)
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch live picks: ${error.message}`);
      }

      if (livePicks && livePicks.length > 0) {
        this.logger.info(`🔴 Processing ${livePicks.length} live picks for immediate posting`);

        for (const pick of livePicks) {
          await this.postLivePick(pick);
          // Rate limiting between posts
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      this.logger.error('Error monitoring live picks', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  /**
   * Stage 6 — Claim-first idempotency for Discord posting.
   * Atomically sets posted_to_discord=true WHERE posted_to_discord=false.
   * Returns true if this agent won the claim, false if another agent already claimed it.
   */
  private async claimPickForDiscord(pickId: string): Promise<boolean> {
    if (!this.hasSupabase()) return false;

    const { data: claimed, error: claimErr } = await this.requireSupabase()
      .from('unified_picks')
      .update({ posted_to_discord: true, updated_at: new Date().toISOString() })
      .eq('id', pickId)
      .eq('posted_to_discord', false)
      .select('id');

    if (claimErr || !claimed || claimed.length === 0) {
      this.logger.info(
        { id: pickId },
        'Pick already claimed by another agent — skipping (idempotent)'
      );
      return false;
    }
    return true;
  }

  /**
   * Post individual live pick to Discord immediately
   */
  public async postLivePick(pickData: any): Promise<void> {
    const startTime = Date.now();

    try {
      // Stage 6: Claim-first — prevents races with DiscordPromotionAgent
      if (!(await this.claimPickForDiscord(pickData.id))) {
        this.alertMetrics.duplicatesSkipped++;
        return;
      }

      this.logger.info('🚨 Posting live pick to Discord', {
        pickId: pickData.id,
        capper: pickData.capper_username,
        tier: pickData.tier,
        betType: pickData.bet_type,
      });

      // Route to appropriate Discord thread
      const threadId = await this.routeToThread(pickData);

      // Format Discord embed for live pick
      const embed = await this.formatLivePickEmbed(pickData);

      // Post to Discord with circuit breaker protection
      const messageId = await withCircuitBreaker.discord(
        async () => {
          await sendDiscordAlert(embed);
          return `alert-${Date.now()}`; // Generate a messageId since Discord service doesn't return one
        },
        async () => {
          this.alertMetrics.fallbacksUsed++;
          this.logger.warn('🔄 Discord circuit breaker open, using fallback');
          // Fallback: Log pick for manual posting
          await this.logPickForManualPosting(pickData);
          return null;
        }
      );

      // Update discord_post_id (posted_to_discord already set by claim)
      if (messageId) {
        await this.updatePickDiscordPostId(pickData.id, messageId);
      }

      // Notify VIP users if high-tier pick
      if (pickData.tier === 'S-tier' || pickData.tier === 'A-tier') {
        await this.notifyVIPUsers(pickData);
      }

      // Update metrics
      this.alertMetrics.alertsSent++;
      this.alertMetrics.successCount++;
      this.alertMetrics.avgProcessingTimeMs =
        (this.alertMetrics.avgProcessingTimeMs + (Date.now() - startTime)) / 2;

      this.logger.info('✅ Successfully posted live pick to Discord', {
        pickId: pickData.id,
        threadId,
        messageId,
        tier: pickData.tier,
        processingTimeMs: Date.now() - startTime,
      });
    } catch (error) {
      // Update metrics
      this.alertMetrics.alertsFailed++;
      this.alertMetrics.errorCount++;

      this.logger.error('❌ Error posting live pick', {
        pickId: pickData.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        processingTimeMs: Date.now() - startTime,
      });

      // Claim retained on error — prevents duplicate retry spam.
      // Log for manual review instead.
      if (this.hasSupabase()) {
        await logAlertRecord(
          this.requireSupabase(),
          pickData,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }

  /**
   * Route pick to appropriate Discord thread based on capper and game context
   */
  private async routeToThread(pickData: any): Promise<string> {
    // Get capper thread from environment configuration
    const capperName = pickData.capper_username;
    const env = await import('../../config/env');
    const threadId = (env.env.capperThreads as any)[capperName];

    if (!threadId) {
      this.logger.warn('⚠️ No thread found for capper, using default', {
        capper: capperName,
        availableCappers: Object.keys(env.env.capperThreads),
      });
      // Fallback to admin alerts thread
      return process.env.SYSTEM_ALERTS_THREAD_ID || process.env.ADMIN_CHANNEL_ID || '';
    }

    return threadId;
  }

  /**
   * Format Discord embed for live picks with urgency indicators
   */
  private async formatLivePickEmbed(pickData: any): Promise<any> {
    const defaultAdvice = `Live pick alert for ${pickData.player_name}. Monitor closely for line movement.`;
    const embed = buildAlertEmbed(pickData, defaultAdvice);

    // Add live pick specific formatting
    const currentTitle = embed.data.title || '';
    embed
      .setTitle(`🔴 LIVE PICK: ${currentTitle}`)
      .setColor(0xff0000) // Red for live picks
      .setTimestamp(new Date());

    // Add urgency footer
    const existingFooter = embed.data.footer?.text || '';
    embed.setFooter({ text: `${existingFooter} • 🔴 LIVE ALERT`.trim() });

    return embed;
  }

  /**
   * Update pick with Discord posting information
   * @deprecated Stage 6 — prefer claimPickForDiscord() + updatePickDiscordPostId()
   */
  private async updatePickWithDiscordInfo(
    pickId: string,
    _threadId: string | null,
    messageId: string | null,
    status: string = 'posted'
  ): Promise<void> {
    if (!this.hasSupabase()) {
      this.logger.warn('⚠️ Supabase not available, cannot update pick status');
      return;
    }

    const updateData: any = {
      posted_to_discord: status === 'posted',
      updated_at: new Date().toISOString(),
    };

    if (messageId) updateData.discord_post_id = messageId;

    const { error } = await this.requireSupabase()
      .from('unified_picks')
      .update(updateData)
      .eq('id', pickId);

    if (error) {
      this.logger.error('Failed to update pick Discord info', {
        pickId,
        error: error.message,
      });
    }
  }

  /**
   * Stage 6 — Update discord_post_id after successful claim + post.
   * Does NOT touch posted_to_discord (already set by claimPickForDiscord).
   */
  private async updatePickDiscordPostId(pickId: string, messageId: string): Promise<void> {
    if (!this.hasSupabase()) return;

    const { error } = await this.requireSupabase()
      .from('unified_picks')
      .update({ discord_post_id: messageId, updated_at: new Date().toISOString() })
      .eq('id', pickId);

    if (error) {
      this.logger.error('Failed to update discord_post_id', { pickId, error: error.message });
    }
  }

  /**
   * Notify VIP users for high-tier picks
   */
  private async notifyVIPUsers(pickData: any): Promise<void> {
    try {
      // Import VIP notification service
      // const { VIPPlusChannelService } = await import('../../services/VIPPlusChannelService');
      // const vipService = new VIPPlusChannelService();

      // Note: VIP notification would need custom insights object
      // await vipService.postExclusiveAnalysis(pickData, insights, correlationId);

      this.logger.info('📱 VIP users notified for high-tier pick', {
        pickId: pickData.id,
        tier: pickData.tier,
      });
    } catch (error) {
      this.logger.error('Failed to notify VIP users', {
        pickId: pickData.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Log pick for manual posting when automated posting fails
   */
  private async logPickForManualPosting(pickData: any): Promise<void> {
    if (this.hasSupabase()) {
      await logAlertRecord(
        this.requireSupabase(),
        pickData,
        'Automatic posting failed - requires manual review'
      );
    }

    this.logger.warn('📝 Pick logged for manual posting', {
      pickId: pickData.id,
      capper: pickData.capper_username,
      tier: pickData.tier,
    });
  }

  /**
   * Monitor for scheduled picks (10 AM EST batch posting)
   */
  public async monitorScheduledPicks(): Promise<void> {
    if (!this.hasSupabase()) {
      this.logger.warn('⚠️ Supabase not available, skipping scheduled pick monitoring');
      return;
    }

    // POSTING-AUTHORITY-001 Rule 3: Kill switch blocks ALL posting
    const scheduledPromoCfg = parsePromotionPolicyConfig();
    if (scheduledPromoCfg.killSwitch) {
      this.logger.info(
        'POSTING-AUTHORITY: Kill switch active — AlertAgent scheduled posting blocked'
      );
      return;
    }

    try {
      const now = new Date();
      const currentHour = now.getHours();

      // Only run at 10 AM EST (15 UTC)
      if (currentHour !== 15) return;

      const supabase = this.requireSupabase();

      const { data: scheduledPicks, error } = await supabase
        .from('unified_picks')
        .select('*')
        .eq('play_status', 'pending')
        .eq('source', 'smart_form_bridge')
        .eq('posted_to_discord', false)
        .lte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()); // Yesterday's picks

      if (error) {
        throw new Error(`Failed to fetch scheduled picks: ${error.message}`);
      }

      if (scheduledPicks && scheduledPicks.length > 0) {
        this.logger.info(
          `📅 Processing ${scheduledPicks.length} scheduled picks for 10 AM batch posting`
        );

        for (const pick of scheduledPicks) {
          // Use the same posting logic but with scheduled formatting
          await this.postScheduledPick(pick);
          // Rate limiting between posts
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      this.logger.error('Error monitoring scheduled picks', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  /**
   * Post scheduled pick with batch formatting
   */
  private async postScheduledPick(pickData: any): Promise<void> {
    const startTime = Date.now();

    try {
      // Stage 6: Claim-first — prevents races with DiscordPromotionAgent
      if (!(await this.claimPickForDiscord(pickData.id))) {
        this.alertMetrics.duplicatesSkipped++;
        return;
      }

      this.logger.info('📅 Posting scheduled pick to Discord', {
        pickId: pickData.id,
        capper: pickData.capper_username,
        tier: pickData.tier,
      });

      // Route to appropriate Discord thread
      const threadId = await this.routeToThread(pickData);

      // Format Discord embed for scheduled pick (less urgent than live)
      const embed = await this.formatScheduledPickEmbed(pickData);

      // Post to Discord with circuit breaker protection
      const messageId = await withCircuitBreaker.discord(
        async () => {
          await sendDiscordAlert(embed);
          return `alert-${Date.now()}`; // Generate a messageId since Discord service doesn't return one
        },
        async () => {
          this.alertMetrics.fallbacksUsed++;
          this.logger.warn('🔄 Discord circuit breaker open, using fallback');
          await this.logPickForManualPosting(pickData);
          return null;
        }
      );

      // Update discord_post_id (posted_to_discord already set by claim)
      if (messageId) {
        await this.updatePickDiscordPostId(pickData.id, messageId);
      }

      // Update metrics
      this.alertMetrics.alertsSent++;
      this.alertMetrics.successCount++;
      this.alertMetrics.avgProcessingTimeMs =
        (this.alertMetrics.avgProcessingTimeMs + (Date.now() - startTime)) / 2;

      this.logger.info('✅ Successfully posted scheduled pick to Discord', {
        pickId: pickData.id,
        threadId,
        messageId,
        tier: pickData.tier,
        processingTimeMs: Date.now() - startTime,
      });
    } catch (error) {
      // Update metrics
      this.alertMetrics.alertsFailed++;
      this.alertMetrics.errorCount++;

      this.logger.error('❌ Error posting scheduled pick', {
        pickId: pickData.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        processingTimeMs: Date.now() - startTime,
      });

      // Claim retained on error — prevents duplicate retry spam.
      // Log for manual review instead.
      if (this.hasSupabase()) {
        await logAlertRecord(
          this.requireSupabase(),
          pickData,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }

  /**
   * Format Discord embed for scheduled picks (less urgent styling)
   */
  private async formatScheduledPickEmbed(pickData: any): Promise<any> {
    const defaultAdvice = `Scheduled pick for ${pickData.player_name}. Strong value identified.`;
    const embed = buildAlertEmbed(pickData, defaultAdvice);

    // Add scheduled pick specific formatting
    const currentTitle = embed.data.title || '';
    embed
      .setTitle(`📅 DAILY PICK: ${currentTitle}`)
      .setColor(0x00aa00) // Green for scheduled picks
      .setTimestamp(new Date());

    // Add batch footer
    const existingFooter = embed.data.footer?.text || '';
    embed.setFooter({ text: `${existingFooter} • 📅 10 AM BATCH`.trim() });

    return embed;
  }

  /**
   * Post approved pick to Discord (alias for postLivePick for backward compatibility)
   * Used by smoke tests and legacy code
   */
  public async postApprovedPickToDiscord(pickData: any): Promise<void> {
    return this.postLivePick(pickData);
  }
}
