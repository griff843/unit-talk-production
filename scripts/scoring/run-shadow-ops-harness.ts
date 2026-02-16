/* eslint-disable */
/**
 * run-shadow-ops-harness.ts — Tranche 8 Shadow Ops Harness
 *
 * Simulates production shadow mode by:
 *   1. Running 48 picks × 7 simulated days = 336 shadow records
 *   2. Computing V2 scores alongside V1 placeholders (shadow mode)
 *   3. Evaluating promotion policy for each pick
 *   4. Feeding all results through the ops aggregator
 *   5. Generating DAILY + WEEKLY summaries
 *
 * Output:
 *   SHADOW_OPS_METRICS.json    — raw metrics per day
 *   DAILY_PROMOTION_SUMMARY.md — latest day summary
 *   WEEKLY_PROMOTION_SUMMARY.md — 7-day summary
 *
 * No DB writes — pure computation.
 *
 * Usage:
 *   npx tsx scripts/scoring/run-shadow-ops-harness.ts
 *
 * Created: 2026-01-29 (Tranche 8 — Prod Shadow Monitoring)
 */

import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '../../');
const apiSrc = path.join(repoRoot, 'apps/api/src');

// Import scoring modules
const { computeScoreV2 } = require(path.join(apiSrc, 'agents/GradingAgent/scoring/computeScoreV2'));
const {
  evaluatePromotion,
  parsePromotionPolicyConfig,
  scoreToConfidence,
  evToDecimal,
  findCriticalDataGaps,
} = require(path.join(apiSrc, 'agents/GradingAgent/scoring/promotionPolicy'));
const { logDrift } = require(path.join(apiSrc, 'agents/GradingAgent/scoring/driftLogger'));

// Import aggregator
const {
  aggregateMetrics,
  generateDailySummary,
  generateWeeklySummary,
} = require('./shadow-ops-aggregator');

import type { ShadowRecord, OpsMetrics } from './shadow-ops-aggregator';

// ─── Output Directory ────────────────────────────────────────────────────────

