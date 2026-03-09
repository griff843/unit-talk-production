/**
 * Claude OS — Failure Classifier (CLAUDE-OS-REDESIGN-001)
 *
 * Pure function that categorizes verification failures into distinct classes:
 *   application, infrastructure, toolchain, environment, governance, transient
 *
 * This replaces the binary PASS/FAIL model with rich failure classification
 * so engineers can distinguish "my code is broken" from "the database is down."
 *
 * No I/O — all inputs and outputs are plain data.
 */

import type {
  CommandRunResult,
  VerificationRequirement,
  ClassifiedFailure,
  FailureCategory,
} from './types.js';

// ---------------------------------------------------------------------------
// Pattern tables
// ---------------------------------------------------------------------------

interface FailurePattern {
  category: FailureCategory;
  /** Regex tested against combined stdout + stderr */
  pattern: RegExp;
  confidence: number;
  retryable: boolean;
  suggestedAction: string;
}

const FAILURE_PATTERNS: FailurePattern[] = [
  // --- Governance ---
  {
    category: 'governance',
    pattern: /GATE\s+FAILED|LIFECYCLE\s+GATE\s+VIOLATION|single.?writer\s+violation/i,
    confidence: 0.95,
    retryable: false,
    suggestedAction: 'Refactor to use lifecycle adapters. See Rule 03.',
  },
  {
    category: 'governance',
    pattern: /violations?\s+found:\s*[1-9]/i,
    confidence: 0.9,
    retryable: false,
    suggestedAction: 'Fix single-writer violations before proceeding.',
  },

  // --- Infrastructure ---
  {
    category: 'infrastructure',
    pattern: /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|connection\s+refused/i,
    confidence: 0.9,
    retryable: true,
    suggestedAction: 'Check that required services (Supabase, API) are running.',
  },
  {
    category: 'infrastructure',
    pattern: /ECONNRESET|EPIPE|socket\s+hang\s+up/i,
    confidence: 0.85,
    retryable: true,
    suggestedAction: 'Service connection dropped. Retry or check service health.',
  },
  {
    category: 'infrastructure',
    pattern: /503\s+Service\s+Unavailable|502\s+Bad\s+Gateway|504\s+Gateway/i,
    confidence: 0.9,
    retryable: true,
    suggestedAction: 'Upstream service is unavailable. Wait and retry.',
  },
  {
    category: 'infrastructure',
    pattern: /database.*(?:unavailable|unreachable|connection)|supabase.*(?:error|fail)/i,
    confidence: 0.85,
    retryable: true,
    suggestedAction: 'Database connection issue. Check Supabase status.',
  },

  // --- Environment ---
  {
    category: 'environment',
    pattern: /Cannot\s+find\s+module|MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND/i,
    confidence: 0.85,
    retryable: false,
    suggestedAction: 'Run pnpm install to restore dependencies.',
  },
  {
    category: 'environment',
    pattern: /ENOENT.*node_modules|node_modules.*corrupt/i,
    confidence: 0.9,
    retryable: false,
    suggestedAction: 'Delete node_modules and run pnpm install.',
  },
  {
    category: 'environment',
    pattern: /EACCES|permission\s+denied|EPERM/i,
    confidence: 0.8,
    retryable: false,
    suggestedAction: 'Check file permissions in the working directory.',
  },
  {
    category: 'environment',
    pattern: /git.*index\.lock|Unable\s+to\s+create.*\.lock/i,
    confidence: 0.9,
    retryable: false,
    suggestedAction: 'Remove stale lock file (e.g., .git/index.lock).',
  },
  {
    category: 'environment',
    pattern: /ENOMEM|JavaScript\s+heap\s+out\s+of\s+memory/i,
    confidence: 0.9,
    retryable: false,
    suggestedAction: 'Increase Node.js memory limit or close other processes.',
  },

  // --- Toolchain ---
  {
    category: 'toolchain',
    pattern: /TODO:.*(?:requires|define|manual)|command\s+not\s+found/i,
    confidence: 0.95,
    retryable: false,
    suggestedAction: 'Resolve the recipe command placeholder before execution.',
  },
  {
    category: 'toolchain',
    pattern: /playwright.*not\s+(?:installed|found)|npx\s+playwright\s+install/i,
    confidence: 0.9,
    retryable: false,
    suggestedAction: 'Install Playwright: npx playwright install.',
  },
  {
    category: 'toolchain',
    pattern: /ENOENT.*(?:tsc|eslint|vitest|playwright)/i,
    confidence: 0.85,
    retryable: false,
    suggestedAction: 'Install missing toolchain dependency.',
  },

  // --- Transient ---
  {
    category: 'transient',
    pattern: /SIGTERM|SIGKILL|killed/i,
    confidence: 0.7,
    retryable: true,
    suggestedAction: 'Process was killed. May be a timeout or OOM. Retry with higher limits.',
  },
  {
    category: 'transient',
    pattern: /EBUSY|resource\s+busy/i,
    confidence: 0.75,
    retryable: true,
    suggestedAction: 'Resource temporarily busy. Wait and retry.',
  },
  {
    category: 'transient',
    pattern: /flaky|intermittent|retry/i,
    confidence: 0.5,
    retryable: true,
    suggestedAction: 'Possible flaky test. Re-run to confirm.',
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classify a verification step failure.
 *
 * Returns the best-matching failure classification based on pattern matching
 * against the command's stdout and stderr output.
 *
 * If no specific pattern matches, defaults to 'application' (code bug)
 * since that is the most common failure class and the safest default
 * (does not weaken fail-closed behavior).
 */
export function classifyFailure(
  requirement: VerificationRequirement,
  commandResult: CommandRunResult | null
): ClassifiedFailure {
  // Unresolved command → toolchain issue
  if (!requirement.commandResolved) {
    return {
      category: 'toolchain',
      confidence: 1.0,
      retryable: false,
      evidence: 'Recipe command is unresolved (placeholder)',
      suggestedAction: 'Resolve the recipe command placeholder before execution.',
    };
  }

  // No command result → environment/internal issue
  if (commandResult === null) {
    return {
      category: 'environment',
      confidence: 0.7,
      retryable: false,
      evidence: 'No command result — internal execution error',
      suggestedAction: 'Check Claude OS command runner configuration.',
    };
  }

  // Timeout → transient by default
  if (commandResult.timedOut) {
    return {
      category: 'transient',
      confidence: 0.75,
      retryable: true,
      evidence: `Command timed out after ${commandResult.durationMs}ms`,
      suggestedAction: 'Increase timeout or investigate slow execution.',
    };
  }

  // Pattern match against combined output
  const combined = (commandResult.stdout || '') + '\n' + (commandResult.stderr || '');
  const match = findBestMatch(combined);

  if (match) {
    return {
      category: match.category,
      confidence: match.confidence,
      retryable: match.retryable,
      evidence: `Matched pattern: ${match.pattern.source}`,
      suggestedAction: match.suggestedAction,
    };
  }

  // Default: application failure (safest — does not weaken fail-closed)
  return {
    category: 'application',
    confidence: 0.6,
    retryable: false,
    evidence: `Exit code ${commandResult.exitCode} with no specific infrastructure/env/toolchain pattern`,
    suggestedAction: 'Investigate test/build output for application-level failures.',
  };
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function findBestMatch(output: string): FailurePattern | null {
  let best: FailurePattern | null = null;
  let bestConfidence = 0;

  for (const pattern of FAILURE_PATTERNS) {
    if (pattern.pattern.test(output) && pattern.confidence > bestConfidence) {
      best = pattern;
      bestConfidence = pattern.confidence;
    }
  }

  return best;
}
