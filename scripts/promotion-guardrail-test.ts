#!/usr/bin/env npx tsx
/**
 * Promotion Guardrail Test — Stage 5 Proof
 *
 * Demonstrates that each guardrail correctly blocks bad promotions
 * and that clean props pass all checks.
 *
 * Pure in-memory test — no DB required.
 *
 * Usage:
 *   npx tsx scripts/promotion-guardrail-test.ts
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  runPreScoreGuardrails,
  runPostScoreGuardrails,
  hasRejection,
  GuardrailResult,
} from '../apps/api/src/agents/EligibilityAgent/PromotionGuardrails';

interface TestCase {
  name: string;
  prop: any;
  scored?: any;
  expectBlocked: boolean;
  expectedGate: string;
}

const TEST_CASES: TestCase[] = [
  // G-01: Invalid odds
  {
    name: 'G-01: odds is null',
    prop: { id: 'g01a', player_name: 'Test', sport: 'NBA', stat_type: 'points', line: 22.5, odds: null },
    expectBlocked: true,
    expectedGate: 'G-01:invalid_odds',
  },
  {
    name: 'G-01: odds is zero',
    prop: { id: 'g01b', player_name: 'Test', sport: 'NBA', stat_type: 'points', line: 22.5, odds: 0 },
    expectBlocked: true,
    expectedGate: 'G-01:invalid_odds',
  },
  {
    name: 'G-01: odds is NaN',
    prop: { id: 'g01c', player_name: 'Test', sport: 'NBA', stat_type: 'points', line: 22.5, odds: NaN },
    expectBlocked: true,
    expectedGate: 'G-01:invalid_odds',
  },
  {
    name: 'G-01: odds exceeds max range',
    prop: { id: 'g01d', player_name: 'Test', sport: 'NBA', stat_type: 'points', line: 22.5, odds: 6000 },
    expectBlocked: true,
    expectedGate: 'G-01:odds_range',
  },

  // G-02: Invalid line
  {
    name: 'G-02: line is non-numeric string',
    prop: { id: 'g02a', player_name: 'Test', sport: 'NBA', stat_type: 'points', line: 'abc', odds: -110 },
    expectBlocked: true,
    expectedGate: 'G-02:invalid_line',
  },

  // G-03: Stale price
  {
    name: 'G-03: price timestamp 3 hours old',
    prop: {
      id: 'g03a',
      player_name: 'Test',
      sport: 'NBA',
      stat_type: 'points',
      line: 22.5,
      odds: -110,
      price_updated_at: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
    },
    expectBlocked: true,
    expectedGate: 'G-03:stale_price',
  },

  // G-04: Missing team for team bet
  {
    name: 'G-04: spread bet without team',
    prop: {
      id: 'g04a',
      player_name: 'Test',
      sport: 'NBA',
      stat_type: 'points',
      line: -3.5,
      odds: -110,
      bet_type: 'spread',
    },
    expectBlocked: true,
    expectedGate: 'G-04:missing_team',
  },

  // G-05: Contradictory volatility
  {
    name: 'G-05: volatile AND stable both true',
    prop: {
      id: 'g05a',
      player_name: 'Test',
      sport: 'NBA',
      stat_type: 'points',
      line: 22.5,
      odds: -110,
      is_volatile: true,
      is_stable: true,
    },
    expectBlocked: true,
    expectedGate: 'G-05:contradictory_volatility',
  },
  {
    name: 'G-05: steam_for AND steam_against both true',
    prop: {
      id: 'g05b',
      player_name: 'Test',
      sport: 'NBA',
      stat_type: 'points',
      line: 22.5,
      odds: -110,
      steam_for: true,
      steam_against: true,
    },
    expectBlocked: true,
    expectedGate: 'G-05:contradictory_steam',
  },

  // G-06: Below minimum edge (post-score)
  {
    name: 'G-06: EV below minimum edge',
    prop: { id: 'g06a', player_name: 'Test', sport: 'NBA', stat_type: 'points', line: 22.5, odds: -110 },
    scored: { ev_percent: -2 },
    expectBlocked: true,
    expectedGate: 'G-06:below_min_edge',
  },

  // CLEAN: should pass all guardrails
  {
    name: 'CLEAN: valid prop passes all guardrails',
    prop: {
      id: 'clean1',
      player_name: 'LeBron James',
      sport: 'NBA',
      stat_type: 'points',
      line: 25.5,
      odds: -115,
    },
    scored: { ev_percent: 5 },
    expectBlocked: false,
    expectedGate: '',
  },
  {
    name: 'CLEAN: valid team bet with team identifier',
    prop: {
      id: 'clean2',
      player_name: 'Team Prop',
      sport: 'NBA',
      stat_type: 'total',
      line: 220.5,
      odds: -110,
      bet_type: 'total',
      team: 'LAL',
    },
    scored: { ev_percent: 3 },
    expectBlocked: false,
    expectedGate: '',
  },
];

function runTests(): { passed: number; failed: number; results: any[] } {
  const results: any[] = [];
  let passed = 0;
  let failed = 0;

  for (const tc of TEST_CASES) {
    const preResults = runPreScoreGuardrails(tc.prop);
    const postResults = tc.scored ? runPostScoreGuardrails(tc.scored) : [];
    const allResults = [...preResults, ...postResults];
    const blocked = hasRejection(allResults);
    const failedRules = allResults.filter(r => !r.passed);

    const matchesExpected = blocked === tc.expectBlocked;
    const gateMatch = tc.expectBlocked
      ? failedRules.some(r => r.gate === tc.expectedGate)
      : true;
    const ok = matchesExpected && gateMatch;

    if (ok) {
      passed++;
    } else {
      failed++;
    }

    results.push({
      name: tc.name,
      status: ok ? 'PASS' : 'FAIL',
      blocked,
      expectedBlocked: tc.expectBlocked,
      failedRules: failedRules.map(r => ({ gate: r.gate, reason: r.reason })),
      expectedGate: tc.expectedGate,
    });
  }

  return { passed, failed, results };
}

function main() {
  console.log('=== Promotion Guardrail Test — Stage 5 ===\n');

  const { passed, failed, results } = runTests();

  // Print results
  for (const r of results) {
    const icon = r.status === 'PASS' ? 'PASS' : 'FAIL';
    console.log(`[${icon}] ${r.name}`);
    if (r.failedRules.length > 0) {
      for (const rule of r.failedRules) {
        console.log(`       Triggered: ${rule.gate} — ${rule.reason}`);
      }
    }
    if (r.status === 'FAIL') {
      console.log(`       Expected blocked=${r.expectedBlocked}, got blocked=${r.blocked}`);
      console.log(`       Expected gate=${r.expectedGate}`);
    }
  }

  console.log(`\n=== Summary: ${passed} passed, ${failed} failed out of ${results.length} ===`);

  // Write artifacts
  const dateStr = new Date().toISOString().split('T')[0];
  const outputDir = path.join(__dirname, '..', 'out', 'promotion-agent-next', dateStr, 'guardrails');
  fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(
    path.join(outputDir, 'test_results.json'),
    JSON.stringify({ passed, failed, total: results.length, results }, null, 2)
  );
  console.log(`\nWritten: ${path.join(outputDir, 'test_results.json')}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