const outDir = path.join(repoRoot, 'out/scoring-rebuild/2026-01-29/tranche-8');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ─── 48 Deterministic Pick Payloads (reuse from T6/T7) ──────────────────────

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
  // NBA (12)
  { id: 'NBA-001', sport: 'NBA', player: 'Luka Doncic', market: 'points', description: 'Elite scorer', ev: 18, features: { matchupRating: 88, playerForm: 90, sharpMoney: 80, closingLineValue: 6, lineMovement: 3 } },
  { id: 'NBA-002', sport: 'NBA', player: 'Jayson Tatum', market: 'rebounds', description: 'Above avg', ev: 8, features: { matchupRating: 65, playerForm: 72, sharpMoney: 60, odds: -115 } },
  { id: 'NBA-003', sport: 'NBA', player: 'Tyrese Haliburton', market: 'assists', description: 'Pass-first', ev: 12, features: { matchupRating: 75, playerForm: 78, sharpMoney: 70, volumeProfile: 70, closingLineValue: 4 } },
  { id: 'NBA-004', sport: 'NBA', player: 'Bench Player', market: 'points', description: 'Neg EV', ev: -12, features: { matchupRating: 35, playerForm: 40, sharpMoney: 30, volumeProfile: 25, closingLineValue: -3 } },
  { id: 'NBA-005', sport: 'NBA', player: 'Anthony Davis', market: 'blocks', description: 'Elite D', ev: 15, features: { matchupRating: 80, playerForm: 85, injuryImpact: 6, sharpMoney: 75, correlationRisk: 0.25 } },
  { id: 'NBA-006', sport: 'NBA', player: 'Shai Gilgeous-Alexander', market: 'points', description: 'MVP cand', ev: 20, features: { matchupRating: 92, playerForm: 95, sharpMoney: 85, odds: -200, closingLineValue: 7 } },
  { id: 'NBA-007', sport: 'NBA', player: "De'Aaron Fox", market: 'steals', description: 'Quick guard', ev: 4, features: { matchupRating: 58, playerForm: 62, volatility: 7, correlationRisk: 0.3 } },
  { id: 'NBA-008', sport: 'NBA', player: 'Nikola Jokic', market: 'assists', description: 'Triple-double', ev: 14, features: { matchupRating: 82, playerForm: 88, sharpMoney: 78, closingLineValue: 5, paceImpact: 16 } },
  { id: 'NBA-009', sport: 'NBA', player: 'Random Role Player', market: 'threes', description: 'Minimal data', ev: -5, features: { matchupRating: 45 } },
  { id: 'NBA-010', sport: 'NBA', player: 'Giannis Antetokounmpo', market: 'PRA', description: 'Dominant', ev: 10, features: { matchupRating: 78, playerForm: 82, odds: 150, sharpMoney: 68, lineMovement: 2 } },
  { id: 'NBA-011', sport: 'NBA', player: 'Donovan Mitchell', market: 'points', description: 'Scoring guard', ev: 6, features: { matchupRating: 62, playerForm: 70, sharpMoney: 55 } },
  { id: 'NBA-012', sport: 'NBA', player: 'LaMelo Ball', market: 'assists', description: 'Young PM', ev: 9, features: { matchupRating: 70, playerForm: 74, volumeProfile: 65 } },
  // MLB (12)
  { id: 'MLB-001', sport: 'MLB', player: 'Shohei Ohtani', market: 'strikeouts', description: 'Elite P', ev: 16, features: { matchupRating: 90, playerForm: 92, weatherImpact: 8, sharpMoney: 82, closingLineValue: 5 } },
  { id: 'MLB-002', sport: 'MLB', player: 'Aaron Judge', market: 'total_bases', description: 'Power', ev: 10, features: { matchupRating: 75, playerForm: 80, weatherImpact: 5, venueAdvantage: 18, sharpMoney: 70 } },
  { id: 'MLB-003', sport: 'MLB', player: 'Mookie Betts', market: 'hits', description: 'Contact', ev: 5, features: { matchupRating: 68, playerForm: 72, sharpMoney: 62 } },
  { id: 'MLB-004', sport: 'MLB', player: 'Backup Catcher', market: 'hits', description: 'Neg EV', ev: -15, features: { matchupRating: 30, playerForm: 35, sharpMoney: 25 } },
  { id: 'MLB-005', sport: 'MLB', player: 'Gerrit Cole', market: 'strikeouts', description: 'Ace', ev: 14, features: { matchupRating: 85, playerForm: 88, sharpMoney: 80, closingLineValue: 4 } },
  { id: 'MLB-006', sport: 'MLB', player: 'Ronald Acuna Jr', market: 'total_bases', description: 'MVP OF', ev: 11, features: { matchupRating: 78, playerForm: 82, sharpMoney: 72, venueAdvantage: 14 } },
  { id: 'MLB-007', sport: 'MLB', player: 'Julio Rodriguez', market: 'hits', description: 'Young star', ev: 7, features: { matchupRating: 65, playerForm: 68, sharpMoney: 55 } },
  { id: 'MLB-008', sport: 'MLB', player: 'Spencer Strider', market: 'strikeouts', description: 'Flame', ev: 13, features: { matchupRating: 82, playerForm: 85, sharpMoney: 75 } },
  { id: 'MLB-009', sport: 'MLB', player: 'Utility Infielder', market: 'hits', description: 'Platoon', ev: -8, features: { matchupRating: 42, playerForm: 45, sharpMoney: 35 } },
  { id: 'MLB-010', sport: 'MLB', player: 'Freddie Freeman', market: 'hits', description: 'Consistent', ev: 8, features: { matchupRating: 72, playerForm: 76, sharpMoney: 65 } },
  { id: 'MLB-011', sport: 'MLB', player: 'Corbin Burnes', market: 'strikeouts', description: 'Control P', ev: 12, features: { matchupRating: 80, playerForm: 83, sharpMoney: 74, closingLineValue: 3 } },
  { id: 'MLB-012', sport: 'MLB', player: 'Juan Soto', market: 'total_bases', description: 'Discipline', ev: 9, features: { matchupRating: 74, playerForm: 78, sharpMoney: 68 } },
  // NFL (12)
  { id: 'NFL-001', sport: 'NFL', player: 'Patrick Mahomes', market: 'passing_yards', description: 'Elite QB', ev: 15, features: { matchupRating: 88, playerForm: 90, sharpMoney: 82, closingLineValue: 5 } },
  { id: 'NFL-002', sport: 'NFL', player: 'Travis Kelce', market: 'receptions', description: 'Top TE', ev: 10, features: { matchupRating: 75, playerForm: 80, sharpMoney: 70 } },
  { id: 'NFL-003', sport: 'NFL', player: 'Lamar Jackson', market: 'rushing_yards', description: 'Dual-threat', ev: 12, features: { matchupRating: 78, playerForm: 82, sharpMoney: 74 } },
  { id: 'NFL-004', sport: 'NFL', player: 'Practice Squad WR', market: 'receptions', description: 'Fringe', ev: -20, features: { matchupRating: 22, playerForm: 25, sharpMoney: 18 } },
  { id: 'NFL-005', sport: 'NFL', player: 'Josh Allen', market: 'passing_TDs', description: 'Top-5 QB', ev: 14, features: { matchupRating: 82, playerForm: 86, sharpMoney: 78, closingLineValue: 4 } },
  { id: 'NFL-006', sport: 'NFL', player: 'CeeDee Lamb', market: 'receiving_yards', description: 'WR1', ev: 11, features: { matchupRating: 76, playerForm: 80, sharpMoney: 70 } },
  { id: 'NFL-007', sport: 'NFL', player: 'Special Teams Player', market: 'tackles', description: 'Low vol', ev: -10, features: { matchupRating: 35, playerForm: 40, sharpMoney: 28 } },
  { id: 'NFL-008', sport: 'NFL', player: 'Tyreek Hill', market: 'receiving_yards', description: 'Speed', ev: 13, features: { matchupRating: 80, playerForm: 84, sharpMoney: 76 } },
  { id: 'NFL-009', sport: 'NFL', player: 'Backup QB', market: 'passing_yards', description: 'Emergency', ev: -25, features: { matchupRating: 20, playerForm: 22, sharpMoney: 15 } },
  { id: 'NFL-010', sport: 'NFL', player: 'Christian McCaffrey', market: 'rushing_yards', description: 'RB1', ev: 11, features: { matchupRating: 78, playerForm: 80, sharpMoney: 72 } },
  { id: 'NFL-011', sport: 'NFL', player: 'Davante Adams', market: 'receptions', description: 'Route', ev: 9, features: { matchupRating: 72, playerForm: 76, sharpMoney: 66 } },
  { id: 'NFL-012', sport: 'NFL', player: 'Justin Jefferson', market: 'receiving_yards', description: 'Elite WR', ev: 16, features: { matchupRating: 86, playerForm: 88, sharpMoney: 80, closingLineValue: 6 } },
  // NHL (12)
  { id: 'NHL-001', sport: 'NHL', player: 'Connor McDavid', market: 'points', description: 'Best NHL', ev: 17, features: { matchupRating: 92, playerForm: 95, sharpMoney: 85, closingLineValue: 6, venueAdvantage: 12 } },
  { id: 'NHL-002', sport: 'NHL', player: 'Nathan MacKinnon', market: 'shots', description: 'Power F', ev: 11, features: { matchupRating: 80, playerForm: 84, sharpMoney: 72 } },
  { id: 'NHL-003', sport: 'NHL', player: 'Auston Matthews', market: 'goals', description: 'Sniper', ev: 13, features: { matchupRating: 82, playerForm: 86, sharpMoney: 78, closingLineValue: 4 } },
  { id: 'NHL-004', sport: 'NHL', player: 'AHL Call-Up', market: 'shots', description: 'No record', ev: -16, features: { matchupRating: 28, playerForm: 30, sharpMoney: 22 } },
  { id: 'NHL-005', sport: 'NHL', player: 'Cale Makar', market: 'assists', description: 'Elite D', ev: 14, features: { matchupRating: 84, playerForm: 88, sharpMoney: 80, closingLineValue: 5 } },
  { id: 'NHL-006', sport: 'NHL', player: 'Leon Draisaitl', market: 'points', description: 'PP spec', ev: 15, features: { matchupRating: 86, playerForm: 90, sharpMoney: 82 } },
  { id: 'NHL-007', sport: 'NHL', player: '4th Line Grinder', market: 'hits', description: 'Physical', ev: -8, features: { matchupRating: 38, playerForm: 42, sharpMoney: 30 } },
  { id: 'NHL-008', sport: 'NHL', player: 'David Pastrnak', market: 'shots', description: 'Offense', ev: 12, features: { matchupRating: 80, playerForm: 82, sharpMoney: 74 } },
  { id: 'NHL-009', sport: 'NHL', player: 'Andrei Vasilevskiy', market: 'saves', description: 'Elite G', ev: 10, features: { matchupRating: 76, playerForm: 80, sharpMoney: 68 } },
  { id: 'NHL-010', sport: 'NHL', player: 'Backup Goalie', market: 'saves', description: 'No track', ev: -18, features: { matchupRating: 25, playerForm: 30, sharpMoney: 20, volumeProfile: 15 } },
  { id: 'NHL-011', sport: 'NHL', player: 'Nikita Kucherov', market: 'assists', description: 'Playmaker', ev: 13, features: { matchupRating: 82, playerForm: 84, sharpMoney: 76, closingLineValue: 4 } },
  { id: 'NHL-012', sport: 'NHL', player: 'Igor Shesterkin', market: 'saves', description: 'Vezina', ev: 9, features: { matchupRating: 78, playerForm: 82, sharpMoney: 68, volumeProfile: 70 } },
];

