import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment
dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config({ path: path.join(__dirname, '../../../.env.canary'), override: true });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyPickPublish() {
  const publishId = '0100afc3-bc0a-4179-a791-737479a322e9';

  const { data, error } = await supabase
    .from('pick_publish')
    .select('id, pick_id, status, external_message_id, discord_channel_id, attempts, sent_at, created_at')
    .eq('id', publishId)
    .single();

  if (error) {
    console.error('Error querying pick_publish:', error);
    process.exit(1);
  }

  console.log('\n=== PICK_PUBLISH VERIFICATION ===');
  console.log(JSON.stringify(data, null, 2));
  console.log('\n✅ STATUS CHECKS:');
  console.log(`  - status: ${data?.status === 'sent' ? '✅ sent' : '❌ ' + data?.status}`);
  console.log(`  - external_message_id: ${data?.external_message_id ? '✅ ' + data.external_message_id : '❌ NULL'}`);
  console.log(`  - discord_channel_id: ${data?.discord_channel_id === '1296531122234327100' ? '✅ CANARY' : '❌ ' + data?.discord_channel_id}`);
  console.log(`  - attempts: ${data?.attempts}`);
  console.log(`  - sent_at: ${data?.sent_at}`);
}

verifyPickPublish();
