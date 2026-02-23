#!/usr/bin/env npx tsx
/**
 * Promotion Calibration Report
 *
 * Reads existing promotion data and produces a quality report.
 * No DB schema changes. Read-only queries against existing tables.
 *
 * Usage (via Docker / CI):
 *   CALIBRATION_START=2026-01-01 CALIBRATION_END=2026-01-29 \
 *   npx tsx scripts/promotion-calibration-report.ts
 *
 * Env vars:
 *   CALIBRATION_START — ISO date start (default: 30 days ago)
 *   CALIBRATION_END   — ISO date end   (default: now)
 *   SUPABASE_URL      — required (from GitHub Secrets)
 *   SUPABASE_SERVICE_ROLE_KEY — required (from GitHub Secrets)
 *
 * Outputs:
 *   out/promotion-agent-next/<date>/calibration/report.md
 *   out/promotion-agent-next/<date>/calibration/report.json
 */

import * as fs from 'fs';
import * as path from 'path';

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const now = new Date();
const startDate =
  process.env.CALIBRATION_START ||
  new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const endDate = process.env.CALIBRATION_END || now.toISOString().split('T')[0];

interface CalibrationReport {
  timeWindow: { start: string; end: string };
  rawProps: { total: number; promoted: number; notPromoted: number };
  dailyPicks: { total: number; promotedToFinal: number; notPromoted: number };
  unifiedPicks: { total: number; postedToDiscord: number; notPosted: number };
  tierDistribution: Record<string, number>;
  promotionDecisions: {
    total: number;
    approved: number;
    rejected: number;
    held: number;
    lanes: Record<string, number>;
  };
  settlementData: {
    available: boolean;
    wins: number;
    losses: number;
    pushes: number;
    winRate: number | null;
    roi: number | null;
  };
  edgeBuckets: Record<string, number>;
  topTriggeredRules: Array<{ rule: string; count: number }>;
  warnings: string[];
}

