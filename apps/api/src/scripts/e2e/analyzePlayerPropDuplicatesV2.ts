#!/usr/bin/env tsx
import axios from 'axios';
import { transformGamesToUnifiedPicks } from '../../agents/FeedAgent/transform';

async function analyze() {
  const apiKey = process.env.ODDS_API_KEY;
  const eventId = 'c4b72eabb3d557e73022ec730d8e3944';
  const url = `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/events/${eventId}/odds`;

  console.log('\n═══ ANALYZING PLAYER PROP DUPLICATES (WITH BOOKMAKER) ═══\n');

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

  // Group by UPDATED constraint: (external_game_id, external_prop_id, bookmaker_key)
  const byConstraint = new Map<string, any[]>();

  playerProps.forEach(prop => {
    const key = `${prop.external_game_id}|${prop.external_prop_id}|${prop.metadata.bookmaker_key}`;
    if (!byConstraint.has(key)) {
      byConstraint.set(key, []);
    }
    byConstraint.get(key)!.push(prop);
  });

  const duplicates = Array.from(byConstraint.entries()).filter(([k, v]) => v.length > 1);

  if (duplicates.length > 0) {
    console.log(`❌ Found ${duplicates.length} duplicate constraint keys:\n`);
    duplicates.slice(0, 10).forEach(([key, props]) => {
      const [gameId, propId, bookmaker] = key.split('|');
      console.log(`  Bookmaker: ${bookmaker}`);
      console.log(`  Prop ID: ${propId}`);
      console.log(`  Count: ${props.length}`);
      console.log(`  Markets: ${[...new Set(props.map(p => p.market))].join(', ')}`);
      console.log(`  Selections: ${props.map(p => `${p.selection} (${p.metadata.outcome || 'N/A'})`).join(', ')}`);
      console.log(`  Lines: ${props.map(p => p.line).join(', ')}`);
      console.log(`  Odds: ${props.map(p => p.odds).join(', ')}`);
      console.log();
    });

    // Show raw API data for one duplicate
    console.log('Sample raw API outcome:');
    const sampleKey = duplicates[0][0];
    const [gameId, propId, bookmaker] = sampleKey.split('|');
    const market = propId.split('_')[1] + '_' + propId.split('_')[2];

    response.data.bookmakers?.forEach((book: any) => {
      if (book.key === bookmaker) {
        book.markets?.forEach((m: any) => {
          if (m.key === market) {
            console.log(`Market: ${m.key}`);
            console.log(`Outcomes:`, JSON.stringify(m.outcomes.slice(0, 3), null, 2));
          }
        });
      }
    });
  } else {
    console.log('✅ No duplicates in player props batch\n');
  }

  console.log('════════════════════════════════════════════════════════\n');
}

analyze().catch(console.error);
