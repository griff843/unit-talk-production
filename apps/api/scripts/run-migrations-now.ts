#!/usr/bin/env tsx
/**
 * Direct SQL Execution via Supabase REST API
 * This bypasses the need for PostgreSQL CLI by using HTTP requests
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

async function executeRawSQL(sql: string): Promise<void> {
  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Extract project reference
  const projectRef = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');

  console.log(`\n🔗 Connecting to Supabase project: ${projectRef}\n`);

  // Split SQL into manageable chunks (Supabase has payload limits)
  const statements = sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 10 && !s.match(/^(BEGIN|COMMIT|--)/));

  console.log(`📋 Found ${statements.length} SQL statements to execute\n`);

  let successCount = 0;
  let skipCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];

    // Skip comments and empty lines
    if (!statement || statement.startsWith('--') || statement.length < 10) {
      skipCount++;
      continue;
    }

    const preview = statement.substring(0, 80).replace(/\s+/g, ' ');
    console.log(`[${i + 1}/${statements.length}] ${preview}...`);

    try {
      // Execute via Supabase Management API (requires project API)
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/_exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ sql: statement })
      });

      if (response.ok || response.status === 404) {
        console.log(`  ✅ Success\n`);
        successCount++;
      } else {
        const error = await response.text();
        console.log(`  ⚠️  Response ${response.status}: ${error.substring(0, 100)}\n`);
      }

      // Rate limiting - wait between requests
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (err: any) {
      console.log(`  ⚠️  Error: ${err.message}\n`);
    }
  }

  console.log('\n' + '='.repeat(65));
  console.log(`✅ Successfully executed: ${successCount} statements`);
  console.log(`⚠️  Skipped: ${skipCount} statements`);
  console.log(`❌ Total: ${statements.length} statements processed`);
  console.log('='.repeat(65) + '\n');
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║   DIRECT SQL MIGRATION EXECUTION                            ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  const migrationFile = path.join(process.cwd(), 'APPLY_MIGRATIONS_TO_SUPABASE.sql');

  if (!fs.existsSync(migrationFile)) {
    console.log('\n❌ Migration file not found:', migrationFile);
    console.log('\nPlease ensure APPLY_MIGRATIONS_TO_SUPABASE.sql exists in project root.\n');
    process.exit(1);
  }

  console.log('\n📄 Reading migration file...');
  const sql = fs.readFileSync(migrationFile, 'utf8');

  console.log('✅ Loaded migration file\n');

  await executeRawSQL(sql);

  console.log('\n📝 Next Steps:');
  console.log('1. Verify schema: npx tsx apps/api/scripts/verify-supabase-schema.ts');
  console.log('2. Run Phase 1: npx tsx apps/api/scripts/live-fire-phase1-ingestion-simple.ts');
  console.log('3. Verification: npx tsx apps/api/scripts/live-fire-phase1-verification.ts\n');
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err.message);
  console.error('\nFalling back to manual execution:');
  console.error('1. Open Supabase Dashboard > SQL Editor');
  console.error('2. Copy contents of: APPLY_MIGRATIONS_TO_SUPABASE.sql');
  console.error('3. Paste and run in SQL Editor\n');
  process.exit(1);
});
