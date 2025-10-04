/**
 * ScoringAgent - Minimal Smoke Test Version
 *
 * Safe non-destructive operations for E2E validation
 * Queries recent picks but makes no schema changes
 */

import fs from 'node:fs';
import path from 'node:path';
import { supabase } from '../../lib/db/supabaseClient';

const OUT_DIR = process.env.OPS_OUT_DIR || path.join(process.cwd(), 'apps/api/out/ops');

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

export async function runScoringAgent(runId: string) {
  ensureDir(OUT_DIR);
  ensureDir(path.join(OUT_DIR, 'agents'));

  console.log('🎯 ScoringAgent: Querying recent picks...');

  // Query picks from last 24h to next 72h (safe read-only)
  const { data, error } = await supabase
    .from('unified_picks')
    .select('id, sport, market, selection')
    .gte('game_date', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    .lte('game_date', new Date(Date.now() + 72 * 3600 * 1000).toISOString())
    .limit(500);

  if (error) {
    console.error('❌ ScoringAgent: Query error:', error.message);
    const ids = [];
    const updated = 0;
    const outFile = path.join(OUT_DIR, `agents/scoringagent-${runId}.json`);
    fs.writeFileSync(outFile, JSON.stringify({ runId, considered: ids.length, updated, error: error.message }, null, 2));
    return { considered: ids.length, updated, outFile, error: error.message };
  }

  const ids = (data ?? []).map(d => d.id);
  console.log(`📊 ScoringAgent: Found ${ids.length} picks to consider`);

  // For smoke test: no actual updates (keep safe)
  const updated = 0;
  console.log(`✅ ScoringAgent: Smoke test complete (no updates made)`);

  const outFile = path.join(OUT_DIR, `agents/scoringagent-${runId}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ runId, considered: ids.length, updated }, null, 2));

  return { considered: ids.length, updated, outFile };
}
