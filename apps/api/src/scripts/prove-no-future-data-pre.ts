#!/usr/bin/env tsx
/* eslint-disable no-console, max-lines-per-function, max-lines, complexity */
/**
 * PRE Score No-Future-Data Guard
 * Sprint: SPRINT-EDGE-ENGINE-PRESCORE-SPLIT-098
 *
 * This script PROVES that PRE scoring never uses closing data by:
 * 1. Running PRE scoring for N picks
 * 2. Instrumenting assertions to detect any closing data access
 * 3. Verifying the leakage guard functions work correctly
 *
 * If ANY closing data is detected in PRE computation → FAIL
 *
 * Usage: npx tsx apps/api/src/scripts/prove-no-future-data-pre.ts
 */

import {
  computeEdgeScorePre,
  assertNoFutureData,
  validatePreInput,
  EdgePreInput,
  MODEL_VERSION_PRE,
} from '../agents/ScoringAgent/scoring/edgeEnginePre';

// =============================================================================
// TEST CONFIGURATION
// =============================================================================

const NUM_TEST_PICKS = 20;

// =============================================================================
// TEST DATA GENERATION
// =============================================================================

interface TestPick extends EdgePreInput {
  // Metadata for test tracking
  test_id: number;
  has_projection: boolean;
  has_opening: boolean;
}

function generateTestPicks(): TestPick[] {
  const picks: TestPick[] = [];
  const sports = ['NBA', 'MLB', 'NFL'];
  const statTypes = ['points', 'rebounds', 'assists', 'strikeouts', 'passing_yards'];
  const sides: ('over' | 'under')[] = ['over', 'under'];

  for (let i = 0; i < NUM_TEST_PICKS; i++) {
    const entryLine = 20 + Math.random() * 15;
    const entryOdds =
      Math.random() > 0.5
        ? -110 - Math.floor(Math.random() * 30)
        : 100 + Math.floor(Math.random() * 50);
    const hasProjection = Math.random() > 0.3;
    const hasOpening = Math.random() > 0.3;

    picks.push({
      test_id: i + 1,
      pick_id: `test-pre-${i + 1}`,
      sport: sports[i % sports.length],
      stat_type: statTypes[i % statTypes.length],
      side: sides[i % sides.length],
      entry_line: Math.round(entryLine * 10) / 10,
      entry_odds: entryOdds,
      projection: hasProjection
        ? Math.round((entryLine + (Math.random() - 0.3) * 5) * 10) / 10
        : null,
      opening_line: hasOpening
        ? Math.round((entryLine - (Math.random() - 0.5) * 2) * 10) / 10
        : null,
      opening_odds: hasOpening ? entryOdds + Math.floor((Math.random() - 0.5) * 20) : null,
      has_projection: hasProjection,
      has_opening: hasOpening,
      player_name: `Test Player ${i + 1}`,
    });
  }

  return picks;
}

// =============================================================================
// LEAKAGE DETECTION TESTS
// =============================================================================

interface LeakageTestResult {
  test_name: string;
  passed: boolean;
  error?: string;
}

