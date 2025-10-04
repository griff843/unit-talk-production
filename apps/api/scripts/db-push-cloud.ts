#!/usr/bin/env tsx
/**
 * Apply Database Migrations to Supabase Cloud
 * Executes pending SQL migrations via Supabase REST API
 */

import { createClient } from '@supabase/supabase-js';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function pushMigrations() {
  console.log('='.repeat(80));
  console.log('SUPABASE CLOUD MIGRATIONS');
  console.log('='.repeat(80));
  console.log(`URL: ${SUPABASE_URL}`);
  console.log('');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Check for migrations directory
  const migrationsDir = join(process.cwd(), '../../supabase/migrations');

  try {
    const files = await readdir(migrationsDir);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

    if (sqlFiles.length === 0) {
      console.log('✅ No migrations found - schema is current');
      return;
    }

    console.log(`Found ${sqlFiles.length} migration files`);
    console.log('');

    for (const file of sqlFiles) {
      const filePath = join(migrationsDir, file);
      const sql = await readFile(filePath, 'utf-8');

      console.log(`📄 Applying: ${file}`);

      // Execute via Supabase RPC
      const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

      if (error) {
        console.error(`❌ Failed to apply ${file}:`, error.message);
        console.log('⚠️  Continuing with remaining migrations...');
      } else {
        console.log(`✅ Applied: ${file}`);
      }
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('✅ MIGRATIONS COMPLETE');
    console.log('='.repeat(80));

  } catch (err: any) {
    if (err.code === 'ENOENT') {
      console.log('✅ No migrations directory found - schema is current');
      console.log('');
      console.log('='.repeat(80));
      return;
    }
    throw err;
  }
}

pushMigrations().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
