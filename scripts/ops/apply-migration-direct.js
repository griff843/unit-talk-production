#!/usr/bin/env node
/**
 * Apply Canonical Migration Directly via PostgreSQL
 * Date: 2025-01-29
 */

require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const log = {
  info: (msg) => console.log(`[\x1b[36mINFO\x1b[0m] ${msg}`),
  success: (msg) => console.log(`[\x1b[32mPASS\x1b[0m] ${msg}`),
  error: (msg) => console.log(`[\x1b[31mFAIL\x1b[0m] ${msg}`),
  warn: (msg) => console.log(`[\x1b[33mWARN\x1b[0m] ${msg}`)
};

async function main() {
  console.log('');
  console.log('='.repeat(80));
  console.log('CANONICAL MIGRATION APPLICATION');
  console.log('='.repeat(80));
  console.log('');

  // Load migration SQL
  const migrationPath = path.join(__dirname, '../migrations/2025-01-28_canonical_convergence.sql');
  
  if (!fs.existsSync(migrationPath)) {
    log.error(`Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  let migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  
  // Remove psql-specific commands (\echo)
  migrationSQL = migrationSQL.replace(/\\echo[^\n]*/g, '-- (echo removed)');
  
  log.info(`Migration file loaded (${migrationSQL.length} bytes)`);

  // Connect to database
  const client = new Client({
    connectionString: process.env.DATABASE_DIRECT_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    log.info('Connecting to database...');
    await client.connect();
    log.success('Connected to database');

    // Get current database info
    const dbInfo = await client.query(`
      SELECT current_database() as database, current_user as "user"
    `);
    log.info(`Database: ${dbInfo.rows[0].database}, User: ${dbInfo.rows[0].user}`);

    // Check current state
    log.info('Checking current schema state...');
    const preCheck = await client.query(`
      SELECT 
        to_regclass('public.picks') as picks_table,
        to_regclass('public.pick_publish') as pick_publish_table
    `);
    
    log.info(`Before migration - picks: ${preCheck.rows[0].picks_table || 'NULL'}, pick_publish: ${preCheck.rows[0].pick_publish_table || 'NULL'}`);

    // Apply migration
    log.info('Applying migration...');
    await client.query(migrationSQL);
    log.success('Migration applied successfully');

    // Verify tables exist
    log.info('Verifying tables...');
    const postCheck = await client.query(`
      SELECT 
        to_regclass('public.picks') as picks_table,
        to_regclass('public.pick_publish') as pick_publish_table,
        (SELECT count(*) FROM public.picks) as picks_count,
        (SELECT count(*) FROM public.pick_publish) as pick_publish_count
    `);

    const result = postCheck.rows[0];
    log.success(`After migration - picks: ${result.picks_table}, pick_publish: ${result.pick_publish_table}`);
    log.info(`Row counts - picks: ${result.picks_count}, pick_publish: ${result.pick_publish_count}`);

    // Force PostgREST reload
    log.info('Forcing PostgREST schema reload...');
    await client.query(`SELECT pg_notify('pgrst', 'reload schema')`);
    log.success('PostgREST reload notification sent');

    console.log('');
    console.log('='.repeat(80));
    log.success('MIGRATION COMPLETE');
    console.log('='.repeat(80));
    console.log('');
    console.log('Next Steps:');
    console.log('  1. Verify PostgREST visibility: node scripts/ops/verify-pgrst-visible.ts');
    console.log('  2. Start services: ./dev.sh start');
    console.log('  3. Run validation: .\\scripts\\ops\\self-heal-and-validate.ps1');
    console.log('');

  } catch (err) {
    log.error(`Migration failed: ${err.message}`);
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

