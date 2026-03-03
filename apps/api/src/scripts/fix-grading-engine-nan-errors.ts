#!/usr/bin/env npx tsx

/**
 * Fix GradingEngine NaN Calculation Errors
 *
 * Patches the gradingEngine.ts with safe mathematical operations
 * to prevent NaN errors in scoring calculations
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { config } from 'dotenv';

config();

async function fixGradingEngineNaNErrors() {
  console.log('🔧 FIXING GRADING ENGINE NaN CALCULATION ERRORS');
  console.log('==============================================');

  try {
    const gradingEnginePath = join(
      process.cwd(),
      'src/agents/GradingAgent/scoring/gradingEngine.ts'
    );

    console.log('📖 Reading gradingEngine.ts...');
    let content = readFileSync(gradingEnginePath, 'utf8');

    console.log('🔧 Applying NaN error fixes...');

    // 1. Add safe number utility functions at the top
    const safeNumberUtilities = `
/**
 * Safe mathematical operations to prevent NaN errors
 */
function safeNumber(value: any, defaultValue: number = 0): number {
  const num = typeof value === 'number' ? value : parseFloat(value);
  return isNaN(num) || !isFinite(num) ? defaultValue : num;
}

function safeMultiply(a: any, b: any, defaultA: number = 0, defaultB: number = 1): number {
  const numA = safeNumber(a, defaultA);
  const numB = safeNumber(b, defaultB);
  const result = numA * numB;
  return isNaN(result) || !isFinite(result) ? 0 : result;
}

function safeDivide(numerator: any, denominator: any, defaultValue: number = 0): number {
  const num = safeNumber(numerator, 0);
  const den = safeNumber(denominator, 1);
  if (den === 0) return defaultValue;
  const result = num / den;
  return isNaN(result) || !isFinite(result) ? defaultValue : result;
}

function safeWeight(weights: any, key: string, defaultValue: number = 1): number {
  if (!weights || typeof weights !== 'object') return defaultValue;
  return safeNumber(weights[key], defaultValue);
}

