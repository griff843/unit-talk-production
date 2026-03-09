/**
 * Tests for envelope-generator.ts (Phase F)
 *
 * Verifies envelope generation from issue + profile: field mapping,
 * profile defaults, cross-validation, eligibility gating, and write.
 * Uses the real unit-talk profile.
 */

import { describe, it, expect } from 'vitest';

import { generateEnvelope } from '../envelope-generator.js';
import { validateEnvelope } from '../envelope-loader.js';
import { loadProfileById } from '../profile-loader.js';

import type { IssueFile, ProjectProfile } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const profileResult = loadProfileById('unit-talk');
const unitTalkProfile: ProjectProfile = profileResult.profile!;

function makeIssue(overrides?: Partial<IssueFile>): IssueFile {
  return {
    issueVersion: '1.0.0',
    issueId: 'ISSUE-GEN-001',
    projectId: 'unit-talk',
    taskType: 'runtime',
    title: 'Test envelope generation',
    objective: 'Test objective for generation',
    summary: 'Test summary for envelope generation testing',
    acceptanceCriteria: ['AC 1', 'AC 2'],
    touchedAreas: ['apps/api/src/agents/'],
    dependencies: [],
    truthSourcesRequired: ['docs/contracts/PICK_LIFECYCLE_CONTRACT.md'],
    killConditions: ['Lifecycle gate fails'],
    notes: ['Implementation note'],
    status: 'open',
    priority: 'normal',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('envelope-generator', () => {
  it('should generate a valid envelope from eligible issue', () => {
    const result = generateEnvelope(makeIssue(), unitTalkProfile);

    expect(result.success).toBe(true);
    expect(result.envelope).not.toBeNull();
    expect(result.errors).toHaveLength(0);
    expect(result.eligibility.status).toBe('ELIGIBLE');
  });

  it('should produce an envelope that passes validateEnvelope', () => {
    const result = generateEnvelope(makeIssue(), unitTalkProfile);
    expect(result.success).toBe(true);

    const errors = validateEnvelope(result.envelope);
    expect(errors).toHaveLength(0);
  });

  it('should apply profile verification tier defaults', () => {
    // runtime → T3 per unit-talk profile
    const runtimeResult = generateEnvelope(makeIssue({ taskType: 'runtime' }), unitTalkProfile);
    expect(runtimeResult.envelope!.verificationTierOverride).toBe('T3');
    expect(runtimeResult.envelope!.runtimeProofRequired).toBe(true);

    // docs → T1 per unit-talk profile
    const docsResult = generateEnvelope(makeIssue({ taskType: 'docs' }), unitTalkProfile);
    expect(docsResult.envelope!.verificationTierOverride).toBe('T1');
    expect(docsResult.envelope!.runtimeProofRequired).toBe(false);
  });

  it('should derive kill conditions from profile when not specified', () => {
    const issue = makeIssue({ killConditions: [] });
    const result = generateEnvelope(issue, unitTalkProfile);

    expect(result.success).toBe(true);
    const kc = result.envelope!.killConditions;
    expect(kc.length).toBeGreaterThan(0);
    expect(kc.every(k => k.startsWith('Violation: '))).toBe(true);
  });

  it('should fail when issue is not eligible', () => {
    const issue = makeIssue({
      dependencies: [{ issueId: 'BLOCKER-001', status: 'unresolved' }],
    });
    const result = generateEnvelope(issue, unitTalkProfile);

    expect(result.success).toBe(false);
    expect(result.envelope).toBeNull();
    expect(result.eligibility.status).toBe('BLOCKED');
  });

  it('should map all required fields correctly', () => {
    const issue = makeIssue();
    const result = generateEnvelope(issue, unitTalkProfile);
    const env = result.envelope!;

    expect(env.taskId).toBe('ISSUE-GEN-001');
    expect(env.taskType).toBe('runtime');
    expect(env.projectId).toBe('unit-talk');
    expect(env.objective).toBe('Test objective for generation');
    expect(env.summary).toBe('Test summary for envelope generation testing');
    expect(env.touchedAreas).toEqual(['apps/api/src/agents/']);
    expect(env.envelopeVersion).toBe('1.0.0');
    expect(env.artifactDate).toBe('today');
    expect(env.deferredRequirements).toEqual([]);
  });

  it('should respect sprintIdOverride', () => {
    const result = generateEnvelope(makeIssue(), unitTalkProfile, {
      sprintIdOverride: 'SPRINT-CUSTOM-999',
    });

    expect(result.success).toBe(true);
    expect(result.envelope!.taskId).toBe('SPRINT-CUSTOM-999');
  });
});
