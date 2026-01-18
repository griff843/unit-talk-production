#!/usr/bin/env node
/**
 * Restart PostgREST via Supabase Management API
 * Date: 2025-01-29
 * 
 * This script uses the Supabase Management API to restart PostgREST,
 * which forces a schema cache reload.
 */

require('dotenv').config();
const https = require('https');

const log = {
  info: (msg) => console.log(`[\x1b[36mINFO\x1b[0m] ${msg}`),
  success: (msg) => console.log(`[\x1b[32mPASS\x1b[0m] ${msg}`),
  error: (msg) => console.log(`[\x1b[31mFAIL\x1b[0m] ${msg}`),
  warn: (msg) => console.log(`[\x1b[33mWARN\x1b[0m] ${msg}`)
};

async function main() {
  console.log('');
  console.log('='.repeat(80));
  console.log('POSTGREST RESTART VIA MANAGEMENT API');
  console.log('Date: 2025-01-29');
  console.log('='.repeat(80));
  console.log('');

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  const projectRef = match ? match[1] : null;

  if (!projectRef) {
    log.error('Could not extract project reference from SUPABASE_URL');
    console.log('');
    console.log('Manual Restart Required:');
    console.log(`  1. Open: https://supabase.com/dashboard/project/${projectRef || 'YOUR_PROJECT'}/settings/api`);
    console.log('  2. Scroll to "PostgREST" section');
    console.log('  3. Click "Restart PostgREST" button');
    console.log('  4. Wait 20 seconds');
    console.log('  5. Run: npx tsx scripts/ops/verify-pgrst-visible.ts');
    console.log('');
    process.exit(1);
  }

  log.info(`Project Reference: ${projectRef}`);
  console.log('');

  log.warn('Supabase Management API requires a personal access token');
  log.info('The restart must be done manually via the Supabase Dashboard');
  console.log('');
  console.log('='.repeat(80));
  console.log('MANUAL RESTART INSTRUCTIONS');
  console.log('='.repeat(80));
  console.log('');
  console.log(`  1. Open: https://supabase.com/dashboard/project/${projectRef}/settings/api`);
  console.log('  2. Scroll to "PostgREST" section');
  console.log('  3. Click "Restart PostgREST" button');
  console.log('  4. Wait 20 seconds for restart to complete');
  console.log('  5. Verify visibility: npx tsx scripts/ops/verify-pgrst-visible.ts');
  console.log('');
  console.log('='.repeat(80));
  console.log('');

  log.info('Opening Supabase Dashboard in browser...');
  
  // Open browser to the API settings page
  const { exec } = require('child_process');
  const url = `https://supabase.com/dashboard/project/${projectRef}/settings/api`;
  
  exec(`start ${url}`, (error) => {
    if (error) {
      log.warn('Could not open browser automatically');
      console.log(`  Manual URL: ${url}`);
    } else {
      log.success('Browser opened to API settings page');
    }
  });

  console.log('');
  log.info('After restarting PostgREST, run:');
  console.log('  npx tsx scripts/ops/verify-pgrst-visible.ts');
  console.log('');
}

main().catch(err => {
  log.error(`Fatal error: ${err.message}`);
  process.exit(1);
});

