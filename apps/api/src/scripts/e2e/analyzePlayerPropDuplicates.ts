#!/usr/bin/env tsx
import axios from 'axios';
import { transformGamesToUnifiedPicks } from '../../agents/FeedAgent/transform';

async function analyze() {
  const apiKey = process.env.ODDS_API_KEY;
  const eventId = 'c4b72eabb3d557e73022ec730d8e3944';
  const url = `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/events/${eventId}/odds`;

  console.log('\n═══ ANALYZING PLAYER PROP DUPLICATES ═══\n');

  const response = await axios.get(url, {
    params: {
      apiKey,
      regions: 'us',
      markets: 'h2h,spreads,totals,player_pass_yds,player_pass_tds,player_rush_yds,player_reception_yds,player_receptions,player_anytime_td',
      bookmakers: 'draftkings,fanduel',
      oddsFormat: 'american',
      dateFormat: 'iso'
    }
  });

  const picks = transformGamesToUnifiedPicks([response.data], ['draftkings', 'fanduel']);
  const playerProps = picks.filter(p => p.external_prop_id !== null);

  console.log(`Total player props: ${playerProps.length}\n`);

  // Group by idx_unified_picks_player_props_dedup constraint:
  // (external_game_id, external_prop_id)
  const byConstraint = new Map<string, any[]>();

  playerProps.forEach(prop => {
    const key = `${prop.external_game_id}|${prop.external_prop_id}`;
    if (!byConstraint.has(key)) {
      byConstraint.set(key, []);
    }
    byConstraint.get(key)!.push(prop);
  });

  const duplicates = Array.from(byConstraint.entries()).filter(([k, v]) => v.length > 1);

  if (duplicates.length > 0) {
    console.log(`❌ Found ${duplicates.length} duplicate constraint keys:\n`);
    duplicates.slice(0, 5).forEach(([key, props]) => {
      console.log(`  Key: ${key.split('|')[1]}`);
      console.log(`  Count: ${props.length}`);
      console.log(`  Markets: ${props.map(p => `${p.market} (${p.metadata.bookmaker_key})`).join(', ')}`);
      console.log(`  Selections: ${props.map(p => p.selection).join(', ')}`);
      console.log();
    });
  } else {
    console.log('✅ No duplicates in player props batch\n');
  }

  console.log('════════════════════════════════════════════════════════\n');
}

analyze().catch(console.error);
