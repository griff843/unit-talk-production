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

  const tables = ['feature_snapshots', 'scored_legs', 'tickets', 'ticket_legs'];

  for (const t of tables) {
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [t]);

    if (cols.rows.length > 0) {
      console.log(`${t} (${cols.rows.length} columns):`);
      cols.rows.forEach(r => {
        console.log(`  ${r.column_name} (${r.data_type})${r.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
      });
    } else {
      console.log(`${t}: NOT FOUND`);
    }
    console.log();
  }

  // Check existing constraints
  const constraints = await client.query(`
    SELECT tc.table_name, tc.constraint_name, tc.constraint_type
    FROM information_schema.table_constraints tc
    WHERE tc.table_schema = 'public'
      AND tc.table_name IN ('feature_snapshots', 'scored_legs')
    ORDER BY tc.table_name, tc.constraint_type
  `);

  console.log('Existing constraints:');
  constraints.rows.forEach(r => {
    console.log(`  ${r.table_name}.${r.constraint_name} (${r.constraint_type})`);
  });

  // Check existing indexes
  const indexes = await client.query(`
    SELECT tablename, indexname
    FROM pg_indexes
    WHERE tablename IN ('feature_snapshots', 'scored_legs')
    ORDER BY tablename, indexname
  `);

  console.log('\nExisting indexes:');
  indexes.rows.forEach(r => {
    console.log(`  ${r.tablename}.${r.indexname}`);
  });

  await client.end();
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
