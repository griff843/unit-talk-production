/**
 * SPOA — Sprint Portfolio Optimization Audit
 * Configuration: output paths, input sources, and conservative defaults.
 *
 * Sprint: SPRINT-SPOA-FOUNDATION-MANUAL-COMMAND
 */

import * as path from 'node:path';

import { resolveRepoPath } from './fs-utils.js';

import type { SprintClassification, RunnerRecommendation } from './portfolio-audit-types.js';

// ---------------------------------------------------------------------------
// Output path config
// ---------------------------------------------------------------------------

export const SPOA_OUTPUT_BASE = 'out/portfolio-audits/SPOA';

export function resolveAuditOutputDir(date: string, override?: string): string {
  if (override) return path.resolve(override);
  return resolveRepoPath(path.join(SPOA_OUTPUT_BASE, date));
}

// ---------------------------------------------------------------------------
// Input source paths (relative to repo root)
// ---------------------------------------------------------------------------

export const SPOA_INPUT_SOURCES: string[] = [
  'docs/status/NEXT_5_SPRINTS.md',
  'docs/status/PHASE_STATUS.md',
  'docs/status/CURRENT_SYSTEM_STATUS.md',
  'docs/status/DRIFT_REPORT.md',
  'docs/status/LIFECYCLE_PROOF_MATRIX.md',
  'docs/status/LIFECYCLE_TRUTH_GAP_MEMO.md',
  'docs/roadmap/INTELLIGENCE_PIPELINE_SPRINT_ORDER.md',
  'docs/roadmap/ARCHITECTURE_MIGRATION_SPRINT_ORDER.md',
];

// ---------------------------------------------------------------------------
// Conservative defaults (fail-closed)
// ---------------------------------------------------------------------------

/** Default classification when truth is incomplete or ambiguous */
export const CONSERVATIVE_CLASSIFICATION: SprintClassification = 'Sequential Only';

/** Default runner when classification is conservative */
export const CONSERVATIVE_RUNNER: RunnerRecommendation = 'Claude Core';

/** Default runner when a sprint is blocked */
export const BLOCKED_RUNNER: RunnerRecommendation = 'Unassigned';

/** Default runner for governance/docs-only sprints */
export const GOVERNANCE_RUNNER: RunnerRecommendation = 'Governance Lane';

// ---------------------------------------------------------------------------
// Classification keyword heuristics
// (used by classifier — not authoritative, just conservative signal)
// ---------------------------------------------------------------------------

/** Keywords in sprint titles that suggest Claude-Core sensitivity */
export const CORE_SENSITIVE_KEYWORDS: string[] = [
  'lifecycle',
  'settlement',
  'grading',
  'scoring',
  'promotion',
  'schema',
  'migration',
  'single-writer',
  'invariant',
  'constitutional',
  'replay',
  'recovery',
  'temporal',
  'auth',
  'security',
  'hardening',
  'certification',
  'e2e',
];

/** Keywords suggesting Governance-Only */
export const GOVERNANCE_KEYWORDS: string[] = [
  'governance',
  'naming',
  'convention',
  'docs',
  'documentation',
  'audit',
  'status',
  'closeout',
  'truth',
  'reconciliation',
  'sync',
  'sprint-close',
  'cos-',
  'claude-os',
  'spoa',
  'skills',
  'agents',
  'blueprint',
];

/** Keywords suggesting Codex-safe (bounded, low-ambiguity UI work) */
export const CODEX_SAFE_KEYWORDS: string[] = [
  'cc-',
  'command-center',
  'dashboard',
  'ui',
  'page',
  'panel',
  'sidebar',
];

/** Keywords that override Codex-safe back to Sequential/Core */
export const CODEX_OVERRIDE_KEYWORDS: string[] = [
  'auth',
  'settlement',
  'lifecycle',
  'schema',
  'migration',
  'grading',
  'scoring',
  'invariant',
  'single-writer',
];
