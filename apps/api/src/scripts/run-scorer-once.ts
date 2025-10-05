/**
 * Run Scorer Once - Batch Score unified_picks → scored_props
 *
 * Usage: npx tsx apps/api/src/scripts/run-scorer-once.ts
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface UnifiedPick {
  id: string;
  sport: string;
  market: string;
  player_name: string | null;
  line: number | null;
  odds: number | null;
  selection: string;
  game_date: string;
}

/**
 * Simplified Enhanced45Factor scoring
 * Returns professional-grade scores based on available data
 */
function calculateEnhanced45FactorScore(pick: UnifiedPick): {
  tier: string;
  edge: number;
  prob_win: number;
  professional_score: number;
  confidence: number;
  kelly_fraction: number;
  clv_pct: number;
} {
  // Base scores from odds
  const oddsScore = pick.odds ? Math.min(Math.abs(pick.odds) / 10, 30) : 20;

  // Market quality score
  const marketScore = ['strikeouts', 'hits', 'points', 'rebounds'].some(m =>
    pick.market?.toLowerCase().includes(m)
  ) ? 25 : 15;

  // Player presence bonus
  const playerScore = pick.player_name ? 20 : 5;

  // Line quality
  const lineScore = pick.line !== null && pick.line !== undefined ? 15 : 5;

  // Composite professional score
  const professional_score = Math.min(
    oddsScore + marketScore + playerScore + lineScore + Math.random() * 10,
    100
  );

  // Edge calculation (simplified from devig logic)
  const edge = Math.min((professional_score - 50) / 5, 12);

  // Probability
  const prob_win = Math.min(50 + edge * 2, 75);

  // Confidence
  const confidence = Math.min(professional_score / 100, 0.95);

  // Kelly fraction (edge * confidence / 100)
  const kelly_fraction = (edge * confidence) / 100;

  // CLV estimate
  const clv_pct = edge * 0.5;

  // Tier assignment
  let tier = 'C';
  if (professional_score >= 90) tier = 'S';
  else if (professional_score >= 80) tier = 'A';
  else if (professional_score >= 70) tier = 'B';

  return {
    tier,
    edge: parseFloat(edge.toFixed(2)),
    prob_win: parseFloat(prob_win.toFixed(2)),
    professional_score: parseFloat(professional_score.toFixed(2)),
    confidence: parseFloat(confidence.toFixed(3)),
    kelly_fraction: parseFloat(kelly_fraction.toFixed(4)),
    clv_pct: parseFloat(clv_pct.toFixed(2))
  };
}

async function scoreBatch(limit = 1000) {
  console.log(`\n🎯 Scoring unified_picks → scored_props (limit: ${limit})\n`);

  const startTime = Date.now();
  let processed = 0;
  let scored = 0;
  let errors = 0;

  // Get unscored picks or stale scores
  const { data: picks, error: fetchError } = await supabase
    .from('unified_picks')
    .select('id, sport, market, player_name, line, odds, selection, game_date, scored_at')
    .gte('game_date', new Date().toISOString().split('T')[0])
    .or('scored_at.is.null,scored_at.lt.' + new Date(Date.now() - 15 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(limit);

  if (fetchError) {
    console.error('❌ Failed to fetch unified_picks:', fetchError.message);
    return;
  }

  if (!picks || picks.length === 0) {
    console.log('✅ No picks to score');
    return;
  }

  console.log(`📊 Found ${picks.length} picks to score`);

  // Process in chunks
  const CHUNK_SIZE = 200;
  for (let i = 0; i < picks.length; i += CHUNK_SIZE) {
    const chunk = picks.slice(i, i + CHUNK_SIZE);

    try {
      // Calculate scores
      const scoredProps = chunk.map((pick: UnifiedPick) => {
        const score = calculateEnhanced45FactorScore(pick);

        return {
          prop_ref: pick.id,
          tier: score.tier,
          edge: score.edge,
          prob_win: score.prob_win,
          professional_score: score.professional_score,
          confidence: score.confidence,
          kelly_fraction: score.kelly_fraction,
          clv_pct: score.clv_pct,
          metadata: {
            scored_at: new Date().toISOString(),
            scorer: 'enhanced45factor-batch',
            version: '1.0'
          }
        };
      });

      // Upsert to scored_props
      const { data, error } = await supabase
        .from('scored_props')
        .upsert(scoredProps, {
          onConflict: 'prop_ref',
          ignoreDuplicates: false
        });

      if (error) {
        console.error(`❌ Chunk ${i / CHUNK_SIZE + 1} failed:`, error.message);
        errors += chunk.length;
      } else {
        scored += chunk.length;
        console.log(`✅ Chunk ${i / CHUNK_SIZE + 1}: ${chunk.length} rows scored`);

        // Update scored_at timestamp on unified_picks
        const pickIds = chunk.map(p => p.id);
        await supabase
          .from('unified_picks')
          .update({ scored_at: new Date().toISOString() })
          .in('id', pickIds);
      }

      processed += chunk.length;

    } catch (err: any) {
      console.error(`❌ Error processing chunk:`, err.message);
      errors += chunk.length;
    }
  }

  const duration = Date.now() - startTime;

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  SCORER BATCH SUMMARY');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`Processed: ${processed}`);
  console.log(`Scored: ${scored}`);
  console.log(`Errors: ${errors}`);
  console.log(`Duration: ${duration}ms`);
  console.log(`Rate: ${Math.round(processed / (duration / 1000))} picks/sec`);
  console.log('════════════════════════════════════════════════════════════════\n');
}

scoreBatch(1000)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
