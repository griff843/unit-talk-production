import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Get a valid pick_id
  const { data: picks } = await supabase.from('unified_picks').select('id').limit(1);
  const pickId = picks?.[0]?.id || 'f52034a1-51b1-4a50-b6a7-89c5a3482a87';

  // Test status values
  const statuses = ['pending', 'PENDING', 'queued', 'QUEUED', 'sent', 'SENT', 'sending', 'SENDING', 'failed', 'FAILED', 'draft', 'DRAFT', 'scheduled', 'SCHEDULED'];

  console.log('Testing status values with CANARY channel...');

  for (const status of statuses) {
    const dedupe = `test_status_${status}_${Date.now()}`;
    const { error } = await supabase
      .from('pick_publish')
      .insert({
        pick_id: pickId,
        tenant_id: '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a',
        channel: 'CANARY',
        status: status,
        attempts: 0,
        max_attempts: 3,
        dedupe_key: dedupe,
      });

    if (!error) {
      console.log(`✅ status="${status}" - VALID`);
      await supabase.from('pick_publish').delete().eq('dedupe_key', dedupe);
    } else if (error.message.includes('status')) {
      console.log(`❌ status="${status}" - INVALID`);
    } else {
      console.log(`? status="${status}" - Other: ${error.message.substring(0, 60)}`);
    }
  }
}

main().catch(console.error);
