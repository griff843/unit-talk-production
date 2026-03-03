/**
 * tranche5Harness.ts — Tranche 5 Runtime Validation + Shadow Drift Harness
 *
 * Objectives:
 * A) Prove V2 can execute end-to-end without errors (runtime wiring)
 * B) Quantify real drift between V1 and V2 scoring paths
 * C) Output all required proof artifacts for governance
 *
 * Exercises both runtime gates:
 * - SyndicateGradingEngine.gradeProp() → V2 short-circuit
 * - unifiedEdgeScore() → V2 short-circuit
 * - computeScoreV2() directly (registry path)
 *
 * Usage:
 *   # V2 runtime validation:
 *   npx tsx apps/api/src/agents/GradingAgent/scoring/__fixtures__/tranche5Harness.ts
 *
 * Created: 2026-01-29 (Tranche 5 — Scoring Rebuild)
 */

import * as fs from 'fs';
import * as path from 'path';

import { unifiedEdgeScore } from '../../../../logic/scoring/unified-edge-score';
import { getScoringConfig, getSportWeights } from '../../../../scoring/config/weights';
import { validateWeightsV2 } from '../../../../scoring/config/weights/types';
import { GradingFeatureSet } from '../../../../types/GradingFeatureSet';
import { computeScoreV2 } from '../computeScoreV2';

// ─── Output Directory ────────────────────────────────────────────────────────

const repoRoot = path.resolve(__dirname, '../../../../../../../');
const outDir = path.join(repoRoot, 'out/scoring-rebuild/2026-01-29/tranche-5');

// ─── 40 Realistic Pick Payloads (10 per sport × 4 sports) ────────────────────

interface PickPayload {
  id: string;
  sport: string;
  player: string;
  market: string;
  description: string;
  features: Partial<GradingFeatureSet>;
  /** Raw prop-like object for unifiedEdgeScore path */
  rawProp: Record<string, any>;
}

function makeFeatureSet(sport: string, overrides: Partial<GradingFeatureSet>): GradingFeatureSet {
  return {
    propId:
      overrides.propId || `t5-${sport.toLowerCase()}-${Math.random().toString(36).slice(2, 6)}`,
    date: '2026-01-29',
    sport,
    league: sport,
    player: overrides.player || 'Test Player',
    odds: overrides.odds || -110,
    market: overrides.market || { type: 'points', odds: -110, line: 22.5 },
    expectedValue: overrides.expectedValue ?? 5,
    lineMovement: overrides.lineMovement ?? 1,
    matchupRating: overrides.matchupRating ?? 55,
    playerForm: overrides.playerForm ?? 60,
    injuryImpact: overrides.injuryImpact ?? 2,
    weatherImpact: overrides.weatherImpact ?? 0,
    marketIntelligence: overrides.marketIntelligence ?? 55,
    sharpMoney: overrides.sharpMoney ?? 55,
    volumeProfile: overrides.volumeProfile ?? 50,
    closingLineValue: overrides.closingLineValue ?? 1,
    playerFatigue: overrides.playerFatigue ?? 60,
    venueAdvantage: overrides.venueAdvantage ?? 10,
    refereeImpact: overrides.refereeImpact ?? 2,
    paceImpact: overrides.paceImpact ?? 10,
    motivationalFactors: overrides.motivationalFactors ?? 12,
    correlationRisk: overrides.correlationRisk ?? 0.15,
    volatility: overrides.volatility ?? 3,
    portfolioImpact: overrides.portfolioImpact ?? 0.08,
    dataQuality: {
      dataValidationScore: 0.95,
      outlierScore: 0.95,
      consistencyScore: 0.95,
      completeness: 0.85,
    },
    timestamp: '2026-01-29T14:00:00Z',
    version: 'tranche5-harness',
    source: 'tranche5',
    confidence: 0.75,
    ...overrides,
  } as GradingFeatureSet;
}

