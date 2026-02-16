/* eslint-disable */
/**
 * run-canary-harness.ts — Tranche 6 Canary Router Harness
 *
 * Exercises the canary router + scoring pipeline in 3 configurations:
 *   (a) default — no flags → all V1
 *   (b) shadow  — SCORING_SHADOW=true → V1 output + drift logs
 *   (c) canary  — SCORING_CANARY_SPORTS=NBA, SCORING_CANARY_PERCENT=10 → mixed V1/V2
 *
 * Produces deterministic output bundles under out/scoring-rebuild/2026-01-29/tranche-6/
 * Does NOT require secrets or DB connections.
 *
 * Usage:
 *   npx tsx scripts/scoring/run-canary-harness.ts
 *
 * Created: 2026-01-29 (Tranche 6 — Scoring Rebuild)
 */

import * as fs from 'fs';
import * as path from 'path';

// Resolve relative to repo root since this script lives in scripts/scoring/
const repoRoot = path.resolve(__dirname, '../../');

// Import scoring + canary modules from apps/api
const apiSrc = path.join(repoRoot, 'apps/api/src');

// Use require for cross-directory imports (tsx resolves paths correctly)
const { computeScoreV2 } = require(path.join(apiSrc, 'agents/GradingAgent/scoring/computeScoreV2'));
const { unifiedEdgeScore } = require(path.join(apiSrc, 'logic/scoring/unified-edge-score'));
const { canaryDecide, parseCanaryConfig, stableHash } = require(
  path.join(apiSrc, 'agents/GradingAgent/scoring/canaryRouter')
);
const { logDrift, topContributors, isPromotionImpacting } = require(
  path.join(apiSrc, 'agents/GradingAgent/scoring/driftLogger')
);

// ─── Output Directory ────────────────────────────────────────────────────────

const outDir = path.join(repoRoot, 'out/scoring-rebuild/2026-01-29/tranche-6');
const harnessOutDir = path.join(outDir, 'HARNESS_OUTPUTS');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ─── 48 Deterministic Pick Payloads (12 per sport × 4 sports) ────────────────

interface PickPayload {
  id: string;
  sport: string;
  player: string;
  market: string;
  description: string;
  ev: number;
  features: Record<string, any>;
}

