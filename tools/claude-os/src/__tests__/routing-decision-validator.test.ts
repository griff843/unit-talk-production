/**
 * Tests for routing-decision-validator.ts (COS-007)
 *
 * Test groups:
 *   1. findRoutingDecisionFile — file discovery
 *   2. validateRoutingDecision — missing sprint output directory
 *   3. validateRoutingDecision — missing file
 *   4. validateRoutingDecision — valid file passes
 *   5. validateRoutingDecision — missing required fields
 *   6. validateRoutingDecision — partial missing fields
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { findRoutingDecisionFile, validateRoutingDecision } from '../routing-decision-validator.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-os-routing-validator-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/** Write LLM_ROUTING_DECISION.md into out/sprints/<sprint>/<date>/ under tmpDir */
function writeRoutingDecision(sprintId: string, dateDir: string, content: string): string {
  const dir = path.join(tmpDir, 'out', 'sprints', sprintId, dateDir);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, 'LLM_ROUTING_DECISION.md');
  fs.writeFileSync(filePath, content);
  return filePath;
}

const VALID_ROUTING_DECISION = `# LLM Routing Decision — SPRINT-TEST-001

**Generated**: 2026-03-15T00:00:00.000Z
**Sprint**: SPRINT-TEST-001
**Sprint Type**: feature

---

## 1. Classification Result

**Classifications**: implementation

---

## 2. Lanes Selected

| Lane | Name | Preferred Model | Execution Mode | External? |
|------|------|----------------|----------------|-----------|
| 1 | Implementation | Claude Sonnet | Claude Code internal | None |
| 3 | Verification | Claude Sonnet | Claude Code internal | None |

---

## 4. Instance Recommendation

**Mode**: SINGLE_INSTANCE

**Rationale**: Mode A — single-LLM execution.
`;

const SPRINT_ID = 'SPRINT-TEST-001';
const opts = () => ({ repoRoot: tmpDir });

// ---------------------------------------------------------------------------
// 1. findRoutingDecisionFile
// ---------------------------------------------------------------------------

describe('findRoutingDecisionFile', () => {
  it('returns null when sprint directory does not exist', () => {
    expect(findRoutingDecisionFile('SPRINT-MISSING', opts())).toBeNull();
  });

  it('returns null when sprint directory exists but has no date subdirs', () => {
    fs.mkdirSync(path.join(tmpDir, 'out', 'sprints', SPRINT_ID), { recursive: true });
    expect(findRoutingDecisionFile(SPRINT_ID, opts())).toBeNull();
  });

  it('returns null when date subdirs exist but contain no routing decision file', () => {
    fs.mkdirSync(path.join(tmpDir, 'out', 'sprints', SPRINT_ID, '2026-03-15'), {
      recursive: true,
    });
    expect(findRoutingDecisionFile(SPRINT_ID, opts())).toBeNull();
  });

  it('returns the absolute path when the file exists', () => {
    const filePath = writeRoutingDecision(SPRINT_ID, '2026-03-15', VALID_ROUTING_DECISION);
    expect(findRoutingDecisionFile(SPRINT_ID, opts())).toBe(filePath);
  });

  it('returns the most-recent date directory first when multiple exist', () => {
    writeRoutingDecision(SPRINT_ID, '2026-03-14', '# old');
    const newer = writeRoutingDecision(SPRINT_ID, '2026-03-15', VALID_ROUTING_DECISION);
    expect(findRoutingDecisionFile(SPRINT_ID, opts())).toBe(newer);
  });

  it('uses the requested date directory when dateDir is provided', () => {
    const older = writeRoutingDecision(SPRINT_ID, '2026-03-14', VALID_ROUTING_DECISION);
    writeRoutingDecision(SPRINT_ID, '2026-03-15', '# newer but invalid');

    expect(findRoutingDecisionFile(SPRINT_ID, { ...opts(), dateDir: '2026-03-14' })).toBe(older);
  });
});

// ---------------------------------------------------------------------------
// 2. Missing sprint output directory
// ---------------------------------------------------------------------------

