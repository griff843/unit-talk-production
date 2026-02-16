/* eslint-disable no-console */
/**
 * Report-building utilities for RECAP-AGENT-001.
 * Separated from generateRecap.ts to respect max-lines-per-function limits.
 */

import { computeDecision } from './decisionRules';

import type {
  BandStats,
  ConfidenceBucket,
  DailySummary,
  IntegrityChecks,
  SettledPick,
} from './types';

// ─── Statistics ──────────────────────────────────────────────────────────────

export function computeBandStats(picks: SettledPick[]): Record<string, BandStats> {
  const bands = ['HARD', 'SOFT', 'NONE'];
  const result: Record<string, BandStats> = {};

  for (const band of bands) {
    const subset =
      band === 'NONE'
        ? picks.filter(p => p.promotion_band === 'NONE' || p.promotion_band === null)
        : picks.filter(p => p.promotion_band === band);

    const wins = subset.filter(p => p.settlement_result === 'win').length;
    const losses = subset.filter(p => p.settlement_result === 'loss').length;
    const pushes = subset.filter(p => p.settlement_result === 'push').length;
    const voids = subset.filter(p => p.settlement_result === 'void').length;
    const scores = subset.map(p => p.professional_score).filter((s): s is number => s !== null);

    result[band] = {
      count: subset.length,
      wins,
      losses,
      pushes,
      voids,
      win_rate: subset.length > 0 ? wins / subset.length : 0,
      avg_score: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    };
  }

  return result;
}

export function computeConfidenceBuckets(picks: SettledPick[]): ConfidenceBucket[] {
  const buckets: ConfidenceBucket[] = [
    { label: '5-6', range: [5, 6.99], count: 0, wins: 0, win_rate: 0 },
    { label: '7-8', range: [7, 8.99], count: 0, wins: 0, win_rate: 0 },
    { label: '9-10', range: [9, 10], count: 0, wins: 0, win_rate: 0 },
  ];

  for (const pick of picks) {
    if (pick.confidence === null) continue;
    for (const bucket of buckets) {
      if (pick.confidence >= bucket.range[0] && pick.confidence <= bucket.range[1]) {
        bucket.count++;
        if (pick.settlement_result === 'win') bucket.wins++;
        break;
      }
    }
  }

  for (const bucket of buckets) {
    bucket.win_rate = bucket.count > 0 ? bucket.wins / bucket.count : 0;
  }

  return buckets;
}

// ─── Summary Builder ────────────────────────────────────────────────────────

function computePromotedVsRejected(picks: SettledPick[]) {
  const promoted = picks.filter(p => p.promotion_band === 'HARD' || p.promotion_band === 'SOFT');
  const rejected = picks.filter(p => p.promotion_band === 'NONE' || p.promotion_band === null);

  const promotedWins = promoted.filter(p => p.settlement_result === 'win').length;
  const rejectedWins = rejected.filter(p => p.settlement_result === 'win').length;
  const promotedWR = promoted.length > 0 ? promotedWins / promoted.length : 0;
  const rejectedWR = rejected.length > 0 ? rejectedWins / rejected.length : 0;

  const avgScore = (arr: SettledPick[]) => {
    const scores = arr.map(p => p.professional_score).filter((s): s is number => s !== null);
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  };

  const pAvg = avgScore(promoted);
  const rAvg = avgScore(rejected);

  return {
    promoted: { count: promoted.length, win_rate: promotedWR, avg_score: pAvg },
    rejected: { count: rejected.length, win_rate: rejectedWR, avg_score: rAvg },
    delta_win_rate: promotedWR - rejectedWR,
    delta_avg_score: pAvg !== null && rAvg !== null ? pAvg - rAvg : null,
  };
}

export function buildSummary(
  picks: SettledPick[],
  integrity: IntegrityChecks,
  dateStart: string,
  dateEnd: string
): DailySummary {
  const wins = picks.filter(p => p.settlement_result === 'win').length;
  const losses = picks.filter(p => p.settlement_result === 'loss').length;
  const pushes = picks.filter(p => p.settlement_result === 'push').length;

  return {
    timestamp: new Date().toISOString(),
    date_range: { start: dateStart, end: dateEnd },
    headline: {
      total_settled: picks.length,
      wins,
      losses,
      pushes,
      win_rate: picks.length > 0 ? wins / picks.length : 0,
      net_units: null,
      net_units_note: 'No units/stake data in unified_picks (columns do not exist)',
    },
    by_band: computeBandStats(picks),
    by_confidence: computeConfidenceBuckets(picks),
    promoted_vs_rejected: computePromotedVsRejected(picks),
    integrity,
    decision: computeDecision({ picks, integrity }),
  };
}

// ─── Markdown Rendering ─────────────────────────────────────────────────────

function fmtPct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function signedPct(v: number): string {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${(v * 100).toFixed(1)}%`;
}

function renderHeader(summary: DailySummary, isWeekly: boolean): string {
  const title = isWeekly ? 'WEEKLY RECAP' : 'DAILY RECAP';
  let md = `# ${title}\n\n`;
  md += `**Date range**: ${summary.date_range.start} to ${summary.date_range.end}\n`;
  md += `**Generated**: ${summary.timestamp}\n\n`;
  return md;
}

