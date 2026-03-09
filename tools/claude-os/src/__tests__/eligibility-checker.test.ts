/**
 * Tests for eligibility-checker.ts (Phase F)
 *
 * Verifies issue eligibility evaluation: all 6 checks, status
 * determination, blockers, and warnings.
 * Uses the real unit-talk profile for profile-dependent checks.
 */

import { describe, it, expect } from 'vitest';

import { checkEligibility } from '../eligibility-checker.js';
import { loadProfileById } from '../profile-loader.js';

import type { IssueFile, ProjectProfile } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Load the real unit-talk profile once */
const profileResult = loadProfileById('unit-talk');
const unitTalkProfile: ProjectProfile = profileResult.profile!;

/** Build a valid issue with optional overrides */
function makeIssue(overrides?: Partial<IssueFile>): IssueFile {
  return {
    issueVersion: '1.0.0',
    issueId: 'TEST-ELIG-001',
    projectId: 'unit-talk',
    taskType: 'docs',
    title: 'Test eligibility issue',
    objective: 'Test objective for eligibility',
    summary: 'Test summary for eligibility checking',
    acceptanceCriteria: ['Criterion 1', 'Criterion 2'],
    touchedAreas: ['docs/'],
    dependencies: [],
    truthSourcesRequired: ['docs/SYSTEM_INVARIANTS.md'],
    killConditions: ['Tests fail'],
    notes: [],
    status: 'open',
    priority: 'normal',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('eligibility-checker', () => {
  it('should return ELIGIBLE when all checks pass', () => {
    const result = checkEligibility(makeIssue(), unitTalkProfile);

    expect(result.status).toBe('ELIGIBLE');
    expect(result.blockers).toHaveLength(0);
    expect(result.checks.every(c => c.passed)).toBe(true);
  });

  it('should return UNSUPPORTED when profile not found', () => {
    const issue = makeIssue({ projectId: 'nonexistent-project' });
    const result = checkEligibility(issue);

    expect(result.status).toBe('UNSUPPORTED');
    expect(result.blockers.some(b => b.includes('profile_exists'))).toBe(true);
  });

  it('should return UNSUPPORTED when taskType is invalid', () => {
    const issue = makeIssue({ taskType: 'invalid_type' as any });
    const result = checkEligibility(issue, unitTalkProfile);

    expect(result.status).toBe('UNSUPPORTED');
    expect(result.blockers.some(b => b.includes('task_type_supported'))).toBe(true);
  });

  it('should return BLOCKED when dependency is unresolved', () => {
    const issue = makeIssue({
      dependencies: [{ issueId: 'DEP-001', status: 'unresolved' }],
    });
    const result = checkEligibility(issue, unitTalkProfile);

    expect(result.status).toBe('BLOCKED');
    expect(result.blockers.some(b => b.includes('dependencies_satisfied'))).toBe(true);
    expect(result.blockers.some(b => b.includes('DEP-001'))).toBe(true);
  });

  it('should return BLOCKED when status is paused', () => {
    const issue = makeIssue({ status: 'paused' });
    const result = checkEligibility(issue, unitTalkProfile);

    expect(result.status).toBe('BLOCKED');
    expect(result.blockers.some(b => b.includes('status_is_open'))).toBe(true);
  });

  it('should return BLOCKED when status is blocked', () => {
    const issue = makeIssue({ status: 'blocked' });
    const result = checkEligibility(issue, unitTalkProfile);

    expect(result.status).toBe('BLOCKED');
    expect(result.blockers.some(b => b.includes('status_is_open'))).toBe(true);
  });

  it('should return INCOMPLETE when acceptanceCriteria is empty', () => {
    const issue = makeIssue({ acceptanceCriteria: [] });
    const result = checkEligibility(issue, unitTalkProfile);

    expect(result.status).toBe('INCOMPLETE');
    expect(result.blockers.some(b => b.includes('acceptance_criteria_present'))).toBe(true);
  });

  it('should return INCOMPLETE when touchedAreas is empty', () => {
    const issue = makeIssue({ touchedAreas: [] });
    const result = checkEligibility(issue, unitTalkProfile);

    expect(result.status).toBe('INCOMPLETE');
    expect(result.blockers.some(b => b.includes('content_complete'))).toBe(true);
  });

  it('should produce warnings for missing optional fields', () => {
    const issue = makeIssue({
      truthSourcesRequired: [],
      killConditions: [],
    });
    const result = checkEligibility(issue, unitTalkProfile);

    expect(result.status).toBe('ELIGIBLE');
    expect(result.warnings.some(w => w.includes('truthSourcesRequired'))).toBe(true);
    expect(result.warnings.some(w => w.includes('killConditions'))).toBe(true);
  });
});
