#!/usr/bin/env tsx
/**
 * Settlement Data Quality Validation for Tier 1 ML Training
 *
 * MISSION: Validate settlement data in Supabase to confirm >95% settlement rate
 *
 * Checks:
 * 1. Total outcomes count
 * 2. Settlement rate (actual_value NOT NULL)
 * 3. Multi-sport coverage
 * 4. Date ranges per sport
 * 5. Data quality (actual_value distribution)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from root .env
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface SettlementStats {
  total_count: number;
  settled_count: number;
  settlement_rate: number;
}

interface SportBreakdown {
  sport: string;
  total: number;
  settled: number;
  rate: number;
  earliest_date: string;
  latest_date: string;
  avg_actual_value: number;
  sample_count: number;
}

interface SampleRecord {
  id: string;
  prop_id: string;
  sport: string;
  player_name: string;
  market_type: string;
  line: number;
  actual_value: number | null;
  outcome: string;
  game_date: string;
}

async function validateSettlementQuality() {
  console.log('🔍 SETTLEMENT DATA QUALITY VALIDATION\n');
  console.log('=' .repeat(80));

  // Initialize Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log('\n📊 STEP 1: Overall Settlement Statistics');
  console.log('-'.repeat(80));

  // Get total count
  const { count: totalCount, error: totalError } = await supabase
    .from('settled_outcomes')
    .select('*', { count: 'exact', head: true });

  if (totalError) {
    console.error('❌ Error fetching total count:', totalError);
    process.exit(1);
  }

  // Get settled count (actual_value NOT NULL)
  // Note: We'll filter out -1 values in the quality check section
  const { count: settledCount, error: settledError } = await supabase
    .from('settled_outcomes')
    .select('*', { count: 'exact', head: true })
    .not('actual_value', 'is', null);

  if (settledError) {
    console.error('❌ Error fetching settled count:', settledError);
    process.exit(1);
  }

  const total = totalCount || 0;
  const settled = settledCount || 0;
  const settlementRate = total > 0 ? (settled / total) * 100 : 0;

  console.log(`Total Outcomes:     ${total.toLocaleString()}`);
  console.log(`Settled Outcomes:   ${settled.toLocaleString()}`);
  console.log(`Settlement Rate:    ${settlementRate.toFixed(2)}%`);

  // Validation check
  const passesThreshold = settlementRate >= 95;
  console.log(`\nThreshold Check:    ${passesThreshold ? '✅ PASS' : '❌ FAIL'} (>95% required)`);

  console.log('\n📈 STEP 2: Sport-by-Sport Breakdown');
  console.log('-'.repeat(80));

  // Get sport breakdown
  const { data: sportData, error: sportError } = await supabase
    .from('settled_outcomes')
    .select('sport, actual_value, game_date')
    .order('sport');

  if (sportError) {
    console.error('❌ Error fetching sport data:', sportError);
    process.exit(1);
  }

  // Group by sport
  const sportMap = new Map<string, any[]>();
  sportData?.forEach(record => {
    const sport = record.sport || 'unknown';
    if (!sportMap.has(sport)) {
      sportMap.set(sport, []);
    }
    sportMap.get(sport)!.push(record);
  });

  const sportBreakdowns: SportBreakdown[] = [];

  for (const [sport, records] of sportMap.entries()) {
    const total = records.length;
    const settled = records.filter(r => r.actual_value !== null && r.actual_value !== -1).length;
    const rate = total > 0 ? (settled / total) * 100 : 0;

    const dates = records
      .map(r => r.game_date)
      .filter(d => d)
      .sort();

    const settledRecords = records.filter(r => r.actual_value !== null && r.actual_value !== -1);
    const avgActualValue = settledRecords.length > 0
      ? settledRecords.reduce((sum, r) => sum + (r.actual_value || 0), 0) / settledRecords.length
      : 0;

    sportBreakdowns.push({
      sport,
      total,
      settled,
      rate,
      earliest_date: dates[0] || 'N/A',
      latest_date: dates[dates.length - 1] || 'N/A',
      avg_actual_value: avgActualValue,
      sample_count: settled
    });
  }

  // Sort by total count descending
  sportBreakdowns.sort((a, b) => b.total - a.total);

  console.log('\nSport          | Total      | Settled    | Rate    | Date Range              | Avg Value');
  console.log('-'.repeat(100));

  sportBreakdowns.forEach(sb => {
    const sportPadded = sb.sport.padEnd(14);
    const totalPadded = sb.total.toLocaleString().padStart(10);
    const settledPadded = sb.settled.toLocaleString().padStart(10);
    const ratePadded = `${sb.rate.toFixed(1)}%`.padStart(7);
    const dateRange = `${sb.earliest_date} to ${sb.latest_date}`.padEnd(23);
    const avgValue = sb.avg_actual_value.toFixed(2).padStart(8);

    console.log(`${sportPadded} | ${totalPadded} | ${settledPadded} | ${ratePadded} | ${dateRange} | ${avgValue}`);
  });

  console.log('\n📋 STEP 3: Sample Data Quality Check');
  console.log('-'.repeat(80));

  // Get sample records from each sport
  const samples: SampleRecord[] = [];

  for (const sport of sportBreakdowns.slice(0, 4).map(s => s.sport)) {
    const { data: sportSamples } = await supabase
      .from('settled_outcomes')
      .select('id, prop_id, sport, player_name, market_type, line, actual_value, outcome, game_date')
      .eq('sport', sport)
      .not('actual_value', 'is', null)
      .neq('actual_value', -1)
      .limit(5);

    if (sportSamples) {
      samples.push(...sportSamples as SampleRecord[]);
    }
  }

  console.log('\nSample Records (showing settled outcomes):');
  console.log('-'.repeat(120));
  console.log('Sport     | Player              | Stat Type        | Line   | Actual | Status    | Date');
  console.log('-'.repeat(120));

  samples.forEach(sample => {
    const sport = sample.sport.padEnd(9);
    const player = (sample.player_name || 'Unknown').substring(0, 19).padEnd(19);
    const marketType = (sample.market_type || 'Unknown').substring(0, 16).padEnd(16);
    const line = (sample.line?.toFixed(1) || 'N/A').padStart(6);
    const actual = (sample.actual_value?.toFixed(1) || 'N/A').padStart(6);
    const outcome = (sample.outcome || 'N/A').padEnd(9);
    const date = sample.game_date || 'N/A';

    console.log(`${sport} | ${player} | ${marketType} | ${line} | ${actual} | ${outcome} | ${date}`);
  });

  console.log('\n🔍 STEP 4: Data Quality Validation');
  console.log('-'.repeat(80));

  // Check for zero values
  const { data: zeroValues } = await supabase
    .from('settled_outcomes')
    .select('actual_value', { count: 'exact', head: true })
    .eq('actual_value', 0);

  const zeroCount = zeroValues || 0;

  // Check for null values
  const { data: nullValues } = await supabase
    .from('settled_outcomes')
    .select('actual_value', { count: 'exact', head: true })
    .is('actual_value', null);

  const nullCount = nullValues || 0;

  // Value distribution
  const { data: valueDistribution } = await supabase
    .from('settled_outcomes')
    .select('actual_value')
    .not('actual_value', 'is', null);

  const values = valueDistribution?.map(r => r.actual_value as number) || [];
  const avgValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const minValue = values.length > 0 ? Math.min(...values) : 0;
  const maxValue = values.length > 0 ? Math.max(...values) : 0;

  console.log(`\nNull Values:        ${nullCount.toLocaleString()} (${((nullCount / totalCount) * 100).toFixed(2)}%)`);
  console.log(`Zero Values:        ${zeroCount.toLocaleString()} (${((zeroCount / settledCount) * 100).toFixed(2)}% of settled)`);
  console.log(`Non-zero Range:     ${minValue.toFixed(1)} to ${maxValue.toFixed(1)}`);
  console.log(`Average Value:      ${avgValue.toFixed(2)}`);

  console.log('\n🎯 STEP 5: Tier 1 ML Training Readiness');
  console.log('-'.repeat(80));

  const validations = [
    {
      check: 'Total outcomes > 1,000',
      value: total,
      threshold: 1000,
      pass: total >= 1000
    },
    {
      check: 'Settlement rate ≥ 95%',
      value: settlementRate,
      threshold: 95,
      pass: settlementRate >= 95
    },
    {
      check: 'Multi-sport coverage (≥2)',
      value: sportBreakdowns.length,
      threshold: 2,
      pass: sportBreakdowns.length >= 2
    },
    {
      check: 'Non-null actual_values',
      value: settled,
      threshold: 1,
      pass: settled > 0
    },
    {
      check: 'Value distribution valid',
      value: maxValue - minValue,
      threshold: 0,
      pass: (maxValue - minValue) > 0
    }
  ];

  console.log('\nValidation Checklist:');
  validations.forEach(v => {
    const status = v.pass ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${status} - ${v.check}: ${v.value.toLocaleString()}`);
  });

  const allPassed = validations.every(v => v.pass);

  console.log('\n' + '='.repeat(80));
  console.log(`\n🚦 FINAL DECISION: ${allPassed ? '✅ GO FOR TIER 1 ML TRAINING' : '❌ NO-GO - FIX DATA ISSUES'}\n`);

  if (allPassed) {
    console.log('✨ Settlement data quality confirmed. Proceed to ML integration.');
    console.log('📋 Next steps:');
    console.log('   1. Configure ML training pipeline');
    console.log('   2. Implement feature engineering');
    console.log('   3. Train initial models on settled outcomes');
    console.log('   4. Validate model performance');
  } else {
    console.log('⚠️  Settlement data requires attention before ML training.');
    console.log('📋 Required actions:');
    validations
      .filter(v => !v.pass)
      .forEach(v => console.log(`   - Fix: ${v.check}`));
  }

  console.log('\n' + '='.repeat(80));

  // Exit with appropriate code
  process.exit(allPassed ? 0 : 1);
}

// Run validation
validateSettlementQuality().catch(error => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
});
