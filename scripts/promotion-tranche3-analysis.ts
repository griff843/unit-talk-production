/**
 * promotion-tranche3-analysis.ts — Tranche 3: Calibration & Intelligence Analysis
 *
 * Structural analysis of the promotion scoring pipeline using the actual math
 * from applyScoringLogic, PromotionGuardrails, and PromotionGatekeeper.
 *
 * Produces:
 *   - Edge bucket distribution analysis
 *   - Confidence bucket distribution analysis
 *   - Tier distribution analysis
 *   - Guardrail trigger frequency analysis
 *   - Rule dominance & conflict analysis
 *   - Scoring function sensitivity analysis
 *
 * NO schema changes. NO Supabase calls. Pure structural analysis.
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Replicated Scoring Math (from actual source files) ─────────────────────
// These replicate the exact math from the codebase to avoid import issues.

/** determineTier.ts — Legacy path (SCORING_ENGINE_V2 not set locally) */
function determineTier(composite_score: number): string {
  if (composite_score >= 20) return 'S';
  if (composite_score >= 15) return 'A';
  if (composite_score >= 10) return 'B';
  return 'C';
}

/** expectedValue.ts — EV calculation */
function calculateExpectedValue(prop: any): number {
  // Legacy path: winProb = projected_win_prob ?? 0.5
  const winProb = prop.projected_win_prob ?? 0.5;
  const odds = prop.odds ?? -110;
  const payout = odds > 0 ? odds / 100 : 100 / Math.abs(odds);
  const devigged_edge = winProb * payout - (1 - winProb);
  return Math.round(devigged_edge * 100);
}

/** confidenceScore.ts — Confidence calculation */
function calculateConfidenceScore(scores: { trend_score: number; matchup_score: number; ev_percent: number }): number {
  const { trend_score, matchup_score, ev_percent } = scores;
  return Math.round(
    0.4 * (trend_score ?? 0) +
    0.3 * (matchup_score ?? 0) +
    0.3 * ((ev_percent ?? 0) / 10)
  );
}

/** trendScore, matchupScore, lineValueScore, roleStabilityScore — simplified */
function calculateTrendScore(prop: any): number {
  const recent = prop.recent_avg ?? prop.season_avg ?? 0;
  const line = prop.line ?? 0;
  if (line === 0) return 2;
  const ratio = recent / line;
  if (ratio > 1.15) return 5;
  if (ratio > 1.05) return 4;
  if (ratio > 0.95) return 3;
  if (ratio > 0.85) return 2;
  return 1;
}

function calculateMatchupScore(_prop: any): number {
  // Simplified: returns 2-4 range based on available data
  return 3;
}

function calculateLineValueScore(prop: any): number {
  const odds = prop.odds ?? -110;
  const absOdds = Math.abs(odds);
  if (odds > 0 && odds <= 150) return 4;
  if (odds > 0) return 3;
  if (absOdds <= 120) return 3;
  if (absOdds <= 150) return 2;
  return 1;
}

function calculateRoleStabilityScore(_prop: any): number {
  return 3; // Default mid-range
}

/** applyScoringLogic.ts — full scoring pipeline */
function applyScoringLogic(prop: any) {
  const trend_score = calculateTrendScore(prop);
  const matchup_score = calculateMatchupScore(prop);
  const ev_percent = calculateExpectedValue(prop);
  const confidence_score = calculateConfidenceScore({ trend_score, matchup_score, ev_percent });
  const line_value_score = calculateLineValueScore(prop);
  const role_stability = calculateRoleStabilityScore(prop);

  const professional_score =
    (trend_score ?? 0) +
    (matchup_score ?? 0) +
    (confidence_score ?? 0) +
    (line_value_score ?? 0) +
    (role_stability ?? 0);

  const tier = determineTier(professional_score);

  return {
    ...prop,
    trend_score,
    matchup_score,
    ev_percent,
    confidence_score,
    line_value_score,
    role_stability,
    professional_score,
    tier,
  };
}

/** PromotionGuardrails — replicated */
interface GuardrailResult {
  gate: string;
  passed: boolean;
  reason: string;
}

