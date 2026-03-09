/**
 * Tests for proof-index-renderer.ts (Phase D)
 *
 * Verifies PROOF_INDEX.md rendering follows the 7-section template structure.
 * Pure string tests — no file system.
 */

import { describe, it, expect } from 'vitest';

import { renderProofIndex, buildProofIndexData } from '../proof-index-renderer.js';

import type {
  BundleManifest,
  BundleVerdict,
  SprintExecutionPlan,
  VerificationExecutionResult,
} from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlan(): SprintExecutionPlan {
  return {
    status: 'ready',
    request: {
      sprintId: 'SPRINT-RENDER-TEST',
      sprintType: 'docs',
      summary: 'Test proof index rendering',
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
    ],
    artifactPlan: {
      sprintId: 'SPRINT-RENDER-TEST',
      date: '2026-03-08',
      canonicalRoot: 'out/sprints/SPRINT-RENDER-TEST/2026-03-08',
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
  };
}

function makeVerResult(): VerificationExecutionResult {
  return {
    sprintId: 'SPRINT-RENDER-TEST',
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
    evidenceRoot: 'out/sprints/SPRINT-RENDER-TEST/2026-03-08',
    runtimeProofGate: {
      required: false,
      satisfied: true,
      reason: 'Not required',
      missingEvidence: [],
    },
    summary: { total: 1, passed: 1, failed: 0, blocked: 0, skipped: 0 },
    generatedAt: new Date().toISOString(),
  };
}

function makeManifest(): BundleManifest {
  return {
    sprintId: 'SPRINT-RENDER-TEST',
    sprintType: 'docs',
    date: '2026-03-08',
    generatedAt: new Date().toISOString(),
    bundlePath: 'out/sprints/SPRINT-RENDER-TEST/2026-03-08',
    verificationTier: 'T1',
    artifacts: [
      {
        relativePath: 'proofs/proof_typecheck.txt',
        category: 'typecheck',
        description: 'TypeScript compilation',
        required: true,
        status: 'present',
        sizeBytes: 1234,
      },
    ],
    completeness: {
      totalRequired: 1,
      presentRequired: 1,
      missingRequired: [],
      emptyRequired: [],
      totalOptional: 0,
      presentOptional: 0,
    },
    verdictSummary: { status: 'PASS', rationale: 'All requirements met' },
    runtimeProofGate: {
      required: false,
      satisfied: true,
      reason: 'Not required',
      missingEvidence: [],
    },
  };
}

function makeVerdict(): BundleVerdict {
  return {
    status: 'PASS',
    rationale: '1/1 required artifacts present. Verification: 1 passed. All requirements met.',
    evidenceChecklist: [],
    limitations: [],
    blockers: [],
    recommendations: ['Ratify — PR is ready for human review.'],
    confidence: 'high',
    confidenceRationale: 'All evidence is captured with clear pass indicators',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('proof-index-renderer', () => {
  describe('renderProofIndex', () => {
    it('should include all 7 required sections', () => {
      const data = buildProofIndexData(makePlan(), makeVerResult(), makeManifest(), makeVerdict());
      const md = renderProofIndex(data);

      expect(md).toContain('## 1. What Changed');
      expect(md).toContain('## 2. Verification Summary');
      expect(md).toContain('## 3. Runtime Evidence Summary');
      expect(md).toContain('## 4. Artifact Manifest');
      expect(md).toContain('## 5. Verdict Summary');
      expect(md).toContain('## 6. Known Limitations');
      expect(md).toContain('## 7. Ratification Recommendation');
    });

    it('should render header with sprint metadata', () => {
      const data = buildProofIndexData(makePlan(), makeVerResult(), makeManifest(), makeVerdict());
      const md = renderProofIndex(data);

      expect(md).toContain('SPRINT-RENDER-TEST');
      expect(md).toContain('2026-03-08');
      expect(md).toContain('docs');
      expect(md).toContain('T1');
    });

    it('should render verification summary table', () => {
      const data = buildProofIndexData(makePlan(), makeVerResult(), makeManifest(), makeVerdict());
      const md = renderProofIndex(data);

      expect(md).toContain('| Verification | Recipe | Result | Evidence File |');
      expect(md).toContain('TypeScript compilation');
      expect(md).toContain('`typecheck`');
      expect(md).toContain('PASS');
    });

    it('should render artifact manifest table', () => {
      const data = buildProofIndexData(makePlan(), makeVerResult(), makeManifest(), makeVerdict());
      const md = renderProofIndex(data);

      expect(md).toContain('| Artifact | Status | Path |');
      expect(md).toContain('PRESENT');
      expect(md).toContain('proof_typecheck.txt');
    });

    it('should render verdict section with correct status', () => {
      const data = buildProofIndexData(makePlan(), makeVerResult(), makeManifest(), makeVerdict());
      const md = renderProofIndex(data);

      expect(md).toContain('**Verdict**: PASS');
      expect(md).toContain('**Rationale**');
    });

    it('should render N/A for runtime evidence when not required', () => {
      const data = buildProofIndexData(makePlan(), makeVerResult(), makeManifest(), makeVerdict());
      const md = renderProofIndex(data);

      expect(md).toContain('N/A');
      expect(md).toContain('build-time sprint');
    });

    it('should render ratification recommendation matching verdict', () => {
      const data = buildProofIndexData(makePlan(), makeVerResult(), makeManifest(), makeVerdict());
      const md = renderProofIndex(data);

      expect(md).toContain('**Recommendation**: RATIFY');
      expect(md).toContain('**Confidence**: high');
    });

    it('should render git evidence section with git artifacts in manifest', () => {
      const manifest = makeManifest();
      manifest.artifacts.push(
        {
          relativePath: 'proofs/proof_git_status.txt',
          category: 'git_status',
          description: 'Git working tree status',
          required: true,
          status: 'present',
          sizeBytes: 500,
        },
        {
          relativePath: 'diffs/sprint_changes.diff',
          category: 'diff',
          description: 'Sprint code changes',
          required: true,
          status: 'present',
          sizeBytes: 2000,
        },
        {
          relativePath: 'proofs/proof_git_log.txt',
          category: 'git_log',
          description: 'Recent commit history',
          required: false,
          status: 'present',
          sizeBytes: 300,
        }
      );

      const data = buildProofIndexData(makePlan(), makeVerResult(), manifest, makeVerdict());
      const md = renderProofIndex(data);

      expect(md).toContain('## Git Evidence');
      expect(md).toContain('git status');
      expect(md).toContain('proof_git_status.txt');
      expect(md).toContain('sprint_changes.diff');
      expect(md).toContain('proof_git_log.txt');
    });

    it('should render empty git evidence section when no git artifacts', () => {
      const data = buildProofIndexData(makePlan(), makeVerResult(), makeManifest(), makeVerdict());
      const md = renderProofIndex(data);

      expect(md).toContain('## Git Evidence');
      expect(md).toContain('No git evidence captured');
    });

    it('should show correct PRESENT/MISSING status for git evidence entries', () => {
      const manifest = makeManifest();
      manifest.artifacts.push(
        {
          relativePath: 'proofs/proof_git_status.txt',
          category: 'git_status',
          description: 'Git working tree status',
          required: true,
          status: 'present',
          sizeBytes: 500,
        },
        {
          relativePath: 'diffs/sprint_changes.diff',
          category: 'diff',
          description: 'Sprint code changes',
          required: true,
          status: 'missing',
          sizeBytes: null,
        }
      );

      const data = buildProofIndexData(makePlan(), makeVerResult(), manifest, makeVerdict());
      const md = renderProofIndex(data);

      expect(md).toContain('PRESENT');
      expect(md).toContain('MISSING');
    });
  });
});
