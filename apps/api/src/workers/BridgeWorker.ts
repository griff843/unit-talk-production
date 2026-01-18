import 'dotenv/config';
import { BaseAgent } from '../agents/BaseAgent';
import {
  BaseAgentConfig,
  BaseAgentDependencies,
  BaseMetrics,
  HealthStatus,
} from '../agents/BaseAgent/types';
import {
  withCircuitBreaker,
  circuitBreaker,
} from '../services/enhanced-circuit-breaker';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../shared/logger/types';
import {
  AgentControlPlane,
  createAgentControlPlane,
} from '../temporal/AgentControlPlane';
import {
  AgentInstrumentation,
  createAgentInstrumentation,
} from '../lib/AgentInstrumentation';

interface BridgeWorkerConfig extends BaseAgentConfig {
  eventBatchSize: number;
  processingInterval: number;
  maxConcurrentEvents: number;
  enableBridgeOutbox: boolean;
  bridgeOutboxBatchSize: number;
}

interface BridgeWorkerMetrics extends BaseMetrics {
  eventsProcessed: number;
  eventsSkipped: number;
  eventsFailed: number;
  avgEventProcessingTime: number;
  workflowsTriggered: number;
  cooldownsRespected: number;
  bridgeOutboxEventsProcessed: number;
  bridgeOutboxEventsFailed: number;
  totalEventsFromBothSources: number;
}

interface EventRecord {
  id: string;
  event_type: string;
  aggregate_id: string;
  aggregate_type: string;
  event_data: any;
  metadata: any;
  idempotency_key: string;
  created_at: string;
  processed_at?: string;
  failed_at?: string;
  retry_count: number;
  max_retries: number;
}

interface BridgeOutboxRecord {
  id: string;
  event_type: string;
  payload: any;
  unique_key: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  max_attempts: number;
  next_attempt_at: string;
  created_at: string;
  processed_at?: string;
  error_message?: string;
}

export class BridgeWorker extends BaseAgent {
  private eventSubscriptions: Map<string, Function> = new Map();
  private isProcessing = false;
  private processingPromise: Promise<void> | null = null;
  private bridgeMetrics: BridgeWorkerMetrics;
  private eventBatchSize: number;
  private processingInterval: number;
  private maxConcurrentEvents: number;
  private enableBridgeOutbox: boolean;
  private bridgeOutboxBatchSize: number;

  // Agent Control Plane - Phase 1 enforcement
  private controlPlane: AgentControlPlane | null = null;
  private instrumentation: AgentInstrumentation | null = null;
  private readonly agentId = 'bridge-worker';

