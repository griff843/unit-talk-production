/**
 * Schema Inventory Tool (read-only, safe for production)
 * - Connects via existing Supabase client or direct DB URL
 * - Queries Postgres system catalogs (configurable schema)
 * - Outputs JSON and Markdown summaries with flags support
 * - Type-safe with explicit interfaces and runtime verification
 */
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */

import * as fs from 'fs';
import * as path from 'path';
import { supabase, isSupabaseConfigured } from '../../apps/api/src/services/supabaseClient';

// CLI argument parsing
const args = process.argv.slice(2);
const getFlag = (name: string, defaultValue: string = 'public'): string => {
  const flagIndex = args.findIndex(arg => arg.startsWith(`--${name}=`));
  if (flagIndex !== -1 && args[flagIndex]) {
    return args[flagIndex]!.split('=')[1] || defaultValue;
  }
  return defaultValue;
};

const SCHEMA_NAME = getFlag('schema', 'public');
const MD_MODE = getFlag('md', 'full') as 'compact' | 'full';

const OUT_DIR = path.resolve(process.cwd(), 'out', 'db');
const JSON_OUT = path.join(OUT_DIR, 'schema-inventory.json');
const MD_OUT = path.join(OUT_DIR, 'schema-inventory.md');

const DB_URL = (process.env['SUPABASE_DB_URL'] || process.env['DATABASE_URL'] || '') as string;

// Type-safe interfaces
interface PgClient {
  query: (sql: string) => Promise<{ rows: unknown[] }>;
  release: () => void;
}

interface PgPool {
  connect: () => Promise<PgClient>;
}

interface TableRow {
  table_name: string;
  rows_est: number;
}

interface ColumnRow {
  table_name: string;
  column_name: string;
}

interface IndexRow {
  table_name: string;
  index_name: string;
}

interface ViewRow {
  table_name: string;
}

interface TableEntry {
  name: string;
  rows: number; // approximate
  columns: string[];
  indexes: string[];
}

interface Inventory {
  generatedAt: string;
  ok: boolean;
  warning?: string;
  schema: string;
  mode: 'compact' | 'full';
  summary: {
    totalTables: number;
    totalViews: number;
    totalIndexes: number;
  };
  tables: TableEntry[];
  views: string[];
  indexes: string[];
  extras?: {
    viewsPresent: Record<string, boolean>;
    rowCounts: {
      cache: Record<string, number>;
      ops: Record<string, number>;
    };
  };
}

interface SupabaseResponse<T = unknown> {
  data: T | null;
  error: { message?: string } | null;
}

function ensureOutDir(): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function writeJSON(obj: Inventory): void {
  ensureOutDir();
  fs.writeFileSync(JSON_OUT, JSON.stringify(obj, null, 2) + '\n', 'utf-8');
}

function writeMarkdown(md: string): void {
  ensureOutDir();
  fs.writeFileSync(MD_OUT, md, 'utf-8');
}

function nowIso(): string {
  return new Date().toISOString();
}

function warn(msg: string): void {
  console.warn(`[db:inventory] ${msg}`);
}

function info(msg: string): void {
  console.log(`[db:inventory] ${msg}`);
}

// Runtime safeguard for connection string
function validateConnectionString(url: string): void {
  if (!url) return;

  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname;

    // Check for expected Supabase host pattern
    if (!host.includes('supabase.co') && !host.includes('localhost')) {
      warn(`Connection host '${host}' doesn't match expected patterns - proceeding with caution`);
    }
  } catch (err) {
    warn('Could not parse DB URL - proceeding with caution');
  }
}

async function getPgPool(): Promise<PgPool | null> {
  if (!DB_URL) return null;

  validateConnectionString(DB_URL);

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: DB_URL,
      ssl: DB_URL.includes('supabase') ? { rejectUnauthorized: false } : undefined,
    }) as PgPool;
    return pool;
  } catch (err) {
    warn('pg module not available; will fall back to Supabase/REST.');
    return null;
  }
}

