/**
 * Schema Inventory Tool (read-only, safe for production)
 * - Connects via existing Supabase client
 * - Queries Postgres system catalogs (public schema only)
 * - Outputs JSON and Markdown summaries
 */

import fs from 'fs';
import path from 'path';
import { supabase, isSupabaseConfigured } from '../../apps/api/src/services/supabaseClient';

const OUT_DIR = path.resolve(process.cwd(), 'out', 'db');
const JSON_OUT = path.join(OUT_DIR, 'schema-inventory.json');
const MD_OUT = path.join(OUT_DIR, 'schema-inventory.md');

const DB_URL = (process.env['SUPABASE_DB_URL'] || process.env['DATABASE_URL'] || '') as string;

type PgPool = {
  connect: () => Promise<{ query: (sql: string) => Promise<{ rows: any[] }>; release: () => void }>;
};

async function getPgPool(): Promise<PgPool | null> {
  if (!DB_URL) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: DB_URL, ssl: DB_URL.includes('supabase') ? { rejectUnauthorized: false } : undefined });
    return pool as PgPool;
  } catch (err) {
    warn('pg module not available; will fall back to Supabase/REST.');
    return null;
  }
}

function ensureOutDir() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function writeJSON(obj: any) {
  ensureOutDir();
  fs.writeFileSync(JSON_OUT, JSON.stringify(obj, null, 2) + '\n', 'utf-8');
}

function writeMarkdown(md: string) {
  ensureOutDir();
  fs.writeFileSync(MD_OUT, md, 'utf-8');
}

function nowIso() {
  return new Date().toISOString();
}

function warn(msg: string) {
  console.warn(`[db:inventory] ${msg}`);
}

type TableEntry = {
  name: string;
  rows: number; // approximate
  columns: string[];
  indexes: string[];
};

type Inventory = {
  generatedAt: string;
  ok: boolean;
  warning?: string;
  tables: TableEntry[];
  views: string[];
  indexes: string[];
};

async function safeQuery<T = any>(
  fn: () => Promise<{ data: any; error: any }>,
  purpose: string
): Promise<T | null> {
  try {
    const { data, error } = await fn();
    if (error) {
      warn(`${purpose} failed: ${error.message || error}`);
      return null;
    }
    return (data as T) ?? null;
  } catch (err: any) {
    warn(`${purpose} threw: ${err?.message || String(err)}`);
    return null;
  }
}

async function execSql<T = any>(sql: string, purpose: string): Promise<T[] | null> {
  const data = await safeQuery<any>(() => (supabase as any).rpc('exec_sql', { sql }), `exec_sql: ${purpose}`);
  if (!data) return null;
  if (Array.isArray(data)) return data as T[];
  if (data && Array.isArray((data as any).rows)) return (data as any).rows as T[];
  return null;
}

async function fetchTableNames(): Promise<string[]> {
  // Prefer information_schema via PostgREST if exposed
  const data = await safeQuery<any[]>(
    () =>
      (supabase as any)
        .from('information_schema.tables')
        .select('table_name, table_schema, table_type')
        .eq('table_schema', 'public')
        .eq('table_type', 'BASE TABLE')
        .order('table_name'),
    'list tables via information_schema.tables'
  );
  if (data) return data.map((r: any) => r.table_name);
  // Fallback via exec_sql
  const viaSql = await execSql<{ table_name: string }>(
    "SELECT c.relname AS table_name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.relname",
    'list tables via pg_catalog'
  );
  return viaSql ? viaSql.map((r) => r.table_name) : [];
}

async function fetchViewNames(): Promise<string[]> {
  const data = await safeQuery<any[]>(
    () =>
      (supabase as any)
        .from('information_schema.views')
        .select('table_name, table_schema')
        .eq('table_schema', 'public')
        .order('table_name'),
    'list views via information_schema.views'
  );
  if (data) return data.map((r: any) => r.table_name);
  const viaSql = await execSql<{ table_name: string }>(
    "SELECT table_name FROM information_schema.views WHERE table_schema = 'public' ORDER BY table_name",
    'list views via exec_sql'
  );
  return viaSql ? viaSql.map((r) => r.table_name) : [];
}

