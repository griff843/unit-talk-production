/**
 * Tests for evidence-capture.ts
 *
 * Verifies evidence file writing and evidence index generation.
 * Uses os.tmpdir() for isolation.
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
  CommandRunResult,
  VerificationExecutionResult,
} from '../types.js';

// ---------------------------------------------------------------------------
// Test Setup
// ---------------------------------------------------------------------------

let tmpRoot: string;
let relativeRoot: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-os-evidence-'));
  // Make relativeRoot relative to workspace root for resolveRepoPath
  const wsRoot = getWorkspaceRoot();
  relativeRoot = path.relative(wsRoot, tmpRoot).replace(/\\/g, '/');
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function makeArtifactPlan(overrides: Partial<ArtifactPlan> = {}): ArtifactPlan {
  return {
    sprintId: 'SPRINT-TEST-001',
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('evidence-capture', () => {
  describe('createEvidenceDirectories', () => {
    it('should create directories from artifact plan', () => {
      const plan = makeArtifactPlan();
      const result = createEvidenceDirectories(plan);

      expect(result.success).toBe(true);
      expect(result.created).toContain('proofs');
      expect(result.created).toContain('diffs');
      expect(result.created).toContain('notes');

      // Verify directories exist
      expect(fs.existsSync(path.join(tmpRoot, 'proofs'))).toBe(true);
      expect(fs.existsSync(path.join(tmpRoot, 'diffs'))).toBe(true);
    });
  });

  describe('captureStepEvidence', () => {
    it('should write evidence file with metadata header', () => {
      const plan = makeArtifactPlan();
      createEvidenceDirectories(plan);
      const step = makeStep();

      const result = captureStepEvidence(step, step.commandResult, plan);

      expect(result.success).toBe(true);
      expect(result.writtenTo).toBeTruthy();

      const content = fs.readFileSync(result.writtenTo!, 'utf-8');
      expect(content).toContain('CLAUDE OS VERIFICATION EVIDENCE');
      expect(content).toContain('Recipe:     typecheck');
      expect(content).toContain('Status:     PASS');
      expect(content).toContain('Exit Code:  0');
      expect(content).toContain('OK'); // stdout
    });

    it('should write stub evidence for BLOCKED steps', () => {
      const plan = makeArtifactPlan();
      createEvidenceDirectories(plan);
      const step = makeStep({
        status: 'BLOCKED',
        reason: 'Required recipe has unresolved command',
        commandResult: null,
        outputFile: 'proofs/proof_lint.txt',
      });

      const result = captureStepEvidence(step, null, plan);

      expect(result.success).toBe(true);
      const content = fs.readFileSync(result.writtenTo!, 'utf-8');
      expect(content).toContain('BLOCKED');
      expect(content).toContain('not executed');
    });

    it('should return success with null writtenTo when no outputFile', () => {
      const plan = makeArtifactPlan();
      const step = makeStep({ outputFile: null });

      const result = captureStepEvidence(step, step.commandResult, plan);

      expect(result.success).toBe(true);
      expect(result.writtenTo).toBeNull();
    });
  });

  describe('writeEvidenceIndex', () => {
    it('should write valid JSON evidence index', () => {
      const plan = makeArtifactPlan();
      createEvidenceDirectories(plan);

      const execResult: VerificationExecutionResult = {
        sprintId: 'SPRINT-TEST-001',
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
      expect(fs.existsSync(indexPath)).toBe(true);

      const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      expect(parsed.sprintId).toBe('SPRINT-TEST-001');
      expect(parsed.overallStatus).toBe('PASS');
      expect(parsed.entries).toHaveLength(1);
      expect(parsed.entries[0].recipeId).toBe('typecheck');
    });
  });
});
