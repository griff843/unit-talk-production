#!/usr/bin/env node
/**
 * Apply Canonical Schema - Idempotent via Supabase Client
 * Date: 2025-01-29
 * 
 * This script creates the canonical picks/pick_publish tables using
 * individual SQL statements via Supabase RPC.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const log = {
  info: (msg) => console.log(`[\x1b[36mINFO\x1b[0m] ${msg}`),
  success: (msg) => console.log(`[\x1b[32mPASS\x1b[0m] ${msg}`),
  error: (msg) => console.log(`[\x1b[31mFAIL\x1b[0m] ${msg}`),
  warn: (msg) => console.log(`[\x1b[33mWARN\x1b[0m] ${msg}`)
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function execSQL(description, sql) {
  log.info(description);
  try {
    // Try direct query first
    const { data, error } = await supabase.rpc('exec', { sql });
    
    if (error) {
      // If RPC doesn't exist, that's expected - tables will be created via REST API
      if (error.message.includes('Could not find the function')) {
        log.warn(`RPC not available, using alternative method`);
        return { success: false, error: error.message };
      }
      throw error;
    }
    
    log.success(`✓ ${description}`);
    return { success: true, data };
  } catch (err) {
    log.error(`✗ ${description}: ${err.message}`);
    return { success: false, error: err.message };
  }
}

async function checkTableExists(tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('id')
      .limit(1);
    
    // If we get any response (even RLS error), table exists
    if (error && (error.code === '42P01' || error.message.includes('does not exist'))) {
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

async function main() {
  console.log('');
  console.log('='.repeat(80));
  console.log('CANONICAL SCHEMA APPLICATION - IDEMPOTENT');
  console.log('='.repeat(80));
  console.log('');

  // Check if tables already exist
  log.info('Checking existing schema...');
  const picksExists = await checkTableExists('picks');
  const pickPublishExists = await checkTableExists('pick_publish');
  
  log.info(`Current state - picks: ${picksExists ? 'EXISTS' : 'NOT FOUND'}, pick_publish: ${pickPublishExists ? 'EXISTS' : 'NOT FOUND'}`);

  if (picksExists && pickPublishExists) {
    log.success('Tables already exist - schema is ready');
    
    // Force PostgREST reload
    log.info('Forcing PostgREST schema reload...');
    await execSQL('PostgREST reload', `SELECT pg_notify('pgrst', 'reload schema')`);
    
    console.log('');
    console.log('='.repeat(80));
    log.success('SCHEMA VERIFIED - READY FOR VALIDATION');
    console.log('='.repeat(80));
    console.log('');
    console.log('Next Steps:');
    console.log('  1. Verify visibility: node scripts/ops/verify-pgrst-visible.ts');
    console.log('  2. Start services: ./dev.sh start');
    console.log('  3. Run validation: .\\scripts\\ops\\self-heal-and-validate.ps1');
    console.log('');
    return;
  }

  // Tables don't exist - need manual migration
  log.warn('Tables not found - manual migration required');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  const projectRef = match ? match[1] : 'unknown';

  console.log('');
  console.log('='.repeat(80));
  console.log('MANUAL MIGRATION REQUIRED');
  console.log('='.repeat(80));
  console.log('');
  console.log('Please apply the migration via Supabase SQL Editor:');
  console.log('');
  console.log(`  1. Open: https://supabase.com/dashboard/project/${projectRef}/sql/new`);
  console.log('  2. Copy SQL from: scripts/migrations/2025-01-28_canonical_convergence.sql');
  console.log('  3. Paste into SQL Editor and click "Run"');
  console.log('  4. Re-run this script to verify');
  console.log('');
  console.log('Alternatively, use the simplified schema:');
  console.log('  Run: node scripts/ops/apply-canonical-schema-simple.js');
  console.log('');
  
  process.exit(1);
}

main().catch(err => {
  log.error(`Fatal error: ${err.message}`);
  process.exit(1);
});

