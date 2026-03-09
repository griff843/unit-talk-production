/**
 * Tests for bundle-assembler.ts (Phase D)
 *
 * Verifies bundle assembly orchestration: input validation,
 * artifact scanning, completeness checks, and full assembly.
 * Uses os.tmpdir() for file system isolation.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  validateBundleInputs,
  scanArtifactRoot,
  checkCompleteness,
  assembleBundle,
  loadVerificationResultFromIndex,
} from '../bundle-assembler.js';
import { getWorkspaceRoot } from '../fs-utils.js';

import type {
  BundleAssemblyInput,
  SprintExecutionPlan,
  VerificationExecutionResult,
  ArtifactFileExpectation,
  ProofRequirement,
  EvidenceIndex,
} from '../types.js';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let tmpRoot: string;
let relativeRoot: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-os-bundle-'));
  const wsRoot = getWorkspaceRoot();
  relativeRoot = path.relative(wsRoot, tmpRoot).replace(/\\/g, '/');
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlan(overrides: Partial<SprintExecutionPlan> = {}): SprintExecutionPlan {
  return {
    status: 'ready',
    request: {
      sprintId: 'SPRINT-BUNDLE-TEST',
      sprintType: 'docs',
      summary: 'Test bundle assembly',
    },
    governanceSummary: { lawsLoaded: 0, contractsLoaded: 0, recipesLoaded: 0, loadErrors: [] },
    contextPackSummary: {
      alwaysLoadedCount: 0,
      sprintSpecificCount: 0,
      optionalCount: 0,
      failedCount: 0,
      isComplete: true,
    },
    verificationRequirements: [],
    proofRequirements: [
      {
        category: 'typecheck',
        artifact: 'proofs/proof_typecheck.txt',
        description: 'TypeScript compilation',
        required: true,
      },
      {
        category: 'git_status',
        artifact: 'proofs/proof_git_status.txt',
        description: 'Git status',
        required: true,
      },
      {
        category: 'diff',
        artifact: 'diffs/sprint_changes.diff',
        description: 'Sprint changes',
        required: true,
      },
      {
        category: 'closeout',
        artifact: 'SPRINT_CLOSEOUT_REPORT.md',
        description: 'Closeout report',
        required: true,
      },
    ],
    artifactPlan: {
      sprintId: 'SPRINT-BUNDLE-TEST',
      date: '2026-03-08',
      canonicalRoot: relativeRoot,
      requiredDirectories: ['proofs', 'diffs', 'notes'],
      requiredFiles: [],
      notes: [],
    },
    driftSignals: [],
    failClosedBlockers: [],
    riskEscalations: [],
    deferredRequirements: [],
    nextStepRecommendations: [],
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeVerResult(
  overrides: Partial<VerificationExecutionResult> = {}
): VerificationExecutionResult {
  return {
    sprintId: 'SPRINT-BUNDLE-TEST',
    steps: [
      {
        recipeId: 'typecheck',
        status: 'PASS',
        reason: 'Exit code 0',
        commandResult: null,
        outputFile: 'proofs/proof_typecheck.txt',
        durationMs: 100,
      },
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
    ...overrides,
  };
}

function makeInput(overrides: Partial<BundleAssemblyInput> = {}): BundleAssemblyInput {
  return {
    plan: makePlan(),
    verificationResult: makeVerResult(),
    ...overrides,
  };
}

function createEvidenceFiles(): void {
  // Create directories
  fs.mkdirSync(path.join(tmpRoot, 'proofs'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'diffs'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'notes'), { recursive: true });

  // Create evidence files
  fs.writeFileSync(path.join(tmpRoot, 'proofs', 'proof_typecheck.txt'), 'tsc: no errors');
  fs.writeFileSync(path.join(tmpRoot, 'proofs', 'proof_git_status.txt'), 'clean');
  fs.writeFileSync(path.join(tmpRoot, 'diffs', 'sprint_changes.diff'), 'diff content');
  fs.writeFileSync(path.join(tmpRoot, 'SPRINT_CLOSEOUT_REPORT.md'), '# Closeout');
}

function createEvidenceIndex(): void {
  const index: EvidenceIndex = {
    sprintId: 'SPRINT-BUNDLE-TEST',
    generatedAt: new Date().toISOString(),
    evidenceRoot: relativeRoot,
    entries: [
      {
        recipeId: 'typecheck',
        status: 'PASS',
        outputFile: 'proofs/proof_typecheck.txt',
        capturedAt: new Date().toISOString(),
      },
    ],
    runtimeProofGate: {
      required: false,
      satisfied: true,
      reason: 'Not required',
      missingEvidence: [],
    },
    overallStatus: 'PASS',
  };
  fs.writeFileSync(
    path.join(tmpRoot, 'verification-evidence-index.json'),
    JSON.stringify(index, null, 2)
  );
}

// ---------------------------------------------------------------------------
// Tests: validateBundleInputs
// ---------------------------------------------------------------------------

describe('validateBundleInputs', () => {
  it('should return empty array for valid inputs', () => {
    const result = validateBundleInputs(makeInput());
    expect(result).toEqual([]);
  });

  it('should return fail-closed when artifact root is empty', () => {
    const plan = makePlan();
    plan.artifactPlan.canonicalRoot = '';
    const result = validateBundleInputs({ plan, verificationResult: makeVerResult() });

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].rule).toContain('Artifact Path');
  });

  it('should return fail-closed when plan status is blocked', () => {
    const plan = makePlan({
      status: 'blocked',
      failClosedBlockers: [
        {
          rule: 'Test',
          description: 'Test blocker',
          severity: 'blocking',
          source: 'test',
          resolution: 'Fix it',
        },
      ],
    });
    const result = validateBundleInputs({ plan, verificationResult: makeVerResult() });

    expect(result.length).toBeGreaterThan(0);
  });

  it('should return fail-closed when sprint ID is empty', () => {
    const plan = makePlan();
    plan.request.sprintId = '';
    const result = validateBundleInputs({ plan, verificationResult: makeVerResult() });

    expect(result.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: scanArtifactRoot
// ---------------------------------------------------------------------------

describe('scanArtifactRoot', () => {
  it('should detect present files with correct size', () => {
    fs.mkdirSync(path.join(tmpRoot, 'proofs'), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'proofs', 'proof_typecheck.txt'), 'content here');

    const expected: ArtifactFileExpectation[] = [
      {
        relativePath: 'proofs/proof_typecheck.txt',
        category: 'typecheck',
        description: 'test',
        required: true,
      },
    ];

    const result = scanArtifactRoot(tmpRoot, expected);
    const status = result.get('proofs/proof_typecheck.txt');

    expect(status?.present).toBe(true);
    expect(status?.nonEmpty).toBe(true);
    expect(status?.sizeBytes).toBeGreaterThan(0);
  });

  it('should detect missing files', () => {
    const expected: ArtifactFileExpectation[] = [
      {
        relativePath: 'proofs/proof_missing.txt',
        category: 'test',
        description: 'test',
        required: true,
      },
    ];

    const result = scanArtifactRoot(tmpRoot, expected);
    const status = result.get('proofs/proof_missing.txt');

    expect(status?.present).toBe(false);
  });

  it('should detect empty files', () => {
    fs.mkdirSync(path.join(tmpRoot, 'proofs'), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'proofs', 'proof_empty.txt'), '');

    const expected: ArtifactFileExpectation[] = [
      {
        relativePath: 'proofs/proof_empty.txt',
        category: 'test',
        description: 'test',
        required: true,
      },
    ];

    const result = scanArtifactRoot(tmpRoot, expected);
    const status = result.get('proofs/proof_empty.txt');

    expect(status?.present).toBe(true);
    expect(status?.nonEmpty).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: checkCompleteness
// ---------------------------------------------------------------------------

describe('checkCompleteness', () => {
  it('should count required and optional correctly', () => {
    const reqs: ProofRequirement[] = [
      { category: 'a', artifact: 'a.txt', description: 'A', required: true },
      { category: 'b', artifact: 'b.txt', description: 'B', required: true },
      { category: 'c', artifact: 'c.txt', description: 'C', required: false },
    ];

    const fileMap = new Map([
      ['a.txt', { present: true, nonEmpty: true, sizeBytes: 100 }],
      ['b.txt', { present: false, nonEmpty: false, sizeBytes: 0 }],
      ['c.txt', { present: true, nonEmpty: true, sizeBytes: 50 }],
    ]);

    const result = checkCompleteness(reqs, fileMap);

    expect(result.totalRequired).toBe(2);
    expect(result.presentRequired).toBe(1);
    expect(result.missingRequired).toContain('b.txt');
    expect(result.totalOptional).toBe(1);
    expect(result.presentOptional).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: loadVerificationResultFromIndex
// ---------------------------------------------------------------------------

describe('loadVerificationResultFromIndex', () => {
  it('should reconstruct result from valid evidence index', () => {
    createEvidenceIndex();
    const indexPath = path.join(tmpRoot, 'verification-evidence-index.json');

    const loaded = loadVerificationResultFromIndex(indexPath);

    expect(loaded.success).toBe(true);
    expect(loaded.result).not.toBeNull();
    expect(loaded.result!.sprintId).toBe('SPRINT-BUNDLE-TEST');
    expect(loaded.result!.steps).toHaveLength(1);
    expect(loaded.result!.steps[0].recipeId).toBe('typecheck');
    expect(loaded.result!.overallStatus).toBe('PASS');
  });

  it('should return error for missing file', () => {
    const loaded = loadVerificationResultFromIndex('/nonexistent/path.json');

    expect(loaded.success).toBe(false);
    expect(loaded.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Tests: assembleBundle
// ---------------------------------------------------------------------------

describe('assembleBundle', () => {
  it('should write manifest.json, verdict.json, and PROOF_INDEX.md', () => {
    createEvidenceFiles();
    createEvidenceIndex();

    const result = assembleBundle(makeInput());

    expect(result.success).toBe(true);
    expect(result.manifest).not.toBeNull();
    expect(result.verdict).not.toBeNull();

    // Check files exist
    expect(fs.existsSync(path.join(tmpRoot, 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpRoot, 'verdict.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpRoot, 'PROOF_INDEX.md'))).toBe(true);

    // Verify manifest content
    const manifest = JSON.parse(fs.readFileSync(path.join(tmpRoot, 'manifest.json'), 'utf-8'));
    expect(manifest.sprintId).toBe('SPRINT-BUNDLE-TEST');
    expect(manifest.completeness.totalRequired).toBe(4);
  });

  it('should fail closed when evidence index is missing', () => {
    createEvidenceFiles();
    // No evidence index created

    const result = assembleBundle(makeInput());

    expect(result.success).toBe(false);
    expect(result.failClosedReasons.length).toBeGreaterThan(0);
    expect(result.failClosedReasons[0].description).toContain('evidence-index');
  });

  it('should fail closed when artifact root does not exist', () => {
    const plan = makePlan();
    plan.artifactPlan.canonicalRoot = relativeRoot + '/nonexistent';

    const result = assembleBundle({
      plan,
      verificationResult: makeVerResult(),
    });

    expect(result.success).toBe(false);
    expect(result.failClosedReasons[0].description).toContain('does not exist');
  });

  it('should produce FAIL verdict when required file missing', () => {
    // Create evidence index but only some files
    fs.mkdirSync(path.join(tmpRoot, 'proofs'), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, 'diffs'), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'proofs', 'proof_typecheck.txt'), 'ok');
    // Missing: proof_git_status.txt, sprint_changes.diff, SPRINT_CLOSEOUT_REPORT.md
    createEvidenceIndex();

    const result = assembleBundle(makeInput());

    expect(result.success).toBe(true);
    expect(result.verdict!.status).toBe('FAIL');
    expect(result.manifest!.completeness.missingRequired.length).toBeGreaterThan(0);
  });
});
