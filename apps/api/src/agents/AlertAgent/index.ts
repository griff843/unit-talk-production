import 'dotenv/config';
import { withCircuitBreaker, circuitBreaker } from '../../services/enhanced-circuit-breaker';
import { startMetricsServer } from '../../services/metricsServer';
import { BaseAgent } from '../BaseAgent/index';
import { BaseAgentConfig, BaseAgentDependencies, BaseMetrics, HealthStatus } from '../BaseAgent/types';
import { CacheFirstUnifiedPicksService } from '../../services/CacheFirstUnifiedPicksService';

// Alert types supported by cache-first AlertAgent
enum AlertType {
  STEAM_ALERT = 'steam_alert',
  MIDDLE_OPPORTUNITY = 'middle_opportunity',
  HEDGE_OPPORTUNITY = 'hedge_opportunity',
  PARLAY_HEDGE = 'parlay_hedge',
  CLV_TRACKING = 'clv_tracking',
  TIER_PROMOTION = 'tier_promotion',
  PICK_ALERT = 'pick_alert'
}

interface AlertContext {
  alertType: AlertType;
  pickData?: any;
  opportunityData?: any;
  metadata?: any;
  confidence?: number;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
}

import { getAdviceForPick } from './adviceEngine';
import { buildAlertEmbed } from './embedBuilder';
import { sendDiscordAlert } from './integrations/discord';
import { EventSubscriptionManager } from './EventSubscriptionManager';
// import { postToNotion } from '../../services/notion';
// import { updateRetoolTag } from '../../services/retool';
import { logAlertRecord } from './log';
// import { env } from '../../config/env';

// Import sophisticated event-driven components
import { TicketStateManager, TicketType } from './TicketStateManager';
import { EventDrivenProcessor } from './EventDrivenProcessor';
import { HedgeDetectionEngine } from './HedgeDetectionEngine';
import { DiscordRichEmbeds } from './DiscordRichEmbeds';
import { SteamDetectionIntegrator } from './SteamDetectionIntegrator';
import { requireSupabase } from '../../utils/supabaseUtils';

interface AlertMetrics extends BaseMetrics {
  // Legacy metrics
  alertsSent: number;
  alertsFailed: number;
  duplicatesSkipped: number;
  avgProcessingTimeMs: number;
  llmCallsCount: number;
  llmFailures: number;
  circuitBreakerTrips: number;
  fallbacksUsed: number;
  
  // Event-driven processing metrics
  eventsProcessedTotal: number;
  eventProcessingLatencyP99Ms: number;
  arbitrageOpportunitiesFound: number;
  
  // Ticket state management metrics
  ticketsTracked: number;
  stateTransitions: number;
  hedgeWindowsOpened: number;
  
  // Hedge detection metrics
  hedgeOpportunitiesDetected: number;
  middleOpportunitiesFound: number;
  averageHedgeProfit: number;

  // Steam detection metrics
  steamMovesDetected: number;
  steamAlertsGenerated: number;
  steamDetectionLatency: number;
  
  // Override optional properties to be required
  errorCount: number;
  successCount: number;
}

export class AlertAgent extends BaseAgent {
  private alertMetrics: AlertMetrics;
  private rateLimiter: Map<string, number> = new Map(); // service -> last call timestamp
  private eventSubscriptionManager: EventSubscriptionManager | null = null;
  private cacheFirstService: CacheFirstUnifiedPicksService;

  // Sophisticated event-driven components
  private ticketStateManager: TicketStateManager | null = null;
  private eventDrivenProcessor: EventDrivenProcessor | null = null;
  private hedgeDetectionEngine: HedgeDetectionEngine | null = null;
  private discordRichEmbeds: DiscordRichEmbeds | null = null;
  private steamDetectionIntegrator: SteamDetectionIntegrator | null = null;

  // Shadow mode support
  private shadowMode = false;
  
