#!/usr/bin/env node
/**
 * Apply PostgREST Reload RPC Migration via Supabase Client
 * Date: 2025-10-29
 * Purpose: Apply 20251029_pgrst_reload_rpc.sql using Supabase REST API
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const log = {
  info: (msg) => console.log(`[\x1b[36mINFO\x1b[0m] ${msg}`),
  success: (msg) => console.log(`[\x1b[32mPASS\x1b[0m] ${msg}`),
  error: (msg) => console.log(`[\x1b[31mFAIL\x1b[0m] ${msg}`),
  warn: (msg) => console.log(`[\x1b[33mWARN\x1b[0m] ${msg}`)
};

async function main() {
  console.log('');
  console.log('='.repeat(80));
  console.log('APPLY POSTGREST RELOAD RPC MIGRATION');
  console.log('Date: 2025-10-29');
  console.log('Charter: v3.0 | Spec: v3.0');
  console.log('='.repeat(80));
  console.log('');

  // Load migration SQL
  const migrationPath = path.join(__dirname, '../../supabase/migrations/20251029_pgrst_reload_rpc.sql');
  
  if (!fs.existsSync(migrationPath)) {
    log.error(`Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  log.info(`Migration file loaded (${migrationSQL.length} bytes)`);

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
    // Execute migration SQL using Supabase's query endpoint
    log.info('Executing migration SQL...');
    
    // Note: Supabase client doesn't have a direct SQL execution method
    // We need to use the REST API directly
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({ query: migrationSQL })
    });

    if (!response.ok) {
      // If exec_sql doesn't exist, we need to use a different approach
      log.warn('Direct SQL execution not available via REST API');
      log.info('Attempting to apply migration using Supabase Management API...');
      
      // Alternative: Use Supabase CLI or Management API
      log.error('Migration requires direct database access or Supabase CLI');
      log.info('');
      log.info('Manual Steps Required:');
      log.info('  1. Open Supabase Dashboard: https://supabase.com/dashboard/project/cqfnsozknjzvyiziwicl/sql');
      log.info('  2. Copy contents of: supabase/migrations/20251029_pgrst_reload_rpc.sql');
      log.info('  3. Paste into SQL Editor and execute');
      log.info('  4. Verify with: node scripts/ops/check-rpc-exists.js');
      log.info('');
      log.warn('OR use Supabase CLI: supabase db push');
      
      // Write manual action card
      const manualCard = `# MANUAL ACTION REQUIRED

## Objective
Apply PostgREST Reload RPC Migration (20251029_pgrst_reload_rpc.sql)

## Why Manual?
Direct SQL execution via REST API is not available. Migration requires:
- Direct PostgreSQL connection (psql not available in Windows environment)
- OR Supabase Dashboard SQL Editor
- OR Supabase CLI

## Steps

### Option 1: Supabase Dashboard (RECOMMENDED)
1. Open: https://supabase.com/dashboard/project/cqfnsozknjzvyiziwicl/sql
2. Copy entire contents of: \`supabase/migrations/20251029_pgrst_reload_rpc.sql\`
3. Paste into SQL Editor
4. Click "Run" button
5. Verify success (should see "Success. No rows returned")
6. Verify RPC exists: \`node scripts/ops/check-rpc-exists.js\`

### Option 2: Supabase CLI
\`\`\`bash
supabase db push
\`\`\`

### Option 3: Direct PostgreSQL (if psql available)
\`\`\`bash
psql "$DATABASE_DIRECT_URL" -f supabase/migrations/20251029_pgrst_reload_rpc.sql
\`\`\`

## Verification
After applying migration, run:
\`\`\`bash
node scripts/ops/check-rpc-exists.js
\`\`\`

Expected output: "pgrst_reload RPC EXISTS and is callable"

## Next Steps
Once verified:
1. Trigger reload: \`node scripts/ops/trigger-rpc-reload.js\`
2. Verify visibility: \`node scripts/ops/verify-pgrst-visible.ts\`
3. Continue with E2E validation

---
Date: ${new Date().toISOString()}
Charter: v3.0 | Spec: v3.0
`;

      const cardPath = path.join(__dirname, '../../out/ops/cutover/metrics/100/QUICK_ACTION_CARD.md');
      fs.writeFileSync(cardPath, manualCard);
      log.success(`Manual action card written: ${cardPath}`);
      
      process.exit(3); // Exit code 3 = manual action required
    }

    const result = await response.json();
    log.success('Migration executed successfully');
    console.log('Result:', JSON.stringify(result, null, 2));

    // Verify RPC exists
    log.info('Verifying RPC function...');
    const { data, error } = await supabase.rpc('pgrst_reload', {
      p_triggered_by: 'apply-rpc-migration-supabase',
      p_reason: 'post-migration verification'
    });

    if (error) {
      log.error(`RPC verification failed: ${error.message}`);
      process.exit(1);
    }

    log.success('RPC function verified and callable');
    console.log('RPC result:', JSON.stringify(data, null, 2));

    // Clean up test entry
    await supabase
      .from('schema_reload_log')
      .delete()
      .eq('triggered_by', 'apply-rpc-migration-supabase');

    console.log('');
    console.log('='.repeat(80));
    log.success('MIGRATION COMPLETE');
    console.log('='.repeat(80));
    console.log('');

  } catch (err) {
    log.error(`Failed: ${err.message}`);
    console.error(err);
    process.exit(1);
  }
}

main();

