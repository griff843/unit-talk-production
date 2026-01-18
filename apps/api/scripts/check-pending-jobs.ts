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
  console.log('Checking pending jobs...\n');

  const now = new Date().toISOString();
  console.log(`Current time: ${now}\n`);

  const { data: jobs, error } = await supabase
    .from('pick_publish')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log(`Found ${jobs?.length || 0} pending jobs:\n`);

  for (const job of jobs || []) {
    console.log(`Job ID: ${job.id}`);
    console.log(`  Pick ID: ${job.pick_id}`);
    console.log(`  Channel: ${job.channel}`);
    console.log(`  Attempts: ${job.attempts}`);
    console.log(`  Created: ${job.created_at}`);
    console.log(`  Next Attempt: ${job.next_attempt_at || 'null'}`);
    console.log(`  Last Error: ${job.last_error ? job.last_error.substring(0, 100) : 'none'}`);

    if (job.next_attempt_at) {
      const nextAttempt = new Date(job.next_attempt_at);
      const currentTime = new Date();
      const diff = nextAttempt.getTime() - currentTime.getTime();
      console.log(`  Time until next attempt: ${Math.round(diff / 1000)}s`);
    }

    console.log('');
  }
})();
