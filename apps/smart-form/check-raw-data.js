const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkRawData() {
  console.log('🔍 Checking raw game data to identify timezone issue...\n');

  try {
    // Check the raw data in the games table
    const { data: games, error } = await supabase
      .from('games')
      .select('*')
      .eq('league', 'MLB')
      .eq('game_date', '2025-08-03')
      .limit(3);

    if (error) {
      console.log('❌ Error:', error);
      return;
    }

    console.log(`📊 Found ${games?.length || 0} games in database:`);

    games?.forEach((game, i) => {
      console.log(`\n${i + 1}. ${game.away_team} @ ${game.home_team}:`);
      console.log(`   ID: ${game.id}`);
      console.log(`   game_date: ${game.game_date}`);
      console.log(`   commence_time: ${game.commence_time}`);
      console.log(`   start_time: ${game.start_time}`);
      console.log(`   created_at: ${game.created_at}`);
      console.log(`   updated_at: ${game.updated_at}`);
      console.log(`   source: ${game.source}`);

      // Test what these times would be in different timezones
      if (game.commence_time) {
        const date = new Date(game.commence_time);
        console.log(`   Parsed as UTC: ${date.toISOString()}`);
        console.log(`   EST: ${date.toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
        console.log(`   PST: ${date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}`);
        console.log(`   CST: ${date.toLocaleString('en-US', { timeZone: 'America/Chicago' })}`);
      }
    });

    // Check what MLB.com shows for comparison
    console.log('\n🏟️ For comparison, typical MLB game times:');
    console.log('   East Coast games: 7:05 PM - 7:35 PM EST');
    console.log('   Central games: 7:05 PM - 8:10 PM CST (8:05 PM - 9:10 PM EST)');
    console.log('   West Coast games: 7:05 PM - 10:10 PM PST (10:05 PM - 1:10 AM EST)');

    console.log('\n🚨 ISSUE IDENTIFIED:');
    console.log('   The commence_time values (2:06 AM) are clearly wrong for MLB games');
    console.log('   This suggests the ingestion pipeline is either:');
    console.log('   1. Getting bad data from the source API');
    console.log('   2. Incorrectly parsing/converting timezones');
    console.log('   3. Storing test/placeholder data instead of real game times');
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

checkRawData();
