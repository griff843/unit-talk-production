/**
 * Live Loop Schedulers - Normalizer & Scorer
 *
 * Normalizer: every 45s (raw_props → unified_picks)
 * Scorer: every 30s (unified_picks → scored_props)
 *
 * Usage: npx tsx apps/api/src/scripts/schedulers/liveLoops.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OUT_DIR = path.join(process.cwd(), 'apps/api/out/ops/schedulers');

let normalizerRunning = false;
let scorerRunning = false;

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
 * Loop A: Normalizer - raw_props → unified_picks every 45s
 */
async function feedLoop() {
  const INTERVAL_MS = 45 * 1000; // 45 seconds

  console.log('🔄 [NormalizerLoop] Starting (every 45s)...');

  while (true) {
    if (normalizerRunning) {
      console.log('[NormalizerLoop] ⏭️  Skipping (previous run still active)');
      await new Promise(resolve => setTimeout(resolve, INTERVAL_MS));
      continue;
    }

    normalizerRunning = true;
    const startTime = Date.now();
    const stats = {
      agent: 'Normalizer',
      timestamp: new Date().toISOString(),
      inserted: 0,
      updated: 0,
      errors: 0,
    };

    try {
      console.log(`\n[NormalizerLoop] Cycle start: ${stats.timestamp}`);

      const { data: rawProps, error } = await supabase
        .from('raw_props')
        .select('id, external_prop_id, external_game_id, sport, market, player_name, line, odds, over_odds, under_odds, outcome, game_date, bookmaker_key, metadata')
        .gte('game_date', new Date().toISOString().split('T')[0])
        .eq('is_valid', true)
        .eq('promoted_to_picks', false)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      if (!rawProps || rawProps.length === 0) {
        console.log('[NormalizerLoop] ✅ No props to normalize');
        normalizerRunning = false;
        await new Promise(resolve => setTimeout(resolve, INTERVAL_MS));
        continue;
      }

      const unifiedPicks = rawProps.map((rp: any) => ({
        external_prop_id: rp.external_prop_id || `${rp.id}`,
        external_game_id: rp.external_game_id,
        sport: rp.sport,
        market: rp.market || 'unknown',
        selection: rp.outcome || 'over',
        line: rp.line,
        odds: rp.odds || rp.over_odds || rp.under_odds,
        player_name: rp.player_name,
        game_date: rp.game_date,
        bookmaker_key: rp.bookmaker_key || 'unknown',
        status: 'pending',
        workflow_stage: 'normalized',
        source: 'normalizer-loop',
        metadata: { raw_prop_id: rp.id, normalized_at: new Date().toISOString() }
      }));

      const { error: upsertError } = await supabase
        .from('unified_picks')
        .upsert(unifiedPicks, {
          onConflict: 'sport,market,player_name,game_date,bookmaker_key,line,selection',
          ignoreDuplicates: false
        });

      if (upsertError) throw upsertError;

      const ids = rawProps.map((rp: any) => rp.id);
      await supabase
        .from('raw_props')
        .update({ promoted_to_picks: true, processed_at: new Date().toISOString() })
        .in('id', ids);

      stats.inserted = unifiedPicks.length;
      console.log(`[NormalizerLoop] ✅ Normalized ${stats.inserted} props in ${Date.now() - startTime}ms`);

      await logHealth('Normalizer', 'normalize', stats);
    } catch (error) {
      stats.errors++;
      console.error(`[NormalizerLoop] ❌ Error:`, error);
      await logHealth('Normalizer', 'normalize', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      normalizerRunning = false;
    }

    writeArtifact('normalizerloop', stats);

    const elapsed = Date.now() - startTime;
    const waitTime = Math.max(0, INTERVAL_MS - elapsed);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
}

/**
 * Loop B: Scorer - unified_picks → scored_props every 30s
 */
async function scoringLoop() {
  const INTERVAL_MS = 30 * 1000; // 30 seconds

  console.log('🔄 [ScorerLoop] Starting (every 30s)...');

  while (true) {
    if (scorerRunning) {
      console.log('[ScorerLoop] ⏭️  Skipping (previous run still active)');
      await new Promise(resolve => setTimeout(resolve, INTERVAL_MS));
      continue;
    }

    scorerRunning = true;
    const startTime = Date.now();
    const stats = {
      agent: 'Scorer',
      timestamp: new Date().toISOString(),
      considered: 0,
      scored: 0,
      errors: 0,
    };

    try {
      console.log(`\n[ScorerLoop] Cycle start: ${stats.timestamp}`);

      const { data: picks, error } = await supabase
        .from('unified_picks')
        .select('id, sport, market, player_name, line, odds, selection')
        .gte('game_date', new Date().toISOString().split('T')[0])
        .or('scored_at.is.null,scored_at.lt.' + new Date(Date.now() - 15 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      if (!picks || picks.length === 0) {
        console.log('[ScorerLoop] ✅ No picks to score');
        scorerRunning = false;
        await new Promise(resolve => setTimeout(resolve, INTERVAL_MS));
        continue;
      }

      stats.considered = picks.length;

      const scoredProps = picks.map((pick: any) => {
        const oddsScore = pick.odds ? Math.min(Math.abs(pick.odds) / 10, 30) : 20;
        const marketScore = ['strikeouts', 'hits', 'points'].some((m: string) =>
          pick.market?.toLowerCase().includes(m)
        ) ? 25 : 15;
        const playerScore = pick.player_name ? 20 : 5;
        const lineScore = pick.line !== null ? 15 : 5;
        const professional_score = Math.min(oddsScore + marketScore + playerScore + lineScore + Math.random() * 10, 100);
        const edge = Math.min((professional_score - 50) / 5, 12);
        const prob_win = Math.min(50 + edge * 2, 75);
        const confidence = Math.min(professional_score / 100, 0.95);
        const kelly_fraction = (edge * confidence) / 100;

        let tier = 'C';
        if (professional_score >= 90) tier = 'S';
        else if (professional_score >= 80) tier = 'A';
        else if (professional_score >= 70) tier = 'B';

        return {
          prop_ref: pick.id,
          tier,
          edge: parseFloat(edge.toFixed(2)),
          prob_win: parseFloat(prob_win.toFixed(2)),
          professional_score: parseFloat(professional_score.toFixed(2)),
          confidence: parseFloat(confidence.toFixed(3)),
          kelly_fraction: parseFloat(kelly_fraction.toFixed(4)),
          clv_pct: parseFloat((edge * 0.5).toFixed(2)),
          metadata: { scored_at: new Date().toISOString() }
        };
      });

      const { error: upsertError } = await supabase
        .from('scored_props')
        .upsert(scoredProps, {
          onConflict: 'prop_ref',
          ignoreDuplicates: false
        });

      if (upsertError) throw upsertError;

      const ids = picks.map((p: any) => p.id);
      await supabase
        .from('unified_picks')
        .update({ scored_at: new Date().toISOString() })
        .in('id', ids);

      stats.scored = scoredProps.length;
      console.log(`[ScorerLoop] ✅ Scored ${stats.scored} picks in ${Date.now() - startTime}ms`);

      await logHealth('Scorer', 'score', stats);
    } catch (error) {
      stats.errors++;
      console.error(`[ScorerLoop] ❌ Error:`, error);
      await logHealth('Scorer', 'score', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      scorerRunning = false;
    }

    writeArtifact('scorerloop', stats);

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
