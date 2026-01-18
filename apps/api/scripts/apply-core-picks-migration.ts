import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function applyMigration() {
  console.log('=== APPLYING CORE PICKS MIGRATION ===\n');

  const migrationPath = path.resolve(process.cwd(), '../../supabase/migrations/20251101_core_picks.sql');

  console.log(`Reading migration from: ${migrationPath}`);
  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

  console.log(`Migration size: ${migrationSQL.length} characters\n`);
  console.log('Executing migration...\n');

  try {
    // Execute the migration SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_string: migrationSQL
    });

    if (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }

    console.log('✅ Migration applied successfully!');
    console.log('\n=== RELOADING POSTGREST SCHEMA ===\n');

    // Reload PostgREST schema
    const { data: reloadData, error: reloadError } = await supabase.rpc('pgrst_reload');

    if (reloadError) {
      console.error('⚠️  Schema reload failed (but migration succeeded):', reloadError);
    } else {
      console.log('✅ PostgREST schema reloaded successfully!');
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

applyMigration();
