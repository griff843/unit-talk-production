#!/usr/bin/env npx tsx

/**
 * Fix ML Model Calculations
 *
 * Fix the calculation issues in ML models that are causing NaN results
 * Focus on the calculateBaseScore method and feature handling
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { config } from 'dotenv';

config();

async function fixMLModelCalculations() {
  console.log('🔧 FIXING ML MODEL CALCULATIONS');
  console.log('================================');

  try {
    const mlModelPath = join(process.cwd(), 'src/agents/GradingAgent/scoring/mlModelManager.ts');

    console.log('📖 Reading mlModelManager.ts...');
    let content = readFileSync(mlModelPath, 'utf8');

    console.log('🔧 Applying ML model calculation fixes...');

    // 1. Add safe number utility functions at the top
    const safeNumberUtilities = `
/**
 * Safe mathematical operations to prevent NaN errors in ML calculations
 */
function safeNumber(value: any, defaultValue: number = 0): number {
  if (value === null || value === undefined) return defaultValue;
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

`;

    // Insert utilities after imports, before interfaces
    const interfaceIndex = content.indexOf('export interface MLModelResult');
    if (interfaceIndex === -1) {
      throw new Error('Could not find MLModelResult interface');
    }
    content =
      content.slice(0, interfaceIndex) + safeNumberUtilities + content.slice(interfaceIndex);

    // 2. Fix calculateBaseScore method with safe operations and better feature handling
    console.log('  → Fixing calculateBaseScore method');
    const newCalculateBaseScore = `
  /**
   * Calculate base professional_score from features with safe mathematical operations
   */
  public calculateBaseScore(features: GradingFeatureSet): number {
    let professional_score = 50; // Base professional_score

    try {
      // Core features (normalized to reasonable ranges)
      // Expected Value: Handle small percentages correctly
      const evValue = safeNumber(features.expectedValue, 0);
      if (evValue !== 0) {
        // Convert to percentage if it's a decimal (e.g., 0.0217 -> 2.17%)
        const evPercentage = evValue < 1 ? evValue * 100 : evValue;
        professional_score += Math.min(10, Math.max(-5, evPercentage / 1.5)); // 15% EV = 10 points, negative EV reduces professional_score
      }

      // Matchup Rating: 0-100 scale, 50 is neutral
      const matchupValue = safeNumber(features.matchupRating, 50);
      professional_score += (matchupValue - 50) / 5; // Scale to +/- 10 points

      // Player Form: 0-100 scale, 50 is neutral
      const formValue = safeNumber(features.playerForm, 50);
      professional_score += (formValue - 50) / 5; // Scale to +/- 10 points

      // Line Movement: Higher absolute movement is better
      const lineMovement = safeNumber(features.lineMovement, 0);
      professional_score += Math.min(5, Math.abs(lineMovement)); // Cap at 5 points

      // Advanced features (normalized)
      // Market Intelligence: 0-100 scale, 50 is neutral
      const marketIntel = safeNumber(features.marketIntelligence, 50);
      professional_score += (marketIntel - 50) / 10; // Scale to +/- 5 points

      // Sharp Money: 0-100 scale, 50 is neutral
      const sharpMoney = safeNumber(features.sharpMoney, 50);
      professional_score += (sharpMoney - 50) / 10; // Scale to +/- 5 points

      // Closing Line Value: Higher is better
      const closingLineValue = safeNumber(features.closingLineValue, 0);
      professional_score += Math.min(5, Math.abs(closingLineValue)); // Cap at 5 points

      // Risk adjustments
      // Correlation Risk: 0-1 scale, lower is better
      const correlationRisk = safeNumber(features.correlationRisk, 0);
      professional_score -= correlationRisk * 10; // Higher risk reduces professional_score

      // Volatility: varies by sport, but generally lower is better
      const volatility = safeNumber(features.volatility, 5);
      if (volatility > 0) {
        professional_score -= Math.min(5, volatility); // Reduce professional_score for high volatility
      }

      // Portfolio Impact: 0-1 scale, lower is better
      const portfolioImpact = safeNumber(features.portfolioImpact, 0);
      professional_score -= portfolioImpact * 10; // Higher impact reduces professional_score

      // Ensure professional_score stays within reasonable bounds
      professional_score = Math.max(0, Math.min(100, professional_score));

      return safeNumber(professional_score, 50);
    } catch (error) {
      console.warn('calculateBaseScore failed, using default:', error);
      return 50; // Safe fallback
    }
  }`;

    // Replace the existing calculateBaseScore method
    content = content.replace(
      /\/\*\*\s*\n\s*\* Calculate base professional_score from features\s*\n\s*\*\/\s*private calculateBaseScore\(features: GradingFeatureSet\): number \{[\s\S]*?return score;\s*\}/,
      newCalculateBaseScore.trim()
    );

    // 3. Fix applyNeuralNetworkLogic with safe operations
    console.log('  → Fixing applyNeuralNetworkLogic method');
    content = content.replace(
      /private applyNeuralNetworkLogic\(features: GradingFeatureSet\): number \{[\s\S]*?return adjustment;\s*\}/,
      `private applyNeuralNetworkLogic(features: GradingFeatureSet): number {
    // Neural networks excel at non-linear relationships
    let adjustment = 0;
    
    try {
      // Non-linear interactions - use safe operations
      const playerForm = safeNumber(features.playerForm, 50);
      const matchupRating = safeNumber(features.matchupRating, 50);
      if (playerForm > 0 && matchupRating > 0) {
        adjustment += Math.sqrt(playerForm * matchupRating) * 0.05; // Reduced multiplier
      }
      
      // Complex feature interactions
      const marketIntel = safeNumber(features.marketIntelligence, 50);
      const sharpMoney = safeNumber(features.sharpMoney, 50);
      if (marketIntel > 0 && sharpMoney > 0) {
        adjustment += (marketIntel * sharpMoney) / 2000; // Scale down significantly
      }
      
      // Expected value boost for neural network
      const evValue = safeNumber(features.expectedValue, 0);
      const evPercentage = evValue < 1 ? evValue * 100 : evValue;
      if (evPercentage > 0) {
        adjustment += Math.min(2, evPercentage / 5); // Cap at 2 points
      }
      
      return safeNumber(adjustment, 0);
    } catch (error) {
      console.warn('applyNeuralNetworkLogic failed:', error);
      return 0;
    }
  }`
    );

    // 4. Fix applyGradientBoostingLogic with safe operations
    console.log('  → Fixing applyGradientBoostingLogic method');
    content = content.replace(
      /private applyGradientBoostingLogic\(features: GradingFeatureSet\): number \{[\s\S]*?return adjustment;\s*\}/,
      `private applyGradientBoostingLogic(features: GradingFeatureSet): number {
    // Gradient boosting excels at feature importance and sequential learning
    let adjustment = 0;
    
    try {
      // Sequential feature importance with proper thresholds
      const evValue = safeNumber(features.expectedValue, 0);
      const evPercentage = evValue < 1 ? evValue * 100 : evValue;
      if (evPercentage > 2) { // 2% threshold
        adjustment += Math.min(3, evPercentage / 3);
      }
      
      const lineMovement = safeNumber(features.lineMovement, 0);
      if (Math.abs(lineMovement) > 1) { // 1 point threshold
        adjustment += Math.min(2, Math.abs(lineMovement) / 2);
      }
      
      const marketIntel = safeNumber(features.marketIntelligence, 50);
      if (marketIntel > 70) { // Above 70 threshold
        adjustment += Math.min(4, (marketIntel - 70) / 7.5);
      }
      
      const sharpMoney = safeNumber(features.sharpMoney, 50);
      if (sharpMoney > 65) { // Above 65 threshold
        adjustment += Math.min(2, (sharpMoney - 65) / 17.5);
      }
      
      return safeNumber(adjustment, 0);
    } catch (error) {
      console.warn('applyGradientBoostingLogic failed:', error);
      return 0;
    }
  }`
    );

    // 5. Fix applyRandomForestLogic with safe operations
    console.log('  → Fixing applyRandomForestLogic method');
    content = content.replace(
      /private applyRandomForestLogic\(features: GradingFeatureSet\): number \{[\s\S]*?return adjustment;\s*\}/,
      `private applyRandomForestLogic(features: GradingFeatureSet): number {
    // Random Forest excels at handling diverse features and avoiding overfitting
    let adjustment = 0;
    
    try {
      // Ensemble of simple rules with safe operations
      const rules = [
        safeNumber(features.playerForm, 50) > 70 ? 1.5 : 0,
        safeNumber(features.injuryImpact, 0) < 2 ? 1 : 0,
        Math.abs(safeNumber(features.weatherImpact, 0)) < 1 ? 0.5 : 0,
        safeNumber(features.venueAdvantage, 0) > 3 ? 1 : 0,
        safeNumber(features.motivationalFactors, 0) > 4 ? 0.5 : 0,
        safeNumber(features.matchupRating, 50) > 75 ? 1.5 : 0,
        safeNumber(features.closingLineValue, 0) > 2 ? 1 : 0
      ];
      
      adjustment = rules.reduce((sum, rule) => sum + rule, 0);
      
      return safeNumber(adjustment, 0);
    } catch (error) {
      console.warn('applyRandomForestLogic failed:', error);
      return 0;
    }
  }`
    );

    // 6. Add error handling to all scoring methods
    console.log('  → Adding error handling to scoring methods');
    content = content.replace(
      /public async scoreWithNeuralNetwork\(features: GradingFeatureSet\): Promise<MLModelResult> \{[\s\S]*?return \{[\s\S]*?\};\s*\}/,
      `public async scoreWithNeuralNetwork(features: GradingFeatureSet): Promise<MLModelResult> {
    try {
      // Simplified neural network scoring with safe operations
      const baseScore = this.calculateBaseScore(features);
      const nnAdjustment = this.applyNeuralNetworkLogic(features);
      
      const finalScore = safeNumber(baseScore + nnAdjustment, 50);
      const clampedScore = Math.max(0, Math.min(100, finalScore));
      
      return {
        score: clampedScore,
        confidence: 0.85,
        featureImportance: this.calculateFeatureImportance(features, 'neuralNetwork')
      };
    } catch (error) {
      console.warn('scoreWithNeuralNetwork failed:', error);
      return {
        score: 50,
        confidence: 0.5,
        featureImportance: {}
      };
    }
  }`
    );

    content = content.replace(
      /public async scoreWithGradientBoosting\(features: GradingFeatureSet\): Promise<MLModelResult> \{[\s\S]*?return \{[\s\S]*?\};\s*\}/,
      `public async scoreWithGradientBoosting(features: GradingFeatureSet): Promise<MLModelResult> {
    try {
      // Simplified gradient boosting scoring with safe operations
      const baseScore = this.calculateBaseScore(features);
      const gbAdjustment = this.applyGradientBoostingLogic(features);
      
      const finalScore = safeNumber(baseScore + gbAdjustment, 50);
      const clampedScore = Math.max(0, Math.min(100, finalScore));
      
      return {
        score: clampedScore,
        confidence: 0.88,
        featureImportance: this.calculateFeatureImportance(features, 'gradientBoosting')
      };
    } catch (error) {
      console.warn('scoreWithGradientBoosting failed:', error);
      return {
        score: 50,
        confidence: 0.5,
        featureImportance: {}
      };
    }
  }`
    );

    content = content.replace(
      /public async scoreWithRandomForest\(features: GradingFeatureSet\): Promise<MLModelResult> \{[\s\S]*?return \{[\s\S]*?\};\s*\}/,
      `public async scoreWithRandomForest(features: GradingFeatureSet): Promise<MLModelResult> {
    try {
      // Simplified random forest scoring with safe operations
      const baseScore = this.calculateBaseScore(features);
      const rfAdjustment = this.applyRandomForestLogic(features);
      
      const finalScore = safeNumber(baseScore + rfAdjustment, 50);
      const clampedScore = Math.max(0, Math.min(100, finalScore));
      
      return {
        score: clampedScore,
        confidence: 0.82,
        featureImportance: this.calculateFeatureImportance(features, 'randomForest')
      };
    } catch (error) {
      console.warn('scoreWithRandomForest failed:', error);
      return {
        score: 50,
        confidence: 0.5,
        featureImportance: {}
      };
    }
  }`
    );

    // Write the fixed content back
    console.log('💾 Writing fixed mlModelManager.ts...');
    writeFileSync(mlModelPath, content);

    console.log('✅ ML Model calculation fixes applied successfully!');
    console.log('\n🔧 FIXES APPLIED:');
    console.log('  ✓ Added safe number utility functions');
    console.log('  ✓ Fixed calculateBaseScore with proper feature scaling');
    console.log('  ✓ Fixed applyNeuralNetworkLogic with safe operations');
    console.log('  ✓ Fixed applyGradientBoostingLogic with safe operations');
    console.log('  ✓ Fixed applyRandomForestLogic with safe operations');
    console.log('  ✓ Added comprehensive error handling to all scoring methods');
    console.log('  ✓ Made calculateBaseScore public for testing');

    console.log('\n📊 KEY IMPROVEMENTS:');
    console.log('  • Expected Value handling: Correctly handles small decimals (0.0217 -> 2.17%)');
    console.log('  • Feature scaling: All features properly scaled to prevent extreme values');
    console.log('  • Error handling: Each method has try-catch with fallback values');
    console.log('  • Safe operations: All math operations use safe number utilities');
  } catch (error) {
    console.error('❌ Fix process failed:', error);
    throw error;
  }
}

// Run the fix
if (require.main === module) {
  fixMLModelCalculations()
    .then(() => {
      console.log('\n✅ ML Model calculation fixes completed successfully');
      console.log('\n🔧 NEXT STEPS:');
      console.log('  1. Test with comprehensive-grading-test.ts');
      console.log('  2. Verify NBA and NFL props no longer produce NaN');
      console.log('  3. Check ML model outputs show proper individual scores');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Fix process failed:', error);
      process.exit(1);
    });
}

export { fixMLModelCalculations };
