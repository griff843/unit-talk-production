/**
 * Outbox Event Processor - Reliable delivery of external events
 * Implements outbox pattern with DLQ, circuit breakers, and retry logic
 */

import { createClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';

export interface OutboxEvent {
  id: string;
  event_type: string;
  event_source: string;
  aggregate_id: string;
  event_data: any;
  metadata?: any;
  attempt_count: number;
  max_attempts: number;
  scheduled_at: string;
  created_at: string;
}

export interface DeliveryResult {
  success: boolean;
  duration: number;
  httpStatusCode?: number;
  error?: {
    type: string;
    message: string;
    retryable: boolean;
  };
}

export interface ServiceConfig {
  service_name: string;
  service_type: string;
  endpoint_url: string;
  timeout_seconds: number;
  max_attempts: number;
  initial_delay_ms: number;
  max_delay_ms: number;
  backoff_multiplier: number;
  rate_limit_per_minute: number;
  circuit_breaker_enabled: boolean;
  auth_type: string;
  auth_config: any;
  enabled: boolean;
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half_open';
  failure_count: number;
  next_attempt_at?: string;
  success_rate: number;
}

class RateLimiter {
  private tokens: Map<string, { count: number; resetAt: number }> = new Map();

  canProcess(service: string, limit: number): boolean {
    const now = Date.now();
    const key = service;
    const bucket = this.tokens.get(key);

    if (!bucket || now >= bucket.resetAt) {
      this.tokens.set(key, { count: 1, resetAt: now + 60000 }); // 1 minute window
      return true;
    }

    if (bucket.count >= limit) {
      return false;
    }

    bucket.count++;
    return true;
  }
}

export class OutboxEventProcessor extends EventEmitter {
  private supabase: ReturnType<typeof createClient>;
  private logger: any;
  private isRunning: boolean = false;
  private processingInterval?: NodeJS.Timeout;
  private rateLimiter: RateLimiter;
  private serviceConfigs: Map<string, ServiceConfig> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();

  constructor(logger: any = console) {
    super();
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    this.logger = logger;
    this.rateLimiter = new RateLimiter();
  }

  /**
   * Start the outbox processor
   */
  async start(intervalMs: number = 5000): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Outbox processor is already running');
      return;
    }

    this.logger.info('Starting outbox event processor', { intervalMs });
    
    // Load service configurations
    await this.loadServiceConfigs();
    await this.loadCircuitBreakerStates();
    
    this.isRunning = true;
    this.emit('started');

    // Start processing loop
    this.processingInterval = setInterval(async () => {
      try {
        await this.processEvents();
      } catch (error) {
        this.logger.error('Error in processing loop', { error });
        this.emit('error', error);
      }
    }, intervalMs);
  }

  /**
   * Stop the outbox processor
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
    this.isRunning = false;
    this.logger.info('Outbox event processor stopped');
    this.emit('stopped');
  }

  /**
   * Queue a new outbox event
   */
  async queueEvent(
    eventType: string,
    eventSource: string,
    aggregateId: string,
    eventData: any,
    options?: {
      metadata?: any;
      idempotencyKey?: string;
      correlationId?: string;
      scheduledAt?: Date;
      maxAttempts?: number;
    }
  ): Promise<string> {
    this.logger.info('Queueing outbox event', {
      eventType,
      eventSource,
      aggregateId,
      idempotencyKey: options?.idempotencyKey
    });

    const { data: eventId, error } = await this.supabase.rpc('queue_outbox_event', {
      p_event_type: eventType,
      p_event_source: eventSource,
      p_aggregate_id: aggregateId,
      p_event_data: eventData,
      p_metadata: options?.metadata || null,
      p_idempotency_key: options?.idempotencyKey || null,
      p_correlation_id: options?.correlationId || null,
      p_scheduled_at: options?.scheduledAt?.toISOString() || null
    });

    if (error) {
      this.logger.error('Failed to queue event', { error, eventType, eventSource });
      throw new Error(`Failed to queue event: ${error.message}`);
    }

    this.emit('eventQueued', { eventId, eventType, eventSource });
    return eventId;
  }

  /**
   * Process pending events
   */
  private async processEvents(): Promise<void> {
    // Process events for each service
    for (const [serviceName, config] of this.serviceConfigs) {
      if (!config.enabled) continue;

      // Check circuit breaker
      const circuitState = this.circuitBreakers.get(serviceName);
      if (circuitState?.state === 'open') {
        const now = new Date();
        const nextAttempt = circuitState.next_attempt_at ? new Date(circuitState.next_attempt_at) : now;
        
        if (now < nextAttempt) {
          continue; // Circuit is still open
        } else {
          // Try to close circuit
          await this.updateCircuitBreakerState(serviceName, 'half_open');
        }
      }

      // Check rate limit
      if (!this.rateLimiter.canProcess(serviceName, config.rate_limit_per_minute)) {
        this.logger.debug('Rate limit exceeded, skipping service', { serviceName });
        continue;
      }

      // Get pending events for this service
      const { data: events, error } = await this.supabase.rpc('get_pending_outbox_events', {
        p_limit: 10, // Process small batches
        p_event_source: serviceName
      });

      if (error) {
        this.logger.error('Failed to get pending events', { error, serviceName });
        continue;
      }

      if (!events || events.length === 0) {
        continue;
      }

      this.logger.info(`Processing ${events.length} events for service ${serviceName}`);

      // Process each event
      for (const event of events as OutboxEvent[]) {
        try {
          await this.processEvent(event, config);
        } catch (error) {
          this.logger.error('Failed to process event', { 
            error, 
            eventId: event.id, 
            serviceName 
          });
        }
      }
    }
  }

  /**
   * Process a single event
   */
  private async processEvent(event: OutboxEvent, config: ServiceConfig): Promise<void> {
    const startTime = Date.now();
    
    this.logger.info('Processing event', {
      eventId: event.id,
      eventType: event.event_type,
      serviceName: config.service_name,
      attempt: event.attempt_count + 1
    });

    let deliveryResult: DeliveryResult;

    try {
      // Deliver the event
      deliveryResult = await this.deliverEvent(event, config);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      deliveryResult = {
        success: false,
        duration,
        error: {
          type: 'delivery_error',
          message: error instanceof Error ? error.message : String(error),
          retryable: true
        }
      };
    }

    // Record the delivery attempt
    await this.recordDeliveryAttempt(event, deliveryResult, config);

    // Update circuit breaker
    await this.updateCircuitBreakerState(config.service_name, deliveryResult.success);

    // Handle result
    if (deliveryResult.success) {
      await this.handleSuccessfulDelivery(event, deliveryResult);
    } else {
      await this.handleFailedDelivery(event, deliveryResult, config);
    }
  }

  /**
   * Deliver event to external service
   */
  private async deliverEvent(event: OutboxEvent, config: ServiceConfig): Promise<DeliveryResult> {
    const startTime = Date.now();

    // Build request based on service type
    let requestOptions: RequestInit;
    let url: string;

    switch (config.service_type) {
      case 'webhook':
        requestOptions = await this.buildWebhookRequest(event, config);
        url = config.endpoint_url;
        break;
      case 'api':
        requestOptions = await this.buildApiRequest(event, config);
        url = this.buildApiUrl(event, config);
        break;
      default:
        throw new Error(`Unsupported service type: ${config.service_type}`);
    }

    // Add timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout_seconds * 1000);
    requestOptions.signal = controller.signal;

    try {
      const response = await fetch(url, requestOptions);
      const duration = Date.now() - startTime;
      
      clearTimeout(timeoutId);

      const isSuccess = response.status >= 200 && response.status < 300;

      return {
        success: isSuccess,
        duration,
        httpStatusCode: response.status,
        error: isSuccess ? undefined : {
          type: 'http_error',
          message: `HTTP ${response.status}: ${response.statusText}`,
          retryable: response.status >= 500 || response.status === 429
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      clearTimeout(timeoutId);

      const isTimeout = error instanceof Error && error.name === 'AbortError';
      const errorType = isTimeout ? 'timeout' : 'network_error';
      const errorMessage = isTimeout ? 'Request timeout' : (error instanceof Error ? error.message : String(error));

      return {
        success: false,
        duration,
        error: {
          type: errorType,
          message: errorMessage,
          retryable: true // Most network errors are retryable
        }
      };
    }
  }

  /**
   * Build webhook request
   */
  private async buildWebhookRequest(event: OutboxEvent, config: ServiceConfig): Promise<RequestInit> {
    const payload = {
      event_type: event.event_type,
      event_id: event.id,
      aggregate_id: event.aggregate_id,
      timestamp: event.created_at,
      data: event.event_data,
      metadata: event.metadata
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'UnitTalk-Outbox/1.0'
    };

    // Add authentication if configured
    if (config.auth_type === 'bearer' && config.auth_config?.token) {
      headers['Authorization'] = `Bearer ${config.auth_config.token}`;
    } else if (config.auth_type === 'api_key' && config.auth_config?.api_key) {
      headers['X-API-Key'] = config.auth_config.api_key;
    }

    return {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    };
  }

  /**
   * Build API request
   */
  private async buildApiRequest(event: OutboxEvent, config: ServiceConfig): Promise<RequestInit> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'UnitTalk-Outbox/1.0'
    };

    // Add authentication
    if (config.auth_type === 'bearer' && config.auth_config?.token) {
      headers['Authorization'] = `Bearer ${config.auth_config.token}`;
    }

    return {
      method: 'POST',
      headers,
      body: JSON.stringify(event.event_data)
    };
  }

  /**
   * Build API URL
   */
  private buildApiUrl(event: OutboxEvent, config: ServiceConfig): string {
    // For APIs, we might need to construct the URL based on event type
    const baseUrl = config.endpoint_url.replace(/\/$/, '');
    
    switch (event.event_type) {
      case 'notion_page_create':
        return `${baseUrl}/pages`;
      case 'notion_database_query':
        return `${baseUrl}/databases/${event.event_data.database_id}/query`;
      default:
        return `${baseUrl}/${event.event_type.replace(/_/g, '/')}`;
    }
  }

  /**
   * Record delivery attempt
   */
  private async recordDeliveryAttempt(
    event: OutboxEvent,
    result: DeliveryResult,
    config: ServiceConfig
  ): Promise<void> {
    const nextRetryDelay = result.success ? null : this.calculateRetryDelay(
      event.attempt_count + 1,
      config
    );

    const { error } = await this.supabase.rpc('record_delivery_attempt', {
      p_event_id: event.id,
      p_success: result.success,
      p_duration_ms: result.duration,
      p_error_type: result.error?.type || null,
      p_error_message: result.error?.message || null,
      p_http_status_code: result.httpStatusCode || null,
      p_next_retry_delay_ms: nextRetryDelay
    });

    if (error) {
      this.logger.error('Failed to record delivery attempt', { error, eventId: event.id });
    }
  }

  /**
   * Handle successful delivery
   */
  private async handleSuccessfulDelivery(event: OutboxEvent, result: DeliveryResult): Promise<void> {
    const { error } = await this.supabase.rpc('mark_event_delivered', {
      p_event_id: event.id,
      p_delivery_duration_ms: result.duration
    });

    if (error) {
      this.logger.error('Failed to mark event as delivered', { error, eventId: event.id });
    } else {
      this.logger.info('Event delivered successfully', {
        eventId: event.id,
        duration: result.duration
      });
      this.emit('eventDelivered', { eventId: event.id, duration: result.duration });
    }
  }

  /**
   * Handle failed delivery
   */
  private async handleFailedDelivery(
    event: OutboxEvent,
    result: DeliveryResult,
    config: ServiceConfig
  ): Promise<void> {
    const newAttemptCount = event.attempt_count + 1;

    if (newAttemptCount >= config.max_attempts) {
      // Move to dead letter queue
      await this.moveToDeadLetterQueue(event, result);
    } else if (result.error && !result.error.retryable) {
      // Non-retryable error, move to DLQ immediately
      await this.moveToDeadLetterQueue(event, result);
    } else {
      this.logger.warn('Event delivery failed, will retry', {
        eventId: event.id,
        attempt: newAttemptCount,
        maxAttempts: config.max_attempts,
        error: result.error?.message
      });
      this.emit('eventFailed', { 
        eventId: event.id, 
        attempt: newAttemptCount, 
        error: result.error 
      });
    }
  }

  /**
   * Move event to dead letter queue
   */
  private async moveToDeadLetterQueue(event: OutboxEvent, result: DeliveryResult): Promise<void> {
    const failureReason = result.error?.retryable === false 
      ? 'Non-retryable error'
      : 'Max attempts exceeded';

    const { error } = await this.supabase.rpc('move_to_dead_letter_queue', {
      p_event_id: event.id,
      p_failure_reason: failureReason,
      p_final_error: result.error?.message || 'Unknown error'
    });

    if (error) {
      this.logger.error('Failed to move event to DLQ', { error, eventId: event.id });
    } else {
      this.logger.warn('Event moved to dead letter queue', {
        eventId: event.id,
        failureReason,
        finalError: result.error?.message
      });
      this.emit('eventMovedToDLQ', { 
        eventId: event.id, 
        failureReason, 
        finalError: result.error?.message 
      });
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attemptNumber: number, config: ServiceConfig): number {
    const baseDelay = config.initial_delay_ms;
    const multiplier = config.backoff_multiplier;
    const maxDelay = config.max_delay_ms;

    let delay = baseDelay * Math.pow(multiplier, attemptNumber - 1);
    
    // Add jitter (±25%)
    const jitter = delay * 0.25 * (Math.random() * 2 - 1);
    delay = Math.max(0, delay + jitter);

    return Math.min(delay, maxDelay);
  }

  /**
   * Update circuit breaker state
   */
  private async updateCircuitBreakerState(serviceName: string, successOrState: boolean | string): Promise<void> {
    if (typeof successOrState === 'string') {
      // Manual state update
      const state = successOrState as 'closed' | 'open' | 'half_open';
      const existing = this.circuitBreakers.get(serviceName);
      if (existing) {
        existing.state = state;
      }
      return;
    }

    // Update based on success/failure
    const success = successOrState as boolean;
    const { data: newState, error } = await this.supabase.rpc('update_circuit_breaker_state', {
      p_service_name: serviceName,
      p_success: success
    });

    if (error) {
      this.logger.error('Failed to update circuit breaker state', { error, serviceName });
      return;
    }

    // Update local cache
    await this.loadCircuitBreakerStates();

    if (newState === 'open') {
      this.logger.warn('Circuit breaker opened for service', { serviceName });
      this.emit('circuitBreakerOpened', { serviceName });
    } else if (newState === 'closed') {
      this.logger.info('Circuit breaker closed for service', { serviceName });
      this.emit('circuitBreakerClosed', { serviceName });
    }
  }

  /**
   * Load service configurations
   */
  private async loadServiceConfigs(): Promise<void> {
    const { data: configs, error } = await this.supabase
      .from('external_service_configs')
      .select('*')
      .eq('enabled', true);

    if (error) {
      this.logger.error('Failed to load service configs', { error });
      throw new Error(`Failed to load service configs: ${error.message}`);
    }

    this.serviceConfigs.clear();
    for (const config of configs as ServiceConfig[]) {
      this.serviceConfigs.set(config.service_name, config);
    }

    this.logger.info(`Loaded ${this.serviceConfigs.size} service configurations`);
  }

  /**
   * Load circuit breaker states
   */
  private async loadCircuitBreakerStates(): Promise<void> {
    const { data: states, error } = await this.supabase
      .from('circuit_breaker_states')
      .select('service_name, state, failure_count, next_attempt_at, success_rate');

    if (error) {
      this.logger.error('Failed to load circuit breaker states', { error });
      return;
    }

    this.circuitBreakers.clear();
    for (const state of states as CircuitBreakerState[]) {
      this.circuitBreakers.set(state.state, state);
    }
  }

  /**
   * Get outbox status summary
   */
  async getStatusSummary(): Promise<any> {
    const { data, error } = await this.supabase
      .from('outbox_status_summary')
      .select('*');

    if (error) {
      this.logger.error('Failed to get status summary', { error });
      return null;
    }

    return data;
  }

  /**
   * Get DLQ summary
   */
  async getDLQSummary(): Promise<any> {
    const { data, error } = await this.supabase
      .from('dlq_summary')
      .select('*');

    if (error) {
      this.logger.error('Failed to get DLQ summary', { error });
      return null;
    }

    return data;
  }

  /**
   * Get service health summary
   */
  async getServiceHealthSummary(): Promise<any> {
    const { data, error } = await this.supabase
      .from('service_health_summary')
      .select('*');

    if (error) {
      this.logger.error('Failed to get service health summary', { error });
      return null;
    }

    return data;
  }

  /**
   * Manually retry DLQ events
   */
  async retryDLQEvents(serviceName?: string, limit: number = 10): Promise<{ retried: number; failed: number }> {
    // Get DLQ events that can be retried
    let query = this.supabase
      .from('dead_letter_queue')
      .select('*')
      .eq('can_retry', true)
      .eq('recovery_status', 'unprocessed');

    if (serviceName) {
      query = query.eq('event_source', serviceName);
    }

    const { data: dlqEvents, error } = await query
      .order('moved_to_dlq_at', { ascending: true })
      .limit(limit);

    if (error) {
      this.logger.error('Failed to get DLQ events for retry', { error });
      throw new Error(`Failed to get DLQ events: ${error.message}`);
    }

    let retried = 0;
    let failed = 0;

    for (const dlqEvent of dlqEvents || []) {
      try {
        // Queue the event again
        await this.queueEvent(
          dlqEvent.event_type,
          dlqEvent.event_source,
          dlqEvent.event_data.aggregate_id,
          dlqEvent.event_data,
          {
            metadata: { ...dlqEvent.metadata, retried_from_dlq: true },
            correlationId: dlqEvent.original_event_id
          }
        );

        // Mark DLQ event as retried
        await this.supabase
          .from('dead_letter_queue')
          .update({
            recovery_status: 'fixed',
            recovered_at: new Date().toISOString(),
            recovery_notes: 'Manually retried'
          })
          .eq('id', dlqEvent.id);

        retried++;
      } catch (error) {
        this.logger.error('Failed to retry DLQ event', { error, dlqEventId: dlqEvent.id });
        failed++;
      }
    }

    this.logger.info('DLQ retry completed', { retried, failed });
    return { retried, failed };
  }

  /**
   * Get processor statistics
   */
  getStats(): {
    isRunning: boolean;
    serviceCount: number;
    circuitBreakerStates: Record<string, string>;
  } {
    const circuitBreakerStates: Record<string, string> = {};
    for (const [serviceName, state] of this.circuitBreakers) {
      circuitBreakerStates[serviceName] = state.state;
    }

    return {
      isRunning: this.isRunning,
      serviceCount: this.serviceConfigs.size,
      circuitBreakerStates
    };
  }
}

// Export for easy integration
export async function createOutboxEventProcessor(logger?: any): Promise<OutboxEventProcessor> {
  return new OutboxEventProcessor(logger);
}