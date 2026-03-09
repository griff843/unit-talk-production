/**
 * Outcome Backfill Runner
 * Sprint: SPRINT-029-OUTCOME-FOUNDATION
 *
 * Backfills actual game outcomes for the 60-day shadow dataset.
 * Fetches results from SGO API, resolves lines from provider_offers,
 * computes WIN/LOSS/PUSH outcomes, and generates performance report.
 *
 * Usage:
 *   npx tsx scripts/analysis/run-outcome-backfill-029.ts
 *
 * Environment:
 *   PROBE_ONLY=true  — run probe step only (skip full backfill)
 *   DRY_RUN=true     — skip DB writes
 */

import * as fs from 'fs';
import * as path from 'path';

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { resolveOutcome } from '../../apps/api/src/analysis/outcomes/outcome-resolver';
import { generatePerformanceReport } from '../../apps/api/src/analysis/outcomes/performance-report';
import {
  resolveActualValue,
  hasStatMapping,
} from '../../apps/api/src/analysis/outcomes/stat-resolver';
import { mapSgoStatToMarketKey } from '../../apps/api/src/logic/providers/marketAdapters/sgoStatMapper';
import { getSGOClient, SGOEvent } from '../../apps/api/src/services/sgo/client';

import type { ShadowScoreRow } from '../../apps/api/src/analysis/edge-validation/types';
import type {
  PlayerGameStatsInsert,
  PropOutcomeInsert,
  OutcomeSummary,
  ScoredOutcome,
} from '../../apps/api/src/analysis/outcomes/types';

const SPRINT = 'SPRINT-029-OUTCOME-FOUNDATION';
const dateStr = new Date().toISOString().slice(0, 10);
const OUT_DIR = path.resolve(__dirname, `../../out/sprints/${SPRINT}/${dateStr}`);
const PROBE_ONLY = process.env['PROBE_ONLY'] === 'true';
const DRY_RUN = process.env['DRY_RUN'] === 'true';

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
// Phase 1: Probe SGO results structure
// ============================================================================

async function probeSGOResults(): Promise<Record<string, unknown>> {
  const sgo = getSGOClient();
  console.log('[Probe] Fetching 1 finalized NBA event with expandResults...');

  const response = await sgo.fetchEvents({
    leagueID: 'NBA',
    finalized: true,
    expandResults: true,
    limit: 1,
  });

  if (!response.data.length) {
    console.warn('[Probe] No finalized events returned');
    return { error: 'no_finalized_events' };
  }

  const event = response.data[0];
  console.log(`[Probe] Event: ${event.eventID}`);
  console.log(
    `[Probe] Teams: ${event.teams?.home?.names?.full} vs ${event.teams?.away?.names?.full}`
  );
  console.log(`[Probe] Top-level keys: ${Object.keys(event).join(', ')}`);

  // Collect sample odds entries with results
  const samplesWithResults: Record<string, unknown>[] = [];
  let totalOdds = 0;
  let withResults = 0;

  if (event.odds) {
    for (const [key, oddsEntry] of Object.entries(event.odds)) {
      totalOdds++;
      const entry = oddsEntry as Record<string, unknown>;
      if (
        entry['results'] &&
        typeof entry['results'] === 'object' &&
        Object.keys(entry['results'] as object).length > 0
      ) {
        withResults++;
        if (samplesWithResults.length < 10) {
          samplesWithResults.push({
            oddsKey: key as string,
            statID: entry.statID,
            playerID: entry.playerID,
            sideID: entry.sideID,
            line: entry.line,
            results: entry.results,
            allEntryKeys: Object.keys(entry),
          });
        }
      }
    }
  }

  const probe = {
    eventID: event.eventID,
    teams: {
      home: event.teams?.home?.names?.full,
      away: event.teams?.away?.names?.full,
    },
    eventTopLevelKeys: Object.keys(event),
    totalOddsEntries: totalOdds,
    oddsWithResults: withResults,
    coveragePct: totalOdds > 0 ? round((withResults / totalOdds) * 100, 1) : 0,
    sampleResultsEntries: samplesWithResults,
    eventStatus: event.status ?? null,
    // Check for event-level results field
    eventResults: (event as Record<string, unknown>)['results'] ?? null,
  };

  console.log(
    `[Probe] ${withResults}/${totalOdds} odds entries have results (${probe.coveragePct}%)`
  );
  if (samplesWithResults.length > 0) {
    console.log('[Probe] Sample:', JSON.stringify(samplesWithResults[0], null, 2));
  }

  return probe;
}

