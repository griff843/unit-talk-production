import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Duplicate data audit (live):
// - approval_queue: more than one pending per unified_id is a problem
// - alerts_queue: identical (unified_id,type,last_sent_hash) duplicates in last 6h indicate dedupe failure

function ensureDir(p: string) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

async function main() {
  const outDir = path.resolve(process.cwd(), 'out', 'db');
  ensureDir(outDir);

  const url = process.env.SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const result: any = {
    ok: false,
    checks: {
      approval_pending_duplicates: 0,
      alerts_recent_duplicates: 0,
    },
    details: {},
    timestamp: new Date().toISOString(),
  };

  try {
    if (!url || !service) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    const db = createClient(url, service);

    // 1) approval_queue pending duplicates by unified_id
    const { data: pending, error: pErr } = await db
      .from('approval_queue')
      .select('unified_id, status')
      .eq('status', 'pending')
      .limit(5000);
    if (pErr) throw pErr;
    const countByUnified: Record<string, number> = {};
    for (const r of pending || []) {
      countByUnified[r.unified_id] = (countByUnified[r.unified_id] || 0) + 1;
    }
    const pendingDupIds = Object.entries(countByUnified).filter(([_id, c]) => c > 1).map(([id]) => id);
    result.checks.approval_pending_duplicates = pendingDupIds.length;
    result.details.approval_pending_dup_ids = pendingDupIds;

    // 2) alerts_queue recent duplicates
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: alerts, error: aErr } = await db
      .from('alerts_queue')
      .select('unified_id, type, last_sent_hash, created_at')
      .gte('created_at', since)
      .limit(5000);
    if (aErr) throw aErr;
    const seen = new Set<string>();
    const dup = new Set<string>();
    for (const a of alerts || []) {
      const key = `${a.unified_id}|${a.type}|${a.last_sent_hash || ''}`;
      if (seen.has(key)) dup.add(key); else seen.add(key);
    }
    result.checks.alerts_recent_duplicates = dup.size;
    result.details.alerts_recent_dup_keys = Array.from(dup);

    result.ok = result.checks.approval_pending_duplicates === 0 && result.checks.alerts_recent_duplicates === 0;
  } catch (e: any) {
    result.error = e?.message || String(e);
  }

  fs.writeFileSync(path.join(outDir, 'dup-audit.json'), JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
  console.log('Duplicate audit (live) complete');
}

main().catch(err => { console.error(err); process.exitCode = 1; });
