#!/usr/bin/env tsx
/**
 * Apply DB Core Migration to Supabase Cloud
 * Uses direct PostgreSQL connection via pg library
 */

import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const DB_PASSWORD = 'Adalise843!';

const DB_CONFIG = {
  host: 'db.lxqmuzmqtnnlpfapvief.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
};

interface MigrationResult {
  file: string;
  status: 'success' | 'error';
  duration_ms: number;
  error?: string;
  rows_affected?: number;
}

async function testConnection(client: Client): Promise<boolean> {
  try {
    const result = await client.query("SELECT 'auth_ok' AS tag, NOW() AT TIME ZONE 'utc' AS utc_now");
    console.log('✅ Connection test successful:', result.rows[0]);
    return true;
  } catch (error: any) {
    console.error('❌ Connection failed:', error.message);
    return false;
  }
}

async function executeSqlFile(client: Client, filePath: string): Promise<MigrationResult> {
  const fileName = path.basename(filePath);
  const startTime = Date.now();

  try {
    console.log(`\n📄 Executing ${fileName}...`);
    const sql = fs.readFileSync(filePath, 'utf-8');

    // Execute SQL
    const result = await client.query(sql);
    const duration = Date.now() - startTime;

    console.log(`✅ ${fileName} completed in ${duration}ms`);

    return {
      file: fileName,
      status: 'success',
      duration_ms: duration,
      rows_affected: result.rowCount || 0
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`❌ ${fileName} failed:`, error.message);

    return {
      file: fileName,
      status: 'error',
      duration_ms: duration,
      error: error.message
    };
  }
}

async function validateSchema(client: Client): Promise<any> {
  const validations: any = {};

  try {
    // Check new tables exist
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('scored_props', 'promotion_queue', 'picks_submissions', 'jobs', 'outbox', 'events', 'model_versions')
      ORDER BY table_name
    `);
    validations.new_tables = tables.rows.map(r => r.table_name);

    // Check partitions exist
    const partitions = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename LIKE 'raw_props_25%'
      ORDER BY tablename
    `);
    validations.partitions = partitions.rows.map(r => r.tablename);

    // Check views exist
    const views = await client.query(`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
      AND table_name LIKE 'v_%'
      ORDER BY table_name
    `);
    validations.views = views.rows.map(r => r.table_name);

    // Check unified_picks is a view
    const unifiedPicks = await client.query(`
      SELECT table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'unified_picks'
    `);
    validations.unified_picks_type = unifiedPicks.rows[0]?.table_type;

    console.log('\n✅ Schema validation:', validations);
    return validations;
  } catch (error: any) {
    console.error('❌ Validation failed:', error.message);
    return { error: error.message };
  }
}

async function main() {
  console.log('🚀 DB Core Migration Application\n');
  console.log('Target: Supabase Cloud (lxqmuzmqtnnlpfapvief)\n');

  // Create timestamp for run
  const runId = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').split('.')[0];
  const outDir = path.join(__dirname, '../../out/ops/dbcore', `run-${runId}`);

  // Ensure output directory exists
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log(`📁 Output directory: ${outDir}\n`);

  // Create PostgreSQL client
  const client = new Client(DB_CONFIG);

  try {
    // Connect to database
    console.log('🔌 Connecting to Supabase Cloud...');
    await client.connect();
    console.log('✅ Connected successfully\n');

    // Test connection
    console.log('🧪 Testing connection...');
    const connectionOk = await testConnection(client);

    if (!connectionOk) {
      throw new Error('Connection test failed - aborting migration');
    }

    // Define migration files in order
    const migrationFiles = [
      '10_core_tables.sql',
      '11_indexes.sql',
      '12_partitions.sql',
      '13_rls_policies.sql',
      '20_views.sql',
      '30_rpcs.sql',
      '40_unified_picks_view.sql'
    ];

    const baseDir = path.join(__dirname, '../../out/ops/dbcore');
    const results: MigrationResult[] = [];

    // Execute each migration file
    console.log('\n📋 Executing migrations...\n');
    for (const file of migrationFiles) {
      const filePath = path.join(baseDir, file);

      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️  File not found: ${file}, skipping...`);
        continue;
      }

      const result = await executeSqlFile(client, filePath);
      results.push(result);

      // Stop on error
      if (result.status === 'error') {
        console.error(`\n❌ Migration failed at ${file}`);
        console.error(`Error: ${result.error}`);
        break;
      }
    }

    // Validate schema
    console.log('\n🔍 Validating schema...');
    const validation = await validateSchema(client);

    // Generate summary
    const summary = {
      run_id: runId,
      timestamp: new Date().toISOString(),
      database: 'Supabase Cloud (lxqmuzmqtnnlpfapvief)',
      migrations: results,
      validation,
      total_duration_ms: results.reduce((sum, r) => sum + r.duration_ms, 0),
      success_count: results.filter(r => r.status === 'success').length,
      error_count: results.filter(r => r.status === 'error').length,
      overall_status: results.every(r => r.status === 'success') ? 'SUCCESS' : 'FAILED'
    };

    // Write summary to file
    const summaryPath = path.join(outDir, '01_migration_summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    console.log('\n📊 Migration Summary:');
    console.log(`Status: ${summary.overall_status}`);
    console.log(`Success: ${summary.success_count}/${results.length}`);
    console.log(`Total Duration: ${summary.total_duration_ms}ms`);
    console.log(`\nSummary saved to: ${summaryPath}`);

    if (summary.overall_status === 'SUCCESS') {
      console.log('\n✅ All migrations applied successfully!');
    } else {
      console.log('\n❌ Migration failed - review errors above');
      process.exit(1);
    }

  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n👋 Disconnected from database');
  }
}

main().catch(console.error);
