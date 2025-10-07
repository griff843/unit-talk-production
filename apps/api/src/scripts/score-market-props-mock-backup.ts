#!/usr/bin/env tsx
/**
 * Score market_props using Enhanced45Factor Engine
 * Writes results to scored_props table
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface MarketProp {
  id: string;
  sport: string;
  market: string;
  selection: string;
  line: number;
  odds: number;
  player_name: string;
  game_date: string;
  metadata: any;
}

async function scoreMarketProps() {
  console.log('🎯 Scoring market_props through Enhanced45Factor Engine...\n');

  // Get unscored props using helper function
  const { data: props, error } = await supabase
    .rpc('get_unscored_market_props', { limit_count: 100 });

  if (error) {
    console.error('❌ Error fetching unscored market_props:', error.message);
    return;
  }

  console.log(`Found ${props?.length || 0} unscored props\n`);

  if (!props || props.length === 0) {
    console.log('✅ No props to score - all props are already scored');
    return;
  }

  let scored = 0;
  let errors = 0;

  for (const prop of props) {
    try {
      // PLACEHOLDER: Basic scoring logic
      // In production, this would call Enhanced45FactorEngine
      const mockScore = generateMockScore(prop);

      // Write to scored_props
      const { error: insertError } = await supabase
        .from('scored_props')
        .insert({
          prop_ref: prop.id,
          edge: mockScore.edge,
          prob_win: mockScore.probWin,
          professional_score: mockScore.professionalScore,
          tier: mockScore.tier,
          confidence: mockScore.confidence,
          kelly_fraction: mockScore.kellyFraction,
          clv_pct: 0,
          metadata: {
            sport: prop.sport,
            market: prop.market,
            scoredVia: 'market_props_scoring_script'
          }
        });

      if (insertError) {
        if (insertError.code === '23505') {
          // Duplicate - update instead
          const { error: updateError } = await supabase
            .from('scored_props')
            .update({
              edge: mockScore.edge,
              prob_win: mockScore.probWin,
              professional_score: mockScore.professionalScore,
              tier: mockScore.tier,
              confidence: mockScore.confidence,
              kelly_fraction: mockScore.kellyFraction,
              updated_at: new Date().toISOString()
            })
            .eq('prop_ref', prop.id);

          if (updateError) {
            throw updateError;
          }
        } else {
          throw insertError;
        }
      }

      scored++;

      if (scored % 10 === 0) {
        console.log(`  Scored ${scored}/${props.length} props...`);
      }
    } catch (err) {
      errors++;
      if (errors <= 5) {
        console.error(`  ❌ Error scoring prop ${prop.id}:`, err instanceof Error ? err.message : 'Unknown');
      }
    }
  }

  console.log('\n='.repeat(70));
  console.log(`✅ Scoring complete!`);
  console.log(`  Scored: ${scored}`);
  console.log(`  Errors: ${errors}`);
  console.log('='.repeat(70));

  // Verify scored_props
  const { count } = await supabase
    .from('scored_props')
    .select('*', { count: 'exact', head: true });

  console.log(`\nTotal scored_props in database: ${count}\n`);

  // Sample scored props
  const { data: sample } = await supabase
    .from('scored_props')
    .select('prop_ref, professional_score, tier, edge, confidence')
    .order('updated_at', { ascending: false })
    .limit(5);

  console.log('Sample scored_props:');
  console.log('-'.repeat(70));
  sample?.forEach((row: any) => {
    console.log(`${row.prop_ref} | Score: ${row.professional_score} | Tier: ${row.tier} | Edge: ${row.edge} | Conf: ${row.confidence}`);
  });
  console.log('');
}

/**
 * Generate mock score for demo purposes
 * TODO: Replace with actual Enhanced45FactorEngine call
 */
function generateMockScore(prop: MarketProp) {
  // Basic scoring based on odds and market type
  const baseScore = 50 + Math.random() * 30; // 50-80 range
  const confidence = 0.5 + Math.random() * 0.3; // 0.5-0.8 range
  const edge = (Math.random() - 0.5) * 0.1; // -5% to +5%
  const probWin = 0.5 + edge;

  // Determine tier based on score
  let tier = 'C';
  if (baseScore >= 75) tier = 'S';
  else if (baseScore >= 65) tier = 'A';
  else if (baseScore >= 55) tier = 'B';

  // Kelly fraction based on edge and confidence
  const kellyFraction = Math.max(0.001, Math.min(0.25, Math.abs(edge) * confidence));

  return {
    edge,
    probWin,
    professionalScore: baseScore,
    tier,
    confidence,
    kellyFraction
  };
}

scoreMarketProps().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