`;

    // Insert utilities after imports
    const importsEndIndex = content.indexOf('export class SyndicateGradingEngine');
    if (importsEndIndex === -1) {
      throw new Error('Could not find SyndicateGradingEngine class declaration');
    }
    content =
      content.slice(0, importsEndIndex) + safeNumberUtilities + content.slice(importsEndIndex);

    // 2. Fix calculateCoreScore method
    content = content.replace(
      /private calculateCoreScore\(features: GradingFeatureSet, weights: any\): number \{[\s\S]*?return score;\s*\}/,
      `private calculateCoreScore(features: GradingFeatureSet, weights: any): number {
    let professional_score = 0;

    // Each component contributes based on its weight
    // Expected Value: 12.5% EV should give high professional_score
    const evValue = safeNumber(features.expectedValue, 0);
    const evScore = Math.min(10, evValue / 1.25);
    professional_score += safeMultiply(evScore, safeWeight(weights, 'expectedValue', 0.3));

    // Line Movement: 3.5 points movement is excellent
    const lineValue = safeNumber(features.lineMovement, 0);
    const lineScore = Math.min(10, Math.abs(lineValue) * 2);
    professional_score += safeMultiply(lineScore, safeWeight(weights, 'lineMovement', 0.2));

    // Matchup Rating: 92/100 is excellent
    const matchupValue = safeNumber(features.matchupRating, 50);
    const matchupScore = matchupValue / 10;
    professional_score += safeMultiply(matchupScore, safeWeight(weights, 'matchupRating', 0.25));

    // Player Form: 95/100 is peak form
    const formValue = safeNumber(features.playerForm, 50);
    const formScore = formValue / 10;
    professional_score += safeMultiply(formScore, safeWeight(weights, 'playerForm', 0.25));

    // Injury Impact: 0 is perfect (no injury)
    const injuryValue = safeNumber(features.injuryImpact, 0);
    const injuryScore = 10 - Math.min(10, injuryValue);
    professional_score += safeMultiply(injuryScore, safeWeight(weights, 'injuryImpact', 0.15));

    // Weather Impact: 0 is perfect (no impact)
    const weatherValue = safeNumber(features.weatherImpact, 0);
    const weatherScore = 10 - Math.min(10, Math.abs(weatherValue));
    professional_score += safeMultiply(weatherScore, safeWeight(weights, 'weatherImpact', 0.1));

    return safeNumber(professional_score, 0);
  }`
    );

    // 3. Fix calculateMarketIntelligenceScore method
    content = content.replace(
      /private calculateMarketIntelligenceScore\(features: GradingFeatureSet, weights: any\): number \{[\s\S]*?return score;\s*\}/,
      `private calculateMarketIntelligenceScore(features: GradingFeatureSet, weights: any): number {
    let professional_score = 0;

    // Market Intelligence: 0-100 scale to 0-10
    const marketValue = safeNumber(features.marketIntelligence, 50);
    const marketScore = marketValue / 10;
    professional_score += safeMultiply(marketScore, safeWeight(weights, 'marketIntelligence', 0.3));

    // Sharp Money: 0-100 percentage to 0-10
    const sharpValue = safeNumber(features.sharpMoney, 50);
    const sharpScore = sharpValue / 10;
    professional_score += safeMultiply(sharpScore, safeWeight(weights, 'sharpMoney', 0.25));

    // Player Fatigue: 0 is good, higher is bad
    const fatigueValue = safeNumber(features.playerFatigue, 0);
    const fatigueScore = Math.max(0, 10 - fatigueValue / 10);
    professional_score += safeMultiply(fatigueScore, safeWeight(weights, 'playerFatigue', 0.15));

    // Volatility: 0-1 scale, lower is better
    const volatilityValue = safeNumber(features.volatility, 5);
    const volatilityScore = Math.max(0, 10 - volatilityValue * 10);
    professional_score += safeMultiply(volatilityScore, safeWeight(weights, 'volatility', 0.2));

    // Portfolio Impact: 0-0.1 scale, lower is better
    const portfolioValue = safeNumber(features.portfolioImpact, 0);
    const portfolioScore = Math.max(0, 10 - portfolioValue * 100);
    professional_score += safeMultiply(portfolioScore, safeWeight(weights, 'portfolioImpact', 0.1));

    // Bonus for high sharp money with good EV
    const evValue = safeNumber(features.expectedValue, 0);
    if (sharpValue >= 75 && evValue >= 8) {
      professional_score += 2; // Bonus points for strong combination
    }

    return safeNumber(professional_score, 0);
  }`
    );

    // 4. Fix calculateMLScore method
    content = content.replace(
      /private calculateMLScore\(mlPredictions: any, weights: any\): number \{[\s\S]*?return score;\s*\}/,
      `private calculateMLScore(mlPredictions: any, weights: any): number {
    let professional_score = 0;

    // Ensure mlPredictions exists and has required properties
    if (!mlPredictions || typeof mlPredictions !== 'object') {
      return 0;
    }

    // ML predictions are already 0-100, scale to 0-10
    const nnValue = safeNumber(mlPredictions.neuralNetwork, 50);
    professional_score += safeMultiply(nnValue / 10, safeWeight(weights, 'neuralNetwork', 0.25));
    
    const gbValue = safeNumber(mlPredictions.gradientBoosting, 50);
    professional_score += safeMultiply(gbValue / 10, safeWeight(weights, 'gradientBoosting', 0.25));
    
    const rfValue = safeNumber(mlPredictions.randomForest, 50);
    professional_score += safeMultiply(rfValue / 10, safeWeight(weights, 'randomForest', 0.25));
    
    const ensembleValue = safeNumber(mlPredictions.ensemble, 50);
    professional_score += safeMultiply(ensembleValue / 10, safeWeight(weights, 'ensemble', 0.25));

    return safeNumber(professional_score, 0);
  }`
    );

    // 5. Fix calculateContextScore method
    content = content.replace(
      /private calculateContextScore\(features: GradingFeatureSet, weights: any\): number \{[\s\S]*?return score;\s*\}/,
      `private calculateContextScore(features: GradingFeatureSet, weights: any): number {
    let professional_score = 0;

    // Player Fatigue: 0 is good, higher is bad
    const fatigueValue = safeNumber(features.playerFatigue, 0);
    const fatigueScore = Math.max(0, 10 - fatigueValue / 10);
    professional_score += safeMultiply(fatigueScore, safeWeight(weights, 'playerFatigue', 0.2));

    // Venue Advantage: 0-20 scale to 0-10
    const venueValue = safeNumber(features.venueAdvantage, 0);
    const venueScore = Math.min(10, venueValue / 2);
    professional_score += safeMultiply(venueScore, safeWeight(weights, 'venueAdvantage', 0.2));

    // Referee Impact: -10 to +10 scale to 0-10
    const refValue = safeNumber(features.refereeImpact, 0);
    const refScore = Math.max(0, Math.min(10, 5 + refValue / 2));
    professional_score += safeMultiply(refScore, safeWeight(weights, 'refereeImpact', 0.2));

    // Pace Impact: 0-20 scale to 0-10
    const paceValue = safeNumber(features.paceImpact, 0);
    const paceScore = Math.min(10, paceValue / 2);
    professional_score += safeMultiply(paceScore, safeWeight(weights, 'paceImpact', 0.2));

    // Motivational Factors: 0-30 scale to 0-10
    const motivationValue = safeNumber(features.motivationalFactors, 0);
    const motivationScore = Math.min(10, motivationValue / 3);
    professional_score += safeMultiply(motivationScore, safeWeight(weights, 'motivationalFactors', 0.2));

    return safeNumber(professional_score, 0);
  }`
    );

    // 6. Fix calculateRiskScore method
    content = content.replace(
      /private calculateRiskScore\(features: GradingFeatureSet, weights: any\): number \{[\s\S]*?return score;\s*\}/,
      `private calculateRiskScore(features: GradingFeatureSet, weights: any): number {
    let professional_score = 0;

    // Correlation Risk: 0-1 scale, lower is better
    const correlationValue = safeNumber(features.correlationRisk, 0);
    const correlationScore = Math.max(0, 10 - correlationValue * 10);
    professional_score += safeMultiply(correlationScore, safeWeight(weights, 'correlationRisk', 0.33));
    
    // Volatility: 0-10 scale, lower is better
    const volatilityValue = safeNumber(features.volatility, 5);
    const volatilityScore = Math.max(0, 10 - volatilityValue);
    professional_score += safeMultiply(volatilityScore, safeWeight(weights, 'volatility', 0.33));
    
    // Portfolio Impact: 0-1 scale, lower is better
    const portfolioValue = safeNumber(features.portfolioImpact, 0);
    const portfolioScore = Math.max(0, 10 - portfolioValue * 10);
    professional_score += safeMultiply(portfolioScore, safeWeight(weights, 'portfolioImpact', 0.34));

    return safeNumber(professional_score, 0);
  }`
    );

    // 7. Fix calculateCompositeScore method to use safe operations
    content = content.replace(
      /const coreContribution = coreScore \* 3\.5;/,
      'const coreContribution = safeMultiply(coreScore, 3.5);'
    );
    content = content.replace(
      /const marketContribution = marketScore \* 3;/,
      'const marketContribution = safeMultiply(marketScore, 3);'
    );
    content = content.replace(
      /const contextContribution = contextScore \* 1\.5;/,
      'const contextContribution = safeMultiply(contextScore, 1.5);'
    );
    content = content.replace(
      /const professionalContribution = professionalScore \* 1\.2;/,
      'const professionalContribution = safeMultiply(professionalScore, 1.2);'
    );

    // 8. Fix potential division by zero in Kelly calculation
    content = content.replace(
      /const kellyFraction = \(edgeValue \- 1\) \/ odds;/,
      'const kellyFraction = safeDivide(edgeValue - 1, odds, 0);'
    );

    // Write the fixed content back
    console.log('💾 Writing fixed gradingEngine.ts...');
    writeFileSync(gradingEnginePath, content);

    console.log('✅ GradingEngine NaN error fixes applied successfully!');
    console.log('\n🔧 FIXES APPLIED:');
    console.log('  ✓ Added safe number utility functions');
    console.log('  ✓ Fixed calculateCoreScore with safe operations');
    console.log('  ✓ Fixed calculateMarketIntelligenceScore with safe operations');
    console.log('  ✓ Fixed calculateMLScore with safe operations');
    console.log('  ✓ Fixed calculateContextScore with safe operations');
    console.log('  ✓ Fixed calculateRiskScore with safe operations');
    console.log('  ✓ Fixed calculateCompositeScore with safe multiplications');
    console.log('  ✓ Fixed Kelly calculation with safe division');

    console.log('\n📊 NEXT STEPS:');
    console.log('  1. Test the grading engine with diagnose-grading-system.ts');
    console.log('  2. Run GradingAgent to verify calculations work correctly');
    console.log('  3. Clear existing edge_score values and re-grade all props');
  } catch (error) {
    console.error('❌ Fix process failed:', error);
    throw error;
  }
}

// Run the fix
if (require.main === module) {
  fixGradingEngineNaNErrors()
    .then(() => {
      console.log('\n✅ NaN error fixes completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Fix process failed:', error);
      process.exit(1);
    });
}

export { fixGradingEngineNaNErrors };
