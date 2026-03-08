/**
 * Claude OS — Verification Executor
 *
 * Orchestrator that ties all Phase C modules together.
 * Runs verification commands, classifies outcomes, captures evidence,
 * and enforces the runtime proof gate.
 *
 * Never mutates code. Never commits. Never pushes.
 */

import {
  isBrowserRecipe,
  checkPlaywrightAvailability,
  resolveBrowserArtifactExpectations,
  collectBrowserArtifacts,
} from './browser-recipe-resolver.js';
import { runCommand } from './command-runner.js';
import {
  createEvidenceDirectories,
  captureStepEvidence,
  writeEvidenceIndex,
} from './evidence-capture.js';
import { resolveRepoPath } from './fs-utils.js';
import { evaluateRuntimeProofGate } from './runtime-proof-gate.js';
import { classifyStep, deriveOverallStatus } from './verification-classifier.js';

import type {
  SprintExecutionPlan,
  CommandRunner,
  CommandRunResult,
  VerificationStepResult,
  VerificationExecutionResult,
  VerificationSummary,
} from './types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for verification execution */
export interface VerificationExecutionOptions {
  /** Custom command runner for testing (defaults to real runCommand) */
  commandRunner?: CommandRunner;
  /** Default timeout for commands in ms (defaults to 120000) */
  defaultTimeoutMs?: number;
  /** If true, classify without executing — no side effects */
  dryRun?: boolean;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Execute all verification steps in a sprint execution plan.
 *
 * Runs every step regardless of failures to produce a complete report.
 * Evidence is written to the artifact root unless in dry-run mode.
 */
export function executeVerification(
  plan: SprintExecutionPlan,
  options?: VerificationExecutionOptions
): VerificationExecutionResult {
  const runner = options?.commandRunner ?? runCommand;
  const defaultTimeoutMs = options?.defaultTimeoutMs ?? 120_000;
  const dryRun = options?.dryRun ?? false;

  // Step 1: Create evidence directories (skip in dry-run)
  if (!dryRun) {
    createEvidenceDirectories(plan.artifactPlan);
  }

  // Step 2: Execute each verification requirement
  const steps: VerificationStepResult[] = [];

  for (const req of plan.verificationRequirements) {
    const stepStart = Date.now();
    let commandResult: CommandRunResult | null = null;

    if (dryRun) {
      // Dry run: classify without executing
      const classification = req.commandResolved
        ? {
            status: 'SKIPPED' as const,
            reason: `Dry run — would execute: ${req.commandPlaceholder}`,
          }
        : classifyStep(req, null);

      steps.push({
        recipeId: req.recipeId,
        status: classification.status,
        reason: classification.reason,
        commandResult: null,
        outputFile: req.outputFile || null,
        durationMs: Date.now() - stepStart,
      });
      continue;
    }

    if (req.commandResolved) {
      // For browser recipes, check Playwright availability first (fail closed)
      if (isBrowserRecipe(req)) {
        const pwCheck = checkPlaywrightAvailability();
        if (!pwCheck.available) {
          const step: VerificationStepResult = {
            recipeId: req.recipeId,
            status: req.required ? 'BLOCKED' : 'SKIPPED',
            reason: `Playwright unavailable: ${pwCheck.reason}`,
            commandResult: null,
            outputFile: req.outputFile || null,
            durationMs: Date.now() - stepStart,
            browserArtifacts: [],
          };
          steps.push(step);
          captureStepEvidence(step, null, plan.artifactPlan);
          continue;
        }
      }

      // Execute the command
      commandResult = runner(req.commandPlaceholder, {
        timeoutMs: defaultTimeoutMs,
      });
    }

    // Classify the outcome
    const classification = classifyStep(req, commandResult);

    const step: VerificationStepResult = {
      recipeId: req.recipeId,
      status: classification.status,
      reason: classification.reason,
      commandResult,
      outputFile: req.outputFile || null,
      durationMs: Date.now() - stepStart,
    };

    // Collect browser artifacts after execution
    if (isBrowserRecipe(req) && commandResult) {
      const expectations = resolveBrowserArtifactExpectations(req);
      if (expectations.length > 0) {
        const absRoot = resolveRepoPath(plan.artifactPlan.canonicalRoot);
        step.browserArtifacts = collectBrowserArtifacts(absRoot, expectations);
      }
    }

    steps.push(step);

    // Capture evidence (skip in dry-run — already guarded above)
    captureStepEvidence(step, commandResult, plan.artifactPlan);
  }

  // Step 3: Evaluate runtime proof gate
  const runtimeProofGate = evaluateRuntimeProofGate(plan, steps);

  // Step 4: Derive overall status
  const overallStatus = deriveOverallStatus(steps, plan.verificationRequirements, runtimeProofGate);

  // Step 5: Build summary
  const summary = buildSummary(steps);

  // Step 6: Assemble result
  const result: VerificationExecutionResult = {
    sprintId: plan.request.sprintId,
    steps,
    overallStatus,
    evidenceRoot: plan.artifactPlan.canonicalRoot,
    runtimeProofGate,
    summary,
    generatedAt: new Date().toISOString(),
  };

  // Step 7: Write evidence index (skip in dry-run)
  if (!dryRun) {
    writeEvidenceIndex(result, plan.artifactPlan);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSummary(steps: VerificationStepResult[]): VerificationSummary {
  return {
    total: steps.length,
    passed: steps.filter(s => s.status === 'PASS').length,
    failed: steps.filter(s => s.status === 'FAIL').length,
    blocked: steps.filter(s => s.status === 'BLOCKED').length,
    skipped: steps.filter(s => s.status === 'SKIPPED').length,
  };
}
