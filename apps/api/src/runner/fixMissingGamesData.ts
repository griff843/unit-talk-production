/**
 * Fix Missing Games Data
 * The games table is empty for today but raw_props exist. 
 * This script populates the games table from Optimal API events.
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

async function fixMissingGamesData() {
  console.log('🔧 FIXING MISSING GAMES DATA');
  console.log('='.repeat(50));
  
  try {
    // Check current state
    const today = new Date().toISOString().split('T')[0];
    console.log('Date:', today);
    
    const supabaseClient = requireSupabase();
      const { data: existingGames, count: gameCount } = await supabase
      .from('games')
      .select('*', { count: 'exact' })
      .eq('game_date', today);
      
    console.log(`Current games for today: ${gameCount || 0}`);
    
    // Fetch events from Optimal API
    console.log('\n📡 Fetching events from Optimal API...');
    const events = await fetchEvents();
    
    if (events.length === 0) {
      console.log('❌ No events found from Optimal API');
      return;
    }
    
    console.log(`Found ${events.length} events from Optimal API`);
    
    // Filter for today's events
    const todaysEvents = events.filter(event => {
      const eventDate = event.start_date_code || event.start_date;
      return eventDate && eventDate.startsWith(today.replace(/-/g, ''));
    });
    
    console.log(`Events for today: ${todaysEvents.length}`);
    
    if (todaysEvents.length === 0) {
      console.log('⚠️  No events found for today');
      // Check what dates we do have
      const eventDates = events.map(e => e.start_date_code || e.start_date).filter(Boolean);
      console.log('Available event dates:', [...new Set(eventDates)].slice(0, 10));
      return;
    }
    
    // Convert events to games format
    const gamesToInsert = todaysEvents.map(event => {
      return {
        id: randomUUID(),
        external_game_id: event.id,
        sport: event.league.toUpperCase(),
        home_team: event.home_display || event.home,
        away_team: event.away_display || event.away,
        game_date: today,
        game_time: event.commence_time || new Date().toISOString(),
        status: event.status || 'scheduled',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        
        // Additional fields that might be required
        home_score: null,
        away_score: null,
        week: null,
        season: new Date().getFullYear(),
        venue: null,
        weather: null,
        temperature: null,
        wind: null,
        surface: null,
        roof: null,
        spread: null,
        total: null,
        moneyline_home: null,
        moneyline_away: null,
        is_completed: false,
        completed_at: null
      };
    });
    
    console.log(`\n💾 Inserting ${gamesToInsert.length} games...`);
    
    // Insert games
    const supabaseClient = requireSupabase();
      const { data: insertedGames, error: insertError } = await supabase
      .from('games')
      .insert(gamesToInsert)
      .select('id, external_game_id, sport, home_team, away_team');
      
    if (insertError) {
      console.error('❌ Insert failed:', insertError.message);
      console.log('Sample game data:', JSON.stringify(gamesToInsert[0], null, 2));
      return;
    }
    
    console.log(`✅ Successfully inserted ${insertedGames?.length || 0} games`);
    
    // Show sample inserted games
    if (insertedGames && insertedGames.length > 0) {
      console.log('\n📋 Sample inserted games:');
      insertedGames.slice(0, 5).forEach((game, i) => {
        console.log(`${i+1}. ${game.sport}: ${game.away_team} @ ${game.home_team} (${game.external_game_id})`);
      });
    }
    
    // Verify final state
    console.log('\n🔍 Verifying final state...');
    const supabaseClient = requireSupabase();
      const { count: finalCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('game_date', today);
      
    console.log(`Final games count for today: ${finalCount || 0}`);
    
    // Check props can now link to games
    const supabaseClient = requireSupabase();
      const { data: sampleProps } = await supabase
      .from('sports_game_odds')
      .select('external_game_id, sport')
      .eq('game_date', today)
      .limit(5);
      
    if (sampleProps && sampleProps.length > 0) {
      console.log('\nSample prop external_game_ids:', sampleProps.map(p => p.external_game_id));
      
      // Use a simpler approach to count linked props
      const supabaseClient = requireSupabase();
      const { data: allTodayProps } = await supabase
        .from('sports_game_odds')
        .select('external_game_id')
        .eq('game_date', today);
        
      const supabaseClient = requireSupabase();
      const { data: todayGames } = await supabase
        .from('games')
        .select('external_game_id')
        .eq('game_date', today);
        
      const gameIds = new Set(todayGames?.map(g => g.external_game_id) || []);
      const linkedPropsCount = allTodayProps?.filter(p => gameIds.has(p.external_game_id)).length || 0;
      const linkedProps = linkedPropsCount;
        
      console.log(`Props that can link to games: ${linkedProps || 0}/${sampleProps.length}`);
    }
    
    console.log('\n🎉 SUCCESS: Games data populated for today!');
    
  } catch (error) {
    console.error('❌ Failed to fix missing games data:', error);
    throw error;
  }
}

fixMissingGamesData().then(() => {
  console.log('\n✅ GAMES DATA FIX COMPLETE');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Games data fix failed:', error);
  process.exit(1);
});