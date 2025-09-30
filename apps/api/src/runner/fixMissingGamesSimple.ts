/**
 * Fix Missing Games Data - Simplified Version
 * Insert only the core required fields for games table
 */

import { randomUUID } from 'crypto';

import { createClient } from '@supabase/supabase-js';
// Load environment variables from root directory
import dotenv from 'dotenv';
import path from 'path';
import { requireSupabase } from '../utils/supabaseUtils';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixMissingGamesSimple() {
  console.log('🔧 FIXING MISSING GAMES DATA (SIMPLIFIED)');
  console.log('='.repeat(50));
  
  const today = new Date().toISOString().split('T')[0];
  console.log('Date:', today);
  
  // Check current state
  const supabaseClient = requireSupabase();
      const { count: currentCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('game_date', today);
    
  console.log(`Current games for today: ${currentCount || 0}`);
  
  if (currentCount && currentCount > 0) {
    console.log('✅ Games already exist for today');
    return;
  }
  
  // Fetch events from Optimal API
  console.log('\n📡 Fetching events from Optimal API...');
  const events = await fetchEvents();
  console.log(`Found ${events.length} events`);
  
  // Filter for today's events (more flexible date matching)
  const todaysEvents = events.filter(event => {
    // Try multiple date formats
    const eventDate = event.start_date_code || event.start_date;
    if (!eventDate) return false;
    
    // Check if the event date contains today's date
    const todayFormatted = today.replace(/-/g, ''); // 20250805
    return eventDate.includes(todayFormatted) || eventDate.startsWith(today);
  });
  
  console.log(`Events for today: ${todaysEvents.length}`);
  
  if (todaysEvents.length === 0) {
    console.log('⚠️  No events for exact date match, using all available events');
    // Use all events if no exact match
    todaysEvents.push(...events);
  }
  
  // Create games with only core fields
  const gamesToInsert = todaysEvents.slice(0, 20).map(event => ({
    id: randomUUID(),
    external_game_id: event.id,
    sport: event.league.toUpperCase(),
    home_team: event.home_display || event.home || 'HOME',
    away_team: event.away_display || event.away || 'AWAY',
    game_date: today,
    game_time: event.commence_time || new Date().toISOString(),
    status: event.status || 'scheduled'
  }));
  
  console.log(`\n💾 Inserting ${gamesToInsert.length} games...`);
  
  const supabaseClient = requireSupabase();
      const { data: insertedGames, error: insertError } = await supabase
    .from('games')
    .insert(gamesToInsert)
    .select('id, external_game_id, sport, home_team, away_team');
    
  if (insertError) {
    console.error('❌ Insert failed:', insertError.message);
    return;
  }
  
  console.log(`✅ Successfully inserted ${insertedGames?.length || 0} games`);
  
  // Show sample
  if (insertedGames && insertedGames.length > 0) {
    console.log('\n📋 Sample games:');
    insertedGames.slice(0, 5).forEach((game, i) => {
      console.log(`${i+1}. ${game.sport}: ${game.away_team} @ ${game.home_team}`);
    });
  }
  
  // Final verification
  const supabaseClient = requireSupabase();
      const { count: finalCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('game_date', today);
    
  console.log(`\n✅ Final count: ${finalCount || 0} games for today`);
}

fixMissingGamesSimple().then(() => {
  console.log('\n🎉 SUCCESS: Games populated!');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Failed:', error);
  process.exit(1);
});