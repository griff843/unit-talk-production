#!/usr/bin/env tsx
/**
 * Apply batch_id migration to raw_props table
 * Adds batch_id column for FeedAgent ingestion grouping
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const DATABASE_URL = 'postgresql://postgres.lxqmuzmqtnnlpfapvief:Adalise843!@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

async function applyMigration() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔗 Connecting to Supabase...');
    await client.connect();
    console.log('✅ Connected');

    const migration = `
-- Migration: Add batch_id column to raw_props
-- Date: 2025-10-07
-- Purpose: Fix FeedAgent ingestion failure due to missing batch_id column

-- Add batch_id column to raw_props table
ALTER TABLE public.raw_props
ADD COLUMN IF NOT EXISTS batch_id TEXT;

-- Add index on batch_id for query performance
CREATE INDEX IF NOT EXISTS idx_raw_props_batch_id
ON public.raw_props(batch_id);

-- Add comment
COMMENT ON COLUMN public.raw_props.batch_id IS 'Batch identifier for grouping props from the same ingestion cycle';

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
    `;

    console.log('\n📝 Applying migration: 20251007_add_batch_id_to_raw_props.sql');
    console.log('   - Adding batch_id column to raw_props');
    console.log('   - Creating index on batch_id');
    console.log('   - Reloading PostgREST schema cache\n');

    await client.query(migration);

    console.log('✅ Migration applied successfully\n');

    // Verify column exists
    const { rows } = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'raw_props'
        AND column_name = 'batch_id';
    `);

    if (rows.length > 0) {
      console.log('✅ Verification successful:');
      console.log(`   - Column: ${rows[0].column_name}`);
      console.log(`   - Type: ${rows[0].data_type}`);
    } else {
      console.error('❌ Verification failed: batch_id column not found');
      process.exit(1);
    }

    // Check index
    const { rows: indexRows } = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'raw_props'
        AND indexname = 'idx_raw_props_batch_id';
    `);

    if (indexRows.length > 0) {
      console.log(`   - Index: ${indexRows[0].indexname} ✅`);
    }

    console.log('\n🎉 Migration complete - FeedAgent can now write with batch_id');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration().catch(console.error);
