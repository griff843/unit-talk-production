/**
 * SGO Historical Events Probe
 * Sprint: SPRINT-027A-SGO-HISTORICAL-BACKFILL
 *
 * Calls SGO /v2/events with finalized=true + includeOpenCloseOdds=true
 * to discover the exact response shape for historical events.
 *
 * This script MUST run before the backfill script to understand:
 * 1. Which fields exist per odds entry (bookOdds, openBookOdds, closeOdds, etc.)
 * 2. Whether per-bookmaker data is available (byBookmaker, bookmakerID filter)
 * 3. How open/close odds are structured
 * 4. What statID values SGO uses for player props
 *
 * Usage:
 *   npx tsx scripts/analysis/probe-sgo-historical-027.ts
 *
 * Output:
 *   out/runtime/sgo_probe_<date>.json   — raw API response
 *   out/runtime/sgo_probe_<date>_analysis.json — field analysis
 */

import * as fs from 'fs';
import * as path from 'path';

import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Import SGO client after dotenv
import { getSGOClient } from '../../apps/api/src/services/sgo/client';

const dateStr = new Date().toISOString().slice(0, 10);
const OUT_DIR = path.resolve(__dirname, '../../out/runtime');

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const client = getSGOClient();

  // Probe 1: Finalized NBA events with open/close odds (last 3 days)
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  console.log('=== SGO Historical Events Probe ===');
  console.log(`Date range: ${threeDaysAgo.toISOString()} → ${now.toISOString()}`);
  console.log();

  // Probe 1A: Without bookmakerID filter
  console.log('--- Probe 1A: finalized=true, includeOpenCloseOdds=true (no bookmaker filter) ---');
  try {
    const resp1 = await client.fetchEvents({
      leagueID: 'NBA',
      startsAfter: threeDaysAgo.toISOString(),
      startsBefore: now.toISOString(),
      finalized: true,
      includeOpenCloseOdds: true,
      includeOpposingOdds: true,
      expandResults: true,
      limit: 3,
    });

    fs.writeFileSync(
      path.join(OUT_DIR, `sgo_probe_${dateStr}_no_filter.json`),
      JSON.stringify(resp1, null, 2)
    );

    console.log(`Events returned: ${resp1.data.length}`);
    analyzeEvents(resp1.data, 'no_bookmaker_filter');
  } catch (err) {
    console.error('Probe 1A failed:', (err as Error).message);
  }

  // Probe 1B: With bookmakerID filter (fanduel)
  console.log();
  console.log('--- Probe 1B: finalized=true, includeOpenCloseOdds=true, bookmakerID=fanduel ---');
  try {
    const resp2 = await client.fetchEvents({
      leagueID: 'NBA',
      startsAfter: threeDaysAgo.toISOString(),
      startsBefore: now.toISOString(),
      finalized: true,
      includeOpenCloseOdds: true,
      includeOpposingOdds: true,
      expandResults: true,
      bookmakerID: 'fanduel',
      limit: 3,
    });

    fs.writeFileSync(
      path.join(OUT_DIR, `sgo_probe_${dateStr}_fanduel.json`),
      JSON.stringify(resp2, null, 2)
    );

    console.log(`Events returned: ${resp2.data.length}`);
    analyzeEvents(resp2.data, 'bookmakerID=fanduel');
  } catch (err) {
    console.error('Probe 1B failed:', (err as Error).message);
  }

  // Probe 1C: With multiple bookmakers
  console.log();
  console.log('--- Probe 1C: bookmakerID=fanduel,draftkings,pinnacle ---');
  try {
    const resp3 = await client.fetchEvents({
      leagueID: 'NBA',
      startsAfter: threeDaysAgo.toISOString(),
      startsBefore: now.toISOString(),
      finalized: true,
      includeOpenCloseOdds: true,
      includeOpposingOdds: true,
      expandResults: true,
      bookmakerID: 'fanduel,draftkings,pinnacle',
      limit: 3,
    });

    fs.writeFileSync(
      path.join(OUT_DIR, `sgo_probe_${dateStr}_multi_book.json`),
      JSON.stringify(resp3, null, 2)
    );

    console.log(`Events returned: ${resp3.data.length}`);
    analyzeEvents(resp3.data, 'bookmakerID=fanduel,draftkings,pinnacle');
  } catch (err) {
    console.error('Probe 1C failed:', (err as Error).message);
  }

  // Probe 2: Wider date range to check volume
  console.log();
  console.log('--- Probe 2: Volume check (last 14 days, limit=50) ---');
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  try {
    const resp4 = await client.fetchEvents({
      leagueID: 'NBA',
      startsAfter: fourteenDaysAgo.toISOString(),
      startsBefore: now.toISOString(),
      finalized: true,
      limit: 50,
    });

    console.log(`Events in 14-day window: ${resp4.data.length}`);
    console.log(`Has nextCursor: ${!!resp4.nextCursor}`);

    if (resp4.data.length > 0) {
      const eventDates = resp4.data.map(e => (e.startsAt ?? e.status?.startsAt ?? '').slice(0, 10));
      const uniqueDates = [...new Set(eventDates)].sort();
      console.log(`Unique dates: ${uniqueDates.length} → ${uniqueDates.join(', ')}`);
    }
  } catch (err) {
    console.error('Probe 2 failed:', (err as Error).message);
  }

  console.log();
  console.log(
    `=== Probe complete. Raw responses saved to ${OUT_DIR}/sgo_probe_${dateStr}_*.json ===`
  );
}

