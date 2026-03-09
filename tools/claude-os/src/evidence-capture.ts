/**
 * Claude OS — Evidence Capture
 *
 * Writes verification evidence to the canonical artifact structure.
 * Uses fs-utils helpers for safe, fail-closed file operations.
 */

import * as path from 'node:path';

import { ensureDir, safeWriteText, safeWriteJson, resolveRepoPath } from './fs-utils.js';

import type {
  ArtifactPlan,
  VerificationStepResult,
  CommandRunResult,
  EvidenceIndex,
  EvidenceIndexEntry,
  VerificationExecutionResult,
} from './types.js';

// ---------------------------------------------------------------------------
// Directory Creation
// ---------------------------------------------------------------------------

/**
 * Create all required evidence directories from an artifact plan.
 */
export function createEvidenceDirectories(artifactPlan: ArtifactPlan): {
  success: boolean;
  created: string[];
  errors: string[];
} {
  const created: string[] = [];
  const errors: string[] = [];

  for (const dir of artifactPlan.requiredDirectories) {
    const absDir = resolveRepoPath(path.join(artifactPlan.canonicalRoot, dir));
    const result = ensureDir(absDir);
    if (result.success) {
      created.push(dir);
    } else {
      errors.push(result.error ?? `Failed to create ${dir}`);
    }
  }

  return {
    success: errors.length === 0,
    created,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Step Evidence Capture
// ---------------------------------------------------------------------------

/**
 * Write evidence for a single verification step to the artifact root.
 */
export function captureStepEvidence(
  step: VerificationStepResult,
  commandResult: CommandRunResult | null,
  artifactPlan: ArtifactPlan
): { success: boolean; writtenTo: string | null; error: string | null } {
  // No output file defined — nothing to write
  if (!step.outputFile) {
    return { success: true, writtenTo: null, error: null };
  }

  const absPath = resolveRepoPath(path.join(artifactPlan.canonicalRoot, step.outputFile));
  const capturedAt = new Date().toISOString();

  let content: string;

  if (commandResult) {
    content = formatEvidenceFile(step, commandResult, capturedAt);
  } else {
    // BLOCKED/SKIPPED — write stub evidence
    content = formatStubEvidence(step, capturedAt);
  }

  const writeResult = safeWriteText(absPath, content);
  if (!writeResult.success) {
    return { success: false, writtenTo: null, error: writeResult.error };
  }

  return { success: true, writtenTo: absPath, error: null };
}

// ---------------------------------------------------------------------------
// Evidence Index
// ---------------------------------------------------------------------------

/**
 * Write the machine-readable evidence index JSON file at the artifact root.
 */
export function writeEvidenceIndex(
  result: VerificationExecutionResult,
  artifactPlan: ArtifactPlan
): { success: boolean; error: string | null } {
  const index: EvidenceIndex = {
    sprintId: result.sprintId,
    generatedAt: result.generatedAt,
    evidenceRoot: artifactPlan.canonicalRoot,
    entries: result.steps.map(step => {
      const entry: EvidenceIndexEntry = {
        recipeId: step.recipeId,
        status: step.status,
        outputFile: step.outputFile,
        capturedAt: result.generatedAt,
      };

      // Add browser evidence detail if present
      if (step.browserArtifacts && step.browserArtifacts.length > 0) {
        entry.browserEvidence = {
          browserArtifacts: step.browserArtifacts,
          playwrightAvailable: true,
        };
      }

      return entry;
    }),
    runtimeProofGate: result.runtimeProofGate,
    overallStatus: result.overallStatus,
  };

  const absPath = resolveRepoPath(
    path.join(artifactPlan.canonicalRoot, 'verification-evidence-index.json')
  );

  return safeWriteJson(absPath, index);
}

// ---------------------------------------------------------------------------
// Formatting Helpers
// ---------------------------------------------------------------------------

function formatEvidenceFile(
  step: VerificationStepResult,
  commandResult: CommandRunResult,
  capturedAt: string
): string {
  const sep = '='.repeat(80);
  const lines = [
    sep,
    'CLAUDE OS VERIFICATION EVIDENCE',
    sep,
    `Recipe:     ${step.recipeId}`,
    `Command:    ${commandResult.command}`,
    `Status:     ${step.status}`,
    `Exit Code:  ${commandResult.exitCode}`,
    `Duration:   ${commandResult.durationMs}ms`,
    `Captured:   ${capturedAt}`,
    sep,
    '',
    '--- STDOUT ---',
    commandResult.stdout || '(empty)',
    '',
    '--- STDERR ---',
    commandResult.stderr || '(empty)',
    '',
  ];

  // Browser artifact summary (Phase C.2)
  if (step.browserArtifacts && step.browserArtifacts.length > 0) {
    lines.push('--- BROWSER ARTIFACTS ---');
    lines.push(`Count: ${step.browserArtifacts.length}`);
    for (const artifact of step.browserArtifacts) {
      lines.push(`  [${artifact.type}] ${artifact.path} (${artifact.sizeBytes} bytes)`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function formatStubEvidence(step: VerificationStepResult, capturedAt: string): string {
  const sep = '='.repeat(80);
  const lines = [
    sep,
    'CLAUDE OS VERIFICATION EVIDENCE',
    sep,
    `Recipe:     ${step.recipeId}`,
    `Command:    (not executed)`,
    `Status:     ${step.status}`,
    `Reason:     ${step.reason}`,
    `Captured:   ${capturedAt}`,
    sep,
    '',
    `This recipe was ${step.status} and no command was executed.`,
    `Reason: ${step.reason}`,
    '',
  ];
  return lines.join('\n');
}
