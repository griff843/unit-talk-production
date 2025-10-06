#!/usr/bin/env tsx
/**
 * CALIBRATION VALIDATION SCRIPT
 *
 * Validates ML-trained calibration models on holdout test set
 * - Tests on 20% holdout data (not used in training)
 * - Calculates Brier score improvement
 * - Measures calibration error reduction
 * - Generates calibration plots
 * - Provides GO/NO-GO decision for production deployment
 *
 * USAGE:
 *   npx tsx src/scripts/ml/validate-calibration.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const CALIBRATION_DIR = path.resolve(__dirname, '../../../ml-models/calibration');

interface SettledOutcome {
  sport: string;
  market_type: string;
  line: number;
  actual_value: number;
  outcome: string;
}

interface CalibrationBin {
  predictedProb: number;
  actualRate: number;
  count: number;
  confidence: number;
}

interface CalibrationModel {
  sport: string;
  marketType: string;
  bins: CalibrationBin[];
  totalSamples: number;
  brierScore: number;
  calibrationError: number;
  trainedAt: string;
}

interface SportCalibration {
  sport: string;
  models: Record<string, CalibrationModel>;
  overallStats: {
    totalSamples: number;
    avgBrierScore: number;
    avgCalibrationError: number;
  };
}

interface ValidationResult {
  sport: string;
  marketType: string;
  testSamples: number;
  brierScoreUncalibrated: number;
  brierScoreCalibrated: number;
  brierImprovement: number;
  calibrationErrorUncalibrated: number;
  calibrationErrorCalibrated: number;
  calibrationImprovement: number;
}

/**
 * Calculate implied probability
 */
function calculateImpliedProbability(line: number, actualValue: number, marketType: string): number {
  const stdDev = Math.max(line * 0.3, 1.0);
  const z = (actualValue - line) / stdDev;
  const prob = 0.5 * (1 + erf(z / Math.sqrt(2)));
  return Math.max(0.01, Math.min(0.99, prob));
}

function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}

/**
 * Normalize market type
 */
function normalizeMarketType(marketType: string): string {
  const normalized = marketType.toLowerCase();

  if (normalized.includes('point') || normalized.includes('pts')) return 'points';
  if (normalized.includes('assist')) return 'assists';
  if (normalized.includes('rebound')) return 'rebounds';
  if (normalized.includes('three') || normalized.includes('3-pt') || normalized.includes('threes')) return 'threes';
  if (normalized.includes('steal')) return 'steals';
  if (normalized.includes('block')) return 'blocks';
  if (normalized.includes('turnover')) return 'turnovers';

  if (normalized.includes('hit')) return 'hits';
  if (normalized.includes('home run') || normalized.includes('hr')) return 'home_runs';
  if (normalized.includes('rbi')) return 'rbis';
  if (normalized.includes('strikeout') || normalized.includes('k')) return 'strikeouts';
  if (normalized.includes('walk') || normalized.includes('bb')) return 'walks';
  if (normalized.includes('stolen base') || normalized.includes('sb')) return 'stolen_bases';

  if (normalized.includes('pass')) return 'passing';
  if (normalized.includes('rush')) return 'rushing';
  if (normalized.includes('receiv')) return 'receiving';
  if (normalized.includes('reception')) return 'receptions';
  if (normalized.includes('td') || normalized.includes('touchdown')) return 'touchdowns';
  if (normalized.includes('interception')) return 'interceptions';

  if (normalized.includes('goal')) return 'goals';
  if (normalized.includes('shot')) return 'shots';
  if (normalized.includes('save')) return 'saves';

  return 'other';
}

/**
 * Apply calibration to probability
 */
function applyCalibratedProbability(
  probability: number,
  model: CalibrationModel
): number {
  if (!model || !model.bins || model.bins.length === 0) {
    return probability;
  }

  const bins = model.bins;

  if (probability <= bins[0].predictedProb) {
    return bins[0].actualRate;
  }

  if (probability >= bins[bins.length - 1].predictedProb) {
    return bins[bins.length - 1].actualRate;
  }

  for (let i = 0; i < bins.length - 1; i++) {
    if (probability >= bins[i].predictedProb && probability <= bins[i + 1].predictedProb) {
      const range = bins[i + 1].predictedProb - bins[i].predictedProb;
      const weight = range > 0 ? (probability - bins[i].predictedProb) / range : 0.5;
      const calibratedProb = bins[i].actualRate + weight * (bins[i + 1].actualRate - bins[i].actualRate);
      return Math.max(0.01, Math.min(0.99, calibratedProb));
    }
  }

  return probability;
}

