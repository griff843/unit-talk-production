/**
 * Test FeedAgent direct data insertion
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testFeedAgentInsertion() {
  console.log('🧪 Testing FeedAgent direct data insertion...');
  
  // Create a sample RawProp object matching the FeedAgent interface
  const testProp = {
    id: 'test-' + Date.now(),
    player_name: 'Test Player',
    team: 'TEST',
    opponent: 'OPP',
    market: 'points',
    line: 25.5,
    over: -110,
    under: -110,
    market_type: 'player_prop',
    game_time: new Date().toISOString(),
    external_id: 'test-external-' + Date.now(),
    provider: 'test-provider',
    scraped_at: new Date().toISOString(),
    sport: 'NBA',
    sport_key: 'basketball_nba',
    game_date: new Date().toISOString().split('T')[0]
  };
  
  console.log('📝 Test prop:', JSON.stringify(testProp, null, 2));
  
  try {
    // Try to insert using the same method as FeedAgent
    const { data, error } = await supabase
      .from('raw_props')
      .insert(testProp)
      .select();
      
    if (error) {
      console.error('❌ Insert error:', error);
      return;
    }
    
    console.log('✅ Successfully inserted prop:', data);
    
    // Verify it's in the database
    const { data: verification, error: verifyError } = await supabase
      .from('raw_props')
      .select('*')
      .eq('id', testProp.id)
      .single();
      
    if (verifyError) {
      console.error('❌ Verification error:', verifyError);
      return;
    }
    
    console.log('✅ Verified in database:', verification);
    
    // Clean up
    await supabase
      .from('raw_props')
      .delete()
      .eq('id', testProp.id);
      
    console.log('🧹 Cleaned up test data');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testFeedAgentInsertion();