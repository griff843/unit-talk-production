/**
 * Claude OS — Bundle Assembler
 *
 * Orchestrates proof bundle assembly from plan and verification outputs.
 * Scans artifact root for file presence, validates completeness,
 * invokes the verdict engine, and writes manifest/verdict/proof-index.
 *
 * Fail-closed: halts on missing artifact root, missing evidence index,
 * or blocked plan. Honest FAIL verdict for missing required evidence.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  fileExists,
  dirExists,
  safeReadJson,
  safeWriteJson,
  safeWriteText,
  resolveRepoPath,
} from './fs-utils.js';
import { buildProofIndexData, renderProofIndex } from './proof-index-renderer.js';
import { buildEvidenceChecklist, evaluateVerdict } from './verdict-engine.js';
import { getMinimumTier } from './verification-resolver.js';

import type {
  BundleAssemblyInput,
  BundleAssemblyResult,
  BundleManifest,
  BundleManifestEntry,
  BundleCompletenessCheck,
  ArtifactPresenceStatus,
  ArtifactFileExpectation,
  EvidenceIndex,
  FailClosedReason,
  ProofRequirement,
  VerificationExecutionResult,
  VerificationSummary,
  VerificationStepResult,
  RuntimeProofGateResult,
} from './types.js';

// ---------------------------------------------------------------------------
// Input Validation
// ---------------------------------------------------------------------------

/**
 * Validate that bundle assembly can proceed.
 * Returns fail-closed reasons if not.
 */
export function validateBundleInputs(input: BundleAssemblyInput): FailClosedReason[] {
  const reasons: FailClosedReason[] = [];

  if (!input.plan.artifactPlan.canonicalRoot) {
    reasons.push({
      rule: 'Rule 4: Undefined Artifact Path',
      description: 'Artifact root is undefined or empty — cannot assemble proof bundle',
      severity: 'blocking',
      source: 'bundle-assembler',
      resolution: 'Ensure sprint plan has a valid artifact root path',
    });
  }

  if (!input.plan.request.sprintId) {
    reasons.push({
      rule: 'Sprint Naming Convention',
      description: 'Sprint ID is empty — cannot generate proof bundle',
      severity: 'blocking',
      source: 'bundle-assembler',
      resolution: 'Provide a valid sprint ID',
    });
  }

  if (input.plan.status === 'blocked') {
    for (const blocker of input.plan.failClosedBlockers) {
      reasons.push(blocker);
    }
  }

  return reasons;
}

// ---------------------------------------------------------------------------
// Artifact Root Scanning
// ---------------------------------------------------------------------------

/** File scan result for a single artifact */
export interface FileStatus {
  present: boolean;
  nonEmpty: boolean;
  sizeBytes: number;
}

/**
 * Scan the artifact root for expected file presence and size.
 * Supports glob patterns (e.g. proofs/proof_runtime_*.txt) via directory listing.
 */