// ============================================================================
// Phase 2: Fetch shadow scores
// ============================================================================

async function fetchShadowScores(supabase: SupabaseClient): Promise<ShadowScoreRow[]> {
  const rows: ShadowScoreRow[] = [];
  let lastId = '';
  const LIMIT = 1000;

  while (true) {
    let query = supabase.from('shadow_scores').select('*').order('id').limit(LIMIT);

    if (lastId) query = query.gt('id', lastId);

    const { data, error } = await query;
    if (error) throw new Error(`shadow_scores fetch: ${error.message}`);
    if (!data || data.length === 0) break;

    rows.push(...(data as ShadowScoreRow[]));
    lastId = data[data.length - 1].id;
    if (data.length < LIMIT) break;
  }

  console.log(`[Data] Fetched ${rows.length} shadow_scores`);
  return rows;
}

// ============================================================================
// Phase 3: Fetch canonical events (external_id = SGO eventID)
// ============================================================================

async function fetchCanonicalEvents(
  supabase: SupabaseClient,
  eventIds: string[]
): Promise<Map<string, { external_id: string; scheduled_at: string }>> {
  const map = new Map<string, { external_id: string; scheduled_at: string }>();
  const BATCH = 500;

  for (let i = 0; i < eventIds.length; i += BATCH) {
    const batch = eventIds.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from('canonical_events')
      .select('id, external_id, scheduled_at')
      .in('id', batch);

    if (error) throw new Error(`canonical_events fetch: ${error.message}`);
    if (data) {
      for (const row of data) {
        if (row.external_id && row.scheduled_at) {
          map.set(row.id, { external_id: row.external_id, scheduled_at: row.scheduled_at });
        }
      }
    }
  }

  console.log(`[Data] Resolved ${map.size} / ${eventIds.length} canonical events with external_id`);
  return map;
}

// ============================================================================
// Phase 4: Fetch participant external_ids
// ============================================================================

async function fetchParticipantExternalIds(
  supabase: SupabaseClient,
  participantIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const BATCH = 500;

  for (let i = 0; i < participantIds.length; i += BATCH) {
    const batch = participantIds.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from('participants')
      .select('id, external_id')
      .in('id', batch);

    if (error) throw new Error(`participants fetch: ${error.message}`);
    if (data) {
      for (const row of data) {
        if (row.external_id) map.set(row.id, row.external_id);
      }
    }
  }

  console.log(`[Data] Resolved ${map.size} / ${participantIds.length} participant external_ids`);
  return map;
}

// ============================================================================
// Phase 5: Fetch market types (id → market_key)
// ============================================================================

async function fetchMarketTypes(supabase: SupabaseClient): Promise<Map<number, string>> {
  const { data, error } = await supabase.from('market_types').select('id, market_key');

  if (error) throw new Error(`market_types fetch: ${error.message}`);

  const map = new Map<number, string>();
  if (data) {
    for (const row of data) map.set(row.id, row.market_key);
  }

  console.log(`[Data] Loaded ${map.size} market types`);
  return map;
}

// ============================================================================
// Phase 6: Fetch lines from provider_offers
// ============================================================================

