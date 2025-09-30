import { createSupabaseClient } from '../utils/supabase';

async function main() {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('scoring_queue')
    .select('status');

  if (error) {
    console.error('Error:', error);
    return;
  }

  const stats = data?.reduce((acc: any, j) => {
    acc[j.status] = (acc[j.status] || 0) + 1;
    return acc;
  }, {});

  console.log('Queue Status:', stats);
  console.log('Total Jobs:', data?.length || 0);
}

main();