async function generateReport(): Promise<CalibrationReport> {
  const warnings: string[] = [];

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log('WARNING: No Supabase credentials. Generating stub report.');
    warnings.push(
      'NO_DB_ACCESS: Supabase credentials not available. Report contains stub data only.'
    );

    return {
      timeWindow: { start: startDate, end: endDate },
      rawProps: { total: 0, promoted: 0, notPromoted: 0 },
      dailyPicks: { total: 0, promotedToFinal: 0, notPromoted: 0 },
      unifiedPicks: { total: 0, postedToDiscord: 0, notPosted: 0 },
      tierDistribution: {},
      promotionDecisions: { total: 0, approved: 0, rejected: 0, held: 0, lanes: {} },
      settlementData: { available: false, wins: 0, losses: 0, pushes: 0, winRate: null, roi: null },
      edgeBuckets: {},
      topTriggeredRules: [],
      warnings,
    };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // 1. Raw props counts
  const { count: rawTotal } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startDate)
    .lte('created_at', endDate);
  const { count: rawPromoted } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .eq('promoted', true);

  // 2. SPRINT-DAILY-PICKS-CANONICAL-ENFORCEMENT-007: daily_picks eliminated
  // Using unified_picks workflow_stage for equivalent counts
  const { count: dpTotal } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .not('workflow_stage', 'is', null);
  const { count: dpPromoted } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .in('workflow_stage', ['approved', 'posted', 'settled']);

  // 3. Unified picks counts
  const { count: upTotal } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startDate)
    .lte('created_at', endDate);
  const { count: upPosted } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .eq('posted_to_discord', true);

  // 4. Tier distribution from unified_picks
  const { data: tierData } = await supabase
    .from('unified_picks')
    .select('tier')
    .gte('created_at', startDate)
    .lte('created_at', endDate);
  const tierDistribution: Record<string, number> = {};
  (tierData || []).forEach(row => {
    const t = row.tier || 'unknown';
    tierDistribution[t] = (tierDistribution[t] || 0) + 1;
  });

  // 5. Promotion decisions
  const { data: decisions } = await supabase
    .from('promotion_decisions')
    .select('decision, approved')
    .gte('created_at', startDate)
    .lte('created_at', endDate);
  const lanes: Record<string, number> = {};
  let approved = 0,
    rejected = 0,
    held = 0;
  (decisions || []).forEach(d => {
    const lane = d.decision || 'unknown';
    lanes[lane] = (lanes[lane] || 0) + 1;
    if (d.approved) approved++;
    else if (lane === 'reject') rejected++;
    else held++;
  });

  // 6. Settlement data (check if result/status columns exist)
  let settlementData = {
    available: false,
    wins: 0,
    losses: 0,
    pushes: 0,
    winRate: null as number | null,
    roi: null as number | null,
  };
  try {
    const { data: settled } = await supabase
      .from('unified_picks')
      .select('result')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .not('result', 'is', null);
    if (settled && settled.length > 0) {
      const wins = settled.filter(s => s.result === 'win').length;
      const losses = settled.filter(s => s.result === 'loss').length;
      const pushes = settled.filter(s => s.result === 'push').length;
      const total = wins + losses;
      settlementData = {
        available: true,
        wins,
        losses,
        pushes,
        winRate: total > 0 ? wins / total : null,
        roi: null, // Would need unit size data
      };
    } else {
      warnings.push('SETTLEMENT_NOT_AVAILABLE: No settled picks found in time window');
    }
  } catch {
    warnings.push('SETTLEMENT_COLUMN_MISSING: unified_picks.result column may not exist');
  }

  // 7. Edge buckets (from decision_factors if available)
  const edgeBuckets: Record<string, number> = {};
  try {
    const { data: dfRows } = await supabase
      .from('promotion_decisions')
      .select('confidence')
      .gte('created_at', startDate)
      .lte('created_at', endDate);
    (dfRows || []).forEach(row => {
      const conf = row.confidence ?? 0;
      const bucket =
        conf >= 0.8 ? '0.8-1.0' : conf >= 0.6 ? '0.6-0.8' : conf >= 0.4 ? '0.4-0.6' : '0.0-0.4';
      edgeBuckets[bucket] = (edgeBuckets[bucket] || 0) + 1;
    });
  } catch {
    warnings.push('EDGE_BUCKETS_UNAVAILABLE: Could not read decision confidence data');
  }

  // 8. Top triggered rules (from decision_factors JSONB if available)
  const topTriggeredRules: Array<{ rule: string; count: number }> = [];
  try {
    const { data: dfRows } = await supabase
      .from('promotion_decisions')
      .select('decision_factors')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .not('decision_factors', 'is', null);
    const ruleCounts: Record<string, number> = {};
    (dfRows || []).forEach(row => {
      const factors = row.decision_factors as any;
      if (factors?.triggered_rules) {
        factors.triggered_rules.forEach((r: any) => {
          const key = `${r.gate}:${r.passed ? 'pass' : 'fail'}`;
          ruleCounts[key] = (ruleCounts[key] || 0) + 1;
        });
      }
    });
    Object.entries(ruleCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([rule, count]) => topTriggeredRules.push({ rule, count }));
  } catch {
    warnings.push('TRIGGERED_RULES_UNAVAILABLE: decision_factors column may not exist');
  }

  return {
    timeWindow: { start: startDate, end: endDate },
    rawProps: {
      total: rawTotal || 0,
      promoted: rawPromoted || 0,
      notPromoted: (rawTotal || 0) - (rawPromoted || 0),
    },
    dailyPicks: {
      total: dpTotal || 0,
      promotedToFinal: dpPromoted || 0,
      notPromoted: (dpTotal || 0) - (dpPromoted || 0),
    },
    unifiedPicks: {
      total: upTotal || 0,
      postedToDiscord: upPosted || 0,
      notPosted: (upTotal || 0) - (upPosted || 0),
    },
    tierDistribution,
    promotionDecisions: { total: (decisions || []).length, approved, rejected, held, lanes },
    settlementData,
    edgeBuckets,
    topTriggeredRules,
    warnings,
  };
}

