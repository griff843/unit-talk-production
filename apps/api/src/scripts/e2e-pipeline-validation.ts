#!/usr/bin/env tsx
/**
 * E2E Pipeline Validation
 * Comprehensive validation of entire data pipeline from ingestion to scoring
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface ValidationResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  value: any;
  expected?: any;
  message: string;
}

async function runE2EValidation() {
  console.log('🔍 Running E2E Pipeline Validation\n');
  console.log('='.repeat(80));

  const results: ValidationResult[] = [];
  const startTime = Date.now();

  // Test 1: Raw Props Ingestion
  console.log('\n📥 TEST 1: Raw Props Ingestion');
  try {
    const { count: totalRawProps } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true });

    const { count: todayRawProps } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .gte('game_date', new Date().toISOString().split('T')[0]);

    results.push({
      test: 'Raw Props Total',
      status: totalRawProps && totalRawProps > 0 ? 'PASS' : 'FAIL',
      value: totalRawProps,
      expected: '> 0',
      message: `Total raw props in database`
    });

    results.push({
      test: 'Raw Props Today',
      status: todayRawProps && todayRawProps >= 100 ? 'PASS' : 'WARN',
      value: todayRawProps,
      expected: '>= 100',
      message: `Raw props for today's games`
    });

    console.log(`  Total raw props: ${totalRawProps}`);
    console.log(`  Today's raw props: ${todayRawProps}`);
  } catch (error) {
    results.push({
      test: 'Raw Props Ingestion',
      status: 'FAIL',
      value: null,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown'}`
    });
  }

  // Test 2: Market Props (Player Props!)
  console.log('\n🎯 TEST 2: Market Props (Player Props)');
  try {
    const { count: totalMarketProps } = await supabase
      .from('market_props')
      .select('*', { count: 'exact', head: true });

    const { count: todayMarketProps } = await supabase
      .from('market_props')
      .select('*', { count: 'exact', head: true })
      .gte('game_date', new Date().toISOString().split('T')[0]);

    // Check for player props (player_name NOT starting with team keywords)
    const { data: sampleProps } = await supabase
      .from('market_props')
      .select('player_name, market, sport')
      .gte('game_date', new Date().toISOString().split('T')[0])
      .limit(10);

    const hasRealPlayers = sampleProps?.some(p =>
      p.player_name &&
      !p.player_name.includes('Cowboys') &&
      !p.player_name.includes('Eagles') &&
      !p.player_name.includes('Bulldogs')
    );

    results.push({
      test: 'Market Props Total',
      status: totalMarketProps && totalMarketProps > 0 ? 'PASS' : 'FAIL',
      value: totalMarketProps,
      expected: '> 0',
      message: `Total market props in database`
    });

    results.push({
      test: 'Market Props Today',
      status: todayMarketProps && todayMarketProps >= 100 ? 'PASS' : 'WARN',
      value: todayMarketProps,
      expected: '>= 100',
      message: `Market props for today`
    });

    results.push({
      test: 'Real Player Names',
      status: hasRealPlayers ? 'PASS' : 'FAIL',
      value: hasRealPlayers ? 'Yes' : 'No',
      expected: 'Yes',
      message: `Player props have real athlete names`
    });

    console.log(`  Total market props: ${totalMarketProps}`);
    console.log(`  Today's market props: ${todayMarketProps}`);
    console.log(`  Real player names: ${hasRealPlayers ? 'YES ✅' : 'NO ❌'}`);
    if (sampleProps && sampleProps.length > 0) {
      console.log(`  Sample players: ${sampleProps.slice(0, 5).map(p => p.player_name).join(', ')}`);
    }
  } catch (error) {
    results.push({
      test: 'Market Props',
      status: 'FAIL',
      value: null,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown'}`
    });
  }

  // Test 3: Scored Props
  console.log('\n📊 TEST 3: Scored Props');
  try {
    const { count: totalScoredProps } = await supabase
      .from('scored_props')
      .select('*', { count: 'exact', head: true });

    const { count: recentScored } = await supabase
      .from('scored_props')
      .select('*', { count: 'exact', head: true })
      .gte('updated_at', new Date(Date.now() - 15 * 60 * 1000).toISOString());

    // Get tier breakdown
    const { data: tierBreakdown } = await supabase
      .rpc('get_tier_counts');

    results.push({
      test: 'Scored Props Total',
      status: totalScoredProps && totalScoredProps > 0 ? 'PASS' : 'FAIL',
      value: totalScoredProps,
      expected: '> 0',
      message: `Total scored props`
    });

    results.push({
      test: 'Recent Scoring Activity',
      status: recentScored && recentScored > 0 ? 'PASS' : 'WARN',
      value: recentScored,
      expected: '> 0',
      message: `Props scored in last 15 minutes`
    });

    console.log(`  Total scored props: ${totalScoredProps}`);
    console.log(`  Scored in last 15 min: ${recentScored}`);

    if (tierBreakdown && tierBreakdown.length > 0) {
      console.log(`  Tier breakdown:`);
      tierBreakdown.forEach((tier: any) => {
        console.log(`    ${tier.tier}: ${tier.count} props`);
      });
    }
  } catch (error) {
    results.push({
      test: 'Scored Props',
      status: 'FAIL',
      value: null,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown'}`
    });
  }

  // Test 4: Gate Verification
  console.log('\n🚪 TEST 4: Health Check Gates');
  try {
    // Gate 1: Raw props today
    const { count: gate1 } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .gte('game_date', new Date().toISOString().split('T')[0]);

    // Gate 2: Market props today
    const { count: gate2 } = await supabase
      .from('market_props')
      .select('*', { count: 'exact', head: true })
      .gte('game_date', new Date().toISOString().split('T')[0]);

    // Gate 3: Scored in last 15 min
    const { count: gate3 } = await supabase
      .from('scored_props')
      .select('*', { count: 'exact', head: true })
      .gte('updated_at', new Date(Date.now() - 15 * 60 * 1000).toISOString());

    // Gate 4: v_prop_read_model
    const { count: gate4 } = await supabase
      .from('v_prop_read_model')
      .select('*', { count: 'exact', head: true });

    // Gate 5: v_daily_board
    const { count: gate5 } = await supabase
      .from('v_daily_board')
      .select('*', { count: 'exact', head: true });

    const gates = [
      { name: 'Gate 1: Raw Props Today', value: gate1, threshold: 100, pass: (gate1 || 0) >= 100 },
      { name: 'Gate 2: Market Props Today', value: gate2, threshold: 100, pass: (gate2 || 0) >= 100 },
      { name: 'Gate 3: Recent Scoring', value: gate3, threshold: 1, pass: (gate3 || 0) >= 1 },
      { name: 'Gate 4: Read Model', value: gate4, threshold: 10, pass: (gate4 || 0) >= 10 },
      { name: 'Gate 5: Daily Board', value: gate5, threshold: 1, pass: (gate5 || 0) >= 1 }
    ];

    gates.forEach(gate => {
      results.push({
        test: gate.name,
        status: gate.pass ? 'PASS' : 'WARN',
        value: gate.value,
        expected: `>= ${gate.threshold}`,
        message: gate.pass ? 'Gate passing' : 'Gate threshold not met'
      });

      console.log(`  ${gate.name}: ${gate.value} (${gate.pass ? '✅ PASS' : '⚠️ WARN'})`);
    });
  } catch (error) {
    results.push({
      test: 'Gate Verification',
      status: 'FAIL',
      value: null,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown'}`
    });
  }

  // Test 5: Data Quality
  console.log('\n🔬 TEST 5: Data Quality Checks');
  try {
    // Check for player props with real names
    const { data: playerProps } = await supabase
      .from('market_props')
      .select('player_name, market')
      .gte('game_date', new Date().toISOString().split('T')[0])
      .ilike('market', 'player%')
      .limit(100);

    const uniquePlayers = new Set(playerProps?.map(p => p.player_name));

    results.push({
      test: 'Player Prop Diversity',
      status: uniquePlayers.size >= 10 ? 'PASS' : 'WARN',
      value: uniquePlayers.size,
      expected: '>= 10',
      message: `Unique players in today's props`
    });

    console.log(`  Unique players today: ${uniquePlayers.size}`);

    // Check for devigging data (props with both over/under)
    const { data: deviggingReady } = await supabase
      .from('market_props')
      .select('id')
      .gte('game_date', new Date().toISOString().split('T')[0])
      .not('over_odds', 'is', null)
      .not('under_odds', 'is', null)
      .limit(10);

    results.push({
      test: 'Devigging Ready Props',
      status: deviggingReady && deviggingReady.length > 0 ? 'PASS' : 'WARN',
      value: deviggingReady?.length || 0,
      expected: '> 0',
      message: `Props with both over/under odds`
    });

    console.log(`  Props ready for devigging: ${deviggingReady?.length || 0}`);
  } catch (error) {
    results.push({
      test: 'Data Quality',
      status: 'FAIL',
      value: null,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown'}`
    });
  }

  // Summary
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log('\n' + '='.repeat(80));
  console.log('📊 E2E VALIDATION SUMMARY');
  console.log('='.repeat(80));

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;
  const total = results.length;

  console.log(`\n✅ PASSED: ${passed}/${total}`);
  console.log(`❌ FAILED: ${failed}/${total}`);
  console.log(`⚠️  WARNED: ${warned}/${total}`);
  console.log(`⏱️  Duration: ${duration}s`);

  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  - ${r.test}: ${r.message}`);
    });
  }

  if (warned > 0) {
    console.log('\n⚠️  WARNINGS:');
    results.filter(r => r.status === 'WARN').forEach(r => {
      console.log(`  - ${r.test}: ${r.message} (got: ${r.value}, expected: ${r.expected})`);
    });
  }

  const overallStatus = failed === 0 ? (warned === 0 ? 'ALL GREEN ✅' : 'MOSTLY GREEN ⚠️') : 'ISSUES DETECTED ❌';
  console.log(`\n🎯 OVERALL STATUS: ${overallStatus}`);
  console.log('='.repeat(80));

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

runE2EValidation().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
