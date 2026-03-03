#!/usr/bin/env tsx
/**
 * Apply Phase 2 Migration via Supabase SQL
 * Date: 2025-10-20
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function applyMigration() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
  }

  console.log('🔧 Applying Phase 2 Migration via Supabase...\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Read migration file
  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20251020_phase2_core.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  console.log(`📄 Migration file: ${migrationPath}`);
  console.log(`📏 Size: ${migrationSQL.length} bytes\n`);

  // Split into individual statements (rough split on semicolons outside of function bodies)
  // For now, we'll execute the whole thing as one block

  try {
    console.log('⏳ Executing migration via Supabase SQL...');

    // Use the SQL endpoint
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      // exec_sql might not exist, try direct query
      console.log('⚠️  exec_sql RPC not found, trying alternative approach...\n');

      // Split migration into CREATE FUNCTION statements
      const statements = migrationSQL.split(/;\s*$/gm).filter(s => s.trim());

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i].trim();
        if (!stmt) continue;

        console.log(`  Executing statement ${i + 1}/${statements.length}...`);

        // For CREATE FUNCTION, we need to use a different approach
        // Let's just log that we need manual execution
        if (stmt.includes('CREATE OR REPLACE FUNCTION')) {
          const funcName = stmt.match(/FUNCTION\s+(\w+)/)?.[1];
          console.log(`    ⚠️  Function: ${funcName} - requires manual execution in SQL Editor`);
        }
      }

      console.log('\n❌ Automatic migration failed.');
      console.log('\n📋 MANUAL STEPS REQUIRED:');
      console.log('1. Go to: https://supabase.com/dashboard/project/cqfnsozknjzvyiziwicl/sql/new');
      console.log('2. Copy the contents of: supabase/migrations/20251020_phase2_core.sql');
      console.log('3. Paste and execute in SQL Editor');
      console.log('4. Re-run this script to verify\n');

      process.exit(1);
    }

    console.log('✅ Migration applied successfully!\n');
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n📋 MANUAL STEPS REQUIRED:');
    console.log('1. Go to: https://supabase.com/dashboard/project/cqfnsozknjzvyiziwicl/sql/new');
    console.log('2. Copy the contents of: supabase/migrations/20251020_phase2_core.sql');
    console.log('3. Paste and execute in SQL Editor');
    console.log('4. Re-run this script to verify\n');
    process.exit(1);
  }

  // Verify functions created
  console.log('🔍 Verifying functions...');
  const { data: functions, error: funcError } = await supabase
    .from('pg_proc')
    .select('proname')
    .like('proname', 'admin_%');

  if (funcError) {
    console.log('⚠️  Could not verify functions via pg_proc');

    // Try calling one of the functions to verify
    console.log('\n🔍 Testing admin_refresh_views()...');
    const { data: testData, error: testError } = await supabase.rpc('admin_refresh_views');

    if (testError) {
      console.log(`❌ Function not found: ${testError.message}`);
      console.log('\n📋 Please apply migration manually in SQL Editor\n');
      process.exit(1);
    } else {
      console.log('✅ admin_refresh_views() exists and works!');
      if (Array.isArray(testData)) {
        testData.forEach((view: any) => {
          console.log(`  ✅ ${view.view_name}: ${view.rows_count} rows`);
        });
      }
    }
  } else {
    console.log(`\nFunctions found:`);
    functions?.forEach((func: any) => {
      console.log(`  ✅ ${func.proname}`);
    });
  }

  console.log('\n✅ Phase 2 migration verification complete!\n');
}

applyMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