export function scanArtifactRoot(
  absoluteRoot: string,
  expectedFiles: ArtifactFileExpectation[]
): Map<string, FileStatus> {
  const result = new Map<string, FileStatus>();

  for (const expected of expectedFiles) {
    // Handle glob patterns (paths containing *)
    if (expected.relativePath.includes('*')) {
      const absGlob = path.resolve(absoluteRoot, expected.relativePath);
      const dir = path.dirname(absGlob);
      const basePattern = path.basename(absGlob);
      // Convert glob pattern to regex: escape dots, replace * with .*
      const regex = new RegExp('^' + basePattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');

      let matchedFile: string | null = null;
      try {
        const entries = fs.readdirSync(dir);
        matchedFile = entries.find(f => regex.test(f)) ?? null;
      } catch {
        // directory doesn't exist
      }

      if (!matchedFile) {
        result.set(expected.relativePath, { present: false, nonEmpty: false, sizeBytes: 0 });
        continue;
      }

      try {
        const stats = fs.statSync(path.join(dir, matchedFile));
        result.set(expected.relativePath, {
          present: true,
          nonEmpty: stats.size > 0,
          sizeBytes: stats.size,
        });
      } catch {
        result.set(expected.relativePath, { present: false, nonEmpty: false, sizeBytes: 0 });
      }
      continue;
    }

    // Standard literal file check
    const absPath = path.resolve(absoluteRoot, expected.relativePath);

    if (!fileExists(absPath)) {
      result.set(expected.relativePath, { present: false, nonEmpty: false, sizeBytes: 0 });
      continue;
    }

    try {
      const stats = fs.statSync(absPath);
      result.set(expected.relativePath, {
        present: true,
        nonEmpty: stats.size > 0,
        sizeBytes: stats.size,
      });
    } catch {
      result.set(expected.relativePath, { present: false, nonEmpty: false, sizeBytes: 0 });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Completeness Check
// ---------------------------------------------------------------------------

/**
 * Build the bundle completeness check from scan results and proof requirements.
 */
export function checkCompleteness(
  proofRequirements: ProofRequirement[],
  fileStatusMap: Map<string, FileStatus>
): BundleCompletenessCheck {
  const required = proofRequirements.filter(p => p.required);
  const optional = proofRequirements.filter(p => !p.required);

  const missingRequired: string[] = [];
  const emptyRequired: string[] = [];
  let presentRequired = 0;

  for (const req of required) {
    const status = fileStatusMap.get(req.artifact);
    if (!status || !status.present) {
      missingRequired.push(req.artifact);
    } else if (!status.nonEmpty) {
      emptyRequired.push(req.artifact);
    } else {
      presentRequired++;
    }
  }

  let presentOptional = 0;
  for (const req of optional) {
    const status = fileStatusMap.get(req.artifact);
    if (status?.present && status.nonEmpty) {
      presentOptional++;
    }
  }

  return {
    totalRequired: required.length,
    presentRequired,
    missingRequired,
    emptyRequired,
    totalOptional: optional.length,
    presentOptional,
  };
}

// ---------------------------------------------------------------------------
// Manifest Builder
// ---------------------------------------------------------------------------

/**
 * Build the BundleManifest from assembled data.
 */
export function buildManifest(
  input: BundleAssemblyInput,
  fileStatusMap: Map<string, FileStatus>,
  completeness: BundleCompletenessCheck,
  verdict: { status: import('./types.js').BundleVerdictStatus; rationale: string },
  runtimeProofGate: RuntimeProofGateResult
): BundleManifest {
  const plan = input.plan;
  const allProofReqs = [...plan.proofRequirements];

  // Build artifact entries
  const artifacts: BundleManifestEntry[] = allProofReqs.map(req => {
    const status = fileStatusMap.get(req.artifact);
    let presenceStatus: ArtifactPresenceStatus = 'missing';
    let sizeBytes: number | null = null;

    if (status?.present) {
      presenceStatus = status.nonEmpty ? 'present' : 'empty';
      sizeBytes = status.sizeBytes;
    }

    return {
      relativePath: req.artifact,
      category: req.category,
      description: req.description,
      required: req.required,
      status: presenceStatus,
      sizeBytes,
    };
  });

  const verificationTier = getMinimumTier(plan.request.sprintType);

  return {
    sprintId: plan.request.sprintId,
    sprintType: plan.request.sprintType,
    date: plan.artifactPlan.date,
    generatedAt: new Date().toISOString(),
    bundlePath: plan.artifactPlan.canonicalRoot,
    verificationTier,
    artifacts,
    completeness,
    verdictSummary: {
      status: verdict.status,
      rationale: verdict.rationale,
    },
    runtimeProofGate,
  };
}

// ---------------------------------------------------------------------------
// Evidence Index Loader
// ---------------------------------------------------------------------------

/**
 * Load a VerificationExecutionResult from an evidence-index.json file.
 * Reconstructs the structured result from the persisted index.
 */
export function loadVerificationResultFromIndex(indexPath: string): {
  success: boolean;
  result: VerificationExecutionResult | null;
  error: string | null;
} {
  const readResult = safeReadJson<EvidenceIndex>(indexPath);
  if (!readResult.success || !readResult.content) {
    return {
      success: false,
      result: null,
      error: readResult.error ?? 'Failed to read evidence index',
    };
  }

  const index = readResult.content;

  // Reconstruct steps from entries
  const steps: VerificationStepResult[] = index.entries.map(entry => ({
    recipeId: entry.recipeId,
    status: entry.status,
    reason: `Loaded from evidence index (status: ${entry.status})`,
    commandResult: null,
    outputFile: entry.outputFile,
    durationMs: 0,
    browserArtifacts: entry.browserEvidence?.browserArtifacts,
  }));

  // Reconstruct summary
  const summary: VerificationSummary = {
    total: steps.length,
    passed: steps.filter(s => s.status === 'PASS').length,
    failed: steps.filter(s => s.status === 'FAIL').length,
    blocked: steps.filter(s => s.status === 'BLOCKED').length,
    skipped: steps.filter(s => s.status === 'SKIPPED').length,
  };

  return {
    success: true,
    result: {
      sprintId: index.sprintId,
      steps,
      overallStatus: index.overallStatus,
      evidenceRoot: index.evidenceRoot,
      runtimeProofGate: index.runtimeProofGate,
      summary,
      generatedAt: index.generatedAt,
    },
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Bundle Assembly
// ---------------------------------------------------------------------------

/**
 * Assemble a complete proof bundle from plan and verification outputs.
 *
 * Writes manifest.json, verdict.json, and PROOF_INDEX.md to the artifact root.
 * Fail-closed on structural issues; honest FAIL verdict for evidence gaps.
 */
export function assembleBundle(input: BundleAssemblyInput): BundleAssemblyResult {
  const generatedAt = new Date().toISOString();

  // 1. Validate inputs — halt on fail-closed
  const failClosedReasons = validateBundleInputs(input);
  if (failClosedReasons.length > 0) {
    return {
      success: false,
      manifest: null,
      verdict: null,
      proofIndexPath: null,
      manifestPath: null,
      verdictPath: null,
      failClosedReasons,
      generatedAt,
    };
  }

  // 2. Resolve artifact root — halt if missing
  const artifactRoot = resolveRepoPath(input.plan.artifactPlan.canonicalRoot);
  if (!dirExists(artifactRoot)) {
    return {
      success: false,
      manifest: null,
      verdict: null,
      proofIndexPath: null,
      manifestPath: null,
      verdictPath: null,
      failClosedReasons: [
        {
          rule: 'Rule 4: Undefined Artifact Path',
          description: `Artifact root does not exist: ${artifactRoot}`,
          severity: 'blocking',
          source: 'bundle-assembler',
          resolution: 'Run verify command first to create artifact directories and evidence',
        },
      ],
      generatedAt,
    };
  }

  // 3. Load evidence index — halt if missing
  const evidenceIndexPath = path.join(artifactRoot, 'verification-evidence-index.json');
  if (!fileExists(evidenceIndexPath)) {
    return {
      success: false,
      manifest: null,
      verdict: null,
      proofIndexPath: null,
      manifestPath: null,
      verdictPath: null,
      failClosedReasons: [
        {
          rule: 'Evidence index required',
          description:
            'verification-evidence-index.json not found at artifact root. Verification has not been run.',
          severity: 'blocking',
          source: 'bundle-assembler',
          resolution: "Run 'verify' command first to execute verification and generate evidence",
        },
      ],
      generatedAt,
    };
  }

  // 4. Merge expected files from plan proof requirements
  const allProofRequirements = [...input.plan.proofRequirements];
  const expectedFiles: ArtifactFileExpectation[] = allProofRequirements.map(req => ({
    relativePath: req.artifact,
    category: req.category,
    description: req.description,
    required: req.required,
  }));

  // 5. Scan artifact root
  const fileStatusMap = scanArtifactRoot(artifactRoot, expectedFiles);

  // 6. Check completeness
  const completeness = checkCompleteness(allProofRequirements, fileStatusMap);

  // 7. Build evidence checklist
  const evidenceChecklist = buildEvidenceChecklist(
    allProofRequirements,
    fileStatusMap,
    input.verificationResult
  );

  // 8. Evaluate verdict
  const verdict = evaluateVerdict(
    evidenceChecklist,
    completeness,
    input.verificationResult,
    allProofRequirements,
    input.verificationResult.runtimeProofGate
  );

  // 9. Build manifest
  const manifest = buildManifest(
    input,
    fileStatusMap,
    completeness,
    verdict,
    input.verificationResult.runtimeProofGate
  );

  // 10. Build and render proof index
  const proofIndexData = buildProofIndexData(
    input.plan,
    input.verificationResult,
    manifest,
    verdict
  );
  const proofIndexMarkdown = renderProofIndex(proofIndexData);

  // 11. Write outputs
  const manifestPath = path.join(artifactRoot, 'manifest.json');
  const verdictPath = path.join(artifactRoot, 'verdict.json');
  const proofIndexPath = path.join(artifactRoot, 'PROOF_INDEX.md');

  const manifestWrite = safeWriteJson(manifestPath, manifest);
  if (!manifestWrite.success) {
    return {
      success: false,
      manifest,
      verdict,
      proofIndexPath: null,
      manifestPath: null,
      verdictPath: null,
      failClosedReasons: [
        {
          rule: 'Write failure',
          description: `Failed to write manifest.json: ${manifestWrite.error}`,
          severity: 'blocking',
          source: 'bundle-assembler',
          resolution: 'Check filesystem permissions',
        },
      ],
      generatedAt,
    };
  }

  const verdictWrite = safeWriteJson(verdictPath, verdict);
  if (!verdictWrite.success) {
    return {
      success: false,
      manifest,
      verdict,
      proofIndexPath: null,
      manifestPath: manifestPath,
      verdictPath: null,
      failClosedReasons: [
        {
          rule: 'Write failure',
          description: `Failed to write verdict.json: ${verdictWrite.error}`,
          severity: 'blocking',
          source: 'bundle-assembler',
          resolution: 'Check filesystem permissions',
        },
      ],
      generatedAt,
    };
  }

  const indexWrite = safeWriteText(proofIndexPath, proofIndexMarkdown);
  if (!indexWrite.success) {
    return {
      success: false,
      manifest,
      verdict,
      proofIndexPath: null,
      manifestPath: manifestPath,
      verdictPath: verdictPath,
      failClosedReasons: [
        {
          rule: 'Write failure',
          description: `Failed to write PROOF_INDEX.md: ${indexWrite.error}`,
          severity: 'blocking',
          source: 'bundle-assembler',
          resolution: 'Check filesystem permissions',
        },
      ],
      generatedAt,
    };
  }

  return {
    success: true,
    manifest,
    verdict,
    proofIndexPath,
    manifestPath,
    verdictPath,
    failClosedReasons: [],
    generatedAt,
  };
}
