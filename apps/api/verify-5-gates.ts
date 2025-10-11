/**
 * Verify 5 Production Gates
 *
 * Gates validate that the system is operational and ready for production use.
 * All gates must pass for production deployment.
 */

import { supabaseClient } from './src/services/supabaseClient';

interface GateResult {
  gate: string;
  passing: boolean;
  actual: number;
  target: number;
  message: string;
}

async function verifyGates(): Promise<GateResult[]> {
  const results: GateResult[] = [];

  console.log('🚪 VERIFYING 5 PRODUCTION GATES\n');
  console.log('=' . repeat(80));

  // Gate 1: Raw Props Today (≥1000 props for today's games)
  console.log('\n🚪 Gate 1: Raw Props Today');
  const { count: rawPropsToday } = await supabaseClient!
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .gte('game_date', new Date().toISOString().split('T')[0]);

  const gate1Pass = (rawPropsToday || 0) >= 1000;
  results.push({
    gate: 'Gate 1: Raw Props Today',
    passing: gate1Pass,
    actual: rawPropsToday || 0,
    target: 1000,
    message: gate1Pass ? '✅ PASS' : '❌ FAIL - Need fresh props ingestion'
  });
  console.log(`  Target: ≥1000 props`);
  console.log(`  Actual: ${rawPropsToday || 0} props`);
  console.log(`  Status: ${gate1Pass ? '✅ PASS' : '❌ FAIL'}`);

  // Gate 2: Market Props Today (≥1000 normalized props)
  console.log('\n🚪 Gate 2: Market Props Today');
  const { count: marketPropsToday } = await supabaseClient!
    .from('market_props')
    .select('*', { count: 'exact', head: true })
    .gte('game_date', new Date().toISOString().split('T')[0]);

  const gate2Pass = (marketPropsToday || 0) >= 1000;
  results.push({
    gate: 'Gate 2: Market Props Today',
    passing: gate2Pass,
    actual: marketPropsToday || 0,
    target: 1000,
    message: gate2Pass ? '✅ PASS' : '❌ FAIL - Need normalization'
  });
  console.log(`  Target: ≥1000 props`);
  console.log(`  Actual: ${marketPropsToday || 0} props`);
  console.log(`  Status: ${gate2Pass ? '✅ PASS' : '❌ FAIL'}`);

  // Gate 3: Scored in Last 15 Minutes (≥50 props recently scored)
  console.log('\n🚪 Gate 3: Recent Scoring Activity');
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { count: recentlyScored } = await supabaseClient!
    .from('scored_props')
    .select('*', { count: 'exact', head: true })
    .gte('updated_at', fifteenMinutesAgo);

  const gate3Pass = (recentlyScored || 0) >= 50;
  results.push({
    gate: 'Gate 3: Recent Scoring',
    passing: gate3Pass,
    actual: recentlyScored || 0,
    target: 50,
    message: gate3Pass ? '✅ PASS' : '⚠️  WARN - Scoring may be idle'
  });
  console.log(`  Target: ≥50 props in last 15min`);
  console.log(`  Actual: ${recentlyScored || 0} props`);
  console.log(`  Status: ${gate3Pass ? '✅ PASS' : '⚠️  WARN'}`);

  // Gate 4: Total Scored Props (≥500 total in database)
  console.log('\n🚪 Gate 4: Total Scored Props');
  const { count: totalScored } = await supabaseClient!
    .from('scored_props')
    .select('*', { count: 'exact', head: true });

  const gate4Pass = (totalScored || 0) >= 500;
  results.push({
    gate: 'Gate 4: Total Scored Props',
    passing: gate4Pass,
    actual: totalScored || 0,
    target: 500,
    message: gate4Pass ? '✅ PASS' : '❌ FAIL - Need more scored props'
  });
  console.log(`  Target: ≥500 props`);
  console.log(`  Actual: ${totalScored || 0} props`);
  console.log(`  Status: ${gate4Pass ? '✅ PASS' : '❌ FAIL'}`);

  // Gate 5: Feature Coverage (≥100 props with features)
  console.log('\n🚪 Gate 5: Feature Coverage');
  const { data: featureRecords } = await supabaseClient!
    .from('feature_values')
    .select('entity_id')
    .limit(10000);

  const uniquePropsWithFeatures = new Set(featureRecords?.map(f => f.entity_id) || []).size;
  const gate5Pass = uniquePropsWithFeatures >= 100;
  results.push({
    gate: 'Gate 5: Feature Coverage',
    passing: gate5Pass,
    actual: uniquePropsWithFeatures,
    target: 100,
    message: gate5Pass ? '✅ PASS' : '❌ FAIL - Need feature computation'
  });
  console.log(`  Target: ≥100 props with features`);
  console.log(`  Actual: ${uniquePropsWithFeatures} props`);
  console.log(`  Status: ${gate5Pass ? '✅ PASS' : '❌ FAIL'}`);

  return results;
}

async function main() {
  try {
    const results = await verifyGates();

    console.log('\n' + '='.repeat(80));
    console.log('📊 GATE VERIFICATION SUMMARY');
    console.log('='.repeat(80));

    const passing = results.filter(r => r.passing).length;
    const total = results.length;

    console.log(`\n✅ Passing: ${passing}/${total} gates`);
    console.log(`❌ Failing: ${total - passing}/${total} gates\n`);

    results.forEach(r => {
      console.log(`${r.message} - ${r.gate}`);
      console.log(`  ${r.actual}/${r.target}`);
    });

    console.log('\n' + '='.repeat(80));

    if (passing === total) {
      console.log('🎉 ALL GATES PASSING - SYSTEM OPERATIONAL');
    } else if (passing >= 3) {
      console.log('⚠️  PARTIAL PASS - System partially operational');
    } else {
      console.log('❌ SYSTEM NOT OPERATIONAL - Multiple gates failing');
    }

    console.log('='.repeat(80));

    // Save results to JSON
    const fs = require('fs');
    const path = require('path');
    const outDir = path.join(__dirname, 'out', 'ops');

    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const reportPath = path.join(outDir, 'GATE_VERIFICATION.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      passing: passing === total,
      gates: results,
      summary: {
        passing,
        total,
        percentage: (passing / total * 100).toFixed(1)
      }
    }, null, 2));

    console.log(`\n📄 Report saved to: ${reportPath}`);

    process.exit(passing === total ? 0 : 1);

  } catch (error: any) {
    console.error('\n❌ ERROR during gate verification:', error.message);
    process.exit(1);
  }
}

main();
