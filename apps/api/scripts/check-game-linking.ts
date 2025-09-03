#!/usr/bin/env tsx

/**
 * Check Game Linking Issues
 * Investigates how props are linked to games and find the mismatch
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwOTY4NDUsImV4cCI6MjA2MDY3Mjg0NX0.PkJJDTPo8WVpGWaAQ-gdzvyGH9WEjcxcwCDi8z0g93o';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkGameLinking() {
  console.log('🔗 Checking game linking between props and games...\n');

  try {
    // 1. Get the Tigers @ Phillies game (user's test case)
    console.log('🎯 Finding Tigers @ Phillies game:');
    const { data: tigersGame, error: gameError } = await supabase
      .from('games')
      .select('id, sport, home_team, away_team, external_game_id, source_event_id')
      .or('home_team.ilike.%tiger%,away_team.ilike.%tiger%,home_team.ilike.%phillie%,away_team.ilike.%phillie%')
      .limit(5);

    if (gameError) {
      console.error('❌ Game error:', gameError);
      return;
    }

    console.log(`✅ Found ${tigersGame?.length || 0} matching games`);
    tigersGame?.forEach((game, index) => {
      console.log(`   ${index + 1}. ${game.away_team} @ ${game.home_team}`);
      console.log(`      ID: ${game.id}`);
      console.log(`      External ID: ${game.external_game_id}`);
      console.log(`      Source Event ID: ${game.source_event_id}`);
    });

    // 2. Check what external game IDs exist in props
    console.log('\n📊 Checking props external game IDs:');
    const { data: propsGameIds, error: propsError } = await supabase
      .from('raw_props')
      .select('external_game_id, game_id, matchup, sport')
      .eq('sport', 'MLB')
      .not('external_game_id', 'is', null)
      .limit(10);

    if (propsError) {
      console.error('❌ Props error:', propsError);
    } else {
      console.log(`✅ Found ${propsGameIds?.length || 0} props with external game IDs`);
      propsGameIds?.forEach((prop, index) => {
        console.log(`   ${index + 1}. External ID: ${prop.external_game_id}`);
        console.log(`      Game ID: ${prop.game_id}`);
        console.log(`      Matchup: ${prop.matchup}`);
      });
    }

    // 3. Look for Tigers/Phillies in props by team names
    console.log('\n🔍 Searching for Tigers/Phillies props by team name:');
    const { data: tigerProps, error: tigerError } = await supabase
      .from('raw_props')
      .select('id, game_id, external_game_id, matchup, team, opponent, player_name, stat_type')
      .or('team.ilike.%phi%,team.ilike.%det%,opponent.ilike.%phi%,opponent.ilike.%det%,matchup.ilike.%phi%,matchup.ilike.%det%')
      .limit(5);

    if (tigerError) {
      console.error('❌ Tiger props error:', tigerError);
    } else {
      console.log(`✅ Found ${tigerProps?.length || 0} props for Tigers/Phillies`);
      tigerProps?.forEach((prop, index) => {
        console.log(`   ${index + 1}. ${prop.player_name} - ${prop.stat_type} (${prop.team} vs ${prop.opponent})`);
        console.log(`      Game ID: ${prop.game_id}`);
        console.log(`      External ID: ${prop.external_game_id}`);
        console.log(`      Matchup: ${prop.matchup}`);
      });
    }

    // 4. Check what games IDs actually exist in props
    console.log('\n🎮 Checking unique game IDs in props:');
    const { data: uniqueGameIds, error: uniqueError } = await supabase
      .from('raw_props')
      .select('game_id')
      .eq('sport', 'MLB')
      .not('game_id', 'is', null)
      .limit(10);

    if (uniqueError) {
      console.error('❌ Unique game IDs error:', uniqueError);
    } else {
      const gameIds = [...new Set(uniqueGameIds?.map(p => p.game_id))];
      console.log(`✅ Found ${gameIds.length} unique game IDs in props`);
      gameIds.slice(0, 5).forEach((id, index) => {
        console.log(`   ${index + 1}. ${id}`);
      });
    }

    // 5. Check if any props game IDs match games table IDs
    if (tigersGame && tigersGame.length > 0) {
      const testGameId = tigersGame[0].id;
      console.log(`\n🔗 Testing if props exist for game ID: ${testGameId}`);
      
      const { data: linkedProps, error: linkedError } = await supabase
        .from('raw_props')
        .select('id, player_name, stat_type')
        .eq('game_id', testGameId)
        .limit(3);

      if (linkedError) {
        console.error('❌ Linked props error:', linkedError);
      } else {
        console.log(`✅ Found ${linkedProps?.length || 0} props linked to this game`);
      }
    }

  } catch (error) {
    console.error('💥 Error checking game linking:', error);
  }
}

// Run if this script is executed directly
if (require.main === module) {
  checkGameLinking()
    .then(() => {
      console.log('\n🎉 Game linking check completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Game linking check failed:', error);
      process.exit(1);
    });
}

export { checkGameLinking };