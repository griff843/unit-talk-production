/**
 * Tests for browser evidence integration (Phase C.2)
 *
 * Verifies that browser artifacts are correctly recorded in evidence files
 * and evidence index entries. Tests the integration between browser-recipe-resolver
 * and evidence-capture.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  createEvidenceDirectories,
  captureStepEvidence,
  writeEvidenceIndex,
} from '../evidence-capture.js';
import { getWorkspaceRoot } from '../fs-utils.js';

import type {
  ArtifactPlan,
  VerificationStepResult,
  VerificationExecutionResult,
  BrowserArtifactEntry,
} from '../types.js';

// ---------------------------------------------------------------------------
// Test Setup
// ---------------------------------------------------------------------------

let tmpRoot: string;
let relativeRoot: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-os-browser-evidence-'));
  const wsRoot = getWorkspaceRoot();
  relativeRoot = path.relative(wsRoot, tmpRoot).replace(/\\/g, '/');
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function makeArtifactPlan(overrides: Partial<ArtifactPlan> = {}): ArtifactPlan {
  return {
    sprintId: 'SPRINT-BROWSER-TEST',
    date: '2026-03-08',
    canonicalRoot: relativeRoot,
    requiredDirectories: ['proofs', 'diffs', 'notes'],
    requiredFiles: [],
    notes: [],
    ...overrides,
  };
}

function makeStep(overrides: Partial<VerificationStepResult> = {}): VerificationStepResult {
  return {
    recipeId: 'typecheck',
    status: 'PASS',
    reason: 'Exit code 0',
    commandResult: {
      command: 'npm run type-check',
      exitCode: 0,
      stdout: 'OK',
      stderr: '',
      durationMs: 1234,
      timedOut: false,
    },
    outputFile: 'proofs/proof_typecheck.txt',
    durationMs: 1234,
    ...overrides,
  };
}

const SAMPLE_BROWSER_ARTIFACTS: BrowserArtifactEntry[] = [
  {
    type: 'screenshot',
    path: 'proofs/screenshots/page-1.png',
    sizeBytes: 54321,
    capturedAt: '2026-03-08T12:00:00.000Z',
  },
  {
    type: 'screenshot',
    path: 'proofs/screenshots/page-2.png',
    sizeBytes: 67890,
    capturedAt: '2026-03-08T12:00:01.000Z',
  },
];

// ---------------------------------------------------------------------------
// Tests: Evidence File Content
// ---------------------------------------------------------------------------

describe('browser evidence in evidence files', () => {
  it('should include browser artifact summary when artifacts present', () => {
    const plan = makeArtifactPlan();
    createEvidenceDirectories(plan);

    const step = makeStep({
      recipeId: 'ui_visual_check',
      outputFile: 'proofs/proof_browser.txt',
      browserArtifacts: SAMPLE_BROWSER_ARTIFACTS,
    });

    const result = captureStepEvidence(step, step.commandResult, plan);
    expect(result.success).toBe(true);

    const content = fs.readFileSync(result.writtenTo!, 'utf-8');
    expect(content).toContain('BROWSER ARTIFACTS');
    expect(content).toContain('Count: 2');
    expect(content).toContain('proofs/screenshots/page-1.png');
    expect(content).toContain('54321 bytes');
  });

  it('should omit browser section when no artifacts', () => {
    const plan = makeArtifactPlan();
    createEvidenceDirectories(plan);

    const step = makeStep({
      recipeId: 'typecheck',
      outputFile: 'proofs/proof_typecheck.txt',
    });

    const result = captureStepEvidence(step, step.commandResult, plan);
    expect(result.success).toBe(true);

    const content = fs.readFileSync(result.writtenTo!, 'utf-8');
    expect(content).not.toContain('BROWSER ARTIFACTS');
  });

  it('should omit browser section when browserArtifacts is empty array', () => {
    const plan = makeArtifactPlan();
    createEvidenceDirectories(plan);

    const step = makeStep({
      recipeId: 'ui_visual_check',
      outputFile: 'proofs/proof_browser.txt',
      browserArtifacts: [],
    });

    const result = captureStepEvidence(step, step.commandResult, plan);
    const content = fs.readFileSync(result.writtenTo!, 'utf-8');
    expect(content).not.toContain('BROWSER ARTIFACTS');
  });
});

// ---------------------------------------------------------------------------
// Tests: Evidence Index
// ---------------------------------------------------------------------------

describe('browser evidence in evidence index', () => {
  it('should include browserEvidence for steps with browser artifacts', () => {
    const plan = makeArtifactPlan();
    createEvidenceDirectories(plan);

    const execResult: VerificationExecutionResult = {
      sprintId: 'SPRINT-BROWSER-TEST',
      steps: [
        makeStep({
          recipeId: 'ui_visual_check',
          browserArtifacts: SAMPLE_BROWSER_ARTIFACTS,
        }),
      ],
      overallStatus: 'PASS',
      evidenceRoot: relativeRoot,
      runtimeProofGate: {
        required: false,
        satisfied: true,
        reason: 'Not required',
        missingEvidence: [],
      },
      summary: { total: 1, passed: 1, failed: 0, blocked: 0, skipped: 0 },
      generatedAt: new Date().toISOString(),
    };

    const result = writeEvidenceIndex(execResult, plan);
    expect(result.success).toBe(true);

    const indexPath = path.join(tmpRoot, 'verification-evidence-index.json');
    const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));

    expect(parsed.entries[0].browserEvidence).toBeDefined();
    expect(parsed.entries[0].browserEvidence.browserArtifacts).toHaveLength(2);
    expect(parsed.entries[0].browserEvidence.playwrightAvailable).toBe(true);
  });

  it('should omit browserEvidence for non-browser steps', () => {
    const plan = makeArtifactPlan();
    createEvidenceDirectories(plan);

    const execResult: VerificationExecutionResult = {
      sprintId: 'SPRINT-BROWSER-TEST',
      steps: [makeStep()],
      overallStatus: 'PASS',
      evidenceRoot: relativeRoot,
      runtimeProofGate: {
        required: false,
        satisfied: true,
        reason: 'Not required',
        missingEvidence: [],
      },
      summary: { total: 1, passed: 1, failed: 0, blocked: 0, skipped: 0 },
      generatedAt: new Date().toISOString(),
    };

    const result = writeEvidenceIndex(execResult, plan);
    expect(result.success).toBe(true);

    const indexPath = path.join(tmpRoot, 'verification-evidence-index.json');
    const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));

    expect(parsed.entries[0].browserEvidence).toBeUndefined();
  });

  it('should preserve backward-compatible evidence index schema', () => {
    const plan = makeArtifactPlan();
    createEvidenceDirectories(plan);

    const execResult: VerificationExecutionResult = {
      sprintId: 'SPRINT-BROWSER-TEST',
      steps: [
        makeStep({ recipeId: 'typecheck' }),
        makeStep({
          recipeId: 'ui_visual_check',
          browserArtifacts: SAMPLE_BROWSER_ARTIFACTS,
        }),
      ],
      overallStatus: 'PASS',
      evidenceRoot: relativeRoot,
      runtimeProofGate: {
        required: false,
        satisfied: true,
        reason: 'Not required',
        missingEvidence: [],
      },
      summary: { total: 2, passed: 2, failed: 0, blocked: 0, skipped: 0 },
      generatedAt: new Date().toISOString(),
    };

    writeEvidenceIndex(execResult, plan);

    const indexPath = path.join(tmpRoot, 'verification-evidence-index.json');
    const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));

    // Standard fields always present
    expect(parsed.sprintId).toBe('SPRINT-BROWSER-TEST');
    expect(parsed.overallStatus).toBe('PASS');
    expect(parsed.entries).toHaveLength(2);

    // Every entry has standard fields
    for (const entry of parsed.entries) {
      expect(entry).toHaveProperty('recipeId');
      expect(entry).toHaveProperty('status');
      expect(entry).toHaveProperty('outputFile');
      expect(entry).toHaveProperty('capturedAt');
    }

    // Only browser entry has browserEvidence
    expect(parsed.entries[0].browserEvidence).toBeUndefined();
    expect(parsed.entries[1].browserEvidence).toBeDefined();
  });
});
