/**
 * Claude OS — Artifact Planner
 *
 * Generates structured artifact path plans based on the artifact contract.
 * Does NOT write proof content — only plans the expected structure.
 */

import * as path from 'node:path';

import type {
  ArtifactPlan,
  ArtifactFileExpectation,
  SprintType,
  ProofRequirement,
} from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ARTIFACT_BASE = 'out/sprints';

/** Directories required in every proof bundle */
const STANDARD_DIRECTORIES = ['proofs', 'diffs', 'notes'] as const;

/** Files always required regardless of sprint type */
const ALWAYS_REQUIRED_FILES: ArtifactFileExpectation[] = [
  {
    relativePath: 'proofs/proof_git_status.txt',
    category: 'git_status',
    description: 'Git status output at sprint completion',
    required: true,
  },
  {
    relativePath: 'proofs/proof_typecheck.txt',
    category: 'typecheck',
    description: 'npm run type-check output',
    required: true,
  },
  {
    relativePath: 'diffs/sprint_changes.diff',
    category: 'diff',
    description: 'Git diff of all sprint changes',
    required: true,
  },
  {
    relativePath: 'SPRINT_CLOSEOUT_REPORT.md',
    category: 'closeout',
    description: 'Sprint summary and verdict',
    required: true,
  },
];

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

/**
 * Generate an artifact plan for a sprint.
 *
 * @param sprintId - Sprint identifier (e.g., SPRINT-SETTLEMENT-045)
 * @param date - Date string (YYYY-MM-DD) or 'today' for current date
 * @param sprintType - Type of sprint
 * @param proofRequirements - Resolved proof requirements from verification-resolver
 */
export function planArtifacts(
  sprintId: string,
  date: string,
  sprintType: SprintType,
  proofRequirements: ProofRequirement[] = []
): ArtifactPlan {
  const resolvedDate = date === 'today' ? new Date().toISOString().split('T')[0] : date;

  const canonicalRoot = path.posix.join(ARTIFACT_BASE, sprintId, resolvedDate);

  // Build required directories
  const requiredDirectories = STANDARD_DIRECTORIES.map(dir => path.posix.join(canonicalRoot, dir));

  // Build required files: always-required + sprint-type-specific from proof recipes
  const requiredFiles: ArtifactFileExpectation[] = [...ALWAYS_REQUIRED_FILES];

  // Add proof requirements from resolved proof recipes
  for (const req of proofRequirements) {
    // Avoid duplicating files already in ALWAYS_REQUIRED
    const alreadyExists = requiredFiles.some(f => f.category === req.category);
    if (!alreadyExists) {
      requiredFiles.push({
        relativePath: req.artifact,
        category: req.category,
        description: req.description,
        required: req.required,
      });
    }
  }

  // Notes
  const notes: string[] = [];

  if (sprintType === 'runtime' || sprintType === 'e2e_lifecycle') {
    notes.push(
      'Runtime proof files (proof_runtime_*.txt) are mandatory for this sprint type. ' +
        'Build-time evidence alone is insufficient per Build/Runtime Separation Law.'
    );
  }

  if (sprintType === 'schema') {
    notes.push(
      'Schema migrations must include rollback documentation in the closeout report. ' +
        'Schema guard verification is required.'
    );
  }

  if (sprintType === 'e2e_lifecycle') {
    notes.push(
      'E2E lifecycle sprints have maximum proof requirements. ' +
        'Every stage of the lifecycle (submit → grade → promote → post → settle) must be evidenced.'
    );
  }

  if (sprintType === 'ui') {
    requiredDirectories.push(path.posix.join(canonicalRoot, 'proofs', 'screenshots'));
    notes.push(
      'Browser screenshot directory created for UI sprint. ' +
        'Screenshots may be captured automatically by Playwright or manually.'
    );
  }

  return {
    sprintId,
    date: resolvedDate,
    canonicalRoot,
    requiredDirectories,
    requiredFiles,
    notes,
  };
}

/**
 * Get the canonical artifact root path for a sprint.
 */
export function getArtifactRoot(sprintId: string, date: string): string {
  const resolvedDate = date === 'today' ? new Date().toISOString().split('T')[0] : date;
  return path.posix.join(ARTIFACT_BASE, sprintId, resolvedDate);
}
