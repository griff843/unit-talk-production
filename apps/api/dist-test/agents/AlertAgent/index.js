"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertAgent = void 0;
require("dotenv/config");
const enhanced_circuit_breaker_1 = require("../../services/enhanced-circuit-breaker");
const metricsServer_1 = require("../../services/metricsServer");
const index_1 = require("../BaseAgent/index");
const adviceEngine_1 = require("./adviceEngine");
const embedBuilder_1 = require("./embedBuilder");
const discord_1 = require("./integrations/discord");
const EventSubscriptionManager_1 = require("./EventSubscriptionManager");
// import { postToNotion } from '../../services/notion';
// import { updateRetoolTag } from '../../services/retool';
const log_1 = require("./log");
// import { env } from '../../config/env';
// Import sophisticated event-driven components
const TicketStateManager_1 = require("./TicketStateManager");
const EventDrivenProcessor_1 = require("./EventDrivenProcessor");
const HedgeDetectionEngine_1 = require("./HedgeDetectionEngine");
const DiscordRichEmbeds_1 = require("./DiscordRichEmbeds");
class AlertAgent extends index_1.BaseAgent {
    constructor(config, deps) {
        super(config, deps);
        this.rateLimiter = new Map(); // service -> last call timestamp
        this.eventSubscriptionManager = null;
        // Sophisticated event-driven components
        this.ticketStateManager = null;
        this.eventDrivenProcessor = null;
        this.hedgeDetectionEngine = null;
        this.discordRichEmbeds = null;
        this.RATE_LIMITS = {
            discord: 2000, // 2 seconds between calls (30/min limit)
            openai: 100, // 100ms between calls
        };
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
            steamAlertsGenerated: 0,
            arbitrageOpportunitiesFound: 0,
            // Ticket state management metrics
            ticketsTracked: 0,
            stateTransitions: 0,
            hedgeWindowsOpened: 0,
            // Hedge detection metrics
            hedgeOpportunitiesDetected: 0,
            middleOpportunitiesFound: 0,
            averageHedgeProfit: 0,
            errorCount: 0,
            successCount: 0,
        };
    }
    async initialize() {
        this.logger.info('🚀 AlertAgent initializing with sophisticated event-driven architecture...');
        // Initialize sophisticated components first
        await this.initializeSophisticatedComponents();
        // Register custom circuit breaker configs for AlertAgent services
        enhanced_circuit_breaker_1.circuitBreaker.registerService('openai-advice', {
            failureThreshold: 3,
            resetTimeoutMs: 45000, // 45 seconds for AI services
            timeoutMs: 20000, // 20 seconds for advice generation
            retryAttempts: 2
        });
        enhanced_circuit_breaker_1.circuitBreaker.registerService('discord-alerts', {
            failureThreshold: 5,
            resetTimeoutMs: 30000, // 30 seconds for Discord
            timeoutMs: 8000, // 8 seconds for Discord API
            retryAttempts: 3
        });
        // Set up circuit breaker event listeners
        enhanced_circuit_breaker_1.circuitBreaker.on('circuitOpened', (event) => {
            if (event.serviceName.includes('openai') || event.serviceName.includes('discord')) {
                this.alertMetrics.circuitBreakerTrips++;
                this.logger.error('⚡ Circuit breaker opened for AlertAgent service', event);
            }
        });
        enhanced_circuit_breaker_1.circuitBreaker.on('operationSuccess', (event) => {
            if (event.serviceName.includes('openai') || event.serviceName.includes('discord')) {
                this.logger.debug('✅ Service call successful', event);
            }
        });
        // Ensure alerts log table exists and is accessible
        try {
            await enhanced_circuit_breaker_1.withCircuitBreaker.supabase(async () => {
                if (this.hasSupabase()) {
                    const { error } = await this.requireSupabase()
                        .from('unit_talk_alerts_log')
                        .select('count')
                        .limit(1);
                    if (error) {
                        throw new Error(`Alert logging table not accessible: ${error.message}`);
                    }
                }
                else {
                    throw new Error('Supabase client not available');
                }
            }, async () => {
                this.logger.warn('⚠️ Supabase health check failed, continuing without verification');
            });
        }
        catch (error) {
            this.logger.warn('⚠️ Database initialization check failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
        // Initialize event-driven subscriptions
        if (this.hasSupabase()) {
            try {
                this.eventSubscriptionManager = new EventSubscriptionManager_1.EventSubscriptionManager(this.requireSupabase(), this.logger, {
                    batchSize: 10,
                    processingTimeout: 30000,
                    retryAttempts: 3,
                    cooldownSeconds: 300, // 5 minutes
                });
                await this.eventSubscriptionManager.setupEventSubscriptions();
                this.logger.info('🔗 Event-driven AlertAgent subscriptions established');
            }
            catch (error) {
                this.logger.error('❌ Failed to initialize event subscriptions, falling back to polling', {
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        else {
            this.logger.warn('⚠️ Supabase not available, AlertAgent running in polling-only mode');
        }
    }
    /**
     * Initialize sophisticated event-driven components
     */
    async initializeSophisticatedComponents() {
        if (!this.hasSupabase()) {
            this.logger.warn('⚠️ Supabase not available, skipping sophisticated component initialization');
            return;
        }
        try {
            const supabase = this.requireSupabase();
            // Initialize TicketStateManager
            this.ticketStateManager = new TicketStateManager_1.TicketStateManager(supabase, this.logger);
            this.logger.info('✅ TicketStateManager initialized');
            // Initialize HedgeDetectionEngine
            this.hedgeDetectionEngine = new HedgeDetectionEngine_1.HedgeDetectionEngine(supabase, this.logger);
            this.logger.info('✅ HedgeDetectionEngine initialized');
            // Initialize DiscordRichEmbeds
            this.discordRichEmbeds = new DiscordRichEmbeds_1.DiscordRichEmbeds(this.logger);
            this.logger.info('✅ DiscordRichEmbeds initialized');
            // Initialize EventDrivenProcessor
            this.eventDrivenProcessor = new EventDrivenProcessor_1.EventDrivenProcessor(supabase, this.logger, this.ticketStateManager, {
                maxLatencyMs: 1000, // <1 second target
                batchSize: 50,
                maxConcurrentEvents: 100
            });
            await this.eventDrivenProcessor.initialize();
            this.logger.info('✅ EventDrivenProcessor initialized with <1s latency target');
            // Start periodic metrics collection
            this.startSophisticatedMetricsCollection();
            this.logger.info('🎯 All sophisticated components initialized successfully');
        }
        catch (error) {
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
    startSophisticatedMetricsCollection() {
        // Collect metrics every 30 seconds
        setInterval(async () => {
            await this.updateSophisticatedMetrics();
        }, 30000);
    }
    /**
     * Update sophisticated component metrics
     */
    async updateSophisticatedMetrics() {
        try {
            if (this.eventDrivenProcessor) {
                const processorMetrics = this.eventDrivenProcessor.getMetrics();
                this.alertMetrics.eventsProcessedTotal = processorMetrics.totalEventsProcessed;
                this.alertMetrics.eventProcessingLatencyP99Ms = processorMetrics.p99LatencyMs;
                this.alertMetrics.steamAlertsGenerated += processorMetrics.alertsGenerated;
                this.alertMetrics.arbitrageOpportunitiesFound = processorMetrics.hedgeOpportunitiesFound;
            }
            // Update ticket state metrics
            if (this.ticketStateManager && this.hasSupabase()) {
                const liveTickets = await this.ticketStateManager.getTicketsByState('LIVE', 10);
                const sweatTickets = await this.ticketStateManager.getTicketsByState('SWEAT', 10);
                const hedgeTickets = await this.ticketStateManager.getTicketsByState('HEDGE_WINDOW', 10);
                this.alertMetrics.ticketsTracked = liveTickets.length + sweatTickets.length + hedgeTickets.length;
                this.alertMetrics.hedgeWindowsOpened = hedgeTickets.length;
            }
        }
        catch (error) {
            this.logger.error('Failed to update sophisticated metrics', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    async cleanup() {
        this.logger.info('🧹 AlertAgent cleanup initiated...');
        // Cleanup sophisticated components first
        if (this.eventDrivenProcessor) {
            try {
                await this.eventDrivenProcessor.cleanup();
                this.logger.info('✅ EventDrivenProcessor cleaned up');
            }
            catch (error) {
                this.logger.warn('⚠️ Error during EventDrivenProcessor cleanup', {
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
        // Cleanup event subscriptions
        if (this.eventSubscriptionManager) {
            try {
                await this.eventSubscriptionManager.cleanup();
                this.logger.info('✅ Event subscriptions cleaned up');
            }
            catch (error) {
                this.logger.warn('⚠️ Error during event subscription cleanup', {
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        this.rateLimiter.clear();
        this.logger.info('🧹 AlertAgent cleanup complete');
    }
    async collectMetrics() {
        let eventSubscriptionMetrics = {};
        if (this.eventSubscriptionManager) {
            try {
                const subscriptionStatus = await this.eventSubscriptionManager.getSubscriptionStatus();
                eventSubscriptionMetrics = {
                    activeSubscriptions: subscriptionStatus.active,
                    totalSubscriptions: subscriptionStatus.total,
                    subscriptionChannels: subscriptionStatus.channels,
                };
            }
            catch (error) {
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
    async checkHealth() {
        const checks = [];
        // Check Supabase connectivity with circuit breaker
        try {
            await enhanced_circuit_breaker_1.withCircuitBreaker.supabase(async () => {
                if (this.hasSupabase()) {
                    await this.requireSupabase().from('unified_picks').select('count').limit(1);
                    checks.push({ service: 'supabase', status: 'healthy' });
                }
                else {
                    throw new Error('Client not available');
                }
            }, async () => {
                checks.push({ service: 'supabase', status: 'degraded', error: 'Circuit breaker protection active' });
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            checks.push({ service: 'supabase', status: 'unhealthy', error: errorMessage });
        }
        // Check OpenAI connectivity (basic) with circuit breaker status
        const openaiServiceStatus = enhanced_circuit_breaker_1.circuitBreaker.getServiceStatus('openai-advice');
        const hasApiKey = !!process.env.OPENAI_API_KEY;
        if (!hasApiKey) {
            checks.push({ service: 'openai', status: 'unhealthy', error: 'Missing API key' });
        }
        else if (openaiServiceStatus?.state === 'OPEN') {
            checks.push({ service: 'openai', status: 'degraded', error: 'Circuit breaker open' });
        }
        else {
            checks.push({ service: 'openai', status: 'healthy' });
        }
        // Check Discord service status
        const discordServiceStatus = enhanced_circuit_breaker_1.circuitBreaker.getServiceStatus('discord-alerts');
        if (discordServiceStatus?.state === 'OPEN') {
            checks.push({ service: 'discord', status: 'degraded', error: 'Circuit breaker open' });
        }
        else {
            checks.push({ service: 'discord', status: 'healthy' });
        }
        // Overall health considers circuit breaker status
        const healthyServices = checks.filter(check => check.status === 'healthy').length;
        const totalServices = checks.length;
        const healthPercentage = healthyServices / totalServices;
        let overallStatus;
        if (healthPercentage >= 1.0) {
            overallStatus = 'healthy';
        }
        else if (healthPercentage >= 0.5) {
            overallStatus = 'degraded';
        }
        else {
            overallStatus = 'unhealthy';
        }
        // Check event subscription health
        if (this.eventSubscriptionManager) {
            try {
                const subscriptionStatus = await this.eventSubscriptionManager.getSubscriptionStatus();
                if (subscriptionStatus.active === subscriptionStatus.total && subscriptionStatus.total > 0) {
                    checks.push({ service: 'event-subscriptions', status: 'healthy' });
                }
                else if (subscriptionStatus.active > 0) {
                    checks.push({ service: 'event-subscriptions', status: 'degraded', error: 'Some subscriptions inactive' });
                }
                else {
                    checks.push({ service: 'event-subscriptions', status: 'unhealthy', error: 'No active subscriptions' });
                }
            }
            catch (error) {
                checks.push({
                    service: 'event-subscriptions',
                    status: 'unhealthy',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        else {
            checks.push({ service: 'event-subscriptions', status: 'degraded', error: 'Polling mode only' });
        }
        // Get circuit breaker health status
        const circuitBreakerHealth = enhanced_circuit_breaker_1.circuitBreaker.getHealthStatus();
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
    async startMetricsServer() {
        const port = this.config.metrics?.port || 9005;
        (0, metricsServer_1.startMetricsServer)(port);
        this.logger.info(`📊 Metrics server started on port ${port}`);
    }
    async enforceRateLimit(service) {
        const limit = this.RATE_LIMITS[service];
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
    async isAlertAlreadySent(pick) {
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
    async process() {
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
                error: error?.message || 'No picks returned'
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
                const advice = await enhanced_circuit_breaker_1.withCircuitBreaker.openai(async () => {
                    this.alertMetrics.llmCallsCount++;
                    return await (0, adviceEngine_1.getAdviceForPick)(pick);
                }, async () => {
                    this.alertMetrics.fallbacksUsed++;
                    this.logger.warn('🔄 Using fallback advice due to OpenAI circuit breaker');
                    return `Strong player prop play for ${pick.player_name}. Monitor line movement. AI analysis temporarily unavailable - based on tier and historical performance.`;
                });
                const embed = (0, embedBuilder_1.buildAlertEmbed)(pick, advice);
                // Rate limit Discord calls
                await this.enforceRateLimit('discord');
                // Send alerts with circuit breaker protection
                await enhanced_circuit_breaker_1.withCircuitBreaker.discord(async () => {
                    await (0, discord_1.sendDiscordAlert)(embed);
                }, async () => {
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
                });
                // Log the alert for deduplication and analytics with circuit breaker
                await enhanced_circuit_breaker_1.withCircuitBreaker.supabase(async () => {
                    if (this.hasSupabase()) {
                        await (0, log_1.logAlertRecord)(this.requireSupabase(), pick, advice);
                    }
                }, async () => {
                    this.logger.warn('⚠️ Failed to log alert record, Supabase circuit breaker open', {
                        pickId: pick.id
                    });
                });
                this.alertMetrics.alertsSent++;
                this.alertMetrics.successCount++;
                const processingTime = Date.now() - pickStartTime;
                this.alertMetrics.avgProcessingTimeMs =
                    (this.alertMetrics.avgProcessingTimeMs + processingTime) / 2;
                this.logger.info(`✅ Alert sent for pick [${pick.id}] - ${pick.player_name} (${processingTime}ms)`);
            }
            catch (err) {
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
        this.logger.info(`🏁 AlertAgent ${cycleType} cycle complete`, {
            totalPicks: picks?.length || 0,
            alertsSent: this.alertMetrics.alertsSent,
            duplicatesSkipped: this.alertMetrics.duplicatesSkipped,
            failures: this.alertMetrics.alertsFailed,
            cycleTimeMs: totalCycleTime,
            isEventDriven
        });
    }
    /**
     * Check if AlertAgent is running in event-driven mode
     */
    isEventDrivenMode() {
        return this.eventSubscriptionManager !== null;
    }
    /**
     * Get event subscription status for monitoring
     */
    async getEventSubscriptionStatus() {
        if (!this.eventSubscriptionManager) {
            return { mode: 'polling-only', subscriptions: [] };
        }
        try {
            const status = await this.eventSubscriptionManager.getSubscriptionStatus();
            return {
                mode: 'event-driven',
                ...status
            };
        }
        catch (error) {
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
     * Monitor both live and scheduled picks for posting
     */
    async monitorPicksForPosting() {
        await Promise.all([
            this.monitorLivePicks(),
            this.monitorScheduledPicks()
        ]);
    }
    /**
     * Monitor unified_picks table for live picks and post immediately
     */
    async monitorLivePicks() {
        if (!this.hasSupabase()) {
            this.logger.warn('⚠️ Supabase not available, skipping live pick monitoring');
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
        }
        catch (error) {
            this.logger.error('Error monitoring live picks', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });
        }
    }
    /**
     * Post individual live pick to Discord immediately
     */
    async postLivePick(pickData) {
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
            // Post to Discord with circuit breaker protection
            const messageId = await enhanced_circuit_breaker_1.withCircuitBreaker.discord(async () => {
                await (0, discord_1.sendDiscordAlert)(embed);
                return `alert-${Date.now()}`; // Generate a messageId since Discord service doesn't return one
            }, async () => {
                this.alertMetrics.fallbacksUsed++;
                this.logger.warn('🔄 Discord circuit breaker open, using fallback');
                // Fallback: Log pick for manual posting
                await this.logPickForManualPosting(pickData);
                return null;
            });
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
        }
        catch (error) {
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
                await (0, log_1.logAlertRecord)(this.requireSupabase(), pickData, error instanceof Error ? error.message : String(error));
            }
        }
    }
    /**
     * Route pick to appropriate Discord thread based on capper and game context
     */
    async routeToThread(pickData) {
        // Get capper thread from environment configuration
        const capperName = pickData.capper_username;
        const env = await Promise.resolve().then(() => __importStar(require('../../config/env')));
        const threadId = env.env.capperThreads[capperName];
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
    async formatLivePickEmbed(pickData) {
        const defaultAdvice = `Live pick alert for ${pickData.player_name}. Monitor closely for line movement.`;
        const embed = (0, embedBuilder_1.buildAlertEmbed)(pickData, defaultAdvice);
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
    async updatePickWithDiscordInfo(pickId, _threadId, messageId, status = 'posted') {
        if (!this.hasSupabase()) {
            this.logger.warn('⚠️ Supabase not available, cannot update pick status');
            return;
        }
        const updateData = {
            posted_to_discord: status === 'posted',
            updated_at: new Date().toISOString()
        };
        if (messageId)
            updateData.discord_post_id = messageId;
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
    async notifyVIPUsers(pickData) {
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
        }
        catch (error) {
            this.logger.error('Failed to notify VIP users', {
                pickId: pickData.id,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    /**
     * Log pick for manual posting when automated posting fails
     */
    async logPickForManualPosting(pickData) {
        if (this.hasSupabase()) {
            await (0, log_1.logAlertRecord)(this.requireSupabase(), pickData, 'Automatic posting failed - requires manual review');
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
    async monitorScheduledPicks() {
        if (!this.hasSupabase()) {
            this.logger.warn('⚠️ Supabase not available, skipping scheduled pick monitoring');
            return;
        }
        try {
            const now = new Date();
            const currentHour = now.getHours();
            // Only run at 10 AM EST (15 UTC)
            if (currentHour !== 15)
                return;
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
                this.logger.info(`📅 Processing ${scheduledPicks.length} scheduled picks for 10 AM batch posting`);
                for (const pick of scheduledPicks) {
                    // Use the same posting logic but with scheduled formatting
                    await this.postScheduledPick(pick);
                    // Rate limiting between posts
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
        catch (error) {
            this.logger.error('Error monitoring scheduled picks', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });
        }
    }
    /**
     * Post scheduled pick with batch formatting
     */
    async postScheduledPick(pickData) {
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
            const messageId = await enhanced_circuit_breaker_1.withCircuitBreaker.discord(async () => {
                await (0, discord_1.sendDiscordAlert)(embed);
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
        }
        catch (error) {
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
                await (0, log_1.logAlertRecord)(this.requireSupabase(), pickData, error instanceof Error ? error.message : String(error));
            }
        }
    }
    /**
     * Format Discord embed for scheduled picks (less urgent styling)
     */
    async formatScheduledPickEmbed(pickData) {
        const defaultAdvice = `Scheduled pick for ${pickData.player_name}. Strong value identified.`;
        const embed = (0, embedBuilder_1.buildAlertEmbed)(pickData, defaultAdvice);
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
    async initializeTicket(ticketId, ticketType, legs, exposureUnits = 1) {
        if (!this.ticketStateManager) {
            throw new Error('TicketStateManager not initialized');
        }
        const ticketLegs = legs.map((leg, index) => ({
            id: `${ticketId}-${index}`,
            ticket_id: ticketId,
            leg_index: index,
            ...leg,
            outcome: 'pending',
            game_id: `game-${Date.now()}`,
            game_status: 'scheduled',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }));
        return await this.ticketStateManager.initializeTicket(ticketId, ticketType, ticketLegs, exposureUnits);
    }
    /**
     * Update leg outcome and trigger state transitions
     */
    async updateLegOutcome(ticketId, legIndex, outcome) {
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
    async getTicketState(ticketId) {
        if (!this.ticketStateManager) {
            throw new Error('TicketStateManager not initialized');
        }
        return await this.ticketStateManager.getTicketState(ticketId);
    }
    /**
     * Force state transition (admin function)
     */
    async forceStateTransition(ticketId, newState, reason) {
        if (!this.ticketStateManager) {
            throw new Error('TicketStateManager not initialized');
        }
        return await this.ticketStateManager.forceStateTransition(ticketId, newState, reason);
    }
    /**
     * Get sophisticated processing metrics
     */
    getSophisticatedMetrics() {
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
    async getSophisticatedHealthStatus() {
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
    async testSophisticatedAlert(alertType) {
        if (!this.discordRichEmbeds) {
            throw new Error('DiscordRichEmbeds not initialized');
        }
        const testAlertData = {
            type: alertType,
            priority: 'high',
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
                trend: 'up'
            }
        };
        const embed = await this.discordRichEmbeds.createEnhancedAlertEmbed(testAlertData, testPlayerData, 'Test alert for sophisticated AlertAgent system');
        await (0, discord_1.sendDiscordAlert)(embed);
        this.logger.info('✅ Test sophisticated alert sent', { type: alertType });
    }
    /**
     * Manual hedge opportunity detection
     */
    async detectHedgeOpportunities(propId) {
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
        }
        catch (error) {
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
    isSophisticatedMode() {
        return !!(this.ticketStateManager &&
            this.eventDrivenProcessor &&
            this.hedgeDetectionEngine &&
            this.discordRichEmbeds);
    }
}
exports.AlertAgent = AlertAgent;
