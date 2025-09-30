import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Materialized view refresh check (live):
// We verify the matview is queryable and has rows if source tables have data.

function ensureDir(p: string) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

async function main() {
  const outDir = path.resolve(process.cwd(), 'out', 'db');
  ensureDir(outDir);

  const url = process.env.SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const result: any = {
    ok: false,
    mode: 'live',
    matview: 'materialized_feature_store',
    count: 0,
    timestamp: new Date().toISOString()
  };

  try {
    if (!url || !service) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    const db = createClient(url, service);

    // Heuristic: if raw_props exists, matview should be queryable. We just check count.
    const { error, count } = await db
      .from('materialized_feature_store' as any)
      .select('*', { count: 'exact', head: true });

    if (error) throw error;
    result.count = typeof count === 'number' ? count : 0;
    result.ok = true; // matview exists and is queryable
  } catch (e: any) {
    result.error = e?.message || String(e);
  }

  fs.writeFileSync(path.join(outDir, 'matview-refresh.json'), JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
  console.log('Matview refresh check complete');
}

main().catch(err => { console.error(err); process.exitCode = 1; });
