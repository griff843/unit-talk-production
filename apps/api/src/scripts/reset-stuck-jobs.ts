import { createSupabaseClient } from '../utils/supabase';

async function main() {
  const supabase = createSupabaseClient();

  // Reset PROCESSING jobs back to PENDING
  const { error } = await supabase
    .from('scoring_queue')
    .update({ status: 'PENDING' })
    .eq('status', 'PROCESSING');

  if (error) {
    console.error('Reset failed:', error);
    return;
  }

  console.log('✅ Reset PROCESSING jobs to PENDING');

  // Check status
  const { data } = await supabase
    .from('scoring_queue')
    .select('status');

  const stats = data?.reduce((acc: any, j) => {
    acc[j.status] = (acc[j.status] || 0) + 1;
    return acc;
  }, {});

  console.log('Queue Status:', stats);
}

main();