#!/usr/bin/env node
/**
 * Apply a migration file to Supabase database using pooler URL
 * Usage: node scripts/apply-migration-pooler.mjs <migration-file>
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load .env file
config();

const poolerUrl = process.env.SUPABASE_DB_URL_POOLER;

if (!poolerUrl) {
  console.error('Missing SUPABASE_DB_URL_POOLER');
  process.exit(1);
}

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: node scripts/apply-migration-pooler.mjs <migration-file>');
  process.exit(1);
}

console.log('Applying migration:', migrationFile);

const sql = readFileSync(migrationFile, 'utf-8');
console.log(`SQL length: ${sql.length} characters`);

const client = new pg.Client({
  connectionString: poolerUrl,
  ssl: { rejectUnauthorized: false }
});

try {
  await client.connect();
  console.log('Connected to database via pooler');

  const result = await client.query(sql);
  console.log('Migration applied successfully');

} catch (error) {
  console.error('Migration failed:', error.message);
  process.exit(1);
} finally {
  await client.end();
}
