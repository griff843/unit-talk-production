/**
 * scoring-certification-harness.ts — SPRINT-072-SCORING-CERTIFICATION
 *
 * Layer 1 runtime certification script for the scoring pipeline.
 * Calls computeScoreV2 and evaluatePromotion with realistic inputs
 * and prints a structured certification report.
 *
 * Run with: npx tsx apps/api/src/scripts/scoring-certification-harness.ts
 *
 * Does NOT require Supabase or any external service. Pure function calls.
 */

/* eslint-disable no-console */

import type { GradingFeatureSet } from '../types/GradingFeatureSet';
import { computeScoreV2 } from '../agents/GradingAgent/scoring/computeScoreV2';
import type { ComputeScoreV2Result } from '../agents/GradingAgent/scoring/computeScoreV2';
import { canonicalTier } from '../agents/GradingAgent/scoring/TierScale';
import {
  evaluatePromotion,
  validateProbabilityPrimitives,
  type ProbabilityPrimitives,
  type PromotionPolicyConfig,
} from '../agents/GradingAgent/scoring/promotionPolicy';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const NBA_FEATURES: GradingFeatureSet = {
  propId: 'CERT-NBA-001',
  unifiedPickId: 'cert-pick-uuid-001',
  gameId: 'cert-game-001',
  date: new Date().toISOString().split('T')[0],
  sport: 'NBA',
  league: 'NBA',
  player: 'Certification Player',
  marketType: 'player_points',
  odds: -110,
  market: { type: 'player_points', odds: -110, line: 24.5 },
  expectedValue: 8.0,
  lineMovement: 0.8,
  matchupRating: 75,
  playerForm: 80,
  injuryImpact: 0.1,
  weatherImpact: 0,
  marketIntelligence: 78,
  sharpMoney: 78,
  volumeProfile: 72,
  closingLineValue: 6.0,
  playerFatigue: 25,
  venueAdvantage: 65,
  refereeImpact: 50,
  paceImpact: 60,
  motivationalFactors: 70,
  correlationRisk: 0.1,
  volatility: 3.0,
  portfolioImpact: 0.15,
  dataQuality: {
    dataValidationScore: 90,
    outlierScore: 5,
    consistencyScore: 88,
    completeness: 0.95,
  },
  timestamp: new Date().toISOString(),
  version: '3.0.0',
  source: 'scoring-certification-harness',
  confidence: 0.85,
};

const VALID_PROBABILITY: ProbabilityPrimitives = {
  pFinal: 0.65,
  uncertaintyFinal: 0.18,
  pMarketDevig: 0.5,
  edgeFinal: 0.15,
  clvForecast: 0.05,
};

const FULL_ENABLE_CONFIG: PromotionPolicyConfig = {
  killSwitch: false,
  policyEnabled: true,
  softEnable: true,
  hardOnly: false,
  hardMinEv: 0.01,
  hardMinConf: 7.0,
  canaryPercent: 100,
  canarySports: [],
  featureSnapshotGateEnabled: true,
};

// ─── Runner ──────────────────────────────────────────────────────────────────

interface CertResult {
  section: string;
  status: 'PASS' | 'FAIL';
  details: string;
}

const results: CertResult[] = [];

function pass(section: string, details: string): void {
  results.push({ section, status: 'PASS', details });
  console.log(`  ✅ ${section}: ${details}`);
}

function fail(section: string, details: string): void {
  results.push({ section, status: 'FAIL', details });
  console.error(`  ❌ ${section}: ${details}`);
}

function check(section: string, condition: boolean, okDetail: string, failDetail: string): void {
  if (condition) {
    pass(section, okDetail);
  } else {
    fail(section, failDetail);
  }
}

console.log('\n══════════════════════════════════════════════════════');
console.log('  SPRINT-072 SCORING CERTIFICATION HARNESS');
console.log('══════════════════════════════════════════════════════\n');

// ─── Section 1: computeScoreV2 ────────────────────────────────────────────

console.log('─ Section 1: computeScoreV2 ─');
let scoreResult: ComputeScoreV2Result;

