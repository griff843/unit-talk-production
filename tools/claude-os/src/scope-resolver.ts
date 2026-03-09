/**
 * Claude OS — Scope Resolver
 *
 * Resolves the blast radius of a sprint by mapping touched areas to
 * affected workspaces. Used by verification to determine which checks
 * are in-scope vs out-of-scope.
 *
 * CLAUDE-OS-SCOPE-HARDENING
 */

import type {
  AffectedWorkspace,
  BlastRadius,
  PackageOwnershipEntry,
  PackageOwnershipMap,
  ScopeClassification,
  VerificationRequirement,
} from './types.js';

// ---------------------------------------------------------------------------
// Workspace Registry
// ---------------------------------------------------------------------------

/**
 * Static mapping from directory prefixes to workspace filter patterns.
 * This mirrors the pnpm workspace config + package names.
 */
export const WORKSPACE_REGISTRY: Record<string, { filterPattern: string; category: string }> = {
  'apps/api/': { filterPattern: 'api', category: 'runtime_app' },
  'apps/discord-bot/': { filterPattern: 'discord-bot', category: 'runtime_app' },
  'apps/smart-form/': { filterPattern: 'smart-form', category: 'runtime_app' },
  'apps/command-center/': { filterPattern: 'command-center', category: 'runtime_app' },
  'apps/dashboard/': { filterPattern: 'dashboard', category: 'runtime_app' },
  'packages/config/': { filterPattern: 'config', category: 'shared_package' },
  'packages/contracts/': { filterPattern: 'contracts', category: 'shared_package' },
  'packages/data-access/': { filterPattern: 'data-access', category: 'shared_package' },
  'packages/distribution/': { filterPattern: 'distribution', category: 'shared_package' },
  'packages/intelligence/': { filterPattern: 'intelligence', category: 'shared_package' },
  'packages/observability/': { filterPattern: 'observability', category: 'shared_package' },
  'packages/shared/': { filterPattern: 'shared', category: 'shared_package' },
  'tools/claude-os/': { filterPattern: 'claude-os', category: 'tooling' },
};

// ---------------------------------------------------------------------------
// Global Gate Recipe IDs
// ---------------------------------------------------------------------------

/**
 * Recipe IDs that are considered global gates — always run regardless of
 * blast radius and always block if they fail.
 */
export const GLOBAL_GATE_RECIPE_IDS: ReadonlySet<string> = new Set([
  'lifecycle_gate',
  'schema_guard',
  'drift_audit',
]);

/**
 * Recipe IDs that are workspace-scoped — run only if the workspace is affected.
 * These use workspace-wide pnpm commands by default.
 */
export const WORKSPACE_SCOPED_RECIPE_IDS: ReadonlySet<string> = new Set([
  'typecheck',
  'lint',
  'unit_tests',
  'integration_tests',
  'build',
  'runtime_smoke',
  'discord_canary',
  'ui_visual_check',
  'browser_smoke',
]);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve the blast radius of a sprint from touched areas.
 *
 * Maps touched file paths/areas to affected workspaces using the
 * package-ownership map and workspace registry.
 */
export function resolveBlastRadius(
  touchedAreas: string[],
  ownershipMap?: PackageOwnershipMap
): BlastRadius {
  if (!touchedAreas || touchedAreas.length === 0) {
    return {
      affectedWorkspaces: [],
      globalGatesRequired: true,
      unmappedAreas: [],
      summary: 'No touched areas specified — global gates only',
    };
  }

  const workspaceMap = new Map<string, AffectedWorkspace>();
  const unmappedAreas: string[] = [];

  for (const area of touchedAreas) {
    const normalizedArea = normalizeArea(area);
    const workspace = resolveWorkspaceForArea(normalizedArea);

    if (workspace) {
      const existing = workspaceMap.get(workspace.name);
      if (existing) {
        existing.touchedPaths.push(normalizedArea);
      } else {
        const changeRisk = resolveChangeRisk(normalizedArea, ownershipMap);
        workspaceMap.set(workspace.name, {
          name: workspace.name,
          filterPattern: workspace.filterPattern,
          touchedPaths: [normalizedArea],
          changeRisk,
        });
      }
    } else {
      unmappedAreas.push(normalizedArea);
    }
  }

  const affectedWorkspaces = Array.from(workspaceMap.values());
  const globalGatesRequired = true; // Global gates always run

  const wsNames = affectedWorkspaces.map(w => w.name).join(', ') || '(none)';
  const summary =
    `Affected workspaces: ${wsNames}` +
    (unmappedAreas.length > 0 ? ` | Unmapped: ${unmappedAreas.join(', ')}` : '');

  return {
    affectedWorkspaces,
    globalGatesRequired,
    unmappedAreas,
    summary,
  };
}

