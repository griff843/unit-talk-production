import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Live view/materialized view existence audit
// Checks that critical views/matviews exist and are queryable

function ensureDir(p: string) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

async function main() {
  const outDir = path.resolve(process.cwd(), 'out', 'db');
  ensureDir(outDir);

  const url = process.env.SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const result: any = {
    ok: false,
    views: {},
    timestamp: new Date().toISOString()
  };

  try {
    if (!url || !service) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    const db = createClient(url, service);

    const targets = [
      'view_postable_unified_picks',
      'materialized_feature_store'
    ];

    let allOk = true;
    for (const name of targets) {
      const { data, error } = await db.from(name as any).select('*').limit(1);
      result.views[name] = { exists: !error || (error.code !== '42P01'), error: error?.message || null };
      if (error && error.code === '42P01') allOk = false;
    }

    result.ok = allOk;
  } catch (e: any) {
    result.error = e?.message || String(e);
  }

  fs.writeFileSync(path.join(outDir, 'view-exists-audit.json'), JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
  console.log('View existence audit complete');
}

main().catch(err => { console.error(err); process.exitCode = 1; });
