/**
 * Claude OS — Repo Context Pack Generator
 *
 * Implements REPO_CONTEXT_PACK_SPEC.md requirements.
 *
 * Generates a machine-readable context pack that grounds every sprint
 * in current repo truth. The pack is written to:
 *   out/context/<SPRINT_ID>/<DATE>/context-pack.json
 *
 * Design law (from CLAUDE_OS_UPGRADE_ROADMAP.md):
 *   - fail-closed: protected-surface sprints block on missing required fields
 *   - no cached truth: pack is generated immediately before task execution
 *   - context older than 5 minutes is stale (REPO_CONTEXT_PACK_SPEC.md)
 *   - if generation fails, sprint start must fail — no sprint without context
 */

import * as path from 'node:path';

import { runCommand } from './command-runner.js';
import {
  resolveRepoPath,
  getWorkspaceRoot,
  fileExists,
  ensureDir,
  safeWriteJson,
  safeReadJson,
  normalizePath,
} from './fs-utils.js';

import type {
  AuthoritySurface,
  ContextPackGenerateOptions,
  ContextPackGenerationResult,
  ContextPackValidationResult,
  GovernanceDocRef,
  RepoContextPack,
  ReceiptClass,
} from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PACK_VERSION = '1.0.0' as const;
const DEFAULT_OUTPUT_ROOT = 'out/context';
const CONTEXT_PACK_FILENAME = 'context-pack.json';

/** Maximum age in milliseconds before a context pack is considered stale (5 minutes) */
export const CONTEXT_PACK_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * Governance documents required by REPO_CONTEXT_PACK_SPEC.md.
 * These must be present in every context pack (with exists=true/false).
 */
const REQUIRED_GOVERNANCE_DOCS: string[] = [
  'governance/ai-orchestration/LLM_AUTHORITY_MAP.md',
  'governance/ai-orchestration/PROOF_RECEIPT_STANDARD.md',
  'governance/ai-orchestration/STATUS_RUBRIC.md',
  'governance/ai-orchestration/PROMPT_STANDARDIZATION_SPEC.md',
  'governance/ai-orchestration/REPO_TRUTH_ACCESS_STANDARD.md',
];

/**
 * Additional governance docs to include when available.
 * Not required, but included if found.
 */
const OPTIONAL_GOVERNANCE_DOCS: string[] = [
  'CLAUDE_EXECUTION_CONTRACT.md',
  'CLAUDE.md',
  'docs/SYSTEM_INVARIANTS.md',
];

/**
 * Required fields that must be non-empty for a valid context pack.
 * These map to the REPO_CONTEXT_PACK_SPEC.md "Required Context Fields" section.
 */
const REQUIRED_FIELDS: Array<keyof RepoContextPack> = [
  'repository_name',
  'current_branch',
  'git_status_summary',
  'recent_commits',
  'diff_summary',
  'changed_files',
  'affected_directories',
];

// ---------------------------------------------------------------------------
// Path Resolution
// ---------------------------------------------------------------------------

function resolveOutputDir(
  sprintId: string,
  dateStr: string,
  options?: ContextPackGenerateOptions
): string {
  const root = options?.outputRoot
    ? path.resolve(options.outputRoot)
    : resolveRepoPath(DEFAULT_OUTPUT_ROOT);
  return path.join(root, sprintId, dateStr);
}

function resolveOutputPath(
  sprintId: string,
  dateStr: string,
  options?: ContextPackGenerateOptions
): string {
  return path.join(resolveOutputDir(sprintId, dateStr, options), CONTEXT_PACK_FILENAME);
}

function toRepoRelativePath(absPath: string): string {
  const root = getWorkspaceRoot();
  const rel = path.relative(root, absPath);
  return normalizePath(rel);
}

// ---------------------------------------------------------------------------
// Git Truth Gathering
// ---------------------------------------------------------------------------

interface GitContextResult {
  repository_name: string;
  current_branch: string;
  git_status_summary: string;
  recent_commits: string[];
  diff_summary: string;
  changed_files: string[];
}

