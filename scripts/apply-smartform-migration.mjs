#!/usr/bin/env node
/**
 * Apply SPRINT-CANONICAL-V3-SMARTFORM-075 migration
 */

import pg from 'pg';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL_POOLER || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('Connected to database\n');

  const migrationPath = join(__dirname, '../supabase/migrations/20260220140000_canonical_v3_smartform_submission.sql');
  const sql = readFileSync(migrationPath, 'utf8');

  console.log('Applying migration: 20260220140000_canonical_v3_smartform_submission.sql');
  console.log('='.repeat(60));

  try {
    await client.query(sql);
    console.log('\nMigration applied successfully!');

    // Verify columns added
    const cols = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'ticket_legs'
        AND column_name IN ('provider_value', 'override_value', 'effective_value', 'effective_source')
      ORDER BY column_name
    `);

    console.log('\nNew columns verified:');
    cols.rows.forEach(r => {
      console.log(`  ${r.column_name} (${r.data_type})`);
    });

    // Verify function created
    const func = await client.query(`
      SELECT proname
      FROM pg_proc
      WHERE proname = 'atomic_submit_ticket_v2'
    `);

    if (func.rows.length > 0) {
      console.log('\nFunction verified: atomic_submit_ticket_v2');
    }

  } catch (error) {
    console.error('\nMigration failed:', error.message);
    if (error.position) {
      console.error('At position:', error.position);
    }
    throw error;
  }

  await client.end();
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
