/**
 * Claude OS — Sprint Lifecycle Checker
 *
 * Sprint: SPRINT-CLAUDE-OS-LIFECYCLE-AUTOMATION-HARDENING
 *
 * Provides a single-screen readout of sprint lifecycle completion status.
 * Checks all post-bundle gates without mutating any shared state.
 *
 * Automation boundary:
 *   SAFE (runs automatically): read-only file checks, git ls-remote, grep
 *   REQUIRES HUMAN: commit, push, PR, merge, tag mint, Linear sync, status sync
 *
 * Usage (CLI):
 *   npx tsx src/cli.ts lifecycle-status --sprint SPRINT-044-...
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { runCommand } from './command-runner.js';
import { resolveRepoPath, safeReadJson } from './fs-utils.js';

import type { CommandRunner } from './types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LifecycleDimensionStatus = 'PASS' | 'FAIL' | 'PENDING' | 'UNKNOWN';
export type LifecycleOverall = 'COMPLETE' | 'IN_PROGRESS' | 'ACTION_REQUIRED' | 'UNKNOWN';

export interface LifecycleDimension {
  /** Dimension identifier */
  id: string;
  /** Human-readable label */
  label: string;
  /** Computed status */
  status: LifecycleDimensionStatus;
  /** Detail message explaining the status */
  detail: string;
  /** Exact command/action for operator if status is not PASS */
  nextStep?: string;
  /** Whether the next step requires human action (cannot be automated) */
  requiresHuman: boolean;
}

export interface NextStep {
  /** Priority ordering (1 = highest) */
  priority: number;
  /** Human-readable description of the action */
  action: string;
  /** Exact shell command (if applicable) */
  command?: string;
  /** Whether a human must approve this action */
  requiresHuman: boolean;
}

export interface LifecycleCheckResult {
  sprintId: string;
  checkedAt: string;
  overall: LifecycleOverall;
  checks: {
    proof_artifacts: LifecycleDimension;
    bundle_verdict: LifecycleDimension;
    working_tree: LifecycleDimension;
    tag_on_remote: LifecycleDimension;
    status_sync: LifecycleDimension;
  };
  /** Ordered list of next steps for the operator */
  nextSteps: NextStep[];
}

export interface LifecycleCheckerOptions {
  /** Override for the sprint artifact date (default: today) */
  dateOverride?: string;
  /** Custom command runner for testing */
  commandRunner?: CommandRunner;
  /** Skip network check for tag (useful in offline/test environments) */
  skipTagCheck?: boolean;
}

// ---------------------------------------------------------------------------
// Dimension: Proof Artifacts
// ---------------------------------------------------------------------------

const REQUIRED_PROOF_FILES = [
  'proofs/proof_git_status.txt',
  'proofs/proof_typecheck.txt',
  'SPRINT_CLOSEOUT_REPORT.md',
] as const;

function checkProofArtifacts(artifactRoot: string): LifecycleDimension {
  const missing: string[] = [];
  const empty: string[] = [];

  for (const rel of REQUIRED_PROOF_FILES) {
    const absPath = path.join(artifactRoot, rel);
    try {
      const stat = fs.statSync(absPath);
      if (stat.size === 0) {
        empty.push(rel);
      }
    } catch {
      missing.push(rel);
    }
  }

  if (missing.length > 0 || empty.length > 0) {
    const parts: string[] = [];
    if (missing.length > 0) parts.push(`Missing: ${missing.join(', ')}`);
    if (empty.length > 0) parts.push(`Empty: ${empty.join(', ')}`);
    return {
      id: 'proof_artifacts',
      label: 'Proof Artifacts',
      status: 'FAIL',
      detail: parts.join(' | '),
      nextStep: `Create missing proof files in: ${artifactRoot}/proofs/`,
      requiresHuman: true,
    };
  }

  return {
    id: 'proof_artifacts',
    label: 'Proof Artifacts',
    status: 'PASS',
    detail: `All ${REQUIRED_PROOF_FILES.length} required proof files present and non-empty`,
    requiresHuman: false,
  };
}

// ---------------------------------------------------------------------------
// Dimension: Bundle Verdict
// ---------------------------------------------------------------------------

