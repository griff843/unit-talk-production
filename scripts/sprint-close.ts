#!/usr/bin/env npx tsx
/**
 * SPRINT CLOSEOUT VALIDATOR
 * Sprint: SPRINT-CLAUDE-OS-GOVERNANCE-UPGRADE-079
 *
 * Provides fail-closed closeout validation for all sprints.
 * Generates proof inventory and validates required artifacts.
 *
 * Usage:
 *   npm run sprint:close -- <SPRINT-ID>
 *   npm run sprint:close -- <SPRINT-ID> --date 2026-02-20
 *   npm run sprint:close -- <SPRINT-ID> --lane ops-submit
 *   npm run sprint:validate -- <SPRINT-ID>
 */

/* eslint-disable no-console, security/detect-object-injection, security/detect-non-literal-fs-filename */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { validateRoutingDecision } from '../tools/claude-os/src/routing-decision-validator.js';

const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const SPRINTS_DIR = path.join(WORKSPACE_ROOT, 'out', 'sprints');

// Required artifacts for every sprint
const REQUIRED_ARTIFACTS = [
  'proof_git_status.txt',
  'proof_fetch_main.txt',
  'proof_rebase_or_merge_main.txt',
  'proof_tag_exists.txt',
  'proof_git_status_clean.txt',
  'proof_proof_inventory.txt',
];

// Artifacts that may have variable names (glob patterns)
const REQUIRED_TYPECHECK_PATTERN = /^proof_typecheck.*\.txt$/;
const REQUIRED_SCOPED_VERIFY_PATTERN = /^proof_verify.*\.txt$/;

interface ValidationResult {
  artifact: string;
  required: boolean;
  found: boolean;
  path: string | null;
}

interface ParsedArgs {
  sprintId: string;
  date: string | null;
  lane: string;
  validateOnly: boolean;
  phase: number | null;
  linearIssue: string | null;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let sprintId = '';
  let date: string | null = null;
  let lane = 'full';
  let validateOnly = false;
  let phase: number | null = null;
  let linearIssue: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];
    if (arg === '--date' && nextArg) {
      date = nextArg;
      i++;
    } else if (arg === '--lane' && nextArg) {
      lane = nextArg;
      i++;
    } else if (arg === '--phase' && nextArg) {
      phase = parseInt(nextArg, 10);
      i++;
    } else if (arg === '--linear' && nextArg) {
      linearIssue = nextArg;
      i++;
    } else if (arg === '--validate-only') {
      validateOnly = true;
    } else if (!arg.startsWith('--')) {
      sprintId = arg;
    }
  }

  return { sprintId, date, lane, validateOnly, phase, linearIssue };
}

function validatePhaseProofContent(proofsDir: string, phase: number): boolean {
  const filename = `proof_phase_advancement_${phase}.txt`;
  const filePath = path.join(proofsDir, filename);

  if (!fs.existsSync(filePath)) {
    console.error(`\n❌ PHASE PROOF CONTENT VALIDATION: file not found: ${filename}`);
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const errors: string[] = [];

  if (content.includes('[FILL IN')) {
    errors.push('Evidence fields not completed — contains "[FILL IN"');
  }
  if (content.includes('[REPLACE THIS LINE')) {
    errors.push('Sign-off not completed — contains "[REPLACE THIS LINE"');
  }
  if (!content.includes(`Phase ${phase} criteria satisfied as of`)) {
    errors.push(
      `Sign-off statement missing — must contain "Phase ${phase} criteria satisfied as of"`
    );
  }

  console.log('\n' + '='.repeat(70));
  console.log('PHASE ADVANCEMENT PROOF CONTENT VALIDATION');
  console.log('='.repeat(70));
  console.log(`Phase: ${phase}`);
  console.log(`File:  ${filename}`);

  if (errors.length === 0) {
    console.log('STATUS: ✅ PHASE PROOF CONTENT VALID');
    console.log('='.repeat(70));
    return true;
  }

  console.log('STATUS: ❌ PHASE PROOF CONTENT INVALID');
  for (const err of errors) {
    console.log(`  • ${err}`);
  }
  console.log('='.repeat(70));
  return false;
}

function findLatestDateFolder(sprintDir: string): string | null {
  if (!fs.existsSync(sprintDir)) {
    return null;
  }

  const entries = fs.readdirSync(sprintDir, { withFileTypes: true });
  const dateFolders = entries
    .filter(e => e.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(e.name))
    .map(e => e.name)
    .sort()
    .reverse();

  return dateFolders[0] || null;
}

function generateProofInventory(proofsDir: string): string {
  const inventory: string[] = [];
  inventory.push('============================================================');
  inventory.push('PROOF INVENTORY');
  inventory.push(`Generated: ${new Date().toISOString()}`);
  inventory.push('============================================================');
  inventory.push('');

  const sprintDir = path.dirname(proofsDir);
  listDirectory(sprintDir, '', inventory);

  inventory.push('');
  inventory.push('============================================================');
  inventory.push('END PROOF INVENTORY');
  inventory.push('============================================================');

  return inventory.join('\n');
}

function listDirectory(dir: string, prefix: string, inventory: string[]): void {
  if (!fs.existsSync(dir)) return;

  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = prefix + entry.name;

    if (entry.isDirectory()) {
      inventory.push(`${relativePath}/`);
      listDirectory(fullPath, relativePath + '/', inventory);
    } else {
      const stats = fs.statSync(fullPath);
      inventory.push(`${relativePath} (${stats.size} bytes)`);
    }
  }
}

