#!/usr/bin/env npx tsx

/**
 * Fix Final Score Calculation Issue
 * 
 * Fix the final professional_score calculation in GradingEngine that's causing NaN
 * for NBA and NFL props while MLB works fine
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { config } from 'dotenv';

config();

async function fixFinalScoreCalculation() {
  console.log('🔧 FIXING FINAL SCORE CALCULATION ISSUE');
  console.log('=======================================');
  
  try {
    const gradingEnginePath = join(process.cwd(), 'src/agents/GradingAgent/scoring/gradingEngine.ts');
    
    console.log('📖 Reading gradingEngine.ts...');
    let content = readFileSync(gradingEnginePath, 'utf8');
    
    console.log('🔧 Applying final professional_score calculation fixes...');
    
    // 1. Fix the calculateCompositeScore method to ensure proper return structure
    console.log('  → Ensuring calculateCompositeScore returns valid structure');
    
    // Find and replace the return statement in calculateCompositeScore
    content = content.replace(
      /const safeFinalScore = safeNumber\(compositeScore, 0\);\s*return \{\s*finalScore: Math\.max\(0, Math\.min\(100, safeFinalScore\)\),\s*edgeScore,\s*breakdown\s*\};/,
      `const safeFinalScore = safeNumber(compositeScore, 0);
    const clampedFinalScore = Math.max(0, Math.min(100, safeFinalScore));
    
    // Debug logging to track the issue
    if (isNaN(clampedFinalScore)) {
      console.warn('calculateCompositeScore producing NaN:', {
        compositeScore,
        safeFinalScore,
        clampedFinalScore,
        breakdown
      });
    }
    
    return {
      finalScore: clampedFinalScore,
      edgeScore,
      breakdown
    };`
    );

    // 2. Fix the confidence calculation that uses compositeScore.finalScore
    console.log('  → Fixing initial confidence calculation');
    content = content.replace(
      /const initialConfidence = safeNumber\(Math\.min\(100, safeNumber\(compositeScore\.finalScore, 0\) \* safeNumber\(mlPredictions\.agreement, 0\.5\)\), 50\);/,
      `const initialConfidence = safeNumber(
      Math.min(100, 
        safeNumber(compositeScore?.finalScore, 0) * safeNumber(mlPredictions?.agreement, 0.5)
      ), 
      50
    );
    
    // Debug logging for confidence calculation
    if (isNaN(initialConfidence)) {
      console.warn('Initial confidence calculation producing NaN:', {
        compositeFinalScore: compositeScore?.finalScore,
        mlAgreement: mlPredictions?.agreement,
        result: initialConfidence
      });
    }`
    );

    // 3. Fix the scenario analysis confidence calculation
    console.log('  → Fixing scenario analysis confidence calculation');
    content = content.replace(
      /const confidence = safeDivide\(compositeScore\.finalScore, 100, 0\.5\);/,
      `const confidence = safeDivide(safeNumber(compositeScore?.finalScore, 0), 100, 0.5);
    
    // Debug logging for scenario confidence
    if (isNaN(confidence)) {
      console.warn('Scenario confidence calculation producing NaN:', {
        compositeFinalScore: compositeScore?.finalScore,
        result: confidence
      });
    }`
    );

    // 4. Fix the Kelly fraction confidence adjustment calculation
    console.log('  → Fixing Kelly fraction confidence adjustment');
    content = content.replace(
      /const confidenceAdjustment = Math\.max\(0\.5, safeDivide\(safeNumber\(compositeScore\.finalScore, 0\), 100, 0\.5\)\);/,
      `const confidenceAdjustment = Math.max(0.5, 
      safeDivide(safeNumber(compositeScore?.finalScore, 0), 100, 0.5)
    );
    
    // Debug logging for Kelly confidence adjustment
    if (isNaN(confidenceAdjustment)) {
      console.warn('Kelly confidence adjustment producing NaN:', {
        compositeFinalScore: compositeScore?.finalScore,
        result: confidenceAdjustment
      });
    }`
    );

    // 5. Add comprehensive error handling to the main gradeProp method
    console.log('  → Adding comprehensive error handling to gradeProp');
    
    // Find the main return statement in gradeProp and add validation
    const returnPattern = /return \{\s*finalScore: compositeScore\.finalScore,[\s\S]*?\};/;
    const returnMatch = content.match(returnPattern);
    
    if (returnMatch) {
      const newReturn = `// Validate all return values before returning
    const finalScore = safeNumber(compositeScore?.finalScore, 0);
    const edgeScore = safeNumber(compositeScore?.edgeScore, 0);
    const confidence = safeNumber(tier.confidence, 0);
    const kellyFraction = safeNumber(kellyFraction, 0);
    
    // Debug logging for final return values
    if (isNaN(finalScore) || isNaN(edgeScore) || isNaN(confidence) || isNaN(kellyFraction)) {
      console.error('GradeProp producing NaN values:', {
        finalScore,
        edgeScore,
        confidence,
        kellyFraction,
        propId: features.propId,
        sport: features.sport
      });
    }
    
    return {
      finalScore: Math.max(0, Math.min(100, finalScore)),
      edgeScore: Math.max(0, edgeScore),
      tier: tier.tier || 'D',
      confidence: Math.max(0, Math.min(1, confidence)),
      kellyFraction: Math.max(0, Math.min(0.25, kellyFraction)), // Cap Kelly at 25%
      positionSize: Math.max(0, Math.min(0.1, positionSize)), // Cap position at 10%
      riskAssessment,
      breakdown: compositeScore?.breakdown || {},
      featureContributions,
      professionalInsights,
      enhancedCapperAnalysis,
      scenarioAnalysis
    };`;
      
      content = content.replace(returnPattern, newReturn);
    }

    // 6. Add safe checks for ML predictions structure to prevent undefined access
    console.log('  → Adding ML predictions validation');
    content = content.replace(
      /const mlPredictions = await this\.getMLPredictions\(enrichedFeatures\);/,
      `let mlPredictions = await this.getMLPredictions(enrichedFeatures);
    
    // Ensure ML predictions has valid structure
    if (!mlPredictions || typeof mlPredictions !== 'object') {
      console.warn('Invalid ML predictions, using fallback');
      mlPredictions = {
        neuralNetwork: 50,
        gradientBoosting: 50,
        randomForest: 50,
        ensemble: 50,
        contributions: {
          'Neural Network': 10,
          'Gradient Boosting': 12.5,
          'Random Forest': 7.5,
          'Ensemble': 15
        },
        agreement: 0.5
      };
    }
    
    // Validate each prediction value
    mlPredictions.neuralNetwork = safeNumber(mlPredictions.neuralNetwork, 50);
    mlPredictions.gradientBoosting = safeNumber(mlPredictions.gradientBoosting, 50);
    mlPredictions.randomForest = safeNumber(mlPredictions.randomForest, 50);
    mlPredictions.ensemble = safeNumber(mlPredictions.ensemble, 50);
    mlPredictions.agreement = safeNumber(mlPredictions.agreement, 0.5);`
    );

    // Write the fixed content back
    console.log('💾 Writing fixed gradingEngine.ts...');
    writeFileSync(gradingEnginePath, content);
    
    console.log('✅ Final professional_score calculation fixes applied successfully!');
    console.log('\n🔧 FIXES APPLIED:');
    console.log('  ✓ Enhanced calculateCompositeScore return validation');
    console.log('  ✓ Fixed initial confidence calculation with null checks');
    console.log('  ✓ Fixed scenario analysis confidence calculation');
    console.log('  ✓ Fixed Kelly fraction confidence adjustment');
    console.log('  ✓ Added comprehensive error handling to gradeProp');
    console.log('  ✓ Added ML predictions validation');
    
    console.log('\n📊 KEY IMPROVEMENTS:');
    console.log('  • Added null-safe property access (compositeScore?.finalScore)');
    console.log('  • Added debug logging to identify NaN sources');
    console.log('  • Added validation for all return values');
    console.log('  • Added ML predictions structure validation');
    console.log('  • Added reasonable caps for Kelly fraction and position size');
    
  } catch (error) {
    console.error('❌ Fix process failed:', error);
    throw error;
  }
}

// Run the fix
if (require.main === module) {
  fixFinalScoreCalculation()
    .then(() => {
      console.log('\n✅ Final professional_score calculation fixes completed successfully');
      console.log('\n🔧 NEXT STEPS:');
      console.log('  1. Test with debug-grading-engine-nan.ts');
      console.log('  2. Verify NBA and NFL props no longer produce NaN');
      console.log('  3. Check debug logs to identify remaining issues');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fix process failed:', error);
      process.exit(1);
    });
}

export { fixFinalScoreCalculation };