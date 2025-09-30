import { createSupabaseClient } from '../utils/supabase';
import { createLogger } from '../utils/logger';

const logger = createLogger('ResetQueue');

async function main() {
  const supabase = createSupabaseClient();

  // Delete all ERROR jobs
  logger.info('Deleting ERROR jobs...');

  const { error: deleteError } = await supabase
    .from('scoring_queue')
    .delete()
    .eq('status', 'ERROR');

  if (deleteError) {
    logger.error('Delete failed', { error: deleteError.message });
    return;
  }

  logger.info('✅ Queue reset complete');

  // Check status
  const { data, error } = await supabase
    .from('scoring_queue')
    .select('status');

  if (error) {
    logger.error('Query failed', { error: error.message });
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