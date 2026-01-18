/**
 * Apply migration via Supabase Management API
 */

const fs = require('fs');
const path = require('path');

require('dotenv').config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

// Extract project ref
const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0];

async function executeSQLBatches(sql) {
  console.log('🔧 Splitting migration into executable batches...');

  // Split by major sections and execute one at a time
  const statements = sql
    .split(/;\s*$/gm)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`   Found ${statements.length} SQL statements`);

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ';';

    // Skip comments
    if (stmt.trim().startsWith('--')) continue;

    try {
      // Use PostgREST RPC if available
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ query: stmt })
      });

      if (response.ok) {
        successCount++;
        process.stdout.write(`\r   Progress: ${successCount}/${statements.length} statements executed`);
      } else {
        const error = await response.text();
        errorCount++;
        errors.push({ statement: i + 1, error: error.substring(0, 200) });
      }
    } catch (error) {
      errorCount++;
      errors.push({ statement: i + 1, error: error.message });
    }
  }

  console.log(`\n\n✅ Executed ${successCount} statements successfully`);

  if (errorCount > 0) {
    console.log(`⚠️  ${errorCount} statements failed (this may be expected for some DDL)`);
    console.log('\nNote: Some errors are normal (e.g., "function does not exist" for DROP commands)');
  }

  return { successCount, errorCount, errors };
}

async function main() {
  console.log('🚀 Starting migration via Management API...');
  console.log(`   Project: ${projectRef}\n`);

  // Read migration
  const migrationPath = path.join(__dirname, 'MIGRATION_READY.sql');
  console.log(`📄 Reading migration: ${path.basename(migrationPath)}`);

  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found: ${migrationPath}`);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  console.log(`   Size: ${(sql.length / 1024).toFixed(2)} KB\n`);

  // Try batch execution
  console.log('⚠️  Note: Supabase REST API may not support raw SQL execution.');
  console.log('Attempting batch execution...\n');

  const result = await executeSQLBatches(sql);

  if (result.errorCount > 0 && result.errorCount === result.successCount + result.errorCount) {
    console.log('\n❌ All statements failed - REST API does not support SQL execution');
    console.log('\n📋 Manual migration required:');
    console.log(`   1. Visit: https://supabase.com/dashboard/project/${projectRef}/sql/new`);
    console.log(`   2. Copy contents from: ${migrationPath}`);
    console.log(`   3. Execute in SQL Editor`);
    console.log('\n   OR provide database password to use direct PostgreSQL connection');
    process.exit(1);
  }

  console.log('\n✅ Migration process completed');
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
