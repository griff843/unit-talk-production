import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Live RLS audit:
// - Using ANON key, attempt write to protected tables and expect failure
// - Using SERVICE key, verify views relation to approvals

function ensureDir(p: string) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

async function main() {
  const outDir = path.resolve(process.cwd(), 'out', 'db');
  ensureDir(outDir);

  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const result: any = {
    ok: false,
    mode: 'live',
    anonWriteBlocked: false,
    postableViewAligned: false,
    checks: {},
    timestamp: new Date().toISOString()
  };

  try {
    if (!url || !anon || !service) {
      throw new Error('Missing SUPABASE_URL or keys (ANON and SERVICE required)');
    }

    // 1) RLS: anon insert to unified_picks should fail
    const anonClient = createClient(url, anon);
    const { error: anonErr } = await anonClient
      .from('unified_picks')
      .insert({ tier: 'C', score: 0, prediction: 'test', sport: 'TEST', created_at: new Date().toISOString() });

    result.anonWriteBlocked = !!anonErr;
    result.checks.anonInsertError = anonErr ? (anonErr.message || String(anonErr)) : null;

    // 2) Approvals → postable view alignment
    const svc = createClient(url, service);
    const { data: approvals, error: apprErr } = await svc
      .from('approval_queue')
      .select('id')
      .eq('status', 'approved')
      .limit(1);
    if (apprErr) throw apprErr;

    const { data: postable, error: viewErr } = await svc
      .from('view_postable_unified_picks')
      .select('id')
      .limit(1);

    // If there are approvals, view should not be empty
    const approvalsExist = (approvals?.length || 0) > 0;
    const postableNonEmpty = (postable?.length || 0) > 0;
    result.postableViewAligned = approvalsExist ? postableNonEmpty : true;

    result.ok = result.anonWriteBlocked && result.postableViewAligned;
  } catch (e: any) {
    result.mode = 'error';
    result.error = e?.message || String(e);
  }

  const outPath = path.join(outDir, 'rls-audit.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
  console.log(`RLS audit complete → ok=${result.ok}`);
}

main().catch(err => { console.error(err); process.exitCode = 1; });
