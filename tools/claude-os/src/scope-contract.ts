/**
 * Claude OS — Scope Contract Derivation
 *
 * Derives file boundary scope contracts from task envelopes and project
 * profiles. Validates individual file paths against scope rules.
 * Fail-closed: files not in allowedPaths are violations (Rule 9).
 *
 * Does NOT mutate source code. Does NOT access the network.
 */

import { normalizePath } from './fs-utils.js';

import type {
  TaskEnvelope,
  ProjectProfile,
  ScopeContract,
  ScopePathRule,
  BoundaryViolation,
  BoundaryViolationType,
} from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONTRACT_VERSION = '1.0.0';

/**
 * Governance-default forbidden paths.
 * These files govern Claude OS itself and must never be modified by sprints.
 */
const GOVERNANCE_FORBIDDEN_PATHS: ScopePathRule[] = [
  {
    pattern: 'CLAUDE_EXECUTION_CONTRACT.md',
    type: 'exact',
    source: 'governance-default',
  },
  {
    pattern: 'docs/SYSTEM_INVARIANTS.md',
    type: 'exact',
    source: 'governance-default',
  },
  {
    pattern: 'governance/claude-os/SYSTEM_LAWS.md',
    type: 'exact',
    source: 'governance-default',
  },
  {
    pattern: 'supabase/migrations/',
    type: 'prefix',
    source: 'governance-default',
  },
];

/**
 * Governance-default allowed paths.
 * Artifact output is always allowed regardless of touchedAreas.
 */
const GOVERNANCE_ALLOWED_PATHS: ScopePathRule[] = [
  {
    pattern: 'out/sprints/',
    type: 'prefix',
    source: 'governance-default',
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Derive a scope contract from an envelope and project profile.
 *
 * Allowed paths come from envelope.touchedAreas + governance defaults.
 * Forbidden paths come from governance defaults + profile runtimeSensitiveAreas
 * that are NOT in touchedAreas.
 */
export function deriveScopeContract(
  envelope: TaskEnvelope,
  profile: ProjectProfile
): ScopeContract {
  const touchedSet = new Set((envelope.touchedAreas ?? []).map(a => normalizePath(a)));

  // --- Allowed paths ---
  const allowedPaths: ScopePathRule[] = [
    ...GOVERNANCE_ALLOWED_PATHS,
    ...(envelope.touchedAreas ?? []).map(
      (area): ScopePathRule => ({
        pattern: normalizePath(area),
        type: 'prefix',
        source: 'envelope',
      })
    ),
  ];

  // --- Forbidden paths ---
  const forbiddenPaths: ScopePathRule[] = [...GOVERNANCE_FORBIDDEN_PATHS];

  // Add profile runtimeSensitiveAreas that are NOT in touchedAreas
  for (const sensitive of profile.runtimeSensitiveAreas ?? []) {
    const normalized = normalizePath(sensitive);
    const isTouched = [...touchedSet].some(
      t => normalized.startsWith(t) || t.startsWith(normalized)
    );
    if (!isTouched) {
      forbiddenPaths.push({
        pattern: normalized,
        type: 'prefix',
        source: 'profile',
      });
    }
  }

  // --- Notes ---
  const notes: string[] = [
    `Derived from envelope ${envelope.taskId}`,
    `Profile: ${profile.projectId}`,
    `Boundary mode: strict (fail-closed Rule 9)`,
  ];

  return {
    contractVersion: CONTRACT_VERSION,
    taskId: envelope.taskId,
    generatedAt: new Date().toISOString(),
    allowedPaths,
    forbiddenPaths,
    boundaryMode: 'strict',
    notes,
  };
}

/**
 * Validate a single file path against a scope contract.
 *
 * Priority: forbidden first → allowed → outside_allowed (fail-closed).
 */
export function validateFileAgainstScope(
  filePath: string,
  contract: ScopeContract
): { allowed: boolean; violation: BoundaryViolation | null } {
  const normalized = normalizePath(filePath);

  // 1. Check forbidden paths first
  for (const rule of contract.forbiddenPaths) {
    if (matchesPathRule(normalized, rule)) {
      return {
        allowed: false,
        violation: {
          filePath: normalized,
          violationType: 'in_forbidden',
          matchedRule: rule,
          severity: 'blocking',
        },
      };
    }
  }

  // 2. Check allowed paths
  for (const rule of contract.allowedPaths) {
    if (matchesPathRule(normalized, rule)) {
      return { allowed: true, violation: null };
    }
  }

  // 3. Not in any allowed list → fail-closed
  return {
    allowed: false,
    violation: {
      filePath: normalized,
      violationType: 'outside_allowed',
      matchedRule: null,
      severity: 'blocking',
    },
  };
}

/**
 * Test whether a file path matches a scope path rule.
 */
export function matchesPathRule(filePath: string, rule: ScopePathRule): boolean {
  const normalizedPath = normalizePath(filePath);
  const normalizedPattern = normalizePath(rule.pattern);

  switch (rule.type) {
    case 'exact':
      return normalizedPath === normalizedPattern;

    case 'prefix':
      return normalizedPath.startsWith(normalizedPattern);

    case 'glob': {
      // Simple glob handling: dir/** → prefix match on dir/
      if (normalizedPattern.endsWith('/**')) {
        const prefix = normalizedPattern.slice(0, -2); // remove **
        return normalizedPath.startsWith(prefix);
      }
      // *.ext → endsWith check
      if (normalizedPattern.startsWith('*.')) {
        const ext = normalizedPattern.slice(1); // e.g. ".ts"
        return normalizedPath.endsWith(ext);
      }
      // Fallback: treat as prefix
      return normalizedPath.startsWith(normalizedPattern);
    }

    default:
      return false;
  }
}
