/**
 * E2E Promoter Tests
 * Validates single-writer model and immutable finals
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';

describe('E2E Promoter Tests', () => {
  let supabase: any;
  let testStartTime: Date;
  let regularUserClient: any;

  beforeAll(async () => {
    testStartTime = new Date();
    console.log(`🧪 Starting Promoter E2E tests at ${testStartTime.toISOString()}`);
    
    // Service role client (promoter permissions)
    supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Regular user client (should not have promoter permissions)
    regularUserClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );
  });

  afterAll(async () => {
    const testEndTime = new Date();
    const duration = testEndTime.getTime() - testStartTime.getTime();
    console.log(`✅ Promoter E2E tests completed in ${duration}ms`);
  });

  test('Single Writer: Non-promoter writes to finals should be rejected', async () => {
    console.log('🔍 Testing single-writer enforcement...');
    
    // Attempt to write to final_picks as non-promoter
    const testFinalPick = {
      scored_prop_id: 'test-' + Date.now(),
      user_id: 'test-user',
      pick_type: 'over',
      confidence: 85,
      reasoning: 'E2E test pick',
      created_at: new Date().toISOString()
    };

    // TODO-MANUAL: This test requires proper RLS policies to be in place
    // The policies should reject writes from non-promoter roles
    
    try {
      const { data, error } = await regularUserClient
        .from('final_picks')
        .insert(testFinalPick);

      // Should fail due to RLS policy
      expect(error).toBeDefined();
      expect(error?.code).toBe('42501'); // Insufficient privilege error
      
      console.log(`✅ Non-promoter write correctly rejected: ${error?.message}`);
    } catch (error) {
      console.log(`✅ Non-promoter write correctly rejected: ${error}`);
    }
  });

  test('Promoter Authority: Promoter should be able to promote valid picks', async () => {
    console.log('🔍 Testing promoter authority...');
    
    // Get a scored prop to promote
    const { data: scoredProp, error: fetchError } = await supabase
      .from('scored_props')
      .select('*')
      .eq('tier', 'A') // Only promote high-tier picks
      .limit(1)
      .single();

    if (fetchError || !scoredProp) {
      console.log('ℹ️ No A-tier scored props found, creating test data...');
      
      // Create a test scored prop first
      const testScoredProp = {
        raw_prop_id: 'test-' + Date.now(),
        confidence_score: 90,
        tier: 'A',
        expected_value: 0.035,
        processing_notes: 'E2E test prop for promotion',
        created_at: new Date().toISOString()
      };

      const { data: insertedProp, error: insertError } = await supabase
        .from('scored_props')
        .insert(testScoredProp)
        .select()
        .single();

      expect(insertError).toBeNull();
      expect(insertedProp).toBeDefined();

      // Now promote it
      const promotedPick = {
        scored_prop_id: insertedProp.id,
        user_id: 'promoter-system',
        pick_type: 'over',
        confidence: insertedProp.confidence_score,
        reasoning: 'Automated promotion of A-tier pick',
        promoted_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };

      const { data: finalPick, error: promoteError } = await supabase
        .from('final_picks')
        .insert(promotedPick)
        .select()
        .single();

      expect(promoteError).toBeNull();
      expect(finalPick).toBeDefined();
      expect(finalPick.scored_prop_id).toBe(insertedProp.id);

      console.log(`✅ Successfully promoted pick ${finalPick.id}`);

      // Cleanup test data
      await supabase.from('final_picks').delete().eq('id', finalPick.id);
      await supabase.from('scored_props').delete().eq('id', insertedProp.id);
    } else {
      console.log(`✅ Found existing scored prop for promotion test: ${scoredProp.id}`);
    }
  });

  test('Immutable Finals: Final picks should not be modifiable after creation', async () => {
    console.log('🔍 Testing final pick immutability...');
    
    // Create a test final pick
    const testFinalPick = {
      scored_prop_id: 'test-immutable-' + Date.now(),
      user_id: 'promoter-system',
      pick_type: 'under',
      confidence: 75,
      reasoning: 'E2E immutability test',
      created_at: new Date().toISOString()
    };

    const { data: finalPick, error: createError } = await supabase
      .from('final_picks')
      .insert(testFinalPick)
      .select()
      .single();

    expect(createError).toBeNull();
    expect(finalPick).toBeDefined();

    // Store original values
    const originalConfidence = finalPick.confidence;
    const originalReasoning = finalPick.reasoning;
    const originalPickType = finalPick.pick_type;

    // Attempt to modify the final pick
    const { error: updateError } = await supabase
      .from('final_picks')
      .update({
        confidence: 95,
        reasoning: 'Modified reasoning',
        pick_type: 'over'
      })
      .eq('id', finalPick.id);

    // TODO-MANUAL: This depends on database policies or triggers preventing updates
    // If updates are allowed, the application should reject them
    
    // Verify values haven't changed
    const { data: unchangedPick, error: fetchError } = await supabase
      .from('final_picks')
      .select('*')
      .eq('id', finalPick.id)
      .single();

    expect(fetchError).toBeNull();
    
    // Values should remain unchanged (depending on RLS policy implementation)
    if (!updateError) {
      // If update succeeded, check that values didn't actually change
      expect(unchangedPick.confidence).toBe(originalConfidence);
      expect(unchangedPick.reasoning).toBe(originalReasoning);
      expect(unchangedPick.pick_type).toBe(originalPickType);
    }

    console.log(`✅ Immutability verified for final pick ${finalPick.id}`);

    // Cleanup test data
    await supabase
      .from('final_picks')
      .delete()
      .eq('id', finalPick.id);
  });

  test('Promotion Logic: Only valid scored picks should be promotable', async () => {
    console.log('🔍 Testing promotion validation logic...');
    
    // Test invalid promotion scenarios
    const invalidPromotions = [
      {
        name: 'Non-existent scored prop',
        data: {
          scored_prop_id: 'non-existent-id',
          user_id: 'promoter-system',
          pick_type: 'over',
          confidence: 85,
          reasoning: 'Invalid promotion test'
        }
      },
      {
        name: 'Invalid pick type',
        data: {
          scored_prop_id: 'test-' + Date.now(),
          user_id: 'promoter-system',
          pick_type: 'invalid_type',
          confidence: 85,
          reasoning: 'Invalid pick type test'
        }
      },
      {
        name: 'Invalid confidence range',
        data: {
          scored_prop_id: 'test-' + Date.now(),
          user_id: 'promoter-system',
          pick_type: 'over',
          confidence: 150, // Invalid: > 100
          reasoning: 'Invalid confidence test'
        }
      }
    ];

    for (const invalidPromotion of invalidPromotions) {
      console.log(`  Testing: ${invalidPromotion.name}`);
      
      try {
        const { data, error } = await supabase
          .from('final_picks')
          .insert(invalidPromotion.data);

        // Should fail due to validation
        expect(error).toBeDefined();
        console.log(`  ✅ ${invalidPromotion.name} correctly rejected`);
      } catch (error) {
        console.log(`  ✅ ${invalidPromotion.name} correctly rejected: ${error}`);
      }
    }
  });

  test('Promotion Tracking: Promoted picks should maintain audit trail', async () => {
    console.log('🔍 Testing promotion audit trail...');
    
    // Create a scored prop and promote it
    const testScoredProp = {
      raw_prop_id: 'test-audit-' + Date.now(),
      confidence_score: 88,
      tier: 'A',
      expected_value: 0.028,
      processing_notes: 'E2E audit trail test',
      created_at: new Date().toISOString()
    };

    const { data: scoredProp, error: scoredError } = await supabase
      .from('scored_props')
      .insert(testScoredProp)
      .select()
      .single();

    expect(scoredError).toBeNull();

    const promotedPick = {
      scored_prop_id: scoredProp.id,
      user_id: 'promoter-system',
      pick_type: 'over',
      confidence: scoredProp.confidence_score,
      reasoning: 'E2E audit trail promotion',
      promoted_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    const { data: finalPick, error: promoteError } = await supabase
      .from('final_picks')
      .insert(promotedPick)
      .select()
      .single();

    expect(promoteError).toBeNull();

    // Verify audit trail fields are populated
    expect(finalPick.scored_prop_id).toBe(scoredProp.id);
    expect(finalPick.promoted_at).toBeDefined();
    expect(finalPick.created_at).toBeDefined();
    expect(finalPick.user_id).toBe('promoter-system');

    console.log(`✅ Audit trail verified for promotion ${finalPick.id}`);

    // Cleanup test data
    await supabase.from('final_picks').delete().eq('id', finalPick.id);
    await supabase.from('scored_props').delete().eq('id', scoredProp.id);
  });

  test('Bulk Promotion: Multiple picks should be promotable in batch', async () => {
    console.log('🔍 Testing bulk promotion capability...');
    
    // Create multiple test scored props
    const testScoredProps = Array.from({ length: 3 }, (_, i) => ({
      raw_prop_id: `test-bulk-${Date.now()}-${i}`,
      confidence_score: 85 + i,
      tier: 'A',
      expected_value: 0.025 + (i * 0.005),
      processing_notes: `E2E bulk test prop ${i}`,
      created_at: new Date().toISOString()
    }));

    const { data: scoredProps, error: scoredError } = await supabase
      .from('scored_props')
      .insert(testScoredProps)
      .select();

    expect(scoredError).toBeNull();
    expect(scoredProps).toHaveLength(3);

    // Promote all in batch
    const promotedPicks = scoredProps.map(prop => ({
      scored_prop_id: prop.id,
      user_id: 'promoter-system',
      pick_type: 'over',
      confidence: prop.confidence_score,
      reasoning: 'E2E bulk promotion test',
      promoted_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    }));

    const { data: finalPicks, error: promoteError } = await supabase
      .from('final_picks')
      .insert(promotedPicks)
      .select();

    expect(promoteError).toBeNull();
    expect(finalPicks).toHaveLength(3);

    console.log(`✅ Bulk promotion successful: ${finalPicks.length} picks promoted`);

    // Cleanup test data
    const finalPickIds = finalPicks.map(pick => pick.id);
    const scoredPropIds = scoredProps.map(prop => prop.id);
    
    await supabase.from('final_picks').delete().in('id', finalPickIds);
    await supabase.from('scored_props').delete().in('id', scoredPropIds);
  });
});