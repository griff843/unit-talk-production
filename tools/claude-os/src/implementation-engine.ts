/**
 * Claude OS — Implementation Engine
 *
 * Governance wrapper for the implementation pipeline stage.
 * Captures pre-implementation snapshots, validates post-implementation
 * changes against scope contracts, and generates change receipts.
 *
 * Does NOT edit code. Does NOT commit or push.
 */

import * as path from 'node:path';

import { runCommand } from './command-runner.js';
import {
  ensureDir,
  safeWriteJson,
  safeReadJson,
  safeWriteText,
  normalizePath,
} from './fs-utils.js';
import { deriveScopeContract, validateFileAgainstScope } from './scope-contract.js';

import type {
  TaskEnvelope,
  ProjectProfile,
  ScopeContract,
  PreImplementationSnapshot,
  ChangeReceipt,
  ChangeReceiptFileEntry,
  BoundaryValidationResult,
  BoundaryViolation,
  ImplementationStartResult,
  ImplementationCheckResult,
  ImplementationCheckStatus,
  CommandRunner,
} from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCOPE_CONTRACT_FILE = 'scope-contract.json';
const PRE_SNAPSHOT_FILE = 'pre-snapshot.json';
const CHANGE_RECEIPT_FILE = 'change-receipt.json';
const DIFF_OUTPUT_DIR = 'diffs';
const DIFF_OUTPUT_FILE = 'diffs/sprint_changes.diff';