function renderHeadline(h: DailySummary['headline']): string {
  let md = `## 1. Headline\n\n`;
  md += `| Metric | Value |\n|--------|-------|\n`;
  md += `| Total settled | ${h.total_settled} |\n`;
  md += `| Wins | ${h.wins} |\n| Losses | ${h.losses} |\n| Pushes | ${h.pushes} |\n`;
  md += `| Win rate | ${fmtPct(h.win_rate)} |\n`;
  md += `| Net units | ${h.net_units !== null ? h.net_units.toFixed(2) : 'N/A'} |\n\n`;
  if (h.net_units_note) md += `> NOTE: ${h.net_units_note}\n\n`;
  return md;
}

function renderBands(byBand: Record<string, BandStats>): string {
  let md = `## 2. By Promotion Band\n\n`;
  md += `| Band | Count | W | L | P | Win Rate | Avg Score |\n`;
  md += `|------|-------|---|---|---|----------|-----------|\n`;
  for (const band of ['HARD', 'SOFT', 'NONE']) {
    const s = byBand[band];
    if (!s) continue;
    const score = s.avg_score !== null ? s.avg_score.toFixed(1) : 'N/A';
    md += `| ${band} | ${s.count} | ${s.wins} | ${s.losses} | ${s.pushes} | ${fmtPct(s.win_rate)} | ${score} |\n`;
  }
  return md + '\n';
}

function renderConfidence(buckets: ConfidenceBucket[]): string {
  let md = `## 3. By Confidence Bucket\n\n`;
  if (!buckets.some(b => b.count > 0)) {
    return md + `No confidence data available (all values NULL).\n\n`;
  }
  md += `| Bucket | Count | Wins | Win Rate |\n|--------|-------|------|----------|\n`;
  for (const b of buckets) {
    md += `| ${b.label} | ${b.count} | ${b.wins} | ${fmtPct(b.win_rate)} |\n`;
  }
  return md + '\n';
}

function renderPvR(pvr: DailySummary['promoted_vs_rejected']): string {
  let md = `## 4. Promoted vs Rejected\n\n`;
  md += `| Group | Count | Win Rate | Avg Score |\n|-------|-------|----------|-----------|\n`;
  const pScore = pvr.promoted.avg_score !== null ? pvr.promoted.avg_score.toFixed(1) : 'N/A';
  const rScore = pvr.rejected.avg_score !== null ? pvr.rejected.avg_score.toFixed(1) : 'N/A';
  const dScore = pvr.delta_avg_score !== null ? pvr.delta_avg_score.toFixed(1) : 'N/A';
  md += `| Promoted (HARD+SOFT) | ${pvr.promoted.count} | ${fmtPct(pvr.promoted.win_rate)} | ${pScore} |\n`;
  md += `| Rejected (NONE/null) | ${pvr.rejected.count} | ${fmtPct(pvr.rejected.win_rate)} | ${rScore} |\n`;
  md += `| **Delta** | | **${signedPct(pvr.delta_win_rate)}** | ${dScore} |\n\n`;
  return md;
}

function renderIntegrity(ic: IntegrityChecks): string {
  let md = `## 5. Integrity Checks\n\n`;
  md += `| Check | Count | Status |\n|-------|-------|--------|\n`;
  md += `| Missing settlements | ${ic.missing_settlements} | ${ic.missing_settlements === 0 ? 'OK' : 'FAIL'} |\n`;
  md += `| Missing game results | ${ic.missing_results} | ${ic.missing_results === 0 ? 'OK' : 'FAIL'} |\n`;
  md += `| Null settlement_result | ${ic.null_settlement_result} | ${ic.null_settlement_result === 0 ? 'OK' : 'WARN'} |\n`;
  md += `| Null promotion_band | ${ic.null_promotion_band} | ${ic.null_promotion_band === 0 ? 'OK' : 'INFO'} |\n\n`;
  return md;
}

function renderDecision(d: DailySummary['decision']): string {
  let md = `## 6. Decision\n\n**${d.decision}**\n\nReasons:\n`;
  for (const r of d.reasons) md += `- ${r}\n`;
  md += `\nMetrics used:\n`;
  md += `- settled_total: ${d.metrics.settled_total}\n`;
  md += `- promoted_total: ${d.metrics.promoted_total}\n`;
  md += `- promoted_win_rate: ${fmtPct(d.metrics.promoted_win_rate)}\n`;
  md += `- rejected_win_rate: ${fmtPct(d.metrics.rejected_win_rate)}\n`;
  md += `- hard_win_rate: ${fmtPct(d.metrics.hard_win_rate)}\n`;
  md += `- hard_count: ${d.metrics.hard_count}\n`;
  md += `- delta: ${(d.metrics.delta * 100).toFixed(1)}%\n`;
  md += `- integrity: ${d.metrics.integrity_ok ? 'OK' : 'FAILED'}\n`;
  return md;
}

export function renderMarkdown(summary: DailySummary, isWeekly: boolean): string {
  return [
    renderHeader(summary, isWeekly),
    renderHeadline(summary.headline),
    renderBands(summary.by_band),
    renderConfidence(summary.by_confidence),
    renderPvR(summary.promoted_vs_rejected),
    renderIntegrity(summary.integrity),
    renderDecision(summary.decision),
  ].join('');
}
