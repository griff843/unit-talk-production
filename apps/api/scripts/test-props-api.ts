#!/usr/bin/env tsx

/**
 * Test Props API Endpoint
 * Tests the smart form's props API to see if it can find props data
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwOTY4NDUsImV4cCI6MjA2MDY3Mjg0NX0.PkJJDTPo8WVpGWaAQ-gdzvyGH9WEjcxcwCDi8z0g93o';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testPropsData() {
  console.log('🔍 Testing props data availability...\n');

  try {
    // 1. Check available games
    console.log('📊 Checking available games:');
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, sport, home_team, away_team, start_time, commence_time')
      .eq('sport', 'BASKETBALL') // NBA games from schema check
      .limit(5);

    if (gamesError) {
      console.error('❌ Games error:', gamesError);
      return;
    }

    console.log(`✅ Found ${games?.length || 0} NBA games`);
    games?.forEach((game, index) => {
      console.log(`   ${index + 1}. ${game.away_team} @ ${game.home_team} (ID: ${game.id})`);
    });

    if (!games || games.length === 0) {
      console.log('❌ No games available for testing');
      return;
    }

    // 2. Test props for first game
    const testGame = games[0];
    console.log(`\n🎯 Testing props for game: ${testGame.away_team} @ ${testGame.home_team}`);
    console.log(`   Game ID: ${testGame.id}`);

    // Check raw props directly matching the API logic
    const { data: rawProps, error: propsError } = await supabase
      .from('raw_props')
      .select(`
        id,
        game_id,
        external_game_id,
        player_name,
        team,
        stat_type,
        line,
        over_odds,
        under_odds,
        sport,
        game_time
      `)
      .or(`game_id.eq.${testGame.id},external_game_id.eq.${testGame.id}`)
      .eq('sport', 'NBA')
      .limit(10);

    if (propsError) {
      console.error('❌ Props error:', propsError);
    } else {
      console.log(`✅ Found ${rawProps?.length || 0} props for this game`);
      
      if (rawProps && rawProps.length > 0) {
        console.log('📋 Sample props:');
        rawProps.slice(0, 3).forEach((prop, index) => {
          console.log(`   ${index + 1}. ${prop.player_name} - ${prop.stat_type} ${prop.line}`);
        });
      }
    }

    // 3. Check MLB props (user's main interest)
    console.log(`\n⚾ Checking MLB props availability:`);
    const { data: mlbProps, error: mlbError } = await supabase
      .from('raw_props')
      .select('id, game_id, player_name, stat_type, line, sport, game_time')
      .eq('sport', 'MLB')
      .limit(5);

    if (mlbError) {
      console.error('❌ MLB props error:', mlbError);
    } else {
      console.log(`✅ Found ${mlbProps?.length || 0} total MLB props`);
      if (mlbProps && mlbProps.length > 0) {
        console.log('📋 Sample MLB props:');
        mlbProps.forEach((prop, index) => {
          console.log(`   ${index + 1}. ${prop.player_name} - ${prop.stat_type} ${prop.line}`);
        });
      }
    }

    // 4. Check MLB games
    console.log(`\n⚾ Checking MLB games:`);
    const { data: mlbGames, error: mlbGamesError } = await supabase
      .from('games')
      .select('id, sport, home_team, away_team, start_time, commence_time')
      .eq('sport', 'MLB')
      .limit(5);

    if (mlbGamesError) {
      console.error('❌ MLB games error:', mlbGamesError);
    } else {
      console.log(`✅ Found ${mlbGames?.length || 0} MLB games`);
      mlbGames?.forEach((game, index) => {
        console.log(`   ${index + 1}. ${game.away_team} @ ${game.home_team} (ID: ${game.id})`);
      });
    }

    // 5. Test props for a MLB game
    if (mlbGames && mlbGames.length > 0) {
      const mlbGame = mlbGames[0];
      console.log(`\n🎯 Testing MLB props for: ${mlbGame.away_team} @ ${mlbGame.home_team}`);
      
      const { data: mlbGameProps, error: mlbGameError } = await supabase
        .from('raw_props')
        .select('id, player_name, stat_type, line, game_id, external_game_id')
        .or(`game_id.eq.${mlbGame.id},external_game_id.eq.${mlbGame.id}`)
        .eq('sport', 'MLB')
        .limit(5);

      if (mlbGameError) {
        console.error('❌ MLB game props error:', mlbGameError);
      } else {
        console.log(`✅ Found ${mlbGameProps?.length || 0} props for this MLB game`);
        if (mlbGameProps && mlbGameProps.length > 0) {
          mlbGameProps.forEach((prop, index) => {
            console.log(`   ${index + 1}. ${prop.player_name} - ${prop.stat_type} ${prop.line}`);
          });
        }
      }
    }

  } catch (error) {
    console.error('💥 Error testing props:', error);
  }
}

// Run if this script is executed directly
if (require.main === module) {
  testPropsData()
    .then(() => {
      console.log('\n🎉 Props data test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Props test failed:', error);
      process.exit(1);
    });
}

export { testPropsData };