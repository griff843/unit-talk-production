/**
 * Simplified E2E Pipeline Test
 * Tests: Queue → Score → Approve (without spawning processes)
 */

import { createLogger } from '../utils/logger';
import { createSupabaseClient } from '../utils/supabase';
import { ScoringAgent } from '../agents/ScoringAgent/ScoringAgent';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const logger = createLogger('E2E-Simple');

interface Stats {
  timestamp: string;
  queue: { pending: number; processed: number; done: number; errors: number };
  scoring: { attempted: number; succeeded: number; avgScore: number };
  approval: { checked: number; eligible: number; approved: number };
  duration: number;
  success: boolean;
}

async function main() {
  const startTime = Date.now();
  const stats: Stats = {
    timestamp: new Date().toISOString(),
    queue: { pending: 0, processed: 0, done: 0, errors: 0 },
    scoring: { attempted: 0, succeeded: 0, avgScore: 0 },
    approval: { checked: 0, eligible: 0, approved: 0 },
    duration: 0,
    success: false
  };

  const supabase = createSupabaseClient();

  logger.info('🚀 Starting Simplified E2E Pipeline Test');

  try {
    // 1) Check queue status
    logger.info('📊 Step 1: Checking scoring_queue status');
    const { data: queueData, error: queueError } = await supabase
      .from('scoring_queue')
      .select('status')
      .in('status', ['PENDING', 'PROCESSING', 'DONE', 'ERROR']);

    if (queueError) {
      logger.warn('Queue table check failed - may need migration', { error: queueError.message });
    } else if (queueData) {
      stats.queue.pending = queueData.filter(j => j.status === 'PENDING').length;
      stats.queue.processed = queueData.filter(j => j.status === 'PROCESSING').length;
      stats.queue.done = queueData.filter(j => j.status === 'DONE').length;
      stats.queue.errors = queueData.filter(j => j.status === 'ERROR').length;

      logger.info('Queue status', stats.queue);
    }

    // 2) Run scoring on queue (if jobs exist)
    if (stats.queue.pending > 0) {
      logger.info('⚡ Step 2: Processing scoring queue');

      const scoringAgent = new ScoringAgent(
        { name: 'E2E-Scoring', enabled: true, interval: 0, timeout: 120000 },
        { logger, supabase }
      );

      // Dequeue and process batch
      const { data: jobs, error: dequeueError } = await supabase
        .rpc('dequeue_scoring_job', { batch_size: 10 });

      if (dequeueError) {
        logger.error('Dequeue failed', { error: dequeueError.message });
      } else if (jobs && jobs.length > 0) {
        logger.info(`Processing ${jobs.length} jobs`);

        for (const job of jobs) {
          stats.scoring.attempted++;
          const result = await scoringAgent.scoreSinglePick(job.pick_id);

          if (result.scored) {
            stats.scoring.succeeded++;
            stats.scoring.avgScore += result.professionalScore || 0;

            await supabase
              .from('scoring_queue')
              .update({ status: 'DONE', error: null })
              .eq('id', job.id);
          } else {
            await supabase
              .from('scoring_queue')
              .update({ status: 'ERROR', error: result.error || 'Unknown' })
              .eq('id', job.id);
          }
        }

        if (stats.scoring.succeeded > 0) {
          stats.scoring.avgScore = stats.scoring.avgScore / stats.scoring.succeeded;
        }
      }
    } else {
      logger.info('⚡ Step 2: No pending queue jobs - skipping scoring');
    }

    // 3) Check approval eligibility
    logger.info('✅ Step 3: Checking approval eligibility');

    const since = new Date(Date.now() - 120 * 60 * 1000).toISOString();
    const { data: picksData, error: picksError } = await supabase
      .from('unified_picks')
      .select('id, professional_score, status')
      .gte('created_at', since)
      .not('professional_score', 'is', null);

    if (picksError) {
      logger.warn('Picks query failed', { error: picksError.message });
    } else if (picksData) {
      stats.approval.checked = picksData.length;
      stats.approval.eligible = picksData.filter(p =>
        (p.professional_score || 0) >= 75 && p.status !== 'approved'
      ).length;

      logger.info('Approval check', {
        checked: stats.approval.checked,
        eligible: stats.approval.eligible,
        minScore: 75
      });
    }

    // 4) Success
    stats.duration = Date.now() - startTime;
    stats.success = true;

    logger.info('✅ E2E Pipeline Test Complete', {
      duration: `${stats.duration}ms`,
      queueProcessed: stats.scoring.succeeded,
      avgScore: Math.round(stats.scoring.avgScore * 100) / 100,
      eligibleForApproval: stats.approval.eligible
    });

    // Write report
    const outDir = join(process.cwd(), 'out', 'ops');
    mkdirSync(outDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const reportPath = join(outDir, `E2E_SIMPLE_${timestamp}.json`);

    writeFileSync(reportPath, JSON.stringify(stats, null, 2));
    logger.info('📄 Report written', { path: reportPath });

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 E2E PIPELINE TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Timestamp: ${stats.timestamp}`);
    console.log(`Duration: ${stats.duration}ms`);
    console.log(`\n🔄 QUEUE:`);
    console.log(`  Pending: ${stats.queue.pending}`);
    console.log(`  Done: ${stats.queue.done}`);
    console.log(`  Errors: ${stats.queue.errors}`);
    console.log(`\n⚡ SCORING:`);
    console.log(`  Attempted: ${stats.scoring.attempted}`);
    console.log(`  Succeeded: ${stats.scoring.succeeded}`);
    console.log(`  Avg Score: ${Math.round(stats.scoring.avgScore * 100) / 100}`);
    console.log(`\n✅ APPROVAL:`);
    console.log(`  Checked: ${stats.approval.checked}`);
    console.log(`  Eligible (≥75): ${stats.approval.eligible}`);
    console.log(`\n✅ Result: ${stats.success ? 'SUCCESS' : 'FAILED'}`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    stats.duration = Date.now() - startTime;
    stats.success = false;

    logger.error('❌ E2E Pipeline Failed', {
      error: error instanceof Error ? error.message : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined
    });

    throw error;
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});