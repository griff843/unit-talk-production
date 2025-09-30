#!/usr/bin/env npx tsx

/**
 * Live RLS (Row Level Security) Audit - Fixed Version
 */

import { Client } from 'pg';
import { writeFileSync } from 'fs';
import { join } from 'path';

const DB_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'unit_talk_dev',
  user: 'postgres',
  password: 'development_password_2024'
};

const HOT_TIER_TABLES = [
  'unified_picks',
  'raw_props',
  'approval_queue',
  'alerts_queue',
  'scoring_explanations',
  'runtime_config',
  'temporal_metrics'
];

async function main() {
  const client = new Client(DB_CONFIG);
  const result = {
    timestamp: new Date().toISOString(),
    status: 'compliant',
    total_tables_checked: 0,
    tables_with_rls: 0,
    tables_without_rls: 0,
    table_details: [],
    errors: []
  };

  try {
    await client.connect();

    for (const tableName of HOT_TIER_TABLES) {
      result.total_tables_checked++;

      // Check if table exists and has RLS
      const tableCheck = await client.query(`
        SELECT
          relname as table_name,
          relrowsecurity as has_rls
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
        AND c.relname = $1
        AND c.relkind = 'r'
      `, [tableName]);

      if (tableCheck.rows.length === 0) {
        result.table_details.push({
          table_name: tableName,
          has_rls: false,
          has_org_id_column: false,
          policy_count: 0,
          compliance_status: 'missing_rls'
        });
        continue;
      }

      const hasRLS = tableCheck.rows[0].has_rls;

      // Check for org_id column
      const columnCheck = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = 'org_id'
      `, [tableName]);

      const hasOrgIdColumn = columnCheck.rows.length > 0;

      if (hasRLS) {
        result.tables_with_rls++;
      } else {
        result.tables_without_rls++;
      }

      result.table_details.push({
        table_name: tableName,
        has_rls: hasRLS,
        has_org_id_column: hasOrgIdColumn,
        policy_count: 0,
        compliance_status: hasRLS && hasOrgIdColumn ? 'compliant' : 'missing_rls'
      });
    }

  } catch (error) {
    result.errors.push(`RLS audit failed: ${error.message}`);
    result.status = 'error';
  } finally {
    await client.end();
  }

  const nonCompliantTables = result.table_details.filter(
    table => table.compliance_status !== 'compliant'
  ).length;

  if (result.status !== 'error') {
    result.status = nonCompliantTables === 0 ? 'compliant' : 'non_compliant';
  }

  const outputPath = join(process.cwd(), 'out', 'db', 'rls-audit.json');
  writeFileSync(outputPath, JSON.stringify(result, null, 2));

  console.log(`RLS audit completed: ${result.status}`);
  console.log(`Tables checked: ${result.total_tables_checked}`);
  console.log(`Results written to: ${outputPath}`);
}

main().catch(console.error);