async function fetchColumnsByTable(): Promise<Record<string, string[]>> {
  const data = await safeQuery<any[]>(
    () =>
      (supabase as any)
        .from('information_schema.columns')
        .select('table_name, column_name, ordinal_position, table_schema')
        .eq('table_schema', 'public')
        .order('table_name', { ascending: true })
        .order('ordinal_position', { ascending: true }),
    'list columns via information_schema.columns'
  );
  const result: Record<string, string[]> = {};
  if (data) {
    for (const row of data) {
      if (!result[row.table_name]) result[row.table_name] = [];
      (result[row.table_name] as string[]).push(row.column_name);
    }
    return result;
  }
  // Fallback via exec_sql with aggregation
  const viaSql = await execSql<{ table_name: string; columns: string[] }>(
    "SELECT table_name, array_agg(column_name ORDER BY ordinal_position) AS columns FROM information_schema.columns WHERE table_schema = 'public' GROUP BY table_name",
    'list columns via exec_sql'
  );
  if (viaSql) {
    for (const row of viaSql) {
      result[row.table_name] = row.columns || [];
    }
  }
  return result;
}

async function fetchIndexesByTable(): Promise<{ byTable: Record<string, string[]>; all: string[] }> {
  // pg_indexes is a system view commonly exposed read-only
  const data = await safeQuery<any[]>(
    () =>
      (supabase as any)
        .from('pg_indexes')
        .select('schemaname, tablename, indexname')
        .eq('schemaname', 'public')
        .order('tablename', { ascending: true })
        .order('indexname', { ascending: true }),
    'list indexes via pg_indexes'
  );
  const byTable: Record<string, string[]> = {};
  const all: string[] = [];
  if (data) {
    for (const row of data) {
      if (!byTable[row.tablename]) byTable[row.tablename] = [];
      (byTable[row.tablename] as string[]).push(row.indexname);
      all.push(row.indexname);
    }
    return { byTable, all };
  }
  // Fallback via exec_sql
  const viaSql = await execSql<{ table_name: string; index_name: string }>(
    "SELECT t.relname AS table_name, i.relname AS index_name FROM pg_class t JOIN pg_index ix ON t.oid = ix.indrelid JOIN pg_class i ON i.oid = ix.indexrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = 'public' ORDER BY t.relname, i.relname",
    'list indexes via exec_sql'
  );
  if (viaSql) {
    for (const row of viaSql) {
      if (!byTable[row.table_name]) byTable[row.table_name] = [];
      (byTable[row.table_name] as string[]).push(row.index_name);
      all.push(row.index_name);
    }
  }
  return { byTable, all };
}

async function fetchApproxRowCounts(): Promise<Record<string, number>> {
  // Prefer pg_stat_user_tables.n_live_tup as approximate row counts
  const data = await safeQuery<any[]>(
    () =>
      (supabase as any)
        .from('pg_stat_user_tables')
        .select('schemaname, relname, n_live_tup')
        .eq('schemaname', 'public'),
    'approx row counts via pg_stat_user_tables'
  );
  const result: Record<string, number> = {};
  if (data) {
    for (const row of data) {
      result[row.relname] = typeof row.n_live_tup === 'number' ? Math.max(0, Math.floor(row.n_live_tup)) : 0;
    }
    return result;
  }
  // Fallback via exec_sql and pg_class.reltuples
  const viaSql = await execSql<{ name: string; rows_est: number }>(
    "SELECT c.relname AS name, COALESCE(c.reltuples, 0)::bigint AS rows_est FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r'",
    'approx rows via exec_sql pg_class'
  );
  if (viaSql) {
    for (const row of viaSql) {
      result[row.name] = typeof row.rows_est === 'number' ? row.rows_est : 0;
    }
  }
  return result;
}

function toMarkdown(inv: Inventory): string {
  const lines: string[] = [];
  lines.push('# DB Schema Inventory');
  lines.push('');
  lines.push(`Generated: ${inv.generatedAt}`);
  lines.push('');
  if (!inv.ok && inv.warning) {
    lines.push('> Warning: ' + inv.warning);
    lines.push('');
  }
  lines.push('## Tables');
  if (inv.tables.length === 0) {
    lines.push('- (none found)');
  } else {
    for (const t of inv.tables) {
      lines.push(`- ${t.name} — rows≈${t.rows ?? 0} — columns(${t.columns.length})`);
    }
  }
  lines.push('');
  lines.push('## Views');
  if (inv.views.length === 0) lines.push('- (none found)');
  else lines.push(...inv.views.map((v) => `- ${v}`));
  lines.push('');
  lines.push('## Indexes (all)');
  if (inv.indexes.length === 0) lines.push('- (none found)');
  else lines.push(...inv.indexes.map((i) => `- ${i}`));
  lines.push('');
  lines.push('Note: Row counts are approximate (stats-based).');
  return lines.join('\n');
}

