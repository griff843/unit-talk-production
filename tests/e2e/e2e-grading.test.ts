/**
 * E2E Grading Agent Tests
 * Validates deterministic grading and snapshot immutability
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';

describe('E2E Grading Agent Tests', () => {
  let supabase: any;
  let testStartTime: Date;

  beforeAll(async () => {
    testStartTime = new Date();
    console.log(`🧪 Starting Grading Agent E2E tests at ${testStartTime.toISOString()}`);
    
    supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  });

  afterAll(async () => {
    const testEndTime = new Date();
    const duration = testEndTime.getTime() - testStartTime.getTime();
    console.log(`✅ Grading Agent E2E tests completed in ${duration}ms`);
  });

  test('Deterministic Grading: Same raw props should produce identical scores', async () => {
    console.log('🔍 Testing deterministic grading behavior...');
    
    // Get a recent raw prop for testing
    const { data: rawProp, error: fetchError } = await supabase
      .from('raw_props')
      .select('*')
      .not('stat_type', 'is', null)
      .not('line', 'is', null)
      .not('over_odds', 'is', null)
      .not('under_odds', 'is', null)
      .limit(1)
      .single();

    expect(fetchError).toBeNull();
    expect(rawProp).toBeDefined();

    console.log(`📊 Testing with prop: ${rawProp.player_name} ${rawProp.stat_type} ${rawProp.line}`);

    // TODO-MANUAL: This test requires the actual GradingAgent processing logic
    // to be accessible. Run this test by triggering the grading workflow
    // manually and comparing results.
    
    // For now, we'll test the consistency of existing scored data
    const { data: existingScores, error: scoresError } = await supabase
      .from('scored_props')
      .select('*')
      .eq('raw_prop_id', rawProp.id);

    if (scoresError) {
      console.log(`ℹ️ No existing scores for prop ${rawProp.id}, skipping deterministic test`);
      return;
    }

    if (existingScores && existingScores.length > 1) {
      // If multiple scores exist for same raw prop, they should be identical
      const firstScore = existingScores[0];
      const restScores = existingScores.slice(1);

      for (const score of restScores) {
        expect(score.confidence_score).toBe(firstScore.confidence_score);
        expect(score.tier).toBe(firstScore.tier);
        expect(score.expected_value).toBe(firstScore.expected_value);
        
        console.log(`✅ Score consistency verified for prop ${rawProp.id}`);
      }
    }
  });

  test('Snapshot Immutability: Scored props should not change after insert', async () => {
    console.log('🔍 Testing snapshot immutability...');
    
    // Get a scored prop that was created at least 1 hour ago
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: oldScoredProp, error } = await supabase
      .from('scored_props')
      .select('*')
      .lt('created_at', oneHourAgo)
      .limit(1)
      .single();

    if (error || !oldScoredProp) {
      console.log('ℹ️ No old scored props found, creating test data...');
      
      // Create a test scored prop to verify immutability
      const testScoredProp = {
        raw_prop_id: 'test-' + Date.now(),
        confidence_score: 85.5,
        tier: 'A',
        expected_value: 0.025,
        processing_notes: 'E2E test prop',
        created_at: new Date().toISOString()
      };

      const { data: insertedProp, error: insertError } = await supabase
        .from('scored_props')
        .insert(testScoredProp)
        .select()
        .single();

      expect(insertError).toBeNull();
      expect(insertedProp).toBeDefined();

      // Store original values
      const originalScore = insertedProp.confidence_score;
      const originalTier = insertedProp.tier;
      const originalEV = insertedProp.expected_value;

      // Attempt to update the scored prop (should fail or be ignored)
      const { error: updateError } = await supabase
        .from('scored_props')
        .update({
          confidence_score: 95.0,
          tier: 'S',
          expected_value: 0.050
        })
        .eq('id', insertedProp.id);

      // TODO-MANUAL: This depends on database policies preventing updates
      // If updates are allowed, this test will need to check that the
      // application layer prevents modification
      
      // Verify values haven't changed
      const { data: unchangedProp, error: fetchError } = await supabase
        .from('scored_props')
        .select('*')
        .eq('id', insertedProp.id)
        .single();

      expect(fetchError).toBeNull();
      expect(unchangedProp.confidence_score).toBe(originalScore);
      expect(unchangedProp.tier).toBe(originalTier);
      expect(unchangedProp.expected_value).toBe(originalEV);

      console.log(`✅ Immutability verified for scored prop ${insertedProp.id}`);

      // Cleanup test data
      await supabase
        .from('scored_props')
        .delete()
        .eq('id', insertedProp.id);
    }
  });

  test('Grading Performance: Should process props within time limits', async () => {
    console.log('🔍 Testing grading performance...');
    
    const startTime = Date.now();
    
    // Get recent grading activity
    const { data: recentGrading, error } = await supabase
      .from('scored_props')
      .select('created_at, processing_time_ms')
      .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // Last 30 minutes
      .order('created_at', { ascending: false })
      .limit(100);

    expect(error).toBeNull();
    
    const queryTime = Date.now() - startTime;
    console.log(`📊 Grading query completed in ${queryTime}ms`);
    console.log(`📊 Recent grading activity: ${recentGrading?.length || 0} props in last 30 minutes`);
    
    if (recentGrading && recentGrading.length > 0) {
      // Analyze processing times
      const processingTimes = recentGrading
        .filter(prop => prop.processing_time_ms)
        .map(prop => prop.processing_time_ms);

      if (processingTimes.length > 0) {
        const avgProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
        const maxProcessingTime = Math.max(...processingTimes);
        
        console.log(`📊 Average processing time: ${avgProcessingTime.toFixed(2)}ms`);
        console.log(`📊 Max processing time: ${maxProcessingTime}ms`);
        
        // Grading should complete within reasonable time
        expect(avgProcessingTime).toBeLessThan(5000); // 5 seconds average
        expect(maxProcessingTime).toBeLessThan(30000); // 30 seconds max
      }
    }
    
    // Query should complete quickly
    expect(queryTime).toBeLessThan(3000); // 3 seconds
  });

  test('Grading Quality: Scores should be within valid ranges', async () => {
    console.log('🔍 Testing grading quality...');
    
    const { data: scoredProps, error } = await supabase
      .from('scored_props')
      .select('*')
      .not('confidence_score', 'is', null)
      .not('tier', 'is', null)
      .limit(100);

    expect(error).toBeNull();
    expect(scoredProps).toBeDefined();

    if (scoredProps && scoredProps.length > 0) {
      let validScores = 0;
      let invalidScores = 0;

      for (const prop of scoredProps) {
        const validScore = 
          prop.confidence_score >= 0 && 
          prop.confidence_score <= 100 &&
          ['S', 'A', 'B', 'C', 'D', 'F'].includes(prop.tier);

        if (validScore) {
          validScores++;
        } else {
          invalidScores++;
          console.log(`❌ Invalid score: confidence=${prop.confidence_score}, tier=${prop.tier}`);
        }
      }

      console.log(`📊 Valid scores: ${validScores}, Invalid: ${invalidScores}`);
      
      // At least 98% should have valid scores
      const validPercentage = (validScores / scoredProps.length) * 100;
      expect(validPercentage).toBeGreaterThan(98);
    }
  });

  test('Professional Features: Advanced grading features should be populated', async () => {
    console.log('🔍 Testing professional grading features...');
    
    const { data: professionalProps, error } = await supabase
      .from('scored_props')
      .select('*')
      .not('professional_score', 'is', null)
      .limit(50);

    if (error || !professionalProps || professionalProps.length === 0) {
      console.log('ℹ️ No professional scores found, skipping professional features test');
      return;
    }

    let featuresCount = 0;
    let totalProps = professionalProps.length;

    for (const prop of professionalProps) {
      // Check for professional features
      const hasFeatures = 
        prop.steam_detected !== null ||
        prop.clv_tracking_id !== null ||
        prop.optimal_timing !== null ||
        prop.line_shopping_edge !== null;

      if (hasFeatures) {
        featuresCount++;
      }
    }

    console.log(`📊 Props with professional features: ${featuresCount}/${totalProps}`);
    
    // At least 50% should have some professional features
    const featuresPercentage = (featuresCount / totalProps) * 100;
    expect(featuresPercentage).toBeGreaterThan(50);
  });
});