async function fetchLines(
  supabase: SupabaseClient,
  eventIds: string[]
): Promise<{ lineMap: Map<string, number>; statIdMap: Map<string, string> }> {
  const lineMap = new Map<string, number>();
  const statIdMap = new Map<string, string>(); // market_key → original SGO statID
  const BATCH = 5; // Small batches for 1.3M row table

  for (let i = 0; i < eventIds.length; i += BATCH) {
    const batch = eventIds.slice(i, i + BATCH);

    // Paginate closing lines for this batch
    let lastId = '';
    while (true) {
      let query = supabase
        .from('provider_offers')
        .select('id, event_id, market_type_id, participant_id, line, meta')
        .in('event_id', batch)
        .eq('is_closing', true)
        .not('line', 'is', null)
        .order('id')
        .limit(1000);

      if (lastId) query = query.gt('id', lastId);

      const { data, error } = await query;
      if (error) {
        console.warn(
          `[Lines] closing fetch error (batch ${Math.floor(i / BATCH)}): ${error.message}`
        );
        break;
      }
      if (!data || data.length === 0) break;

      for (const row of data) {
        const key = `${row.event_id}|${row.market_type_id}|${row.participant_id ?? 'null'}`;
        if (!lineMap.has(key)) {
          lineMap.set(key, row.line);
          const meta = row.meta as Record<string, unknown> | null;
          if (meta?.statID && typeof meta.statID === 'string') {
            statIdMap.set(key, meta.statID);
          }
        }
      }

      lastId = data[data.length - 1].id;
      if (data.length < 1000) break;
    }

    if ((i + BATCH) % 50 === 0 || i + BATCH >= eventIds.length) {
      console.log(
        `[Lines] Progress: ${Math.min(i + BATCH, eventIds.length)}/${eventIds.length} events, ${lineMap.size} lines`
      );
    }
  }

  console.log(
    `[Lines] Resolved ${lineMap.size} unique lines, ${statIdMap.size} statIDs from provider_offers`
  );
  return { lineMap, statIdMap };
}

// ============================================================================
// Phase 7: Fetch SGO events with results
// ============================================================================

async function fetchSGOEventsWithResults(
  dateFrom: string,
  dateTo: string
): Promise<Map<string, SGOEvent>> {
  const sgo = getSGOClient();
  console.log(
    `[SGO] Fetching finalized NBA events ${dateFrom.slice(0, 10)} → ${dateTo.slice(0, 10)} with expandResults...`
  );

  const events = await sgo.fetchAllEvents({
    leagueID: 'NBA',
    finalized: true,
    expandResults: true,
    startsAfter: dateFrom,
    startsBefore: dateTo,
  });

  const map = new Map<string, SGOEvent>();
  for (const event of events) map.set(event.eventID, event);

  console.log(`[SGO] Fetched ${map.size} finalized events`);
  return map;
}

// ============================================================================
// Phase 8: Extract player stats from SGO event-level results
// SGO structure: event.results.game[playerID] = { points: 25, rebounds: 9, ... }
// Player IDs are keys like "JAMES_HARDEN_1_NBA" alongside "home"/"away"/"all"
// ============================================================================

// Normalize SGO results stat names → our stat-resolver column names
const SGO_STAT_NORMALIZE: Record<string, string> = {
  threePointersMade: 'threes',
  // 'points+rebounds+assists' maps to combo fallback in stat-resolver
  // Most names match directly: points, rebounds, assists, steals, blocks, turnovers
};

const TEAM_KEYS = new Set(['away', 'home', 'all']);

interface ExtractionStats {
  totalEvents: number;
  eventsWithResults: number;
  totalPlayerStats: number;
}

