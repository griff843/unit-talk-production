#!/usr/bin/env npx tsx

/**
 * Analyze Over/Under Props in Player Names
 * 
 * Identifies team total props incorrectly placed in player_name field
 * and analyzes API call efficiency issues.
 */

import { config } from 'dotenv';

import { supabaseClient } from '../services/supabaseClient';
import { Logger } from '../shared/logger';

config();

async function analyzeOverUnderIssue() {
  console.log('🔍 ANALYZING OVER/UNDER PROPS IN PLAYER NAMES');
  console.log('=============================================');

  const logger = new Logger('analyze-over-under-issue');

  try {
    console.log('\n📊 PHASE 1: IDENTIFY OVER/UNDER IN PLAYER NAMES');
    console.log('===============================================');
    
    // Check for Over/Under in player names
    const { data: overUnders, error } = await supabaseClient
      .from('raw_props')
      .select('player_name, team, stat_type, market_type, line, sport, provider, created_at')
      .or('player_name.ilike.%over%,player_name.ilike.%under%')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      throw new Error(`Query failed: ${error.message}`);
    }

    console.log(`📋 Found ${overUnders?.length || 0} props with Over/Under in player_name:`);
    
    if (overUnders && overUnders.length > 0) {
      for (const prop of overUnders) {
        console.log(`\n  📋 player_name: "${prop.player_name}"`);
        console.log(`    team: "${prop.team}"`);
        console.log(`    stat_type: "${prop.stat_type}"`);
        console.log(`    market_type: "${prop.market_type}"`);
        console.log(`    line: ${prop.line}`);
        console.log(`    sport: "${prop.sport}"`);
        console.log(`    provider: "${prop.provider}"`);
        console.log(`    created: ${prop.created_at?.split('T')[0]}`);
      }
    }

    // Get total count
    const { count: totalOverUnders, error: countError } = await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .or('player_name.ilike.%over%,player_name.ilike.%under%');

    if (!countError) {
      console.log(`\n📊 Total Over/Under props in player_name: ${totalOverUnders?.toLocaleString()}`);
    }

    console.log('\n🔍 PHASE 2: API CALL EFFICIENCY ANALYSIS');
    console.log('========================================');
    
    // Analyze recent API calls and their structure
    console.log('\n💡 Odds API Call Structure Analysis:');
    console.log('====================================');
    console.log('Current Implementation (Per Sport):');
    console.log('  - 1 call per sport (e.g., NCAAF)');
    console.log('  - Returns ALL games for that sport');
    console.log('  - Returns ALL markets (h2h, spreads, totals) in ONE call');
    console.log('  - Returns ALL bookmakers in ONE call');
    
    console.log('\n📊 Expected vs Reality:');
    console.log('=======================');
    console.log('Expected Credits Used: 1 credit per sport');
    console.log('  - NCAAF: 1 credit');
    console.log('  - NFL: 1 credit'); 
    console.log('  - NBA: 1 credit');
    console.log('  - etc.');
    
    console.log('\nCurrent Credit Tracking: 0/500 used');
    console.log('  - Either tracking is broken');
    console.log('  - Or we have not made API calls yet');
    console.log('  - Credit monitoring may reset incorrectly');

    console.log('\n🎯 PHASE 3: DATA CLASSIFICATION ISSUES');
    console.log('=====================================');
    
    // Check for team totals vs player props
    const { data: teamTotals, error: teamError } = await supabaseClient
      .from('raw_props')
      .select('player_name, stat_type, market_type, line, sport')
      .in('stat_type', ['total', 'totals'])
      .or('player_name.ilike.%over%,player_name.ilike.%under%')
      .limit(10);

    if (!teamError && teamTotals) {
      console.log(`\n🏈 Team Total Props (should not have player names): ${teamTotals.length}`);
      for (const prop of teamTotals) {
        console.log(`  📋 "${prop.player_name}" | stat: ${prop.stat_type} | line: ${prop.line}`);
      }
    }

    console.log('\n🔧 PHASE 4: PROPOSED SOLUTIONS');
    console.log('===============================');
    
    console.log('\n1️⃣ FIX OVER/UNDER CLASSIFICATION:');
    console.log('===================================');
    console.log('Problem: Team totals showing as player names');
    console.log('Solution: Separate team props from player props');
    console.log('  - player_name should be actual player names only');
    console.log('  - team totals should use team field');
    console.log('  - over/under should be in outcome field, not player_name');

    console.log('\n2️⃣ FIX API CREDIT TRACKING:');
    console.log('============================');
    console.log('Problem: Credit usage showing 0/500 despite API calls');
    console.log('Possible causes:');
    console.log('  - Credit tracking resets incorrectly');
    console.log('  - Not persisting credit usage between sessions');
    console.log('  - API key might be different than expected');

    console.log('\n3️⃣ OPTIMIZE API USAGE:');
    console.log('=======================');
    console.log('Current: Efficient (1 call per sport gets all games)');
    console.log('Recommendation: Keep current approach, fix tracking');
    console.log('  - Single call gets 100+ games per sport');
    console.log('  - Much more efficient than per-game calls');

    console.log('\n📋 IMMEDIATE ACTION ITEMS:');
    console.log('==========================');
    if (totalOverUnders && totalOverUnders > 0) {
      console.log(`1. Fix ${totalOverUnders} over/under props in player_name field`);
    }
    console.log('2. Investigate credit tracking accuracy');
    console.log('3. Separate team props from player props properly');
    console.log('4. Validate API call efficiency is maintained');

    console.log('\n🎯 RECOMMENDED DATA STRUCTURE:');
    console.log('==============================');
    console.log('TEAM TOTALS:');
    console.log('  player_name: null or "Team Total"');
    console.log('  team: "Team Name"');
    console.log('  stat_type: "team_total"');
    console.log('  outcome: "over" or "under"');
    
    console.log('\nPLAYER PROPS:');
    console.log('  player_name: "Actual Player Name"');
    console.log('  team: "Team Name"');
    console.log('  stat_type: "points", "rebounds", etc.');
    console.log('  outcome: "over" or "under"');

  } catch (error) {
    console.error('\n❌ Analysis failed:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

// Run the analysis
if (require.main === module) {
  analyzeOverUnderIssue()
    .then(() => {
      console.log('\n✅ Over/Under analysis completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Analysis crashed:', error);
      process.exit(1);
    });
}

export { analyzeOverUnderIssue };