const { createClient } = require('@supabase/supabase-js');
require('dotenv/config');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Testing Direct Database Insertion with Corrected Schema');
console.log('='.repeat(60));

async function testDirectInsertion() {
  try {
    // Test with the EXACT same transformation that FeedAgent uses
    const sampleProp = {
      // Required fields
      id: crypto.randomUUID(),
      player_name: 'Test Player',
      sport: 'NFL',
      team: 'KC',
      opponent: 'LAC',
      stat_type: 'passing_yards',
      line: 250.5,
      game_date: new Date().toISOString().split('T')[0],
      matchup: 'KC vs LAC',
      
      // Market and odds fields
      market: 'passing_yards',
      market_type: 'player_prop',
      over: -110,
      under: -110,
      over_odds: -110,
      under_odds: -110,
      
      // Game timing
      game_time: new Date().toISOString(),
      start_time: null,
      
      // Provider and metadata
      provider: 'test-provider',
      external_id: crypto.randomUUID(),
      external_game_id: null,
      sport_key: 'nfl',
      
      // Data quality and validation
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
      
      // Default numerical fields
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
      
      // Timestamps
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
    };
    
    console.log('📊 Testing complete schema insertion...');
    
    const { data: insertResult, error: insertError } = await supabase
      .from('raw_props')
      .insert(sampleProp)
      .select('id');
    
    if (insertError) {
      console.log('❌ INSERTION FAILED:', insertError.message);
      console.log('   Error code:', insertError.code);
      console.log('   Error details:', insertError.details);
      
      // Try to identify the specific problematic field
      if (insertError.message.includes('column') || insertError.message.includes('violates')) {
        console.log('\n🔍 SCHEMA MISMATCH DETECTED');
        console.log('   Likely issue: Field type mismatch or missing column');
        
        // Test with minimal required fields only
        const minimalProp = {
          id: crypto.randomUUID(),
          player_name: 'Minimal Test',
          sport: 'TEST',
          created_at: new Date().toISOString()
        };
        
        console.log('\n📋 Testing minimal insertion...');
        const { data: minResult, error: minError } = await supabase
          .from('raw_props')
          .insert(minimalProp)
          .select('id');
        
        if (minError) {
          console.log('❌ Even minimal insertion failed:', minError.message);
        } else {
          console.log('✅ Minimal insertion worked - complex field issue');
          
          // Clean up
          await supabase.from('raw_props').delete().eq('id', minimalProp.id);
        }
      }
      
      return false;
    }
    
    console.log('✅ INSERTION SUCCESSFUL!');
    console.log(`   Inserted prop ID: ${insertResult[0].id}`);
    
    // Verify it's actually in the database
    const { data: verifyResult, error: verifyError } = await supabase
      .from('raw_props')
      .select('id, player_name, sport, market')
      .eq('id', sampleProp.id);
    
    if (verifyError) {
      console.log('❌ Verification failed:', verifyError.message);
    } else {
      console.log('✅ VERIFICATION SUCCESSFUL');
      console.log('   Retrieved:', verifyResult[0]);
    }
    
    // Clean up test data
    await supabase.from('raw_props').delete().eq('id', sampleProp.id);
    console.log('✅ Test data cleaned up');
    
    return true;
    
  } catch (error) {
    console.error('💥 Test insertion failed:', error.message);
    return false;
  }
}

async function checkRecentInsertions() {
  console.log('\n📈 Checking for recent FeedAgent insertions...');
  
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  
  const { data: recentProps, error: recentError } = await supabase
    .from('raw_props')
    .select('id, player_name, sport, provider, created_at')
    .gte('created_at', thirtyMinutesAgo)
    .order('created_at', { ascending: false });
  
  if (recentError) {
    console.log('❌ Recent props check failed:', recentError.message);
    return;
  }
  
  console.log(`Found ${recentProps.length} recent props`);
  
  if (recentProps.length > 0) {
    const sportBreakdown = recentProps.reduce((acc, prop) => {
      acc[prop.sport] = (acc[prop.sport] || 0) + 1;
      return acc;
    }, {});
    
    console.log('Recent props by sport:', sportBreakdown);
    
    // Check for FeedAgent provider
    const feedAgentProps = recentProps.filter(p => 
      p.provider === 'unified-router' || 
      p.provider === 'test-provider' || 
      p.provider === 'optimal-api'
    );
    
    console.log(`FeedAgent props: ${feedAgentProps.length}`);
    
    if (feedAgentProps.length > 0) {
      console.log('🎉 SUCCESS: FeedAgent IS inserting data successfully!');
    }
  }
}

async function main() {
  const insertionWorks = await testDirectInsertion();
  
  if (insertionWorks) {
    console.log('\n✅ Schema transformation is correct');
    await checkRecentInsertions();
    
    console.log('\n🎯 CONCLUSION:');
    console.log('If FeedAgent props aren\'t showing up, the issue is likely:');
    console.log('1. Time window too narrow in validation script');
    console.log('2. Props being inserted but with different timestamps');
    console.log('3. FeedAgent execution completing but silently failing on some props');
  } else {
    console.log('\n❌ Schema needs further correction');
  }
}

main();