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

  // Check market_types schema
  const mtCols = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'market_types'
    ORDER BY ordinal_position
  `);

  console.log('market_types columns:');
  mtCols.rows.forEach(r => {
    console.log(`  ${r.column_name} (${r.data_type})${r.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
  });

  // Sample market_types data
  const mtData = await client.query('SELECT * FROM market_types LIMIT 5');
  console.log('\nSample market_types data:');
  mtData.rows.forEach(r => console.log('  ', JSON.stringify(r)));

  // Check provider_offers schema
  const poCols = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'provider_offers'
    ORDER BY ordinal_position
  `);

  console.log('\nprovider_offers columns:');
  poCols.rows.forEach(r => {
    console.log(`  ${r.column_name} (${r.data_type})${r.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
  });

  // Check existing ticket_legs constraints
  const constraints = await client.query(`
    SELECT tc.constraint_name, tc.constraint_type, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'ticket_legs'
    ORDER BY tc.constraint_type, tc.constraint_name
  `);

  console.log('\nticket_legs constraints:');
  constraints.rows.forEach(r => {
    console.log(`  ${r.constraint_name} (${r.constraint_type}): ${r.column_name}`);
  });

  // Check tickets unique constraints
  const ticketConstraints = await client.query(`
    SELECT tc.constraint_name, tc.constraint_type, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'tickets'
    ORDER BY tc.constraint_type, tc.constraint_name
  `);

  console.log('\ntickets constraints:');
  ticketConstraints.rows.forEach(r => {
    console.log(`  ${r.constraint_name} (${r.constraint_type}): ${r.column_name}`);
  });

  await client.end();
}

run().catch(e => { console.error(e); process.exit(1); });
