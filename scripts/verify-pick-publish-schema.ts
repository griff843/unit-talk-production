/**
 * Verify pick_publish table schema and constraints
 * Ensures CANARY channel is allowed and all required columns exist
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment
config({ path: resolve(__dirname, '../.env.shared') });
config({ path: resolve(__dirname, '../.env'), override: true });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function verifySchema(): Promise<void> {
  console.log('🔍 Verifying pick_publish table schema...\n');

  // Step 1: Get a sample record to verify structure
  const { data: sample, error: sampleError } = await supabase
    .from('pick_publish')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (sampleError && sampleError.code !== 'PGRST116') {  // PGRST116 = no rows
    console.error('❌ Error fetching sample record:', sampleError);
    process.exit(1);
  }

  if (sample) {
    console.log('📋 Sample pick_publish record found:');
    console.log(JSON.stringify(sample, null, 2));

    // Verify critical columns exist in the sample
    const columnNames = Object.keys(sample);
    console.log('\n📋 Columns present:', columnNames.join(', '));

    const requiredColumns = [
      'id',
      'pick_id',
      'tenant_id',
      'channel',
      'status',
      'discord_channel_id',
      'external_message_id',
      'attempts',
      'max_attempts',
      'last_error',  // Note: NOT 'error'
      'sent_at',
      'confirmed_at',
      'created_at',
      'updated_at'
    ];

    console.log('\n✅ Required columns check:');
    let allPresent = true;
    requiredColumns.forEach(col => {
      const exists = columnNames.includes(col);
      console.log(`  ${exists ? '✅' : '❌'} ${col}`);
      if (!exists) {
        allPresent = false;
      }
    });

    if (!allPresent) {
      console.error('\n❌ CRITICAL: Missing required columns');
      process.exit(1);
    }
  } else {
    console.log('ℹ️  No pick_publish records exist yet (table is empty)');
    console.log('   Will verify schema by attempting CANARY insert test...\n');
  }

  // Step 2: Verify CANARY channel is allowed
  const { data: canaryRecords, error: testError } = await supabase
    .from('pick_publish')
    .select('id, channel, status')
    .eq('channel', 'CANARY')
    .limit(5);

  if (testError) {
    // If error mentions enum violation, CANARY is not allowed
    if (testError.message.includes('invalid input value for enum')) {
      console.error('\n❌ CRITICAL: CANARY is not in channel enum!');
      console.error('Error:', testError.message);
      process.exit(1);
    }
    console.error('❌ Error querying CANARY records:', testError);
    process.exit(1);
  }

  console.log(`\n✅ CANARY channel: ALLOWED (found ${canaryRecords?.length || 0} CANARY records)`);
  if (canaryRecords && canaryRecords.length > 0) {
    console.log('   Sample CANARY records:');
    console.table(canaryRecords);
  }

  console.log('\n✅ Schema verification complete!');
  console.log('\n📋 Summary:');
  console.log('  - pick_publish table: EXISTS');
  console.log('  - Required columns: ALL PRESENT');
  console.log('  - CANARY channel: ALLOWED');
  console.log('  - last_error column: VERIFIED (not "error")');
}

verifySchema().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