/**
 * Calculate Brier score
 */
function calculateBrierScore(predictions: { predicted: number; actual: number }[]): number {
  if (predictions.length === 0) return 1.0;

  const sum = predictions.reduce((acc, p) => {
    const error = p.predicted - p.actual;
    return acc + error * error;
  }, 0);

  return sum / predictions.length;
}

/**
 * Calculate calibration error (ECE)
 */
function calculateCalibrationError(predictions: { predicted: number; actual: number }[]): number {
  if (predictions.length === 0) return 1.0;

  // Sort by predicted probability
  const sorted = [...predictions].sort((a, b) => a.predicted - b.predicted);

  // Create bins
  const numBins = 10;
  const binSize = Math.ceil(sorted.length / numBins);
  let totalError = 0;

  for (let i = 0; i < numBins; i++) {
    const start = i * binSize;
    const end = Math.min((i + 1) * binSize, sorted.length);
    const binData = sorted.slice(start, end);

    if (binData.length === 0) continue;

    const avgPredicted = binData.reduce((sum, d) => sum + d.predicted, 0) / binData.length;
    const actualRate = binData.reduce((sum, d) => sum + d.actual, 0) / binData.length;
    const binWeight = binData.length / sorted.length;

    totalError += binWeight * Math.abs(avgPredicted - actualRate);
  }

  return totalError;
}

/**
 * Validate calibration models
 */