describe('validateRoutingDecision — missing sprint directory', () => {
  it('returns valid=false with descriptive error', () => {
    const result = validateRoutingDecision(SPRINT_ID, opts());
    expect(result.valid).toBe(false);
    expect(result.filePath).toBeNull();
    expect(result.errors.some(e => e.includes('not found'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Missing file
// ---------------------------------------------------------------------------

describe('validateRoutingDecision — missing file', () => {
  it('returns valid=false when directory exists but file is absent', () => {
    fs.mkdirSync(path.join(tmpDir, 'out', 'sprints', SPRINT_ID, '2026-03-15'), {
      recursive: true,
    });
    const result = validateRoutingDecision(SPRINT_ID, opts());
    expect(result.valid).toBe(false);
    expect(result.filePath).toBeNull();
    expect(result.errors.some(e => e.includes('LLM_ROUTING_DECISION.md not found'))).toBe(true);
  });

  it('includes hint to run the router in the error message', () => {
    fs.mkdirSync(path.join(tmpDir, 'out', 'sprints', SPRINT_ID, '2026-03-15'), {
      recursive: true,
    });
    const result = validateRoutingDecision(SPRINT_ID, opts());
    expect(result.errors.some(e => e.includes('route'))).toBe(true);
  });

  it('reports the specific date path when dateDir is provided', () => {
    fs.mkdirSync(path.join(tmpDir, 'out', 'sprints', SPRINT_ID, '2026-03-15'), {
      recursive: true,
    });
    const result = validateRoutingDecision(SPRINT_ID, { ...opts(), dateDir: '2026-03-15' });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('2026-03-15');
  });
});

// ---------------------------------------------------------------------------
// 4. Valid file passes
// ---------------------------------------------------------------------------

describe('validateRoutingDecision — valid file', () => {
  it('returns valid=true for a well-formed routing decision', () => {
    writeRoutingDecision(SPRINT_ID, '2026-03-15', VALID_ROUTING_DECISION);
    const result = validateRoutingDecision(SPRINT_ID, opts());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.filePath).not.toBeNull();
  });

  it('returns the absolute path to the file', () => {
    const filePath = writeRoutingDecision(SPRINT_ID, '2026-03-15', VALID_ROUTING_DECISION);
    const result = validateRoutingDecision(SPRINT_ID, opts());
    expect(result.filePath).toBe(filePath);
  });
});

// ---------------------------------------------------------------------------
// 5. Missing required fields — all absent
// ---------------------------------------------------------------------------

describe('validateRoutingDecision — all required fields missing', () => {
  it('reports errors for all four required fields', () => {
    writeRoutingDecision(SPRINT_ID, '2026-03-15', '# LLM Routing Decision\n\nNo required content.');
    const result = validateRoutingDecision(SPRINT_ID, opts());
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// 6. Partial missing fields
// ---------------------------------------------------------------------------

describe('validateRoutingDecision — partial missing fields', () => {
  it('fails when Sprint identifier is missing', () => {
    const content = VALID_ROUTING_DECISION.replace('**Sprint**: SPRINT-TEST-001', '');
    writeRoutingDecision(SPRINT_ID, '2026-03-15', content);
    const result = validateRoutingDecision(SPRINT_ID, opts());
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Sprint identifier'))).toBe(true);
  });

  it('fails when Classifications are missing', () => {
    const content = VALID_ROUTING_DECISION.replace('**Classifications**: implementation', '');
    writeRoutingDecision(SPRINT_ID, '2026-03-15', content);
    const result = validateRoutingDecision(SPRINT_ID, opts());
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Work type'))).toBe(true);
  });

  it('fails when Instance mode is missing', () => {
    const content = VALID_ROUTING_DECISION.replace('SINGLE_INSTANCE', 'UNSET');
    writeRoutingDecision(SPRINT_ID, '2026-03-15', content);
    const result = validateRoutingDecision(SPRINT_ID, opts());
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Instance mode'))).toBe(true);
  });

  it('fails when Lane assignments are missing', () => {
    // Remove the table header row
    const content = VALID_ROUTING_DECISION.replace('| Lane | Name |', '| — | — |');
    writeRoutingDecision(SPRINT_ID, '2026-03-15', content);
    const result = validateRoutingDecision(SPRINT_ID, opts());
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Lane assignments'))).toBe(true);
  });

  it('passes with TWO_INSTANCES as instance mode', () => {
    const content = VALID_ROUTING_DECISION.replace('SINGLE_INSTANCE', 'TWO_INSTANCES');
    writeRoutingDecision(SPRINT_ID, '2026-03-15', content);
    const result = validateRoutingDecision(SPRINT_ID, opts());
    expect(result.valid).toBe(true);
  });

  it('passes with THREE_INSTANCES as instance mode', () => {
    const content = VALID_ROUTING_DECISION.replace('SINGLE_INSTANCE', 'THREE_INSTANCES');
    writeRoutingDecision(SPRINT_ID, '2026-03-15', content);
    const result = validateRoutingDecision(SPRINT_ID, opts());
    expect(result.valid).toBe(true);
  });
});
