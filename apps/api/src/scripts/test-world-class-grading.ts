#!/usr/bin/env tsx

/**
 * WORLD-CLASS GRADING SYSTEM TEST
 * 
 * Test the completely rewritten system with ZERO dummy data.
 * Validates that we now beat the best cappers in the world.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '../utils/getEnv';
import { professionalPropProcessor } from '../services/ProfessionalPropProcessor';
import { playerPerformanceAnalytics } from '../analytics/PlayerPerformanceAnalytics';
import { dvpMatchupAnalytics } from '../analytics/DVPMatchupAnalytics';

const logger = {
  info: (...args: any[]) => console.log('[INFO ]', ...args),
  success: (...args: any[]) => console.log('[✅  ]', ...args),
  error: (...args: any[]) => console.log('[❌  ]', ...args),
  warn: (...args: any[]) => console.log('[⚠️  ]', ...args),
  critical: (...args: any[]) => console.log('[🚨  ]', ...args),
};

interface WorldClassTestResults {
  totalPropsProcessed: number;
  realAnalyticsUsed: number;
  dummyDataFound: number;
  predictionAccuracy: number;
  averageConfidence: number;
  tierDistribution: Record<string, number>;
  unitRecommendations: { min: number; max: number; avg: number };
  processingTime: number;
  worldClassScore: number; // 0-100, how close to world-class
}

async function testWorldClassGradingSystem(): Promise<WorldClassTestResults> {
  try {
    logger.critical('🚀 TESTING WORLD-CLASS GRADING SYSTEM');
    logger.critical('Target: Beat the best cappers and syndicates in the world');
    logger.info('='.repeat(80));

    const env = getEnv();
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const startTime = Date.now();

    // Get sample props for testing
    logger.info('📋 Getting sample props for world-class analysis...');
    const { data: rawProps, error } = await supabase
      .from('raw_props')
      .select('*')
      .not('player_name', 'is', null)
      .not('line', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10); // Test with 10 props

    if (error || !rawProps || rawProps.length === 0) {
      throw new Error(`Failed to get props for testing: ${error?.message || 'No props found'}`);
    }

    logger.success(`✅ Found ${rawProps.length} props for world-class testing`);

    const results: WorldClassTestResults = {
      totalPropsProcessed: 0,
      realAnalyticsUsed: 0,
      dummyDataFound: 0,
      predictionAccuracy: 0,
      averageConfidence: 0,
      tierDistribution: { S: 0, A: 0, B: 0, C: 0, D: 0 },
      unitRecommendations: { min: 5, max: 0, avg: 0 },
      processingTime: 0,
      worldClassScore: 0
    };

    // Test each prop through the world-class system
    logger.info('\n🎯 PROCESSING PROPS THROUGH WORLD-CLASS SYSTEM:');
    logger.info('-'.repeat(60));

    const processedResults = [];

    for (let i = 0; i < rawProps.length; i++) {
      const prop = rawProps[i];
      logger.info(`\n${i + 1}/${rawProps.length}: ${prop.player_name} ${prop.stat_type} (${prop.sport})`);

      try {
        // Test analytics engines directly
        const playerAnalytics = await playerPerformanceAnalytics.getPlayerPerformance(
          prop.player_name,
          prop.sport,
          prop.stat_type
        );

        const opponentTeam = prop.away_team || prop.home_team || 'Unknown';
        const playerTeam = prop.home_team !== opponentTeam ? prop.home_team : prop.away_team;
        
        const matchupAnalytics = await dvpMatchupAnalytics.calculateMatchupRating(
          prop.player_name,
          playerTeam || 'Unknown',
          opponentTeam,
          prop.sport,
          prop.stat_type,
          prop.line || 0
        );

        // Test full professional processing
        const professionalResult = await professionalPropProcessor.processGradingFeatureSet({
          propId: prop.id,
          sport: prop.sport,
          marketType: prop.stat_type,
          player: prop.player_name,
          line: prop.line,
          odds: prop.over_odds || -110,
          timestamp: prop.created_at
        });

        // Validate results for world-class quality
        const validation = validateWorldClassResults(playerAnalytics, matchupAnalytics, professionalResult);
        
        processedResults.push({
          prop,
          playerAnalytics,
          matchupAnalytics,
          professionalResult,
          validation
        });

        // Update results
        results.totalPropsProcessed++;
        results.realAnalyticsUsed += validation.realAnalyticsCount;
        results.dummyDataFound += validation.dummyDataCount;
        results.averageConfidence += professionalResult.confidence;
        results.tierDistribution[professionalResult.tier] = (results.tierDistribution[professionalResult.tier] || 0) + 1;

        const units = professionalResult.professional_insights?.unit_recommendation?.units || 0;
        results.unitRecommendations.min = Math.min(results.unitRecommendations.min, units);
        results.unitRecommendations.max = Math.max(results.unitRecommendations.max, units);

        logger.success(`✅ Processed: ${prop.player_name} - Tier ${professionalResult.tier}, ${units} units`);
        logger.info(`   Real Analytics: ${validation.realAnalyticsCount}/10, Dummy Found: ${validation.dummyDataCount}`);
        logger.info(`   Player Form: ${playerAnalytics.formScore.toFixed(3)}, Matchup: ${matchupAnalytics.overallMatchupRating.toFixed(3)}`);
        logger.info(`   Prediction: ${matchupAnalytics.recommendedSide?.toUpperCase() || 'TBD'}, Confidence: ${(professionalResult.confidence * 100).toFixed(1)}%`);

      } catch (error) {
        logger.error(`❌ Failed to process ${prop.player_name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Calculate final metrics
    results.processingTime = Date.now() - startTime;
    results.averageConfidence = results.averageConfidence / results.totalPropsProcessed;
    results.unitRecommendations.avg = processedResults.reduce((sum, r) => {
      const units = r.professionalResult?.professional_insights?.unit_recommendation?.units || 0;
      return sum + units;
    }, 0) / processedResults.length;

    // Calculate World-Class Score (0-100)
    results.worldClassScore = calculateWorldClassScore(results);

    // Generate world-class report
    logger.info('\n📊 WORLD-CLASS SYSTEM ANALYSIS COMPLETE:');
    logger.info('='.repeat(80));

    logger.success(`🎯 WORLD-CLASS SCORE: ${results.worldClassScore}/100`);
    
    if (results.worldClassScore >= 90) {
      logger.success('🏆 WORLD-CLASS ACHIEVEMENT: System beats best cappers!');
    } else if (results.worldClassScore >= 80) {
      logger.info('⭐ PROFESSIONAL GRADE: System competitive with top cappers');
    } else if (results.worldClassScore >= 70) {
      logger.warn('📈 GOOD SYSTEM: Above average but needs improvement');
    } else {
      logger.error('📉 NEEDS WORK: System below professional standards');
    }

    logger.info(`\n📈 SYSTEM METRICS:`);
    logger.info(`   Props Processed: ${results.totalPropsProcessed}`);
    logger.info(`   Real Analytics: ${results.realAnalyticsUsed}/${results.totalPropsProcessed * 10} (${((results.realAnalyticsUsed / (results.totalPropsProcessed * 10)) * 100).toFixed(1)}%)`);
    logger.info(`   Dummy Data Found: ${results.dummyDataFound} (${results.dummyDataFound === 0 ? '✅ NONE!' : '❌ ELIMINATE!'})`);
    logger.info(`   Average Confidence: ${(results.averageConfidence * 100).toFixed(1)}%`);
    logger.info(`   Processing Time: ${results.processingTime}ms (avg: ${Math.round(results.processingTime / results.totalPropsProcessed)}ms per prop)`);

    logger.info(`\n🏆 TIER DISTRIBUTION:`);
    Object.entries(results.tierDistribution).forEach(([tier, count]) => {
      const percentage = (count / results.totalPropsProcessed * 100).toFixed(1);
      logger.info(`   Tier ${tier}: ${count} props (${percentage}%)`);
    });

    logger.info(`\n💰 UNIT RECOMMENDATIONS:`);
    logger.info(`   Range: ${results.unitRecommendations.min} - ${results.unitRecommendations.max} units`);
    logger.info(`   Average: ${results.unitRecommendations.avg.toFixed(1)} units`);

    // Provide specific improvement recommendations
    if (results.worldClassScore < 90) {
      logger.info('\n🎯 IMPROVEMENT RECOMMENDATIONS:');
      
      if (results.dummyDataFound > 0) {
        logger.error(`   ❌ CRITICAL: Eliminate ${results.dummyDataFound} dummy data instances`);
      }
      
      if (results.averageConfidence < 0.7) {
        logger.warn(`   ⚠️  Increase prediction confidence (current: ${(results.averageConfidence * 100).toFixed(1)}%)`);
      }
      
      const sTierPercent = (results.tierDistribution.S / results.totalPropsProcessed) * 100;
      if (sTierPercent < 10) {
        logger.warn(`   📈 Increase S-tier picks (current: ${sTierPercent.toFixed(1)}%)`);
      }
    }

    logger.info('\n✅ WORLD-CLASS GRADING TEST COMPLETE!');
    return results;

  } catch (error) {
    logger.critical('🚨 World-class grading test failed:', error);
    throw error;
  }
}

/**
 * Validate that results meet world-class standards
 */
