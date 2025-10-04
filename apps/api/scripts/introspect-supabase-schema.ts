/**
 * Comprehensive Supabase Schema Introspection
 * Generates complete schema report for dbcore migration planning
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface TableInfo {
  table_name: string;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
  constraints: ConstraintInfo[];
  row_count?: number;
}

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
}

interface IndexInfo {
  index_name: string;
  index_def: string;
}

interface ConstraintInfo {
  constraint_name: string;
  constraint_type: string;
  definition: string;
}

interface ViewInfo {
  view_name: string;
  definition: string;
}

interface EnumInfo {
  enum_name: string;
  values: string[];
}

interface RLSPolicyInfo {
  table_name: string;
  policy_name: string;
  cmd: string;
  qual: string;
  with_check: string;
}

async function introspectSchema() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log('🔍 Starting comprehensive schema introspection...\n');

  // Get all tables
  const { data: tables, error: tablesError } = await supabase.rpc('get_tables_info' as any) as any;

  if (tablesError) {
    console.log('Using direct SQL queries instead...');
  }

  // Query information_schema for comprehensive data
  const queries = {
    tables: `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `,

    columns: `
      SELECT
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `,

    views: `
      SELECT
        table_name as view_name,
        view_definition as definition
      FROM information_schema.views
      WHERE table_schema = 'public'
      ORDER BY table_name
    `,

    enums: `
      SELECT
        t.typname as enum_name,
        array_agg(e.enumlabel ORDER BY e.enumsortorder) as values
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      GROUP BY t.typname
      ORDER BY t.typname
    `,

    indexes: `
      SELECT
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `,

    constraints: `
      SELECT
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        pg_get_constraintdef(c.oid) as definition
      FROM information_schema.table_constraints tc
      JOIN pg_constraint c ON c.conname = tc.constraint_name
      WHERE tc.table_schema = 'public'
      ORDER BY tc.table_name, tc.constraint_name
    `,

    rls_policies: `
      SELECT
        schemaname,
        tablename,
        policyname,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname
    `,

    table_sizes: `
      SELECT
        schemaname as schema_name,
        tablename as table_name,
        pg_total_relation_size(schemaname||'.'||tablename) as total_bytes,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `
  };

  const results: any = {};

  // Execute all queries directly via raw SQL using pg library
  const { Client } = await import('pg');

  // Parse Supabase URL to get connection string
  const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  const connectionString = `postgresql://postgres.${projectRef}:${SUPABASE_SERVICE_ROLE_KEY.split('.')[2]}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

  // Try connection string from SUPABASE_URL
  const dbHost = `db.${projectRef}.supabase.co`;
  const dbPort = 5432;
  const dbUser = 'postgres';
  const dbPassword = SUPABASE_SERVICE_ROLE_KEY; // Service role key for auth
  const dbName = 'postgres';

  console.log(`Connecting to Supabase Postgres at ${dbHost}...`);

  const client = new Client({
    host: dbHost,
    port: 6543, // Supabase pooler port
    database: dbName,
    user: dbUser,
    password: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Supabase Postgres!\n');

    for (const [key, sql] of Object.entries(queries)) {
      try {
        const result = await client.query(sql);
        results[key] = result.rows;
        console.log(`✅ Fetched ${key}: ${result.rows.length} rows`);
      } catch (err: any) {
        console.warn(`⚠️  Could not fetch ${key}: ${err.message}`);
        results[key] = [];
      }
    }

    await client.end();
  } catch (err: any) {
    console.error(`❌ Database connection error: ${err.message}`);
    console.log('Falling back to empty results...');
    for (const key of Object.keys(queries)) {
      results[key] = [];
    }
  }

  // Build comprehensive report
  const report: any = {
    generated_at: new Date().toISOString(),
    supabase_project: SUPABASE_URL,
    tables: [],
    views: [],
    enums: [],
    rls_policies: [],
    summary: {
      total_tables: 0,
      total_views: 0,
      total_enums: 0,
      total_indexes: 0,
      total_constraints: 0,
      total_rls_policies: 0
    }
  };

  // Process results
  const tableNames = results.tables?.map((t: any) => t.table_name) || [];

  report.summary.total_tables = tableNames.length;
  report.summary.total_views = results.views?.length || 0;
  report.summary.total_enums = results.enums?.length || 0;

  // Consolidate table info
  for (const tableName of tableNames) {
    const tableInfo: TableInfo = {
      table_name: tableName,
      columns: results.columns?.filter((c: any) => c.table_name === tableName) || [],
      indexes: results.indexes?.filter((i: any) => i.tablename === tableName)
        .map((i: any) => ({ index_name: i.indexname, index_def: i.indexdef })) || [],
      constraints: results.constraints?.filter((c: any) => c.table_name === tableName)
        .map((c: any) => ({
          constraint_name: c.constraint_name,
          constraint_type: c.constraint_type,
          definition: c.definition
        })) || []
    };

    report.tables.push(tableInfo);
  }

  report.views = results.views || [];
  report.enums = results.enums || [];
  report.rls_policies = results.rls_policies || [];

  report.summary.total_indexes = results.indexes?.length || 0;
  report.summary.total_constraints = results.constraints?.length || 0;
  report.summary.total_rls_policies = results.rls_policies?.length || 0;

  // Save full JSON report
  const outDir = path.join(process.cwd(), 'out', 'ops', 'dbcore');
  fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, 'schema_introspection.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  console.log(`✅ Full schema saved to: ${jsonPath}\n`);

  // Print summary
  console.log('📊 SCHEMA SUMMARY');
  console.log('='.repeat(60));
  console.log(`Tables: ${report.summary.total_tables}`);
  console.log(`Views: ${report.summary.total_views}`);
  console.log(`Enums: ${report.summary.total_enums}`);
  console.log(`Indexes: ${report.summary.total_indexes}`);
  console.log(`Constraints: ${report.summary.total_constraints}`);
  console.log(`RLS Policies: ${report.summary.total_rls_policies}`);
  console.log('='.repeat(60));
  console.log('\n📋 TABLES:\n');

  for (const table of report.tables) {
    console.log(`  ${table.table_name}`);
    console.log(`    Columns: ${table.columns.length}`);
    console.log(`    Indexes: ${table.indexes.length}`);
    console.log(`    Constraints: ${table.constraints.length}`);
  }

  if (report.enums.length > 0) {
    console.log('\n🔢 ENUMS:\n');
    for (const enumInfo of report.enums) {
      console.log(`  ${enumInfo.enum_name}: ${enumInfo.values?.join(', ')}`);
    }
  }

  console.log('\n✅ Introspection complete!');

  return report;
}

introspectSchema().catch(console.error);
