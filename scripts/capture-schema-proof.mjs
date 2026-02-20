#!/usr/bin/env node
import pg from 'pg';
import { config } from 'dotenv';

config();

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL_POOLER || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('=== SCHEMA VERIFICATION FOR SPRINT-075 ===\n');

  // Check new columns on ticket_legs
  const cols = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'ticket_legs'
      AND column_name IN ('provider_value', 'override_value', 'effective_value', 'effective_source')
    ORDER BY column_name
  `);

  console.log('ticket_legs new columns:');
  cols.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

  // Check constraints
  const cons = await client.query(`
    SELECT constraint_name, constraint_type
    FROM information_schema.table_constraints
    WHERE table_name = 'ticket_legs'
      AND constraint_name LIKE '%effective_source%'
  `);

  console.log('\neffective_source constraints:');
  cons.rows.forEach(r => console.log(`  ${r.constraint_name} (${r.constraint_type})`));

  // Check function
  const func = await client.query(`
    SELECT proname, pronargs
    FROM pg_proc
    WHERE proname = 'atomic_submit_ticket_v2'
  `);

  console.log('\nFunction verified:');
  func.rows.forEach(r => console.log(`  ${r.proname} (args: ${r.pronargs})`));

  // Check index
  const idx = await client.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'ticket_legs' AND indexname LIKE '%effective%'
  `);

  console.log('\nNew indexes:');
  idx.rows.forEach(r => console.log(`  ${r.indexname}`));

  // Check idempotency constraint
  const uniq = await client.query(`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'tickets' AND constraint_type = 'UNIQUE'
  `);

  console.log('\ntickets UNIQUE constraints (idempotency):');
  uniq.rows.forEach(r => console.log(`  ${r.constraint_name}`));

  await client.end();
}

run().catch(e => { console.error(e); process.exit(1); });
