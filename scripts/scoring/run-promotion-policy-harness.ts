/* eslint-disable */
/**
 * run-promotion-policy-harness.ts — Tranche 7 Promotion Policy Harness
 *
 * Exercises the promotion policy against V2 scoring results for 48 picks.
 * Tests 3 configurations:
 *   (a) default — policy OFF → all picks get band=NONE, promote=false (policy_disabled)
 *   (b) policy-on — PROMOTION_POLICY_V2=true, canary 100% all sports → full evaluation
 *   (c) policy-on-soft — same + PROMOTION_SOFT_ENABLE=true → SOFT band auto-promotes
 *
 * Output:
 *   PROMOTION_DECISIONS.json — per-pick decisions for all configs
 *   PROMOTION_SUMMARY.md — aggregate stats
 *
 * Usage:
 *   npx tsx scripts/scoring/run-promotion-policy-harness.ts
 *
 * Created: 2026-01-29 (Tranche 7 — Promotion Governance)
 */

import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '../../');
const apiSrc = path.join(repoRoot, 'apps/api/src');

// Import modules
const { computeScoreV2 } = require(path.join(apiSrc, 'agents/GradingAgent/scoring/computeScoreV2'));
const {
  evaluatePromotion,
  parsePromotionPolicyConfig,
  classifyBand,
  scoreToConfidence,
  evToDecimal,
  findCriticalDataGaps,
} = require(path.join(apiSrc, 'agents/GradingAgent/scoring/promotionPolicy'));

// ─── Output Directory ────────────────────────────────────────────────────────