async function inventoryViaPg(): Promise<Inventory | null> {
  const pool = await getPgPool();
  if (!pool) return null;

  const client = await pool.connect();
  try {
    const tablesRows = (await client.query(
      "SELECT c.relname AS table_name, COALESCE(c.reltuples, 0)::bigint AS rows_est FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.relname"
    )).rows as { table_name: string; rows_est: number }[];

    const colsRows = (await client.query(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position"
    )).rows as { table_name: string; column_name: string }[];

    const idxRows = (await client.query(
      "SELECT t.relname AS table_name, i.relname AS index_name FROM pg_class t JOIN pg_index ix ON t.oid = ix.indrelid JOIN pg_class i ON i.oid = ix.indexrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = 'public' ORDER BY t.relname, i.relname"
    )).rows as { table_name: string; index_name: string }[];

    const viewRows = (await client.query(
      "SELECT table_name FROM information_schema.views WHERE table_schema = 'public' ORDER BY table_name"
    )).rows as { table_name: string }[];

    const columnsByTable: Record<string, string[]> = {};
    for (const r of colsRows) {
      if (!columnsByTable[r.table_name]) columnsByTable[r.table_name] = [];
      (columnsByTable[r.table_name] as string[]).push(r.column_name);
    }

    const indexesByTable: Record<string, string[]> = {};
    const allIndexes: string[] = [];
    for (const r of idxRows) {
      if (!indexesByTable[r.table_name]) indexesByTable[r.table_name] = [];
      (indexesByTable[r.table_name] as string[]).push(r.index_name);
      allIndexes.push(r.index_name);
    }

    const tables: TableEntry[] = tablesRows.map((t) => ({
      name: t.table_name,
      rows: typeof t.rows_est === 'number' ? t.rows_est : 0,
      columns: columnsByTable[t.table_name] || [],
      indexes: indexesByTable[t.table_name] || [],
    }));

    const inv: Inventory = {
      generatedAt: nowIso(),
      ok: true,
      tables: tables.sort((a, b) => a.name.localeCompare(b.name)),
      views: viewRows.map((v) => v.table_name).sort((a, b) => a.localeCompare(b)),
      indexes: Array.from(new Set(allIndexes)).sort((a, b) => a.localeCompare(b)),
    };

    return inv;
  } finally {
    client.release();
  }
}

async function main() {
  // Env sanity via Supabase client (non-fatal)
  if (!isSupabaseConfigured) {
    warn('Supabase client is not fully configured; proceeding with DB URL if available.');
  }

  if (!DB_URL && (!isSupabaseConfigured || !supabase)) {
    const warning = 'No DB connection available (SUPABASE_DB_URL/DATABASE_URL missing and Supabase client not configured); writing placeholder.';
    warn(warning);
    const placeholder: Inventory = {
      generatedAt: nowIso(),
      ok: false,
      warning,
      tables: [],
      views: [],
      indexes: [],
    };
    writeJSON(placeholder);
    writeMarkdown(toMarkdown(placeholder));
    console.log('✅ Wrote placeholder inventory outputs to out/db/');
    process.exit(0);
    return;
  }

  console.log('🔎 Collecting schema inventory (public schema)...');

  // Preferred: direct Postgres via DB URL
  let inventory = await inventoryViaPg();

  if (!inventory) {
    // Fallback: Supabase REST/catalogs
    const [tableNames, views, columnsByTable, indexesInfo, rowCounts] = await Promise.all([
      fetchTableNames(),
      fetchViewNames(),
      fetchColumnsByTable(),
      fetchIndexesByTable(),
      fetchApproxRowCounts(),
    ]);

    const tables: TableEntry[] = [];
    for (const name of tableNames) {
      const columns = columnsByTable[name] || [];
      const indexes = indexesInfo.byTable[name] || [];
      const rows = typeof rowCounts[name] === 'number' ? rowCounts[name] : 0;
      tables.push({ name, rows, columns, indexes });
    }

    inventory = {
      generatedAt: nowIso(),
      ok: true,
      tables: tables.sort((a, b) => a.name.localeCompare(b.name)),
      views: views.sort((a, b) => a.localeCompare(b)),
      indexes: Array.from(new Set(indexesInfo.all)).sort((a, b) => a.localeCompare(b)),
    };
  }

  writeJSON(inventory);
  writeMarkdown(toMarkdown(inventory));

  console.log('✅ Schema inventory complete');
  console.log(`   JSON: ${JSON_OUT}`);
  console.log(`   Markdown: ${MD_OUT}`);
}

main().catch((err) => {
  console.error('❌ Inventory failed:', err?.message || err);
  // Still try to write a minimal artifact for CI visibility
  try {
    const fallback: Inventory = {
      generatedAt: nowIso(),
      ok: false,
      warning: 'Inventory script error: ' + (err?.message || String(err)),
      tables: [],
      views: [],
      indexes: [],
    };
    writeJSON(fallback);
    writeMarkdown(toMarkdown(fallback));
    console.log('⚠️ Wrote fallback placeholder outputs');
  } catch {}
  process.exit(1);
});

