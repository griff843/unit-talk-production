import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkCanaryRecord() {
  const PICK_ID = 'f20495c2-ddde-4d65-97c5-a1c874e5aab0';
  const EXPECTED_CANARY_CHANNEL = '1296531122234327100';
  const ALERTS_CHANNEL = '1289720383767056405';

  console.log('=== CHECKING CANARY PUBLISH RECORD ===\n');
  console.log(`Pick ID: ${PICK_ID}`);
  console.log(`Expected CANARY channel: ${EXPECTED_CANARY_CHANNEL}`);
  console.log(`Production ALERTS channel: ${ALERTS_CHANNEL}\n`);

  const { data: publishRecords, error } = await supabase
    .from('pick_publish')
    .select('*')
    .eq('pick_id', PICK_ID)
    .eq('channel', 'CANARY')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }

  if (!publishRecords || publishRecords.length === 0) {
    console.log('❌ NO CANARY RECORD FOUND');
    process.exit(1);
  }

  const record = publishRecords[0];

  console.log('PICK_PUBLISH RECORD:');
  console.log(`  ID: ${record.id}`);
  console.log(`  Channel (logical): ${record.channel}`);
  console.log(`  Discord Channel ID (physical): ${record.discord_channel_id || 'NULL'}`);
  console.log(`  Status: ${record.status}`);
  console.log(`  External Message ID: ${record.external_message_id || 'NULL'}`);
  console.log(`  Attempts: ${record.attempts}`);
  console.log(`  Created At: ${record.created_at}`);
  console.log(`  Sent At: ${record.sent_at || 'NULL'}`);

  console.log('\n=== ROUTING FIX VERIFICATION ===');

  if (!record.discord_channel_id) {
    console.log('❌ FAIL: discord_channel_id is NULL');
    console.log('   Expected: 1296531122234327100');
    console.log('   Actual: NULL');
    process.exit(1);
  }

  if (record.discord_channel_id === EXPECTED_CANARY_CHANNEL) {
    console.log('✅ PASS: discord_channel_id matches CANARY channel');
    console.log(`   Discord Channel ID: ${record.discord_channel_id}`);
  } else if (record.discord_channel_id === ALERTS_CHANNEL) {
    console.log('❌ FAIL: discord_channel_id is ALERTS channel (ROUTING BUG STILL EXISTS)');
    console.log(`   Expected: ${EXPECTED_CANARY_CHANNEL} (CANARY)`);
    console.log(`   Actual: ${record.discord_channel_id} (ALERTS)`);
  } else {
    console.log('❌ FAIL: discord_channel_id is UNKNOWN channel');
    console.log(`   Expected: ${EXPECTED_CANARY_CHANNEL}`);
    console.log(`   Actual: ${record.discord_channel_id}`);
  }

  console.log('\n=== NEXT STEP ===');
  if (record.discord_channel_id === EXPECTED_CANARY_CHANNEL && record.external_message_id) {
    console.log('Verify Discord message exists in vip-canary channel:');
    console.log(`Message ID: ${record.external_message_id}`);
    console.log(`Channel ID: ${record.discord_channel_id}`);
  } else {
    console.log('Cannot proceed to Discord verification - routing fix failed at database level');
  }
}

checkCanaryRecord();
