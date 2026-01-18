#!/usr/bin/env node
/**
 * Verify PostgREST Schema Visibility
 * 
 * Checks that critical tables (picks, pick_publish) are visible via Supabase REST API.
 * Returns exit code 0 if visible, 1 if not.
 * 
 * Date: 2025-01-28
 * Author: Unit Talk Engineering
 * Version: 1.0.0
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CRITICAL_TABLES = ['picks', 'pick_publish'];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const log = {
  info: (msg: string) => console.log(`[\x1b[36mINFO\x1b[0m] ${msg}`),
  success: (msg: string) => console.log(`[\x1b[32mPASS\x1b[0m] ${msg}`),
  error: (msg: string) => console.log(`[\x1b[31mFAIL\x1b[0m] ${msg}`),
  warn: (msg: string) => console.log(`[\x1b[33mWARN\x1b[0m] ${msg}`)
};

// ============================================================================
// VERIFICATION
// ============================================================================

async function verifyTableVisibility(tableName: string): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    log.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured');
    return false;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (error) {
      if (error.message.includes('does not exist') || 
          error.message.includes('schema cache') ||
          error.message.includes('relation') ||
          error.code === 'PGRST204') {
        log.error(`Table '${tableName}' NOT visible: ${error.message}`);
        return false;
      }
      // Other errors (e.g., RLS) mean table IS visible
      log.success(`Table '${tableName}' visible (error: ${error.code})`);
      return true;
    }

    log.success(`Table '${tableName}' visible (${data?.length || 0} rows)`);
    return true;
  } catch (err: any) {
    log.error(`Table '${tableName}' verification failed: ${err.message}`);
    return false;
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('');
  console.log('='.repeat(80));
  console.log('POSTGREST SCHEMA VISIBILITY CHECK');
  console.log('='.repeat(80));
  console.log('');

  const results: Record<string, boolean> = {};
  let allVisible = true;

  for (const table of CRITICAL_TABLES) {
    log.info(`Checking table: ${table}...`);
    const visible = await verifyTableVisibility(table);
    results[table] = visible;
    if (!visible) allVisible = false;
    console.log('');
  }

  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log('');

  for (const [table, visible] of Object.entries(results)) {
    const status = visible ? '✅ VISIBLE' : '❌ NOT VISIBLE';
    console.log(`  ${table.padEnd(20)} ${status}`);
  }

  console.log('');
  console.log('='.repeat(80));

  if (allVisible) {
    log.success('ALL TABLES VISIBLE');
    console.log('');
    console.log('Next Steps:');
    console.log('  1. Start services: ./dev.sh start');
    console.log('  2. Run E2E validation: .\\scripts\\ops\\industry-standard-e2e-validation.ps1');
    console.log('');
    process.exit(0);
  } else {
    log.error('SOME TABLES NOT VISIBLE');
    console.log('');
    console.log('Remediation:');
    console.log('  1. Force reload: node scripts/ops/force-postgrest-reload.js');
    console.log('  2. Wait 10 seconds');
    console.log('  3. Re-run this script');
    console.log('');
    process.exit(1);
  }
}

main().catch(error => {
  log.error(`Fatal error: ${error.message}`);
  process.exit(1);
});