const PICKS: PickPayload[] = [
  // ── NBA (12) ─────────────────────────────────────────────────────────────
  {
    id: 'NBA-001',
    sport: 'NBA',
    player: 'Luka Doncic',
    market: 'points',
    description: 'Elite scorer, strong matchup',
    ev: 18,
    features: {
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
    description: 'Above avg rebounder',
    ev: 8,
    features: { matchupRating: 65, playerForm: 72, sharpMoney: 60, odds: -115 },
  },
  {
    id: 'NBA-003',
    sport: 'NBA',
    player: 'Tyrese Haliburton',
    market: 'assists',
    description: 'Pass-first guard',
    ev: 12,
    features: {
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
    description: 'Low-minute, neg EV',
    ev: -12,
    features: {
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
    description: 'Elite defender',
    ev: 15,
    features: {
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
    description: 'MVP candidate',
    ev: 20,
    features: {
      matchupRating: 92,
      playerForm: 95,
      sharpMoney: 85,
      odds: -200,
      closingLineValue: 7,
    },
  },
  {
    id: 'NBA-007',
    sport: 'NBA',
    player: "De'Aaron Fox",
    market: 'steals',
    description: 'Quick guard, high variance',
    ev: 4,
    features: { matchupRating: 58, playerForm: 62, volatility: 7, correlationRisk: 0.3 },
  },
  {
    id: 'NBA-008',
    sport: 'NBA',
    player: 'Nikola Jokic',
    market: 'assists',
    description: 'Triple-double threat',
    ev: 14,
    features: {
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
    description: 'Minimal data',
    ev: -5,
    features: { matchupRating: 45 },
  },
  {
    id: 'NBA-010',
    sport: 'NBA',
    player: 'Giannis Antetokounmpo',
    market: 'PRA',
    description: 'Dominant combo stat',
    ev: 10,
    features: { matchupRating: 78, playerForm: 82, odds: 150, sharpMoney: 68, lineMovement: 2 },
  },
  {
    id: 'NBA-011',
    sport: 'NBA',
    player: 'Donovan Mitchell',
    market: 'points',
    description: 'Scoring guard, moderate',
    ev: 6,
    features: { matchupRating: 62, playerForm: 70, sharpMoney: 55 },
  },
  {
    id: 'NBA-012',
    sport: 'NBA',
    player: 'LaMelo Ball',
    market: 'assists',
    description: 'Young playmaker',
    ev: 9,
    features: { matchupRating: 70, playerForm: 74, volumeProfile: 65 },
  },

  // ── MLB (12) ─────────────────────────────────────────────────────────────
  {
    id: 'MLB-001',
    sport: 'MLB',
    player: 'Shohei Ohtani',
    market: 'strikeouts',
    description: 'Elite pitcher, weather favorable',
    ev: 16,
    features: {
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
    description: 'Power hitter',
    ev: 10,
    features: {
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
    description: 'Contact hitter',
    ev: 6,
    features: { matchupRating: 68, playerForm: 70, weatherImpact: 3, sharpMoney: 58 },
  },
  {
    id: 'MLB-004',
    sport: 'MLB',
    player: 'Backup Catcher',
    market: 'hits',
    description: 'Low batting avg',
    ev: -15,
    features: { matchupRating: 30, playerForm: 28, sharpMoney: 25, weatherImpact: 0 },
  },
  {
    id: 'MLB-005',
    sport: 'MLB',
    player: 'Gerrit Cole',
    market: 'outs',
    description: 'Quality start candidate',
    ev: 8,
    features: { matchupRating: 72, playerForm: 75, weatherImpact: 12, injuryImpact: 4 },
  },
  {
    id: 'MLB-006',
    sport: 'MLB',
    player: 'Juan Soto',
    market: 'walks',
    description: 'Elite plate discipline',
    ev: 5,
    features: { matchupRating: 60, playerForm: 65, volatility: 6, sharpMoney: 55 },
  },
  {
    id: 'MLB-007',
    sport: 'MLB',
    player: 'Corbin Burnes',
    market: 'strikeouts',
    description: 'Solid pitcher',
    ev: 11,
    features: {
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
    description: 'Speed threat',
    ev: 3,
    features: { matchupRating: 55, playerForm: 58, volatility: 8, correlationRisk: 0.35 },
  },
  {
    id: 'MLB-009',
    sport: 'MLB',
    player: 'Zack Wheeler',
    market: 'earned_runs',
    description: 'Ace, strong opposing lineup',
    ev: -2,
    features: {
      matchupRating: 82,
      playerForm: 80,
      weatherImpact: 2,
      sharpMoney: 62,
      closingLineValue: 1,
    },
  },
  {
    id: 'MLB-010',
    sport: 'MLB',
    player: 'Freddie Freeman',
    market: 'RBI',
    description: 'Cleanup hitter',
    ev: 13,
    features: {
      matchupRating: 76,
      playerForm: 78,
      venueAdvantage: 22,
      weatherImpact: 4,
      sharpMoney: 74,
    },
  },
  {
    id: 'MLB-011',
    sport: 'MLB',
    player: 'Trea Turner',
    market: 'hits',
    description: 'Speedy contact hitter',
    ev: 7,
    features: { matchupRating: 66, playerForm: 72, sharpMoney: 60 },
  },
  {
    id: 'MLB-012',
    sport: 'MLB',
    player: 'Spencer Strider',
    market: 'strikeouts',
    description: 'High K-rate arm',
    ev: 14,
    features: { matchupRating: 84, playerForm: 86, sharpMoney: 78, closingLineValue: 4 },
  },

  // ── NFL (12) ─────────────────────────────────────────────────────────────
  {
    id: 'NFL-001',
    sport: 'NFL',
    player: 'Patrick Mahomes',
    market: 'passing_yards',
    description: 'Elite QB, dome game',
    ev: 15,
    features: {
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
    description: 'Workhorse RB',
    ev: 10,
    features: {
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
    ev: 7,
    features: { matchupRating: 70, playerForm: 65, injuryImpact: 8, sharpMoney: 60 },
  },
  {
    id: 'NFL-004',
    sport: 'NFL',
    player: 'WR3 Depth Player',
    market: 'receptions',
    description: 'Low target share',
    ev: -10,
    features: { matchupRating: 35, playerForm: 38, sharpMoney: 30, volumeProfile: 20 },
  },
  {
    id: 'NFL-005',
    sport: 'NFL',
    player: 'Josh Allen',
    market: 'rushing_yards',
    description: 'Dual-threat QB',
    ev: 8,
    features: {
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
    description: 'WR1, strong targets',
    ev: 16,
    features: {
      matchupRating: 85,
      playerForm: 88,
      sharpMoney: 78,
      closingLineValue: 5,
      paceImpact: 14,
    },
  },
  {
    id: 'NFL-007',
    sport: 'NFL',
    player: 'Saquon Barkley',
    market: 'rushing_attempts',
    description: 'Bell cow, moderate',
    ev: 4,
    features: { matchupRating: 62, playerForm: 68, paceImpact: 10, sharpMoney: 52 },
  },
  {
    id: 'NFL-008',
    sport: 'NFL',
    player: 'T.J. Watt',
    market: 'sacks',
    description: 'Elite pass rusher',
    ev: 3,
    features: { matchupRating: 70, playerForm: 75, volatility: 7, correlationRisk: 0.3 },
  },
  {
    id: 'NFL-009',
    sport: 'NFL',
    player: 'Lamar Jackson',
    market: 'passing_TDs',
    description: 'Dual-threat QB',
    ev: 9,
    features: { matchupRating: 74, playerForm: 82, paceImpact: 15, sharpMoney: 66 },
  },
  {
    id: 'NFL-010',
    sport: 'NFL',
    player: 'CeeDee Lamb',
    market: 'receptions',
    description: 'Target monster',
    ev: 5,
    features: { matchupRating: 60, playerForm: 72, sharpMoney: 56, volumeProfile: 68 },
  },
  {
    id: 'NFL-011',
    sport: 'NFL',
    player: 'Nick Chubb',
    market: 'rushing_yards',
    description: 'Physical runner',
    ev: 6,
    features: { matchupRating: 68, playerForm: 74, injuryImpact: 5, sharpMoney: 58 },
  },
  {
    id: 'NFL-012',
    sport: 'NFL',
    player: 'Micah Parsons',
    market: 'sacks',
    description: 'Pass rush specialist',
    ev: 2,
    features: { matchupRating: 72, playerForm: 80, volatility: 8 },
  },

  // ── NHL (12) ─────────────────────────────────────────────────────────────
  {
    id: 'NHL-001',
    sport: 'NHL',
    player: 'Connor McDavid',
    market: 'points',
    description: 'Generational talent',
    ev: 18,
    features: {
      matchupRating: 92,
      playerForm: 95,
      sharpMoney: 85,
      closingLineValue: 6,
      odds: -130,
    },
  },
  {
    id: 'NHL-002',
    sport: 'NHL',
    player: 'Auston Matthews',
    market: 'shots_on_goal',
    description: 'Elite goal scorer',
    ev: 12,
    features: { matchupRating: 80, playerForm: 85, sharpMoney: 72, closingLineValue: 3 },
  },
  {
    id: 'NHL-003',
    sport: 'NHL',
    player: 'Nathan MacKinnon',
    market: 'assists',
    description: 'Playmaker, high pace',
    ev: 10,
    features: { matchupRating: 78, playerForm: 80, paceImpact: 14, sharpMoney: 68 },
  },
  {
    id: 'NHL-004',
    sport: 'NHL',
    player: '4th Line Forward',
    market: 'shots_on_goal',
    description: 'Low ice time',
    ev: -14,
    features: { matchupRating: 28, playerForm: 32, sharpMoney: 22, volumeProfile: 18 },
  },
  {
    id: 'NHL-005',
    sport: 'NHL',
    player: 'Cale Makar',
    market: 'blocked_shots',
    description: 'Elite defenseman',
    ev: 6,
    features: { matchupRating: 70, playerForm: 75, sharpMoney: 62, paceImpact: 12 },
  },
  {
    id: 'NHL-006',
    sport: 'NHL',
    player: 'Leon Draisaitl',
    market: 'goals',
    description: 'Power play specialist',
    ev: 15,
    features: {
      matchupRating: 84,
      playerForm: 88,
      sharpMoney: 80,
      closingLineValue: 5,
      venueAdvantage: 14,
    },
  },
  {
    id: 'NHL-007',
    sport: 'NHL',
    player: 'Andrei Vasilevskiy',
    market: 'saves',
    description: 'Elite goalie',
    ev: 8,
    features: { matchupRating: 74, playerForm: 78, sharpMoney: 65, volumeProfile: 72 },
  },
  {
    id: 'NHL-008',
    sport: 'NHL',
    player: 'Jack Hughes',
    market: 'points',
    description: 'Young star, streaky',
    ev: 5,
    features: { matchupRating: 62, playerForm: 68, volatility: 6, sharpMoney: 55 },
  },
  {
    id: 'NHL-009',
    sport: 'NHL',
    player: 'David Pastrnak',
    market: 'shots_on_goal',
    description: 'Shot-happy winger',
    ev: 11,
    features: { matchupRating: 76, playerForm: 82, sharpMoney: 70, closingLineValue: 4 },
  },
  {
    id: 'NHL-010',
    sport: 'NHL',
    player: 'AHL Callup',
    market: 'points',
    description: 'Zero track record',
    ev: -18,
    features: { matchupRating: 25, playerForm: 30, sharpMoney: 20, volumeProfile: 15 },
  },
  {
    id: 'NHL-011',
    sport: 'NHL',
    player: 'Nikita Kucherov',
    market: 'assists',
    description: 'Elite playmaker',
    ev: 13,
    features: { matchupRating: 82, playerForm: 84, sharpMoney: 76, closingLineValue: 4 },
  },
  {
    id: 'NHL-012',
    sport: 'NHL',
    player: 'Igor Shesterkin',
    market: 'saves',
    description: 'Vezina contender',
    ev: 9,
    features: { matchupRating: 78, playerForm: 82, sharpMoney: 68, volumeProfile: 70 },
  },
];

// ─── Feature Set Builder ─────────────────────────────────────────────────────

function buildFeatureSet(pick: PickPayload): any {
  return {
    propId: pick.id,
    date: '2026-01-29',
    sport: pick.sport,
    league: pick.sport,
    player: pick.player,
    odds: pick.features.odds || -110,
    market: { type: pick.market, odds: pick.features.odds || -110, line: 22.5 },
    expectedValue: pick.ev,
    lineMovement: pick.features.lineMovement ?? 1,
    matchupRating: pick.features.matchupRating ?? 55,
    playerForm: pick.features.playerForm ?? 60,
    injuryImpact: pick.features.injuryImpact ?? 2,
    weatherImpact: pick.features.weatherImpact ?? 0,
    marketIntelligence: pick.features.marketIntelligence ?? 55,
    sharpMoney: pick.features.sharpMoney ?? 55,
    volumeProfile: pick.features.volumeProfile ?? 50,
    closingLineValue: pick.features.closingLineValue ?? 1,
    playerFatigue: pick.features.playerFatigue ?? 60,
    venueAdvantage: pick.features.venueAdvantage ?? 10,
    refereeImpact: pick.features.refereeImpact ?? 2,
    paceImpact: pick.features.paceImpact ?? 10,
    motivationalFactors: pick.features.motivationalFactors ?? 12,
    correlationRisk: pick.features.correlationRisk ?? 0.15,
    volatility: pick.features.volatility ?? 3,
    portfolioImpact: pick.features.portfolioImpact ?? 0.08,
    dataQuality: {
      dataValidationScore: 0.95,
      outlierScore: 0.95,
      consistencyScore: 0.95,
      completeness: 0.85,
    },
    timestamp: '2026-01-29T14:00:00Z',
    version: 'tranche6-harness',
    source: 'tranche6',
    confidence: 0.75,
  };
}

function featuresToRawProp(features: any): Record<string, any> {
  return {
    id: features.propId,
    league: features.sport,
    sport: features.sport,
    player_name: features.player,
    odds: features.odds,
    market_type: features.market?.type,
    stat_type: features.market?.type,
    line: features.market?.line,
    expected_value: features.expectedValue,
    ev: features.expectedValue,
    line_movement: features.lineMovement,
    matchup_score: features.matchupRating,
    player_form: features.playerForm,
    injury_impact: features.injuryImpact,
    weather_impact: features.weatherImpact,
    market_intelligence: features.marketIntelligence,
    sharp_money: features.sharpMoney,
    volume_profile: features.volumeProfile,
    closing_line_value: features.closingLineValue,
    player_fatigue: features.playerFatigue,
    venue_advantage: features.venueAdvantage,
    referee_impact: features.refereeImpact,
    pace_impact: features.paceImpact,
    motivational_factors: features.motivationalFactors,
    correlation_risk: features.correlationRisk,
    volatility: features.volatility,
    portfolio_impact: features.portfolioImpact,
  };
}

// ─── Run Configuration ───────────────────────────────────────────────────────

interface RunResult {
  pick_id: string;
  sport: string;
  player: string;
  canary_decision: { mode: string; reason: string };
  v1: { score: number; tier: string } | null;
  v2: { score: number; tier: string; ev: number; top_contributors: any[] } | null;
  drift_log: any | null;
}

function runConfig(
  configName: string,
  envOverrides: Record<string, string>
): { results: RunResult[]; driftLogs: any[] } {
  // Save and set env
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(envOverrides)) {
    saved[k] = process.env[k];
    process.env[k] = v;
  }
  // Clear any env vars not in overrides
  for (const key of [
    'SCORING_ENGINE_V2',
    'SCORING_KILL_SWITCH',
    'SCORING_SHADOW',
    'SCORING_CANARY_SPORTS',
    'SCORING_CANARY_PERCENT',
  ]) {
    if (!(key in envOverrides)) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  }

  const results: RunResult[] = [];
  const driftLogs: any[] = [];

  // Capture drift logs from stdout
  const origLog = console.log;
  console.log = (...args: any[]) => {
    const msg = args[0];
    if (typeof msg === 'string' && msg.includes('"type":"scoring_drift"')) {
      try {
        driftLogs.push(JSON.parse(msg));
      } catch {
        /* ignore non-JSON */
      }
    }
    origLog.apply(console, args);
  };

  for (const pick of PICKS) {
    const features = buildFeatureSet(pick);
    const rawProp = featuresToRawProp(features);

    // Get canary decision
    const decision = canaryDecide(pick.sport, pick.id);

    let v1Result: any = null;
    let v2Result: any = null;

    // Run through unifiedEdgeScore (which now has canary routing)
    const edgeResult = unifiedEdgeScore(rawProp);

    if (decision.mode === 'v2') {
      v2Result = {
        score: edgeResult.score,
        tier: edgeResult.tier,
        ev: pick.ev,
        top_contributors: [],
      };
    } else {
      v1Result = {
        score: edgeResult.score,
        tier: edgeResult.tier,
      };
      // In shadow mode, also compute V2 directly for the result
      if (decision.mode === 'shadow') {
        const v2Direct = computeScoreV2(features);
        v2Result = {
          score: v2Direct.score,
          tier: v2Direct.tier,
          ev: v2Direct.ev,
          top_contributors: topContributors(v2Direct.breakdown, 3),
        };
      }
    }

    results.push({
      pick_id: pick.id,
      sport: pick.sport,
      player: pick.player,
      canary_decision: decision,
      v1: v1Result,
      v2: v2Result,
      drift_log: null, // filled from captured logs
    });
  }

  // Restore console.log
  console.log = origLog;

  // Restore env
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }

  return { results, driftLogs };
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  ensureDir(outDir);
  ensureDir(harnessOutDir);

  const configs = [
    {
      name: 'default',
      label: '(a) DEFAULT — no flags → all V1',
      env: {} as Record<string, string>,
    },
    {
      name: 'shadow',
      label: '(b) SHADOW — SCORING_ENGINE_V2=true, SCORING_SHADOW=true → V1 output + drift logs',
      env: {
        SCORING_ENGINE_V2: 'true',
        SCORING_SHADOW: 'true',
      },
    },
    {
      name: 'canary',
      label:
        '(c) CANARY — SCORING_ENGINE_V2=true, SCORING_CANARY_SPORTS=NBA, SCORING_CANARY_PERCENT=10',
      env: {
        SCORING_ENGINE_V2: 'true',
        SCORING_CANARY_SPORTS: 'NBA',
        SCORING_CANARY_PERCENT: '10',
      },
    },
  ];

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         TRANCHE 6 — Canary Router Harness                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`Total picks: ${PICKS.length} (${[...new Set(PICKS.map(p => p.sport))].join(', ')})`);
  console.log('');

  for (const cfg of configs) {
    console.log(`\n=== ${cfg.label} ===`);
    const { results, driftLogs } = runConfig(cfg.name, cfg.env);

    // Compute stats
    const v1Count = results.filter(r => r.canary_decision.mode === 'v1').length;
    const v2Count = results.filter(r => r.canary_decision.mode === 'v2').length;
    const shadowCount = results.filter(r => r.canary_decision.mode === 'shadow').length;

    const promoImpacting = driftLogs.filter(l => l.promotion_impacting).length;
    const tierChanges = driftLogs.filter(l => l.deltas?.tier_changed).length;

    console.log(`  Decisions: V1=${v1Count} V2=${v2Count} Shadow=${shadowCount}`);
    console.log(`  Drift logs: ${driftLogs.length}`);
    if (driftLogs.length > 0) {
      console.log(`  Tier changes: ${tierChanges}/${driftLogs.length}`);
      console.log(`  Promotion-impacting: ${promoImpacting}/${driftLogs.length}`);
    }

    // Print per-pick detail
    for (const r of results) {
      const mode = r.canary_decision.mode.toUpperCase().padEnd(6);
      const v1Str = r.v1 ? `V1=${r.v1.score.toFixed(1)}/${r.v1.tier}` : 'V1=n/a';
      const v2Str = r.v2 ? `V2=${r.v2.score.toFixed(1)}/${r.v2.tier}` : 'V2=n/a';
      const flag = r.v1 && r.v2 && r.v1.tier !== r.v2.tier ? ' ⚠️ TIER-CHANGE' : '';
      console.log(
        `  [${r.pick_id}] ${mode} ${r.player.padEnd(25)} ${v1Str.padEnd(18)} ${v2Str}${flag}`
      );
    }

    // Per-sport hash distribution for canary config
    if (cfg.name === 'canary') {
      console.log('\n  Hash bucket distribution (NBA picks):');
      for (const r of results.filter(r => r.sport === 'NBA')) {
        const bucket = stableHash(r.pick_id);
        const passed = bucket < 10 ? '✅ V2' : '❌ V1';
        console.log(`    ${r.pick_id}: bucket=${bucket} → ${passed}`);
      }
    }

    // Write JSON output
    const output = {
      config: cfg.name,
      env: cfg.env,
      timestamp: new Date().toISOString(),
      totalPicks: PICKS.length,
      decisions: { v1: v1Count, v2: v2Count, shadow: shadowCount },
      driftStats: {
        totalDriftLogs: driftLogs.length,
        tierChanges,
        promotionImpacting: promoImpacting,
      },
      results,
      driftLogs,
    };

    fs.writeFileSync(path.join(harnessOutDir, `${cfg.name}.json`), JSON.stringify(output, null, 2));
    console.log(`  → Wrote: ${path.join(harnessOutDir, `${cfg.name}.json`)}`);
  }

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Harness complete. Check HARNESS_OUTPUTS/ for JSON files.  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
}

main();
