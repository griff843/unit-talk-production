/**
 * Regression tests for SPRINT-CONTROL-PLANE-TRUTH-RECONCILIATION
 *
 * Test groups:
 *   1. sprint-gate.js — fail-closed on all non-locked states (no roadmap fallback)
 *   2. hasDrift null/undefined/unknown — fail-closed in pre-sprint-check logic
 *   3. check-session-baseline — backward walk skips incomplete dirs
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'control-plane-truth-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const SPRINT_GATE = path.resolve(__dirname, '../../../../tools/governance/sprint-gate.js');
const REPO_ROOT = path.resolve(__dirname, '../../../../');

/**
 * Run sprint-gate.js with a synthetic NEXT_5_SPRINTS.md in tmpDir.
 * Returns { exitCode, stdout, stderr }.
 */
function runSprintGate(
  nextSprintsContent: string | null,
  args: string[] = []
): { exitCode: number; stdout: string; stderr: string } {
  const statusDir = path.join(tmpDir, 'docs', 'status');
  fs.mkdirSync(statusDir, { recursive: true });

  if (nextSprintsContent !== null) {
    fs.writeFileSync(path.join(statusDir, 'NEXT_5_SPRINTS.md'), nextSprintsContent);
  }

  let stdout = '';
  let stderr = '';
  let exitCode = 0;

  try {
    stdout = execSync(`node "${SPRINT_GATE}" ${args.join(' ')}`, {
      cwd: tmpDir,
      encoding: 'utf8',
      env: { ...process.env },
      timeout: 5000,
    });
  } catch (err: any) {
    stdout = err.stdout ?? '';
    stderr = err.stderr ?? '';
    exitCode = err.status ?? 1;
  }

  return { exitCode, stdout, stderr };
}

// ---------------------------------------------------------------------------
// 1. sprint-gate.js — fail-closed on all non-locked states
// ---------------------------------------------------------------------------