function checkBundleVerdict(artifactRoot: string): LifecycleDimension {
  // Try to load verdict.json from the artifact root
  const verdictPath = path.join(artifactRoot, 'verdict.json');
  const result = safeReadJson<{ status?: string; rationale?: string }>(verdictPath);

  if (!result.success || !result.content) {
    return {
      id: 'bundle_verdict',
      label: 'Bundle Verdict',
      status: 'UNKNOWN',
      detail: 'verdict.json not found — run supervised-run or bundle command first',
      nextStep: `npx tsx src/cli.ts bundle --sprint <SPRINT> --type <type> --summary "<text>"`,
      requiresHuman: false,
    };
  }

  const { status, rationale } = result.content;

  if (status === 'PASS' || status === 'PASS_WITH_LIMITATIONS') {
    return {
      id: 'bundle_verdict',
      label: 'Bundle Verdict',
      status: 'PASS',
      detail: `${status}: ${rationale ?? '(no rationale)'}`,
      requiresHuman: false,
    };
  }

  return {
    id: 'bundle_verdict',
    label: 'Bundle Verdict',
    status: 'FAIL',
    detail: `${status ?? 'UNKNOWN'}: ${rationale ?? '(no rationale)'}`,
    nextStep: 'Fix failing verification steps and re-run bundle',
    requiresHuman: true,
  };
}

// ---------------------------------------------------------------------------
// Dimension: Working Tree
// ---------------------------------------------------------------------------

function checkWorkingTree(runner: CommandRunner): LifecycleDimension {
  try {
    const result = runner('git status --porcelain', { timeoutMs: 10_000 });

    if (result.exitCode !== 0) {
      return {
        id: 'working_tree',
        label: 'Working Tree',
        status: 'UNKNOWN',
        detail: `git status failed (exit ${result.exitCode}): ${result.stderr}`,
        requiresHuman: false,
      };
    }

    const output = result.stdout.trim();
    if (output === '') {
      return {
        id: 'working_tree',
        label: 'Working Tree',
        status: 'PASS',
        detail: 'Clean — no uncommitted changes',
        requiresHuman: false,
      };
    }

    const lineCount = output.split('\n').length;
    return {
      id: 'working_tree',
      label: 'Working Tree',
      status: 'FAIL',
      detail: `Dirty — ${lineCount} uncommitted change(s)`,
      nextStep: 'Commit or stash changes before proceeding',
      requiresHuman: true,
    };
  } catch {
    return {
      id: 'working_tree',
      label: 'Working Tree',
      status: 'UNKNOWN',
      detail: 'Could not check git status',
      requiresHuman: false,
    };
  }
}

// ---------------------------------------------------------------------------
// Dimension: Tag on Remote
// ---------------------------------------------------------------------------

function checkTagOnRemote(sprintId: string, runner: CommandRunner): LifecycleDimension {
  try {
    const result = runner(`git ls-remote origin refs/tags/${sprintId}`, { timeoutMs: 15_000 });

    if (result.exitCode !== 0) {
      return {
        id: 'tag_on_remote',
        label: 'Tag on Remote',
        status: 'UNKNOWN',
        detail: `git ls-remote failed (exit ${result.exitCode}): ${result.stderr}`,
        requiresHuman: false,
      };
    }

    const output = result.stdout.trim();
    if (output !== '') {
      const sha = output.split('\t')[0] ?? '?';
      return {
        id: 'tag_on_remote',
        label: 'Tag on Remote',
        status: 'PASS',
        detail: `MINTED → ${sha.slice(0, 12)}`,
        requiresHuman: false,
      };
    }

    // Tag not found — check if governance closeout exists
    const closeoutPath = resolveRepoPath(`governance/closeouts/${sprintId}.md`);
    let closeoutExists = false;
    try {
      fs.statSync(closeoutPath);
      closeoutExists = true;
    } catch {
      // file missing
    }

    if (!closeoutExists) {
      return {
        id: 'tag_on_remote',
        label: 'Tag on Remote',
        status: 'PENDING',
        detail: 'Not minted — governance closeout file missing',
        nextStep: `Create governance/closeouts/${sprintId}.md then push to main`,
        requiresHuman: true,
      };
    }

    return {
      id: 'tag_on_remote',
      label: 'Tag on Remote',
      status: 'PENDING',
      detail: 'Closeout file exists but tag not yet minted — CI may still be running',
      nextStep: `gh workflow run mint-governed-tag.yml --ref main --field force_check=true`,
      requiresHuman: true,
    };
  } catch {
    return {
      id: 'tag_on_remote',
      label: 'Tag on Remote',
      status: 'UNKNOWN',
      detail: 'Could not check remote tags (network or git error)',
      requiresHuman: false,
    };
  }
}