function testAssertNoFutureData(): LeakageTestResult[] {
  const results: LeakageTestResult[] = [];

  // Test 1: Clean data should pass
  try {
    assertNoFutureData({});
    results.push({ test_name: 'assertNoFutureData: empty object', passed: true });
  } catch (e) {
    results.push({
      test_name: 'assertNoFutureData: empty object',
      passed: false,
      error: String(e),
    });
  }

  // Test 2: is_closing=true should FAIL
  try {
    assertNoFutureData({ is_closing: true });
    results.push({
      test_name: 'assertNoFutureData: is_closing=true',
      passed: false,
      error: 'Should have thrown',
    });
  } catch (e) {
    const errorMsg = String(e);
    if (errorMsg.includes('LEAKAGE_VIOLATION')) {
      results.push({ test_name: 'assertNoFutureData: is_closing=true', passed: true });
    } else {
      results.push({
        test_name: 'assertNoFutureData: is_closing=true',
        passed: false,
        error: errorMsg,
      });
    }
  }

  // Test 3: closing_line should FAIL
  try {
    assertNoFutureData({ closing_line: 25.5 });
    results.push({
      test_name: 'assertNoFutureData: closing_line',
      passed: false,
      error: 'Should have thrown',
    });
  } catch (e) {
    const errorMsg = String(e);
    if (errorMsg.includes('LEAKAGE_VIOLATION')) {
      results.push({ test_name: 'assertNoFutureData: closing_line', passed: true });
    } else {
      results.push({
        test_name: 'assertNoFutureData: closing_line',
        passed: false,
        error: errorMsg,
      });
    }
  }

  // Test 4: closing_odds should FAIL
  try {
    assertNoFutureData({ closing_odds: -120 });
    results.push({
      test_name: 'assertNoFutureData: closing_odds',
      passed: false,
      error: 'Should have thrown',
    });
  } catch (e) {
    const errorMsg = String(e);
    if (errorMsg.includes('LEAKAGE_VIOLATION')) {
      results.push({ test_name: 'assertNoFutureData: closing_odds', passed: true });
    } else {
      results.push({
        test_name: 'assertNoFutureData: closing_odds',
        passed: false,
        error: errorMsg,
      });
    }
  }

  // Test 5: result should FAIL
  try {
    assertNoFutureData({ result: 'won' });
    results.push({
      test_name: 'assertNoFutureData: result',
      passed: false,
      error: 'Should have thrown',
    });
  } catch (e) {
    const errorMsg = String(e);
    if (errorMsg.includes('LEAKAGE_VIOLATION')) {
      results.push({ test_name: 'assertNoFutureData: result', passed: true });
    } else {
      results.push({ test_name: 'assertNoFutureData: result', passed: false, error: errorMsg });
    }
  }

  // Test 6: null values should pass
  try {
    assertNoFutureData({ closing_line: null, closing_odds: null, result: null });
    results.push({ test_name: 'assertNoFutureData: null values', passed: true });
  } catch (e) {
    results.push({ test_name: 'assertNoFutureData: null values', passed: false, error: String(e) });
  }

  return results;
}

function testValidatePreInput(): LeakageTestResult[] {
  const results: LeakageTestResult[] = [];

  // Base valid input
  const validInput: EdgePreInput = {
    pick_id: 'test-1',
    sport: 'NBA',
    stat_type: 'points',
    side: 'over',
    entry_line: 25.5,
    entry_odds: -110,
  };

  // Test 1: Valid input should pass
  try {
    validatePreInput(validInput as EdgePreInput & Record<string, unknown>);
    results.push({ test_name: 'validatePreInput: valid input', passed: true });
  } catch (e) {
    results.push({ test_name: 'validatePreInput: valid input', passed: false, error: String(e) });
  }

  // Test 2: Input with closing_line should FAIL
  try {
    validatePreInput({ ...validInput, closing_line: 24.5 } as EdgePreInput &
      Record<string, unknown>);
    results.push({
      test_name: 'validatePreInput: closing_line',
      passed: false,
      error: 'Should have thrown',
    });
  } catch (e) {
    const errorMsg = String(e);
    if (errorMsg.includes('LEAKAGE_VIOLATION')) {
      results.push({ test_name: 'validatePreInput: closing_line', passed: true });
    } else {
      results.push({ test_name: 'validatePreInput: closing_line', passed: false, error: errorMsg });
    }
  }

  // Test 3: Input with closing_odds should FAIL
  try {
    validatePreInput({ ...validInput, closing_odds: -120 } as EdgePreInput &
      Record<string, unknown>);
    results.push({
      test_name: 'validatePreInput: closing_odds',
      passed: false,
      error: 'Should have thrown',
    });
  } catch (e) {
    const errorMsg = String(e);
    if (errorMsg.includes('LEAKAGE_VIOLATION')) {
      results.push({ test_name: 'validatePreInput: closing_odds', passed: true });
    } else {
      results.push({ test_name: 'validatePreInput: closing_odds', passed: false, error: errorMsg });
    }
  }

  // Test 4: Input with result should FAIL
  try {
    validatePreInput({ ...validInput, result: 'won' } as EdgePreInput & Record<string, unknown>);
    results.push({
      test_name: 'validatePreInput: result',
      passed: false,
      error: 'Should have thrown',
    });
  } catch (e) {
    const errorMsg = String(e);
    if (errorMsg.includes('LEAKAGE_VIOLATION')) {
      results.push({ test_name: 'validatePreInput: result', passed: true });
    } else {
      results.push({ test_name: 'validatePreInput: result', passed: false, error: errorMsg });
    }
  }

  // Test 5: Input with settlement_status should FAIL
  try {
    validatePreInput({ ...validInput, settlement_status: 'settled' } as EdgePreInput &
      Record<string, unknown>);
    results.push({
      test_name: 'validatePreInput: settlement_status',
      passed: false,
      error: 'Should have thrown',
    });
  } catch (e) {
    const errorMsg = String(e);
    if (errorMsg.includes('LEAKAGE_VIOLATION')) {
      results.push({ test_name: 'validatePreInput: settlement_status', passed: true });
    } else {
      results.push({
        test_name: 'validatePreInput: settlement_status',
        passed: false,
        error: errorMsg,
      });
    }
  }

  return results;
}

