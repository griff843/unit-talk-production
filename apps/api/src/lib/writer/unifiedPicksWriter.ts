/**
 * Unified Picks Writer - Supabase Cloud Edition
 *
 * Writes picks to unified_picks table with dedup tracking and diagnostics
 * Uses upsert with ignoreDuplicates to handle deduplication
 */

import { supabase } from '../db/supabaseClient';
import fs from 'node:fs';
import path from 'node:path';

export type UnifiedPickInput = {
  game_id?: string | null;
  sport: string;                  // 'mlb'
  market: 'h2h' | 'spreads' | 'totals' | 'player_props';
  selection: string;
  odds: number;
  line?: number | null;
  bookmaker_key: string;
  game_date: string;              // ISO timestamptz
  source?: 'odds-api';
  posted_at?: string;
  user_id?: string | null;        // Cloud requires NOT NULL
  pick_type?: string;             // Cloud requires NOT NULL
  stake?: number;                 // Cloud requires NOT NULL
  potential_payout?: number;      // Cloud requires NOT NULL
};

export type WriteResult = {
  attemptedWrites: number;
  inserted: number;
  skippedDedup: number;
  errors: number;
  sampleFile?: string;
  reasons?: string[];
};

const OUT_DIR = process.env.OPS_OUT_DIR || path.join(process.cwd(), 'apps/api/out/ops');

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function uniqKey(p: UnifiedPickInput) {
  // Must mirror the DB unique index:
  // (source, market, selection, bookmaker_key, game_date, coalesce(line,-9999), coalesce(game_id, '0000...'))
  const source = p.source ?? 'odds-api';
  const lineVal = p.line ?? -9999;
  const gid = p.game_id ?? '00000000-0000-0000-0000-000000000000';
  return [source, p.market, p.selection, p.bookmaker_key, p.game_date, lineVal, gid].join('|');
}

export async function writeUnifiedPicks(rows: UnifiedPickInput[], runId: string): Promise<WriteResult> {
  ensureDir(OUT_DIR);
  const res: WriteResult = {
    attemptedWrites: rows.length,
    inserted: 0,
    skippedDedup: 0,
    errors: 0,
    reasons: [],
  };

  if (!rows.length) return res;

  // Normalize defaults (Cloud schema has additional NOT NULL constraints)
  const SYS_UID = process.env.SYSTEM_USER_ID || '00000000-0000-0000-0000-000000000001';
  const normalized = rows.map(r => ({
    ...r,
    source: r.source ?? 'odds-api',
    posted_at: r.posted_at ?? new Date().toISOString(),
    line: r.line ?? null,
    user_id: r.user_id ?? SYS_UID,  // Use system user for automated picks
    pick_type: r.pick_type ?? 'single',
    stake: r.stake ?? 1,
    potential_payout: r.potential_payout ?? (r.stake ?? 1) * (r.odds > 0 ? (1 + r.odds / 100) : (1 - 100 / r.odds)),
  }));

  // Upsert in small batches to avoid payload limits
  const BATCH = Number(process.env.ODDS_FEED_BATCH || 20);
  for (let i = 0; i < normalized.length; i += BATCH) {
    const chunk = normalized.slice(i, i + BATCH);

    // Upsert using fingerprint unique constraint
    // onConflict needs the column(s) that make up the unique index
    const { data, error, status } = await supabase
      .from('unified_picks')
      .upsert(chunk, { ignoreDuplicates: true })
      .select('id');

    if (error) {
      res.errors += chunk.length;
      res.reasons?.push(`upsert_error_${status}:${error.message}`);
      // Dump one sample payload for debugging
      if (!res.sampleFile) {
        const fp = path.join(OUT_DIR, `feedagent-sample-payload-${runId}.json`);
        fs.writeFileSync(fp, JSON.stringify({ chunk, error: error.message }, null, 2));
        res.sampleFile = fp;
      }
      continue;
    }

    // Supabase returns inserted IDs only for rows that changed; deduped ones not returned
    const insertedCount = Array.isArray(data) ? data.length : 0;
    res.inserted += insertedCount;
    res.skippedDedup += (chunk.length - insertedCount);
  }

  return res;
}
