/**
 * verify-promotion-ops.ts — Stage 4 Proof: Ops + Alerts Validation
 *
 * Generates ≥100 simulated promotion events with realistic distribution,
 * runs the shadow-ops-aggregator, validates alerts trigger correctly,
 * and writes:
 *   - PROMOTION_EVENTS.json
 *   - DAILY_PROMOTION_SUMMARY.md
 *   - WEEKLY_PROMOTION_SUMMARY.md
 *   - proof_stage4_alerts.txt
 *
 * Run: npx tsx scripts/scoring/verify-promotion-ops.ts
 */

import {
  evaluatePromotion,
  classifyBand,
  PromotionPolicyConfig,
} from '../../apps/api/src/agents/GradingAgent/scoring/promotionPolicy';
import type { ComputeScoreV2Result } from '../../apps/api/src/agents/GradingAgent/scoring/computeScoreV2';
import { stableHash } from '../../apps/api/src/agents/GradingAgent/scoring/canaryRouter';
import {
  aggregateMetrics,
  generateDailySummary,
  generateWeeklySummary,
  ShadowRecord,
  PromotionDecisionLog,
} from './shadow-ops-aggregator';
import * as fs from 'fs';
import * as path from 'path';

// ─── Tranche 10 Config ─────────────────────────────────────────────────────

const T10_CONFIG: PromotionPolicyConfig = {
  policyEnabled: true,
  killSwitch: false,
  softEnable: false,
  hardOnly: true,
  hardMinEv: 0.01,
  hardMinConf: 7,
  canaryPercent: 5,
  canarySports: ['NBA'],
};

// ─── Data Generation ────────────────────────────────────────────────────────

const SPORTS = ['NBA', 'NFL', 'MLB', 'NHL'];
const TIERS = ['S', 'A', 'B', 'C', 'D'];

function randomPick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function makeFeatureAudit(hasFallback: boolean = false) {
  return {
    expectedValue: { present: !hasFallback, fallbackUsed: hasFallback, fallbackPolicy: 'neutral' as const, rawValue: hasFallback ? undefined : randomBetween(-5, 15) },
    matchupRating: { present: true, fallbackUsed: false, fallbackPolicy: 'neutral' as const, rawValue: randomBetween(40, 95) },
    playerForm: { present: true, fallbackUsed: false, fallbackPolicy: 'neutral' as const, rawValue: randomBetween(50, 90) },
    marketIntelligence: { present: true, fallbackUsed: false, fallbackPolicy: 'neutral' as const, rawValue: randomBetween(30, 80) },
    sharpMoney: { present: true, fallbackUsed: false, fallbackPolicy: 'neutral' as const, rawValue: randomBetween(40, 85) },
    closingLineValue: { present: true, fallbackUsed: false, fallbackPolicy: 'neutral' as const, rawValue: randomBetween(1, 8) },
  };
}

function generatePick(index: number): { result: ComputeScoreV2Result; sport: string; pickId: string } {
  const sport = randomPick(SPORTS);
  const pickId = `sim-pick-${index}`;

  // Distribution: ~15% S, ~25% A, ~30% B, ~20% C, ~10% D
  const tierRoll = Math.random();
  let tier: string;
  let scoreRange: [number, number];
  let evRange: [number, number];

  if (tierRoll < 0.15) {
    tier = 'S'; scoreRange = [80, 98]; evRange = [5, 20];
  } else if (tierRoll < 0.40) {
    tier = 'A'; scoreRange = [65, 82]; evRange = [0.2, 10];
  } else if (tierRoll < 0.70) {
    tier = 'B'; scoreRange = [50, 68]; evRange = [-2, 3];
  } else if (tierRoll < 0.90) {
    tier = 'C'; scoreRange = [30, 52]; evRange = [-8, 1];
  } else {
    tier = 'D'; scoreRange = [10, 35]; evRange = [-15, -2];
  }

  const score = Math.round(randomBetween(scoreRange[0], scoreRange[1]));
  const ev = Math.round(randomBetween(evRange[0], evRange[1]) * 100) / 100;
  const hasFallback = Math.random() < 0.05; // 5% have critical data gaps

  const result: ComputeScoreV2Result = {
    score,
    tier: tier as any,
    ev,
    breakdown: {
      expectedValue: { raw: ev, normalized: Math.max(0, Math.min(100, ev * 5 + 50)), weight: 0.15, contribution: 0 },
      matchupRating: { raw: score * 0.9, normalized: score * 0.9, weight: 0.12, contribution: 0 },
      playerForm: { raw: score * 0.85, normalized: score * 0.85, weight: 0.1, contribution: 0 },
    },
    feature_audit: makeFeatureAudit(hasFallback),
  };

  return { result, sport, pickId };
}

