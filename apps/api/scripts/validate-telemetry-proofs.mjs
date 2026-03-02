#!/usr/bin/env node
/**
 * EXECUTION-TELEMETRY-DEPLOY-VERIFY-006: Proof Validation Script
 *
 * Validates that all required proof artifacts are present and contain
 * expected data patterns.
 *
 * Usage:
 *   node scripts/validate-telemetry-proofs.mjs <proofs-directory>
 */

import fs from 'fs';
import path from 'path';

const REQUIRED_PROOFS = [
  { file: 'proof_staging_migration_apply.txt', pattern: /execution_events/, description: 'Migration apply output' },
  { file: 'proof_staging_schema_verify.md', pattern: /execution_events/, description: 'Schema verification' },
  { file: 'proof_deploy_sha.txt', pattern: /[a-f0-9]{7,40}/, description: 'Git SHA' },
  { file: 'proof_discord_receipt.md', pattern: /\d{17,19}/, description: 'Discord snowflake ID' },
  { file: 'proof_publish_logs.txt', pattern: /telemetry|execution/, description: 'Worker logs' },
  { file: 'proof_telemetry_row.sql', pattern: /pick_id|published/, description: 'Telemetry row query' },
  { file: 'proof_idempotency.sql', pattern: /cnt\s*[=|:]\s*1/, description: 'Idempotency check (cnt=1)' },
  { file: 'proof_settlement_update.sql', pattern: /settled|clv/, description: 'Settlement CLV update' },
  { file: 'proof_missing_telemetry_check.sql', pattern: /missing\s*[=|:]\s*0/, description: 'No missing telemetry (=0)' }
];

function validateProofs(proofsDir) {
  console.log('🔍 TELEMETRY PROOF VALIDATOR');
  console.log(`   Directory: ${proofsDir}`);
  console.log('');

  if (!fs.existsSync(proofsDir)) {
    console.error(`❌ Proofs directory not found: ${proofsDir}`);
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;
  const results = [];

  for (const proof of REQUIRED_PROOFS) {
    const filePath = path.join(proofsDir, proof.file);
    let status = 'MISSING';
    let detail = '';

    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');

      if (content.trim().length === 0) {
        status = 'EMPTY';
        detail = 'File exists but is empty';
      } else if (proof.pattern.test(content)) {
        status = 'PASS';
        detail = `Contains expected pattern: ${proof.pattern}`;
        passed++;
      } else {
        status = 'INVALID';
        detail = `Missing expected pattern: ${proof.pattern}`;
      }
    } else {
      detail = 'File not found';
    }

    if (status !== 'PASS') {
      failed++;
    }

    results.push({
      file: proof.file,
      description: proof.description,
      status,
      detail
    });
  }

  // Print results
  console.log('📊 Results:');
  console.log('');

  for (const result of results) {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    console.log(`   ${icon} ${result.file}`);
    console.log(`      ${result.description}`);
    console.log(`      Status: ${result.status}`);
    if (result.status !== 'PASS') {
      console.log(`      Detail: ${result.detail}`);
    }
    console.log('');
  }

  // Summary
  console.log('─'.repeat(50));
  console.log(`   Total: ${REQUIRED_PROOFS.length}`);
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  console.log('');

  if (failed === 0) {
    console.log('✅ ALL PROOFS VALIDATED');
    return true;
  } else {
    console.log('❌ PROOF VALIDATION FAILED');
    console.log('');
    console.log('Missing or invalid proofs:');
    for (const result of results.filter(r => r.status !== 'PASS')) {
      console.log(`   - ${result.file}: ${result.status}`);
    }
    return false;
  }
}

// Main
const proofsDir = process.argv[2] || 'out/sprints/EXECUTION-TELEMETRY-DEPLOY-VERIFY-006/2026-02-28/proofs';
const success = validateProofs(proofsDir);
process.exit(success ? 0 : 1);