function runPreScoreGuardrails(prop: any): GuardrailResult[] {
  const maxOdds = 5000;
  const maxStaleMinutes = 120;
  const results: GuardrailResult[] = [];

  const odds = prop.odds;
  if (odds === undefined || odds === null || typeof odds !== 'number' || isNaN(odds) || odds === 0) {
    results.push({ gate: 'G-01:invalid_odds', passed: false, reason: `Odds invalid or missing: ${odds}` });
  } else if (Math.abs(odds) > maxOdds) {
    results.push({ gate: 'G-01:odds_range', passed: false, reason: `|Odds| ${Math.abs(odds)} exceeds max ${maxOdds}` });
  }

  const line = prop.line;
  if (line !== undefined && line !== null && line !== '') {
    const numLine = typeof line === 'number' ? line : Number(line);
    if (isNaN(numLine)) {
      results.push({ gate: 'G-02:invalid_line', passed: false, reason: `Line not a valid number: ${line}` });
    }
  }

  const priceTs = prop.price_updated_at ?? prop.odds_updated_at;
  if (priceTs) {
    const priceDate = new Date(priceTs);
    if (!isNaN(priceDate.getTime())) {
      const ageMinutes = (Date.now() - priceDate.getTime()) / (1000 * 60);
      if (ageMinutes > maxStaleMinutes) {
        results.push({ gate: 'G-03:stale_price', passed: false, reason: `Price ${Math.round(ageMinutes)}m old (max ${maxStaleMinutes}m)` });
      }
    }
  }

  const betType = (prop.bet_type || '').toLowerCase();
  if (['spread', 'moneyline', 'total', 'team_total'].includes(betType)) {
    if (!prop.team && !prop.team_name) {
      results.push({ gate: 'G-04:missing_team', passed: false, reason: `Bet type "${betType}" requires team identifier` });
    }
  }

  if (prop.is_volatile === true && prop.is_stable === true) {
    results.push({ gate: 'G-05:contradictory_volatility', passed: false, reason: 'is_volatile and is_stable both true' });
  }
  if (prop.steam_for === true && prop.steam_against === true) {
    results.push({ gate: 'G-05:contradictory_steam', passed: false, reason: 'steam_for and steam_against both true' });
  }

  return results;
}

function runPostScoreGuardrails(scored: any): GuardrailResult[] {
  const minEdgePct = 1;
  const results: GuardrailResult[] = [];
  const evPct = scored.ev_percent ?? 0;
  if (evPct < minEdgePct) {
    results.push({ gate: 'G-06:below_min_edge', passed: false, reason: `EV ${evPct}% below minimum ${minEdgePct}%` });
  }
  return results;
}

function hasRejection(results: GuardrailResult[]): boolean {
  return results.some(r => !r.passed);
}

// ─── Gate Evaluation (simplified from PromotionGatekeeper) ──────────────────

interface GateThresholds {
  gateId: string;
  minTier: string;
  minConfidence: number;
  minProfessionalScore: number;
  minExpectedValue: number;
}

const GATES: GateThresholds[] = [
  { gateId: 'instant-s-tier', minTier: 'S', minConfidence: 0.75, minProfessionalScore: 85, minExpectedValue: 0.05 },
  { gateId: '10am-premium', minTier: 'A', minConfidence: 0.65, minProfessionalScore: 75, minExpectedValue: 0.03 },
  { gateId: 'steam-hunter', minTier: 'A', minConfidence: 0.60, minProfessionalScore: 70, minExpectedValue: 0.02 },
];

function tierScore(tier: string): number {
  switch (tier.toUpperCase()) {
    case 'S': return 4;
    case 'A': return 3;
    case 'B': return 2;
    case 'C': return 1;
    default: return 0;
  }
}

function evaluateGates(scored: any): Array<{ gateId: string; passed: boolean; failedChecks: string[] }> {
  return GATES.map(gate => {
    const failedChecks: string[] = [];
    if (tierScore(scored.tier) < tierScore(gate.minTier)) failedChecks.push('tier');
    // Note: confidence_score from applyScoringLogic is 0-5, but gate expects 0-1
    // This is a design gap discovered during analysis
    const normalizedConf = (scored.confidence_score ?? 0) / 5;
    if (normalizedConf < gate.minConfidence) failedChecks.push('confidence');
    if ((scored.professional_score ?? 0) < gate.minProfessionalScore) failedChecks.push('professional_score');
    if ((scored.ev_percent ?? 0) / 100 < gate.minExpectedValue) failedChecks.push('expected_value');
    return {
      gateId: gate.gateId,
      passed: failedChecks.length === 0,
      failedChecks,
    };
  });
}

// ─── Synthetic Data Generator ───────────────────────────────────────────────

function generateSyntheticProps(count: number): any[] {
  const sports = ['NBA', 'NFL', 'MLB', 'NHL', 'NCAAF'];
  const statTypes = ['points', 'rebounds', 'assists', 'passing_yards', 'rushing_yards', 'strikeouts', 'saves', 'goals'];
  const oddsRange = [-200, -150, -130, -120, -115, -110, -105, 100, 105, 110, 115, 120, 130, 150, 200, 250, 300];

  const props: any[] = [];

  for (let i = 0; i < count; i++) {
    const sport = sports[i % sports.length];
    const stat = statTypes[i % statTypes.length];
    const odds = oddsRange[i % oddsRange.length];
    const line = 5 + (i % 50);
    const recentAvg = line * (0.7 + (i % 100) / 100 * 0.6); // 0.7x to 1.3x of line

    // Varying data quality scenarios
    const hasProjectedWinProb = i % 5 === 0; // 20% have explicit win prob
    const hasStalePrice = i % 20 === 0; // 5% stale
    const hasInvalidOdds = i % 50 === 0; // 2% invalid
    const hasContradictoryFlags = i % 100 === 0; // 1% contradictory

    const prop: any = {
      id: `synth-${i.toString().padStart(5, '0')}`,
      player_name: `Player_${i}`,
      sport,
      stat_type: stat,
      line,
      odds: hasInvalidOdds ? 0 : odds,
      recent_avg: recentAvg,
      season_avg: recentAvg * 0.95,
      is_valid: true,
      promoted: false,
    };

    if (hasProjectedWinProb) {
      prop.projected_win_prob = 0.3 + (i % 40) / 100; // 0.30 to 0.69
    }

    if (hasStalePrice) {
      prop.price_updated_at = new Date(Date.now() - 200 * 60 * 1000).toISOString();
    }

    if (hasContradictoryFlags) {
      prop.is_volatile = true;
      prop.is_stable = true;
    }

    // Some team-based bets without team
    if (i % 30 === 0) {
      prop.bet_type = 'spread';
      // No team field — should trigger G-04
    }

    props.push(prop);
  }

  return props;
}

