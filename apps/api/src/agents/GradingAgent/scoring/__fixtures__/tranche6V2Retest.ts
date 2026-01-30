/* eslint-disable max-lines, max-lines-per-function, complexity, no-console */
/**
 * tranche6V2Retest.ts — Tranche 6 V2 Shadow Readiness Re-test
 *
 * Re-runs the Tranche 5 analysis with Tranche 6 fixes applied:
 *   Fix 1B: validateWeightsV2() always used → sport-specific weights loaded correctly
 *   Fix 2B: 8 capper features changed from 'neutral' to 'excluded' → no 50-compression
 *
 * Outputs to: out/promotion-tranche-6/2026-02-16/3b_v2_retest/
 *
 * Usage:
 *   npx tsx apps/api/src/agents/GradingAgent/scoring/__fixtures__/tranche6V2Retest.ts
 */

import * as fs from 'fs';
import * as path from 'path';

import { computeScoreV2 } from '../computeScoreV2';
import { calculateConfidenceScore } from '../confidenceScore';
import { determineTier } from '../determineTier';
import { calculateExpectedValue } from '../expectedValue';
import { calculateLineValueScore } from '../lineValueScore';
import { calculateMatchupScore } from '../matchupScore';
import { calculateNormalizedConfidence } from '../normalizedConfidence';
import { calculateRoleStabilityScore } from '../roleStabilityScore';
import { normalizeScore } from '../TierScale';
import { calculateTrendScore } from '../trendScore';

import type { GradingFeatureSet } from '../../../../types/GradingFeatureSet';

// ─── Output ──────────────────────────────────────────────────────────────────

const repoRoot = path.resolve(__dirname, '../../../../../../../');
const outDir = path.join(repoRoot, 'out/promotion-tranche-6/2026-02-16/3b_v2_retest');

// ─── Pick Data (same 40 picks from Tranche 5) ───────────────────────────────

interface PickInput {
  id: string;
  sport: string;
  player: string;
  market: string;
  description: string;
  features: Partial<GradingFeatureSet>;
}

