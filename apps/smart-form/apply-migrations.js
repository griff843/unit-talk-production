/**
 * Apply migrations to NEW Supabase project
 * This script applies core and smart form migrations in order
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment
require('dotenv').config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

console.log(`🔧 Connecting to Supabase: ${SUPABASE_URL}`);

// Create service role client
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Migration files in order
const MIGRATIONS = [
  {
    name: '20251101_core_picks',
    path: path.join(__dirname, '../../supabase/migrations/20251101_core_picks.sql')
  },
  {
    name: '20260115_smart_form_canonical_integration',
    path: path.join(__dirname, '../../supabase/migrations/20260115_smart_form_canonical_integration.sql')
  }
];

async function applyMigration(migration) {
  console.log(`\n📄 Applying migration: ${migration.name}`);

  if (!fs.existsSync(migration.path)) {
    throw new Error(`Migration file not found: ${migration.path}`);
  }

  const sql = fs.readFileSync(migration.path, 'utf8');

  // Execute migration via Supabase REST API (since we can't execute raw SQL directly via JS client)
  // We'll use the pg REST endpoint
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({ query: sql })
  });

  if (!response.ok) {
    // If RPC method doesn't exist, we need to use SQL editor approach
    console.log('⚠️  Note: Direct SQL execution via API not available.');
    console.log('📋 Manual Steps Required:');
    console.log(`   1. Go to ${SUPABASE_URL.replace('https://', 'https://app.supabase.com/project/')}/sql/new`);
    console.log(`   2. Copy and paste the SQL from: ${migration.path}`);
    console.log(`   3. Execute the migration`);
    console.log('');
    return { method: 'manual', migration: migration.name };
  }

  const result = await response.json();
  console.log(`✅ Migration applied successfully: ${migration.name}`);
  return { method: 'api', migration: migration.name, result };
}

async function verifyTables() {
  console.log('\n🔍 Verifying tables exist...');

  const tables = ['tenants', 'users', 'picks', 'smart_form_submissions'];

  for (const table of tables) {
    const { error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`❌ Table '${table}' not found or error: ${error.message}`);
    } else {
      console.log(`✅ Table '${table}' exists (${count} rows)`);
    }
  }
}

async function main() {
  console.log('🚀 Starting migration application process...\n');

  const results = [];

  for (const migration of MIGRATIONS) {
    try {
      const result = await applyMigration(migration);
      results.push(result);

      if (result.method === 'manual') {
        console.log('\n⏸️  Pausing automated migration. Please complete manual steps and run verification separately.');
        console.log('\nTo verify after manual migration, run:');
        console.log('  node apply-migrations.js verify');
        process.exit(0);
      }
    } catch (error) {
      console.error(`\n❌ Error applying migration ${migration.name}:`);
      console.error(error.message);
      console.error('\nStack:', error.stack);
      process.exit(1);
    }
  }

  // Verify tables
  await verifyTables();

  console.log('\n✅ All migrations completed successfully!');
  console.log('\nResults:');
  results.forEach(r => {
    console.log(`  - ${r.migration}: ${r.method}`);
  });
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args[0] === 'verify') {
  verifyTables().then(() => {
    console.log('\n✅ Verification complete');
    process.exit(0);
  }).catch(err => {
    console.error('❌ Verification failed:', err.message);
    process.exit(1);
  });
} else {
  main().catch(err => {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
  });
}
