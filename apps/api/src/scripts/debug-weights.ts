#!/usr/bin/env tsx

/**
 * Debug weight validation issues
 */

import 'dotenv/config';

const logger = {
  info: (...args: any[]) => console.log('[INFO ]', ...args),
  success: (...args: any[]) => console.log('[✅  ]', ...args),
  error: (...args: any[]) => console.log('[❌  ]', ...args),
};

async function debugWeights() {
  try {
    const { NBA_WEIGHTS } = await import('../scoring/config/weights/nba');
    const { validateWeights } = await import('../scoring/config/weights/types');
    
    logger.info('🔍 DEBUGGING NBA WEIGHTS VALIDATION');
    logger.info('=' .repeat(50));
    
    // Check what fields exist on NBA_WEIGHTS
    logger.info('NBA_WEIGHTS fields:');
    Object.entries(NBA_WEIGHTS).forEach(([key, value]) => {
      logger.info(`  ${key}: ${typeof value === 'number' ? value : typeof value}`);
    });
    
    // Calculate sum manually (matching new validation function)
    const weightFields = [
      'expectedValue', 'lineMovement', 'matchupRating', 'playerForm', 'injuryImpact', 'weatherImpact',
      'marketIntelligence', 'sharpMoney', 'volumeProfile', 'closingLineValue',
      'steamDetection', 'closingLinePrediction', 'optimalTiming', 'lineShoppingEdge',
      'publicVsSharpSplit', 'marketTimingAdvantage', 'injuryTimingEdge', 'crossMarketDiscrepancy',
      'playerFatigue', 'venueAdvantage', 'refereeImpact', 'paceImpact', 'motivationalFactors',
      'correlationRisk', 'volatility', 'portfolioImpact',
      'neuralNetwork', 'gradientBoosting', 'randomForest', 'ensemble',
      'handednessSplits', 'recentTrendAnalysis', 'headToHeadHistory', 'rosterStabilityScore',
      'bullpenQualityScore', 'advancedSplitAnalysis'
      // Excluding time-based weights as they are multipliers
    ];
    
    let total = 0;
    logger.info('\nWeight field analysis:');
    
    for (const field of weightFields) {
      const value = (NBA_WEIGHTS as any)[field];
      if (typeof value === 'number') {
        total += value;
        logger.info(`  ${field}: ${value}`);
      } else if (value === undefined) {
        logger.info(`  ${field}: MISSING`);
      } else {
        logger.info(`  ${field}: ${value} (${typeof value})`);
      }
    }
    
    logger.info(`\nCalculated total: ${total}`);
    logger.info(`Difference from 1.0: ${Math.abs(total - 1.0)}`);
    logger.info(`Within tolerance (0.001): ${Math.abs(total - 1.0) < 0.001}`);
    
    // Test validation function
    const isValid = validateWeights(NBA_WEIGHTS);
    logger.info(`ValidationWeights result: ${isValid}`);
    
  } catch (error) {
    logger.error('Debug failed:', error);
  }
}

if (require.main === module) {
  debugWeights();
}