const PICKS: PickInput[] = [
  // NBA (10)
  {
    id: 'NBA-001',
    sport: 'NBA',
    player: 'Luka Doncic',
    market: 'points',
    description: 'Elite scorer, strong matchup, +EV',
    features: {
      expectedValue: 18,
      matchupRating: 88,
      playerForm: 90,
      sharpMoney: 80,
      closingLineValue: 6,
      lineMovement: 3,
    },
  },
  {
    id: 'NBA-002',
    sport: 'NBA',
    player: 'Jayson Tatum',
    market: 'rebounds',
    description: 'Above avg rebounder, moderate EV',
    features: { expectedValue: 8, matchupRating: 65, playerForm: 72, sharpMoney: 60 },
  },
  {
    id: 'NBA-003',
    sport: 'NBA',
    player: 'Tyrese Haliburton',
    market: 'assists',
    description: 'Pass-first guard, high volume',
    features: {
      expectedValue: 12,
      matchupRating: 75,
      playerForm: 78,
      sharpMoney: 70,
      volumeProfile: 70,
      closingLineValue: 4,
    },
  },
  {
    id: 'NBA-004',
    sport: 'NBA',
    player: 'Bench Player',
    market: 'points',
    description: 'Low-minute player, negative EV',
    features: {
      expectedValue: -12,
      matchupRating: 35,
      playerForm: 40,
      sharpMoney: 30,
      volumeProfile: 25,
      closingLineValue: -3,
    },
  },
  {
    id: 'NBA-005',
    sport: 'NBA',
    player: 'Anthony Davis',
    market: 'blocks',
    description: 'Elite defender, niche market',
    features: {
      expectedValue: 15,
      matchupRating: 80,
      playerForm: 85,
      injuryImpact: 6,
      sharpMoney: 75,
      correlationRisk: 0.25,
    },
  },
  {
    id: 'NBA-006',
    sport: 'NBA',
    player: 'Shai Gilgeous-Alexander',
    market: 'points',
    description: 'MVP candidate, heavy favorite',
    features: {
      expectedValue: 20,
      matchupRating: 92,
      playerForm: 95,
      sharpMoney: 85,
      closingLineValue: 7,
    },
  },
  {
    id: 'NBA-007',
    sport: 'NBA',
    player: "De'Aaron Fox",
    market: 'steals',
    description: 'Quick guard, high variance',
    features: {
      expectedValue: 4,
      matchupRating: 58,
      playerForm: 62,
      volatility: 7,
      correlationRisk: 0.3,
    },
  },
  {
    id: 'NBA-008',
    sport: 'NBA',
    player: 'Nikola Jokic',
    market: 'assists',
    description: 'Triple-double threat',
    features: {
      expectedValue: 14,
      matchupRating: 82,
      playerForm: 88,
      sharpMoney: 78,
      closingLineValue: 5,
      paceImpact: 16,
    },
  },
  {
    id: 'NBA-009',
    sport: 'NBA',
    player: 'Random Role Player',
    market: 'threes',
    description: 'Minimal data, fallback-heavy',
    features: { expectedValue: -5, matchupRating: 45 },
  },
  {
    id: 'NBA-010',
    sport: 'NBA',
    player: 'Giannis Antetokounmpo',
    market: 'PRA',
    description: 'Dominant combo stat',
    features: {
      expectedValue: 10,
      matchupRating: 78,
      playerForm: 82,
      sharpMoney: 68,
      lineMovement: 2,
    },
  },
  // MLB (10)
  {
    id: 'MLB-001',
    sport: 'MLB',
    player: 'Shohei Ohtani',
    market: 'strikeouts',
    description: 'Elite pitcher, high K rate',
    features: {
      expectedValue: 16,
      matchupRating: 90,
      playerForm: 92,
      weatherImpact: 8,
      sharpMoney: 82,
      closingLineValue: 5,
    },
  },
  {
    id: 'MLB-002',
    sport: 'MLB',
    player: 'Aaron Judge',
    market: 'total_bases',
    description: 'Power hitter, strong park',
    features: {
      expectedValue: 10,
      matchupRating: 75,
      playerForm: 80,
      weatherImpact: 5,
      venueAdvantage: 18,
      sharpMoney: 70,
    },
  },
  {
    id: 'MLB-003',
    sport: 'MLB',
    player: 'Mookie Betts',
    market: 'hits',
    description: 'Contact hitter, moderate EV',
    features: { expectedValue: 6, matchupRating: 68, playerForm: 70, sharpMoney: 58 },
  },
  {
    id: 'MLB-004',
    sport: 'MLB',
    player: 'Backup Catcher',
    market: 'hits',
    description: 'Low batting avg, negative EV',
    features: { expectedValue: -15, matchupRating: 30, playerForm: 28, sharpMoney: 25 },
  },
  {
    id: 'MLB-005',
    sport: 'MLB',
    player: 'Gerrit Cole',
    market: 'outs',
    description: 'Quality start, heavy rain risk',
    features: {
      expectedValue: 8,
      matchupRating: 72,
      playerForm: 75,
      weatherImpact: 12,
      injuryImpact: 4,
    },
  },
  {
    id: 'MLB-006',
    sport: 'MLB',
    player: 'Juan Soto',
    market: 'walks',
    description: 'Elite plate discipline',
    features: {
      expectedValue: 5,
      matchupRating: 60,
      playerForm: 65,
      volatility: 6,
      sharpMoney: 55,
    },
  },
  {
    id: 'MLB-007',
    sport: 'MLB',
    player: 'Corbin Burnes',
    market: 'strikeouts',
    description: 'Solid pitcher, warm weather',
    features: {
      expectedValue: 11,
      matchupRating: 78,
      playerForm: 76,
      weatherImpact: 6,
      sharpMoney: 72,
      closingLineValue: 3,
    },
  },
  {
    id: 'MLB-008',
    sport: 'MLB',
    player: 'Ronald Acuna Jr',
    market: 'stolen_bases',
    description: 'Speed threat, high variance',
    features: {
      expectedValue: 3,
      matchupRating: 55,
      playerForm: 58,
      volatility: 8,
      correlationRisk: 0.35,
    },
  },
  {
    id: 'MLB-009',
    sport: 'MLB',
    player: 'Zack Wheeler',
    market: 'earned_runs',
    description: 'Ace pitcher, opposing strong lineup',
    features: {
      expectedValue: -2,
      matchupRating: 82,
      playerForm: 80,
      sharpMoney: 62,
      closingLineValue: 1,
    },
  },
  {
    id: 'MLB-010',
    sport: 'MLB',
    player: 'Freddie Freeman',
    market: 'RBI',
    description: 'Cleanup hitter, Coors boost',
    features: {
      expectedValue: 13,
      matchupRating: 76,
      playerForm: 78,
      venueAdvantage: 22,
      sharpMoney: 74,
    },
  },
  // NFL (10)
  {
    id: 'NFL-001',
    sport: 'NFL',
    player: 'Patrick Mahomes',
    market: 'passing_yards',
    description: 'Elite QB, dome game',
    features: {
      expectedValue: 15,
      matchupRating: 88,
      playerForm: 90,
      paceImpact: 18,
      sharpMoney: 80,
      closingLineValue: 5,
    },
  },
  {
    id: 'NFL-002',
    sport: 'NFL',
    player: 'Derrick Henry',
    market: 'rushing_yards',
    description: 'Workhorse RB, plus matchup',
    features: {
      expectedValue: 10,
      matchupRating: 75,
      playerForm: 78,
      paceImpact: 12,
      motivationalFactors: 18,
      sharpMoney: 65,
    },
  },
  {
    id: 'NFL-003',
    sport: 'NFL',
    player: 'Travis Kelce',
    market: 'receiving_yards',
    description: 'Elite TE, injury concern',
    features: {
      expectedValue: 7,
      matchupRating: 70,
      playerForm: 65,
      injuryImpact: 8,
      sharpMoney: 60,
    },
  },
  {
    id: 'NFL-004',
    sport: 'NFL',
    player: 'WR3 Depth Player',
    market: 'receptions',
    description: 'Low target share, negative EV',
    features: {
      expectedValue: -10,
      matchupRating: 35,
      playerForm: 38,
      sharpMoney: 30,
      volumeProfile: 20,
    },
  },
  {
    id: 'NFL-005',
    sport: 'NFL',
    player: 'Josh Allen',
    market: 'rushing_yards',
    description: 'Dual-threat QB, cold weather',
    features: {
      expectedValue: 8,
      matchupRating: 72,
      playerForm: 80,
      weatherImpact: 6,
      motivationalFactors: 20,
      volatility: 6,
    },
  },
  {
    id: 'NFL-006',
    sport: 'NFL',
    player: "Ja'Marr Chase",
    market: 'receiving_yards',
    description: 'Top WR, primetime, sharp action',
    features: {
      expectedValue: 18,
      matchupRating: 85,
      playerForm: 88,
      sharpMoney: 82,
      closingLineValue: 6,
      paceImpact: 15,
    },
  },
  {
    id: 'NFL-007',
    sport: 'NFL',
    player: 'Saquon Barkley',
    market: 'rushing_attempts',
    description: 'Heavy workload back',
    features: {
      expectedValue: 5,
      matchupRating: 62,
      playerForm: 68,
      correlationRisk: 0.3,
      paceImpact: 8,
    },
  },
  {
    id: 'NFL-008',
    sport: 'NFL',
    player: 'T.J. Watt',
    market: 'sacks',
    description: 'Elite pass rusher, high variance',
    features: {
      expectedValue: 4,
      matchupRating: 78,
      playerForm: 82,
      volatility: 9,
      correlationRisk: 0.4,
      sharpMoney: 55,
    },
  },
  {
    id: 'NFL-009',
    sport: 'NFL',
    player: 'Lamar Jackson',
    market: 'passing_TDs',
    description: 'MVP QB, strong at home',
    features: {
      expectedValue: 12,
      matchupRating: 80,
      playerForm: 84,
      venueAdvantage: 16,
      motivationalFactors: 22,
    },
  },
  {
    id: 'NFL-010',
    sport: 'NFL',
    player: 'CeeDee Lamb',
    market: 'receptions',
    description: 'Target monster, neg game script',
    features: {
      expectedValue: -3,
      matchupRating: 55,
      playerForm: 72,
      sharpMoney: 45,
      paceImpact: 6,
    },
  },
  // NHL (10)
  {
    id: 'NHL-001',
    sport: 'NHL',
    player: 'Connor McDavid',
    market: 'points',
    description: 'Generational talent, plus matchup',
    features: {
      expectedValue: 14,
      matchupRating: 92,
      playerForm: 95,
      sharpMoney: 78,
      closingLineValue: 4,
      paceImpact: 16,
    },
  },
  {
    id: 'NHL-002',
    sport: 'NHL',
    player: 'Auston Matthews',
    market: 'shots_on_goal',
    description: 'Elite shooter, high volume',
    features: {
      expectedValue: 10,
      matchupRating: 80,
      playerForm: 82,
      volumeProfile: 72,
      sharpMoney: 70,
      closingLineValue: 3,
    },
  },
  {
    id: 'NHL-003',
    sport: 'NHL',
    player: 'Nathan MacKinnon',
    market: 'assists',
    description: 'Playmaker, strong line',
    features: {
      expectedValue: 7,
      matchupRating: 74,
      playerForm: 78,
      paceImpact: 14,
      sharpMoney: 62,
    },
  },
  {
    id: 'NHL-004',
    sport: 'NHL',
    player: '4th Line Forward',
    market: 'shots_on_goal',
    description: 'Limited ice time, negative EV',
    features: {
      expectedValue: -8,
      matchupRating: 30,
      playerForm: 35,
      sharpMoney: 28,
      volumeProfile: 18,
    },
  },
  {
    id: 'NHL-005',
    sport: 'NHL',
    player: 'Cale Makar',
    market: 'blocked_shots',
    description: 'Offensive D, high variance',
    features: {
      expectedValue: 3,
      matchupRating: 65,
      playerForm: 75,
      volatility: 7,
      correlationRisk: 0.35,
    },
  },
  {
    id: 'NHL-006',
    sport: 'NHL',
    player: 'Leon Draisaitl',
    market: 'goals',
    description: 'PP specialist, strong at home',
    features: {
      expectedValue: 12,
      matchupRating: 82,
      playerForm: 85,
      venueAdvantage: 15,
      sharpMoney: 76,
      closingLineValue: 5,
    },
  },
  {
    id: 'NHL-007',
    sport: 'NHL',
    player: 'Andrei Vasilevskiy',
    market: 'saves',
    description: 'Elite goalie, high shot volume',
    features: {
      expectedValue: 6,
      matchupRating: 70,
      playerForm: 72,
      volumeProfile: 68,
      playerFatigue: 55,
    },
  },
  {
    id: 'NHL-008',
    sport: 'NHL',
    player: 'Jack Hughes',
    market: 'points',
    description: 'Young star, inconsistent form',
    features: {
      expectedValue: 5,
      matchupRating: 60,
      playerForm: 55,
      volatility: 6,
      sharpMoney: 52,
    },
  },
  {
    id: 'NHL-009',
    sport: 'NHL',
    player: 'David Pastrnak',
    market: 'shots_on_goal',
    description: 'Trigger-happy winger, rivalry',
    features: {
      expectedValue: 9,
      matchupRating: 76,
      playerForm: 80,
      motivationalFactors: 20,
      sharpMoney: 68,
      paceImpact: 13,
    },
  },
  {
    id: 'NHL-010',
    sport: 'NHL',
    player: 'AHL Callup',
    market: 'points',
    description: 'Zero track record, max fallback',
    features: { expectedValue: -18, matchupRating: 20 },
  },
];

