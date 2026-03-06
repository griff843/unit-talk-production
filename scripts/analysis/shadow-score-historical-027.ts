/**
 * Shadow Score Historical Script
 * Sprint: SPRINT-027A-SGO-HISTORICAL-BACKFILL
 *
 * Scores OPEN snapshots from provider_offers using the same scoring
 * pipeline as production (computeConsensus → computeProbabilityLayer → computeScoreV2),
 * but writes results to isolated shadow_scores table.
 *
 * Processes event-by-event to avoid memory/timeout issues on large datasets.
 *
 * Usage:
 *   npx tsx scripts/analysis/shadow-score-historical-027.ts
 *
 * Env:
 *   DRY_RUN=true        — log only, no writes
 *   BATCH_SIZE=500       — DB insert batch size (default 500)
 *   MODEL_VERSION=v3.0.0 — scoring model version tag
 */

import * as fs from 'fs';
import * as path from 'path';

import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { createClient } from '@supabase/supabase-js';

import { computeScoreV2 } from '../../apps/api/src/agents/GradingAgent/scoring/computeScoreV2';
import {
  computeConsensus,
  type BookOffer,
} from '../../apps/api/src/lib/probability/devigConsensus';
import {
  computeProbabilityLayer,
  type ProbabilityInput,
} from '../../apps/api/src/lib/probability/probabilityLayer';
import { getBookProfile } from '../../apps/api/src/logic/providers/marketAdapters/types';

import type { GradingFeatureSet } from '../../apps/api/src/types/GradingFeatureSet';

// ── Config ──────────────────────────────────────────────────────────────────

const DRY_RUN = process.env.DRY_RUN === 'true';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE ?? '500', 10);
const MODEL_VERSION = process.env.MODEL_VERSION ?? 'v3.0.0-shadow';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const OUT_DIR = path.resolve(__dirname, '../../out/sprints/SPRINT-027A-SGO-HISTORICAL-BACKFILL');

// ── Types ───────────────────────────────────────────────────────────────────

interface PairedOffer {
  event_id: string;
  market_type_id: number;
  participant_id: string | null;
  provider: string;
  over_odds: number;
  under_odds: number;
  line: number | null;
  snapshot_at: string;
}

interface ShadowScoreRow {
  run_id: string;
  market_key: string;
  event_id: string;
  market_type_id: number;
  participant_id: string | null;
  snapshot_at: string;
  book_count: number;
  providers: string[];
  p_market_devig: number | null;
  p_final: number | null;
  edge_final: number | null;
  uncertainty_final: number | null;
  clv_forecast: number | null;
  tier: string | null;
  score: number | null;
  model_version: string;
  devig_mode: string;
  explain_v3: Record<string, unknown> | null;
}

// ── Market type cache ───────────────────────────────────────────────────────

const marketTypeCache = new Map<number, string>();

async function resolveMarketKey(marketTypeId: number): Promise<string> {
  const cached = marketTypeCache.get(marketTypeId);
  if (cached) return cached;

  const { data } = await supabase
    .from('market_types')
    .select('market_key')
    .eq('id', marketTypeId)
    .single();

  const key = data?.market_key ?? `unknown_mt_${marketTypeId}`;
  marketTypeCache.set(marketTypeId, key);
  return key;
}

// ── Pairing helper ──────────────────────────────────────────────────────────

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
  provider_market_key: string | null;
}