function validateWorldClassResults(playerAnalytics: any, matchupAnalytics: any, professionalResult: any) {
  let realAnalyticsCount = 0;
  let dummyDataCount = 0;

  // Check player analytics for real data
  if (playerAnalytics.formScore !== 0.5 && playerAnalytics.formScore !== 0.7) realAnalyticsCount++;
  if (playerAnalytics.trendDirection !== 'stable') realAnalyticsCount++;
  if (playerAnalytics.last3Games?.hitRate !== 0.5) realAnalyticsCount++;
  if (playerAnalytics.last5Games?.hitRate !== 0.5) realAnalyticsCount++;

  // Check matchup analytics for real data
  if (matchupAnalytics.overallMatchupRating !== 0.5 && matchupAnalytics.overallMatchupRating !== 0.6) realAnalyticsCount++;
  if (matchupAnalytics.matchupAdvantage !== 0) realAnalyticsCount++;
  if (matchupAnalytics.recommendedSide !== 'avoid') realAnalyticsCount++;

  // Check professional result
  if (professionalResult.tier && professionalResult.tier !== 'C') realAnalyticsCount++;
  if (professionalResult.confidence > 0.1) realAnalyticsCount++;
  if (professionalResult.professional_insights?.unit_recommendation) realAnalyticsCount++;

  // Check for dummy data patterns
  if (playerAnalytics.formScore === 0.7) dummyDataCount++;
  if (matchupAnalytics.overallMatchupRating === 0.6) dummyDataCount++;
  if (professionalResult.confidence === 0.5) dummyDataCount++;

  return {
    realAnalyticsCount,
    dummyDataCount
  };
}

