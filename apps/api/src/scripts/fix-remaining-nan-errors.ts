#!/usr/bin/env npx tsx

/**
 * Fix Remaining GradingEngine NaN Calculation Errors
 * 
 * Addresses specific NaN errors still occurring in the scoring calculations
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { config } from 'dotenv';

config();

async function fixRemainingNaNErrors() {
  console.log('🔧 FIXING REMAINING GRADING ENGINE NaN ERRORS');
  console.log('==============================================');
  
  try {
    const gradingEnginePath = join(process.cwd(), 'src/agents/GradingAgent/scoring/gradingEngine.ts');
    
    console.log('📖 Reading gradingEngine.ts...');
    let content = readFileSync(gradingEnginePath, 'utf8');
    
    console.log('🔧 Applying additional NaN error fixes...');
    
    // 1. Fix compositeScore additions with safe operations
    console.log('  → Fixing compositeScore additions');
    content = content.replace(
      /compositeScore \+= coreContribution;/,
      'compositeScore = safeNumber(compositeScore + coreContribution, 0);'
    );
    content = content.replace(
      /compositeScore \+= marketContribution;/,
      'compositeScore = safeNumber(compositeScore + marketContribution, 0);'
    );
    content = content.replace(
      /compositeScore \+= contextContribution;/,
      'compositeScore = safeNumber(compositeScore + contextContribution, 0);'
    );
    content = content.replace(
      /compositeScore \+= riskContribution;/,
      'compositeScore = safeNumber(compositeScore + riskContribution, 0);'
    );
    content = content.replace(
      /compositeScore \+= professionalContribution;/,
      'compositeScore = safeNumber(compositeScore + professionalContribution, 0);'
    );
    content = content.replace(
      /compositeScore \+= mlContribution;/,
      'compositeScore = safeNumber(compositeScore + mlContribution, 0);'
    );
    content = content.replace(
      /compositeScore \+= bonusScore;/,
      'compositeScore = safeNumber(compositeScore + bonusScore, 0);'
    );

    // 2. Fix initial confidence calculation
    console.log('  → Fixing initial confidence calculation');
    content = content.replace(
      /const initialConfidence = Math\.min\(100, compositeScore\.finalScore \* mlPredictions\.agreement\);/,
      'const initialConfidence = safeNumber(Math.min(100, safeNumber(compositeScore.finalScore, 0) * safeNumber(mlPredictions.agreement, 0.5)), 50);'
    );

    // 3. Fix feature contributions calculation
    console.log('  → Fixing feature contributions calculation');
    content = content.replace(
      /contributions\[category\] = \(\(professional_score as number\) \/ totalScore\) \* 100;/,
      'contributions[category] = safeDivide(professional_score as number, totalScore, 0) * 100;'
    );

    // 4. Fix tier determination confidence calculation
    console.log('  → Fixing tier determination confidence');
    content = content.replace(
      /const baseConfidence = professional_score \/ 100;/,
      'const baseConfidence = safeDivide(professional_score, 100, 0.5);'
    );

    // 5. Fix edge multiplier calculation
    console.log('  → Fixing edge multiplier calculation');
    content = content.replace(
      /const edgeMultiplier = Math\.min\(1\.2, 1 \+ \(edge \/ 50\)\);/,
      'const edgeMultiplier = Math.min(1.2, 1 + safeDivide(edge, 50, 0));'
    );

    // 6. Fix Kelly fraction calculation components
    console.log('  → Fixing Kelly fraction calculations');
    content = content.replace(
      /const kellyFraction = \(b \* p - q\) \/ b;/,
      'const kellyFraction = safeDivide(b * p - q, b, 0);'
    );

    // 7. Fix scenario analysis calculations
    console.log('  → Fixing scenario analysis calculations');
    content = content.replace(
      /const confidence = compositeScore\.finalScore \/ 100;/,
      'const confidence = safeDivide(compositeScore.finalScore, 100, 0.5);'
    );

    // 8. Fix professional_score component calculation in Kelly
    console.log('  → Fixing professional_score component in Kelly calculation');
    content = content.replace(
      /const scoreComponent = compositeScore\.finalScore \/ 100;/,
      'const scoreComponent = safeDivide(compositeScore.finalScore, 100, 0.5);'
    );
    content = content.replace(
      /const evComponent = Math\.min\(1, 0\.5 \+ \(features\.expectedValue \/ 20\)\);/,
      'const evComponent = Math.min(1, 0.5 + safeDivide(safeNumber(features.expectedValue, 0), 20, 0));'
    );

    // 9. Fix risk adjustment calculation
    console.log('  → Fixing risk adjustment calculations');
    content = content.replace(
      /const riskAdjustment = Math\.max\(0\.5, 1 - \(riskAssessment\.riskScore \/ 20\)\);/,
      'const riskAdjustment = Math.max(0.5, 1 - safeDivide(safeNumber(riskAssessment.riskScore, 0), 20, 0));'
    );
    content = content.replace(
      /const confidenceAdjustment = Math\.max\(0\.5, compositeScore\.finalScore \/ 100\);/,
      'const confidenceAdjustment = Math.max(0.5, safeDivide(safeNumber(compositeScore.finalScore, 0), 100, 0.5));'
    );

    // 10. Add safe checks for ML predictions structure
    console.log('  → Adding ML predictions safety checks');
    const mlPredictionsCheck = `
    // Ensure ML predictions have required structure with safe defaults
    if (!mlPredictions || typeof mlPredictions !== 'object') {
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
    
    // Ensure all required ML prediction fields exist
    mlPredictions.neuralNetwork = safeNumber(mlPredictions.neuralNetwork, 50);
    mlPredictions.gradientBoosting = safeNumber(mlPredictions.gradientBoosting, 50);
    mlPredictions.randomForest = safeNumber(mlPredictions.randomForest, 50);
    mlPredictions.ensemble = safeNumber(mlPredictions.ensemble, 50);
    mlPredictions.agreement = safeNumber(mlPredictions.agreement, 0.5);
    
    if (!mlPredictions.contributions || typeof mlPredictions.contributions !== 'object') {
      mlPredictions.contributions = {
        'Neural Network': safeNumber(mlPredictions.neuralNetwork, 50) * 0.2,
        'Gradient Boosting': safeNumber(mlPredictions.gradientBoosting, 50) * 0.25,
        'Random Forest': safeNumber(mlPredictions.randomForest, 50) * 0.15,
        'Ensemble': safeNumber(mlPredictions.ensemble, 50) * 0.3
      };
    }
`;

    // Insert ML predictions check after getting ML predictions
    content = content.replace(
      /const mlPredictions = await this\.getMLPredictions\(enrichedFeatures\);/,
      `const mlPredictions = await this.getMLPredictions(enrichedFeatures);
    ${mlPredictionsCheck}`
    );

    // Write the fixed content back
    console.log('💾 Writing enhanced fixes to gradingEngine.ts...');
    writeFileSync(gradingEnginePath, content);
    
    console.log('✅ Remaining NaN error fixes applied successfully!');
    console.log('\n🔧 ADDITIONAL FIXES APPLIED:');
    console.log('  ✓ Safe compositeScore additions');
    console.log('  ✓ Safe initial confidence calculation');
    console.log('  ✓ Safe feature contributions calculation');
    console.log('  ✓ Safe tier determination confidence');
    console.log('  ✓ Safe edge multiplier calculation');
    console.log('  ✓ Safe Kelly fraction calculation');
    console.log('  ✓ Safe scenario analysis calculations');
    console.log('  ✓ Safe Kelly component calculations');
    console.log('  ✓ Safe risk adjustment calculations');
    console.log('  ✓ Enhanced ML predictions safety checks');
    
  } catch (error) {
    console.error('❌ Fix process failed:', error);
    throw error;
  }
}

// Run the fix
if (require.main === module) {
  fixRemainingNaNErrors()
    .then(() => {
      console.log('\n✅ Remaining NaN error fixes completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fix process failed:', error);
      process.exit(1);
    });
}

export { fixRemainingNaNErrors };