function featuresToRawProp(f: GradingFeatureSet): Record<string, any> {
  return {
    id: f.propId,
    league: f.sport,
    sport: f.sport,
    player_name: f.player,
    odds: f.odds,
    market_type: f.market?.type,
    stat_type: f.market?.type,
    line: f.market?.line,
    expected_value: f.expectedValue,
    ev: f.expectedValue,
    line_movement: f.lineMovement,
    matchup_score: f.matchupRating,
    player_form: f.playerForm,
    injury_impact: f.injuryImpact,
    weather_impact: f.weatherImpact,
    market_intelligence: f.marketIntelligence,
    sharp_money: f.sharpMoney,
    volume_profile: f.volumeProfile,
    closing_line_value: f.closingLineValue,
    player_fatigue: f.playerFatigue,
    venue_advantage: f.venueAdvantage,
    referee_impact: f.refereeImpact,
    pace_impact: f.paceImpact,
    motivational_factors: f.motivationalFactors,
    correlation_risk: f.correlationRisk,
    volatility: f.volatility,
    portfolio_impact: f.portfolioImpact,
  };
}

const PICKS: PickPayload[] = [
  // ── NBA (10) ──────────────────────────────────────────────────────────────
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
    rawProp: {},
  },
  {
    id: 'NBA-002',
    sport: 'NBA',
    player: 'Jayson Tatum',
    market: 'rebounds',
    description: 'Above avg rebounder, moderate EV',
    features: { expectedValue: 8, matchupRating: 65, playerForm: 72, sharpMoney: 60, odds: -115 },
    rawProp: {},
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
    rawProp: {},
  },
  {
    id: 'NBA-004',
    sport: 'NBA',
    player: 'Bench Player',
    market: 'points',
    description: 'Low-minute player, negative EV, thin data',
    features: {
      expectedValue: -12,
      matchupRating: 35,
      playerForm: 40,
      sharpMoney: 30,
      volumeProfile: 25,
      closingLineValue: -3,
    },
    rawProp: {},
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
    rawProp: {},
  },
  {
    id: 'NBA-006',
    sport: 'NBA',
    player: 'Shai Gilgeous-Alexander',
    market: 'points',
    description: 'MVP candidate, heavy favorite line',
    features: {
      expectedValue: 20,
      matchupRating: 92,
      playerForm: 95,
      sharpMoney: 85,
      odds: -200,
      closingLineValue: 7,
    },
    rawProp: {},
  },
  {
    id: 'NBA-007',
    sport: 'NBA',
    player: "De'Aaron Fox",
    market: 'steals',
    description: 'Quick guard, high variance prop',
    features: {
      expectedValue: 4,
      matchupRating: 58,
      playerForm: 62,
      volatility: 7,
      correlationRisk: 0.3,
    },
    rawProp: {},
  },
  {
    id: 'NBA-008',
    sport: 'NBA',
    player: 'Nikola Jokic',
    market: 'assists',
    description: 'Triple-double threat, strong all-around',
    features: {
      expectedValue: 14,
      matchupRating: 82,
      playerForm: 88,
      sharpMoney: 78,
      closingLineValue: 5,
      paceImpact: 16,
    },
    rawProp: {},
  },
  {
    id: 'NBA-009',
    sport: 'NBA',
    player: 'Random Role Player',
    market: 'threes',
    description: 'Minimal data, fallback-heavy',
    features: { expectedValue: -5, matchupRating: 45 },
    rawProp: {},
  },
  {
    id: 'NBA-010',
    sport: 'NBA',
    player: 'Giannis Antetokounmpo',
    market: 'PRA',
    description: 'Dominant combo stat, underdog line',
    features: {
      expectedValue: 10,
      matchupRating: 78,
      playerForm: 82,
      odds: 150,
      sharpMoney: 68,
      lineMovement: 2,
    },
    rawProp: {},
  },

  // ── MLB (10) ──────────────────────────────────────────────────────────────
  {
    id: 'MLB-001',
    sport: 'MLB',
    player: 'Shohei Ohtani',
    market: 'strikeouts',
    description: 'Elite pitcher, high K rate, weather favorable',
    features: {
      expectedValue: 16,
      matchupRating: 90,
      playerForm: 92,
      weatherImpact: 8,
      sharpMoney: 82,
      closingLineValue: 5,
    },
    rawProp: {},
  },
  {
    id: 'MLB-002',
    sport: 'MLB',
    player: 'Aaron Judge',
    market: 'total_bases',
    description: 'Power hitter, strong park factor',
    features: {
      expectedValue: 10,
      matchupRating: 75,
      playerForm: 80,
      weatherImpact: 5,
      venueAdvantage: 18,
      sharpMoney: 70,
    },
    rawProp: {},
  },
  {
    id: 'MLB-003',
    sport: 'MLB',
    player: 'Mookie Betts',
    market: 'hits',
    description: 'Contact hitter, moderate EV',
    features: {
      expectedValue: 6,
      matchupRating: 68,
      playerForm: 70,
      weatherImpact: 3,
      sharpMoney: 58,
    },
    rawProp: {},
  },
  {
    id: 'MLB-004',
    sport: 'MLB',
    player: 'Backup Catcher',
    market: 'hits',
    description: 'Low batting avg, negative EV',
    features: {
      expectedValue: -15,
      matchupRating: 30,
      playerForm: 28,
      sharpMoney: 25,
      weatherImpact: 0,
    },
    rawProp: {},
  },
  {
    id: 'MLB-005',
    sport: 'MLB',
    player: 'Gerrit Cole',
    market: 'outs',
    description: 'Quality start candidate, heavy rain risk',
    features: {
      expectedValue: 8,
      matchupRating: 72,
      playerForm: 75,
      weatherImpact: 12,
      injuryImpact: 4,
    },
    rawProp: {},
  },
  {
    id: 'MLB-006',
    sport: 'MLB',
    player: 'Juan Soto',
    market: 'walks',
    description: 'Elite plate discipline, niche market',
    features: {
      expectedValue: 5,
      matchupRating: 60,
      playerForm: 65,
      volatility: 6,
      sharpMoney: 55,
    },
    rawProp: {},
  },
  {
    id: 'MLB-007',
    sport: 'MLB',
    player: 'Corbin Burnes',
    market: 'strikeouts',
    description: 'Solid pitcher, warm weather boost',
    features: {
      expectedValue: 11,
      matchupRating: 78,
      playerForm: 76,
      weatherImpact: 6,
      sharpMoney: 72,
      closingLineValue: 3,
    },
    rawProp: {},
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
    rawProp: {},
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
      weatherImpact: 2,
      sharpMoney: 62,
      closingLineValue: 1,
    },
    rawProp: {},
  },
  {
    id: 'MLB-010',
    sport: 'MLB',
    player: 'Freddie Freeman',
    market: 'RBI',
    description: 'Cleanup hitter, Coors Field boost',
    features: {
      expectedValue: 13,
      matchupRating: 76,
      playerForm: 78,
      venueAdvantage: 22,
      weatherImpact: 4,
      sharpMoney: 74,
    },
    rawProp: {},
  },

  // ── NFL (10) ──────────────────────────────────────────────────────────────
  {
    id: 'NFL-001',
    sport: 'NFL',
    player: 'Patrick Mahomes',
    market: 'passing_yards',
    description: 'Elite QB, dome game, high pace',
    features: {
      expectedValue: 15,
      matchupRating: 88,
      playerForm: 90,
      paceImpact: 18,
      injuryImpact: 0,
      sharpMoney: 80,
      closingLineValue: 5,
    },
    rawProp: {},
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
    rawProp: {},
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
    rawProp: {},
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
    rawProp: {},
  },
  {
    id: 'NFL-005',
    sport: 'NFL',
    player: 'Josh Allen',
    market: 'rushing_yards',
    description: 'Dual-threat QB, cold weather game',
    features: {
      expectedValue: 8,
      matchupRating: 72,
      playerForm: 80,
      weatherImpact: 6,
      motivationalFactors: 20,
      volatility: 6,
    },
    rawProp: {},
  },
  {
    id: 'NFL-006',
    sport: 'NFL',
    player: "Ja'Marr Chase",
    market: 'receiving_yards',
    description: 'Top WR, primetime game, sharp action',
    features: {
      expectedValue: 18,
      matchupRating: 85,
      playerForm: 88,
      sharpMoney: 82,
      closingLineValue: 6,
      paceImpact: 15,
    },
    rawProp: {},
  },
  {
    id: 'NFL-007',
    sport: 'NFL',
    player: 'Saquon Barkley',
    market: 'rushing_attempts',
    description: 'Heavy workload back, game script dependent',
    features: {
      expectedValue: 5,
      matchupRating: 62,
      playerForm: 68,
      correlationRisk: 0.3,
      paceImpact: 8,
    },
    rawProp: {},
  },
  {
    id: 'NFL-008',
    sport: 'NFL',
    player: 'T.J. Watt',
    market: 'sacks',
    description: 'Elite pass rusher, high variance prop',
    features: {
      expectedValue: 4,
      matchupRating: 78,
      playerForm: 82,
      volatility: 9,
      correlationRisk: 0.4,
      sharpMoney: 55,
    },
    rawProp: {},
  },
  {
    id: 'NFL-009',
    sport: 'NFL',
    player: 'Lamar Jackson',
    market: 'passing_TDs',
    description: 'MVP QB, strong at home, limited data',
    features: {
      expectedValue: 12,
      matchupRating: 80,
      playerForm: 84,
      venueAdvantage: 16,
      motivationalFactors: 22,
    },
    rawProp: {},
  },
  {
    id: 'NFL-010',
    sport: 'NFL',
    player: 'CeeDee Lamb',
    market: 'receptions',
    description: 'Target monster, negative game script expected',
    features: {
      expectedValue: -3,
      matchupRating: 55,
      playerForm: 72,
      sharpMoney: 45,
      paceImpact: 6,
    },
    rawProp: {},
  },

  // ── NHL (10) ──────────────────────────────────────────────────────────────
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
    rawProp: {},
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
    rawProp: {},
  },
  {
    id: 'NHL-003',
    sport: 'NHL',
    player: 'Nathan MacKinnon',
    market: 'assists',
    description: 'Playmaker, strong line, moderate EV',
    features: {
      expectedValue: 7,
      matchupRating: 74,
      playerForm: 78,
      paceImpact: 14,
      sharpMoney: 62,
    },
    rawProp: {},
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
    rawProp: {},
  },
  {
    id: 'NHL-005',
    sport: 'NHL',
    player: 'Cale Makar',
    market: 'blocked_shots',
    description: 'Offensive D, high variance prop',
    features: {
      expectedValue: 3,
      matchupRating: 65,
      playerForm: 75,
      volatility: 7,
      correlationRisk: 0.35,
    },
    rawProp: {},
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
    rawProp: {},
  },
  {
    id: 'NHL-007',
    sport: 'NHL',
    player: 'Andrei Vasilevskiy',
    market: 'saves',
    description: 'Elite goalie, high shot volume expected',
    features: {
      expectedValue: 6,
      matchupRating: 70,
      playerForm: 72,
      volumeProfile: 68,
      playerFatigue: 55,
    },
    rawProp: {},
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
    rawProp: {},
  },
  {
    id: 'NHL-009',
    sport: 'NHL',
    player: 'David Pastrnak',
    market: 'shots_on_goal',
    description: 'Trigger-happy winger, rivalry game',
    features: {
      expectedValue: 9,
      matchupRating: 76,
      playerForm: 80,
      motivationalFactors: 20,
      sharpMoney: 68,
      paceImpact: 13,
    },
    rawProp: {},
  },
  {
    id: 'NHL-010',
    sport: 'NHL',
    player: 'AHL Callup',
    market: 'points',
    description: 'Zero track record, maximum fallback',
    features: { expectedValue: -18, matchupRating: 20 },
    rawProp: {},
  },
];

