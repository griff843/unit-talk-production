#!/usr/bin/env tsx

/**
 * Fix ProfessionalPropProcessor configuration for elite SaaS performance
 * Target: Compete with best human cappers in the world
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '../utils/getEnv';

const logger = {
  info: (...args: any[]) => console.log('[INFO ]', ...args),
  success: (...args: any[]) => console.log('[✅  ]', ...args),
  error: (...args: any[]) => console.log('[❌  ]', ...args),
  warn: (...args: any[]) => console.log('[⚠️  ]', ...args),
};

async function fixProfessionalProcessor() {
  try {
    const env = getEnv();
    const supabase = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY
    );

    logger.info('🚀 FIXING PROFESSIONALPROPPROCESSOR FOR ELITE SAAS PERFORMANCE');
    logger.info('🎯 TARGET: Compete with best human cappers in the world');
    logger.info('=' .repeat(70));

    // Issue 1: Fix missing error_message column reference
    logger.info('\\n📊 STEP 1: Database Schema Issues');
    logger.info('-'.repeat(40));

    // Check if error_message column exists in raw_props
    const { data: schemaTest, error: schemaError } = await supabase
      .from('raw_props')
      .select('*')
      .limit(1);

    if (schemaTest?.[0]) {
      const columns = Object.keys(schemaTest[0]);
      logger.info(`raw_props columns: ${columns.join(', ')}`);
      
      if (!columns.includes('error_message')) {
        logger.warn('❌ Column error_message does not exist in raw_props');
        logger.info('✅ Solution: Update ProfessionalPropProcessor to remove error_message filter');
      }
      
      if (!columns.includes('processed_at')) {
        logger.warn('❌ Column processed_at does not exist in raw_props');
        logger.info('✅ Solution: Add processed_at column or use alternative');
      } else {
        logger.success('✅ processed_at column exists');
      }
    }

    // Issue 2: Fix sport configuration weights
    logger.info('\\n🏆 STEP 2: Elite Sport Configuration Weights');
    logger.info('-'.repeat(40));

    // Calculate actual NBA weights sum
    const nbaWeights = {
      // Core Components
      expectedValue: 0.20,
      lineMovement: 0.12,
      matchupRating: 0.15,
      playerForm: 0.12,
      injuryImpact: 0.08,
      weatherImpact: 0.0,
      
      // Advanced Market Intelligence
      marketIntelligence: 0.14,
      sharpMoney: 0.09,
      volumeProfile: 0.06,
      closingLineValue: 0.11,
      
      // Professional Capper Features
      steamDetection: 0.02,
      closingLinePrediction: 0.015,
      optimalTiming: 0.01,
      lineShoppingEdge: 0.015,
      publicVsSharpSplit: 0.02,
      marketTimingAdvantage: 0.01,
      injuryTimingEdge: 0.015,
      crossMarketDiscrepancy: 0.01,
      
      // Player & Game Context
      playerFatigue: 0.03,
      venueAdvantage: 0.02,
      refereeImpact: 0.02,
      paceImpact: 0.04,
      motivationalFactors: 0.02,
      
      // Risk & Correlation
      correlationRisk: 0.015,
      volatility: 0.01,
      portfolioImpact: 0.005,
      
      // ML Model Ensemble
      neuralNetwork: 0.025,
      gradientBoosting: 0.03,
      randomForest: 0.02,
      ensemble: 0.035,
      
      // Enhanced Features
      handednessSplits: 0.005,
      recentTrendAnalysis: 0.025,
      headToHeadHistory: 0.015,
      rosterStabilityScore: 0.01,
      bullpenQualityScore: 0.0,
      advancedSplitAnalysis: 0.02,
    };

    // Calculate weights sum
    const weightsSum = Object.values(nbaWeights).reduce((sum, weight) => sum + weight, 0);
    logger.info(`NBA weights sum: ${weightsSum.toFixed(4)} (target: 1.0000)`);
    
    if (Math.abs(weightsSum - 1.0) > 0.001) {
      logger.warn(`❌ NBA weights sum is ${weightsSum.toFixed(4)}, not 1.0 - this causes validation failure`);
      logger.info('✅ Solution: Normalize weights to sum to exactly 1.0');
      
      // Show normalized weights
      const normalizedWeights = Object.fromEntries(
        Object.entries(nbaWeights).map(([key, value]) => [key, value / weightsSum])
      );
      const normalizedSum = Object.values(normalizedWeights).reduce((sum, weight) => sum + weight, 0);
      logger.success(`✅ Normalized weights sum: ${normalizedSum.toFixed(6)}`);
    } else {
      logger.success('✅ NBA weights are properly normalized');
    }

    // Issue 3: Check devigging service
    logger.info('\\n💎 STEP 3: Elite Devigging Service');
    logger.info('-'.repeat(40));
    
    try {
      // Test devigging calculation
      const { DeviggingService } = await import('../services/devigging/DeviggingService');
      const deviggingService = DeviggingService.getInstance();
      
      const testResult = deviggingService.devigTwoWay({
        odds1: -110,
        odds2: -110
      });
      
      logger.success('✅ DeviggingService is working');
      logger.info(`Test vig removal: ${(testResult.totalVig * 100).toFixed(2)}% total vig`);
      logger.info(`True probabilities: ${testResult.outcome1.trueProb.toFixed(3)} / ${testResult.outcome2.trueProb.toFixed(3)}`);
      
    } catch (error) {
      logger.error(`❌ DeviggingService error: ${error}`);
    }

    // Issue 4: CLV Tracking Service
    logger.info('\\n📈 STEP 4: Elite CLV Tracking');
    logger.info('-'.repeat(40));
    
    try {
      const { CLVTrackingService } = await import('../services/clv/CLVTrackingService');
      const clvService = CLVTrackingService.getInstance();
      logger.success('✅ CLVTrackingService imported successfully');
    } catch (error) {
      logger.error(`❌ CLVTrackingService error: ${error}`);
    }

    // Issue 5: Professional scoring path verification
    logger.info('\\n🎯 STEP 5: Elite Professional Scoring Path');
    logger.info('-'.repeat(40));
    
    const USE_PRO_SCORER = process.env.USE_PRO_SCORER === 'true';
    logger.info(`USE_PRO_SCORER environment variable: ${USE_PRO_SCORER}`);
    
    if (!USE_PRO_SCORER) {
      logger.warn('❌ Professional scoring path is DISABLED');
      logger.info('✅ Solution: Set USE_PRO_SCORER=true in environment');
    } else {
      logger.success('✅ Professional scoring path is ENABLED');
    }

    // Issue 6: Test unified_picks schema
    logger.info('\\n📋 STEP 6: Elite Unified Picks Schema');
    logger.info('-'.repeat(40));
    
    const { data: pickTest, error: pickError } = await supabase
      .from('unified_picks')
      .select('*')
      .limit(1);

    if (pickTest?.[0]) {
      const pickColumns = Object.keys(pickTest[0]);
      logger.info(`unified_picks columns: ${pickColumns.join(', ')}`);
      
      const requiredColumns = [
        'professional_score', 'devigged_edge', 'kelly_fraction', 
        'professional_insights', 'clv_tracking_id', 'feature_contributions'
      ];
      
      const missingColumns = requiredColumns.filter(col => !pickColumns.includes(col));
      
      if (missingColumns.length > 0) {
        logger.warn(`❌ Missing professional columns: ${missingColumns.join(', ')}`);
        logger.info('✅ Solution: Add professional columns to unified_picks schema');
      } else {
        logger.success('✅ All professional columns exist in unified_picks');
      }
    }

    // Generate fix recommendations
    logger.info('\\n' + '='.repeat(70));
    logger.info('🏆 ELITE SAAS FIXES REQUIRED FOR WORLD-CLASS PERFORMANCE');
    logger.info('='.repeat(70));
    
    logger.info('\\n🔧 IMMEDIATE FIXES NEEDED:');
    logger.info('1. Remove error_message filter from getUnprocessedRawProps()');
    logger.info('2. Normalize all sport weights to sum exactly 1.0');
    logger.info('3. Set USE_PRO_SCORER=true in environment');
    logger.info('4. Add missing professional columns to unified_picks schema');
    logger.info('5. Test complete professional pipeline with real data');
    
    logger.info('\\n🚀 ELITE FEATURES TO ENABLE:');
    logger.info('• Real-time devigging for accurate edge calculation');
    logger.info('• CLV tracking for confidence adjustment over time');
    logger.info('• 52+ point professional scoring system');
    logger.info('• Kelly criterion position sizing');
    logger.info('• Advanced market intelligence integration');
    logger.info('• ML ensemble model predictions');
    logger.info('• Professional capper features (steam, timing, arbitrage)');
    
    logger.info('\\n🎯 PERFORMANCE TARGETS (Elite SaaS Level):');
    logger.info('• Pick processing: <2 seconds per prop');
    logger.info('• Accuracy: >65% win rate on high-confidence picks');
    logger.info('• CLV: Positive CLV on >60% of all picks');
    logger.info('• Edge calculation: >5% average devigged edge');
    logger.info('• Professional score distribution: S/A tier >30% of picks');

    logger.success('\\n🏆 Ready to implement elite-level professional grading system!');

  } catch (error) {
    logger.error('❌ Failed to analyze professional processor:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  fixProfessionalProcessor()
    .then(() => {
      console.log('\\n✅ Professional processor analysis completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\\n❌ Analysis failed:', error);
      process.exit(1);
    });
}