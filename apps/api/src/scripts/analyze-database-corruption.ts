#!/usr/bin/env npx tsx
// @ts-nocheck

/**
 * Comprehensive Database Corruption Analysis
 *
 * Analyzes the current state of raw_props table and identifies:
 * 1. Sport classification mismatches
 * 2. API usage optimization opportunities
 * 3. Data cleanup requirements
 */

import { config } from 'dotenv';

import { getCreditUsageStatus } from '../agents/FeedAgent/oddsApi';
import { supabaseClient } from '../services/supabaseClient';
import { Logger } from '../shared/logger';

config();

async function analyzeDatabaseCorruption() {
  console.log('🔍 COMPREHENSIVE DATABASE CORRUPTION ANALYSIS');
  console.log('=============================================');

  const logger = new Logger('analyze-database-corruption');

  try {
    console.log('\n📊 PHASE 1: API USAGE ANALYSIS');
    console.log('===============================');

    // Check Odds API usage
    const oddsApiStatus = getCreditUsageStatus();
    console.log('📈 Odds API Status:');
    console.log(
      `  Monthly Used: ${oddsApiStatus.monthlyUsed}/${oddsApiStatus.monthlyLimit} (${oddsApiStatus.percentUsed}%)`
    );
    console.log(`  Remaining: ${oddsApiStatus.monthlyLimit - oddsApiStatus.monthlyUsed} credits`);
    console.log(`  Daily Budget: ${oddsApiStatus.dailyBudget} credits/day`);
    console.log(`  Days Remaining: ${oddsApiStatus.daysRemaining}`);

    console.log('\n🗄️ PHASE 2: DATABASE CORRUPTION ANALYSIS');
    console.log('=========================================');

    // Get total props count
    const { count: totalProps, error: totalError } = await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      throw new Error(`Failed to count total props: ${totalError.message}`);
    }

    console.log(`📊 Total props in database: ${totalProps?.toLocaleString()}`);

    // Analyze sport classification issues
    console.log('\n🔍 Sport Classification Analysis:');
    console.log('=================================');

    // Check NCAAF props with wrong sport classification
    const { data: ncaafCorrupted, error: ncaafError } = await supabaseClient
      .from('raw_props')
      .select('sport, league, sport_key, player_name, created_at, provider, source')
      .eq('sport_key', 'americanfootball_ncaaf')
      .neq('sport', 'NCAAF')
      .order('created_at', { ascending: false })
      .limit(10);

    if (ncaafError) {
      console.log(`⚠️ Error querying NCAAF corrupted data: ${ncaafError.message}`);
    } else {
      console.log(
        `\n❌ NCAAF props with wrong sport classification: ${ncaafCorrupted?.length || 0} (showing first 10)`
      );

      if (ncaafCorrupted && ncaafCorrupted.length > 0) {
        for (const prop of ncaafCorrupted) {
          console.log(`  📋 ${prop.player_name}`);
          console.log(`    sport: "${prop.sport}" (should be "NCAAF")`);
          console.log(`    league: "${prop.league}"`);
          console.log(`    provider: "${prop.provider}" | source: "${prop.source}"`);
          console.log(`    created: ${prop.created_at?.split('T')[0]}`);
        }
      }
    }

    // Get count of all corrupted NCAAF props
    const { count: ncaafCorruptedCount, error: ncaafCountError } = await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .eq('sport_key', 'americanfootball_ncaaf')
      .neq('sport', 'NCAAF');

    if (!ncaafCountError) {
      console.log(
        `\n📊 Total NCAAF props with wrong sport: ${ncaafCorruptedCount?.toLocaleString()}`
      );
    }

    // Check what sports are being incorrectly used for NCAAF
    const { data: sportMismatches, error: mismatchError } = await supabaseClient
      .from('raw_props')
      .select('sport, count(*)')
      .eq('sport_key', 'americanfootball_ncaaf')
      .neq('sport', 'NCAAF')
      .limit(50);

    if (!mismatchError && sportMismatches) {
      console.log('\n🔍 Incorrect sports used for NCAAF props:');
      for (const mismatch of sportMismatches) {
        console.log(`  "${mismatch.sport}": ${mismatch.count} props`);
      }
    }

    console.log('\n🏈 PHASE 3: DATA SOURCE ANALYSIS');
    console.log('=================================');

    // Analyze by data source
    const { data: sourceAnalysis, error: sourceError } =
      await supabaseClient.rpc('analyze_props_by_source');

    if (sourceError) {
      // Manual analysis if RPC doesn't exist
      const { data: providers, error: providerError } = await supabaseClient
        .from('raw_props')
        .select('provider, source, sport, count(*)')
        .limit(100);

      if (!providerError && providers) {
        console.log('\n📊 Data by Provider/Source:');
        const providerMap = new Map();

        for (const item of providers) {
          const key = `${item.provider || 'Unknown'} (${item.source || 'Unknown'})`;
          const count = parseInt(item.count) || 1;
          providerMap.set(key, (providerMap.get(key) || 0) + count);
        }

        for (const [provider, count] of providerMap.entries()) {
          console.log(`  ${provider}: ${count.toLocaleString()} props`);
        }
      }
    }

    console.log('\n⚖️ PHASE 4: API OPTIMIZATION ANALYSIS');
    console.log('=====================================');

    // Check what sports we're getting from which APIs
    const { data: sportsBySource, error: sportsError } = await supabaseClient
      .from('raw_props')
      .select('sport, source, count(*)')
      .in('sport', ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF'])
      .order('sport')
      .limit(50);

    if (!sportsError && sportsBySource) {
      console.log('\n📊 Sports by API Source:');

      const apiUsage = {
        'odds-api': new Map(),
        optimal: new Map(),
        other: new Map(),
      };

      for (const item of sportsBySource) {
        const source = item.source || 'other';
        const apiKey = source.includes('odds')
          ? 'odds-api'
          : source.includes('optimal')
            ? 'optimal'
            : 'other';

        const count = parseInt(item.count) || 1;
        apiUsage[apiKey].set(item.sport, (apiUsage[apiKey].get(item.sport) || 0) + count);
      }

      for (const [api, sports] of Object.entries(apiUsage)) {
        if (sports.size > 0) {
          console.log(`\n  ${api.toUpperCase()}:`);
          for (const [sport, count] of sports.entries()) {
            console.log(`    ${sport}: ${count.toLocaleString()} props`);
          }
        }
      }
    }

    console.log('\n💡 PHASE 5: OPTIMIZATION RECOMMENDATIONS');
    console.log('========================================');

    console.log('\n🎯 API Strategy Recommendations:');
    console.log('================================');
    console.log('✅ OPTIMAL API (Primary for major sports):');
    console.log('   - NFL: Best player props, comprehensive coverage');
    console.log('   - NBA: Best player props, comprehensive coverage');
    console.log('   - MLB: Best player props, comprehensive coverage');
    console.log('   - NHL: Best player props, comprehensive coverage');

    console.log('\n✅ ODDS API (Exclusive coverage):');
    console.log('   - NCAAF: ONLY source for college football');
    console.log('   - NCAAB: College basketball coverage');
    console.log('   - Settlement data: ONLY source for game results');

    console.log('\n🔧 Data Cleanup Recommendations:');
    console.log('=================================');

    if (ncaafCorruptedCount && ncaafCorruptedCount > 0) {
      console.log(`❌ Fix ${ncaafCorruptedCount.toLocaleString()} corrupted NCAAF props:`);
      console.log('   - Update sport="NCAAF" where sport_key="americanfootball_ncaaf"');
      console.log('   - Update league="NCAAF" where sport_key="americanfootball_ncaaf"');
    }

    console.log('\n⚡ Performance Improvements:');
    console.log('============================');
    console.log('1. Use Optimal API for NFL/NBA/MLB/NHL (better player props)');
    console.log('2. Use Odds API only for NCAAF and settlement data');
    console.log('3. Clean up corrupted sport classifications');
    console.log('4. Implement proper data validation before insertion');

    console.log('\n📊 CURRENT API USAGE SUMMARY:');
    console.log('==============================');
    console.log('Odds API:');
    console.log(
      `  - Credits remaining: ${oddsApiStatus.monthlyLimit - oddsApiStatus.monthlyUsed}/500`
    );
    console.log(`  - Should be used for: NCAAF, NCAAB, Settlement data`);
    console.log(`  - Current usage seems too low (may not be tracking correctly)`);

    console.log('\nOptimal API:');
    console.log('  - Should be primary for: NFL, NBA, MLB, NHL');
    console.log('  - Need to test current usage and limits');
  } catch (error) {
    console.error(
      '\n❌ Analysis failed:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    throw error;
  }
}

// Run the analysis
if (require.main === module) {
  analyzeDatabaseCorruption()
    .then(() => {
      console.log('\n✅ Database corruption analysis completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Analysis crashed:', error);
      process.exit(1);
    });
}

export { analyzeDatabaseCorruption };
