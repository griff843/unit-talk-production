import { createSupabaseClient } from '../utils/supabase';
import { createLogger } from '../utils/logger';

const logger = createLogger('EnqueueUnscored');

async function main() {
  const supabase = createSupabaseClient();

  // Find picks created recently that don't have professional_score
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  logger.info('Finding unscored picks since', { since });

  const { data: picks, error } = await supabase
    .from('unified_picks')
    .select('id, created_at, market, matchup')
    .gte('created_at', since)
    .is('professional_score', null)
    .limit(10);

  if (error) {
    logger.error('Query failed', { error: error.message });
    return;
  }

  if (!picks || picks.length === 0) {
    logger.info('No unscored picks found');
    return;
  }

  logger.info(`Found ${picks.length} unscored picks`);

  // Enqueue them
  const jobs = picks.map(p => ({
    pick_id: p.id,
    status: 'PENDING'
  }));

  const { data: inserted, error: insertError } = await supabase
    .from('scoring_queue')
    .insert(jobs)
    .select();

  if (insertError) {
    logger.error('Enqueue failed', { error: insertError.message });
    return;
  }

  logger.info(`✅ Enqueued ${inserted?.length || 0} picks for scoring`);

  picks.forEach(p => {
    console.log(`  - ${p.market}: ${p.matchup} (${p.id})`);
  });
}

main();