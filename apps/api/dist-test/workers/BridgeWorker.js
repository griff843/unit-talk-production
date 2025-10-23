"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BridgeWorker = void 0;
require("dotenv/config");
const BaseAgent_1 = require("../agents/BaseAgent");
const enhanced_circuit_breaker_1 = require("../services/enhanced-circuit-breaker");
class BridgeWorker extends BaseAgent_1.BaseAgent {
    constructor(config, deps) {
        super(config, deps);
        this.eventSubscriptions = new Map();
        this.isProcessing = false;
        this.processingPromise = null;
        this.eventBatchSize = config.eventBatchSize || 10;
        this.processingInterval = config.processingInterval || 5000;
        this.maxConcurrentEvents = config.maxConcurrentEvents || 3;
        this.enableBridgeOutbox = config.enableBridgeOutbox !== false; // Default enabled
        this.bridgeOutboxBatchSize = config.bridgeOutboxBatchSize || 5;
        this.bridgeMetrics = {
            ...this.metrics,
            eventsProcessed: 0,
            eventsSkipped: 0,
            eventsFailed: 0,
            avgEventProcessingTime: 0,
            workflowsTriggered: 0,
            cooldownsRespected: 0,
            errorCount: 0,
            successCount: 0,
            bridgeOutboxEventsProcessed: 0,
            bridgeOutboxEventsFailed: 0,
            totalEventsFromBothSources: 0,
        };
        this.setupEventSubscriptions();
    }
    async initialize() {
        this.logger.info('🌉 BridgeWorker initializing with event processing capabilities...');
        // Register circuit breaker configs for external services
        enhanced_circuit_breaker_1.circuitBreaker.registerService('temporal-workflow', {
            failureThreshold: 3,
            resetTimeoutMs: 60000, // 1 minute
            timeoutMs: 30000, // 30 seconds
            retryAttempts: 2
        });
        enhanced_circuit_breaker_1.circuitBreaker.registerService('supabase-events', {
            failureThreshold: 5,
            resetTimeoutMs: 30000, // 30 seconds  
            timeoutMs: 10000, // 10 seconds
            retryAttempts: 3
        });
        // Verify events table accessibility
        try {
            await enhanced_circuit_breaker_1.withCircuitBreaker.supabase(async () => {
                if (this.hasSupabase()) {
                    const { error } = await this.requireSupabase()
                        .from('events')
                        .select('count')
                        .limit(1);
                    if (error) {
                        throw new Error(`Events table not accessible: ${error.message}`);
                    }
                }
                else {
                    throw new Error('Supabase client not available');
                }
            }, async () => {
                this.logger.warn('⚠️ Events table health check failed, continuing without verification');
            });
        }
        catch (error) {
            this.logger.warn('⚠️ Event table initialization check failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
        // Verify bridge_outbox table accessibility if enabled
        if (this.enableBridgeOutbox) {
            try {
                await enhanced_circuit_breaker_1.withCircuitBreaker.supabase(async () => {
                    if (this.hasSupabase()) {
                        const { error } = await this.requireSupabase()
                            .from('bridge_outbox')
                            .select('count')
                            .limit(1);
                        if (error) {
                            this.logger.warn('⚠️ Bridge outbox table not accessible, disabling bridge outbox processing', {
                                error: error.message
                            });
                            this.enableBridgeOutbox = false;
                        }
                        else {
                            this.logger.info('✅ Bridge outbox table verified and accessible');
                        }
                    }
                }, async () => {
                    this.logger.warn('⚠️ Bridge outbox health check failed, disabling bridge outbox processing');
                    this.enableBridgeOutbox = false;
                });
            }
            catch (error) {
                this.logger.warn('⚠️ Bridge outbox initialization check failed, disabling', {
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                this.enableBridgeOutbox = false;
            }
        }
        // Register as active subscriber
        await this.registerSubscriber();
    }
    setupEventSubscriptions() {
        // Subscribe to Smart Form ticket submissions
        this.eventSubscriptions.set('ticket.submitted.v1', this.handleTicketSubmitted.bind(this));
        this.eventSubscriptions.set('ticket_submitted', this.handleBridgeOutboxTicketSubmitted.bind(this)); // Bridge outbox format
        // Subscribe to grading completion events
        this.eventSubscriptions.set('grading.completed.v1', this.handleGradingCompleted.bind(this));
        // Subscribe to replay events
        this.eventSubscriptions.set('ticket.submitted.v1.replay', this.handleTicketSubmittedReplay.bind(this));
        this.eventSubscriptions.set('grading.completed.v1.replay', this.handleGradingCompletedReplay.bind(this));
        // Subscribe to alert re-emission events
        this.eventSubscriptions.set('alert.reemit.v1', this.handleAlertReemit.bind(this));
        // Subscribe to bridge outbox status updates
        this.eventSubscriptions.set('ticket_status_updated', this.handleBridgeOutboxStatusUpdate.bind(this));
    }
    async registerSubscriber() {
        if (!this.hasSupabase())
            return;
        const subscriberData = {
            subscriber_name: 'BridgeWorker',
            is_active: true,
            processing_config: {
                batch_size: this.eventBatchSize,
                processing_interval: this.processingInterval,
                max_concurrent: this.maxConcurrentEvents,
            },
            updated_at: new Date().toISOString(),
        };
        for (const eventType of Array.from(this.eventSubscriptions.keys())) {
            await this.requireSupabase()
                .from('event_subscribers')
                .upsert({
                ...subscriberData,
                event_type: eventType,
            });
        }
    }
    async process() {
        if (this.isProcessing)
            return;
        this.isProcessing = true;
        try {
            // Process both event sources in parallel
            const promises = [
                this.processUnprocessedEvents(), // Original events table
            ];
            if (this.enableBridgeOutbox) {
                promises.push(this.processBridgeOutboxEvents()); // New bridge outbox table
            }
            await Promise.allSettled(promises);
        }
        finally {
            this.isProcessing = false;
        }
    }
    async processUnprocessedEvents() {
        const events = await this.fetchUnprocessedEvents();
        if (events.length === 0) {
            return;
        }
        this.logger.info(`📋 Processing ${events.length} unprocessed events from events table`);
        // Process events in batches with concurrency control
        const batches = this.chunkArray(events, this.maxConcurrentEvents);
        for (const batch of batches) {
            const processingPromises = batch.map(event => this.processEvent(event));
            await Promise.allSettled(processingPromises);
        }
    }
    async processBridgeOutboxEvents() {
        const outboxEvents = await this.fetchBridgeOutboxEvents();
        if (outboxEvents.length === 0) {
            return;
        }
        this.logger.info(`📦 Processing ${outboxEvents.length} bridge outbox events`);
        // Process bridge outbox events in batches
        const batches = this.chunkArray(outboxEvents, this.bridgeOutboxBatchSize);
        for (const batch of batches) {
            const processingPromises = batch.map(event => this.processBridgeOutboxEvent(event));
            await Promise.allSettled(processingPromises);
        }
    }
    async fetchUnprocessedEvents() {
        return await enhanced_circuit_breaker_1.withCircuitBreaker.supabase(async () => {
            if (!this.hasSupabase())
                throw new Error('Supabase not available');
            const { data: events, error } = await this.requireSupabase()
                .from('events')
                .select('*')
                .is('processed_at', null)
                .is('failed_at', null)
                .lt('retry_count', this.requireSupabase().from('events').select('max_retries'))
                .order('created_at', { ascending: true })
                .limit(this.eventBatchSize);
            if (error) {
                throw new Error(`Failed to fetch events: ${error.message}`);
            }
            return events || [];
        }, async () => {
            this.logger.warn('⚠️ Supabase circuit breaker open, skipping event fetch');
            return [];
        });
    }
    async fetchBridgeOutboxEvents() {
        if (!this.enableBridgeOutbox)
            return [];
        return await enhanced_circuit_breaker_1.withCircuitBreaker.supabase(async () => {
            if (!this.hasSupabase())
                throw new Error('Supabase not available');
            const { data: events, error } = await this.requireSupabase()
                .from('bridge_outbox')
                .select('*')
                .eq('status', 'pending')
                .lte('next_attempt_at', new Date().toISOString())
                .filter('attempts', 'lt', 'max_attempts')
                .order('created_at', { ascending: true })
                .limit(this.bridgeOutboxBatchSize);
            if (error) {
                throw new Error(`Failed to fetch bridge outbox events: ${error.message}`);
            }
            return events || [];
        }, async () => {
            this.logger.warn('⚠️ Supabase circuit breaker open, skipping bridge outbox event fetch');
            return [];
        });
    }
    async processBridgeOutboxEvent(event) {
        const startTime = Date.now();
        try {
            // Mark event as processing to prevent duplicate processing
            await this.markBridgeOutboxEventAsProcessing(event);
            // Log processing start
            this.logger.info('🎫 Processing bridge outbox event', {
                eventId: event.id,
                eventType: event.event_type,
                uniqueKey: event.unique_key,
                attempts: event.attempts
            });
            // Check if handler exists
            const handler = this.eventSubscriptions.get(event.event_type);
            if (!handler) {
                this.logger.warn(`No handler for bridge outbox event type: ${event.event_type}`, { eventId: event.id });
                await this.markBridgeOutboxEventAsCompleted(event);
                return;
            }
            // Create a standardized event object for the handler
            const standardizedEvent = {
                id: event.id,
                event_type: event.event_type,
                aggregate_id: event.payload.bet_slip_id || event.unique_key,
                aggregate_type: 'ticket',
                event_data: event.payload,
                metadata: {
                    source: 'bridge_outbox',
                    unique_key: event.unique_key,
                    attempts: event.attempts,
                },
                idempotency_key: event.unique_key,
                created_at: event.created_at,
            };
            // Process the event using the same handler pattern
            await handler(standardizedEvent);
            // Mark as successfully processed
            await this.markBridgeOutboxEventAsCompleted(event);
            // Update metrics
            const processingTime = Date.now() - startTime;
            this.bridgeMetrics.bridgeOutboxEventsProcessed++;
            this.bridgeMetrics.totalEventsFromBothSources++;
            this.bridgeMetrics.successCount++;
            this.bridgeMetrics.avgEventProcessingTime =
                (this.bridgeMetrics.avgEventProcessingTime + processingTime) / 2;
            this.logger.info(`✅ Bridge outbox event processed successfully`, {
                eventId: event.id,
                eventType: event.event_type,
                uniqueKey: event.unique_key,
                processingTimeMs: processingTime
            });
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            await this.handleBridgeOutboxEventProcessingError(event, error, processingTime);
        }
    }
    async processEvent(event) {
        const startTime = Date.now();
        try {
            // Log processing start
            await this.logProcessingStart(event);
            // Check if handler exists
            const handler = this.eventSubscriptions.get(event.event_type);
            if (!handler) {
                this.logger.warn(`No handler for event type: ${event.event_type}`, { eventId: event.id });
                await this.markEventAsSkipped(event);
                return;
            }
            // Check cooldowns for replay events
            if (event.metadata?.is_replay && await this.isSubscriberInCooldown(event.event_type)) {
                this.logger.info('Subscriber in cooldown, respecting limit', {
                    eventType: event.event_type,
                    eventId: event.id
                });
                this.bridgeMetrics.cooldownsRespected++;
                return;
            }
            // Process the event
            await handler(event);
            // Mark as successfully processed
            await this.markEventAsProcessed(event);
            // Update metrics
            const processingTime = Date.now() - startTime;
            this.bridgeMetrics.eventsProcessed++;
            this.bridgeMetrics.successCount++;
            this.bridgeMetrics.avgEventProcessingTime =
                (this.bridgeMetrics.avgEventProcessingTime + processingTime) / 2;
            // Log processing completion
            await this.logProcessingComplete(event, processingTime);
            this.logger.info(`✅ Event processed successfully`, {
                eventId: event.id,
                eventType: event.event_type,
                processingTimeMs: processingTime
            });
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            await this.handleEventProcessingError(event, error, processingTime);
        }
    }
    async handleTicketSubmitted(event) {
        this.logger.info('Processing ticket submission event', {
            eventId: event.id,
            ticketId: event.aggregate_id
        });
        // Extract ticket data
        const ticketData = event.event_data;
        // Trigger Temporal grading workflow
        await this.triggerGradingWorkflow(event.aggregate_id, ticketData, event.idempotency_key);
        // Publish immediate alert opportunities (injuries, line movements)
        await this.checkForImmediateAlerts(event.aggregate_id, ticketData);
    }
    async handleTicketSubmittedReplay(event) {
        this.logger.info('Processing ticket submission replay event', {
            eventId: event.id,
            originalEventId: event.metadata?.original_event_id
        });
        // Similar to handleTicketSubmitted but with replay context
        const ticketData = {
            ...event.event_data,
            is_replay: true,
            replayed_at: new Date().toISOString(),
        };
        await this.triggerGradingWorkflow(event.aggregate_id, ticketData, `replay-${event.idempotency_key}`);
    }
    async handleGradingCompleted(event) {
        this.logger.info('Processing grading completion event', {
            eventId: event.id,
            gradingId: event.aggregate_id
        });
        const gradingData = event.event_data;
        // Emit alerts for high-tier completed grading
        if (['S-tier', 'A-tier'].includes(gradingData.tier)) {
            await this.emitHighTierAlert(event.aggregate_id, gradingData);
        }
        // Emit hedge/middle opportunity alerts
        await this.checkForHedgeMiddleOpportunities(event.aggregate_id, gradingData);
    }
    async handleGradingCompletedReplay(event) {
        this.logger.info('Processing grading completion replay event', {
            eventId: event.id,
            originalEventId: event.metadata?.original_event_id
        });
        const gradingData = {
            ...event.event_data,
            is_replay: true,
            replayed_at: new Date().toISOString(),
        };
        // Process with shorter cooldowns for replays
        await this.emitHighTierAlert(event.aggregate_id, gradingData, 0.1);
    }
    async handleAlertReemit(event) {
        this.logger.info('Processing alert re-emission event', {
            eventId: event.id,
            originalGradingEventId: event.event_data.original_grading_event_id
        });
        const alertData = {
            ...event.event_data,
            is_reemission: true,
            reemitted_at: new Date().toISOString(),
        };
        // Re-emit the alert with special handling
        await this.emitReemissionAlert(event.aggregate_id, alertData);
    }
    async triggerGradingWorkflow(ticketId, ticketData, idempotencyKey) {
        await enhanced_circuit_breaker_1.withCircuitBreaker.supabase(async () => {
            // For now, simulate workflow triggering until Temporal is properly set up
            this.logger.info('Simulating grading workflow trigger', {
                ticketId,
                idempotencyKey,
                isReplay: ticketData.is_replay || false
            });
            const workflowId = `grading-${ticketId}-${Date.now()}`;
            // Track workflow execution in database
            if (this.hasSupabase()) {
                await this.requireSupabase()
                    .from('workflow_executions')
                    .insert({
                    workflow_id: workflowId,
                    workflow_type: 'eventDrivenGradingWorkflow',
                    run_id: `${workflowId}-${Date.now()}`,
                    execution_status: 'simulated',
                    input_data: { ticketId, eventData: ticketData, idempotencyKey },
                });
            }
            this.bridgeMetrics.workflowsTriggered++;
            this.logger.info('Grading workflow triggered', {
                workflowId,
                ticketId,
                isReplay: ticketData.is_replay || false
            });
        }, async () => {
            this.logger.error('Failed to trigger grading workflow, service unavailable', {
                ticketId,
                idempotencyKey
            });
            throw new Error('Workflow service unavailable');
        });
    }
    async checkForImmediateAlerts(ticketId, ticketData) {
        // Check for injury opportunities
        if (ticketData.player_status === 'questionable' || ticketData.injury_status) {
            await this.publishEvent('alert.injury.detected.v1', ticketId, 'ticket', {
                player_name: ticketData.player_name,
                injury_status: ticketData.injury_status,
                confidence: 0.8,
            });
        }
        // Check for line movement opportunities
        if (ticketData.line_movement && Math.abs(ticketData.line_movement) > 0.5) {
            await this.publishEvent('alert.line_movement.detected.v1', ticketId, 'ticket', {
                player_name: ticketData.player_name,
                original_line: ticketData.original_line,
                current_line: ticketData.current_line,
                movement: ticketData.line_movement,
            });
        }
    }
    async checkForHedgeMiddleOpportunities(gradingId, gradingData) {
        // Analyze grading results for hedge/middle opportunities
        if (gradingData.hedge_opportunity_score > 0.7) {
            await this.publishEvent('alert.hedge.opportunity.v1', gradingId, 'grading', {
                original_pick: gradingData.original_pick,
                hedge_pick: gradingData.hedge_pick,
                opportunity_score: gradingData.hedge_opportunity_score,
            });
        }
        if (gradingData.middle_opportunity_score > 0.6) {
            await this.publishEvent('alert.middle.opportunity.v1', gradingId, 'grading', {
                picks: gradingData.middle_picks,
                opportunity_score: gradingData.middle_opportunity_score,
            });
        }
    }
    async emitHighTierAlert(gradingId, gradingData, cooldownMultiplier = 1.0) {
        const entityKey = `${gradingData.player_name}-${gradingData.stat_type}`;
        // Check cooldown
        if (await this.isAlertInCooldown('high-tier', entityKey)) {
            this.logger.info('High-tier alert in cooldown, skipping', { entityKey });
            this.bridgeMetrics.cooldownsRespected++;
            return;
        }
        await this.publishEvent('alert.high_tier.v1', gradingId, 'grading', {
            tier: gradingData.tier,
            player_name: gradingData.player_name,
            stat_type: gradingData.stat_type,
            confidence: gradingData.confidence,
            is_replay: gradingData.is_replay || false,
        });
        // Set cooldown (5 minutes * multiplier)
        await this.setCooldown('high-tier', entityKey, 300 * cooldownMultiplier);
    }
    async emitReemissionAlert(gradingId, alertData) {
        await this.publishEvent('alert.reemitted.v1', gradingId, 'grading', alertData);
    }
    // Bridge outbox specific event handlers
    async handleBridgeOutboxTicketSubmitted(event) {
        this.logger.info('Processing bridge outbox ticket submission event', {
            eventId: event.id,
            betSlipId: event.aggregate_id,
            uniqueKey: event.metadata?.unique_key
        });
        // Extract ticket data from payload
        const ticketData = event.event_data;
        // Add bridge outbox metadata for tracking
        const enrichedTicketData = {
            ...ticketData,
            source: 'bridge_outbox',
            processed_from_outbox: true,
            original_unique_key: event.metadata?.unique_key,
        };
        // Trigger Temporal grading workflow with bridge outbox context
        await this.triggerGradingWorkflow(event.aggregate_id, enrichedTicketData, event.idempotency_key);
        // Publish immediate alert opportunities (injuries, line movements)
        await this.checkForImmediateAlerts(event.aggregate_id, enrichedTicketData);
    }
    async handleBridgeOutboxStatusUpdate(event) {
        this.logger.info('Processing bridge outbox status update event', {
            eventId: event.id,
            betSlipId: event.aggregate_id,
            status: event.event_data?.status
        });
        // Handle status updates - could trigger additional workflows or alerts
        const statusData = event.event_data;
        if (statusData.status === 'completed') {
            // Ticket has been fully processed, might trigger final alerts
            await this.publishEvent('ticket.processing.completed.v1', event.aggregate_id, 'ticket', {
                ...statusData,
                processed_from_bridge_outbox: true,
            });
        }
        else if (statusData.status === 'failed') {
            // Ticket processing failed, might need error handling
            await this.publishEvent('ticket.processing.failed.v1', event.aggregate_id, 'ticket', {
                ...statusData,
                processed_from_bridge_outbox: true,
            });
        }
    }
    // Event publishing utility
    async publishEvent(eventType, aggregateId, aggregateType, eventData, idempotencyKey) {
        const key = idempotencyKey || `${eventType}-${aggregateId}-${Date.now()}`;
        if (this.hasSupabase()) {
            await this.requireSupabase()
                .from('events')
                .insert({
                event_type: eventType,
                aggregate_id: aggregateId,
                aggregate_type: aggregateType,
                event_data: eventData,
                idempotency_key: key,
                metadata: {
                    created_by: 'BridgeWorker',
                    source_event: true,
                },
            });
        }
    }
    async isAlertInCooldown(alertType, entityKey) {
        if (!this.hasSupabase())
            return false;
        const { data } = await this.requireSupabase()
            .from('alert_cooldowns')
            .select('cooldown_until')
            .eq('alert_type', alertType)
            .eq('entity_key', entityKey)
            .gt('cooldown_until', new Date().toISOString())
            .limit(1);
        return Boolean(data && data.length > 0);
    }
    async isSubscriberInCooldown(eventType) {
        if (!this.hasSupabase())
            return false;
        const { data } = await this.requireSupabase()
            .from('event_subscribers')
            .select('cooldown_until')
            .eq('subscriber_name', 'BridgeWorker')
            .eq('event_type', eventType)
            .gt('cooldown_until', new Date().toISOString())
            .limit(1);
        return Boolean(data && data.length > 0);
    }
    async setCooldown(alertType, entityKey, seconds) {
        if (!this.hasSupabase())
            return;
        const cooldownUntil = new Date(Date.now() + seconds * 1000).toISOString();
        await this.requireSupabase()
            .from('alert_cooldowns')
            .upsert({
            alert_type: alertType,
            entity_key: entityKey,
            cooldown_until: cooldownUntil,
        });
    }
    async markEventAsProcessed(event) {
        if (!this.hasSupabase())
            return;
        await this.requireSupabase()
            .from('events')
            .update({
            processed_at: new Date().toISOString(),
            retry_count: event.retry_count + 1
        })
            .eq('id', event.id);
    }
    async markEventAsSkipped(event) {
        if (!this.hasSupabase())
            return;
        await this.requireSupabase()
            .from('events')
            .update({
            processed_at: new Date().toISOString(),
            retry_count: event.retry_count + 1,
            metadata: {
                ...event.metadata,
                skipped: true,
                skip_reason: 'No handler available',
            }
        })
            .eq('id', event.id);
        this.bridgeMetrics.eventsSkipped++;
    }
    // Bridge outbox database operations
    async markBridgeOutboxEventAsProcessing(event) {
        if (!this.hasSupabase())
            return;
        await this.requireSupabase()
            .from('bridge_outbox')
            .update({
            status: 'processing',
            attempts: event.attempts + 1,
            next_attempt_at: new Date(Date.now() + 60000).toISOString(), // 1 minute retry
        })
            .eq('id', event.id);
    }
    async markBridgeOutboxEventAsCompleted(event) {
        if (!this.hasSupabase())
            return;
        await this.requireSupabase()
            .from('bridge_outbox')
            .update({
            status: 'completed',
            processed_at: new Date().toISOString(),
            attempts: event.attempts + 1,
        })
            .eq('id', event.id);
    }
    async handleBridgeOutboxEventProcessingError(event, error, processingTime) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const shouldRetry = event.attempts + 1 < event.max_attempts;
        this.bridgeMetrics.bridgeOutboxEventsFailed++;
        this.bridgeMetrics.errorCount++;
        if (shouldRetry) {
            // Calculate exponential backoff: 1min, 5min, 15min
            const backoffMinutes = Math.pow(3, event.attempts + 1);
            const nextAttempt = new Date(Date.now() + backoffMinutes * 60 * 1000);
            // Update retry count and schedule next attempt
            if (this.hasSupabase()) {
                await this.requireSupabase()
                    .from('bridge_outbox')
                    .update({
                    status: 'pending',
                    attempts: event.attempts + 1,
                    next_attempt_at: nextAttempt.toISOString(),
                    error_message: errorMessage,
                })
                    .eq('id', event.id);
            }
            this.logger.warn(`Bridge outbox event processing failed, will retry`, {
                eventId: event.id,
                eventType: event.event_type,
                uniqueKey: event.unique_key,
                attempts: event.attempts + 1,
                maxAttempts: event.max_attempts,
                nextAttempt: nextAttempt.toISOString(),
                error: errorMessage,
            });
        }
        else {
            // Mark as permanently failed
            if (this.hasSupabase()) {
                await this.requireSupabase()
                    .from('bridge_outbox')
                    .update({
                    status: 'failed',
                    processed_at: new Date().toISOString(),
                    attempts: event.attempts + 1,
                    error_message: errorMessage,
                })
                    .eq('id', event.id);
            }
            this.logger.error(`Bridge outbox event processing permanently failed`, {
                eventId: event.id,
                eventType: event.event_type,
                uniqueKey: event.unique_key,
                attempts: event.attempts + 1,
                error: errorMessage,
            });
        }
    }
    async handleEventProcessingError(event, error, processingTime) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const shouldRetry = event.retry_count < event.max_retries;
        this.bridgeMetrics.eventsFailed++;
        this.bridgeMetrics.errorCount++;
        if (shouldRetry) {
            // Update retry count
            if (this.hasSupabase()) {
                await this.requireSupabase()
                    .from('events')
                    .update({
                    retry_count: event.retry_count + 1,
                    metadata: {
                        ...event.metadata,
                        last_error: errorMessage,
                        last_error_at: new Date().toISOString(),
                    }
                })
                    .eq('id', event.id);
            }
            this.logger.warn(`Event processing failed, will retry`, {
                eventId: event.id,
                eventType: event.event_type,
                retryCount: event.retry_count + 1,
                maxRetries: event.max_retries,
                error: errorMessage,
            });
        }
        else {
            // Mark as permanently failed
            if (this.hasSupabase()) {
                await this.requireSupabase()
                    .from('events')
                    .update({
                    failed_at: new Date().toISOString(),
                    retry_count: event.retry_count + 1,
                    metadata: {
                        ...event.metadata,
                        failed_permanently: true,
                        final_error: errorMessage,
                    }
                })
                    .eq('id', event.id);
            }
            this.logger.error(`Event processing permanently failed`, {
                eventId: event.id,
                eventType: event.event_type,
                retryCount: event.retry_count,
                error: errorMessage,
            });
        }
        // Log processing failure
        await this.logProcessingFailure(event, errorMessage, processingTime);
    }
    async logProcessingStart(event) {
        if (!this.hasSupabase())
            return;
        await this.requireSupabase()
            .from('event_processing_logs')
            .insert({
            event_id: event.id,
            subscriber_name: 'BridgeWorker',
            processing_status: 'started',
        });
    }
    async logProcessingComplete(event, processingTime) {
        if (!this.hasSupabase())
            return;
        await this.requireSupabase()
            .from('event_processing_logs')
            .insert({
            event_id: event.id,
            subscriber_name: 'BridgeWorker',
            processing_status: 'completed',
            processing_completed_at: new Date().toISOString(),
            processing_duration_ms: processingTime,
        });
    }
    async logProcessingFailure(event, errorMessage, processingTime) {
        if (!this.hasSupabase())
            return;
        await this.requireSupabase()
            .from('event_processing_logs')
            .insert({
            event_id: event.id,
            subscriber_name: 'BridgeWorker',
            processing_status: 'failed',
            processing_completed_at: new Date().toISOString(),
            processing_duration_ms: processingTime,
            error_message: errorMessage,
        });
    }
    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }
    async collectMetrics() {
        return {
            ...this.bridgeMetrics,
            memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024,
        };
    }
    async checkHealth() {
        const checks = [];
        // Check Supabase connectivity for events table
        try {
            if (this.hasSupabase()) {
                await this.requireSupabase().from('events').select('count').limit(1);
                checks.push({ service: 'supabase-events', status: 'healthy' });
            }
            else {
                checks.push({ service: 'supabase-events', status: 'unhealthy', error: 'Client not available' });
            }
        }
        catch (error) {
            checks.push({
                service: 'supabase-events',
                status: 'unhealthy',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
        // Check Supabase connectivity for bridge outbox table
        if (this.enableBridgeOutbox) {
            try {
                if (this.hasSupabase()) {
                    await this.requireSupabase().from('bridge_outbox').select('count').limit(1);
                    checks.push({ service: 'supabase-bridge-outbox', status: 'healthy' });
                }
                else {
                    checks.push({ service: 'supabase-bridge-outbox', status: 'unhealthy', error: 'Client not available' });
                }
            }
            catch (error) {
                checks.push({
                    service: 'supabase-bridge-outbox',
                    status: 'unhealthy',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        else {
            checks.push({ service: 'supabase-bridge-outbox', status: 'disabled', note: 'Bridge outbox processing disabled' });
        }
        // Check Temporal connectivity (simulated for now)
        try {
            // Simulate temporal health check until service is properly configured
            checks.push({ service: 'temporal', status: 'healthy', note: 'simulated' });
        }
        catch (error) {
            checks.push({
                service: 'temporal',
                status: 'unhealthy',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
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
        return {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            details: {
                checks,
                metrics: this.bridgeMetrics,
                processing: {
                    isProcessing: this.isProcessing,
                    eventBatchSize: this.eventBatchSize,
                    processingInterval: this.processingInterval,
                    bridgeOutboxEnabled: this.enableBridgeOutbox,
                    bridgeOutboxBatchSize: this.bridgeOutboxBatchSize,
                },
            }
        };
    }
    async cleanup() {
        this.logger.info('🧹 BridgeWorker cleanup initiated...');
        // Stop processing
        this.isProcessing = false;
        // Wait for current processing to complete
        if (this.processingPromise) {
            await this.processingPromise;
        }
        // Deactivate subscriber
        if (this.hasSupabase()) {
            await this.requireSupabase()
                .from('event_subscribers')
                .update({
                is_active: false,
                updated_at: new Date().toISOString()
            })
                .eq('subscriber_name', 'BridgeWorker');
        }
        this.logger.info('🧹 BridgeWorker cleanup complete');
    }
}
exports.BridgeWorker = BridgeWorker;