// ─── Raw prop builder ────────────────────────────────────────────────────────

function buildRawProp(pick: PickInput): Record<string, any> {
  const f = pick.features;
  const matchupRating = f.matchupRating ?? 50;
  const playerForm = f.playerForm ?? 50;
  const ev = f.expectedValue ?? 0;
  const l10_hit_rate = playerForm / 100;
  const dvp_rank = Math.max(1, Math.round(32 - matchupRating * 0.3));
  const projected_win_prob = Math.min(0.85, Math.max(0.15, 0.5 + ev / 100));
  const projected_line = 22.5 + (ev > 0 ? Math.min(ev / 5, 3) : Math.max(ev / 5, -3));
  const minutes = Math.max(8, Math.min(38, Math.round(15 + playerForm * 0.25)));

  return {
    id: pick.id,
    sport: pick.sport,
    league: pick.sport,
    player_name: pick.player,
    stat_type: pick.market,
    line: 22.5,
    odds: -110,
    over_odds: -110,
    under_odds: -110,
    ev,
    expected_value: ev,
    matchup_quality: matchupRating,
    trend_confidence: playerForm,
    recent_avg: 20,
    season_avg: 19,
    team: 'TEST',
    l10_hit_rate,
    dvp_rank,
    projected_win_prob,
    projected_line,
    starter: playerForm >= 70,
    minutes,
  };
}

