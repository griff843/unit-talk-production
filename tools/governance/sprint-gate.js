#!/usr/bin/env node
/**
 * Sprint Gate - SPRINT-053-GOVERNANCE-NAMING-CONVENTION
 *
 * Validates that the requested sprint matches the locked next sprint from
 * docs/status/NEXT_5_SPRINTS.md, which is the sole runtime queue authority.
 *
 * Usage:
 *   pnpm sprint:gate
 *   node tools/governance/sprint-gate.js <SPRINT-ID>
 */

const fs = require('fs');
const path = require('path');

const NEXT_SPRINTS_PATH = path.resolve(process.cwd(), 'docs/status/NEXT_5_SPRINTS.md');

/**
 * Parse Sprint 1 from NEXT_5_SPRINTS.md.
 * Looks for a line matching: ## Sprint 1: SPRINT-...
 */
function getNextSprintFromQueue() {
  if (!fs.existsSync(NEXT_SPRINTS_PATH)) {
    return { type: 'file_missing' };
  }

  const text = fs.readFileSync(NEXT_SPRINTS_PATH, 'utf8');
  const match = text.match(/^## Sprint 1:\s+(SPRINT-[\w-]+)/m);

  if (!match) {
    return { type: 'vacant' };
  }

  return { type: 'locked', sprint: match[1].trim() };
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

const next = getNextSprintFromQueue();
const requested = process.argv[2];

if (next.type === 'file_missing') {
  console.error('[SPRINT GATE] FAIL: docs/status/NEXT_5_SPRINTS.md is missing.');
  console.error('  Create docs/status/NEXT_5_SPRINTS.md first.');
  console.error('  Format: ## Sprint 1: SPRINT-<NAME>');
  process.exit(1);
}

if (next.type === 'vacant') {
  if (!requested) {
    console.log('[SPRINT GATE] QUEUE VACANT');
    console.log('  Sprint 1 slot is not locked.');
    console.log('  Run /sprint-plan to select the next sprint, then update:');
    console.log('    docs/status/NEXT_5_SPRINTS.md (Sprint 1 line)');
    console.log('  Format: ## Sprint 1: SPRINT-<NAME>');
    process.exit(0);
  }

  console.error('[SPRINT GATE] FAIL: Sprint 1 slot is vacant — no sprint is locked.');
  console.error(`  Cannot validate "${requested}" against an empty queue.`);
  console.error('  Populate docs/status/NEXT_5_SPRINTS.md Sprint 1 before running sprint gate.');
  console.error('  Format: ## Sprint 1: SPRINT-<NAME>');
  process.exit(1);
}

if (!requested) {
  console.log('[SPRINT GATE] PASS');
  console.log(`Next locked sprint: ${next.sprint}  (source: docs/status/NEXT_5_SPRINTS.md)`);
  process.exit(0);
}

const formatCheck = validateNameFormat(requested);
if (!formatCheck.valid) {
  console.error(`[SPRINT GATE] FAIL: sprint name format invalid - ${formatCheck.reason}`);
  console.error(`  Received: "${requested}"`);
  console.error('  See docs/claude/SPRINT_NAMING_CONVENTION.md for valid patterns.');
  process.exit(1);
}

if (requested !== next.sprint) {
  console.error(
    `[SPRINT GATE] FAIL: requested sprint "${requested}" is not the locked next sprint.`
  );
  console.error(`[SPRINT GATE] Allowed next sprint: "${next.sprint}"`);
  console.error('  Update docs/status/NEXT_5_SPRINTS.md if the queue has changed.');
  process.exit(1);
}

console.log(`[SPRINT GATE] PASS: "${requested}" matches locked next sprint.`);
process.exit(0);