// ─── Feature Set Builder ────────────────────────────────────────────────────

function buildFeatureSet(pick: PickPayload, day: number): any {
  // Add slight daily variation to simulate real traffic (deterministic per day)
  const dayJitter = ((day * 7 + 3) % 5) - 2; // -2 to +2
  return {
    propId: pick.id,
    date: `2026-01-${String(23 + day).padStart(2, '0')}`,
    sport: pick.sport,
    league: pick.sport,
    player: pick.player,
    odds: pick.features.odds || -110,
    market: { type: pick.market, odds: pick.features.odds || -110, line: 22.5 },
    expectedValue: pick.ev + dayJitter,
    lineMovement: pick.features.lineMovement ?? 1,
    matchupRating: Math.max(10, Math.min(100, (pick.features.matchupRating ?? 55) + dayJitter)),
    playerForm: Math.max(10, Math.min(100, (pick.features.playerForm ?? 60) + dayJitter)),
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
    dataQuality: { dataValidationScore: 0.95, outlierScore: 0.95, consistencyScore: 0.95, completeness: 0.85 },
    timestamp: `2026-01-${String(23 + day).padStart(2, '0')}T14:00:00Z`,
    version: 'tranche8-shadow-harness',
    source: 'tranche8',
    confidence: 0.75,
  };
}

