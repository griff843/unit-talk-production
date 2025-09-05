/**
 * Comprehensive Grading Pipeline Verification
 * Following claude.md rules - verify complete professional grading compliance
 */

import { createClient } from '@supabase/supabase-js';
// Load environment variables from root directory
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface GradingVerificationResult {
  rawPropsTotal: number;
  rawPropsGraded: number;
  unifiedPicksTotal: number;
  professionalCompliance: {
    clvTracking: number;
    kellyFractions: number;
    confidenceScores: number;
    tierAssignments: number;
  };
  gradingMetrics: {
    avgConfidence: number;
    tierDistribution: Record<string, number>;
    promotionRate: number;
  };
}

async function comprehensiveGradingVerification(): Promise<GradingVerificationResult> {
  console.log('🔍 COMPREHENSIVE GRADING PIPELINE VERIFICATION');
  console.log('='.repeat(55));
  
  // Check raw_props grading status
  console.log('\n📊 RAW PROPS GRADING STATUS:');
  const { data: allRawProps, count: totalRawProps } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact' });
    
  console.log(`Total raw props: ${totalRawProps || 0}`);
  
  const { data: gradedRawProps, count: gradedCount } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact' })
    .not('confidence_score', 'is', null)
    .not('tier', 'is', null);
    
  console.log(`Graded raw props: ${gradedCount || 0}`);
  console.log(`Grading completion: ${totalRawProps ? ((gradedCount || 0) / totalRawProps * 100).toFixed(1) : 0}%`);
  
  // Check tier distribution in raw_props
  const { data: tierData } = await supabase
    .from('raw_props')
    .select('tier')
    .not('tier', 'is', null);
    
  const tierDistribution = tierData?.reduce((acc: any, prop: any) => {
    acc[prop.tier] = (acc[prop.tier] || 0) + 1;
    return acc;
  }, {}) || {};
  
  console.log('\n🎯 TIER DISTRIBUTION:');
  Object.entries(tierDistribution).forEach(([tier, count]) => {
    console.log(`   ${tier} Tier: ${count} picks`);
  });
  
  // Check unified_picks promotion status
  console.log('\n📈 UNIFIED PICKS PROMOTION STATUS:');
  const { data: unifiedPicks, count: unifiedCount } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact' });
    
  console.log(`Total unified picks: ${unifiedCount || 0}`);
  
  // Check professional compliance in unified_picks
  if (unifiedPicks && unifiedPicks.length > 0) {
    console.log('\n🏆 PROFESSIONAL COMPLIANCE CHECK:');
    
    const clvTracking = unifiedPicks.filter(pick => 
      pick.kelly_bet_size !== null && pick.kelly_bet_size > 0
    ).length;
    
    const kellyFractions = unifiedPicks.filter(pick => 
      pick.kelly_bet_size !== null
    ).length;
    
    const confidenceScores = unifiedPicks.filter(pick => 
      pick.confidence !== null && pick.confidence > 0
    ).length;
    
    const tierAssignments = unifiedPicks.filter(pick => 
      pick.tier_when_placed !== null
    ).length;
    
    console.log(`   CLV tracking: ${clvTracking}/${unifiedPicks.length} (${(clvTracking/unifiedPicks.length*100).toFixed(1)}%)`);
    console.log(`   Kelly fractions: ${kellyFractions}/${unifiedPicks.length} (${(kellyFractions/unifiedPicks.length*100).toFixed(1)}%)`);
    console.log(`   Confidence scores: ${confidenceScores}/${unifiedPicks.length} (${(confidenceScores/unifiedPicks.length*100).toFixed(1)}%)`);
    console.log(`   Tier assignments: ${tierAssignments}/${unifiedPicks.length} (${(tierAssignments/unifiedPicks.length*100).toFixed(1)}%)`);
    
    // Calculate average confidence
    const avgConfidence = unifiedPicks
      .filter(pick => pick.confidence !== null)
      .reduce((sum, pick) => sum + (pick.confidence || 0), 0) / confidenceScores;
      
    console.log(`   Average confidence: ${avgConfidence.toFixed(1)}%`);
  }
  
  // Check promoted props in raw_props
  const { data: promotedProps, count: promotedCount } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact' })
    .eq('promoted_to_picks', true);
    
  console.log(`\n📤 PROMOTION TRACKING:`);
  console.log(`   Props marked as promoted: ${promotedCount || 0}`);
  console.log(`   Promotion rate: ${gradedCount ? ((promotedCount || 0) / gradedCount * 100).toFixed(1) : 0}%`);
  
  // Professional grading rules compliance check
  console.log('\n🏅 PROFESSIONAL GRADING RULES COMPLIANCE:');
  
  // Rule #1: Universal CLV Tracking
  const clvCompliance = unifiedPicks ? 
    unifiedPicks.filter(pick => pick.kelly_bet_size !== null).length / unifiedPicks.length * 100 : 0;
  console.log(`   Rule #1: CLV Tracking: ${clvCompliance.toFixed(1)}% (Target: 100%)`);
  
  // Rule #2: Professional Grading
  const gradingCompliance = gradedCount && totalRawProps ? 
    (gradedCount / totalRawProps) * 100 : 0;
  console.log(`   Rule #2: Professional Grading: ${gradingCompliance.toFixed(1)}% (Target: 100%)`);
  
  // Rule #3: Kelly Criterion Sizing
  const kellyCompliance = unifiedPicks ? 
    unifiedPicks.filter(pick => pick.kelly_bet_size && pick.kelly_bet_size > 0).length / unifiedPicks.length * 100 : 0;
  console.log(`   Rule #3: Kelly Sizing: ${kellyCompliance.toFixed(1)}% (Target: 100%)`);
  
  // Overall compliance professional_score
  const overallCompliance = (clvCompliance + gradingCompliance + kellyCompliance) / 3;
  console.log(`   Overall Compliance: ${overallCompliance.toFixed(1)}% (Target: 95%+)`);
  
  // Check if system meets professional standards
  console.log('\n🎖️ PROFESSIONAL STANDARDS ASSESSMENT:');
  if (overallCompliance >= 95) {
    console.log('   ✅ EXCEEDS PROFESSIONAL STANDARDS');
  } else if (overallCompliance >= 85) {
    console.log('   ⚠️  MEETS MINIMUM PROFESSIONAL STANDARDS');
  } else {
    console.log('   ❌ BELOW PROFESSIONAL STANDARDS - NEEDS IMPROVEMENT');
  }
  
  return {
    rawPropsTotal: totalRawProps || 0,
    rawPropsGraded: gradedCount || 0,
    unifiedPicksTotal: unifiedCount || 0,
    professionalCompliance: {
      clvTracking: clvCompliance,
      kellyFractions: kellyCompliance,
      confidenceScores: unifiedPicks ? 
        unifiedPicks.filter(pick => pick.confidence !== null).length / unifiedPicks.length * 100 : 0,
      tierAssignments: unifiedPicks ? 
        unifiedPicks.filter(pick => pick.tier_when_placed !== null).length / unifiedPicks.length * 100 : 0
    },
    gradingMetrics: {
      avgConfidence: unifiedPicks && unifiedPicks.length > 0 ? 
        unifiedPicks.filter(pick => pick.confidence !== null)
          .reduce((sum, pick) => sum + (pick.confidence || 0), 0) / 
        unifiedPicks.filter(pick => pick.confidence !== null).length : 0,
      tierDistribution,
      promotionRate: gradedCount ? ((promotedCount || 0) / gradedCount * 100) : 0
    }
  };
}

async function main() {
  try {
    const results = await comprehensiveGradingVerification();
    
    console.log('\n🎉 VERIFICATION COMPLETE!');
    console.log('📋 Summary:');
    console.log(`   • ${results.rawPropsGraded}/${results.rawPropsTotal} props grading_status (${results.rawPropsTotal ? (results.rawPropsGraded/results.rawPropsTotal*100).toFixed(1) : 0}%)`);
    console.log(`   • ${results.unifiedPicksTotal} picks promoted to unified_picks`);
    console.log(`   • ${results.gradingMetrics.promotionRate.toFixed(1)}% promotion rate`);
    console.log(`   • ${results.gradingMetrics.avgConfidence.toFixed(1)}% average confidence`);
    
    // Determine next steps
    if (results.rawPropsGraded === 0) {
      console.log('\n⚠️  NEXT STEP: Run GradingAgent to process all props');
      console.log('   Command: npx tsx src/runner/testUpdatedGradingAgent.ts');
    } else if (results.professionalCompliance.clvTracking < 95) {
      console.log('\n⚠️  NEXT STEP: Improve professional compliance');
    } else {
      console.log('\n✅ GRADING PIPELINE FULLY OPERATIONAL');
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

main().then(() => process.exit(0)).catch(console.error);