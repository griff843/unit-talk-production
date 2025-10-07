#!/usr/bin/env tsx
/**
 * Run 5 verification gates for pipeline health
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function verifyGates() {
  const client = new Client({
    host: 'aws-0-us-east-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.lxqmuzmqtnnlpfapvief',
    password: 'Adalise843!',
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('🔍 Running 5 Verification Gates\n');
  console.log('='.repeat(70));

  const results: any = {
    timestamp: new Date().toISOString(),
    gates: {}
  };

  // Gate 1: raw_props_today
  const gate1 = await client.query(`
    SELECT COUNT(*) AS raw_props_today
    FROM public.raw_props
    WHERE game_date >= (now()::date)
  `);
  const gate1Count = parseInt(gate1.rows[0].raw_props_today);
  results.gates.raw_props_today = gate1Count;
  console.log(`Gate 1: raw_props_today     = ${gate1Count} ${gate1Count > 0 ? '✅ PASS' : '❌ FAIL'}`);

  // Gate 2: market_props_today
  const gate2 = await client.query(`
    SELECT COUNT(*) AS market_props_today
    FROM public.market_props
    WHERE game_date >= (now()::date)
  `);
  const gate2Count = parseInt(gate2.rows[0].market_props_today);
  results.gates.market_props_today = gate2Count;
  console.log(`Gate 2: market_props_today  = ${gate2Count} ${gate2Count > 0 ? '✅ PASS' : '❌ FAIL'}`);

  // Gate 3: scored_15m
  const gate3 = await client.query(`
    SELECT COUNT(*) AS scored_15m
    FROM public.scored_props
    WHERE updated_at >= now() - interval '15 min'
  `);
  const gate3Count = parseInt(gate3.rows[0].scored_15m);
  results.gates.scored_15m = gate3Count;
  console.log(`Gate 3: scored_15m          = ${gate3Count} ${gate3Count > 0 ? '✅ PASS' : '⚠️  WARN'}`);

  // Gate 4: v_prop_read_model
  const gate4 = await client.query(`
    SELECT COUNT(*) AS feed_rows
    FROM public.v_prop_read_model
    WHERE game_date >= (now()::date)
  `);
  const gate4Count = parseInt(gate4.rows[0].feed_rows);
  results.gates.v_prop_read_model = gate4Count;
  console.log(`Gate 4: v_prop_read_model   = ${gate4Count} ${gate4Count > 0 ? '✅ PASS' : '❌ FAIL'}`);

  // Gate 5: v_daily_board
  const gate5 = await client.query(`
    SELECT COUNT(*) AS board_rows
    FROM public.v_daily_board
    WHERE game_date >= (now()::date)
  `);
  const gate5Count = parseInt(gate5.rows[0].board_rows);
  results.gates.v_daily_board = gate5Count;
  console.log(`Gate 5: v_daily_board       = ${gate5Count} ${gate5Count > 0 ? '✅ PASS' : '❌ FAIL'}`);

  console.log('='.repeat(70));

  // Overall status
  const allPass = gate1Count > 0 && gate2Count > 0 && gate4Count > 0 && gate5Count > 0;
  results.status = allPass ? 'PASS' : 'FAIL';
  results.overall = allPass ? '✅ ALL GATES PASS' : '❌ SOME GATES FAILED';

  console.log(`\nOverall: ${results.overall}\n`);

  // Sample data from v_prop_read_model
  console.log('Sample from v_prop_read_model:');
  console.log('-'.repeat(70));
  const sample1 = await client.query(`
    SELECT id, sport, market, selection, odds, game_date
    FROM public.v_prop_read_model
    WHERE game_date >= (now()::date)
    ORDER BY game_date, odds DESC NULLS LAST
    LIMIT 5
  `);

  if (sample1.rows.length > 0) {
    sample1.rows.forEach(r => {
      console.log(`${r.sport} | ${r.market} | ${r.selection} | ${r.odds} | ${r.game_date}`);
    });
  } else {
    console.log('  No rows found');
  }

  // Sample data from v_daily_board
  console.log('\nSample from v_daily_board:');
  console.log('-'.repeat(70));
  const sample2 = await client.query(`
    SELECT prop_ref, sport, market, selection, odds, game_date
    FROM public.v_daily_board
    WHERE game_date >= (now()::date)
    LIMIT 5
  `);

  if (sample2.rows.length > 0) {
    sample2.rows.forEach(r => {
      console.log(`${r.prop_ref} | ${r.sport} | ${r.market} | ${r.selection} | ${r.odds}`);
    });
  } else {
    console.log('  No rows found');
  }

  console.log('');

  // Save results
  const outDir = path.join(process.cwd(), 'out/ops');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outputPath = path.join(outDir, 'READY_FOR_DAY.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`✅ Results saved to: ${outputPath}\n`);

  await client.end();
}

verifyGates().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