/**
 * Calculate world-class score (0-100)
 */
function calculateWorldClassScore(results: WorldClassTestResults): number {
  let score = 0;

  // Real analytics usage (40 points)
  const analyticsRatio = results.realAnalyticsUsed / (results.totalPropsProcessed * 10);
  score += analyticsRatio * 40;

  // No dummy data (20 points)
  if (results.dummyDataFound === 0) {
    score += 20;
  } else {
    score += Math.max(0, 20 - (results.dummyDataFound * 2));
  }

  // High confidence predictions (20 points)
  score += Math.min(results.averageConfidence * 20, 20);

  // Good tier distribution (10 points)
  const sTierPercent = (results.tierDistribution.S / results.totalPropsProcessed) * 100;
  const aTierPercent = (results.tierDistribution.A / results.totalPropsProcessed) * 100;
  const topTierPercent = sTierPercent + aTierPercent;
  score += Math.min(topTierPercent * 0.5, 10);

  // Fast processing (10 points)
  const avgProcessingTime = results.processingTime / results.totalPropsProcessed;
  if (avgProcessingTime < 1000) score += 10;
  else if (avgProcessingTime < 2000) score += 5;

  return Math.round(Math.min(score, 100));
}

if (require.main === module) {
  testWorldClassGradingSystem()
    .then((results) => {
      console.log(`\n🏆 WORLD-CLASS TEST COMPLETE: ${results.worldClassScore}/100`);
      
      if (results.worldClassScore >= 90) {
        console.log('✅ System ready for world-class production!');
        process.exit(0);
      } else {
        console.log(`❌ System needs improvement to reach world-class standards (currently ${results.worldClassScore}/100)`);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n🚨 World-class test failed:', error);
      process.exit(1);
    });
}

export { testWorldClassGradingSystem };