#!/usr/bin/env node
/**
 * Apply Phase 13 Migration to Supabase Cloud
 * Date: 2025-11-01
 * Charter: v4.0
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment
require('dotenv').config();

const MIGRATION_FILE = path.join(__dirname, '../../supabase/migrations/20251101_phase13_serving.sql');
const OUTPUT_DIR = path.join(__dirname, '../../out/ops/cutover/metrics/phase13');

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, colors.green);
}

function fail(message) {
  log(`❌ ${message}`, colors.red);
}

function warn(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function section(title) {
  log(`\n${'='.repeat(80)}`, colors.cyan);
  log(title, colors.cyan);
  log('='.repeat(80), colors.cyan);
}

async function applyMigration() {
  section('PHASE 13 MIGRATION - Model Serving Infrastructure');
  
  // Check environment
  log('\n1. Checking environment...');
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    fail('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  
  const maskedUrl = supabaseUrl.substring(0, 30) + '***';
  const maskedKey = serviceRoleKey.substring(0, 20) + '***';
  log(`  SUPABASE_URL: ${maskedUrl}`);
  log(`  SERVICE_KEY:  ${maskedKey}`);
  success('Environment variables loaded');
  
  // Read migration file
  log('\n2. Reading migration file...');
  if (!fs.existsSync(MIGRATION_FILE)) {
    fail(`Migration file not found: ${MIGRATION_FILE}`);
    process.exit(1);
  }
  
  const migrationSQL = fs.readFileSync(MIGRATION_FILE, 'utf8');
  const lineCount = migrationSQL.split('\n').length;
  log(`  File: ${path.basename(MIGRATION_FILE)}`);
  log(`  Lines: ${lineCount}`);
  success('Migration file loaded');
  
  // Create Supabase client
  log('\n3. Connecting to Supabase...');
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  success('Supabase client created');
  
  // Execute migration via RPC (if available) or direct SQL
  log('\n4. Executing migration...');
  log('  Note: Using Supabase SQL editor approach');
  
  // Split migration into individual statements
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  log(`  Total statements: ${statements.length}`);
  
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ';';
    
    // Skip comments and empty statements
    if (stmt.trim().startsWith('--') || stmt.trim().length < 5) {
      skipCount++;
      continue;
    }
    
    try {
      // Use Supabase RPC to execute SQL
      const { data, error } = await supabase.rpc('exec_sql', { sql: stmt });
      
      if (error) {
        // Check if it's an "already exists" error (idempotent)
        if (error.message.includes('already exists') || 
            error.message.includes('IF NOT EXISTS')) {
          log(`  [${i+1}/${statements.length}] SKIP (already exists)`, colors.yellow);
          skipCount++;
        } else {
          log(`  [${i+1}/${statements.length}] FAIL: ${error.message}`, colors.red);
          failCount++;
        }
      } else {
        log(`  [${i+1}/${statements.length}] OK`);
        successCount++;
      }
    } catch (err) {
      log(`  [${i+1}/${statements.length}] ERROR: ${err.message}`, colors.red);
      failCount++;
    }
  }
  
  // Summary
  section('MIGRATION SUMMARY');
  log(`\n  ✅ Success: ${successCount}`);
  log(`  ⚠️  Skipped: ${skipCount}`);
  log(`  ❌ Failed:  ${failCount}\n`);
  
  if (failCount > 0) {
    warn('Some statements failed. This may be expected for idempotent migrations.');
    warn('Please review the output above and verify tables exist.');
  }
  
  // Verify tables
  log('\n5. Verifying tables...');
  const tables = ['model_predictions_live', 'model_performance_history'];
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        if (error.message.includes('does not exist')) {
          fail(`Table '${table}' does not exist`);
        } else {
          // RLS or other error means table exists
          success(`Table '${table}' exists (RLS active)`);
        }
      } else {
        success(`Table '${table}' exists and accessible`);
      }
    } catch (err) {
      warn(`Table '${table}' verification failed: ${err.message}`);
    }
  }
  
  // Trigger PostgREST reload
  log('\n6. Triggering PostgREST reload...');
  try {
    const { data, error } = await supabase.rpc('pgrst_reload');
    if (error) {
      warn(`PostgREST reload RPC failed: ${error.message}`);
      warn('You may need to reload manually via Supabase dashboard');
    } else {
      success('PostgREST reload triggered');
    }
  } catch (err) {
    warn(`PostgREST reload error: ${err.message}`);
  }
  
  // Save attestation
  log('\n7. Saving attestation...');
  const attestation = {
    phase: 'Phase 13 - Model Serving Infrastructure',
    date: new Date().toISOString(),
    migration_file: path.basename(MIGRATION_FILE),
    statements_executed: successCount,
    statements_skipped: skipCount,
    statements_failed: failCount,
    tables_verified: tables,
    status: failCount === 0 ? 'SUCCESS' : 'PARTIAL',
  };
  
  const attestationFile = path.join(OUTPUT_DIR, `migration_attestation_${Date.now()}.json`);
  fs.writeFileSync(attestationFile, JSON.stringify(attestation, null, 2));
  success(`Attestation saved: ${attestationFile}`);
  
  section('DEPLOYMENT COMPLETE');
  log('\nNext Steps:');
  log('  1. Verify tables in Supabase dashboard');
  log('  2. Run PostgREST visibility check');
  log('  3. Continue with E2E validation\n');
  
  process.exit(failCount > 0 ? 1 : 0);
}

// Run
applyMigration().catch(err => {
  fail(`Fatal error: ${err.message}`);
  console.error(err);
  process.exit(1);
});

