import { createSupabaseClient } from '../utils/supabase';
import { ScoringAgent } from '../agents/ScoringAgent/ScoringAgent';
import { createLogger } from '../utils/logger';

const logger = createLogger('TestSingleScore');

async function main() {
  const supabase = createSupabaseClient();

  logger.info('🧪 Testing single pick scoring');

  // Get one pending job
  const { data: jobs, error } = await supabase
    .rpc('dequeue_scoring_job', { batch_size: 1 });

  if (error || !jobs || jobs.length === 0) {
    logger.error('No jobs found', { error: error?.message });
    return;
  }

  const job = jobs[0];
  logger.info('Processing job', { jobId: job.id, pickId: job.pick_id });

  const scoringAgent = new ScoringAgent(
    { name: 'TestScoring', enabled: true, interval: 0, timeout: 120000 },
    { logger, supabase }
  );

  try {
    const startTime = Date.now();
    const result = await scoringAgent.scoreSinglePick(job.pick_id);
    const duration = Date.now() - startTime;

    logger.info('Scoring result', {
      pickId: job.pick_id,
      scored: result.scored,
      professionalScore: result.professionalScore,
      error: result.error,
      duration: `${duration}ms`
    });

    if (result.scored) {
      await supabase
        .from('scoring_queue')
        .update({ status: 'DONE', error: null })
        .eq('id', job.id);

      logger.info('✅ Job marked as DONE');
    } else {
      await supabase
        .from('scoring_queue')
        .update({ status: 'ERROR', error: result.error || 'Unknown' })
        .eq('id', job.id);

      logger.error('❌ Job marked as ERROR', { error: result.error });
    }

  } catch (error) {
    logger.error('Fatal error', {
      error: error instanceof Error ? error.message : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}

main();