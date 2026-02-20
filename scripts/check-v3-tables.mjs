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
  console.log('Connected to database\n');

  const tables = ['provider_offers', 'canonical_events', 'participants', 'market_types', 'provider_registry', 'offer_quarantine'];

  for (const table of tables) {
    const cols = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [table]);

    if (cols.rows.length > 0) {
      console.log(`${table} (${cols.rows.length} columns):`);
      cols.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));
    } else {
      console.log(`${table}: NOT FOUND`);
    }
    console.log();
  }

  await client.end();
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