/**
 * Classify a verification step relative to the sprint blast radius.
 */
export function classifyScopeForStep(
  step: VerificationRequirement,
  blastRadius: BlastRadius
): { classification: ScopeClassification; targetWorkspace: string | null } {
  // Global gates are always blockers
  if (GLOBAL_GATE_RECIPE_IDS.has(step.recipeId)) {
    return { classification: 'global_blocker', targetWorkspace: null };
  }

  // If no workspaces affected, all workspace-scoped steps are out of scope
  if (blastRadius.affectedWorkspaces.length === 0) {
    return { classification: 'out_of_scope_failure', targetWorkspace: null };
  }

  // Try to determine which workspace this step targets from the command
  const targetWorkspace = inferWorkspaceFromCommand(step.commandPlaceholder);

  if (targetWorkspace) {
    const isAffected = blastRadius.affectedWorkspaces.some(
      w => w.filterPattern === targetWorkspace || w.name === targetWorkspace
    );
    return {
      classification: isAffected ? 'in_scope_failure' : 'out_of_scope_failure',
      targetWorkspace,
    };
  }

  // Workspace-wide commands (no filter) — check if it's a workspace-scoped recipe
  if (WORKSPACE_SCOPED_RECIPE_IDS.has(step.recipeId)) {
    // Workspace-wide command (e.g. `pnpm run type-check`) runs all workspaces.
    // If ALL workspaces are affected, it's in-scope. Otherwise, failures could
    // be from unrelated workspaces, so we classify as in_scope since the command
    // covers the affected workspaces too.
    return { classification: 'in_scope_failure', targetWorkspace: null };
  }

  // Unknown recipes default to in-scope (fail-closed principle)
  return { classification: 'in_scope_failure', targetWorkspace: null };
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/** Normalize an area path to use forward slashes and ensure trailing slash for dirs */
function normalizeArea(area: string): string {
  return area.replace(/\\/g, '/');
}

/** Resolve a touched area to a workspace entry from the registry */
function resolveWorkspaceForArea(area: string): { name: string; filterPattern: string } | null {
  // Check each registry entry — longest prefix match wins
  let bestMatch: { prefix: string; entry: { filterPattern: string; category: string } } | null =
    null;

  for (const [prefix, entry] of Object.entries(WORKSPACE_REGISTRY)) {
    if (area.startsWith(prefix)) {
      if (!bestMatch || prefix.length > bestMatch.prefix.length) {
        bestMatch = { prefix, entry };
      }
    }
  }

  if (bestMatch) {
    return {
      name: bestMatch.entry.filterPattern,
      filterPattern: bestMatch.entry.filterPattern,
    };
  }
  return null;
}

/** Resolve the change risk for an area from the ownership map */
function resolveChangeRisk(
  area: string,
  ownershipMap?: PackageOwnershipMap
): 'low' | 'medium' | 'high' | 'critical' {
  if (!ownershipMap) return 'medium';

  // Find best matching ownership entry (longest prefix match)
  let bestMatch: PackageOwnershipEntry | null = null;
  let bestLength = 0;

  for (const entry of ownershipMap.areas) {
    if (area.startsWith(entry.area) && entry.area.length > bestLength) {
      bestMatch = entry;
      bestLength = entry.area.length;
    }
  }

  return bestMatch?.change_risk ?? 'medium';
}

/** Infer which workspace a verification command targets from --filter flags */
function inferWorkspaceFromCommand(command: string): string | null {
  // Match pnpm --filter <name> pattern
  const filterMatch = command.match(/--filter\s+(\S+)/);
  if (filterMatch) {
    return filterMatch[1];
  }

  // Match pnpm -F <name> pattern
  const shortFilterMatch = command.match(/-F\s+(\S+)/);
  if (shortFilterMatch) {
    return shortFilterMatch[1];
  }

  return null;
}
