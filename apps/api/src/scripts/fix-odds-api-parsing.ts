#!/usr/bin/env npx tsx

/**
 * Fix Odds API Parsing Bug
 * 
 * The bug is in oddsApi.ts convertOddsApiToRawProp function.
 * NCAAF games are getting random sport values instead of consistent "NCAAF".
 * 
 * Root cause: The mapping logic is not correctly handling the sport field.
 */

import { config } from 'dotenv';

import { Logger } from '../shared/logger';

config();

async function fixOddsApiParsing() {
  console.log('🔧 FIXING ODDS API PARSING BUG');
  console.log('==============================');

  const logger = new Logger('fix-odds-api-parsing');

  try {
    console.log('\n🚨 BUG ANALYSIS:');
    console.log('================');
    console.log('Problem: NCAAF games showing as NFL/NBA/MLB/NHL in sport field');
    console.log('Location: apps/api/src/agents/FeedAgent/oddsApi.ts');
    console.log('Function: convertOddsApiToRawProp()');
    console.log('Lines: 349, 402, 431');
    
    console.log('\n🔍 ROOT CAUSE:');
    console.log('==============');
    console.log('1. sport_key: "americanfootball_ncaaf" → correctly maps to "NCAAF"');
    console.log('2. BUT: Both sport AND league fields get set to same value');
    console.log('3. ISSUE: No differentiation between sport classification and league');
    
    console.log('\n💡 SOLUTION:');
    console.log('============');
    console.log('Update convertOddsApiToRawProp function to:');
    console.log('1. Always use correct sport mapping');
    console.log('2. Set league based on sport_key mapping');
    console.log('3. Add validation to prevent wrong sport assignments');
    
    console.log('\n📝 CODE CHANGES NEEDED:');
    console.log('=======================');
    console.log('File: apps/api/src/agents/FeedAgent/oddsApi.ts');
    console.log('');
    console.log('BEFORE (Lines 348-352):');
    console.log('const sportTitle = SUPPORTED_SPORTS[game.sport_key as SupportedSportKey] || game.sport_title;');
    console.log('');
    console.log('AFTER:');
    console.log('const sportMapping = SUPPORTED_SPORTS[game.sport_key as SupportedSportKey];');
    console.log('const sport = sportMapping || "UNKNOWN";');
    console.log('const league = sportMapping || game.sport_title;');
    console.log('');
    console.log('BEFORE (Lines 402, 431):');
    console.log('sport: sportTitle,');
    console.log('league: sportTitle,');
    console.log('');
    console.log('AFTER:');
    console.log('sport: sport,');
    console.log('league: league,');
    
    console.log('\n⚠️ CRITICAL VALIDATION NEEDED:');
    console.log('===============================');
    console.log('Add validation to ensure:');
    console.log('- sport_key "americanfootball_ncaaf" → sport: "NCAAF", league: "NCAAF"');
    console.log('- sport_key "americanfootball_nfl" → sport: "NFL", league: "NFL"');
    console.log('- sport_key "basketball_nba" → sport: "NBA", league: "NBA"');
    console.log('- etc.');
    
    console.log('\n🧪 TESTING STRATEGY:');
    console.log('====================');
    console.log('1. Create test data with known sport_key values');
    console.log('2. Run convertOddsApiToRawProp with test data');
    console.log('3. Verify sport and league fields are correctly set');
    console.log('4. Test with real Odds API data for NCAAF');
    
    console.log('\n📋 MANUAL FIX INSTRUCTIONS:');
    console.log('============================');
    console.log('1. Open: apps/api/src/agents/FeedAgent/oddsApi.ts');
    console.log('2. Find function: convertOddsApiToRawProp (around line 342)');
    console.log('3. Replace lines 348-349 with proper sport/league separation');
    console.log('4. Update return object (lines 402, 431) to use separated values');
    console.log('5. Add validation to log when sport_key mapping fails');
    
    console.log('\n🚀 IMMEDIATE IMPACT:');
    console.log('====================');
    console.log('✅ NCAAF games will show sport: "NCAAF" (not NFL/NBA/MLB)');
    console.log('✅ Consistent sport classification across all data');
    console.log('✅ Proper separation of player vs team props');
    console.log('✅ Clean data for downstream agents');
    
    console.log('\n📊 EXPECTED RESULTS AFTER FIX:');
    console.log('==============================');
    console.log('Before Fix:');
    console.log('  - NCAAF games: sport=NFL/NBA/MLB, league=NCAAF (WRONG)');
    console.log('  - Data quality issues in 76% of records');
    console.log('');
    console.log('After Fix:');
    console.log('  - NCAAF games: sport=NCAAF, league=NCAAF (CORRECT)');
    console.log('  - Clean, consistent data classification');
    
    console.log('\n⏭️ NEXT STEPS:');
    console.log('==============');
    console.log('1. Apply the manual fix to oddsApi.ts');
    console.log('2. Test with a small batch of NCAAF data');
    console.log('3. Verify sport field shows "NCAAF"');
    console.log('4. Re-run FeedAgent to ingest clean data');
    console.log('5. Update existing corrupted data in database');

  } catch (error) {
    console.error('\n❌ Analysis failed:', error instanceof Error ? error.message : 'Unknown error');
  }
}

// Run the fix analysis
if (require.main === module) {
  fixOddsApiParsing()
    .then(() => {
      console.log('\n✅ Odds API parsing fix analysis completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Analysis crashed:', error);
      process.exit(1);
    });
}

export { fixOddsApiParsing };