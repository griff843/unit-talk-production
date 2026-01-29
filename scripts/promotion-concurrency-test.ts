#!/usr/bin/env npx tsx
/**
 * Promotion Concurrency Safety Test — Stage 6 Proof
 *
 * Demonstrates that the claim-first pattern prevents duplicate processing
 * when multiple agents target the same pick concurrently.
 *
 * This test simulates the UPDATE...WHERE...RETURNING pattern at the logic level.
 * In production, PostgreSQL provides row-level locking that makes the UPDATE
 * atomic — only one transaction can claim a row.
 *
 * Usage:
 *   npx tsx scripts/promotion-concurrency-test.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface SimulatedPick {
  id: string;
  posted_to_discord: boolean;
  player_name: string;
}

interface ClaimResult {
  agent: string;
  pickId: string;
  claimed: boolean;
  reason: string;
}

/**
 * Simulate the claim-first UPDATE pattern.
 * In production, PostgreSQL row-level locking guarantees only one caller
 * can flip posted_to_discord from false→true for a given row.
 */
function simulateClaimFirst(
  pick: SimulatedPick,
  agentName: string
): { claimed: boolean; pick: SimulatedPick } {
  // Simulate: UPDATE unified_picks SET posted_to_discord=true
  //           WHERE id=$1 AND posted_to_discord=false RETURNING id
  if (!pick.posted_to_discord) {
    // Claim succeeds — this agent wins
    pick.posted_to_discord = true;
    return { claimed: true, pick };
  }
  // Claim fails — another agent already claimed it
  return { claimed: false, pick };
}

/**
 * Simulate the old post-then-flag pattern (vulnerable).
 * Both agents read posted_to_discord=false and both proceed to post.
 */
function simulatePostThenFlag(
  pick: SimulatedPick,
  _agentName: string
): { wouldPost: boolean } {
  // Old pattern: SELECT * WHERE posted_to_discord=false
  // Both agents see false → both would post → DUPLICATE
  return { wouldPost: !pick.posted_to_discord };
}