async function safeQuery<T = unknown>(
  fn: () => Promise<SupabaseResponse<T>>,
  purpose: string
): Promise<T | null> {
  try {
    const { data, error } = await fn();
    if (error) {
      warn(`${purpose} failed: ${error.message || String(error)}`);
      return null;
    }
    return data ?? null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    warn(`${purpose} threw: ${message}`);
    return null;
  }
}

async function execSql<T = unknown>(sql: string, purpose: string): Promise<T[] | null> {
  const data = await safeQuery<unknown>(
    () => (supabase as any).rpc('exec_sql', { sql }),
    `exec_sql: ${purpose}`
  );
  if (!data) return null;
  if (Array.isArray(data)) return data as T[];
  if (data && Array.isArray((data as any).rows)) return (data as any).rows as T[];
  return null;
}

async function fetchTableNames(): Promise<string[]> {
  // Prefer information_schema via PostgREST if exposed
  const data = await safeQuery<unknown[]>(
    () =>
      (supabase as any)
        .from('information_schema.tables')
        .select('table_name, table_schema, table_type')
        .eq('table_schema', SCHEMA_NAME)
        .eq('table_type', 'BASE TABLE')
        .order('table_name'),
    'list tables via information_schema.tables'
  );
  if (data) return data.map((r: any) => r.table_name as string);

  // Fallback via exec_sql
  const viaSql = await execSql<TableRow>(
    `SELECT c.relname AS table_name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = '${SCHEMA_NAME}' AND c.relkind = 'r' ORDER BY c.relname`,
    'list tables via pg_catalog'
  );
  return viaSql ? viaSql.map(r => r.table_name) : [];
}

async function fetchViewNames(): Promise<string[]> {
  const data = await safeQuery<unknown[]>(
    () =>
      (supabase as any)
        .from('information_schema.views')
        .select('table_name, table_schema')
        .eq('table_schema', SCHEMA_NAME)
        .order('table_name'),
    'list views via information_schema.views'
  );
  if (data) return data.map((r: any) => r.table_name as string);

  const viaSql = await execSql<ViewRow>(
    `SELECT table_name FROM information_schema.views WHERE table_schema = '${SCHEMA_NAME}' ORDER BY table_name`,
    'list views via exec_sql'
  );
  return viaSql ? viaSql.map(r => r.table_name) : [];
}

async function fetchColumnsByTable(): Promise<Record<string, string[]>> {
  const data = await safeQuery<unknown[]>(
    () =>
      (supabase as any)
        .from('information_schema.columns')
        .select('table_name, column_name, ordinal_position, table_schema')
        .eq('table_schema', SCHEMA_NAME)
        .order('table_name', { ascending: true })
        .order('ordinal_position', { ascending: true }),
    'list columns via information_schema.columns'
  );
  const result: Record<string, string[]> = {};
  if (data) {
    for (const row of data) {
      const r = row as any;
      if (!result[r.table_name]) result[r.table_name] = [];
      result[r.table_name]!.push(r.column_name as string);
    }
    return result;
  }

  // Fallback via exec_sql with aggregation
  const viaSql = await execSql<{ table_name: string; columns: string[] }>(
    `SELECT table_name, array_agg(column_name ORDER BY ordinal_position) AS columns FROM information_schema.columns WHERE table_schema = '${SCHEMA_NAME}' GROUP BY table_name`,
    'list columns via exec_sql'
  );
  if (viaSql) {
    for (const row of viaSql) {
      result[row.table_name] = row.columns || [];
    }
  }
  return result;
}

