/**
 * Tests for autonomy-policy.ts (Phase H + CLAUDE-OS-REDESIGN-001)
 *
 * Verifies autonomy policy evaluation: task type restrictions,
 * priority gates, eligibility checks, schema migration blocking,
 * and execution-level-aware autopilot gating.
 * Pure function tests — no file I/O.
 */

import { describe, it, expect } from 'vitest';

import { evaluateAutonomyPolicy, resolveExecutionLevel } from '../autonomy-policy.js';

import type { IssueFile, EligibilityResult, ProjectProfile } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIssue(overrides?: Partial<IssueFile>): IssueFile {
  return {
    issueVersion: '1.0.0',
    issueId: 'ISSUE-AUTO-001',
    projectId: 'unit-talk',
    taskType: 'docs',
    title: 'Test autonomy issue',
    objective: 'Test objective',
    summary: 'Test summary',
    acceptanceCriteria: ['Criteria 1'],
    touchedAreas: ['docs/'],
    dependencies: [],
    priority: 'normal',
    ...overrides,
  };
}

function makeEligibility(overrides?: Partial<EligibilityResult>): EligibilityResult {
  return {
    status: 'ELIGIBLE',
    issueId: 'ISSUE-AUTO-001',
    projectId: 'unit-talk',
    checks: [],
    blockers: [],
    warnings: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('evaluateAutonomyPolicy', () => {
  it('should ALLOW eligible docs issue with normal priority', () => {
    const result = evaluateAutonomyPolicy(makeIssue(), makeEligibility());

    expect(result.decision).toBe('ALLOW');
    expect(result.denialReasons).toHaveLength(0);
  });

  it('should ALLOW eligible build_fix issue with low priority', () => {
    const result = evaluateAutonomyPolicy(
      makeIssue({ taskType: 'build_fix', priority: 'low' }),
      makeEligibility()
    );

    expect(result.decision).toBe('ALLOW');
  });

  it('should DENY when eligibility status is BLOCKED', () => {
    const result = evaluateAutonomyPolicy(makeIssue(), makeEligibility({ status: 'BLOCKED' }));

    expect(result.decision).toBe('DENY');
    expect(result.denialReasons.length).toBeGreaterThan(0);
  });

  it('should DENY for runtime type (not in default allowed list)', () => {
    const result = evaluateAutonomyPolicy(makeIssue({ taskType: 'runtime' }), makeEligibility());

    expect(result.decision).toBe('DENY');
    expect(result.denialReasons.some(r => r.includes('runtime'))).toBe(true);
  });

  it('should DENY for schema type (not in default allowed list)', () => {
    const result = evaluateAutonomyPolicy(makeIssue({ taskType: 'schema' }), makeEligibility());

    expect(result.decision).toBe('DENY');
  });

  it('should DENY for urgent priority issue', () => {
    const result = evaluateAutonomyPolicy(makeIssue({ priority: 'urgent' }), makeEligibility());

    expect(result.decision).toBe('DENY');
    expect(result.denialReasons.some(r => r.includes('Urgent'))).toBe(true);
  });

  it('should ALLOW with custom allowedTaskTypes including runtime', () => {
    const result = evaluateAutonomyPolicy(makeIssue({ taskType: 'runtime' }), makeEligibility(), {
      allowedTaskTypes: ['docs', 'build_fix', 'runtime'],
    });

    expect(result.decision).toBe('ALLOW');
  });

  it('should DENY when touchedAreas includes schema migration paths', () => {
    const result = evaluateAutonomyPolicy(
      makeIssue({ touchedAreas: ['supabase/migrations/'] }),
      makeEligibility()
    );

    expect(result.decision).toBe('DENY');
    expect(result.denialReasons.some(r => r.includes('migration'))).toBe(true);
  });

  it('should contain named check entries', () => {
    const result = evaluateAutonomyPolicy(makeIssue(), makeEligibility());

    expect(result.checks).toHaveLength(4);
    const names = result.checks.map(c => c.name);
    expect(names).toContain('eligibility_passed');
    expect(names).toContain('task_type_allowed');
    expect(names).toContain('priority_not_urgent');
    expect(names).toContain('no_schema_migration_paths');
  });
});

// ---------------------------------------------------------------------------
// Execution Level Tests (CLAUDE-OS-REDESIGN-001)
// ---------------------------------------------------------------------------

/** Minimal profile with execution level fields */
function makeProfile(overrides?: Partial<ProjectProfile>): ProjectProfile {
  return {
    profileVersion: '2.0.0',
    projectId: 'unit-talk',
    projectName: 'Unit Talk',
    projectType: 'monorepo',
    architectureMode: 'agent-lifecycle',
    truthPriorityOrder: [],
    criticalInvariants: [],
    deliverySurfaces: [],
    deprecatedPaths: [],
    canonicalWriteTargets: [],
    runtimeSensitiveAreas: [],
    domainKeywords: {},
    lifecycleKeywords: [],
    schemaKeywords: [],
    verificationDefaults: {},
    artifactConventions: { artifactBase: 'out/sprints', standardDirectories: [] },
    riskAreas: [],
    defaultExecutionLevel: 2,
    taskTypeExecutionLevels: {
      docs: 0,
      build_fix: 1,
      ui: 2,
      runtime: 2,
      schema: 3,
      e2e_lifecycle: 3,
    },
    ...overrides,
  };
}

describe('resolveExecutionLevel', () => {
  it('should return task-type override from profile when below default', () => {
    // Profile default is 0, task-type override for docs is 0 → level 0
    const level = resolveExecutionLevel(
      makeIssue({ taskType: 'docs' }),
      makeProfile({ defaultExecutionLevel: 0 })
    );
    expect(level).toBe(0);
  });

  it('should return profile default when task type has no override', () => {
    const level = resolveExecutionLevel(
      makeIssue({ taskType: 'docs' }),
      makeProfile({ taskTypeExecutionLevels: {}, defaultExecutionLevel: 3 })
    );
    // Default task-type level for docs is 0, but profile default is 3 (floor)
    expect(level).toBe(3);
  });

  it('should enforce profile default as floor', () => {
    // docs task type level is 0, but profile default is 2 → should be 2
    const level = resolveExecutionLevel(
      makeIssue({ taskType: 'docs' }),
      makeProfile({ defaultExecutionLevel: 2, taskTypeExecutionLevels: { docs: 0 } })
    );
    expect(level).toBe(2);
  });

  it('should allow task-type level above profile default', () => {
    const level = resolveExecutionLevel(
      makeIssue({ taskType: 'schema' }),
      makeProfile({ defaultExecutionLevel: 2 })
    );
    expect(level).toBe(3);
  });

  it('should escalate based on escalation triggers', () => {
    const level = resolveExecutionLevel(
      makeIssue({ taskType: 'docs', touchedAreas: ['supabase/migrations/'] }),
      makeProfile({
        escalationTriggers: [
          { pattern: 'supabase/migrations/', minLevel: 3, reason: 'Schema migrations' },
        ],
      })
    );
    expect(level).toBe(3);
  });

  it('should not de-escalate below task-type level from trigger', () => {
    const level = resolveExecutionLevel(
      makeIssue({ taskType: 'schema', touchedAreas: ['supabase/migrations/'] }),
      makeProfile({
        escalationTriggers: [
          { pattern: 'supabase/migrations/', minLevel: 1, reason: 'Low trigger' },
        ],
      })
    );
    // schema is level 3, trigger minLevel 1 → stays at 3
    expect(level).toBe(3);
  });

  it('should default to level 2 with no profile', () => {
    // Unknown task type with no profile
    const level = resolveExecutionLevel(makeIssue({ taskType: 'runtime' }), null);
    expect(level).toBe(2);
  });
});

describe('evaluateAutonomyPolicy with execution levels', () => {
  it('should ALLOW docs (level 0) with profile', () => {
    const result = evaluateAutonomyPolicy(makeIssue({ taskType: 'docs' }), makeEligibility(), {
      profile: makeProfile({ defaultExecutionLevel: 0 }),
    });
    expect(result.decision).toBe('ALLOW');
  });

  it('should ALLOW build_fix (level 1) with profile defaulting to 0', () => {
    const result = evaluateAutonomyPolicy(makeIssue({ taskType: 'build_fix' }), makeEligibility(), {
      profile: makeProfile({ defaultExecutionLevel: 0 }),
    });
    expect(result.decision).toBe('ALLOW');
  });

  it('should DENY runtime (level 2) — above MAX_AUTOPILOT_LEVEL', () => {
    const result = evaluateAutonomyPolicy(makeIssue({ taskType: 'runtime' }), makeEligibility(), {
      profile: makeProfile(),
    });
    expect(result.decision).toBe('DENY');
    expect(result.denialReasons.some(r => r.includes('SUPERVISED'))).toBe(true);
  });

  it('should DENY schema (level 3) — above MAX_AUTOPILOT_LEVEL', () => {
    const result = evaluateAutonomyPolicy(makeIssue({ taskType: 'schema' }), makeEligibility(), {
      profile: makeProfile(),
    });
    expect(result.decision).toBe('DENY');
  });

  it('should DENY docs when profile default is 2 (floor override)', () => {
    const result = evaluateAutonomyPolicy(makeIssue({ taskType: 'docs' }), makeEligibility(), {
      profile: makeProfile({ defaultExecutionLevel: 2 }),
    });
    expect(result.decision).toBe('DENY');
  });

  it('should use execution_level_allows_autopilot check name with profile', () => {
    const result = evaluateAutonomyPolicy(makeIssue({ taskType: 'docs' }), makeEligibility(), {
      profile: makeProfile({ defaultExecutionLevel: 0 }),
    });
    const names = result.checks.map(c => c.name);
    expect(names).toContain('execution_level_allows_autopilot');
    expect(names).not.toContain('task_type_allowed');
  });

  it('should fall back to task_type_allowed without profile levels', () => {
    const result = evaluateAutonomyPolicy(
      makeIssue({ taskType: 'docs' }),
      makeEligibility()
      // No profile → legacy allowlist
    );
    const names = result.checks.map(c => c.name);
    expect(names).toContain('task_type_allowed');
    expect(names).not.toContain('execution_level_allows_autopilot');
  });

  it('should DENY via escalation trigger even for docs', () => {
    const result = evaluateAutonomyPolicy(
      makeIssue({ taskType: 'docs', touchedAreas: ['apps/api/src/lib/lifecycle/'] }),
      makeEligibility(),
      {
        profile: makeProfile({
          defaultExecutionLevel: 0,
          escalationTriggers: [
            { pattern: 'apps/api/src/lib/lifecycle/', minLevel: 3, reason: 'Lifecycle changes' },
          ],
        }),
      }
    );
    expect(result.decision).toBe('DENY');
  });
});