// ─── V1 Scoring ──────────────────────────────────────────────────────────────

function scoreV1(prop: Record<string, any>) {
  const trend_score = calculateTrendScore(prop);
  const matchup_score = calculateMatchupScore(prop);
  const ev_percent = calculateExpectedValue(prop);
  const confidence_score = calculateConfidenceScore({ trend_score, matchup_score, ev_percent });
  const line_value_score = calculateLineValueScore(prop);
  const role_stability = calculateRoleStabilityScore(prop);
  const professional_score_raw =
    (trend_score ?? 0) +
    (matchup_score ?? 0) +
    (confidence_score ?? 0) +
    (line_value_score ?? 0) +
    (role_stability ?? 0);
  const tier = determineTier(professional_score_raw);
  const professional_score = normalizeScore(professional_score_raw, 25);
  const normalized_confidence = calculateNormalizedConfidence({
    ev_percent,
    professional_score_raw,
    trend_score,
    matchup_score,
    line_value_score,
    role_stability,
    prop,
  });
  return {
    professional_score,
    professional_score_raw,
    normalized_confidence,
    confidence_score,
    tier,
    ev_percent,
    trend_score,
    matchup_score,
    line_value_score,
    role_stability,
    scoring_engine: 'v1' as const,
  };
}

// ─── V2 Scoring ──────────────────────────────────────────────────────────────

