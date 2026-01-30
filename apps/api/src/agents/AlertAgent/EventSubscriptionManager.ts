/* eslint-disable max-lines, max-lines-per-function, complexity */
import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

import { withCircuitBreaker } from '../../services/enhanced-circuit-breaker';
import { Logger } from '../../shared/logger/types';

import { AlertEngineV2 } from './v2/alertEngineV2';

import type { AlertSignal, AlertType } from './v2/types';

interface EventSubscriptionConfig {
  batchSize: number;
  processingTimeout: number;
  retryAttempts: number;
  cooldownSeconds: number;
}

interface AlertOpportunity {
  type: 'injury' | 'line_movement' | 'steam' | 'hedge' | 'middle';
  player_name: string;
  stat_type: string;
  confidence: number;
  metadata: any;
}

export class EventSubscriptionManager {
  private supabase: SupabaseClient;
  private logger: Logger;
  private subscriptions: RealtimeChannel[] = [];
  private config: EventSubscriptionConfig;
  private isInitialized = false;
  private processingQueue: Map<string, any[]> = new Map();
  private alertEngineV2: AlertEngineV2 | null = null;

  constructor(supabase: SupabaseClient, logger: Logger, config?: Partial<EventSubscriptionConfig>) {
    this.supabase = supabase;
    this.logger = logger;
    this.config = {
      batchSize: 5,
      processingTimeout: 30000, // 30 seconds
      retryAttempts: 3,
      cooldownSeconds: 300, // 5 minutes
      ...config,
    };

    // Initialize AlertEngine V2 if flag-gated on
    if (process.env.ALERT_ENGINE_V2 === 'true') {
      this.alertEngineV2 = new AlertEngineV2();
      this.logger.info('🆕 AlertEngine V2 enabled in EventSubscriptionManager');
    }
  }

  async setupEventSubscriptions(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('Event subscriptions already initialized');
      return;
    }

