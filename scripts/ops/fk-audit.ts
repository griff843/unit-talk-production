import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Foreign key audit (live):
// - Attempt to insert child rows with non-existent parents and expect FK violation

function ensureDir(p: string) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

async function main() {
  const outDir = path.resolve(process.cwd(), 'out', 'db');
  ensureDir(outDir);

  const url = process.env.SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const result: any = {
    ok: false,
    checks: {
      unified_picks_user_fk_enforced: false,
      approval_queue_unified_fk_enforced: false,
    },
    timestamp: new Date().toISOString(),
  };

  try {
    if (!url || !service) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    const db = createClient(url, service);

    const ORG_ID = '00000000-0000-0000-0000-000000000000';

    // 1) unified_picks.user_id should reference users.id (expect FK violation)
    try {
      const { error } = await db
        .from('unified_picks')
        .insert({ id: `fktest-${Date.now()}`, sport: 'TEST', prediction: 'NONE', score: 0, tier: 'C', user_id: '00000000-0000-0000-0000-000000000001', org_id: ORG_ID });
      result.checks.unified_picks_user_fk_enforced = !!error && /foreign key|23503/i.test(error.message || '');
      if (!result.checks.unified_picks_user_fk_enforced && error) {
        // It failed for another reason; still consider enforcement uncertain
        result.checks.unified_picks_user_fk_reason = error.message;
      }
    } catch (e: any) {
      result.checks.unified_picks_user_fk_reason = e?.message || String(e);
    }

    // 2) approval_queue.unified_id should reference unified_picks.id (expect FK violation)
    try {
      const { error } = await db
        .from('approval_queue')
        .insert({ unified_id: `missing-${Date.now()}`, status: 'approved', org_id: ORG_ID });
      result.checks.approval_queue_unified_fk_enforced = !!error && /foreign key|23503/i.test(error.message || '');
      if (!result.checks.approval_queue_unified_fk_enforced && error) {
        result.checks.approval_queue_unified_fk_reason = error.message;
      }
    } catch (e: any) {
      result.checks.approval_queue_unified_fk_reason = e?.message || String(e);
    }

    result.ok = result.checks.unified_picks_user_fk_enforced && result.checks.approval_queue_unified_fk_enforced;
  } catch (e: any) {
    result.error = e?.message || String(e);
  }

  fs.writeFileSync(path.join(outDir, 'fk-audit.json'), JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
  console.log('FK audit (live) complete');
}

main().catch(err => { console.error(err); process.exitCode = 1; });