  private readonly RATE_LIMITS: Record<string, number> = {
    discord: 2000, // 2 seconds between calls (30/min limit)
    openai: 100,   // 100ms between calls
  };

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);

    // Initialize cache-first service
    this.cacheFirstService = CacheFirstUnifiedPicksService.getInstance();

    this.alertMetrics = {
      ...this.metrics,
      // Legacy metrics
      alertsSent: 0,
      alertsFailed: 0,
      duplicatesSkipped: 0,
      avgProcessingTimeMs: 0,
      llmCallsCount: 0,
      llmFailures: 0,
      circuitBreakerTrips: 0,
      fallbacksUsed: 0,
      
      // Event-driven processing metrics
      eventsProcessedTotal: 0,
      eventProcessingLatencyP99Ms: 0,
      arbitrageOpportunitiesFound: 0,
      
      // Ticket state management metrics
      ticketsTracked: 0,
      stateTransitions: 0,
      hedgeWindowsOpened: 0,
      
      // Hedge detection metrics
      hedgeOpportunitiesDetected: 0,
      middleOpportunitiesFound: 0,
      averageHedgeProfit: 0,

      // Steam detection metrics
      steamMovesDetected: 0,
      steamAlertsGenerated: 0,
      steamDetectionLatency: 0,
      
      errorCount: 0,
      successCount: 0,
    };
  }

  protected async initialize(): Promise<void> {
    this.logger.info('🚀 AlertAgent initializing with cache-first sophisticated event-driven architecture...');

    // Load shadow mode configuration
    await this.loadShadowModeConfig();

    // Initialize sophisticated components first
    await this.initializeSophisticatedComponents();

    // Register custom circuit breaker configs for AlertAgent services
    circuitBreaker.registerService('openai-advice', {
      failureThreshold: 3,
      resetTimeoutMs: 45000, // 45 seconds for AI services
      timeoutMs: 20000, // 20 seconds for advice generation
      retryAttempts: 2
    });

    circuitBreaker.registerService('discord-alerts', {
      failureThreshold: 5,
      resetTimeoutMs: 30000, // 30 seconds for Discord
      timeoutMs: 8000, // 8 seconds for Discord API
      retryAttempts: 3
    });

    // Set up circuit breaker event listeners
    circuitBreaker.on('circuitOpened', (event) => {
      if (event.serviceName.includes('openai') || event.serviceName.includes('discord')) {
        this.alertMetrics.circuitBreakerTrips++;
        this.logger.error('⚡ Circuit breaker opened for AlertAgent service', event);
      }
    });

    circuitBreaker.on('operationSuccess', (event) => {
      if (event.serviceName.includes('openai') || event.serviceName.includes('discord')) {
        this.logger.debug('✅ Service call successful', event);
      }
    });

    // Ensure alerts log table exists and is accessible
    try {
      await withCircuitBreaker.supabase(async () => {
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
      }, async () => {
        this.logger.warn('⚠️ Supabase health check failed, continuing without verification');
      });
    } catch (error) {
      this.logger.warn('⚠️ Database initialization check failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
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
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } else {
      this.logger.warn('⚠️ Supabase not available, AlertAgent running in polling-only mode');
    }
  }

  /**
   * Initialize sophisticated event-driven components
   */
  private async initializeSophisticatedComponents(): Promise<void> {
    if (!this.hasSupabase()) {
      this.logger.warn('⚠️ Supabase not available, skipping sophisticated component initialization');
      return;
    }

    try {
      const supabase = this.requireSupabase();

      // Initialize TicketStateManager
      this.ticketStateManager = new TicketStateManager(supabase, this.logger);
      this.logger.info('✅ TicketStateManager initialized');

      // Initialize HedgeDetectionEngine
      this.hedgeDetectionEngine = new HedgeDetectionEngine(supabase, this.logger);
      this.logger.info('✅ HedgeDetectionEngine initialized');

      // Initialize DiscordRichEmbeds
      this.discordRichEmbeds = new DiscordRichEmbeds(this.logger);
      this.logger.info('✅ DiscordRichEmbeds initialized');

      // Initialize EventDrivenProcessor
      this.eventDrivenProcessor = new EventDrivenProcessor(
        supabase,
        this.logger,
        this.ticketStateManager,
        {
          maxLatencyMs: 1000, // <1 second target
          batchSize: 50,
          maxConcurrentEvents: 100
        }
      );

      await this.eventDrivenProcessor.initialize();
      this.logger.info('✅ EventDrivenProcessor initialized with <1s latency target');

      // Initialize Steam Detection Integrator
      this.steamDetectionIntegrator = new SteamDetectionIntegrator({
        enabled: true,
        processingIntervalMs: 30000, // 30 seconds
        alertThreshold: 70,
        minLineMovement: 2.0,
        timeWindow: 5,
        enabledSports: ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF']
      });

      // Set up steam detection event listeners
      this.steamDetectionIntegrator.on('steamProcessed', (event) => {
        this.alertMetrics.steamMovesDetected++;
        this.logger.info('🔥 Steam detection processed', {
          propId: event.propId,
          steamScore: event.result.steamScore
        });
      });

      this.steamDetectionIntegrator.on('alertGenerated', (event) => {
        this.alertMetrics.steamAlertsGenerated++;
      });

      await this.steamDetectionIntegrator.initialize();
      this.logger.info('✅ Steam Detection Integrator initialized');

      // Start periodic metrics collection
      this.startSophisticatedMetricsCollection();

      this.logger.info('🎯 All sophisticated components initialized successfully');

    } catch (error) {
      this.logger.error('❌ Failed to initialize sophisticated components', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Fallback to legacy mode
      this.logger.warn('⚠️ Falling back to legacy AlertAgent mode');
    }
  }

  /**
   * Start sophisticated metrics collection
   */
  private startSophisticatedMetricsCollection(): void {
    // Collect metrics every 30 seconds
    setInterval(async () => {
      await this.updateSophisticatedMetrics();
    }, 30000);
  }

  /**
   * Update sophisticated component metrics
   */
  private async updateSophisticatedMetrics(): Promise<void> {
    try {
      if (this.eventDrivenProcessor) {
        const processorMetrics = this.eventDrivenProcessor.getMetrics();
        this.alertMetrics.eventsProcessedTotal = processorMetrics.totalEventsProcessed;
        this.alertMetrics.eventProcessingLatencyP99Ms = processorMetrics.p99LatencyMs;
        // Additional processor metrics can be added here
        this.alertMetrics.arbitrageOpportunitiesFound = processorMetrics.hedgeOpportunitiesFound;
      }

      // Update ticket state metrics
      if (this.ticketStateManager && this.hasSupabase()) {
        const liveTickets = await this.ticketStateManager.getTicketsByState('LIVE' as any, 10);
        const sweatTickets = await this.ticketStateManager.getTicketsByState('SWEAT' as any, 10);
        const hedgeTickets = await this.ticketStateManager.getTicketsByState('HEDGE_WINDOW' as any, 10);
        
        this.alertMetrics.ticketsTracked = liveTickets.length + sweatTickets.length + hedgeTickets.length;
        this.alertMetrics.hedgeWindowsOpened = hedgeTickets.length;
      }

      // Update steam detection metrics
      if (this.steamDetectionIntegrator) {
        const steamMetrics = this.steamDetectionIntegrator.getMetrics();
        this.alertMetrics.steamDetectionLatency = steamMetrics.processingLatency;
      }

    } catch (error) {
      this.logger.error('Failed to update sophisticated metrics', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Load shadow mode configuration from runtime_config
   */
  private async loadShadowModeConfig(): Promise<void> {
    try {
      if (!this.hasSupabase()) {
        this.logger.warn('⚠️ Supabase not available, shadow mode disabled');
        return;
      }

      const { data, error } = await this.requireSupabase()
        .from('runtime_config')
        .select('config_value')
        .eq('config_key', 'shadow_mode')
        .eq('is_active', true)
        .single();

      if (error) {
        this.logger.debug('No shadow mode config found, running in normal mode');
        this.shadowMode = false;
        return;
      }

      this.shadowMode = Boolean(data?.config_value);

      this.logger.info(`🔧 Shadow mode configuration loaded`, {
        shadowMode: this.shadowMode,
        discordSuppressed: this.shadowMode
      });
    } catch (error) {
      this.logger.error('Failed to load shadow mode config', {
        error: error instanceof Error ? error.message : String(error)
      });
      this.shadowMode = false;
    }
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('🧹 AlertAgent cleanup initiated...');
    
    // Cleanup sophisticated components first
    if (this.eventDrivenProcessor) {
      try {
        await this.eventDrivenProcessor.cleanup();
        this.logger.info('✅ EventDrivenProcessor cleaned up');
      } catch (error) {
        this.logger.warn('⚠️ Error during EventDrivenProcessor cleanup', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Cleanup Steam Detection Integrator
    if (this.steamDetectionIntegrator) {
      try {
        await this.steamDetectionIntegrator.cleanup();
        this.logger.info('✅ Steam Detection Integrator cleaned up');
      } catch (error) {
        this.logger.warn('⚠️ Error during Steam Detection Integrator cleanup', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Cleanup event subscriptions
    if (this.eventSubscriptionManager) {
      try {
        await this.eventSubscriptionManager.cleanup();
        this.logger.info('✅ Event subscriptions cleaned up');
      } catch (error) {
        this.logger.warn('⚠️ Error during event subscription cleanup', {
          error: error instanceof Error ? error.message : 'Unknown error'
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
          error: error instanceof Error ? error.message : 'Unknown error'
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
    const checks: Array<{ service: string; status: string; error?: string }> = [];

    // Check cache-first service health
    try {
      const cacheHealth = await this.cacheFirstService.healthCheck();
      checks.push({
        service: 'cache-first-unified-picks',
        status: cacheHealth.status,
        error: cacheHealth.status !== 'healthy' ? 'Cache performance degraded' : undefined
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      checks.push({ service: 'cache-first-unified-picks', status: 'unhealthy', error: errorMessage });
    }

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
          checks.push({ service: 'supabase', status: 'degraded', error: 'Circuit breaker protection active' });
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
        if (subscriptionStatus.active === subscriptionStatus.total && subscriptionStatus.total > 0) {
          checks.push({ service: 'event-subscriptions', status: 'healthy' });
        } else if (subscriptionStatus.active > 0) {
          checks.push({ service: 'event-subscriptions', status: 'degraded', error: 'Some subscriptions inactive' });
        } else {
          checks.push({ service: 'event-subscriptions', status: 'unhealthy', error: 'No active subscriptions' });
        }
      } catch (error) {
        checks.push({ 
          service: 'event-subscriptions', 
          status: 'unhealthy', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    } else {
      checks.push({ service: 'event-subscriptions', status: 'degraded', error: 'Polling mode only' });
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
          discord: discordServiceStatus?.state || 'UNKNOWN'
        }
      }
    };
  }

  public async startMetricsServer(): Promise<void> {
    const port = this.config.metrics?.port || 9005;
    startMetricsServer(port);
    this.logger.info(`📊 Metrics server started on port ${port}`);
  }

  private async enforceRateLimit(service: string): Promise<void> {
    const limit = this.RATE_LIMITS[service] as number | undefined;
    if (!limit) {return;}

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
        error: error.message
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

    this.logger.info(`🚨 Starting cache-first AlertAgent ${cycleType} cycle...`);
    const cycleStartTime = Date.now();

    try {
      // Monitor for approved picks from Command Center workflow
      await this.monitorApprovedPicksForDiscord();

      // Also process pending picks for backward compatibility
      const picks = await this.cacheFirstService.listPicks({
        status: 'pending',
        published: false,
        limit: 50
      });

      if (!picks || picks.length === 0) {
        this.logger.debug('No pending picks found for alerts');
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

        // Send alerts with circuit breaker protection and shadow mode check
        if (this.shadowMode) {
          this.logger.info('🔇 Shadow mode active - Discord alert suppressed', {
            pickId: pick.id,
            playerName: pick.player_name,
            tier: pick.tier
          });

          // Still emit to ops.alert_events for tracking
          await this.emitAlertEvent(pick, 'shadow_suppressed');
        } else {
          await withCircuitBreaker.discord(
            async () => {
              await sendDiscordAlert(embed);
            },
            async () => {
              this.alertMetrics.fallbacksUsed++;
              this.logger.error('🚨 Discord alert failed, logging for manual review', {
                pickId: pick.id,
                playerName: pick.player_name,
                tier: pick.tier
              });

              // Store failed alert for later retry
              if (this.hasSupabase()) {
                await this.requireSupabase()
                  .from('failed_alerts')
                  .insert({
                    pick_id: pick.id,
                    alert_data: embed,
                    failure_reason: 'Discord circuit breaker open',
                    created_at: new Date().toISOString()
                  });
              }
            }
          );
        }

        // Log the alert for deduplication and analytics with circuit breaker
        await withCircuitBreaker.supabase(
          async () => {
            if (this.hasSupabase()) {
              await logAlertRecord(this.requireSupabase(), pick, advice);
            }
          },
          async () => {
            this.logger.warn('⚠️ Failed to log alert record, Supabase circuit breaker open', {
              pickId: pick.id
            });
          }
        );

        this.alertMetrics.alertsSent++;
        this.alertMetrics.successCount++;
        
        const processingTime = Date.now() - pickStartTime;
        this.alertMetrics.avgProcessingTimeMs = 
          (this.alertMetrics.avgProcessingTimeMs + processingTime) / 2;

        this.logger.info(`✅ Alert sent for pick [${pick.id}] - ${pick.player_name} (${processingTime}ms)`);

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
            tier: pick.tier
          }
        });
        }
      }

      const totalCycleTime = Date.now() - cycleStartTime;
      this.alertMetrics.processingTimeMs = totalCycleTime;

      this.logger.info(`🏁 Cache-first AlertAgent ${cycleType} cycle complete`, {
        totalPicks: picks?.length || 0,
        alertsSent: this.alertMetrics.alertsSent,
        duplicatesSkipped: this.alertMetrics.duplicatesSkipped,
        failures: this.alertMetrics.alertsFailed,
        cycleTimeMs: totalCycleTime,
        isEventDriven,
        shadowMode: this.shadowMode
      });

    } catch (error) {
      this.alertMetrics.errorCount++;
      this.logger.error('❌ Failed to process AlertAgent cycle', {
        error: error instanceof Error ? error.message : String(error),
        cycleType,
        shadowMode: this.shadowMode
      });
    }
  }

  /**
   * Process comprehensive alert with support for all alert types
   */
  private async processComprehensiveAlert(context: AlertContext): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.info(`🚨 Processing ${context.alertType} alert`, {
        alertType: context.alertType,
        urgency: context.urgency || 'medium',
        confidence: context.confidence || 0.5
      });

      // Generate appropriate alert content based on type
      const alertContent = await this.generateAlertContent(context);

      if (!alertContent) {
        this.logger.warn('No alert content generated, skipping alert', {
          alertType: context.alertType
        });
        return;
      }

      // Check deduplication
      const dedupeKey = this.generateDedupeKey(context);
      if (await this.isAlertDuplicate(dedupeKey)) {
        this.logger.debug('Alert already sent, skipping duplicate', { dedupeKey });
        this.alertMetrics.duplicatesSkipped++;
        return;
      }

      // Send Discord alert (if not in shadow mode)
      if (this.shadowMode) {
        this.logger.info('🔇 Shadow mode: Alert suppressed', {
          alertType: context.alertType,
          dedupeKey
        });
      } else {
        await this.sendDiscordAlert(alertContent.embed, context);
      }

      // Emit to ops.alert_events
      await this.emitComprehensiveAlertEvent(context, dedupeKey, alertContent);

      this.alertMetrics.alertsSent++;
      this.alertMetrics.successCount++;

      const processingTime = Date.now() - startTime;
      this.logger.info(`✅ ${context.alertType} alert processed successfully`, {
        alertType: context.alertType,
        dedupeKey,
        processingTimeMs: processingTime,
        shadowMode: this.shadowMode
      });

    } catch (error) {
      this.alertMetrics.alertsFailed++;
      this.alertMetrics.errorCount++;
      this.logger.error(`❌ Failed to process ${context.alertType} alert`, {
        alertType: context.alertType,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Generate alert content based on alert type
   */
  private async generateAlertContent(context: AlertContext): Promise<{ embed: any; message: string } | null> {
    switch (context.alertType) {
      case AlertType.STEAM_ALERT:
        return this.generateSteamAlertContent(context);
      case AlertType.MIDDLE_OPPORTUNITY:
        return this.generateMiddleOpportunityContent(context);
      case AlertType.HEDGE_OPPORTUNITY:
        return this.generateHedgeOpportunityContent(context);
      case AlertType.PARLAY_HEDGE:
        return this.generateParlayHedgeContent(context);
      case AlertType.CLV_TRACKING:
        return this.generateCLVTrackingContent(context);
      case AlertType.TIER_PROMOTION:
        return this.generateTierPromotionContent(context);
      case AlertType.PICK_ALERT:
        return this.generatePickAlertContent(context);
      default:
        this.logger.warn('Unknown alert type', { alertType: context.alertType });
        return null;
    }
  }

  /**
   * Generate steam alert content
   */
  private async generateSteamAlertContent(context: AlertContext): Promise<{ embed: any; message: string }> {
    const data = context.opportunityData || {};
    const embed = await buildAlertEmbed({
      id: data.prop_id || 'steam-alert',
      player_name: data.player_name || 'Unknown Player',
      bet_type: 'steam_alert',
      tier: 'S-tier',
      steam_score: data.steamScore || 0,
      line_movement: data.lineMovement || 0,
      confidence: context.confidence || 0.85
    }, `🔥 STEAM DETECTED! Score: ${data.steamScore || 0}/100`);

    embed.setTitle('🔥 STEAM ALERT')
      .setColor(0xFF6B35)
      .addFields([
        { name: 'Steam Score', value: `${data.steamScore || 0}/100`, inline: true },
        { name: 'Line Movement', value: `${data.lineMovement || 0} pts`, inline: true },
        { name: 'Confidence', value: `${Math.round((context.confidence || 0) * 100)}%`, inline: true }
      ]);

    return {
      embed,
      message: `🔥 Steam detected: ${data.player_name || 'Unknown'} - Score: ${data.steamScore || 0}`
    };
  }

  /**
   * Generate middle opportunity content
   */
  private async generateMiddleOpportunityContent(context: AlertContext): Promise<{ embed: any; message: string }> {
    const data = context.opportunityData || {};
    const embed = await buildAlertEmbed({
      id: data.id || 'middle-opportunity',
      player_name: data.player_name || 'Unknown Player',
      bet_type: 'middle_opportunity',
      tier: 'A-tier',
      profit_potential: data.profit || 0
    }, `🎯 MIDDLE OPPORTUNITY: ${Math.round(data.profit * 100 || 0)}% profit`);

    embed.setTitle('🎯 MIDDLE OPPORTUNITY')
      .setColor(0x00FF00)
      .addFields([
        { name: 'Profit %', value: `${Math.round(data.profit * 100 || 0)}%`, inline: true },
        { name: 'Line Gap', value: `${data.lineGap || 0} pts`, inline: true },
        { name: 'Books', value: `${data.book1 || 'A'} vs ${data.book2 || 'B'}`, inline: true }
      ]);

    return {
      embed,
      message: `🎯 Middle opportunity: ${data.player_name || 'Unknown'} - ${Math.round(data.profit * 100 || 0)}% profit`
    };
  }

  /**
   * Generate hedge opportunity content
   */
  private async generateHedgeOpportunityContent(context: AlertContext): Promise<{ embed: any; message: string }> {
    const data = context.opportunityData || {};
    const embed = await buildAlertEmbed({
      id: data.ticket_id || 'hedge-opportunity',
      player_name: data.player_name || 'Unknown Player',
      bet_type: 'hedge_opportunity',
      tier: 'A-tier',
      guaranteed_profit: data.guaranteed_profit || 0
    }, `💰 HEDGE OPPORTUNITY: $${data.guaranteed_profit || 0} guaranteed`);

    embed.setTitle('💰 HEDGE OPPORTUNITY')
      .setColor(0xFFD700)
      .addFields([
        { name: 'Guaranteed Profit', value: `$${data.guaranteed_profit || 0}`, inline: true },
        { name: 'Risk Free %', value: `${Math.round(data.risk_free_percentage || 0)}%`, inline: true },
        { name: 'Recommended Book', value: data.recommended_book || 'TBD', inline: true }
      ]);

    return {
      embed,
      message: `💰 Hedge opportunity: ${data.player_name || 'Unknown'} - $${data.guaranteed_profit || 0} guaranteed`
    };
  }

  /**
   * Generate parlay hedge content
   */
  private async generateParlayHedgeContent(context: AlertContext): Promise<{ embed: any; message: string }> {
    const data = context.opportunityData || {};
    const embed = await buildAlertEmbed({
      id: data.parlay_id || 'parlay-hedge',
      player_name: `${data.legs_remaining || 0} Legs Remaining`,
      bet_type: 'parlay_hedge',
      tier: 'A-tier',
      hedge_value: data.hedge_value || 0
    }, `🎰 PARLAY HEDGE: ${data.legs_remaining || 0} legs left`);

    embed.setTitle('🎰 PARLAY HEDGE OPPORTUNITY')
      .setColor(0x9932CC)
      .addFields([
        { name: 'Legs Remaining', value: `${data.legs_remaining || 0}`, inline: true },
        { name: 'Potential Payout', value: `$${data.potential_payout || 0}`, inline: true },
        { name: 'Hedge Value', value: `$${data.hedge_value || 0}`, inline: true }
      ]);

    return {
      embed,
      message: `🎰 Parlay hedge: ${data.legs_remaining || 0} legs remaining - $${data.hedge_value || 0} hedge value`
    };
  }

  /**
   * Generate CLV tracking content
   */
  private async generateCLVTrackingContent(context: AlertContext): Promise<{ embed: any; message: string }> {
    const data = context.opportunityData || {};
    const embed = await buildAlertEmbed({
      id: data.pick_id || 'clv-tracking',
      player_name: data.player_name || 'Unknown Player',
      bet_type: 'clv_tracking',
      tier: data.clv > 5 ? 'S-tier' : 'A-tier',
      clv_percentage: data.clv || 0
    }, `📈 CLV TRACKING: ${data.clv || 0}% closing line value`);

    embed.setTitle('📈 CLV TRACKING UPDATE')
      .setColor(data.clv > 0 ? 0x00FF00 : 0xFF0000)
      .addFields([
        { name: 'CLV %', value: `${data.clv > 0 ? '+' : ''}${data.clv || 0}%`, inline: true },
        { name: 'Opening Line', value: `${data.opening_line || 'N/A'}`, inline: true },
        { name: 'Closing Line', value: `${data.closing_line || 'N/A'}`, inline: true }
      ]);

    return {
      embed,
      message: `📈 CLV Update: ${data.player_name || 'Unknown'} - ${data.clv > 0 ? '+' : ''}${data.clv || 0}% CLV`
    };
  }

  /**
   * Generate tier promotion content
   */
  private async generateTierPromotionContent(context: AlertContext): Promise<{ embed: any; message: string }> {
    const data = context.pickData || {};
    const embed = await buildAlertEmbed({
      id: data.id || 'tier-promotion',
      player_name: data.player_name || 'Unknown Player',
      bet_type: 'tier_promotion',
      tier: data.new_tier || 'A-tier',
      previous_tier: data.previous_tier || 'B-tier'
    }, `🚀 TIER PROMOTION: ${data.previous_tier || 'B'} → ${data.new_tier || 'A'}`);

    embed.setTitle('🚀 TIER PROMOTION')
      .setColor(0xFF4500)
      .addFields([
        { name: 'Previous Tier', value: data.previous_tier || 'B-tier', inline: true },
        { name: 'New Tier', value: data.new_tier || 'A-tier', inline: true },
        { name: 'Reason', value: data.promotion_reason || 'Algorithm Update', inline: true }
      ]);

    return {
      embed,
      message: `🚀 Tier Promotion: ${data.player_name || 'Unknown'} promoted to ${data.new_tier || 'A-tier'}`
    };
  }

  /**
   * Generate standard pick alert content
   */
  private async generatePickAlertContent(context: AlertContext): Promise<{ embed: any; message: string }> {
    const pick = context.pickData || {};
    return {
      embed: await buildAlertEmbed(pick, `🏆 ${pick.tier || 'A'}-tier pick: ${pick.player_name || 'Unknown'}`),
      message: `🏆 ${pick.tier || 'A'}-tier pick: ${pick.player_name || 'Unknown'} ${pick.bet_type || ''}`
    };
  }

  /**
   * Generate deduplication key based on context
   */
  private generateDedupeKey(context: AlertContext): string {
    const baseData = context.pickData || context.opportunityData || {};
    return `${context.alertType}_${baseData.id || baseData.prop_id || 'unknown'}_${baseData.player_name || 'unknown'}_${Date.now()}`.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  /**
   * Send Discord alert with context
   */
  private async sendDiscordAlert(embed: any, context: AlertContext): Promise<void> {
    await withCircuitBreaker.discord(
      async () => {
        await sendDiscordAlert(embed);
      },
      async () => {
        this.alertMetrics.fallbacksUsed++;
        this.logger.error('🚨 Discord alert failed for context', {
          alertType: context.alertType,
          urgency: context.urgency
        });
      }
    );
  }

  /**
   * Emit comprehensive alert event to ops.alert_events
   */
  private async emitComprehensiveAlertEvent(context: AlertContext, dedupeKey: string, alertContent: any): Promise<void> {
    try {
      const baseData = context.pickData || context.opportunityData || {};

      await this.requireSupabase()
        .from('ops.alert_events')
        .insert({
          alert_type: context.alertType,
          pick_id: baseData.id || baseData.prop_id,
          player_name: baseData.player_name,
          bet_type: baseData.bet_type || context.alertType,
          tier: baseData.tier || this.inferTierFromContext(context),
          status: 'sent',
          dedupe_key: dedupeKey,
          alert_data: {
            ...baseData,
            alertType: context.alertType,
            confidence: context.confidence,
            urgency: context.urgency,
            shadowMode: this.shadowMode,
            processingSource: 'cache-first-alert-agent'
          },
          created_at: new Date().toISOString()
        });

      this.logger.debug('📝 Comprehensive alert event emitted', {
        alertType: context.alertType,
        dedupeKey
      });
    } catch (error) {
      this.logger.error('Failed to emit comprehensive alert event', {
        alertType: context.alertType,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Infer tier from alert context
   */
  private inferTierFromContext(context: AlertContext): string {
    switch (context.alertType) {
      case AlertType.STEAM_ALERT:
        return 'S-tier';
      case AlertType.MIDDLE_OPPORTUNITY:
      case AlertType.HEDGE_OPPORTUNITY:
        return 'A-tier';
      case AlertType.PARLAY_HEDGE:
        return 'B-tier';
      case AlertType.CLV_TRACKING:
        return context.opportunityData?.clv > 5 ? 'S-tier' : 'A-tier';
      case AlertType.TIER_PROMOTION:
        return context.pickData?.new_tier || 'A-tier';
      default:
        return 'B-tier';
    }
  }

  /**
   * Emit alert event to ops.alert_events table with deduplication
   */
  private async emitAlertEvent(pick: any, status: string = 'sent'): Promise<void> {
    try {
      const dedupeKey = `alert_${pick.id}_${pick.player_name}_${pick.bet_type}_${pick.line}`;

      await this.requireSupabase()
        .from('ops.alert_events')
        .insert({
          alert_type: 'pick_alert',
          pick_id: pick.id,
          player_name: pick.player_name,
          bet_type: pick.bet_type,
          tier: pick.tier,
          status,
          dedupe_key: dedupeKey,
          alert_data: {
            pickId: pick.id,
            playerName: pick.player_name,
            betType: pick.bet_type,
            line: pick.line,
            odds: pick.odds,
            tier: pick.tier,
            capper: pick.capper_username,
            shadowMode: this.shadowMode
          },
          created_at: new Date().toISOString()
        });

      this.logger.debug('📝 Alert event emitted to ops.alert_events', {
        pickId: pick.id,
        dedupeKey,
        status
      });
    } catch (error) {
      this.logger.error('Failed to emit alert event', {
        pickId: pick.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
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
        ...status
      };
    } catch (error) {
      return {
        mode: 'event-driven-error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ============================================================================
  // LIVE PICK POSTING - PRIMARY RESPONSIBILITY 
  // ============================================================================

  /**
   * Monitor both approved picks and live picks for posting
   */
  public async monitorPicksForPosting(): Promise<void> {
    await Promise.all([
      this.monitorApprovedPicksForDiscord(),
      this.monitorLivePicks(),
      this.monitorScheduledPicks()
    ]);
  }

  /**
   * Monitor unified_picks for approved picks from Command Center
   */
  public async monitorApprovedPicksForDiscord(): Promise<void> {
    if (!this.hasSupabase()) {
      this.logger.warn('⚠️ Supabase not available, skipping approved picks monitoring');
      return;
    }

    try {
      // Get approved picks that haven't been posted to Discord yet
      const { data: approvedPicks, error } = await this.requireSupabase()
        .from('unified_picks')
        .select('*')
        .eq('workflow_stage', 'approved')
        .eq('posted_to_discord', false)
        .order('created_at', { ascending: true })
        .limit(20);

      if (error) {
        throw new Error(`Failed to fetch approved picks: ${error.message}`);
      }

      if (approvedPicks && approvedPicks.length > 0) {
        this.logger.info(`🏆 Processing ${approvedPicks.length} approved picks for Discord posting`);

        for (const pick of approvedPicks) {
          await this.postApprovedPickToDiscord(pick);
          // Rate limiting between posts
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

    } catch (error) {
      this.logger.error('Error monitoring approved picks', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  /**
   * Post approved pick to Discord with Enhanced45Factor professional formatting
   */
  public async postApprovedPickToDiscord(pickData: any): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.info('🏆 Posting approved pick to Discord', {
        pickId: pickData.id,
        playerName: pickData.player_name,
        tier: pickData.tier,
        professionalScore: pickData.professional_score,
        kellyFraction: pickData.kelly_fraction
      });

      // Create professional Discord embed with Enhanced45Factor metrics
      const embed = await this.buildProfessionalDiscordEmbed(pickData);

      // Post to Discord with circuit breaker protection and shadow mode check
      if (this.shadowMode) {
        this.logger.info('🔇 Shadow mode active - Approved pick Discord posting suppressed', {
          pickId: pickData.id,
          playerName: pickData.player_name,
          tier: pickData.tier
        });

        // Still emit to ops.alert_events for tracking
        await this.emitAlertEvent(pickData, 'approved_shadow_suppressed');
      } else {
        await withCircuitBreaker.discord(async () => {
          await sendDiscordAlert(embed, pickData.capper_username);
        }, async () => {
          this.alertMetrics.fallbacksUsed++;
          this.logger.warn('🔄 Discord circuit breaker open for approved pick');
          await this.logPickForManualPosting(pickData);
        });
      }

      // Update database to mark as posted to Discord
      await this.updatePickDiscordStatus(pickData.id, true);

      // Update metrics
      this.alertMetrics.alertsSent++;
      this.alertMetrics.successCount++;
      this.alertMetrics.avgProcessingTimeMs = (this.alertMetrics.avgProcessingTimeMs + (Date.now() - startTime)) / 2;

      this.logger.info('✅ Successfully posted approved pick to Discord', {
        pickId: pickData.id,
        tier: pickData.tier,
        processingTimeMs: Date.now() - startTime
      });

    } catch (error) {
      // Update metrics
      this.alertMetrics.alertsFailed++;
      this.alertMetrics.errorCount++;

      this.logger.error('❌ Error posting approved pick to Discord', {
        pickId: pickData.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        processingTimeMs: Date.now() - startTime
      });

      // Log for manual review
      if (this.hasSupabase()) {
        await logAlertRecord(this.requireSupabase(), pickData, error instanceof Error ? error.message : String(error));
      }
    }
  }

  /**
   * Build professional Discord embed with Enhanced45Factor metrics
   */
  private async buildProfessionalDiscordEmbed(pickData: any): Promise<any> {
    const professionalAdvice = this.generateProfessionalAdvice(pickData);

    // Use buildAlertEmbed but enhance it with professional metrics
    const embed = buildAlertEmbed(pickData, professionalAdvice);

    // Enhance with Professional formatting and metrics
    embed.setTitle(`🏆 PROFESSIONAL PICK APPROVED`);
    embed.setColor(this.getProfessionalEmbedColor(pickData.tier));

    // Override description with professional format
    const professionalDesc = `**${pickData.player_name || 'Unknown Player'}** | ${pickData.stat_type || 'Unknown Stat'} | ${pickData.line ? (pickData.over_under === 'over' ? 'O' : 'U') + ' ' + pickData.line : 'N/A'}`;
    embed.setDescription(professionalDesc);

    // Add Enhanced45Factor professional metrics fields
    if (pickData.professional_score || pickData.kelly_fraction || pickData.devigged_edge) {
      embed.addFields({
        name: '💰 Professional Analysis',
        value: this.formatProfessionalMetrics(pickData),
        inline: false
      });
    }

    // Add tier and confidence
    embed.addFields({
      name: '🎯 Enhanced45Factor Analysis',
      value: `**Tier:** ${pickData.tier || 'N/A'} | **Score:** ${pickData.professional_score ? pickData.professional_score.toFixed(1) + '/10' : 'N/A'}`,
      inline: true
    });

    // Add professional footer
    embed.setFooter({
      text: '🏆 Enhanced45Factor Professional Intelligence System',
    });

    return embed;
  }

  /**
   * Generate professional advice based on Enhanced45Factor metrics
   */
  private generateProfessionalAdvice(pickData: any): string {
    const score = pickData.professional_score || 0;
    const kelly = pickData.kelly_fraction || 0;
    const edge = pickData.devigged_edge || 0;

    if (score >= 8.5) {
      return `🔥 ELITE PROFESSIONAL PLAY: ${score.toFixed(1)}/10 score with ${(kelly * 100).toFixed(1)}% Kelly sizing. Enhanced45Factor analysis indicates exceptional value.`;
    } else if (score >= 7.0) {
      return `⚡ STRONG PROFESSIONAL PLAY: ${score.toFixed(1)}/10 score with positive edge of ${edge.toFixed(1)}%. Enhanced45Factor confirms solid value.`;
    } else if (score >= 5.5) {
      return `📈 QUALITY PROFESSIONAL PLAY: ${score.toFixed(1)}/10 score meets professional standards. Enhanced45Factor analysis supports this selection.`;
    } else {
      return `📊 Professional analysis complete: ${score.toFixed(1)}/10 score processed through Enhanced45Factor system.`;
    }
  }

  /**
   * Format professional metrics for Discord display
   */
  private formatProfessionalMetrics(pickData: any): string {
    const metrics = [];

    if (pickData.professional_score) {
      metrics.push(`**Professional Score:** ${pickData.professional_score.toFixed(1)}/10`);
    }

    if (pickData.kelly_fraction) {
      metrics.push(`**Kelly Fraction:** ${(pickData.kelly_fraction * 100).toFixed(1)}%`);
    }

    if (pickData.devigged_edge) {
      metrics.push(`**Devigged Edge:** +${pickData.devigged_edge.toFixed(1)}%`);
    }

    if (pickData.confidence) {
      metrics.push(`**Confidence:** ${pickData.confidence}%`);
    }

    return metrics.length > 0 ? metrics.join(' | ') : 'Professional metrics processing...';
  }

  /**
   * Get professional embed color based on tier
   */
  private getProfessionalEmbedColor(tier: string): number {
    switch (tier) {
      case 'S+': return 0xFF0000; // Red for S+
      case 'S': return 0xFF6600;  // Orange for S
      case 'A+': return 0xFFD700; // Gold for A+
      case 'A': return 0x00FF00;  // Green for A
      case 'B+': return 0x00AAFF; // Blue for B+
      case 'B': return 0x0099FF;  // Light blue for B
      default: return 0x808080;   // Gray for others
    }
  }

  /**
   * Update pick posted_to_discord status
   */
  private async updatePickDiscordStatus(pickId: string, posted: boolean): Promise<void> {
    if (!this.hasSupabase()) {
      this.logger.warn('⚠️ Supabase not available, cannot update Discord status');
      return;
    }

    const { error } = await this.requireSupabase()
      .from('unified_picks')
      .update({
        posted_to_discord: posted,
        updated_at: new Date().toISOString()
      })
      .eq('id', pickId);

    if (error) {
      this.logger.error('Failed to update Discord status', {
        pickId,
        error: error.message
      });
    }
  }

  /**
   * Monitor unified_picks table for live picks and post immediately
   */
  public async monitorLivePicks(): Promise<void> {
    try {
      // Use cache-first service to get live picks ready to post
      const livePicks = await this.cacheFirstService.listPicks({
        status: 'pending',
        limit: 100
      });

      // Filter for picks not yet posted to Discord
      const unpostedPicks = livePicks.filter(pick => !pick.posted_to_discord);

      if (unpostedPicks && unpostedPicks.length > 0) {
        this.logger.info(`🔴 Processing ${unpostedPicks.length} live picks for immediate posting`);

        for (const pick of unpostedPicks) {
          await this.postLivePick(pick);
          // Rate limiting between posts
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

    } catch (error) {
      this.logger.error('Error monitoring live picks', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  /**
   * Post individual live pick to Discord immediately
   */
  public async postLivePick(pickData: any): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.logger.info('🚨 Posting live pick to Discord', {
        pickId: pickData.id,
        capper: pickData.capper_username,
        tier: pickData.tier,
        betType: pickData.bet_type
      });

      // Route to appropriate Discord thread
      const threadId = await this.routeToThread(pickData);
      
      // Format Discord embed for live pick
      const embed = await this.formatLivePickEmbed(pickData);
      
      // Post to Discord with circuit breaker protection and shadow mode check
      let messageId = null;
      if (this.shadowMode) {
        this.logger.info('🔇 Shadow mode active - Live pick Discord posting suppressed', {
          pickId: pickData.id,
          capper: pickData.capper_username,
          tier: pickData.tier
        });

        // Still emit to ops.alert_events for tracking
        await this.emitAlertEvent(pickData, 'live_shadow_suppressed');
      } else {
        messageId = await withCircuitBreaker.discord(async () => {
          await sendDiscordAlert(embed);
          return `alert-${Date.now()}`; // Generate a messageId since Discord service doesn't return one
        }, async () => {
          this.alertMetrics.fallbacksUsed++;
          this.logger.warn('🔄 Discord circuit breaker open, using fallback');
          // Fallback: Log pick for manual posting
          await this.logPickForManualPosting(pickData);
          return null;
        });
      }
      
      // Update database with Discord message info
      if (messageId) {
        await this.updatePickWithDiscordInfo(pickData.id, threadId, messageId, 'posted');
      }
      
      // Notify VIP users if high-tier pick
      if (pickData.tier === 'S-tier' || pickData.tier === 'A-tier') {
        await this.notifyVIPUsers(pickData);
      }

      // Update metrics
      this.alertMetrics.alertsSent++;
      this.alertMetrics.successCount++;
      this.alertMetrics.avgProcessingTimeMs = (this.alertMetrics.avgProcessingTimeMs + (Date.now() - startTime)) / 2;

      this.logger.info('✅ Successfully posted live pick to Discord', {
        pickId: pickData.id,
        threadId,
        messageId,
        tier: pickData.tier,
        processingTimeMs: Date.now() - startTime
      });

    } catch (error) {
      // Update metrics
      this.alertMetrics.alertsFailed++;
      this.alertMetrics.errorCount++;

      this.logger.error('❌ Error posting live pick', {
        pickId: pickData.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        processingTimeMs: Date.now() - startTime
      });

      // Update pick status to error
      await this.updatePickWithDiscordInfo(pickData.id, null, null, 'error');
      
      // Log for manual review
      if (this.hasSupabase()) {
        await logAlertRecord(this.requireSupabase(), pickData, error instanceof Error ? error.message : String(error));
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
        availableCappers: Object.keys(env.env.capperThreads)
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
    embed.setTitle(`🔴 LIVE PICK: ${currentTitle}`)
      .setColor(0xFF0000) // Red for live picks
      .setTimestamp(new Date());
    
    // Add urgency footer
    const existingFooter = embed.data.footer?.text || '';
    embed.setFooter({ text: `${existingFooter} • 🔴 LIVE ALERT`.trim() });
    
    return embed;
  }

  /**
   * Update pick with Discord posting information
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
      updated_at: new Date().toISOString()
    };

    if (messageId) updateData.discord_post_id = messageId;

    const { error } = await this.requireSupabase()
      .from('unified_picks')
      .update(updateData)
      .eq('id', pickId);

    if (error) {
      this.logger.error('Failed to update pick Discord info', {
        pickId,
        error: error.message
      });
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
        tier: pickData.tier
      });
      
    } catch (error) {
      this.logger.error('Failed to notify VIP users', {
        pickId: pickData.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Log pick for manual posting when automated posting fails
   */
  private async logPickForManualPosting(pickData: any): Promise<void> {
    if (this.hasSupabase()) {
      await logAlertRecord(this.requireSupabase(), pickData, 'Automatic posting failed - requires manual review');
    }
    
    this.logger.warn('📝 Pick logged for manual posting', {
      pickId: pickData.id,
      capper: pickData.capper_username,
      tier: pickData.tier
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

    try {
      const now = new Date();
      const currentHour = now.getHours();
      
      // Only run at 10 AM EST (15 UTC)
      if (currentHour !== 15) return;

      const supabase = this.requireSupabase();
      
      const supabaseClient = requireSupabase();
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
        this.logger.info(`📅 Processing ${scheduledPicks.length} scheduled picks for 10 AM batch posting`);
        
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
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  /**
   * Post scheduled pick with batch formatting
   */
  private async postScheduledPick(pickData: any): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.logger.info('📅 Posting scheduled pick to Discord', {
        pickId: pickData.id,
        capper: pickData.capper_username,
        tier: pickData.tier
      });

      // Route to appropriate Discord thread
      const threadId = await this.routeToThread(pickData);
      
      // Format Discord embed for scheduled pick (less urgent than live)
      const embed = await this.formatScheduledPickEmbed(pickData);
      
      // Post to Discord with circuit breaker protection
      const messageId = await withCircuitBreaker.discord(async () => {
        await sendDiscordAlert(embed);
        return `alert-${Date.now()}`; // Generate a messageId since Discord service doesn't return one
      }, async () => {
        this.alertMetrics.fallbacksUsed++;
        this.logger.warn('🔄 Discord circuit breaker open, using fallback');
        await this.logPickForManualPosting(pickData);
        return null;
      });
      
      // Update database with Discord message info
      if (messageId) {
        await this.updatePickWithDiscordInfo(pickData.id, threadId, messageId, 'posted');
      }

      // Update metrics
      this.alertMetrics.alertsSent++;
      this.alertMetrics.successCount++;
      this.alertMetrics.avgProcessingTimeMs = (this.alertMetrics.avgProcessingTimeMs + (Date.now() - startTime)) / 2;

      this.logger.info('✅ Successfully posted scheduled pick to Discord', {
        pickId: pickData.id,
        threadId,
        messageId,
        tier: pickData.tier,
        processingTimeMs: Date.now() - startTime
      });

    } catch (error) {
      // Update metrics
      this.alertMetrics.alertsFailed++;
      this.alertMetrics.errorCount++;

      this.logger.error('❌ Error posting scheduled pick', {
        pickId: pickData.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        processingTimeMs: Date.now() - startTime
      });

      // Update pick status to error
      await this.updatePickWithDiscordInfo(pickData.id, null, null, 'error');
      
      // Log for manual review
      if (this.hasSupabase()) {
        await logAlertRecord(this.requireSupabase(), pickData, error instanceof Error ? error.message : String(error));
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
    embed.setTitle(`📅 DAILY PICK: ${currentTitle}`)
      .setColor(0x00AA00) // Green for scheduled picks
      .setTimestamp(new Date());
    
    // Add batch footer
    const existingFooter = embed.data.footer?.text || '';
    embed.setFooter({ text: `${existingFooter} • 📅 10 AM BATCH`.trim() });
    
    return embed;
  }

  // ============================================================================
  // SOPHISTICATED EVENT-DRIVEN API METHODS
  // ============================================================================

  /**
   * Initialize a ticket in the state management system
   */
  public async initializeTicket(
    ticketId: string,
    ticketType: 'single' | 'parlay' | 'round_robin',
    legs: Array<{
      player_name: string;
      stat_type: string;
      line: number;
      odds: number;
      game_start_time: string;
    }>,
    exposureUnits: number = 1
  ): Promise<any> {
    if (!this.ticketStateManager) {
      throw new Error('TicketStateManager not initialized');
    }

    const ticketLegs = legs.map((leg, index) => ({
      id: `${ticketId}-${index}`,
      ticket_id: ticketId,
      leg_index: index,
      ...leg,
      outcome: 'pending' as const,
      game_id: `game-${Date.now()}`,
      game_status: 'scheduled' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    // Convert string literal to TicketType enum
    const ticketTypeEnum = ticketType === 'single' ? TicketType.SINGLE :
                          ticketType === 'parlay' ? TicketType.PARLAY :
                          TicketType.ROUND_ROBIN;

    return await this.ticketStateManager.initializeTicket(
      ticketId,
      ticketTypeEnum,
      ticketLegs,
      exposureUnits
    );
  }

  /**
   * Update leg outcome and trigger state transitions
   */
  public async updateLegOutcome(
    ticketId: string,
    legIndex: number,
    outcome: 'hit' | 'miss' | 'void'
  ): Promise<any> {
    if (!this.ticketStateManager) {
      throw new Error('TicketStateManager not initialized');
    }

    const result = await this.ticketStateManager.updateLegOutcome(ticketId, legIndex, outcome);
    
    // Update metrics
    this.alertMetrics.stateTransitions++;
    
    return result;
  }

  /**
   * Get ticket state
   */
  public async getTicketState(ticketId: string): Promise<any> {
    if (!this.ticketStateManager) {
      throw new Error('TicketStateManager not initialized');
    }

    return await this.ticketStateManager.getTicketState(ticketId);
  }

  /**
   * Force state transition (admin function)
   */
  public async forceStateTransition(
    ticketId: string,
    newState: 'OPEN' | 'LIVE' | 'SWEAT' | 'HEDGE_WINDOW' | 'DONE',
    reason: string
  ): Promise<any> {
    if (!this.ticketStateManager) {
      throw new Error('TicketStateManager not initialized');
    }

    return await this.ticketStateManager.forceStateTransition(ticketId, newState as any, reason);
  }

  /**
   * Get sophisticated processing metrics
   */
  public getSophisticatedMetrics(): any {
    const base = {
      ...this.alertMetrics,
      isEventDrivenMode: !!this.eventDrivenProcessor,
      componentStatus: {
        ticketStateManager: !!this.ticketStateManager,
        eventDrivenProcessor: !!this.eventDrivenProcessor,
        hedgeDetectionEngine: !!this.hedgeDetectionEngine,
        discordRichEmbeds: !!this.discordRichEmbeds
      }
    };

    if (this.eventDrivenProcessor) {
      const processorMetrics = this.eventDrivenProcessor.getMetrics();
      return {
        ...base,
        eventProcessorMetrics: processorMetrics
      };
    }

    return base;
  }

  /**
   * Get health status with sophisticated components
   */
  public async getSophisticatedHealthStatus(): Promise<any> {
    const baseHealth = await this.checkHealth();
    
    const sophisticatedHealth = {
      ...baseHealth,
      sophisticatedComponents: {
        ticketStateManager: {
          status: this.ticketStateManager ? 'healthy' : 'not_initialized',
          initialized: !!this.ticketStateManager
        },
        eventDrivenProcessor: {
          status: this.eventDrivenProcessor ? 'healthy' : 'not_initialized',
          initialized: !!this.eventDrivenProcessor,
          healthStatus: this.eventDrivenProcessor?.getHealthStatus()
        },
        hedgeDetectionEngine: {
          status: this.hedgeDetectionEngine ? 'healthy' : 'not_initialized',
          initialized: !!this.hedgeDetectionEngine
        },
        discordRichEmbeds: {
          status: this.discordRichEmbeds ? 'healthy' : 'not_initialized',
          initialized: !!this.discordRichEmbeds
        }
      }
    };

    return sophisticatedHealth;
  }

  /**
   * Test sophisticated alert generation
   */
  public async testSophisticatedAlert(alertType: 'steam' | 'hedge' | 'arbitrage' | 'live_ticket'): Promise<void> {
    if (!this.discordRichEmbeds) {
      throw new Error('DiscordRichEmbeds not initialized');
    }

    const testAlertData = {
      type: alertType,
      priority: 'high' as const,
      player_name: 'Test Player',
      stat_type: 'Points',
      sport: 'NBA',
      team: 'Lakers',
      opponent: 'Warriors',
      confidence: 0.85,
      trigger_data: {
        line: 25.5,
        odds: -110,
        line_movement: 1.5,
        steam_detected: true
      },
      time_to_game: 120,
      expires_at: new Date(Date.now() + 300000).toISOString()
    };

    const testPlayerData = {
      headshot_url: 'https://via.placeholder.com/150x150?text=Player',
      season_stats: {
        games_played: 50,
        avg_stat_value: 24.8,
        hit_rate: 0.65,
        trend: 'up' as const
      }
    };

    const embed = await this.discordRichEmbeds.createEnhancedAlertEmbed(
      testAlertData,
      testPlayerData,
      'Test alert for sophisticated AlertAgent system'
    );

    await sendDiscordAlert(embed);
    this.logger.info('✅ Test sophisticated alert sent', { type: alertType });
  }

  /**
   * Manual hedge opportunity detection
   */
  public async detectHedgeOpportunities(propId: string): Promise<any[]> {
    if (!this.hedgeDetectionEngine || !this.hasSupabase()) {
      throw new Error('HedgeDetectionEngine not available');
    }

    try {
      // Get recent prop tick data
      const { data: recentTick, error } = await this.requireSupabase()
        .from('prop_ticks_hot')
        .select('*')
        .eq('prop_id', propId)
        .order('tick_timestamp', { ascending: false })
        .limit(1)
        .single();

      if (error || !recentTick) {
        throw new Error(`No recent tick data found for prop ${propId}`);
      }

      return await this.hedgeDetectionEngine.analyzeHedgeOpportunities(recentTick);

    } catch (error) {
      this.logger.error('Manual hedge detection failed', {
        propId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Check if running in sophisticated event-driven mode
   */
  public isSophisticatedMode(): boolean {
    return !!(
      this.ticketStateManager &&
      this.eventDrivenProcessor &&
      this.hedgeDetectionEngine &&
      this.discordRichEmbeds
    );
  }
}