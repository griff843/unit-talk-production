#!/usr/bin/env tsx
/**
 * FINAL SETTLEMENT DATA VALIDATION FOR TIER 1 ML TRAINING
 * 
 * Validates settlement quality and provides GO/NO-GO decision
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function finalValidation() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log('🎯 TIER 1 SETTLEMENT DATA VALIDATION\n');
  console.log('='.repeat(80));

  // Total count
  const { count: totalCount } = await supabase
    .from('settled_outcomes')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📊 OVERALL STATISTICS`);
  console.log('-'.repeat(80));
  console.log(`Total Outcomes: ${(totalCount || 0).toLocaleString()}`);

  // Check each sport
  const sports = ['MLB', 'NFL', 'NBA', 'NHL'];
  const sportStats: any[] = [];

  console.log(`\n🏈 SPORT-BY-SPORT BREAKDOWN`);
  console.log('-'.repeat(80));
  console.log('Sport      | Total       | Settlement Rate | Avg Actual | Date Range');
  console.log('-'.repeat(80));

  for (const sport of sports) {
    // Total for sport
    const { count: sportTotal } = await supabase
      .from('settled_outcomes')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport);

    // Sample actual values (get first 100 to check)
    const { data: samples } = await supabase
      .from('settled_outcomes')
      .select('actual_value, game_date')
      .eq('sport', sport)
      .limit(100);

    const validSamples = samples?.filter(s => s.actual_value !== null && s.actual_value !== undefined) || [];
    const avgActual = validSamples.length > 0 
      ? (validSamples.reduce((sum, s) => sum + s.actual_value, 0) / validSamples.length).toFixed(2)
      : 'N/A';

    const settlementRate = samples && sportTotal 
      ? ((validSamples.length / samples.length) * 100).toFixed(1)
      : '0.0';

    // Get date range
    const dates = samples?.map(s => s.game_date).filter(d => d).sort() || [];
    const dateRange = dates.length > 0 
      ? `${dates[0]} to ${dates[dates.length - 1]}`
      : 'N/A';

    console.log(
      `${sport.padEnd(10)} | ${(sportTotal || 0).toLocaleString().padStart(11)} | ${settlementRate.padStart(6)}% ` +
      `| ${avgActual.toString().padStart(10)} | ${dateRange}`
    );

    sportStats.push({
      sport,
      total: sportTotal || 0,
      settlementRate: parseFloat(settlementRate),
      avgActual,
      sampleSize: samples?.length || 0,
      validSamples: validSamples.length
    });
  }

  // Overall settlement quality
  console.log(`\n📈 SETTLEMENT QUALITY ANALYSIS`);
  console.log('-'.repeat(80));

  const totalValidSamples = sportStats.reduce((sum, s) => sum + s.validSamples, 0);
  const totalSamples = sportStats.reduce((sum, s) => sum + s.sampleSize, 0);
  const overallSettlementRate = totalSamples > 0 
    ? ((totalValidSamples / totalSamples) * 100).toFixed(2)
    : '0.00';

  console.log(`Sample Size:        ${totalSamples} records analyzed`);
  console.log(`Valid Settlements:  ${totalValidSamples} records with actual_value`);
  console.log(`Settlement Rate:    ${overallSettlementRate}%`);

  // Sample data quality
  console.log(`\n📋 SAMPLE DATA QUALITY (20 records per sport)`);
  console.log('-'.repeat(100));

  for (const sport of ['NBA', 'NFL']) { // Start with sports we know have data
    const { data: samples } = await supabase
      .from('settled_outcomes')
      .select('player_name, market_type, line, actual_value, outcome, game_date')
      .eq('sport', sport)
      .limit(5);

    console.log(`\n${sport}:`);
    console.log('-'.repeat(100));
    console.log('Player              | Market Type          | Line  | Actual | Outcome | Date');
    console.log('-'.repeat(100));

    samples?.forEach(s => {
      console.log(
        `${(s.player_name || 'Unknown').substring(0, 19).padEnd(19)} | ` +
        `${(s.market_type || 'Unknown').substring(0, 20).padEnd(20)} | ` +
        `${(s.line?.toFixed(1) || 'N/A').padStart(5)} | ` +
        `${(s.actual_value?.toFixed(1) || 'NULL').padStart(6)} | ` +
        `${(s.outcome || 'N/A').padEnd(7)} | ` +
        `${s.game_date || 'N/A'}`
      );
    });
  }

  // Validation checks
  console.log(`\n\n🚦 TIER 1 VALIDATION CHECKLIST`);
  console.log('='.repeat(80));

  const checks = [
    {
      name: 'Total outcomes > 1M',
      pass: (totalCount || 0) >= 1000000,
      value: (totalCount || 0).toLocaleString()
    },
    {
      name: 'Multi-sport coverage (≥3)',
      pass: sportStats.filter(s => s.total > 0).length >= 3,
      value: sportStats.filter(s => s.total > 0).length.toString()
    },
    {
      name: 'Settlement rate ≥ 95%',
      pass: parseFloat(overallSettlementRate) >= 95,
      value: `${overallSettlementRate}%`
    },
    {
      name: 'NBA data present',
      pass: sportStats.find(s => s.sport === 'NBA')?.total || 0 > 100000,
      value: sportStats.find(s => s.sport === 'NBA')?.total.toLocaleString() || '0'
    },
    {
      name: 'NFL data present',
      pass: sportStats.find(s => s.sport === 'NFL')?.total || 0 > 10000,
      value: sportStats.find(s => s.sport === 'NFL')?.total.toLocaleString() || '0'
    },
    {
      name: 'MLB data present',
      pass: sportStats.find(s => s.sport === 'MLB')?.total || 0 > 100000,
      value: sportStats.find(s => s.sport === 'MLB')?.total.toLocaleString() || '0'
    }
  ];

  checks.forEach(check => {
    const status = check.pass ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${check.name}: ${check.value}`);
  });

  const allPassed = checks.every(c => c.pass);

  console.log('\n' + '='.repeat(80));
  console.log(`\n🎯 FINAL DECISION: ${allPassed ? '✅ GO FOR TIER 1 ML TRAINING' : '⚠️  INVESTIGATE DATA QUALITY'}\n`);

  if (allPassed) {
    console.log('✅ Settlement data validated. Ready for ML integration.');
    console.log('\n📋 NEXT STEPS:');
    console.log('   1. Configure ML training pipeline');
    console.log('   2. Feature engineering setup');
    console.log('   3. Train initial models');
    console.log('   4. Validate model performance\n');
  } else {
    console.log('⚠️  Settlement data quality requires investigation.');
    console.log('\n📋 REQUIRED ACTIONS:');
    checks.filter(c => !c.pass).forEach(c => {
      console.log(`   - Fix: ${c.name} (current: ${c.value})`);
    });
    console.log('');
  }

  console.log('='.repeat(80));

  process.exit(allPassed ? 0 : 1);
}

finalValidation().catch(console.error);
