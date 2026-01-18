#!/usr/bin/env node
/**
 * PostgREST Reload via Direct PostgreSQL Connection
 * Uses service role credentials to bypass RLS
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
  console.log('POSTGREST SCHEMA RELOAD - DIRECT CONNECTION');
  console.log('='.repeat(80));
  console.log('');

  // Parse DATABASE_DIRECT_URL to add role parameter
  let connectionString = process.env.DATABASE_DIRECT_URL;
  
  if (!connectionString) {
    log.error('DATABASE_DIRECT_URL not found in environment');
    process.exit(1);
  }

  // Add role=service_role to bypass RLS
  const url = new URL(connectionString);
  url.searchParams.set('options', '-c role=service_role');
  
  const client = new Client({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false }
  });

  try {
    log.info('Connecting to database with service_role...');
    await client.connect();
    log.success('Connected successfully');

    // Execute pg_notify to reload PostgREST schema
    log.info('Sending PostgREST reload notification...');
    await client.query(`SELECT pg_notify('pgrst', 'reload schema')`);
    log.success('PostgREST reload notification sent');

    // Verify tables exist
    log.info('Verifying canonical tables...');
    const result = await client.query(`
      SELECT 
        to_regclass('public.picks') as picks_table,
        to_regclass('public.pick_publish') as pick_publish_table,
        (SELECT count(*) FROM public.picks) as picks_count,
        (SELECT count(*) FROM public.pick_publish) as pick_publish_count
    `);

    const row = result.rows[0];
    log.success(`Tables verified - picks: ${row.picks_table}, pick_publish: ${row.pick_publish_table}`);
    log.info(`Row counts - picks: ${row.picks_count}, pick_publish: ${row.pick_publish_count}`);

    console.log('');
    console.log('='.repeat(80));
    log.success('POSTGREST RELOAD COMPLETE');
    console.log('='.repeat(80));
    console.log('');
    console.log('Next Steps:');
    console.log('  1. Wait 20 seconds for schema propagation');
    console.log('  2. Verify: npx tsx scripts/ops/verify-pgrst-visible.ts');
    console.log('  3. Start stack: ./dev.sh start');
    console.log('  4. Run validation: .\\scripts\\ops\\self-heal-and-validate.ps1');
    console.log('');

  } catch (err) {
    log.error(`Failed: ${err.message}`);
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