function makeFeatureSet(pick: PickInput): GradingFeatureSet {
  const f = pick.features;
  return {
    propId: pick.id,
    date: '2026-02-16',
    sport: pick.sport,
    league: pick.sport,
    player: pick.player,
    odds: -110,
    market: { type: pick.market, odds: -110, line: 22.5 },
    expectedValue: f.expectedValue ?? 0,
    lineMovement: f.lineMovement ?? 1,
    matchupRating: f.matchupRating ?? 55,
    playerForm: f.playerForm ?? 60,
    injuryImpact: f.injuryImpact ?? 2,
    weatherImpact: f.weatherImpact ?? 0,
    marketIntelligence: f.marketIntelligence ?? 55,
    sharpMoney: f.sharpMoney ?? 55,
    volumeProfile: f.volumeProfile ?? 50,
    closingLineValue: f.closingLineValue ?? 1,
    playerFatigue: f.playerFatigue ?? 60,
    venueAdvantage: f.venueAdvantage ?? 10,
    refereeImpact: f.refereeImpact ?? 2,
    paceImpact: f.paceImpact ?? 10,
    motivationalFactors: f.motivationalFactors ?? 12,
    correlationRisk: f.correlationRisk ?? 0.15,
    volatility: f.volatility ?? 3,
    portfolioImpact: f.portfolioImpact ?? 0.08,
    dataQuality: {
      dataValidationScore: 0.95,
      outlierScore: 0.95,
      consistencyScore: 0.95,
      completeness: 0.85,
    },
    timestamp: '2026-02-16T14:00:00Z',
    version: 'tranche6-retest',
    source: 'tranche6',
    confidence: 0.75,
  } as GradingFeatureSet;
}

function scoreV2(pick: PickInput, v1Result: ReturnType<typeof scoreV1>) {
  const features = makeFeatureSet(pick);
  const v2 = computeScoreV2(features);
  const normalized_confidence = calculateNormalizedConfidence({
    ev_percent: v2.ev,
    professional_score_raw: v2.score * 0.25,
    trend_score: v1Result.trend_score,
    matchup_score: v1Result.matchup_score,
    line_value_score: v1Result.line_value_score,
    role_stability: v1Result.role_stability,
    prop: buildRawProp(pick),
  });
  return {
    professional_score: v2.score,
    normalized_confidence,
    tier: v2.tier,
    ev_percent: v2.ev,
    scoring_engine: 'v2' as const,
    breakdown: v2.breakdown,
    feature_audit: v2.feature_audit,
  };
}

// ─── Gate evaluation ─────────────────────────────────────────────────────────

interface GateResult {
  gate: string;
  threshold: number;
  passed: boolean;
  score: number;
  margin: number;
}

function evaluateGates(professional_score: number): GateResult[] {
  return [
    { gate: 'instant-s-tier', threshold: 85 },
    { gate: '10am-premium', threshold: 75 },
    { gate: 'steam-hunter', threshold: 70 },
  ].map(g => ({
    ...g,
    passed: professional_score >= g.threshold,
    score: professional_score,
    margin: professional_score - g.threshold,
  }));
}

