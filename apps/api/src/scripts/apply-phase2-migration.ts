#!/usr/bin/env tsx
/**
 * Apply Phase 2 Migration Directly
 * Date: 2025-10-20
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function applyMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL not set');
  }

  console.log('🔧 Applying Phase 2 Migration...\n');

  // Disable SSL verification for Supabase pooler
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  const client = new Client({
    connectionString,
    statement_timeout: 30000, // 30 seconds
  });

  await client.connect();

  // Read migration file
  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20251020_phase2_core.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  console.log(`📄 Migration file: ${migrationPath}`);
  console.log(`📏 Size: ${migrationSQL.length} bytes\n`);

  try {
    console.log('⏳ Executing migration...');
    await client.query(migrationSQL);
    console.log('✅ Migration applied successfully!\n');

    // Verify functions created
    console.log('🔍 Verifying functions...');
    const result = await client.query(`
      SELECT routine_name, routine_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_name LIKE 'admin_%'
      ORDER BY routine_name
    `);

    console.log(`\nFunctions created:`);
    result.rows.forEach(row => {
      console.log(`  ✅ ${row.routine_name} (${row.routine_type})`);
    });

    // Verify views
    console.log('\n🔍 Verifying views...');
    const viewResult = await client.query(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('v_prop_read_model', 'v_daily_board')
    `);

    console.log(`\nViews created:`);
    viewResult.rows.forEach(row => {
      console.log(`  ✅ ${row.table_name} (${row.table_type})`);
    });

    console.log('\n✅ Phase 2 migration complete!\n');

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

applyMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

