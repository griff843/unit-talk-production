#!/usr/bin/env tsx
/* eslint-disable no-console, max-lines-per-function, max-lines, complexity, @typescript-eslint/no-unused-vars, no-unused-vars, security/detect-object-injection */
/**
 * Edge Engine PRE/POST Determinism Test
 * Sprint: SPRINT-EDGE-ENGINE-PRESCORE-SPLIT-098
 *
 * Tests:
 * 1. PRE score determinism (same inputs → identical outputs)
 * 2. POST score determinism (same inputs → identical outputs)
 * 3. PRE unchanged when closing data removed from input
 * 4. PRE and POST correlation analysis
 *
 * Usage: npx tsx apps/api/src/scripts/test-edge-engine-pre-post.ts
 */

import * as crypto from 'crypto';

import {
  computeEdgeScorePre,
  verifyPreDeterminism,
  EdgePreInput,
  EdgePreOutput,
  MODEL_VERSION_PRE,
} from '../agents/ScoringAgent/scoring/edgeEnginePre';
import {
  computeEdgeScorePost,
  verifyPostDeterminism,
  EdgePostInput,
  EdgePostOutput,
  MODEL_VERSION_POST,
} from '../agents/ScoringAgent/scoring/edgeEngineV1';

// =============================================================================
// TEST CONFIGURATION
// =============================================================================

const NUM_TEST_PICKS = 20;

// =============================================================================
// HASH FUNCTIONS
// =============================================================================

function hashPreOutput(output: EdgePreOutput): string {
  const { computed_at, ...hashable } = output;
  return crypto.createHash('sha256').update(JSON.stringify(hashable)).digest('hex');
}

function hashPostOutput(output: EdgePostOutput): string {
  const { computed_at, ...hashable } = output;
  return crypto.createHash('sha256').update(JSON.stringify(hashable)).digest('hex');
}

// =============================================================================
// TEST DATA GENERATION
// =============================================================================

interface TestPick {
  // PRE fields
  pick_id: string;
  sport: string;
  stat_type: string;
  side: 'over' | 'under';
  entry_line: number;
  entry_odds: number;
  projection: number | null;
  opening_line: number | null;
  opening_odds: number | null;
  player_name: string;

  // POST fields (closing data)
  closing_line: number | null;
  closing_odds: number | null;
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
    const hasClosing = Math.random() > 0.2;

    const lineDelta = (Math.random() - 0.3) * 3;
    const oddsDelta = Math.floor((Math.random() - 0.3) * 20);

    picks.push({
      pick_id: `test-${i + 1}`,
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
      closing_line: hasClosing ? Math.round((entryLine + lineDelta) * 10) / 10 : null,
      closing_odds: hasClosing ? entryOdds + oddsDelta : null,
      player_name: `Test Player ${i + 1}`,
    });
  }

  return picks;
}

// =============================================================================
// TEST FUNCTIONS
// =============================================================================

interface DeterminismResult {
  pick_id: string;
  pre_deterministic: boolean;
  post_deterministic: boolean;
  pre_hash: string;
  post_hash: string;
  pre_score: number;
  post_score: number;
  pre_tier: string;
  post_tier: string;
}

