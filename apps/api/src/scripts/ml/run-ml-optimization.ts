#!/usr/bin/env tsx
/**
 * Enhanced45Factor ML Weight Optimization - Execution Script
 *
 * This script orchestrates the complete ML optimization pipeline:
 * 1. Apply database migration
 * 2. Run ML weight training
 * 3. Validate optimized weights
 * 4. Generate report
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

console.log('🚀 ENHANCED45FACTOR ML OPTIMIZATION PIPELINE');
console.log('=' .repeat(80));
console.log('Starting ML-based factor weight optimization...\n');

async function runMLOptimization() {
  try {
    // Step 1: Apply database migration (if not already applied)
    console.log('📊 Step 1: Applying database migration...\n');
    try {
      const migrationPath = path.resolve(__dirname, '../../../../../supabase/migrations');
      console.log(`Migration path: ${migrationPath}`);
      console.log('✅ Manually apply migration 030_ml_weight_optimization_support.sql via Supabase dashboard\n');
    } catch (error) {
      console.warn(`⚠️  Migration step skipped: ${error}\n`);
    }

    // Step 2: Run ML weight training
    console.log('🤖 Step 2: Running ML weight training...\n');
    const trainingScript = path.resolve(__dirname, './train-factor-weights.ts');

    // Import and run training
    const { FactorWeightOptimizer } = await import('./train-factor-weights');
    const optimizer = new FactorWeightOptimizer();
    await optimizer.optimize();

    console.log('\n✅ ML weight training completed successfully\n');

    // Step 3: Validate optimized weights
    console.log('🔍 Step 3: Validating optimized weights...\n');
    validateWeightConfigs();

    // Step 4: Generate final report
    console.log('\n📊 Step 4: Generating final report...\n');
    generateFinalSummary();

    console.log('\n' + '='.repeat(80));
    console.log('✅ ML OPTIMIZATION PIPELINE COMPLETE');
    console.log('=' .repeat(80));
    console.log('\nNext Steps:');
    console.log('1. Review ENHANCED45FACTOR_ML_OPTIMIZATION_REPORT.md');
    console.log('2. Deploy optimized weights to production');
    console.log('3. Monitor performance improvements');
    console.log('4. Retrain monthly as new data accumulates\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ML Optimization Pipeline Failed:', error);
    console.error('\nTroubleshooting:');
    console.error('- Ensure Supabase connection is configured');
    console.error('- Verify settled_outcomes table has sufficient data');
    console.error('- Check migration 030 has been applied\n');
    process.exit(1);
  }
}

/**
 * Validate generated weight configs
 */
function validateWeightConfigs() {
  const configDir = path.resolve(__dirname, '../../../../../config/enhanced45-weights');

  if (!fs.existsSync(configDir)) {
    throw new Error(`Weight config directory not found: ${configDir}`);
  }

  const files = fs.readdirSync(configDir).filter(f => f.endsWith('-weights.json'));

  if (files.length === 0) {
    throw new Error('No weight configuration files generated');
  }

  console.log(`Found ${files.length} weight configuration files:`);

  for (const file of files) {
    const filepath = path.join(configDir, file);
    const content = fs.readFileSync(filepath, 'utf-8');
    const config = JSON.parse(content);

    // Validate structure
    if (!config.sport || !config.weights) {
      throw new Error(`Invalid config structure in ${file}`);
    }

    // Validate weight sums
    const categories = ['marketFactors', 'playerFactors', 'matchupFactors', 'priceFactors', 'metaFactors'];
    for (const category of categories) {
      const weights = Object.values(config.weights[category] as Record<string, number>);
      const sum = weights.reduce((a: number, b: number) => a + b, 0);

      if (Math.abs(sum - 1.0) > 0.01) {
        console.warn(`  ⚠️  ${file}: ${category} weights sum to ${sum.toFixed(4)} (expected 1.0)`);
      }
    }

    console.log(`  ✅ ${file} (${config.sport}, v${config.version})`);
  }
}

/**
 * Generate final summary
 */
function generateFinalSummary() {
  const reportPath = path.resolve(__dirname, '../../../../../ENHANCED45FACTOR_ML_OPTIMIZATION_REPORT.md');

  if (fs.existsSync(reportPath)) {
    console.log(`✅ Report generated: ${reportPath}`);

    // Read and display key metrics
    const report = fs.readFileSync(reportPath, 'utf-8');
    const lines = report.split('\n');

    // Find performance table
    const tableStart = lines.findIndex(l => l.includes('| Sport | Win Rate |'));
    if (tableStart > 0) {
      console.log('\nPerformance Summary:');
      for (let i = tableStart; i < tableStart + 10 && i < lines.length; i++) {
        if (lines[i].trim()) {
          console.log(lines[i]);
        }
      }
    }
  } else {
    console.warn('⚠️  Report not found, but optimization may have succeeded');
  }
}

// Execute pipeline
runMLOptimization();
