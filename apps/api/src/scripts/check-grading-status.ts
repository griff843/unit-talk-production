#!/usr/bin/env npx tsx

/**
 * Check Grading Status - Analyze props and grading workflow
 */

import { config } from 'dotenv';

import { supabaseClient } from '../services/supabaseClient';

config();

async function checkGradingStatus() {
  console.log('🔍 CHECKING GRADING STATUS');
  console.log('==========================');

  try {
    // Check raw props by sport
    const { data: rawPropsSummary, error: rawError } = await supabaseClient
      .from('raw_props')
      .select('sport, status, prop_status, stat_type')
      .neq('status', 'settled');

    if (rawError) {
      console.error('❌ Error fetching raw props:', rawError.message);
      return;
    }

    console.log('\n📊 RAW PROPS SUMMARY:');
    const sportCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};
    const propStatusCounts: Record<string, number> = {};

    rawPropsSummary?.forEach(prop => {
      sportCounts[prop.sport] = (sportCounts[prop.sport] || 0) + 1;
      statusCounts[prop.status] = (statusCounts[prop.status] || 0) + 1;
      propStatusCounts[prop.prop_status || 'null'] =
        (propStatusCounts[prop.prop_status || 'null'] || 0) + 1;
    });

    console.log('By Sport:', sportCounts);
    console.log('By Status:', statusCounts);
    console.log('By Prop Status:', propStatusCounts);

    // Check if any props have been grading_status today
    const { data: recentlyGraded } = await supabaseClient
      .from('raw_props')
      .select('id, sport, player_name, stat_type, edge_score, tier, updated_at')
      .not('edge_score', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(10);

    console.log('\n📈 RECENTLY GRADED PROPS:');
    if (recentlyGraded?.length) {
      recentlyGraded.forEach(prop => {
        console.log(`  ${prop.sport}: ${prop.player_name || 'Team Total'} - ${prop.stat_type}`);
        console.log(`    Edge Score: ${prop.edge_score}, Tier: ${prop.tier}`);
        console.log(`    Updated: ${prop.updated_at?.split('T')[0]}`);
      });
    } else {
      console.log('  No props with edge scores found');
    }

    // Check unified_picks (if any)
    const { data: unifiedPicks } = await supabaseClient
      .from('unified_picks')
      .select('id, sport, player_name, pick_type, confidence, tier, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    console.log('\n🎯 UNIFIED PICKS (PROMOTED):');
    if (unifiedPicks?.length) {
      unifiedPicks.forEach(pick => {
        console.log(`  ${pick.sport}: ${pick.player_name || 'Team Total'} - ${pick.pick_type}`);
        console.log(`    Confidence: ${pick.confidence}, Tier: ${pick.tier}`);
        console.log(`    Created: ${pick.created_at?.split('T')[0]}`);
      });
    } else {
      console.log('  No unified picks found - no props promoted yet');
    }

    // Check for props that should be gradeable (have line, odds, etc.)
    const { data: gradeableProps } = await supabaseClient
      .from('raw_props')
      .select('id, sport, player_name, stat_type, line, over_odds, under_odds, status')
      .not('line', 'is', null)
      .not('over_odds', 'is', null)
      .not('under_odds', 'is', null)
      .neq('status', 'settled')
      .limit(5);

    console.log('\n⚡ PROPS READY FOR GRADING:');
    if (gradeableProps?.length) {
      gradeableProps.forEach(prop => {
        console.log(`  ${prop.sport}: ${prop.player_name || 'Team Total'} - ${prop.stat_type}`);
        console.log(`    Line: ${prop.line}, Over: ${prop.over_odds}, Under: ${prop.under_odds}`);
        console.log(`    Status: ${prop.status}`);
      });
    } else {
      console.log('  No props found with complete grading data');
    }

    // Check for recent props that might need time to settle
    const { data: todaysProps } = await supabaseClient
      .from('raw_props')
      .select('id, sport, player_name, stat_type, created_at, status')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    console.log("\n📅 TODAY'S PROPS:");
    if (todaysProps?.length) {
      todaysProps.forEach(prop => {
        console.log(`  ${prop.sport}: ${prop.player_name || 'Team Total'} - ${prop.stat_type}`);
        console.log(`    Status: ${prop.status}, Created: ${prop.created_at?.split('T')[0]}`);
      });
    } else {
      console.log('  No props created in the last 24 hours');
    }

    console.log('\n🎯 GRADING ANALYSIS:');
    console.log('====================');

    if (!gradeableProps?.length) {
      console.log('❌ Issue: No props with complete grading data (line + odds)');
      console.log('   This could mean:');
      console.log('   - Props are missing line values');
      console.log('   - Props are missing odds data');
      console.log('   - All props are already settled');
    }

    if (!recentlyGraded?.length) {
      console.log('❌ Issue: No props have been grading_status (no edge scores)');
      console.log('   This could mean:');
      console.log('   - GradingAgent is not assigning edge scores');
      console.log('   - Grading criteria are too strict');
      console.log("   - Props don't meet minimum quality thresholds");
    }

    if (!unifiedPicks?.length) {
      console.log('❌ Issue: No props promoted to unified_picks');
      console.log('   This could mean:');
      console.log("   - Props don't meet promotion criteria");
      console.log('   - Edge scores are too low for promotion');
      console.log('   - Promotion workflow is not running');
    }
  } catch (error) {
    console.error('❌ Error checking grading status:', error);
  }
}

// Run the check
if (require.main === module) {
  checkGradingStatus()
    .then(() => {
      console.log('\n✅ Grading status check completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Check failed:', error);
      process.exit(1);
    });
}

export { checkGradingStatus };
