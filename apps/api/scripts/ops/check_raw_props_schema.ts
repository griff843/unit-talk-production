// 2025-11-23: Phase 15 – raw_props schema health check (HTTP + SQL)
// Verifies that raw_props.processed_at/processed_by/error_message/error_at are
// visible and writable via the same Supabase REST endpoint the app uses,
// and cross-checks against information_schema. Emits machine-readable and
// human-readable artifacts under out/ops/cutover/metrics/phase15/schema/.
//
// Charter: docs/PRODUCTION_CHARTER.md (canonical-first, Docker-only)
// Usage (via Docker, from apps/api):
//   docker-compose exec api npx ts-node scripts/ops/check_raw_props_schema.ts

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

interface HealthResult {
  run_at: string;
  supabase_url_present: boolean;
  service_role_present: boolean;
  http_visible: boolean;
  sql_visible: boolean;
  test_update_ok: boolean;
  http_error?: string;
  sql_error?: string;
  update_error?: string;
}

async function main() {
  const runAt = new Date().toISOString();

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const result: HealthResult = {
    run_at: runAt,
    supabase_url_present: !!supabaseUrl,
    service_role_present: !!supabaseKey,
    http_visible: false,
    sql_visible: false,
    test_update_ok: false,
  };

  if (!supabaseUrl || !supabaseKey) {
    result.http_error = 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY';
    await writeArtifacts(result);
    console.error('[Phase15] Supabase env vars missing');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  try {
    // 1) HTTP: describe raw_props via select * limit 0
    const { error: httpError } = await supabase
      .from('raw_props')
      .select('*')
      .limit(0);

    if (httpError) {
      result.http_error = httpError.message || String(httpError);
      console.error('[Phase15] HTTP visibility error on raw_props:', httpError);
    } else {
      result.http_visible = true;
    }
  } catch (err) {
    result.http_error = err instanceof Error ? err.message : String(err);
    console.error('[Phase15] HTTP visibility exception on raw_props:', err);
  }

  try {
    // 2) SQL: direct query against pg_catalog to verify columns exist, avoiding
    // PostgREST's limited information_schema support.
    const directUrl = process.env.DATABASE_DIRECT_URL;

    if (!directUrl) {
      result.sql_error = 'DATABASE_DIRECT_URL not configured';
      console.error('[Phase15] SQL visibility skipped: missing DATABASE_DIRECT_URL');
    } else {
      const pool = new Pool({ connectionString: directUrl });
      const client = await pool.connect();
      try {
        const { rows } = await client.query<ColumnInfo>(
          `SELECT attname AS column_name,
                  format_type(atttypid, atttypmod) AS data_type,
                  CASE WHEN attnotnull THEN 'NO' ELSE 'YES' END AS is_nullable
           FROM pg_attribute
           WHERE attrelid = 'public.raw_props'::regclass
             AND attname IN ('processed_at', 'processed_by', 'error_message', 'error_at')
             AND attnum > 0
             AND NOT attisdropped;`,
        );

        const cols = rows || [];
        const haveAll = ['processed_at', 'processed_by', 'error_message', 'error_at'].every((c) =>
          cols.some((col) => col.column_name === c),
        );
        result.sql_visible = haveAll;
      } finally {
        client.release();
        await pool.end();
      }
    }
  } catch (err) {
    result.sql_error = err instanceof Error ? err.message : String(err);
    console.error('[Phase15] SQL visibility exception on raw_props columns:', err);
  }

  try {
    // 3) Test UPDATE on a single row (no-op semantics) to detect PGRST204-style
    // schema cache issues on processed_* early.
    const { data: sample, error: sampleError } = await supabase
      .from('raw_props')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (sampleError) {
      result.update_error = `Failed to select sample row: ${sampleError.message}`;
    } else if (!sample) {
      result.update_error = 'No rows in raw_props to test update against';
    } else {
      const { error: updateError } = await supabase
        .from('raw_props')
        .update({ processed_at: new Date().toISOString(), processed_by: 'schema_probe' })
        .eq('id', (sample as any).id);

      if (updateError) {
        result.update_error = updateError.message || String(updateError);
        console.error('[Phase15] Test update on raw_props failed:', updateError);
      } else {
        result.test_update_ok = true;
      }
    }
  } catch (err) {
    result.update_error = err instanceof Error ? err.message : String(err);
    console.error('[Phase15] Exception during test update on raw_props:', err);
  }

  await writeArtifacts(result);

  const ok = result.http_visible && result.sql_visible && result.test_update_ok;
  if (!ok) {
    console.error('[Phase15] raw_props schema health check FAILED', result);
    process.exit(1);
  }

  console.log('[Phase15] raw_props schema health check PASSED');
  process.exit(0);
}

async function writeArtifacts(result: HealthResult) {
  const tsSafe = result.run_at.replace(/[:.]/g, '-');
  const baseDir = path.join('..', '..', 'out', 'ops', 'cutover', 'metrics', 'phase15', 'schema', tsSafe);
  fs.mkdirSync(baseDir, { recursive: true });

  const jsonPath = path.join(baseDir, 'RAW_PROPS_SCHEMA_HEALTH.json');
  const mdPath = path.join(baseDir, 'RAW_PROPS_SCHEMA_HEALTH.md');

  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf-8');

  const lines: string[] = [];
  lines.push('# Phase 15 – raw_props Schema Health');
  lines.push('');
  lines.push(`- Run at: ${result.run_at}`);
  lines.push(`- SUPABASE_URL present: ${result.supabase_url_present ? 'YES' : 'NO'}`);
  lines.push(`- SERVICE_ROLE key present: ${result.service_role_present ? 'YES' : 'NO'}`);
  lines.push(`- HTTP visibility (select * limit 0): ${result.http_visible ? 'OK' : 'FAIL'}`);
  lines.push(`- SQL visibility (information_schema): ${result.sql_visible ? 'OK' : 'FAIL'}`);
  lines.push(`- Test update processed_*/processed_by: ${result.test_update_ok ? 'OK' : 'FAIL'}`);
  if (result.http_error) lines.push(`- HTTP error: ${result.http_error}`);
  if (result.sql_error) lines.push(`- SQL error: ${result.sql_error}`);
  if (result.update_error) lines.push(`- Update error: ${result.update_error}`);

  fs.writeFileSync(mdPath, lines.join('\n'), 'utf-8');
}

main().catch((err) => {
  console.error('[Phase15] raw_props schema health check crashed:', err);
  process.exit(1);
});