  constructor(config: BridgeWorkerConfig, deps: BaseAgentDependencies) {
    super(config, deps);

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

  protected async initialize(): Promise<void> {
    this.logger.info(
      '🌉 BridgeWorker initializing with event processing capabilities...'
    );

    // Initialize Agent Control Plane for lifecycle enforcement
    if (this.hasSupabase()) {
      this.controlPlane = createAgentControlPlane(
        this.requireSupabase(),
        this.logger,
        this.agentId
      );
      this.instrumentation = createAgentInstrumentation(this.agentId);
      this.logger.info('✅ Agent Control Plane initialized for enforcement');
    } else {
      this.logger.warn(
        '⚠️ Agent Control Plane skipped - Supabase not available'
      );
    }

    // Register circuit breaker configs for external services
    circuitBreaker.registerService('temporal-workflow', {
      failureThreshold: 3,
      resetTimeoutMs: 60000, // 1 minute
      timeoutMs: 30000, // 30 seconds
      retryAttempts: 2,
    });

    circuitBreaker.registerService('supabase-events', {
      failureThreshold: 5,
      resetTimeoutMs: 30000, // 30 seconds
      timeoutMs: 10000, // 10 seconds
      retryAttempts: 3,
    });

    // Verify events table accessibility
    try {
      await withCircuitBreaker.supabase(
        async () => {
          if (this.hasSupabase()) {
            const { error } = await this.requireSupabase()
              .from('events')
              .select('count')
              .limit(1);

            if (error) {
              throw new Error(`Events table not accessible: ${error.message}`);
            }
          } else {
            throw new Error('Supabase client not available');
          }
        },
        async () => {
          this.logger.warn(
            '⚠️ Events table health check failed, continuing without verification'
          );
        }
      );
    } catch (error) {
      this.logger.warn('⚠️ Event table initialization check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Verify bridge_outbox table accessibility if enabled
    if (this.enableBridgeOutbox) {
      try {
        await withCircuitBreaker.supabase(
          async () => {
            if (this.hasSupabase()) {
              const { error } = await this.requireSupabase()
                .from('bridge_outbox')
                .select('count')
                .limit(1);

              if (error) {
                this.logger.warn(
                  '⚠️ Bridge outbox table not accessible, disabling bridge outbox processing',
                  {
                    error: error.message,
                  }
                );
                this.enableBridgeOutbox = false;
              } else {
                this.logger.info(
                  '✅ Bridge outbox table verified and accessible'
                );
              }
            }
          },
          async () => {
            this.logger.warn(
              '⚠️ Bridge outbox health check failed, disabling bridge outbox processing'
            );
            this.enableBridgeOutbox = false;
          }
        );
      } catch (error) {
        this.logger.warn(
          '⚠️ Bridge outbox initialization check failed, disabling',
          {
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        );
        this.enableBridgeOutbox = false;
      }
    }

    // Register as active subscriber
    await this.registerSubscriber();
  }

  private setupEventSubscriptions(): void {
    // Subscribe to Smart Form ticket submissions
    this.eventSubscriptions.set(
      'ticket.submitted.v1',
      this.handleTicketSubmitted.bind(this)
    );
    this.eventSubscriptions.set(
      'ticket_submitted',
      this.handleBridgeOutboxTicketSubmitted.bind(this)
    ); // Bridge outbox format

    // Subscribe to grading completion events
    this.eventSubscriptions.set(
      'grading.completed.v1',
      this.handleGradingCompleted.bind(this)
    );

    // Subscribe to replay events
    this.eventSubscriptions.set(
      'ticket.submitted.v1.replay',
      this.handleTicketSubmittedReplay.bind(this)
    );
    this.eventSubscriptions.set(
      'grading.completed.v1.replay',
      this.handleGradingCompletedReplay.bind(this)
    );

    // Subscribe to alert re-emission events
    this.eventSubscriptions.set(
      'alert.reemit.v1',
      this.handleAlertReemit.bind(this)
    );

    // Subscribe to bridge outbox status updates
    this.eventSubscriptions.set(
      'ticket_status_updated',
      this.handleBridgeOutboxStatusUpdate.bind(this)
    );
  }

  private async registerSubscriber(): Promise<void> {
    if (!this.hasSupabase()) return;

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

  protected async process(): Promise<void> {
    if (this.isProcessing) return;

    // ================================================================
    // AGENT CONTROL PLANE ENFORCEMENT GATE (Phase 1)
    // This is the PRIMARY enforcement point - checked BEFORE any work
    // ================================================================
    if (this.controlPlane) {
      const shouldProcess = await this.controlPlane.shouldProcess();

      if (!shouldProcess) {
        // Agent is paused/stopped/killed/frozen - do NOT process events
        // BUT still report heartbeat so operators can observe we are alive
        const status = await this.controlPlane.getControlStatus();
        this.logger.info('🛑 BridgeWorker paused by control plane', {
          agentId: this.agentId,
          desiredState: status.desiredState,
          currentState: status.currentState,
          systemFreeze: status.systemFreeze,
        });

        // Report heartbeat even when paused (metrics show we are alive)
        if (this.instrumentation) {
          await this.controlPlane.updateHeartbeat('paused', {
            runCount: this.instrumentation.getAggregatedMetrics().runCount,
            successCount:
              this.instrumentation.getAggregatedMetrics().successCount,
            failureCount:
              this.instrumentation.getAggregatedMetrics().failureCount,
          });
        }

        return; // Exit without processing
      }
    }
    // ================================================================

    this.isProcessing = true;

    // Start instrumentation cycle if available
    if (this.instrumentation) {
      this.instrumentation.startCycle();
    }

    try {
      // Process both event sources in parallel
      const promises = [
        this.processUnprocessedEvents(), // Original events table
      ];

      if (this.enableBridgeOutbox) {
        promises.push(this.processBridgeOutboxEvents()); // New bridge outbox table
      }

      await Promise.allSettled(promises);

      // Record success
      if (this.instrumentation) {
        this.instrumentation.recordEventsProcessed(
          this.bridgeMetrics.eventsProcessed +
            this.bridgeMetrics.bridgeOutboxEventsProcessed
        );
        this.instrumentation.endCycle(true);
      }
    } catch (error) {
      // Record failure
      if (this.instrumentation) {
        this.instrumentation.recordEventsFailed(1);
        this.instrumentation.endCycle(false);
      }
      throw error;
    } finally {
      this.isProcessing = false;

      // Report heartbeat with current metrics after each cycle
      if (this.controlPlane && this.instrumentation) {
        const metrics = this.instrumentation.getAggregatedMetrics();
        await this.controlPlane.updateHeartbeat('running', {
          runCount: metrics.runCount,
          successCount: metrics.successCount,
          failureCount: metrics.failureCount,
          avgLatencyMs: metrics.avgLatencyMs,
          backlogSize: metrics.backlogSize,
        });
      }
    }
  }

  private async processUnprocessedEvents(): Promise<void> {
    const events = await this.fetchUnprocessedEvents();

    if (events.length === 0) {
      return;
    }

    this.logger.info(
      `📋 Processing ${events.length} unprocessed events from events table`
    );

    // Process events in batches with concurrency control
    const batches = this.chunkArray(events, this.maxConcurrentEvents);

    for (const batch of batches) {
      const processingPromises = batch.map((event) => this.processEvent(event));
      await Promise.allSettled(processingPromises);
    }
  }

  private async processBridgeOutboxEvents(): Promise<void> {
    const outboxEvents = await this.fetchBridgeOutboxEvents();

    if (outboxEvents.length === 0) {
      return;
    }

    this.logger.info(
      `📦 Processing ${outboxEvents.length} bridge outbox events`
    );

    // Process bridge outbox events in batches
    const batches = this.chunkArray(outboxEvents, this.bridgeOutboxBatchSize);

    for (const batch of batches) {
      const processingPromises = batch.map((event) =>
        this.processBridgeOutboxEvent(event)
      );
      await Promise.allSettled(processingPromises);
    }
  }

  private async fetchUnprocessedEvents(): Promise<EventRecord[]> {
    return await withCircuitBreaker.supabase(
      async () => {
        if (!this.hasSupabase()) throw new Error('Supabase not available');

        const { data: events, error } = await this.requireSupabase()
          .from('events')
          .select('*')
          .is('processed_at', null)
          .is('failed_at', null)
          .lt(
            'retry_count',
            this.requireSupabase().from('events').select('max_retries')
          )
          .order('created_at', { ascending: true })
          .limit(this.eventBatchSize);

        if (error) {
          throw new Error(`Failed to fetch events: ${error.message}`);
        }

        return events || [];
      },
      async () => {
        this.logger.warn(
          '⚠️ Supabase circuit breaker open, skipping event fetch'
        );
        return [];
      }
    );
  }

  private async fetchBridgeOutboxEvents(): Promise<BridgeOutboxRecord[]> {
    if (!this.enableBridgeOutbox) return [];

    return await withCircuitBreaker.supabase(
      async () => {
        if (!this.hasSupabase()) throw new Error('Supabase not available');

        const { data: events, error } = await this.requireSupabase()
          .from('bridge_outbox')
          .select('*')
          .eq('status', 'pending')
          .lte('next_attempt_at', new Date().toISOString())
          .filter('attempts', 'lt', 'max_attempts')
          .order('created_at', { ascending: true })
          .limit(this.bridgeOutboxBatchSize);

        if (error) {
          throw new Error(
            `Failed to fetch bridge outbox events: ${error.message}`
          );
        }

        return events || [];
      },
      async () => {
        this.logger.warn(
          '⚠️ Supabase circuit breaker open, skipping bridge outbox event fetch'
        );
        return [];
      }
    );
  }

  private async processBridgeOutboxEvent(
    event: BridgeOutboxRecord
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Mark event as processing to prevent duplicate processing
      await this.markBridgeOutboxEventAsProcessing(event);

      // Log processing start
      this.logger.info('🎫 Processing bridge outbox event', {
        eventId: event.id,
        eventType: event.event_type,
        uniqueKey: event.unique_key,
        attempts: event.attempts,
      });

      // Check if handler exists
      const handler = this.eventSubscriptions.get(event.event_type);
      if (!handler) {
        this.logger.warn(
          `No handler for bridge outbox event type: ${event.event_type}`,
          { eventId: event.id }
        );
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
        processingTimeMs: processingTime,
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;
      await this.handleBridgeOutboxEventProcessingError(
        event,
        error,
        processingTime
      );
    }
  }

  private async processEvent(event: EventRecord): Promise<void> {
    const startTime = Date.now();

    try {
      // Log processing start
      await this.logProcessingStart(event);

      // Check if handler exists
      const handler = this.eventSubscriptions.get(event.event_type);
      if (!handler) {
        this.logger.warn(`No handler for event type: ${event.event_type}`, {
          eventId: event.id,
        });
        await this.markEventAsSkipped(event);
        return;
      }

      // Check cooldowns for replay events
      if (
        event.metadata?.is_replay &&
        (await this.isSubscriberInCooldown(event.event_type))
      ) {
        this.logger.info('Subscriber in cooldown, respecting limit', {
          eventType: event.event_type,
          eventId: event.id,
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
        processingTimeMs: processingTime,
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;
      await this.handleEventProcessingError(event, error, processingTime);
    }
  }

  private async handleTicketSubmitted(event: EventRecord): Promise<void> {
    this.logger.info('Processing ticket submission event', {
      eventId: event.id,
      ticketId: event.aggregate_id,
    });

    // Extract ticket data
    const ticketData = event.event_data;

    // Trigger Temporal grading workflow
    await this.triggerGradingWorkflow(
      event.aggregate_id,
      ticketData,
      event.idempotency_key
    );

    // Publish immediate alert opportunities (injuries, line movements)
    await this.checkForImmediateAlerts(event.aggregate_id, ticketData);
  }

  private async handleTicketSubmittedReplay(event: EventRecord): Promise<void> {
    this.logger.info('Processing ticket submission replay event', {
      eventId: event.id,
      originalEventId: event.metadata?.original_event_id,
    });

    // Similar to handleTicketSubmitted but with replay context
    const ticketData = {
      ...event.event_data,
      is_replay: true,
      replayed_at: new Date().toISOString(),
    };

    await this.triggerGradingWorkflow(
      event.aggregate_id,
      ticketData,
      `replay-${event.idempotency_key}`
    );
  }

  private async handleGradingCompleted(event: EventRecord): Promise<void> {
    this.logger.info('Processing grading completion event', {
      eventId: event.id,
      gradingId: event.aggregate_id,
    });

    const gradingData = event.event_data;

    // Emit alerts for high-tier completed grading
    if (['S-tier', 'A-tier'].includes(gradingData.tier)) {
      await this.emitHighTierAlert(event.aggregate_id, gradingData);
    }

    // Emit hedge/middle opportunity alerts
    await this.checkForHedgeMiddleOpportunities(
      event.aggregate_id,
      gradingData
    );
  }

  private async handleGradingCompletedReplay(
    event: EventRecord
  ): Promise<void> {
    this.logger.info('Processing grading completion replay event', {
      eventId: event.id,
      originalEventId: event.metadata?.original_event_id,
    });

    const gradingData = {
      ...event.event_data,
      is_replay: true,
      replayed_at: new Date().toISOString(),
    };

    // Process with shorter cooldowns for replays
    await this.emitHighTierAlert(event.aggregate_id, gradingData, 0.1);
  }

  private async handleAlertReemit(event: EventRecord): Promise<void> {
    this.logger.info('Processing alert re-emission event', {
      eventId: event.id,
      originalGradingEventId: event.event_data.original_grading_event_id,
    });

    const alertData = {
      ...event.event_data,
      is_reemission: true,
      reemitted_at: new Date().toISOString(),
    };

    // Re-emit the alert with special handling
    await this.emitReemissionAlert(event.aggregate_id, alertData);
  }

  private async triggerGradingWorkflow(
    ticketId: string,
    ticketData: any,
    idempotencyKey: string
  ): Promise<void> {
    await withCircuitBreaker.supabase(
      async () => {
        // For now, simulate workflow triggering until Temporal is properly set up
        this.logger.info('Simulating grading workflow trigger', {
          ticketId,
          idempotencyKey,
          isReplay: ticketData.is_replay || false,
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
          isReplay: ticketData.is_replay || false,
        });
      },
      async () => {
        this.logger.error(
          'Failed to trigger grading workflow, service unavailable',
          {
            ticketId,
            idempotencyKey,
          }
        );
        throw new Error('Workflow service unavailable');
      }
    );
  }

  private async checkForImmediateAlerts(
    ticketId: string,
    ticketData: any
  ): Promise<void> {
    // Check for injury opportunities
    if (
      ticketData.player_status === 'questionable' ||
      ticketData.injury_status
    ) {
      await this.publishEvent('alert.injury.detected.v1', ticketId, 'ticket', {
        player_name: ticketData.player_name,
        injury_status: ticketData.injury_status,
        confidence: 0.8,
      });
    }

    // Check for line movement opportunities
    if (ticketData.line_movement && Math.abs(ticketData.line_movement) > 0.5) {
      await this.publishEvent(
        'alert.line_movement.detected.v1',
        ticketId,
        'ticket',
        {
          player_name: ticketData.player_name,
          original_line: ticketData.original_line,
          current_line: ticketData.current_line,
          movement: ticketData.line_movement,
        }
      );
    }
  }

  private async checkForHedgeMiddleOpportunities(
    gradingId: string,
    gradingData: any
  ): Promise<void> {
    // Analyze grading results for hedge/middle opportunities
    if (gradingData.hedge_opportunity_score > 0.7) {
      await this.publishEvent(
        'alert.hedge.opportunity.v1',
        gradingId,
        'grading',
        {
          original_pick: gradingData.original_pick,
          hedge_pick: gradingData.hedge_pick,
          opportunity_score: gradingData.hedge_opportunity_score,
        }
      );
    }

    if (gradingData.middle_opportunity_score > 0.6) {
      await this.publishEvent(
        'alert.middle.opportunity.v1',
        gradingId,
        'grading',
        {
          picks: gradingData.middle_picks,
          opportunity_score: gradingData.middle_opportunity_score,
        }
      );
    }
  }

  private async emitHighTierAlert(
    gradingId: string,
    gradingData: any,
    cooldownMultiplier: number = 1.0
  ): Promise<void> {
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

  private async emitReemissionAlert(
    gradingId: string,
    alertData: any
  ): Promise<void> {
    await this.publishEvent('alert.reemitted.v1', gradingId, 'grading', alertData);
  }

  // Bridge outbox specific event handlers
  private async handleBridgeOutboxTicketSubmitted(event: any): Promise<void> {
    this.logger.info('Processing bridge outbox ticket submission event', {
      eventId: event.id,
      betSlipId: event.aggregate_id,
      uniqueKey: event.metadata?.unique_key,
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
    await this.triggerGradingWorkflow(
      event.aggregate_id,
      enrichedTicketData,
      event.idempotency_key
    );

    // Publish immediate alert opportunities (injuries, line movements)
    await this.checkForImmediateAlerts(event.aggregate_id, enrichedTicketData);
  }

  private async handleBridgeOutboxStatusUpdate(event: any): Promise<void> {
    this.logger.info('Processing bridge outbox status update event', {
      eventId: event.id,
      betSlipId: event.aggregate_id,
      status: event.event_data?.status,
    });

    // Handle status updates - could trigger additional workflows or alerts
    const statusData = event.event_data;

    if (statusData.status === 'completed') {
      // Ticket has been fully processed, might trigger final alerts
      await this.publishEvent(
        'ticket.processing.completed.v1',
        event.aggregate_id,
        'ticket',
        {
          ...statusData,
          processed_from_bridge_outbox: true,
        }
      );
    } else if (statusData.status === 'failed') {
      // Ticket processing failed, might need error handling
      await this.publishEvent(
        'ticket.processing.failed.v1',
        event.aggregate_id,
        'ticket',
        {
          ...statusData,
          processed_from_bridge_outbox: true,
        }
      );
    }
  }

  // Event publishing utility
  private async publishEvent(
    eventType: string,
    aggregateId: string,
    aggregateType: string,
    eventData: any,
    idempotencyKey?: string
  ): Promise<void> {
    const key =
      idempotencyKey || `${eventType}-${aggregateId}-${Date.now()}`;

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

  private async isAlertInCooldown(
    alertType: string,
    entityKey: string
  ): Promise<boolean> {
    if (!this.hasSupabase()) return false;

    const { data } = await this.requireSupabase()
      .from('alert_cooldowns')
      .select('cooldown_until')
      .eq('alert_type', alertType)
      .eq('entity_key', entityKey)
      .gt('cooldown_until', new Date().toISOString())
      .limit(1);

    return data && data.length > 0;
  }

  private async isSubscriberInCooldown(eventType: string): Promise<boolean> {
    if (!this.hasSupabase()) return false;

    const { data } = await this.requireSupabase()
      .from('event_subscribers')
      .select('cooldown_until')
      .eq('subscriber_name', 'BridgeWorker')
      .eq('event_type', eventType)
      .gt('cooldown_until', new Date().toISOString())
      .limit(1);

    return data && data.length > 0;
  }

  private async setCooldown(
    alertType: string,
    entityKey: string,
    seconds: number
  ): Promise<void> {
    if (!this.hasSupabase()) return;

    const cooldownUntil = new Date(Date.now() + seconds * 1000).toISOString();

    await this.requireSupabase().from('alert_cooldowns').upsert({
      alert_type: alertType,
      entity_key: entityKey,
      cooldown_until: cooldownUntil,
    });
  }

  private async markEventAsProcessed(event: EventRecord): Promise<void> {
    if (!this.hasSupabase()) return;

    await this.requireSupabase()
      .from('events')
      .update({
        processed_at: new Date().toISOString(),
        retry_count: event.retry_count + 1,
      })
      .eq('id', event.id);
  }

  private async markEventAsSkipped(event: EventRecord): Promise<void> {
    if (!this.hasSupabase()) return;

    await this.requireSupabase()
      .from('events')
      .update({
        processed_at: new Date().toISOString(),
        retry_count: event.retry_count + 1,
        metadata: {
          ...event.metadata,
          skipped: true,
          skip_reason: 'No handler available',
        },
      })
      .eq('id', event.id);

    this.bridgeMetrics.eventsSkipped++;
  }

  // Bridge outbox database operations
  private async markBridgeOutboxEventAsProcessing(
    event: BridgeOutboxRecord
  ): Promise<void> {
    if (!this.hasSupabase()) return;

    await this.requireSupabase()
      .from('bridge_outbox')
      .update({
        status: 'processing',
        attempts: event.attempts + 1,
        next_attempt_at: new Date(Date.now() + 60000).toISOString(), // 1 minute retry
      })
      .eq('id', event.id);
  }

  private async markBridgeOutboxEventAsCompleted(
    event: BridgeOutboxRecord
  ): Promise<void> {
    if (!this.hasSupabase()) return;

    await this.requireSupabase()
      .from('bridge_outbox')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
        attempts: event.attempts + 1,
      })
      .eq('id', event.id);
  }

  private async handleBridgeOutboxEventProcessingError(
    event: BridgeOutboxRecord,
    error: any,
    processingTime: number
  ): Promise<void> {
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
    } else {
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

  private async handleEventProcessingError(
    event: EventRecord,
    error: any,
    processingTime: number
  ): Promise<void> {
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
            },
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
    } else {
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
            },
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

  private async logProcessingStart(event: EventRecord): Promise<void> {
    if (!this.hasSupabase()) return;

    await this.requireSupabase().from('event_processing_logs').insert({
      event_id: event.id,
      subscriber_name: 'BridgeWorker',
      processing_status: 'started',
    });
  }

  private async logProcessingComplete(
    event: EventRecord,
    processingTime: number
  ): Promise<void> {
    if (!this.hasSupabase()) return;

    await this.requireSupabase().from('event_processing_logs').insert({
      event_id: event.id,
      subscriber_name: 'BridgeWorker',
      processing_status: 'completed',
      processing_completed_at: new Date().toISOString(),
      processing_duration_ms: processingTime,
    });
  }

  private async logProcessingFailure(
    event: EventRecord,
    errorMessage: string,
    processingTime: number
  ): Promise<void> {
    if (!this.hasSupabase()) return;

    await this.requireSupabase().from('event_processing_logs').insert({
      event_id: event.id,
      subscriber_name: 'BridgeWorker',
      processing_status: 'failed',
      processing_completed_at: new Date().toISOString(),
      processing_duration_ms: processingTime,
      error_message: errorMessage,
    });
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    return {
      ...this.bridgeMetrics,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024,
    };
  }

  public async checkHealth(): Promise<HealthStatus> {
    const checks = [];

    // Check Supabase connectivity for events table
    try {
      if (this.hasSupabase()) {
        await this.requireSupabase().from('events').select('count').limit(1);
        checks.push({ service: 'supabase-events', status: 'healthy' });
      } else {
        checks.push({
          service: 'supabase-events',
          status: 'unhealthy',
          error: 'Client not available',
        });
      }
    } catch (error) {
      checks.push({
        service: 'supabase-events',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Check Supabase connectivity for bridge outbox table
    if (this.enableBridgeOutbox) {
      try {
        if (this.hasSupabase()) {
          await this.requireSupabase()
            .from('bridge_outbox')
            .select('count')
            .limit(1);
          checks.push({ service: 'supabase-bridge-outbox', status: 'healthy' });
        } else {
          checks.push({
            service: 'supabase-bridge-outbox',
            status: 'unhealthy',
            error: 'Client not available',
          });
        }
      } catch (error) {
        checks.push({
          service: 'supabase-bridge-outbox',
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } else {
      checks.push({
        service: 'supabase-bridge-outbox',
        status: 'disabled',
        note: 'Bridge outbox processing disabled',
      });
    }

    // Check Temporal connectivity (simulated for now)
    try {
      // Simulate temporal health check until service is properly configured
      checks.push({ service: 'temporal', status: 'healthy', note: 'simulated' });
    } catch (error) {
      checks.push({
        service: 'temporal',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Check Agent Control Plane status
    if (this.controlPlane) {
      try {
        const controlStatus = await this.controlPlane.getControlStatus();
        checks.push({
          service: 'agent-control-plane',
          status: 'healthy',
          desiredState: controlStatus.desiredState,
          currentState: controlStatus.currentState,
        });
      } catch (error) {
        checks.push({
          service: 'agent-control-plane',
          status: 'degraded',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const healthyServices = checks.filter(
      (check) => check.status === 'healthy'
    ).length;
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
        controlPlane: {
          enabled: this.controlPlane !== null,
          agentId: this.agentId,
        },
      },
    };
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('🧹 BridgeWorker cleanup initiated...');

    // Report state transition to control plane
    if (this.controlPlane) {
      await this.controlPlane.reportStateTransition(
        'running',
        'stopped',
        'cleanup_initiated'
      );
    }

    // Stop processing
    this.isProcessing = false;

    // Wait for current processing to complete
    if (this.processingPromise) {
      await this.processingPromise;
    }

    // Signal drain complete if we were in draining state
    if (this.controlPlane) {
      const status = await this.controlPlane.getControlStatus();
      if (status.desiredState === 'draining') {
        await this.controlPlane.signalDrainComplete();
        this.logger.info('✅ Drain complete signaled to control plane');
      }
    }

    // Deactivate subscriber
    if (this.hasSupabase()) {
      await this.requireSupabase()
        .from('event_subscribers')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('subscriber_name', 'BridgeWorker');
    }

    // Final heartbeat with stopped state
    if (this.controlPlane && this.instrumentation) {
      const metrics = this.instrumentation.getAggregatedMetrics();
      await this.controlPlane.updateHeartbeat('stopped', {
        runCount: metrics.runCount,
        successCount: metrics.successCount,
        failureCount: metrics.failureCount,
      });
    }

    this.logger.info('🧹 BridgeWorker cleanup complete');
  }
}
