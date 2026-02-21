#!/usr/bin/env node
/**
 * Check database schema
 */

import pg from 'pg';
import { config } from 'dotenv';

config();

const poolerUrl = process.env.SUPABASE_DB_URL_POOLER;

const client = new pg.Client({
  connectionString: poolerUrl,
  ssl: { rejectUnauthorized: false }
});

try {
  await client.connect();

  // List all tables in public schema
  const tables = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);

  console.log('=== TABLES IN PUBLIC SCHEMA ===');
  tables.rows.forEach(r => console.log('- ' + r.table_name));

  // Check for user-related tables
  console.log('\n=== CHECKING FOR USER/CAPPER TABLES ===');
  const userTables = await client.query(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (table_name LIKE '%user%' OR table_name LIKE '%capper%' OR table_name = 'profiles')
    ORDER BY table_name, ordinal_position
    LIMIT 50
  `);

  if (userTables.rows.length > 0) {
    let currentTable = '';
    userTables.rows.forEach(r => {
      if (r.table_name !== currentTable) {
        currentTable = r.table_name;
        console.log(`\n[${currentTable}]`);
      }
      console.log(`  - ${r.column_name}: ${r.data_type}`);
    });
  } else {
    console.log('No user/capper tables found');
  }

  // Check profiles table specifically
  console.log('\n=== PROFILES TABLE ===');
  const profiles = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
    ORDER BY ordinal_position
  `);

  if (profiles.rows.length > 0) {
    profiles.rows.forEach(r => console.log(`  - ${r.column_name}: ${r.data_type} (${r.is_nullable})`));
  } else {
    console.log('profiles table not found');
  }

} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
} finally {
  await client.end();
}
