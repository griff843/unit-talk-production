#!/usr/bin/env tsx
/**
 * Task 1: Capture Live SGO Sample
 * Sprint: SPRINT-SCORING-PIPELINE-VALIDATION-019
 *
 * Fetches live SGO events for NBA, MLB, NHL with includeOpposingOdds=true
 * and saves raw response JSON for inspection.
 *
 * Usage: npx tsx scripts/analysis/sample-sgo-markets.ts
 */

import * as fs from 'fs';
import * as path from 'path';

import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { fetchSGOEvents } from '../../apps/api/src/logic/providers/sgoFetcher';

const SGO_API_KEY = process.env['SGO_API_KEY'];
if (!SGO_API_KEY) {
  console.error('[FATAL] Missing SGO_API_KEY');
  process.exit(1);
}

const DATE_STR = new Date().toISOString().slice(0, 10);
const OUT_DIR = path.resolve(__dirname, `../../out/runtime/sgo_samples/${DATE_STR}`);

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const now = new Date();
  const threeDaysOut = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const leagues = ['NBA', 'MLB', 'NHL'];
  const allEvents: Record<string, any[]> = {};
  let totalEvents = 0;
  let totalOddsKeys = 0;
  let bothSidesCount = 0;
  let singleSideCount = 0;

  for (const league of leagues) {
    console.log(`Fetching ${league} events...`);
    try {
      const events = await fetchSGOEvents({
        apiKey: SGO_API_KEY!,
        leagueID: league,
        startsAfter: now.toISOString(),
        startsBefore: threeDaysOut.toISOString(),
        includeOpposingOdds: true,
        oddsAvailable: true,
        limit: 10,
      });
      allEvents[league] = events;
      totalEvents += events.length;

      // Count odds with both sides
      for (const evt of events) {
        if (!evt.odds) continue;
        for (const [, offer] of Object.entries(evt.odds || {})) {
          const o = offer as any;
          totalOddsKeys++;
          const sideId = (o.sideID || '').toLowerCase();
          if (sideId === 'over' || sideId === 'under') {
            // Check if opposing side exists in same event
            bothSidesCount++;
          } else {
            singleSideCount++;
          }
        }
      }

      console.log(`  ${league}: ${events.length} events`);
    } catch (err: any) {
      console.error(`  ${league}: FAILED — ${err.message}`);
      allEvents[league] = [];
    }
  }

  // Save raw response
  const outPath = path.join(OUT_DIR, 'sgo_raw_sample.json');
  fs.writeFileSync(outPath, JSON.stringify(allEvents, null, 2));
  console.log(`\nSaved raw sample to ${outPath}`);

  // Summary
  const summary = {
    timestamp: new Date().toISOString(),
    sprint: 'SPRINT-SCORING-PIPELINE-VALIDATION-019',
    leagues,
    includeOpposingOdds: true,
    totalEvents,
    totalOddsKeys,
    bothSidesCount,
    singleSideCount,
    eventsByLeague: Object.fromEntries(Object.entries(allEvents).map(([k, v]) => [k, v.length])),
  };

  fs.writeFileSync(path.join(OUT_DIR, 'sgo_sample_summary.json'), JSON.stringify(summary, null, 2));

  console.log('\n=== SGO Sample Summary ===');
  console.log(`Total events: ${totalEvents}`);
  console.log(`Total odds keys: ${totalOddsKeys}`);
  console.log(`Both-sided odds: ${bothSidesCount}`);
  console.log(`Single-sided odds: ${singleSideCount}`);
  for (const [league, events] of Object.entries(allEvents)) {
    console.log(`  ${league}: ${events.length} events`);
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