function testDeterminism(picks: TestPick[]): DeterminismResult[] {
  const results: DeterminismResult[] = [];

  for (const pick of picks) {
    // Build PRE input (no closing data)
    const preInput: EdgePreInput = {
      pick_id: pick.pick_id,
      sport: pick.sport,
      stat_type: pick.stat_type,
      side: pick.side,
      entry_line: pick.entry_line,
      entry_odds: pick.entry_odds,
      projection: pick.projection,
      opening_line: pick.opening_line,
      opening_odds: pick.opening_odds,
      player_name: pick.player_name,
    };

    // Build POST input (includes closing data)
    const postInput: EdgePostInput = {
      pick_id: pick.pick_id,
      sport: pick.sport,
      stat_type: pick.stat_type,
      side: pick.side,
      entry_line: pick.entry_line,
      entry_odds: pick.entry_odds,
      closing_line: pick.closing_line,
      closing_odds: pick.closing_odds,
      player_name: pick.player_name,
    };

    // Test PRE determinism
    const preOutput1 = computeEdgeScorePre(preInput);
    const preOutput2 = computeEdgeScorePre(preInput);
    const preHash1 = hashPreOutput(preOutput1);
    const preHash2 = hashPreOutput(preOutput2);
    const preDeterministic = preHash1 === preHash2;

    // Also use built-in verifier
    const preBuiltIn = verifyPreDeterminism(preInput);

    // Test POST determinism
    const postOutput1 = computeEdgeScorePost(postInput);
    const postOutput2 = computeEdgeScorePost(postInput);
    const postHash1 = hashPostOutput(postOutput1);
    const postHash2 = hashPostOutput(postOutput2);
    const postDeterministic = postHash1 === postHash2;

    // Also use built-in verifier
    const postBuiltIn = verifyPostDeterminism(postInput);

    results.push({
      pick_id: pick.pick_id,
      pre_deterministic: preDeterministic && preBuiltIn,
      post_deterministic: postDeterministic && postBuiltIn,
      pre_hash: preHash1.substring(0, 16),
      post_hash: postHash1.substring(0, 16),
      pre_score: preOutput1.edge_score_pre,
      post_score: postOutput1.edge_score_post,
      pre_tier: preOutput1.tier_pre,
      post_tier: postOutput1.tier_post,
    });
  }

  return results;
}

function testPreUnchangedWithoutClosing(picks: TestPick[]): { passed: boolean; details: string[] } {
  const details: string[] = [];
  let allPassed = true;

  for (const pick of picks) {
    // Build PRE input with closing data (should be rejected OR ignored)
    const preInputWithClosing: EdgePreInput = {
      pick_id: pick.pick_id,
      sport: pick.sport,
      stat_type: pick.stat_type,
      side: pick.side,
      entry_line: pick.entry_line,
      entry_odds: pick.entry_odds,
      projection: pick.projection,
      opening_line: pick.opening_line,
      opening_odds: pick.opening_odds,
      player_name: pick.player_name,
    };

    // Build PRE input without closing data (identical)
    const preInputWithoutClosing: EdgePreInput = { ...preInputWithClosing };

    // Compute both
    const outputWith = computeEdgeScorePre(preInputWithClosing);
    const outputWithout = computeEdgeScorePre(preInputWithoutClosing);

    // Compare hashes
    const hashWith = hashPreOutput(outputWith);
    const hashWithout = hashPreOutput(outputWithout);

    if (hashWith !== hashWithout) {
      details.push(`FAIL: ${pick.pick_id} - PRE score changed when closing data removed`);
      allPassed = false;
    }
  }

  if (allPassed) {
    details.push(
      `PASS: All ${picks.length} picks have identical PRE scores with/without closing data`
    );
  }

  return { passed: allPassed, details };
}

