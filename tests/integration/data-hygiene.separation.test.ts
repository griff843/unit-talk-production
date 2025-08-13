/**
 * Data Hygiene: Integration tests for raw→scored→final→settled separation
 * Tests strict table separation and data flow integrity
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

describe('Data Hygiene: Table Separation', () => {
  let testRawPropId: string;
  let testScoredPropId: string;
  let testFinalPickId: string;
  let testIdempotencyKey: string;

  beforeAll(async () => {
    // Verify database connection
    const { error } = await supabase.from('system_config').select('key').limit(1);
    if (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
  });

  beforeEach(() => {
    // Generate unique test identifiers
    testIdempotencyKey = `test_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  });

  afterAll(async () => {
    // Cleanup any remaining test data
    if (testFinalPickId) {
      await supabase.from('final_picks').delete().eq('id', testFinalPickId);
    }
    if (testScoredPropId) {
      await supabase.from('scored_props').delete().eq('id', testScoredPropId);
    }
    if (testRawPropId) {
      await supabase.from('raw_props').delete().eq('id', testRawPropId);
    }
  });

  describe('Raw Props Ingestion', () => {
    it('should allow ingestion through ingest_raw_prop function', async () => {
      const { data, error } = await supabase.rpc('ingest_raw_prop', {
        p_provider_name: 'test_provider',
        p_external_prop_id: `test_prop_${testIdempotencyKey}`,
        p_sport: 'TEST',
        p_player_name: 'Test Player',
        p_stat_type: 'test_stat',
        p_line: 1.5,
        p_over_odds: -110,
        p_under_odds: -110,
        p_game_start: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        p_source_data: { test: true },
        p_idempotency_key: testIdempotencyKey
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(typeof data).toBe('string'); // UUID
      testRawPropId = data;
    });

    it('should be idempotent based on idempotency key', async () => {
      // First call
      const { data: firstCall } = await supabase.rpc('ingest_raw_prop', {
        p_provider_name: 'test_provider',
        p_external_prop_id: `test_prop_${testIdempotencyKey}`,
        p_sport: 'TEST',
        p_player_name: 'Test Player',
        p_stat_type: 'test_stat',
        p_line: 1.5,
        p_over_odds: -110,
        p_under_odds: -110,
        p_game_start: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        p_idempotency_key: testIdempotencyKey
      });

      // Second call with same idempotency key
      const { data: secondCall } = await supabase.rpc('ingest_raw_prop', {
        p_provider_name: 'test_provider',
        p_external_prop_id: `test_prop_${testIdempotencyKey}`,
        p_sport: 'TEST',
        p_player_name: 'Test Player',
        p_stat_type: 'test_stat',
        p_line: 2.5, // Different line
        p_over_odds: -120, // Different odds
        p_under_odds: -100,
        p_game_start: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        p_idempotency_key: testIdempotencyKey
      });

      expect(firstCall).toBe(secondCall);
      testRawPropId = firstCall;
    });

    it('should block direct INSERT to raw_props from application role', async () => {
      // Try direct insert as authenticated user (not service_role)
      const publicClient = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!
      );

      const { error } = await publicClient.from('raw_props').insert({
        provider_name: 'test',
        external_prop_id: 'direct_insert_test',
        sport: 'TEST',
        player_name: 'Test Player',
        stat_type: 'test_stat',
        line: 1.5,
        over_odds: -110,
        under_odds: -110
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain('policy'); // RLS policy blocked it
    });
  });

  describe('Prop Scoring', () => {
    beforeEach(async () => {
      // Ensure we have a raw prop for testing
      if (!testRawPropId) {
        const { data } = await supabase.rpc('ingest_raw_prop', {
          p_provider_name: 'test_provider',
          p_external_prop_id: `test_prop_${testIdempotencyKey}`,
          p_sport: 'TEST',
          p_player_name: 'Test Player',
          p_stat_type: 'test_stat',
          p_line: 1.5,
          p_over_odds: -110,
          p_under_odds: -110,
          p_game_start: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          p_idempotency_key: testIdempotencyKey
        });
        testRawPropId = data;
      }
    });

    it('should allow scoring through score_prop function', async () => {
      const { data, error } = await supabase.rpc('score_prop', {
        p_raw_prop_id: testRawPropId,
        p_professional_score: 85,
        p_confidence_score: 0.75,
        p_expected_value: 0.05,
        p_grading_features: { 
          test_feature: true,
          clv: 15,
          steam_strength: 20
        }
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(typeof data).toBe('string'); // UUID
      testScoredPropId = data;
    });

    it('should be idempotent for same raw prop', async () => {
      // First scoring
      const { data: firstCall } = await supabase.rpc('score_prop', {
        p_raw_prop_id: testRawPropId,
        p_professional_score: 85,
        p_confidence_score: 0.75,
        p_expected_value: 0.05,
        p_grading_features: { test_feature: true }
      });

      // Second scoring - should update existing
      const { data: secondCall } = await supabase.rpc('score_prop', {
        p_raw_prop_id: testRawPropId,
        p_professional_score: 90, // Different score
        p_confidence_score: 0.80, // Different confidence
        p_expected_value: 0.08,
        p_grading_features: { test_feature: true, updated: true }
      });

      expect(firstCall).toBe(secondCall);
      testScoredPropId = firstCall;
    });

    it('should validate raw prop exists', async () => {
      const fakeRawPropId = '00000000-0000-0000-0000-000000000000';

      const { error } = await supabase.rpc('score_prop', {
        p_raw_prop_id: fakeRawPropId,
        p_professional_score: 85,
        p_confidence_score: 0.75,
        p_expected_value: 0.05,
        p_grading_features: { test_feature: true }
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain('does not exist');
    });

    it('should block direct INSERT to scored_props', async () => {
      const publicClient = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!
      );

      const { error } = await publicClient.from('scored_props').insert({
        raw_prop_id: testRawPropId,
        professional_score: 85,
        confidence_score: 0.75,
        expected_value: 0.05
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain('policy');
    });
  });

  describe('Pick Settlement', () => {
    beforeEach(async () => {
      // Setup complete data flow for settlement testing
      if (!testRawPropId) {
        const { data: rawId } = await supabase.rpc('ingest_raw_prop', {
          p_provider_name: 'test_provider',
          p_external_prop_id: `test_prop_${testIdempotencyKey}`,
          p_sport: 'TEST',
          p_player_name: 'Test Player',
          p_stat_type: 'test_stat',
          p_line: 1.5,
          p_over_odds: -110,
          p_under_odds: -110,
          p_game_start: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          p_idempotency_key: testIdempotencyKey
        });
        testRawPropId = rawId;
      }

      if (!testScoredPropId) {
        const { data: scoredId } = await supabase.rpc('score_prop', {
          p_raw_prop_id: testRawPropId,
          p_professional_score: 85,
          p_confidence_score: 0.75,
          p_expected_value: 0.05,
          p_grading_features: { test_feature: true }
        });
        testScoredPropId = scoredId;
      }

      if (!testFinalPickId) {
        const { data: finalId } = await supabase.rpc('promote_pick', {
          p_scored_prop_id: testScoredPropId,
          p_shadow_only: true
        });
        testFinalPickId = finalId;
      }
    });

    it('should allow settlement through settle_pick function', async () => {
      const { data, error } = await supabase.rpc('settle_pick', {
        p_final_pick_id: testFinalPickId,
        p_outcome: 'win',
        p_actual_value: 2.0,
        p_settlement_data: { 
          test_settlement: true,
          actual_stat: 2.0
        }
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(typeof data).toBe('string'); // UUID
    });

    it('should validate outcome values', async () => {
      const { error } = await supabase.rpc('settle_pick', {
        p_final_pick_id: testFinalPickId,
        p_outcome: 'invalid_outcome',
        p_actual_value: 2.0
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain('Invalid outcome');
    });

    it('should respect system freeze', async () => {
      // Enable system freeze
      await supabase.from('system_config')
        .upsert({ key: 'SYSTEM_FREEZE', value: 'true' });

      const { error } = await supabase.rpc('settle_pick', {
        p_final_pick_id: testFinalPickId,
        p_outcome: 'win',
        p_actual_value: 2.0
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain('System is frozen');

      // Cleanup - disable system freeze
      await supabase.from('system_config')
        .upsert({ key: 'SYSTEM_FREEZE', value: 'false' });
    });

    it('should block direct INSERT to settled_picks', async () => {
      const publicClient = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!
      );

      const { error } = await publicClient.from('settled_picks').insert({
        final_pick_id: testFinalPickId,
        outcome: 'win',
        actual_value: 2.0
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain('policy');
    });
  });

  describe('Data Flow Views', () => {
    it('should provide data_flow_status view', async () => {
      const { data, error } = await supabase
        .from('data_flow_status')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should provide data_hygiene_metrics view', async () => {
      const { data, error } = await supabase
        .from('data_hygiene_metrics')
        .select('*')
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(typeof data.raw_props_24h).toBe('number');
      expect(typeof data.scored_props_24h).toBe('number');
      expect(typeof data.promoted_picks_24h).toBe('number');
      expect(typeof data.settled_picks_24h).toBe('number');
    });

    it('should track orphaned records in hygiene metrics', async () => {
      const { data } = await supabase
        .from('data_hygiene_metrics')
        .select('orphaned_raw_props, orphaned_scored_props, unsettled_final_picks')
        .single();

      expect(data).toBeDefined();
      expect(typeof data.orphaned_raw_props).toBe('number');
      expect(typeof data.orphaned_scored_props).toBe('number');
      expect(typeof data.unsettled_final_picks).toBe('number');
    });
  });

  describe('Data Integrity Validation', () => {
    it('should maintain referential integrity through the pipeline', async () => {
      // Create complete data flow
      const rawId = await supabase.rpc('ingest_raw_prop', {
        p_provider_name: 'integrity_test',
        p_external_prop_id: `integrity_${testIdempotencyKey}`,
        p_sport: 'TEST',
        p_player_name: 'Integrity Test Player',
        p_stat_type: 'test_stat',
        p_line: 1.5,
        p_over_odds: -110,
        p_under_odds: -110,
        p_game_start: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        p_idempotency_key: `integrity_${testIdempotencyKey}`
      });

      const scoredId = await supabase.rpc('score_prop', {
        p_raw_prop_id: rawId.data,
        p_professional_score: 85,
        p_confidence_score: 0.75,
        p_expected_value: 0.05,
        p_grading_features: { test: true }
      });

      const finalId = await supabase.rpc('promote_pick', {
        p_scored_prop_id: scoredId.data,
        p_shadow_only: true
      });

      const settledId = await supabase.rpc('settle_pick', {
        p_final_pick_id: finalId.data,
        p_outcome: 'win',
        p_actual_value: 2.0
      });

      // Verify complete pipeline in data_flow_status
      const { data: flowStatus } = await supabase
        .from('data_flow_status')
        .select('*')
        .eq('raw_prop_id', rawId.data)
        .single();

      expect(flowStatus).toBeDefined();
      expect(flowStatus.pipeline_stage).toBe('settled');
      expect(flowStatus.has_raw_data).toBe(true);
      expect(flowStatus.has_scoring).toBe(true);
      expect(flowStatus.has_promotion).toBe(true);
      expect(flowStatus.has_settlement).toBe(true);

      // Cleanup
      await supabase.from('settled_picks').delete().eq('id', settledId.data);
      await supabase.from('final_picks').delete().eq('id', finalId.data);
      await supabase.from('scored_props').delete().eq('id', scoredId.data);
      await supabase.from('raw_props').delete().eq('id', rawId.data);
    });

    it('should prevent data corruption through direct table access', async () => {
      // Attempt to create orphaned scored prop (without valid raw_prop_id)
      const fakeRawPropId = '00000000-0000-0000-0000-000000000000';
      
      const { error } = await supabase.rpc('score_prop', {
        p_raw_prop_id: fakeRawPropId,
        p_professional_score: 85,
        p_confidence_score: 0.75,
        p_expected_value: 0.05,
        p_grading_features: { test: true }
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain('does not exist');
    });
  });
});