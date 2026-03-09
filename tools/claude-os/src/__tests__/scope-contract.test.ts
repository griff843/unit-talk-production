/**
 * Tests for scope-contract.ts (Phase G)
 *
 * Verifies scope contract derivation, file validation against scope rules,
 * and path matching logic. Uses the real unit-talk profile.
 */

import { describe, it, expect } from 'vitest';

import { loadProfileById } from '../profile-loader.js';
import {
  deriveScopeContract,
  validateFileAgainstScope,
  matchesPathRule,
} from '../scope-contract.js';

import type { TaskEnvelope, ProjectProfile, ScopeContract, ScopePathRule } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const profileResult = loadProfileById('unit-talk');
const unitTalkProfile: ProjectProfile = profileResult.profile!;

function makeEnvelope(overrides?: Partial<TaskEnvelope>): TaskEnvelope {
  return {
    envelopeVersion: '1.0.0',
    taskId: 'SPRINT-SCOPE-TEST-001',
    taskType: 'runtime',
    projectId: 'unit-talk',
    objective: 'Test scope contract derivation',
    summary: 'Test summary',
    touchedAreas: ['apps/api/src/agents/SettlementAgent/', 'apps/api/src/activities/'],
    truthSourcesRequired: [],
    killConditions: [],
    notes: [],
    deferredRequirements: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: deriveScopeContract
// ---------------------------------------------------------------------------

describe('deriveScopeContract', () => {
  it('should generate allowedPaths from envelope touchedAreas', () => {
    const contract = deriveScopeContract(makeEnvelope(), unitTalkProfile);

    const envelopeRules = contract.allowedPaths.filter(r => r.source === 'envelope');
    expect(envelopeRules).toHaveLength(2);
    expect(envelopeRules.map(r => r.pattern)).toContain('apps/api/src/agents/SettlementAgent/');
    expect(envelopeRules.map(r => r.pattern)).toContain('apps/api/src/activities/');
    expect(envelopeRules.every(r => r.type === 'prefix')).toBe(true);
  });

  it('should always include out/sprints/ in allowed paths', () => {
    const contract = deriveScopeContract(makeEnvelope(), unitTalkProfile);

    const outRule = contract.allowedPaths.find(
      r => r.pattern === 'out/sprints/' && r.source === 'governance-default'
    );
    expect(outRule).toBeDefined();
  });

  it('should include governance defaults in forbiddenPaths', () => {
    const contract = deriveScopeContract(makeEnvelope(), unitTalkProfile);

    const govRules = contract.forbiddenPaths.filter(r => r.source === 'governance-default');
    expect(govRules.length).toBeGreaterThanOrEqual(3);
  });

  it('should forbid CLAUDE_EXECUTION_CONTRACT.md', () => {
    const contract = deriveScopeContract(makeEnvelope(), unitTalkProfile);

    const rule = contract.forbiddenPaths.find(r => r.pattern === 'CLAUDE_EXECUTION_CONTRACT.md');
    expect(rule).toBeDefined();
    expect(rule!.type).toBe('exact');
  });

  it('should forbid supabase/migrations/', () => {
    const contract = deriveScopeContract(makeEnvelope(), unitTalkProfile);

    const rule = contract.forbiddenPaths.find(r => r.pattern === 'supabase/migrations/');
    expect(rule).toBeDefined();
    expect(rule!.type).toBe('prefix');
  });

  it('should add profile runtimeSensitiveAreas not in touchedAreas to forbidden', () => {
    // Envelope touches agents/ and activities/ but NOT lifecycle/ or packages/
    const contract = deriveScopeContract(makeEnvelope(), unitTalkProfile);

    const profileRules = contract.forbiddenPaths.filter(r => r.source === 'profile');
    // lifecycle/, packages/distribution/, packages/intelligence/, runtime_config/
    // should be forbidden (not in touchedAreas)
    expect(profileRules.some(r => r.pattern === 'apps/api/src/lib/lifecycle/')).toBe(true);
    expect(profileRules.some(r => r.pattern === 'packages/distribution/')).toBe(true);
    expect(profileRules.some(r => r.pattern === 'runtime_config/')).toBe(true);
  });

  it('should NOT forbid runtimeSensitiveAreas that ARE in touchedAreas', () => {
    // Envelope touches agents/ and activities/ — these are in runtimeSensitiveAreas
    const contract = deriveScopeContract(makeEnvelope(), unitTalkProfile);

    const profileRules = contract.forbiddenPaths.filter(r => r.source === 'profile');
    // agents/ and activities/ should NOT appear in forbidden because they're touched
    expect(profileRules.some(r => r.pattern === 'apps/api/src/agents/')).toBe(false);
    expect(profileRules.some(r => r.pattern === 'apps/api/src/activities/')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: validateFileAgainstScope
// ---------------------------------------------------------------------------

describe('validateFileAgainstScope', () => {
  it('should return allowed for file matching allowedPaths prefix', () => {
    const contract = deriveScopeContract(makeEnvelope(), unitTalkProfile);

    const result = validateFileAgainstScope(
      'apps/api/src/agents/SettlementAgent/index.ts',
      contract
    );
    expect(result.allowed).toBe(true);
    expect(result.violation).toBeNull();
  });

  it('should return in_forbidden for file matching forbiddenPaths', () => {
    const contract = deriveScopeContract(makeEnvelope(), unitTalkProfile);

    const result = validateFileAgainstScope('CLAUDE_EXECUTION_CONTRACT.md', contract);
    expect(result.allowed).toBe(false);
    expect(result.violation).not.toBeNull();
    expect(result.violation!.violationType).toBe('in_forbidden');
    expect(result.violation!.severity).toBe('blocking');
  });

  it('should return outside_allowed when no rule matches', () => {
    const contract = deriveScopeContract(makeEnvelope(), unitTalkProfile);

    const result = validateFileAgainstScope('apps/dashboard/src/components/Chart.tsx', contract);
    expect(result.allowed).toBe(false);
    expect(result.violation).not.toBeNull();
    expect(result.violation!.violationType).toBe('outside_allowed');
    expect(result.violation!.matchedRule).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: matchesPathRule
// ---------------------------------------------------------------------------

describe('matchesPathRule', () => {
  it('should handle prefix type correctly', () => {
    const rule: ScopePathRule = { pattern: 'apps/api/src/', type: 'prefix', source: 'test' };

    expect(matchesPathRule('apps/api/src/index.ts', rule)).toBe(true);
    expect(matchesPathRule('apps/api/src/agents/foo.ts', rule)).toBe(true);
    expect(matchesPathRule('apps/dashboard/src/index.ts', rule)).toBe(false);
  });

  it('should handle exact type correctly', () => {
    const rule: ScopePathRule = { pattern: 'CLAUDE.md', type: 'exact', source: 'test' };

    expect(matchesPathRule('CLAUDE.md', rule)).toBe(true);
    expect(matchesPathRule('docs/CLAUDE.md', rule)).toBe(false);
    expect(matchesPathRule('CLAUDE.md/extra', rule)).toBe(false);
  });
});
