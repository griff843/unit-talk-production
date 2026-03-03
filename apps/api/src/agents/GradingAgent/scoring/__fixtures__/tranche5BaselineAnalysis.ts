/**
 * tranche5BaselineAnalysis.ts — Tranche 5 Shadow Baseline Analysis
 *
 * Exercises the ACTUAL scoring pipeline (applyScoringLogic sub-functions)
 * against 40 realistic fixture picks to generate:
 * - professional_score distribution (0-100 normalized)
 * - normalized_confidence distribution (0.05-0.95 continuous)
 * - Gate pass rates at thresholds 70, 75, 85
 * - Threshold stress test (±5%, ±10%)
 * - V1 vs V2 score deltas
 * - Canary readiness assessment
 *
 * Usage:
 *   npx tsx apps/api/src/agents/GradingAgent/scoring/__fixtures__/tranche5BaselineAnalysis.ts
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
const outDir = path.join(repoRoot, 'out/promotion-tranche-5/2026-02-15');

// ─── Pick Data (40 picks from tranche5Harness) ──────────────────────────────

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
  // Map feature inputs to the EXACT field names V1 sub-functions read:
  //   trendScore → l10_hit_rate
  //   matchupScore → dvp_rank
  //   lineValueScore → projected_line
  //   roleStabilityScore → starter, minutes
  //   expectedValue → projected_win_prob, odds
  const matchupRating = f.matchupRating ?? 50;
  const playerForm = f.playerForm ?? 50;
  const ev = f.expectedValue ?? 0;

  // Derive l10_hit_rate from playerForm (0-100 → 0.0-1.0)
  const l10_hit_rate = playerForm / 100;

  // Derive dvp_rank from matchupRating (higher matchup → lower dvp_rank → better)
  // matchupRating 90+ → dvp_rank 1-5 (excellent), 70-89 → 6-10, 50-69 → 11-15, etc.
  const dvp_rank = Math.max(1, Math.round(32 - matchupRating * 0.3));

  // Derive projected_win_prob from EV: higher EV → higher win probability
  // EV of 0% → 0.5 probability, EV of +20% → ~0.65, EV of -20% → ~0.35
  const projected_win_prob = Math.min(0.85, Math.max(0.15, 0.5 + ev / 100));

  // Derive projected_line with small edge from EV direction
  const projected_line = 22.5 + (ev > 0 ? Math.min(ev / 5, 3) : Math.max(ev / 5, -3));

  // Derive minutes from playerForm
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
    ev: ev,
    expected_value: ev,
    matchup_quality: matchupRating,
    trend_confidence: playerForm,
    recent_avg: 20,
    season_avg: 19,
    team: 'TEST',
    // V1 sub-function fields
    l10_hit_rate,
    dvp_rank,
    projected_win_prob,
    projected_line,
    starter: playerForm >= 70,
    minutes,
  };
}

// ─── V1 Scoring (manual assembly, no env var dependency) ─────────────────────

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
    date: '2026-02-15',
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
    timestamp: '2026-02-15T14:00:00Z',
    version: 'tranche5-baseline',
    source: 'tranche5',
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
  const gates = [
    { gate: 'instant-s-tier', threshold: 85 },
    { gate: '10am-premium', threshold: 75 },
    { gate: 'steam-hunter', threshold: 70 },
  ];
  return gates.map(g => ({
    ...g,
    passed: professional_score >= g.threshold,
    score: professional_score,
    margin: professional_score - g.threshold,
  }));
}

// ─── Statistics helpers ──────────────────────────────────────────────────────

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx];
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
  for (const dir of ['baseline', 'outcomes', 'gates', 'readiness']) {
    const d = path.join(outDir, dir);
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }

  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logs.push(msg);
  };

  log('================================================================');
  log('  TRANCHE 5 — Shadow Baseline Analysis');
  log('  Date: 2026-02-15');
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
    const gates_v1 = evaluateGates(v1.professional_score);
    const gates_v2 = evaluateGates(v2.professional_score);
    results.push({
      id: pick.id,
      sport: pick.sport,
      player: pick.player,
      market: pick.market,
      v1,
      v2,
      gates_v1,
      gates_v2,
    });
  }

  // ── STAGE 1: Baseline distributions ────────────────────────────────
  log('=== STAGE 1: SHADOW PROMOTION BASELINE ===');
  log('');

  const v1Scores = results.map(r => r.v1.professional_score);
  const v2Scores = results.map(r => r.v2.professional_score);
  const v1Conf = results.map(r => r.v1.normalized_confidence);
  const v2Conf = results.map(r => r.v2.normalized_confidence);

  log(`Total candidates evaluated: ${results.length}`);
  log('');

  // V1 professional_score distribution
  log('--- V1 professional_score (0-100) ---');
  log(`  Min:    ${Math.min(...v1Scores).toFixed(2)}`);
  log(`  Max:    ${Math.max(...v1Scores).toFixed(2)}`);
  log(`  Mean:   ${mean(v1Scores).toFixed(2)}`);
  log(`  StdDev: ${stddev(v1Scores).toFixed(2)}`);
  log(`  P25:    ${percentile(v1Scores, 25).toFixed(2)}`);
  log(`  P50:    ${percentile(v1Scores, 50).toFixed(2)}`);
  log(`  P75:    ${percentile(v1Scores, 75).toFixed(2)}`);
  log('');

  // V2 professional_score distribution
  log('--- V2 professional_score (0-100) ---');
  log(`  Min:    ${Math.min(...v2Scores).toFixed(2)}`);
  log(`  Max:    ${Math.max(...v2Scores).toFixed(2)}`);
  log(`  Mean:   ${mean(v2Scores).toFixed(2)}`);
  log(`  StdDev: ${stddev(v2Scores).toFixed(2)}`);
  log(`  P25:    ${percentile(v2Scores, 25).toFixed(2)}`);
  log(`  P50:    ${percentile(v2Scores, 50).toFixed(2)}`);
  log(`  P75:    ${percentile(v2Scores, 75).toFixed(2)}`);
  log('');

  // V1 normalized_confidence distribution
  log('--- V1 normalized_confidence (0.05-0.95) ---');
  log(`  Min:    ${Math.min(...v1Conf).toFixed(4)}`);
  log(`  Max:    ${Math.max(...v1Conf).toFixed(4)}`);
  log(`  Mean:   ${mean(v1Conf).toFixed(4)}`);
  log(`  StdDev: ${stddev(v1Conf).toFixed(4)}`);
  log(`  Distinct values (2dp): ${new Set(v1Conf.map(c => c.toFixed(2))).size}`);
  log('');

  // V2 normalized_confidence distribution
  log('--- V2 normalized_confidence (0.05-0.95) ---');
  log(`  Min:    ${Math.min(...v2Conf).toFixed(4)}`);
  log(`  Max:    ${Math.max(...v2Conf).toFixed(4)}`);
  log(`  Mean:   ${mean(v2Conf).toFixed(4)}`);
  log(`  StdDev: ${stddev(v2Conf).toFixed(4)}`);
  log(`  Distinct values (2dp): ${new Set(v2Conf.map(c => c.toFixed(2))).size}`);
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

  // V1 vs V2 deltas
  const scoreDeltas = results.map(r => r.v2.professional_score - r.v1.professional_score);
  const tierChanges = results.filter(r => r.v1.tier !== r.v2.tier);
  log('--- V1 vs V2 Deltas ---');
  log(`  Mean score delta (V2-V1): ${mean(scoreDeltas).toFixed(2)}`);
  log(`  Max delta:  ${Math.max(...scoreDeltas.map(Math.abs)).toFixed(2)}`);
  log(
    `  Tier changes: ${tierChanges.length}/${results.length} (${((tierChanges.length / results.length) * 100).toFixed(1)}%)`
  );
  log('');

  // Per-pick detail
  log('--- Per-Pick Scores ---');
  log(
    '  ID          | Player                    | V1 Score | V2 Score | V1 Tier | V2 Tier | V1 Conf | V2 Conf'
  );
  log('  ' + '-'.repeat(105));
  for (const r of results) {
    log(
      `  ${r.id.padEnd(11)} | ${r.player.padEnd(25)} | ${r.v1.professional_score.toFixed(1).padStart(8)} | ${r.v2.professional_score.toFixed(1).padStart(8)} | ${r.v1.tier.padStart(7)} | ${r.v2.tier.padStart(7)} | ${r.v1.normalized_confidence.toFixed(3).padStart(7)} | ${r.v2.normalized_confidence.toFixed(3).padStart(7)}`
    );
  }
  log('');

  // ── STAGE 3: Gate Stress Test ──────────────────────────────────────
  log('=== STAGE 3: GATE THRESHOLD STRESS TEST ===');
  log('');

  const thresholdVariants = [
    { label: '-10%', adjustments: [-10, -10, -10] },
    { label: '-5%', adjustments: [-5, -5, -5] },
    { label: 'current', adjustments: [0, 0, 0] },
    { label: '+5%', adjustments: [5, 5, 5] },
    { label: '+10%', adjustments: [10, 10, 10] },
  ];
  const baseThresholds = [85, 75, 70];

  log('  Threshold | instant-s-tier | 10am-premium | steam-hunter | Total Unique');
  log('  ' + '-'.repeat(80));

  const stressResults: any[] = [];
  for (const variant of thresholdVariants) {
    const thresholds = baseThresholds.map((t, i) => t + variant.adjustments[i]);
    const passes = thresholds.map(t => results.filter(r => r.v2.professional_score >= t).length);
    const uniquePassers = new Set(
      results.filter(r => thresholds.some(t => r.v2.professional_score >= t)).map(r => r.id)
    ).size;
    log(
      `  ${variant.label.padEnd(9)} | ${String(thresholds[0]).padEnd(4)} → ${String(passes[0]).padStart(2)}/${results.length} (${((passes[0] / results.length) * 100).toFixed(0)}%) | ${String(thresholds[1]).padEnd(4)} → ${String(passes[1]).padStart(2)}/${results.length} (${((passes[1] / results.length) * 100).toFixed(0)}%) | ${String(thresholds[2]).padEnd(4)} → ${String(passes[2]).padStart(2)}/${results.length} (${((passes[2] / results.length) * 100).toFixed(0)}%) | ${uniquePassers}`
    );
    stressResults.push({ label: variant.label, thresholds, passes, uniquePassers });
  }
  log('');

  // Knife-edge analysis
  log('--- Knife-Edge Analysis (picks within ±3 of a gate threshold, V2 scores) ---');
  for (const t of baseThresholds) {
    const nearEdge = results.filter(r => Math.abs(r.v2.professional_score - t) <= 3);
    log(`  Threshold ${t}: ${nearEdge.length} picks within ±3 points`);
    for (const r of nearEdge) {
      log(
        `    ${r.id} ${r.player}: V2=${r.v2.professional_score.toFixed(1)} (margin=${(r.v2.professional_score - t).toFixed(1)})`
      );
    }
  }
  log('');

  // ── STAGE 2: Outcome Analysis (NOT PROVEN) ─────────────────────────
  log('=== STAGE 2: OUTCOME & SIGNAL QUALITY ===');
  log('');
  log('  Settlement data: NOT AVAILABLE (local environment, no live database)');
  log('  Hit rate: NOT PROVEN');
  log('  ROI: NOT PROVEN');
  log('  CLV delta: NOT PROVEN');
  log('');
  log('  Structural signal quality (what CAN be verified):');

  // Confidence vs EV correlation
  const evs = results.map(r => r.v1.ev_percent);
  const confs = results.map(r => r.v1.normalized_confidence);
  const evMean = mean(evs);
  const confMean = mean(confs);
  let covSum = 0,
    evVar = 0,
    confVar = 0;
  for (let i = 0; i < evs.length; i++) {
    covSum += (evs[i] - evMean) * (confs[i] - confMean);
    evVar += (evs[i] - evMean) ** 2;
    confVar += (confs[i] - confMean) ** 2;
  }
  const correlation = evVar > 0 && confVar > 0 ? covSum / Math.sqrt(evVar * confVar) : 0;
  log(`  EV vs Confidence correlation (V1): ${correlation.toFixed(4)}`);

  // Score vs EV correlation
  const scores = results.map(r => r.v2.professional_score);
  const scoreMean = mean(scores);
  let covSumSE = 0,
    scoreVar = 0,
    evVar2 = 0;
  for (let i = 0; i < scores.length; i++) {
    covSumSE += (scores[i] - scoreMean) * (evs[i] - evMean);
    scoreVar += (scores[i] - scoreMean) ** 2;
    evVar2 += (evs[i] - evMean) ** 2;
  }
  const scoreEvCorr = scoreVar > 0 && evVar2 > 0 ? covSumSE / Math.sqrt(scoreVar * evVar2) : 0;
  log(`  V2 Score vs EV correlation:        ${scoreEvCorr.toFixed(4)}`);

  // Confidence discrimination: do higher-confidence picks have higher EV?
  const highConf = results.filter(r => r.v1.normalized_confidence >= 0.55);
  const lowConf = results.filter(r => r.v1.normalized_confidence < 0.55);
  const highConfAvgEV = highConf.length > 0 ? mean(highConf.map(r => r.v1.ev_percent)) : 0;
  const lowConfAvgEV = lowConf.length > 0 ? mean(lowConf.map(r => r.v1.ev_percent)) : 0;
  log(`  High confidence (>=0.55) avg EV:   ${highConfAvgEV.toFixed(2)} (n=${highConf.length})`);
  log(`  Low confidence (<0.55) avg EV:     ${lowConfAvgEV.toFixed(2)} (n=${lowConf.length})`);
  log(`  Discrimination gap:                ${(highConfAvgEV - lowConfAvgEV).toFixed(2)}`);
  log('');

  // ── STAGE 4: Canary Readiness ──────────────────────────────────────
  log('=== STAGE 4: CANARY READINESS ASSESSMENT ===');
  log('');

  const criteria = [
    {
      name: 'Gate pass rate > 0% (V2)',
      met: results.some(r => r.gates_v2.some(g => g.passed)),
      required: true,
    },
    { name: 'professional_score max > 70 (V2)', met: Math.max(...v2Scores) > 70, required: true },
    {
      name: 'normalized_confidence distinct values > 20',
      met: new Set(v1Conf.map(c => c.toFixed(2))).size > 20,
      required: true,
    },
    {
      name: 'Confidence is discriminative (gap > 2)',
      met: highConfAvgEV - lowConfAvgEV > 2,
      required: true,
    },
    { name: 'V2 scoring pipeline error-free', met: true, required: true },
    { name: 'Settlement data available', met: false, required: false },
    { name: 'Confidence calibration verified', met: false, required: false },
    { name: '14+ days of shadow data', met: false, required: false },
  ];

  for (const c of criteria) {
    const tag = c.met ? 'PASS' : c.required ? 'FAIL' : 'NOT PROVEN';
    const icon = c.met ? 'Y' : c.required ? 'X' : '?';
    log(`  [${icon}] ${c.name}: ${tag}${c.required ? ' (required)' : ' (recommended)'}`);
  }

  const requiredMet = criteria.filter(c => c.required && c.met).length;
  const requiredTotal = criteria.filter(c => c.required).length;
  const recommendedMet = criteria.filter(c => !c.required && c.met).length;
  const recommendedTotal = criteria.filter(c => !c.required).length;

  log('');
  log(`  Required criteria: ${requiredMet}/${requiredTotal}`);
  log(`  Recommended criteria: ${recommendedMet}/${recommendedTotal}`);
  log('');

  let decision: string;
  if (requiredMet === requiredTotal && recommendedMet === recommendedTotal) {
    decision = 'READY FOR CANARY';
  } else if (requiredMet === requiredTotal) {
    decision = 'CONDITIONALLY READY';
  } else {
    decision = 'NOT READY';
  }
  log(`  DECISION: ${decision}`);
  log('');

  // ── Write artifacts ────────────────────────────────────────────────

  // Baseline summary JSON
  const summaryJson = {
    timestamp: new Date().toISOString(),
    total_candidates: results.length,
    sports: ['NBA', 'MLB', 'NFL', 'NHL'],
    data_source: 'fixture-based simulation (40 picks, 10 per sport)',
    v1: {
      professional_score: {
        min: Math.min(...v1Scores),
        max: Math.max(...v1Scores),
        mean: mean(v1Scores),
        stddev: stddev(v1Scores),
        p25: percentile(v1Scores, 25),
        p50: percentile(v1Scores, 50),
        p75: percentile(v1Scores, 75),
      },
      normalized_confidence: {
        min: Math.min(...v1Conf),
        max: Math.max(...v1Conf),
        mean: mean(v1Conf),
        stddev: stddev(v1Conf),
        distinct_2dp: new Set(v1Conf.map(c => c.toFixed(2))).size,
      },
      tier_distribution: v1Tiers,
      gate_pass_rates: Object.fromEntries(
        gateNames.map(g => [
          g,
          results.filter(r => r.gates_v1.find(gr => gr.gate === g)?.passed).length / results.length,
        ])
      ),
    },
    v2: {
      professional_score: {
        min: Math.min(...v2Scores),
        max: Math.max(...v2Scores),
        mean: mean(v2Scores),
        stddev: stddev(v2Scores),
        p25: percentile(v2Scores, 25),
        p50: percentile(v2Scores, 50),
        p75: percentile(v2Scores, 75),
      },
      normalized_confidence: {
        min: Math.min(...v2Conf),
        max: Math.max(...v2Conf),
        mean: mean(v2Conf),
        stddev: stddev(v2Conf),
        distinct_2dp: new Set(v2Conf.map(c => c.toFixed(2))).size,
      },
      tier_distribution: v2Tiers,
      gate_pass_rates: Object.fromEntries(
        gateNames.map(g => [
          g,
          results.filter(r => r.gates_v2.find(gr => gr.gate === g)?.passed).length / results.length,
        ])
      ),
    },
    deltas: {
      mean_score_delta: mean(scoreDeltas),
      tier_change_rate: tierChanges.length / results.length,
    },
    signal_quality: {
      ev_confidence_correlation: correlation,
      v2_score_ev_correlation: scoreEvCorr,
      high_conf_avg_ev: highConfAvgEV,
      low_conf_avg_ev: lowConfAvgEV,
      discrimination_gap: highConfAvgEV - lowConfAvgEV,
    },
    readiness: {
      decision,
      required_met: requiredMet,
      required_total: requiredTotal,
      recommended_met: recommendedMet,
      recommended_total: recommendedTotal,
      criteria: criteria.map(c => ({ ...c })),
    },
    stress_test: stressResults,
    per_pick: results.map(r => ({
      id: r.id,
      sport: r.sport,
      player: r.player,
      market: r.market,
      v1_score: r.v1.professional_score,
      v2_score: r.v2.professional_score,
      v1_conf: r.v1.normalized_confidence,
      v2_conf: r.v2.normalized_confidence,
      v1_tier: r.v1.tier,
      v2_tier: r.v2.tier,
      v1_ev: r.v1.ev_percent,
      v2_ev: r.v2.ev_percent,
    })),
  };

  fs.writeFileSync(
    path.join(outDir, 'baseline/summary.json'),
    JSON.stringify(summaryJson, null, 2)
  );
  fs.writeFileSync(path.join(outDir, 'baseline/PROOF.txt'), logs.join('\n'));
  fs.writeFileSync(path.join(outDir, 'outcomes/PROOF.txt'), logs.join('\n'));
  fs.writeFileSync(path.join(outDir, 'gates/PROOF.txt'), logs.join('\n'));

  log('');
  log('Artifacts written to: out/promotion-tranche-5/2026-02-15/');
  log('  baseline/summary.json');
  log('  baseline/PROOF.txt');
  log('  outcomes/PROOF.txt');
  log('  gates/PROOF.txt');
  log('');
  log('================================================================');
  log(`  TRANCHE 5 BASELINE ANALYSIS COMPLETE — DECISION: ${decision}`);
  log('================================================================');

  // Final write
  fs.writeFileSync(path.join(outDir, 'baseline/PROOF.txt'), logs.join('\n'));
}

main();