async function fetchIndexesByTable(): Promise<{
  byTable: Record<string, string[]>;
  all: string[];
}> {
  // pg_indexes is a system view commonly exposed read-only
  const data = await safeQuery<unknown[]>(
    () =>
      (supabase as any)
        .from('pg_indexes')
        .select('schemaname, tablename, indexname')
        .eq('schemaname', SCHEMA_NAME)
        .order('tablename', { ascending: true })
        .order('indexname', { ascending: true }),
    'list indexes via pg_indexes'
  );
  const byTable: Record<string, string[]> = {};
  const all: string[] = [];
  if (data) {
    for (const row of data) {
      const r = row as any;
      if (!byTable[r.tablename]) byTable[r.tablename] = [];
      byTable[r.tablename]!.push(r.indexname as string);
      all.push(r.indexname as string);
    }
    return { byTable, all };
  }

  // Fallback via exec_sql
  const viaSql = await execSql<IndexRow>(
    `SELECT t.relname AS table_name, i.relname AS index_name FROM pg_class t JOIN pg_index ix ON t.oid = ix.indrelid JOIN pg_class i ON i.oid = ix.indexrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = '${SCHEMA_NAME}' ORDER BY t.relname, i.relname`,
    'list indexes via exec_sql'
  );
  if (viaSql) {
    for (const row of viaSql) {
      if (!byTable[row.table_name]) byTable[row.table_name] = [];
      byTable[row.table_name]!.push(row.index_name);
      all.push(row.index_name);
    }
  }
  return { byTable, all };
}

async function fetchApproxRowCounts(): Promise<Record<string, number>> {
  // Prefer pg_stat_user_tables.n_live_tup as approximate row counts
  const data = await safeQuery<unknown[]>(
    () =>
      (supabase as any)
        .from('pg_stat_user_tables')
        .select('schemaname, relname, n_live_tup')
        .eq('schemaname', SCHEMA_NAME),
    'approx row counts via pg_stat_user_tables'
  );
  const result: Record<string, number> = {};
  if (data) {
    for (const row of data) {
      const r = row as any;
      result[r.relname as string] =
        typeof r.n_live_tup === 'number' ? Math.max(0, Math.floor(r.n_live_tup)) : 0;
    }
    return result;
  }

  // Fallback via exec_sql and pg_class.reltuples
  const viaSql = await execSql<{ name: string; rows_est: number }>(
    `SELECT c.relname AS name, COALESCE(c.reltuples, 0)::bigint AS rows_est FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = '${SCHEMA_NAME}' AND c.relkind = 'r'`,
    'approx rows via exec_sql pg_class'
  );
  if (viaSql) {
    for (const row of viaSql) {
      result[row.name] = typeof row.rows_est === 'number' ? row.rows_est : 0;
    }
  }
  return result;
}

async function fetchApproxRowCountsForSchema(schema: string): Promise<Record<string, number>> {
  // Try pg_stat_user_tables filtered by schema
  const data = await safeQuery<unknown[]>(
    () =>
      (supabase as any)
        .from('pg_stat_user_tables')
        .select('schemaname, relname, n_live_tup')
        .eq('schemaname', schema),
    `approx row counts via pg_stat_user_tables for ${schema}`
  );
  const result: Record<string, number> = {};
  if (data) {
    for (const row of data) {
      const r = row as any;
      result[r.relname as string] = typeof r.n_live_tup === 'number' ? Math.max(0, Math.floor(r.n_live_tup)) : 0;
    }
    return result;
  }
  // Fallback via exec_sql
  const viaSql = await execSql<{ name: string; rows_est: number }>(
    `SELECT c.relname AS name, COALESCE(c.reltuples, 0)::bigint AS rows_est FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = '${schema}' AND c.relkind = 'r'`,
    `approx rows via exec_sql pg_class for ${schema}`
  );
  if (viaSql) {
    for (const row of viaSql) result[row.name] = typeof row.rows_est === 'number' ? row.rows_est : 0;
  }
  return result;
}

async function checkViewPresence(): Promise<Record<string, boolean>> {
  const names = ['view_props_for_form', 'mv_props_for_form'];
  const presence: Record<string, boolean> = {};
  // information_schema.views for standard view
  const v1 = await safeQuery<unknown[]>(
    () => (supabase as any).from('information_schema.views').select('table_name, table_schema').eq('table_schema', 'public'),
    'list public views'
  );
  const viewSet = new Set((v1 || []).map((r: any) => r.table_name as string));
  presence['view_props_for_form'] = viewSet.has('view_props_for_form');
  // matview via pg_class
  const mv = await execSql<{ relname: string }>(
    `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='mv_props_for_form'`,
    'check matview mv_props_for_form'
  );
  presence['mv_props_for_form'] = (mv || []).length > 0;
  return presence;
}


