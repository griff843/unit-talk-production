#!/usr/bin/env node
/**
 * proof-temporal-099a.mjs
 *
 * SPRINT-TEMPORAL-FOUNDATION-TRUTH-LOCK-099A
 *
 * Verifies Temporal health by querying /ops/status and asserting:
 * - temporal.healthy === true
 * - temporal.configured === true
 * - No DB_MODE mismatch (do not regress DB_MODE truth lock)
 *
 * Outputs proof JSON to out/sprints/SPRINT-TEMPORAL-FOUNDATION-TRUTH-LOCK-099A/<date>/proofs/
 *
 * Usage:
 *   node scripts/proof-temporal-099a.mjs
 *
 * Exit codes:
 *   0 - All assertions passed
 *   1 - One or more assertions failed
 */

import fs from 'fs';
import path from 'path';

const API_URL = process.env.API_URL || 'http://127.0.0.1:3010';
const DATE = new Date().toISOString().split('T')[0];
const SPRINT_ID = 'SPRINT-TEMPORAL-FOUNDATION-TRUTH-LOCK-099A';
const PROOF_DIR = path.join('out', 'sprints', SPRINT_ID, DATE, 'proofs');

async function main() {
  console.log('=== TEMPORAL PROOF VERIFICATION ===');
  console.log(`Sprint: ${SPRINT_ID}`);
  console.log(`Date: ${DATE}`);
  console.log(`API URL: ${API_URL}`);
  console.log('');

  // Ensure proof directory exists
  if (!fs.existsSync(PROOF_DIR)) {
    fs.mkdirSync(PROOF_DIR, { recursive: true });
  }

  // Fetch /ops/status
  let statusResponse;
  try {
    const response = await fetch(`${API_URL}/ops/status`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    statusResponse = await response.json();
  } catch (error) {
    console.error('[FAIL] Could not fetch /ops/status:', error.message);
    process.exit(1);
  }

  console.log('Fetched /ops/status successfully');
  console.log('');

  // Extract assertions
  const temporal = statusResponse.components?.temporal || {};
  const db = statusResponse.components?.db || {};

  const assertions = [
    {
      name: 'temporal.configured',
      expected: true,
      actual: temporal.configured,
      pass: temporal.configured === true,
    },
    {
      name: 'temporal.healthy',
      expected: true,
      actual: temporal.healthy,
      pass: temporal.healthy === true,
    },
    {
      name: 'temporal.endpoint',
      expected: 'temporal:7233',
      actual: temporal.endpoint,
      pass: temporal.endpoint === 'temporal:7233',
    },
    {
      name: 'db.mismatchDetected',
      expected: false,
      actual: db.mismatchDetected,
      pass: db.mismatchDetected === false,
    },
  ];

  // Print results
  let allPassed = true;
  for (const a of assertions) {
    const status = a.pass ? '[PASS]' : '[FAIL]';
    console.log(`${status} ${a.name}: expected=${a.expected}, actual=${a.actual}`);
    if (!a.pass) allPassed = false;
  }

  console.log('');

  // Build proof JSON
  const proof = {
    sprint: SPRINT_ID,
    date: DATE,
    timestamp: new Date().toISOString(),
    api_url: API_URL,
    assertions,
    all_passed: allPassed,
    raw_response: statusResponse,
  };

  // Write proof file
  const proofPath = path.join(PROOF_DIR, 'proof_ops_status_temporal.json');
  fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2));
  console.log(`Proof written to: ${proofPath}`);

  // Final result
  if (allPassed) {
    console.log('');
    console.log('=== ALL ASSERTIONS PASSED ===');
    process.exit(0);
  } else {
    console.log('');
    console.log('=== SOME ASSERTIONS FAILED ===');

    // Additional diagnostics
    if (!temporal.healthy && temporal.error) {
      console.log(`Temporal error: ${temporal.error}`);
    }

    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
