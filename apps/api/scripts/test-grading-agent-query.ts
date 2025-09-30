#!/usr/bin/env tsx

/**
 * Test Grading Agent Query
 * Tests the exact query that was failing in the grading agent
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testScoringAgentQuery() {
  try {
    console.log('🧪 Testing Scoring Agent Database Query');
    console.log('=====================================');

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('🔍 Testing the exact grading agent query...');

    // Test the exact query that was failing in ScoringAgent.ts:293-294
    const { data, error } = await supabase
      .from('raw_props')
      .select('*')
      .is('outcome', null)
      .is('promoted_to_picks', null)
      .limit(5);

    if (error) {
      console.error('❌ Grading agent query FAILED:', error);
      console.log('\n💡 This indicates the migration is still needed.');
      console.log('📋 Required columns missing:');
      if (error.message.includes('outcome')) {
        console.log('   - outcome column');
      }
      if (error.message.includes('promoted_to_picks')) {
        console.log('   - promoted_to_picks column');
      }
      return false;
    }

    console.log(`✅ Grading agent query SUCCESSFUL! Found ${data.length} unprocessed props`);

    // Test enhanced scoring columns
    console.log('\n🔍 Testing enhanced scoring columns...');
    
    const { data: scoringData, error: scoringError } = await supabase
      .from('raw_props')
      .select('trend_confidence, edge_score, matchup_quality, expected_value, sharp_money')
      .limit(1);

    if (scoringError) {
      console.error('❌ Enhanced scoring columns MISSING:', scoringError);
      console.log('\n💡 Enhanced scoring migration needed.');
      return false;
    }

    console.log('✅ Enhanced scoring columns exist!');

    // Check for new tables
    console.log('\n🔍 Testing new tables...');
    
    const tables = ['grading_results', 'capper_profiles', 'ml_features', 'settlement_tracking'];
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
          
        if (error) {
          console.error(`❌ Table ${table} MISSING:`, error.message);
          return false;
        } else {
          console.log(`✅ Table ${table} exists`);
        }
      } catch (err) {
        console.error(`❌ Table ${table} MISSING:`, err);
        return false;
      }
    }

    // Test grading results insertion
    console.log('\n🔍 Testing grading results insertion...');
    
    if (data.length > 0) {
      const testResult = {
        prop_id: data[0].id,
        final_score: 75.5,
        confidence: 0.85,
        tier: 'A' as const,
        edge_score: 12.3,
        model_version: 'test-validation',
        config_used: 'test'
      };

      const { data: insertData, error: insertError } = await supabase
        .from('grading_results')
        .insert(testResult)
        .select()
        .single();

      if (insertError) {
        console.error('❌ Grading results insert FAILED:', insertError);
        return false;
      } else {
        console.log('✅ Grading results insert successful!');
        
        // Clean up test record
        await supabase
          .from('grading_results')
          .delete()
          .eq('id', insertData.id);
          
        console.log('✅ Test record cleaned up');
      }
    }

    // Final report
    console.log('\n📊 Migration Status Report:');
    
    const { count: rawPropsCount } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true });

    const { count: ungradedCount } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .is('outcome', null)
      .is('promoted_to_picks', false);

    const { count: finalPicksCount } = await supabase
      .from('unified_picks')
      .select('*', { count: 'exact', head: true });

    const { count: gradingResultsCount } = await supabase
      .from('grading_results')
      .select('*', { count: 'exact', head: true });

    console.log(`📈 Raw Props: ${rawPropsCount || 0} total, ${ungradedCount || 0} ungraded`);
    console.log(`📈 Final Picks: ${finalPicksCount || 0}`);
    console.log(`📈 Grading Results: ${gradingResultsCount || 0}`);

    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('✅ Database schema is properly aligned');
    console.log('✅ Grading agent should work correctly');
    
    return true;

  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Execute the test
testScoringAgentQuery().then(success => {
  if (success) {
    console.log('\n🚀 Ready to restart grading agent!');
    process.exit(0);
  } else {
    console.log('\n🔧 Migration still required.');
    process.exit(1);
  }
}).catch(console.error);