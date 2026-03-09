/**
 * Claude OS — Autonomy Policy (CLAUDE-OS-REDESIGN-001)
 *
 * Pure function that evaluates whether an issue is safe for
 * automated (bounded autopilot) execution.
 *
 * Redesigned to be execution-level-aware:
 * - Reads defaultExecutionLevel and taskTypeExecutionLevels from project profile
 * - Only Level 0 (AUTOPILOT) and Level 1 (GUIDED) work is eligible for autopilot
 * - Level 2+ (SUPERVISED, COLLABORATIVE, HUMAN_LED) requires human involvement
 *
 * Conservative defaults preserved: only docs and build_fix are auto-allowed
 * when no profile execution levels are configured.
 */

import { MAX_AUTOPILOT_LEVEL, EXECUTION_LEVEL_NAMES } from './types.js';

import type {
  IssueFile,
  EligibilityResult,
  SprintType,
  ExecutionLevel,
  ProjectProfile,
  AutonomyDecision,
  AutonomyPolicyCheck,
  AutonomyPolicyResult,
} from './types.js';


// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_ALLOWED_TASK_TYPES: SprintType[] = ['docs', 'build_fix'];

/** Default execution levels when no profile is configured */
const DEFAULT_TASK_TYPE_LEVELS: Record<SprintType, ExecutionLevel> = {
  docs: 0,
  build_fix: 1,
  ui: 2,
  runtime: 2,
  schema: 3,
  e2e_lifecycle: 3,
};

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface AutonomyPolicyOptions {
  /** Task types allowed for autonomous execution (default: docs, build_fix) */
  allowedTaskTypes?: SprintType[];
  /** Block urgent-priority issues (default: true) */
  blockUrgent?: boolean;
  /** Project profile for execution level resolution */
  profile?: ProjectProfile;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve the effective execution level for an issue.
 * Checks profile overrides, escalation triggers, and falls back to defaults.
 */
export function resolveExecutionLevel(
  issue: IssueFile,
  profile?: ProjectProfile | null
): ExecutionLevel {
  const profileDefault = profile?.defaultExecutionLevel;
  const taskTypeOverride = profile?.taskTypeExecutionLevels?.[issue.taskType];

  // Start with task-type-specific level
  let level: ExecutionLevel =
    taskTypeOverride ?? DEFAULT_TASK_TYPE_LEVELS[issue.taskType] ?? profileDefault ?? 2;

  // Apply profile default as floor
  if (profileDefault !== undefined && level < profileDefault) {
    level = profileDefault;
  }

  // Check escalation triggers
  if (profile?.escalationTriggers) {
    for (const trigger of profile.escalationTriggers) {
      const matches = issue.touchedAreas.some(
        area => area.includes(trigger.pattern) || trigger.pattern.includes(area)
      );
      if (matches && trigger.minLevel > level) {
        level = trigger.minLevel;
      }
    }
  }

  return level as ExecutionLevel;
}

/**
 * Evaluate autonomy policy for an issue.
 * Returns ALLOW only if ALL checks pass. DENY if any fail.
 *
 * When a profile with execution levels is provided, uses the execution
 * level system. Falls back to task-type allowlist for backward compatibility.
 */
export function evaluateAutonomyPolicy(
  issue: IssueFile,
  eligibility: EligibilityResult,
  options?: AutonomyPolicyOptions
): AutonomyPolicyResult {
  const blockUrgent = options?.blockUrgent ?? true;
  const profile = options?.profile;

  const checks: AutonomyPolicyCheck[] = [];

  // Check 1: Eligibility must be ELIGIBLE
  checks.push({
    name: 'eligibility_passed',
    passed: eligibility.status === 'ELIGIBLE',
    reason:
      eligibility.status === 'ELIGIBLE'
        ? 'Issue passed eligibility checks'
        : `Issue eligibility is ${eligibility.status}`,
  });

  // Check 2: Execution level / task type must allow autopilot
  if (profile?.defaultExecutionLevel !== undefined || profile?.taskTypeExecutionLevels) {
    // Execution-level-aware check (new model)
    const level = resolveExecutionLevel(issue, profile);
    const levelName = EXECUTION_LEVEL_NAMES[level];
    const allowed = level <= MAX_AUTOPILOT_LEVEL;

    checks.push({
      name: 'execution_level_allows_autopilot',
      passed: allowed,
      reason: allowed
        ? `Execution level ${level} (${levelName}) is within autopilot range (0-${MAX_AUTOPILOT_LEVEL})`
        : `Execution level ${level} (${levelName}) requires supervised execution (max autopilot: ${MAX_AUTOPILOT_LEVEL})`,
    });
  } else {
    // Legacy task-type allowlist check (backward compatible)
    const allowedTypes = options?.allowedTaskTypes ?? DEFAULT_ALLOWED_TASK_TYPES;
    const typeAllowed = allowedTypes.includes(issue.taskType);
    checks.push({
      name: 'task_type_allowed',
      passed: typeAllowed,
      reason: typeAllowed
        ? `Task type '${issue.taskType}' is in allowed list`
        : `Task type '${issue.taskType}' is not in allowed list [${allowedTypes.join(', ')}]`,
    });
  }

  // Check 3: Priority must not be urgent (unless opt-out)
  const isUrgent = issue.priority === 'urgent';
  const priorityOk = !blockUrgent || !isUrgent;
  checks.push({
    name: 'priority_not_urgent',
    passed: priorityOk,
    reason: priorityOk
      ? `Priority '${issue.priority}' is acceptable`
      : 'Urgent priority issues require human attention',
  });

  // Check 4: No schema migration paths in touchedAreas
  const hasMigrationPaths = issue.touchedAreas.some(area => area.includes('supabase/migrations'));
  checks.push({
    name: 'no_schema_migration_paths',
    passed: !hasMigrationPaths,
    reason: hasMigrationPaths
      ? 'touchedAreas includes schema migration paths'
      : 'No schema migration paths detected',
  });

  // Decision: ALLOW only if all checks pass
  const denialReasons = checks.filter(c => !c.passed).map(c => c.reason);

  return {
    decision: denialReasons.length === 0 ? 'ALLOW' : 'DENY',
    issueId: issue.issueId,
    checks,
    denialReasons,
  };
}
