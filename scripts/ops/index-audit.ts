import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Index audit (live): verifies that key tables have at least one index in pg_indexes

function ensureDir(p: string) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

async function main() {
  const outDir = path.resolve(process.cwd(), 'out', 'db');
  ensureDir(outDir);

  const url = process.env.SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const result: any = {
    ok: false,
    tables: {},
    timestamp: new Date().toISOString()
  };

  try {
    if (!url || !service) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    const db = createClient(url, service);

    const targetTables = ['unified_picks', 'approval_queue', 'alerts_queue', 'raw_props'];

    let allOk = true;
    for (const t of targetTables) {
      // Try querying pg_indexes; if unavailable, this will error with 42P01
      const { data, error } = await db
        .from('pg_indexes' as any)
        .select('schemaname, tablename, indexname')
        .eq('schemaname', 'public')
        .eq('tablename', t);

      const exists = !error && (data?.length || 0) > 0;
      result.tables[t] = { indexed: exists, count: data?.length || 0, error: error?.message || null };
      if (!exists) allOk = false;
    }

    result.ok = allOk;
  } catch (e: any) {
    result.error = e?.message || String(e);
  }

  fs.writeFileSync(path.join(outDir, 'index-audit.json'), JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
  console.log('Index audit (live) complete');
}

main().catch(err => { console.error(err); process.exitCode = 1; });