// ---------------------------------------------------------------------------
// Dimension: Status Sync
// ---------------------------------------------------------------------------

function checkStatusSync(sprintId: string): LifecycleDimension {
  const statusDocPath = resolveRepoPath('docs/status/CURRENT_SYSTEM_STATUS.md');

  try {
    const content = fs.readFileSync(statusDocPath, 'utf-8');
    const lines = content.split('\n').slice(0, 10); // Check top 10 lines for Last Updated

    for (const line of lines) {
      if (line.includes('Last Updated') && line.includes(sprintId)) {
        return {
          id: 'status_sync',
          label: 'Status Sync',
          status: 'PASS',
          detail: `CURRENT_SYSTEM_STATUS.md updated for ${sprintId}`,
          requiresHuman: false,
        };
      }
    }

    // Find the last updated line to show current state
    const lastUpdatedLine = lines.find(l => l.includes('Last Updated')) ?? '';

    return {
      id: 'status_sync',
      label: 'Status Sync',
      status: 'PENDING',
      detail: `Status docs not yet synced for ${sprintId}. Current: ${lastUpdatedLine.trim()}`,
      nextStep: `/status-sync ${sprintId}`,
      requiresHuman: true,
    };
  } catch {
    return {
      id: 'status_sync',
      label: 'Status Sync',
      status: 'UNKNOWN',
      detail: 'Could not read CURRENT_SYSTEM_STATUS.md',
      requiresHuman: false,
    };
  }
}

// ---------------------------------------------------------------------------
// Overall Status Computation
// ---------------------------------------------------------------------------

function computeOverall(checks: LifecycleCheckResult['checks']): LifecycleOverall {
  const { proof_artifacts, bundle_verdict, working_tree, tag_on_remote, status_sync } = checks;

  // Blocking failures
  if (proof_artifacts.status === 'FAIL' || bundle_verdict.status === 'FAIL') {
    return 'ACTION_REQUIRED';
  }

  if (working_tree.status === 'FAIL') {
    return 'ACTION_REQUIRED';
  }

  // All unknown → can't assess
  if (
    bundle_verdict.status === 'UNKNOWN' &&
    tag_on_remote.status === 'UNKNOWN' &&
    status_sync.status === 'UNKNOWN'
  ) {
    return 'UNKNOWN';
  }

  // Complete: tag minted + status synced
  if (tag_on_remote.status === 'PASS' && status_sync.status === 'PASS') {
    return 'COMPLETE';
  }

  // In progress: bundle good but not yet merged/tagged/synced
  if (
    proof_artifacts.status === 'PASS' &&
    (bundle_verdict.status === 'PASS' || bundle_verdict.status === 'PENDING')
  ) {
    return 'IN_PROGRESS';
  }

  return 'UNKNOWN';
}

// ---------------------------------------------------------------------------
// Next Steps Builder
// ---------------------------------------------------------------------------