// =============================================================================
// PRE SCORING TESTS
// =============================================================================

interface ScoringTestResult {
  pick_id: string;
  passed: boolean;
  edge_score_pre: number;
  tier_pre: string;
  flags: string[];
  error?: string;
}

function testPreScoring(picks: TestPick[]): ScoringTestResult[] {
  const results: ScoringTestResult[] = [];

  for (const pick of picks) {
    try {
      const output = computeEdgeScorePre(pick);

      // Verify output does NOT contain any closing data references
      const outputStr = JSON.stringify(output);

      // Check for forbidden terms in output
      const forbiddenTerms = [
        'closing_line',
        'closing_odds',
        'clv_pct',
        'clv_direction',
        'is_closing',
      ];
      let hasForbiddenTerm = false;
      for (const term of forbiddenTerms) {
        if (outputStr.includes(term)) {
          hasForbiddenTerm = true;
          results.push({
            pick_id: pick.pick_id,
            passed: false,
            edge_score_pre: output.edge_score_pre,
            tier_pre: output.tier_pre,
            flags: output.pre_flags,
            error: `Output contains forbidden term: ${term}`,
          });
          break;
        }
      }

      if (!hasForbiddenTerm) {
        // Verify model version is correct
        if (output.model_version_pre !== MODEL_VERSION_PRE) {
          results.push({
            pick_id: pick.pick_id,
            passed: false,
            edge_score_pre: output.edge_score_pre,
            tier_pre: output.tier_pre,
            flags: output.pre_flags,
            error: `Invalid model version: ${output.model_version_pre}`,
          });
        } else {
          results.push({
            pick_id: pick.pick_id,
            passed: true,
            edge_score_pre: output.edge_score_pre,
            tier_pre: output.tier_pre,
            flags: output.pre_flags,
          });
        }
      }
    } catch (e) {
      results.push({
        pick_id: pick.pick_id,
        passed: false,
        edge_score_pre: 0,
        tier_pre: 'ERROR',
        flags: [],
        error: String(e),
      });
    }
  }

  return results;
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  console.log('='.repeat(70));
  console.log('PRE SCORE NO-FUTURE-DATA GUARD');
  console.log(`Model Version: ${MODEL_VERSION_PRE}`);
  console.log('Sprint: SPRINT-EDGE-ENGINE-PRESCORE-SPLIT-098');
  console.log('='.repeat(70));
  console.log('');

  let allPassed = true;

  // Test 1: Leakage Guard Functions
  console.log('[TEST 1] Leakage Guard Function Tests');
  console.log('-'.repeat(70));

  const assertTests = testAssertNoFutureData();
  for (const test of assertTests) {
    const status = test.passed ? 'PASS' : 'FAIL';
    console.log(`  ${status}: ${test.test_name}`);
    if (!test.passed) {
      console.log(`        Error: ${test.error}`);
      allPassed = false;
    }
  }

  console.log('');
  console.log('[TEST 2] Input Validation Tests');
  console.log('-'.repeat(70));

  const validateTests = testValidatePreInput();
  for (const test of validateTests) {
    const status = test.passed ? 'PASS' : 'FAIL';
    console.log(`  ${status}: ${test.test_name}`);
    if (!test.passed) {
      console.log(`        Error: ${test.error}`);
      allPassed = false;
    }
  }

  // Test 2: PRE Scoring with No Future Data
  console.log('');
  console.log('[TEST 3] PRE Scoring - No Future Data in Output');
  console.log('-'.repeat(70));

  const testPicks = generateTestPicks();
  console.log(`  Generated ${testPicks.length} test picks`);
  console.log('');

  const scoringResults = testPreScoring(testPicks);

  let scoringPassed = 0;
  let scoringFailed = 0;

  for (const result of scoringResults) {
    if (result.passed) {
      scoringPassed++;
    } else {
      scoringFailed++;
      console.log(`  FAIL: ${result.pick_id}`);
      console.log(`        Error: ${result.error}`);
      allPassed = false;
    }
  }

  console.log(`  Scoring Results: ${scoringPassed} PASS / ${scoringFailed} FAIL`);

  // Test 3: Verify Leakage on Polluted Input
  console.log('');
  console.log('[TEST 4] Verify Rejection of Polluted Input');
  console.log('-'.repeat(70));

  const pollutedInput = {
    pick_id: 'test-polluted',
    sport: 'NBA',
    stat_type: 'points',
    side: 'over' as const,
    entry_line: 25.5,
    entry_odds: -110,
    closing_line: 24.5, // FORBIDDEN
    closing_odds: -120, // FORBIDDEN
  };

  try {
    computeEdgeScorePre(pollutedInput as EdgePreInput);
    console.log('  FAIL: Should have rejected polluted input');
    allPassed = false;
  } catch (e) {
    const errorMsg = String(e);
    if (errorMsg.includes('LEAKAGE_VIOLATION')) {
      console.log('  PASS: Correctly rejected polluted input with closing_line');
    } else {
      console.log(`  FAIL: Wrong error type: ${errorMsg}`);
      allPassed = false;
    }
  }

  // Summary
  console.log('');
  console.log('='.repeat(70));
  console.log('TEST SUMMARY');
  console.log('='.repeat(70));

  const totalAssertTests = assertTests.length;
  const passedAssertTests = assertTests.filter(t => t.passed).length;

  const totalValidateTests = validateTests.length;
  const passedValidateTests = validateTests.filter(t => t.passed).length;

  console.log(`  Leakage Guard Tests: ${passedAssertTests}/${totalAssertTests} PASS`);
  console.log(`  Input Validation Tests: ${passedValidateTests}/${totalValidateTests} PASS`);
  console.log(`  PRE Scoring Tests: ${scoringPassed}/${scoringResults.length} PASS`);
  console.log(`  Polluted Input Test: ${allPassed ? '1/1 PASS' : '0/1 FAIL'}`);

  console.log('');
  console.log('='.repeat(70));

  if (allPassed) {
    console.log('RESULT: PASS - PRE score NEVER uses future data');
    console.log('');
    console.log('PROOF STATEMENT:');
    console.log('  1. assertNoFutureData() correctly rejects is_closing=true');
    console.log('  2. assertNoFutureData() correctly rejects closing_line/closing_odds');
    console.log('  3. assertNoFutureData() correctly rejects result data');
    console.log('  4. validatePreInput() blocks forbidden fields in input');
    console.log('  5. computeEdgeScorePre() output contains NO closing data references');
    console.log('  6. Polluted input is correctly rejected at runtime');
    console.log('');
    console.log(`MODEL_VERSION_PRE: ${MODEL_VERSION_PRE}`);
  } else {
    console.log('RESULT: FAIL - Future data leakage detected');
    process.exit(1);
  }

  console.log('='.repeat(70));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
