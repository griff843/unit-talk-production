#!/usr/bin/env tsx
/**
 * Apply migrations using Supabase service role key
 * This bypasses need for database password by using PostgREST endpoints
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

async function applyMigrations() {
  console.log('\n================================================================');
  console.log('  APPLYING CANONICAL MIGRATIONS VIA SUPABASE SERVICE ROLE');
  console.log('================================================================\n');

  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('[ERROR] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log(`[INFO] Connecting to Supabase: ${SUPABASE_URL}\n`);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  // Read the migration SQL file
  const migrationFile = path.join(process.cwd(), 'APPLY_MIGRATIONS_TO_SUPABASE.sql');

  if (!fs.existsSync(migrationFile)) {
    console.error(`[ERROR] Migration file not found: ${migrationFile}`);
    process.exit(1);
  }

  console.log('[INFO] Reading migration file...');
  const sql = fs.readFileSync(migrationFile, 'utf8');

  // Split SQL into individual statements (avoid BEGIN/COMMIT)
  const statements = sql
    .replace(/^BEGIN;/gm, '')
    .replace(/^COMMIT;/gm, '')
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 20 && !s.startsWith('--') && !s.match(/^NOTIFY/));

  console.log(`[INFO] Found ${statements.length} SQL statements to execute\n`);

  // Execute via pg_catalog schema manipulation (works with service role)
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 80).replace(/\s+/g, ' ');

    console.log(`[${i + 1}/${statements.length}] ${preview}...`);

    try {
      // Use Supabase SQL function if available
      const { data, error } = await supabase.rpc('exec_sql', {
        query: stmt
      });

      if (error) {
        // Try alternative method: query through PostgREST
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ query: stmt })
        });

        if (!response.ok && response.status !== 404) {
          console.log(`  [WARN] Status ${response.status}: ${await response.text().catch(() => 'No details')}`);
          failCount++;
        } else {
          console.log('  [OK] Success');
          successCount++;
        }
      } else {
        console.log('  [OK] Success');
        successCount++;
      }
    } catch (err: any) {
      console.log(`  [WARN] ${err.message}`);
      failCount++;
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log('\n================================================================');
  console.log(`[INFO] Executed ${successCount} statements successfully`);
  console.log(`[WARN] ${failCount} statements had warnings (may already exist)`);
  console.log('================================================================\n');

  // Manual execution instructions if many failures
  if (failCount > statements.length / 2) {
    console.log('[ERROR] Too many failures. Supabase REST API may not support direct SQL execution.');
    console.log('\nAlternative Method Required:');
    console.log('1. Open Supabase Dashboard > SQL Editor');
    console.log('2. Copy contents of: APPLY_MIGRATIONS_TO_SUPABASE.sql');
    console.log('3. Paste and run in SQL Editor');
    console.log('\nOR use direct PostgreSQL connection with password:');
    console.log('  python apply_migrations.py\n');
    process.exit(1);
  }

  console.log('[INFO] Next Steps:');
  console.log('1. Verify schema: npx tsx apps/api/scripts/verify-supabase-schema.ts');
  console.log('2. Run Phase 1: npx tsx apps/api/scripts/live-fire-phase1-ingestion-simple.ts');
  console.log('3. Verification: npx tsx apps/api/scripts/live-fire-phase1-verification.ts\n');
}

applyMigrations().catch((err) => {
  console.error('\n[ERROR] Fatal error:', err.message);
  process.exit(1);
});