function analyzeEvents(events: any[], label: string): void {
  if (events.length === 0) {
    console.log(`  [${label}] No events to analyze`);
    return;
  }

  const analysis: Record<string, unknown> = {
    label,
    eventCount: events.length,
    topLevelKeys: new Set<string>(),
    oddsFieldFrequency: {} as Record<string, number>,
    statIDValues: new Set<string>(),
    sideIDValues: new Set<string>(),
    sampleOddsKeys: [] as string[],
    hasOpenBookOdds: false,
    hasCloseOdds: false,
    hasOpenOdds: false,
    hasResults: false,
    hasBookOdds: false,
    hasFairOdds: false,
    hasOpenFairOdds: false,
    playerCount: 0,
    oddsEntryCount: 0,
  };

  for (const evt of events) {
    // Top-level keys
    for (const key of Object.keys(evt)) {
      (analysis.topLevelKeys as Set<string>).add(key);
    }

    // Players
    if (evt.players) {
      analysis.playerCount = (analysis.playerCount as number) + Object.keys(evt.players).length;
    }

    // Odds analysis
    if (evt.odds && typeof evt.odds === 'object') {
      const oddsEntries = Object.entries(evt.odds);
      analysis.oddsEntryCount = (analysis.oddsEntryCount as number) + oddsEntries.length;

      // Sample first 3 odds keys
      if ((analysis.sampleOddsKeys as string[]).length < 5) {
        (analysis.sampleOddsKeys as string[]).push(...oddsEntries.slice(0, 5).map(([k]) => k));
      }

      for (const [, oddsRaw] of oddsEntries) {
        const odds = oddsRaw as Record<string, unknown>;

        // Track all fields present
        for (const field of Object.keys(odds)) {
          const freq = analysis.oddsFieldFrequency as Record<string, number>;
          freq[field] = (freq[field] || 0) + 1;
        }

        // Specific field checks
        if (odds.statID) (analysis.statIDValues as Set<string>).add(String(odds.statID));
        if (odds.sideID) (analysis.sideIDValues as Set<string>).add(String(odds.sideID));
        if (odds.openBookOdds != null) analysis.hasOpenBookOdds = true;
        if (odds.closeOdds != null) analysis.hasCloseOdds = true;
        if (odds.openOdds != null) analysis.hasOpenOdds = true;
        if (odds.results != null) analysis.hasResults = true;
        if (odds.bookOdds != null) analysis.hasBookOdds = true;
        if (odds.fairOdds != null) analysis.hasFairOdds = true;
        if (odds.openFairOdds != null) analysis.hasOpenFairOdds = true;
      }
    }
  }

  // Convert Sets to arrays for output
  const output = {
    ...analysis,
    topLevelKeys: [...(analysis.topLevelKeys as Set<string>)],
    statIDValues: [...(analysis.statIDValues as Set<string>)],
    sideIDValues: [...(analysis.sideIDValues as Set<string>)],
  };

  console.log(`  Top-level keys: ${output.topLevelKeys.join(', ')}`);
  console.log(`  Odds entries: ${output.oddsEntryCount}`);
  console.log(`  Players: ${output.playerCount}`);
  console.log(`  StatID values: ${output.statIDValues.join(', ') || '(none)'}`);
  console.log(`  SideID values: ${output.sideIDValues.join(', ') || '(none)'}`);
  console.log(`  Has bookOdds: ${output.hasBookOdds}`);
  console.log(`  Has openBookOdds: ${output.hasOpenBookOdds}`);
  console.log(`  Has closeOdds: ${output.hasCloseOdds}`);
  console.log(`  Has openOdds: ${output.hasOpenOdds}`);
  console.log(`  Has fairOdds: ${output.hasFairOdds}`);
  console.log(`  Has openFairOdds: ${output.hasOpenFairOdds}`);
  console.log(`  Has results: ${output.hasResults}`);
  console.log(`  Sample odds keys: ${(output.sampleOddsKeys as string[]).slice(0, 5).join(', ')}`);
  console.log(`  Odds field frequency:`, output.oddsFieldFrequency);

  // Save analysis
  fs.writeFileSync(
    path.join(OUT_DIR, `sgo_probe_${dateStr}_analysis_${label.replace(/[^a-z0-9]/gi, '_')}.json`),
    JSON.stringify(output, null, 2)
  );
}

main().catch(err => {
  console.error('Probe failed:', err);
  process.exit(1);
});
