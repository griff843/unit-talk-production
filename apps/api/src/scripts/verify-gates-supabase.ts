#!/usr/bin/env ts-node
/**
 * Verify 5 dual-track gates using Supabase REST (service role)
 * - Writes out/ops/READY_FOR_DAY.json
 * - Prints PASS/FAIL and sample rows
 */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

function fmt(n: number | null | undefined): number { return typeof n === 'number' ? n : 0; }

async function main() {
  const SUPABASE_URL = process.env.SUPABASE_URL || '';
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  }
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const fifteenAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  // Gate 1: raw_props today
  const g1 = await sb.from('raw_props').select('*', { count: 'exact', head: true }).gte('game_date', todayStr);
  const rawPropsToday = fmt(g1.count);

  // Gate 2: market_props today
  const g2 = await sb.from('market_props').select('*', { count: 'exact', head: true }).gte('game_date', todayStr);
  const marketPropsToday = fmt(g2.count);

  // Gate 3: scored last 15m
  const g3 = await sb.from('scored_props').select('*', { count: 'exact', head: true }).gte('updated_at', fifteenAgo);
  const scored15m = fmt(g3.count);

  // Gate 4: v_prop_read_model rows
  const g4 = await sb.from('v_prop_read_model').select('*', { count: 'exact', head: true });
  const vReadModel = fmt(g4.count);

  // Gate 5: v_daily_board rows
  const g5 = await sb.from('v_daily_board').select('*', { count: 'exact', head: true });
  const vDailyBoard = fmt(g5.count);

  const results = {
    timestamp: new Date().toISOString(),
    targets: {
      raw_props_today: ">=1000",
      market_props_today: ">=1000",
      scored_15m: ">=50",
      v_prop_read_model: ">=1000",
      v_daily_board: ">=50"
    },
    counts: {
      raw_props_today: rawPropsToday,
      market_props_today: marketPropsToday,
      scored_15m: scored15m,
      v_prop_read_model: vReadModel,
      v_daily_board: vDailyBoard
    },
    pass: {
      raw_props_today: rawPropsToday >= 1000,
      market_props_today: marketPropsToday >= 1000,
      scored_15m: scored15m >= 50,
      v_prop_read_model: vReadModel >= 1000,
      v_daily_board: vDailyBoard >= 50
    }
  };

  // Write JSON
  const outDir = path.resolve(process.cwd(), '../../out/ops');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'READY_FOR_DAY.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));

  // Log status
  const p = results.pass;
  const pad = (s: string) => (s + ' '.repeat(24)).slice(0, 24);
  console.log('\n===== Verification Gates =====');
  console.log(`${pad('Gate 1 raw_props_today')}: ${rawPropsToday}  ${p.raw_props_today ? 'PASS' : 'FAIL'}`);
  console.log(`${pad('Gate 2 market_props_today')}: ${marketPropsToday}  ${p.market_props_today ? 'PASS' : 'FAIL'}`);
  console.log(`${pad('Gate 3 scored_15m')}: ${scored15m}  ${p.scored_15m ? 'PASS' : 'FAIL'}`);
  console.log(`${pad('Gate 4 v_prop_read_model')}: ${vReadModel}  ${p.v_prop_read_model ? 'PASS' : 'FAIL'}`);
  console.log(`${pad('Gate 5 v_daily_board')}: ${vDailyBoard}  ${p.v_daily_board ? 'PASS' : 'FAIL'}`);
  console.log('================================\n');
  console.log(`Output written to: ${outPath}\n`);

  // Samples
  const sampleRead = await sb
    .from('v_prop_read_model')
    .select('prop_ref, source, sport, market, selection, line, odds, tier, edge')
    .limit(5);
  console.log('Sample v_prop_read_model:');
  console.log(sampleRead.data || []);

  const sampleBoard = await sb
    .from('v_daily_board')
    .select('prop_ref, sport, market, selection, line, odds, tier, edge, professional_score')
    .limit(5);
  console.log('\nSample v_daily_board:');
  console.log(sampleBoard.data || []);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