function renderMarkdown(report: CalibrationReport): string {
  const lines: string[] = [];
  lines.push(`# Promotion Calibration Report`);
  lines.push(`**Window**: ${report.timeWindow.start} to ${report.timeWindow.end}\n`);

  if (report.warnings.length > 0) {
    lines.push(`## Warnings`);
    report.warnings.forEach(w => lines.push(`- ${w}`));
    lines.push('');
  }

  lines.push(`## Pipeline Funnel`);
  lines.push(`| Stage | Total | Promoted | Not Promoted |`);
  lines.push(`|-------|-------|----------|--------------|`);
  lines.push(
    `| raw_props | ${report.rawProps.total} | ${report.rawProps.promoted} | ${report.rawProps.notPromoted} |`
  );
  lines.push(
    `| daily_picks | ${report.dailyPicks.total} | ${report.dailyPicks.promotedToFinal} | ${report.dailyPicks.notPromoted} |`
  );
  lines.push(
    `| unified_picks | ${report.unifiedPicks.total} | ${report.unifiedPicks.postedToDiscord} | ${report.unifiedPicks.notPosted} |`
  );
  lines.push('');

  lines.push(`## Tier Distribution`);
  lines.push(`| Tier | Count |`);
  lines.push(`|------|-------|`);
  Object.entries(report.tierDistribution)
    .sort()
    .forEach(([tier, count]) => {
      lines.push(`| ${tier} | ${count} |`);
    });
  lines.push('');

  lines.push(`## Promotion Decisions`);
  lines.push(`- Total: ${report.promotionDecisions.total}`);
  lines.push(`- Approved: ${report.promotionDecisions.approved}`);
  lines.push(`- Rejected: ${report.promotionDecisions.rejected}`);
  lines.push(`- Held: ${report.promotionDecisions.held}`);
  lines.push(`- Lanes: ${JSON.stringify(report.promotionDecisions.lanes)}`);
  lines.push('');

  lines.push(`## Settlement`);
  if (report.settlementData.available) {
    lines.push(`- Wins: ${report.settlementData.wins}`);
    lines.push(`- Losses: ${report.settlementData.losses}`);
    lines.push(`- Pushes: ${report.settlementData.pushes}`);
    lines.push(
      `- Win Rate: ${report.settlementData.winRate !== null ? (report.settlementData.winRate * 100).toFixed(1) + '%' : 'N/A'}`
    );
    lines.push(
      `- ROI: ${report.settlementData.roi !== null ? (report.settlementData.roi * 100).toFixed(1) + '%' : 'NOT AVAILABLE (requires unit size data)'}`
    );
  } else {
    lines.push(`**NOT AVAILABLE** — no settled picks in time window`);
  }
  lines.push('');

  lines.push(`## Confidence Buckets`);
  lines.push(`| Bucket | Count |`);
  lines.push(`|--------|-------|`);
  Object.entries(report.edgeBuckets)
    .sort()
    .forEach(([bucket, count]) => {
      lines.push(`| ${bucket} | ${count} |`);
    });
  lines.push('');

  lines.push(`## Top Triggered Rules`);
  if (report.topTriggeredRules.length > 0) {
    lines.push(`| Rule | Count |`);
    lines.push(`|------|-------|`);
    report.topTriggeredRules.forEach(r => lines.push(`| ${r.rule} | ${r.count} |`));
  } else {
    lines.push(`**NOT AVAILABLE** — no decision_factors data found`);
  }

  return lines.join('\n');
}

async function main() {
  const dateStr = new Date().toISOString().split('T')[0];
  const outputDir = path.join(
    __dirname,
    '..',
    'out',
    'promotion-agent-next',
    dateStr,
    'calibration'
  );
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`=== Promotion Calibration Report ===`);
  console.log(`Window: ${startDate} to ${endDate}`);

  const report = await generateReport();

  // Write JSON
  fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`Written: ${path.join(outputDir, 'report.json')}`);

  // Write Markdown
  const md = renderMarkdown(report);
  fs.writeFileSync(path.join(outputDir, 'report.md'), md);
  console.log(`Written: ${path.join(outputDir, 'report.md')}`);

  // Summary
  console.log(
    `\nPipeline Funnel: raw_props(${report.rawProps.total}) → daily_picks(${report.dailyPicks.total}) → unified_picks(${report.unifiedPicks.total})`
  );
  console.log(`Warnings: ${report.warnings.length}`);
  report.warnings.forEach(w => console.log(`  - ${w}`));
}

main().catch(err => {
  console.error('Calibration report failed:', err);
  process.exit(1);
});
