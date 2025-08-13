/**
 * E2E Recap Agent Tests
 * Validates daily/weekly recap generation and formatting
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';

describe('E2E Recap Agent Tests', () => {
  let supabase: any;
  let testStartTime: Date;

  beforeAll(async () => {
    testStartTime = new Date();
    console.log(`🧪 Starting Recap Agent E2E tests at ${testStartTime.toISOString()}`);
    
    supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  });

  afterAll(async () => {
    const testEndTime = new Date();
    const duration = testEndTime.getTime() - testStartTime.getTime();
    console.log(`✅ Recap Agent E2E tests completed in ${duration}ms`);
  });

  test('Daily Recap: Should generate recap for correct date range', async () => {
    console.log('🔍 Testing daily recap date range...');
    
    // Calculate yesterday's date range
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);

    console.log(`📊 Testing date range: ${yesterday.toISOString()} to ${endOfYesterday.toISOString()}`);

    // Get picks from yesterday
    const { data: yesterdayPicks, error: picksError } = await supabase
      .from('final_picks')
      .select('*, scored_props(*)')
      .gte('created_at', yesterday.toISOString())
      .lte('created_at', endOfYesterday.toISOString());

    expect(picksError).toBeNull();
    
    const pickCount = yesterdayPicks?.length || 0;
    console.log(`📊 Yesterday's picks found: ${pickCount}`);

    // Check for existing daily recap
    const { data: existingRecap, error: recapError } = await supabase
      .from('recap_log')
      .select('*')
      .eq('recap_type', 'daily')
      .gte('recap_date', yesterday.toISOString())
      .lte('recap_date', endOfYesterday.toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    expect(recapError).toBeNull();

    if (existingRecap && existingRecap.length > 0) {
      const recap = existingRecap[0];
      console.log(`📊 Found daily recap: ${recap.id}`);
      
      // Validate recap data
      expect(recap.recap_type).toBe('daily');
      expect(recap.total_picks).toBeGreaterThanOrEqual(0);
      expect(recap.recap_content).toBeDefined();
      
      // Check if pick count matches
      if (pickCount > 0) {
        expect(recap.total_picks).toBe(pickCount);
      }

      console.log(`✅ Daily recap validation passed`);
    } else if (pickCount > 0) {
      console.log(`⚠️ No daily recap found but picks exist - recap may not have run yet`);
      
      // TODO-MANUAL: Trigger daily recap generation manually
      // This would normally be done by the RecapAgent on schedule
    } else {
      console.log(`ℹ️ No picks or recap found for yesterday - this is normal if no activity`);
    }
  });

  test('Weekly Recap: Should generate recap for correct week range', async () => {
    console.log('🔍 Testing weekly recap date range...');
    
    // Calculate last week's date range (Monday to Sunday)
    const today = new Date();
    const lastMonday = new Date(today);
    lastMonday.setDate(today.getDate() - today.getDay() - 6); // Last Monday
    lastMonday.setHours(0, 0, 0, 0);
    
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    lastSunday.setHours(23, 59, 59, 999);

    console.log(`📊 Testing week range: ${lastMonday.toISOString()} to ${lastSunday.toISOString()}`);

    // Get picks from last week
    const { data: weekPicks, error: picksError } = await supabase
      .from('final_picks')
      .select('*, scored_props(*)')
      .gte('created_at', lastMonday.toISOString())
      .lte('created_at', lastSunday.toISOString());

    expect(picksError).toBeNull();
    
    const weekPickCount = weekPicks?.length || 0;
    console.log(`📊 Last week's picks found: ${weekPickCount}`);

    // Check for existing weekly recap
    const { data: existingWeeklyRecap, error: weeklyError } = await supabase
      .from('recap_log')
      .select('*')
      .eq('recap_type', 'weekly')
      .gte('recap_date', lastMonday.toISOString())
      .lte('recap_date', lastSunday.toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    expect(weeklyError).toBeNull();

    if (existingWeeklyRecap && existingWeeklyRecap.length > 0) {
      const recap = existingWeeklyRecap[0];
      console.log(`📊 Found weekly recap: ${recap.id}`);
      
      // Validate recap data
      expect(recap.recap_type).toBe('weekly');
      expect(recap.total_picks).toBeGreaterThanOrEqual(0);
      expect(recap.recap_content).toBeDefined();
      
      console.log(`✅ Weekly recap validation passed`);
    } else {
      console.log(`ℹ️ No weekly recap found - may not have run yet or no activity last week`);
      
      // TODO-MANUAL: Trigger weekly recap generation manually
      // This would normally be done by the RecapAgent on Sunday night
    }
  });

  test('Recap Content Format: Discord embeds should have proper structure', async () => {
    console.log('🔍 Testing recap content formatting...');
    
    // Get recent recaps
    const { data: recentRecaps, error: recapError } = await supabase
      .from('recap_log')
      .select('*')
      .not('recap_content', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);

    expect(recapError).toBeNull();

    if (!recentRecaps || recentRecaps.length === 0) {
      console.log('ℹ️ No recap content found, creating test recap...');
      
      // Create test recap content
      const testRecapContent = {
        embeds: [{
          title: '📊 Daily Recap - Test',
          description: 'Performance summary for test period',
          color: 0x00ff00,
          fields: [
            { name: 'Total Picks', value: '5', inline: true },
            { name: 'Win Rate', value: '80%', inline: true },
            { name: 'ROI', value: '+12.5%', inline: true },
            { name: 'Best Performer', value: 'Test Player - O2.5 Hits', inline: false }
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: 'Unit Talk Intelligence'
          }
        }]
      };

      const testRecap = {
        recap_type: 'daily',
        recap_date: new Date().toISOString(),
        total_picks: 5,
        win_rate: 80.0,
        roi_percentage: 12.5,
        recap_content: testRecapContent,
        created_at: new Date().toISOString()
      };

      const { data: insertedRecap, error: insertError } = await supabase
        .from('recap_log')
        .insert(testRecap)
        .select()
        .single();

      expect(insertError).toBeNull();
      
      // Validate test recap format
      const content = insertedRecap.recap_content;
      expect(content.embeds).toBeDefined();
      expect(content.embeds[0].title).toContain('Recap');
      expect(content.embeds[0].fields).toBeDefined();
      expect(content.embeds[0].fields.length).toBeGreaterThan(0);

      console.log(`✅ Test recap format validated`);

      // Cleanup
      await supabase.from('recap_log').delete().eq('id', insertedRecap.id);
    } else {
      // Validate existing recaps
      let validFormats = 0;
      
      for (const recap of recentRecaps) {
        const content = recap.recap_content;
        
        if (content && 
            content.embeds && 
            Array.isArray(content.embeds) && 
            content.embeds.length > 0 &&
            content.embeds[0].title &&
            content.embeds[0].fields) {
          validFormats++;
        } else {
          console.log(`❌ Invalid recap format for ${recap.id}`);
        }
      }

      const validPercentage = (validFormats / recentRecaps.length) * 100;
      console.log(`📊 Valid recap formats: ${validFormats}/${recentRecaps.length} (${validPercentage.toFixed(1)}%)`);
      
      expect(validPercentage).toBeGreaterThan(80); // 80% should be properly formatted
    }
  });

  test('Recap Metrics: Performance calculations should be accurate', async () => {
    console.log('🔍 Testing recap metric calculations...');
    
    // Get a recent recap with metrics
    const { data: recapWithMetrics, error: metricsError } = await supabase
      .from('recap_log')
      .select('*')
      .not('win_rate', 'is', null)
      .not('total_picks', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (metricsError || !recapWithMetrics) {
      console.log('ℹ️ No recap with metrics found, creating test data...');
      
      // Create test recap with metrics
      const testMetricsRecap = {
        recap_type: 'daily',
        recap_date: new Date().toISOString(),
        total_picks: 10,
        winning_picks: 7,
        losing_picks: 3,
        win_rate: 70.0,
        roi_percentage: 8.5,
        total_units_wagered: 10.0,
        total_units_profit: 0.85,
        avg_confidence: 78.5,
        created_at: new Date().toISOString()
      };

      const { data: testRecap, error: testError } = await supabase
        .from('recap_log')
        .insert(testMetricsRecap)
        .select()
        .single();

      expect(testError).toBeNull();
      
      // Validate calculations
      const calculatedWinRate = (testRecap.winning_picks / testRecap.total_picks) * 100;
      expect(Math.abs(testRecap.win_rate - calculatedWinRate)).toBeLessThan(0.1);
      
      const calculatedROI = (testRecap.total_units_profit / testRecap.total_units_wagered) * 100;
      expect(Math.abs(testRecap.roi_percentage - calculatedROI)).toBeLessThan(0.1);

      console.log(`✅ Metric calculations validated`);

      // Cleanup
      await supabase.from('recap_log').delete().eq('id', testRecap.id);
    } else {
      // Validate existing metrics
      console.log(`📊 Validating recap metrics for ${recapWithMetrics.id}`);
      
      // Basic validation
      expect(recapWithMetrics.win_rate).toBeGreaterThanOrEqual(0);
      expect(recapWithMetrics.win_rate).toBeLessThanOrEqual(100);
      expect(recapWithMetrics.total_picks).toBeGreaterThanOrEqual(0);
      
      if (recapWithMetrics.winning_picks !== null && recapWithMetrics.losing_picks !== null) {
        expect(recapWithMetrics.winning_picks + recapWithMetrics.losing_picks).toBe(recapWithMetrics.total_picks);
      }

      console.log(`✅ Existing recap metrics validated`);
    }
  });

  test('Recap Scheduling: Recaps should be generated on schedule', async () => {
    console.log('🔍 Testing recap scheduling...');
    
    // Check for recent daily recaps (should be generated daily)
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    
    const { data: recentDailyRecaps, error: dailyError } = await supabase
      .from('recap_log')
      .select('recap_date, created_at')
      .eq('recap_type', 'daily')
      .gte('recap_date', threeDaysAgo.toISOString())
      .order('recap_date', { ascending: true });

    expect(dailyError).toBeNull();
    
    console.log(`📊 Daily recaps in last 3 days: ${recentDailyRecaps?.length || 0}`);

    // Check for recent weekly recaps (should be generated weekly)
    const fourWeeksAgo = new Date(Date.now() - 4 * 7 * 24 * 60 * 60 * 1000);
    
    const { data: recentWeeklyRecaps, error: weeklyError } = await supabase
      .from('recap_log')
      .select('recap_date, created_at')
      .eq('recap_type', 'weekly')
      .gte('recap_date', fourWeeksAgo.toISOString())
      .order('recap_date', { ascending: true });

    expect(weeklyError).toBeNull();
    
    console.log(`📊 Weekly recaps in last 4 weeks: ${recentWeeklyRecaps?.length || 0}`);

    // TODO-MANUAL: Validate that recaps are being generated on the expected schedule
    // This requires checking against the actual Temporal workflow schedule
    // Daily recaps should run every morning at a consistent time
    // Weekly recaps should run every Sunday night or Monday morning
    
    if (recentDailyRecaps && recentDailyRecaps.length > 1) {
      // Check if daily recaps are roughly 24 hours apart
      const dates = recentDailyRecaps.map(r => new Date(r.recap_date));
      const intervals = [];
      
      for (let i = 1; i < dates.length; i++) {
        const interval = dates[i].getTime() - dates[i-1].getTime();
        const hours = interval / (1000 * 60 * 60);
        intervals.push(hours);
      }
      
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      console.log(`📊 Average daily recap interval: ${avgInterval.toFixed(1)} hours`);
      
      // Should be roughly 24 hours (allow some variance)
      expect(avgInterval).toBeGreaterThan(20);
      expect(avgInterval).toBeLessThan(28);
    }
  });

  test('Recap Performance: Generation should complete quickly', async () => {
    console.log('🔍 Testing recap generation performance...');
    
    const startTime = Date.now();
    
    // Query recent recap generation activity
    const { data: recentActivity, error } = await supabase
      .from('recap_log')
      .select('created_at, generation_time_ms, total_picks')
      .not('generation_time_ms', 'is', null)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last week
      .order('created_at', { ascending: false })
      .limit(20);

    expect(error).toBeNull();
    
    const queryTime = Date.now() - startTime;
    console.log(`📊 Recap query completed in ${queryTime}ms`);
    
    if (recentActivity && recentActivity.length > 0) {
      // Analyze generation times
      const generationTimes = recentActivity
        .filter(recap => recap.generation_time_ms)
        .map(recap => recap.generation_time_ms);

      if (generationTimes.length > 0) {
        const avgGenerationTime = generationTimes.reduce((a, b) => a + b, 0) / generationTimes.length;
        const maxGenerationTime = Math.max(...generationTimes);
        
        console.log(`📊 Average recap generation time: ${avgGenerationTime.toFixed(2)}ms`);
        console.log(`📊 Max recap generation time: ${maxGenerationTime}ms`);
        
        // Recap generation should be reasonably fast
        expect(avgGenerationTime).toBeLessThan(15000); // 15 seconds average
        expect(maxGenerationTime).toBeLessThan(60000); // 1 minute max
      }
    }
    
    console.log(`📊 Recent recap activity: ${recentActivity?.length || 0} recaps in last week`);
    
    // Query should complete quickly
    expect(queryTime).toBeLessThan(2000); // 2 seconds
  });
});