/**
 * Idempotency & Deduplication: Integration tests for DB-backed uniqueness
 * Tests safe operation retries and duplicate content detection
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

describe('Idempotency & Deduplication System', () => {
  let testIdempotencyKey: string;
  let testRequestHash: string;
  let testContentHash: string;

  beforeAll(async () => {
    // Verify database connection
    const { error } = await supabase.from('system_config').select('key').limit(1);
    if (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
  });

  beforeEach(() => {
    // Generate unique test identifiers
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2);
    testIdempotencyKey = `test_idem_${timestamp}_${random}`;
    testRequestHash = crypto.createHash('sha256')
      .update(`test_request_${timestamp}_${random}`)
      .digest('hex');
    testContentHash = crypto.createHash('sha256')
      .update(`test_content_${timestamp}_${random}`)
      .digest('hex');
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase.from('idempotency_keys').delete().like('idempotency_key', 'test_idem_%');
    await supabase.from('deduplication_hashes').delete().like('business_key->provider_name', 'test_%');
    await supabase.from('raw_props').delete().eq('provider_name', 'test_provider');
  });

  describe('Idempotency Key Management', () => {
    it('should register new idempotent operation', async () => {
      const { data, error } = await supabase.rpc('register_idempotent_operation', {
        p_idempotency_key: testIdempotencyKey,
        p_operation_type: 'test_operation',
        p_request_hash: testRequestHash,
        p_user_id: null,
        p_source_ip: '127.0.0.1',
        p_user_agent: 'test-client'
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.operation_id).toBeDefined();
      expect(data.status).toBe('processing');
      expect(data.is_retry).toBe(false);
    });

    it('should detect duplicate idempotency key with same request', async () => {
      // First registration
      await supabase.rpc('register_idempotent_operation', {
        p_idempotency_key: testIdempotencyKey,
        p_operation_type: 'test_operation',
        p_request_hash: testRequestHash
      });

      // Second registration with same key and hash
      const { data, error } = await supabase.rpc('register_idempotent_operation', {
        p_idempotency_key: testIdempotencyKey,
        p_operation_type: 'test_operation',
        p_request_hash: testRequestHash
      });

      expect(error).toBeNull();
      expect(data.is_retry).toBe(true);
      expect(data.status).toBe('processing');
    });

    it('should reject duplicate idempotency key with different request', async () => {
      // First registration
      await supabase.rpc('register_idempotent_operation', {
        p_idempotency_key: testIdempotencyKey,
        p_operation_type: 'test_operation',
        p_request_hash: testRequestHash
      });

      // Second registration with same key but different hash
      const differentHash = crypto.createHash('sha256').update('different_request').digest('hex');
      const { error } = await supabase.rpc('register_idempotent_operation', {
        p_idempotency_key: testIdempotencyKey,
        p_operation_type: 'test_operation',
        p_request_hash: differentHash
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain('Idempotency key conflict');
    });

    it('should complete idempotent operation successfully', async () => {
      // Register operation
      await supabase.rpc('register_idempotent_operation', {
        p_idempotency_key: testIdempotencyKey,
        p_operation_type: 'test_operation',
        p_request_hash: testRequestHash
      });

      // Complete operation
      const resultData = { test_result: 'success', record_id: 'test-uuid' };
      const { data, error } = await supabase.rpc('complete_idempotent_operation', {
        p_idempotency_key: testIdempotencyKey,
        p_result_data: resultData,
        p_status: 'completed'
      });

      expect(error).toBeNull();
      expect(data).toBe(true);

      // Verify completion in database
      const { data: record } = await supabase
        .from('idempotency_keys')
        .select('*')
        .eq('idempotency_key', testIdempotencyKey)
        .single();

      expect(record.status).toBe('completed');
      expect(record.result_data).toEqual(resultData);
      expect(record.completed_at).toBeDefined();
    });

    it('should complete idempotent operation with failure', async () => {
      // Register operation
      await supabase.rpc('register_idempotent_operation', {
        p_idempotency_key: testIdempotencyKey,
        p_operation_type: 'test_operation',
        p_request_hash: testRequestHash
      });

      // Complete with failure
      const errorMessage = 'Test operation failed';
      const { data, error } = await supabase.rpc('complete_idempotent_operation', {
        p_idempotency_key: testIdempotencyKey,
        p_result_data: null,
        p_status: 'failed',
        p_error_message: errorMessage
      });

      expect(error).toBeNull();
      expect(data).toBe(true);

      // Verify failure in database
      const { data: record } = await supabase
        .from('idempotency_keys')
        .select('*')
        .eq('idempotency_key', testIdempotencyKey)
        .single();

      expect(record.status).toBe('failed');
      expect(record.error_message).toBe(errorMessage);
    });

    it('should prevent completion of non-existent operation', async () => {
      const fakeKey = 'non_existent_key';
      
      const { error } = await supabase.rpc('complete_idempotent_operation', {
        p_idempotency_key: fakeKey,
        p_result_data: { test: 'data' },
        p_status: 'completed'
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain('not found');
    });
  });

  describe('Content Deduplication', () => {
    it('should detect no duplicate for new content', async () => {
      const businessKey = {
        provider: 'test_provider',
        external_id: 'test_001',
        sport: 'TEST'
      };

      const { data, error } = await supabase.rpc('check_content_duplicate', {
        p_content_type: 'raw_prop',
        p_content_hash: testContentHash,
        p_business_key: businessKey
      });

      expect(error).toBeNull();
      expect(data.is_duplicate).toBe(false);
    });

    it('should register content hash successfully', async () => {
      const recordId = crypto.randomUUID();
      const businessKey = {
        provider: 'test_provider',
        external_id: 'test_002',
        sport: 'TEST'
      };

      const { data, error } = await supabase.rpc('register_content_hash', {
        p_content_type: 'raw_prop',
        p_content_hash: testContentHash,
        p_record_id: recordId,
        p_table_name: 'raw_props',
        p_business_key: businessKey
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(typeof data).toBe('string'); // UUID
    });

    it('should detect duplicate content after registration', async () => {
      const recordId = crypto.randomUUID();
      const businessKey = {
        provider: 'test_provider',
        external_id: 'test_003',
        sport: 'TEST'
      };

      // Register content hash
      await supabase.rpc('register_content_hash', {
        p_content_type: 'raw_prop',
        p_content_hash: testContentHash,
        p_record_id: recordId,
        p_table_name: 'raw_props',
        p_business_key: businessKey
      });

      // Check for duplicate
      const { data, error } = await supabase.rpc('check_content_duplicate', {
        p_content_type: 'raw_prop',
        p_content_hash: testContentHash,
        p_business_key: businessKey
      });

      expect(error).toBeNull();
      expect(data.is_duplicate).toBe(true);
      expect(data.existing_record_id).toBe(recordId);
      expect(data.table_name).toBe('raw_props');
    });

    it('should track occurrence count for duplicates', async () => {
      const recordId = crypto.randomUUID();
      const businessKey = {
        provider: 'test_provider',
        external_id: 'test_004',
        sport: 'TEST'
      };

      // Register content hash
      await supabase.rpc('register_content_hash', {
        p_content_type: 'raw_prop',
        p_content_hash: testContentHash,
        p_record_id: recordId,
        p_table_name: 'raw_props',
        p_business_key: businessKey
      });

      // Check for duplicate multiple times
      for (let i = 0; i < 3; i++) {
        await supabase.rpc('check_content_duplicate', {
          p_content_type: 'raw_prop',
          p_content_hash: testContentHash,
          p_business_key: businessKey
        });
      }

      // Verify occurrence count
      const { data: record } = await supabase
        .from('deduplication_hashes')
        .select('occurrence_count')
        .eq('record_id', recordId)
        .single();

      expect(record.occurrence_count).toBe(4); // 1 register + 3 checks
    });
  });

  describe('Idempotent Ingestion Function', () => {
    it('should create new raw prop with idempotency', async () => {
      const { data, error } = await supabase.rpc('ingest_raw_prop_idempotent', {
        p_idempotency_key: testIdempotencyKey,
        p_provider_name: 'test_provider',
        p_external_prop_id: `test_prop_${Date.now()}`,
        p_sport: 'TEST',
        p_player_name: 'Test Player',
        p_stat_type: 'test_stat',
        p_line: 1.5,
        p_over_odds: -110,
        p_under_odds: -110,
        p_game_start: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        p_source_data: { test: true },
        p_request_context: { user_id: null, source_ip: '127.0.0.1' }
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.raw_prop_id).toBeDefined();
      expect(data.is_duplicate).toBe(false);
      expect(data.occurrence_count).toBe(1);
    });

    it('should return same result for retry with same idempotency key', async () => {
      const requestParams = {
        p_idempotency_key: testIdempotencyKey,
        p_provider_name: 'test_provider',
        p_external_prop_id: `test_prop_retry_${Date.now()}`,
        p_sport: 'TEST',
        p_player_name: 'Test Player',
        p_stat_type: 'test_stat',
        p_line: 1.5,
        p_over_odds: -110,
        p_under_odds: -110,
        p_game_start: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        p_source_data: { test: true },
        p_request_context: { user_id: null, source_ip: '127.0.0.1' }
      };

      // First call
      const { data: firstResult } = await supabase.rpc('ingest_raw_prop_idempotent', requestParams);

      // Second call (retry)
      const { data: secondResult } = await supabase.rpc('ingest_raw_prop_idempotent', requestParams);

      expect(firstResult.raw_prop_id).toBe(secondResult.raw_prop_id);
      expect(firstResult.is_duplicate).toBe(secondResult.is_duplicate);
    });

    it('should detect content duplication across different idempotency keys', async () => {
      const sharedContent = {
        p_provider_name: 'test_provider',
        p_external_prop_id: `test_shared_${Date.now()}`,
        p_sport: 'TEST',
        p_player_name: 'Shared Test Player',
        p_stat_type: 'shared_stat',
        p_line: 2.5,
        p_over_odds: -115,
        p_under_odds: -105,
        p_game_start: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        p_source_data: { test: true },
        p_request_context: { user_id: null, source_ip: '127.0.0.1' }
      };

      // First ingestion
      const key1 = `${testIdempotencyKey}_1`;
      const { data: result1 } = await supabase.rpc('ingest_raw_prop_idempotent', {
        ...sharedContent,
        p_idempotency_key: key1
      });

      // Second ingestion with different idempotency key but same content
      const key2 = `${testIdempotencyKey}_2`;
      const { data: result2 } = await supabase.rpc('ingest_raw_prop_idempotent', {
        ...sharedContent,
        p_idempotency_key: key2
      });

      expect(result1.is_duplicate).toBe(false);
      expect(result2.is_duplicate).toBe(true);
      expect(result2.raw_prop_id).toBe(result1.raw_prop_id);
      expect(result2.occurrence_count).toBe(2);
    });

    it('should handle operation failures gracefully', async () => {
      // Use invalid data that should cause a constraint violation
      const invalidKey = `${testIdempotencyKey}_invalid`;
      
      const { error } = await supabase.rpc('ingest_raw_prop_idempotent', {
        p_idempotency_key: invalidKey,
        p_provider_name: null, // This should cause an error
        p_external_prop_id: 'test_prop',
        p_sport: 'TEST',
        p_player_name: 'Test Player',
        p_stat_type: 'test_stat',
        p_line: 1.5,
        p_over_odds: -110,
        p_under_odds: -110,
        p_game_start: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        p_request_context: { user_id: null }
      });

      expect(error).toBeDefined();

      // Verify idempotency key was marked as failed
      const { data: record } = await supabase
        .from('idempotency_keys')
        .select('status, error_message')
        .eq('idempotency_key', invalidKey)
        .maybeSingle();

      if (record) {
        expect(record.status).toBe('failed');
        expect(record.error_message).toBeDefined();
      }
    });
  });

  describe('Cleanup Functions', () => {
    it('should clean up expired idempotency keys', async () => {
      // Create expired key
      const expiredKey = `${testIdempotencyKey}_expired`;
      await supabase.from('idempotency_keys').insert({
        idempotency_key: expiredKey,
        operation_type: 'test',
        request_hash: testRequestHash,
        status: 'completed',
        completed_at: new Date(),
        expires_at: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
      });

      // Run cleanup
      const { data, error } = await supabase.rpc('cleanup_expired_idempotency_keys');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBeGreaterThan(0);
      expect(typeof data[0].deleted_count).toBe('number');
    });

    it('should clean up old deduplication hashes', async () => {
      // Create old hash
      const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000); // 45 days ago
      await supabase.from('deduplication_hashes').insert({
        content_type: 'test_content',
        content_hash: testContentHash,
        record_id: crypto.randomUUID(),
        table_name: 'test_table',
        business_key: { test: 'old_data' },
        first_seen_at: oldDate,
        last_seen_at: oldDate
      });

      // Run cleanup
      const { data, error } = await supabase.rpc('cleanup_old_dedup_hashes', { p_retention_days: 30 });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBeGreaterThan(0);
      expect(typeof data[0].deleted_count).toBe('number');
    });
  });

  describe('Monitoring Views', () => {
    it('should provide idempotency metrics view', async () => {
      const { data, error } = await supabase
        .from('idempotency_metrics')
        .select('*');

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      
      if (data.length > 0) {
        const metric = data[0];
        expect(metric.operation_type).toBeDefined();
        expect(typeof metric.total_operations).toBe('number');
        expect(typeof metric.completed_operations).toBe('number');
        expect(typeof metric.failed_operations).toBe('number');
        expect(typeof metric.processing_operations).toBe('number');
      }
    });

    it('should provide deduplication metrics view', async () => {
      const { data, error } = await supabase
        .from('deduplication_metrics')
        .select('*');

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      
      if (data.length > 0) {
        const metric = data[0];
        expect(metric.content_type).toBeDefined();
        expect(typeof metric.unique_content_items).toBe('number');
        expect(typeof metric.total_occurrences).toBe('number');
      }
    });

    it('should calculate deduplication rates correctly', async () => {
      // Create test data with duplicates
      const baseHash = crypto.createHash('sha256').update('dedup_test_base').digest('hex');
      const duplicateHash = crypto.createHash('sha256').update('dedup_test_duplicate').digest('hex');

      // Register original content
      await supabase.rpc('register_content_hash', {
        p_content_type: 'test_dedup',
        p_content_hash: baseHash,
        p_record_id: crypto.randomUUID(),
        p_table_name: 'test_table',
        p_business_key: { test: 'base' }
      });

      // Register duplicate content multiple times
      const dupId = crypto.randomUUID();
      await supabase.rpc('register_content_hash', {
        p_content_type: 'test_dedup',
        p_content_hash: duplicateHash,
        p_record_id: dupId,
        p_table_name: 'test_table',
        p_business_key: { test: 'duplicate' }
      });

      // Generate more duplicates
      for (let i = 0; i < 3; i++) {
        await supabase.rpc('check_content_duplicate', {
          p_content_type: 'test_dedup',
          p_content_hash: duplicateHash,
          p_business_key: { test: 'duplicate' }
        });
      }

      // Check metrics
      const { data: metrics } = await supabase
        .from('deduplication_metrics')
        .select('*')
        .eq('content_type', 'test_dedup');

      expect(metrics).toBeDefined();
      expect(metrics!.length).toBeGreaterThan(0);
      
      const metric = metrics![0];
      expect(metric.deduplicated_items).toBeGreaterThan(0);
      expect(metric.deduplication_rate_percent).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle concurrent idempotency key registration', async () => {
      const concurrentKey = `${testIdempotencyKey}_concurrent`;
      
      // Simulate concurrent calls
      const promises = Array.from({ length: 5 }, () =>
        supabase.rpc('register_idempotent_operation', {
          p_idempotency_key: concurrentKey,
          p_operation_type: 'concurrent_test',
          p_request_hash: testRequestHash
        })
      );

      const results = await Promise.allSettled(promises);
      
      // Exactly one should succeed as new, others should be retries
      const successful = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<any>[];
      const newOperations = successful.filter(r => r.value.is_retry === false);
      const retryOperations = successful.filter(r => r.value.is_retry === true);

      expect(newOperations.length).toBe(1);
      expect(retryOperations.length).toBeGreaterThan(0);
    });

    it('should validate operation status transitions', async () => {
      // Register operation
      await supabase.rpc('register_idempotent_operation', {
        p_idempotency_key: testIdempotencyKey,
        p_operation_type: 'status_test',
        p_request_hash: testRequestHash
      });

      // Complete operation
      await supabase.rpc('complete_idempotent_operation', {
        p_idempotency_key: testIdempotencyKey,
        p_result_data: { test: 'completed' },
        p_status: 'completed'
      });

      // Try to complete again (should fail)
      const { error } = await supabase.rpc('complete_idempotent_operation', {
        p_idempotency_key: testIdempotencyKey,
        p_result_data: { test: 'completed_again' },
        p_status: 'completed'
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain('not found or already completed');
    });

    it('should reject invalid operation status', async () => {
      // Register operation
      await supabase.rpc('register_idempotent_operation', {
        p_idempotency_key: testIdempotencyKey,
        p_operation_type: 'invalid_status_test',
        p_request_hash: testRequestHash
      });

      // Try to complete with invalid status
      const { error } = await supabase.rpc('complete_idempotent_operation', {
        p_idempotency_key: testIdempotencyKey,
        p_result_data: { test: 'data' },
        p_status: 'invalid_status'
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain('Invalid completion status');
    });
  });
});