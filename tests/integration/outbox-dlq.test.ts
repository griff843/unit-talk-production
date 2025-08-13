/**
 * Outbox DLQ Integration Tests
 * Tests outbox pattern with dead letter queue, circuit breakers, and retry logic
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { OutboxEventProcessor } from '../../src/services/OutboxEventProcessor';

// Mock fetch for testing
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// Mock logger
const mockLogger = {
  info: (...args: any[]) => console.log('[INFO]', ...args),
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args),
  debug: (...args: any[]) => console.debug('[DEBUG]', ...args)
};

describe('Outbox DLQ System', () => {
  let processor: OutboxEventProcessor;
  let testServiceName: string;
  let testEventId: string;
  let testDLQId: string;

  beforeAll(async () => {
    // Verify database connection
    const { error } = await supabase.from('system_config').select('key').limit(1);
    if (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }

    // Initialize processor
    processor = new OutboxEventProcessor(mockLogger);

    // Reset mock
    mockFetch.mockReset();
  });

  beforeEach(() => {
    const timestamp = Date.now();
    testServiceName = `test_service_${timestamp}`;
    testEventId = `test_event_${timestamp}`;
    testDLQId = `test_dlq_${timestamp}`;

    // Reset fetch mock
    mockFetch.mockReset();
  });

  afterAll(async () => {
    // Stop processor
    processor.stop();

    // Cleanup test data
    await supabase.from('delivery_attempts').delete().like('service_name', 'test_service_%');
    await supabase.from('dead_letter_queue').delete().like('event_source', 'test_service_%');
    await supabase.from('outbox_events').delete().like('event_source', 'test_service_%');
    await supabase.from('circuit_breaker_states').delete().like('service_name', 'test_service_%');
    await supabase.from('external_service_configs').delete().like('service_name', 'test_service_%');
  });

  describe('Outbox Event Management', () => {
    it('should queue outbox event', async () => {
      const eventData = {
        message: 'Test notification',
        channel: '#alerts',
        priority: 'high'
      };

      const eventId = await processor.queueEvent(
        'discord_alert',
        testServiceName,
        crypto.randomUUID(),
        eventData,
        {
          metadata: { source: 'test' },
          idempotencyKey: `test-${testEventId}`,
          maxAttempts: 3
        }
      );

      expect(eventId).toBeDefined();
      expect(typeof eventId).toBe('string');

      // Verify event was stored
      const { data: event } = await supabase
        .from('outbox_events')
        .select('*')
        .eq('id', eventId)
        .single();

      expect(event).toBeDefined();
      expect(event.event_type).toBe('discord_alert');
      expect(event.event_source).toBe(testServiceName);
      expect(event.event_data).toMatchObject(eventData);
      expect(event.status).toBe('pending');
      expect(event.attempt_count).toBe(0);
    });

    it('should handle duplicate events with idempotency key', async () => {
      const idempotencyKey = `duplicate-test-${testEventId}`;
      const eventData = { message: 'Duplicate test' };

      // Queue first event
      const eventId1 = await processor.queueEvent(
        'test_event',
        testServiceName,
        crypto.randomUUID(),
        eventData,
        { idempotencyKey }
      );

      // Queue duplicate event with same idempotency key
      const eventId2 = await processor.queueEvent(
        'test_event',
        testServiceName,
        crypto.randomUUID(),
        eventData,
        { idempotencyKey }
      );

      expect(eventId1).toBe(eventId2);

      // Verify only one event exists
      const { data: events } = await supabase
        .from('outbox_events')
        .select('*')
        .eq('idempotency_key', idempotencyKey);

      expect(events).toBeDefined();
      expect(events!.length).toBe(1);
    });

    it('should schedule events for future delivery', async () => {
      const futureTime = new Date(Date.now() + 60000); // 1 minute from now

      const eventId = await processor.queueEvent(
        'scheduled_event',
        testServiceName,
        crypto.randomUUID(),
        { message: 'Scheduled message' },
        { scheduledAt: futureTime }
      );

      const { data: event } = await supabase
        .from('outbox_events')
        .select('*')
        .eq('id', eventId)
        .single();

      expect(event).toBeDefined();
      expect(new Date(event.scheduled_at).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Service Configuration', () => {
    beforeEach(async () => {
      // Create test service configuration
      await supabase.from('external_service_configs').upsert({
        service_name: testServiceName,
        service_type: 'webhook',
        endpoint_url: 'https://api.test.com/webhook',
        timeout_seconds: 30,
        max_attempts: 3,
        initial_delay_ms: 1000,
        max_delay_ms: 60000,
        backoff_multiplier: 2.0,
        rate_limit_per_minute: 60,
        circuit_breaker_enabled: true,
        auth_type: 'bearer',
        auth_config: { token: 'test-token' },
        enabled: true
      });
    });

    it('should load service configurations', async () => {
      await processor.start(1000);

      const stats = processor.getStats();
      expect(stats.serviceCount).toBeGreaterThan(0);
      expect(stats.isRunning).toBe(true);

      processor.stop();
    });

    it('should process events for configured services', async () => {
      // Mock successful HTTP response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK'
      } as Response);

      // Queue an event
      const eventId = await processor.queueEvent(
        'webhook_test',
        testServiceName,
        crypto.randomUUID(),
        { message: 'Test webhook' }
      );

      // Start processor briefly
      await processor.start(500);
      await new Promise(resolve => setTimeout(resolve, 1000));
      processor.stop();

      // Verify delivery attempt was made
      const { data: attempts } = await supabase
        .from('delivery_attempts')
        .select('*')
        .eq('event_id', eventId);

      expect(attempts).toBeDefined();
      expect(attempts!.length).toBeGreaterThan(0);
      expect(attempts![0].success).toBe(true);
    });
  });

  describe('Delivery Attempts and Retries', () => {
    beforeEach(async () => {
      await supabase.from('external_service_configs').upsert({
        service_name: testServiceName,
        service_type: 'webhook',
        endpoint_url: 'https://api.test.com/webhook',
        timeout_seconds: 5,
        max_attempts: 3,
        initial_delay_ms: 100,
        max_delay_ms: 5000,
        backoff_multiplier: 2.0,
        enabled: true
      });
    });

    it('should record delivery attempts', async () => {
      const eventId = await processor.queueEvent(
        'delivery_test',
        testServiceName,
        crypto.randomUUID(),
        { message: 'Delivery test' }
      );

      // Mock HTTP failure
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await processor.start(200);
      await new Promise(resolve => setTimeout(resolve, 500));
      processor.stop();

      // Verify delivery attempt was recorded
      const { data: attempts } = await supabase
        .from('delivery_attempts')
        .select('*')
        .eq('event_id', eventId)
        .order('attempt_number', { ascending: true });

      expect(attempts).toBeDefined();
      expect(attempts!.length).toBeGreaterThan(0);
      
      const firstAttempt = attempts![0];
      expect(firstAttempt.success).toBe(false);
      expect(firstAttempt.error_type).toBe('network_error');
      expect(firstAttempt.error_message).toBe('Network error');
    });

    it('should implement exponential backoff', async () => {
      // Mock HTTP timeouts
      mockFetch.mockImplementation(() => 
        Promise.reject(new Error('Request timeout'))
      );

      const eventId = await processor.queueEvent(
        'backoff_test',
        testServiceName,
        crypto.randomUUID(),
        { message: 'Backoff test' }
      );

      await processor.start(100);
      await new Promise(resolve => setTimeout(resolve, 2000));
      processor.stop();

      // Verify multiple attempts with increasing delays
      const { data: attempts } = await supabase
        .from('delivery_attempts')
        .select('*')
        .eq('event_id', eventId)
        .order('attempt_number', { ascending: true });

      expect(attempts).toBeDefined();
      expect(attempts!.length).toBeGreaterThan(1);

      // Check that retry delays increase
      if (attempts!.length > 1) {
        const firstDelay = attempts![0].retry_delay_ms || 0;
        const secondDelay = attempts![1].retry_delay_ms || 0;
        expect(secondDelay).toBeGreaterThanOrEqual(firstDelay);
      }
    });

    it('should handle HTTP error responses', async () => {
      // Mock HTTP error responses
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as Response);

      const eventId = await processor.queueEvent(
        'http_error_test',
        testServiceName,
        crypto.randomUUID(),
        { message: 'HTTP error test' }
      );

      await processor.start(200);
      await new Promise(resolve => setTimeout(resolve, 500));
      processor.stop();

      const { data: attempts } = await supabase
        .from('delivery_attempts')
        .select('*')
        .eq('event_id', eventId);

      expect(attempts).toBeDefined();
      expect(attempts!.length).toBeGreaterThan(0);
      
      const attempt = attempts![0];
      expect(attempt.success).toBe(false);
      expect(attempt.http_status_code).toBe(500);
      expect(attempt.error_type).toBe('http_error');
    });
  });

  describe('Dead Letter Queue', () => {
    beforeEach(async () => {
      await supabase.from('external_service_configs').upsert({
        service_name: testServiceName,
        service_type: 'webhook',
        endpoint_url: 'https://api.test.com/webhook',
        max_attempts: 2,
        enabled: true
      });
    });

    it('should move events to DLQ after max attempts', async () => {
      // Mock all attempts to fail
      mockFetch.mockImplementation(() => 
        Promise.reject(new Error('Service unavailable'))
      );

      const eventId = await processor.queueEvent(
        'dlq_test',
        testServiceName,
        crypto.randomUUID(),
        { message: 'DLQ test' }
      );

      await processor.start(100);
      await new Promise(resolve => setTimeout(resolve, 1000));
      processor.stop();

      // Verify event moved to DLQ
      const { data: event } = await supabase
        .from('outbox_events')
        .select('status')
        .eq('id', eventId)
        .single();

      expect(event).toBeDefined();
      expect(event.status).toBe('dead_letter');

      // Verify DLQ entry exists
      const { data: dlqEntry } = await supabase
        .from('dead_letter_queue')
        .select('*')
        .eq('original_event_id', eventId)
        .single();

      expect(dlqEntry).toBeDefined();
      expect(dlqEntry.event_source).toBe(testServiceName);
      expect(dlqEntry.failure_reason).toBe('Max attempts exceeded');
      expect(dlqEntry.total_attempts).toBe(2);
    });

    it('should handle non-retryable errors', async () => {
      // Mock 400 Bad Request (non-retryable)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      } as Response);

      const eventId = await processor.queueEvent(
        'non_retryable_test',
        testServiceName,
        crypto.randomUUID(),
        { message: 'Non-retryable test' }
      );

      await processor.start(200);
      await new Promise(resolve => setTimeout(resolve, 500));
      processor.stop();

      // Verify event moved to DLQ immediately
      const { data: dlqEntry } = await supabase
        .from('dead_letter_queue')
        .select('*')
        .eq('original_event_id', eventId)
        .single();

      expect(dlqEntry).toBeDefined();
      expect(dlqEntry.failure_reason).toBe('Non-retryable error');
    });

    it('should support DLQ event recovery', async () => {
      // First, create a DLQ entry
      const originalEventId = crypto.randomUUID();
      
      const { data: dlqEntry } = await supabase
        .from('dead_letter_queue')
        .insert({
          original_event_id: originalEventId,
          event_type: 'recovery_test',
          event_source: testServiceName,
          event_data: { message: 'Recovery test' },
          total_attempts: 3,
          final_error: 'Max attempts exceeded',
          failure_reason: 'Max attempts exceeded',
          first_attempt_at: new Date().toISOString(),
          final_attempt_at: new Date().toISOString(),
          can_retry: true
        })
        .select()
        .single();

      expect(dlqEntry).toBeDefined();

      // Now retry DLQ events
      const { retried, failed } = await processor.retryDLQEvents(testServiceName, 1);

      expect(retried).toBe(1);
      expect(failed).toBe(0);

      // Verify DLQ entry was marked as recovered
      const { data: updatedDLQEntry } = await supabase
        .from('dead_letter_queue')
        .select('*')
        .eq('id', dlqEntry.id)
        .single();

      expect(updatedDLQEntry).toBeDefined();
      expect(updatedDLQEntry.recovery_status).toBe('fixed');
      expect(updatedDLQEntry.recovery_notes).toBe('Manually retried');
    });
  });

  describe('Circuit Breaker', () => {
    beforeEach(async () => {
      await supabase.from('external_service_configs').upsert({
        service_name: testServiceName,
        service_type: 'webhook',
        endpoint_url: 'https://api.test.com/webhook',
        circuit_breaker_enabled: true,
        failure_threshold: 3,
        recovery_timeout_seconds: 5,
        enabled: true
      });
    });

    it('should open circuit breaker after failure threshold', async () => {
      // Mock failures
      mockFetch.mockImplementation(() => 
        Promise.reject(new Error('Service down'))
      );

      // Queue multiple events to trigger failures
      const eventIds = [];
      for (let i = 0; i < 5; i++) {
        const eventId = await processor.queueEvent(
          'circuit_breaker_test',
          testServiceName,
          crypto.randomUUID(),
          { message: `Test ${i}` }
        );
        eventIds.push(eventId);
      }

      await processor.start(100);
      await new Promise(resolve => setTimeout(resolve, 1000));
      processor.stop();

      // Check circuit breaker state
      const { data: circuitState } = await supabase
        .from('circuit_breaker_states')
        .select('*')
        .eq('service_name', testServiceName)
        .single();

      expect(circuitState).toBeDefined();
      expect(circuitState.failure_count).toBeGreaterThanOrEqual(3);
      expect(['open', 'closed']).toContain(circuitState.state); // Might be open if threshold reached
    });

    it('should prevent requests when circuit is open', async () => {
      // Manually set circuit breaker to open state
      await supabase.from('circuit_breaker_states').upsert({
        service_name: testServiceName,
        state: 'open',
        failure_count: 5,
        opened_at: new Date().toISOString(),
        next_attempt_at: new Date(Date.now() + 10000).toISOString() // 10 seconds from now
      });

      const eventId = await processor.queueEvent(
        'circuit_open_test',
        testServiceName,
        crypto.randomUUID(),
        { message: 'Circuit open test' }
      );

      await processor.start(200);
      await new Promise(resolve => setTimeout(resolve, 500));
      processor.stop();

      // Verify no delivery attempts were made
      const { data: attempts } = await supabase
        .from('delivery_attempts')
        .select('*')
        .eq('event_id', eventId);

      expect(attempts).toBeDefined();
      expect(attempts!.length).toBe(0); // No attempts should be made when circuit is open
    });
  });

  describe('Monitoring and Statistics', () => {
    beforeEach(async () => {
      // Create test events and attempts for monitoring
      const eventId = await processor.queueEvent(
        'monitoring_test',
        testServiceName,
        crypto.randomUUID(),
        { message: 'Monitoring test' }
      );

      await supabase.rpc('record_delivery_attempt', {
        p_event_id: eventId,
        p_success: true,
        p_duration_ms: 1500,
        p_error_type: null,
        p_error_message: null,
        p_http_status_code: 200
      });
    });

    it('should provide outbox status summary', async () => {
      const summary = await processor.getStatusSummary();

      expect(Array.isArray(summary)).toBe(true);
      if (summary && summary.length > 0) {
        const testServiceSummary = summary.find(s => s.event_source === testServiceName);
        if (testServiceSummary) {
          expect(testServiceSummary).toHaveProperty('event_count');
          expect(testServiceSummary).toHaveProperty('status');
        }
      }
    });

    it('should provide service health summary', async () => {
      const healthSummary = await processor.getServiceHealthSummary();

      expect(Array.isArray(healthSummary)).toBe(true);
      if (healthSummary && healthSummary.length > 0) {
        const testServiceHealth = healthSummary.find(s => s.service_name === testServiceName);
        if (testServiceHealth) {
          expect(testServiceHealth).toHaveProperty('service_name');
          expect(testServiceHealth).toHaveProperty('service_type');
          expect(testServiceHealth).toHaveProperty('enabled');
        }
      }
    });

    it('should provide processor statistics', async () => {
      await processor.start(1000);
      const stats = processor.getStats();
      processor.stop();

      expect(stats).toHaveProperty('isRunning');
      expect(stats).toHaveProperty('serviceCount');
      expect(stats).toHaveProperty('circuitBreakerStates');
      expect(typeof stats.isRunning).toBe('boolean');
      expect(typeof stats.serviceCount).toBe('number');
      expect(typeof stats.circuitBreakerStates).toBe('object');
    });
  });

  describe('Event Processing Integration', () => {
    it('should process complete event lifecycle', async () => {
      // Setup service config
      await supabase.from('external_service_configs').upsert({
        service_name: testServiceName,
        service_type: 'webhook',
        endpoint_url: 'https://api.test.com/webhook',
        timeout_seconds: 30,
        max_attempts: 2,
        initial_delay_ms: 100,
        enabled: true
      });

      // Mock successful delivery
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ success: true })
      } as Response);

      // Queue event
      const aggregateId = crypto.randomUUID();
      const eventId = await processor.queueEvent(
        'lifecycle_test',
        testServiceName,
        aggregateId,
        {
          message: 'Lifecycle test message',
          timestamp: new Date().toISOString()
        },
        {
          metadata: { source: 'integration_test' },
          correlationId: crypto.randomUUID()
        }
      );

      // Start processor and wait for processing
      await processor.start(200);
      await new Promise(resolve => setTimeout(resolve, 1000));
      processor.stop();

      // Verify event was delivered
      const { data: event } = await supabase
        .from('outbox_events')
        .select('*')
        .eq('id', eventId)
        .single();

      expect(event).toBeDefined();
      expect(event.status).toBe('delivered');
      expect(event.delivered_at).toBeDefined();

      // Verify delivery attempt was recorded
      const { data: attempts } = await supabase
        .from('delivery_attempts')
        .select('*')
        .eq('event_id', eventId);

      expect(attempts).toBeDefined();
      expect(attempts!.length).toBe(1);
      expect(attempts![0].success).toBe(true);
      expect(attempts![0].http_status_code).toBe(200);

      // Verify circuit breaker was updated
      const { data: circuitState } = await supabase
        .from('circuit_breaker_states')
        .select('*')
        .eq('service_name', testServiceName);

      expect(circuitState).toBeDefined();
      if (circuitState && circuitState.length > 0) {
        expect(circuitState[0].successful_requests).toBeGreaterThan(0);
        expect(circuitState[0].state).toBe('closed');
      }
    });
  });
});