#!/usr/bin/env npx tsx

/**
 * Check Table Structure - Analyze raw_props and unified_picks tables
 */

import { config } from 'dotenv';

import { supabaseClient } from '../services/supabaseClient';

config();

async function checkTableStructure() {
  console.log('🔍 CHECKING RAW_PROPS TABLE STRUCTURE');
  console.log('===================================');

  try {
    // Get a sample of raw_props to see the actual columns
    const { data: sampleProps, error } = await supabaseClient
      .from('raw_props')
      .select('*')
      .limit(2);

    if (error) {
      console.error('❌ Error:', error.message);
      return;
    }

    if (sampleProps?.length) {
      console.log('📊 Sample prop structure:');
      console.log(JSON.stringify(sampleProps[0], null, 2));

      console.log('\n📋 Available columns:');
      console.log(Object.keys(sampleProps[0]).join(', '));

      console.log('\n📈 Total props count:');
      const { count } = await supabaseClient
        .from('raw_props')
        .select('*', { count: 'exact', head: true });
      console.log(`Total: ${count} props`);

      // Check for props with grading data
      const { data: gradeableProps } = await supabaseClient
        .from('raw_props')
        .select('id, sport, player_name, stat_type, line, over_odds, under_odds')
        .not('line', 'is', null)
        .not('over_odds', 'is', null)
        .not('under_odds', 'is', null)
        .limit(5);

      console.log('\n⚡ PROPS WITH COMPLETE DATA:');
      if (gradeableProps?.length) {
        gradeableProps.forEach(prop => {
          console.log(`  ${prop.sport}: ${prop.player_name || 'Team Total'} - ${prop.stat_type}`);
          console.log(`    Line: ${prop.line}, Over: ${prop.over_odds}, Under: ${prop.under_odds}`);
        });
      } else {
        console.log('  No props found with complete grading data (line + odds)');
      }

      // Check if any props have edge scores
      const { data: gradedProps } = await supabaseClient
        .from('raw_props')
        .select('id, sport, player_name, edge_score, tier')
        .not('edge_score', 'is', null)
        .limit(5);

      console.log('\n📊 PROPS WITH EDGE SCORES:');
      if (gradedProps?.length) {
        gradedProps.forEach(prop => {
          console.log(`  ${prop.sport}: ${prop.player_name || 'Team Total'}`);
          console.log(`    Edge Score: ${prop.edge_score}, Tier: ${prop.tier}`);
        });
      } else {
        console.log(
          "  No props found with edge scores - GradingAgent hasn't grading_status anything yet"
        );
      }
    } else {
      console.log('No props found in raw_props table');
    }

    // Check unified_picks table
    console.log('\n🎯 CHECKING UNIFIED_PICKS TABLE');
    console.log('===============================');

    const { data: unifiedPicks, error: unifiedError } = await supabaseClient
      .from('unified_picks')
      .select('*')
      .limit(5);

    if (unifiedError) {
      console.error('❌ Error fetching unified_picks:', unifiedError.message);
    } else if (unifiedPicks?.length) {
      console.log('📊 Sample unified pick:');
      console.log(JSON.stringify(unifiedPicks[0], null, 2));

      const { count: unifiedCount } = await supabaseClient
        .from('unified_picks')
        .select('*', { count: 'exact', head: true });
      console.log(`\nTotal unified picks: ${unifiedCount}`);
    } else {
      console.log('No picks found in unified_picks table - no promotions yet');
    }
  } catch (error) {
    console.error('❌ Error checking table structure:', error);
  }
}

// Run the check
if (require.main === module) {
  checkTableStructure()
    .then(() => {
      console.log('\n✅ Table structure check completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Check failed:', error);
      process.exit(1);
    });
}

export { checkTableStructure };