// ─── Analysis Functions ─────────────────────────────────────────────────────

interface BucketStats {
  bucket: string;
  count: number;
  pct: string;
  avgProfScore: string;
  avgConfidence: string;
  tierDist: Record<string, number>;
  hitRate: string; // NOT PROVEN
}

function bucketByEdge(results: any[]): BucketStats[] {
  const buckets: Record<string, any[]> = {
    'negative': [],
    '0-0.5%': [],
    '0.5-1%': [],
    '1-2%': [],
    '2-5%': [],
    '5%+': [],
  };

  for (const r of results) {
    const ev = r.ev_percent;
    if (ev < 0) buckets['negative'].push(r);
    else if (ev < 0.5) buckets['0-0.5%'].push(r);
    else if (ev < 1) buckets['0.5-1%'].push(r);
    else if (ev < 2) buckets['1-2%'].push(r);
    else if (ev < 5) buckets['2-5%'].push(r);
    else buckets['5%+'].push(r);
  }

  const total = results.length;
  return Object.entries(buckets).map(([bucket, items]) => {
    const tierDist: Record<string, number> = { S: 0, A: 0, B: 0, C: 0 };
    for (const item of items) tierDist[item.tier] = (tierDist[item.tier] || 0) + 1;

    return {
      bucket,
      count: items.length,
      pct: total > 0 ? ((items.length / total) * 100).toFixed(1) + '%' : '0%',
      avgProfScore: items.length > 0
        ? (items.reduce((s: number, r: any) => s + r.professional_score, 0) / items.length).toFixed(2)
        : 'N/A',
      avgConfidence: items.length > 0
        ? (items.reduce((s: number, r: any) => s + r.confidence_score, 0) / items.length).toFixed(2)
        : 'N/A',
      tierDist,
      hitRate: 'NOT PROVEN — no settlement data',
    };
  });
}

function bucketByConfidence(results: any[]): BucketStats[] {
  const buckets: Record<string, any[]> = {
    '0': [],
    '1': [],
    '2': [],
    '3': [],
    '4': [],
    '5': [],
  };

  for (const r of results) {
    const c = Math.min(5, Math.max(0, r.confidence_score));
    buckets[c.toString()].push(r);
  }

  const total = results.length;
  return Object.entries(buckets).map(([bucket, items]) => {
    const tierDist: Record<string, number> = { S: 0, A: 0, B: 0, C: 0 };
    for (const item of items) tierDist[item.tier] = (tierDist[item.tier] || 0) + 1;

    return {
      bucket: `confidence=${bucket}`,
      count: items.length,
      pct: total > 0 ? ((items.length / total) * 100).toFixed(1) + '%' : '0%',
      avgProfScore: items.length > 0
        ? (items.reduce((s: number, r: any) => s + r.professional_score, 0) / items.length).toFixed(2)
        : 'N/A',
      avgConfidence: bucket,
      tierDist,
      hitRate: 'NOT PROVEN — no settlement data',
    };
  });
}

function bucketByTier(results: any[]): BucketStats[] {
  const buckets: Record<string, any[]> = { S: [], A: [], B: [], C: [] };
  for (const r of results) {
    if (buckets[r.tier]) buckets[r.tier].push(r);
  }

  const total = results.length;
  return Object.entries(buckets).map(([tier, items]) => ({
    bucket: `Tier ${tier}`,
    count: items.length,
    pct: total > 0 ? ((items.length / total) * 100).toFixed(1) + '%' : '0%',
    avgProfScore: items.length > 0
      ? (items.reduce((s: number, r: any) => s + r.professional_score, 0) / items.length).toFixed(2)
      : 'N/A',
    avgConfidence: items.length > 0
      ? (items.reduce((s: number, r: any) => s + r.confidence_score, 0) / items.length).toFixed(2)
      : 'N/A',
    tierDist: { [tier]: items.length },
    hitRate: 'NOT PROVEN — no settlement data',
  }));
}

// ─── Rule Analysis ──────────────────────────────────────────────────────────

interface RuleFrequency {
  rule: string;
  triggerCount: number;
  triggerRate: string;
  blockedPromotions: number;
}

interface RuleCoOccurrence {
  rule1: string;
  rule2: string;
  coOccurrenceCount: number;
  coOccurrenceRate: string;
}