function pairOverUnder(rows: RawOffer[]): PairedOffer[] {
  const pairMap = new Map<string, { over: RawOffer | null; under: RawOffer | null }>();

  for (const row of rows) {
    const pmk = row.provider_market_key ?? '';
    let baseKey: string;
    if (pmk.endsWith('-over')) baseKey = pmk.slice(0, -5);
    else if (pmk.endsWith('-under')) baseKey = pmk.slice(0, -6);
    else baseKey = pmk;

    const pairKey = `${row.event_id}|${baseKey}|${row.provider}`;
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
      });
    }
  }
  return paired;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('=== Shadow Scoring Historical ===');
  console.log(`DRY_RUN: ${DRY_RUN}`);
  console.log(`MODEL_VERSION: ${MODEL_VERSION}`);
  console.log(`BATCH_SIZE: ${BATCH_SIZE}`);
  console.log();

  // Create scoring run record
  let runId: string;
  if (!DRY_RUN) {
    const { data: run, error: runErr } = await supabase
      .from('shadow_scoring_runs')
      .insert({
        run_type: 'SHADOW_SCORE',
        params: { model_version: MODEL_VERSION, batch_size: BATCH_SIZE },
        status: 'running',
      })
      .select('id')
      .single();

    if (runErr || !run) {
      console.error('Failed to create scoring run:', runErr);
      process.exit(1);
    }
    runId = run.id;
    console.log(`Created shadow_scoring_runs: ${runId}`);
  } else {
    runId = 'dry-run';
    console.log('DRY RUN — no DB writes');
  }

  // Step 1: Get distinct event_ids from canonical_events (backfill source)
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
  console.log('\n--- Step 2: Scoring event by event ---');
  const pendingInserts: ShadowScoreRow[] = [];
  let totalScored = 0;
  let totalFailed = 0;
  let totalConsensusFailed = 0;
  let totalPairedOffers = 0;
  let totalRawRows = 0;
  const tierCounts: Record<string, number> = {};
  let totalInserted = 0;

  for (let ei = 0; ei < eventIds.length; ei++) {
    const eventId = eventIds[ei]!;

    // Fetch opening offers for this event (cursor pagination within event)
    const eventOffers: RawOffer[] = [];
    let lastRowId = '00000000-0000-0000-0000-000000000000';

    while (true) {
      const { data: page, error } = await supabase
        .from('provider_offers')
        .select(
          'id, event_id, market_type_id, participant_id, provider, over_odds, under_odds, line, snapshot_at, provider_market_key'
        )
        .eq('event_id', eventId)
        .eq('is_opening', true)
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
    totalRawRows += eventOffers.length;

    // Pair over/under
    const paired = pairOverUnder(eventOffers);
    totalPairedOffers += paired.length;

    // Group by market_type_id + participant_id
    const groups = new Map<string, PairedOffer[]>();
    for (const offer of paired) {
      const key = `${offer.market_type_id}|${offer.participant_id ?? 'null'}`;
      let arr = groups.get(key);
      if (!arr) {
        arr = [];
        groups.set(key, arr);
      }
      arr.push(offer);
    }

    // Score each market group with >= 2 books
    for (const [groupKey, offers] of groups) {
      if (offers.length < 2) continue;

      try {
        const marketTypeId = offers[0]!.market_type_id;
        const participantId = offers[0]!.participant_id;
        const marketKey = await resolveMarketKey(marketTypeId);

        const bookOffers: BookOffer[] = offers.map(o => {
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

        const consensus = computeConsensus(bookOffers, 'proportional');
        if (!consensus.ok) {
          totalConsensusFailed++;
          continue;
        }

        const entryOdds = bookOffers[0]!.overOdds;
        const snapshotAt = offers[0]!.snapshot_at;
        const sport =
          marketKey.includes('passing') ||
          marketKey.includes('rushing') ||
          marketKey.includes('receiving')
            ? 'NFL'
            : 'NBA';

        const probInput: ProbabilityInput = {
          confidenceScore: 5,
          bookOffers,
          side: 'over',
          entryOdds,
          sport,
          marketType: marketKey,
          hoursToStart: null,
          featureCompleteness: 0.5,
        };

        const probResult = computeProbabilityLayer(probInput);

        let pMarketDevig: number | null = null;
        let pFinal: number | null = null;
        let edgeFinal: number | null = null;
        let uncertaintyFinal: number | null = null;
        let clvForecast: number | null = null;
        let explainV3: Record<string, unknown> | null = null;

        if (probResult.ok) {
          pMarketDevig = probResult.pMarketDevig;
          pFinal = probResult.pFinal;
          edgeFinal = probResult.edgeFinal;
          uncertaintyFinal = probResult.uncertaintyFinal;
          clvForecast = probResult.clvForecast;
          explainV3 = probResult.explain as unknown as Record<string, unknown>;
        }

        const line = offers[0]!.line ?? 0;
        const featureSet = {
          propId: `shadow-${eventId}-${marketTypeId}-${participantId ?? 'null'}`,
          date: snapshotAt.slice(0, 10),
          sport,
          league: sport,
          marketType: marketKey,
          odds: entryOdds,
          market: { type: marketKey, odds: entryOdds, line },
          outcome: 'over' as const,
          expectedValue: edgeFinal != null ? edgeFinal * 100 : 0,
          lineMovement: 0,
          matchupRating: 0.5,
          playerForm: 0.5,
          injuryImpact: 0,
          weatherImpact: 0,
          marketIntelligence: pMarketDevig ?? 0.5,
          sharpMoney: 0,
          volumeProfile: 0,
          closingLineValue: clvForecast ?? 0,
          crossBookVariance: uncertaintyFinal ?? undefined,
          playerFatigue: 0,
          venueAdvantage: 0,
          refereeImpact: 0,
          paceImpact: 0,
          motivationalFactors: 0,
          correlationRisk: 0,
          volatility: 0.5,
          portfolioImpact: 0,
          dataQuality: {
            dataValidationScore: 0.5,
            outlierScore: 0,
            consistencyScore: 0.5,
            completeness: 0.5,
          },
          timestamp: snapshotAt,
          version: MODEL_VERSION,
          source: 'shadow-historical',
          confidence: 5,
          multiBookLines: bookOffers.map(bo => ({
            book: bo.bookName,
            line,
            odds: bo.overOdds,
            timestamp: new Date(snapshotAt).getTime(),
          })),
        } as GradingFeatureSet;

        const scoreResult = computeScoreV2(featureSet);
        const tier = scoreResult.tier;
        tierCounts[tier] = (tierCounts[tier] ?? 0) + 1;

        pendingInserts.push({
          run_id: runId,
          market_key: `${eventId}|${marketTypeId}|${participantId ?? 'null'}`,
          event_id: eventId,
          market_type_id: marketTypeId,
          participant_id: participantId,
          snapshot_at: snapshotAt,
          book_count: bookOffers.length,
          providers: bookOffers.map(bo => bo.bookId),
          p_market_devig: pMarketDevig,
          p_final: pFinal,
          edge_final: edgeFinal,
          uncertainty_final: uncertaintyFinal,
          clv_forecast: clvForecast,
          tier,
          score: scoreResult.score,
          model_version: MODEL_VERSION,
          devig_mode: 'MULTI_BOOK',
          explain_v3: explainV3,
        });

        totalScored++;
      } catch (err) {
        totalFailed++;
        if (totalFailed <= 5) {
          console.error(`  Score failed:`, (err as Error).message);
        }
      }
    }

    // Flush inserts periodically
    if (!DRY_RUN && pendingInserts.length >= BATCH_SIZE) {
      const batch = pendingInserts.splice(0, BATCH_SIZE);
      const { error: insertErr } = await supabase.from('shadow_scores').upsert(batch, {
        onConflict: 'market_key,model_version,snapshot_at',
        ignoreDuplicates: true,
      });

      if (insertErr) {
        console.error(`  Insert error:`, insertErr.message);
      } else {
        totalInserted += batch.length;
      }
    }

    if ((ei + 1) % 25 === 0 || ei === eventIds.length - 1) {
      console.log(
        `  Events: ${ei + 1}/${eventIds.length} | Raw rows: ${totalRawRows} | Paired: ${totalPairedOffers} | Scored: ${totalScored} | Inserted: ${totalInserted}`
      );
    }
  }

  // Flush remaining inserts
  if (!DRY_RUN && pendingInserts.length > 0) {
    for (let i = 0; i < pendingInserts.length; i += BATCH_SIZE) {
      const batch = pendingInserts.slice(i, i + BATCH_SIZE);
      const { error: insertErr } = await supabase.from('shadow_scores').upsert(batch, {
        onConflict: 'market_key,model_version,snapshot_at',
        ignoreDuplicates: true,
      });

      if (insertErr) {
        console.error(`  Final insert error:`, insertErr.message);
      } else {
        totalInserted += batch.length;
      }
    }
  }

  console.log(
    `\nScoring complete: ${totalScored} scored, ${totalConsensusFailed} consensus failed, ${totalFailed} errors`
  );
  console.log('Tier distribution:', tierCounts);
  console.log(`Total inserted: ${totalInserted}`);

  // Update run status
  const resultSummary = {
    total_events: eventIds.length,
    total_raw_rows: totalRawRows,
    total_paired: totalPairedOffers,
    scored: totalScored,
    consensus_failed: totalConsensusFailed,
    errors: totalFailed,
    inserted: totalInserted,
    tier_distribution: tierCounts,
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
    path.join(artifactPath, 'SHADOW_SCORE_RESULT.json'),
    JSON.stringify(resultSummary, null, 2)
  );

  console.log('\n=== Shadow Scoring Complete ===');
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
  console.error('Shadow scoring failed:', err);
  process.exit(1);
});
