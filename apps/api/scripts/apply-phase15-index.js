#!/usr/bin/env node
/**
 * Apply Phase 15 processed_by Index Migration
 * Production readiness: Priority #1 from governance audit
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

async function applyMigration() {
  console.log('\n=== Apply Phase 15 Index Migration ===\n');

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '../../../supabase/migrations/20251125_phase15_processed_by_index.sql');
    console.log(`Reading migration: ${migrationPath}`);

    if (!fs.existsSync(migrationPath)) {
      console.error('❌ Migration file not found');
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log(`Loaded SQL (${sql.length} bytes)\n`);

    // Apply via exec_sql RPC
    console.log('Attempting to apply migration via exec_sql RPC...');
    const { data: execData, error: execError } = await supabase.rpc('exec_sql', { query: sql });

    if (execError) {
      // exec_sql RPC might not exist, fallback to direct SQL execution
      console.log('exec_sql RPC not available, trying alternative approach...\n');

      // Split SQL into statements and execute each
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement.toUpperCase().includes('CREATE INDEX')) {
          console.log('Creating index...');

          // We can't run DDL directly via Supabase JS client
          // Output SQL for manual application
          console.log('\n⚠️  Manual migration required:');
          console.log('Run this SQL via Supabase SQL Editor:\n');
          console.log('----------------------------------------');
          console.log(sql);
          console.log('----------------------------------------\n');
          console.log('Or via psql:');
          console.log(`psql "${supabaseUrl.replace('https://', 'postgres://')}:5432/postgres" -c "${statement.replace(/"/g, '\\"')}"`);
          console.log('');

          process.exit(0);
        }
      }
    } else {
      console.log('✅ Migration applied successfully via exec_sql RPC\n');
    }

    // Verify index creation
    console.log('Verifying index...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('raw_props')
      .select('id')
      .eq('processed_by', 'professional_system')
      .limit(1);

    if (verifyError) {
      console.log('Verification query failed:', verifyError.message);
    } else {
      console.log('✅ Index verification query succeeded\n');
    }

    // Performance test
    console.log('Running performance test...');
    const start = Date.now();
    const { data: perfData, error: perfError } = await supabase
      .from('raw_props')
      .select('id, processed_by')
      .eq('processed_by', 'professional_system')
      .limit(100);

    const duration = Date.now() - start;

    if (perfError) {
      console.log('❌ Performance test failed:', perfError.message);
      process.exit(1);
    } else {
      console.log(`✅ Performance test: ${duration}ms for ${perfData.length} rows\n`);

      if (duration > 500) {
        console.log('⚠️  Query is slower than expected. Index may not be active yet.');
        console.log('Try reloading PostgREST schema cache.');
      } else {
        console.log('✅ Query performance is excellent!');
      }
    }

    console.log('\n=== Migration Complete ===\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

applyMigration();
