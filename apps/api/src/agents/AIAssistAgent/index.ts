/**
 * AI Assist Agent
 * Phase 12: Event-driven AI analysis and Discord integration
 *
 * Subscribes to pick.scored and pick.failed events, generates AI summaries,
 * and posts them to Discord via the notification queue.
 */

import { BaseAgent } from '../BaseAgent';
import type { BaseAgentConfig, BaseAgentDependencies } from '../BaseAgent/types';
import { logger } from '../../shared/logger';
import { AssistGateway, AssistantFactory } from '../../services/ai';
import { getAIMetrics } from '../../services/ai/PrometheusMetrics';

export class AIAssistAgent extends BaseAgent {
  private assistGateway!: AssistGateway;
  private assistantFactory!: AssistantFactory;
  private aiMetrics: ReturnType<typeof getAIMetrics>;
  private eventSubscriptions: any[] = [];
  private tenantId: string;
  private defaultChannelId: string;

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);

    // Get configuration from environment
    this.tenantId = process.env.DEFAULT_TENANT_ID || '';
    this.defaultChannelId = process.env.AI_INSIGHTS_DISCORD_CHANNEL_ID || '';

    this.aiMetrics = getAIMetrics(3002);

    logger.info('AIAssistAgent constructed', {
      name: config.name,
      tenantId: this.tenantId,
    });
  }

  /**
   * Initialize the agent
   */
  protected async initialize(): Promise<void> {
    logger.info('AIAssistAgent initializing...');

    const supabase = this.requireSupabase();

    // Initialize AI Gateway
    const openaiApiKey = process.env.OPENAI_API_KEY || '';
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';

    if (!openaiApiKey && !anthropicApiKey) {
      throw new Error('At least one AI provider API key must be configured');
    }

    this.assistGateway = new AssistGateway({
      openaiApiKey,
      anthropicApiKey,
      defaultProvider: process.env.AI_DEFAULT_PROVIDER as any || 'openai',
      defaultModel: process.env.AI_DEFAULT_MODEL as any || 'gpt-4-turbo',
      supabase,
    });

    this.assistantFactory = new AssistantFactory(this.assistGateway);

    // Setup event subscriptions
    await this.setupEventSubscriptions();

    logger.info('AIAssistAgent initialized successfully');
  }

  /**
   * Main processing loop
   */
  protected async process(): Promise<void> {
    try {
      // Process pending AI assist requests
      await this.processPendingRequests();

      // Update metrics
      await this.updateMetrics();

      // Wait before next iteration
      await new Promise(resolve => setTimeout(resolve, 5000));

    } catch (error) {
      logger.error('Error in AIAssistAgent process', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Cleanup resources
   */
  protected async cleanup(): Promise<void> {
    logger.info('AIAssistAgent cleaning up...');

    // Unsubscribe from all events
    for (const subscription of this.eventSubscriptions) {
      try {
        await subscription.unsubscribe();
      } catch (error) {
        logger.warn('Error unsubscribing from event', { error });
      }
    }

    this.eventSubscriptions = [];

    logger.info('AIAssistAgent cleanup complete');
  }

  /**
   * Health check
   */
  public async checkHealth(): Promise<any> {
    const checks = [];

    // Check Supabase connection
    try {
      await this.requireSupabase()
        .from('ai_assist_requests')
        .select('count')
        .limit(1);

      checks.push({ service: 'supabase', status: 'healthy' });
    } catch (error) {
      checks.push({
        service: 'supabase',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Check AI Gateway circuit breakers
    const openaiStatus = this.assistGateway.getCircuitBreakerStatus('openai');
    const anthropicStatus = this.assistGateway.getCircuitBreakerStatus('anthropic');

    checks.push({
      service: 'openai',
      status: openaiStatus.state === 'CLOSED' ? 'healthy' : 'degraded',
      state: openaiStatus.state,
    });

    checks.push({
      service: 'anthropic',
      status: anthropicStatus.state === 'CLOSED' ? 'healthy' : 'degraded',
      state: anthropicStatus.state,
    });

    const healthyServices = checks.filter(c => c.status === 'healthy').length;

    return {
      status: healthyServices === checks.length ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      details: {
        checks,
        metrics: this.assistGateway.getMetrics(),
      },
    };
  }

  /**
   * Collect metrics
   */
  protected async collectMetrics(): Promise<any> {
    const gatewayMetrics = this.assistGateway.getMetrics();

    return {
      agentName: 'AIAssistAgent',
      successCount: gatewayMetrics.requestsCompleted,
      errorCount: gatewayMetrics.requestsFailed,
      processingTimeMs: gatewayMetrics.avgLatencyMs,
      totalTokens: gatewayMetrics.totalTokens,
      totalCost: gatewayMetrics.totalCost,
      cacheHitRate: gatewayMetrics.cacheHitRate,
      errorRate: gatewayMetrics.errorRate,
    };
  }

  /**
   * Setup event subscriptions for pick scoring events
   */
  private async setupEventSubscriptions(): Promise<void> {
    const supabase = this.requireSupabase();

    // Subscribe to grading completed events (pick.scored)
    const gradingCompletedChannel = supabase
      .channel('ai_grading_completed')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'events',
          filter: 'event_type=eq.grading.completed.v1',
        },
        async (payload) => {
          await this.handlePickScoredEvent(payload.new);
        }
      )
      .subscribe();

    this.eventSubscriptions.push(gradingCompletedChannel);

    // Subscribe to grading failed events (pick.failed)
    const gradingFailedChannel = supabase
      .channel('ai_grading_failed')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'events',
          filter: 'event_type=eq.grading.failed.v1',
        },
        async (payload) => {
          await this.handlePickFailedEvent(payload.new);
        }
      )
      .subscribe();

    this.eventSubscriptions.push(gradingFailedChannel);

    logger.info('Event subscriptions setup complete', {
      subscriptions: ['grading.completed.v1', 'grading.failed.v1'],
    });
  }

  /**
   * Handle pick.scored event
   */
  private async handlePickScoredEvent(event: any): Promise<void> {
    try {
      logger.info('Processing pick.scored event', {
        eventId: event.id,
        aggregateId: event.aggregate_id,
      });

      const eventData = event.event_data || {};

      // Generate AI summary using Insight Summarizer
      const summarizer = this.assistantFactory.getInsightSummarizer();

      const summary = await summarizer.summarizePickEvent({
        eventType: 'pick.scored',
        eventData: {
          pick_id: event.aggregate_id,
          user_name: eventData.user_name,
          player_name: eventData.player_name,
          stat_type: eventData.stat_type,
          line: eventData.line,
          result: eventData.result,
          professional_score: eventData.professional_score,
          outcome: eventData.outcome,
          actual_value: eventData.actual_value,
          clv: eventData.clv,
        },
        tenantId: this.tenantId,
      });

      // Create Discord notification
      await this.createDiscordNotification({
        type: 'pick_scored',
        title: `✅ Pick Result: ${eventData.outcome?.toUpperCase() || 'COMPLETED'}`,
        description: summary.output,
        pickId: event.aggregate_id,
        aiLogId: summary.aiResponse.id,
        fields: [
          {
            name: 'Player',
            value: `${eventData.player_name} - ${eventData.stat_type} ${eventData.line}`,
            inline: false,
          },
          {
            name: 'Professional Score',
            value: `${eventData.professional_score || 'N/A'}/100`,
            inline: true,
          },
          {
            name: 'CLV',
            value: eventData.clv ? `${(eventData.clv * 100).toFixed(2)}%` : 'N/A',
            inline: true,
          },
        ],
        color: eventData.outcome === 'win' ? '#00ff00' : eventData.outcome === 'loss' ? '#ff0000' : '#ffaa00',
      });

      // Update Prometheus metrics
      this.aiMetrics.recordRequest({
        assistantType: 'insight_summarizer',
        provider: summary.aiResponse.provider,
        model: summary.aiResponse.model,
        status: 'success',
        latencyMs: summary.aiResponse.latencyMs,
        tokensUsed: summary.aiResponse.tokensUsed,
        cost: summary.aiResponse.cost,
      });

      logger.info('Pick scored event processed successfully', {
        eventId: event.id,
        aiLogId: summary.aiResponse.id,
      });

    } catch (error) {
      logger.error('Error handling pick.scored event', {
        eventId: event.id,
        error: error instanceof Error ? error.message : String(error),
      });

      this.aiMetrics.recordError({
        provider: 'openai',
        errorType: 'pick_scored_handler',
      });
    }
  }

  /**
   * Handle pick.failed event
   */
  private async handlePickFailedEvent(event: any): Promise<void> {
    try {
      logger.info('Processing pick.failed event', {
        eventId: event.id,
        aggregateId: event.aggregate_id,
      });

      const eventData = event.event_data || {};

      // Generate AI summary using Insight Summarizer
      const summarizer = this.assistantFactory.getInsightSummarizer();

      const summary = await summarizer.summarizePickEvent({
        eventType: 'pick.failed',
        eventData: {
          pick_id: event.aggregate_id,
          user_name: eventData.user_name,
          player_name: eventData.player_name,
          stat_type: eventData.stat_type,
          line: eventData.line,
          result: eventData.error_message || 'Processing failed',
        },
        tenantId: this.tenantId,
      });

      // Create Discord notification
      await this.createDiscordNotification({
        type: 'pick_failed',
        title: '❌ Pick Processing Failed',
        description: summary.output,
        pickId: event.aggregate_id,
        aiLogId: summary.aiResponse.id,
        fields: [
          {
            name: 'Pick',
            value: `${eventData.player_name} - ${eventData.stat_type} ${eventData.line}`,
            inline: false,
          },
          {
            name: 'Error',
            value: eventData.error_message || 'Unknown error',
            inline: false,
          },
        ],
        color: '#ff0000',
      });

      // Update Prometheus metrics
      this.aiMetrics.recordRequest({
        assistantType: 'insight_summarizer',
        provider: summary.aiResponse.provider,
        model: summary.aiResponse.model,
        status: 'success',
        latencyMs: summary.aiResponse.latencyMs,
        tokensUsed: summary.aiResponse.tokensUsed,
        cost: summary.aiResponse.cost,
      });

      logger.info('Pick failed event processed successfully', {
        eventId: event.id,
        aiLogId: summary.aiResponse.id,
      });

    } catch (error) {
      logger.error('Error handling pick.failed event', {
        eventId: event.id,
        error: error instanceof Error ? error.message : String(error),
      });

      this.aiMetrics.recordError({
        provider: 'openai',
        errorType: 'pick_failed_handler',
      });
    }
  }

  /**
   * Create Discord notification
   */
  private async createDiscordNotification(params: {
    type: string;
    title: string;
    description: string;
    pickId?: string;
    aiLogId?: string;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
    color?: string;
  }): Promise<void> {
    const supabase = this.requireSupabase();

    await supabase.from('discord_notifications').insert({
      tenant_id: this.tenantId,
      notification_type: params.type as any,
      discord_channel_id: this.defaultChannelId,
      title: params.title,
      description: params.description,
      fields: params.fields || [],
      color: params.color || '#0099ff',
      pick_id: params.pickId || null,
      ai_log_id: params.aiLogId || null,
      status: 'pending',
    });
  }

  /**
   * Process pending AI assist requests from queue
   */
  private async processPendingRequests(): Promise<void> {
    const supabase = this.requireSupabase();

    const { data: requests } = await supabase
      .from('ai_assist_requests')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('status', 'pending')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(5);

    if (!requests || requests.length === 0) {
      return;
    }

    logger.info(`Processing ${requests.length} pending AI requests`);

    for (const request of requests) {
      await this.processAIRequest(request);
    }
  }

  /**
   * Process individual AI request
   */
  private async processAIRequest(request: any): Promise<void> {
    const startTime = Date.now();
    const supabase = this.requireSupabase();

    try {
      // Mark as processing
      await supabase
        .from('ai_assist_requests')
        .update({
          status: 'processing',
          started_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      // Route to appropriate assistant
      const assistantResponse = await this.assistantFactory.processAssistantRequest({
        type: request.request_type,
        input: request.prompt,
        context: request.context,
        tenantId: request.tenant_id,
        userId: request.user_id,
      });

      // Update request with results
      await supabase
        .from('ai_assist_requests')
        .update({
          status: 'completed',
          response: assistantResponse.output,
          result_metadata: {
            confidence: assistantResponse.confidence,
            tokensUsed: assistantResponse.aiResponse.tokensUsed,
            cost: assistantResponse.aiResponse.cost,
            latencyMs: Date.now() - startTime,
          },
          ai_log_id: assistantResponse.aiResponse.id,
          completed_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      logger.info('AI request processed successfully', {
        requestId: request.id,
        type: request.request_type,
        latencyMs: Date.now() - startTime,
      });

    } catch (error) {
      logger.error('Error processing AI request', {
        requestId: request.id,
        error: error instanceof Error ? error.message : String(error),
      });

      // Mark as failed with retry
      const retryCount = request.retry_count || 0;
      const maxRetries = request.max_retries || 3;

      if (retryCount < maxRetries) {
        const nextRetryAt = new Date(Date.now() + Math.pow(2, retryCount) * 60000); // Exponential backoff

        await supabase
          .from('ai_assist_requests')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : String(error),
            retry_count: retryCount + 1,
            next_retry_at: nextRetryAt.toISOString(),
          })
          .eq('id', request.id);
      } else {
        await supabase
          .from('ai_assist_requests')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : String(error),
          })
          .eq('id', request.id);
      }
    }
  }

  /**
   * Update metrics
   */
  private async updateMetrics(): Promise<void> {
    const metrics = this.assistGateway.getMetrics();

    // Update circuit breaker states
    const openaiStatus = this.assistGateway.getCircuitBreakerStatus('openai');
    const anthropicStatus = this.assistGateway.getCircuitBreakerStatus('anthropic');

    this.aiMetrics.setCircuitBreakerState('openai', openaiStatus.state);
    this.aiMetrics.setCircuitBreakerState('anthropic', anthropicStatus.state);
  }
}