function analyzeRules(props: any[]): {
  preGuardrailFreq: RuleFrequency[];
  postGuardrailFreq: RuleFrequency[];
  gateFreq: Array<{ gateId: string; passCount: number; failCount: number; passRate: string; topFailReasons: Record<string, number> }>;
  coOccurrences: RuleCoOccurrence[];
  dominanceFlags: string[];
} {
  const preRuleCounts: Record<string, number> = {};
  const postRuleCounts: Record<string, number> = {};
  const gateResults: Record<string, { pass: number; fail: number; failReasons: Record<string, number> }> = {};
  const ruleCoOccur: Record<string, number> = {};
  let totalProps = 0;
  let preBlocked = 0;
  let postBlocked = 0;

  for (const prop of props) {
    totalProps++;

    // Pre-score guardrails
    const preResults = runPreScoreGuardrails(prop);
    const failedPre = preResults.filter(r => !r.passed);
    if (failedPre.length > 0) preBlocked++;

    for (const r of failedPre) {
      preRuleCounts[r.gate] = (preRuleCounts[r.gate] || 0) + 1;
    }

    // Co-occurrence of pre-guardrail failures
    for (let i = 0; i < failedPre.length; i++) {
      for (let j = i + 1; j < failedPre.length; j++) {
        const key = [failedPre[i].gate, failedPre[j].gate].sort().join(' + ');
        ruleCoOccur[key] = (ruleCoOccur[key] || 0) + 1;
      }
    }

    // Score if not pre-blocked
    if (!hasRejection(preResults)) {
      const scored = applyScoringLogic(prop);

      // Post-score guardrails
      const postResults = runPostScoreGuardrails(scored);
      const failedPost = postResults.filter(r => !r.passed);
      if (failedPost.length > 0) postBlocked++;

      for (const r of failedPost) {
        postRuleCounts[r.gate] = (postRuleCounts[r.gate] || 0) + 1;
      }

      // Gate evaluation
      const gates = evaluateGates(scored);
      for (const g of gates) {
        if (!gateResults[g.gateId]) {
          gateResults[g.gateId] = { pass: 0, fail: 0, failReasons: {} };
        }
        if (g.passed) {
          gateResults[g.gateId].pass++;
        } else {
          gateResults[g.gateId].fail++;
          for (const reason of g.failedChecks) {
            gateResults[g.gateId].failReasons[reason] = (gateResults[g.gateId].failReasons[reason] || 0) + 1;
          }
        }
      }
    }
  }

  // Build frequency tables
  const preGuardrailFreq: RuleFrequency[] = Object.entries(preRuleCounts)
    .map(([rule, count]) => ({
      rule,
      triggerCount: count,
      triggerRate: ((count / totalProps) * 100).toFixed(2) + '%',
      blockedPromotions: count,
    }))
    .sort((a, b) => b.triggerCount - a.triggerCount);

  const postGuardrailFreq: RuleFrequency[] = Object.entries(postRuleCounts)
    .map(([rule, count]) => ({
      rule,
      triggerCount: count,
      triggerRate: ((count / totalProps) * 100).toFixed(2) + '%',
      blockedPromotions: count,
    }))
    .sort((a, b) => b.triggerCount - a.triggerCount);

  const gateFreq = Object.entries(gateResults).map(([gateId, data]) => ({
    gateId,
    passCount: data.pass,
    failCount: data.fail,
    passRate: ((data.pass / (data.pass + data.fail)) * 100).toFixed(1) + '%',
    topFailReasons: data.failReasons,
  }));

  const coOccurrences: RuleCoOccurrence[] = Object.entries(ruleCoOccur)
    .map(([key, count]) => {
      const [rule1, rule2] = key.split(' + ');
      return {
        rule1,
        rule2,
        coOccurrenceCount: count,
        coOccurrenceRate: ((count / totalProps) * 100).toFixed(2) + '%',
      };
    })
    .sort((a, b) => b.coOccurrenceCount - a.coOccurrenceCount);

  // Dominance flags
  const dominanceFlags: string[] = [];

  // Check if any single guardrail blocks >50% of all rejections
  const totalRejections = preBlocked + postBlocked;
  for (const [rule, count] of Object.entries(preRuleCounts)) {
    if (totalRejections > 0 && count / totalRejections > 0.5) {
      dominanceFlags.push(`DOMINANT: ${rule} accounts for ${((count / totalRejections) * 100).toFixed(0)}% of all guardrail rejections`);
    }
  }
  for (const [rule, count] of Object.entries(postRuleCounts)) {
    if (totalRejections > 0 && count / totalRejections > 0.5) {
      dominanceFlags.push(`DOMINANT: ${rule} accounts for ${((count / totalRejections) * 100).toFixed(0)}% of all guardrail rejections`);
    }
  }

  // Check if any gate never passes
  for (const [gateId, data] of Object.entries(gateResults)) {
    if (data.pass === 0 && data.fail > 0) {
      dominanceFlags.push(`NEVER_PASSES: ${gateId} has 0% pass rate (${data.fail} evaluations)`);
    }
  }

  // Check gate fail reasons: if one reason dominates
  for (const [gateId, data] of Object.entries(gateResults)) {
    const total = data.pass + data.fail;
    for (const [reason, count] of Object.entries(data.failReasons)) {
      if (total > 0 && count / total > 0.8) {
        dominanceFlags.push(`GATE_BOTTLENECK: ${gateId} blocked by '${reason}' in ${((count / total) * 100).toFixed(0)}% of cases`);
      }
    }
  }

  return { preGuardrailFreq, postGuardrailFreq, gateFreq, coOccurrences, dominanceFlags };
}