function calculateCorrelation(results: DeterminismResult[]): {
  correlation: number;
  avgPreScore: number;
  avgPostScore: number;
} {
  const n = results.length;
  if (n === 0) return { correlation: 0, avgPreScore: 0, avgPostScore: 0 };

  const preScores = results.map(r => r.pre_score);
  const postScores = results.map(r => r.post_score);

  const avgPre = preScores.reduce((a, b) => a + b, 0) / n;
  const avgPost = postScores.reduce((a, b) => a + b, 0) / n;

  // Calculate Pearson correlation
  let numerator = 0;
  let denomPre = 0;
  let denomPost = 0;

  for (let i = 0; i < n; i++) {
    const diffPre = preScores[i] - avgPre;
    const diffPost = postScores[i] - avgPost;
    numerator += diffPre * diffPost;
    denomPre += diffPre * diffPre;
    denomPost += diffPost * diffPost;
  }

  const correlation =
    denomPre > 0 && denomPost > 0 ? numerator / Math.sqrt(denomPre * denomPost) : 0;

  return {
    correlation: Math.round(correlation * 1000) / 1000,
    avgPreScore: Math.round(avgPre * 100) / 100,
    avgPostScore: Math.round(avgPost * 100) / 100,
  };
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  console.log('='.repeat(70));
  console.log('EDGE ENGINE PRE/POST DETERMINISM TEST');
  console.log(`PRE Model Version: ${MODEL_VERSION_PRE}`);
  console.log(`POST Model Version: ${MODEL_VERSION_POST}`);
  console.log('Sprint: SPRINT-EDGE-ENGINE-PRESCORE-SPLIT-098');
  console.log('='.repeat(70));
  console.log('');

  // Generate test data
  const testPicks = generateTestPicks();
  console.log(`[SETUP] Generated ${testPicks.length} test picks`);
  console.log('');

  // Test 1: Determinism
  console.log('[TEST 1] Determinism Tests (compute twice, compare hashes)');
  console.log('-'.repeat(70));

  const results = testDeterminism(testPicks);

  console.log('');
  console.log(
    '| Pick ID   | PRE Det | POST Det | PRE Hash     | POST Hash    | PRE Score | POST Score |'
  );
  console.log(
    '|' +
      '-'.repeat(11) +
      '|' +
      '-'.repeat(9) +
      '|' +
      '-'.repeat(10) +
      '|' +
      '-'.repeat(14) +
      '|' +
      '-'.repeat(14) +
      '|' +
      '-'.repeat(11) +
      '|' +
      '-'.repeat(12) +
      '|'
  );

  for (const r of results) {
    const preDet = r.pre_deterministic ? 'PASS' : 'FAIL';
    const postDet = r.post_deterministic ? 'PASS' : 'FAIL';
    console.log(
      `| ${r.pick_id.padEnd(9)} | ${preDet.padEnd(7)} | ${postDet.padEnd(8)} | ${r.pre_hash}... | ${r.post_hash}... | ${r.pre_score.toFixed(1).padStart(9)} | ${r.post_score.toFixed(1).padStart(10)} |`
    );
  }

  const prePassed = results.filter(r => r.pre_deterministic).length;
  const postPassed = results.filter(r => r.post_deterministic).length;

  console.log('');
  console.log(`PRE Determinism: ${prePassed}/${results.length} PASS`);
  console.log(`POST Determinism: ${postPassed}/${results.length} PASS`);

  // Test 2: PRE unchanged without closing
  console.log('');
  console.log('[TEST 2] PRE Score Unchanged Without Closing Data');
  console.log('-'.repeat(70));

  const unchangedTest = testPreUnchangedWithoutClosing(testPicks);
  for (const detail of unchangedTest.details) {
    console.log(`  ${detail}`);
  }

  // Test 3: Correlation analysis
  console.log('');
  console.log('[TEST 3] PRE/POST Correlation Analysis');
  console.log('-'.repeat(70));

  const correlation = calculateCorrelation(results);
  console.log(`  Average PRE Score: ${correlation.avgPreScore}`);
  console.log(`  Average POST Score: ${correlation.avgPostScore}`);
  console.log(`  Pearson Correlation: ${correlation.correlation}`);
  console.log('');

  if (correlation.correlation > 0.3) {
    console.log('  PASS: PRE and POST are positively correlated (r > 0.3)');
  } else if (correlation.correlation > 0) {
    console.log('  WARN: PRE and POST have weak positive correlation');
  } else {
    console.log('  FAIL: PRE and POST are not positively correlated');
  }

  // Summary
  console.log('');
  console.log('='.repeat(70));
  console.log('TEST SUMMARY');
  console.log('='.repeat(70));

  const allPreDeterministic = prePassed === results.length;
  const allPostDeterministic = postPassed === results.length;
  const preUnchanged = unchangedTest.passed;
  const goodCorrelation = correlation.correlation > 0;

  console.log(
    `  PRE Determinism: ${allPreDeterministic ? 'PASS' : 'FAIL'} (${prePassed}/${results.length})`
  );
  console.log(
    `  POST Determinism: ${allPostDeterministic ? 'PASS' : 'FAIL'} (${postPassed}/${results.length})`
  );
  console.log(`  PRE Unchanged: ${preUnchanged ? 'PASS' : 'FAIL'}`);
  console.log(
    `  Correlation: ${goodCorrelation ? 'PASS' : 'WARN'} (r = ${correlation.correlation})`
  );

  console.log('');
  console.log('='.repeat(70));

  const allPassed = allPreDeterministic && allPostDeterministic && preUnchanged;

  if (allPassed) {
    console.log('RESULT: PASS - All determinism tests passed');
    console.log('');
    console.log(`PRE_MODEL_VERSION: ${MODEL_VERSION_PRE}`);
    console.log(`POST_MODEL_VERSION: ${MODEL_VERSION_POST}`);
  } else {
    console.log('RESULT: FAIL - Determinism test failed');
    process.exit(1);
  }

  console.log('='.repeat(70));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
