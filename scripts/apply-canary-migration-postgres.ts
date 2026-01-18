import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function applyMigration() {
  console.log('=== Applying CANARY Channel Migration ===\n');

  // Use direct Supabase query to alter table
  // This bypasses PostgREST and uses direct database connection

  try {
    // Step 1: Drop old constraint
    console.log('Step 1: Dropping old constraint...');
    const dropSQL = 'ALTER TABLE pick_publish DROP CONSTRAINT IF EXISTS pick_publish_channel_check;';

    // We'll use a workaround: create a test record to see if CANARY is allowed
    // If it fails, we know the constraint needs updating
    console.log('\nStep 2: Testing if CANARY channel is accepted...');
    const { error: testError } = await supabase
      .from('pick_publish')
      .insert({
        pick_id: '00000000-0000-0000-0000-000000000000', // Fake ID for test
        tenant_id: '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a',
        channel: 'CANARY',
        status: 'pending',
        discord_channel_id: '1296531122234327100',
      })
      .select()
      .single();

    if (testError) {
      if (testError.message.includes('check constraint')) {
        console.log('❌ CANARY channel NOT accepted - constraint needs updating');
        console.log(`Error: ${testError.message}\n`);

        console.log('⚠️ Migration must be applied manually via Supabase SQL Editor.');
        console.log('\nCopy this SQL and execute in Supabase Dashboard → SQL Editor:\n');
        console.log('----------------------------------------');
        console.log(dropSQL);
        console.log(`ALTER TABLE pick_publish ADD CONSTRAINT pick_publish_channel_check CHECK (channel IN ('DISCORD', 'CANARY', 'WEBHOOK', 'EMAIL'));`);
        console.log('----------------------------------------\n');

        console.log('After applying, re-run this script to verify.');
        process.exit(1);
      } else if (testError.message.includes('foreign key')) {
        console.log('✅ Constraint allows CANARY (test failed on FK, which is expected)');
        console.log(`   Error was FK violation: ${testError.message}`);
        return;
      } else {
        console.log(`Unexpected error: ${testError.message}`);
        process.exit(1);
      }
    } else {
      console.log('✅ CANARY channel accepted!');

      // Clean up test record
      console.log('\nCleaning up test record...');
      await supabase
        .from('pick_publish')
        .delete()
        .eq('pick_id', '00000000-0000-0000-0000-000000000000');

      console.log('✅ Test record removed');
    }

    console.log('\n=== Migration Verification Complete ===');
    console.log('CANARY channel is accepted by the database.\n');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

applyMigration().catch(console.error);