function validateArtifacts(proofsDir: string, lane: string): ValidationResult[] {
  const results: ValidationResult[] = [];
  const existingFiles = fs.existsSync(proofsDir) ? fs.readdirSync(proofsDir) : [];

  for (const artifact of REQUIRED_ARTIFACTS) {
    const found = existingFiles.includes(artifact);
    results.push({
      artifact,
      required: true,
      found,
      path: found ? `proofs/${artifact}` : null,
    });
  }

  const requiredPatterns = [REQUIRED_TYPECHECK_PATTERN];
  if (lane !== 'full') {
    requiredPatterns.push(REQUIRED_SCOPED_VERIFY_PATTERN);
  }

  for (const pattern of requiredPatterns) {
    const matches = existingFiles.filter(f => pattern.test(f));
    const found = matches.length > 0;
    results.push({
      artifact: pattern.source.replace(/\^|\$|\.\*/g, '*'),
      required: true,
      found,
      path: found ? `proofs/${matches[0]}` : null,
    });
  }

  return results;
}

function printComplianceTable(
  sprintId: string,
  date: string,
  results: ValidationResult[]
): boolean {
  console.log('\n' + '='.repeat(70));
  console.log('SPRINT CLOSEOUT VALIDATION');
  console.log('='.repeat(70));
  console.log(`Sprint: ${sprintId}`);
  console.log(`Date: ${date}`);
  console.log('');
  console.log('COMPLIANCE TABLE:');
  console.log('-'.repeat(70));
  console.log('Artifact'.padEnd(35) + '| Required | Found | Path');
  console.log('-'.repeat(70));

  for (const result of results) {
    const artifact = result.artifact.padEnd(33);
    const required = result.required ? 'YES' : 'NO ';
    const found = result.found ? '✅   ' : '❌   ';
    const filePath = result.path || '-';
    console.log(`${artifact} | ${required}      | ${found} | ${filePath}`);
  }

  console.log('-'.repeat(70));

  const allFound = results.every(r => !r.required || r.found);
  if (allFound) {
    console.log('STATUS: ✅ ALL REQUIRED ARTIFACTS PRESENT');
  } else {
    console.log('STATUS: ❌ MISSING REQUIRED ARTIFACTS');
    const missing = results.filter(r => r.required && !r.found);
    console.log(`Missing: ${missing.map(m => m.artifact).join(', ')}`);
  }
  console.log('='.repeat(70));

  return allFound;
}

function runVerificationLane(lane: string): boolean {
  console.log('\n' + '='.repeat(60));
  console.log(`🔧 RUNNING VERIFICATION LANE: ${lane}`);
  console.log('='.repeat(60));

  try {
    let cmd: string;
    switch (lane) {
      case 'ops-submit':
        cmd = 'npm run verify:ops-submit';
        break;
      case 'api':
        cmd = 'npm run verify:sprint -- --api';
        break;
      case 'full':
        cmd = 'npm run type-check && npm run test';
        break;
      default:
        throw new Error(`Unsupported verification lane: ${lane}`);
    }

    console.log(`Running: ${cmd}`);
    execSync(cmd, { cwd: WORKSPACE_ROOT, stdio: 'inherit' });
    console.log('✅ VERIFICATION LANE PASSED');
    return true;
  } catch {
    console.log('❌ VERIFICATION LANE FAILED');
    return false;
  }
}

function validateSprintDirectory(sprintId: string): string | null {
  const sprintDir = path.join(SPRINTS_DIR, sprintId);
  if (!fs.existsSync(sprintDir)) {
    console.error(`\n❌ Sprint directory not found: ${sprintDir}`);
    console.error('   Create the sprint directory first.');
    return null;
  }
  return sprintDir;
}