const CONTRACT_VERSION = '1.0.0';
const SNAPSHOT_VERSION = '1.0.0';
const RECEIPT_VERSION = '1.0.0';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ImplementationEngineOptions {
  /** Custom command runner for testing (defaults to real runCommand) */
  commandRunner?: CommandRunner;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start implementation: derive scope contract and capture pre-implementation snapshot.
 *
 * Call this BEFORE external code changes are made.
 * Writes scope-contract.json and pre-snapshot.json to artifactRoot.
 */
export function startImplementation(
  envelope: TaskEnvelope,
  profile: ProjectProfile,
  artifactRoot: string,
  options?: ImplementationEngineOptions
): ImplementationStartResult {
  const runner = options?.commandRunner ?? runCommand;
  const errors: string[] = [];

  // 1. Derive scope contract
  const scopeContract = deriveScopeContract(envelope, profile);

  // 2. Capture git state
  const headResult = runner('git rev-parse HEAD', { timeoutMs: 10_000 });
  if (headResult.exitCode !== 0) {
    errors.push(`Failed to capture git HEAD: ${headResult.stderr.trim()}`);
    return {
      success: false,
      scopeContract: null,
      snapshot: null,
      scopeContractPath: null,
      snapshotPath: null,
      errors,
    };
  }

  const branchResult = runner('git rev-parse --abbrev-ref HEAD', { timeoutMs: 10_000 });
  const statusResult = runner('git status --porcelain', { timeoutMs: 10_000 });

  const gitHead = headResult.stdout.trim();
  const gitBranch = branchResult.exitCode === 0 ? branchResult.stdout.trim() : 'unknown';
  const statusOutput = statusResult.exitCode === 0 ? statusResult.stdout : '';

  // Parse untracked files (lines starting with ??)
  const untrackedFiles = statusOutput
    .split('\n')
    .filter(line => line.startsWith('??'))
    .map(line => line.slice(3).trim());

  const workingTreeClean = statusOutput.trim() === '';

  // 3. Build snapshot
  const snapshot: PreImplementationSnapshot = {
    snapshotVersion: SNAPSHOT_VERSION,
    taskId: envelope.taskId,
    gitHead,
    gitBranch,
    workingTreeClean,
    untrackedFiles,
    capturedAt: new Date().toISOString(),
  };

  // 4. Write artifacts
  ensureDir(artifactRoot);

  const contractPath = path.join(artifactRoot, SCOPE_CONTRACT_FILE);
  const contractWrite = safeWriteJson(contractPath, scopeContract);
  if (!contractWrite.success) {
    errors.push(`Failed to write scope contract: ${contractWrite.error}`);
  }

  const snapshotPath = path.join(artifactRoot, PRE_SNAPSHOT_FILE);
  const snapshotWrite = safeWriteJson(snapshotPath, snapshot);
  if (!snapshotWrite.success) {
    errors.push(`Failed to write pre-snapshot: ${snapshotWrite.error}`);
  }

  if (errors.length > 0) {
    return {
      success: false,
      scopeContract,
      snapshot,
      scopeContractPath: null,
      snapshotPath: null,
      errors,
    };
  }

  return {
    success: true,
    scopeContract,
    snapshot,
    scopeContractPath: contractPath,
    snapshotPath: snapshotPath,
    errors: [],
  };
}

/**
 * Check implementation: validate changes against scope contract and generate receipt.
 *
 * Call this AFTER external code changes are made.
 * Loads saved scope-contract.json and pre-snapshot.json from artifactRoot.
 * Validates git diff against scope contract.
 * Writes change-receipt.json and diffs/sprint_changes.diff.
 */
export function checkImplementation(
  artifactRoot: string,
  options?: ImplementationEngineOptions
): ImplementationCheckResult {
  const runner = options?.commandRunner ?? runCommand;
  const errors: string[] = [];
  const now = new Date().toISOString();

  // 1. Load saved artifacts (fail-closed if missing)
  const contractPath = path.join(artifactRoot, SCOPE_CONTRACT_FILE);
  const contractRead = safeReadJson<ScopeContract>(contractPath);
  if (!contractRead.success || !contractRead.content) {
    return {
      success: false,
      status: 'BLOCKED',
      boundaryValidation: null,
      changeReceipt: null,
      diffArtifactPath: null,
      changeReceiptPath: null,
      errors: [`Scope contract not found at ${contractPath}. Run --start first.`],
    };
  }
  const contract = contractRead.content;

  const snapshotPath = path.join(artifactRoot, PRE_SNAPSHOT_FILE);
  const snapshotRead = safeReadJson<PreImplementationSnapshot>(snapshotPath);
  if (!snapshotRead.success || !snapshotRead.content) {
    return {
      success: false,
      status: 'BLOCKED',
      boundaryValidation: null,
      changeReceipt: null,
      diffArtifactPath: null,
      changeReceiptPath: null,
      errors: [`Pre-snapshot not found at ${snapshotPath}. Run --start first.`],
    };
  }
  const snapshot = snapshotRead.content;

  // 2. Capture current git state
  const nameStatusResult = runner('git diff --name-status', { timeoutMs: 30_000 });
  const numstatResult = runner('git diff --numstat', { timeoutMs: 30_000 });
  const diffResult = runner('git diff', { timeoutMs: 30_000 });
  const headResult = runner('git rev-parse HEAD', { timeoutMs: 10_000 });

  const currentHead = headResult.exitCode === 0 ? headResult.stdout.trim() : 'unknown';

  // 3. Parse changed files
  const nameStatusEntries = parseGitNameStatus(
    nameStatusResult.exitCode === 0 ? nameStatusResult.stdout : ''
  );
  const numstatEntries = parseGitNumstat(numstatResult.exitCode === 0 ? numstatResult.stdout : '');
  const diffText = diffResult.exitCode === 0 ? diffResult.stdout : '';

  // Build numstat lookup
  const numstatMap = new Map<string, { added: number; removed: number }>();
  for (const entry of numstatEntries) {
    numstatMap.set(normalizePath(entry.path), {
      added: entry.added,
      removed: entry.removed,
    });
  }

  // 4. Validate each file against scope contract
  const violations: BoundaryViolation[] = [];
  const allowedFiles: string[] = [];
  const fileEntries: ChangeReceiptFileEntry[] = [];

  for (const entry of nameStatusEntries) {
    const normalized = normalizePath(entry.path);
    const result = validateFileAgainstScope(normalized, contract);

    if (result.allowed) {
      allowedFiles.push(normalized);
    } else if (result.violation) {
      violations.push(result.violation);
    }

    const stats = numstatMap.get(normalized);
    fileEntries.push({
      filePath: normalized,
      changeType: mapGitStatus(entry.status),
      linesAdded: stats?.added ?? 0,
      linesRemoved: stats?.removed ?? 0,
    });
  }

  // 5. Build boundary validation result
  const boundaryValidation: BoundaryValidationResult = {
    status: violations.length === 0 ? 'PASS' : 'FAIL',
    totalFilesChecked: nameStatusEntries.length,
    allowedFiles,
    violations,
    validatedAt: now,
  };

  // 6. Build change receipt
  const totalLinesAdded = fileEntries.reduce((sum, f) => sum + f.linesAdded, 0);
  const totalLinesRemoved = fileEntries.reduce((sum, f) => sum + f.linesRemoved, 0);

  const changeReceipt: ChangeReceipt = {
    receiptVersion: RECEIPT_VERSION,
    taskId: contract.taskId,
    preSnapshotHead: snapshot.gitHead,
    currentHead,
    boundaryValidation,
    files: fileEntries,
    totalFilesChanged: fileEntries.length,
    totalLinesAdded,
    totalLinesRemoved,
    generatedAt: now,
  };

  // 7. Write artifacts
  ensureDir(path.join(artifactRoot, DIFF_OUTPUT_DIR));

  const receiptPath = path.join(artifactRoot, CHANGE_RECEIPT_FILE);
  const receiptWrite = safeWriteJson(receiptPath, changeReceipt);
  if (!receiptWrite.success) {
    errors.push(`Failed to write change receipt: ${receiptWrite.error}`);
  }

  const diffPath = path.join(artifactRoot, DIFF_OUTPUT_FILE);
  const diffWrite = safeWriteText(diffPath, diffText || '(no changes)\n');
  if (!diffWrite.success) {
    errors.push(`Failed to write diff artifact: ${diffWrite.error}`);
  }

  // 8. Determine status
  let status: ImplementationCheckStatus;
  if (errors.length > 0) {
    status = 'BLOCKED';
  } else if (violations.length > 0) {
    status = 'FAIL';
  } else {
    status = 'PASS';
  }

  return {
    success: status === 'PASS',
    status,
    boundaryValidation,
    changeReceipt,
    diffArtifactPath: diffPath,
    changeReceiptPath: receiptPath,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Internal: Git output parsers
// ---------------------------------------------------------------------------

/**
 * Parse `git diff --name-status` output.
 * Each line: `<status>\t<path>` (or `<status>\t<old>\t<new>` for renames)
 */
export function parseGitNameStatus(output: string): { path: string; status: string }[] {
  if (!output.trim()) return [];

  return output
    .trim()
    .split('\n')
    .map(line => {
      const parts = line.split('\t');
      const status = (parts[0] ?? '').trim();
      // For renames (R###), use the new path (parts[2])
      const filePath = status.startsWith('R')
        ? (parts[2] ?? parts[1] ?? '').trim()
        : (parts[1] ?? '').trim();
      return { path: filePath, status };
    })
    .filter(e => e.path !== '');
}

/**
 * Parse `git diff --numstat` output.
 * Each line: `<added>\t<removed>\t<path>`
 * Binary files show `-` for counts.
 */
export function parseGitNumstat(
  output: string
): { path: string; added: number; removed: number }[] {
  if (!output.trim()) return [];

  return output
    .trim()
    .split('\n')
    .map(line => {
      const parts = line.split('\t');
      const added = parts[0] === '-' ? 0 : parseInt(parts[0] ?? '0', 10);
      const removed = parts[1] === '-' ? 0 : parseInt(parts[1] ?? '0', 10);
      const filePath = (parts[2] ?? '').trim();
      return { path: filePath, added, removed };
    })
    .filter(e => e.path !== '');
}

/**
 * Map git status letter to change type.
 */
function mapGitStatus(status: string): 'added' | 'modified' | 'deleted' | 'renamed' {
  if (status === 'A') return 'added';
  if (status === 'D') return 'deleted';
  if (status.startsWith('R')) return 'renamed';
  return 'modified'; // M, or anything else
}
