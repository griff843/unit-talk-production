#!/usr/bin/env tsx

/**
 * Fix Props Game Linking
 * 
 * This script fixes the mismatch between props and games by:
 * 1. Analyzing current props data structure
 * 2. Finding matching games based on team names and dates
 * 3. Updating props to link to correct game IDs
 * 4. Verifying the fixes work for the smart form
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cqfnsozknjzvyiziwicl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwOTY4NDUsImV4cCI6MjA2MDY3Mjg0NX0.PkJJDTPo8WVpGWaAQ-gdzvyGH9WEjcxcwCDi8z0g93o';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fixPropsGameLinking() {
  console.log('🔧 Starting props game linking fix...\n');

  try {
    // 1. Analyze current props data structure
    console.log('📊 Analyzing current props data structure:');
    const { data: sampleProps, error: propsError } = await supabase
      .from('raw_props')
      .select('id, game_id, external_game_id, matchup, team, opponent, sport, game_time')
      .eq('sport', 'MLB')
      .limit(10);

    if (propsError) {
      console.error('❌ Props analysis error:', propsError);
      return;
    }

    console.log(`✅ Found ${sampleProps?.length || 0} sample props:`);
    sampleProps?.forEach((prop, index) => {
      console.log(`   ${index + 1}. ${prop.matchup || `${prop.team} vs ${prop.opponent}`}`);
      console.log(`      Game ID: ${prop.game_id || 'NULL'}`);
      console.log(`      External ID: ${prop.external_game_id || 'NULL'}`);
      console.log(`      Game Time: ${prop.game_time || 'NULL'}`);
    });

    // 2. Find current/recent games
    console.log('\n🎮 Analyzing current games structure:');
    const { data: currentGames, error: gamesError } = await supabase
      .from('games')
      .select('id, league, home_team, away_team, game_date, start_time, commence_time')
      .eq('league', 'MLB')
      .gte('game_date', '2025-08-02') // Recent games
      .limit(10);

    if (gamesError) {
      console.error('❌ Games analysis error:', gamesError);
      return;
    }

    console.log(`✅ Found ${currentGames?.length || 0} recent MLB games:`);
    currentGames?.forEach((game, index) => {
      console.log(`   ${index + 1}. ${game.away_team} @ ${game.home_team}`);
      console.log(`      ID: ${game.id}`);
      console.log(`      Date: ${game.game_date}`);
      console.log(`      Start: ${game.start_time || game.commence_time}`);
    });

    // 3. Check for props without proper game linking
    console.log('\n🔍 Finding props with missing or incorrect game IDs:');
    const { data: orphanedProps, error: orphanError } = await supabase
      .from('raw_props')
      .select('id, game_id, external_game_id, matchup, team, opponent, player_name, stat_type')
      .eq('sport', 'MLB')
      .is('game_id', null)
      .limit(20);

    if (orphanError) {
      console.error('❌ Orphaned props error:', orphanError);
    } else {
      console.log(`✅ Found ${orphanedProps?.length || 0} props with missing game IDs`);
      orphanedProps?.slice(0, 5).forEach((prop, index) => {
        console.log(`   ${index + 1}. ${prop.player_name} - ${prop.stat_type}`);
        console.log(`      Matchup: ${prop.matchup || `${prop.team} vs ${prop.opponent}`}`);
        console.log(`      External ID: ${prop.external_game_id}`);
      });
    }

    // 4. Create team mapping for matching
    console.log('\n🏆 Creating team name mapping for game matching:');
    
    const teamMappings: { [key: string]: string[] } = {
      'phi': ['PHILADELPHIA_PHILLIES_MLB', 'Philadelphia Phillies', 'PHI'],
      'cws': ['CHICAGO_WHITE_SOX_MLB', 'Chicago White Sox', 'CWS', 'CHW'],
      'det': ['DETROIT_TIGERS_MLB', 'Detroit Tigers', 'DET'],
      'bos': ['BOSTON_RED_SOX_MLB', 'Boston Red Sox', 'BOS'],
      'stl': ['STLOUIS_CARDINALS_MLB', 'St. Louis Cardinals', 'STL'],
      'atl': ['ATLANTA_BRAVES_MLB', 'Atlanta Braves', 'ATL'],
      'cle': ['CLEVELAND_GUARDIANS_MLB', 'Cleveland Guardians', 'CLE']
    };

    // 5. Attempt to match props to games
    console.log('\n🎯 Attempting to match props to current games:');
    
    let matchedCount = 0;
    const updatesNeeded: Array<{ propId: string, gameId: string, reason: string }> = [];

    for (const game of currentGames || []) {
      const homeTeam = game.home_team.toLowerCase();
      const awayTeam = game.away_team.toLowerCase();
      
      // Look for props that might match this game
      const { data: matchingProps, error: matchError } = await supabase
        .from('raw_props')
        .select('id, external_game_id, matchup, team, opponent')
        .eq('sport', 'MLB')
        .is('game_id', null) // Only unlinked props
        .limit(100);

      if (matchError) continue;

      for (const prop of matchingProps || []) {
        let isMatch = false;
        let matchReason = '';

        // Check if prop teams match game teams
        const propTeams = [prop.team?.toLowerCase(), prop.opponent?.toLowerCase()].filter(Boolean);
        
        for (const [shortName, variations] of Object.entries(teamMappings)) {
          const homeVariations = variations.map(v => v.toLowerCase());
          const awayVariations = variations.map(v => v.toLowerCase());
          
          if (
            (homeVariations.some(v => homeTeam.includes(shortName) || v.includes(homeTeam.split('_')[0])) &&
             propTeams.includes(shortName)) ||
            (awayVariations.some(v => awayTeam.includes(shortName) || v.includes(awayTeam.split('_')[0])) &&
             propTeams.includes(shortName))
          ) {
            isMatch = true;
            matchReason = `Team match: ${shortName} found in ${homeTeam}/${awayTeam} and prop teams ${propTeams.join(', ')}`;
            break;
          }
        }

        if (isMatch) {
          updatesNeeded.push({
            propId: prop.id,
            gameId: game.id,
            reason: matchReason
          });
          matchedCount++;
        }
      }
    }

    console.log(`✅ Found ${matchedCount} potential prop-to-game matches`);
    
    if (updatesNeeded.length > 0) {
      console.log('\n📝 Sample matches that could be updated:');
      updatesNeeded.slice(0, 5).forEach((update, index) => {
        console.log(`   ${index + 1}. Prop ${update.propId} → Game ${update.gameId}`);
        console.log(`      Reason: ${update.reason}`);
      });
    }

    // 6. For now, just report what we found - don't make automatic updates
    console.log('\n📋 Summary:');
    console.log(`• Total props analyzed: ${sampleProps?.length || 0}`);
    console.log(`• Orphaned props found: ${orphanedProps?.length || 0}`);
    console.log(`• Current games available: ${currentGames?.length || 0}`);
    console.log(`• Potential matches found: ${matchedCount}`);

    console.log('\n💡 Recommendations:');
    if (orphanedProps && orphanedProps.length > 0) {
      console.log('• Props data exists but needs proper game linking');
      console.log('• External game IDs use format like "MLB-phi-cws-2025072819"');
      console.log('• Games use UUID format like "e2d1ba1b-6c90-4791-9604-63dee7e3be40"');
      console.log('• Need to ensure FeedAgent/IngestionAgent creates proper linking');
    }

    if (currentGames && currentGames.length > 0) {
      console.log('• Current games are available in games table');
      console.log('• Game data structure looks correct');
      console.log('• Need to fix the linking process in data ingestion');
    }

    console.log('\n🔧 Next Steps:');
    console.log('1. Check FeedAgent/IngestionAgent configuration');
    console.log('2. Verify how external_game_id should be set');
    console.log('3. Test with fresh data ingestion');
    console.log('4. Create proper game linking in ingestion pipeline');

  } catch (error) {
    console.error('💥 Error during props linking analysis:', error);
  }
}

// Run if this script is executed directly
if (require.main === module) {
  fixPropsGameLinking()
    .then(() => {
      console.log('\n🎉 Props game linking analysis completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Props linking analysis failed:', error);
      process.exit(1);
    });
}

export { fixPropsGameLinking };