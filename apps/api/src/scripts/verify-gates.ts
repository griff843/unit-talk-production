#!/usr/bin/env tsx
/**
 * Run 5 verification gates for pipeline health
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load canonical env (root .env)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function verifyGates() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log('🔍 Running 5 Verification Gates\n');
  console.log('='.repeat(70));

  const results: any = {
    timestamp: new Date().toISOString(),
    gates: {}
  };

  const today = new Date().toISOString().split('T')[0];

  // Gate 1: raw_props_today
  const { count: gate1Count } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .gte('game_date', today);

  results.gates.raw_props_today = gate1Count || 0;
  console.log(`Gate 1: raw_props_today     = ${gate1Count || 0} ${(gate1Count || 0) > 0 ? '✅ PASS' : '❌ FAIL'}`);

  // Gate 2: market_props_today
  const { count: gate2Count } = await supabase
    .from('market_props')
    .select('*', { count: 'exact', head: true })
    .gte('game_date', today);

  results.gates.market_props_today = gate2Count || 0;
  console.log(`Gate 2: market_props_today  = ${gate2Count || 0} ${(gate2Count || 0) > 0 ? '✅ PASS' : '❌ FAIL'}`);

  // Gate 3: scored_15m
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { count: gate3Count } = await supabase
    .from('scored_props')
    .select('*', { count: 'exact', head: true })
    .gte('updated_at', fifteenMinAgo);

  results.gates.scored_15m = gate3Count || 0;
  console.log(`Gate 3: scored_15m          = ${gate3Count || 0} ${(gate3Count || 0) > 0 ? '✅ PASS' : '⚠️  WARN'}`);

  // Gate 4: v_prop_read_model
  const { count: gate4Count } = await supabase
    .from('v_prop_read_model')
    .select('*', { count: 'exact', head: true })
    .gte('game_date', today);

  results.gates.v_prop_read_model = gate4Count || 0;
  console.log(`Gate 4: v_prop_read_model   = ${gate4Count || 0} ${(gate4Count || 0) > 0 ? '✅ PASS' : '❌ FAIL'}`);

  // Gate 5: v_daily_board
  const { count: gate5Count } = await supabase
    .from('v_daily_board')
    .select('*', { count: 'exact', head: true })
    .gte('game_date', today);

  results.gates.v_daily_board = gate5Count || 0;
  console.log(`Gate 5: v_daily_board       = ${gate5Count || 0} ${(gate5Count || 0) > 0 ? '✅ PASS' : '❌ FAIL'}`);

  console.log('='.repeat(70));

  // Overall status - strict thresholds
  const gate1Pass = (gate1Count || 0) >= 1000;
  const gate2Pass = (gate2Count || 0) >= 1000;
  const gate3Pass = (gate3Count || 0) >= 50;
  const gate4Pass = (gate4Count || 0) >= 1000;
  const gate5Pass = (gate5Count || 0) >= 50;

  const allPass = gate1Pass && gate2Pass && gate3Pass && gate4Pass && gate5Pass;
  results.status = allPass ? 'PASS' : 'FAIL';
  results.overall = allPass ? '✅ ALL GATES PASS' : '❌ SOME GATES FAILED';

  results.thresholds = {
    gate1: { actual: gate1Count || 0, target: 1000, pass: gate1Pass },
    gate2: { actual: gate2Count || 0, target: 1000, pass: gate2Pass },
    gate3: { actual: gate3Count || 0, target: 50, pass: gate3Pass },
    gate4: { actual: gate4Count || 0, target: 1000, pass: gate4Pass },
    gate5: { actual: gate5Count || 0, target: 50, pass: gate5Pass },
  };

  console.log(`\nOverall: ${results.overall}\n`);

  // Sample data from v_prop_read_model
  console.log('Sample from v_prop_read_model:');
  console.log('-'.repeat(70));
  const { data: sample1 } = await supabase
    .from('v_prop_read_model')
    .select('id, sport, market, selection, odds, game_date')
    .gte('game_date', today)
    .order('game_date')
    .order('odds', { ascending: false, nullsFirst: false })
    .limit(5);

  if (sample1 && sample1.length > 0) {
    sample1.forEach(r => {
      console.log(`${r.sport} | ${r.market} | ${r.selection} | ${r.odds} | ${r.game_date}`);
    });
  } else {
    console.log('  No rows found');
  }

  // Sample data from v_daily_board
  console.log('\nSample from v_daily_board:');
  console.log('-'.repeat(70));
  const { data: sample2 } = await supabase
    .from('v_daily_board')
    .select('prop_ref, sport, market, selection, odds, game_date')
    .gte('game_date', today)
    .limit(5);

  if (sample2 && sample2.length > 0) {
    sample2.forEach(r => {
      console.log(`${r.prop_ref} | ${r.sport} | ${r.market} | ${r.selection} | ${r.odds}`);
    });
  } else {
    console.log('  No rows found');
  }

  console.log('');

  // Save results to out/ops/verify
  const outDir = path.resolve(__dirname, '../../out/ops/verify');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const jsonPath = path.join(outDir, 'E2E_VALIDATION_REPORT.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  console.log(`✅ JSON saved to: ${jsonPath}`);

  // Generate markdown report
  const mdReport = `# E2E Validation Report
**Date:** ${new Date().toISOString().split('T')[0]}
**Status:** ${results.status}

## Gate Results

| Gate | Count | Target | Status |
|------|-------|--------|--------|
| Gate 1 - raw_props_today | ${gate1Count} | ≥1,000 | ${gate1Pass ? '✅ PASS' : '❌ FAIL'} |
| Gate 2 - market_props_today | ${gate2Count} | ≥1,000 | ${gate2Pass ? '✅ PASS' : '❌ FAIL'} |
| Gate 3 - scored_15m | ${gate3Count} | ≥50 | ${gate3Pass ? '✅ PASS' : '❌ FAIL'} |
| Gate 4 - v_prop_read_model | ${gate4Count} | ≥1,000 | ${gate4Pass ? '✅ PASS' : '❌ FAIL'} |
| Gate 5 - v_daily_board | ${gate5Count} | ≥50 | ${gate5Pass ? '✅ PASS' : '❌ FAIL'} |

**Overall:** ${results.overall}

---
**Generated:** ${new Date().toISOString()}
`;

  const mdPath = path.join(outDir, 'E2E_VALIDATION_REPORT.md');
  fs.writeFileSync(mdPath, mdReport);
  console.log(`✅ Markdown saved to: ${mdPath}\n`);

  // Hard fail if gates don't pass
  if (!allPass) {
    console.error('❌ GATES FAILED - Exiting with code 1');
    process.exit(1);
  }
}

verifyGates().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
