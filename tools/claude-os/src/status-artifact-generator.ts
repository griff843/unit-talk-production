/**
 * Status Artifact Generator (Sprint 5 — STATUS_RUBRIC.md)
 *
 * Generates a governed post-sprint status artifact grounded in:
 *   - Sprint state (receipts, blockers, maturity delta request)
 *   - Proof receipt validation results (hash integrity)
 *   - STATUS_RUBRIC.md maturity level definitions
 *   - Repo context pack (subsystem label)
 *
 * Output:
 *   out/status/<SPRINT_ID>/<DATE>/status-artifact.json  — machine-readable
 *   out/status/<SPRINT_ID>/<DATE>/status-artifact.md    — human-readable
 *
 * Fail-closed rule: if evidence is insufficient, the maturity claim is capped
 * at the highest justified level. Claims are NEVER inflated.
 *
 * Elite and Syndicate-Grade cannot be auto-verified from sprint state alone.
 */

import * as path from 'node:path';

import {
  resolveRepoPath,
  normalizePath,
  ensureDir,
  safeWriteJson,
  safeWriteText,
} from './fs-utils.js';

import type {
  ActiveSprintState,
  MaturityLevel,
  ReceiptClass,
  ReceiptValidationReport,
  StatusArtifact,
  StatusArtifactGenerateOptions,
  StatusArtifactGenerationResult,
  StatusEvidenceRef,
} from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ARTIFACT_VERSION = '1.0.0' as const;

/**
 * Maturity levels in ascending order per STATUS_RUBRIC.md.
 * Index is used for comparison: higher index = higher maturity.
 */
const MATURITY_ORDER: MaturityLevel[] = [
  'Design',
  'Prototype',
  'Operational',
  'Production-Ready',
  'Elite',
  'Syndicate-Grade',
];

/**
 * Receipt classes that indicate runtime or deployment evidence,
 * which push a sprint from Operational → Production-Ready when present.
 */
const RUNTIME_RECEIPT_CLASSES: ReceiptClass[] = ['runtime', 'db', 'distribution'];

// ---------------------------------------------------------------------------
// Maturity Evaluation
// ---------------------------------------------------------------------------

interface MaturityEvaluation {
  supported: MaturityLevel;
  requested_target: MaturityLevel | null;
  is_request_supported: boolean;
  rationale: string;
}

/**
 * Parse the target maturity level from a maturity delta string.
 * Accepts "X → Y" or just "Y". Returns null if unparseable.
 */
function parseTargetLevel(delta: string): MaturityLevel | null {
  const parts = delta.split('→');
  const raw = (parts[parts.length - 1] ?? '').trim();
  return (MATURITY_ORDER as string[]).includes(raw) ? (raw as MaturityLevel) : null;
}

/**
 * Determine the highest maturity level supported by the current evidence.
 * Rules applied in order (first match wins):
 *
 * 1. Aborted sprint → Prototype
 * 2. Any receipt hash mismatch → Prototype
 * 3. Missing required receipts → Prototype
 * 4. Blocking blockers → Prototype
 * 5. Runtime/db/distribution receipt present → Production-Ready
 * 6. All required receipts + no blocking blockers → Operational
 */
function computeSupportedLevel(
  state: ActiveSprintState,
  validationReport: ReceiptValidationReport | undefined
): { level: MaturityLevel; rationale: string } {
  if (state.status === 'aborted') {
    return {
      level: 'Prototype',
      rationale: 'Sprint aborted — evidence is incomplete',
    };
  }

  if (validationReport) {
    const hasTampered = validationReport.entries.some(e => e.hash_match === false);
    if (hasTampered) {
      return {
        level: 'Prototype',
        rationale: 'Receipt hash mismatch detected — artifact integrity may be compromised',
      };
    }
  }

  if (state.missing_receipts.length > 0) {
    return {
      level: 'Prototype',
      rationale: `Missing required receipt classes: ${state.missing_receipts.join(', ')}`,
    };
  }

  const blockingBlockers = state.blockers.filter(b => b.severity === 'blocking');
  if (blockingBlockers.length > 0) {
    const desc = blockingBlockers.map(b => b.description).join('; ');
    return {
      level: 'Prototype',
      rationale: `Blocking issues unresolved: ${desc}`,
    };
  }

  const foundClasses = new Set(state.found_receipts.map(r => r.receipt_class));
  const hasRuntimeEvidence = RUNTIME_RECEIPT_CLASSES.some(rc => foundClasses.has(rc));
  if (hasRuntimeEvidence) {
    const present = RUNTIME_RECEIPT_CLASSES.filter(rc => foundClasses.has(rc));
    return {
      level: 'Production-Ready',
      rationale: `All required receipts present including runtime/deployment evidence (${present.join(', ')}). No blocking issues.`,
    };
  }

  return {
    level: 'Operational',
    rationale: `All required receipts present (${[...foundClasses].join(', ')}). No blocking issues.`,
  };
}

