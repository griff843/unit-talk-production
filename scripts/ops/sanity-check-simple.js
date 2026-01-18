#!/usr/bin/env node
/**
 * Simple Sanity Check - Direct PostgreSQL Connection
 * Date: 2025-01-29
 */

require('dotenv').config();
const { Client } = require('pg');

const log = {
  info: (msg) => console.log(`[\x1b[36mINFO\x1b[0m] ${msg}`),
  success: (msg) => console.log(`[\x1b[32mPASS\x1b[0m] ${msg}`),
  error: (msg) => console.log(`[\x1b[31mFAIL\x1b[0m] ${msg}`),
  warn: (msg) => console.log(`[\x1b[33mWARN\x1b[0m] ${msg}`)
};

async function main() {
  console.log('');
  console.log('='.repeat(80));
  console.log('PRE-CHECK: DATABASE CONNECTION & SCHEMA STATE');
  console.log('='.repeat(80));
  console.log('');

  // Mask secrets
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const dbUrl = process.env.DATABASE_DIRECT_URL || '';

  log.info('Environment Configuration:');
  console.log(`  SUPABASE_URL: ${supabaseUrl.substring(0, 30)}***`);
  console.log(`  SUPABASE_SERVICE_ROLE_KEY: ${serviceKey.substring(0, 20)}***`);
  console.log(`  DATABASE_DIRECT_URL: ${dbUrl.substring(0, 40)}***`);
  console.log('');

  // Parse connection string to avoid "Tenant or user not found" error
  // Use Session mode (port 5432) instead of Transaction mode (port 6543)
  let connectionString = dbUrl;
  
  // If using pooler.supabase.com:6543, switch to :5432
  if (connectionString.includes(':6543')) {
    connectionString = connectionString.replace(':6543', ':5432');
    log.warn('Switched from port 6543 (transaction) to 5432 (session) for compatibility');
  }

  const client = new Client({ connectionString });

  try {
    log.info('Connecting to database...');
    await client.connect();
    log.success('Connected successfully');
    console.log('');

    // Run sanity check query
    const sql = `
      SELECT 
        current_database() as database,
        current_user as "user",
        to_regclass('public.picks') as picks_table,
        to_regclass('public.pick_publish') as pick_publish_table
    `;

    log.info('Running sanity check query...');
    const result = await client.query(sql);
    const row = result.rows[0];

    console.log('');
    console.log('='.repeat(80));
    console.log('SANITY CHECK RESULTS');
    console.log('='.repeat(80));
    console.log('');
    console.log(`  Database: ${row.database}`);
    console.log(`  User: ${row.user}`);
    console.log(`  picks table: ${row.picks_table || 'NULL (not found)'}`);
    console.log(`  pick_publish table: ${row.pick_publish_table || 'NULL (not found)'}`);
    console.log('');

    const picksExists = row.picks_table !== null;
    const pickPublishExists = row.pick_publish_table !== null;

    if (!picksExists || !pickPublishExists) {
      log.warn('MIGRATION REQUIRED - Tables not found');
      console.log('');
      console.log('Next Step: Apply canonical schema migration');
      console.log('');
      process.exit(0); // Exit 0 to continue workflow
    } else {
      log.success('SCHEMA EXISTS - Tables found');
      console.log('');
      console.log('Next Step: Verify PostgREST visibility');
      console.log('');
      process.exit(0);
    }

  } catch (err) {
    log.error(`Database error: ${err.message}`);
    console.log('');
    console.log('Troubleshooting:');
    console.log('  1. Verify DATABASE_DIRECT_URL in .env');
    console.log('  2. Check Supabase project is active');
    console.log('  3. Verify network connectivity');
    console.log('');
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

