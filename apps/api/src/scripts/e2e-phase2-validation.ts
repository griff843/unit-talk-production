#!/usr/bin/env tsx
/**
 * Phase 2 E2E Validation Report
 * Date: 2025-10-20
 *
 * Validates dual-track pipeline and generates comprehensive report
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface GateResult {
  name: string;
  count: number;
  target: number;
  status: 'PASS' | 'FAIL';
  suggestion?: string;
}

interface E2EReport {
  timestamp: string;
  phase: string;
  gates: GateResult[];
  overallStatus: 'PASS' | 'FAIL';
  commandCenter: {
    healthy: boolean;
    url: string;
  };
  recommendations: string[];
  nextSteps: string[];
}

async function runE2EValidation(): Promise<E2EReport> {
  console.log('🔍 Phase 2 E2E Validation Starting...\n');
  console.log('='.repeat(70));

  const report: E2EReport = {
    timestamp: new Date().toISOString(),
    phase: 'Phase 2 - Dual-Track Pipeline',
    gates: [],
    overallStatus: 'FAIL',
    commandCenter: {
      healthy: false,
      url: 'http://localhost:3004',
    },
    recommendations: [],
    nextSteps: [],
  };

  const today = new Date().toISOString().split('T')[0];
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  // Gate 1: raw_props_today
  console.log('Gate 1: Checking raw_props_today...');
  const { count: rawPropsCount } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .gte('game_date', today);

  report.gates.push({
    name: 'raw_props_today',
    count: rawPropsCount || 0,
    target: 1000,
    status: (rawPropsCount || 0) >= 1000 ? 'PASS' : 'FAIL',
    suggestion:
      (rawPropsCount || 0) < 1000 ? 'Run feed ingestion or check odds API connectivity' : undefined,
  });
  console.log(
    `  Count: ${rawPropsCount || 0} (target: ≥1000) ${(rawPropsCount || 0) >= 1000 ? '✅' : '❌'}`
  );

  // Gate 2: market_props_today
  console.log('Gate 2: Checking market_props_today...');
  const { count: marketPropsCount } = await supabase
    .from('market_props')
    .select('*', { count: 'exact', head: true })
    .gte('game_date', today);

  report.gates.push({
    name: 'market_props_today',
    count: marketPropsCount || 0,
    target: 1000,
    status: (marketPropsCount || 0) >= 1000 ? 'PASS' : 'FAIL',
    suggestion:
      (marketPropsCount || 0) < 1000
        ? 'Run backfill: npx tsx src/scripts/backfill-market-props.ts'
        : undefined,
  });
  console.log(
    `  Count: ${marketPropsCount || 0} (target: ≥1000) ${(marketPropsCount || 0) >= 1000 ? '✅' : '❌'}`
  );

  // Gate 3: scored_15m
  console.log('Gate 3: Checking scored_15m...');
  const { count: scoredCount } = await supabase
    .from('scored_props')
    .select('*', { count: 'exact', head: true })
    .gte('updated_at', fifteenMinutesAgo);

  report.gates.push({
    name: 'scored_15m',
    count: scoredCount || 0,
    target: 50,
    status: (scoredCount || 0) >= 50 ? 'PASS' : 'FAIL',
    suggestion:
      (scoredCount || 0) < 50
        ? 'Start scoring agent or run: npx tsx src/scripts/score-market-props.ts'
        : undefined,
  });
  console.log(
    `  Count: ${scoredCount || 0} (target: ≥50) ${(scoredCount || 0) >= 50 ? '✅' : '❌'}`
  );

  // Gate 4: v_prop_read_model
  console.log('Gate 4: Checking v_prop_read_model...');
  const { count: readModelCount, error: readModelError } = await supabase
    .from('v_prop_read_model')
    .select('*', { count: 'exact', head: true });

  report.gates.push({
    name: 'v_prop_read_model',
    count: readModelCount || 0,
    target: 1000,
    status: (readModelCount || 0) >= 1000 ? 'PASS' : 'FAIL',
    suggestion: readModelError
      ? `View error: ${readModelError.message}. Check if view exists and has correct grants.`
      : (readModelCount || 0) < 1000
        ? 'Refresh materialized view or check view definition'
        : undefined,
  });
  console.log(
    `  Count: ${readModelCount || 0} (target: ≥1000) ${(readModelCount || 0) >= 1000 ? '✅' : '❌'}`
  );
  if (readModelError) console.log(`  Error: ${readModelError.message}`);

  // Gate 5: v_daily_board
  console.log('Gate 5: Checking v_daily_board...');
  const { count: dailyBoardCount, error: dailyBoardError } = await supabase
    .from('v_daily_board')
    .select('*', { count: 'exact', head: true });

  report.gates.push({
    name: 'v_daily_board',
    count: dailyBoardCount || 0,
    target: 50,
    status: (dailyBoardCount || 0) >= 50 ? 'PASS' : 'FAIL',
    suggestion: dailyBoardError
      ? `View error: ${dailyBoardError.message}. Check if view exists and has correct grants.`
      : (dailyBoardCount || 0) < 50
        ? 'Refresh materialized view or check view definition'
        : undefined,
  });
  console.log(
    `  Count: ${dailyBoardCount || 0} (target: ≥50) ${(dailyBoardCount || 0) >= 50 ? '✅' : '❌'}`
  );
  if (dailyBoardError) console.log(`  Error: ${dailyBoardError.message}`);

  console.log('='.repeat(70));

  // Determine overall status
  const allPassed = report.gates.every(g => g.status === 'PASS');
  report.overallStatus = allPassed ? 'PASS' : 'FAIL';

  console.log(`\n🎯 Overall Status: ${report.overallStatus}\n`);

  // Generate recommendations
  if (!allPassed) {
    console.log('💡 Recommendations:\n');

    const failedGates = report.gates.filter(g => g.status === 'FAIL');
    failedGates.forEach(gate => {
      if (gate.suggestion) {
        console.log(`  ${gate.name}: ${gate.suggestion}`);
        report.recommendations.push(`${gate.name}: ${gate.suggestion}`);
      }
    });

    // Add specific next steps
    if (report.gates[0].status === 'FAIL') {
      report.nextSteps.push('1. Ingest props from odds API for today');
    }
    if (report.gates[1].status === 'FAIL') {
      report.nextSteps.push('2. Run backfill to populate market_props from raw_props');
    }
    if (report.gates[2].status === 'FAIL') {
      report.nextSteps.push('3. Start scoring agent or run manual scoring');
    }
    if (report.gates[3].status === 'FAIL' || report.gates[4].status === 'FAIL') {
      report.nextSteps.push('4. Create/refresh materialized views for Command Center');
    }
  } else {
    report.nextSteps.push('1. Start schedulers with PM2');
    report.nextSteps.push('2. Test Command Center approval workflow');
    report.nextSteps.push('3. Verify Discord posting');
  }

  // Write report
  const outDir = path.join(process.cwd(), 'apps/api/out/ops/verify');
  fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, 'E2E_VALIDATION_REPORT.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 JSON Report: ${jsonPath}`);

  // Write markdown report
  const mdPath = path.join(outDir, 'E2E_VALIDATION_REPORT.md');
  const markdown = generateMarkdownReport(report);
  fs.writeFileSync(mdPath, markdown);
  console.log(`📄 Markdown Report: ${mdPath}\n`);

  return report;
}

function generateMarkdownReport(report: E2EReport): string {
  const lines: string[] = [];

  lines.push(`# Phase 2 E2E Validation Report`);
  lines.push(`**Date:** ${report.timestamp}`);
  lines.push(`**Phase:** ${report.phase}`);
  lines.push(`**Overall Status:** ${report.overallStatus === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
  lines.push('');

  lines.push('## Gate Results');
  lines.push('');
  lines.push('| Gate | Count | Target | Status | Suggestion |');
  lines.push('|------|-------|--------|--------|------------|');

  report.gates.forEach(gate => {
    const status = gate.status === 'PASS' ? '✅ PASS' : '❌ FAIL';
    const suggestion = gate.suggestion || '-';
    lines.push(`| ${gate.name} | ${gate.count} | ≥${gate.target} | ${status} | ${suggestion} |`);
  });

  lines.push('');
  lines.push('## Command Center');
  lines.push(`- URL: ${report.commandCenter.url}`);
  lines.push(`- Status: ${report.commandCenter.healthy ? '✅ Healthy' : '⚠️ Not verified'}`);
  lines.push('');

  if (report.recommendations.length > 0) {
    lines.push('## Recommendations');
    lines.push('');
    report.recommendations.forEach(rec => {
      lines.push(`- ${rec}`);
    });
    lines.push('');
  }

  if (report.nextSteps.length > 0) {
    lines.push('## Next Steps');
    lines.push('');
    report.nextSteps.forEach(step => {
      lines.push(`${step}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

runE2EValidation().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
