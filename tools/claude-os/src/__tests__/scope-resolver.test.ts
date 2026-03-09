/**
 * Tests for scope-resolver.ts
 *
 * Verifies blast-radius resolution and scope classification logic.
 *
 * CLAUDE-OS-SCOPE-HARDENING
 */

import { describe, it, expect } from 'vitest';

import {
  resolveBlastRadius,
  classifyScopeForStep,
  GLOBAL_GATE_RECIPE_IDS,
  WORKSPACE_SCOPED_RECIPE_IDS,
} from '../scope-resolver.js';

import type { BlastRadius, PackageOwnershipMap, VerificationRequirement } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequirement(
  overrides: Partial<VerificationRequirement> = {}
): VerificationRequirement {
  return {
    recipeId: 'typecheck',
    purpose: 'Type check',
    required: true,
    commandPlaceholder: 'pnpm run type-check',
    commandResolved: true,
    outputFile: 'proofs/proof_typecheck.txt',
    failureSeverity: 'blocking',
    notes: '',
    ...overrides,
  };
}

function makeBlastRadius(workspaces: string[] = [], unmapped: string[] = []): BlastRadius {
  return {
    affectedWorkspaces: workspaces.map(name => ({
      name,
      filterPattern: name,
      touchedPaths: [`apps/${name}/src/index.ts`],
      changeRisk: 'medium' as const,
    })),
    globalGatesRequired: true,
    unmappedAreas: unmapped,
    summary: `Affected: ${workspaces.join(', ')}`,
  };
}

const sampleOwnership: PackageOwnershipMap = {
  version: '1.0.0',
  description: 'Test ownership map',
  areas: [
    {
      area: 'apps/api/',
      category: 'runtime_app',
      responsibility: 'API',
      change_risk: 'critical',
      requires_extra_verification: true,
      notes: '',
    },
    {
      area: 'apps/api/src/agents/',
      category: 'runtime_app',
      responsibility: 'Agents',
      change_risk: 'critical',
      requires_extra_verification: true,
      notes: '',
    },
    {
      area: 'apps/discord-bot/',
      category: 'runtime_app',
      responsibility: 'Discord',
      change_risk: 'high',
      requires_extra_verification: true,
      notes: '',
    },
    {
      area: 'tools/claude-os/',
      category: 'tooling',
      responsibility: 'Claude OS',
      change_risk: 'medium',
      requires_extra_verification: false,
      notes: '',
    },
    {
      area: 'packages/observability/',
      category: 'shared_package',
      responsibility: 'Observability',
      change_risk: 'low',
      requires_extra_verification: false,
      notes: '',
    },
  ],
};

// ---------------------------------------------------------------------------
// resolveBlastRadius
// ---------------------------------------------------------------------------

describe('resolveBlastRadius', () => {
  it('returns empty workspaces for empty touched areas', () => {
    const result = resolveBlastRadius([]);
    expect(result.affectedWorkspaces).toHaveLength(0);
    expect(result.globalGatesRequired).toBe(true);
  });

  it('maps apps/api/ paths to api workspace', () => {
    const result = resolveBlastRadius([
      'apps/api/src/agents/GradingAgent.ts',
      'apps/api/src/activities/backfill.ts',
    ]);
    expect(result.affectedWorkspaces).toHaveLength(1);
    expect(result.affectedWorkspaces[0].name).toBe('api');
    expect(result.affectedWorkspaces[0].touchedPaths).toHaveLength(2);
  });

  it('maps multiple workspace areas correctly', () => {
    const result = resolveBlastRadius(['apps/api/src/index.ts', 'tools/claude-os/src/cli.ts']);
    expect(result.affectedWorkspaces).toHaveLength(2);
    const names = result.affectedWorkspaces.map(w => w.name).sort();
    expect(names).toEqual(['api', 'claude-os']);
  });

  it('captures unmapped areas (docs, scripts, etc.)', () => {
    const result = resolveBlastRadius(['docs/system/current/README.md', 'apps/api/src/index.ts']);
    expect(result.unmappedAreas).toContain('docs/system/current/README.md');
    expect(result.affectedWorkspaces).toHaveLength(1);
  });

  it('uses ownership map for change risk resolution', () => {
    const result = resolveBlastRadius(['apps/api/src/agents/SettlementAgent.ts'], sampleOwnership);
    expect(result.affectedWorkspaces[0].changeRisk).toBe('critical');
  });

  it('deduplicates workspace entries for multiple paths in same workspace', () => {
    const result = resolveBlastRadius([
      'apps/api/src/agents/GradingAgent.ts',
      'apps/api/src/activities/ingestion.ts',
      'apps/api/src/api-server.ts',
    ]);
    expect(result.affectedWorkspaces).toHaveLength(1);
    expect(result.affectedWorkspaces[0].touchedPaths).toHaveLength(3);
  });

  it('always sets globalGatesRequired to true', () => {
    const result = resolveBlastRadius(['tools/claude-os/src/cli.ts']);
    expect(result.globalGatesRequired).toBe(true);
  });

  it('handles backslash paths (Windows)', () => {
    const result = resolveBlastRadius(['apps\\api\\src\\index.ts']);
    expect(result.affectedWorkspaces).toHaveLength(1);
    expect(result.affectedWorkspaces[0].name).toBe('api');
  });
});

