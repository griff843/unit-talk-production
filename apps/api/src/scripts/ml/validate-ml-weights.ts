#!/usr/bin/env tsx
/**
 * Validate ML-Optimized Weights
 *
 * Validates that ML-optimized weights are properly configured and loadable
 */

import { dynamicWeightLoader } from '../../agents/ScoringAgent/scoring/DynamicWeightLoader';
import * as fs from 'fs';
import * as path from 'path';

console.log('🔍 VALIDATING ML-OPTIMIZED WEIGHTS\n');
console.log('=' .repeat(80));

// Sports to validate
const SPORTS = ['NFL', 'NBA', 'MLB', 'NHL'];

async function validateMLWeights() {
  let hasErrors = false;

  // Check available configs
  console.log('\n📂 Available Weight Configurations:');
  const available = dynamicWeightLoader.getAvailableConfigs();

  if (available.length === 0) {
    console.log('  ⚠️  No ML-optimized weight configurations found');
    console.log('  Run: npm run ml:train-weights to generate optimized weights\n');
    hasErrors = true;
  } else {
    for (const sport of available) {
      console.log(`  ✅ ${sport}`);

      // Load performance metrics
      const metrics = dynamicWeightLoader.getPerformanceMetrics(sport);
      if (metrics) {
        console.log(`     Win Rate: ${metrics.winRate.toFixed(2)}%`);
        console.log(`     Accuracy: ${metrics.accuracy.toFixed(2)}%`);
        console.log(`     Sample Size: ${metrics.sampleSize.toLocaleString()}`);
      }
    }
  }

  // Validate each sport can load weights
  console.log('\n🔬 Weight Loading Validation:');
  for (const sport of SPORTS) {
    try {
      const weights = dynamicWeightLoader.loadWeights(sport);

      // Validate structure
      if (!weights.marketFactors || !weights.playerFactors ||
          !weights.matchupFactors || !weights.priceFactors ||
          !weights.metaFactors) {
        console.log(`  ❌ ${sport}: Missing weight categories`);
        hasErrors = true;
        continue;
      }

      // Validate weight sums
      const categories = {
        market: weights.marketFactors,
        player: weights.playerFactors,
        matchup: weights.matchupFactors,
        price: weights.priceFactors,
        meta: weights.metaFactors
      };

      let categoryErrors = 0;
      for (const [catName, catWeights] of Object.entries(categories)) {
        const sum = Object.values(catWeights).reduce((a, b) => a + b, 0);

        if (Math.abs(sum - 1.0) > 0.01) {
          console.log(`  ⚠️  ${sport}: ${catName} weights sum to ${sum.toFixed(4)} (expected 1.0)`);
          categoryErrors++;
        }
      }

      if (categoryErrors === 0) {
        const source = available.includes(sport) ? 'ML-optimized' : 'Expert defaults';
        console.log(`  ✅ ${sport} (${source})`);
      } else {
        hasErrors = true;
      }
    } catch (error) {
      console.log(`  ❌ ${sport}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      hasErrors = true;
    }
  }

  // Validate config files
  console.log('\n📄 Configuration File Validation:');
  const configDir = path.resolve(__dirname, '../../../../../config/enhanced45-weights');

  if (!fs.existsSync(configDir)) {
    console.log(`  ⚠️  Config directory not found: ${configDir}`);
    hasErrors = true;
  } else {
    const files = fs.readdirSync(configDir).filter(f => f.endsWith('-weights.json'));

    if (files.length === 0) {
      console.log('  ℹ️  No configuration files found (using expert defaults)');
    } else {
      for (const file of files) {
        try {
          const filepath = path.join(configDir, file);
          const content = fs.readFileSync(filepath, 'utf-8');
          const config = JSON.parse(content);

          // Validate JSON structure
          if (!config.sport || !config.version || !config.weights) {
            console.log(`  ❌ ${file}: Invalid structure`);
            hasErrors = true;
            continue;
          }

          // Validate all factor categories exist
          const requiredCategories = ['marketFactors', 'playerFactors', 'matchupFactors', 'priceFactors', 'metaFactors'];
          const missingCategories = requiredCategories.filter(cat => !config.weights[cat]);

          if (missingCategories.length > 0) {
            console.log(`  ❌ ${file}: Missing categories: ${missingCategories.join(', ')}`);
            hasErrors = true;
            continue;
          }

          console.log(`  ✅ ${file}`);
          console.log(`     Sport: ${config.sport}`);
          console.log(`     Version: ${config.version}`);
          if (config.performance) {
            console.log(`     Win Rate: ${config.performance.winRate?.toFixed(2) || 'N/A'}%`);
          }
        } catch (error) {
          console.log(`  ❌ ${file}: ${error instanceof Error ? error.message : 'Parse error'}`);
          hasErrors = true;
        }
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  if (hasErrors) {
    console.log('❌ VALIDATION FAILED - Fix errors above before deploying\n');
    process.exit(1);
  } else {
    console.log('✅ VALIDATION PASSED - Weights ready for production\n');

    console.log('Next Steps:');
    console.log('1. Monitor Enhanced45FactorEngine logs for weight loading');
    console.log('2. Compare performance vs baseline expert weights');
    console.log('3. Retrain monthly as new data accumulates\n');

    process.exit(0);
  }
}

// Run validation
validateMLWeights();
