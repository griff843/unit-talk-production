/**
 * Claude OS — Queue Manager
 *
 * Scans the issue queue directory, evaluates eligibility and autonomy
 * policy for each issue, and provides deterministic issue selection.
 *
 * Absorbs issue-selector logic (priority-based sorting with tie-breaking).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { evaluateAutonomyPolicy } from './autonomy-policy.js';
import { checkEligibility } from './eligibility-checker.js';
import { resolveRepoPath, dirExists } from './fs-utils.js';
import { loadIssueFromPath } from './issue-loader.js';

import type { AutonomyPolicyOptions } from './autonomy-policy.js';
import type {
  WorkflowState,
  WorkflowStateFile,
  ScannedIssue,
  QueueScanResult,
  QueueSelection,
} from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_ISSUES_DIR = 'governance/claude-os/issues';

/** Priority ordering for deterministic selection (lower = higher priority) */
const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

/** States that disqualify an issue from selection */
const TERMINAL_STATES: WorkflowState[] = ['running', 'proof_ready', 'awaiting_ratification'];

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface QueueManagerOptions {
  /** Override issues directory path (absolute, for testing) */
  issuesDir?: string;
  /** Autonomy policy options */
  autonomyOptions?: AutonomyPolicyOptions;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scan the issue queue directory, loading and evaluating all issues.
 * Returns structured results including eligibility and autonomy evaluation.
 */
export function scanIssueQueue(options?: QueueManagerOptions): QueueScanResult {
  const issuesDir = options?.issuesDir ?? resolveRepoPath(DEFAULT_ISSUES_DIR);
  const now = new Date().toISOString();
  const loadErrors: string[] = [];
  const issues: ScannedIssue[] = [];

  if (!dirExists(issuesDir)) {
    return {
      scannedAt: now,
      totalFiles: 0,
      loaded: 0,
      loadErrors: [],
      issues: [],
    };
  }

  // Read all .json files from the issues directory
  let files: string[];
  try {
    files = fs
      .readdirSync(issuesDir)
      .filter(f => f.endsWith('.json'))
      .sort(); // deterministic order
  } catch (err) {
    return {
      scannedAt: now,
      totalFiles: 0,
      loaded: 0,
      loadErrors: [`Failed to read issues directory: ${(err as Error).message}`],
      issues: [],
    };
  }

  for (const file of files) {
    const filePath = path.join(issuesDir, file);
    const loadResult = loadIssueFromPath(filePath);

    if (!loadResult.success || !loadResult.issue) {
      loadErrors.push(`${file}: ${loadResult.errors.join(', ')}`);
      continue;
    }

    const issue = loadResult.issue;
    const eligibility = checkEligibility(issue);
    const autonomy = evaluateAutonomyPolicy(issue, eligibility, options?.autonomyOptions);

    issues.push({
      issueId: issue.issueId,
      filePath,
      issue,
      eligibility,
      autonomy,
      workflowState: null, // populated by caller if workflow state is loaded
    });
  }

  return {
    scannedAt: now,
    totalFiles: files.length,
    loaded: issues.length,
    loadErrors,
    issues,
  };
}

/**
 * Select the next issue for autopilot execution.
 * Deterministic: priority ordering, then alphabetical tie-breaking.
 * Filters out issues denied by autonomy policy or in terminal states.
 */
export function selectNextIssue(
  scanResult: QueueScanResult,
  workflowState: WorkflowStateFile
): QueueSelection {
  // Annotate issues with their current workflow state
  const annotated = scanResult.issues.map(si => ({
    ...si,
    workflowState: workflowState.issues[si.issueId]?.state ?? null,
  }));

  // Filter to eligible candidates
  const candidates = annotated.filter(si => {
    // Must be allowed by autonomy policy
    if (si.autonomy.decision !== 'ALLOW') return false;
    // Must not be in a terminal/active state
    if (si.workflowState !== null && TERMINAL_STATES.includes(si.workflowState)) return false;
    return true;
  });

  if (candidates.length === 0) {
    return {
      selected: null,
      reason: 'No eligible issues found',
      candidateCount: 0,
      scannedAt: scanResult.scannedAt,
    };
  }

  // Sort by priority (lower number = higher priority), then alphabetical issueId
  candidates.sort((a, b) => {
    const aPri = PRIORITY_ORDER[a.issue.priority ?? 'normal'] ?? 99;
    const bPri = PRIORITY_ORDER[b.issue.priority ?? 'normal'] ?? 99;
    if (aPri !== bPri) return aPri - bPri;
    return a.issueId.localeCompare(b.issueId);
  });

  return {
    selected: candidates[0],
    reason: `Selected ${candidates[0].issueId} (priority: ${candidates[0].issue.priority})`,
    candidateCount: candidates.length,
    scannedAt: scanResult.scannedAt,
  };
}
