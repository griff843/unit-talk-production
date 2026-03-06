/**
 * Shadow CLV Historical Script
 * Sprint: SPRINT-027A-SGO-HISTORICAL-BACKFILL
 *
 * Computes Closing Line Value (CLV) from open vs close snapshots
 * in provider_offers. For each market:
 *   1. Query OPEN snapshots → computeConsensus → p_open_devig
 *   2. Query CLOSE snapshots → computeConsensus → p_close_devig
 *   3. CLV = p_close_devig - p_open_devig
 *
 * Processes event-by-event to avoid memory/timeout issues.
 * Writes to isolated shadow_clv_results table.
 *
 * Usage:
 *   npx tsx scripts/analysis/shadow-clv-historical-027.ts
 *
 * Env:
 *   DRY_RUN=true        — log only, no writes
 *   MODEL_VERSION=v3.0.0 — scoring model version tag
 */

import * as dotenv from 'dotenv';

import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { createClient } from '@supabase/supabase-js';

import {
  computeConsensus,
  type BookOffer,
} from '../../apps/api/src/lib/probability/devigConsensus';
import { getBookProfile } from '../../apps/api/src/logic/providers/marketAdapters/types';

// ── Config ──────────────────────────────────────────────────────────────────

const DRY_RUN = process.env.DRY_RUN === 'true';
const MODEL_VERSION = process.env.MODEL_VERSION ?? 'v3.0.0-shadow';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE ?? '500', 10);

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const OUT_DIR = path.resolve(__dirname, '../../out/sprints/SPRINT-027A-SGO-HISTORICAL-BACKFILL');

// ── Types ───────────────────────────────────────────────────────────────────

interface RawOffer {
  id: string;
  event_id: string;
  market_type_id: number;
  participant_id: string | null;
  provider: string;
  over_odds: number | null;
  under_odds: number | null;
  line: number | null;
  snapshot_at: string;
  is_opening: boolean;
  is_closing: boolean;
  provider_market_key: string | null;
}

interface PairedOffer {
  event_id: string;
  market_type_id: number;
  participant_id: string | null;
  provider: string;
  over_odds: number;
  under_odds: number;
  line: number | null;
  snapshot_at: string;
  is_opening: boolean;
  is_closing: boolean;
}

interface CLVResultRow {
  run_id: string;
  market_key: string;
  event_id: string;
  market_type_id: number;
  participant_id: string | null;
  model_version: string;
  book_count_open: number;
  book_count_close: number;
  p_open_devig: number | null;
  p_close_devig: number | null;
  clv_prob: number;
  reason_code: string | null;
  meta: Record<string, unknown> | null;
}

// ── Pairing helper ──────────────────────────────────────────────────────────

function pairOverUnder(rows: RawOffer[]): PairedOffer[] {
  const pairMap = new Map<string, { over: RawOffer | null; under: RawOffer | null }>();

  for (const row of rows) {
    const pmk = row.provider_market_key ?? '';
    let baseKey: string;
    if (pmk.endsWith('-over')) baseKey = pmk.slice(0, -5);
    else if (pmk.endsWith('-under')) baseKey = pmk.slice(0, -6);
    else baseKey = pmk;

    const side = row.is_opening ? 'open' : 'close';
    const pairKey = `${row.event_id}|${baseKey}|${row.provider}|${side}`;
    let pair = pairMap.get(pairKey);
    if (!pair) {
      pair = { over: null, under: null };
      pairMap.set(pairKey, pair);
    }

    if (row.over_odds != null) pair.over = row;
    if (row.under_odds != null) pair.under = row;
    if (row.over_odds != null && row.under_odds != null) {
      pair.over = row;
      pair.under = row;
    }
  }

  const paired: PairedOffer[] = [];
  for (const [, pair] of pairMap) {
    if (pair.over && pair.under) {
      paired.push({
        event_id: pair.over.event_id,
        market_type_id: pair.over.market_type_id,
        participant_id: pair.over.participant_id,
        provider: pair.over.provider,
        over_odds: pair.over.over_odds!,
        under_odds: pair.under.under_odds!,
        line: pair.over.line ?? pair.under.line,
        snapshot_at: pair.over.snapshot_at,
        is_opening: pair.over.is_opening,
        is_closing: pair.over.is_closing,
      });
    }
  }
  return paired;
}

