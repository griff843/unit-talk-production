#!/usr/bin/env ts-node
/**
 * Raw Props -> Unified Picks migration (idempotent, resumable)
 *
 * - Reads raw_props in batches (default 5000)
 * - If raw_props is a VIEW, exits early with a clear message
 * - Upserts into unified_picks on (external_game_id, external_prop_id)
 * - Conservative column mapping; preserves provider 'source'
 * - Writes checkpoints and stats to out/db/migrate_raw_props.log.json
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const OUT_DIR = path.resolve(process.cwd(), 'out', 'db');
const LOG_PATH = path.join(OUT_DIR, 'migrate_raw_props.log.json');

function ensureOutDir() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

interface Checkpoint {
  startedAt: string;
  completedAt?: string;
  batchSize: number;
  lastOffset: number;
  batchesProcessed: number;
  rowsRead: number;
  rowsUpserted: number;
  skippedReason?: string;
}

function loadCheckpoint(): Checkpoint | null {
  try {
    const raw = fs.readFileSync(LOG_PATH, 'utf-8');
    return JSON.parse(raw) as Checkpoint;
  } catch {
    return null;
  }
}

function saveCheckpoint(cp: Checkpoint) {
  ensureOutDir();
  fs.writeFileSync(LOG_PATH, JSON.stringify(cp, null, 2) + '\n', 'utf-8');
}

async function isRawPropsBaseTable(): Promise<boolean> {
  const { data, error } = await (supabase as any)
    .from('information_schema.tables')
    .select('table_schema,table_name,table_type')
    .eq('table_schema', 'public')
    .eq('table_name', 'raw_props')
    .single();
  if (error) {
    console.warn('Could not determine raw_props type; assuming BASE TABLE. Error:', error.message);
    return true;
  }
  return data?.table_type === 'BASE TABLE';
}

function coalesce<T>(...vals: (T | null | undefined)[]): T | null {
  for (const v of vals) if (v !== undefined && v !== null && (v as any) !== '') return v as T;
  return null;
}

function toInt(n: any): number | null {
  if (n === null || n === undefined) return null;
  const x = Number(n);
  return Number.isFinite(x) ? Math.trunc(x) : null;
}

function toNumeric(n: any): number | null {
  if (n === null || n === undefined) return null;
  const x = Number(n);
  return Number.isFinite(x) ? x : null;
}

function mapRowToUnified(row: any): any {
  const side = coalesce<string>(row.outcome, row.side);
  const odds = coalesce<number>(row.odds, side?.toLowerCase() === 'over' ? row.over_odds : side?.toLowerCase() === 'under' ? row.under_odds : row.over_odds ?? row.under_odds);

  const external_prop_id = coalesce<string>(row.external_id, row.id?.toString());
  const external_game_id = coalesce<string>(row.external_game_id, row.game_id?.toString());

  if (!external_prop_id || !external_game_id) {
    return null; // skip rows we cannot reconcile idempotently
  }

  const mapped = {
    external_game_id,
    external_prop_id,
    sport: coalesce<string>(row.sport) || 'unknown',
    league: coalesce<string>(row.league),
    market: coalesce<string>(row.market_type, row.stat_type) || 'unknown',
    submarket: coalesce<string>(row.bet_type, row.submarket),
    player_name: coalesce<string>(row.player_name),
    team: coalesce<string>(row.team),
    matchup: coalesce<string>(row.matchup, row.opponent),
    game_date: coalesce<string>(row.game_time, row.start_time, row.created_at),
    side: side || null,
    line: toNumeric(row.line),
    price: toInt(odds),
    implied_prob: null,
    source: coalesce<string>(row.provider, row.source) || 'unknown',
    posted_at: coalesce<string>(row.created_at, row.inserted_at) || new Date().toISOString(),
    promoted: false,
    outcome: coalesce<string>(row.outcome),
    meta: {
      raw_id: row.id || null,
      raw_external_id: row.external_id || null,
      raw_market: row.market_type || row.stat_type || null,
      raw_payload_present: !!row.payload,
    },
  } as any;

  return mapped;
}

async function upsertBatch(rows: any[]): Promise<number> {
  const payload = rows
    .map(mapRowToUnified)
    .filter(Boolean);

  if (payload.length === 0) return 0;

  // Upsert on unique index (external_game_id, external_prop_id)
  const { error } = await (supabase as any)
    .from('unified_picks')
    .upsert(payload, { onConflict: 'external_game_id,external_prop_id' });

  if (error) throw new Error('Upsert failed: ' + error.message);
  return payload.length;
}

async function migrate(): Promise<void> {
  if (!(await isRawPropsBaseTable())) {
    const cp: Checkpoint = {
      startedAt: new Date().toISOString(),
      batchSize: BATCH_SIZE,
      lastOffset: 0,
      batchesProcessed: 0,
      rowsRead: 0,
      rowsUpserted: 0,
      skippedReason: 'raw_props is a VIEW; migration not required.',
      completedAt: new Date().toISOString(),
    };
    saveCheckpoint(cp);
    console.log('✅ raw_props is a view; nothing to migrate.');
    return;
  }

  let cp = loadCheckpoint();
  if (!cp) {
    cp = {
      startedAt: new Date().toISOString(),
      batchSize: BATCH_SIZE,
      lastOffset: 0,
      batchesProcessed: 0,
      rowsRead: 0,
      rowsUpserted: 0,
    };
  }

  let offset = cp.lastOffset || 0;
  let totalUpserted = cp.rowsUpserted || 0;
  let totalRead = cp.rowsRead || 0;

  for (;;) {
    console.log(`📦 Reading batch at offset ${offset} (size ${BATCH_SIZE})...`);
    const { data, error } = await (supabase as any)
      .from('raw_props')
      .select('*')
      .order('created_at', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) throw new Error('Select failed: ' + error.message);

    const rows: any[] = data || [];
    const read = rows.length;
    if (read === 0) {
      console.log('✅ No more rows to migrate.');
      break;
    }

    totalRead += read;

    const upserted = await upsertBatch(rows);
    totalUpserted += upserted;

    offset += read;
    cp = { ...cp, lastOffset: offset, batchesProcessed: (cp.batchesProcessed || 0) + 1, rowsRead: totalRead, rowsUpserted: totalUpserted };
    saveCheckpoint(cp);
    console.log(`⬆️  Upserted ${upserted} rows (total ${totalUpserted})`);

    if (read < BATCH_SIZE) {
      console.log('✅ Final batch processed.');
      break;
    }
  }

  cp.completedAt = new Date().toISOString();
  saveCheckpoint(cp);
  console.log('🏁 Migration complete.');
}

const BATCH_SIZE = parseInt(process.env.MIGRATE_BATCH_SIZE || '5000', 10);

migrate().catch(err => {
  console.error('❌ Migration failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});

