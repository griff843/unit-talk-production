#!/usr/bin/env tsx
import { transformOddsApiToUnified } from '../../agents/FeedAgent/transform.js';
import axios from 'axios';

async function check() {
  const apiKey = process.env.ODDS_API_KEY;
  const eventId = 'c4b72eabb3d557e73022ec730d8e3944';
  const url = `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/events/${eventId}/odds`;

  const response = await axios.get(url, {
    params: {
      apiKey,
      regions: 'us',
      markets: 'h2h,spreads,totals',
      bookmakers: 'draftkings,fanduel',
      oddsFormat: 'american',
      dateFormat: 'iso'
    }
  });

  const picks = transformOddsApiToUnified([response.data]);

  console.log(`\n═══ CHECKING FOR DUPLICATES IN TRANSFORM OUTPUT ═══\n`);
  console.log(`Total picks: ${picks.length}`);

  // Group by idx_unified_picks_final_unique constraint key
  const byConstraint = new Map<string, any[]>();
  picks.forEach(pick => {
    const key = [
      pick.external_game_id,
      pick.external_prop_id || '',
      pick.market,
      pick.selection || '',
      pick.odds || 0,
      pick.metadata.bookmaker_key || 'unknown'
    ].join('|');

    if (!byConstraint.has(key)) {
      byConstraint.set(key, []);
    }
    byConstraint.get(key)!.push(pick);
  });

  const duplicates = Array.from(byConstraint.entries()).filter(([k, v]) => v.length > 1);

  console.log(`\nDuplicates found: ${duplicates.length}`);

  if (duplicates.length > 0) {
    console.log('\n❌ DUPLICATES DETECTED IN BATCH:');
    duplicates.forEach(([key, picks]) => {
      console.log(`\n  Constraint key: ${key}`);
      console.log(`  Count: ${picks.length}`);
      console.log(`  Sample pick:`, JSON.stringify(picks[0], null, 2).split('\n').slice(0, 10).join('\n'));
    });
  } else {
    console.log('\n✅ No duplicates - transform is clean');
  }

  console.log('\n════════════════════════════════════════════════════════\n');
}

check().catch(console.error);
