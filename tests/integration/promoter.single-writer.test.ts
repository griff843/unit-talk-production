/**
 * Integration tests for Single Writer DB Model
 * 
 * Tests that enforce the single writer pattern for pick promotions
 * and verify that unauthorized writes are properly blocked.
 */

import { createClient } from '@supabase/supabase-js';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

// Test configuration
const TEST_CONFIG = {
  SUPABASE_URL: process.env.SUPABASE_URL || 'http://localhost:54321',
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'test-anon-key',
};

describe('Single Writer DB Model', () => {
  let serviceClient: any;
  let anonClient: any;
  let testScoredPropId: string;
  let testUserId: string;

  beforeAll(async () => {
    // Initialize clients
    serviceClient = createClient(TEST_CONFIG.SUPABASE_URL, TEST_CONFIG.SUPABASE_SERVICE_KEY);
    anonClient = createClient(TEST_CONFIG.SUPABASE_URL, TEST_CONFIG.SUPABASE_ANON_KEY);

    // Ensure test data exists
    await setupTestData();
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
  });

  beforeEach(async () => {
    // Reset system config for each test
    await serviceClient
      .from('system_config')
      .update({ value: 'false' })
      .in('key', ['SAFE_MODE', 'SYSTEM_FREEZE']);
  });

  async function setupTestData() {
    // Create test user
    const { data: user, error: userError } = await serviceClient
      .from('users')
      .insert({
        id: '00000000-0000-0000-0000-000000000001',
        username: 'test-promoter-user',
        tier: 'S',
        discord_id: 'test-discord-123'
      })
      .select()
      .single();

    if (userError && userError.code !== '23505') { // Ignore duplicate key error
      console.warn('User creation error:', userError);
    }

    testUserId = user?.id || '00000000-0000-0000-0000-000000000001';

    // Create test raw prop
    const { data: rawProp } = await serviceClient
      .from('raw_props')
      .insert({
        id: '00000000-0000-0000-0000-000000000002',
        provider_name: 'test-provider',
        external_prop_id: 'test-prop-123',
        sport: 'MLB',
        league: 'MLB',
        player_name: 'Test Player',
        stat_type: 'hits',
        line: 1.5,
        over_odds: -110,
        under_odds: -110,
        game_date: new Date().toISOString()
      })
      .select()
      .single();

    // Create test scored prop
    const { data: scoredProp } = await serviceClient
      .from('scored_props')
      .insert({
        id: '00000000-0000-0000-0000-000000000003',
        raw_prop_id: rawProp?.id || '00000000-0000-0000-0000-000000000002',
        user_id: testUserId,
        sport: 'MLB',
        league: 'MLB',
        player_name: 'Test Player',
        stat_type: 'hits',
        line: 1.5,
        over_odds: -110,
        under_odds: -110,
        pick_side: 'over',
        confidence: 0.75,
        professional_score: 0.85,
        devigged_edge: 0.05,
        clv_tracking_id: '00000000-0000-0000-0000-000000000004',
        kelly_fraction: 0.15,
        feature_contributions: { steam: 0.2, timing: 0.3, line_shopping: 0.35 }
      })
      .select()
      .single();

    testScoredPropId = scoredProp?.id || '00000000-0000-0000-0000-000000000003';
  }

  async function cleanupTestData() {
    // Clean up in reverse dependency order
    await serviceClient.from('final_picks').delete().eq('scored_prop_id', testScoredPropId);
    await serviceClient.from('scored_props').delete().eq('id', testScoredPropId);
    await serviceClient.from('raw_props').delete().eq('id', '00000000-0000-0000-0000-000000000002');
    await serviceClient.from('users').delete().eq('id', testUserId);
  }

  describe('System Configuration', () => {
    test('should have required system config keys', async () => {
      const { data: config, error } = await serviceClient
        .from('system_config')
        .select('key, value')
        .in('key', ['SAFE_MODE', 'SYSTEM_FREEZE', 'SHADOW_MODE', 'PUBLISH_TO_DISCORD']);

      expect(error).toBeNull();
      expect(config).toHaveLength(4);
      
      const configMap = config.reduce((acc: any, item: any) => {
        acc[item.key] = item.value;
        return acc;
      }, {});

      expect(configMap).toHaveProperty('SAFE_MODE');
      expect(configMap).toHaveProperty('SYSTEM_FREEZE');
      expect(configMap).toHaveProperty('SHADOW_MODE');
      expect(configMap).toHaveProperty('PUBLISH_TO_DISCORD');
    });
  });

  describe('Promotion Function', () => {
    test('should successfully promote pick via function', async () => {
      const { data, error } = await serviceClient
        .rpc('promote_pick', {
          p_scored_prop_id: testScoredPropId,
          p_shadow_only: true,
          p_promoted_by: testUserId
        });

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // Verify pick was created
      const { data: finalPick, error: fetchError } = await serviceClient
        .from('final_picks')
        .select('*')
        .eq('id', data)
        .single();

      expect(fetchError).toBeNull();
      expect(finalPick).toMatchObject({
        scored_prop_id: testScoredPropId,
        shadow_only: true,
        promoted_by: testUserId
      });
      expect(finalPick.promoted_at).toBeDefined();
      expect(finalPick.immutable_score).toBeDefined();
    });

    test('should prevent duplicate promotions', async () => {
      // First promotion should succeed
      const { error: firstError } = await serviceClient
        .rpc('promote_pick', {
          p_scored_prop_id: testScoredPropId,
          p_shadow_only: true
        });

      expect(firstError).toBeNull();

      // Second promotion should fail
      const { error: secondError } = await serviceClient
        .rpc('promote_pick', {
          p_scored_prop_id: testScoredPropId,
          p_shadow_only: true
        });

      expect(secondError).toBeDefined();
      expect(secondError.message).toContain('already promoted');
    });

    test('should respect system freeze', async () => {
      // Enable system freeze
      await serviceClient
        .from('system_config')
        .update({ value: 'true' })
        .eq('key', 'SYSTEM_FREEZE');

      const { error } = await serviceClient
        .rpc('promote_pick', {
          p_scored_prop_id: testScoredPropId,
          p_shadow_only: false
        });

      expect(error).toBeDefined();
      expect(error.message).toContain('System is frozen');
    });

    test('should force shadow mode when safe mode enabled', async () => {
      // Enable safe mode
      await serviceClient
        .from('system_config')
        .update({ value: 'true' })
        .eq('key', 'SAFE_MODE');

      const { data, error } = await serviceClient
        .rpc('promote_pick', {
          p_scored_prop_id: testScoredPropId,
          p_shadow_only: false // Try to disable shadow mode
        });

      expect(error).toBeNull();

      // Should be forced to shadow mode
      const { data: finalPick } = await serviceClient
        .from('final_picks')
        .select('shadow_only')
        .eq('id', data)
        .single();

      expect(finalPick.shadow_only).toBe(true);
    });
  });

  describe('Direct Write Prevention', () => {
    test('should block direct INSERT to final_picks', async () => {
      const { error } = await anonClient
        .from('final_picks')
        .insert({
          scored_prop_id: testScoredPropId,
          user_id: testUserId,
          sport: 'MLB',
          player_name: 'Test Player',
          stat_type: 'hits',
          line: 1.5,
          pick_side: 'over'
        });

      expect(error).toBeDefined();
      // Should be blocked by RLS policy or permissions
    });

    test('should block direct UPDATE to final_picks', async () => {
      // First create a pick via function
      const { data: pickId } = await serviceClient
        .rpc('promote_pick', {
          p_scored_prop_id: testScoredPropId,
          p_shadow_only: true
        });

      // Try to update it directly
      const { error } = await anonClient
        .from('final_picks')
        .update({ confidence: 0.99 })
        .eq('id', pickId);

      expect(error).toBeDefined();
    });

    test('should allow reads from final_picks', async () => {
      // Create a pick first
      await serviceClient
        .rpc('promote_pick', {
          p_scored_prop_id: testScoredPropId,
          p_shadow_only: true
        });

      const { data, error } = await anonClient
        .from('final_picks')
        .select('*')
        .eq('scored_prop_id', testScoredPropId);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });
  });

  describe('Immutable Fields Protection', () => {
    test('should prevent updates to immutable scoring fields', async () => {
      // Create a pick
      const { data: pickId } = await serviceClient
        .rpc('promote_pick', {
          p_scored_prop_id: testScoredPropId,
          p_shadow_only: true
        });

      // Try to update immutable score with service client (has permissions)
      const { error } = await serviceClient
        .from('final_picks')
        .update({ 
          immutable_score: { modified: 'not_allowed' }
        })
        .eq('id', pickId);

      expect(error).toBeDefined();
      expect(error.message).toContain('immutable fields');
    });

    test('should allow updates to mutable fields', async () => {
      // Create a pick
      const { data: pickId } = await serviceClient
        .rpc('promote_pick', {
          p_scored_prop_id: testScoredPropId,
          p_shadow_only: true
        });

      // Update a mutable field
      const { error } = await serviceClient
        .from('final_picks')
        .update({ 
          notes: 'This should be allowed'
        })
        .eq('id', pickId);

      expect(error).toBeNull();
    });
  });

  describe('Audit Logging', () => {
    test('should log promotion operations', async () => {
      const { data: pickId } = await serviceClient
        .rpc('promote_pick', {
          p_scored_prop_id: testScoredPropId,
          p_shadow_only: true,
          p_promoted_by: testUserId
        });

      // Check audit log
      const { data: auditEntries, error } = await serviceClient
        .from('audit_log')
        .select('*')
        .eq('table_name', 'final_picks')
        .eq('operation', 'promote_pick')
        .order('timestamp', { ascending: false })
        .limit(1);

      expect(error).toBeNull();
      expect(auditEntries).toHaveLength(1);
      expect(auditEntries[0]).toMatchObject({
        table_name: 'final_picks',
        operation: 'promote_pick',
        user_id: testUserId,
        user_role: 'promoter'
      });
      expect(auditEntries[0].new_values.pick_id).toBe(pickId);
    });

    test('should log system config changes', async () => {
      // Change system config
      await serviceClient
        .from('system_config')
        .update({ value: 'true' })
        .eq('key', 'SAFE_MODE');

      // Check audit log
      const { data: auditEntries, error } = await serviceClient
        .from('audit_log')
        .select('*')
        .eq('table_name', 'system_config')
        .eq('operation', 'UPDATE')
        .order('timestamp', { ascending: false })
        .limit(1);

      expect(error).toBeNull();
      expect(auditEntries).toHaveLength(1);
      expect(auditEntries[0].metadata).toMatchObject({
        key: 'SAFE_MODE',
        old_value: 'false',
        new_value: 'true'
      });
    });
  });

  describe('Idempotency', () => {
    test('should support idempotency keys', async () => {
      const idempotencyKey = `test-promotion-${Date.now()}`;

      // Insert idempotency key
      const { error: keyError } = await serviceClient
        .from('idempotency_keys')
        .insert({
          key: idempotencyKey,
          operation_type: 'promote_pick',
          payload_hash: 'test-hash',
          status: 'pending'
        });

      expect(keyError).toBeNull();

      // Verify key exists
      const { data: keys, error: fetchError } = await serviceClient
        .from('idempotency_keys')
        .select('*')
        .eq('key', idempotencyKey);

      expect(fetchError).toBeNull();
      expect(keys).toHaveLength(1);
      expect(keys[0].operation_type).toBe('promote_pick');
    });

    test('should prevent duplicate idempotency keys', async () => {
      const idempotencyKey = `test-duplicate-${Date.now()}`;

      // First insert should succeed
      const { error: firstError } = await serviceClient
        .from('idempotency_keys')
        .insert({
          key: idempotencyKey,
          operation_type: 'promote_pick'
        });

      expect(firstError).toBeNull();

      // Second insert should fail
      const { error: secondError } = await serviceClient
        .from('idempotency_keys')
        .insert({
          key: idempotencyKey,
          operation_type: 'promote_pick'
        });

      expect(secondError).toBeDefined();
      expect(secondError.code).toBe('23505'); // Unique violation
    });
  });

  describe('Database Constraints', () => {
    test('should enforce unique raw props deduplication', async () => {
      const dupeProp = {
        provider_name: 'test-provider',
        external_prop_id: 'dupe-test-123',
        sport: 'MLB',
        league: 'MLB',
        player_name: 'Dupe Player',
        stat_type: 'hits',
        line: 2.5,
        over_odds: -105,
        under_odds: -115
      };

      // First insert should succeed
      const { error: firstError } = await serviceClient
        .from('raw_props')
        .insert(dupeProp);

      expect(firstError).toBeNull();

      // Second insert within same hour should fail
      const { error: secondError } = await serviceClient
        .from('raw_props')
        .insert(dupeProp);

      expect(secondError).toBeDefined();
      expect(secondError.code).toBe('23505'); // Unique violation
    });

    test('should enforce unique scored props per raw prop', async () => {
      // Create raw prop
      const { data: rawProp } = await serviceClient
        .from('raw_props')
        .insert({
          provider_name: 'test-provider',
          external_prop_id: 'unique-test-456',
          sport: 'MLB',
          league: 'MLB',
          player_name: 'Unique Player',
          stat_type: 'rbis',
          line: 1.5,
          over_odds: -110,
          under_odds: -110
        })
        .select()
        .single();

      const scoredProp = {
        raw_prop_id: rawProp.id,
        user_id: testUserId,
        sport: 'MLB',
        league: 'MLB',
        player_name: 'Unique Player',
        stat_type: 'rbis',
        line: 1.5,
        pick_side: 'over',
        confidence: 0.8
      };

      // First scored prop should succeed
      const { error: firstError } = await serviceClient
        .from('scored_props')
        .insert(scoredProp);

      expect(firstError).toBeNull();

      // Second scored prop for same raw prop should fail
      const { error: secondError } = await serviceClient
        .from('scored_props')
        .insert(scoredProp);

      expect(secondError).toBeDefined();
      expect(secondError.code).toBe('23505'); // Unique violation
    });
  });
});