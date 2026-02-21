#!/usr/bin/env node
/**
 * SPRINT-DB-MODE-TRUTH-LOCK-095A: Proof Bundle Automation
 *
 * Captures proof artifacts for DB mode enforcement verification.
 *
 * Usage:
 *   node scripts/proof-db-mode-095a.mjs
 *
 * Prerequisites:
 *   - Stack running in cloud mode OR local mode
 *   - API accessible at http://localhost:3010
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const SPRINT_ID = 'SPRINT-DB-MODE-TRUTH-LOCK-095A';
const DATE = new Date().toISOString().split('T')[0];
const PROOF_DIR = `out/sprints/${SPRINT_ID}/${DATE}/proofs`;
// Use 127.0.0.1 instead of localhost to avoid IPv6 issues on Windows
const API_URL = process.env.API_URL || 'http://127.0.0.1:3010';

console.log('========================================');
console.log(`${SPRINT_ID} - Proof Bundle Automation`);
console.log('========================================\n');

// Create proof directory
fs.mkdirSync(PROOF_DIR, { recursive: true });
console.log(`Created proof directory: ${PROOF_DIR}\n`);

async function fetchOpsStatus() {
  try {
    const response = await fetch(`${API_URL}/ops/status`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch /ops/status:', error.message);
    return null;
  }
}

function runCommand(cmd, description) {
  console.log(`Running: ${description}`);
  try {
    const output = execSync(cmd, { encoding: 'utf8', timeout: 30000 });
    return output;
  } catch (error) {
    console.error(`  Error: ${error.message}`);
    return `ERROR: ${error.message}`;
  }
}

function writeProof(filename, content) {
  const filepath = path.join(PROOF_DIR, filename);
  fs.writeFileSync(filepath, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  console.log(`  Written: ${filename}`);
}

async function captureOpsStatus() {
  console.log('\n--- Capturing /ops/status ---');
  const status = await fetchOpsStatus();

  if (!status) {
    writeProof('proof_ops_status_error.txt', 'Failed to fetch /ops/status - is the API running?');
    return null;
  }

  const dbMode = status.components?.db?.mode || 'unknown';
  const filename = `proof_ops_status_db_${dbMode}.json`;
  writeProof(filename, status);

  console.log(`  DB Mode: ${dbMode}`);
  console.log(`  Mismatch: ${status.components?.db?.mismatchDetected}`);
  console.log(`  Target: ${status.components?.db?.target}`);

  return status;
}

function captureComposeProfiles() {
  console.log('\n--- Capturing Compose Profiles ---');

  // List services per profile
  const cloudServices = runCommand(
    'docker compose config --services 2>/dev/null || echo "Error getting services"',
    'List default (cloud) services'
  );

  const localServices = runCommand(
    'docker compose -f docker-compose.yml -f docker-compose.local.yml config --services 2>/dev/null || echo "Error getting services"',
    'List local mode services'
  );

  const output = `=== COMPOSE PROFILES ===
Date: ${new Date().toISOString()}

=== Cloud Mode Services (default) ===
${cloudServices}

=== Local Mode Services (with docker-compose.local.yml) ===
${localServices}

=== Postgres Profile Assignment ===
Postgres is assigned to profile: [local]
- Cloud mode: postgres container should NOT be running
- Local mode: postgres container SHOULD be running
`;

  writeProof('proof_compose_profiles.txt', output);
}

function captureEnvConsistency() {
  console.log('\n--- Capturing Environment Consistency ---');

  // Capture API env (redacted)
  const apiEnv = runCommand(
    'docker exec unit-talk-api printenv 2>/dev/null | grep -E "^(DB_MODE|DATABASE_URL|SUPABASE_URL|NODE_ENV)=" | sed "s/=.*/=<REDACTED>/" || echo "Container not running"',
    'API environment keys'
  );
  writeProof('proof_env_consistency_api.txt', `=== API Environment Keys ===\nDate: ${new Date().toISOString()}\n\n${apiEnv}`);

  // Capture workers env (redacted)
  const workersEnv = runCommand(
    'docker exec unit-talk-workers printenv 2>/dev/null | grep -E "^(DB_MODE|DATABASE_URL|SUPABASE_URL|NODE_ENV)=" | sed "s/=.*/=<REDACTED>/" || echo "Container not running"',
    'Workers environment keys'
  );
  writeProof('proof_env_consistency_workers.txt', `=== Workers Environment Keys ===\nDate: ${new Date().toISOString()}\n\n${workersEnv}`);
}

function captureGitStatus() {
  console.log('\n--- Capturing Git Status ---');
  const gitStatus = runCommand('git status', 'Git status');
  writeProof('proof_git_status_clean.txt', gitStatus);
}

function captureContainerStatus() {
  console.log('\n--- Capturing Container Status ---');
  const ps = runCommand('docker compose ps 2>&1', 'Docker compose ps');
  writeProof('proof_container_status.txt', ps);

  // Check if postgres is running
  const postgresRunning = ps.includes('unit-talk-postgres') && ps.includes('healthy');
  console.log(`  Postgres container running: ${postgresRunning}`);
}

async function main() {
  console.log('Starting proof capture...\n');

  // Capture all proofs
  const status = await captureOpsStatus();
  captureComposeProfiles();
  captureEnvConsistency();
  captureContainerStatus();
  captureGitStatus();

  // Generate summary
  const summary = {
    sprint: SPRINT_ID,
    date: DATE,
    timestamp: new Date().toISOString(),
    dbMode: status?.components?.db?.mode || 'unknown',
    mismatchDetected: status?.components?.db?.mismatchDetected || false,
    overallReady: status?.overall_ready || false,
    proofFiles: fs.readdirSync(PROOF_DIR),
  };

  writeProof('proof_summary.json', summary);

  console.log('\n========================================');
  console.log('Proof Bundle Complete');
  console.log('========================================');
  console.log(`Directory: ${PROOF_DIR}`);
  console.log(`Files: ${summary.proofFiles.length}`);
  console.log(`DB Mode: ${summary.dbMode}`);
  console.log(`Mismatch Detected: ${summary.mismatchDetected}`);
  console.log(`Overall Ready: ${summary.overallReady}`);
}

main().catch(console.error);
