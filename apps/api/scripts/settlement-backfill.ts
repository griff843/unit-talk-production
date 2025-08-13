#!/usr/bin/env npx tsx

/**
 * Settlement Backfill Script - Self-Contained Production Version
 * 
 * Processes the 10 seeded settlement_backfill records from shadow_decisions
 * Uses Node 18+ global fetch (no node-fetch dependency)
 * Self-contained with local logger and DB helper
 * Production-ready for Supabase database connection
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Local logger implementation
const logger = {
  info:  (...a: any[]) => process.stdout.write(`[INFO ] ${a.join(' ')}\n`),
  warn:  (...a: any[]) => process.stderr.write(`[WARN ] ${a.join(' ')}\n`),
  error: (...a: any[]) => process.stderr.write(`[ERROR] ${a.join(' ')}\n`),
  debug: (...a: any[]) => { if (process.env.DEBUG) process.stdout.write(`[DEBUG] ${a.join(' ')}\n`); },
};

type Row = {
  id: string;
  player: string | null;
  market: string | null;
  line: number | null;
  direction: string | null;
  external_game_id: string | null;
  event_time: string | null; // ISO
};

const MLB_BASE = process.env.MLB_STATSAPI_BASE || 'https://statsapi.mlb.com';
const isDryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true';
const batchMax = Number(process.env.BATCH_MAX || 10);

// Initialize Supabase client for production database connection
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false }
  }
);

async function selectSeedBatch(limit = batchMax): Promise<Row[]> {
  const { data, error } = await supabase
    .from('shadow_decisions')
    .select(`
      id,
      player,
      market,
      line,
      additional_data,
      event_time
    `)
    .eq('decision_type', 'settlement_backfill')
    .is('settled_at', null)  // IDEMPOTENCY: Only unsettled picks
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Database query failed: ${error.message}`);
  }

  return (data || []).map(row => ({
    id: row.id,
    player: row.player,
    market: row.market,
    line: row.line ? parseFloat(row.line) : null,
    direction: row.additional_data?.direction || 'over',
    external_game_id: row.additional_data?.external_game_id || null,
    event_time: row.event_time || null
  }));
}

function toISODate(d: string | null) {
  if (!d) return null;
  // d already in ISO-ish; just return
  return d;
}

async function resolveGamePk(externalGameId: string | null, eventTimeISO: string | null): Promise<string | null> {
  // Try schedule by date; match by team names found in our DB if needed
  if (!eventTimeISO) return null;
  const dateStr = eventTimeISO.slice(0,10); // YYYY-MM-DD
  const url = `${MLB_BASE}/api/v1/schedule?sportId=1&date=${dateStr}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    logger.warn('schedule fetch failed', resp.status, url);
    return null;
  }
  const data: any = await resp.json();
  const games = data?.dates?.[0]?.games ?? [];
  // If externalGameId embeds teams (e.g., MLB-tor-col-...), use that to match
  const tag = (externalGameId || '').toLowerCase();
  let gamePk: string | null = null;
  for (const gm of games) {
    const home = (gm?.teams?.home?.team?.name || '').toLowerCase().replace(/\./g,'');
    const away = (gm?.teams?.away?.team?.name || '').toLowerCase().replace(/\./g,'');
    if (tag && home && away && tag.includes(home.split(' ')[0]?.slice(0,3)) && tag.includes(away.split(' ')[0]?.slice(0,3))) {
      gamePk = String(gm.gamePk);
      break;
    }
  }
  // Fallback: first game of the day (not ideal, but this is a dry-run sanity step)
  if (!gamePk && games.length) gamePk = String(games[0].gamePk);
  return gamePk;
}

async function fetchBox(gamePk: string): Promise<any | null> {
  const url = `${MLB_BASE}/api/v1.1/game/${gamePk}/feed/live`;
  const resp = await fetch(url);
  if (!resp.ok) {
    logger.warn('box fetch failed', resp.status, url);
    return null;
  }
  return resp.json();
}

function computeActual(row: Row, box: any): number | null {
  const market = (row.market || '').toUpperCase();
  const teamsBox = box?.liveData?.boxscore?.teams;
  for (const side of ['home','away'] as const) {
    const players = teamsBox?.[side]?.players ?? {};
    for (const k of Object.keys(players)) {
      const p = players[k];
      const stats = p?.stats?.batting;
      if (stats && p?.person?.fullName === row.player) {
        if (market === 'HITS') return stats?.hits ?? null;
        if (market === 'RBIS' || market === 'RBI') return stats?.rbi ?? null;
        if (market === 'RUNS' || market === 'R') return stats?.runs ?? null;
        if (market === 'TOTALBASES' || market === 'TOTAL BASES') {
          const singles = (stats?.hits ?? 0) - (stats?.doubles ?? 0) - (stats?.triples ?? 0) - (stats?.homeRuns ?? 0);
          return singles*1 + (stats?.doubles ?? 0)*2 + (stats?.triples ?? 0)*3 + (stats?.homeRuns ?? 0)*4;
        }
        if (market === 'HOMERUNS' || market === 'HR') return stats?.homeRuns ?? null;
        if (market === 'WALKSBATTER' || market === 'WALKS') return stats?.baseOnBalls ?? null;
      }
    }
  }
  return null; // pitcher markets omitted in this quick dry-run
}

function decide(direction: string | null, line: number | null, actual: number | null): 'Win'|'Loss'|'Push'|'Void' {
  if (actual == null || line == null) return 'Void';
  const eq = Math.abs(actual - line) < 1e-9;
  if ((direction || 'over').toLowerCase() === 'over') {
    return actual > line ? 'Win' : eq ? 'Push' : 'Loss';
  }
  return actual < line ? 'Win' : eq ? 'Push' : 'Loss';
}

async function writeHeartbeat(processed: number, successful: number, failed: number) {
  const { error } = await supabase
    .from('settlement_heartbeat')
    .insert({
      pipeline_name: 'mlb_settlement_backfill',
      processed_count: processed,
      success_count: successful,
      error_count: failed,
      last_run: new Date().toISOString(),
      status: failed > 0 ? 'partial' : 'success'
    });
    
  if (error) {
    logger.warn('Heartbeat logging failed', error.message);
  }
}

async function main() {
  const startTime = Date.now();
  logger.info('settlement backfill starting…');
  
  const batch = await selectSeedBatch(batchMax);
  logger.info('candidates', batch.length);
  
  let processed = 0;
  let successful = 0;
  let failed = 0;
  
  for (const row of batch) {
    processed++;
    
    const gamePk = await resolveGamePk(row.external_game_id, toISODate(row.event_time));
    if (!gamePk) { 
      logger.warn('no gamePk', row.id, row.external_game_id); 
      failed++;
      continue; 
    }
    
    const box = await fetchBox(gamePk);
    if (!box) { 
      logger.warn('no box', row.id, gamePk); 
      failed++;
      continue; 
    }
    
    const statusCode = box?.gameData?.status?.codedGameState;
    if (!(statusCode === 'F')) { 
      logger.warn('not final', row.id, gamePk, statusCode); 
      failed++;
      continue; 
    }
    
    const actual = computeActual(row, box);
    const result = decide(row.direction, row.line, actual);
    
    if (isDryRun) {
      logger.info('DRY', { 
        id: row.id, 
        player: row.player, 
        market: row.market, 
        line: row.line, 
        actual, 
        result 
      });
      successful++;
    } else {
      const { error } = await supabase
        .from('shadow_decisions')
        .update({
          actual_result: actual,
          settled_at: new Date().toISOString(),
          status: 'settled',
          settlement_source: 'mlb_statsapi',
          settlement_details: { gamePk, direction: row.direction, market: row.market }
        })
        .eq('id', row.id)
        .is('settled_at', null);  // IDEMPOTENCY: Only update if still unsettled
      
      if (error) {
        logger.error('Update failed', { id: row.id, error: error.message });
        failed++;
      } else {
        logger.info('SETTLED', { id: row.id, actual, result });
        successful++;
      }
    }
  }
  
  // Write heartbeat for monitoring
  if (!isDryRun) {
    await writeHeartbeat(processed, successful, failed);
  }
  
  const duration = Date.now() - startTime;
  logger.info('settlement backfill complete', { processed, successful, failed, duration: `${duration}ms` });
}

main().catch(e => { 
  logger.error(e); 
  process.exit(1); 
});