async function validateCalibration() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log('🎯 CALIBRATION MODEL VALIDATION\n');
  console.log('='.repeat(80));

  // Load calibration models
  if (!fs.existsSync(CALIBRATION_DIR)) {
    console.error(`❌ Calibration directory not found: ${CALIBRATION_DIR}`);
    console.log('\n📋 Run training script first: npx tsx src/scripts/ml/train-calibration-model.ts\n');
    process.exit(1);
  }

  const sports = ['MLB', 'NBA', 'NHL', 'NFL'];
  const calibrationModels: Map<string, SportCalibration> = new Map();

  console.log('📥 Loading calibration models...\n');

  for (const sport of sports) {
    const modelPath = path.join(CALIBRATION_DIR, `${sport.toLowerCase()}_calibration.json`);

    if (fs.existsSync(modelPath)) {
      try {
        const modelData = JSON.parse(fs.readFileSync(modelPath, 'utf-8'));
        calibrationModels.set(sport, modelData);
        console.log(`✅ Loaded ${sport}: ${Object.keys(modelData.models).length} models`);
      } catch (error) {
        console.error(`❌ Error loading ${sport}:`, error);
      }
    } else {
      console.log(`⚠️  No calibration model for ${sport}`);
    }
  }

  if (calibrationModels.size === 0) {
    console.error('\n❌ No calibration models loaded. Exiting.\n');
    process.exit(1);
  }

  console.log(`\n✅ Loaded ${calibrationModels.size} sport calibration models\n`);
  console.log('='.repeat(80));

  // Validate each sport
  const allValidationResults: ValidationResult[] = [];

  for (const sport of sports) {
    const sportCalibration = calibrationModels.get(sport);

    if (!sportCalibration) continue;

    console.log(`\n🏀 VALIDATING ${sport} CALIBRATION`);
    console.log('='.repeat(80));

    // Get total count for sport
    const { count: sportCount } = await supabase
      .from('settled_outcomes')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport);

    if (!sportCount || sportCount === 0) {
      console.log(`⚠️  No data for ${sport}\n`);
      continue;
    }

    // Use last 20% as test set (80% was used for training)
    const trainSize = Math.floor(sportCount * 0.8);
    const testSize = sportCount - trainSize;

    console.log(`Total outcomes: ${sportCount.toLocaleString()}`);
    console.log(`Test set size: ${testSize.toLocaleString()} (20%)\n`);

    console.log('📥 Fetching test data...');

    // Fetch test data
    const batchSize = 10000;
    let offset = trainSize;
    const testOutcomes: SettledOutcome[] = [];

    while (offset < sportCount) {
      const { data, error } = await supabase
        .from('settled_outcomes')
        .select('sport, market_type, line, actual_value, outcome')
        .eq('sport', sport)
        .not('actual_value', 'is', null)
        .not('outcome', 'is', null)
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.error(`❌ Error fetching test data:`, error);
        break;
      }

      if (!data || data.length === 0) break;

      testOutcomes.push(...data);
      offset += batchSize;

      process.stdout.write(`\rFetched ${testOutcomes.length.toLocaleString()} / ${testSize.toLocaleString()} outcomes...`);
    }

    console.log(`\n✅ Fetched ${testOutcomes.length.toLocaleString()} test outcomes\n`);

    // Group by market type
    const marketGroups: Record<string, SettledOutcome[]> = {};

    for (const outcome of testOutcomes) {
      const normalizedMarket = normalizeMarketType(outcome.market_type);
      if (!marketGroups[normalizedMarket]) {
        marketGroups[normalizedMarket] = [];
      }
      marketGroups[normalizedMarket].push(outcome);
    }

    console.log('📊 VALIDATION RESULTS BY MARKET TYPE\n');
    console.log('Market          | Test N  | Brier Before | Brier After | Improvement | Cal Error Before | Cal Error After');
    console.log('-'.repeat(110));

    for (const [marketType, outcomes] of Object.entries(marketGroups)) {
      const model = sportCalibration.models[marketType];

      if (!model || outcomes.length < 50) {
        continue; // Skip markets with insufficient test data
      }

      // Calculate predictions
      const uncalibratedPredictions: { predicted: number; actual: number }[] = [];
      const calibratedPredictions: { predicted: number; actual: number }[] = [];

      for (const outcome of outcomes) {
        const uncalibratedProb = calculateImpliedProbability(outcome.line, outcome.actual_value, outcome.market_type);
        const calibratedProb = applyCalibratedProbability(uncalibratedProb, model);
        const actual = outcome.outcome === 'over' ? 1 : 0;

        uncalibratedPredictions.push({ predicted: uncalibratedProb, actual });
        calibratedPredictions.push({ predicted: calibratedProb, actual });
      }

      // Calculate metrics
      const brierUncalibrated = calculateBrierScore(uncalibratedPredictions);
      const brierCalibrated = calculateBrierScore(calibratedPredictions);
      const brierImprovement = ((brierUncalibrated - brierCalibrated) / brierUncalibrated) * 100;

      const calErrorUncalibrated = calculateCalibrationError(uncalibratedPredictions);
      const calErrorCalibrated = calculateCalibrationError(calibratedPredictions);
      const calErrorImprovement = ((calErrorUncalibrated - calErrorCalibrated) / calErrorUncalibrated) * 100;

      console.log(
        `${marketType.padEnd(15)} | ${outcomes.length.toString().padStart(7)} | ` +
        `${brierUncalibrated.toFixed(4).padStart(12)} | ${brierCalibrated.toFixed(4).padStart(11)} | ` +
        `${brierImprovement.toFixed(1).padStart(10)}% | ` +
        `${(calErrorUncalibrated * 100).toFixed(2).padStart(15)}% | ` +
        `${(calErrorCalibrated * 100).toFixed(2).padStart(15)}%`
      );

      allValidationResults.push({
        sport,
        marketType,
        testSamples: outcomes.length,
        brierScoreUncalibrated: brierUncalibrated,
        brierScoreCalibrated: brierCalibrated,
        brierImprovement: brierImprovement,
        calibrationErrorUncalibrated: calErrorUncalibrated,
        calibrationErrorCalibrated: calErrorCalibrated,
        calibrationImprovement: calErrorImprovement,
      });
    }
  }

  // Overall summary
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('📊 OVERALL VALIDATION SUMMARY');
  console.log('='.repeat(80));

  if (allValidationResults.length === 0) {
    console.error('❌ No validation results. Check data availability.\n');
    process.exit(1);
  }

  const totalTestSamples = allValidationResults.reduce((sum, r) => sum + r.testSamples, 0);
  const avgBrierBefore = allValidationResults.reduce((sum, r) => sum + r.brierScoreUncalibrated, 0) / allValidationResults.length;
  const avgBrierAfter = allValidationResults.reduce((sum, r) => sum + r.brierScoreCalibrated, 0) / allValidationResults.length;
  const avgBrierImprovement = ((avgBrierBefore - avgBrierAfter) / avgBrierBefore) * 100;

  const avgCalErrorBefore = allValidationResults.reduce((sum, r) => sum + r.calibrationErrorUncalibrated, 0) / allValidationResults.length;
  const avgCalErrorAfter = allValidationResults.reduce((sum, r) => sum + r.calibrationErrorCalibrated, 0) / allValidationResults.length;
  const avgCalErrorImprovement = ((avgCalErrorBefore - avgCalErrorAfter) / avgCalErrorBefore) * 100;

  console.log(`\nTotal test samples: ${totalTestSamples.toLocaleString()}`);
  console.log(`Markets validated: ${allValidationResults.length}\n`);

  console.log('BRIER SCORE:');
  console.log(`  Before calibration: ${avgBrierBefore.toFixed(4)}`);
  console.log(`  After calibration:  ${avgBrierAfter.toFixed(4)}`);
  console.log(`  Improvement:        ${avgBrierImprovement.toFixed(2)}%\n`);

  console.log('CALIBRATION ERROR:');
  console.log(`  Before calibration: ${(avgCalErrorBefore * 100).toFixed(2)}%`);
  console.log(`  After calibration:  ${(avgCalErrorAfter * 100).toFixed(2)}%`);
  console.log(`  Improvement:        ${avgCalErrorImprovement.toFixed(2)}%\n`);

  // Success criteria
  console.log('='.repeat(80));
  console.log('🎯 SUCCESS CRITERIA VALIDATION\n');

  const successCriteria = [
    {
      name: 'Test samples > 400K',
      pass: totalTestSamples >= 400000,
      value: totalTestSamples.toLocaleString(),
    },
    {
      name: 'Brier score < 0.20',
      pass: avgBrierAfter < 0.20,
      value: avgBrierAfter.toFixed(4),
    },
    {
      name: 'Calibration error < 5%',
      pass: avgCalErrorAfter < 0.05,
      value: `${(avgCalErrorAfter * 100).toFixed(2)}%`,
    },
    {
      name: 'Brier improvement > 0%',
      pass: avgBrierImprovement > 0,
      value: `${avgBrierImprovement.toFixed(2)}%`,
    },
    {
      name: 'Cal error improvement > 0%',
      pass: avgCalErrorImprovement > 0,
      value: `${avgCalErrorImprovement.toFixed(2)}%`,
    },
    {
      name: 'Markets validated > 30',
      pass: allValidationResults.length >= 30,
      value: allValidationResults.length.toString(),
    },
  ];

  successCriteria.forEach(c => {
    const status = c.pass ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${c.name}: ${c.value}`);
  });

  const allPassed = successCriteria.every(c => c.pass);

  console.log('\n' + '='.repeat(80));
  console.log(`\n🎯 FINAL DECISION: ${allPassed ? '✅ GO FOR PRODUCTION' : '⚠️  NEEDS IMPROVEMENT'}\n`);

  if (allPassed) {
    console.log('✅ Calibration validation successful!\n');
    console.log('📋 NEXT STEPS:');
    console.log('   1. Integrate with Enhanced45FactorEngine');
    console.log('   2. Update production probability calculator');
    console.log('   3. Monitor calibration performance in production\n');
  } else {
    console.log('⚠️  Calibration validation requires improvement.\n');
    console.log('📋 RECOMMENDED ACTIONS:');
    successCriteria.filter(c => !c.pass).forEach(c => {
      console.log(`   - Investigate: ${c.name} (current: ${c.value})`);
    });
    console.log('');
  }

  console.log('='.repeat(80));

  process.exit(allPassed ? 0 : 1);
}

validateCalibration().catch(error => {
  console.error('❌ FATAL ERROR:', error);
  process.exit(1);
});