const outDir = path.join(repoRoot, 'out/scoring-rebuild/2026-01-29/tranche-7');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ─── 48 Deterministic Pick Payloads (reuse from Tranche 6) ──────────────────

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
  { id: 'NBA-001', sport: 'NBA', player: 'Luka Doncic', market: 'points', description: 'Elite scorer, strong matchup', ev: 18, features: { matchupRating: 88, playerForm: 90, sharpMoney: 80, closingLineValue: 6, lineMovement: 3 } },
  { id: 'NBA-002', sport: 'NBA', player: 'Jayson Tatum', market: 'rebounds', description: 'Above avg rebounder', ev: 8, features: { matchupRating: 65, playerForm: 72, sharpMoney: 60, odds: -115 } },
  { id: 'NBA-003', sport: 'NBA', player: 'Tyrese Haliburton', market: 'assists', description: 'Pass-first guard', ev: 12, features: { matchupRating: 75, playerForm: 78, sharpMoney: 70, volumeProfile: 70, closingLineValue: 4 } },
  { id: 'NBA-004', sport: 'NBA', player: 'Bench Player', market: 'points', description: 'Low-minute, neg EV', ev: -12, features: { matchupRating: 35, playerForm: 40, sharpMoney: 30, volumeProfile: 25, closingLineValue: -3 } },
  { id: 'NBA-005', sport: 'NBA', player: 'Anthony Davis', market: 'blocks', description: 'Elite defender', ev: 15, features: { matchupRating: 80, playerForm: 85, injuryImpact: 6, sharpMoney: 75, correlationRisk: 0.25 } },
  { id: 'NBA-006', sport: 'NBA', player: 'Shai Gilgeous-Alexander', market: 'points', description: 'MVP candidate', ev: 20, features: { matchupRating: 92, playerForm: 95, sharpMoney: 85, odds: -200, closingLineValue: 7 } },
  { id: 'NBA-007', sport: 'NBA', player: "De'Aaron Fox", market: 'steals', description: 'Quick guard, high variance', ev: 4, features: { matchupRating: 58, playerForm: 62, volatility: 7, correlationRisk: 0.3 } },
  { id: 'NBA-008', sport: 'NBA', player: 'Nikola Jokic', market: 'assists', description: 'Triple-double threat', ev: 14, features: { matchupRating: 82, playerForm: 88, sharpMoney: 78, closingLineValue: 5, paceImpact: 16 } },
  { id: 'NBA-009', sport: 'NBA', player: 'Random Role Player', market: 'threes', description: 'Minimal data', ev: -5, features: { matchupRating: 45 } },
  { id: 'NBA-010', sport: 'NBA', player: 'Giannis Antetokounmpo', market: 'PRA', description: 'Dominant combo stat', ev: 10, features: { matchupRating: 78, playerForm: 82, odds: 150, sharpMoney: 68, lineMovement: 2 } },
  { id: 'NBA-011', sport: 'NBA', player: 'Donovan Mitchell', market: 'points', description: 'Scoring guard, moderate', ev: 6, features: { matchupRating: 62, playerForm: 70, sharpMoney: 55 } },
  { id: 'NBA-012', sport: 'NBA', player: 'LaMelo Ball', market: 'assists', description: 'Young playmaker', ev: 9, features: { matchupRating: 70, playerForm: 74, volumeProfile: 65 } },
  // MLB (12)
  { id: 'MLB-001', sport: 'MLB', player: 'Shohei Ohtani', market: 'strikeouts', description: 'Elite pitcher', ev: 16, features: { matchupRating: 90, playerForm: 92, weatherImpact: 8, sharpMoney: 82, closingLineValue: 5 } },
  { id: 'MLB-002', sport: 'MLB', player: 'Aaron Judge', market: 'total_bases', description: 'Power hitter', ev: 10, features: { matchupRating: 75, playerForm: 80, weatherImpact: 5, venueAdvantage: 18, sharpMoney: 70 } },
  { id: 'MLB-003', sport: 'MLB', player: 'Mookie Betts', market: 'hits', description: 'Contact hitter', ev: 5, features: { matchupRating: 68, playerForm: 72, sharpMoney: 62 } },
  { id: 'MLB-004', sport: 'MLB', player: 'Backup Catcher', market: 'hits', description: 'Backup, neg EV', ev: -15, features: { matchupRating: 30, playerForm: 35, sharpMoney: 25 } },
  { id: 'MLB-005', sport: 'MLB', player: 'Gerrit Cole', market: 'strikeouts', description: 'Ace pitcher', ev: 14, features: { matchupRating: 85, playerForm: 88, sharpMoney: 80, closingLineValue: 4 } },
  { id: 'MLB-006', sport: 'MLB', player: 'Ronald Acuna Jr', market: 'total_bases', description: 'MVP outfielder', ev: 11, features: { matchupRating: 78, playerForm: 82, sharpMoney: 72, venueAdvantage: 14 } },
  { id: 'MLB-007', sport: 'MLB', player: 'Julio Rodriguez', market: 'hits', description: 'Young star', ev: 7, features: { matchupRating: 65, playerForm: 68, sharpMoney: 55 } },
  { id: 'MLB-008', sport: 'MLB', player: 'Spencer Strider', market: 'strikeouts', description: 'Flamethrower', ev: 13, features: { matchupRating: 82, playerForm: 85, sharpMoney: 75 } },
  { id: 'MLB-009', sport: 'MLB', player: 'Utility Infielder', market: 'hits', description: 'Platoon player', ev: -8, features: { matchupRating: 42, playerForm: 45, sharpMoney: 35 } },
  { id: 'MLB-010', sport: 'MLB', player: 'Freddie Freeman', market: 'hits', description: 'Consistent', ev: 8, features: { matchupRating: 72, playerForm: 76, sharpMoney: 65 } },
  { id: 'MLB-011', sport: 'MLB', player: 'Corbin Burnes', market: 'strikeouts', description: 'Control pitcher', ev: 12, features: { matchupRating: 80, playerForm: 83, sharpMoney: 74, closingLineValue: 3 } },
  { id: 'MLB-012', sport: 'MLB', player: 'Juan Soto', market: 'total_bases', description: 'Discipline hitter', ev: 9, features: { matchupRating: 74, playerForm: 78, sharpMoney: 68 } },
  // NFL (12)
  { id: 'NFL-001', sport: 'NFL', player: 'Patrick Mahomes', market: 'passing_yards', description: 'Elite QB', ev: 15, features: { matchupRating: 88, playerForm: 90, sharpMoney: 82, closingLineValue: 5 } },
  { id: 'NFL-002', sport: 'NFL', player: 'Travis Kelce', market: 'receptions', description: 'Top TE', ev: 10, features: { matchupRating: 75, playerForm: 80, sharpMoney: 70 } },
  { id: 'NFL-003', sport: 'NFL', player: 'Lamar Jackson', market: 'rushing_yards', description: 'Dual-threat', ev: 12, features: { matchupRating: 78, playerForm: 82, sharpMoney: 74 } },
  { id: 'NFL-004', sport: 'NFL', player: 'Practice Squad WR', market: 'receptions', description: 'Fringe roster', ev: -20, features: { matchupRating: 22, playerForm: 25, sharpMoney: 18 } },
  { id: 'NFL-005', sport: 'NFL', player: 'Josh Allen', market: 'passing_TDs', description: 'Top-5 QB', ev: 14, features: { matchupRating: 82, playerForm: 86, sharpMoney: 78, closingLineValue: 4 } },
  { id: 'NFL-006', sport: 'NFL', player: 'CeeDee Lamb', market: 'receiving_yards', description: 'WR1', ev: 11, features: { matchupRating: 76, playerForm: 80, sharpMoney: 70 } },
  { id: 'NFL-007', sport: 'NFL', player: 'Special Teams Player', market: 'tackles', description: 'Low volume', ev: -10, features: { matchupRating: 35, playerForm: 40, sharpMoney: 28 } },
  { id: 'NFL-008', sport: 'NFL', player: 'Tyreek Hill', market: 'receiving_yards', description: 'Speed threat', ev: 13, features: { matchupRating: 80, playerForm: 84, sharpMoney: 76 } },
  { id: 'NFL-009', sport: 'NFL', player: 'Backup QB', market: 'passing_yards', description: 'Emergency backup', ev: -25, features: { matchupRating: 20, playerForm: 22, sharpMoney: 15 } },
  { id: 'NFL-010', sport: 'NFL', player: 'Christian McCaffrey', market: 'rushing_yards', description: 'RB1', ev: 11, features: { matchupRating: 78, playerForm: 80, sharpMoney: 72 } },
  { id: 'NFL-011', sport: 'NFL', player: 'Davante Adams', market: 'receptions', description: 'Route runner', ev: 9, features: { matchupRating: 72, playerForm: 76, sharpMoney: 66 } },
  { id: 'NFL-012', sport: 'NFL', player: 'Justin Jefferson', market: 'receiving_yards', description: 'Elite WR', ev: 16, features: { matchupRating: 86, playerForm: 88, sharpMoney: 80, closingLineValue: 6 } },
  // NHL (12)
  { id: 'NHL-001', sport: 'NHL', player: 'Connor McDavid', market: 'points', description: 'Best in NHL', ev: 17, features: { matchupRating: 92, playerForm: 95, sharpMoney: 85, closingLineValue: 6, venueAdvantage: 12 } },
  { id: 'NHL-002', sport: 'NHL', player: 'Nathan MacKinnon', market: 'shots', description: 'Power forward', ev: 11, features: { matchupRating: 80, playerForm: 84, sharpMoney: 72 } },
  { id: 'NHL-003', sport: 'NHL', player: 'Auston Matthews', market: 'goals', description: 'Sniper', ev: 13, features: { matchupRating: 82, playerForm: 86, sharpMoney: 78, closingLineValue: 4 } },
  { id: 'NHL-004', sport: 'NHL', player: 'AHL Call-Up', market: 'shots', description: 'No NHL track record', ev: -16, features: { matchupRating: 28, playerForm: 30, sharpMoney: 22 } },
  { id: 'NHL-005', sport: 'NHL', player: 'Cale Makar', market: 'assists', description: 'Elite D-man', ev: 14, features: { matchupRating: 84, playerForm: 88, sharpMoney: 80, closingLineValue: 5 } },
  { id: 'NHL-006', sport: 'NHL', player: 'Leon Draisaitl', market: 'points', description: 'Power play specialist', ev: 15, features: { matchupRating: 86, playerForm: 90, sharpMoney: 82 } },
  { id: 'NHL-007', sport: 'NHL', player: '4th Line Grinder', market: 'hits', description: 'Physical, low scoring', ev: -8, features: { matchupRating: 38, playerForm: 42, sharpMoney: 30 } },
  { id: 'NHL-008', sport: 'NHL', player: 'David Pastrnak', market: 'shots', description: 'Offensive D', ev: 12, features: { matchupRating: 80, playerForm: 82, sharpMoney: 74 } },
  { id: 'NHL-009', sport: 'NHL', player: 'Andrei Vasilevskiy', market: 'saves', description: 'Elite goalie', ev: 10, features: { matchupRating: 76, playerForm: 80, sharpMoney: 68 } },
  { id: 'NHL-010', sport: 'NHL', player: 'Backup Goalie', market: 'saves', description: 'Zero track record', ev: -18, features: { matchupRating: 25, playerForm: 30, sharpMoney: 20, volumeProfile: 15 } },
  { id: 'NHL-011', sport: 'NHL', player: 'Nikita Kucherov', market: 'assists', description: 'Elite playmaker', ev: 13, features: { matchupRating: 82, playerForm: 84, sharpMoney: 76, closingLineValue: 4 } },
  { id: 'NHL-012', sport: 'NHL', player: 'Igor Shesterkin', market: 'saves', description: 'Vezina contender', ev: 9, features: { matchupRating: 78, playerForm: 82, sharpMoney: 68, volumeProfile: 70 } },
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
    dataQuality: { dataValidationScore: 0.95, outlierScore: 0.95, consistencyScore: 0.95, completeness: 0.85 },
    timestamp: '2026-01-29T14:00:00Z',
    version: 'tranche7-harness',
    source: 'tranche7',
    confidence: 0.75,
  };
}

