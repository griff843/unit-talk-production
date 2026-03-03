#!/usr/bin/env npx tsx

/**
 * Detailed Data Issues Analysis
 *
 * Gets specific examples of data quality problems in raw_props
 */

import { config } from 'dotenv';

import { supabaseClient } from '../services/supabaseClient';

config();

async function analyzeDetailedIssues() {
  console.log('🔍 DETAILED DATA QUALITY ISSUES');
  console.log('===============================');

  try {
    // 1. Sport classification issues
    console.log('\n🏈 CRITICAL: NCAAF games mislabeled as NFL/NBA/MLB');
    console.log('================================================');

    const { data: sportMismatches } = await supabaseClient
      .from('raw_props')
      .select('sport, league, player_name, stat_type, matchup')
      .neq('sport', 'NCAAF')
      .eq('league', 'NCAAF')
      .limit(8);

    if (sportMismatches) {
      sportMismatches.forEach((row, i) => {
        console.log(`${i + 1}. SPORT: ${row.sport} | LEAGUE: ${row.league}`);
        console.log(`   PLAYER: "${row.player_name}" | STAT: ${row.stat_type}`);
        console.log(`   MATCHUP: ${row.matchup || 'N/A'}`);
        console.log('');
      });
    }

    // 2. Team names in player_name field
    console.log('👤 ISSUE: Team/Game props using player_name field');
    console.log('=================================================');

    const { data: teamInPlayer } = await supabaseClient
      .from('raw_props')
      .select('player_name, stat_type, sport, matchup, line')
      .in('player_name', ['Over', 'Under'])
      .limit(8);

    if (teamInPlayer) {
      teamInPlayer.forEach((row, i) => {
        console.log(`${i + 1}. PLAYER_NAME: "${row.player_name}" | STAT: ${row.stat_type}`);
        console.log(`   SPORT: ${row.sport} | LINE: ${row.line}`);
        console.log(`   MATCHUP: ${row.matchup || 'N/A'}`);
        console.log('');
      });
    }

    // 3. Sport/League distribution
    console.log('📊 SPORT/LEAGUE DISTRIBUTION ANALYSIS');
    console.log('=====================================');

    const { data: sportLeague } = await supabaseClient
      .from('raw_props')
      .select('sport, league')
      .limit(200);

    if (sportLeague) {
      const combinations: Record<string, number> = {};

      sportLeague.forEach(row => {
        const key = `${row.sport} / ${row.league}`;
        combinations[key] = (combinations[key] || 0) + 1;
      });

      console.log('Most common Sport/League combinations:');
      Object.entries(combinations)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 10)
        .forEach(([combo, count]) => {
          console.log(`  ${combo}: ${count} records`);
        });
    }

    // 4. Stat type analysis
    console.log('\n📋 STAT_TYPE VARIATIONS');
    console.log('=======================');

    const { data: statTypes } = await supabaseClient
      .from('raw_props')
      .select('stat_type')
      .limit(200);

    if (statTypes) {
      const statCounts: Record<string, number> = {};

      statTypes.forEach(row => {
        const stat = row.stat_type || 'null';
        statCounts[stat] = (statCounts[stat] || 0) + 1;
      });

      console.log('Most common stat types:');
      Object.entries(statCounts)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 12)
        .forEach(([stat, count]) => {
          console.log(`  "${stat}": ${count} records`);
        });
    }

    // 5. College teams with wrong sport
    console.log('\n🏫 COLLEGE TEAMS MISLABELED');
    console.log('===========================');

    const { data: collegeTeams } = await supabaseClient
      .from('raw_props')
      .select('sport, league, player_name, stat_type')
      .or('player_name.ilike.%Wildcats%,player_name.ilike.%Tigers%,player_name.ilike.%Eagles%')
      .limit(6);

    if (collegeTeams) {
      collegeTeams.forEach((row, i) => {
        console.log(`${i + 1}. SPORT: ${row.sport} | LEAGUE: ${row.league}`);
        console.log(`   TEAM: "${row.player_name}" | STAT: ${row.stat_type}`);
        console.log('');
      });
    }

    // 6. Recommendations summary
    console.log('💡 IMMEDIATE ACTION ITEMS');
    console.log('=========================');
    console.log('1. 🚨 CRITICAL: Fix sport classification - NCAAF games showing as NFL/NBA/MLB');
    console.log('2. 🚨 CRITICAL: Separate player props from team/game props');
    console.log('3. 🔧 Create proper schema with team_name field for team props');
    console.log('4. 📊 Standardize stat_type values (total, spread, moneyline, etc.)');
    console.log('5. ✅ Validate sport_key matches sport and league fields');

    console.log('\n🏗️ PROPOSED SCHEMA FIXES');
    console.log('=========================');
    console.log('ADD COLUMNS:');
    console.log('  - prop_category: "player" | "team" | "game"');
    console.log('  - team_name: for team/game props (move from player_name)');
    console.log('  - standardized_sport: "NFL" | "NBA" | "MLB" | "NHL" | "NCAAF"');
    console.log('  - standardized_stat: normalized stat types');

    console.log('\nDATA MIGRATION NEEDED:');
    console.log('  - Move Over/Under from player_name to team_name');
    console.log('  - Fix NCAAF sport classification');
    console.log('  - Standardize team names and stat types');
  } catch (error) {
    console.error('Analysis failed:', error);
  }
}

analyzeDetailedIssues();
