/**
 * Live Loop Schedulers
 *
 * Continuous schedulers for FeedAgent, ScoringAgent, and Promotion sweep.
 * Runs inside the API process without external cron dependencies.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OUT_DIR = path.join(process.cwd(), 'apps/api/out/ops/schedulers');

// Ensure output directory exists
function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

// Write audit artifact
function writeArtifact(name: string, data: any) {
  ensureDir(OUT_DIR);
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${name}-${runId}.json`;
  fs.writeFileSync(
    path.join(OUT_DIR, filename),
    JSON.stringify(data, null, 2)
  );
  console.log(`📝 Artifact written: ${filename}`);
}

// Log to agent_health table (health ping for watchdog)
async function logHealth(
  agent: string,
  loop: string,
  details?: Record<string, any>
) {
  await supabase.from('agent_health').insert({
    agent,
    details: { loop, ...details },
  });
}

/**
 * Loop A: FeedAgent - Ingest today+48h props every 45s
 */
async function feedLoop() {
  const INTERVAL_MS = 45 * 1000; // 45 seconds

  console.log('🔄 [FeedLoop] Starting (every 45s)...');

  while (true) {
    const startTime = Date.now();
    const stats = {
      agent: 'FeedAgent',
      timestamp: new Date().toISOString(),
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      sports: [] as string[],
    };

    try {
      console.log(`\n[FeedLoop] Cycle start: ${stats.timestamp}`);

      // TODO: Call actual FeedAgent ingest for today+48h
      // For now, log health only
      stats.sports = ['mlb', 'nfl', 'nba', 'nhl'];
      stats.inserted = 0; // Replace with actual counts from FeedAgent

      await logHealth('FeedAgent', 'feed', stats);
      console.log(`[FeedLoop] ✅ Completed in ${Date.now() - startTime}ms`);
    } catch (error) {
      stats.errors++;
      console.error(`[FeedLoop] ❌ Error:`, error);
      await logHealth('FeedAgent', 'feed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Write artifact
    writeArtifact('feedloop', stats);

    // Wait for next cycle
    const elapsed = Date.now() - startTime;
    const waitTime = Math.max(0, INTERVAL_MS - elapsed);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
}

/**
 * Loop B: ScoringAgent - Refresh scored_props every 30s
 */
async function scoringLoop() {
  const INTERVAL_MS = 30 * 1000; // 30 seconds

  console.log('🔄 [ScoringLoop] Starting (every 30s)...');

  while (true) {
    const startTime = Date.now();
    const stats = {
      agent: 'ScoringAgent',
      timestamp: new Date().toISOString(),
      considered: 0,
      inserted: 0,
      updated: 0,
      errors: 0,
    };

    try {
      console.log(`\n[ScoringLoop] Cycle start: ${stats.timestamp}`);

      // Fetch today's picks from v_prop_read_model
      const { data: picks, error: readError } = await supabase
        .from('v_prop_read_model')
        .select('*')
        .gte('game_date', new Date().toISOString().split('T')[0])
        .limit(100);

      if (readError) throw readError;

      stats.considered = picks?.length || 0;

      if (picks && picks.length > 0) {
        // Generate scores (simple stub - replace with actual scoring logic)
        const now = new Date().toISOString();
        const scores = picks.map((p: any) => ({
          prop_ref: p.prop_ref,
          edge: Math.random() * 0.15,
          prob_win: 0.45 + Math.random() * 0.20,
          professional_score: 60 + Math.random() * 30,
          tier: Math.random() > 0.7 ? 'A' : Math.random() > 0.4 ? 'B' : 'C',
          confidence: 0.60 + Math.random() * 0.30,
          kelly_fraction: Math.random() * 0.05,
          clv_pct: Math.random() * 10,
          updated_at: now,
        }));

        // Upsert to scored_props
        const { error: upsertError } = await supabase
          .from('scored_props')
          .upsert(scores, { onConflict: 'prop_ref' });

        if (upsertError) throw upsertError;

        stats.updated = scores.length;
        console.log(`[ScoringLoop] ✅ Updated ${stats.updated} scores`);
      }

      await logHealth('ScoringAgent', 'scoring', stats);
    } catch (error) {
      stats.errors++;
      console.error(`[ScoringLoop] ❌ Error:`, error);
      await logHealth('ScoringAgent', 'scoring', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Write artifact
    writeArtifact('scoringloop', stats);

    // Wait for next cycle
    const elapsed = Date.now() - startTime;
    const waitTime = Math.max(0, INTERVAL_MS - elapsed);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
}

/**
 * Loop C: Promotion sweep - Ensure approved items have publish_at every 30s
 */
async function promotionLoop() {
  const INTERVAL_MS = 30 * 1000; // 30 seconds

  console.log('🔄 [PromotionLoop] Starting (every 30s)...');

  while (true) {
    const startTime = Date.now();
    const stats = {
      agent: 'PromotionSweep',
      timestamp: new Date().toISOString(),
      checked: 0,
      fixed: 0,
      errors: 0,
    };

    try {
      console.log(`\n[PromotionLoop] Cycle start: ${stats.timestamp}`);

      // Find approved items without publish_at
      const { data: needsPublish, error: readError } = await supabase
        .from('promotion_queue')
        .select('id')
        .eq('status', 'approved')
        .is('publish_at', null);

      if (readError) throw readError;

      stats.checked = needsPublish?.length || 0;

      if (needsPublish && needsPublish.length > 0) {
        // Set publish_at to now
        const { error: updateError } = await supabase
          .from('promotion_queue')
          .update({ publish_at: new Date().toISOString() })
          .in('id', needsPublish.map((p: any) => p.id));

        if (updateError) throw updateError;

        stats.fixed = needsPublish.length;
        console.log(`[PromotionLoop] ✅ Fixed ${stats.fixed} publish_at timestamps`);
      }

      await logHealth('PromotionSweep', 'promotion', stats);
    } catch (error) {
      stats.errors++;
      console.error(`[PromotionLoop] ❌ Error:`, error);
      await logHealth('PromotionSweep', 'promotion', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Write artifact
    writeArtifact('promotionloop', stats);

    // Wait for next cycle
    const elapsed = Date.now() - startTime;
    const waitTime = Math.max(0, INTERVAL_MS - elapsed);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
}

/**
 * Main entry point - Start all loops
 */
async function main() {
  console.log('🚀 Starting Live Loop Schedulers');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Feed Loop: Every 45s');
  console.log('Scoring Loop: Every 30s');
  console.log('Promotion Loop: Every 30s');
  console.log('Output: apps/api/out/ops/schedulers/');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Start all loops in parallel
  await Promise.all([
    feedLoop(),
    scoringLoop(),
    promotionLoop(),
  ]);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down schedulers gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Shutting down schedulers gracefully...');
  process.exit(0);
});

main().catch(error => {
  console.error('💥 Scheduler failed:', error);
  process.exit(1);
});