    try {
      // Subscribe to events table for real-time processing
      const eventsChannel = this.supabase
        .channel('alert-agent-events')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'events',
            filter:
              'event_type=in.(ticket.submitted.v1,grading.completed.v1,alert.reemit.v1,ticket.processing.completed.v1,ticket.processing.failed.v1)',
          },
          this.handleNewEvent.bind(this)
        )
        .subscribe(status => {
          if (status === 'SUBSCRIBED') {
            this.logger.info('✅ AlertAgent event subscriptions established');
          } else if (status === 'CHANNEL_ERROR') {
            this.logger.error('❌ AlertAgent event subscription failed');
          }
        });

      this.subscriptions.push(eventsChannel);

      // Subscribe to high-priority alert events
      const alertsChannel = this.supabase
        .channel('alert-agent-alerts')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'events',
            filter:
              'event_type=in.(alert.injury.detected.v1,alert.high_tier.v1,alert.hedge.opportunity.v1,alert.middle.opportunity.v1,alert.line_movement.detected.v1)',
          },
          this.handleAlertEvent.bind(this)
        )
        .subscribe();

      this.subscriptions.push(alertsChannel);

      // Subscribe to bridge outbox events for Smart Form integration
      const bridgeOutboxChannel = this.supabase
        .channel('alert-agent-bridge-outbox')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'bridge_outbox',
            filter: 'status=eq.completed',
          },
          this.handleBridgeOutboxCompletion.bind(this)
        )
        .subscribe(status => {
          if (status === 'SUBSCRIBED') {
            this.logger.info('✅ AlertAgent bridge outbox subscriptions established');
          } else if (status === 'CHANNEL_ERROR') {
            this.logger.error('❌ AlertAgent bridge outbox subscription failed');
          }
        });

      this.subscriptions.push(bridgeOutboxChannel);

      // Subscribe to workflow execution events for Temporal integration
      const workflowChannel = this.supabase
        .channel('alert-agent-workflows')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'workflow_executions',
            filter: 'execution_status=in.(completed,failed)',
          },
          this.handleWorkflowCompletion.bind(this)
        )
        .subscribe();

      this.subscriptions.push(workflowChannel);

      this.isInitialized = true;
      this.logger.info('🔗 Event subscriptions established', {
        channels: this.subscriptions.length,
        config: this.config,
      });
    } catch (error) {
      this.logger.error('Failed to setup event subscriptions', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async handleNewEvent(payload: any): Promise<void> {
    const event = payload.new;

    try {
      this.logger.info('📥 Received new event', {
        eventId: event.id,
        eventType: event.event_type,
        aggregateId: event.aggregate_id,
      });

      // Route event to appropriate handler
      switch (event.event_type) {
        case 'ticket.submitted.v1':
          await this.processTicketSubmission(event);
          break;
        case 'grading.completed.v1':
          await this.processGradingCompletion(event);
          break;
        case 'alert.reemit.v1':
          await this.processAlertReemission(event);
          break;
        default:
          this.logger.warn('Unhandled event type', {
            eventType: event.event_type,
            eventId: event.id,
          });
      }
    } catch (error) {
      this.logger.error('Failed to handle new event', {
        eventId: event.id,
        eventType: event.event_type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handleAlertEvent(payload: any): Promise<void> {
    const event = payload.new;

    try {
      this.logger.info('🚨 Received alert event', {
        eventId: event.id,
        eventType: event.event_type,
      });

      // Process alert immediately (high priority)
      await this.processAlertEvent(event);
    } catch (error) {
      this.logger.error('Failed to handle alert event', {
        eventId: event.id,
        eventType: event.event_type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async processTicketSubmission(event: any): Promise<void> {
    this.logger.info('Processing ticket submission via event', { eventId: event.id });

    const ticketData = event.event_data;

    // Analyze ticket for immediate alert opportunities
    const alertOpportunities = await this.analyzeTicketForAlerts(ticketData);

    for (const opportunity of alertOpportunities) {
      await this.emitAlert(opportunity, event.aggregate_id);
    }

    // Add to processing queue for batch processing if needed
    this.addToProcessingQueue('ticket_submissions', event);
  }

  private async processGradingCompletion(event: any): Promise<void> {
    this.logger.info('Processing grading completion via event', { eventId: event.id });

    const gradingData = event.event_data;

    // Check for high-tier picks that need immediate alerts
    if (['S-tier', 'A-tier'].includes(gradingData.tier)) {
      await this.emitHighTierAlert(gradingData, event.aggregate_id);
    }

    // Check for hedge/middle opportunities
    const hedgeMiddleOpportunities = await this.analyzeForHedgeMiddle(gradingData);

    for (const opportunity of hedgeMiddleOpportunities) {
      await this.emitAlert(opportunity, event.aggregate_id);
    }

    // Add to processing queue
    this.addToProcessingQueue('grading_completions', event);
  }

  private async processAlertReemission(event: any): Promise<void> {
    this.logger.info('Processing alert re-emission via event', { eventId: event.id });

    const alertData = event.event_data;

    // Re-emit the alert with special reemission context
    await this.emitReemissionAlert(alertData, event.aggregate_id);
  }

  private async processAlertEvent(event: any): Promise<void> {
    // Process high-priority alert events immediately
    const alertType = event.event_type.split('.')[1]; // Extract 'injury', 'high_tier', etc.

    await this.triggerImmediateAlert(alertType, event.event_data, event.aggregate_id);
  }

  private async analyzeTicketForAlerts(ticketData: any): Promise<AlertOpportunity[]> {
    const opportunities: AlertOpportunity[] = [];

    try {
      // Injury detection
      if (ticketData.player_status === 'questionable' || ticketData.injury_reports?.length > 0) {
        opportunities.push({
          type: 'injury',
          player_name: ticketData.player_name,
          stat_type: ticketData.stat_type,
          confidence: this.calculateInjuryConfidence(ticketData),
          metadata: {
            injury_status: ticketData.player_status,
            injury_reports: ticketData.injury_reports,
            game_time: ticketData.game_time,
          },
        });
      }

      // Line movement detection
      if (ticketData.line_history && ticketData.line_history.length > 1) {
        const lineMovement = this.calculateLineMovement(ticketData.line_history);

        if (Math.abs(lineMovement.change) > 0.5) {
          opportunities.push({
            type: 'line_movement',
            player_name: ticketData.player_name,
            stat_type: ticketData.stat_type,
            confidence: Math.min(Math.abs(lineMovement.change) * 0.4, 0.9),
            metadata: {
              original_line: lineMovement.original,
              current_line: lineMovement.current,
              change: lineMovement.change,
              direction: lineMovement.direction,
            },
          });
        }
      }

      // Steam detection (sharp money movement)
      if (ticketData.betting_percentages && ticketData.line_movement) {
        const steamScore = this.calculateSteamScore(ticketData);

        if (steamScore > 0.7) {
          opportunities.push({
            type: 'steam',
            player_name: ticketData.player_name,
            stat_type: ticketData.stat_type,
            confidence: steamScore,
            metadata: {
              public_percentage: ticketData.betting_percentages.public,
              sharp_percentage: ticketData.betting_percentages.sharp,
              line_movement: ticketData.line_movement,
            },
          });
        }
      }
    } catch (error) {
      this.logger.error('Error analyzing ticket for alerts', {
        ticketId: ticketData.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return opportunities;
  }

  private async analyzeForHedgeMiddle(gradingData: any): Promise<AlertOpportunity[]> {
    const opportunities: AlertOpportunity[] = [];

    try {
      // Hedge opportunity detection
      if (gradingData.original_pick && gradingData.current_market_conditions) {
        const hedgeScore = this.calculateHedgeOpportunity(gradingData);

        if (hedgeScore > 0.6) {
          opportunities.push({
            type: 'hedge',
            player_name: gradingData.player_name,
            stat_type: gradingData.stat_type,
            confidence: hedgeScore,
            metadata: {
              original_pick: gradingData.original_pick,
              hedge_pick: gradingData.recommended_hedge,
              profit_potential: gradingData.hedge_profit_potential,
            },
          });
        }
      }

      // Middle opportunity detection
      if (gradingData.market_analysis && gradingData.market_analysis.middle_opportunities) {
        const middleOpportunities = gradingData.market_analysis.middle_opportunities;

        for (const middle of middleOpportunities) {
          if (middle.profit_probability > 0.5) {
            opportunities.push({
              type: 'middle',
              player_name: gradingData.player_name,
              stat_type: gradingData.stat_type,
              confidence: middle.profit_probability,
              metadata: {
                picks: middle.picks,
                profit_range: middle.profit_range,
                required_books: middle.required_books,
              },
            });
          }
        }
      }
    } catch (error) {
      this.logger.error('Error analyzing for hedge/middle opportunities', {
        gradingId: gradingData.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return opportunities;
  }

  private async emitAlert(opportunity: AlertOpportunity, aggregateId: string): Promise<void> {
    if (this.alertEngineV2) {
      await this.processSignalV2(opportunity, aggregateId);
      return;
    }
    await this.emitAlertLegacy(opportunity, aggregateId);
  }

  private async emitAlertLegacy(opportunity: AlertOpportunity, aggregateId: string): Promise<void> {
    const entityKey = `${opportunity.player_name}-${opportunity.stat_type}`;

    if (await this.isAlertInCooldown(opportunity.type, entityKey)) {
      this.logger.info('Alert in cooldown, skipping', {
        type: opportunity.type,
        entityKey,
      });
      return;
    }

    try {
      await this.insertAlertEvent(opportunity, aggregateId);
      await this.setCooldown(opportunity.type, entityKey, this.config.cooldownSeconds);
    } catch (error) {
      this.logger.error('Failed to emit alert', {
        type: opportunity.type,
        player: opportunity.player_name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async insertAlertEvent(
    opportunity: AlertOpportunity,
    aggregateId: string
  ): Promise<void> {
    await withCircuitBreaker.supabase(
      async () => {
        const alertEventData = {
          alert_type: opportunity.type,
          player_name: opportunity.player_name,
          stat_type: opportunity.stat_type,
          confidence: opportunity.confidence,
          metadata: opportunity.metadata,
          created_at: new Date().toISOString(),
        };

        await this.supabase.from('events').insert({
          event_type: `alert.${opportunity.type}.triggered.v1`,
          aggregate_id: aggregateId,
          aggregate_type: 'alert',
          event_data: alertEventData,
          idempotency_key: `alert-${opportunity.type}-${aggregateId}-${Date.now()}`,
          metadata: {
            source: 'EventSubscriptionManager',
            priority: this.getAlertPriority(opportunity.type),
          },
        });

        this.logger.info('Alert emitted successfully', {
          type: opportunity.type,
          player: opportunity.player_name,
          confidence: opportunity.confidence,
        });
      },
      async () => {
        this.logger.error('Failed to emit alert, Supabase circuit breaker open', {
          type: opportunity.type,
          player: opportunity.player_name,
        });
      }
    );
  }

  private async emitHighTierAlert(gradingData: any, aggregateId: string): Promise<void> {
    const alertData = {
      tier: gradingData.tier,
      player_name: gradingData.player_name,
      stat_type: gradingData.stat_type,
      confidence: gradingData.confidence,
      edge_score: gradingData.edge_score,
      is_replay: gradingData.is_replay || false,
    };

    await this.supabase.from('events').insert({
      event_type: 'alert.high_tier.triggered.v1',
      aggregate_id: aggregateId,
      aggregate_type: 'grading',
      event_data: alertData,
      idempotency_key: `high-tier-${aggregateId}-${Date.now()}`,
      metadata: {
        source: 'EventSubscriptionManager',
        priority: 'high',
      },
    });

    this.logger.info('✅ High-tier alert emitted', {
      tier: gradingData.tier,
      player: gradingData.player_name,
      confidence: gradingData.confidence,
    });
  }

  private async emitReemissionAlert(alertData: any, aggregateId: string): Promise<void> {
    await this.supabase.from('events').insert({
      event_type: 'alert.reemission.triggered.v1',
      aggregate_id: aggregateId,
      aggregate_type: 'alert',
      event_data: {
        ...alertData,
        reemitted_at: new Date().toISOString(),
      },
      idempotency_key: `reemission-${aggregateId}-${Date.now()}`,
      metadata: {
        source: 'EventSubscriptionManager',
        priority: 'normal',
        is_reemission: true,
      },
    });

    this.logger.info('✅ Re-emission alert emitted', {
      originalType: alertData.original_alert_type,
      aggregateId,
    });
  }

  private async triggerImmediateAlert(
    alertType: string,
    alertData: any,
    aggregateId: string
  ): Promise<void> {
    // Process high-priority alerts immediately without queueing
    this.logger.info('🚨 Processing immediate alert', { alertType, aggregateId });

    // This would integrate with existing AlertAgent Discord posting logic
    // For now, we'll emit a processed alert event
    await this.supabase.from('events').insert({
      event_type: `alert.${alertType}.processed.v1`,
      aggregate_id: aggregateId,
      aggregate_type: 'alert',
      event_data: {
        ...alertData,
        processed_at: new Date().toISOString(),
        processing_method: 'immediate',
      },
      idempotency_key: `immediate-${alertType}-${aggregateId}-${Date.now()}`,
    });
  }

  private addToProcessingQueue(queueName: string, event: any): void {
    if (!this.processingQueue.has(queueName)) {
      this.processingQueue.set(queueName, []);
    }

    const queue = this.processingQueue.get(queueName)!;
    queue.push(event);

    // Process batch if queue is full
    if (queue.length >= this.config.batchSize) {
      this.processBatch(queueName);
    }
  }

  private async processBatch(queueName: string): Promise<void> {
    const queue = this.processingQueue.get(queueName);
    if (!queue || queue.length === 0) return;

    const batch = queue.splice(0, this.config.batchSize);

    try {
      this.logger.info(`Processing batch of ${batch.length} events`, { queueName });

      // Process batch events - this could trigger additional workflows
      for (const event of batch) {
        // Batch processing logic here
        await this.processBatchEvent(event);
      }
    } catch (error) {
      this.logger.error('Batch processing failed', {
        queueName,
        batchSize: batch.length,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async processBatchEvent(event: any): Promise<void> {
    // Placeholder for batch event processing
    this.logger.debug('Processing batch event', { eventId: event.id });
  }

  // Utility methods
  private calculateInjuryConfidence(ticketData: any): number {
    let confidence = 0.5; // Base confidence

    if (ticketData.player_status === 'questionable') confidence += 0.2;
    if (ticketData.injury_reports?.length > 0) confidence += 0.1;
    if (ticketData.game_time && this.isGameTimeClose(ticketData.game_time)) confidence += 0.15;

    return Math.min(confidence, 0.95);
  }

  private calculateLineMovement(lineHistory: any[]): {
    original: number;
    current: number;
    change: number;
    direction: string;
  } {
    const original = lineHistory[0].line;
    const current = lineHistory[lineHistory.length - 1].line;
    const change = current - original;

    return {
      original,
      current,
      change,
      direction: change > 0 ? 'up' : 'down',
    };
  }

  private calculateSteamScore(ticketData: any): number {
    const publicPercentage = ticketData.betting_percentages?.public || 0;
    const lineMovement = Math.abs(ticketData.line_movement || 0);

    // Steam typically occurs when line moves against public money
    if (publicPercentage > 70 && lineMovement > 0.5) {
      return Math.min(0.3 + lineMovement * 0.4 + (100 - publicPercentage) * 0.01, 0.95);
    }

    return 0;
  }

  private calculateHedgeOpportunity(gradingData: any): number {
    // Simplified hedge calculation
    const originalConfidence = gradingData.confidence || 0;
    const currentMarketShift = gradingData.market_shift || 0;

    if (originalConfidence > 0.8 && Math.abs(currentMarketShift) > 0.3) {
      return Math.min(originalConfidence + Math.abs(currentMarketShift), 0.95);
    }

    return 0;
  }

  private isGameTimeClose(gameTime: string): boolean {
    const gameDate = new Date(gameTime);
    const now = new Date();
    const hoursUntilGame = (gameDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    return hoursUntilGame <= 2 && hoursUntilGame >= 0; // Within 2 hours of game time
  }

  private getAlertPriority(alertType: string): string {
    const priorities = {
      injury: 'high',
      steam: 'high',
      line_movement: 'medium',
      hedge: 'medium',
      middle: 'normal',
    };

    return priorities[alertType] || 'normal';
  }

  private async isAlertInCooldown(alertType: string, entityKey: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('alert_cooldowns')
      .select('cooldown_until')
      .eq('alert_type', alertType)
      .eq('entity_key', entityKey)
      .gt('cooldown_until', new Date().toISOString())
      .limit(1);

    return data && data.length > 0;
  }

  private async setCooldown(alertType: string, entityKey: string, seconds: number): Promise<void> {
    const cooldownUntil = new Date(Date.now() + seconds * 1000).toISOString();

    await this.supabase.from('alert_cooldowns').upsert({
      alert_type: alertType,
      entity_key: entityKey,
      cooldown_until: cooldownUntil,
      metadata: {
        set_at: new Date().toISOString(),
        duration_seconds: seconds,
      },
    });
  }

  async getSubscriptionStatus(): Promise<{ active: number; total: number; channels: string[] }> {
    return {
      active: this.subscriptions.filter(sub => sub.state === 'joined').length,
      total: this.subscriptions.length,
      channels: this.subscriptions.map(sub => sub.topic),
    };
  }

  /**
   * Handle bridge outbox completion events for Smart Form integration
   */
  private async handleBridgeOutboxCompletion(payload: any): Promise<void> {
    const outboxRecord = payload.new;

    try {
      this.logger.info('📦 Received bridge outbox completion', {
        outboxId: outboxRecord.id,
        eventType: outboxRecord.event_type,
        uniqueKey: outboxRecord.unique_key,
        attempts: outboxRecord.attempts,
      });

      // Route to appropriate handler based on event type from bridge outbox
      switch (outboxRecord.event_type) {
        case 'ticket.submitted.v1':
          await this.processBridgeTicketSubmission(outboxRecord);
          break;
        case 'ticket.processing.completed.v1':
          await this.processBridgeTicketCompletion(outboxRecord);
          break;
        case 'grading.completed.v1':
          await this.processBridgeGradingCompletion(outboxRecord);
          break;
        default:
          this.logger.warn('Unhandled bridge outbox event type', {
            eventType: outboxRecord.event_type,
            outboxId: outboxRecord.id,
          });
      }

      // Mark outbox event as processed by AlertAgent (optional tracking)
      await this.recordBridgeOutboxProcessing(outboxRecord.id, 'processed');
    } catch (error) {
      this.logger.error('Failed to handle bridge outbox completion', {
        outboxId: outboxRecord.id,
        eventType: outboxRecord.event_type,
        error: error instanceof Error ? error.message : String(error),
      });

      // Mark as failed for retry or manual review
      await this.recordBridgeOutboxProcessing(outboxRecord.id, 'failed');
    }
  }

  /**
   * Handle workflow execution completion events for Temporal integration
   */
  private async handleWorkflowCompletion(payload: any): Promise<void> {
    const workflowExecution = payload.new;

    try {
      this.logger.info('🔄 Received workflow completion', {
        workflowId: workflowExecution.workflow_id,
        betSlipId: workflowExecution.bet_slip_id,
        executionStatus: workflowExecution.execution_status,
        processingTime: workflowExecution.processing_time_ms,
      });

      // Process workflow completion based on status
      if (workflowExecution.execution_status === 'completed') {
        await this.processWorkflowSuccess(workflowExecution);
      } else if (workflowExecution.execution_status === 'failed') {
        await this.processWorkflowFailure(workflowExecution);
      }

      // Check for alert-worthy conditions from workflow results
      const alertOpportunities = await this.analyzeWorkflowForAlerts(workflowExecution);
      for (const opportunity of alertOpportunities) {
        await this.emitAlert(opportunity, workflowExecution.bet_slip_id);
      }
    } catch (error) {
      this.logger.error('Failed to handle workflow completion', {
        workflowId: workflowExecution.workflow_id,
        betSlipId: workflowExecution.bet_slip_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Process bridge outbox ticket submission from Smart Form
   */
  private async processBridgeTicketSubmission(outboxRecord: any): Promise<void> {
    this.logger.info('Processing bridge ticket submission', { outboxId: outboxRecord.id });

    const ticketData = outboxRecord.payload;

    // Enhanced analysis for Smart Form submissions
    const alertOpportunities = await this.analyzeTicketForAlerts(ticketData);

    // Add Smart Form specific context
    for (const opportunity of alertOpportunities) {
      opportunity.metadata = {
        ...opportunity.metadata,
        source: 'smart_form_bridge',
        unique_key: outboxRecord.unique_key,
        submission_timestamp: outboxRecord.created_at,
      };

      await this.emitAlert(opportunity, outboxRecord.unique_key);
    }

    // Queue for batch processing if needed
    this.addToProcessingQueue('bridge_submissions', outboxRecord);
  }

  /**
   * Process bridge outbox ticket completion
   */
  private async processBridgeTicketCompletion(outboxRecord: any): Promise<void> {
    this.logger.info('Processing bridge ticket completion', { outboxId: outboxRecord.id });

    const completionData = outboxRecord.payload;

    // Check for immediate alerting conditions
    if (completionData.requires_immediate_alert) {
      await this.triggerImmediateAlert(
        'bridge_completion',
        completionData,
        outboxRecord.unique_key
      );
    }
  }

  /**
   * Process bridge outbox grading completion
   */
  private async processBridgeGradingCompletion(outboxRecord: any): Promise<void> {
    this.logger.info('Processing bridge grading completion', { outboxId: outboxRecord.id });

    const gradingData = outboxRecord.payload;

    // Enhanced grading analysis for bridge events
    if (['S-tier', 'A-tier'].includes(gradingData.tier)) {
      await this.emitHighTierAlert(
        {
          ...gradingData,
          source: 'smart_form_bridge',
        },
        outboxRecord.unique_key
      );
    }

    // Check for hedge/middle opportunities from bridge data
    const hedgeMiddleOpportunities = await this.analyzeForHedgeMiddle(gradingData);
    for (const opportunity of hedgeMiddleOpportunities) {
      opportunity.metadata = {
        ...opportunity.metadata,
        source: 'smart_form_bridge',
        bridge_unique_key: outboxRecord.unique_key,
      };

      await this.emitAlert(opportunity, outboxRecord.unique_key);
    }
  }

  /**
   * Process successful workflow execution
   */
  private async processWorkflowSuccess(workflowExecution: any): Promise<void> {
    this.logger.info('Processing workflow success', {
      workflowId: workflowExecution.workflow_id,
      betSlipId: workflowExecution.bet_slip_id,
    });

    // Extract grading results from workflow execution data
    const workflowResults = workflowExecution.execution_result || {};

    // Check for high-tier results that need immediate alerts
    if (workflowResults.tier && ['S-tier', 'A-tier'].includes(workflowResults.tier)) {
      await this.emitHighTierAlert(
        {
          ...workflowResults,
          workflow_id: workflowExecution.workflow_id,
          source: 'temporal_workflow',
        },
        workflowExecution.bet_slip_id
      );
    }
  }

  /**
   * Process failed workflow execution
   */
  private async processWorkflowFailure(workflowExecution: any): Promise<void> {
    this.logger.warn('Processing workflow failure', {
      workflowId: workflowExecution.workflow_id,
      betSlipId: workflowExecution.bet_slip_id,
      errorMessage: workflowExecution.error_message,
    });

    // Emit workflow failure alert for monitoring
    await this.supabase.from('events').insert({
      event_type: 'alert.workflow.failure.v1',
      aggregate_id: workflowExecution.bet_slip_id,
      aggregate_type: 'workflow',
      event_data: {
        workflow_id: workflowExecution.workflow_id,
        bet_slip_id: workflowExecution.bet_slip_id,
        error_message: workflowExecution.error_message,
        processing_time_ms: workflowExecution.processing_time_ms,
        failure_timestamp: new Date().toISOString(),
      },
      idempotency_key: `workflow-failure-${workflowExecution.workflow_id}-${Date.now()}`,
      metadata: {
        source: 'EventSubscriptionManager',
        priority: 'high',
        alert_type: 'system_failure',
      },
    });
  }

  /**
   * Analyze workflow execution results for alert opportunities
   */
  private async analyzeWorkflowForAlerts(workflowExecution: any): Promise<AlertOpportunity[]> {
    const opportunities: AlertOpportunity[] = [];

    try {
      const executionResult = workflowExecution.execution_result || {};

      // Check for hedge opportunities from workflow results
      if (executionResult.hedge_recommendations?.length > 0) {
        for (const hedge of executionResult.hedge_recommendations) {
          opportunities.push({
            type: 'hedge',
            player_name: hedge.player_name || 'Multiple',
            stat_type: hedge.stat_type || 'combined',
            confidence: hedge.confidence || 0.7,
            metadata: {
              hedge_type: hedge.type,
              profit_potential: hedge.profit_potential,
              recommended_books: hedge.recommended_books,
              workflow_id: workflowExecution.workflow_id,
              source: 'temporal_workflow',
            },
          });
        }
      }

      // Check for middle opportunities
      if (executionResult.middle_opportunities?.length > 0) {
        for (const middle of executionResult.middle_opportunities) {
          opportunities.push({
            type: 'middle',
            player_name: middle.player_name || 'Multiple',
            stat_type: middle.stat_type || 'combined',
            confidence: middle.profit_probability || 0.6,
            metadata: {
              profit_range: middle.profit_range,
              required_picks: middle.required_picks,
              books_needed: middle.books_needed,
              workflow_id: workflowExecution.workflow_id,
              source: 'temporal_workflow',
            },
          });
        }
      }
    } catch (error) {
      this.logger.error('Error analyzing workflow for alerts', {
        workflowId: workflowExecution.workflow_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return opportunities;
  }

  /**
   * Record bridge outbox processing status for tracking
   */
  private async recordBridgeOutboxProcessing(
    outboxId: string,
    status: 'processed' | 'failed'
  ): Promise<void> {
    try {
      await withCircuitBreaker.supabase(
        async () => {
          await this.supabase.from('alert_processing_log').insert({
            source_type: 'bridge_outbox',
            source_id: outboxId,
            processing_status: status,
            processed_by: 'AlertAgent',
            processed_at: new Date().toISOString(),
            metadata: {
              agent: 'EventSubscriptionManager',
              processing_type: 'bridge_outbox_completion',
            },
          });
        },
        async () => {
          this.logger.warn('Failed to record bridge outbox processing, circuit breaker open', {
            outboxId,
            status,
          });
        }
      );
    } catch (error) {
      this.logger.error('Error recording bridge outbox processing', {
        outboxId,
        status,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Process an alert through the V2 engine pipeline.
   */
  private async processSignalV2(opportunity: AlertOpportunity, aggregateId: string): Promise<void> {
    const signal: AlertSignal = {
      type: opportunity.type as AlertType,
      sport: opportunity.metadata?.sport || 'unknown',
      market: opportunity.stat_type,
      player_name: opportunity.player_name,
      player_id: opportunity.metadata?.player_id,
      team_id: opportunity.metadata?.team_id,
      team_name: opportunity.metadata?.team_name,
      game_id: aggregateId,
      line: opportunity.metadata?.current_line ?? opportunity.metadata?.line,
      odds: opportunity.metadata?.odds,
      book: opportunity.metadata?.book,
      detection: opportunity.metadata || {},
      timestamp: new Date().toISOString(),
    };
    const result = await this.alertEngineV2!.processSignal(signal);
    if (result) {
      this.logger.info('V2 alert processed', {
        alertKey: result.alert_key,
        type: result.type,
        dryRun: result.dry_run,
      });
    } else {
      this.logger.info('V2 alert suppressed (cooldown/idempotency)', {
        type: opportunity.type,
        player: opportunity.player_name,
      });
    }
  }

  async cleanup(): Promise<void> {
    this.logger.info('🧹 Cleaning up event subscriptions...');

    // Cleanup V2 engine if initialized
    if (this.alertEngineV2) {
      this.alertEngineV2.destroy();
      this.alertEngineV2 = null;
    }

    for (const subscription of this.subscriptions) {
      try {
        await subscription.unsubscribe();
      } catch (error) {
        this.logger.warn('Failed to unsubscribe from channel', {
          topic: subscription.topic,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.subscriptions = [];
    this.processingQueue.clear();
    this.isInitialized = false;

    this.logger.info('✅ Event subscriptions cleanup complete');
  }
}
