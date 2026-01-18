import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

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

const PICK_ID = 'f20495c2-ddde-4d65-97c5-a1c874e5aab0';
const CANARY_CHANNEL_ID = '1296531122234327100';

async function track1QueryAndInsert() {
  console.log('=== Track 1: Benchmark Unblock ===\n');

  // Step 1: Query pick for tenant_id and workflow_stage
  console.log('Step 1: Querying pick for tenant_id and workflow_stage...');
  const { data: pickData, error: pickError } = await supabase
    .from('picks')
    .select('id, tenant_id, workflow_stage, user_id, selection, odds, created_at')
    .eq('id', PICK_ID)
    .single();

  if (pickError) {
    console.error('ERROR querying pick:', pickError);
    process.exit(1);
  }

  if (!pickData) {
    console.error('ERROR: Pick not found');
    process.exit(1);
  }

  console.log('✅ Pick found:');
  console.log(JSON.stringify(pickData, null, 2));
  console.log('');

  // Step 2: Insert pick_publish CANARY record manually
  console.log('Step 2: Inserting pick_publish CANARY record...');
  const { data: publishData, error: publishError } = await supabase
    .from('pick_publish')
    .insert({
      pick_id: PICK_ID,
      tenant_id: pickData.tenant_id,
      channel: 'DISCORD',
      status: 'pending',
      discord_channel_id: CANARY_CHANNEL_ID,
      metadata: {
        message_type: 'new_pick',
        test_type: 'track1_benchmark',
        inserted_at: new Date().toISOString()
      }
    })
    .select()
    .single();

  if (publishError) {
    console.error('ERROR inserting pick_publish:', publishError);
    process.exit(1);
  }

  console.log('✅ pick_publish record created:');
  console.log(JSON.stringify(publishData, null, 2));
  console.log('');

  // Step 3: Query pick_publish to confirm
  console.log('Step 3: Confirming pick_publish record...');
  const { data: confirmData, error: confirmError } = await supabase
    .from('pick_publish')
    .select('*')
    .eq('id', publishData.id)
    .single();

  if (confirmError) {
    console.error('ERROR confirming pick_publish:', confirmError);
    process.exit(1);
  }

  console.log('✅ pick_publish confirmed:');
  console.log(JSON.stringify(confirmData, null, 2));
  console.log('');

  console.log('=== Track 1 Setup Complete ===');
  console.log('');
  console.log('Next steps:');
  console.log('1. Start the worker: npm run worker:dev');
  console.log('2. Monitor logs for publish attempt');
  console.log('3. Check Discord CANARY channel for message');
  console.log('4. Query pick_publish to verify status=sent');
}

track1QueryAndInsert().catch(console.error);
