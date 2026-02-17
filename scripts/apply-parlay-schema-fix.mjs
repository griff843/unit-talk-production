/**
 * PARLAY-SCHEMA-FIX-029 Migration Script
 * Applies the parlay schema fix directly to cloud database
 *
 * Run: node scripts/apply-parlay-schema-fix.mjs
 */

import pg from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Use pooler URL for cloud connection
const connectionString = process.env.SUPABASE_DB_URL_POOLER || process.env.DATABASE_URL;
console.log('Connecting to:', connectionString?.split('@')[1]?.split('/')[0] || 'unknown');

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  console.log('=== PARLAY-SCHEMA-FIX-029 MIGRATION ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('');

  const client = await pool.connect();

  try {
    // Step 1: Backfill NULL leg_index values
    console.log('Step 1: Backfilling NULL leg_index values...');
    const backfillResult = await client.query(`
      UPDATE unified_picks
      SET leg_index = 0
      WHERE leg_index IS NULL
    `);
    console.log(`Backfilled ${backfillResult.rowCount} rows`);

    // Step 2: Set default and NOT NULL
    console.log('\nStep 2: Setting leg_index default and NOT NULL...');
    try {
      await client.query('ALTER TABLE unified_picks ALTER COLUMN leg_index SET DEFAULT 0');
      console.log('Default set to 0');
    } catch (e) {
      console.log('Default already set or error:', e.message);
    }

    try {
      await client.query('ALTER TABLE unified_picks ALTER COLUMN leg_index SET NOT NULL');
      console.log('NOT NULL constraint added');
    } catch (e) {
      console.log('NOT NULL already set or error:', e.message);
    }

    // Step 3: Drop the blocking unique index
    console.log('\nStep 3: Dropping idx_unified_picks_bet_slip_id_unique...');
    await client.query('DROP INDEX IF EXISTS idx_unified_picks_bet_slip_id_unique');
    console.log('SUCCESS: Index dropped');

    // Step 4: Create composite unique index
    console.log('\nStep 4: Creating idx_unified_picks_bet_slip_leg_unique...');
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_unified_picks_bet_slip_leg_unique
      ON unified_picks (bet_slip_id, leg_index)
      WHERE bet_slip_id IS NOT NULL
    `);
    console.log('SUCCESS: Composite unique index created');

    // Step 5: Create non-unique index for queries
    console.log('\nStep 5: Creating idx_unified_picks_bet_slip_id...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_unified_picks_bet_slip_id
      ON unified_picks (bet_slip_id)
      WHERE bet_slip_id IS NOT NULL
    `);
    console.log('SUCCESS: Query index created');

    // Verify indexes
    console.log('\n=== VERIFYING INDEXES ===');
    const result = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'unified_picks'
      AND indexname LIKE '%bet_slip%'
      ORDER BY indexname
    `);

    for (const row of result.rows) {
      console.log('\nIndex:', row.indexname);
      console.log('  DDL:', row.indexdef);
    }

    console.log('\n=== MIGRATION COMPLETE ===');

  } catch (err) {
    console.error('\nMIGRATION ERROR:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
