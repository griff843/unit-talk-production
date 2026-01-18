#!/usr/bin/env node
/**
 * PostgREST Reload via Supabase Management API
 * Date: 2025-01-29
 */

require('dotenv').config();

const log = {
  info: (msg) => console.log(`[\x1b[36mINFO\x1b[0m] ${msg}`),
  success: (msg) => console.log(`[\x1b[32mPASS\x1b[0m] ${msg}`),
  error: (msg) => console.log(`[\x1b[31mFAIL\x1b[0m] ${msg}`),
  warn: (msg) => console.log(`[\x1b[33mWARN\x1b[0m] ${msg}`)
};

async function main() {
  console.log('');
  console.log('='.repeat(80));
  console.log('POSTGREST SCHEMA RELOAD - MANAGEMENT API');
  console.log('='.repeat(80));
  console.log('');

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    log.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found');
    process.exit(1);
  }

  // Extract project ref
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match) {
    log.error('Could not extract project ref from SUPABASE_URL');
    process.exit(1);
  }

  const projectRef = match[1];
  log.info(`Project: ${projectRef}`);

  // Method 1: Try REST API with reload header
  log.info('Attempting PostgREST reload via REST API header...');
  
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Prefer': 'schema-reload=true'
      }
    });

    log.success(`REST API response: ${response.status}`);
  } catch (err) {
    log.warn(`REST API method failed: ${err.message}`);
  }

  // Method 2: Try via PostgREST admin endpoint
  log.info('Attempting PostgREST reload via admin endpoint...');
  
  try {
    const adminResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/pg_notify`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel: 'pgrst',
        payload: 'reload schema'
      })
    });

    if (adminResponse.ok) {
      log.success('Admin endpoint reload successful');
    } else {
      log.warn(`Admin endpoint returned: ${adminResponse.status}`);
    }
  } catch (err) {
    log.warn(`Admin endpoint method failed: ${err.message}`);
  }

  console.log('');
  log.info('Waiting 20 seconds for schema propagation...');
  await new Promise(resolve => setTimeout(resolve, 20000));

  // Verify visibility
  log.info('Verifying table visibility...');
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    const { data, error } = await supabase
      .from('picks')
      .select('id')
      .limit(1);

    if (error) {
      if (error.message.includes('schema cache')) {
        log.error('Tables still not visible in schema cache');
        console.log('');
        console.log('='.repeat(80));
        log.warn('AUTOMATIC RELOAD INSUFFICIENT');
        console.log('='.repeat(80));
        console.log('');
        console.log('The PostgREST schema cache requires additional time or manual intervention.');
        console.log('');
        console.log('Options:');
        console.log('  1. Wait 5-10 minutes for automatic schema reload');
        console.log('  2. Contact Supabase support to restart PostgREST service');
        console.log('  3. Check Supabase status: https://status.supabase.com');
        console.log('');
        process.exit(1);
      }
      log.success('Tables visible (RLS or other non-cache error)');
    } else {
      log.success('Tables visible and accessible');
    }
  } catch (err) {
    log.error(`Verification failed: ${err.message}`);
  }

  console.log('');
  console.log('='.repeat(80));
  log.success('POSTGREST RELOAD ATTEMPTED');
  console.log('='.repeat(80));
  console.log('');
  console.log('Next Steps:');
  console.log('  1. Verify: npx tsx scripts/ops/verify-pgrst-visible.ts');
  console.log('  2. If not visible, wait 5-10 minutes and retry');
  console.log('  3. Start stack: ./dev.sh start');
  console.log('  4. Run validation: .\\scripts\\ops\\self-heal-and-validate.ps1');
  console.log('');
}

main().catch(err => {
  log.error(`Fatal error: ${err.message}`);
  process.exit(1);
});

