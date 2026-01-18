#!/usr/bin/env node
/**
 * Force PostgREST Reload via Supabase RPC
 * 
 * Uses Supabase client to execute pg_notify via RPC function.
 * This works with Supabase Cloud where direct PostgreSQL connections may be restricted.
 * 
 * Date: 2025-10-29
 * Author: Unit Talk Engineering
 * Version: 1.0.0
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const log = {
  info: (msg) => console.log(`[\x1b[36mINFO\x1b[0m] ${msg}`),
  success: (msg) => console.log(`[\x1b[32mSUCCESS\x1b[0m] ${msg}`),
  error: (msg) => console.log(`[\x1b[31mERROR\x1b[0m] ${msg}`),
  warn: (msg) => console.log(`[\x1b[33mWARN\x1b[0m] ${msg}`)
};

async function forceReloadViaRPC() {
  console.log('');
  console.log('='.repeat(80));
  console.log('POSTGREST SCHEMA RELOAD - SUPABASE RPC');
  console.log('='.repeat(80));
  console.log('');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    log.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  log.info('Environment Configuration:');
  console.log(`  SUPABASE_URL: ${supabaseUrl.substring(0, 30)}***`);
  console.log(`  SERVICE_KEY: ${serviceKey.substring(0, 20)}***`);
  console.log('');

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Method 1: Try using SQL via REST API (if available)
  log.info('Attempting Method 1: Direct SQL execution...');
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      query: "SELECT pg_notify('pgrst', 'reload schema')"
    });

    if (error) {
      if (error.message.includes('Could not find the function')) {
        log.warn('Method 1 failed: exec_sql function not available');
      } else {
        log.error(`Method 1 failed: ${error.message}`);
      }
    } else {
      log.success('Method 1 succeeded: PostgREST reload notification sent via RPC');
      console.log('');
      console.log('='.repeat(80));
      log.success('RELOAD COMPLETE');
      console.log('='.repeat(80));
      console.log('');
      console.log('Next Steps:');
      console.log('  1. Wait 10-20 seconds for PostgREST to process the reload');
      console.log('  2. Verify visibility: node scripts/ops/verify-pgrst-visible.ts');
      console.log('');
      process.exit(0);
    }
  } catch (err) {
    log.warn(`Method 1 exception: ${err.message}`);
  }

  // Method 2: Create a temporary function to execute pg_notify
  log.info('Attempting Method 2: Create temporary reload function...');
  try {
    // First, try to create the function
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION public.reload_postgrest_schema()
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        PERFORM pg_notify('pgrst', 'reload schema');
      END;
      $$;
    `;

    // We can't execute DDL via RPC, so we'll provide instructions
    log.warn('Method 2 requires manual SQL execution in Supabase Dashboard');
    console.log('');
    console.log('='.repeat(80));
    console.log('MANUAL INTERVENTION REQUIRED');
    console.log('='.repeat(80));
    console.log('');
    console.log('PostgREST reload requires SQL execution in Supabase Dashboard:');
    console.log('');
    console.log(`1. Open: https://supabase.com/dashboard/project/${supabaseUrl.match(/https:\/\/([^.]+)/)[1]}/sql/new`);
    console.log('2. Execute the following SQL:');
    console.log('');
    console.log('   SELECT pg_notify(\'pgrst\', \'reload schema\');');
    console.log('');
    console.log('3. Wait 10-20 seconds');
    console.log('4. Re-run: node scripts/ops/verify-pgrst-visible.ts');
    console.log('');
    console.log('='.repeat(80));
    console.log('');
    process.exit(1);
  } catch (err) {
    log.error(`Method 2 failed: ${err.message}`);
    process.exit(1);
  }
}

forceReloadViaRPC().catch(err => {
  log.error(`Fatal error: ${err.message}`);
  process.exit(1);
});

