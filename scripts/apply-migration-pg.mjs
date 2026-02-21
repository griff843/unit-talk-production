#!/usr/bin/env node
/**
 * Apply a migration file to Supabase database using pg
 * Usage: node scripts/apply-migration-pg.mjs <migration-file>
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load .env file
config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: node scripts/apply-migration-pg.mjs <migration-file>');
  process.exit(1);
}

console.log('Applying migration:', migrationFile);

const sql = readFileSync(migrationFile, 'utf-8');
console.log(`SQL length: ${sql.length} characters`);

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

try {
  await client.connect();
  console.log('Connected to database');

  const result = await client.query(sql);
  console.log('Migration applied successfully');
  console.log('Result:', result);

} catch (error) {
  console.error('Migration failed:', error.message);
  process.exit(1);
} finally {
  await client.end();
}
