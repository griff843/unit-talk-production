/**
 * Claude OS — Issue Loader
 *
 * Loads, validates, and normalizes machine-readable issue files.
 * Fail-closed: invalid or missing issue -> error block.
 * Convention path: governance/claude-os/issues/<issueId>.json
 */

import { resolveRepoPath, safeReadJson, fileExists } from './fs-utils.js';
import { isValidSprintType } from './verification-resolver.js';

import type { IssueFile, IssueLoadResult, IssueStatus, IssuePriority } from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ISSUES_DIR = 'governance/claude-os/issues';

const REQUIRED_ISSUE_FIELDS: (keyof IssueFile)[] = [
  'issueVersion',
  'issueId',
  'projectId',
  'taskType',
  'title',
  'objective',
  'summary',
  'acceptanceCriteria',
  'touchedAreas',
  'dependencies',
];

const VALID_ISSUE_STATUSES: IssueStatus[] = ['open', 'blocked', 'paused', 'closed'];
const VALID_ISSUE_PRIORITIES: IssuePriority[] = ['urgent', 'high', 'normal', 'low'];
const VALID_DEPENDENCY_STATUSES = ['resolved', 'unresolved', 'in_progress'];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve an issue ID to its convention file path.
 */
export function resolveIssuePath(issueId: string): string {
  return `${ISSUES_DIR}/${issueId}.json`;
}

/**
 * Load an issue by ID or path. If the argument contains '/' or ends
 * with '.json', it's treated as a path; otherwise as an issue ID.
 */
export function loadIssue(pathOrId: string): IssueLoadResult {
  if (pathOrId.includes('/') || pathOrId.endsWith('.json')) {
    return loadIssueFromPath(pathOrId);
  }
  return loadIssueById(pathOrId);
}

/**
 * Load an issue by ID using the convention path.
 */
export function loadIssueById(issueId: string): IssueLoadResult {
  return loadIssueFromPath(resolveIssuePath(issueId));
}

/**
 * Load an issue from a file path (repo-relative or absolute).
 */
export function loadIssueFromPath(filePath: string): IssueLoadResult {
  const absolutePath = filePath.startsWith('/') ? filePath : resolveRepoPath(filePath);

  if (!fileExists(absolutePath)) {
    return {
      success: false,
      issue: null,
      source: filePath,
      errors: [`Issue file not found: ${filePath}`],
    };
  }

  const readResult = safeReadJson<IssueFile>(absolutePath);
  if (!readResult.success || readResult.content === null) {
    return {
      success: false,
      issue: null,
      source: filePath,
      errors: [readResult.error ?? `Failed to read issue file: ${filePath}`],
    };
  }

  const validationErrors = validateIssue(readResult.content);
  if (validationErrors.length > 0) {
    return {
      success: false,
      issue: null,
      source: filePath,
      errors: validationErrors,
    };
  }

  return {
    success: true,
    issue: normalizeIssue(readResult.content),
    source: filePath,
    errors: [],
  };
}

/**
 * Validate that issue data has all required fields and correct types.
 * Returns list of validation error messages (empty = valid).
 */
export function validateIssue(data: unknown): string[] {
  const errors: string[] = [];

  if (data === null || data === undefined || typeof data !== 'object') {
    errors.push('Issue data is null or not an object');
    return errors;
  }

  const issue = data as Record<string, unknown>;

  // Check required fields
  for (const field of REQUIRED_ISSUE_FIELDS) {
    if (!(field in issue) || issue[field] === undefined || issue[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate taskType
  if ('taskType' in issue && typeof issue.taskType === 'string') {
    if (!isValidSprintType(issue.taskType)) {
      errors.push(`Invalid taskType '${issue.taskType}'. Must be a valid sprint type.`);
    }
  }

  // Validate array fields are arrays
  const arrayFields: (keyof IssueFile)[] = ['acceptanceCriteria', 'touchedAreas', 'dependencies'];
  for (const field of arrayFields) {
    if (field in issue && !Array.isArray(issue[field])) {
      errors.push(`Field '${field}' must be an array`);
    }
  }

  // Validate acceptanceCriteria is non-empty
  if (Array.isArray(issue.acceptanceCriteria)) {
    if (issue.acceptanceCriteria.length === 0) {
      errors.push('acceptanceCriteria must contain at least one criterion');
    }
    for (let i = 0; i < issue.acceptanceCriteria.length; i++) {
      const ac = issue.acceptanceCriteria[i];
      if (typeof ac !== 'string' || ac.trim() === '') {
        errors.push(`acceptanceCriteria[${i}] must be a non-empty string`);
      }
    }
  }

  // Validate dependency entries
  if (Array.isArray(issue.dependencies)) {
    for (let i = 0; i < issue.dependencies.length; i++) {
      const dep = issue.dependencies[i] as Record<string, unknown> | null;
      if (!dep || typeof dep !== 'object') {
        errors.push(`dependencies[${i}] must be an object`);
        continue;
      }
      if (typeof dep.issueId !== 'string' || dep.issueId.trim() === '') {
        errors.push(`dependencies[${i}].issueId must be a non-empty string`);
      }
      if (!VALID_DEPENDENCY_STATUSES.includes(dep.status as string)) {
        errors.push(
          `dependencies[${i}].status must be one of: ${VALID_DEPENDENCY_STATUSES.join(', ')}`
        );
      }
    }
  }

  // Validate optional status
  if ('status' in issue && issue.status !== undefined && issue.status !== null) {
    if (!VALID_ISSUE_STATUSES.includes(issue.status as IssueStatus)) {
      errors.push(
        `Invalid status '${issue.status}'. Must be one of: ${VALID_ISSUE_STATUSES.join(', ')}`
      );
    }
  }

  // Validate optional priority
  if ('priority' in issue && issue.priority !== undefined && issue.priority !== null) {
    if (!VALID_ISSUE_PRIORITIES.includes(issue.priority as IssuePriority)) {
      errors.push(
        `Invalid priority '${issue.priority}'. Must be one of: ${VALID_ISSUE_PRIORITIES.join(', ')}`
      );
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

/** Default optional fields for consistent downstream consumption. */
function normalizeIssue(issue: IssueFile): IssueFile {
  return {
    ...issue,
    status: issue.status ?? 'open',
    priority: issue.priority ?? 'normal',
    truthSourcesRequired: issue.truthSourcesRequired ?? [],
    killConditions: issue.killConditions ?? [],
    notes: issue.notes ?? [],
  };
}