function extractStatsFromEvents(sgoEvents: Map<string, SGOEvent>): {
  playerStats: Map<string, Record<string, number>>; // "sgoEventID|sgoPlayerID" → { stat: value }
  extractionStats: ExtractionStats;
} {
  const playerStats = new Map<string, Record<string, number>>();
  let totalEvents = 0,
    eventsWithResults = 0,
    totalPlayerStats = 0;

  for (const [sgoEventID, event] of Array.from(sgoEvents.entries())) {
    totalEvents++;

    // Results are at event level (not on odds entries)
    const eventAny = event as Record<string, unknown>;
    const results = eventAny['results'] as Record<string, unknown> | undefined;
    if (!results) continue;

    // Use 'game' period for full-game player props
    const gameResults = results['game'] as Record<string, Record<string, number>> | undefined;
    if (!gameResults || typeof gameResults !== 'object') continue;

    eventsWithResults++;

    for (const [key, playerData] of Object.entries(gameResults)) {
      if (TEAM_KEYS.has(key)) continue;
      if (typeof playerData !== 'object' || playerData === null) continue;

      totalPlayerStats++;
      const playerKey = `${sgoEventID}|${key}`;
      const normalized: Record<string, number> = {};

      for (const [statName, value] of Object.entries(playerData)) {
        if (typeof value !== 'number' || !isFinite(value)) continue;
        const normalizedName = SGO_STAT_NORMALIZE[statName] ?? statName;
        normalized[normalizedName] = value;
      }

      playerStats.set(playerKey, normalized);
    }
  }

  console.log(`[Extract] ${eventsWithResults}/${totalEvents} events have game results`);
  console.log(`[Extract] ${totalPlayerStats} player-game stat sets extracted`);
  return { playerStats, extractionStats: { totalEvents, eventsWithResults, totalPlayerStats } };
}

// ============================================================================
// Phase 9: Build outcomes
// ============================================================================

function buildOutcomes(
  shadowScores: ShadowScoreRow[],
  canonicalEvents: Map<string, { external_id: string; scheduled_at: string }>,
  participantExternalIds: Map<string, string>,
  marketTypes: Map<number, string>,
  lineMap: Map<string, number>,
  statIdMap: Map<string, string>,
  playerStats: Map<string, Record<string, number>>
): {
  playerGameStats: PlayerGameStatsInsert[];
  propOutcomes: PropOutcomeInsert[];
  scoredOutcomes: ScoredOutcome[];
  unresolvedReasons: Record<string, number>;
} {
  const propOutcomes: PropOutcomeInsert[] = [];
  const scoredOutcomes: ScoredOutcome[] = [];
  const unresolvedReasons: Record<string, number> = {};
  const seenPlayerStats = new Set<string>();
  const playerGameStatsList: PlayerGameStatsInsert[] = [];

  function countUnresolved(reason: string) {
    unresolvedReasons[reason] = (unresolvedReasons[reason] ?? 0) + 1;
  }

  for (const score of shadowScores) {
    if (score.p_final == null) {
      countUnresolved('null_p_final');
      continue;
    }

    const eventInfo = canonicalEvents.get(score.event_id);
    if (!eventInfo) {
      countUnresolved('no_canonical_event');
      continue;
    }

    const sgoEventID = eventInfo.external_id;
    let marketKey = marketTypes.get(score.market_type_id);
    if (!marketKey) {
      countUnresolved('no_market_type');
      continue;
    }

    // For generic props, resolve actual market_key from provider_offers meta.statID
    if (!hasStatMapping(marketKey)) {
      const lineKey = `${score.event_id}|${score.market_type_id}|${score.participant_id ?? 'null'}`;
      const sgoStatID = statIdMap.get(lineKey);
      if (sgoStatID) {
        const resolved = mapSgoStatToMarketKey(sgoStatID);
        if (resolved && hasStatMapping(resolved)) {
          marketKey = resolved;
        } else {
          countUnresolved(`no_stat_mapping:${sgoStatID}`);
          continue;
        }
      } else {
        countUnresolved('no_stat_mapping:no_statid');
        continue;
      }
    }

    // Get line
    const lineKey = `${score.event_id}|${score.market_type_id}|${score.participant_id ?? 'null'}`;
    const line = lineMap.get(lineKey);
    if (line == null) {
      countUnresolved('no_line');
      continue;
    }

    if (!score.participant_id) {
      countUnresolved('null_participant_id');
      continue;
    }

    const sgoPlayerID = participantExternalIds.get(score.participant_id);
    if (!sgoPlayerID) {
      countUnresolved('no_participant_external_id');
      continue;
    }

    // Try numeric stats path (preferred)
    let actual_value: number | null = null;
    let outcome: 'WIN' | 'LOSS' | 'PUSH' | null = null;

    const playerKey = `${sgoEventID}|${sgoPlayerID}`;
    const stats = playerStats.get(playerKey);

    if (stats) {
      const resolution = resolveActualValue(marketKey, stats);
      if (resolution.resolved) {
        actual_value = resolution.actual_value!;
        outcome = resolveOutcome(actual_value, line);

        // Track player_game_stats (one per player per game)
        if (!seenPlayerStats.has(playerKey)) {
          seenPlayerStats.add(playerKey);
          playerGameStatsList.push({
            event_id: score.event_id,
            participant_id: score.participant_id,
            game_date: eventInfo.scheduled_at.slice(0, 10),
            source: 'sgo',
            stats,
          });
        }
      } else {
        // Stats exist but missing columns for this market type
        countUnresolved(`stat_columns_missing:${resolution.missing_columns.join('+')}`);
        continue;
      }
    } else {
      countUnresolved('no_player_stats_from_sgo');
      continue;
    }

    if (outcome === null || actual_value === null) {
      countUnresolved('outcome_computation_failed');
      continue;
    }

    propOutcomes.push({
      market_key: score.market_key,
      event_id: score.event_id,
      market_type_id: score.market_type_id,
      participant_id: score.participant_id,
      line,
      actual_value,
      outcome,
      side: 'over',
      source: 'sgo',
    });

    scoredOutcomes.push({
      market_key: score.market_key,
      event_id: score.event_id,
      market_type_id: score.market_type_id,
      participant_id: score.participant_id,
      p_final: score.p_final!,
      p_market_devig: score.p_market_devig!,
      edge_final: score.edge_final!,
      score: score.score!,
      tier: score.tier!,
      book_count: score.book_count,
      line,
      actual_value,
      outcome,
      market_type_key: marketKey,
    });
  }

  return { playerGameStats: playerGameStatsList, propOutcomes, scoredOutcomes, unresolvedReasons };
}

