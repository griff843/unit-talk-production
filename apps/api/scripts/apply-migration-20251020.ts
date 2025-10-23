#!/usr/bin/env tsx
/**
 * Apply Migration: 20251020_api_quota_configs_extension
 * Date: 2025-10-20
 * 
 * Applies the api_quota_configs extension migration directly to Supabase Cloud
 * using DATABASE_DIRECT_URL (port 5432, sslmode=require).
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function applyMigration() {
  // Try simple postgres username (2025-10-20)
  const directUrl = 'postgresql://postgres:Adalise843!@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

  const client = new Client({
    connectionString: directUrl,
    ssl: {
      rejectUnauthorized: false, // Docker container doesn't have CA certs
    },
  });

  try {
    await client.connect();
    console.log('✅ Connected to Supabase (direct connection, port 5432)');

    const migrationPath = path.resolve(__dirname, '../../../supabase/migrations/20251020_api_quota_configs_extension.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Executing migration: 20251020_api_quota_configs_extension.sql');
    console.log(`   Path: ${migrationPath}`);
    
    await client.query(sql);
    console.log('✅ Migration applied successfully');

    // Verify table exists and has new columns
    const result = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='api_quota_configs'
      ORDER BY ordinal_position
    `);

    console.log('\n✅ Verified api_quota_configs schema:');
    result.rows.forEach(row => {
      const def = row.column_default ? ` (default: ${row.column_default})` : '';
      console.log(`  - ${row.column_name} (${row.data_type})${def}`);
    });

    // Check if oddsapi row exists
    const oddsapiRow = await client.query(`
      SELECT provider, daily_limit, monthly_limit, enabled, emergency_freeze, rpm
      FROM public.api_quota_configs
      WHERE provider = 'oddsapi'
    `);

    if (oddsapiRow.rows.length > 0) {
      console.log('\n✅ oddsapi config row exists:');
      console.log(`   ${JSON.stringify(oddsapiRow.rows[0], null, 2)}`);
    } else {
      console.log('\n⚠️  oddsapi config row not found (will be created on first use)');
    }

    console.log('\n🎉 Migration complete. Restart API to pick up schema changes.');

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    if (error.detail) {
      console.error(`   Detail: ${error.detail}`);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();

