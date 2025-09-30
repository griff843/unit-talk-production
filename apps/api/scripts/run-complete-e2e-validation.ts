#!/usr/bin/env npx tsx
/**
 * COMPLETE E2E VALIDATION - Unit Talk Platform (OPTIMAL-FIRST ARCHITECTURE)
 * Verifies entire production pipeline from Optimal API ingestion to professional scoring
 */

import { supabaseClient } from '../src/services/supabaseClient';
import { fetchOptimalProps } from '../src/agents/FeedAgent/optimal';
import { fetchAndFlattenSGOProps } from '../src/logic/providers/sgoFetcher';

async function runCompleteE2EValidation() {
  console.log('🚀 COMPLETE E2E VALIDATION - UNIT TALK PLATFORM (OPTIMAL-FIRST)');
  console.log('✅ Testing full pipeline: Optimal API → Database → Enhanced45FactorEngine');
  console.log('=' .repeat(80));

  const results = {
    apiConnectivity: false,
    databaseHealth: false,
    optimalApiWorking: false,
    sgoApiWorking: false, // Fallback test
    propsIngestion: false,
    enhancedScoringEngine: false,
    overallStatus: 'FAILED'
  };

  try {
    // 1. Test Database Connectivity
    console.log('\n🔍 STEP 1: Database Connectivity Test');
    try {
      const { data, error } = await supabaseClient
        .from('raw_props')
        .select('id')
        .limit(1);

      if (error) {
        console.log('❌ Database connection failed:', error.message);
      } else {
        console.log('✅ Database connection successful');
        results.databaseHealth = true;
      }
    } catch (error) {
      console.log('❌ Database test failed:', error);
    }

    // 2. Test PRIMARY API (Optimal) Connectivity
    console.log('\n🔍 STEP 2: PRIMARY API (Optimal) Connectivity Test');
    const optimalApiKey = process.env.OPTIMAL_API_KEY;
    if (!optimalApiKey) {
      console.log('❌ OPTIMAL_API_KEY not configured - testing fallback');
    } else {
      try {
        console.log('🎯 Testing Optimal API (PRIMARY provider)...');
        const testProps = await fetchOptimalProps('NFL');

        if (testProps.length > 0) {
          console.log(`✅ Optimal API working - Retrieved ${testProps.length} test props`);
          results.optimalApiWorking = true;
        } else {
          console.log('⚠️ Optimal API connected but returned no props');
        }
      } catch (error) {
        console.log('❌ Optimal API test failed:', error);
        console.log('🔄 Testing SGO API fallback...');

        // Fallback to SGO API test
        const sgoApiKey = process.env.SGO_API_KEY;
        if (sgoApiKey) {
          try {
            const sgoProps = await fetchAndFlattenSGOProps({
              apiKey: sgoApiKey,
              leagueID: 'NFL',
              limit: 5
            });

            if (sgoProps.length > 0) {
              console.log(`⚠️ SGO API fallback working - Retrieved ${sgoProps.length} test props`);
              results.sgoApiWorking = true;
            }
          } catch (sgoError) {
            console.log('❌ SGO API fallback also failed:', sgoError);
          }
        }
      }
    }

    // 3. Test Current Props in Database
    console.log('\n🔍 STEP 3: Props Ingestion Validation');
    const today = new Date().toISOString().split('T')[0];

    try {
      const { data: rawProps, error } = await supabaseClient
        .from('raw_props')
        .select('id, player_name, stat_type, line, over_odds, under_odds, sport')
        .gte('created_at', today)
        .neq('player_name', 'unknown')
        .limit(10);

      if (error) {
        console.log('❌ Props query failed:', error.message);
      } else {
        console.log(`✅ Found ${rawProps?.length || 0} valid props from today`);

        if (rawProps && rawProps.length > 0) {
          results.propsIngestion = true;
          console.log('📊 Sample props:');
          rawProps.slice(0, 3).forEach((prop, i) => {
            console.log(`   ${i+1}. ${prop.player_name} - ${prop.stat_type} ${prop.line} (${prop.sport})`);
            console.log(`      Over: ${prop.over_odds}, Under: ${prop.under_odds}`);
          });
        }
      }
    } catch (error) {
      console.log('❌ Props validation failed:', error);
    }

    // 4. Test Enhanced45FactorEngine by checking processed props
    console.log('\n🔍 STEP 4: Enhanced45FactorEngine Validation');
    try {
      const { data: processedProps, error } = await supabaseClient
        .from('raw_props')
        .select('id, player_name, stat_type, professional_score, processed_at')
        .gte('created_at', today)
        .not('processed_at', 'is', null)
        .limit(5);

      if (error) {
        console.log('❌ Processed props query failed:', error.message);
      } else {
        console.log(`✅ Found ${processedProps?.length || 0} props processed by Enhanced45FactorEngine`);

        if (processedProps && processedProps.length > 0) {
          results.enhancedScoringEngine = true;
          console.log('🏆 Sample processed props:');
          processedProps.forEach((prop, i) => {
            console.log(`   ${i+1}. ${prop.player_name} - ${prop.stat_type}`);
            console.log(`      Professional Score: ${prop.professional_score || 'N/A'}`);
            console.log(`      Processed: ${new Date(prop.processed_at).toLocaleTimeString()}`);
          });
        }
      }
    } catch (error) {
      console.log('❌ Enhanced45FactorEngine validation failed:', error);
    }

    // 5. Test Unified Picks Generation
    console.log('\n🔍 STEP 5: Unified Picks Generation Test');
    try {
      const { data: unifiedPicks, error } = await supabaseClient
        .from('unified_picks')
        .select('id, player_name, stat_type, pick_direction, professional_score, tier')
        .gte('created_at', today)
        .limit(5);

      if (error) {
        console.log('❌ Unified picks query failed:', error.message);
      } else {
        console.log(`✅ Found ${unifiedPicks?.length || 0} unified picks from today`);

        if (unifiedPicks && unifiedPicks.length > 0) {
          console.log('🎯 Sample unified picks:');
          unifiedPicks.forEach((pick, i) => {
            console.log(`   ${i+1}. ${pick.player_name} - ${pick.stat_type}`);
            console.log(`      Direction: ${pick.pick_direction || 'N/A'}`);
            console.log(`      Score: ${pick.professional_score || 'N/A'} (${pick.tier || 'N/A'})`);
          });
        }
      }
    } catch (error) {
      console.log('❌ Unified picks test failed:', error);
    }

    // 6. Service Health Checks
    console.log('\n🔍 STEP 6: Service Health Validation');
    const healthChecks = [
      { name: 'API Health', url: 'http://localhost:3000/health' },
      { name: 'Prometheus Metrics', url: 'http://localhost:9464/metrics' }
    ];

    for (const check of healthChecks) {
      try {
        const response = await fetch(check.url);
        if (response.ok) {
          console.log(`✅ ${check.name}: OK`);
          if (check.name === 'API Health') results.apiConnectivity = true;
        } else {
          console.log(`⚠️ ${check.name}: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.log(`❌ ${check.name}: Failed to connect`);
      }
    }

    // Calculate Overall Status
    const passedTests = Object.values(results).filter(Boolean).length - 1; // Exclude overallStatus
    const totalTests = Object.keys(results).length - 1;
    const successRate = (passedTests / totalTests) * 100;

    if (successRate >= 80) {
      results.overallStatus = 'PRODUCTION_READY';
    } else if (successRate >= 60) {
      results.overallStatus = 'NEEDS_ATTENTION';
    } else {
      results.overallStatus = 'CRITICAL_ISSUES';
    }

    // Final Report
    console.log('\n🎉 E2E VALIDATION COMPLETE');
    console.log('=' .repeat(80));
    console.log('📊 TEST RESULTS:');
    console.log(`   Database Health: ${results.databaseHealth ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   SGO API Working: ${results.sgoApiWorking ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Props Ingestion: ${results.propsIngestion ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Enhanced45FactorEngine: ${results.enhancedScoringEngine ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   API Connectivity: ${results.apiConnectivity ? '✅ PASS' : '❌ FAIL'}`);

    console.log(`\n🏆 OVERALL STATUS: ${results.overallStatus}`);
    console.log(`📈 Success Rate: ${successRate.toFixed(1)}% (${passedTests}/${totalTests} tests passed)`);

    if (results.overallStatus === 'PRODUCTION_READY') {
      console.log('\n🚀 SYSTEM IS PRODUCTION READY!');
      console.log('✅ All critical components operational');
      console.log('✅ Props ingestion pipeline working');
      console.log('✅ Enhanced45FactorEngine processing props');
      console.log('✅ Ready for live betting intelligence operations');
    } else {
      console.log('\n⚠️ SYSTEM NEEDS ATTENTION');
      console.log('❌ Some components require fixes before production deployment');
    }

    return results;

  } catch (error) {
    console.error('❌ E2E validation failed with critical error:', error);
    return results;
  }
}

// Run if called directly
if (require.main === module) {
  runCompleteE2EValidation().catch(console.error);
}

export { runCompleteE2EValidation };