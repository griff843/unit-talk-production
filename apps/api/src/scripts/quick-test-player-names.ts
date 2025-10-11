#!/usr/bin/env tsx
/**
 * Quick test - verify player name extraction is working
 */

import { fetchOddsApiProps } from '../agents/FeedAgent/oddsApi';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function quickTest() {
  console.log('🧪 Quick test: Player name extraction\n');

  try {
    // Fetch just passing yards props (should be fast - only ~30 props per game)
    const props = await fetchOddsApiProps(
      'americanfootball_nfl',
      ['player_pass_yds'],
      'us',
      'american',
      'iso',
      1
    );

    console.log(`✅ Fetched ${props.length} player props\n`);

    // Check first 10 props
    console.log('First 10 player names:');
    props.slice(0, 10).forEach((prop, i) => {
      console.log(`  ${i + 1}. ${prop.player_name} (${prop.market})`);
      console.log(`     Selection: ${prop.selection}, Line: ${prop.line}, Odds: ${prop.over_odds || prop.under_odds}`);
    });

    // Count unique players
    const uniquePlayers = new Set(props.map(p => p.player_name));
    console.log(`\n✅ Found ${uniquePlayers.size} unique player names`);

    // Check for devigging readiness
    const withBothOdds = props.filter(p => p.over_odds && p.under_odds);
    console.log(`⚠️  Props with both over/under: ${withBothOdds.length} (${((withBothOdds.length / props.length) * 100).toFixed(1)}%)`);

    // Sample some player names
    const samplePlayers = Array.from(uniquePlayers).slice(0, 20);
    console.log(`\nSample player names:\n${samplePlayers.join(', ')}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

quickTest();
