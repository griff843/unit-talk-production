#!/usr/bin/env tsx
/**
 * Closing Snapshot Capture Runner
 * Sprint: SPRINT-025-CLV-CLOSING-SNAPSHOT
 *
 * Runs ClosingSnapshotService to capture closing consensus from provider_offers.
 *
 * Usage:
 *   npx tsx scripts/analysis/capture-closing-snapshots-025.ts
 *
 * Environment:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (from .env)
 *   LOOKBACK_HOURS (optional, default: 24)
 *   CLOSE_WINDOW_MINUTES (optional, default: 30)
 *   MAX_EVENTS (optional, default: 200)
 */

/* eslint-disable no-console */

import * as fs from 'fs';
import * as path from 'path';

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { ClosingSnapshotService } from '../../apps/api/src/services/ClosingSnapshotService';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env['SUPABASE_URL'];
const SUPABASE_KEY =
  process.env['SUPABASE_SERVICE_ROLE_KEY'] || process.env['SUPABASE_SERVICE_KEY'];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[FATAL] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const LOOKBACK_HOURS = parseInt(process.env['LOOKBACK_HOURS'] || '24', 10);
const CLOSE_WINDOW_MINUTES = parseInt(process.env['CLOSE_WINDOW_MINUTES'] || '30', 10);
const MAX_EVENTS = parseInt(process.env['MAX_EVENTS'] || '200', 10);

const SPRINT_ID = 'SPRINT-025-CLV-CLOSING-SNAPSHOT';
const DATE_STR = new Date().toISOString().slice(0, 10);
const OUT_DIR = path.resolve(__dirname, `../../out/sprints/${SPRINT_ID}/${DATE_STR}`);

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`\n=== Closing Snapshot Capture — ${SPRINT_ID} ===`);
  console.log(
    `Lookback: ${LOOKBACK_HOURS}h | Close window: ${CLOSE_WINDOW_MINUTES}min | Max events: ${MAX_EVENTS}`
  );

  const service = new ClosingSnapshotService(supabase);

  const result = await service.captureClosingSnapshots({
    lookbackHours: LOOKBACK_HOURS,
    closeWindowMinutes: CLOSE_WINDOW_MINUTES,
    maxEvents: MAX_EVENTS,
  });

  console.log(`\n--- Closing Snapshot Results ---`);
  console.log(`Total events:               ${result.total_events}`);
  console.log(`Eligible markets:           ${result.eligible_markets}`);
  console.log(`Captured:                   ${result.captured}`);
  console.log(`Failed:                     ${result.failed}`);
  console.log(`Skipped (< 3 books):        ${result.skipped_insufficient_books}`);

  if (result.results.length > 0) {
    console.log(`\n--- Sample Snapshots (first 10) ---`);
    for (const r of result.results.slice(0, 10)) {
      console.log(
        `  ${r.market_key.slice(0, 50).padEnd(50)} ` +
          `books=${r.book_count} ` +
          `p_over=${r.p_close_over.toFixed(4)} ` +
          `p_under=${r.p_close_under.toFixed(4)}`
      );
    }
  }

  // Write artifacts
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, 'CLOSING_SNAPSHOTS_SAMPLE.json'),
    JSON.stringify(
      {
        sprint: SPRINT_ID,
        timestamp: new Date().toISOString(),
        summary: {
          total_events: result.total_events,
          eligible_markets: result.eligible_markets,
          captured: result.captured,
          failed: result.failed,
          skipped_insufficient_books: result.skipped_insufficient_books,
        },
        snapshots: result.results.slice(0, 50),
        errors: result.errors,
      },
      null,
      2
    )
  );

  console.log(`\nArtifacts written to: ${OUT_DIR}/`);

  const pass = result.total_events > 0;
  console.log(`\n=== CLOSING SNAPSHOT GATE: ${pass ? 'PASS' : 'FAIL'} ===`);
  process.exit(pass ? 0 : 1);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