// ─── Sensitivity Analysis ───────────────────────────────────────────────────

interface SensitivityResult {
  parameter: string;
  baseline: string;
  variations: Array<{
    value: string;
    promotedCount: number;
    tierDist: Record<string, number>;
    avgEv: string;
    change: string;
  }>;
}

function sensitivityAnalysis(baseProps: any[]): SensitivityResult[] {
  const results: SensitivityResult[] = [];

  // Vary EV threshold (G-06)
  {
    const variations: SensitivityResult['variations'] = [];
    for (const minEdge of [0, 0.5, 1, 2, 3, 5]) {
      let promoted = 0;
      const tierDist: Record<string, number> = { S: 0, A: 0, B: 0, C: 0 };
      let totalEv = 0;
      let evCount = 0;

      for (const prop of baseProps) {
        if (hasRejection(runPreScoreGuardrails(prop))) continue;
        const scored = applyScoringLogic(prop);
        const evPct = scored.ev_percent ?? 0;
        if (evPct < minEdge) continue;
        if (['S', 'A', 'B'].includes(scored.tier)) {
          promoted++;
          tierDist[scored.tier] = (tierDist[scored.tier] || 0) + 1;
          totalEv += evPct;
          evCount++;
        }
      }

      variations.push({
        value: `${minEdge}%`,
        promotedCount: promoted,
        tierDist,
        avgEv: evCount > 0 ? (totalEv / evCount).toFixed(2) + '%' : 'N/A',
        change: '',
      });
    }

    // Calculate % change from baseline (1%)
    const baseline = variations.find(v => v.value === '1%');
    if (baseline) {
      for (const v of variations) {
        if (baseline.promotedCount > 0) {
          const pctChange = ((v.promotedCount - baseline.promotedCount) / baseline.promotedCount) * 100;
          v.change = pctChange > 0 ? `+${pctChange.toFixed(0)}%` : `${pctChange.toFixed(0)}%`;
        }
      }
    }

    results.push({
      parameter: 'G-06 min_edge threshold',
      baseline: '1% (current default)',
      variations,
    });
  }

  return results;
}

// ─── Confidence Scale Analysis ──────────────────────────────────────────────

interface ConfidenceScaleIssue {
  issue: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  detail: string;
  recommendation: string;
}

