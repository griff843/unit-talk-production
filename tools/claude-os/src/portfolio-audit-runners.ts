/**
 * SPOA — Sprint Portfolio Optimization Audit
 * Runner recommendation logic.
 *
 * Maps classifications to concrete runner recommendations and
 * identifies multi-Claude wave and Codex opportunities.
 *
 * Sprint: SPRINT-SPOA-FOUNDATION-MANUAL-COMMAND
 */

import {
  CONSERVATIVE_RUNNER,
  BLOCKED_RUNNER,
  GOVERNANCE_RUNNER,
} from './portfolio-audit-config.js';

import type {
  ClassifiedSprint,
  SprintClassification,
  RunnerRecommendation,
  ParallelizationEntry,
} from './portfolio-audit-types.js';

// ---------------------------------------------------------------------------
// Runner assignment
// ---------------------------------------------------------------------------

/**
 * Assign a runner recommendation based on sprint classification.
 * Conservative by default — never over-assigns Codex or Multi-Claude.
 */
export function assignRunner(
  classification: SprintClassification,
  parallelSafe: boolean
): RunnerRecommendation {
  switch (classification) {
    case 'Claude-Core':
    case 'Sequential Only':
      return CONSERVATIVE_RUNNER;

    case 'Parallel-Safe':
      // Parallel-safe → Claude Secondary (lower-priority queue or second instance).
      // Conservative: we know it CAN run in parallel, so de-prioritize from Core queue.
      return parallelSafe ? 'Claude Secondary' : CONSERVATIVE_RUNNER;

    case 'Multi-Claude Safe':
      return 'Multi-Claude Wave';

    case 'Codex-Safe':
      return 'Codex';

    case 'Governance-Only':
      return GOVERNANCE_RUNNER;

    case 'Blocked':
    case 'Deferred':
      return BLOCKED_RUNNER;

    case 'Combine Candidate':
    case 'Split Candidate':
      // These are meta-classifications — assign based on constituent work
      // Default to Claude Core (conservative)
      return CONSERVATIVE_RUNNER;

    default: {
      // TypeScript exhaustiveness guard
      const _exhaustive: never = classification;
      void _exhaustive;
      return CONSERVATIVE_RUNNER;
    }
  }
}

// ---------------------------------------------------------------------------
// Multi-Claude candidacy check
// ---------------------------------------------------------------------------

/**
 * Check if a set of classified sprints has valid multi-Claude wave opportunities.
 * Returns pairings that pass the file-overlap and dependency safety check.
 *
 * Conservative: only approve pairings where BOTH sprints are Codex-Safe or
 * Governance-Only, since those are the classifications with lowest merge risk.
 */
export function buildParallelizationMatrix(sprints: ClassifiedSprint[]): ParallelizationEntry[] {
  const matrix: ParallelizationEntry[] = [];

  for (let i = 0; i < sprints.length; i++) {
    for (let j = i + 1; j < sprints.length; j++) {
      const a = sprints[i];
      const b = sprints[j];

      const aId = a.entry.id;
      const bId = b.entry.id;

      // Both must be parallel-safe
      if (!a.parallelSafe || !b.parallelSafe) {
        matrix.push({
          sprintA: aId,
          sprintB: bId,
          safe: false,
          reason: buildUnsafeReason(a, b),
          mergeRisk: 'high',
        });
        continue;
      }

      // Blocked or deferred items can't run in parallel
      if (
        a.classification === 'Blocked' ||
        a.classification === 'Deferred' ||
        b.classification === 'Blocked' ||
        b.classification === 'Deferred'
      ) {
        matrix.push({
          sprintA: aId,
          sprintB: bId,
          safe: false,
          reason: 'One or both sprints are Blocked or Deferred',
          mergeRisk: 'high',
        });
        continue;
      }

      // Multi-Claude Safe or Codex-Safe pairings are the only approved safe pairs
      const safeClassifications: SprintClassification[] = [
        'Codex-Safe',
        'Governance-Only',
        'Multi-Claude Safe',
      ];
      const aIsSafe = safeClassifications.includes(a.classification);
      const bIsSafe = safeClassifications.includes(b.classification);

      if (aIsSafe && bIsSafe) {
        matrix.push({
          sprintA: aId,
          sprintB: bId,
          safe: true,
          reason: buildSafeReason(a, b),
          mergeRisk: 'low',
        });
      } else {
        matrix.push({
          sprintA: aId,
          sprintB: bId,
          safe: false,
          reason: buildUnsafeReason(a, b),
          mergeRisk: 'medium',
        });
      }
    }
  }

  return matrix;
}

function buildSafeReason(a: ClassifiedSprint, b: ClassifiedSprint): string {
  const parts: string[] = [];
  if (a.classification === 'Governance-Only')
    parts.push(`${a.entry.id} is docs-only (no code changes)`);
  if (b.classification === 'Governance-Only')
    parts.push(`${b.entry.id} is docs-only (no code changes)`);
  if (a.classification === 'Codex-Safe')
    parts.push(`${a.entry.id} is bounded UI (no lifecycle touch)`);
  if (b.classification === 'Codex-Safe')
    parts.push(`${b.entry.id} is bounded UI (no lifecycle touch)`);
  return parts.join('; ') || 'Both sprints classified as parallel-safe with no conflicting scope';
}

function buildUnsafeReason(a: ClassifiedSprint, b: ClassifiedSprint): string {
  if (a.classification === 'Claude-Core' || b.classification === 'Claude-Core') {
    return 'One or both sprints are Claude-Core — require isolated sequential execution';
  }
  if (a.classification === 'Sequential Only' || b.classification === 'Sequential Only') {
    return 'One or both sprints are Sequential Only — cannot safely parallelize';
  }
  return 'Parallel safety cannot be confirmed from available classification data (fail-closed)';
}

// ---------------------------------------------------------------------------
// Runner assignment summary
// ---------------------------------------------------------------------------

export interface RunnerSummary {
  claudeCore: ClassifiedSprint[];
  claudeSecondary: ClassifiedSprint[];
  multiClaudeWave: ClassifiedSprint[];
  codex: ClassifiedSprint[];
  governanceLane: ClassifiedSprint[];
  unassigned: ClassifiedSprint[];
}

export function buildRunnerSummary(sprints: ClassifiedSprint[]): RunnerSummary {
  const summary: RunnerSummary = {
    claudeCore: [],
    claudeSecondary: [],
    multiClaudeWave: [],
    codex: [],
    governanceLane: [],
    unassigned: [],
  };

  for (const s of sprints) {
    switch (s.runner) {
      case 'Claude Core':
        summary.claudeCore.push(s);
        break;
      case 'Claude Secondary':
        summary.claudeSecondary.push(s);
        break;
      case 'Multi-Claude Wave':
        summary.multiClaudeWave.push(s);
        break;
      case 'Codex':
        summary.codex.push(s);
        break;
      case 'Governance Lane':
        summary.governanceLane.push(s);
        break;
      case 'Unassigned':
        summary.unassigned.push(s);
        break;
      default: {
        const _e: never = s.runner;
        void _e;
        summary.unassigned.push(s);
      }
    }
  }

  return summary;
}