// ─── Simulated V1 Scores ────────────────────────────────────────────────────

function simulateV1Score(pick: PickPayload): { score: number; tier: string; ev: number } {
  // Deterministic V1 simulation based on pick features
  const mr = pick.features.matchupRating ?? 55;
  const pf = pick.features.playerForm ?? 60;
  const sm = pick.features.sharpMoney ?? 50;
  const score = Math.round((mr * 0.3 + pf * 0.4 + sm * 0.3) * 100) / 100;

  let tier: string;
  if (score >= 85) tier = 'S';
  else if (score >= 70) tier = 'A';
  else if (score >= 55) tier = 'B';
  else if (score >= 40) tier = 'C';
  else tier = 'D';

  return { score, tier, ev: pick.ev };
}

// ─── Main ───────────────────────────────────────────────────────────────────

function run(): void {
  ensureDir(outDir);

  console.log('=== Tranche 8: Shadow Ops Harness ===');
  console.log(`Picks: ${PICKS.length} per day`);
  console.log('Simulated days: 7');
  console.log(`Total shadow records: ${PICKS.length * 7}`);
  console.log('');

  // Shadow mode promotion policy config
  const promoCfg = parsePromotionPolicyConfig({
    PROMOTION_POLICY_V2: 'true',
    PROMOTION_CANARY_PERCENT: '100',
    PROMOTION_CANARY_SPORTS: '',
    PROMOTION_HARD_MIN_EV: '0.01',
    PROMOTION_HARD_MIN_CONF: '7',
    PROMOTION_SOFT_ENABLE: 'false',
    PROMOTION_KILL_SWITCH: 'false',
  });

  const dailyMetrics: OpsMetrics[] = [];
  const allShadowRecords: ShadowRecord[] = [];

  // Suppress drift log stdout during harness (capture instead)
  const origLog = console.log;
  const driftLogs: any[] = [];
  const promoLogs: any[] = [];

  for (let day = 0; day < 7; day++) {
    const dateStr = `2026-01-${String(23 + day).padStart(2, '0')}`;
    const dayRecords: ShadowRecord[] = [];

    origLog.call(console, `--- Day ${day + 1}: ${dateStr} ---`);

    // Temporarily capture log output
    console.log = (msg: any) => {
      if (typeof msg === 'string') {
        try {
          const parsed = JSON.parse(msg);
          if (parsed.type === 'scoring_drift') driftLogs.push(parsed);
          else if (parsed.type?.startsWith('promotion_decision')) promoLogs.push(parsed);
        } catch {
          origLog.call(console, msg);
        }
      } else {
        origLog.call(console, msg);
      }
    };

    for (const pick of PICKS) {
      const features = buildFeatureSet(pick, day);
      const v1 = simulateV1Score(pick);
      const v2 = computeScoreV2(features, pick.sport);

      // Build drift entry (shadow mode)
      const driftEntry = logDrift({
        pickId: pick.id,
        sport: pick.sport,
        mode: 'shadow' as const,
        v1Score: v1.score,
        v1Tier: v1.tier,
        v1Ev: v1.ev,
        v2Result: v2,
        traceId: `${pick.id}-day${day}`,
      });

      // Evaluate promotion in shadow context
      const promoDecision = evaluatePromotion(v2, pick.sport, pick.id, promoCfg);

      dayRecords.push({
        drift: driftEntry,
        promotion: {
          type: 'promotion_decision_shadow',
          pick_id: pick.id,
          promote: promoDecision.promote,
          band: promoDecision.band,
          reason_codes: promoDecision.reason_codes,
          notes: promoDecision.notes,
        },
      });
    }

    // Restore console.log
    console.log = origLog;

    allShadowRecords.push(...dayRecords);

    // Aggregate daily metrics
    const dayMetrics = aggregateMetrics(
      dayRecords,
      'daily',
      `${dateStr}T00:00:00Z`,
      `${dateStr}T23:59:59Z`
    );
    dailyMetrics.push(dayMetrics);

    console.log(`  Picks: ${dayRecords.length}`);
    console.log(`  Bands: HARD=${dayMetrics.band_distribution.hard} SOFT=${dayMetrics.band_distribution.soft} NONE=${dayMetrics.band_distribution.none}`);
    console.log(`  Promo-eligible: ${dayMetrics.promotion_eligible_rate}%`);
    console.log(`  Promo-impacting: ${dayMetrics.promotion_impacting_rate}%`);
    console.log(`  Avg score delta: ${dayMetrics.avg_score_delta}`);
    console.log(`  Recommendation: ${dayMetrics.recommendation}`);
    console.log('');
  }

  // Write raw metrics
  const metricsPath = path.join(outDir, 'SHADOW_OPS_METRICS.json');
  fs.writeFileSync(metricsPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    total_records: allShadowRecords.length,
    days: 7,
    daily_metrics: dailyMetrics,
  }, null, 2));
  console.log(`Wrote: ${metricsPath}`);

  // Generate daily summary (latest day)
  const latestDay = dailyMetrics[dailyMetrics.length - 1];
  const latestDate = `2026-01-${String(23 + 6).padStart(2, '0')}`;
  const dailySummary = generateDailySummary(latestDay, latestDate);
  const dailyPath = path.join(outDir, 'DAILY_PROMOTION_SUMMARY.md');
  fs.writeFileSync(dailyPath, dailySummary);
  console.log(`Wrote: ${dailyPath}`);

  // Generate weekly summary
  const weeklySummary = generateWeeklySummary(dailyMetrics, 'Week of 2026-01-23');
  const weeklyPath = path.join(outDir, 'WEEKLY_PROMOTION_SUMMARY.md');
  fs.writeFileSync(weeklyPath, weeklySummary);
  console.log(`Wrote: ${weeklyPath}`);

  // Final summary
  console.log('');
  console.log('=== Shadow Ops Harness Summary ===');
  console.log(`Total shadow records: ${allShadowRecords.length}`);
  console.log('');

  // Aggregate all 7 days
  const weekTotal = aggregateMetrics(allShadowRecords, 'weekly', '2026-01-23T00:00:00Z', '2026-01-29T23:59:59Z');
  console.log('Weekly aggregate:');
  console.log(`  HARD: ${weekTotal.band_distribution.hard} (${weekTotal.band_distribution.hard_pct}%)`);
  console.log(`  SOFT: ${weekTotal.band_distribution.soft} (${weekTotal.band_distribution.soft_pct}%)`);
  console.log(`  NONE: ${weekTotal.band_distribution.none} (${weekTotal.band_distribution.none_pct}%)`);
  console.log(`  Promotion-eligible: ${weekTotal.promotion_eligible_rate}%`);
  console.log(`  Promotion-impacting: ${weekTotal.promotion_impacting_rate}%`);
  console.log(`  Avg score delta: ${weekTotal.avg_score_delta}`);
  console.log(`  Tier change rate: ${weekTotal.tier_change_rate}%`);
  console.log(`  Anomalies: ${weekTotal.anomalies.length}`);
  console.log(`  Recommendation: ${weekTotal.recommendation}`);
  console.log('');
  console.log('=== Harness complete ===');
}

run();