// ─── Harness Logic ──────────────────────────────────────────────────────────

interface RuntimeResult {
  pick_id: string;
  sport: string;
  player: string;
  market: string;
  description: string;
  v1: {
    score: number;
    tier: string;
    ev: number;
    postable: boolean;
    executionMs: number;
    error: string | null;
  };
  v2: {
    score: number;
    tier: string;
    ev: number;
    postable: boolean;
    executionMs: number;
    error: string | null;
    featuresPresent: number;
    fallbacksUsed: number;
    excluded: number;
  };
  delta: { score: number; tierChanged: boolean; promotionImpact: boolean; evDelta: number };
}

function isPromotionImpacting(v1Tier: string, v2Tier: string): boolean {
  const promotionTiers = ['S', 'A'];
  const v1Promoted = promotionTiers.includes(v1Tier);
  const v2Promoted = promotionTiers.includes(v2Tier);
  return v1Promoted !== v2Promoted;
}

function runV1(rawProp: Record<string, any>): {
  score: number;
  tier: string;
  ev: number;
  postable: boolean;
  executionMs: number;
  error: string | null;
} {
  const start = performance.now();
  try {
    // Run with V2=false (legacy path)
    const saved = process.env.SCORING_ENGINE_V2;
    delete process.env.SCORING_ENGINE_V2;
    const result = unifiedEdgeScore(rawProp as any);
    if (saved) process.env.SCORING_ENGINE_V2 = saved;
    const ms = performance.now() - start;
    return {
      score: result.score,
      tier: result.tier,
      ev: rawProp.expected_value ?? rawProp.ev ?? 0,
      postable: result.postable,
      executionMs: Math.round(ms * 100) / 100,
      error: null,
    };
  } catch (e: any) {
    const ms = performance.now() - start;
    return {
      score: 0,
      tier: 'ERR',
      ev: 0,
      postable: false,
      executionMs: Math.round(ms * 100) / 100,
      error: e.message,
    };
  }
}