function gatherGitContext(
  runner: NonNullable<ContextPackGenerateOptions['commandRunner']>,
  warnings: string[]
): GitContextResult {
  const ctx: GitContextResult = {
    repository_name: '',
    current_branch: '',
    git_status_summary: '',
    recent_commits: [],
    diff_summary: '',
    changed_files: [],
  };

  // Repository name — try remote URL first, fall back to workspace directory name
  const remoteResult = runner('git remote get-url origin', { timeoutMs: 10_000 });
  if (remoteResult.exitCode === 0 && remoteResult.stdout.trim()) {
    const url = remoteResult.stdout.trim();
    const match = url.match(/\/([^/]+?)(?:\.git)?$/);
    ctx.repository_name = match ? match[1] : url;
  } else {
    try {
      ctx.repository_name = path.basename(getWorkspaceRoot());
    } catch {
      ctx.repository_name = '(unknown)';
      warnings.push('Could not determine repository name from remote or directory');
    }
  }

  // Current branch
  const branchResult = runner('git rev-parse --abbrev-ref HEAD', { timeoutMs: 10_000 });
  if (branchResult.exitCode === 0) {
    ctx.current_branch = branchResult.stdout.trim();
  } else {
    ctx.current_branch = '(unknown)';
    warnings.push('git rev-parse --abbrev-ref HEAD failed: ' + branchResult.stderr.trim());
  }

  // Git status summary (short format)
  const statusResult = runner('git status --short', { timeoutMs: 10_000 });
  if (statusResult.exitCode === 0) {
    ctx.git_status_summary = statusResult.stdout.trim() || '(clean working tree)';
  } else {
    ctx.git_status_summary = '(git status failed)';
    warnings.push('git status --short failed: ' + statusResult.stderr.trim());
  }

  // Recent commits (last 10 oneline)
  const logResult = runner('git log -n 10 --oneline', { timeoutMs: 10_000 });
  if (logResult.exitCode === 0) {
    ctx.recent_commits = logResult.stdout
      .trim()
      .split('\n')
      .filter(l => l.length > 0);
  } else {
    ctx.recent_commits = [];
    warnings.push('git log failed: ' + logResult.stderr.trim());
  }

  // Diff summary — staged + unstaged relative to HEAD
  const diffStatResult = runner('git diff --stat HEAD', { timeoutMs: 15_000 });
  if (diffStatResult.exitCode === 0) {
    ctx.diff_summary = diffStatResult.stdout.trim() || '(no diff from HEAD)';
  } else {
    // On initial commit or detached HEAD, this may fail; try without HEAD
    const diffStatFallback = runner('git diff --stat', { timeoutMs: 10_000 });
    if (diffStatFallback.exitCode === 0) {
      ctx.diff_summary = diffStatFallback.stdout.trim() || '(no uncommitted changes)';
    } else {
      ctx.diff_summary = '(diff stat unavailable)';
      warnings.push('git diff --stat failed: ' + diffStatResult.stderr.trim());
    }
  }

  // Changed files relative to HEAD
  const diffNamesResult = runner('git diff --name-only HEAD', { timeoutMs: 15_000 });
  if (diffNamesResult.exitCode === 0) {
    ctx.changed_files = diffNamesResult.stdout
      .trim()
      .split('\n')
      .filter(l => l.length > 0);
  } else {
    // Fallback: staged files
    const stagedResult = runner('git diff --cached --name-only', { timeoutMs: 10_000 });
    if (stagedResult.exitCode === 0) {
      ctx.changed_files = stagedResult.stdout
        .trim()
        .split('\n')
        .filter(l => l.length > 0);
    } else {
      ctx.changed_files = [];
      warnings.push('git diff --name-only HEAD failed: ' + diffNamesResult.stderr.trim());
    }
  }

  return ctx;
}

// ---------------------------------------------------------------------------
// Governance Doc Resolution
// ---------------------------------------------------------------------------

function resolveGovernanceDocs(): GovernanceDocRef[] {
  const docs: GovernanceDocRef[] = [];

  for (const docPath of REQUIRED_GOVERNANCE_DOCS) {
    docs.push({ path: docPath, exists: fileExists(resolveRepoPath(docPath)) });
  }
  for (const docPath of OPTIONAL_GOVERNANCE_DOCS) {
    const absPath = resolveRepoPath(docPath);
    if (fileExists(absPath)) {
      docs.push({ path: docPath, exists: true });
    }
  }

  return docs;
}

// ---------------------------------------------------------------------------
// Affected Directories
// ---------------------------------------------------------------------------