try {
  scoreResult = computeScoreV2(NBA_FEATURES);
  pass('computeScoreV2', `executed without throw`);

  check(
    'score range',
    scoreResult.score >= 0 && scoreResult.score <= 100,
    `score=${scoreResult.score} (0-100 ✓)`,
    `score=${scoreResult.score} is OUT OF RANGE`
  );

  check(
    'tier valid',
    ['S', 'A', 'B', 'C', 'D'].includes(scoreResult.tier),
    `tier=${scoreResult.tier}`,
    `tier=${scoreResult.tier} is not a valid Tier`
  );

  check(
    'ev defined',
    typeof scoreResult.ev === 'number',
    `ev=${scoreResult.ev}`,
    'ev is not a number'
  );

  check(
    'breakdown populated',
    Object.keys(scoreResult.breakdown).length > 0,
    `breakdown has ${Object.keys(scoreResult.breakdown).length} features`,
    'breakdown is empty'
  );

  check(
    'feature_audit populated',
    Object.keys(scoreResult.feature_audit).length > 0,
    `feature_audit has ${Object.keys(scoreResult.feature_audit).length} entries`,
    'feature_audit is empty'
  );

  check(
    'featureSnapshotId absent',
    scoreResult.featureSnapshotId === undefined,
    'featureSnapshotId undefined (expected — not set by computeScoreV2)',
    'featureSnapshotId unexpectedly set'
  );

  check(
    'deterministic',
    (() => {
      const r2 = computeScoreV2(NBA_FEATURES);
      return r2.score === scoreResult.score && r2.tier === scoreResult.tier;
    })(),
    'same inputs produce same output',
    'non-deterministic!'
  );
} catch (err) {
  fail('computeScoreV2', `THREW: ${err}`);
  scoreResult = { score: 0, tier: 'D', ev: 0, breakdown: {}, feature_audit: {} };
}

// ─── Section 2: canonicalTier ─────────────────────────────────────────────

console.log('\n─ Section 2: canonicalTier ─');

const tierCases = [
  { score: 85, edge: 25, risk: 2.0, expected: 'S' },
  { score: 65, edge: 5, risk: 3.5, expected: 'A' },
  { score: 45, edge: -5, risk: 4.0, expected: 'B' },
  { score: 35, edge: -10, risk: 5.0, expected: 'C' },
  { score: 20, edge: -20, risk: 9.0, expected: 'D' },
];

for (const tc of tierCases) {
  const actual = canonicalTier({ score: tc.score, edge: tc.edge, risk: tc.risk });
  check(
    `canonicalTier(${tc.score},${tc.edge},${tc.risk})`,
    actual === tc.expected,
    `= ${actual} ✓`,
    `expected ${tc.expected}, got ${actual}`
  );
}

// ─── Section 3: validateProbabilityPrimitives ─────────────────────────────

console.log('\n─ Section 3: validateProbabilityPrimitives ─');

const probValid = validateProbabilityPrimitives(VALID_PROBABILITY, 'HARD');
check(
  'valid HARD primitives',
  probValid.valid,
  `valid=true, errors=[]`,
  `valid=false, errors=${probValid.errors.join(',')}`
);

const probNoUncert = validateProbabilityPrimitives(
  { ...VALID_PROBABILITY, uncertaintyFinal: 0.3 },
  'HARD'
);
check(
  'Gate 8b: uncertainty > HARD_MAX blocked',
  !probNoUncert.valid &&
    probNoUncert.errors.some(e => e.includes('uncertainty_exceeds_hard_threshold')),
  'correctly blocked high uncertainty',
  `unexpected result: ${JSON.stringify(probNoUncert)}`
);

const probNoPFinal = validateProbabilityPrimitives({ ...VALID_PROBABILITY, pFinal: null }, 'HARD');
check(
  'Gate 8a: null pFinal blocked',
  !probNoPFinal.valid,
  'correctly blocked null pFinal',
  `unexpected result: ${JSON.stringify(probNoPFinal)}`
);

// ─── Section 4: evaluatePromotion — CONSTITUTIONAL gates ─────────────────

console.log('\n─ Section 4: evaluatePromotion CONSTITUTIONAL gates ─');

const GOOD_RESULT: ComputeScoreV2Result = {
  score: 85,
  tier: 'S',
  ev: 8.0,
  breakdown: {},
  feature_audit: {},
  featureSnapshotId: 'cert-snapshot-uuid-12345678',
  featureVectorHash: 'cert-vector-hash-12345678',
};