// ─── Statistics ──────────────────────────────────────────────────────────────

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor((p / 100) * (sorted.length - 1))];
}
function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}
function stddev(arr: number[]): number {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logs.push(msg);
  };

  log('================================================================');
  log('  TRANCHE 6 — V2 Shadow Readiness Re-test (Stage 3B)');
  log('  Date: 2026-02-16');
  log('  Fixes Applied:');
  log('    1B: validateWeightsV2() always used (sport-specific weights)');
  log('    2B: 8 capper features → excluded (no neutral 50-compression)');
  log('================================================================');
  log('');

  // ── Score all picks ────────────────────────────────────────────────
  interface PickResult {
    id: string;
    sport: string;
    player: string;
    market: string;
    v1: ReturnType<typeof scoreV1>;
    v2: ReturnType<typeof scoreV2>;
    gates_v1: GateResult[];
    gates_v2: GateResult[];
  }

  const results: PickResult[] = [];
  for (const pick of PICKS) {
    const rawProp = buildRawProp(pick);
    const v1 = scoreV1(rawProp);
    const v2 = scoreV2(pick, v1);
    results.push({
      id: pick.id,
      sport: pick.sport,
      player: pick.player,
      market: pick.market,
      v1,
      v2,
      gates_v1: evaluateGates(v1.professional_score),
      gates_v2: evaluateGates(v2.professional_score),
    });
  }

  // ── Distributions ──────────────────────────────────────────────────
  const v1Scores = results.map(r => r.v1.professional_score);
  const v2Scores = results.map(r => r.v2.professional_score);
  log(`Total candidates evaluated: ${results.length}`);
  log('');

  log('--- V1 professional_score (0-100, UNCHANGED) ---');
  log(`  Min:    ${Math.min(...v1Scores).toFixed(2)}`);
  log(`  Max:    ${Math.max(...v1Scores).toFixed(2)}`);
  log(`  Mean:   ${mean(v1Scores).toFixed(2)}`);
  log(`  StdDev: ${stddev(v1Scores).toFixed(2)}`);
  log('');

  log('--- V2 professional_score (0-100, AFTER FIXES) ---');
  log(`  Min:    ${Math.min(...v2Scores).toFixed(2)}`);
  log(`  Max:    ${Math.max(...v2Scores).toFixed(2)}`);
  log(`  Mean:   ${mean(v2Scores).toFixed(2)}`);
  log(`  StdDev: ${stddev(v2Scores).toFixed(2)}`);
  log(`  P25:    ${percentile(v2Scores, 25).toFixed(2)}`);
  log(`  P50:    ${percentile(v2Scores, 50).toFixed(2)}`);
  log(`  P75:    ${percentile(v2Scores, 75).toFixed(2)}`);
  log('');

  // Tranche 5 baseline (pre-fix) for comparison
  log('--- COMPARISON: Tranche 5 V2 Baseline (PRE-FIX) ---');
  log('  Min:    38.30');
  log('  Max:    62.14');
  log('  Mean:   52.76');
  log('  StdDev: 6.53');
  log('  Gate passes: 0/40 (all gates)');
  log('');

  // Delta analysis
  const rangeImprovement = Math.max(...v2Scores) - Math.min(...v2Scores) - (62.14 - 38.3);
  const stddevImprovement = stddev(v2Scores) - 6.53;
  log('--- IMPROVEMENT METRICS ---');
  log(
    `  V2 Range: ${(Math.max(...v2Scores) - Math.min(...v2Scores)).toFixed(2)} (was 23.84, delta: ${rangeImprovement > 0 ? '+' : ''}${rangeImprovement.toFixed(2)})`
  );
  log(
    `  V2 StdDev: ${stddev(v2Scores).toFixed(2)} (was 6.53, delta: ${stddevImprovement > 0 ? '+' : ''}${stddevImprovement.toFixed(2)})`
  );
  log(
    `  V2 Max: ${Math.max(...v2Scores).toFixed(2)} (was 62.14, delta: ${Math.max(...v2Scores) - 62.14 > 0 ? '+' : ''}${(Math.max(...v2Scores) - 62.14).toFixed(2)})`
  );
  log('');

  // Tier distribution
  const v1Tiers: Record<string, number> = {};
  const v2Tiers: Record<string, number> = {};
  for (const r of results) {
    v1Tiers[r.v1.tier] = (v1Tiers[r.v1.tier] || 0) + 1;
    v2Tiers[r.v2.tier] = (v2Tiers[r.v2.tier] || 0) + 1;
  }
  log('--- Tier Distribution ---');
  log(
    '  V1: ' +
      Object.entries(v1Tiers)
        .sort()
        .map(([t, c]) => `${t}=${c}`)
        .join(', ')
  );
  log(
    '  V2: ' +
      Object.entries(v2Tiers)
        .sort()
        .map(([t, c]) => `${t}=${c}`)
        .join(', ')
  );
  log('');

  // Gate pass rates
  const gateNames = ['instant-s-tier', '10am-premium', 'steam-hunter'];
  log('--- Gate Pass Rates ---');
  for (const gate of gateNames) {
    const v1Pass = results.filter(r => r.gates_v1.find(g => g.gate === gate)?.passed).length;
    const v2Pass = results.filter(r => r.gates_v2.find(g => g.gate === gate)?.passed).length;
    log(
      `  ${gate}: V1=${v1Pass}/${results.length} (${((v1Pass / results.length) * 100).toFixed(1)}%), V2=${v2Pass}/${results.length} (${((v2Pass / results.length) * 100).toFixed(1)}%)`
    );
  }
  log('');

  // Per-pick detail
  log('--- Per-Pick Scores ---');
  log(
    '  ID          | Player                    | V1 Score | V2 Score | V1 Tier | V2 Tier | Delta'
  );
  log('  ' + '-'.repeat(100));
  for (const r of results) {
    const delta = r.v2.professional_score - r.v1.professional_score;
    log(
      `  ${r.id.padEnd(11)} | ${r.player.padEnd(25)} | ${r.v1.professional_score.toFixed(1).padStart(8)} | ${r.v2.professional_score.toFixed(1).padStart(8)} | ${r.v1.tier.padStart(7)} | ${r.v2.tier.padStart(7)} | ${(delta >= 0 ? '+' : '') + delta.toFixed(1)}`
    );
  }
  log('');

  // Feature audit for top and bottom picks
  log('--- Feature Audit (Top 3 V2 Picks) ---');
  const sorted = [...results].sort((a, b) => b.v2.professional_score - a.v2.professional_score);
  for (const r of sorted.slice(0, 3)) {
    log(`  ${r.id} ${r.player}: V2=${r.v2.professional_score.toFixed(1)}`);
    if (r.v2.feature_audit) {
      const auditEntries = Object.values(r.v2.feature_audit);
      const present = auditEntries.filter((a: any) => a.present).length;
      const excluded = auditEntries.filter((a: any) => a.fallbackPolicy === 'excluded').length;
      const fallback = auditEntries.filter((a: any) => a.fallbackUsed).length;
      log(`    Present: ${present}, Excluded: ${excluded}, Fallback(neutral): ${fallback}`);
    }
  }
  log('');

  log('--- Feature Audit (Bottom 3 V2 Picks) ---');
  for (const r of sorted.slice(-3)) {
    log(`  ${r.id} ${r.player}: V2=${r.v2.professional_score.toFixed(1)}`);
    if (r.v2.feature_audit) {
      const auditEntries = Object.values(r.v2.feature_audit);
      const present = auditEntries.filter((a: any) => a.present).length;
      const excluded = auditEntries.filter((a: any) => a.fallbackPolicy === 'excluded').length;
      const fallback = auditEntries.filter((a: any) => a.fallbackUsed).length;
      log(`    Present: ${present}, Excluded: ${excluded}, Fallback(neutral): ${fallback}`);
    }
  }
  log('');

  // ── Readiness Assessment ───────────────────────────────────────────
  log('=== V2 SHADOW READINESS ASSESSMENT ===');
  log('');

  const v2Max = Math.max(...v2Scores);
  const v2StdDev = stddev(v2Scores);
  const v2GatePassAny = results.filter(r => r.gates_v2.some(g => g.passed)).length;
  const v2GateSteam = results.filter(
    r => r.gates_v2.find(g => g.gate === 'steam-hunter')?.passed
  ).length;

  const criteria = [
    { name: 'V2 max score > 70', met: v2Max > 70, value: v2Max.toFixed(2) },
    { name: 'V2 max score > 85 (S-tier)', met: v2Max > 85, value: v2Max.toFixed(2) },
    { name: 'V2 std dev > 10 (discrimination)', met: v2StdDev > 10, value: v2StdDev.toFixed(2) },
    {
      name: 'V2 gate pass rate > 0% (any gate)',
      met: v2GatePassAny > 0,
      value: `${v2GatePassAny}/${results.length}`,
    },
    {
      name: 'V2 steam-hunter gate pass > 10%',
      met: v2GateSteam / results.length > 0.1,
      value: `${((v2GateSteam / results.length) * 100).toFixed(1)}%`,
    },
    {
      name: 'V2 score range > 40 points',
      met: v2Max - Math.min(...v2Scores) > 40,
      value: (v2Max - Math.min(...v2Scores)).toFixed(2),
    },
  ];

  for (const c of criteria) {
    const icon = c.met ? 'PASS' : 'FAIL';
    log(`  [${icon}] ${c.name} → ${c.value}`);
  }

  const allPass = criteria.every(c => c.met);
  log('');
  log(`  VERDICT: ${allPass ? 'V2 READY FOR SHADOW CANARY' : 'V2 NEEDS FURTHER WORK'}`);
  log('');

  // ── Write artifacts ────────────────────────────────────────────────
  const summaryJson = {
    timestamp: new Date().toISOString(),
    tranche: 6,
    stage: '3B',
    description: 'V2 Shadow Readiness Re-test after Tranche 6 fixes',
    fixes_applied: [
      'Fix 1B: validateWeightsV2() always used — sport-specific weights loaded correctly',
      'Fix 2B: 8 capper features changed from neutral to excluded — no 50-compression',
    ],
    total_candidates: results.length,
    v1: {
      professional_score: {
        min: Math.min(...v1Scores),
        max: Math.max(...v1Scores),
        mean: mean(v1Scores),
        stddev: stddev(v1Scores),
      },
      tier_distribution: v1Tiers,
    },
    v2_after_fix: {
      professional_score: {
        min: Math.min(...v2Scores),
        max: Math.max(...v2Scores),
        mean: mean(v2Scores),
        stddev: stddev(v2Scores),
        p25: percentile(v2Scores, 25),
        p50: percentile(v2Scores, 50),
        p75: percentile(v2Scores, 75),
      },
      tier_distribution: v2Tiers,
      gate_pass_rates: Object.fromEntries(
        gateNames.map(g => [
          g,
          results.filter(r => r.gates_v2.find(gr => gr.gate === g)?.passed).length / results.length,
        ])
      ),
    },
    v2_before_fix: {
      professional_score: { min: 38.3, max: 62.14, mean: 52.76, stddev: 6.53 },
      gate_pass_rates: { 'instant-s-tier': 0, '10am-premium': 0, 'steam-hunter': 0 },
    },
    improvement: {
      range_delta: Math.max(...v2Scores) - Math.min(...v2Scores) - 23.84,
      stddev_delta: stddev(v2Scores) - 6.53,
      max_delta: Math.max(...v2Scores) - 62.14,
    },
    readiness: {
      criteria: criteria.map(c => ({ ...c })),
      verdict: allPass ? 'V2 READY FOR SHADOW CANARY' : 'V2 NEEDS FURTHER WORK',
    },
    per_pick: results.map(r => ({
      id: r.id,
      sport: r.sport,
      player: r.player,
      market: r.market,
      v1_score: r.v1.professional_score,
      v2_score: r.v2.professional_score,
      v1_tier: r.v1.tier,
      v2_tier: r.v2.tier,
      delta: r.v2.professional_score - r.v1.professional_score,
    })),
  };

  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summaryJson, null, 2));
  fs.writeFileSync(path.join(outDir, 'PROOF.txt'), logs.join('\n'));

  log('');
  log(`Artifacts written to: out/promotion-tranche-6/2026-02-16/3b_v2_retest/`);
  log('  summary.json');
  log('  PROOF.txt');
  log('');
  log('================================================================');
  log(`  TRANCHE 6 STAGE 3B COMPLETE — VERDICT: ${allPass ? 'V2 READY' : 'NEEDS WORK'}`);
  log('================================================================');

  fs.writeFileSync(path.join(outDir, 'PROOF.txt'), logs.join('\n'));
}

main();
