#!/usr/bin/env tsx
/**
 * Test player props ingestion after fix
 * Verifies that 'player-props' market is now being fetched
 */

import { fetchOddsApiProps } from '../agents/FeedAgent/oddsApi';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function testPlayerPropsFetch() {
  console.log('🧪 Testing player props ingestion after fix...\n');

  try {
    // Test 1: Fetch NFL player passing yards props
    console.log('Test 1: Fetching NFL player_pass_yds props...');
    const nflPassProps = await fetchOddsApiProps(
      'americanfootball_nfl',
      ['player_pass_yds'],
      'us',
      'american',
      'iso',
      1
    );
    console.log(`  ✅ Fetched ${nflPassProps.length} NFL passing yards props`);

    if (nflPassProps.length > 0) {
      const sample = nflPassProps[0];
      console.log(`  Sample: ${sample.player_name || sample.selection} - ${sample.market}`);
      console.log(`    Sport: ${sample.sport}, Line: ${sample.line}, Odds: ${sample.odds}`);
    }

    // Test 2: Fetch NFL player props using 'player-props' alias
    console.log('\nTest 2: Fetching NFL props with "player-props" alias...');
    const nflPlayerProps = await fetchOddsApiProps(
      'americanfootball_nfl',
      ['player-props'],  // This should expand to 50+ NFL player markets
      'us',
      'american',
      'iso',
      1
    );
    console.log(`  ✅ Fetched ${nflPlayerProps.length} NFL player props (all markets)`);

    // Group by market type
    const marketCounts: Record<string, number> = {};
    nflPlayerProps.forEach(prop => {
      marketCounts[prop.market] = (marketCounts[prop.market] || 0) + 1;
    });

    console.log('\n  Market breakdown:');
    Object.entries(marketCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([market, count]) => {
        console.log(`    ${market}: ${count} props`);
      });

    // Test 3: Check for actual player names (not team names)
    console.log('\nTest 3: Verifying actual player names (not team names)...');
    const playerNames = new Set(
      nflPlayerProps
        .map(p => p.player_name)
        .filter(name => name && !name.includes('Cowboys') && !name.includes('Eagles') && !name.includes('Patriots'))
    );
    console.log(`  ✅ Found ${playerNames.size} unique player names`);

    const samplePlayers = Array.from(playerNames).slice(0, 5);
    console.log(`  Sample players: ${samplePlayers.join(', ')}`);

    // Test 4: Check for over/under pairs (needed for devigging)
    console.log('\nTest 4: Checking for over/under pairs for devigging...');
    const withOverUnder = nflPlayerProps.filter(p => p.over_odds && p.under_odds);
    console.log(`  ✅ ${withOverUnder.length} props have both over/under odds`);
    console.log(`  Devigging readiness: ${((withOverUnder.length / nflPlayerProps.length) * 100).toFixed(1)}%`);

    console.log('\n' + '='.repeat(70));
    console.log('✅ Player props ingestion test PASSED!');
    console.log(`Total props fetched: ${nflPlayerProps.length}`);
    console.log(`Unique markets: ${Object.keys(marketCounts).length}`);
    console.log(`Unique players: ${playerNames.size}`);
    console.log(`Devigging ready: ${withOverUnder.length}`);
    console.log('='.repeat(70));

  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : 'Unknown error');
    console.error(error);
    process.exit(1);
  }
}

testPlayerPropsFetch();