function findDateDirectory(sprintDir: string, date: string | null): string | null {
  const targetDate = date || findLatestDateFolder(sprintDir);
  if (!targetDate) {
    console.error(`\n❌ No date folder found in: ${sprintDir}`);
    console.error('   Create a date folder (YYYY-MM-DD) first.');
    return null;
  }
  return targetDate;
}

function main(): void {
  const { sprintId, date, lane, validateOnly, phase, linearIssue } = parseArgs();

  if (!sprintId) {
    console.error(
      'Usage: npm run sprint:close -- <SPRINT-ID> [--date YYYY-MM-DD] [--lane ops-submit|api|full] [--phase N] [--linear UNI-N]'
    );
    process.exit(1);
  }

  console.log('🛡️  SPRINT CLOSEOUT VALIDATOR');
  console.log(`   Sprint ID: ${sprintId}`);
  console.log(`   Mode: ${validateOnly ? 'VALIDATE ONLY' : 'FULL CLOSEOUT'}`);
  if (phase !== null) {
    console.log(`   Phase claim: ${phase} (phase advancement proof required)`);
  }
  if (linearIssue) {
    console.log(`   Linear issue: ${linearIssue} (will sync on success)`);
  }

  const sprintDir = validateSprintDirectory(sprintId);
  if (!sprintDir) process.exit(1);

  const targetDate = findDateDirectory(sprintDir, date);
  if (!targetDate) process.exit(1);

  const dateDir = path.join(sprintDir, targetDate);
  const proofsDir = path.join(dateDir, 'proofs');

  console.log(`   Date: ${targetDate}`);
  console.log(`   Proofs Dir: ${proofsDir}`);

  if (!fs.existsSync(proofsDir)) {
    fs.mkdirSync(proofsDir, { recursive: true });
  }

  // Routing decision gate (COS-007) — always enforced regardless of mode
  console.log('\n🔀 Validating routing decision...');
  const routingResult = validateRoutingDecision(sprintId);
  if (!routingResult.valid) {
    console.error('\n❌ CLOSEOUT FAILED: Routing decision invalid');
    for (const err of routingResult.errors) {
      console.error(`   ${err}`);
    }
    process.exit(1);
  }
  console.log(`   ✅ LLM_ROUTING_DECISION.md valid: ${routingResult.filePath}`);

  if (!validateOnly) {
    const verifyPassed = runVerificationLane(lane);
    if (!verifyPassed) {
      console.error('\n❌ CLOSEOUT FAILED: Verification lane did not pass');
      process.exit(1);
    }
  }

  // Proof inventory write is skipped in --validate-only mode (non-mutating)
  if (!validateOnly) {
    console.log('\n📋 Generating proof inventory...');
    const inventory = generateProofInventory(proofsDir);
    const inventoryPath = path.join(proofsDir, 'proof_proof_inventory.txt');
    fs.writeFileSync(inventoryPath, inventory);
    console.log(`   Written: ${inventoryPath}`);
  }

  // If phase claim, add proof_phase_advancement_<N>.txt to required artifacts
  if (phase !== null) {
    REQUIRED_ARTIFACTS.push(`proof_phase_advancement_${phase}.txt`);
  }

  const results = validateArtifacts(proofsDir, lane);
  const allFound = printComplianceTable(sprintId, targetDate, results);

  if (!allFound) {
    console.error('\n❌ CLOSEOUT FAILED: Missing required artifacts');
    process.exit(1);
  }

  // Phase proof content validation (in addition to presence check)
  if (phase !== null) {
    const contentValid = validatePhaseProofContent(proofsDir, phase);
    if (!contentValid) {
      console.error('\n❌ CLOSEOUT FAILED: Phase advancement proof content invalid');
      console.error('   Fill in all evidence fields and complete the sign-off, then re-run.');
      process.exit(1);
    }
  }

  console.log('\n✅ SPRINT CLOSEOUT VALIDATION PASSED');

  // COS-002: Linear sync (runs after all gates pass, gracefully skips if no API key)
  if (linearIssue && !validateOnly) {
    console.log(`\n🔗 Running Linear sync for ${linearIssue}...`);
    try {
      const dateArg = targetDate ? `--date ${targetDate}` : '';
      execSync(
        `npx tsx ${path.join(WORKSPACE_ROOT, 'scripts', 'sprint-linear-sync.ts')} --issue ${linearIssue} --sprint ${sprintId} ${dateArg}`,
        { cwd: WORKSPACE_ROOT, stdio: 'inherit' }
      );
    } catch {
      // Non-fatal — linear sync failure does not fail the closeout
      console.warn('   ⚠️  Linear sync failed (non-fatal). Run manually:');
      console.warn(`   npm run sprint:linear-sync -- --issue ${linearIssue} --sprint ${sprintId}`);
    }
  }

  process.exit(0);
}

main();
