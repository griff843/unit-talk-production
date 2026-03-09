/**
 * Claude OS — Proof Index Renderer
 *
 * Pure string generation for PROOF_INDEX.md.
 * Follows the 7-section structure from governance/claude-os/templates/proof-bundle-template.md.
 * No I/O — all rendering from structured data.
 */

import {
  GIT_EVIDENCE_PATHS,
  GIT_EVIDENCE_DESCRIPTIONS,
  GIT_EVIDENCE_COMMAND_MAP,
} from './git-evidence.js';

import type {
  ArtifactPresenceStatus,
  SprintType,
  VerificationTier,
  BundleManifest,
  BundleManifestEntry,
  BundleVerdict,
  BundleCompletenessCheck,
  SprintExecutionPlan,
  VerificationExecutionResult,
  RuntimeProofGateResult,
} from './types.js';

// ---------------------------------------------------------------------------
// Data Structure
// ---------------------------------------------------------------------------

/** Structured data for rendering PROOF_INDEX.md */
export interface ProofIndexData {
  sprintId: string;
  date: string;
  sprintType: SprintType;
  verificationTier: VerificationTier;
  bundlePath: string;
  summary: string;

  verificationEntries: Array<{
    label: string;
    recipeId: string;
    result: string;
    evidenceFile: string;
  }>;

  runtimeEvidence: {
    required: boolean;
    entries: Array<{
      evidence: string;
      method: string;
      demonstrates: string;
      file: string;
    }>;
  };

  gitEvidence: {
    entries: Array<{
      description: string;
      command: string;
      file: string;
      status: ArtifactPresenceStatus;
    }>;
  };

  artifactEntries: BundleManifestEntry[];
  completeness: BundleCompletenessCheck;
  verdict: BundleVerdict;
  runtimeProofGate: RuntimeProofGateResult;
}

// ---------------------------------------------------------------------------
// Recipe ID to human-readable label
// ---------------------------------------------------------------------------

const RECIPE_LABELS: Record<string, string> = {
  typecheck: 'TypeScript compilation',
  lint: 'Lint',
  unit_tests: 'Unit tests',
  integration_tests: 'Integration tests',
  build: 'Build',
  lifecycle_gate: 'Lifecycle gate',
  runtime_smoke: 'Runtime smoke',
  discord_canary: 'Discord canary',
  schema_guard: 'Schema guard',
  drift_audit: 'Drift audit',
  ui_visual_check: 'UI visual check',
  browser_smoke: 'Browser smoke',
};

// ---------------------------------------------------------------------------
// Build Data
// ---------------------------------------------------------------------------

/**
 * Build ProofIndexData from plan, verification result, manifest, and verdict.
 */
