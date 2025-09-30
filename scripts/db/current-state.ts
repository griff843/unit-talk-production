#!/usr/bin/env ts-node
/**
 * Current State Reporter
 * - Summarizes unified_picks hot/warm/cold counts based on historical_config
 * - Reports last archival run if present in runtime_config
 * - Writes to out/ops/current-state.json
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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OUT_DIR = path.resolve(process.cwd(), 'out', 'ops');
const OUT_PATH = path.join(OUT_DIR, 'current-state.json');

function ensureDir() { fs.mkdirSync(OUT_DIR, { recursive: true }); }

async function getConfig(): Promise<{ hot_days: number; archive_days: number }> {
  const { data, error } = await (supabase as any)
    .from('historical_config')
    .select('hot_days,archive_days')
    .eq('id', 1)
    .maybeSingle();
  if (error) {
    return { hot_days: 14, archive_days: 365 };
  }
  const d = data || {} as any;
  return { hot_days: Number(d.hot_days) || 14, archive_days: Number(d.archive_days) || 365 };
}

async function countRange(column = 'created_at', gte?: string, lt?: string): Promise<number> {
  let q = (supabase as any).from('unified_picks').select('id', { count: 'exact', head: true });
  if (gte) q = q.gte(column, gte);
  if (lt) q = q.lt(column, lt);
  const { count, error } = await q;
  if (error) return 0;
  return count || 0;
}

async function getLastArchivalRun(): Promise<string | null> {
  const { data, error } = await (supabase as any)
    .from('runtime_config')
    .select('value')
    .eq('key', 'last_archival_run')
    .maybeSingle();
  if (error) return null;
  return (data?.value as string) || null;
}

async function main() {
  const cfg = await getConfig();
  const now = new Date();
  const hotSince = new Date(now.getTime() - cfg.hot_days * 24 * 3600 * 1000);
  const coldBefore = new Date(now.getTime() - cfg.archive_days * 24 * 3600 * 1000);

  const [hot, warm, cold, lastArchival] = await Promise.all([
    countRange('created_at', hotSince.toISOString(), undefined),
    countRange('created_at', coldBefore.toISOString(), hotSince.toISOString()),
    countRange('created_at', undefined, coldBefore.toISOString()),
    getLastArchivalRun(),
  ]);

  const payload = {
    generatedAt: now.toISOString(),
    config: cfg,
    counts: { hot, warm, cold },
    lastArchivalRun: lastArchival,
  };

  ensureDir();
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf-8');
  console.log('✅ Wrote', OUT_PATH);
}

main().catch(err => { console.error('❌ current-state failed:', err); process.exit(1); });

