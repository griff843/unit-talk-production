import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyCanaryMigration() {
  console.log('=== Applying CANARY Channel Migration ===\n');

  // Read migration file
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20251203_add_canary_channel_support.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

  console.log('Migration SQL:');
  console.log(migrationSQL);
  console.log('');

  // Extract and execute SQL statements
  const statements = [
    `ALTER TABLE pick_publish DROP CONSTRAINT IF EXISTS pick_publish_channel_check;`,
    `ALTER TABLE pick_publish ADD CONSTRAINT pick_publish_channel_check CHECK (channel IN ('DISCORD', 'CANARY', 'WEBHOOK', 'EMAIL'));`,
    `COMMENT ON COLUMN pick_publish.channel IS 'Publishing channel: DISCORD (production), CANARY (testing), WEBHOOK (HTTP), EMAIL';`
  ];

  for (const sql of statements) {
    console.log(`Executing: ${sql.substring(0, 80)}...`);
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error(`ERROR: ${error.message}`);
      // Try direct approach - use raw SQL connection
      console.log('Trying alternative approach...');

      // Since RPC might not work, we'll just report the migration needs manual application
      console.error('\n⚠️ Migration could not be applied via RPC.');
      console.error('This migration must be applied manually via Supabase SQL Editor or psql.');
      console.error('\nSQL to execute:');
      console.error(migrationSQL);
      process.exit(1);
    }

    console.log('✅ Success');
  }

  console.log('\n=== Migration Applied Successfully ===');
}

applyCanaryMigration().catch(console.error);