function computeAffectedDirectories(changedFiles: string[]): string[] {
  const dirs = new Set<string>();
  for (const f of changedFiles) {
    const dir = path.dirname(f);
    if (dir && dir !== '.') dirs.add(normalizePath(dir));
  }
  return Array.from(dirs).sort();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a repo context pack for the given sprint.
 *
 * Runs git commands to gather current repo truth, assembles the pack,
 * writes it to out/context/<SPRINT_ID>/<DATE>/context-pack.json, and
 * returns the result.
 *
 * Fail-closed: if git commands fail for a protected-surface sprint, the
 * result has success=false and errors non-empty. The caller (sprint start)
 * must treat this as a hard blocker.
 */
export function generateContextPack(
  sprintId: string,
  sprintTitle: string,
  authoritySurfaces: AuthoritySurface[],
  expectedProofClasses: ReceiptClass[],
  options?: ContextPackGenerateOptions
): ContextPackGenerationResult {
  const runner = options?.commandRunner ?? runCommand;
  const warnings: string[] = [];
  const errors: string[] = [];
  const isProtected = authoritySurfaces.length > 0;

  const now = new Date();
  const dateStr = options?.dateOverride ?? now.toISOString().split('T')[0];
  const timestampGenerated = now.toISOString();

  // ---- Gather git context ----
  let gitCtx: GitContextResult;
  try {
    gitCtx = gatherGitContext(runner, warnings);
  } catch (err) {
    const msg = `Git context gathering failed: ${err instanceof Error ? err.message : String(err)}`;
    errors.push(msg);
    return {
      success: false,
      pack: null,
      output_path: null,
      repo_relative_path: null,
      warnings,
      errors,
    };
  }

  // For protected surfaces: unknown branch is a hard blocker
  if (isProtected && gitCtx.current_branch === '(unknown)') {
    errors.push(
      `Cannot gather required git context for protected-surface sprint (${authoritySurfaces.join(', ')}): ` +
        'current branch is unknown. Ensure you are in a valid git repository.'
    );
    return {
      success: false,
      pack: null,
      output_path: null,
      repo_relative_path: null,
      warnings,
      errors,
    };
  }

  // ---- Governance docs ----
  const governanceDocs = resolveGovernanceDocs();
  const missingRequiredDocs = governanceDocs.filter(
    d => REQUIRED_GOVERNANCE_DOCS.includes(d.path) && !d.exists
  );
  if (missingRequiredDocs.length > 0) {
    const missingList = missingRequiredDocs.map(d => d.path).join(', ');
    if (isProtected) {
      errors.push(
        `Required governance documents are missing for protected-surface sprint: ${missingList}`
      );
      return {
        success: false,
        pack: null,
        output_path: null,
        repo_relative_path: null,
        warnings,
        errors,
      };
    } else {
      warnings.push(`Required governance documents not found: ${missingList}`);
    }
  }

  // ---- Assemble pack ----
  const pack: RepoContextPack = {
    pack_version: PACK_VERSION,
    sprint_id: sprintId,
    sprint_title: sprintTitle,
    timestamp_generated: timestampGenerated,
    repository_name: gitCtx.repository_name,
    current_branch: gitCtx.current_branch,
    git_status_summary: gitCtx.git_status_summary,
    recent_commits: gitCtx.recent_commits,
    diff_summary: gitCtx.diff_summary,
    changed_files: gitCtx.changed_files,
    affected_directories: computeAffectedDirectories(gitCtx.changed_files),
    relevant_governance_docs: governanceDocs,
    authority_surfaces: authoritySurfaces,
    expected_proof_classes: expectedProofClasses,
    subsystem: options?.subsystem ?? null,
    known_blockers: options?.known_blockers ?? [],
  };

  // ---- Validate before writing ----
  const validation = validateContextPack(pack, isProtected);
  if (!validation.valid) {
    if (isProtected) {
      errors.push(
        'Context pack validation failed for protected-surface sprint. Missing required fields: ' +
          validation.missing_required_fields.join(', ')
      );
      return {
        success: false,
        pack: null,
        output_path: null,
        repo_relative_path: null,
        warnings,
        errors,
      };
    }
    for (const f of validation.missing_required_fields) {
      warnings.push(`Required field missing or empty: ${f}`);
    }
  }

  // Add warnings from governance doc validation
  if (validation.warnings.length > 0) {
    warnings.push(...validation.warnings);
  }

  // ---- Write to disk ----
  const absOutputPath = resolveOutputPath(sprintId, dateStr, options);
  const outDir = resolveOutputDir(sprintId, dateStr, options);

  const dirResult = ensureDir(outDir);
  if (!dirResult.success) {
    errors.push(`Failed to create context pack output directory: ${dirResult.error}`);
    return {
      success: false,
      pack: null,
      output_path: null,
      repo_relative_path: null,
      warnings,
      errors,
    };
  }

  const writeResult = safeWriteJson(absOutputPath, pack);
  if (!writeResult.success) {
    errors.push(`Failed to write context pack: ${writeResult.error}`);
    return {
      success: false,
      pack: null,
      output_path: null,
      repo_relative_path: null,
      warnings,
      errors,
    };
  }

  const repoRelativePath = toRepoRelativePath(absOutputPath);

  return {
    success: true,
    pack,
    output_path: absOutputPath,
    repo_relative_path: repoRelativePath,
    warnings,
    errors: [],
  };
}

/**
 * Validate a context pack against requirements.
 *
 * Required fields must be non-empty (non-null, non-empty string/array).
 * Protected-surface packs are validated more strictly.
 */
export function validateContextPack(
  pack: RepoContextPack,
  isProtected: boolean
): ContextPackValidationResult {
  const missingFields: string[] = [];
  const warnings: string[] = [];

  for (const field of REQUIRED_FIELDS) {
    const value = pack[field];
    if (value === null || value === undefined) {
      missingFields.push(field);
    } else if (typeof value === 'string' && value.trim() === '') {
      missingFields.push(field);
    } else if (Array.isArray(value)) {
      // changed_files can legitimately be empty (clean working tree)
      // recent_commits being empty on a brand-new repo is also valid
      if (value.length === 0 && field !== 'changed_files' && field !== 'affected_directories') {
        if (isProtected && field === 'recent_commits') {
          warnings.push('No recent commits found — verify this is not a new/empty repo');
        }
      }
    }
  }

  return {
    valid: missingFields.length === 0,
    is_protected: isProtected,
    missing_required_fields: missingFields,
    warnings,
  };
}

/**
 * Check whether a context pack is still fresh.
 *
 * Per REPO_CONTEXT_PACK_SPEC.md: context older than 5 minutes is invalid.
 *
 * Returns fresh=true if within maxAgeMs, false if stale or timestamp is missing.
 */
export function checkContextPackFreshness(
  pack: RepoContextPack,
  maxAgeMs: number = CONTEXT_PACK_MAX_AGE_MS
): { fresh: boolean; ageMs: number; reason: string } {
  if (!pack.timestamp_generated) {
    return { fresh: false, ageMs: Infinity, reason: 'Pack has no timestamp_generated field' };
  }

  const generatedAt = new Date(pack.timestamp_generated).getTime();
  if (isNaN(generatedAt)) {
    return {
      fresh: false,
      ageMs: Infinity,
      reason: `Invalid timestamp_generated: ${pack.timestamp_generated}`,
    };
  }

  const ageMs = Date.now() - generatedAt;

  if (ageMs > maxAgeMs) {
    const ageSec = Math.round(ageMs / 1000);
    const maxSec = Math.round(maxAgeMs / 1000);
    return {
      fresh: false,
      ageMs,
      reason: `Context pack is stale: ${ageSec}s old (max ${maxSec}s per REPO_CONTEXT_PACK_SPEC.md)`,
    };
  }

  return { fresh: true, ageMs, reason: 'Pack is fresh' };
}

/**
 * Load a context pack from an absolute path.
 * Returns null if the file does not exist or cannot be parsed.
 */
export function loadContextPack(absolutePath: string): RepoContextPack | null {
  const result = safeReadJson<RepoContextPack>(absolutePath);
  if (!result.success || result.content === null) {
    return null;
  }
  return result.content;
}

/**
 * Load a context pack from a repo-relative path.
 * Returns null if the file does not exist or cannot be parsed.
 */
export function loadContextPackFromRepoPath(repoRelativePath: string): RepoContextPack | null {
  const absPath = resolveRepoPath(repoRelativePath);
  return loadContextPack(absPath);
}