// ---------------------------------------------------------------------------
// classifyScopeForStep
// ---------------------------------------------------------------------------

describe('classifyScopeForStep', () => {
  it('classifies global gate recipes as global_blocker', () => {
    for (const gateId of GLOBAL_GATE_RECIPE_IDS) {
      const req = makeRequirement({ recipeId: gateId });
      const blast = makeBlastRadius(['api']);
      const result = classifyScopeForStep(req, blast);
      expect(result.classification).toBe('global_blocker');
    }
  });

  it('classifies filtered command in affected workspace as in_scope_failure', () => {
    const req = makeRequirement({
      recipeId: 'typecheck',
      commandPlaceholder: 'pnpm --filter api run type-check',
    });
    const blast = makeBlastRadius(['api']);
    const result = classifyScopeForStep(req, blast);
    expect(result.classification).toBe('in_scope_failure');
    expect(result.targetWorkspace).toBe('api');
  });

  it('classifies filtered command in unaffected workspace as out_of_scope_failure', () => {
    const req = makeRequirement({
      recipeId: 'typecheck',
      commandPlaceholder: 'pnpm --filter discord-bot run type-check',
    });
    const blast = makeBlastRadius(['api', 'claude-os']);
    const result = classifyScopeForStep(req, blast);
    expect(result.classification).toBe('out_of_scope_failure');
    expect(result.targetWorkspace).toBe('discord-bot');
  });

  it('classifies unfiltered workspace-scoped recipe as in_scope_failure', () => {
    const req = makeRequirement({
      recipeId: 'typecheck',
      commandPlaceholder: 'pnpm run type-check',
    });
    const blast = makeBlastRadius(['api']);
    const result = classifyScopeForStep(req, blast);
    expect(result.classification).toBe('in_scope_failure');
  });

  it('classifies all workspace-scoped recipes as out_of_scope when no workspaces affected', () => {
    for (const recipeId of WORKSPACE_SCOPED_RECIPE_IDS) {
      const req = makeRequirement({ recipeId });
      const blast = makeBlastRadius([]);
      const result = classifyScopeForStep(req, blast);
      expect(result.classification).toBe('out_of_scope_failure');
    }
  });

  it('returns global_blocker for lifecycle_gate regardless of blast radius', () => {
    const req = makeRequirement({
      recipeId: 'lifecycle_gate',
      commandPlaceholder: 'pnpm --filter api run lifecycle:single-writer -- --strict',
    });
    const blast = makeBlastRadius([]); // Even with no workspaces
    const result = classifyScopeForStep(req, blast);
    expect(result.classification).toBe('global_blocker');
  });

  it('handles -F shorthand for filter', () => {
    const req = makeRequirement({
      recipeId: 'build',
      commandPlaceholder: 'pnpm -F api run build',
    });
    const blast = makeBlastRadius(['api']);
    const result = classifyScopeForStep(req, blast);
    expect(result.classification).toBe('in_scope_failure');
    expect(result.targetWorkspace).toBe('api');
  });
});

// ---------------------------------------------------------------------------
// Integration: Scope classification with real recipe IDs
// ---------------------------------------------------------------------------

describe('scope classification with verification recipes', () => {
  const sprint046Blast = makeBlastRadius(['api', 'claude-os']);

  it('typecheck (unfiltered) is in-scope when api is affected', () => {
    const req = makeRequirement({
      recipeId: 'typecheck',
      commandPlaceholder: 'pnpm run type-check',
    });
    const result = classifyScopeForStep(req, sprint046Blast);
    expect(result.classification).toBe('in_scope_failure');
  });

  it('discord-bot filtered build is out-of-scope for api+claude-os sprint', () => {
    const req = makeRequirement({
      recipeId: 'build',
      commandPlaceholder: 'pnpm --filter discord-bot run build',
    });
    const result = classifyScopeForStep(req, sprint046Blast);
    expect(result.classification).toBe('out_of_scope_failure');
  });

  it('lifecycle_gate is always a global blocker', () => {
    const req = makeRequirement({
      recipeId: 'lifecycle_gate',
      commandPlaceholder: 'pnpm --filter api run lifecycle:single-writer -- --strict',
    });
    const result = classifyScopeForStep(req, sprint046Blast);
    expect(result.classification).toBe('global_blocker');
  });

  it('schema_guard is always a global blocker', () => {
    const req = makeRequirement({
      recipeId: 'schema_guard',
      commandPlaceholder: 'pnpm run schema:verify',
    });
    const result = classifyScopeForStep(req, sprint046Blast);
    expect(result.classification).toBe('global_blocker');
  });
});
