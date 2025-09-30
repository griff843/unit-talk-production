import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.cwd(), 'out', 'ops', 'dumps');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const sinceMinutes = Number(process.argv[2] ?? 15);
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supa = createClient(url, key, { auth: { persistSession: false } });

  const sinceIso = new Date(Date.now() - sinceMinutes * 60_000).toISOString();
  const stamp = Date.now();

  // Unified timestamp detection - try different timestamp columns that might exist
  const timestampColumns = ['inserted_at', 'created_at', 'timestamp', 'created_date'];
  let timestampCol: string | null = null;

  for (const col of timestampColumns) {
    try {
      const testQuery = await supa
        .from('unified_picks')
        .select(col)
        .limit(1);
      if (!testQuery.error) {
        timestampCol = col;
        console.log(`[DUMP] Found timestamp column: ${col}`);
        break;
      }
    } catch (e) {
      // Column doesn't exist, continue
    }
  }

  if (!timestampCol) {
    console.warn(`[DUMP] No timestamp column found, using 'id' ordering`);
  }

  // Query unified_picks table with recent data
  let query = supa
    .from('unified_picks')
    .select('id, user_id' + (timestampCol ? `, ${timestampCol}` : ''));

  if (timestampCol) {
    query = query
      .gte(timestampCol, sinceIso)
      .order(timestampCol, { ascending: false });
  } else {
    // Fallback to ordering by id if no timestamp column
    query = query.order('id', { ascending: false });
  }

  const { data, error } = await query.limit(500);

  const result = {
    ts: new Date().toISOString(),
    sinceMinutes,
    sinceIso,
    count: data?.length ?? 0,
    error: error ?? null,
    rows: data ?? []
  };

  const file = path.join(OUT, `unified_picks-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(result, null, 2));
  console.log(file);

  // Also write a summary file for quick analysis
  const summaryFile = path.join(OUT, `unified_picks-summary-${stamp}.json`);
  const summary = {
    ts: new Date().toISOString(),
    sinceIso,
    sinceMinutes,
    timestampColumn: timestampCol,
    count: result.count,
    totalRows: result.count,
    hasData: result.count > 0,
    error: result.error
  };
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  console.log(summaryFile);
})();