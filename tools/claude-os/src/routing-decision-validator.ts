/**
 * Routing Decision Validator (COS-007)
 *
 * Validates that a well-formed LLM_ROUTING_DECISION.md exists in the sprint
 * output directory before sprint:close is allowed to complete.
 *
 * Required fields (checked by markdown content scan):
 *   - Sprint identifier
 *   - Work type(s) / classifications
 *   - Instance mode (SINGLE_INSTANCE | TWO_INSTANCES | THREE_INSTANCES)
 *   - Lane assignments (at least one lane entry)
 *
 * File location convention:
 *   out/sprints/<sprint_id>/<YYYY-MM-DD>/LLM_ROUTING_DECISION.md
 *
 * When multiple date directories exist, the most recently named (lexicographic
 * sort descending) directory is checked first.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { resolveRepoPath } from './fs-utils.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoutingDecisionValidationResult {
  /** Whether the routing decision is present and well-formed */
  valid: boolean;
  /** Absolute path to the file that was found (null if not found) */
  filePath: string | null;
  /** Validation errors — empty when valid=true */
  errors: string[];
}

/** Options for overriding paths in tests */
export interface RoutingDecisionValidatorOptions {
  /** Override repo root for resolving out/sprints/ (useful in tests) */
  repoRoot?: string;
}

// ---------------------------------------------------------------------------
// Required field patterns
// ---------------------------------------------------------------------------

/**
 * Each entry is [fieldName, regex] — the regex is tested against the full file
 * content. A failing match produces an error for that field.
 */
const REQUIRED_FIELD_PATTERNS: Array<[string, RegExp]> = [
  ['Sprint identifier', /\*\*Sprint\*\*:/m],
  ['Work type(s) / Classifications', /\*\*Classifications\*\*:/im],
  ['Instance mode', /SINGLE_INSTANCE|TWO_INSTANCES|THREE_INSTANCES/],
  ['Lane assignments', /\| Lane /m],
];

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

/**
 * Locate LLM_ROUTING_DECISION.md in the sprint output directory.
 * Searches all date-subdirectories (most recent first).
 * Returns the absolute path of the first match, or null.
 */
export function findRoutingDecisionFile(
  sprintId: string,
  options?: RoutingDecisionValidatorOptions
): string | null {
  const resolve = (p: string) =>
    options?.repoRoot ? path.join(options.repoRoot, p) : resolveRepoPath(p);

  const sprintsDir = resolve(`out/sprints/${sprintId}`);
  if (!fs.existsSync(sprintsDir)) return null;

  let dateDirs: string[];
  try {
    dateDirs = fs
      .readdirSync(sprintsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .sort()
      .reverse(); // most-recent date string first
  } catch {
    return null;
  }

  for (const dateDir of dateDirs) {
    const candidate = path.join(sprintsDir, dateDir, 'LLM_ROUTING_DECISION.md');
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate that a well-formed LLM_ROUTING_DECISION.md exists for the given
 * sprint.
 *
 * Returns { valid: true } when the file is found and all required fields are
 * present. Returns { valid: false, errors } otherwise.
 */
export function validateRoutingDecision(
  sprintId: string,
  options?: RoutingDecisionValidatorOptions
): RoutingDecisionValidationResult {
  const resolve = (p: string) =>
    options?.repoRoot ? path.join(options.repoRoot, p) : resolveRepoPath(p);

  const sprintsDir = resolve(`out/sprints/${sprintId}`);
  if (!fs.existsSync(sprintsDir)) {
    return {
      valid: false,
      filePath: null,
      errors: [`Sprint output directory not found: out/sprints/${sprintId}/`],
    };
  }

  const filePath = findRoutingDecisionFile(sprintId, options);
  if (!filePath) {
    return {
      valid: false,
      filePath: null,
      errors: [
        `LLM_ROUTING_DECISION.md not found in out/sprints/${sprintId}/*/`,
        'Run the LLM router before closing: npx tsx tools/claude-os/src/cli.ts route --sprint <ID> ...',
      ],
    };
  }

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return {
      valid: false,
      filePath,
      errors: [`Failed to read ${filePath}`],
    };
  }

  const errors: string[] = [];
  for (const [fieldName, pattern] of REQUIRED_FIELD_PATTERNS) {
    if (!pattern.test(content)) {
      errors.push(`Missing required field in LLM_ROUTING_DECISION.md: ${fieldName}`);
    }
  }

  return { valid: errors.length === 0, filePath, errors };
}
