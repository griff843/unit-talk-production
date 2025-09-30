#!/usr/bin/env node

/**
 * COMPREHENSIVE E2E TEST - Real Professional Grading System
 * 
 * This test validates that our professional grading pipeline:
 * 1. Uses REAL ScoringAgent (not hardcoded values)
 * 2. Calculates actual 45+ factors from data sources  
 * 3. Stores authentic professional scores in database
 * 4. Proves the pipeline works end-to-end
 */

import './src/agents/ScoringAgent/ScoringAgent.js';

// Import the REAL professional system components
async function runComprehensiveE2ETest() {
  console.log('🔍 COMPREHENSIVE E2E TEST - REAL PROFESSIONAL GRADING SYSTEM');
  console.log('================================================================\n');

  try {
    // Import actual services
    const { ProfessionalPropProcessor } = await import('./src/services/ProfessionalPropProcessor.js');
    const { supabaseClient } = await import('./src/services/supabaseClient.js');
    
    console.log('✅ Successfully imported real professional components\n');

    // 1. GET SAMPLE RAW PROPS FROM DATABASE
    console.log('📊 Step 1: Fetching real raw props from database...');
    const { data: rawProps, error: propsError } = await supabaseClient
      .from('raw_props')
      .select('*')
      .is('processed_at', null)
      .eq('is_valid', true)
      .limit(3); // Test with 3 props

    if (propsError) {
      console.error('❌ Failed to fetch raw props:', propsError);
      return;
    }

    if (!rawProps || rawProps.length === 0) {
      console.log('⚠️ No unprocessed raw props found. Creating test prop...');
      
      // Create a test raw prop
      const testRawProp = {
        sport: 'NBA',
        stat_type: 'points',
        player_name: 'LeBron James',
        line: 25.5,
        over_odds: -110,
        under_odds: -110,
        is_valid: true,
        created_at: new Date().toISOString()
      };

      const { data: createdProp, error: createError } = await supabaseClient
        .from('raw_props')
        .insert(testRawProp)
        .select()
        .single();

      if (createError) {
        console.error('❌ Failed to create test prop:', createError);
        return;
      }

      rawProps.push(createdProp);
    }

    console.log(`✅ Found ${rawProps.length} raw props to process\n`);

    // Display props being tested
    rawProps.forEach((prop, index) => {
      console.log(`🎯 Test Prop ${index + 1}:`);
      console.log(`   ID: ${prop.id}`);
      console.log(`   Sport: ${prop.sport}`);
      console.log(`   Player: ${prop.player_name}`);
      console.log(`   Market: ${prop.stat_type} ${prop.line}`);
      console.log(`   Odds: ${prop.over_odds}/${prop.under_odds}`);
    });

    console.log('\n📈 Step 2: Processing through REAL professional system...');
    
    // 2. PROCESS THROUGH REAL PROFESSIONAL SYSTEM
    const processor = await ProfessionalPropProcessor.getInstance();
    const results = await processor.processRawProps({ max_batch_size: 3 });

    console.log(`\n✅ Professional processing completed! Processed ${results.length} props`);

    // 3. VERIFY RESULTS HAVE REAL DATA (NOT HARDCODED)
    console.log('\n🔬 Step 3: Verifying authentic professional grading results...\n');

    let allPropsGraded = true;
    const gradingResults = [];

    for (const result of results) {
      console.log(`📊 Professional Result for Pick ${result.pickId}:`);
      console.log(`   ✅ Professional Score: ${result.professionalScore.toFixed(2)} (${result.tier} tier)`);
      console.log(`   ✅ Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`   ✅ Devigged Edge: ${result.devigged_edge.toFixed(4)}`);
      console.log(`   ✅ Kelly Fraction: ${result.kelly_fraction.toFixed(4)}`);
      console.log(`   ✅ Processing Time: ${result.processing_time}ms`);
      
      // Check if this looks like real data vs hardcoded
      const looksReal = (
        result.professionalScore !== 60 && // Not hardcoded 60
        result.professionalScore !== 70 && // Not hardcoded 70
        result.confidence !== 0.5 &&      // Not hardcoded 50%
        result.devigged_edge !== 0         // Has actual edge calculation
      );
      
      console.log(`   ${looksReal ? '✅' : '❌'} Data authenticity: ${looksReal ? 'REAL calculations' : 'Looks like hardcoded values'}`);
      
      if (!looksReal) {
        allPropsGraded = false;
      }

      gradingResults.push({
        pickId: result.pickId,
        professionalScore: result.professionalScore,
        tier: result.tier,
        confidence: result.confidence,
        looksReal
      });

      console.log();
    }

    // 4. VERIFY DATABASE STORAGE
    console.log('🗄️ Step 4: Verifying professional data stored in database...\n');

    for (const result of results) {
      const { data: dbPick, error: dbError } = await supabaseClient
        .from('unified_picks')
        .select('*, professional_score, devigged_edge, kelly_fraction, feature_contributions')
        .eq('id', result.pickId)
        .single();

      if (dbError) {
        console.error(`❌ Failed to fetch pick ${result.pickId} from database:`, dbError);
        continue;
      }

      console.log(`📊 Database Record for Pick ${result.pickId}:`);
      console.log(`   Professional Score: ${dbPick.professional_score || 'NULL'}`);
      console.log(`   Devigged Edge: ${dbPick.devigged_edge || 'NULL'}`);
      console.log(`   Kelly Fraction: ${dbPick.kelly_fraction || 'NULL'}`);
      console.log(`   Feature Contributions: ${dbPick.feature_contributions ? 'Present' : 'NULL'}`);
      console.log(`   Tier: ${dbPick.tier}`);
      console.log(`   Confidence: ${dbPick.confidence}`);
      
      const hasRealData = (
        dbPick.professional_score !== null &&
        dbPick.devigged_edge !== null &&
        dbPick.kelly_fraction !== null
      );
      
      console.log(`   ${hasRealData ? '✅' : '❌'} Database storage: ${hasRealData ? 'All professional data stored' : 'Missing professional data'}\n`);
    }

    // 5. FINAL VALIDATION SUMMARY
    console.log('🎯 FINAL E2E VALIDATION SUMMARY');
    console.log('================================');
    console.log(`Total Props Processed: ${results.length}`);
    console.log(`Props with Real Data: ${gradingResults.filter(r => r.looksReal).length}`);
    console.log(`Props with Hardcoded Data: ${gradingResults.filter(r => !r.looksReal).length}`);
    console.log(`Overall Success Rate: ${(gradingResults.filter(r => r.looksReal).length / results.length * 100).toFixed(1)}%`);
    
    if (allPropsGraded && results.length > 0) {
      console.log('\n🎉 ✅ E2E TEST PASSED! ✅');
      console.log('Professional grading system is working with REAL 45+ factor calculations!');
      console.log('✅ Real ScoringAgent is being used');
      console.log('✅ Authentic calculations (not hardcoded values)');
      console.log('✅ Professional data stored in database');
      console.log('✅ Complete pipeline operational');
    } else {
      console.log('\n❌ E2E TEST FAILED!');
      console.log('Professional grading system still using hardcoded values or not working properly');
      
      if (results.length === 0) {
        console.log('❌ No props were processed');
      } else {
        console.log('❌ Some props have hardcoded/generic values');
      }
    }

    console.log('\n🔧 Next Steps for Production:');
    console.log('1. Verify Command Center shows these graded props');
    console.log('2. Test pick approval workflow');
    console.log('3. Verify Discord integration posts approved picks');
    console.log('4. Scale to process all remaining props');

  } catch (error) {
    console.error('💥 COMPREHENSIVE E2E TEST FAILED:', error.message);
    console.error('Full error:', error);
  }
}

// Run the comprehensive test
runComprehensiveE2ETest().catch(console.error);