function generateShadowRecord(index: number): ShadowRecord & { classifiedBand: string } {
  const { result, sport, pickId } = generatePick(index);
  const decision = evaluatePromotion(result, sport, pickId, T10_CONFIG);
  const { band: classifiedBand } = classifyBand(result, T10_CONFIG);

  // Simulate V1 drift data
  const v1Score = result.score + Math.round(randomBetween(-15, 15));
  const v1Ev = result.ev + randomBetween(-3, 3);
  const v1Tier = TIERS[Math.min(4, Math.max(0, TIERS.indexOf(result.tier as string) + (Math.random() < 0.2 ? 1 : 0)))];
  const scoreDelta = result.score - v1Score;
  const evDelta = Math.round((result.ev - v1Ev) * 100) / 100;
  const tierChanged = v1Tier !== result.tier;
  const promotionImpacting = tierChanged && (result.tier === 'S' || result.tier === 'A');

  const drift = {
    type: 'scoring_drift' as const,
    timestamp: new Date().toISOString(),
    trace_id: `trace-${index}`,
    pick_id: pickId,
    sport,
    mode: 'v2_primary',
    v1: { score: v1Score, tier: v1Tier, ev: Math.round(v1Ev * 100) / 100 },
    v2: {
      score: result.score,
      tier: result.tier as string,
      ev: result.ev,
      weights_source: 'registry_v2',
      top_contributors: [
        { feature: 'expectedValue', contribution: result.ev * 0.5 },
        { feature: 'matchupRating', contribution: result.score * 0.12 },
      ],
    },
    deltas: { score: scoreDelta, tier_changed: tierChanged, ev: evDelta },
    promotion_impacting: promotionImpacting,
  };

  // Use classifiedBand (from classifyBand) for the shadow record band,
  // since evaluatePromotion returns band=NONE for canary-denied picks.
  const promotion: PromotionDecisionLog = {
    type: 'promotion_decision' as const,
    pick_id: pickId,
    promote: decision.promote,
    band: classifiedBand as 'HARD' | 'SOFT' | 'NONE',
    reason_codes: decision.reason_codes,
    notes: decision.notes,
  };

  return { drift, promotion, classifiedBand };
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  console.log('=== Stage 4: Ops + Alerts Validation ===\n');

  const TOTAL_PICKS = 120;
  const records: ShadowRecord[] = [];

  for (let i = 0; i < TOTAL_PICKS; i++) {
    records.push(generateShadowRecord(i));
  }

  console.log(`Generated ${records.length} simulated promotion events\n`);

  // ─── Promotion Events JSON ──────────────────────────────────────────────
  const promotionEvents = records.map((r: any) => ({
    pick_id: r.drift.pick_id,
    sport: r.drift.sport,
    score: r.drift.v2!.score,
    tier: r.drift.v2!.tier,
    ev: r.drift.v2!.ev,
    classified_band: r.classifiedBand,
    decision_band: r.promotion!.band,
    promote: r.promotion!.promote,
    reason_codes: r.promotion!.reason_codes,
  }));

  // Stats (classified_band = actual band from classifyBand, decision_band = band from evaluatePromotion)
  const promoted = promotionEvents.filter((e) => e.promote);
  const hardBand = promotionEvents.filter((e) => e.classified_band === 'HARD');
  const softBand = promotionEvents.filter((e) => e.classified_band === 'SOFT');
  const noneBand = promotionEvents.filter((e) => e.classified_band === 'NONE');
  const nbaPicks = promotionEvents.filter((e) => e.sport === 'NBA');
  const nbaPromoted = promotionEvents.filter((e) => e.sport === 'NBA' && e.promote);

  console.log('Band Distribution:');
  console.log(`  HARD: ${hardBand.length}/${TOTAL_PICKS} (${((hardBand.length / TOTAL_PICKS) * 100).toFixed(1)}%)`);
  console.log(`  SOFT: ${softBand.length}/${TOTAL_PICKS} (${((softBand.length / TOTAL_PICKS) * 100).toFixed(1)}%)`);
  console.log(`  NONE: ${noneBand.length}/${TOTAL_PICKS} (${((noneBand.length / TOTAL_PICKS) * 100).toFixed(1)}%)`);
  console.log(`\nPromoted: ${promoted.length}/${TOTAL_PICKS}`);
  console.log(`NBA Picks: ${nbaPicks.length}, NBA Promoted: ${nbaPromoted.length}`);
  console.log(`Non-NBA promoted: ${promoted.filter((e) => e.sport !== 'NBA').length} (should be 0)\n`);

  // ─── Run Aggregator ─────────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];
  const dailyMetrics = aggregateMetrics(records, 'daily', `${today}T00:00:00Z`, `${today}T23:59:59Z`);
  const dailySummary = generateDailySummary(dailyMetrics, today);
  const weeklySummary = generateWeeklySummary([dailyMetrics], `Week of ${today}`);

  console.log('Aggregator Recommendation:', dailyMetrics.recommendation);
  console.log('Anomalies:', dailyMetrics.anomalies.length > 0
    ? dailyMetrics.anomalies.map((a) => `[${a.severity}] ${a.type}: ${a.message}`).join('\n  ')
    : 'None');
  console.log('');

  // ─── Alert Validation ───────────────────────────────────────────────────
  const alertTests: { name: string; pass: boolean; detail: string }[] = [];

  // Alert 1: No non-NBA promotions
  const nonNbaPromoted = promoted.filter((e) => e.sport !== 'NBA');
  alertTests.push({
    name: 'No non-NBA promotions',
    pass: nonNbaPromoted.length === 0,
    detail: `non-NBA promoted: ${nonNbaPromoted.length}`,
  });

  // Alert 2: No SOFT band promotions
  const softPromoted = promotionEvents.filter((e) => e.classified_band === 'SOFT' && e.promote);
  alertTests.push({
    name: 'No SOFT band promotions (hardOnly enforced)',
    pass: softPromoted.length === 0,
    detail: `SOFT promoted: ${softPromoted.length}`,
  });

  // Alert 3: No NONE band promotions
  const nonePromoted = promotionEvents.filter((e) => e.classified_band === 'NONE' && e.promote);
  alertTests.push({
    name: 'No NONE band promotions',
    pass: nonePromoted.length === 0,
    detail: `NONE promoted: ${nonePromoted.length}`,
  });

  // Alert 4: Only promoted picks are HARD + NBA + canary pass
  const allPromotedHardNba = promoted.every((e) => e.classified_band === 'HARD' && e.sport === 'NBA');
  alertTests.push({
    name: 'All promoted picks are HARD + NBA',
    pass: allPromotedHardNba,
    detail: `all HARD+NBA: ${allPromotedHardNba}`,
  });

  // Alert 5: Canary % — promoted should be small fraction due to 5% bucket
  const promotedPct = (promoted.length / TOTAL_PICKS) * 100;
  alertTests.push({
    name: 'Promoted fraction is small (canary 5% limiting)',
    pass: promotedPct < 20, // With 5% canary + NBA-only, very few should promote
    detail: `promoted=${promoted.length}/${TOTAL_PICKS} (${promotedPct.toFixed(1)}%)`,
  });

  // Alert 6: Aggregator produces recommendation
  alertTests.push({
    name: 'Aggregator produces valid recommendation',
    pass: ['HOLD', 'EXPAND', 'ROLLBACK'].includes(dailyMetrics.recommendation),
    detail: `recommendation=${dailyMetrics.recommendation}`,
  });

  // Alert 7: Classified band distribution is non-trivial
  alertTests.push({
    name: 'Classified band distribution covers HARD + SOFT + NONE',
    pass: hardBand.length > 0 && softBand.length > 0 && noneBand.length > 0,
    detail: `HARD=${hardBand.length}, SOFT=${softBand.length}, NONE=${noneBand.length} (from classifyBand, independent of canary gating)`,
  });

  // Print alert results
  console.log('Alert Validation:');
  let alertPass = 0;
  let alertFail = 0;
  for (const t of alertTests) {
    const status = t.pass ? 'PASS' : 'FAIL';
    if (t.pass) alertPass++;
    else alertFail++;
    console.log(`  [${status}] ${t.name} — ${t.detail}`);
  }
  console.log(`\nAlerts: ${alertPass}/${alertPass + alertFail} passed\n`);

  // ─── Write Output Files ─────────────────────────────────────────────────
  const outDir = path.join(__dirname, '../../out/scoring-rebuild/2026-01-29/tranche-10');
  fs.mkdirSync(outDir, { recursive: true });

  // PROMOTION_EVENTS.json
  fs.writeFileSync(
    path.join(outDir, 'PROMOTION_EVENTS.json'),
    JSON.stringify(promotionEvents, null, 2),
    'utf8'
  );

  // DAILY_PROMOTION_SUMMARY.md
  fs.writeFileSync(
    path.join(outDir, 'DAILY_PROMOTION_SUMMARY.md'),
    dailySummary,
    'utf8'
  );

  // WEEKLY_PROMOTION_SUMMARY.md
  fs.writeFileSync(
    path.join(outDir, 'WEEKLY_PROMOTION_SUMMARY.md'),
    weeklySummary,
    'utf8'
  );

  // proof_stage4_alerts.txt
  const proofLines: string[] = [];
  proofLines.push('Stage 4 — Ops + Alerts Validation');
  proofLines.push('==================================');
  proofLines.push(`Date: ${today}`);
  proofLines.push('');
  proofLines.push(`Total Simulated Picks: ${TOTAL_PICKS}`);
  proofLines.push(`Band Distribution: HARD=${hardBand.length}, SOFT=${softBand.length}, NONE=${noneBand.length}`);
  proofLines.push(`Promoted: ${promoted.length}/${TOTAL_PICKS} (${promotedPct.toFixed(1)}%)`);
  proofLines.push(`NBA Picks: ${nbaPicks.length}, NBA Promoted: ${nbaPromoted.length}`);
  proofLines.push(`Non-NBA Promoted: ${nonNbaPromoted.length}`);
  proofLines.push('');
  proofLines.push('AGGREGATOR OUTPUT:');
  proofLines.push(`  Recommendation: ${dailyMetrics.recommendation}`);
  proofLines.push(`  Anomalies: ${dailyMetrics.anomalies.length}`);
  for (const a of dailyMetrics.anomalies) {
    proofLines.push(`    [${a.severity}] ${a.type}: ${a.message}`);
  }
  proofLines.push('');
  proofLines.push('ALERT VALIDATION:');
  for (const t of alertTests) {
    proofLines.push(`  [${t.pass ? 'PASS' : 'FAIL'}] ${t.name} — ${t.detail}`);
  }
  proofLines.push(`\nSUMMARY: ${alertPass}/${alertPass + alertFail} alerts passed`);
  proofLines.push('');
  proofLines.push('OUTPUT FILES:');
  proofLines.push('  - PROMOTION_EVENTS.json (120 events)');
  proofLines.push('  - DAILY_PROMOTION_SUMMARY.md');
  proofLines.push('  - WEEKLY_PROMOTION_SUMMARY.md');
  proofLines.push('  - proof_stage4_alerts.txt (this file)');

  fs.writeFileSync(
    path.join(outDir, 'proof_stage4_alerts.txt'),
    proofLines.join('\n'),
    'utf8'
  );

  console.log('Output files written to:', outDir);
  console.log('  - PROMOTION_EVENTS.json');
  console.log('  - DAILY_PROMOTION_SUMMARY.md');
  console.log('  - WEEKLY_PROMOTION_SUMMARY.md');
  console.log('  - proof_stage4_alerts.txt');

  if (alertFail > 0) process.exit(1);
}

main();
