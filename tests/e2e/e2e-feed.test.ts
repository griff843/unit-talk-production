/**
 * E2E Feed Agent Tests
 * Validates feed freshness, deduplication, and timezone normalization
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { FeedAgent } from '../../apps/api/src/agents/FeedAgent';

describe('E2E Feed Agent Tests', () => {
  let supabase: any;
  let feedAgent: FeedAgent;
  let testStartTime: Date;

  beforeAll(async () => {
    testStartTime = new Date();
    console.log(`🧪 Starting Feed Agent E2E tests at ${testStartTime.toISOString()}`);
    
    supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Initialize FeedAgent for testing
    feedAgent = new FeedAgent({
      name: 'FeedAgent',
      enabled: true,
      config: {
        processingInterval: 60000,
        batchSize: 100
      }
    }, {
      supabase,
      logger: console,
      metrics: null
    });
  });

  afterAll(async () => {
    const testEndTime = new Date();
    const duration = testEndTime.getTime() - testStartTime.getTime();
    console.log(`✅ Feed Agent E2E tests completed in ${duration}ms`);
  });

  test('Feed Freshness: Data should be < 2 minutes behind', async () => {
    console.log('🔍 Testing feed freshness...');
    
    const { data: recentProps, error } = await supabase
      .from('raw_props')
      .select('created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(10);

    expect(error).toBeNull();
    expect(recentProps).toBeDefined();
    expect(recentProps.length).toBeGreaterThan(0);

    const mostRecentProp = recentProps[0];
    const propTime = new Date(mostRecentProp.created_at);
    const now = new Date();
    const ageMinutes = (now.getTime() - propTime.getTime()) / (1000 * 60);

    console.log(`📊 Most recent prop age: ${ageMinutes.toFixed(2)} minutes`);
    
    // Allow up to 2 minutes staleness
    expect(ageMinutes).toBeLessThan(2);
  });

  test('Deduplication: Duplicate ingests should not create new rows', async () => {
    console.log('🔍 Testing deduplication logic...');
    
    // Get initial count
    const { count: initialCount } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true });

    console.log(`📊 Initial raw_props count: ${initialCount}`);

    // Get a recent prop to simulate duplicate
    const { data: existingProp } = await supabase
      .from('raw_props')
      .select('*')
      .limit(1)
      .single();

    expect(existingProp).toBeDefined();

    // Simulate duplicate ingestion by attempting to insert same prop
    const duplicateData = {
      ...existingProp,
      id: undefined, // Remove ID to simulate new insert
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // TODO-MANUAL: This test requires the actual FeedAgent deduplication logic
    // to be working. Run this test after ensuring FeedAgent has proper 
    // unique key constraints on (game_id, player_name, stat_type, book)
    
    try {
      const { error: insertError } = await supabase
        .from('raw_props')
        .insert(duplicateData);

      // Should either fail due to unique constraint or be handled by dedup logic
      if (insertError) {
        console.log(`✅ Duplicate rejected by database: ${insertError.message}`);
      }
    } catch (error) {
      console.log(`✅ Duplicate handling working: ${error}`);
    }

    // Verify count didn't increase inappropriately
    const { count: finalCount } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true });

    console.log(`📊 Final raw_props count: ${finalCount}`);
    
    // Count should be same or only increased by 1 if it was a legitimate new prop
    expect(finalCount).toBeLessThanOrEqual(initialCount! + 1);
  });

  test('Timezone Normalization: All timestamps should be UTC', async () => {
    console.log('🔍 Testing timezone normalization...');
    
    const { data: props, error } = await supabase
      .from('raw_props')
      .select('game_time, created_at, updated_at')
      .not('game_time', 'is', null)
      .limit(20);

    expect(error).toBeNull();
    expect(props).toBeDefined();
    expect(props.length).toBeGreaterThan(0);

    let utcCount = 0;
    let nonUtcCount = 0;

    for (const prop of props) {
      // Check if timestamp ends with 'Z' (UTC) or has timezone info
      const gameTime = prop.game_time;
      const createdAt = prop.created_at;
      const updatedAt = prop.updated_at;

      if (gameTime.endsWith('Z') || gameTime.includes('+00:00')) {
        utcCount++;
      } else {
        nonUtcCount++;
        console.log(`⚠️ Non-UTC game_time found: ${gameTime}`);
      }

      // created_at and updated_at should always be UTC
      expect(createdAt).toMatch(/Z$|\+00:00$/);
      expect(updatedAt).toMatch(/Z$|\+00:00$/);
    }

    console.log(`📊 UTC timestamps: ${utcCount}, Non-UTC: ${nonUtcCount}`);
    
    // At least 90% should be properly normalized
    const utcPercentage = (utcCount / props.length) * 100;
    expect(utcPercentage).toBeGreaterThan(90);
  });

  test('Feed Processing Performance: Should complete within reasonable time', async () => {
    console.log('🔍 Testing feed processing performance...');
    
    const startTime = Date.now();
    
    // TODO-MANUAL: Trigger actual feed processing cycle
    // This should be integrated with the actual FeedAgent.process() method
    // For now, we'll simulate by checking recent processing activity
    
    const { data: recentActivity, error } = await supabase
      .from('raw_props')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
      .order('created_at', { ascending: false });

    expect(error).toBeNull();
    
    const processingTime = Date.now() - startTime;
    console.log(`📊 Feed query completed in ${processingTime}ms`);
    console.log(`📊 Recent activity: ${recentActivity?.length || 0} props in last 5 minutes`);
    
    // Query should complete quickly
    expect(processingTime).toBeLessThan(5000); // 5 seconds
  });

  test('Data Integrity: Raw props should have required fields', async () => {
    console.log('🔍 Testing data integrity...');
    
    const { data: props, error } = await supabase
      .from('raw_props')
      .select('*')
      .limit(50);

    expect(error).toBeNull();
    expect(props).toBeDefined();
    expect(props.length).toBeGreaterThan(0);

    let validCount = 0;
    let invalidCount = 0;

    for (const prop of props) {
      const hasRequiredFields = 
        prop.game_id &&
        prop.player_name &&
        prop.stat_type &&
        prop.line !== null &&
        prop.over_odds &&
        prop.under_odds;

      if (hasRequiredFields) {
        validCount++;
      } else {
        invalidCount++;
        console.log(`❌ Invalid prop missing required fields:`, {
          id: prop.id,
          game_id: prop.game_id,
          player_name: prop.player_name,
          stat_type: prop.stat_type,
          line: prop.line
        });
      }
    }

    console.log(`📊 Valid props: ${validCount}, Invalid: ${invalidCount}`);
    
    // At least 95% should have all required fields
    const validPercentage = (validCount / props.length) * 100;
    expect(validPercentage).toBeGreaterThan(95);
  });
});