export function buildProofIndexData(
  plan: SprintExecutionPlan,
  verificationResult: VerificationExecutionResult,
  manifest: BundleManifest,
  verdict: BundleVerdict
): ProofIndexData {
  // Build verification entries from steps
  const verificationEntries = verificationResult.steps.map(step => ({
    label: RECIPE_LABELS[step.recipeId] ?? step.recipeId,
    recipeId: step.recipeId,
    result: step.status,
    evidenceFile: step.outputFile ?? 'N/A',
  }));

  // Build runtime evidence entries
  const runtimeRequired = plan.proofRequirements.some(p => p.category === 'runtime_evidence');
  const runtimeSteps = verificationResult.steps.filter(s =>
    ['runtime_smoke', 'discord_canary', 'browser_smoke'].includes(s.recipeId)
  );
  const runtimeEntries = runtimeSteps
    .filter(s => s.status === 'PASS')
    .map(s => ({
      evidence: RECIPE_LABELS[s.recipeId] ?? s.recipeId,
      method: `Automated (${s.recipeId})`,
      demonstrates: `${RECIPE_LABELS[s.recipeId] ?? s.recipeId} verification passed`,
      file: s.outputFile ?? 'N/A',
    }));

  // Build git evidence entries from manifest artifacts
  const gitEvidenceEntries = manifest.artifacts
    .filter(a => GIT_EVIDENCE_PATHS.includes(a.relativePath))
    .map(a => ({
      description: GIT_EVIDENCE_DESCRIPTIONS[a.relativePath] ?? a.description,
      command: GIT_EVIDENCE_COMMAND_MAP[a.relativePath] ?? 'unknown',
      file: a.relativePath,
      status: a.status,
    }));

  return {
    sprintId: plan.request.sprintId,
    date: manifest.date,
    sprintType: plan.request.sprintType,
    verificationTier: manifest.verificationTier,
    bundlePath: manifest.bundlePath,
    summary: plan.request.summary,
    verificationEntries,
    runtimeEvidence: {
      required: runtimeRequired,
      entries: runtimeEntries,
    },
    gitEvidence: {
      entries: gitEvidenceEntries,
    },
    artifactEntries: manifest.artifacts,
    completeness: manifest.completeness,
    verdict,
    runtimeProofGate: manifest.runtimeProofGate,
  };
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

/**
 * Render PROOF_INDEX.md from structured data.
 */
export function renderProofIndex(data: ProofIndexData): string {
  const sections: string[] = [];

  // Section 0: Header
  sections.push(renderHeader(data));

  // Section 1: What Changed
  sections.push(renderWhatChanged(data));

  // Git Evidence (between What Changed and Verification Summary)
  sections.push(renderGitEvidence(data));

  // Section 2: Verification Summary
  sections.push(renderVerificationSummary(data));

  // Section 3: Runtime Evidence Summary
  sections.push(renderRuntimeEvidence(data));

  // Section 4: Artifact Manifest
  sections.push(renderArtifactManifest(data));

  // Section 5: Verdict Summary
  sections.push(renderVerdictSummary(data));

  // Section 6: Known Limitations
  sections.push(renderLimitations(data));

  // Section 7: Ratification Recommendation
  sections.push(renderRatification(data));

  return sections.join('\n---\n\n');
}

// ---------------------------------------------------------------------------
// Section Renderers
// ---------------------------------------------------------------------------

function renderHeader(data: ProofIndexData): string {
  return [
    `# Proof Bundle Index: ${data.sprintId}`,
    '',
    `**Sprint**: \`${data.sprintId}\``,
    `**Date**: ${data.date}`,
    `**Sprint Type**: ${data.sprintType}`,
    `**Verification Tier**: ${data.verificationTier}`,
    `**Bundle Path**: \`${data.bundlePath}\``,
    '',
  ].join('\n');
}

function renderWhatChanged(data: ProofIndexData): string {
  return [
    '## 1. What Changed',
    '',
    '### Summary',
    '',
    data.summary,
    '',
    '### Files Modified',
    '',
    'See `diffs/sprint_changes.diff` for detailed file-level changes.',
    '',
  ].join('\n');
}

function renderGitEvidence(data: ProofIndexData): string {
  const lines = ['## Git Evidence', ''];

  if (data.gitEvidence.entries.length === 0) {
    lines.push('No git evidence captured for this bundle.', '');
    return lines.join('\n');
  }

  lines.push('| Evidence | Command | File | Status |', '| --- | --- | --- | --- |');

  for (const entry of data.gitEvidence.entries) {
    lines.push(
      `| ${entry.description} | \`${entry.command}\` | \`${entry.file}\` | ${entry.status.toUpperCase()} |`
    );
  }

  lines.push('');
  return lines.join('\n');
}

function renderVerificationSummary(data: ProofIndexData): string {
  const lines = [
    '## 2. Verification Summary',
    '',
    '| Verification | Recipe | Result | Evidence File |',
    '| --- | --- | --- | --- |',
  ];

  for (const entry of data.verificationEntries) {
    lines.push(
      `| ${entry.label} | \`${entry.recipeId}\` | ${entry.result} | \`${entry.evidenceFile}\` |`
    );
  }

  lines.push('');
  return lines.join('\n');
}

function renderRuntimeEvidence(data: ProofIndexData): string {
  const lines = ['## 3. Runtime Evidence Summary', ''];

  if (!data.runtimeEvidence.required) {
    lines.push('N/A — build-time sprint.', '');
    return lines.join('\n');
  }

  if (data.runtimeEvidence.entries.length === 0) {
    lines.push('Runtime evidence required but none collected.', '');
    return lines.join('\n');
  }

  lines.push(
    '| Evidence | Collection Method | What It Demonstrates | File |',
    '| --- | --- | --- | --- |'
  );

  for (const entry of data.runtimeEvidence.entries) {
    lines.push(
      `| ${entry.evidence} | ${entry.method} | ${entry.demonstrates} | \`${entry.file}\` |`
    );
  }

  lines.push('');
  return lines.join('\n');
}

function renderArtifactManifest(data: ProofIndexData): string {
  const lines = [
    '## 4. Artifact Manifest',
    '',
    '| Artifact | Status | Path |',
    '| --- | --- | --- |',
  ];

  for (const entry of data.artifactEntries) {
    const status = entry.status.toUpperCase();
    lines.push(`| \`${entry.relativePath}\` | ${status} | \`${entry.relativePath}\` |`);
  }

  lines.push('');
  lines.push('### Completeness Check');
  lines.push('');
  lines.push(
    `- Required: ${data.completeness.presentRequired}/${data.completeness.totalRequired} present`
  );
  lines.push(
    `- Optional: ${data.completeness.presentOptional}/${data.completeness.totalOptional} present`
  );

  if (data.completeness.missingRequired.length > 0) {
    lines.push(`- Missing required: ${data.completeness.missingRequired.join(', ')}`);
  }

  lines.push('');
  return lines.join('\n');
}

function renderVerdictSummary(data: ProofIndexData): string {
  const statusDisplay = data.verdict.status.replace(/_/g, ' ');
  const lines = [
    '## 5. Verdict Summary',
    '',
    `**Verdict**: ${statusDisplay}`,
    '',
    `**Rationale**: ${data.verdict.rationale}`,
    '',
  ];

  if (data.verdict.limitations.length > 0) {
    lines.push('### Limitations');
    lines.push('');
    lines.push('| Limitation | Severity | Impact |');
    lines.push('| --- | --- | --- |');
    for (const lim of data.verdict.limitations) {
      lines.push(`| ${lim.description} | ${lim.severity} | ${lim.impact} |`);
    }
    lines.push('');
  }

  if (data.verdict.blockers.length > 0) {
    lines.push('### Blockers');
    lines.push('');
    lines.push('| Blocker | Type | Resolution |');
    lines.push('| --- | --- | --- |');
    for (const blk of data.verdict.blockers) {
      lines.push(`| ${blk.description} | ${blk.type} | ${blk.resolution} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function renderLimitations(data: ProofIndexData): string {
  const lines = ['## 6. Known Limitations', ''];

  if (data.verdict.limitations.length === 0) {
    lines.push('None — all acceptance criteria fully met with strong evidence.', '');
    return lines.join('\n');
  }

  for (const lim of data.verdict.limitations) {
    lines.push(`- ${lim.description}`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderRatification(data: ProofIndexData): string {
  let recommendation: string;
  switch (data.verdict.status) {
    case 'PASS':
      recommendation = 'RATIFY';
      break;
    case 'PASS_WITH_LIMITATIONS':
      recommendation = 'RATIFY WITH CONDITIONS';
      break;
    default:
      recommendation = 'DO NOT RATIFY';
  }

  const lines = [
    '## 7. Ratification Recommendation',
    '',
    `**Recommendation**: ${recommendation}`,
    '',
  ];

  if (data.verdict.recommendations.length > 0) {
    for (const rec of data.verdict.recommendations) {
      lines.push(`- ${rec}`);
    }
    lines.push('');
  }

  lines.push(`**Confidence**: ${data.verdict.confidence}`);
  lines.push(`**Confidence rationale**: ${data.verdict.confidenceRationale}`);
  lines.push('');

  return lines.join('\n');
}
