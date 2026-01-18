/**
 * Verify Pick Publish Status in Supabase Cloud
 *
 * Queries SUPABASE CLOUD to check pick_publish record status.
 * NO SECRETS PRINTED.
 *
 * Usage: npx tsx scripts/verify-pick-publish-supabase.ts <publish_id>
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

async function main() {
  const publishId = process.argv[2];

  if (!publishId) {
    console.error('❌ Usage: npx tsx scripts/verify-pick-publish-supabase.ts <publish_id>');
    process.exit(1);
  }

  console.log('🔍 Verifying pick_publish in SUPABASE CLOUD (NO SECRETS PRINTED)\n');
  console.log(`   Publish ID: ${publishId}`);
  console.log(`   Supabase URL: ${SUPABASE_URL?.substring(0, 30)}...`);
  console.log();

  const { data, error } = await supabase
    .from('pick_publish')
    .select('*')
    .eq('id', publishId)
    .single();

  if (error) {
    console.error('❌ Error fetching pick_publish:', error.message);
    process.exit(1);
  }

  if (!data) {
    console.error('❌ No pick_publish record found with that ID');
    process.exit(1);
  }

  console.log('📊 Pick Publish Record:');
  console.log(`   ID: ${data.id}`);
  console.log(`   Pick ID: ${data.pick_id}`);
  console.log(`   Status: ${data.status}`);
  console.log(`   Channel: ${data.channel}`);
  console.log(`   Discord Channel ID: ${data.discord_channel_id || 'null'}`);
  console.log(`   External Message ID: ${data.external_message_id || 'null'}`);
  console.log(`   Attempts: ${data.attempts || 0}`);
  console.log(`   Last Error: ${data.last_error ? '[PRESENT]' : 'null'}`);
  console.log(`   Created At: ${data.created_at}`);
  console.log(`   Sent At: ${data.sent_at || 'null'}`);
  console.log();

  if (data.status === 'sent') {
    console.log('✅ VERIFIED: Pick successfully sent to Discord');
    console.log(`   Discord Channel: ${data.discord_channel_id}`);
    console.log(`   Discord Message: ${data.external_message_id}`);
    process.exit(0);
  } else if (data.status === 'failed') {
    console.error('❌ FAILED: Pick failed to send');
    if (data.last_error) {
      console.error(`   Error present: YES`);
    }
    process.exit(1);
  } else {
    console.log(`⏳ PENDING: Pick status is ${data.status}, attempts: ${data.attempts}`);
    process.exit(2);
  }
}

main();
