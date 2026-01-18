import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.resolve(__dirname, '../../../.env');
dotenv.config({ path: envPath });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

(async () => {
  console.log('🔄 Resetting pending jobs for immediate retry...\n');

  // Update all pending CANARY jobs to process immediately
  const { data: updated, error } = await supabase
    .from('pick_publish')
    .update({
      next_attempt_at: null,
      attempts: 0,
      last_error: null,
    })
    .eq('status', 'pending')
    .eq('channel', 'CANARY')
    .select();

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log(`✅ Reset ${updated?.length || 0} jobs for immediate retry\n`);

  for (const job of updated || []) {
    console.log(`  - ${job.id} (pick: ${job.pick_id})`);
  }

  console.log('\n✅ Jobs ready! Run outbox publisher now.\n');
})();
