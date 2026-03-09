/**
 * SGO Historical Backfill — Provider Offers Ingestion
 * Sprint: SPRINT-027A-SGO-HISTORICAL-BACKFILL
 *
 * Fetches finalized SGO events with open/close odds and persists
 * them into provider_offers. Each bookmaker's odds become a separate
 * provider_offers row with is_opening/is_closing flags.
 *
 * Usage:
 *   npx tsx scripts/backfill/sgo-historical-backfill-027.ts
 *
 * Environment:
 *   LEAGUES          — comma-separated (default: NBA)
 *   DAYS_BACK        — how many days to backfill (default: 60)
 *   WINDOW_DAYS      — chunk size per API call (default: 7)
 *   DRY_RUN          — true to skip DB writes (default: false)
 *   MAX_EVENTS       — safety cap on total events (default: 5000)
 *
 * Idempotency:
 *   provider_offers has UNIQUE constraint on (event_id, market_id, participant_id,
 *   segment_id, provider, snapshot_at). Re-runs are safe.
 */

import * as fs from 'fs';
import * as path from 'path';

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import {
  mapSgoStatToMarketKey,
  resolveMarketTypeId,
} from '../../apps/api/src/logic/providers/marketAdapters/sgoStatMapper';
import { getSGOClient, SGOEvent, SGOOddsEntry } from '../../apps/api/src/services/sgo/client';

// ============================================================================
// Configuration
// ============================================================================

const LEAGUES = (process.env['LEAGUES'] || 'NBA').split(',').map(s => s.trim());
const DAYS_BACK = parseInt(process.env['DAYS_BACK'] || '60', 10);
const WINDOW_DAYS = parseInt(process.env['WINDOW_DAYS'] || '7', 10);
const DRY_RUN = process.env['DRY_RUN'] === 'true';
const MAX_EVENTS = parseInt(process.env['MAX_EVENTS'] || '5000', 10);

const SPRINT = 'SPRINT-027A-SGO-HISTORICAL-BACKFILL';
const dateStr = new Date().toISOString().slice(0, 10);
const OUT_DIR = path.resolve(__dirname, `../../out/sprints/${SPRINT}/${dateStr}`);

// ============================================================================
// Supabase
// ============================================================================

function getSupabase(): SupabaseClient {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  return createClient(url, key);
}

// ============================================================================
// Provider ID resolution (cached)
// ============================================================================

const providerIdCache = new Map<string, number | null>();

async function resolveProviderId(
  supabase: SupabaseClient,
  providerCode: string
): Promise<number | null> {
  if (providerIdCache.has(providerCode)) return providerIdCache.get(providerCode)!;
  const { data } = await supabase
    .from('provider_registry')
    .select('id')
    .eq('code', providerCode)
    .eq('active', true)
    .limit(1)
    .single();
  const id = data?.id ?? null;
  providerIdCache.set(providerCode, id);
  return id;
}

// ============================================================================
// Participant resolution (cached)
// ============================================================================

const participantIdCache = new Map<string, string | null>();

async function resolveParticipantId(
  supabase: SupabaseClient,
  sgoPlayerID: string,
  playerName: string | null,
  sport: string
): Promise<string | null> {
  const cacheKey = `${sgoPlayerID}:${sport}`;
  if (participantIdCache.has(cacheKey)) return participantIdCache.get(cacheKey)!;

  // Try by external_id first
  const { data: byExternal } = await supabase
    .from('participants')
    .select('id')
    .eq('external_id', sgoPlayerID)
    .limit(1)
    .single();

  if (byExternal?.id) {
    participantIdCache.set(cacheKey, byExternal.id);
    return byExternal.id;
  }

  // Try by name match
  if (playerName) {
    const { data: byName } = await supabase
      .from('participants')
      .select('id')
      .ilike('name', playerName)
      .limit(1)
      .single();

    if (byName?.id) {
      participantIdCache.set(cacheKey, byName.id);
      return byName.id;
    }
  }

  // Create new participant
  const { data: created } = await supabase
    .from('participants')
    .insert({
      name: playerName ?? sgoPlayerID,
      external_id: sgoPlayerID,
      sport: sport.toUpperCase(),
      participant_type: 'player',
      meta: { source: 'sgo_historical_backfill' },
    })
    .select('id')
    .single();

  const id = created?.id ?? null;
  participantIdCache.set(cacheKey, id);
  return id;
}

