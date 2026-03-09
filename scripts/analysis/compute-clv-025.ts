#!/usr/bin/env tsx
/**
 * CLV Computation Runner
 * Sprint: SPRINT-025-CLV-CLOSING-SNAPSHOT
 *
 * Runs CLVComputeService to compute CLV for scored picks.
 *
 * Usage:
 *   npx tsx scripts/analysis/compute-clv-025.ts
 *
 * Environment:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (from .env)
 *   CLOSE_KIND (optional, default: CLOSE_FINAL)
 *   LIMIT (optional, default: 500)
 */

/* eslint-disable no-console */

import * as fs from 'fs';
import * as path from 'path';

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { CLVComputeService } from '../../apps/api/src/services/CLVComputeService';

import type { CloseKind } from '../../apps/api/src/services/CLVComputeService';

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

const CLOSE_KIND = (process.env['CLOSE_KIND'] || 'CLOSE_FINAL') as CloseKind;
const LIMIT = parseInt(process.env['LIMIT'] || '500', 10);

const SPRINT_ID = 'SPRINT-025-CLV-CLOSING-SNAPSHOT';
const DATE_STR = new Date().toISOString().slice(0, 10);
const OUT_DIR = path.resolve(__dirname, `../../out/sprints/${SPRINT_ID}/${DATE_STR}`);

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`\n=== CLV Computation — ${SPRINT_ID} ===`);
  console.log(`Close kind: ${CLOSE_KIND} | Limit: ${LIMIT}`);

  const service = new CLVComputeService(supabase);

  const result = await service.computeCLV({
    closeKind: CLOSE_KIND,
    limit: LIMIT,
  });

  console.log(`\n--- CLV Computation Results ---`);
  console.log(`Total picks scanned:    ${result.total_picks_scanned}`);
  console.log(`Already computed:       ${result.already_computed}`);
  console.log(`Newly computed:         ${result.computed}`);
  console.log(`Reason-coded:           ${result.reason_coded}`);
  console.log(`Errors:                 ${result.errors.length}`);

  // Reason code breakdown
  const reasonCounts: Record<string, number> = {};
  for (const r of result.results) {
    const code = r.reason_code ?? 'SUCCESS';
    reasonCounts[code] = (reasonCounts[code] || 0) + 1;
  }
  console.log(`\n--- Reason Code Breakdown ---`);
  for (const [code, count] of Object.entries(reasonCounts).sort()) {
    console.log(`  ${code.padEnd(25)} ${count}`);
  }

  // CLV distribution for successful results
  const successful = result.results.filter(r => !r.reason_code);
  if (successful.length > 0) {
    const clvValues = successful.map(r => r.clv_prob);
    const mean = clvValues.reduce((a, b) => a + b, 0) / clvValues.length;
    const sorted = [...clvValues].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    console.log(`\n--- CLV Distribution (successful) ---`);
    console.log(`  Count:  ${successful.length}`);
    console.log(`  Mean:   ${mean.toFixed(6)}`);
    console.log(`  Median: ${median.toFixed(6)}`);
    console.log(`  Min:    ${sorted[0].toFixed(6)}`);
    console.log(`  Max:    ${sorted[sorted.length - 1].toFixed(6)}`);
  }

  // Write artifacts
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, 'CLV_SAMPLE.json'),
    JSON.stringify(
      {
        sprint: SPRINT_ID,
        timestamp: new Date().toISOString(),
        summary: {
          total_picks_scanned: result.total_picks_scanned,
          already_computed: result.already_computed,
          computed: result.computed,
          reason_coded: result.reason_coded,
          reason_breakdown: reasonCounts,
        },
        results: result.results.slice(0, 50),
        errors: result.errors,
      },
      null,
      2
    )
  );

  console.log(`\nArtifacts written to: ${OUT_DIR}/`);
  process.exit(0);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
