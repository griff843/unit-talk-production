#!/usr/bin/env node
/**
 * Sprint Gate — SPRINT-053-GOVERNANCE-NAMING-CONVENTION
 *
 * Validates that the requested sprint matches the locked next sprint.
 *
 * Authority: docs/status/NEXT_5_SPRINTS.md — sole queue authority.
 * No fallback to roadmap or any secondary source. Fail-closed on all
 * non-locked states (missing, vacant, unparseable).
 *
 * Usage:
 *   pnpm sprint:gate                          # show current next sprint
 *   node tools/governance/sprint-gate.js <SPRINT-ID>  # validate specific sprint
 */

const fs = require('fs');
const path = require('path');

const NEXT_SPRINTS_PATH = path.resolve(process.cwd(), 'docs/status/NEXT_5_SPRINTS.md');

/**
 * Parse Sprint 1 from NEXT_5_SPRINTS.md.
 * Returns queue metadata so all non-locked states fail closed.
 */
function getQueueState() {
  if (!fs.existsSync(NEXT_SPRINTS_PATH)) {
    return { status: 'missing', sprint: null };
  }

  const text = fs.readFileSync(NEXT_SPRINTS_PATH, 'utf8');
  const match = text.match(/^## Sprint 1:\s+(SPRINT-[\w-]+)/m);
  if (match) {
    return { status: 'locked', sprint: match[1].trim() };
  }

  if (/Sprint 1 slot is vacant/i.test(text)) {
    return { status: 'vacant', sprint: null };
  }

  return { status: 'unparseable', sprint: null };
}

/**
 * Validate sprint name format per SPRINT_NAMING_CONVENTION.md.
 * Pattern A: SPRINT-NNN-DESCRIPTIVE-NAME (sequenced)
 * Pattern B: SPRINT-DOMAIN-DESCRIPTOR (non-sequenced)
 * Both must be all-uppercase with hyphens only.
 */
function validateNameFormat(name) {
  if (!name) return { valid: false, reason: 'empty name' };
  if (!/^SPRINT-[A-Z0-9][A-Z0-9-]+$/.test(name)) {
    return {
      valid: false,
      reason: 'name must match SPRINT-[A-Z0-9][A-Z0-9-]+ (uppercase hyphens only)',
    };
  }
  return { valid: true };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const queueState = getQueueState();

if (queueState.status === 'missing') {
  console.error('[SPRINT GATE] FAIL: docs/status/NEXT_5_SPRINTS.md not found.');
  console.error('  This file is the sole queue authority — no fallback exists.');
  console.error('  Restore the file or run /sprint-plan before proceeding.');
  process.exit(1);
}

if (queueState.status === 'vacant') {
  console.error('[SPRINT GATE] FAIL: Sprint 1 queue slot is explicitly vacant.');
  console.error('  Queue authority: docs/status/NEXT_5_SPRINTS.md');
  console.error('  Action: run /sprint-plan and lock the next sprint before proceeding.');
  process.exit(1);
}

if (queueState.status === 'unparseable') {
  console.error('[SPRINT GATE] FAIL: Could not parse Sprint 1 from docs/status/NEXT_5_SPRINTS.md.');
  console.error('  The file exists but no "## Sprint 1: SPRINT-..." line was found.');
  console.error('  Fix the file or run /sprint-plan to set a locked sprint.');
  process.exit(1);
}

const next = queueState.sprint; // status === 'locked' guaranteed here

const requested = process.argv[2];

if (!requested) {
  console.log('[SPRINT GATE] PASS');
  console.log(`Next locked sprint: ${next}  (source: NEXT_5_SPRINTS.md)`);
  process.exit(0);
}

// Validate name format
const formatCheck = validateNameFormat(requested);
if (!formatCheck.valid) {
  console.error(`[SPRINT GATE] FAIL: sprint name format invalid — ${formatCheck.reason}`);
  console.error(`  Received: "${requested}"`);
  console.error('  See docs/claude/SPRINT_NAMING_CONVENTION.md for valid patterns.');
  process.exit(1);
}

// Validate sprint order
if (requested !== next) {
  console.error(
    `[SPRINT GATE] FAIL: requested sprint "${requested}" is not the locked next sprint.`
  );
  console.error(`[SPRINT GATE] Allowed next sprint: "${next}"`);
  console.error('  Update docs/status/NEXT_5_SPRINTS.md if the queue has changed.');
  process.exit(1);
}

console.log(`[SPRINT GATE] PASS: "${requested}" matches locked next sprint.`);
process.exit(0);