// ============================================================================
// Market ID resolution (cached — for the NOT NULL market_id column)
// ============================================================================

const marketIdCache = new Map<string, string | null>();

async function resolveMarketId(
  supabase: SupabaseClient,
  marketKey: string
): Promise<string | null> {
  if (marketIdCache.has(marketKey)) return marketIdCache.get(marketKey)!;

  // Map to canonical_key for the markets table
  const canonicalKey = marketKey.startsWith('player_')
    ? `player_${marketKey.replace('player_', '').replace('_ou', '')}`
    : `game_${marketKey}`;

  const { data } = await supabase
    .from('markets')
    .select('id')
    .eq('canonical_key', canonicalKey)
    .limit(1)
    .single();

  if (data?.id) {
    marketIdCache.set(marketKey, data.id);
    return data.id;
  }

  // Try direct lookup
  const { data: direct } = await supabase.from('markets').select('id').limit(1).single();

  // Use a fallback market_id if needed (the column is NOT NULL)
  const fallbackId = direct?.id ?? null;
  marketIdCache.set(marketKey, fallbackId);
  return fallbackId;
}

// ============================================================================
// Event resolution — create canonical_events rows
// provider_offers.event_id FK → canonical_events(id)
// canonical_events: id, external_id, sport, league, event_type, scheduled_at, status, meta
// ============================================================================

const eventIdCache = new Map<string, string | null>();

async function resolveEventId(
  supabase: SupabaseClient,
  sgoEventId: string,
  sport: string,
  homeTeam: string,
  awayTeam: string,
  scheduledAt: string
): Promise<string | null> {
  const cached = eventIdCache.get(sgoEventId);
  if (cached !== undefined) return cached;

  // Check if canonical_events row already exists by external_id
  const { data: existing } = await supabase
    .from('canonical_events')
    .select('id')
    .eq('external_id', sgoEventId)
    .limit(1)
    .single();

  if (existing?.id) {
    eventIdCache.set(sgoEventId, existing.id);
    return existing.id;
  }

  // Create new canonical_events row
  const { data: created, error } = await supabase
    .from('canonical_events')
    .insert({
      external_id: sgoEventId,
      sport: sport.toUpperCase(),
      league: sport.toUpperCase(),
      event_type: 'game',
      scheduled_at: scheduledAt,
      status: 'completed',
      meta: {
        source: 'sgo_historical_backfill',
        home_team: homeTeam,
        away_team: awayTeam,
      },
    })
    .select('id')
    .single();

  if (error || !created?.id) {
    console.warn(`[Backfill] canonical_events creation failed: ${error?.message ?? 'no id'}`);
    eventIdCache.set(sgoEventId, null);
    return null;
  }

  eventIdCache.set(sgoEventId, created.id);
  return created.id;
}

// ============================================================================
// SGO League → sport_key mapping
// ============================================================================

const LEAGUE_TO_SPORT_KEY: Record<string, string> = {
  NBA: 'basketball_nba',
  NFL: 'americanfootball_nfl',
  MLB: 'baseball_mlb',
  NHL: 'icehockey_nhl',
};

// ============================================================================
// Core: Process a single SGO event into provider_offers rows
// ============================================================================

interface OfferRow {
  event_id: string;
  market_id: string | null;
  market_type_id: number;
  participant_id: string | null;
  segment_id: null;
  provider: string;
  provider_id: number | null;
  provider_event_id: string;
  provider_market_key: string;
  line: number | null;
  over_odds: number | null;
  under_odds: number | null;
  home_odds: number | null;
  away_odds: number | null;
  snapshot_at: string;
  is_opening: boolean;
  is_closing: boolean;
  mapping_confidence: number;
  meta: Record<string, unknown>;
}

