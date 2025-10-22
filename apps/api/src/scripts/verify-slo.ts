#!/usr/bin/env tsx
/**
 * SLO Verification Script
 * Date: 2025-10-20
 * Purpose: Verify database performance SLOs and hard-fail if breached
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

interface SLOResult {
  name: string;
  target_ms: number;
  actual_ms: number;
  pass: boolean;
  query: string;
}

async function verifySLOs() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log('📊 Running SLO Verification\n');
  console.log('='.repeat(70));

  const results: SLOResult[] = [];
  let allPass = true;
  const today = new Date().toISOString().split('T')[0];

  // SLO 1: Single table read (market_props) < 50ms
  console.log('\nSLO 1: Single table read (market_props)...');
  const slo1Start = Date.now();
  await supabase
    .from('market_props')
    .select('id, sport, market, selection, line, odds, game_date')
    .gte('game_date', today)
    .limit(100);
  const slo1Duration = Date.now() - slo1Start;
  const slo1Pass = slo1Duration < 50;
  results.push({
    name: 'Single table read (market_props)',
    target_ms: 50,
    actual_ms: slo1Duration,
    pass: slo1Pass,
    query: 'SELECT ... FROM market_props WHERE game_date >= CURRENT_DATE LIMIT 100'
  });
  console.log(`   Target: <50ms, Actual: ${slo1Duration}ms ${slo1Pass ? '✅ PASS' : '❌ FAIL'}`);
  if (!slo1Pass) allPass = false;

  // SLO 2: View read (v_prop_read_model) < 150ms
  console.log('\nSLO 2: View read (v_prop_read_model)...');
  const slo2Start = Date.now();
  await supabase
    .from('v_prop_read_model')
    .select('prop_ref, sport, market, selection, line, odds, tier, edge')
    .gte('game_date', today)
    .limit(100);
  const slo2Duration = Date.now() - slo2Start;
  const slo2Pass = slo2Duration < 150;
  results.push({
    name: 'View read (v_prop_read_model)',
    target_ms: 150,
    actual_ms: slo2Duration,
    pass: slo2Pass,
    query: 'SELECT ... FROM v_prop_read_model WHERE game_date >= CURRENT_DATE LIMIT 100'
  });
  console.log(`   Target: <150ms, Actual: ${slo2Duration}ms ${slo2Pass ? '✅ PASS' : '❌ FAIL'}`);
  if (!slo2Pass) allPass = false;

  // SLO 3: Write operation (INSERT) < 40ms
  console.log('\nSLO 3: Write operation (INSERT into agent_health)...');
  const slo3Start = Date.now();
  await supabase
    .from('agent_health')
    .upsert({
      agent_name: 'slo_test',
      status: 'healthy',
      last_ping: new Date().toISOString(),
      metadata: { test: true }
    }, { onConflict: 'agent_name' });
  const slo3Duration = Date.now() - slo3Start;
  const slo3Pass = slo3Duration < 40;
  results.push({
    name: 'Write operation (INSERT)',
    target_ms: 40,
    actual_ms: slo3Duration,
    pass: slo3Pass,
    query: 'INSERT INTO agent_health ... ON CONFLICT DO UPDATE'
  });
  console.log(`   Target: <40ms, Actual: ${slo3Duration}ms ${slo3Pass ? '✅ PASS' : '❌ FAIL'}`);
  if (!slo3Pass) allPass = false;

  // SLO 4: View count (v_daily_board) < 800ms
  console.log('\nSLO 4: View count (v_daily_board)...');
  const slo4Start = Date.now();
  await supabase
    .from('v_daily_board')
    .select('*', { count: 'exact', head: true })
    .gte('game_date', today);
  const slo4Duration = Date.now() - slo4Start;
  const slo4Pass = slo4Duration < 800;
  results.push({
    name: 'View count (v_daily_board)',
    target_ms: 800,
    actual_ms: slo4Duration,
    pass: slo4Pass,
    query: 'SELECT COUNT(*) FROM v_daily_board WHERE game_date >= CURRENT_DATE'
  });
  console.log(`   Target: <800ms, Actual: ${slo4Duration}ms ${slo4Pass ? '✅ PASS' : '❌ FAIL'}`);
  if (!slo4Pass) allPass = false;

  // SLO 5: Scoring freshness (p95 < 60s for last 2 hours)
  console.log('\nSLO 5: Scoring freshness (last 2 hours)...');
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: freshnessData } = await supabase
    .from('scored_props')
    .select('updated_at')
    .gte('updated_at', twoHoursAgo)
    .order('updated_at', { ascending: false })
    .limit(1);

  const maxAge = freshnessData && freshnessData.length > 0
    ? (Date.now() - new Date(freshnessData[0].updated_at).getTime()) / 1000
    : 0;
  const slo5Pass = maxAge < 60;
  results.push({
    name: 'Scoring freshness (p95)',
    target_ms: 60000,
    actual_ms: maxAge * 1000,
    pass: slo5Pass,
    query: 'SELECT MAX(updated_at) FROM scored_props WHERE updated_at >= NOW() - INTERVAL \'2 hours\''
  });
  console.log(`   Target: <60s, Actual: ${maxAge.toFixed(1)}s ${slo5Pass ? '✅ PASS' : '❌ FAIL'}`);
  if (!slo5Pass) allPass = false;

  console.log('\n' + '='.repeat(70));
  console.log(`\nOverall: ${allPass ? '✅ ALL SLOs MET' : '❌ SOME SLOs BREACHED'}\n`);

  // Save results
  const outDir = path.resolve(__dirname, '../../out/ops/verify');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const report = {
    timestamp: new Date().toISOString(),
    status: allPass ? 'PASS' : 'FAIL',
    slos: results,
    summary: {
      total: results.length,
      passed: results.filter(r => r.pass).length,
      failed: results.filter(r => !r.pass).length,
    }
  };

  const jsonPath = path.join(outDir, 'SLO_REPORT.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`✅ JSON saved to: ${jsonPath}`);

  // Generate markdown report
  const mdReport = `# SLO Verification Report
**Date:** ${new Date().toISOString().split('T')[0]}  
**Status:** ${report.status}

## SLO Results

| SLO | Target | Actual | Status |
|-----|--------|--------|--------|
${results.map(r => `| ${r.name} | ${r.target_ms}ms | ${r.actual_ms.toFixed(1)}ms | ${r.pass ? '✅ PASS' : '❌ FAIL'} |`).join('\n')}

**Summary:** ${report.summary.passed}/${report.summary.total} SLOs met

${!allPass ? `
## Recommended Actions

${results.filter(r => !r.pass).map(r => `
### ${r.name} (${r.actual_ms.toFixed(1)}ms > ${r.target_ms}ms)

**Query:**
\`\`\`sql
${r.query}
\`\`\`

**Recommendations:**
- Add covering index on frequently queried columns
- Analyze query plan with EXPLAIN ANALYZE
- Consider materialized view if data is relatively static
- Review agent batch sizes if write-heavy
`).join('\n')}
` : ''}

---
**Generated:** ${new Date().toISOString()}
`;

  const mdPath = path.join(outDir, 'SLO_REPORT.md');
  fs.writeFileSync(mdPath, mdReport);
  console.log(`✅ Markdown saved to: ${mdPath}\n`);

  // Hard fail if SLOs breached
  if (!allPass) {
    console.error('❌ SLO BREACH - Exiting with code 1');
    process.exit(1);
  }
}

verifySLOs().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