// ─── Config Definitions ──────────────────────────────────────────────────────

interface ConfigDef {
  name: string;
  env: Record<string, string>;
  description: string;
}

const CONFIGS: ConfigDef[] = [
  {
    name: 'default',
    env: {},
    description: 'Policy OFF — all picks get policy_disabled, promote=false',
  },
  {
    name: 'policy-on',
    env: {
      PROMOTION_POLICY_V2: 'true',
      PROMOTION_CANARY_PERCENT: '100',
      PROMOTION_CANARY_SPORTS: '',
      PROMOTION_HARD_MIN_EV: '0.01',
      PROMOTION_HARD_MIN_CONF: '7',
    },
    description: 'Policy ON, canary 100% all sports, SOFT auto-promote OFF',
  },
  {
    name: 'policy-on-soft',
    env: {
      PROMOTION_POLICY_V2: 'true',
      PROMOTION_SOFT_ENABLE: 'true',
      PROMOTION_CANARY_PERCENT: '100',
      PROMOTION_CANARY_SPORTS: '',
      PROMOTION_HARD_MIN_EV: '0.01',
      PROMOTION_HARD_MIN_CONF: '7',
    },
    description: 'Policy ON + SOFT auto-promote enabled',
  },
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface PickDecision {
  pick_id: string;
  sport: string;
  player: string;
  v2_score: number;
  v2_tier: string;
  v2_ev: number;
  confidence_10: number;
  ev_decimal: number;
  critical_gaps: string[];
  promote: boolean;
  band: string;
  reason_codes: string[];
  notes: string[];
}

interface ConfigResult {
  config: string;
  description: string;
  decisions: PickDecision[];
}

// ─── Main ────────────────────────────────────────────────────────────────────

function run(): void {
  ensureDir(outDir);
  const allResults: ConfigResult[] = [];

  console.log('=== Tranche 7: Promotion Policy Harness ===');
  console.log(`Picks: ${PICKS.length} (${PICKS.length / 4} per sport x 4 sports)`);
  console.log('');

  for (const cfgDef of CONFIGS) {
    console.log(`--- Config: ${cfgDef.name} ---`);
    console.log(`  ${cfgDef.description}`);

    const policyConfig = parsePromotionPolicyConfig(cfgDef.env);
    const decisions: PickDecision[] = [];

    for (const pick of PICKS) {
      const features = buildFeatureSet(pick);
      const v2 = computeScoreV2(features, pick.sport);
      const decision = evaluatePromotion(v2, pick.sport, pick.id, policyConfig);
      const confidence = scoreToConfidence(v2.score);
      const evDec = evToDecimal(v2.ev);
      const gaps = findCriticalDataGaps(v2.feature_audit);

      decisions.push({
        pick_id: pick.id,
        sport: pick.sport,
        player: pick.player,
        v2_score: v2.score,
        v2_tier: v2.tier,
        v2_ev: v2.ev,
        confidence_10: confidence,
        ev_decimal: evDec,
        critical_gaps: gaps,
        promote: decision.promote,
        band: decision.band,
        reason_codes: decision.reason_codes,
        notes: decision.notes,
      });
    }

    // Summary for this config
    const promoted = decisions.filter((d) => d.promote).length;
    const hard = decisions.filter((d) => d.band === 'HARD').length;
    const soft = decisions.filter((d) => d.band === 'SOFT').length;
    const none = decisions.filter((d) => d.band === 'NONE').length;

    console.log(`  Promoted: ${promoted}/${decisions.length}`);
    console.log(`  Bands: HARD=${hard}, SOFT=${soft}, NONE=${none}`);
    console.log('');

    allResults.push({ config: cfgDef.name, description: cfgDef.description, decisions });
  }

  // Write PROMOTION_DECISIONS.json
  const decisionsPath = path.join(outDir, 'PROMOTION_DECISIONS.json');
  fs.writeFileSync(decisionsPath, JSON.stringify(allResults, null, 2));
  console.log(`Wrote: ${decisionsPath}`);

  // Generate PROMOTION_SUMMARY.md
  generateSummary(allResults);

  console.log('\n=== Harness complete ===');
}

function generateSummary(results: ConfigResult[]): void {
  const lines: string[] = [];
  lines.push('# Promotion Policy Summary \u2014 Tranche 7');
  lines.push('');
  lines.push('Generated: 2026-01-29');
  lines.push(`Picks: ${PICKS.length} (12 per sport \u00d7 4 sports: NBA, MLB, NFL, NHL)`);
  lines.push('');

  for (const cr of results) {
    lines.push(`## Config: ${cr.config}`);
    lines.push('');
    lines.push(`> ${cr.description}`);
    lines.push('');

    const promoted = cr.decisions.filter((d) => d.promote);
    const hard = cr.decisions.filter((d) => d.band === 'HARD');
    const soft = cr.decisions.filter((d) => d.band === 'SOFT');
    const none = cr.decisions.filter((d) => d.band === 'NONE');

    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Promoted | ${promoted.length}/${cr.decisions.length} (${((promoted.length / cr.decisions.length) * 100).toFixed(1)}%) |`);
    lines.push(`| HARD band | ${hard.length} (${((hard.length / cr.decisions.length) * 100).toFixed(1)}%) |`);
    lines.push(`| SOFT band | ${soft.length} (${((soft.length / cr.decisions.length) * 100).toFixed(1)}%) |`);
    lines.push(`| NONE band | ${none.length} (${((none.length / cr.decisions.length) * 100).toFixed(1)}%) |`);
    lines.push('');

    // Per-sport breakdown
    const sports = ['NBA', 'MLB', 'NFL', 'NHL'];
    lines.push('### Per-Sport Breakdown');
    lines.push('');
    lines.push('| Sport | Promoted | HARD | SOFT | NONE | Avg Score | Avg EV |');
    lines.push('|-------|----------|------|------|------|-----------|--------|');
    for (const sport of sports) {
      const sd = cr.decisions.filter((d) => d.sport === sport);
      const sp = sd.filter((d) => d.promote).length;
      const sh = sd.filter((d) => d.band === 'HARD').length;
      const ss = sd.filter((d) => d.band === 'SOFT').length;
      const sn = sd.filter((d) => d.band === 'NONE').length;
      const avgScore = sd.reduce((a, d) => a + d.v2_score, 0) / sd.length;
      const avgEv = sd.reduce((a, d) => a + d.v2_ev, 0) / sd.length;
      lines.push(`| ${sport} | ${sp}/${sd.length} | ${sh} | ${ss} | ${sn} | ${avgScore.toFixed(1)} | ${avgEv.toFixed(1)}% |`);
    }
    lines.push('');

    // Show promoted picks
    if (promoted.length > 0) {
      lines.push('### Promoted Picks');
      lines.push('');
      lines.push('| Pick | Sport | Player | Tier | Score | EV | Band | Reason |');
      lines.push('|------|-------|--------|------|-------|-----|------|--------|');
      for (const d of promoted) {
        lines.push(`| ${d.pick_id} | ${d.sport} | ${d.player} | ${d.v2_tier} | ${d.v2_score.toFixed(1)} | ${d.v2_ev.toFixed(1)}% | ${d.band} | ${d.reason_codes.join(', ')} |`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  // Overall analysis
  lines.push('## Analysis');
  lines.push('');

  const policyOn = results.find((r) => r.config === 'policy-on');
  const policyOnSoft = results.find((r) => r.config === 'policy-on-soft');

  if (policyOn && policyOnSoft) {
    const hardOnly = policyOn.decisions.filter((d) => d.promote).length;
    const withSoft = policyOnSoft.decisions.filter((d) => d.promote).length;
    lines.push(`- **HARD-only promotion rate**: ${hardOnly}/${PICKS.length} (${((hardOnly / PICKS.length) * 100).toFixed(1)}%)`);
    lines.push(`- **HARD+SOFT promotion rate**: ${withSoft}/${PICKS.length} (${((withSoft / PICKS.length) * 100).toFixed(1)}%)`);
    lines.push(`- **SOFT adds**: ${withSoft - hardOnly} additional picks`);
    lines.push('');

    // Count picks with critical data gaps
    const gapPicks = policyOn.decisions.filter((d) => d.critical_gaps.length > 0);
    lines.push(`- **Picks with critical data gaps**: ${gapPicks.length}/${PICKS.length}`);
    if (gapPicks.length > 0) {
      lines.push(`  - Affected: ${gapPicks.map((d) => d.pick_id).join(', ')}`);
    }
  }

  lines.push('');

  const summaryPath = path.join(outDir, 'PROMOTION_SUMMARY.md');
  fs.writeFileSync(summaryPath, lines.join('\n'));
  console.log(`Wrote: ${summaryPath}`);
}

run();
