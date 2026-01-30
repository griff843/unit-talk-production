/**
 * outcomeMetrics.ts — Outcome Metrics Script (Tranche 6, Track A, Stage 2A)
 *
 * Idempotent script that queries settled data and computes:
 *   1. Settled count (total, by sport, by tier)
 *   2. Hit rate (wins / (wins + losses), excluding push/void)
 *   3. ROI proxy (using American odds to compute implied probabilities)
 *   4. Confidence-outcome correlation (Pearson r)
 *
 * Designed to run via:
 *   docker-compose exec api npx tsx src/scripts/outcomeMetrics.ts
 *   OR via GitHub Actions workflow (where secrets are injected)
 *
 * Outputs JSON report to stdout and optionally to file.
 *
 * Environment:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — required
 *   OUTCOME_METRICS_OUTPUT — optional path for JSON output file
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ─── Setup ───────────────────────────────────────────────────────────────────

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  console.error('Run via docker-compose exec or GitHub Actions workflow.');
  console.error('');
  console.error('Generating empty report (no database access)...');

  const emptyReport = {
    timestamp: new Date().toISOString(),
    status: 'NO_DATABASE_ACCESS',
    message: 'Supabase credentials not available. Run via CI/CD or Docker.',
    settled_count: { total: 0, by_sport: {}, by_tier: {} },
    hit_rate: { overall: null, by_sport: {}, by_tier: {} },
    roi_proxy: { overall: null, by_sport: {} },
    confidence_correlation: null,
  };

  const outputPath = process.env.OUTCOME_METRICS_OUTPUT;
  if (outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(emptyReport, null, 2));
    console.log(`Empty report written to: ${outputPath}`);
  } else {
    console.log(JSON.stringify(emptyReport, null, 2));
  }

  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Types ───────────────────────────────────────────────────────────────────

interface SettledPick {
  id: string;
  sport: string;
  market: string | null;
  line: number;
  odds: number;
  professional_score: number | null;
  confidence: number | null;
  tier: string | null;
  settlement_result: string; // win, loss, push, void
  actual_outcome: number | null;
  settled_at: string;
  devigged_edge: number | null;
}

interface MetricsReport {
  timestamp: string;
  status: string;
  query_window: { from: string; to: string };
  settled_count: {
    total: number;
    by_sport: Record<string, number>;
    by_tier: Record<string, number>;
    by_result: Record<string, number>;
  };
  hit_rate: {
    overall: number | null;
    by_sport: Record<string, { wins: number; losses: number; rate: number | null }>;
    by_tier: Record<string, { wins: number; losses: number; rate: number | null }>;
  };
  roi_proxy: {
    overall: number | null;
    by_sport: Record<string, number | null>;
    units_won: number;
    units_wagered: number;
  };
  confidence_correlation: {
    pearson_r: number | null;
    sample_size: number;
    high_conf_hit_rate: number | null;
    low_conf_hit_rate: number | null;
  };
  clv_summary: {
    avg_clv: number | null;
    positive_clv_rate: number | null;
    sample_size: number;
  };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

async function fetchSettledPicks(): Promise<SettledPick[]> {
  // First check if settlement columns exist by attempting the query.
  // Settlement columns are added by migration 004_settlement_schema.sql.
  // If not yet applied, this query will fail gracefully.
  const { data, error } = await supabase
    .from('unified_picks')
    .select(`
      id,
      sport,
      market,
      line,
      odds,
      professional_score,
      confidence,
      tier,
      settlement_result,
      actual_outcome,
      settled_at,
      devigged_edge
    `)
    .eq('settlement_status', 'settled')
    .not('settlement_result', 'is', null)
    .order('settled_at', { ascending: false });

  if (error) {
    // Expected if settlement migration hasn't been applied yet
    if (error.message.includes('does not exist')) {
      console.log('Settlement columns not yet available (migration 004 not applied).');
      console.log('SettlementAgent will create these columns when enabled.');
      return [];
    }
    console.error('Error fetching settled picks:', error);
    return [];
  }

  return (data || []) as SettledPick[];
}

async function fetchPropSettlements(): Promise<any[]> {
  // prop_settlements table is created by migration 004_settlement_schema.sql.
  // May not exist yet if migration hasn't been applied.
  const { data, error } = await supabase
    .from('prop_settlements')
    .select(`
      id,
      player_name,
      stat_type,
      line,
      bet_side,
      actual_value,
      settlement_result,
      settlement_confidence,
      settled_at
    `)
    .not('settlement_result', 'is', null)
    .order('settled_at', { ascending: false });

  if (error) {
    if (error.message.includes('Could not find') || error.code === 'PGRST205') {
      console.log('prop_settlements table not yet created (migration 004 pending).');
      return [];
    }
    console.error('Error fetching prop settlements:', error);
    return [];
  }

  return data || [];
}

// ─── Calculations ────────────────────────────────────────────────────────────

function americanToDecimal(odds: number): number {
  if (odds >= 100) return (odds / 100) + 1;
  if (odds <= -100) return (100 / Math.abs(odds)) + 1;
  return 2.0; // default for invalid odds
}

function computeROI(picks: SettledPick[]): { roi: number | null; unitsWon: number; unitsWagered: number } {
  const decidedPicks = picks.filter(p => p.settlement_result === 'win' || p.settlement_result === 'loss');
  if (decidedPicks.length === 0) return { roi: null, unitsWon: 0, unitsWagered: 0 };

  let unitsWon = 0;
  const unitsWagered = decidedPicks.length; // 1 unit per pick

  for (const pick of decidedPicks) {
    if (pick.settlement_result === 'win') {
      const decimalOdds = americanToDecimal(pick.odds || -110);
      unitsWon += decimalOdds - 1; // profit on 1 unit
    } else {
      unitsWon -= 1; // loss of 1 unit
    }
  }

  return {
    roi: unitsWagered > 0 ? (unitsWon / unitsWagered) * 100 : null,
    unitsWon,
    unitsWagered,
  };
}

function pearsonCorrelation(x: number[], y: number[]): number | null {
  if (x.length < 3 || x.length !== y.length) return null;
  const n = x.length;
  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;
  let covSum = 0, xVar = 0, yVar = 0;
  for (let i = 0; i < n; i++) {
    covSum += (x[i] - meanX) * (y[i] - meanY);
    xVar += (x[i] - meanX) ** 2;
    yVar += (y[i] - meanY) ** 2;
  }
  if (xVar === 0 || yVar === 0) return null;
  return covSum / Math.sqrt(xVar * yVar);
}

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const k = key(item);
    if (!groups[k]) groups[k] = [];
    groups[k].push(item);
  }
  return groups;
}

function hitRate(picks: SettledPick[]): { wins: number; losses: number; rate: number | null } {
  const wins = picks.filter(p => p.settlement_result === 'win').length;
  const losses = picks.filter(p => p.settlement_result === 'loss').length;
  const total = wins + losses;
  return { wins, losses, rate: total > 0 ? wins / total : null };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Outcome Metrics Script (Tranche 6, Stage 2A) ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('');

  // Fetch settled data
  const settledPicks = await fetchSettledPicks();
  const propSettlements = await fetchPropSettlements();

  console.log(`Settled picks (unified_picks): ${settledPicks.length}`);
  console.log(`Prop settlements: ${propSettlements.length}`);
  console.log('');

  // Determine query window
  const sortedDates = settledPicks
    .map(p => p.settled_at)
    .filter(Boolean)
    .sort();
  const queryWindow = {
    from: sortedDates[0] || 'N/A',
    to: sortedDates[sortedDates.length - 1] || 'N/A',
  };

  // 1. Settled count
  const bySport = groupBy(settledPicks, p => p.sport || 'UNKNOWN');
  const byTier = groupBy(settledPicks, p => p.tier || 'UNKNOWN');
  const byResult = groupBy(settledPicks, p => p.settlement_result || 'UNKNOWN');

  const settledCount = {
    total: settledPicks.length,
    by_sport: Object.fromEntries(Object.entries(bySport).map(([k, v]) => [k, v.length])),
    by_tier: Object.fromEntries(Object.entries(byTier).map(([k, v]) => [k, v.length])),
    by_result: Object.fromEntries(Object.entries(byResult).map(([k, v]) => [k, v.length])),
  };

  // 2. Hit rate
  const overallHR = hitRate(settledPicks);
  const hrBySport: Record<string, { wins: number; losses: number; rate: number | null }> = {};
  for (const [sport, picks] of Object.entries(bySport)) {
    hrBySport[sport] = hitRate(picks);
  }
  const hrByTier: Record<string, { wins: number; losses: number; rate: number | null }> = {};
  for (const [tier, picks] of Object.entries(byTier)) {
    hrByTier[tier] = hitRate(picks);
  }

  // 3. ROI proxy
  const overallROI = computeROI(settledPicks);
  const roiBySport: Record<string, number | null> = {};
  for (const [sport, picks] of Object.entries(bySport)) {
    roiBySport[sport] = computeROI(picks).roi;
  }

  // 4. Confidence-outcome correlation
  // Filter to picks with both confidence and binary outcome
  const confOutcomePairs = settledPicks
    .filter(p =>
      p.confidence !== null &&
      p.confidence !== undefined &&
      (p.settlement_result === 'win' || p.settlement_result === 'loss')
    );

  const confValues = confOutcomePairs.map(p => p.confidence!);
  const outcomeValues = confOutcomePairs.map(p => p.settlement_result === 'win' ? 1 : 0);
  const confCorr = pearsonCorrelation(confValues, outcomeValues);

  // High/low confidence split
  const highConf = confOutcomePairs.filter(p => p.confidence! >= 0.6);
  const lowConf = confOutcomePairs.filter(p => p.confidence! < 0.6);
  const highConfHR = highConf.length > 0
    ? highConf.filter(p => p.settlement_result === 'win').length / highConf.length
    : null;
  const lowConfHR = lowConf.length > 0
    ? lowConf.filter(p => p.settlement_result === 'win').length / lowConf.length
    : null;

  // 5. CLV summary
  const clvPicks = settledPicks.filter(p => p.devigged_edge !== null && p.devigged_edge !== undefined);
  const avgCLV = clvPicks.length > 0
    ? clvPicks.reduce((s, p) => s + (p.devigged_edge || 0), 0) / clvPicks.length
    : null;
  const positiveCLVRate = clvPicks.length > 0
    ? clvPicks.filter(p => (p.devigged_edge || 0) > 0).length / clvPicks.length
    : null;

  // Build report
  const report: MetricsReport = {
    timestamp: new Date().toISOString(),
    status: settledPicks.length > 0 ? 'DATA_AVAILABLE' : 'NO_SETTLED_DATA',
    query_window: queryWindow,
    settled_count: settledCount,
    hit_rate: {
      overall: overallHR.rate,
      by_sport: hrBySport,
      by_tier: hrByTier,
    },
    roi_proxy: {
      overall: overallROI.roi,
      by_sport: roiBySport,
      units_won: overallROI.unitsWon,
      units_wagered: overallROI.unitsWagered,
    },
    confidence_correlation: {
      pearson_r: confCorr,
      sample_size: confOutcomePairs.length,
      high_conf_hit_rate: highConfHR,
      low_conf_hit_rate: lowConfHR,
    },
    clv_summary: {
      avg_clv: avgCLV,
      positive_clv_rate: positiveCLVRate,
      sample_size: clvPicks.length,
    },
  };

  // Output
  console.log('=== OUTCOME METRICS REPORT ===');
  console.log(JSON.stringify(report, null, 2));

  // Write to file if requested
  const outputPath = process.env.OUTCOME_METRICS_OUTPUT;
  if (outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`\nReport written to: ${outputPath}`);
  }

  // Also write to tranche-6 output directory
  const tranche6Dir = path.resolve(__dirname, '../../../../out/promotion-tranche-6/2026-02-16/2a_outcome_metrics');
  if (!fs.existsSync(tranche6Dir)) fs.mkdirSync(tranche6Dir, { recursive: true });
  fs.writeFileSync(path.join(tranche6Dir, 'outcome_metrics.json'), JSON.stringify(report, null, 2));
  console.log(`Report also written to: out/promotion-tranche-6/2026-02-16/2a_outcome_metrics/outcome_metrics.json`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
