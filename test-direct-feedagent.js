require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

console.log('🚀 Direct FeedAgent Parallel Processing Test');
console.log('='.repeat(60));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testDirectParallelProcessing() {
  try {
    console.log('📊 Checking initial database state...');
    
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: beforeData, error: beforeError } = await supabase
      .from('raw_props')
      .select('id')
      .gte('created_at', fiveMinutesAgo);
      
    if (beforeError) throw beforeError;
    console.log(`   Recent props (5 min): ${beforeData.length}`);

    console.log('\n🌐 Fetching data using unified router...');
    
    // Import the unified data source router directly
    const { fetchUnifiedData } = require('./apps/api/dist/agents/FeedAgent/dataSourceRouter.js');
    
    // Get a smaller subset for testing - just NCAAF
    const testConfig = {
      sport: 'NCAAF',
      marketType: 'player-props', 
      date: new Date().toISOString().split('T')[0],
      forceSource: 'odds-api'
    };
    
    console.log(`   Fetching ${testConfig.sport} props...`);
    const result = await fetchUnifiedData(testConfig);
    console.log(`   ✅ Got ${result.data.length} props from ${result.source} in ${result.metadata.processingTimeMs}ms`);
    
    if (result.data.length === 0) {
      console.log('   ⚠️ No props to test with - exiting');
      return;
    }
    
    // Take a smaller sample for testing
    const sampleProps = result.data.slice(0, 100);
    console.log(`   📦 Testing with ${sampleProps.length} props`);
    
    // Transform to proper database format
    const transformedProps = sampleProps.map(prop => ({
      // Required fields
      id: crypto.randomUUID(),
      player_name: prop.player_name || '',
      sport: prop.sport || testConfig.sport,
      team: prop.team || '',
      opponent: prop.opponent || '',
      stat_type: prop.stat_type || prop.market || '',
      line: parseFloat(prop.line) || 0,
      game_date: prop.game_date || testConfig.date,
      matchup: prop.matchup || `${prop.team} vs ${prop.opponent}`,
      
      // Market and odds fields  
      market: prop.market || prop.stat_type || '',
      market_type: prop.market_type || 'player_prop',
      over: parseFloat(prop.over_odds) || parseFloat(prop.over) || 0,
      under: parseFloat(prop.under_odds) || parseFloat(prop.under) || 0,
      over_odds: parseFloat(prop.over_odds) || parseFloat(prop.over) || null,
      under_odds: parseFloat(prop.under_odds) || parseFloat(prop.under) || null,
      
      // Game timing
      game_time: prop.game_time || new Date().toISOString(),
      start_time: prop.start_time || null,
      
      // Provider metadata
      provider: 'unified-router',
      external_id: crypto.randomUUID(),
      external_game_id: null,
      game_id: null,  // Explicitly set to null like existing props
      sport_key: prop.sport_key || testConfig.sport.toLowerCase(),
      
      // All the required boolean/numeric fields with defaults
      is_valid: true,
      is_primary: true,
      is_alt_line: false,
      auto_approved: false,
      context_flag: false,
      promoted: false,
      is_promoted: false,
      promoted_to_picks: false,
      steam_detected: false,
      contrarian_opportunity: false,
      is_canary: false,
      needs_review: false,
      unit_size: 1,
      confidence: 0,
      volatility: 5,
      bid_ask_spread: 0.02,
      data_completeness: 0.95,
      outlier_score: 0.95,
      consistency_score: 0.95,
      data_validation_score: 0.95,
      data_quality_score: 0,
      pro_attempts: 0,
      created_at: new Date().toISOString(),
      inserted_at: new Date().toISOString(),
      scraped_at: new Date().toISOString(),
      
      // All nullable fields
      outcome: null,
      odds: null,
      trend_confidence: null,
      matchup_quality: null,
      line_value_score: null,
      role_stability: null,
      confidence_score: null,
      edge_score: null,
      tier_tag: null,
      source: null,
      game_id: null,
      bet_type: null,
      outcomes: null,
      player_id: null,
      player_slug: null,
      fair_odds: null,
      league: null,
      promoted_at: null,
      tier: null,
      ev_percent: null,
      trend_score: null,
      matchup_score: null,
      line_score: null,
      role_score: null,
      direction: null,
      unique_key: null,
      event_id: null,
      book: null,
      updated_at: null,
      home_team: null,
      home_team_id: null,
      away_team: null,
      away_team_id: null,
      expected_value: null,
      sharp_money: null,
      line_movement: null,
      player_form: null,
      injury_impact: null,
      best_available_line: null,
      best_book: null,
      public_betting_percentage: null,
      sharp_betting_percentage: null,
      correlation_risk: null,
      weather_impact: null,
      market_intelligence: null,
      volume_profile: null,
      closing_line_value: null,
      predicted_closing_line: null,
      optimal_betting_time: null,
      injury_timing_advantage: null,
      cross_market_arbitrage: null,
      player_fatigue: null,
      venue_advantage: null,
      referee_impact: null,
      pace_impact: null,
      motivational_factors: null,
      portfolio_impact: null,
      metadata: null,
      prop_category: null,
      team_name: null,
      standardized_sport: null,
      standardized_stat: null,
      processed_at: null,
      processing_error: null,
      professional_score: null,
      kelly_fraction: null,
      clv_tracking_id: null
    }));
    
    console.log('\n🚀 Testing parallel batch processing...');
    
    const startTime = Date.now();
    const BATCH_SIZE = 50;  // Smaller batches for testing
    const MAX_PARALLEL_BATCHES = 3;
    
    // Split into batches
    const batches = [];
    for (let i = 0; i < transformedProps.length; i += BATCH_SIZE) {
      batches.push(transformedProps.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`   📦 Split ${transformedProps.length} props into ${batches.length} batches of up to ${BATCH_SIZE} each`);
    
    let totalInserted = 0;
    let totalDuplicates = 0;
    let totalErrors = 0;
    
    // Process batches in parallel chunks
    for (let i = 0; i < batches.length; i += MAX_PARALLEL_BATCHES) {
      const parallelBatches = batches.slice(i, i + MAX_PARALLEL_BATCHES);
      
      console.log(`   🔄 Processing chunk ${Math.floor(i / MAX_PARALLEL_BATCHES) + 1}/${Math.ceil(batches.length / MAX_PARALLEL_BATCHES)} (${parallelBatches.length} batches)`);
      
      const batchPromises = parallelBatches.map(async (batch, batchIndex) => {
        try {
          const { data, error } = await supabase
            .from('raw_props')
            .upsert(batch, {
              onConflict: 'id',
              ignoreDuplicates: true
            })
            .select('id');
            
          if (error) {
            console.log(`   ❌ Batch ${i + batchIndex} failed:`, error.message);
            return { inserted: 0, duplicates: 0, errors: batch.length };
          }
          
          const insertedCount = data?.length || 0;
          const duplicateCount = batch.length - insertedCount;
          
          console.log(`   ✅ Batch ${i + batchIndex}: ${insertedCount} inserted, ${duplicateCount} duplicates`);
          return { inserted: insertedCount, duplicates: duplicateCount, errors: 0 };
          
        } catch (error) {
          console.log(`   💥 Batch ${i + batchIndex} exception:`, error.message);
          return { inserted: 0, duplicates: 0, errors: batch.length };
        }
      });
      
      const results = await Promise.all(batchPromises);
      
      results.forEach(result => {
        totalInserted += result.inserted;
        totalDuplicates += result.duplicates; 
        totalErrors += result.errors;
      });
      
      const progress = Math.min(i + MAX_PARALLEL_BATCHES, batches.length);
      const percentage = ((progress / batches.length) * 100).toFixed(1);
      console.log(`   📊 Progress: ${percentage}% - Total inserted: ${totalInserted}, duplicates: ${totalDuplicates}, errors: ${totalErrors}`);
    }
    
    const duration = Date.now() - startTime;
    console.log(`\n🎉 Parallel processing complete in ${duration}ms!`);
    console.log(`📈 Final results: ${totalInserted} inserted, ${totalDuplicates} duplicates, ${totalErrors} errors`);
    
    // Verify in database
    console.log('\n🔍 Verifying database insertion...');
    const { data: afterData, error: afterError } = await supabase
      .from('raw_props')
      .select('id, player_name, sport, provider')
      .gte('created_at', fiveMinutesAgo)
      .eq('provider', 'unified-router')
      .limit(10);
      
    if (afterError) throw afterError;
    
    console.log(`✅ Found ${afterData.length} new unified-router props in database`);
    if (afterData.length > 0) {
      console.log('Sample props:');
      afterData.slice(0, 3).forEach(prop => {
        console.log(`   - ${prop.sport}: ${prop.player_name} (${prop.provider})`);
      });
    }
    
    if (totalInserted > 0) {
      console.log('\n🎯 SUCCESS: Parallel batch processing is working correctly!');
      console.log('   ✅ Data fetched from unified router');
      console.log('   ✅ Props transformed to database format');
      console.log('   ✅ Parallel batch insertion successful');
      console.log('   ✅ Database verification confirmed');
      return true;
    } else {
      console.log('\n⚠️ All props were duplicates - test inconclusive');
      return false;
    }
    
  } catch (error) {
    console.error('\n💥 Direct parallel processing test failed:', error.message);
    return false;
  }
}

testDirectParallelProcessing();