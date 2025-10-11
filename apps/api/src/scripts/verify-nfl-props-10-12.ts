#!/usr/bin/env tsx
/**
 * Verify NFL Props for 10/12/2025
 * Proves end-to-end pipeline is working
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function verifyNFL_10_12() {
  console.log('🏈 NFL Props Verification for 10/12/2025\n');
  console.log('='.repeat(80));

  const targetDate = '2025-10-12';

  // Step 1: Count total NFL market_props for 10/12
  console.log('\n📥 STEP 1: Market Props Ingestion');
  const { count: totalNFL } = await supabase
    .from('market_props')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NFL')
    .eq('game_date', targetDate);

  console.log(`  Total NFL props for 10/12: ${totalNFL}`);

  // Breakdown by market type
  const { data: markets } = await supabase
    .from('market_props')
    .select('market')
    .eq('sport', 'NFL')
    .eq('game_date', targetDate);

  const marketBreakdown: Record<string, number> = {};
  markets?.forEach(m => {
    marketBreakdown[m.market] = (marketBreakdown[m.market] || 0) + 1;
  });

  console.log('\n  Market breakdown:');
  Object.entries(marketBreakdown)
    .sort((a, b) => b[1] - a[1])
    .forEach(([market, count]) => {
      const isPlayerProp = market.startsWith('player_');
      console.log(`    ${isPlayerProp ? '🎯' : '📊'} ${market}: ${count}`);
    });

  // Count player props specifically
  const playerPropCount = Object.entries(marketBreakdown)
    .filter(([market]) => market.startsWith('player_'))
    .reduce((sum, [, count]) => sum + count, 0);

  const gameMarketCount = (totalNFL || 0) - playerPropCount;

  console.log('\n  Summary:');
  console.log(`    Game markets: ${gameMarketCount}`);
  console.log(`    Player props: ${playerPropCount} ⭐`);

  // Step 2: Get unique players
  const { data: players } = await supabase
    .from('market_props')
    .select('player_name')
    .eq('sport', 'NFL')
    .eq('game_date', targetDate)
    .ilike('market', 'player%');

  const uniquePlayers = new Set(players?.map(p => p.player_name));
  console.log(`\n  Unique NFL players: ${uniquePlayers.size}`);

  if (uniquePlayers.size > 0) {
    const samplePlayers = Array.from(uniquePlayers).slice(0, 15);
    console.log(`  Sample: ${samplePlayers.join(', ')}`);
  }

  // Step 3: Check scoring status
  console.log('\n📊 STEP 2: Scoring Status');

  // Get prop_refs for NFL props on 10/12
  const { data: nflProps } = await supabase
    .from('market_props')
    .select('id')
    .eq('sport', 'NFL')
    .eq('game_date', targetDate);

  const propRefs = nflProps?.map(p => p.id) || [];
  console.log(`  Total NFL prop_refs: ${propRefs.length}`);

  // Check how many are scored
  const { data: scoredNFL } = await supabase
    .from('scored_props')
    .select('prop_ref, professional_score, tier, edge, confidence')
    .in('prop_ref', propRefs);

  console.log(`  Scored NFL props: ${scoredNFL?.length || 0}`);

  const scoringRate = propRefs.length > 0
    ? ((scoredNFL?.length || 0) / propRefs.length * 100).toFixed(1)
    : '0.0';

  console.log(`  Scoring rate: ${scoringRate}%`);

  // Tier breakdown of scored props
  if (scoredNFL && scoredNFL.length > 0) {
    const tierCounts: Record<string, number> = {};
    scoredNFL.forEach(s => {
      tierCounts[s.tier] = (tierCounts[s.tier] || 0) + 1;
    });

    console.log('\n  Tier breakdown:');
    ['S', 'A', 'B', 'C', 'D'].forEach(tier => {
      if (tierCounts[tier]) {
        console.log(`    ${tier} tier: ${tierCounts[tier]} props`);
      }
    });

    // Sample top scored props
    const topProps = scoredNFL
      .sort((a, b) => b.professional_score - a.professional_score)
      .slice(0, 5);

    console.log('\n  Top 5 scored props:');
    topProps.forEach((prop, i) => {
      console.log(`    ${i + 1}. Score: ${prop.professional_score.toFixed(1)} | Tier: ${prop.tier} | Edge: ${(prop.edge * 100).toFixed(2)}% | Conf: ${prop.confidence.toFixed(2)}`);
    });
  }

  // Step 4: End-to-end pipeline verification
  console.log('\n✅ STEP 3: Pipeline Verification');

  const pipelineChecks = [
    {
      name: 'Ingestion',
      status: (totalNFL || 0) > 0,
      value: totalNFL,
      details: 'Props ingested from The Odds API'
    },
    {
      name: 'Player Props',
      status: playerPropCount > 0,
      value: playerPropCount,
      details: 'Real player names extracted'
    },
    {
      name: 'Unique Players',
      status: uniquePlayers.size > 10,
      value: uniquePlayers.size,
      details: 'Diverse player coverage'
    },
    {
      name: 'Scoring',
      status: (scoredNFL?.length || 0) > 0,
      value: scoredNFL?.length || 0,
      details: 'Enhanced45Factor scoring operational'
    },
    {
      name: 'Scoring Rate',
      status: parseFloat(scoringRate) > 0,
      value: `${scoringRate}%`,
      details: 'Props being scored automatically'
    }
  ];

  pipelineChecks.forEach(check => {
    const icon = check.status ? '✅' : '❌';
    console.log(`  ${icon} ${check.name}: ${check.value} - ${check.details}`);
  });

  const allPassed = pipelineChecks.every(c => c.status);

  console.log('\n' + '='.repeat(80));
  console.log(`🎯 SYSTEM STATUS: ${allPassed ? '✅ FULLY OPERATIONAL' : '⚠️ NEEDS ATTENTION'}`);
  console.log('='.repeat(80));

  // Final summary
  console.log('\n📈 FINAL SUMMARY FOR 10/12/2025:');
  console.log(`  Total NFL Props: ${totalNFL}`);
  console.log(`  Game Markets: ${gameMarketCount}`);
  console.log(`  Player Props: ${playerPropCount} ⭐`);
  console.log(`  Unique Players: ${uniquePlayers.size}`);
  console.log(`  Scored Props: ${scoredNFL?.length || 0}`);
  console.log(`  Scoring Rate: ${scoringRate}%`);
  console.log(`  Pipeline Status: ${allPassed ? '✅ End-to-End Working' : '⚠️ Needs Review'}`);

  process.exit(allPassed ? 0 : 1);
}

verifyNFL_10_12().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
