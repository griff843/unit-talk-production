#!/usr/bin/env npx tsx

/**
 * Analyze Grading and Promotion - Deep dive into why props aren't being promoted
 */

import { config } from 'dotenv';

import { supabaseClient } from '../services/supabaseClient';

config();

async function analyzeGradingPromotion() {
  console.log('🔍 ANALYZING GRADING AND PROMOTION WORKFLOW');
  console.log('==========================================');

  try {
    // Check props by promotion status
    const { data: promotionStats } = await supabaseClient
      .from('raw_props')
      .select('promoted, promoted_to_picks, is_promoted, edge_score, tier')
      .not('edge_score', 'is', null);

    console.log('\n📊 PROMOTION STATUS ANALYSIS:');
    if (promotionStats?.length) {
      const promoted = promotionStats.filter(p => p.promoted === true).length;
      const promotedToPicks = promotionStats.filter(p => p.promoted_to_picks === true).length;
      const isPromoted = promotionStats.filter(p => p.is_promoted === true).length;
      const totalGraded = promotionStats.length;

      console.log(`Total grading_status props: ${totalGraded}`);
      console.log(`promoted=true: ${promoted}`);
      console.log(`promoted_to_picks=true: ${promotedToPicks}`);
      console.log(`is_promoted=true: ${isPromoted}`);

      // Check tier distribution
      const tierCounts: Record<string, number> = {};
      promotionStats.forEach(p => {
        if (p.tier) {
          tierCounts[p.tier] = (tierCounts[p.tier] || 0) + 1;
        }
      });
      console.log('Tier distribution:', tierCounts);

      // Check edge professional_score distribution
      const edgeScores = promotionStats
        .map(p => p.edge_score)
        .filter(Boolean)
        .sort((a, b) => b - a);
      console.log(`Edge scores range: ${edgeScores[edgeScores.length - 1]} to ${edgeScores[0]}`);
      console.log(`High-quality props (edge >= 50): ${edgeScores.filter(s => s >= 50).length}`);
    }

    // Check recent grading activity
    console.log('\n⏰ RECENT GRADING ACTIVITY:');
    const { data: recentlyGraded } = await supabaseClient
      .from('raw_props')
      .select(
        'id, sport, player_name, stat_type, edge_score, tier, promoted, created_at, updated_at'
      )
      .not('edge_score', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(5);

    if (recentlyGraded?.length) {
      recentlyGraded.forEach(prop => {
        console.log(`  ${prop.sport}: ${prop.player_name || 'Team Total'} - ${prop.stat_type}`);
        console.log(`    Edge: ${prop.edge_score}, Tier: ${prop.tier}, Promoted: ${prop.promoted}`);
        console.log(
          `    Created: ${prop.created_at?.split('T')[0]}, Updated: ${prop.updated_at?.split('T')[0] || 'Never'}`
        );
      });
    } else {
      console.log('  No recently grading_status props found');
    }

    // Check promotion criteria - look for high-quality props that should be promoted
    console.log('\n🎯 HIGH-QUALITY PROPS READY FOR PROMOTION:');
    const { data: highQualityProps } = await supabaseClient
      .from('raw_props')
      .select(
        'id, sport, player_name, stat_type, edge_score, tier, promoted, promoted_to_picks, is_promoted'
      )
      .gte('edge_score', 40) // High edge professional_score
      .eq('promoted', false) // Not yet promoted
      .limit(10);

    if (highQualityProps?.length) {
      console.log(`Found ${highQualityProps.length} high-quality props not yet promoted:`);
      highQualityProps.forEach(prop => {
        console.log(`  ${prop.sport}: ${prop.player_name || 'Team Total'} - ${prop.stat_type}`);
        console.log(`    Edge: ${prop.edge_score}, Tier: ${prop.tier}`);
        console.log(
          `    Flags: promoted=${prop.promoted}, promoted_to_picks=${prop.promoted_to_picks}, is_promoted=${prop.is_promoted}`
        );
      });
    } else {
      console.log('  No high-quality props awaiting promotion (all promoted or low edge scores)');
    }

    // Check if props need different criteria
    console.log('\n🔍 PROMOTION CRITERIA ANALYSIS:');
    const { data: allGradedProps } = await supabaseClient
      .from('raw_props')
      .select('edge_score, tier, promoted')
      .not('edge_score', 'is', null);

    if (allGradedProps?.length) {
      const promotableByEdge = allGradedProps.filter(p => p.edge_score >= 30 && !p.promoted).length;
      const promotableByTier = allGradedProps.filter(
        p => ['S', 'A'].includes(p.tier) && !p.promoted
      ).length;

      console.log(`Props with edge >= 30 not promoted: ${promotableByEdge}`);
      console.log(`Props with S/A tier not promoted: ${promotableByTier}`);
    }

    // Check unified_picks to see what's been promoted
    console.log('\n📋 EXISTING UNIFIED PICKS:');
    const { data: existingPicks } = await supabaseClient
      .from('unified_picks')
      .select('sport, selection, confidence, tier_when_placed, created_at')
      .order('created_at', { ascending: false })
      .limit(7);

    if (existingPicks?.length) {
      existingPicks.forEach(pick => {
        console.log(`  ${pick.sport}: ${pick.selection}`);
        console.log(`    Confidence: ${pick.confidence}, Tier: ${pick.tier_when_placed}`);
        console.log(`    Created: ${pick.created_at?.split('T')[0]}`);
      });
    }

    console.log('\n💡 ANALYSIS SUMMARY:');
    console.log('===================');

    if (promotionStats?.length) {
      const unpromoted = promotionStats.filter(
        p => !p.promoted && !p.is_promoted && !p.promoted_to_picks
      ).length;
      console.log(`✅ GradingAgent is working: ${promotionStats.length} props have edge scores`);
      console.log(`⚠️ Promotion issue: ${unpromoted} grading_status props not promoted`);

      if (unpromoted > 0) {
        console.log('\n🔧 POTENTIAL ISSUES:');
        console.log('- Promotion criteria might be too strict');
        console.log('- Promotion workflow might not be running');
        console.log('- Multiple promotion flags causing confusion');
        console.log('- Props might need manual promotion trigger');
      }
    } else {
      console.log('❌ No grading_status props found - GradingAgent not working properly');
    }
  } catch (error) {
    console.error('❌ Error analyzing grading and promotion:', error);
  }
}

// Run the analysis
if (require.main === module) {
  analyzeGradingPromotion()
    .then(() => {
      console.log('\n✅ Grading and promotion analysis completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Analysis failed:', error);
      process.exit(1);
    });
}

export { analyzeGradingPromotion };
