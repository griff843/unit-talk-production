/**
 * Diagnose feed writing issue
 */

import { oddsToUnifiedRows } from '../lib/transform/oddsToUnified';
import { writeUnifiedPicks } from '../lib/writer/unifiedPicksWriter';

const ODDS_API_KEY = process.env.ODDS_API_KEY!;
const sport = 'baseball_mlb';
const regions = 'us';
const markets = 'h2h,spreads,totals';

(async () => {
  console.log('Fetching from Odds API...');
  const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${ODDS_API_KEY}&regions=${regions}&markets=${markets}`;
  const res = await fetch(url);
  const events = await res.json();
  console.log(`Got ${events.length} events`);

  const rows = oddsToUnifiedRows(events.slice(0, 1));  // Just first event
  console.log(`Transformed to ${rows.length} rows`);

  // Check for duplicates
  const seen = new Set();
  const dups: any[] = [];
  for (const r of rows) {
    const key = JSON.stringify([r.game_id, r.market, r.selection, r.bookmaker_key, r.line]);
    if (seen.has(key)) {
      dups.push({ key, row: r });
    }
    seen.add(key);
  }
  console.log(`Found ${dups.length} internal duplicates`);

  if (dups.length > 0) {
    console.log('Sample duplicate:', JSON.stringify(dups[0], null, 2));
  }

  // Try writing just 3 rows
  console.log('\nTrying to write first 3 unique rows...');
  const uniqueRows = rows.slice(0, 3);
  const result = await writeUnifiedPicks(uniqueRows, 'diagnose-test');
  console.log('Write result:', JSON.stringify(result, null, 2));
})();