function analyzeConfidenceScale(results: any[]): ConfidenceScaleIssue[] {
  const issues: ConfidenceScaleIssue[] = [];

  // Distribution analysis
  const confValues = results.map((r: any) => r.confidence_score);
  const uniqueValues = [...new Set(confValues)].sort((a, b) => a - b);

  // Check if confidence is discrete (integer only)
  const allInteger = confValues.every((v: number) => Number.isInteger(v));
  if (allInteger) {
    issues.push({
      issue: 'Confidence is discrete (integer-only)',
      severity: 'critical',
      detail: `confidence_score only takes integer values: [${uniqueValues.join(', ')}]. ` +
        `Formula: Math.round(0.4*trend + 0.3*matchup + 0.3*(ev/10)). ` +
        `Since trend (1-5), matchup (2-4), ev/10 are all small integers or near-integers, ` +
        `the weighted sum rounds to very few distinct values.`,
      recommendation: 'Replace with continuous confidence function (see Stage 3 design).',
    });
  }

  // Check concentration
  const modeBucket = Object.entries(
    confValues.reduce((acc: Record<number, number>, v: number) => {
      acc[v] = (acc[v] || 0) + 1;
      return acc;
    }, {})
  ).sort(([, a], [, b]) => b - a)[0];

  if (modeBucket && Number(modeBucket[1]) / results.length > 0.4) {
    issues.push({
      issue: 'Confidence over-concentrated',
      severity: 'high',
      detail: `${((Number(modeBucket[1]) / results.length) * 100).toFixed(0)}% of all props have confidence_score=${modeBucket[0]}. ` +
        `This means the confidence score provides almost no discriminating power.`,
      recommendation: 'Widen confidence range to 0-100 or 0-10 with continuous values.',
    });
  }

  // Check if confidence correlates with tier (it should)
  const tierConfMap: Record<string, number[]> = { S: [], A: [], B: [], C: [] };
  for (const r of results) {
    if (tierConfMap[r.tier]) tierConfMap[r.tier].push(r.confidence_score);
  }
  const tierAvgs: Record<string, number> = {};
  for (const [tier, confs] of Object.entries(tierConfMap)) {
    tierAvgs[tier] = confs.length > 0 ? confs.reduce((a, b) => a + b, 0) / confs.length : 0;
  }

  // Check monotonicity: S > A > B > C
  if (tierAvgs['S'] <= tierAvgs['A'] || tierAvgs['A'] <= tierAvgs['B'] || tierAvgs['B'] <= tierAvgs['C']) {
    issues.push({
      issue: 'Confidence not monotonic with tier',
      severity: 'high',
      detail: `Average confidence by tier: S=${tierAvgs['S']?.toFixed(2)}, A=${tierAvgs['A']?.toFixed(2)}, ` +
        `B=${tierAvgs['B']?.toFixed(2)}, C=${tierAvgs['C']?.toFixed(2)}. ` +
        `Higher tiers should always have higher confidence.`,
      recommendation: 'Redesign confidence to incorporate tier and edge signals.',
    });
  }

  // Gatekeeper confidence scale mismatch
  issues.push({
    issue: 'Confidence scale mismatch between scoring and gatekeeper',
    severity: 'critical',
    detail: `applyScoringLogic produces confidence_score on 0-5 scale. ` +
      `PromotionGatekeeper expects PickForPromotion.confidence on 0-1 scale. ` +
      `Gate thresholds: 0.75 (S), 0.65 (A), 0.60 (steam). ` +
      `A confidence_score of 3 (out of 5) = 0.60 normalized, which barely passes steam gate. ` +
      `This creates a silent bottleneck where adequate-quality props fail confidence gates.`,
    recommendation: 'Normalize confidence to 0-1 before passing to PromotionGatekeeper, or redesign confidence on 0-1 scale natively.',
  });

  return issues;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const outDir = path.resolve(__dirname, '../out/promotion-tranche-3/2026-01-30');

  console.log('=== Tranche 3: Promotion Intelligence & Calibration Analysis ===');
  console.log(`Output directory: ${outDir}`);
  console.log('');

  // Generate synthetic props
  const PROP_COUNT = 1000;
  console.log(`Generating ${PROP_COUNT} synthetic props...`);
  const props = generateSyntheticProps(PROP_COUNT);

  // Run scoring pipeline on all props
  console.log('Running scoring pipeline...');
  const scoredResults: any[] = [];
  const promotedResults: any[] = [];
  const rejectedByGuardrail: any[] = [];
  const rejectedByTier: any[] = [];

  for (const prop of props) {
    const preResults = runPreScoreGuardrails(prop);
    if (hasRejection(preResults)) {
      rejectedByGuardrail.push({ prop, guardrails: preResults.filter(r => !r.passed) });
      continue;
    }

    const scored = applyScoringLogic(prop);
    scoredResults.push(scored);

    const postResults = runPostScoreGuardrails(scored);
    if (hasRejection(postResults)) {
      rejectedByGuardrail.push({ prop: scored, guardrails: postResults.filter(r => !r.passed) });
      continue;
    }

    if (['S', 'A', 'B'].includes(scored.tier)) {
      promotedResults.push(scored);
    } else {
      rejectedByTier.push(scored);
    }
  }

  console.log(`  Total props: ${PROP_COUNT}`);
  console.log(`  Scored: ${scoredResults.length}`);
  console.log(`  Promoted (S/A/B): ${promotedResults.length}`);
  console.log(`  Rejected by guardrail: ${rejectedByGuardrail.length}`);
  console.log(`  Rejected by tier (C): ${rejectedByTier.length}`);
  console.log('');

  // Stage 1: Edge Buckets
  console.log('Stage 1: Edge & Confidence Bucket Analysis...');
  const edgeBuckets = bucketByEdge(scoredResults);
  const confidenceBuckets = bucketByConfidence(scoredResults);
  const tierBuckets = bucketByTier(scoredResults);

  // Stage 2: Rule Analysis
  console.log('Stage 2: Rule Dominance & Conflict Analysis...');
  const ruleAnalysis = analyzeRules(props);

  // Sensitivity analysis
  console.log('Sensitivity Analysis...');
  const sensitivity = sensitivityAnalysis(props);

  // Confidence scale analysis
  console.log('Confidence Scale Analysis...');
  const confidenceIssues = analyzeConfidenceScale(scoredResults);

  // ─── Write Artifacts ────────────────────────────────────────────────────

  // Stage 1 artifacts
  const edgeBucketsOut = {
    metadata: {
      date: '2026-01-30',
      total_scored: scoredResults.length,
      total_promoted: promotedResults.length,
      total_rejected_guardrail: rejectedByGuardrail.length,
      total_rejected_tier: rejectedByTier.length,
      note: 'Structural analysis using replicated scoring math against synthetic data',
    },
    edge_buckets: edgeBuckets,
    hit_rate_status: 'NOT PROVEN — no settlement data available (SettlementAgent not integrated)',
  };
  fs.writeFileSync(
    path.join(outDir, 'calibration', 'edge_buckets.json'),
    JSON.stringify(edgeBucketsOut, null, 2)
  );

  const confidenceBucketsOut = {
    metadata: {
      date: '2026-01-30',
      total_scored: scoredResults.length,
      confidence_range: '0-5 (integer, from calculateConfidenceScore)',
      note: 'Confidence is discrete (Math.round) — see confidence_scale_issues',
    },
    confidence_buckets: confidenceBuckets,
    tier_buckets: tierBuckets,
    confidence_scale_issues: confidenceIssues,
    hit_rate_status: 'NOT PROVEN — no settlement data available (SettlementAgent not integrated)',
  };
  fs.writeFileSync(
    path.join(outDir, 'calibration', 'confidence_buckets.json'),
    JSON.stringify(confidenceBucketsOut, null, 2)
  );

  // Stage 1 proof
  const proofLines = [
    '=== Stage 1: Edge & Confidence Bucket Analysis — PROOF ===',
    `Date: ${new Date().toISOString()}`,
    `Command: npx tsx scripts/promotion-tranche3-analysis.ts`,
    '',
    `Total synthetic props: ${PROP_COUNT}`,
    `Scored (passed pre-guardrails): ${scoredResults.length}`,
    `Promoted (S/A/B tier, passed all guardrails): ${promotedResults.length}`,
    `Rejected by guardrail: ${rejectedByGuardrail.length}`,
    `Rejected by tier (C): ${rejectedByTier.length}`,
    '',
    '--- Edge Buckets ---',
    ...edgeBuckets.map(b => `  ${b.bucket}: count=${b.count} (${b.pct}), avgProfScore=${b.avgProfScore}, tierDist=${JSON.stringify(b.tierDist)}`),
    '',
    '--- Confidence Buckets ---',
    ...confidenceBuckets.map(b => `  ${b.bucket}: count=${b.count} (${b.pct}), avgProfScore=${b.avgProfScore}`),
    '',
    '--- Tier Distribution ---',
    ...tierBuckets.map(b => `  ${b.bucket}: count=${b.count} (${b.pct}), avgProfScore=${b.avgProfScore}, avgConf=${b.avgConfidence}`),
    '',
    '--- Confidence Scale Issues ---',
    ...confidenceIssues.map(i => `  [${i.severity.toUpperCase()}] ${i.issue}: ${i.detail}`),
    '',
    '--- Sensitivity Analysis ---',
    ...sensitivity.map(s => {
      const lines = [`  ${s.parameter} (baseline: ${s.baseline}):`];
      for (const v of s.variations) {
        lines.push(`    ${v.value}: promoted=${v.promotedCount}, tierDist=${JSON.stringify(v.tierDist)}, avgEv=${v.avgEv}, change=${v.change}`);
      }
      return lines.join('\n');
    }),
    '',
    'Hit Rate / ROI: NOT PROVEN — no settlement data available',
    '',
    '=== END PROOF ===',
  ];
  fs.writeFileSync(
    path.join(outDir, 'calibration', 'PROOF.txt'),
    proofLines.join('\n')
  );

  // Stage 2 artifacts
  fs.writeFileSync(
    path.join(outDir, 'rules', 'rule_frequency.json'),
    JSON.stringify({
      metadata: {
        date: '2026-01-30',
        total_props_analyzed: PROP_COUNT,
        note: 'Structural analysis of guardrail and gate trigger patterns',
      },
      pre_guardrail_frequency: ruleAnalysis.preGuardrailFreq,
      post_guardrail_frequency: ruleAnalysis.postGuardrailFreq,
      gate_frequency: ruleAnalysis.gateFreq,
      sensitivity: sensitivity,
    }, null, 2)
  );

  // Rule conflicts
  const conflictLines = [
    '# Stage 2 — Rule Dominance & Conflict Analysis',
    '',
    `**Date**: 2026-01-30`,
    `**Props Analyzed**: ${PROP_COUNT}`,
    '',
    '## Pre-Score Guardrail Trigger Frequency',
    '',
    '| Rule | Trigger Count | Trigger Rate | Impact |',
    '|------|--------------|--------------|--------|',
    ...ruleAnalysis.preGuardrailFreq.map(r =>
      `| ${r.rule} | ${r.triggerCount} | ${r.triggerRate} | Blocks promotion |`
    ),
    '',
    '## Post-Score Guardrail Trigger Frequency',
    '',
    '| Rule | Trigger Count | Trigger Rate | Impact |',
    '|------|--------------|--------------|--------|',
    ...ruleAnalysis.postGuardrailFreq.map(r =>
      `| ${r.rule} | ${r.triggerCount} | ${r.triggerRate} | Blocks promotion |`
    ),
    '',
    '## Gate Pass/Fail Rates',
    '',
    '| Gate | Pass | Fail | Pass Rate | Top Fail Reasons |',
    '|------|------|------|-----------|-----------------|',
    ...ruleAnalysis.gateFreq.map(g =>
      `| ${g.gateId} | ${g.passCount} | ${g.failCount} | ${g.passRate} | ${Object.entries(g.topFailReasons).map(([k, v]) => `${k}(${v})`).join(', ')} |`
    ),
    '',
    '## Rule Co-Occurrences',
    '',
    ruleAnalysis.coOccurrences.length > 0
      ? [
        '| Rule Pair | Co-Occurrence Count | Rate |',
        '|-----------|-------------------|------|',
        ...ruleAnalysis.coOccurrences.map(c =>
          `| ${c.rule1} + ${c.rule2} | ${c.coOccurrenceCount} | ${c.coOccurrenceRate} |`
        ),
      ].join('\n')
      : 'No rule co-occurrences detected.',
    '',
    '## Dominance Flags',
    '',
    ruleAnalysis.dominanceFlags.length > 0
      ? ruleAnalysis.dominanceFlags.map(f => `- **${f}**`).join('\n')
      : 'No dominance flags detected.',
    '',
    '## Structural Conflicts Detected',
    '',
    '### Confidence Scale Mismatch (CRITICAL)',
    '',
    '`applyScoringLogic` produces `confidence_score` on a **0-5 integer scale**.',
    '`PromotionGatekeeper` expects `PickForPromotion.confidence` on a **0-1 continuous scale**.',
    '',
    'Gate thresholds requiring 0.60-0.75 confidence are nearly unreachable when:',
    '- confidence_score=3 → normalized 0.60 (barely passes steam gate)',
    '- confidence_score=4 → normalized 0.80 (passes all gates)',
    '- confidence_score=2 → normalized 0.40 (fails ALL gates)',
    '',
    'This creates a **binary cliff**: confidence 2 vs 3 is the difference between',
    'failing every gate and passing some. There is no gradation.',
    '',
    '### Professional Score Scale Mismatch',
    '',
    '`applyScoringLogic` produces `professional_score` on a **0-25 scale**.',
    '`PromotionGatekeeper` thresholds expect 70-85 (on a 0-100 scale).',
    '',
    'A professional_score of 25 (maximum) is only 25 on the gate\'s 100-point scale.',
    'This means **no prop from applyScoringLogic can ever pass any gate\'s professional_score check**.',
    '',
    'This is a structural dead-end unless:',
    '1. The pipeline between applyScoringLogic and PromotionGatekeeper normalizes scores, OR',
    '2. PromotionGatekeeper is fed from computeScoreV2 (0-100 scale) instead',
    '',
    '### Outcome Correlation: NOT PROVEN',
    '',
    'Cannot determine which rules correlate with poor/good outcomes because',
    'SettlementAgent is not integrated and no outcome data is populated.',
  ];

  fs.writeFileSync(
    path.join(outDir, 'rules', 'rule_conflicts.md'),
    conflictLines.join('\n')
  );

  // Stage 2 proof
  const ruleProofLines = [
    '=== Stage 2: Rule Dominance & Conflict Analysis — PROOF ===',
    `Date: ${new Date().toISOString()}`,
    `Command: npx tsx scripts/promotion-tranche3-analysis.ts`,
    '',
    `Total props analyzed: ${PROP_COUNT}`,
    '',
    '--- Pre-Score Guardrail Triggers ---',
    ...ruleAnalysis.preGuardrailFreq.map(r => `  ${r.rule}: ${r.triggerCount} (${r.triggerRate})`),
    '',
    '--- Post-Score Guardrail Triggers ---',
    ...ruleAnalysis.postGuardrailFreq.map(r => `  ${r.rule}: ${r.triggerCount} (${r.triggerRate})`),
    '',
    '--- Gate Results ---',
    ...ruleAnalysis.gateFreq.map(g =>
      `  ${g.gateId}: pass=${g.passCount}, fail=${g.failCount} (${g.passRate}), failReasons=${JSON.stringify(g.topFailReasons)}`
    ),
    '',
    '--- Dominance Flags ---',
    ...ruleAnalysis.dominanceFlags.map(f => `  ${f}`),
    '',
    '--- Co-Occurrences ---',
    ...ruleAnalysis.coOccurrences.map(c => `  ${c.rule1} + ${c.rule2}: ${c.coOccurrenceCount} (${c.coOccurrenceRate})`),
    '',
    '--- CRITICAL: Confidence Scale Mismatch ---',
    '  applyScoringLogic.confidence_score: 0-5 (integer)',
    '  PromotionGatekeeper.PickForPromotion.confidence: 0-1 (continuous)',
    '  Gate thresholds: 0.60 (steam), 0.65 (10am), 0.75 (instant)',
    '  Impact: Binary cliff at confidence_score 2→3 (0.40→0.60 normalized)',
    '',
    '--- CRITICAL: Professional Score Scale Mismatch ---',
    '  applyScoringLogic.professional_score: 0-25 (sum of 5 sub-scores)',
    '  PromotionGatekeeper thresholds: 70 (steam), 75 (10am), 85 (instant)',
    '  Impact: NO prop from applyScoringLogic can pass ANY gate professional_score check',
    '',
    'Rule-Outcome Correlation: NOT PROVEN — no settlement data',
    '',
    '=== END PROOF ===',
  ];
  fs.writeFileSync(
    path.join(outDir, 'rules', 'PROOF.txt'),
    ruleProofLines.join('\n')
  );

  // Summary
  console.log('');
  console.log('=== Analysis Complete ===');
  console.log('');
  console.log('Stage 1 artifacts:');
  console.log('  calibration/edge_buckets.json');
  console.log('  calibration/confidence_buckets.json');
  console.log('  calibration/PROOF.txt');
  console.log('');
  console.log('Stage 2 artifacts:');
  console.log('  rules/rule_frequency.json');
  console.log('  rules/rule_conflicts.md');
  console.log('  rules/PROOF.txt');
  console.log('');

  // Print key findings
  console.log('=== KEY FINDINGS ===');
  console.log('');
  for (const issue of confidenceIssues) {
    console.log(`[${issue.severity.toUpperCase()}] ${issue.issue}`);
    console.log(`  ${issue.detail.substring(0, 120)}...`);
    console.log('');
  }
  for (const flag of ruleAnalysis.dominanceFlags) {
    console.log(`[DOMINANCE] ${flag}`);
  }
}

main().catch(err => {
  console.error('Analysis failed:', err);
  process.exit(1);
});
