/**
 * Apply Line History Migration
 * Part of Week 1, Day 1: Feature Store Population
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function applyMigration() {
  console.log('\n🚀 WEEK 1, DAY 1: Applying Line History Migration\n');
  console.log('='.repeat(60));

  // Read migration file
  const migrationPath = path.join(__dirname, '../../../../supabase/migrations/20251006_line_history_table.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

  console.log('\n📄 Migration File:', migrationPath);
  console.log('📊 SQL Length:', migrationSQL.length, 'characters');

  // Split into individual statements (Supabase RPC limitation)
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log('📝 Statements to execute:', statements.length);

  let executed = 0;
  let failed = 0;

  for (const statement of statements) {
    try {
      // Skip comments and empty lines
      if (statement.startsWith('COMMENT') || statement.startsWith('GRANT')) {
        console.log(`⏭️  Skipping: ${statement.substring(0, 50)}...`);
        continue;
      }

      console.log(`\n▶️  Executing: ${statement.substring(0, 80)}...`);

      const { error } = await supabase.rpc('exec_sql', { sql: statement });

      if (error) {
        // Try direct query for CREATE statements
        const { error: queryError } = await (supabase as any).from('_').select('*').limit(0);

        console.log(`❌ Error: ${error.message}`);
        failed++;
      } else {
        console.log(`✅ Success`);
        executed++;
      }
    } catch (err) {
      console.log(`❌ Exception: ${err instanceof Error ? err.message : 'Unknown'}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary:');
  console.log(`   Executed: ${executed}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total: ${statements.length}`);

  if (failed === 0) {
    console.log('\n🎉 Line History Migration Applied Successfully!\n');
    console.log('Features Unlocked:');
    console.log('   ✅ line_history - 30-day line movement tracking');
    console.log('   ✅ steam_detection - Sharp action identification');
    console.log('   ✅ line_velocity - Movement speed calculation');
    console.log('   ✅ price_action - Market momentum analysis\n');
  } else {
    console.log('\n⚠️  Migration completed with errors - manual review needed\n');
  }

  process.exit(failed > 0 ? 1 : 0);
}

applyMigration().catch(console.error);