/**
 * Evaluate the maturity claim: determine what is supported and whether
 * the requested claim (if any) is justified.
 */
function evaluateMaturityClaim(
  state: ActiveSprintState,
  validationReport: ReceiptValidationReport | undefined
): MaturityEvaluation {
  const { level: supported, rationale } = computeSupportedLevel(state, validationReport);

  if (!state.requested_maturity_delta) {
    return {
      supported,
      requested_target: null,
      is_request_supported: true,
      rationale,
    };
  }

  const target = parseTargetLevel(state.requested_maturity_delta);

  if (!target) {
    return {
      supported,
      requested_target: null,
      is_request_supported: false,
      rationale: `${rationale}. Unrecognized maturity level in claim: '${state.requested_maturity_delta}'`,
    };
  }

  // Elite and Syndicate-Grade cannot be auto-verified from sprint state
  if (target === 'Elite' || target === 'Syndicate-Grade') {
    return {
      supported,
      requested_target: target,
      is_request_supported: false,
      rationale:
        `${rationale}. ${target} cannot be auto-verified from sprint state — ` +
        'requires human attestation of observability, governance leverage, and operational quality',
    };
  }

  const supportedIdx = MATURITY_ORDER.indexOf(supported);
  const targetIdx = MATURITY_ORDER.indexOf(target);
  const is_request_supported = supportedIdx >= targetIdx;

  const fullRationale = is_request_supported
    ? rationale
    : `Requested '${target}' is not supported — evidence justifies at most '${supported}'. ${rationale}`;

  return {
    supported,
    requested_target: target,
    is_request_supported,
    rationale: fullRationale,
  };
}

// ---------------------------------------------------------------------------
// Evidence Refs
// ---------------------------------------------------------------------------

function buildEvidenceRefs(
  state: ActiveSprintState,
  validationReport: ReceiptValidationReport | undefined
): StatusEvidenceRef[] {
  return state.found_receipts.map(receipt => {
    const entry = validationReport?.entries.find(
      e => e.receipt.artifact_path === receipt.artifact_path
    );
    const hash_verified = entry?.hash_match ?? null;

    return {
      receipt_class: receipt.receipt_class,
      artifact_path: receipt.artifact_path,
      description: receipt.description,
      captured_at: receipt.captured_at,
      hash_verified,
    };
  });
}

// ---------------------------------------------------------------------------
// Markdown Builder
// ---------------------------------------------------------------------------

function hashIcon(hash_verified: boolean | null): string {
  if (hash_verified === true) return '✓ verified';
  if (hash_verified === false) return '✗ MISMATCH';
  return '— (no hash)';
}