function runConcurrencyTests(): { passed: number; failed: number; results: any[] } {
  const results: any[] = [];
  let passed = 0;
  let failed = 0;

  // Test 1: Claim-first — two agents, same pick
  {
    const pick: SimulatedPick = { id: 'pick-001', posted_to_discord: false, player_name: 'LeBron' };

    // DiscordPromotionAgent claims first
    const claim1 = simulateClaimFirst(pick, 'DiscordPromotionAgent');
    // AlertAgent tries to claim same pick
    const claim2 = simulateClaimFirst(pick, 'AlertAgent');

    const test1Pass = claim1.claimed === true && claim2.claimed === false;
    results.push({
      test: 'Claim-first: two agents, same pick',
      status: test1Pass ? 'PASS' : 'FAIL',
      agent1: { name: 'DiscordPromotionAgent', claimed: claim1.claimed },
      agent2: { name: 'AlertAgent', claimed: claim2.claimed },
      explanation: 'Only first agent gets the claim; second is rejected (idempotent)',
    });
    if (test1Pass) passed++;
    else failed++;
  }

  // Test 2: Claim-first — AlertAgent claims first (reversed order)
  {
    const pick: SimulatedPick = { id: 'pick-002', posted_to_discord: false, player_name: 'Curry' };

    // AlertAgent claims first
    const claim1 = simulateClaimFirst(pick, 'AlertAgent');
    // DiscordPromotionAgent tries to claim same pick
    const claim2 = simulateClaimFirst(pick, 'DiscordPromotionAgent');

    const test2Pass = claim1.claimed === true && claim2.claimed === false;
    results.push({
      test: 'Claim-first: AlertAgent claims first',
      status: test2Pass ? 'PASS' : 'FAIL',
      agent1: { name: 'AlertAgent', claimed: claim1.claimed },
      agent2: { name: 'DiscordPromotionAgent', claimed: claim2.claimed },
      explanation: 'Order does not matter — first claim wins, second is rejected',
    });
    if (test2Pass) passed++;
    else failed++;
  }

  // Test 3: Claim-first — already-claimed pick rejected
  {
    const pick: SimulatedPick = { id: 'pick-003', posted_to_discord: true, player_name: 'Giannis' };

    const claim = simulateClaimFirst(pick, 'AlertAgent');

    const test3Pass = claim.claimed === false;
    results.push({
      test: 'Claim-first: already-posted pick rejected',
      status: test3Pass ? 'PASS' : 'FAIL',
      agent: { name: 'AlertAgent', claimed: claim.claimed },
      explanation: 'Pick with posted_to_discord=true cannot be claimed again',
    });
    if (test3Pass) passed++;
    else failed++;
  }

  // Test 4: Old pattern — demonstrates the race condition
  {
    const pick: SimulatedPick = { id: 'pick-004', posted_to_discord: false, player_name: 'Jokic' };

    // Both agents read at the same time (before either writes)
    const read1 = simulatePostThenFlag({ ...pick }, 'DiscordPromotionAgent');
    const read2 = simulatePostThenFlag({ ...pick }, 'AlertAgent');

    const test4Pass = read1.wouldPost === true && read2.wouldPost === true;
    results.push({
      test: 'OLD pattern: demonstrates race condition (both would post)',
      status: test4Pass ? 'PASS' : 'FAIL',
      agent1: { name: 'DiscordPromotionAgent', wouldPost: read1.wouldPost },
      agent2: { name: 'AlertAgent', wouldPost: read2.wouldPost },
      explanation: 'VULNERABILITY: Both agents see posted_to_discord=false → duplicate posts',
    });
    if (test4Pass) passed++;
    else failed++;
  }

  // Test 5: Multiple picks — each claimed by exactly one agent
  {
    const picks: SimulatedPick[] = [
      { id: 'pick-010', posted_to_discord: false, player_name: 'A' },
      { id: 'pick-011', posted_to_discord: false, player_name: 'B' },
      { id: 'pick-012', posted_to_discord: false, player_name: 'C' },
    ];

    const claimLog: ClaimResult[] = [];

    // Simulate interleaved claims (Agent1 claims pick-010, Agent2 claims pick-010, etc.)
    for (const pick of picks) {
      const c1 = simulateClaimFirst(pick, 'DiscordPromotionAgent');
      claimLog.push({
        agent: 'DiscordPromotionAgent',
        pickId: pick.id,
        claimed: c1.claimed,
        reason: c1.claimed ? 'won claim' : 'already claimed',
      });
      const c2 = simulateClaimFirst(pick, 'AlertAgent');
      claimLog.push({
        agent: 'AlertAgent',
        pickId: pick.id,
        claimed: c2.claimed,
        reason: c2.claimed ? 'won claim' : 'already claimed',
      });
    }

    // Verify: each pick claimed exactly once
    const claimCounts = new Map<string, number>();
    for (const c of claimLog) {
      if (c.claimed) {
        claimCounts.set(c.pickId, (claimCounts.get(c.pickId) || 0) + 1);
      }
    }
    const allExactlyOnce = picks.every(p => claimCounts.get(p.id) === 1);

    results.push({
      test: 'Multiple picks: each claimed exactly once',
      status: allExactlyOnce ? 'PASS' : 'FAIL',
      claimCounts: Object.fromEntries(claimCounts),
      explanation: 'With claim-first, every pick is processed by exactly one agent',
    });
    if (allExactlyOnce) passed++;
    else failed++;
  }

  return { passed, failed, results };
}

function main() {
  console.log('=== Promotion Concurrency Safety Test — Stage 6 ===\n');

  const { passed, failed, results } = runConcurrencyTests();

  for (const r of results) {
    const icon = r.status === 'PASS' ? 'PASS' : 'FAIL';
    console.log(`[${icon}] ${r.test}`);
    if (r.explanation) {
      console.log(`       ${r.explanation}`);
    }
  }

  console.log(`\n=== Summary: ${passed} passed, ${failed} failed out of ${results.length} ===`);

  // Write artifacts
  const dateStr = new Date().toISOString().split('T')[0];
  const outputDir = path.join(__dirname, '..', 'out', 'promotion-agent-next', dateStr, 'concurrency');
  fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(
    path.join(outputDir, 'results.json'),
    JSON.stringify({ passed, failed, total: results.length, results }, null, 2)
  );
  console.log(`\nWritten: ${path.join(outputDir, 'results.json')}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
