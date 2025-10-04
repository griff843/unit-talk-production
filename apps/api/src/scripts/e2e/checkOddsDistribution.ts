#!/usr/bin/env tsx
/**
 * Check distribution of odds in scored picks to verify professional filtering
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkOddsDistribution() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  ODDS DISTRIBUTION ANALYSIS');
  console.log('  Verifying Professional Odds Filter');
  console.log('══════════════════════════════════════════════════════════\n');

  const { data: picks } = await supabase
    .from('unified_picks')
    .select('odds, professional_score')
    .gte('game_date', '2025-10-02T04:00:00Z')
    .lt('game_date', '2025-10-03T04:00:00Z')
    .not('professional_score', 'is', null)
    .order('professional_score', { ascending: false })
    .limit(1000);

  if (!picks || picks.length === 0) {
    console.log('No scored picks found');
    return;
  }

  // Categorize by odds ranges
  const oddsRanges = {
    heavyFavorites: picks.filter(p => p.odds <= -300),
    moderateFavorites: picks.filter(p => p.odds > -300 && p.odds <= -200),
    lightFavorites: picks.filter(p => p.odds > -200 && p.odds <= -110),
    pickEm: picks.filter(p => p.odds > -110 && p.odds <= 110),
    lightUnderdogs: picks.filter(p => p.odds > 110 && p.odds <= 200),
    moderateUnderdogs: picks.filter(p => p.odds > 200 && p.odds <= 300),
    heavyUnderdogs: picks.filter(p => p.odds > 300)
  };

  console.log('📊 ODDS DISTRIBUTION:\n');
  console.log(`   Heavy Favorites (≤-300):      ${oddsRanges.heavyFavorites.length} picks`);
  console.log(`   Moderate Favorites (-299 to -200): ${oddsRanges.moderateFavorites.length} picks`);
  console.log(`   Light Favorites (-199 to -110):    ${oddsRanges.lightFavorites.length} picks`);
  console.log(`   Pick'em (-109 to +110):            ${oddsRanges.pickEm.length} picks`);
  console.log(`   Light Underdogs (+111 to +200):    ${oddsRanges.lightUnderdogs.length} picks`);
  console.log(`   Moderate Underdogs (+201 to +300): ${oddsRanges.moderateUnderdogs.length} picks`);
  console.log(`   Heavy Underdogs (>+300):           ${oddsRanges.heavyUnderdogs.length} picks`);

  console.log('\n🚫 REJECTED PICKS (Score = 0):\n');
  const rejected = picks.filter(p => p.professional_score === 0);
  console.log(`   Total rejected: ${rejected.length}`);

  if (rejected.length > 0) {
    const rejectedOdds = {
      tooHeavyFavorites: rejected.filter(p => p.odds <= -300).length,
      tooHeavyUnderdogs: rejected.filter(p => p.odds >= 600).length
    };
    console.log(`   Rejected heavy favorites (≤-300): ${rejectedOdds.tooHeavyFavorites}`);
    console.log(`   Rejected heavy underdogs (≥+600): ${rejectedOdds.tooHeavyUnderdogs}`);
  }

  console.log('\n✅ TOP 10 HIGHEST SCORED PICKS:\n');
  picks.slice(0, 10).forEach((p, idx) => {
    console.log(`   ${idx + 1}. Odds: ${p.odds > 0 ? '+' : ''}${p.odds} | Score: ${p.professional_score?.toFixed(2)}`);
  });

  console.log('\n══════════════════════════════════════════════════════════\n');
}

checkOddsDistribution().catch(console.error);