// Gate 7a: missing featureSnapshotId
const g7a = evaluatePromotion(
  { ...GOOD_RESULT, featureSnapshotId: undefined },
  'NBA',
  'p1',
  FULL_ENABLE_CONFIG,
  VALID_PROBABILITY
);
check(
  'Gate 7a: missing featureSnapshotId blocks',
  !g7a.promote && g7a.reason_codes.includes('feature_snapshot_missing'),
  'promote=false, reason=feature_snapshot_missing',
  `unexpected: promote=${g7a.promote}, codes=${g7a.reason_codes}`
);

// Gate 7b: missing featureVectorHash
const g7b = evaluatePromotion(
  { ...GOOD_RESULT, featureVectorHash: undefined },
  'NBA',
  'p2',
  FULL_ENABLE_CONFIG,
  VALID_PROBABILITY
);
check(
  'Gate 7b: missing featureVectorHash blocks',
  !g7b.promote && g7b.reason_codes.includes('feature_hash_missing'),
  'promote=false, reason=feature_hash_missing',
  `unexpected: promote=${g7b.promote}, codes=${g7b.reason_codes}`
);

// Gate 8: missing probability
const g8 = evaluatePromotion(GOOD_RESULT, 'NBA', 'p3', FULL_ENABLE_CONFIG, undefined);
check(
  'Gate 8: missing probability blocks',
  !g8.promote && g8.reason_codes.includes('probability_primitives_missing'),
  'promote=false, reason=probability_primitives_missing',
  `unexpected: promote=${g8.promote}, codes=${g8.reason_codes}`
);

// Gate 1: kill switch
const g1 = evaluatePromotion(
  GOOD_RESULT,
  'NBA',
  'p4',
  { ...FULL_ENABLE_CONFIG, killSwitch: true },
  VALID_PROBABILITY
);
check(
  'Gate 1: kill switch blocks',
  !g1.promote && g1.reason_codes.includes('kill_switch'),
  'promote=false, reason=kill_switch',
  `unexpected: promote=${g1.promote}, codes=${g1.reason_codes}`
);

// Happy path: HARD promotion
const happy = evaluatePromotion(GOOD_RESULT, 'NBA', 'p5', FULL_ENABLE_CONFIG, VALID_PROBABILITY);
check(
  'Happy path: HARD promotion',
  happy.promote && happy.band === 'HARD',
  `promote=true, band=HARD`,
  `promote=${happy.promote}, band=${happy.band}, codes=${happy.reason_codes}`
);

// ─── Section 5: End-to-end integration ───────────────────────────────────

console.log('\n─ Section 5: computeScoreV2 → evaluatePromotion integration ─');

const augmented: ComputeScoreV2Result = {
  ...scoreResult,
  featureSnapshotId: 'injected-snapshot-uuid-12345678',
  featureVectorHash: 'injected-vector-hash-12345678',
};

const e2eResult = evaluatePromotion(
  augmented,
  'NBA',
  'pick-e2e-001',
  FULL_ENABLE_CONFIG,
  VALID_PROBABILITY
);
check(
  'E2E: augmented result returns valid band',
  ['HARD', 'SOFT', 'NONE'].includes(e2eResult.band),
  `band=${e2eResult.band}, promote=${e2eResult.promote}`,
  `invalid band: ${e2eResult.band}`
);

const rawResult = evaluatePromotion(
  scoreResult,
  'NBA',
  'pick-e2e-002',
  FULL_ENABLE_CONFIG,
  VALID_PROBABILITY
);
check(
  'E2E: raw computeScoreV2 output blocked by Gate 7',
  !rawResult.promote,
  `raw output correctly blocked (promote=false)`,
  `raw output unexpectedly promoted!`
);

// ─── Summary ─────────────────────────────────────────────────────────────

const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;
const total = results.length;

console.log('\n══════════════════════════════════════════════════════');
console.log(`  CERTIFICATION SUMMARY`);
console.log(
  `  Score: ${scoreResult.score?.toFixed(1)} | Tier: ${scoreResult.tier} | EV: ${scoreResult.ev}`
);
console.log(`  Tests: ${passed}/${total} passed${failed > 0 ? ` (${failed} FAILED)` : ''}`);
console.log(failed === 0 ? '  ✅ SCORING PIPELINE CERTIFIED' : '  ❌ CERTIFICATION FAILED');
console.log('══════════════════════════════════════════════════════\n');

process.exit(failed > 0 ? 1 : 0);
/* eslint-enable no-console */