function toMarkdown(inv: Inventory): string {
  const lines: string[] = [];
  lines.push('# DB Schema Inventory');
  lines.push('');
  lines.push(`**Generated:** ${inv.generatedAt}  `);
  lines.push(`**Schema:** ${inv.schema}  `);
  lines.push(`**Mode:** ${inv.mode}  `);
  lines.push('');

  if (!inv.ok && inv.warning) {
    lines.push('> ⚠️ **Warning:** ' + inv.warning);
    lines.push('');
  }

  // Summary block at top
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Tables | ${inv.summary.totalTables} |`);
  lines.push(`| Views | ${inv.summary.totalViews} |`);
  lines.push(`| Indexes | ${inv.summary.totalIndexes} |`);
  lines.push('');

  // Tables section with better formatting
  lines.push('## Tables');
  lines.push('');
  if (inv.tables.length === 0) {
    lines.push('- (none found)');
  } else {
  // Extras section
  if ((inv as any).extras) {
    const extras = (inv as any).extras as { viewsPresent: Record<string, boolean>; rowCounts: { cache: Record<string, number>; ops: Record<string, number> } };
    lines.push('## Smart Form & Cache/OPS Checks');
    lines.push('');
    lines.push(`- view_props_for_form present: ${extras.viewsPresent['view_props_for_form'] ? 'yes' : 'no'}`);
    lines.push(`- mv_props_for_form present: ${extras.viewsPresent['mv_props_for_form'] ? 'yes' : 'no'}`);
    lines.push('');
    lines.push('### cache.* approx row counts');
    const cacheNames = Object.keys(extras.rowCounts.cache);
    lines.push(cacheNames.length ? cacheNames.map(k => `- ${k}: ${extras.rowCounts.cache[k].toLocaleString()}`).join('\n') : '- (none)');
    lines.push('');
    lines.push('### ops.* approx row counts');
    const opsNames = Object.keys(extras.rowCounts.ops);
    lines.push(opsNames.length ? opsNames.map(k => `- ${k}: ${extras.rowCounts.ops[k].toLocaleString()}`).join('\n') : '- (none)');
    lines.push('');
  }

    lines.push('| Table | Rows≈ | Columns | Indexes |');
    lines.push('|-------|-------|---------|---------|');
    for (const t of inv.tables) {
      const rowCount = t.rows.toLocaleString();
      const columnCount = t.columns.length.toString();
      const indexCount = t.indexes.length.toString();
      lines.push(`| ${t.name} | ${rowCount} | ${columnCount} | ${indexCount} |`);
    }
  }
  lines.push('');

  // Views section
  lines.push('## Views');
  lines.push('');
  if (inv.views.length === 0) {
    lines.push('- (none found)');
  } else {
    for (const v of inv.views) {
      lines.push(`- ${v}`);
    }
  }
  lines.push('');

  // All Indexes table
  lines.push('## All Indexes');
  lines.push('');
  if (inv.indexes.length === 0) {
    lines.push('- (none found)');
  } else {
    const displayLimit = inv.mode === 'compact' ? 15 : inv.indexes.length;
    const indexesToShow = inv.indexes.slice(0, displayLimit);

    if (inv.mode === 'compact' && inv.indexes.length > displayLimit) {
      // Use collapsible details for compact mode
      lines.push(`First ${displayLimit} indexes:`);
      lines.push('');
      for (const idx of indexesToShow) {
        lines.push(`- ${idx}`);
      }
      lines.push('');
      lines.push('<details>');
      lines.push(`<summary>Show remaining ${inv.indexes.length - displayLimit} indexes</summary>`);
      lines.push('');
      for (const idx of inv.indexes.slice(displayLimit)) {
        lines.push(`- ${idx}`);
      }
      lines.push('');
      lines.push('</details>');
    } else {
      // Full mode - show all
      for (const idx of indexesToShow) {
        lines.push(`- ${idx}`);
      }
    }
  }
  lines.push('');

  // Per-table index details (limit for compact mode)
  if (inv.mode === 'full' || inv.tables.some(t => t.indexes.length > 0)) {
    lines.push('## Indexes by Table');
    lines.push('');
    for (const t of inv.tables) {
      if (t.indexes.length > 0) {
        lines.push(`### ${t.name}`);
        lines.push('');
        const indexLimit = inv.mode === 'compact' ? 15 : t.indexes.length;
        const indexesToShow = t.indexes.slice(0, indexLimit);

        for (const idx of indexesToShow) {
          lines.push(`- ${idx}`);
        }

        if (inv.mode === 'compact' && t.indexes.length > indexLimit) {
          lines.push(`- ... and ${t.indexes.length - indexLimit} more`);
        }
        lines.push('');
      }
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('*Note: Row counts are approximate (stats-based). Generated by Unit Talk schema inventory tool.*');
  return lines.join('\n');
}

