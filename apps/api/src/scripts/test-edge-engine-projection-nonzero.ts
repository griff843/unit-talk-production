/* eslint-disable no-console, max-lines-per-function, complexity */
/**
 * Test Edge Engine Projection Non-Zero
 * Sprint: SPRINT-PROJECTIONS-FOUNDATION-099A
 *
 * Proves that projection_delta_score is non-zero when projection exists.
 *
 * Usage: npx tsx src/scripts/test-edge-engine-projection-nonzero.ts
 */

import { computeEdgeScorePre, EdgePreInput } from '../agents/ScoringAgent/scoring/edgeEnginePre';

// ============================================================================
// TEST CASES
// ============================================================================

interface TestCase {
  name: string;
  input: EdgePreInput;
  expectedProjectionDeltaScoreNonZero: boolean;
  expectedFlags: string[];
}

const TEST_CASES: TestCase[] = [
  // Case 1: Projection present, favorable OVER
  {
    name: 'Projection present - favorable OVER (projection > line)',
    input: {
      pick_id: 'test-001',
      sport: 'NBA',
      stat_type: 'points',
      side: 'over',
      entry_line: 25.5,
      entry_odds: -110,
      projection: 28.0, // 9.8% above line - favorable for OVER
      opening_line: 25.0,
      opening_odds: -108,
      player_name: 'LeBron James',
    },
    expectedProjectionDeltaScoreNonZero: true,
    expectedFlags: [],
  },

  // Case 2: Projection present, favorable UNDER
  {
    name: 'Projection present - favorable UNDER (projection < line)',
    input: {
      pick_id: 'test-002',
      sport: 'NBA',
      stat_type: 'rebounds',
      side: 'under',
      entry_line: 8.5,
      entry_odds: -115,
      projection: 7.5, // 11.8% below line - favorable for UNDER
      opening_line: 8.0,
      opening_odds: -110,
      player_name: 'Anthony Davis',
    },
    expectedProjectionDeltaScoreNonZero: true,
    expectedFlags: [],
  },

  // Case 3: Projection absent
  {
    name: 'Projection absent - should be zero with flag',
    input: {
      pick_id: 'test-003',
      sport: 'MLB',
      stat_type: 'strikeouts',
      side: 'over',
      entry_line: 6.5,
      entry_odds: -120,
      projection: null, // No projection
      opening_line: 6.5,
      opening_odds: -115,
      player_name: 'Shohei Ohtani',
    },
    expectedProjectionDeltaScoreNonZero: false,
    expectedFlags: ['no_projection'],
  },

  // Case 4: Projection undefined (also absent)
  {
    name: 'Projection undefined - should be zero with flag',
    input: {
      pick_id: 'test-004',
      sport: 'NFL',
      stat_type: 'passing_yards',
      side: 'over',
      entry_line: 275.5,
      entry_odds: -105,
      // projection not provided (undefined)
      opening_line: 270.0,
      opening_odds: -110,
      player_name: 'Patrick Mahomes',
    },
    expectedProjectionDeltaScoreNonZero: false,
    expectedFlags: ['no_projection'],
  },

  // Case 5: Projection exactly matches line
  {
    name: 'Projection equals line - should be zero (no edge)',
    input: {
      pick_id: 'test-005',
      sport: 'NBA',
      stat_type: 'assists',
      side: 'over',
      entry_line: 10.0,
      entry_odds: -110,
      projection: 10.0, // Exactly matches line - no edge
      opening_line: 9.5,
      opening_odds: -110,
      player_name: 'Nikola Jokic',
    },
    expectedProjectionDeltaScoreNonZero: false, // Zero delta = zero score
    expectedFlags: [],
  },

  // Case 6: Large projection edge
  {
    name: 'Large projection edge (10%+) - should score high',
    input: {
      pick_id: 'test-006',
      sport: 'NBA',
      stat_type: 'threes',
      side: 'over',
      entry_line: 3.5,
      entry_odds: -125,
      projection: 4.2, // 20% above line - very favorable
      opening_line: 3.5,
      opening_odds: -120,
      player_name: 'Steph Curry',
    },
    expectedProjectionDeltaScoreNonZero: true,
    expectedFlags: [],
  },
];

// ============================================================================
// MAIN
// ============================================================================

function main() {
  console.log('='.repeat(70));
  console.log('TEST EDGE ENGINE PROJECTION NON-ZERO');
  console.log('Sprint: SPRINT-PROJECTIONS-FOUNDATION-099A');
  console.log('='.repeat(70));
  console.log();

  let passed = 0;
  let failed = 0;

  for (const testCase of TEST_CASES) {
    console.log(`📋 ${testCase.name}`);
    console.log(
      `   Input: entry_line=${testCase.input.entry_line}, projection=${testCase.input.projection ?? 'null'}, side=${testCase.input.side}`
    );

    try {
      const result = computeEdgeScorePre(testCase.input);

      const projScore = result.pre_components.projection_delta_score;
      const isNonZero = projScore !== 0;

      console.log(`   projection_delta_score: ${projScore}`);
      console.log(`   edge_score_pre: ${result.edge_score_pre}`);
      console.log(`   tier_pre: ${result.tier_pre}`);
      console.log(`   pre_flags: [${result.pre_flags.join(', ')}]`);

      // Check projection_delta_score
      let testPassed = true;

      if (testCase.expectedProjectionDeltaScoreNonZero && !isNonZero) {
        console.log(`   ❌ FAIL: Expected projection_delta_score to be NON-ZERO, got ${projScore}`);
        testPassed = false;
      } else if (!testCase.expectedProjectionDeltaScoreNonZero && isNonZero) {
        console.log(`   ❌ FAIL: Expected projection_delta_score to be ZERO, got ${projScore}`);
        testPassed = false;
      }

      // Check flags
      for (const expectedFlag of testCase.expectedFlags) {
        if (!result.pre_flags.includes(expectedFlag)) {
          console.log(`   ❌ FAIL: Expected flag '${expectedFlag}' not found in pre_flags`);
          testPassed = false;
        }
      }

      if (testPassed) {
        console.log(`   ✅ PASS`);
        passed++;
      } else {
        failed++;
      }
    } catch (err) {
      console.log(`   ❌ ERROR: ${err}`);
      failed++;
    }

    console.log();
  }

  console.log('='.repeat(70));
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(70));

  if (failed > 0) {
    console.log('❌ SOME TESTS FAILED');
    process.exit(1);
  } else {
    console.log('✅ ALL TESTS PASSED');
    console.log();
    console.log('PROOF: projection_delta_score is NON-ZERO when projection exists');
    process.exit(0);
  }
}

main();
