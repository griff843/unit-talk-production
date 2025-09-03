#!/usr/bin/env tsx

/**
 * Quick Props Population Script
 * Populates props data for live games to fix the immediate testing issue
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwOTY4NDUsImV4cCI6MjA2MDY3Mjg0NX0.PkJJDTPo8WVpGWaAQ-gdzvyGH9WEjcxcwCDi8z0g93o';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface Game {
  id: string;
  home_team: string;
  away_team: string;
  game_time: string;
  sport: string;
}

interface Player {
  id: string;
  name: string;
  team: string;
  sport: string;
}

async function populatePropsForLiveGames() {
  console.log('🎯 Populating props for live games...\n');

  try {
    // 1. Get current games that should have props
    console.log('📊 Fetching current games...');
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .eq('sport', 'MLB')
      .order('game_time', { ascending: true })
      .limit(10);

    if (gamesError) {
      throw new Error(`Games fetch error: ${gamesError.message}`);
    }

    if (!games || games.length === 0) {
      console.log('❌ No games found in database');
      return;
    }

    console.log(`✅ Found ${games.length} games`);
    
    // 2. Get players for prop creation
    console.log('👥 Fetching players...');
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('sport', 'MLB')
      .limit(50);

    if (playersError) {
      throw new Error(`Players fetch error: ${playersError.message}`);
    }

    console.log(`✅ Found ${players?.length || 0} players`);

    // 3. Create props for each game
    let totalPropsCreated = 0;

    for (const game of games.slice(0, 5)) { // Limit to first 5 games
      console.log(`\n🏟️ Processing game: ${game.away_team} @ ${game.home_team}`);
      
      // Get players for both teams
      const gameTeams = [game.home_team, game.away_team];
      const gamePlayers = players?.filter(p => 
        gameTeams.some(team => p.team?.toLowerCase().includes(team.toLowerCase().substring(0, 3)))
      ) || [];

      console.log(`   Found ${gamePlayers.length} players for this game`);

      // Create props for each player
      const propsToCreate = [];
      
      for (const player of gamePlayers.slice(0, 6)) { // Limit to 6 players per game
        // Create multiple prop types for each player
        const propTypes = [
          { type: 'hits', line: 1.5, over_odds: -120, under_odds: +100 },
          { type: 'runs', line: 0.5, over_odds: +140, under_odds: -170 },
          { type: 'rbis', line: 0.5, over_odds: +110, under_odds: -140 },
        ];

        for (const propType of propTypes) {
          propsToCreate.push({
            game_id: game.id,
            player_id: player.id,
            player_name: player.name,
            prop_type: propType.type,
            line: propType.line,
            over_odds: propType.over_odds,
            under_odds: propType.under_odds,
            sport: 'MLB',
            bookmaker: 'DraftKings',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
      }

      // Insert props in batches
      if (propsToCreate.length > 0) {
        console.log(`   Creating ${propsToCreate.length} props...`);
        
        const { data: insertedProps, error: propsError } = await supabase
          .from('props')
          .insert(propsToCreate)
          .select();

        if (propsError) {
          console.error(`   ❌ Error creating props: ${propsError.message}`);
        } else {
          console.log(`   ✅ Created ${insertedProps?.length || 0} props`);
          totalPropsCreated += insertedProps?.length || 0;
        }
      }
    }

    console.log(`\n🎉 COMPLETED! Created ${totalPropsCreated} total props`);
    
    // 4. Verify props were created
    console.log('\n🔍 Verifying props creation...');
    const { data: allProps, error: verifyError } = await supabase
      .from('props')
      .select('game_id, player_name, prop_type, line')
      .order('created_at', { ascending: false })
      .limit(10);

    if (verifyError) {
      console.error(`❌ Verification error: ${verifyError.message}`);
    } else {
      console.log('✅ Recent props created:');
      allProps?.forEach((prop, index) => {
        console.log(`   ${index + 1}. ${prop.player_name} - ${prop.prop_type} ${prop.line}`);
      });
    }

  } catch (error) {
    console.error('💥 Error populating props:', error);
    throw error;
  }
}

// Run if this script is executed directly
if (require.main === module) {
  populatePropsForLiveGames()
    .then(() => {
      console.log('\n🚀 Props population completed successfully!');
      console.log('💡 You can now test the smart form with live props data');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Props population failed:', error);
      process.exit(1);
    });
}

export { populatePropsForLiveGames };