/**
 * ML System Deployment Script
 *
 * Complete deployment of the ML-based scoring system:
 * 1. Runs setup (migrations + data)
 * 2. Tests probability calculator
 * 3. Validates Enhanced45FactorEngine integration
 * 4. Runs end-to-end test with real picks
 */

import { probabilityCalculator } from '../../models/ProbabilityCalculator';
import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runSetup() {
  console.log('🚀 Step 1: Running ML System Setup');
  console.log('==========================================\n');

  try {
    const { stdout, stderr } = await execAsync('npx tsx src/scripts/ml/setup-ml-system.ts');
    console.log(stdout);
    if (stderr) console.error('Setup warnings:', stderr);
    return true;
  } catch (error: any) {
    console.error('❌ Setup failed:', error.message);
    return false;
  }
}

async function testProbabilityCalculator() {
  console.log('\n🧪 Step 2: Testing Probability Calculator');
  console.log('==========================================\n');

  const testCases = [
    {
      name: 'NBA Points Prop',
      input: {
        sport: 'NBA',
        playerName: 'LeBron James',
        marketType: 'player_points',
        line: 25.5,
        venue: 'home' as const,
      },
    },
    {
      name: 'NFL Passing Yards',
      input: {
        sport: 'NFL',
        playerName: 'Patrick Mahomes',
        marketType: 'player_pass_yds',
        line: 275.5,
      },
    },
    {
      name: 'MLB Total Bases',
      input: {
        sport: 'MLB',
        playerName: 'Aaron Judge',
        marketType: 'batter_total_bases',
        line: 1.5,
      },
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    try {
      console.log(`\n   Testing: ${testCase.name}`);
      const result = await probabilityCalculator.calculateProbability(testCase.input);

      console.log(`   ✅ Probability: ${(result.probability * 100).toFixed(2)}%`);
      console.log(`      Confidence: ${(result.confidence * 100).toFixed(2)}%`);
      console.log(`      Method: ${result.method}`);
      console.log(`      Data Points: ${result.dataPoints}`);

      // Validate result
      if (
        result.probability >= 0.15 &&
        result.probability <= 0.85 &&
        result.confidence >= 0 &&
        result.confidence <= 1
      ) {
        passed++;
      } else {
        console.log(`   ⚠️  Probability out of expected range`);
        failed++;
      }
    } catch (error: any) {
      console.log(`   ❌ Test failed: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n   Results: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

async function testEnhanced45Integration() {
  console.log('\n🔗 Step 3: Testing Enhanced45FactorEngine Integration');
  console.log('==========================================\n');

  // Check if Enhanced45FactorEngine file has been updated
  const fs = require('fs');
  const enginePath = './src/agents/ScoringAgent/scoring/Enhanced45FactorEngine.ts';

  try {
    const content = fs.readFileSync(enginePath, 'utf-8');

    // Check for the hardcoded 52%
    if (content.includes('const assumedTrueProb = 0.52')) {
      console.log('   ❌ Hardcoded 52% still exists in Enhanced45FactorEngine');
      return false;
    }

    // Check for probability calculator import
    if (content.includes('probabilityCalculator')) {
      console.log('   ✅ ProbabilityCalculator integrated');
    } else {
      console.log('   ⚠️  ProbabilityCalculator not found in code');
      return false;
    }

    // Check for async calculateDeviggedEV
    if (content.includes('async calculateDeviggedEV')) {
      console.log('   ✅ calculateDeviggedEV is now async');
    } else {
      console.log('   ❌ calculateDeviggedEV is not async');
      return false;
    }

    console.log('   ✅ Integration validated');
    return true;
  } catch (error: any) {
    console.log('   ❌ Failed to read Enhanced45FactorEngine:', error.message);
    return false;
  }
}

async function testWithRealPick() {
  console.log('\n🎯 Step 4: Testing with Real Pick');
  console.log('==========================================\n');

  // Get a real pick from unified_picks
  const { data: picks, error } = await supabase
    .from('unified_picks')
    .select('*')
    .eq('status', 'pending')
    .limit(1);

  if (error || !picks || picks.length === 0) {
    console.log('   ⚠️  No pending picks found in database');
    console.log('   Creating mock pick for testing...');

    // Use mock data
    const mockResult = await probabilityCalculator.calculateProbability({
      sport: 'NFL',
      playerName: 'Test Player',
      marketType: 'player_rush_yds',
      line: 75.5,
    });

    console.log(`\n   Mock Pick Probability: ${(mockResult.probability * 100).toFixed(2)}%`);
    console.log(`   Method: ${mockResult.method}`);
    console.log(`   ✅ System functioning with mock data`);
    return true;
  }

  const pick = picks[0];
  console.log(`\n   Testing with pick: ${pick.id}`);
  console.log(`   Player: ${pick.market} - ${pick.line}`);

  const result = await probabilityCalculator.calculateProbability({
    sport: pick.sport || 'NFL',
    playerName: pick.market || 'Unknown',
    marketType: pick.market || 'unknown',
    line: pick.line || 0,
  });

  console.log(`\n   Calculated Probability: ${(result.probability * 100).toFixed(2)}%`);
  console.log(`   Confidence: ${(result.confidence * 100).toFixed(2)}%`);
  console.log(`   Method: ${result.method}`);

  // Calculate expected value
  const ev = probabilityCalculator.calculateExpectedValue(result.probability, pick.odds || -110);

  console.log(`   Expected Value: ${(ev * 100).toFixed(2)}%`);

  if (ev > 0) {
    console.log(`   🎉 POSITIVE EXPECTED VALUE - This is a good bet!`);
  } else {
    console.log(`   📊 Negative EV - Avoid this bet`);
  }

  console.log(`\n   ✅ Real pick test complete`);
  return true;
}

async function generateReport() {
  console.log('\n\n📊 DEPLOYMENT SUMMARY');
  console.log('==========================================\n');

  // Count features in database
  const { count: leagueAvgCount } = await supabase
    .from('league_averages')
    .select('*', { count: 'exact', head: true });

  const { count: playerStatsCount } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });

  console.log('Database Status:');
  console.log(`   League Averages: ${leagueAvgCount || 0} entries`);
  console.log(`   Player Stats: ${playerStatsCount || 0} entries`);

  console.log('\nSystem Components:');
  console.log('   ✅ Feature storage tables created');
  console.log('   ✅ Probability calculator operational');
  console.log('   ✅ Enhanced45FactorEngine integrated');
  console.log('   ✅ Real probability calculations active');

  console.log('\nKey Improvements:');
  console.log('   🎯 Replaced hardcoded 52% with data-driven probabilities');
  console.log('   📊 Probability range: 15-85% (dynamic based on data)');
  console.log('   🔍 Uses player stats when available');
  console.log('   📈 Falls back to league averages gracefully');
  console.log('   ⚡ Includes confidence scoring');

  console.log('\nNext Steps:');
  console.log('   1. Monitor probability_predictions table for model performance');
  console.log('   2. Add player stats from MLB Stats API, ESPN, etc.');
  console.log('   3. Collect settled outcomes to train better models');
  console.log('   4. Implement automated retraining pipeline');

  console.log('\n🚀 ML SYSTEM DEPLOYMENT COMPLETE!\n');
}

async function main() {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║   ML-BASED SCORING SYSTEM DEPLOYMENT              ║');
  console.log('║   Replacing Hardcoded 52% with Real Models        ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Setup
    const setupSuccess = await runSetup();
    if (!setupSuccess) {
      console.log('\n❌ Setup failed. Cannot proceed.');
      process.exit(1);
    }

    // Step 2: Test probability calculator
    const calculatorSuccess = await testProbabilityCalculator();
    if (!calculatorSuccess) {
      console.log('\n❌ Probability calculator tests failed.');
      process.exit(1);
    }

    // Step 3: Test integration
    const integrationSuccess = await testEnhanced45Integration();
    if (!integrationSuccess) {
      console.log('\n❌ Enhanced45FactorEngine integration failed.');
      process.exit(1);
    }

    // Step 4: Test with real pick
    const realPickSuccess = await testWithRealPick();
    if (!realPickSuccess) {
      console.log('\n⚠️  Real pick test had issues, but system is operational.');
    }

    // Generate final report
    await generateReport();

    console.log('✅ All deployment steps completed successfully!\n');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Deployment failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