// ============================================================================
// Phase 10: DB inserts
// ============================================================================

async function insertPlayerGameStats(
  supabase: SupabaseClient,
  rows: PlayerGameStatsInsert[]
): Promise<number> {
  if (DRY_RUN || rows.length === 0) return rows.length;
  let inserted = 0;
  const BATCH = 500;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from('player_game_stats')
      .upsert(batch, { onConflict: 'event_id,participant_id' });

    if (error)
      console.warn(`[DB] player_game_stats batch ${Math.floor(i / BATCH)}: ${error.message}`);
    else inserted += batch.length;
  }

  return inserted;
}

async function insertPropOutcomes(
  supabase: SupabaseClient,
  rows: PropOutcomeInsert[]
): Promise<number> {
  if (DRY_RUN || rows.length === 0) return rows.length;
  let inserted = 0;
  const BATCH = 500;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from('prop_outcomes')
      .upsert(batch, { onConflict: 'market_key' });

    if (error) console.warn(`[DB] prop_outcomes batch ${Math.floor(i / BATCH)}: ${error.message}`);
    else inserted += batch.length;
  }

  return inserted;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  SPRINT-029: Outcome Backfill Runner`);
  console.log(`  OUT_DIR: ${OUT_DIR}`);
  console.log(`  PROBE_ONLY: ${PROBE_ONLY}, DRY_RUN: ${DRY_RUN}`);
  console.log(`${'='.repeat(60)}\n`);

  // Phase 1: Probe SGO results structure
  const probe = await probeSGOResults();
  fs.writeFileSync(path.join(OUT_DIR, 'SGO_RESULTS_PROBE.json'), JSON.stringify(probe, null, 2));
  console.log(`[Probe] Written to SGO_RESULTS_PROBE.json\n`);

  if (PROBE_ONLY) {
    console.log('[Done] PROBE_ONLY mode — exiting.');
    return;
  }

  const supabase = getSupabase();

  // Phase 2: Fetch shadow scores
  const shadowScores = await fetchShadowScores(supabase);
  const uniqueEventIds = Array.from(new Set(shadowScores.map(s => s.event_id)));
  const uniqueParticipantIds = Array.from(
    new Set(shadowScores.map(s => s.participant_id).filter((id): id is string => id != null))
  );
  console.log(
    `[Data] ${uniqueEventIds.length} unique events, ${uniqueParticipantIds.length} unique participants\n`
  );

  // Phase 3–6: Fetch reference data in sequence
  const canonicalEvents = await fetchCanonicalEvents(supabase, uniqueEventIds);
  const participantExternalIds = await fetchParticipantExternalIds(supabase, uniqueParticipantIds);
  const marketTypes = await fetchMarketTypes(supabase);
  const { lineMap, statIdMap } = await fetchLines(supabase, uniqueEventIds);
  console.log('');

  // Phase 7: Determine date range and fetch SGO events
  const dates = Array.from(canonicalEvents.values())
    .map(e => e.scheduled_at)
    .sort();
  if (dates.length === 0) {
    console.error('[FATAL] No canonical events with external_id found. Cannot proceed.');
    console.error('[HINT] Run the SGO historical backfill first (Sprint 027A).');
    // Write diagnostic artifact
    fs.writeFileSync(
      path.join(OUT_DIR, 'OUTCOME_SUMMARY.json'),
      JSON.stringify(
        {
          total_shadow_scores: shadowScores.length,
          total_outcomes_resolved: 0,
          join_rate_pct: 0,
          unresolved_count: shadowScores.length,
          unresolved_reasons: { no_canonical_events_with_external_id: shadowScores.length },
          player_game_stats_count: 0,
          unique_events: uniqueEventIds.length,
          unique_participants: uniqueParticipantIds.length,
        },
        null,
        2
      )
    );
    return;
  }

  const dateFrom = new Date(new Date(dates[0]).getTime() - 2 * 86400000).toISOString();
  const dateTo = new Date(new Date(dates[dates.length - 1]).getTime() + 2 * 86400000).toISOString();
  console.log(
    `[Dates] Event range: ${dates[0].slice(0, 10)} → ${dates[dates.length - 1].slice(0, 10)}`
  );

  const sgoEvents = await fetchSGOEventsWithResults(dateFrom, dateTo);

  // Match SGO events to our canonical events
  const sgoToCanonical = new Map<string, string>(); // sgoEventID → our event_id
  for (const [eventId, info] of Array.from(canonicalEvents.entries())) {
    sgoToCanonical.set(info.external_id, eventId);
  }
  let matchedEvents = 0;
  for (const sgoEventID of Array.from(sgoEvents.keys())) {
    if (sgoToCanonical.has(sgoEventID)) matchedEvents++;
  }
  console.log(
    `[Match] ${matchedEvents} / ${canonicalEvents.size} canonical events found in SGO results\n`
  );

  // Phase 8: Extract stats from SGO event-level results
  const { playerStats, extractionStats } = extractStatsFromEvents(sgoEvents);
  console.log('');

  // Phase 9: Build outcomes
  const { playerGameStats, propOutcomes, scoredOutcomes, unresolvedReasons } = buildOutcomes(
    shadowScores,
    canonicalEvents,
    participantExternalIds,
    marketTypes,
    lineMap,
    statIdMap,
    playerStats
  );

  const joinRate = shadowScores.length > 0 ? (propOutcomes.length / shadowScores.length) * 100 : 0;

  console.log(`\n${'─'.repeat(40)}`);
  console.log(
    `[Results] Outcomes resolved: ${propOutcomes.length} / ${shadowScores.length} (${joinRate.toFixed(1)}%)`
  );
  console.log(`[Results] Player game stats: ${playerGameStats.length}`);
  console.log(`[Results] Unresolved reasons:`);
  for (const [reason, count] of Object.entries(unresolvedReasons).sort((a, b) => b[1] - a[1])) {
    console.log(`           ${reason}: ${count}`);
  }

  // Phase 10: Insert into DB
  if (!DRY_RUN && propOutcomes.length > 0) {
    const pgsInserted = await insertPlayerGameStats(supabase, playerGameStats);
    const poInserted = await insertPropOutcomes(supabase, propOutcomes);
    console.log(`\n[DB] Inserted: ${pgsInserted} player_game_stats, ${poInserted} prop_outcomes`);
  } else if (DRY_RUN) {
    console.log('\n[DB] DRY_RUN — skipping inserts');
  }

  // Phase 11: Performance report
  const report = scoredOutcomes.length > 0 ? generatePerformanceReport(scoredOutcomes) : null;

  if (report) {
    console.log(`\n${'─'.repeat(40)}`);
    console.log(`[Report] Total: ${report.overall.total} markets`);
    console.log(`  Hit rate (over): ${report.overall.hit_rate_pct}%`);
    console.log(`  Directional accuracy: ${report.overall.directional_accuracy_pct}%`);
    console.log(`  Flat-bet ROI (-110): ${report.overall.flat_bet_roi_pct}%`);
    console.log(`\n  By market type:`);
    for (const b of report.by_market_type.slice(0, 10)) {
      console.log(`    ${b.label}: ${b.count} props, ${b.hit_rate_pct}% hit, ${b.roi_pct}% ROI`);
    }
    console.log(`\n  By p_final bin:`);
    for (const b of report.by_p_final_bin) {
      console.log(`    ${b.label}: ${b.count} props, ${b.hit_rate_pct}% hit, ${b.roi_pct}% ROI`);
    }
  }

  // Phase 12: Write artifacts
  const summary: OutcomeSummary = {
    total_shadow_scores: shadowScores.length,
    total_outcomes_resolved: propOutcomes.length,
    join_rate_pct: round(joinRate, 2),
    unresolved_count: shadowScores.length - propOutcomes.length,
    unresolved_reasons: unresolvedReasons,
    player_game_stats_count: playerGameStats.length,
    unique_events: uniqueEventIds.length,
    unique_participants: uniqueParticipantIds.length,
  };

  fs.writeFileSync(path.join(OUT_DIR, 'OUTCOME_SUMMARY.json'), JSON.stringify(summary, null, 2));

  if (report) {
    fs.writeFileSync(
      path.join(OUT_DIR, 'PERFORMANCE_REPORT.json'),
      JSON.stringify(report, null, 2)
    );
  }

  // Unresolved markets sample
  const resolvedKeys = new Set(propOutcomes.map(o => o.market_key));
  const unresolvedSample = shadowScores
    .filter(s => !resolvedKeys.has(s.market_key))
    .slice(0, 100)
    .map(s => ({
      market_key: s.market_key,
      event_id: s.event_id,
      market_type_id: s.market_type_id,
      participant_id: s.participant_id,
    }));

  fs.writeFileSync(
    path.join(OUT_DIR, 'UNRESOLVED_MARKETS.json'),
    JSON.stringify(
      {
        count: shadowScores.length - propOutcomes.length,
        reasons: unresolvedReasons,
        sample: unresolvedSample,
      },
      null,
      2
    )
  );

  fs.writeFileSync(
    path.join(OUT_DIR, 'PROMOTED_WITH_OUTCOMES.json'),
    JSON.stringify(
      {
        note: 'All scored outcomes (not filtered by pick engine)',
        count: scoredOutcomes.length,
        sample: scoredOutcomes.slice(0, 100),
        extraction_stats: extractionStats,
      },
      null,
      2
    )
  );

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Artifacts written to ${OUT_DIR}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`\n[Pass Criteria]`);
  console.log(`  Join rate: ${joinRate.toFixed(1)}% (target: ≥95%)`);
  console.log(`  player_game_stats: ${playerGameStats.length} (target: >0)`);
  console.log(`  prop_outcomes: ${propOutcomes.length} (target: >0)`);
  console.log(`  Artifacts: 5/5 written`);
}

function round(v: number, d: number): number {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

main().catch(err => {
  console.error('\n[FATAL]', err);
  process.exit(1);
});
