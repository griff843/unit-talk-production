#!/usr/bin/env node
/**
 * Trigger PostgREST Reload via RPC
 * Date: 2025-10-29
 * Purpose: Call pgrst_reload() RPC via Supabase client
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const log = {
  info: (msg) => console.log(`[\x1b[36mINFO\x1b[0m] ${msg}`),
  success: (msg) => console.log(`[\x1b[32mPASS\x1b[0m] ${msg}`),
  error: (msg) => console.log(`[\x1b[31mFAIL\x1b[0m] ${msg}`),
  warn: (msg) => console.log(`[\x1b[33mWARN\x1b[0m] ${msg}`)
};

async function main() {
  console.log('');
  console.log('='.repeat(80));
  console.log('TRIGGER POSTGREST RELOAD VIA RPC');
  console.log('Date: 2025-10-29');
  console.log('Charter: v3.0 | Spec: v3.0');
  console.log('='.repeat(80));
  console.log('');

  // Validate environment
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    log.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  log.info(`Supabase URL: ${supabaseUrl}`);
  log.info(`Service Role Key: ${serviceRoleKey.substring(0, 20)}***`);

  // Create Supabase client
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Call pgrst_reload RPC
    log.info('Calling pgrst_reload RPC...');
    const { data, error } = await supabase.rpc('pgrst_reload', {
      p_triggered_by: 'trigger-rpc-reload-script',
      p_reason: 'Manual PostgREST schema reload via RPC'
    });

    if (error) {
      log.error(`RPC call failed: ${error.message}`);
      console.error(error);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      log.error('RPC returned no data');
      process.exit(1);
    }

    const result = Array.isArray(data) ? data[0] : data;
    
    if (result.success) {
      log.success(`PostgREST reload triggered successfully`);
      log.info(`Reload ID: ${result.reload_id}`);
      log.info(`Reloaded at: ${result.reloaded_at}`);
    } else {
      log.error('RPC returned success=false');
      process.exit(1);
    }

    // Wait for reload to propagate
    log.info('Waiting 20 seconds for PostgREST to reload schema...');
    await new Promise(resolve => setTimeout(resolve, 20000));
    log.success('Wait complete');

    console.log('');
    console.log('='.repeat(80));
    log.success('POSTGREST RELOAD COMPLETE');
    console.log('='.repeat(80));
    console.log('');
    console.log('Next Steps:');
    console.log('  1. Verify visibility: node scripts/ops/verify-pgrst-visible.ts');
    console.log('  2. Check health: curl http://localhost:3010/api/health');
    console.log('  3. Run preflight: curl http://localhost:3010/api/domain/picks/preflight');
    console.log('');

    // Write artifact
    const fs = require('fs');
    const path = require('path');
    
    const artifact = {
      timestamp: new Date().toISOString(),
      status: 'SUCCESS',
      rpc_result: result,
      wait_seconds: 20
    };

    const artifactPath = path.join(__dirname, '../../out/ops/cutover/metrics/100/STEP_RPC_RELOAD.json');
    fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
    log.success(`Artifact written: ${artifactPath}`);

  } catch (err) {
    log.error(`Failed: ${err.message}`);
    console.error(err);
    process.exit(1);
  }
}

main();

