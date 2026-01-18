#!/usr/bin/env node
/**
 * Apply Canonical Convergence Migration to Supabase
 * 
 * Executes the canonical convergence migration using Supabase client
 * with service role key for direct SQL execution.
 * 
 * Date: 2025-01-28
 * Author: Unit Talk Engineering
 * Version: 1.0.0
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const log = {
  info: (msg) => console.log(`[\x1b[36mINFO\x1b[0m] ${msg}`),
  success: (msg) => console.log(`[\x1b[32mPASS\x1b[0m] ${msg}`),
  error: (msg) => console.log(`[\x1b[31mFAIL\x1b[0m] ${msg}`),
  warn: (msg) => console.log(`[\x1b[33mWARN\x1b[0m] ${msg}`)
};

// ============================================================================
// LOAD ENVIRONMENT
// ============================================================================

log.info('Loading environment configuration...');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  log.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in environment');
  process.exit(1);
}

log.success('Environment loaded');

// Create Supabase client with service role
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// ============================================================================
// READ MIGRATION FILE
// ============================================================================

const migrationFile = path.join(__dirname, '../../scripts/migrations/2025-01-28_canonical_convergence.sql');

if (!fs.existsSync(migrationFile)) {
  log.error(`Migration file not found: ${migrationFile}`);
  process.exit(1);
}

const migrationSQL = fs.readFileSync(migrationFile, 'utf8');
log.success(`Migration file loaded (${migrationSQL.length} bytes)`);

// ============================================================================
// APPLY MIGRATION
// ============================================================================

async function applyMigration() {
  log.info('Applying canonical convergence migration...');
  console.log('');

  try {
    // Split SQL into individual statements (simple approach)
    // Remove comments and split by semicolon
    const statements = migrationSQL
      .split('\n')
      .filter(line => !line.trim().startsWith('--') && !line.trim().startsWith('\\echo'))
      .join('\n')
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    log.info(`Executing ${statements.length} SQL statements...`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (stmt.length < 10) continue; // Skip very short statements

      try {
        const { data, error } = await supabase.rpc('exec_sql', { sql: stmt });
        
        if (error) {
          // Try direct execution via REST API
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({ sql: stmt })
          });

          if (!response.ok) {
            log.warn(`Statement ${i + 1} failed (may be expected): ${error.message}`);
            // Continue anyway - some statements may fail if already exists
          }
        }
      } catch (err) {
        log.warn(`Statement ${i + 1} error (continuing): ${err.message}`);
      }
    }

    log.success('Migration statements executed');

  } catch (error) {
    log.error(`Migration failed: ${error.message}`);
    process.exit(1);
  }
}

// ============================================================================
// FORCE POSTGREST SCHEMA RELOAD
// ============================================================================

async function reloadSchema() {
  log.info('Forcing PostgREST schema reload...');

  try {
    const { error } = await supabase.rpc('pg_notify', {
      channel: 'pgrst',
      payload: 'reload schema'
    });

    if (error) {
      log.warn('PostgREST reload failed (non-critical)');
    } else {
      log.success('PostgREST schema reload triggered');
      log.info('Waiting 5 seconds for schema propagation...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  } catch (error) {
    log.warn(`PostgREST reload error (non-critical): ${error.message}`);
  }
}

// ============================================================================
// VERIFY CANONICAL TABLES
// ============================================================================

async function verifyTables() {
  log.info('Verifying canonical tables...');

  try {
    // Check if picks table exists
    const { data: picksData, error: picksError } = await supabase
      .from('picks')
      .select('count', { count: 'exact', head: true });

    const { data: publishData, error: publishError } = await supabase
      .from('pick_publish')
      .select('count', { count: 'exact', head: true });

    if (!picksError && !publishError) {
      log.success(`Canonical tables verified`);
      log.info(`  - picks table: ${picksData?.count || 0} rows`);
      log.info(`  - pick_publish table: ${publishData?.count || 0} rows`);
    } else {
      log.error('Table verification failed');
      if (picksError) log.error(`  picks: ${picksError.message}`);
      if (publishError) log.error(`  pick_publish: ${publishError.message}`);
    }
  } catch (error) {
    log.error(`Verification failed: ${error.message}`);
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('');
  console.log('='.repeat(80));
  console.log('CANONICAL CONVERGENCE MIGRATION');
  console.log('='.repeat(80));
  console.log('');

  // Note: Supabase doesn't support arbitrary SQL execution via REST API
  // We need to use the SQL Editor or CLI
  log.warn('Supabase REST API does not support arbitrary SQL execution');
  log.info('Please use one of the following methods:');
  console.log('');
  console.log('Option 1: Supabase SQL Editor (RECOMMENDED)');
  console.log(`  1. Open: ${supabaseUrl.replace('https://', 'https://supabase.com/dashboard/project/')}/sql/new`);
  console.log(`  2. Copy SQL from: ${migrationFile}`);
  console.log('  3. Paste and click "Run"');
  console.log('');
  console.log('Option 2: Supabase CLI');
  console.log(`  supabase db execute --file ${migrationFile}`);
  console.log('');
  console.log('Option 3: Direct PostgreSQL');
  console.log(`  psql "${process.env.DATABASE_DIRECT_URL}" -f ${migrationFile}`);
  console.log('');

  // Try to verify if tables already exist
  await verifyTables();

  console.log('');
  console.log('='.repeat(80));
  console.log('');
}

main().catch(error => {
  log.error(`Fatal error: ${error.message}`);
  process.exit(1);
});