function buildBookOffers(offers: PairedOffer[]): BookOffer[] {
  return offers.map(o => {
    const profile = getBookProfile(o.provider);
    return {
      bookId: o.provider,
      bookName: o.provider,
      overOdds: o.over_odds,
      underOdds: o.under_odds,
      bookProfile: profile.profile,
      liquidityTier: profile.liquidity,
      dataQuality: 'good' as const,
    };
  });
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('=== Shadow CLV Historical ===');
  console.log(`DRY_RUN: ${DRY_RUN}`);
  console.log(`MODEL_VERSION: ${MODEL_VERSION}`);
  console.log();

  // Create CLV run record
  let runId: string;
  if (!DRY_RUN) {
    const { data: run, error: runErr } = await supabase
      .from('shadow_scoring_runs')
      .insert({
        run_type: 'CLV_COMPUTE',
        params: { model_version: MODEL_VERSION },
        status: 'running',
      })
      .select('id')
      .single();

    if (runErr || !run) {
      console.error('Failed to create CLV run:', runErr);
      process.exit(1);
    }
    runId = run.id;
    console.log(`Created shadow_scoring_runs: ${runId}`);
  } else {
    runId = 'dry-run';
    console.log('DRY RUN — no DB writes');
  }

  // Step 1: Get distinct event_ids
  console.log('\n--- Step 1: Fetching distinct event IDs ---');
  const eventIds: string[] = [];
  let lastEventId = '00000000-0000-0000-0000-000000000000';

  while (true) {
    const { data: page, error } = await supabase
      .from('canonical_events')
      .select('id')
      .gt('id', lastEventId)
      .order('id')
      .limit(500);

    if (error) {
      console.error('Failed to fetch event IDs:', error);
      process.exit(1);
    }
    if (!page || page.length === 0) break;
    for (const row of page) eventIds.push(row.id);
    lastEventId = page[page.length - 1]!.id;
    if (page.length < 500) break;
  }

  console.log(`Found ${eventIds.length} canonical events`);

  // Step 2: Process each event
  console.log('\n--- Step 2: Computing CLV event by event ---');
  const pendingInserts: CLVResultRow[] = [];
  let totalComputed = 0;
  let totalPartial = 0;
  let totalOpenFailed = 0;
  let totalCloseFailed = 0;
  let totalErrors = 0;
  let totalInserted = 0;
  const clvValues: number[] = [];

  for (let ei = 0; ei < eventIds.length; ei++) {
    const eventId = eventIds[ei]!;

    // Fetch ALL offers (open + close) for this event
    const eventOffers: RawOffer[] = [];
    let lastRowId = '00000000-0000-0000-0000-000000000000';

    while (true) {
      const { data: page, error } = await supabase
        .from('provider_offers')
        .select(
          'id, event_id, market_type_id, participant_id, provider, over_odds, under_odds, line, snapshot_at, is_opening, is_closing, provider_market_key'
        )
        .eq('event_id', eventId)
        .or('is_opening.eq.true,is_closing.eq.true')
        .gt('id', lastRowId)
        .order('id')
        .limit(1000);

      if (error) {
        console.error(`  Event ${ei + 1}: fetch error:`, error.message);
        break;
      }
      if (!page || page.length === 0) break;
      eventOffers.push(...(page as RawOffer[]));
      lastRowId = page[page.length - 1]!.id;
      if (page.length < 1000) break;
    }

    if (eventOffers.length === 0) continue;

    // Pair over/under
    const paired = pairOverUnder(eventOffers);
    const openPaired = paired.filter(p => p.is_opening);
    const closePaired = paired.filter(p => p.is_closing);

    // Group by market_type_id + participant_id
    const marketKeys = new Set<string>();
    for (const p of paired) {
      marketKeys.add(`${p.market_type_id}|${p.participant_id ?? 'null'}`);
    }

    for (const mk of marketKeys) {
      const [mtIdStr, pIdStr] = mk.split('|');
      const marketTypeId = parseInt(mtIdStr!, 10);
      const participantId = pIdStr === 'null' ? null : pIdStr!;

      const openOffers = openPaired.filter(
        p =>
          p.market_type_id === marketTypeId &&
          (p.participant_id ?? 'null') === (participantId ?? 'null')
      );
      const closeOffers = closePaired.filter(
        p =>
          p.market_type_id === marketTypeId &&
          (p.participant_id ?? 'null') === (participantId ?? 'null')
      );

      const marketKey = `${eventId}|${marketTypeId}|${participantId ?? 'null'}`;
      const hasOpen = openOffers.length >= 2;
      const hasClose = closeOffers.length >= 2;

      if (!hasOpen && !hasClose) continue;

      try {
        if (hasOpen && hasClose) {
          const openBooks = buildBookOffers(openOffers);
          const closeBooks = buildBookOffers(closeOffers);

          const openConsensus = computeConsensus(openBooks, 'proportional');
          if (!openConsensus.ok) {
            totalOpenFailed++;
            continue;
          }

          const closeConsensus = computeConsensus(closeBooks, 'proportional');
          if (!closeConsensus.ok) {
            totalCloseFailed++;
            continue;
          }

          const pOpenDevig = openConsensus.overConsensus;
          const pCloseDevig = closeConsensus.overConsensus;
          const clvProb = pCloseDevig - pOpenDevig;
          clvValues.push(clvProb);

          pendingInserts.push({
            run_id: runId,
            market_key: marketKey,
            event_id: eventId,
            market_type_id: marketTypeId,
            participant_id: participantId,
            model_version: MODEL_VERSION,
            book_count_open: openBooks.length,
            book_count_close: closeBooks.length,
            p_open_devig: pOpenDevig,
            p_close_devig: pCloseDevig,
            clv_prob: clvProb,
            reason_code: null,
            meta: {
              open_providers: openBooks.map(b => b.bookId),
              close_providers: closeBooks.map(b => b.bookId),
            },
          });
          totalComputed++;
        } else {
          // Partial — record with reason code
          pendingInserts.push({
            run_id: runId,
            market_key: marketKey,
            event_id: eventId,
            market_type_id: marketTypeId,
            participant_id: participantId,
            model_version: MODEL_VERSION,
            book_count_open: openOffers.length,
            book_count_close: closeOffers.length,
            p_open_devig: null,
            p_close_devig: null,
            clv_prob: 0,
            reason_code: !hasOpen ? 'MISSING_OPEN' : 'MISSING_CLOSE',
            meta: null,
          });
          totalPartial++;
        }
      } catch (err) {
        totalErrors++;
        if (totalErrors <= 5) {
          console.error(`  CLV failed:`, (err as Error).message);
        }
      }
    }

    // Flush inserts periodically
    if (!DRY_RUN && pendingInserts.length >= BATCH_SIZE) {
      const batch = pendingInserts.splice(0, BATCH_SIZE);
      const { error: insertErr } = await supabase
        .from('shadow_clv_results')
        .upsert(batch, { onConflict: 'market_key,model_version', ignoreDuplicates: true });

      if (insertErr) {
        console.error(`  Insert error:`, insertErr.message);
      } else {
        totalInserted += batch.length;
      }
    }

    if ((ei + 1) % 25 === 0 || ei === eventIds.length - 1) {
      console.log(
        `  Events: ${ei + 1}/${eventIds.length} | Computed: ${totalComputed} | Partial: ${totalPartial} | Inserted: ${totalInserted}`
      );
    }
  }

  // Flush remaining
  if (!DRY_RUN && pendingInserts.length > 0) {
    for (let i = 0; i < pendingInserts.length; i += BATCH_SIZE) {
      const batch = pendingInserts.slice(i, i + BATCH_SIZE);
      const { error: insertErr } = await supabase
        .from('shadow_clv_results')
        .upsert(batch, { onConflict: 'market_key,model_version', ignoreDuplicates: true });

      if (insertErr) {
        console.error(`  Final insert error:`, insertErr.message);
      } else {
        totalInserted += batch.length;
      }
    }
  }

  console.log(
    `\nCLV complete: ${totalComputed} computed, ${totalPartial} partial, ${totalOpenFailed} open consensus failed, ${totalCloseFailed} close consensus failed, ${totalErrors} errors`
  );
  console.log(`Total inserted: ${totalInserted}`);

  // CLV distribution stats
  if (clvValues.length > 0) {
    const sorted = [...clvValues].sort((a, b) => a - b);
    const mean = clvValues.reduce((a, b) => a + b, 0) / clvValues.length;
    const median = sorted[Math.floor(sorted.length / 2)]!;
    const stdDev = Math.sqrt(
      clvValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / clvValues.length
    );
    const positive = clvValues.filter(v => v > 0).length;

    console.log('\nCLV Distribution:');
    console.log(`  Mean:     ${(mean * 100).toFixed(3)}%`);
    console.log(`  Median:   ${(median * 100).toFixed(3)}%`);
    console.log(`  Std Dev:  ${(stdDev * 100).toFixed(3)}%`);
    console.log(
      `  Positive: ${positive}/${clvValues.length} (${((positive / clvValues.length) * 100).toFixed(1)}%)`
    );
    console.log(`  Min:      ${(sorted[0]! * 100).toFixed(3)}%`);
    console.log(`  Max:      ${(sorted[sorted.length - 1]! * 100).toFixed(3)}%`);
  }

  // Update run status
  const resultSummary = {
    total_events: eventIds.length,
    computed: totalComputed,
    partial: totalPartial,
    open_consensus_failed: totalOpenFailed,
    close_consensus_failed: totalCloseFailed,
    errors: totalErrors,
    inserted: totalInserted,
    clv_stats:
      clvValues.length > 0
        ? {
            mean: clvValues.reduce((a, b) => a + b, 0) / clvValues.length,
            count: clvValues.length,
            positive: clvValues.filter(v => v > 0).length,
          }
        : null,
    model_version: MODEL_VERSION,
  };

  if (!DRY_RUN) {
    await updateRunStatus(runId, 'completed', resultSummary);
  }

  // Write artifact
  const dateStr = new Date().toISOString().slice(0, 10);
  const artifactPath = path.join(OUT_DIR, dateStr);
  fs.mkdirSync(artifactPath, { recursive: true });
  fs.writeFileSync(
    path.join(artifactPath, 'SHADOW_CLV_RESULT.json'),
    JSON.stringify(resultSummary, null, 2)
  );

  console.log('\n=== Shadow CLV Complete ===');
  console.log(JSON.stringify(resultSummary, null, 2));
}

async function updateRunStatus(
  runId: string,
  status: string,
  result: Record<string, unknown>
): Promise<void> {
  if (runId === 'dry-run') return;

  await supabase
    .from('shadow_scoring_runs')
    .update({
      status,
      result,
      completed_at: new Date().toISOString(),
    })
    .eq('id', runId);
}

main().catch(err => {
  console.error('Shadow CLV failed:', err);
  process.exit(1);
});
