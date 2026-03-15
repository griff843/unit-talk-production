#!/usr/bin/env node
/**
 * Sprint Gate — SPRINT-053-GOVERNANCE-NAMING-CONVENTION
 *
 * Validates that the requested sprint matches the locked next sprint.
 *
 * Authority order:
 *   1. docs/status/NEXT_5_SPRINTS.md  — Sprint 1 line (current queue, primary)
 *   2. docs/roadmap/INTELLIGENCE_PIPELINE_SPRINT_ORDER.md  — legacy fallback
 *      (covers SPRINT-031 through SPRINT-040 intelligence pipeline sprints)
 *
 * Usage:
 *   pnpm sprint:gate                          # show current next sprint
 *   node tools/governance/sprint-gate.js <SPRINT-ID>  # validate specific sprint
 */

const fs = require('fs');
const path = require('path');

const NEXT_SPRINTS_PATH = path.resolve(process.cwd(), 'docs/status/NEXT_5_SPRINTS.md');

const ROADMAP_PATH = path.resolve(
  process.cwd(),
  'docs/roadmap/INTELLIGENCE_PIPELINE_SPRINT_ORDER.md'
);

/**
 * Parse Sprint 1 from NEXT_5_SPRINTS.md.
 * Looks for a line matching: ## Sprint 1: SPRINT-...
 */
function getNextSprintFromQueue() {
  if (!fs.existsSync(NEXT_SPRINTS_PATH)) {
    return null;
  }
  const text = fs.readFileSync(NEXT_SPRINTS_PATH, 'utf8');
  const match = text.match(/^## Sprint 1:\s+(SPRINT-[\w-]+)/m);
  return match ? match[1].trim() : null;
}

/**
 * Parse "Next Sprint (LOCKED)" from INTELLIGENCE_PIPELINE_SPRINT_ORDER.md.
 * Legacy fallback for intelligence pipeline sprints (SPRINT-031 to SPRINT-040).
 */
function getNextSprintFromRoadmap() {
  if (!fs.existsSync(ROADMAP_PATH)) {
    return null;
  }
  const text = fs.readFileSync(ROADMAP_PATH, 'utf8');
  const nextSection =
    text.split('## Next Sprint (LOCKED)')[1]?.split('## Future Sprint Order')[0] || '';
  const match = nextSection.match(/###\s+(SPRINT-[0-9A-Z-]+)/);
  return match ? match[1] : null;
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

const next = getNextSprintFromQueue() || getNextSprintFromRoadmap();

if (!next) {
  console.error('[SPRINT GATE] FAIL: could not determine locked next sprint.');
  console.error('  Checked: docs/status/NEXT_5_SPRINTS.md (Sprint 1 line)');
  console.error('  Checked: docs/roadmap/INTELLIGENCE_PIPELINE_SPRINT_ORDER.md');
  process.exit(1);
}

const requested = process.argv[2];

if (!requested) {
  console.log('[SPRINT GATE] PASS');
  const source = getNextSprintFromQueue()
    ? 'NEXT_5_SPRINTS.md'
    : 'INTELLIGENCE_PIPELINE_SPRINT_ORDER.md';
  console.log(`Next locked sprint: ${next}  (source: ${source})`);
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