async function inventoryViaPg(): Promise<Inventory | null> {
  const pool = await getPgPool();
  if (!pool) return null;

  const client = await pool.connect();
  try {
    const tablesRows = (
      await client.query(
        `SELECT c.relname AS table_name, COALESCE(c.reltuples, 0)::bigint AS rows_est FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = '${SCHEMA_NAME}' AND c.relkind = 'r' ORDER BY c.relname`
      )
    ).rows as TableRow[];

    const colsRows = (
      await client.query(
        `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = '${SCHEMA_NAME}' ORDER BY table_name, ordinal_position`
      )
    ).rows as ColumnRow[];

    const idxRows = (
      await client.query(
        `SELECT t.relname AS table_name, i.relname AS index_name FROM pg_class t JOIN pg_index ix ON t.oid = ix.indrelid JOIN pg_class i ON i.oid = ix.indexrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = '${SCHEMA_NAME}' ORDER BY t.relname, i.relname`
      )
    ).rows as IndexRow[];

    const viewRows = (
      await client.query(
        `SELECT table_name FROM information_schema.views WHERE table_schema = '${SCHEMA_NAME}' ORDER BY table_name`
      )
    ).rows as ViewRow[];

    const columnsByTable: Record<string, string[]> = {};
    for (const r of colsRows) {
      if (!columnsByTable[r.table_name]) columnsByTable[r.table_name] = [];
      columnsByTable[r.table_name]!.push(r.column_name);
    }

    const indexesByTable: Record<string, string[]> = {};
    const allIndexes: string[] = [];
    for (const r of idxRows) {
      if (!indexesByTable[r.table_name]) indexesByTable[r.table_name] = [];
      indexesByTable[r.table_name]!.push(r.index_name);
      allIndexes.push(r.index_name);
    }

    const tables: TableEntry[] = tablesRows.map(t => ({
      name: t.table_name,
      rows: typeof t.rows_est === 'number' ? t.rows_est : 0,
      columns: columnsByTable[t.table_name] || [],
      indexes: indexesByTable[t.table_name] || [],
    }));

    const sortedTables = tables.sort((a, b) => a.name.localeCompare(b.name));
    const sortedViews = viewRows.map(v => v.table_name).sort((a, b) => a.localeCompare(b));
    const uniqueIndexes = Array.from(new Set(allIndexes)).sort((a, b) => a.localeCompare(b));
    // Compute extras via direct PG (no Supabase RPC dependency)
    const viewsPresent = {
      view_props_for_form: (await client.query(
        `SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'view_props_for_form'`
      )).rows.length > 0,
      mv_props_for_form: (await client.query(
        `SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='mv_props_for_form'`
      )).rows.length > 0,
    } as Record<string, boolean>;

    const cacheCountsRows = (
      await client.query(
        `SELECT relname, COALESCE(n_live_tup, 0)::bigint AS n FROM pg_stat_user_tables WHERE schemaname = 'cache'`
      )
    ).rows as { relname: string; n: number }[];
    const opsCountsRows = (
      await client.query(
        `SELECT relname, COALESCE(n_live_tup, 0)::bigint AS n FROM pg_stat_user_tables WHERE schemaname = 'ops'`
      )
    ).rows as { relname: string; n: number }[];

    const cacheCounts: Record<string, number> = {};
    for (const r of cacheCountsRows) cacheCounts[r.relname] = typeof r.n === 'number' ? r.n : 0;
    const opsCounts: Record<string, number> = {};
    for (const r of opsCountsRows) opsCounts[r.relname] = typeof r.n === 'number' ? r.n : 0;


    const inv: Inventory = {
      generatedAt: nowIso(),
      ok: true,
      schema: SCHEMA_NAME,
      mode: MD_MODE,
      summary: {
        totalTables: sortedTables.length,
        totalViews: sortedViews.length,
        totalIndexes: uniqueIndexes.length,
      },
      tables: sortedTables,
      views: sortedViews,
      indexes: uniqueIndexes,
    };

    // Attach extras (computed via direct PG)
    (inv as any).extras = {
      viewsPresent: viewsPresent,
      rowCounts: {
        cache: cacheCounts,
        ops: opsCounts,
      },
    };



    return inv;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  info(`Starting schema inventory (schema: ${SCHEMA_NAME}, mode: ${MD_MODE})`);

  // Env sanity via Supabase client (non-fatal)
  if (!isSupabaseConfigured) {


    warn('Supabase client is not fully configured; proceeding with DB URL if available.');
  }

  if (!DB_URL && (!isSupabaseConfigured || !supabase)) {
    const warning =
      'No DB connection available (SUPABASE_DB_URL/DATABASE_URL missing and Supabase client not configured); writing placeholder.';
    warn(warning);
    const placeholder: Inventory = {
      generatedAt: nowIso(),
      ok: false,
      warning,
      schema: SCHEMA_NAME,
      mode: MD_MODE,
      summary: { totalTables: 0, totalViews: 0, totalIndexes: 0 },
      tables: [],
      views: [],
      indexes: [],
    };
    writeJSON(placeholder);
    writeMarkdown(toMarkdown(placeholder));
    console.log('✅ Wrote placeholder inventory outputs to out/db/');
    process.exit(0);
  }

  console.log('🔎 Collecting schema inventory...');

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

    const sortedTables = tables.sort((a, b) => a.name.localeCompare(b.name));
    const sortedViews = views.sort((a, b) => a.localeCompare(b));
    const uniqueIndexes = Array.from(new Set(indexesInfo.all)).sort((a, b) => a.localeCompare(b));

    inventory = {
      generatedAt: nowIso(),
      ok: true,
      schema: SCHEMA_NAME,
      mode: MD_MODE,
      summary: {
        totalTables: sortedTables.length,
        totalViews: sortedViews.length,
        totalIndexes: uniqueIndexes.length,
      },
      tables: sortedTables,
      views: sortedViews,
      indexes: uniqueIndexes,
    };

    // Attach extras for fallback path as well
    (inventory as any).extras = {
      viewsPresent: await checkViewPresence(),
      rowCounts: {
        cache: await fetchApproxRowCountsForSchema('cache'),
        ops: await fetchApproxRowCountsForSchema('ops'),
      },
    };
  }

  writeJSON(inventory);
  writeMarkdown(toMarkdown(inventory));

  console.log('✅ Schema inventory complete');
  console.log(`   Schema: ${SCHEMA_NAME}`);
  console.log(`   Mode: ${MD_MODE}`);
  console.log(`   JSON: ${JSON_OUT}`);
  console.log(`   Markdown: ${MD_OUT}`);
  console.log(`   Summary: ${inventory.summary.totalTables} tables, ${inventory.summary.totalViews} views, ${inventory.summary.totalIndexes} indexes`);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('❌ Inventory failed:', message);
  // Still try to write a minimal artifact for CI visibility
  try {
    const fallback: Inventory = {
      generatedAt: nowIso(),
      ok: false,
      warning: 'Inventory script error: ' + message,
      schema: SCHEMA_NAME,
      mode: MD_MODE,
      summary: { totalTables: 0, totalViews: 0, totalIndexes: 0 },
      tables: [],
      views: [],
      indexes: [],
    };
    writeJSON(fallback);
    writeMarkdown(toMarkdown(fallback));
    console.log('⚠️ Wrote fallback placeholder outputs');
  } catch {
    // Ignore write errors in fallback
  }
  process.exit(1);
});