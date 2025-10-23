#!/usr/bin/env node
/**
 * Apply Migration from Host Machine (not Docker)
 * Date: 2025-10-20
 * 
 * Run this script directly on the host machine where DNS resolution works.
 * Usage: node scripts/apply-migration-host.mjs
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyMigration() {
  // Try direct connection to db.PROJECT.supabase.co:5432
  const connectionString = 'postgresql://postgres:Adalise843!@db.cqfnsozknjzvyiziwicl.supabase.co:5432/postgres?sslmode=require';
  
  console.log('🔧 Applying migration: 20251020_api_quota_configs_extension.sql');
  console.log(`📡 Connecting to: db.cqfnsozknjzvyiziwicl.supabase.co:5432`);
  console.log('');

  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false, // Accept self-signed certs
    },
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    const migrationPath = path.resolve(__dirname, '../supabase/migrations/20251020_api_quota_configs_extension.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Executing migration SQL...');
    await client.query(sql);

    console.log('✅ Migration applied successfully!');
    console.log('');

    // Verify columns exist
    const { rows } = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='api_quota_configs'
      ORDER BY ordinal_position;
    `);

    console.log('✅ Verified api_quota_configs columns:');
    rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

    console.log('');
    console.log('🎉 Migration complete!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Restart API: ./dev.sh restart api');
    console.log('  2. Check logs: docker-compose logs api --tail=100 | grep -i quota');
    console.log('');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();

