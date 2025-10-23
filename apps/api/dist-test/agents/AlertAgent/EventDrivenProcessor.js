"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventDrivenProcessor = void 0;
const enhanced_circuit_breaker_1 = require("../../services/enhanced-circuit-breaker");
const HedgeDetectionEngine_1 = require("./HedgeDetectionEngine");
class EventDrivenProcessor {
    constructor(supabase, logger, ticketStateManager, config) {
        // Performance tracking
        this.metrics = {
            totalEventsProcessed: 0,
            averageLatencyMs: 0,
            p99LatencyMs: 0,
            alertsGenerated: 0,
            hedgeOpportunitiesFound: 0,
            circuitBreakerTrips: 0,
            errorRate: 0,
            throughputPerSecond: 0
        };
        // Event processing infrastructure
        this.realtimeSubscription = null;
        this.processingQueue = new Map();
        this.activeProcessing = new Set();
        this.deduplicationCache = new Map(); // event_id -> timestamp
        this.latencyBuffer = [];
        this.lastThroughputCalculation = Date.now();
        this.eventsInLastSecond = 0;
        // Circuit breaker and rate limiting
        this.isHealthy = true;
        this.consecutiveErrors = 0;
        this.lastHealthCheck = Date.now();
        this.supabase = supabase;
        this.logger = logger;
        this.ticketStateManager = ticketStateManager;
        this.hedgeDetectionEngine = new HedgeDetectionEngine_1.HedgeDetectionEngine(supabase, logger);
        this.config = {
            maxLatencyMs: 1000, // <1 second target
            batchSize: 50,
            processingTimeoutMs: 800, // Leave buffer for network
            maxConcurrentEvents: 100,
            retryAttempts: 2,
            circuitBreakerThreshold: 5,
            ...config
        };
        // Start health monitoring
        this.startHealthMonitoring();
    }
    /**
     * Initialize real-time subscriptions to prop_ticks_hot
     */
    async initialize() {
        this.logger.info('🚀 Initializing EventDrivenProcessor with <1s latency target');
        await this.setupRealtimeSubscriptions();
        await this.startMetricsCollection();
        this.logger.info('✅ EventDrivenProcessor initialized', {
            maxLatencyMs: this.config.maxLatencyMs,
            batchSize: this.config.batchSize,
            maxConcurrentEvents: this.config.maxConcurrentEvents
        });
    }
    /**
     * Setup real-time subscriptions to prop_ticks_hot table
     */
    async setupRealtimeSubscriptions() {
        try {
            // Subscribe to prop_ticks_hot INSERT events for real-time processing
            this.realtimeSubscription = this.supabase
                .channel('prop-ticks-hot-processor')
                .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'prop_ticks_hot',
                // Filter for high-value events only to reduce noise
                filter: 'steam_detected=eq.true,sharp_money_indicator=eq.true,confidence_level=gte.0.8'
            }, this.handlePropTickEvent.bind(this))
                .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    this.logger.info('✅ Real-time prop_ticks_hot subscription established');
                }
                else if (status === 'CHANNEL_ERROR') {
                    this.logger.error('❌ Prop_ticks_hot subscription failed');
                    this.metrics.circuitBreakerTrips++;
                }
            });
            // Setup fallback polling for missed events
            this.startFallbackPolling();
        }
        catch (error) {
            this.logger.error('Failed to setup realtime subscriptions', {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    /**
     * Handle incoming prop tick events with <1 second processing
     */
    async handlePropTickEvent(payload) {
        const startTime = Date.now();
        const event = payload.new;
        try {
            // Deduplication check
            if (this.isDuplicateEvent(event)) {
                this.logger.debug('Skipping duplicate event', { eventId: event.id });
                return;
            }
            // Immediate processing for critical events
            if (this.isCriticalEvent(event)) {
                await this.processCriticalEvent(event, startTime);
            }
            else {
                // Queue for batch processing
                this.queueEvent(event);
            }
            // Update metrics
            this.updateLatencyMetrics(startTime);
            this.metrics.totalEventsProcessed++;
        }
        catch (error) {
            this.handleProcessingError(error, event);
        }
    }
    /**
     * Process critical events immediately (steam, sharp money, large line movements)
     */
    async processCriticalEvent(event, startTime) {
        const eventId = `${event.prop_id}-${event.tick_timestamp}`;
        if (this.activeProcessing.has(eventId)) {
            return; // Already processing
        }
        this.activeProcessing.add(eventId);
        try {
            const processed = await this.processEvent(event, startTime);
            // Immediate alert generation for critical events
            if (processed.alertOpportunities.length > 0) {
                await this.generateImmediateAlerts(processed);
            }
            // Check for hedge opportunities
            if (processed.hedgeOpportunities.length > 0) {
                await this.processHedgeOpportunities(processed.hedgeOpportunities);
            }
            // Update ticket states if needed
            if (processed.ticketStateUpdates.length > 0) {
                await this.updateTicketStates(processed.ticketStateUpdates, event);
            }
            const processingTime = Date.now() - startTime;
            this.logger.info('⚡ Critical event processed', {
                eventId,
                processingTimeMs: processingTime,
                alertsGenerated: processed.alertOpportunities.length,
                hedgeOpportunities: processed.hedgeOpportunities.length
            });
        }
        finally {
            this.activeProcessing.delete(eventId);
        }
    }
    /**
     * Core event processing logic
     */
    async processEvent(event, startTime) {
        const processed = {
            event,
            processingStartTime: startTime,
            alertOpportunities: [],
            hedgeOpportunities: [],
            ticketStateUpdates: []
        };
        // Analyze for steam moves
        if (event.steam_detected || event.sharp_money_indicator) {
            processed.alertOpportunities.push(await this.analyzeSteamMove(event));
        }
        // Analyze significant line movements
        if (Math.abs(event.line_movement) >= 0.5) {
            processed.alertOpportunities.push(await this.analyzeLineMovement(event));
        }
        // Check for arbitrage opportunities
        const arbitrageOpps = await this.checkArbitrageOpportunities(event);
        processed.alertOpportunities.push(...arbitrageOpps);
        // Detect hedge opportunities for existing tickets
        const hedgeOpps = await this.hedgeDetectionEngine.analyzeHedgeOpportunities(event);
        processed.hedgeOpportunities.push(...hedgeOpps);
        // Identify tickets that need state updates
        processed.ticketStateUpdates = await this.identifyTicketStateUpdates(event);
        return processed;
    }
    /**
     * Analyze steam move for alert opportunity
     */
    async analyzeSteamMove(event) {
        const confidence = this.calculateSteamConfidence(event);
        return {
            type: 'steam',
            priority: confidence > 0.8 ? 'urgent' : 'high',
            confidence,
            player_name: event.player_name,
            stat_type: event.stat_type,
            trigger_data: {
                steam_detected: event.steam_detected,
                sharp_money_indicator: event.sharp_money_indicator,
                line_movement: event.line_movement,
                odds_movement: event.odds_movement,
                time_to_game: event.time_to_game,
                book: event.book
            },
            expires_at: new Date(Date.now() + (5 * 60 * 1000)).toISOString() // 5 minutes
        };
    }
    /**
     * Analyze line movement for alert opportunity
     */
    async analyzeLineMovement(event) {
        const movementMagnitude = Math.abs(event.line_movement);
        const confidence = Math.min(movementMagnitude * 0.4, 0.95);
        return {
            type: 'line_movement',
            priority: movementMagnitude > 1.0 ? 'urgent' : 'high',
            confidence,
            player_name: event.player_name,
            stat_type: event.stat_type,
            trigger_data: {
                line_movement: event.line_movement,
                odds_movement: event.odds_movement,
                movement_direction: event.line_movement > 0 ? 'up' : 'down',
                time_to_game: event.time_to_game,
                public_percentage: event.public_percentage
            },
            expires_at: new Date(Date.now() + (10 * 60 * 1000)).toISOString() // 10 minutes
        };
    }
    /**
     * Check for arbitrage opportunities across books
     */
    async checkArbitrageOpportunities(event) {
        const opportunities = [];
        try {
            // Query recent ticks for same prop across different books
            const { data: recentTicks, error } = await this.supabase
                .from('prop_ticks_hot')
                .select('*')
                .eq('prop_id', event.prop_id)
                .neq('book', event.book)
                .gte('tick_timestamp', new Date(Date.now() - 5 * 60 * 1000).toISOString())
                .order('tick_timestamp', { ascending: false })
                .limit(10);
            if (error || !recentTicks) {
                return opportunities;
            }
            for (const tick of recentTicks) {
                const arbOpportunity = this.calculateArbitrageOpportunity(event, tick);
                if (arbOpportunity && arbOpportunity.profit > 0.02) { // 2% minimum profit
                    opportunities.push({
                        type: 'arbitrage',
                        priority: 'urgent',
                        confidence: 0.9,
                        player_name: event.player_name,
                        stat_type: event.stat_type,
                        trigger_data: {
                            book_a: event.book,
                            book_b: tick.book,
                            line_a: event.line,
                            line_b: tick.line,
                            odds_a: event.over_odds || event.under_odds,
                            odds_b: tick.over_odds || tick.under_odds,
                            profit_percentage: arbOpportunity.profit,
                            stake_distribution: arbOpportunity.stakes
                        },
                        expires_at: new Date(Date.now() + (2 * 60 * 1000)).toISOString() // 2 minutes
                    });
                }
            }
        }
        catch (error) {
            this.logger.error('Error checking arbitrage opportunities', {
                propId: event.prop_id,
                error: error instanceof Error ? error.message : String(error)
            });
        }
        return opportunities;
    }
    /**
     * Calculate arbitrage opportunity between two ticks
     */
    calculateArbitrageOpportunity(tick1, tick2) {
        // Simplified arbitrage calculation
        // In production, this would be more sophisticated
        const odds1 = tick1.over_odds || tick1.under_odds || 0;
        const odds2 = tick2.over_odds || tick2.under_odds || 0;
        if (odds1 <= 0 || odds2 <= 0)
            return null;
        const prob1 = odds1 > 0 ? 100 / (odds1 + 100) : Math.abs(odds1) / (Math.abs(odds1) + 100);
        const prob2 = odds2 > 0 ? 100 / (odds2 + 100) : Math.abs(odds2) / (Math.abs(odds2) + 100);
        const totalProb = prob1 + prob2;
        if (totalProb >= 1)
            return null; // No arbitrage
        const profit = (1 / totalProb) - 1;
        return {
            profit,
            stakes: {
                book1: prob1 / totalProb,
                book2: prob2 / totalProb
            }
        };
    }
    /**
     * Identify tickets that need state updates based on prop tick
     */
    async identifyTicketStateUpdates(event) {
        const ticketIds = [];
        try {
            // Find tickets with legs matching this prop
            const { data: matchingLegs, error } = await this.supabase
                .from('ticket_legs')
                .select('ticket_id')
                .eq('player_name', event.player_name)
                .eq('stat_type', event.stat_type)
                .in('outcome', ['pending'])
                .limit(50);
            if (error || !matchingLegs) {
                return ticketIds;
            }
            for (const leg of matchingLegs) {
                if (!ticketIds.includes(leg.ticket_id)) {
                    ticketIds.push(leg.ticket_id);
                }
            }
        }
        catch (error) {
            this.logger.error('Error identifying ticket state updates', {
                event: event.id,
                error: error instanceof Error ? error.message : String(error)
            });
        }
        return ticketIds;
    }
    /**
     * Generate immediate alerts for critical events
     */
    async generateImmediateAlerts(processed) {
        for (const opportunity of processed.alertOpportunities) {
            try {
                await this.emitAlertEvent(opportunity);
                this.metrics.alertsGenerated++;
                this.logger.info('🚨 Immediate alert generated', {
                    type: opportunity.type,
                    priority: opportunity.priority,
                    player: opportunity.player_name,
                    confidence: opportunity.confidence
                });
            }
            catch (error) {
                this.logger.error('Failed to generate immediate alert', {
                    opportunity: opportunity.type,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
    }
    /**
     * Process hedge opportunities
     */
    async processHedgeOpportunities(opportunities) {
        for (const opportunity of opportunities) {
            try {
                await this.hedgeDetectionEngine.processHedgeOpportunity(opportunity);
                this.metrics.hedgeOpportunitiesFound++;
                this.logger.info('💰 Hedge opportunity processed', {
                    type: opportunity.type,
                    player: opportunity.player_name,
                    profit: opportunity.guaranteed_profit,
                    confidence: opportunity.confidence
                });
            }
            catch (error) {
                this.logger.error('Failed to process hedge opportunity', {
                    opportunity: opportunity.type,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
    }
    /**
     * Update ticket states based on event
     */
    async updateTicketStates(ticketIds, event) {
        for (const ticketId of ticketIds) {
            try {
                // Check if ticket needs cashout value update
                await this.updateTicketCashoutValue(ticketId, event);
            }
            catch (error) {
                this.logger.error('Failed to update ticket state', {
                    ticketId,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
    }
    /**
     * Update ticket cashout value based on current market conditions
     */
    async updateTicketCashoutValue(ticketId, event) {
        const ticketState = await this.ticketStateManager.getTicketState(ticketId);
        if (!ticketState)
            return;
        // Calculate new cashout value based on line movement
        // This would integrate with live odds APIs in production
        const newCashoutValue = this.calculateCashoutValue(ticketState, event);
        const evPercentage = (newCashoutValue / ticketState.potential_payout) * 100;
        if (evPercentage >= 65 && ticketState.state === 'SWEAT') {
            // Trigger hedge window
            await this.ticketStateManager.transitionToState(ticketId, 'HEDGE_WINDOW', 'cashout_ev_threshold', {
                cashout_ev_percentage: evPercentage,
                trigger_event: event.id
            });
        }
    }
    /**
     * Calculate current cashout value for a ticket
     */
    calculateCashoutValue(ticketState, event) {
        // Simplified cashout calculation
        // In production, this would use sophisticated pricing models
        const baseValue = ticketState.exposure_units;
        const lineMovementFactor = 1 + (event.line_movement * 0.1);
        return baseValue * lineMovementFactor;
    }
    // Utility Methods
    /**
     * Check if event is duplicate
     */
    isDuplicateEvent(event) {
        const eventKey = `${event.prop_id}-${event.tick_timestamp}`;
        const now = Date.now();
        if (this.deduplicationCache.has(eventKey)) {
            return true;
        }
        // Add to cache with 5-minute expiry
        this.deduplicationCache.set(eventKey, now);
        // Clean old entries
        if (this.deduplicationCache.size > 10000) {
            this.cleanDeduplicationCache();
        }
        return false;
    }
    /**
     * Check if event is critical (needs immediate processing)
     */
    isCriticalEvent(event) {
        return (event.steam_detected ||
            event.sharp_money_indicator ||
            Math.abs(event.line_movement) >= 1.0 ||
            event.time_to_game <= 60 || // Within 1 hour of game
            event.confidence_level >= 0.9);
    }
    /**
     * Queue event for batch processing
     */
    queueEvent(event) {
        const eventKey = `${event.prop_id}-${event.tick_timestamp}`;
        this.processingQueue.set(eventKey, event);
        // Process batch if queue is full
        if (this.processingQueue.size >= this.config.batchSize) {
            this.processBatch();
        }
    }
    /**
     * Process batch of queued events
     */
    async processBatch() {
        const events = Array.from(this.processingQueue.values());
        this.processingQueue.clear();
        this.logger.info('⚡ Processing event batch', {
            batchSize: events.length
        });
        const batchStartTime = Date.now();
        const promises = events.map(event => this.processEvent(event, batchStartTime));
        try {
            const results = await Promise.allSettled(promises);
            // Process successful results
            const successful = results
                .filter((result) => result.status === 'fulfilled')
                .map(result => result.value);
            // Generate alerts in batch
            await this.processBatchAlerts(successful);
        }
        catch (error) {
            this.logger.error('Batch processing failed', {
                batchSize: events.length,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    /**
     * Process alerts for batch of events
     */
    async processBatchAlerts(processedEvents) {
        const allOpportunities = processedEvents.flatMap(p => p.alertOpportunities);
        for (const opportunity of allOpportunities) {
            await this.emitAlertEvent(opportunity);
            this.metrics.alertsGenerated++;
        }
    }
    /**
     * Emit alert event to event system
     */
    async emitAlertEvent(opportunity) {
        await enhanced_circuit_breaker_1.withCircuitBreaker.supabase(async () => {
            await this.supabase
                .from('events')
                .insert({
                event_type: `alert.${opportunity.type}.detected.v1`,
                aggregate_id: `${opportunity.player_name}-${opportunity.stat_type}`,
                aggregate_type: 'prop_alert',
                event_data: opportunity,
                idempotency_key: `alert-${opportunity.type}-${Date.now()}-${Math.random()}`,
                metadata: {
                    source: 'EventDrivenProcessor',
                    priority: opportunity.priority,
                    confidence: opportunity.confidence
                }
            });
        }, async () => {
            this.logger.warn('Failed to emit alert event, circuit breaker open', {
                type: opportunity.type
            });
        });
    }
    // Performance and Monitoring
    /**
     * Update latency metrics
     */
    updateLatencyMetrics(startTime) {
        const latency = Date.now() - startTime;
        this.latencyBuffer.push(latency);
        // Keep only recent latencies for P99 calculation
        if (this.latencyBuffer.length > 1000) {
            this.latencyBuffer = this.latencyBuffer.slice(-1000);
        }
        // Update average
        const sum = this.latencyBuffer.reduce((a, b) => a + b, 0);
        this.metrics.averageLatencyMs = sum / this.latencyBuffer.length;
        // Update P99
        if (this.latencyBuffer.length >= 10) {
            const sorted = [...this.latencyBuffer].sort((a, b) => a - b);
            const p99Index = Math.floor(sorted.length * 0.99);
            this.metrics.p99LatencyMs = sorted[p99Index];
        }
    }
    /**
     * Calculate steam confidence score
     */
    calculateSteamConfidence(event) {
        let confidence = 0.5; // Base confidence
        if (event.steam_detected)
            confidence += 0.2;
        if (event.sharp_money_indicator)
            confidence += 0.2;
        if (Math.abs(event.line_movement) > 0.5)
            confidence += 0.1;
        if (event.time_to_game <= 120)
            confidence += 0.1; // Within 2 hours
        if (event.confidence_level > 0.8)
            confidence += 0.1;
        return Math.min(confidence, 0.95);
    }
    /**
     * Start fallback polling for missed events
     */
    startFallbackPolling() {
        setInterval(async () => {
            await this.pollForMissedEvents();
        }, 30000); // Every 30 seconds
    }
    /**
     * Poll for any missed events
     */
    async pollForMissedEvents() {
        try {
            const { data: recentEvents, error } = await this.supabase
                .from('prop_ticks_hot')
                .select('*')
                .gte('tick_timestamp', new Date(Date.now() - 60000).toISOString())
                .or('steam_detected.eq.true,sharp_money_indicator.eq.true')
                .order('tick_timestamp', { ascending: false })
                .limit(20);
            if (error || !recentEvents)
                return;
            for (const event of recentEvents) {
                if (!this.isDuplicateEvent(event)) {
                    await this.handlePropTickEvent({ new: event });
                }
            }
        }
        catch (error) {
            this.logger.error('Fallback polling failed', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    /**
     * Clean old deduplication cache entries
     */
    cleanDeduplicationCache() {
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        for (const [key, timestamp] of this.deduplicationCache.entries()) {
            if (timestamp < fiveMinutesAgo) {
                this.deduplicationCache.delete(key);
            }
        }
    }
    /**
     * Handle processing errors
     */
    handleProcessingError(error, event) {
        this.consecutiveErrors++;
        this.metrics.errorRate = this.consecutiveErrors / this.metrics.totalEventsProcessed;
        this.logger.error('Event processing failed', {
            eventId: event.id,
            propId: event.prop_id,
            error: error instanceof Error ? error.message : String(error),
            consecutiveErrors: this.consecutiveErrors
        });
        // Circuit breaker logic
        if (this.consecutiveErrors >= this.config.circuitBreakerThreshold) {
            this.isHealthy = false;
            this.metrics.circuitBreakerTrips++;
            // Reset after cooldown period
            setTimeout(() => {
                this.consecutiveErrors = 0;
                this.isHealthy = true;
            }, 60000); // 1 minute cooldown
        }
    }
    /**
     * Start health monitoring
     */
    startHealthMonitoring() {
        setInterval(() => {
            this.checkHealthAndResetMetrics();
        }, 5000); // Every 5 seconds
    }
    /**
     * Check health and reset metrics periodically
     */
    checkHealthAndResetMetrics() {
        const now = Date.now();
        // Calculate throughput
        if (now - this.lastThroughputCalculation >= 1000) {
            this.metrics.throughputPerSecond = this.eventsInLastSecond;
            this.eventsInLastSecond = 0;
            this.lastThroughputCalculation = now;
        }
        // Check SLO compliance
        if (this.metrics.p99LatencyMs > this.config.maxLatencyMs) {
            this.logger.warn('⚠️ SLO violation: P99 latency exceeds target', {
                p99LatencyMs: this.metrics.p99LatencyMs,
                targetMs: this.config.maxLatencyMs
            });
        }
        this.lastHealthCheck = now;
    }
    /**
     * Start metrics collection
     */
    async startMetricsCollection() {
        // Emit metrics every 30 seconds
        setInterval(() => {
            this.emitMetricsEvent();
        }, 30000);
    }
    /**
     * Emit metrics event for monitoring
     */
    async emitMetricsEvent() {
        try {
            await this.supabase
                .from('events')
                .insert({
                event_type: 'system.metrics.event_processor.v1',
                aggregate_id: 'event-driven-processor',
                aggregate_type: 'system',
                event_data: this.metrics,
                idempotency_key: `metrics-${Date.now()}`,
                metadata: {
                    source: 'EventDrivenProcessor',
                    component: 'performance_monitoring'
                }
            });
        }
        catch (error) {
            this.logger.error('Failed to emit metrics', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    /**
     * Get current performance metrics
     */
    getMetrics() {
        return { ...this.metrics };
    }
    /**
     * Get health status
     */
    getHealthStatus() {
        return {
            healthy: this.isHealthy,
            metrics: this.getMetrics()
        };
    }
    /**
     * Cleanup and shutdown
     */
    async cleanup() {
        this.logger.info('🧹 Cleaning up EventDrivenProcessor...');
        if (this.realtimeSubscription) {
            await this.realtimeSubscription.unsubscribe();
        }
        // Process any remaining queued events
        if (this.processingQueue.size > 0) {
            await this.processBatch();
        }
        this.processingQueue.clear();
        this.activeProcessing.clear();
        this.deduplicationCache.clear();
        this.logger.info('✅ EventDrivenProcessor cleanup complete');
    }
}
exports.EventDrivenProcessor = EventDrivenProcessor;