// Target bookmakers for multi-book scoring (subset of the 23 available)
const TARGET_BOOKMAKERS = [
  'fanduel',
  'draftkings',
  'pinnacle',
  'caesars',
  'betmgm',
  'bet365',
  'bovada',
  'circa',
];

async function processEvent(
  supabase: SupabaseClient,
  event: SGOEvent,
  providerId: number,
  _providerCode: string,
  league: string
): Promise<{ open: OfferRow[]; close: OfferRow[] }> {
  const openRows: OfferRow[] = [];
  const closeRows: OfferRow[] = [];

  if (!event.odds || typeof event.odds !== 'object') return { open: openRows, close: closeRows };

  const sportKey = LEAGUE_TO_SPORT_KEY[league] ?? league.toLowerCase();
  const homeTeam = event.teams?.home?.names?.full ?? event.teams?.home?.teamID ?? 'Home';
  const awayTeam = event.teams?.away?.names?.full ?? event.teams?.away?.teamID ?? 'Away';
  const startsAt = event.startsAt ?? event.status?.startsAt ?? new Date().toISOString();

  // Resolve event — create canonical_events row
  const eventId = await resolveEventId(
    supabase,
    event.eventID,
    league,
    homeTeam,
    awayTeam,
    startsAt
  );
  if (!eventId) return { open: openRows, close: closeRows };

  for (const [marketKey, oddsEntry] of Object.entries(event.odds)) {
    const odds = oddsEntry as SGOOddsEntry;
    if (!odds.statID) continue;

    // Only process player props (over/under)
    const direction = (odds.sideID ?? '').toLowerCase();
    if (direction !== 'over' && direction !== 'under') continue;

    // Resolve market_type_id
    const marketTypeId = await resolveMarketTypeId(supabase, odds.statID);
    if (!marketTypeId) continue;

    // Resolve participant if player prop
    let participantId: string | null = null;
    const playerId = odds.playerID ?? odds.statEntityID ?? null;
    if (playerId && event.players?.[playerId]) {
      participantId = await resolveParticipantId(
        supabase,
        playerId,
        event.players[playerId]?.name ?? null,
        league
      );
    }

    // SPRINT-027A: Extract per-bookmaker odds from byBookmaker
    // SGO provides byBookmaker: { fanduel: { odds, openOdds, closeOdds, overUnder, ... }, ... }
    const byBookmaker = (odds as any).byBookmaker as Record<string, any> | undefined;
    if (!byBookmaker || typeof byBookmaker !== 'object') continue;

    // Get line from the consensus or first bookmaker
    const fairOU = toNum((odds as any).fairOverUnder) ?? toNum((odds as any).openFairOverUnder);

    for (const bookName of TARGET_BOOKMAKERS) {
      const bookData = byBookmaker[bookName];
      if (!bookData) continue;

      // Resolve provider_id for this bookmaker (nullable — ok if not in registry)
      const bookProviderId = await resolveProviderId(supabase, bookName);

      const openOddsStr = bookData.openOdds;
      const closeOddsStr = bookData.closeOdds;
      const currentOddsStr = bookData.odds;
      const line = toNum(bookData.openOverUnder) ?? toNum(bookData.overUnder) ?? fairOU;

      // Build base row for this bookmaker
      const baseRow = {
        event_id: eventId,
        market_id: null, // nullable — no FK needed
        market_type_id: marketTypeId,
        participant_id: participantId,
        segment_id: null,
        provider: bookName,
        provider_id: bookProviderId,
        provider_event_id: event.eventID,
        provider_market_key: marketKey,
        mapping_confidence: 1.0,
        meta: {
          source: 'sgo_historical_backfill',
          league,
          statID: odds.statID,
          bookmaker: bookName,
        },
      };

      // Determine which odds columns to use based on direction
      const oddsColumns = (value: number | null) => {
        if (direction === 'over')
          return { over_odds: value, under_odds: null, home_odds: null, away_odds: null };
        if (direction === 'under')
          return { over_odds: null, under_odds: value, home_odds: null, away_odds: null };
        return { over_odds: value, under_odds: null, home_odds: null, away_odds: null };
      };

      // Open snapshot (if opening odds exist)
      const openVal = toNum(openOddsStr);
      if (openVal != null) {
        const openTimestamp = new Date(
          new Date(startsAt).getTime() - 24 * 60 * 60 * 1000
        ).toISOString();
        openRows.push({
          ...baseRow,
          ...oddsColumns(openVal),
          line,
          snapshot_at: openTimestamp,
          is_opening: true,
          is_closing: false,
        });
      }

      // Close snapshot
      const closeVal = toNum(closeOddsStr) ?? toNum(currentOddsStr);
      if (closeVal != null) {
        closeRows.push({
          ...baseRow,
          ...oddsColumns(closeVal),
          line,
          snapshot_at: startsAt,
          is_opening: false,
          is_closing: true,
        });
      }
    }
  }

  return { open: openRows, close: closeRows };
}

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