function buildNextSteps(checks: LifecycleCheckResult['checks'], sprintId: string): NextStep[] {
  const steps: NextStep[] = [];
  let priority = 1;

  if (checks.proof_artifacts.status === 'FAIL') {
    steps.push({
      priority: priority++,
      action: 'Capture required proof artifacts',
      command: checks.proof_artifacts.nextStep,
      requiresHuman: true,
    });
  }

  if (checks.bundle_verdict.status === 'FAIL' || checks.bundle_verdict.status === 'UNKNOWN') {
    steps.push({
      priority: priority++,
      action: 'Run bundle assembly to get verdict',
      command: checks.bundle_verdict.nextStep,
      requiresHuman: false,
    });
  }

  if (checks.working_tree.status === 'FAIL') {
    steps.push({
      priority: priority++,
      action: 'Commit all changes to sprint branch',
      command: `git add -p && git commit -m "feat(<scope>): <description>\\n\\nSPRINT: ${sprintId}"`,
      requiresHuman: true,
    });
  }

  if (checks.tag_on_remote.status === 'PENDING' || checks.tag_on_remote.status === 'UNKNOWN') {
    // Only add these if proof + bundle are good
    if (
      checks.proof_artifacts.status === 'PASS' &&
      (checks.bundle_verdict.status === 'PASS' || checks.bundle_verdict.status === 'PENDING')
    ) {
      steps.push({
        priority: priority++,
        action: 'Create PR to merge sprint branch into main',
        command: `gh pr create --title "${sprintId}" --body "Sprint: ${sprintId}"`,
        requiresHuman: true,
      });

      steps.push({
        priority: priority++,
        action: 'Wait for CI and merge PR',
        command: `gh pr checks --watch && gh pr merge --squash --admin`,
        requiresHuman: true,
      });

      if (checks.tag_on_remote.status === 'PENDING' && checks.tag_on_remote.nextStep) {
        steps.push({
          priority: priority++,
          action: 'Ensure governance closeout file exists, then trigger tag mint',
          command: checks.tag_on_remote.nextStep,
          requiresHuman: true,
        });
      }
    }
  }

  if (checks.tag_on_remote.status === 'PASS' && checks.status_sync.status !== 'PASS') {
    steps.push({
      priority: priority++,
      action: 'Sync Linear issue to Done and run status sync',
      command: `/status-sync ${sprintId}`,
      requiresHuman: true,
    });
  }

  return steps;
}

// ---------------------------------------------------------------------------
// Artifact Root Resolution
// ---------------------------------------------------------------------------

/**
 * Find the most recent artifact directory for the given sprint.
 * Looks in out/sprints/<sprintId>/ for the most recent date subdirectory.
 */
export function resolveArtifactRoot(sprintId: string, dateOverride?: string): string | null {
  const base = resolveRepoPath(`out/sprints/${sprintId}`);

  if (dateOverride) {
    return path.join(base, dateOverride);
  }

  try {
    const entries = fs.readdirSync(base);
    const dateDirs = entries
      .filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e))
      .sort()
      .reverse();

    if (dateDirs.length === 0) return null;
    return path.join(base, dateDirs[0]!);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

/**
 * Check the full post-bundle lifecycle for a sprint.
 *
 * Safe to call at any time — read-only, never mutates shared state.
 */
export function checkLifecycle(
  sprintId: string,
  options?: LifecycleCheckerOptions
): LifecycleCheckResult {
  const checkedAt = new Date().toISOString();
  const runner = options?.commandRunner ?? runCommand;

  // Resolve artifact root
  const artifactRoot = resolveArtifactRoot(sprintId, options?.dateOverride);

  // Run all dimension checks
  const proof_artifacts = artifactRoot
    ? checkProofArtifacts(artifactRoot)
    : {
        id: 'proof_artifacts',
        label: 'Proof Artifacts',
        status: 'UNKNOWN' as LifecycleDimensionStatus,
        detail: `No artifact directory found for ${sprintId} in out/sprints/`,
        requiresHuman: false,
      };

  const bundle_verdict = artifactRoot
    ? checkBundleVerdict(artifactRoot)
    : {
        id: 'bundle_verdict',
        label: 'Bundle Verdict',
        status: 'UNKNOWN' as LifecycleDimensionStatus,
        detail: 'No artifact directory — bundle not run yet',
        requiresHuman: false,
      };

  const working_tree = checkWorkingTree(runner);

  const tag_on_remote = options?.skipTagCheck
    ? {
        id: 'tag_on_remote',
        label: 'Tag on Remote',
        status: 'UNKNOWN' as LifecycleDimensionStatus,
        detail: 'Tag check skipped (offline mode)',
        requiresHuman: false,
      }
    : checkTagOnRemote(sprintId, runner);

  const status_sync = checkStatusSync(sprintId);

  const checks = {
    proof_artifacts,
    bundle_verdict,
    working_tree,
    tag_on_remote,
    status_sync,
  };

  const overall = computeOverall(checks);
  const nextSteps = buildNextSteps(checks, sprintId);

  return {
    sprintId,
    checkedAt,
    overall,
    checks,
    nextSteps,
  };
}
