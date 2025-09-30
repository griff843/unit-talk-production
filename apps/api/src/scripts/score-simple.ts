import { createSupabaseClient } from '../utils/supabase';
import { createLogger } from '../utils/logger';

const logger = createLogger('ScoreSimple');

async function main() {
  const supabase = createSupabaseClient();

  logger.info('🎯 Simple scoring for h2h picks');

  // Get pending jobs
  const { data: jobs, error: jobsError } = await supabase
    .from('scoring_queue')
    .select('id, pick_id')
    .eq('status', 'PENDING')
    .limit(10);

  if (jobsError || !jobs || jobs.length === 0) {
    logger.error('No jobs found', { error: jobsError?.message });
    return;
  }

  logger.info(`Found ${jobs.length} pending jobs`);

  // For each job, do simple scoring
  for (const job of jobs) {
    try {
      // Get pick details
      const { data: pick, error: pickError } = await supabase
        .from('unified_picks')
        .select('id, market, odds, line')
        .eq('id', job.pick_id)
        .single();

      if (pickError || !pick) {
        logger.error('Pick not found', { pickId: job.pick_id });
        await supabase
          .from('scoring_queue')
          .update({ status: 'ERROR', error: 'Pick not found' })
          .eq('id', job.id);
        continue;
      }

      // Simple scoring based on market type
      let baseScore = 50;

      // Add points for h2h markets (most common)
      if (pick.market === 'h2h') {
        baseScore += 10;
      }

      // Add points for favorable odds (between -150 and +150)
      const odds = pick.odds || 0;
      if (odds >= -150 && odds <= 150) {
        baseScore += 15;
      }

      // Professional score (simple algorithm for testing)
      const professionalScore = Math.min(Math.max(baseScore, 0), 100);

      // Update pick with score
      const { error: updateError } = await supabase
        .from('unified_picks')
        .update({
          professional_score: professionalScore,
          status: professionalScore >= 75 ? 'approved' : 'pending'
        })
        .eq('id', pick.id);

      if (updateError) {
        logger.error('Update failed', { pickId: pick.id, error: updateError.message });
        await supabase
          .from('scoring_queue')
          .update({ status: 'ERROR', error: updateError.message })
          .eq('id', job.id);
        continue;
      }

      // Mark job as DONE
      await supabase
        .from('scoring_queue')
        .update({ status: 'DONE', error: null })
        .eq('id', job.id);

      logger.info('✅ Scored', {
        pickId: pick.id,
        market: pick.market,
        professionalScore,
        status: professionalScore >= 75 ? 'approved' : 'pending'
      });

    } catch (error) {
      logger.error('Job failed', {
        jobId: job.id,
        error: error instanceof Error ? error.message : 'Unknown'
      });

      await supabase
        .from('scoring_queue')
        .update({ status: 'ERROR', error: error instanceof Error ? error.message : 'Unknown' })
        .eq('id', job.id);
    }
  }

  logger.info('🎉 Simple scoring complete');

  // Check final queue status
  const { data: finalJobs } = await supabase
    .from('scoring_queue')
    .select('status');

  const stats = finalJobs?.reduce((acc: any, j) => {
    acc[j.status] = (acc[j.status] || 0) + 1;
    return acc;
  }, {});

  console.log('\n📊 Final Queue Status:', stats);
}

main();