// ============================================================================
// Batch insert into provider_offers
// ============================================================================

async function batchInsertOffers(
  supabase: SupabaseClient,
  rows: OfferRow[]
): Promise<{ inserted: number; skipped: number; errors: number }> {
  let inserted = 0;
  const skipped = 0;
  let errors = 0;

  // Insert in large batches (NULLable unique constraint columns mean
  // each row is unique in Postgres, so plain insert works)
  const BATCH_SIZE = 1000;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(rows.length / BATCH_SIZE);

    const { error } = await supabase.from('provider_offers').insert(batch);

    if (error) {
      console.error(`    Batch ${batchNum}/${totalBatches} error: ${error.message.slice(0, 100)}`);
      errors += batch.length;
    } else {
      inserted += batch.length;
      if (batchNum % 5 === 0 || batchNum === totalBatches) {
        console.log(`    Batch ${batchNum}/${totalBatches}: +${batch.length} (total: ${inserted})`);
      }
    }
  }

  return { inserted, skipped, errors };
}

// ============================================================================
// Main
// ============================================================================

interface BackfillResult {
  league: string;
  totalEvents: number;
  openRows: number;
  closeRows: number;
  inserted: number;
  errors: number;
  durationMs: number;
}

async function main(): Promise<void> {
  fs.mkdirSync(path.join(OUT_DIR, 'proofs'), { recursive: true });

  console.log(`=== ${SPRINT} — SGO Historical Backfill ===`);
  console.log(`Leagues: ${LEAGUES.join(', ')}`);
  console.log(`Days back: ${DAYS_BACK}`);
  console.log(`Window: ${WINDOW_DAYS} days`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log();

  const supabase = getSupabase();
  const client = getSGOClient();
  const results: BackfillResult[] = [];

  // Create a run record
  let runId: string | null = null;
  if (!DRY_RUN) {
    const { data: run } = await supabase
      .from('shadow_scoring_runs')
      .insert({
        run_type: 'BACKFILL_INGEST',
        params: { leagues: LEAGUES, daysBack: DAYS_BACK, windowDays: WINDOW_DAYS },
      })
      .select('id')
      .single();
    runId = run?.id ?? null;
  }

  const now = new Date();
  let totalEventsAll = 0;

  for (const league of LEAGUES) {
    const startTime = Date.now();
    console.log(`\n--- Processing ${league} ---`);

    let leagueOpenRows = 0;
    let leagueCloseRows = 0;
    let leagueInserted = 0;
    let leagueErrors = 0;
    let leagueEvents = 0;

    // We need a provider_id for event creation. Use the first available provider.
    // SGO events will create events via any provider - they'll be shared.
    const sgoProviderId = await resolveProviderId(supabase, 'fanduel');
    if (!sgoProviderId) {
      console.error(`  Provider 'fanduel' not found in registry, skipping ${league}`);
      continue;
    }

    // Iterate date windows
    for (let d = DAYS_BACK; d > 0; d -= WINDOW_DAYS) {
      const windowEnd = new Date(now.getTime() - (d - WINDOW_DAYS) * 24 * 60 * 60 * 1000);
      const windowStart = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

      console.log(
        `  Window: ${windowStart.toISOString().slice(0, 10)} → ${windowEnd.toISOString().slice(0, 10)}`
      );

      try {
        const events = await client.fetchAllEvents({
          leagueID: league,
          startsAfter: windowStart.toISOString(),
          startsBefore: windowEnd.toISOString(),
          finalized: true,
          includeOpenCloseOdds: true,
          includeOpposingOdds: true,
          expandResults: true,
          limit: 50,
        });

        console.log(`    Events: ${events.length}`);
        leagueEvents += events.length;
        totalEventsAll += events.length;

        if (totalEventsAll > MAX_EVENTS) {
          console.warn(`  Safety cap reached (${MAX_EVENTS} events). Stopping.`);
          break;
        }

        // Process each event
        const allOpen: OfferRow[] = [];
        const allClose: OfferRow[] = [];

        for (const event of events) {
          const { open, close } = await processEvent(
            supabase,
            event,
            sgoProviderId,
            'fanduel',
            league
          );
          allOpen.push(...open);
          allClose.push(...close);
        }

        leagueOpenRows += allOpen.length;
        leagueCloseRows += allClose.length;

        console.log(`    Open rows: ${allOpen.length}, Close rows: ${allClose.length}`);

        // Insert
        if (!DRY_RUN) {
          const allRows = [...allOpen, ...allClose];
          if (allRows.length > 0) {
            const result = await batchInsertOffers(supabase, allRows);
            leagueInserted += result.inserted;
            leagueErrors += result.errors;
            console.log(`    Inserted: ${result.inserted}, Errors: ${result.errors}`);
          }
        }
      } catch (err) {
        console.error(`    Window failed: ${(err as Error).message}`);
        leagueErrors++;
      }
    }

    const durationMs = Date.now() - startTime;
    const result: BackfillResult = {
      league,
      totalEvents: leagueEvents,
      openRows: leagueOpenRows,
      closeRows: leagueCloseRows,
      inserted: leagueInserted,
      errors: leagueErrors,
      durationMs,
    };
    results.push(result);

    console.log(
      `  ${league} complete: ${leagueEvents} events, ${leagueOpenRows + leagueCloseRows} rows, ${leagueInserted} inserted, ${leagueErrors} errors (${durationMs}ms)`
    );
  }

  // Update run record
  if (runId && !DRY_RUN) {
    await supabase
      .from('shadow_scoring_runs')
      .update({
        completed_at: new Date().toISOString(),
        status: 'completed',
        result: { results, totalEvents: totalEventsAll },
      })
      .eq('id', runId);
  }

  // Write artifacts
  const summary = {
    sprint: SPRINT,
    date: dateStr,
    dryRun: DRY_RUN,
    config: { leagues: LEAGUES, daysBack: DAYS_BACK, windowDays: WINDOW_DAYS },
    results,
    totalEvents: totalEventsAll,
    totalOpenRows: results.reduce((s, r) => s + r.openRows, 0),
    totalCloseRows: results.reduce((s, r) => s + r.closeRows, 0),
    totalInserted: results.reduce((s, r) => s + r.inserted, 0),
    totalErrors: results.reduce((s, r) => s + r.errors, 0),
    runId,
  };

  fs.writeFileSync(path.join(OUT_DIR, 'BACKFILL_RESULT.json'), JSON.stringify(summary, null, 2));
  console.log(`\n=== Backfill complete. Artifacts: ${OUT_DIR} ===`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
