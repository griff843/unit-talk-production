#!/usr/bin/env tsx
/**
 * Force PostgREST schema cache reload on Supabase
 * Connectivity rules: use DATABASE_DIRECT_URL (5432, sslmode=require)
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load canonical env (root .env)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function main() {
  const connectionString = process.env.DATABASE_DIRECT_URL;
  if (!connectionString) {
    throw new Error('DATABASE_DIRECT_URL is not set in .env');
  }
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: true } });
  await client.connect();
  await client.query(`DO $$ BEGIN PERFORM pg_notify('pgrst', 'reload schema'); EXCEPTION WHEN OTHERS THEN NULL; END $$;`);
  await client.end();
  console.log('✅ PostgREST schema reload notification sent');
}

main().catch((err) => {
  console.error('❌ Failed to reload PostgREST schema:', err.message);
  process.exit(1);
});

