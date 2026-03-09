/**
 * Claude OS — Eligibility Checker
 *
 * Evaluates whether an issue is eligible for autonomous execution.
 * Checks: profile existence, task type support, dependency satisfaction,
 * status, acceptance criteria, and content completeness.
 * Fail-closed: any structural gap → UNSUPPORTED/BLOCKED/INCOMPLETE.
 */

import { loadProfileById } from './profile-loader.js';
import { isValidSprintType } from './verification-resolver.js';

import type {
  IssueFile,
  ProjectProfile,
  EligibilityResult,
  EligibilityStatus,
  EligibilityCheck,
} from './types.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether an issue is eligible for autonomous execution.
 *
 * If profile is not provided, attempts to load it by issue.projectId.
 * Returns a structured result with individual check details, blockers,
 * and warnings.
 */
export function checkEligibility(
  issue: IssueFile,
  profile?: ProjectProfile | null
): EligibilityResult {
  const checks: EligibilityCheck[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Resolve profile if not provided
  let resolvedProfile = profile ?? null;
  if (!resolvedProfile) {
    const profileResult = loadProfileById(issue.projectId);
    if (profileResult.success && profileResult.profile) {
      resolvedProfile = profileResult.profile;
    }
  }

  // Check 1: Profile exists
  checks.push(checkProfileExists(issue.projectId, resolvedProfile));

  // Check 2: Task type supported
  checks.push(checkTaskTypeSupported(issue.taskType));

  // Check 3: Dependencies satisfied
  checks.push(checkDependenciesSatisfied(issue));

  // Check 4: Status is open
  checks.push(checkStatusIsOpen(issue));

  // Check 5: Acceptance criteria present
  checks.push(checkAcceptanceCriteriaPresent(issue));

  // Check 6: Content complete
  checks.push(checkContentComplete(issue));

  // Collect blockers from failed checks
  for (const check of checks) {
    if (!check.passed) {
      blockers.push(`${check.name}: ${check.reason}`);
    }
  }

  // Generate warnings for missing optional fields
  if (!issue.truthSourcesRequired || issue.truthSourcesRequired.length === 0) {
    warnings.push('truthSourcesRequired not specified — will be derived from profile');
  }
  if (!issue.killConditions || issue.killConditions.length === 0) {
    warnings.push('killConditions not specified — will be derived from profile criticalInvariants');
  }

  // Determine overall status
  const status = determineStatus(checks);

  return {
    status,
    issueId: issue.issueId,
    projectId: issue.projectId,
    checks,
    blockers,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Individual Checks
// ---------------------------------------------------------------------------

function checkProfileExists(projectId: string, profile: ProjectProfile | null): EligibilityCheck {
  if (profile) {
    return {
      name: 'profile_exists',
      passed: true,
      reason: `Profile found for project '${projectId}'`,
    };
  }
  return {
    name: 'profile_exists',
    passed: false,
    reason: `No profile found for project '${projectId}'`,
  };
}

function checkTaskTypeSupported(taskType: string): EligibilityCheck {
  if (isValidSprintType(taskType)) {
    return {
      name: 'task_type_supported',
      passed: true,
      reason: `Task type '${taskType}' is supported`,
    };
  }
  return {
    name: 'task_type_supported',
    passed: false,
    reason: `Task type '${taskType}' is not a valid sprint type`,
  };
}

function checkDependenciesSatisfied(issue: IssueFile): EligibilityCheck {
  const unresolved = issue.dependencies.filter(d => d.status !== 'resolved');
  if (unresolved.length === 0) {
    return {
      name: 'dependencies_satisfied',
      passed: true,
      reason:
        issue.dependencies.length === 0
          ? 'No dependencies'
          : `All ${issue.dependencies.length} dependencies resolved`,
    };
  }
  const unresolvedIds = unresolved.map(d => d.issueId).join(', ');
  return {
    name: 'dependencies_satisfied',
    passed: false,
    reason: `Unresolved dependencies: ${unresolvedIds}`,
  };
}

function checkStatusIsOpen(issue: IssueFile): EligibilityCheck {
  const status = issue.status;
  if (status === undefined || status === 'open') {
    return {
      name: 'status_is_open',
      passed: true,
      reason: status ? `Status is '${status}'` : 'No status field (assumed open)',
    };
  }
  return {
    name: 'status_is_open',
    passed: false,
    reason: `Status is '${status}' — must be 'open' for execution`,
  };
}

function checkAcceptanceCriteriaPresent(issue: IssueFile): EligibilityCheck {
  if (
    Array.isArray(issue.acceptanceCriteria) &&
    issue.acceptanceCriteria.length > 0 &&
    issue.acceptanceCriteria.every(ac => typeof ac === 'string' && ac.trim() !== '')
  ) {
    return {
      name: 'acceptance_criteria_present',
      passed: true,
      reason: `${issue.acceptanceCriteria.length} acceptance criteria defined`,
    };
  }
  return {
    name: 'acceptance_criteria_present',
    passed: false,
    reason: 'Acceptance criteria missing or empty',
  };
}

function checkContentComplete(issue: IssueFile): EligibilityCheck {
  const missing: string[] = [];

  if (!issue.objective || issue.objective.trim() === '') {
    missing.push('objective');
  }
  if (!issue.summary || issue.summary.trim() === '') {
    missing.push('summary');
  }
  if (!Array.isArray(issue.touchedAreas) || issue.touchedAreas.length === 0) {
    missing.push('touchedAreas');
  }

  if (missing.length === 0) {
    return {
      name: 'content_complete',
      passed: true,
      reason: 'All required content fields present',
    };
  }
  return {
    name: 'content_complete',
    passed: false,
    reason: `Missing or empty: ${missing.join(', ')}`,
  };
}

// ---------------------------------------------------------------------------
// Status Resolution
// ---------------------------------------------------------------------------

/**
 * Determine overall eligibility status from individual checks.
 * Priority: UNSUPPORTED > BLOCKED > INCOMPLETE > ELIGIBLE
 */
function determineStatus(checks: EligibilityCheck[]): EligibilityStatus {
  const failed = checks.filter(c => !c.passed);
  if (failed.length === 0) return 'ELIGIBLE';

  const failedNames = new Set(failed.map(c => c.name));

  // Structural problems → UNSUPPORTED
  if (failedNames.has('profile_exists') || failedNames.has('task_type_supported')) {
    return 'UNSUPPORTED';
  }

  // Operational blockers → BLOCKED
  if (failedNames.has('dependencies_satisfied') || failedNames.has('status_is_open')) {
    return 'BLOCKED';
  }

  // Data gaps → INCOMPLETE
  return 'INCOMPLETE';
}