function buildMarkdown(artifact: StatusArtifact): string {
  const lines: string[] = [];

  lines.push(`# Sprint Status Artifact`);
  lines.push('');
  lines.push(`**Sprint**: ${artifact.sprint_id}`);
  lines.push(`**Title**: ${artifact.sprint_title}`);
  lines.push(`**Sprint Status**: ${artifact.sprint_status.toUpperCase()}`);
  if (artifact.subsystem_or_subject) {
    lines.push(`**Subsystem**: ${artifact.subsystem_or_subject}`);
  }
  lines.push(`**Generated**: ${artifact.timestamp_generated}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Maturity Claim
  lines.push('## Maturity Claim');
  lines.push('');
  lines.push('| Field | Value |');
  lines.push('|-------|-------|');
  lines.push(`| Requested | ${artifact.maturity_claim_requested ?? '(none)'}  |`);
  lines.push(`| Supported | **${artifact.maturity_claim_supported}** |`);
  lines.push(
    `| Claim Justified | ${artifact.maturity_claim_request_supported ? '✅ YES' : '❌ NO'} |`
  );
  lines.push('');
  lines.push(`**Rationale**: ${artifact.maturity_claim_rationale}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Evidence References
  lines.push('## Evidence References');
  lines.push('');
  if (artifact.evidence_refs.length === 0) {
    lines.push('*No receipts registered.*');
  } else {
    lines.push('| Class | Artifact | Captured At | Hash |');
    lines.push('|-------|----------|-------------|------|');
    for (const ref of artifact.evidence_refs) {
      const capturedDate = ref.captured_at.slice(0, 19).replace('T', ' ');
      lines.push(
        `| ${ref.receipt_class} | \`${ref.artifact_path}\` | ${capturedDate} | ${hashIcon(ref.hash_verified)} |`
      );
    }
  }
  lines.push('');

  if (artifact.missing_receipts.length > 0) {
    lines.push(`**Missing Receipts**: ${artifact.missing_receipts.join(', ')}`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // Authority Surfaces
  lines.push('## Authority Surfaces');
  lines.push('');
  if (artifact.authority_surfaces.length === 0) {
    lines.push('None (standard sprint — no protected surfaces)');
  } else {
    for (const s of artifact.authority_surfaces) {
      lines.push(`- ${s}`);
    }
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // Blockers
  lines.push('## Blockers');
  lines.push('');
  if (artifact.blockers.length === 0) {
    lines.push('None');
  } else {
    for (const b of artifact.blockers) {
      const prefix = b.severity === 'blocking' ? '⛔' : '⚠️';
      lines.push(`- ${prefix} **[${b.severity}]** ${b.description}`);
    }
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // Next Recommended Sprint
  lines.push('## Next Recommended Sprint');
  lines.push('');
  lines.push(artifact.next_recommended_sprint);
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

/**
 * Generate a governed post-sprint status artifact.
 *
 * Output location: out/status/<SPRINT_ID>/<DATE>/status-artifact.{json,md}
 *
 * Maturity claims are evaluated against STATUS_RUBRIC.md evidence requirements.
 * Claims are NEVER inflated — if evidence is insufficient, the claim is capped.
 */
export function generateStatusArtifact(
  state: ActiveSprintState,
  options?: StatusArtifactGenerateOptions
): StatusArtifactGenerationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const date = options?.dateOverride ?? new Date().toISOString().slice(0, 10);
  const outputRoot = options?.outputRoot ?? resolveRepoPath('out/status');
  const sprintSlug = normalizePath(state.sprint_id);
  const outputDir = path.join(outputRoot, sprintSlug, date);

  const jsonFilename = 'status-artifact.json';
  const mdFilename = 'status-artifact.md';
  const jsonPath = path.join(outputDir, jsonFilename);
  const mdPath = path.join(outputDir, mdFilename);

  // Compute repo-relative paths (always forward slashes)
  const repoRoot = resolveRepoPath('');
  const repoRelativeJsonPath = normalizePath(path.relative(repoRoot, jsonPath));
  const repoRelativeMdPath = normalizePath(path.relative(repoRoot, mdPath));

  // Build evaluation
  const validationReport = options?.validationReport;
  const evaluation = evaluateMaturityClaim(state, validationReport);
  const evidenceRefs = buildEvidenceRefs(state, validationReport);

  const subsystem = options?.contextPack?.subsystem ?? null;

  const artifact: StatusArtifact = {
    artifact_version: ARTIFACT_VERSION,
    sprint_id: state.sprint_id,
    sprint_title: state.title,
    subsystem_or_subject: subsystem,
    authority_surfaces: [...state.authority_surfaces],
    required_receipts: [...state.required_receipts],
    found_receipts: [...state.found_receipts],
    missing_receipts: [...state.missing_receipts],
    evidence_refs: evidenceRefs,
    maturity_claim_requested: state.requested_maturity_delta ?? null,
    maturity_claim_supported: evaluation.supported,
    maturity_claim_request_supported: evaluation.is_request_supported,
    maturity_claim_rationale: evaluation.rationale,
    blockers: [...state.blockers],
    sprint_status: state.status,
    next_recommended_sprint: state.next_action,
    timestamp_generated: new Date().toISOString(),
  };

  // Ensure output directory
  const dirResult = ensureDir(outputDir);
  if (!dirResult.success) {
    errors.push(dirResult.error ?? `Failed to create output directory: ${outputDir}`);
    return {
      success: false,
      artifact: null,
      json_path: null,
      md_path: null,
      repo_relative_json_path: null,
      repo_relative_md_path: null,
      warnings,
      errors,
    };
  }

  // Write JSON
  const jsonResult = safeWriteJson(jsonPath, artifact);
  if (!jsonResult.success) {
    errors.push(jsonResult.error ?? `Failed to write JSON artifact: ${jsonPath}`);
    return {
      success: false,
      artifact: null,
      json_path: null,
      md_path: null,
      repo_relative_json_path: null,
      repo_relative_md_path: null,
      warnings,
      errors,
    };
  }

  // Write Markdown
  const mdResult = safeWriteText(mdPath, buildMarkdown(artifact));
  if (!mdResult.success) {
    warnings.push(mdResult.error ?? `Failed to write markdown artifact: ${mdPath}`);
  }

  return {
    success: true,
    artifact,
    json_path: jsonPath,
    md_path: mdResult.success ? mdPath : null,
    repo_relative_json_path: repoRelativeJsonPath,
    repo_relative_md_path: mdResult.success ? repoRelativeMdPath : null,
    warnings,
    errors,
  };
}
