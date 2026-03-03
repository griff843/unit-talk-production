#!/usr/bin/env npx tsx

/**
 * Clear and Re-grade Props
 *
 * Clear existing edge_score and tier values to force fresh grading
 * with the new sophisticated scoring system
 */

import { config } from 'dotenv';

import { supabaseClient } from '../services/supabaseClient';

config();

async function clearAndRegradeProps() {
  console.log('🧹 CLEAR AND RE-GRADE PROPS');
  console.log('============================');

  try {
    // 1. Check current state
    console.log('\n1. CURRENT STATE CHECK:');
    const { data: currentStats } = await supabaseClient
      .from('raw_props')
      .select('edge_score, tier')
      .not('edge_score', 'is', null);

    console.log(`Props with existing scores: ${currentStats?.length || 0}`);

    // 2. Clear existing scores to force re-grading
    console.log('\n2. CLEARING EXISTING SCORES:');
    console.log('This will reset edge_score and tier to null to force fresh calculation...');

    const { data: clearResult, error: clearError } = await supabaseClient
      .from('raw_props')
      .update({
        edge_score: null,
        tier: null,
        promoted: false,
        confidence: null,
      })
      .not('edge_score', 'is', null);

    if (clearError) {
      console.error('❌ Failed to clear scores:', clearError);
      return;
    }

    console.log('✅ Scores cleared successfully');

    // 3. Verify clearing worked
    console.log('\n3. VERIFICATION:');
    const { data: verifyStats } = await supabaseClient
      .from('raw_props')
      .select('edge_score, tier')
      .not('edge_score', 'is', null);

    console.log(`Props with scores after clearing: ${verifyStats?.length || 0}`);

    // 4. Check props with valid data for grading
    console.log('\n4. GRADABLE PROPS ANALYSIS:');
    const { data: gradableProps } = await supabaseClient
      .from('raw_props')
      .select('sport, expected_value, sharp_money, line_movement, matchup_rating')
      .not('expected_value', 'is', null)
      .not('line', 'is', null)
      .limit(10);

    if (gradableProps) {
      console.log(`Props with basic required data: Found ${gradableProps.length} samples`);

      // Show sample of data quality
      gradableProps.forEach((prop, index) => {
        if (index < 3) {
          console.log(`  Sample ${index + 1}: ${prop.sport}`);
          console.log(`    Expected Value: ${prop.expected_value}`);
          console.log(`    Sharp Money: ${prop.sharp_money}`);
          console.log(`    Line Movement: ${prop.line_movement}`);
          console.log(`    Matchup Rating: ${prop.matchup_rating}`);
        }
      });
    }

    // 5. Count props by sport for re-grading
    console.log('\n5. PROPS BY SPORT FOR RE-GRADING:');
    const { data: sportCounts } = await supabaseClient
      .from('raw_props')
      .select('sport')
      .not('line', 'is', null);

    if (sportCounts) {
      const counts = sportCounts.reduce(
        (acc, prop) => {
          acc[prop.sport] = (acc[prop.sport] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      console.log('Props available for grading by sport:');
      Object.entries(counts).forEach(([sport, count]) => {
        console.log(`  ${sport}: ${count} props`);
      });
    }

    console.log('\n✅ Props cleared and ready for re-grading');
    console.log('\n🔧 NEXT STEPS:');
    console.log('  1. Run the GradingAgent: npx tsx src/runner/runGradingAgent.ts');
    console.log('  2. Check for new sophisticated scores in the database');
    console.log('  3. Verify scores show variety (not all edge_score=30)');
    console.log('  4. Test individual props with our debug scripts');
  } catch (error) {
    console.error('❌ Clear and re-grade failed:', error);
  }
}

// Run the clear and re-grade
if (require.main === module) {
  clearAndRegradeProps()
    .then(() => {
      console.log('\n📊 Clear and re-grade completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Clear and re-grade failed:', error);
      process.exit(1);
    });
}

export { clearAndRegradeProps };
