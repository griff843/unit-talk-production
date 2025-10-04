#!/usr/bin/env tsx
/**
 * Deep analysis of scoring system to verify it's working correctly
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzeScoring() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  SCORING SYSTEM ANALYSIS - VERIFICATION');
  console.log('══════════════════════════════════════════════════════════\n');

  const { data: picks } = await supabase
    .from('unified_picks')
    .select('id, sport, market, odds, line, selection, professional_score, confidence')
    .gte('game_date', '2025-10-02T04:00:00Z')
    .lt('game_date', '2025-10-03T04:00:00Z')
    .not('professional_score', 'is', null)
    .limit(500);

  if (!picks) {
    console.log('No picks found');
    return;
  }

  console.log(`Analyzing ${picks.length} picks...\n`);

  // Score distribution
  const scoreMap = new Map<string, number>();
  picks.forEach(p => {
    const score = p.professional_score?.toFixed(2) || '0';
    scoreMap.set(score, (scoreMap.get(score) || 0) + 1);
  });

  console.log('📊 SCORE DISTRIBUTION (Top 15):\n');
  Array.from(scoreMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([score, count]) => {
      const pct = ((count / picks.length) * 100).toFixed(1);
      console.log(`   Score ${score}: ${count} picks (${pct}%)`);
    });

  // Check for score variation
  const uniqueScores = scoreMap.size;
  console.log(`\n   Total Unique Scores: ${uniqueScores}`);
  if (uniqueScores < 10) {
    console.log('   ⚠️  WARNING: Very low score variation - possible hardcoding!');
  }

  // Odds distribution
  console.log('\n📊 ODDS DISTRIBUTION:\n');
  const oddsRanges = {
    'Heavy Favorites (≤-300)': picks.filter(p => p.odds <= -300),
    'Moderate Favorites (-299 to -200)': picks.filter(p => p.odds > -300 && p.odds <= -200),
    'Light Favorites (-199 to -110)': picks.filter(p => p.odds > -200 && p.odds <= -110),
    'Pick\'em (-109 to +110)': picks.filter(p => p.odds > -110 && p.odds <= 110),
    'Light Underdogs (+111 to +200)': picks.filter(p => p.odds > 110 && p.odds <= 200),
    'Moderate Underdogs (+201 to +300)': picks.filter(p => p.odds > 200 && p.odds <= 300),
    'Heavy Underdogs (>+300)': picks.filter(p => p.odds > 300)
  };

  Object.entries(oddsRanges).forEach(([range, picksInRange]) => {
    console.log(`   ${range}: ${picksInRange.length} picks`);
  });

  // Sample different odds ranges
  console.log('\n📋 SAMPLE PICKS ACROSS ODDS RANGES:\n');

  const samples = [
    picks.find(p => p.odds <= -200),
    picks.find(p => p.odds > -200 && p.odds <= -110),
    picks.find(p => p.odds > -110 && p.odds <= 110),
    picks.find(p => p.odds > 110 && p.odds <= 200),
    picks.find(p => p.odds > 200)
  ].filter(Boolean);

  samples.forEach(p => {
    if (p) {
      console.log(`   ${p.selection || p.market} @ ${p.odds > 0 ? '+' : ''}${p.odds}`);
      console.log(`   → Score: ${p.professional_score?.toFixed(4)}, Confidence: ${p.confidence}`);
      console.log('');
    }
  });

  // Check rejected picks (score = 0)
  const rejected = picks.filter(p => p.professional_score === 0);
  console.log(`\n🚫 REJECTED PICKS (Score = 0): ${rejected.length}\n`);
  if (rejected.length > 0) {
    console.log('   Sample rejected picks:');
    rejected.slice(0, 5).forEach(p => {
      console.log(`   - ${p.selection || p.market} @ ${p.odds > 0 ? '+' : ''}${p.odds}`);
    });
  }

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  DIAGNOSIS');
  console.log('══════════════════════════════════════════════════════════\n');

  if (uniqueScores < 10) {
    console.log('❌ ISSUE: Scoring appears hardcoded or broken');
    console.log('   Expected: Hundreds of unique scores');
    console.log(`   Actual: ${uniqueScores} unique scores`);
  } else {
    console.log('✅ Score variation looks healthy');
  }

  const hasAllOddsRanges = Object.values(oddsRanges).some(r => r.length > 0);
  if (!oddsRanges['Light Favorites (-199 to -110)'].length &&
      !oddsRanges['Pick\'em (-109 to +110)'].length) {
    console.log('❌ ISSUE: Missing favorites and pick\'em odds');
    console.log('   System may be over-filtering or data is limited');
  }

  console.log('\n══════════════════════════════════════════════════════════\n');
}

analyzeScoring().catch(console.error);