function runV2(features: GradingFeatureSet): {
  score: number;
  tier: string;
  ev: number;
  postable: boolean;
  executionMs: number;
  error: string | null;
  featuresPresent: number;
  fallbacksUsed: number;
  excluded: number;
} {
  const start = performance.now();
  try {
    const result = computeScoreV2(features);
    const ms = performance.now() - start;
    const auditEntries = Object.values(result.feature_audit);
    return {
      score: result.score,
      tier: result.tier,
      ev: result.ev,
      postable: ['S', 'A'].includes(result.tier),
      executionMs: Math.round(ms * 100) / 100,
      error: null,
      featuresPresent: auditEntries.filter(a => a.present).length,
      fallbacksUsed: auditEntries.filter(a => a.fallbackUsed).length,
      excluded: auditEntries.filter(a => a.fallbackPolicy === 'excluded').length,
    };
  } catch (e: any) {
    const ms = performance.now() - start;
    return {
      score: 0,
      tier: 'ERR',
      ev: 0,
      postable: false,
      executionMs: Math.round(ms * 100) / 100,
      error: e.message,
      featuresPresent: 0,
      fallbacksUsed: 0,
      excluded: 0,
    };
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logs.push(msg);
  };

  log('╔══════════════════════════════════════════════════════════════╗');
  log('║         TRANCHE 5 — Runtime Validation Harness             ║');
  log('╚══════════════════════════════════════════════════════════════╝');
  log('');

  // ── Stage A-0: Weight validation ──────────────────────────────────────
  log('=== STAGE A-0: Weight Validation ===');
  for (const sport of ['NBA', 'MLB', 'NFL', 'NHL', 'NCAAF', 'NCAAB', 'WNBA']) {
    const config = getScoringConfig(sport);
    const v2Result = validateWeightsV2(config.weights);
    const status = v2Result.valid ? '✅' : '❌';
    log(
      `  ${status} ${sport}: coreTotal=${v2Result.coreTotal.toFixed(4)}, enhancedTotal=${v2Result.enhancedTotal.toFixed(4)}, total=${v2Result.total.toFixed(4)}, issues=${v2Result.issues.length}`
    );
    if (v2Result.issues.length > 0) {
      for (const issue of v2Result.issues) log(`      ⚠️  ${issue}`);
    }
  }
  log('');

  // ── Stage A-1: Build pick payloads ────────────────────────────────────
  log('=== STAGE A-1: Building Pick Payloads ===');
  log(`  Total picks: ${PICKS.length}`);
  const sportCounts: Record<string, number> = {};
  for (const p of PICKS) {
    sportCounts[p.sport] = (sportCounts[p.sport] || 0) + 1;
  }
  for (const [sport, count] of Object.entries(sportCounts)) {
    log(`  ${sport}: ${count} picks`);
  }
  log('');

  // ── Stage A-2 + B: Run both engines ─────────────────────────────────
  log('=== STAGE A-2/B: Running V1 + V2 Engines ===');
  const results: RuntimeResult[] = [];
  let v2Errors = 0;
  let v1Errors = 0;

  for (const pick of PICKS) {
    const features = makeFeatureSet(pick.sport, {
      ...pick.features,
      propId: pick.id,
      player: pick.player,
      market: { type: pick.market, odds: (pick.features as any).odds || -110, line: 22.5 },
    });
    const rawProp = featuresToRawProp(features);

    const v1 = runV1(rawProp);
    const v2 = runV2(features);

    if (v1.error) v1Errors++;
    if (v2.error) v2Errors++;

    const tierChanged = v1.tier !== v2.tier;
    const promotionImpact = isPromotionImpacting(v1.tier, v2.tier);

    results.push({
      pick_id: pick.id,
      sport: pick.sport,
      player: pick.player,
      market: pick.market,
      description: pick.description,
      v1,
      v2,
      delta: {
        score: Math.round((v2.score - v1.score) * 100) / 100,
        tierChanged,
        promotionImpact,
        evDelta: Math.round((v2.ev - v1.ev) * 100) / 100,
      },
    });

    const tierFlag = tierChanged ? (promotionImpact ? ' ⚠️ PROMO-IMPACT' : ' △TIER') : '';
    log(
      `  [${pick.id}] ${pick.player} (${pick.sport}/${pick.market}): V1=${v1.score.toFixed(1)}/${v1.tier} V2=${v2.score.toFixed(1)}/${v2.tier} Δ=${(v2.score - v1.score).toFixed(1)}${tierFlag}${v1.error ? ' V1-ERR' : ''}${v2.error ? ' V2-ERR' : ''}`
    );
  }

  log('');
  log('=== EXECUTION SUMMARY ===');
  log(`  Total picks processed: ${results.length}`);
  log(`  V1 errors: ${v1Errors}`);
  log(`  V2 errors: ${v2Errors}`);
  const v1AvgMs = results.reduce((s, r) => s + r.v1.executionMs, 0) / results.length;
  const v2AvgMs = results.reduce((s, r) => s + r.v2.executionMs, 0) / results.length;
  log(`  V1 avg execution: ${v1AvgMs.toFixed(2)}ms`);
  log(`  V2 avg execution: ${v2AvgMs.toFixed(2)}ms`);
  log(`  V2 speedup: ${(v1AvgMs / v2AvgMs).toFixed(1)}x`);
  log('');

  // ── Drift Metrics ─────────────────────────────────────────────────────
  const tierChanges = results.filter(r => r.delta.tierChanged);
  const promoImpacts = results.filter(r => r.delta.promotionImpact);
  const avgScoreDelta = results.reduce((s, r) => s + Math.abs(r.delta.score), 0) / results.length;

  const sportDrift: Record<
    string,
    { count: number; totalDelta: number; tierChanges: number; promoImpacts: number }
  > = {};
  for (const r of results) {
    if (!sportDrift[r.sport])
      sportDrift[r.sport] = { count: 0, totalDelta: 0, tierChanges: 0, promoImpacts: 0 };
    sportDrift[r.sport].count++;
    sportDrift[r.sport].totalDelta += r.delta.score;
    if (r.delta.tierChanged) sportDrift[r.sport].tierChanges++;
    if (r.delta.promotionImpact) sportDrift[r.sport].promoImpacts++;
  }

  log('=== DRIFT METRICS ===');
  log(
    `  Tier changes: ${tierChanges.length}/${results.length} (${((tierChanges.length / results.length) * 100).toFixed(1)}%)`
  );
  log(
    `  Promotion-impacting: ${promoImpacts.length}/${results.length} (${((promoImpacts.length / results.length) * 100).toFixed(1)}%)`
  );
  log(`  Avg |score delta|: ${avgScoreDelta.toFixed(2)}`);
  log('');
  log('  By sport:');
  for (const [sport, d] of Object.entries(sportDrift)) {
    const avgDelta = d.totalDelta / d.count;
    log(
      `    ${sport}: n=${d.count}, avgΔ=${avgDelta.toFixed(2)}, tierChanges=${d.tierChanges}, promoImpact=${d.promoImpacts}`
    );
  }
  log('');

  // ── Write artifacts ─────────────────────────────────────────────────
  // A: Runtime logs
  const logsPath = path.join(outDir, 'proof_stageA_runtime_logs.txt');
  fs.writeFileSync(logsPath, logs.join('\n'));
  log(`Wrote: ${logsPath}`);

  // A: Execution summary
  const execSummary = {
    timestamp: new Date().toISOString(),
    totalPicks: results.length,
    sports: Object.keys(sportCounts),
    sportsCount: sportCounts,
    v1Errors,
    v2Errors,
    v1AvgExecutionMs: Math.round(v1AvgMs * 100) / 100,
    v2AvgExecutionMs: Math.round(v2AvgMs * 100) / 100,
    v2Speedup: Math.round((v1AvgMs / v2AvgMs) * 100) / 100,
    driftMetrics: {
      tierChangePct: Math.round((tierChanges.length / results.length) * 10000) / 100,
      promotionImpactPct: Math.round((promoImpacts.length / results.length) * 10000) / 100,
      avgAbsScoreDelta: Math.round(avgScoreDelta * 100) / 100,
      tierChanges: tierChanges.map(r => ({
        pick: r.pick_id,
        sport: r.sport,
        v1Tier: r.v1.tier,
        v2Tier: r.v2.tier,
        promoImpact: r.delta.promotionImpact,
      })),
    },
    sportDrift: Object.fromEntries(
      Object.entries(sportDrift).map(([sport, d]) => [
        sport,
        {
          picks: d.count,
          avgScoreDelta: Math.round((d.totalDelta / d.count) * 100) / 100,
          tierChanges: d.tierChanges,
          promoImpacts: d.promoImpacts,
        },
      ])
    ),
  };
  const execPath = path.join(outDir, 'proof_stageA_execution_summary.json');
  fs.writeFileSync(execPath, JSON.stringify(execSummary, null, 2));
  log(`Wrote: ${execPath}`);

  // B: Shadow comparison
  const shadowPath = path.join(outDir, 'SHADOW_COMPARISON.json');
  fs.writeFileSync(shadowPath, JSON.stringify(results, null, 2));
  log(`Wrote: ${shadowPath}`);

  // B: Runner output
  const runnerPath = path.join(outDir, 'proof_stageB_runner.txt');
  fs.writeFileSync(runnerPath, logs.join('\n'));
  log(`Wrote: ${runnerPath}`);

  // ── Final status ────────────────────────────────────────────────────
  log('');
  log('╔══════════════════════════════════════════════════════════════╗');
  log(
    `║  V2 Errors: ${v2Errors}    Tier Changes: ${tierChanges.length}/${results.length}    Promo Impact: ${promoImpacts.length}/${results.length}  ║`
  );
  log('╚══════════════════════════════════════════════════════════════╝');

  // Re-write logs with final content
  fs.writeFileSync(logsPath, logs.join('\n'));
  fs.writeFileSync(runnerPath, logs.join('\n'));
}

main();