describe('sprint-gate: fail-closed on all non-locked states (no roadmap fallback)', () => {
  it('exits 1 when NEXT_5_SPRINTS.md is missing', () => {
    const { exitCode, stderr } = runSprintGate(null);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('FAIL');
    expect(stderr).toContain('NEXT_5_SPRINTS.md not found');
    // Must NOT reference roadmap fallback
    expect(stderr).not.toContain('INTELLIGENCE_PIPELINE_SPRINT_ORDER');
  });

  it('exits 1 when queue slot is vacant', () => {
    const { exitCode, stderr } = runSprintGate(
      '## Sprint Queue\n\n> **Sprint 1 slot is vacant.** Run `/sprint-plan` to select.\n'
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain('FAIL');
    expect(stderr).toContain('vacant');
    expect(stderr).not.toContain('INTELLIGENCE_PIPELINE_SPRINT_ORDER');
  });

  it('exits 1 when queue content is unparseable', () => {
    const { exitCode, stderr } = runSprintGate('# Next 5 Sprints\n\nNo sprint header here.\n');
    expect(exitCode).toBe(1);
    expect(stderr).toContain('FAIL');
    expect(stderr).toContain('Could not parse Sprint 1');
    // Must not silently fall back to roadmap
    expect(stderr).not.toContain('INTELLIGENCE_PIPELINE_SPRINT_ORDER');
  });

  it('exits 0 and reports locked sprint when queue has Sprint 1', () => {
    const { exitCode, stdout } = runSprintGate('## Sprint 1: SPRINT-TEST-LOCKED\n\n## Summary\n');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('PASS');
    expect(stdout).toContain('SPRINT-TEST-LOCKED');
    expect(stdout).toContain('NEXT_5_SPRINTS.md');
  });

  it('exits 1 with wrong sprint name even when queue is locked', () => {
    const { exitCode, stderr } = runSprintGate('## Sprint 1: SPRINT-TEST-LOCKED\n\n## Summary\n', [
      'SPRINT-WRONG-SPRINT',
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('FAIL');
    expect(stderr).toContain('SPRINT-WRONG-SPRINT');
    expect(stderr).toContain('SPRINT-TEST-LOCKED');
  });
});

// ---------------------------------------------------------------------------
// 2. hasDrift null/undefined/unknown — fail-closed
// ---------------------------------------------------------------------------

/**
 * Simulate the checkForBlockers hasDrift logic directly.
 * This mirrors the logic in scripts/pre-sprint-check.mjs.
 */
function checkDriftBlocker(hasDrift: boolean | null | undefined | string) {
  const blockers: string[] = [];
  if (hasDrift !== false) {
    const reason =
      hasDrift === true
        ? 'Schema drift detected'
        : `Schema drift status unknown (hasDrift=${String(hasDrift)}) — fail-closed`;
    blockers.push(reason);
  }
  return blockers;
}

describe('hasDrift fail-closed logic', () => {
  it('blocks when hasDrift === true', () => {
    const blockers = checkDriftBlocker(true);
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toContain('Schema drift detected');
  });

  it('blocks when hasDrift === null (was fail-open, now fixed)', () => {
    const blockers = checkDriftBlocker(null);
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toContain('unknown');
    expect(blockers[0]).toContain('fail-closed');
  });

  it('blocks when hasDrift === undefined', () => {
    const blockers = checkDriftBlocker(undefined);
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toContain('unknown');
  });

  it('blocks when hasDrift is an unexpected string', () => {
    const blockers = checkDriftBlocker('Unknown');
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toContain('Unknown');
  });

  it('does NOT block when hasDrift === false (clean schema)', () => {
    const blockers = checkDriftBlocker(false);
    expect(blockers).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 3. check-session-baseline backward walk — skips incomplete dirs
// ---------------------------------------------------------------------------

/**
 * Simulate the backward-walk logic from check-session-baseline.mjs and
 * pre-sprint-check.mjs: sort dirs newest-first, skip those without a valid
 * baseline.json with a timestamp field.
 */
function findLatestBaselineBackwardWalk(baselineDir: string) {
  if (!fs.existsSync(baselineDir)) return null;

  const entries = fs.readdirSync(baselineDir, { withFileTypes: true });
  const dirs = entries
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort()
    .reverse();

  for (const name of dirs) {
    const baselinePath = path.join(baselineDir, name, 'baseline.json');
    if (!fs.existsSync(baselinePath)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
      if (data.timestamp) return { name, timestamp: data.timestamp };
    } catch {
      continue;
    }
  }
  return null;
}

describe('check-session-baseline: backward walk skips incomplete dirs', () => {
  // Note: Windows does not allow ':' in directory names.
  // Baseline dirs use names like '20260317-100000' (no colons).

  it('skips dir with no baseline.json and finds older valid dir', () => {
    const baseDir = path.join(tmpDir, 'session-baseline');
    // newest dir — incomplete (no baseline.json)
    fs.mkdirSync(path.join(baseDir, '20260317-100000'), { recursive: true });
    // older dir — valid
    const oldDir = path.join(baseDir, '20260317-090000');
    fs.mkdirSync(oldDir, { recursive: true });
    fs.writeFileSync(
      path.join(oldDir, 'baseline.json'),
      JSON.stringify({ timestamp: '2026-03-17T09:00:00.000Z', typescript: { totalErrors: 0 } })
    );

    const found = findLatestBaselineBackwardWalk(baseDir);
    expect(found).not.toBeNull();
    expect(found!.name).toBe('20260317-090000');
    expect(found!.timestamp).toBe('2026-03-17T09:00:00.000Z');
  });

  it('skips dir with corrupt baseline.json and finds valid one', () => {
    const baseDir = path.join(tmpDir, 'session-baseline');
    // newest dir — corrupt JSON
    const newestDir = path.join(baseDir, '20260317-110000');
    fs.mkdirSync(newestDir, { recursive: true });
    fs.writeFileSync(path.join(newestDir, 'baseline.json'), 'NOT VALID JSON{{{');
    // older dir — valid
    const oldDir = path.join(baseDir, '20260317-080000');
    fs.mkdirSync(oldDir, { recursive: true });
    fs.writeFileSync(
      path.join(oldDir, 'baseline.json'),
      JSON.stringify({ timestamp: '2026-03-17T08:00:00.000Z' })
    );

    const found = findLatestBaselineBackwardWalk(baseDir);
    expect(found).not.toBeNull();
    expect(found!.name).toBe('20260317-080000');
  });

  it('skips dir with baseline.json missing timestamp field', () => {
    const baseDir = path.join(tmpDir, 'session-baseline');
    // newest dir — no timestamp
    const newestDir = path.join(baseDir, '20260317-120000');
    fs.mkdirSync(newestDir, { recursive: true });
    fs.writeFileSync(
      path.join(newestDir, 'baseline.json'),
      JSON.stringify({ typescript: { totalErrors: 0 } }) // no timestamp
    );
    // older dir — valid
    const oldDir = path.join(baseDir, '20260317-070000');
    fs.mkdirSync(oldDir, { recursive: true });
    fs.writeFileSync(
      path.join(oldDir, 'baseline.json'),
      JSON.stringify({ timestamp: '2026-03-17T07:00:00.000Z' })
    );

    const found = findLatestBaselineBackwardWalk(baseDir);
    expect(found!.name).toBe('20260317-070000');
  });

  it('returns null when no dirs have valid baseline.json', () => {
    const baseDir = path.join(tmpDir, 'session-baseline');
    fs.mkdirSync(path.join(baseDir, 'run1'), { recursive: true });
    // no baseline.json in run1

    const found = findLatestBaselineBackwardWalk(baseDir);
    expect(found).toBeNull();
  });

  it('returns null when baselineDir does not exist', () => {
    const found = findLatestBaselineBackwardWalk(path.join(tmpDir, 'nonexistent'));
    expect(found).toBeNull();
  });
});
