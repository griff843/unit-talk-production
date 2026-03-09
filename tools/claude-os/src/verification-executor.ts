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
import { classifyFailure } from './failure-classifier.js';
import { resolveRepoPath } from './fs-utils.js';
import { evaluateRuntimeProofGate } from './runtime-proof-gate.js';
import { classifyScopeForStep } from './scope-resolver.js';
import { classifyStep, deriveOverallStatus } from './verification-classifier.js';


import type {
  SprintExecutionPlan,
  BlastRadius,
  CommandRunner,
  CommandRunResult,
  VerificationStepResult,
  VerificationExecutionResult,
  VerificationSummary,
  FailureClassificationSummary,
  FailureCategory,
  ScopedVerificationStepResult,
  ScopedVerificationResult,
  ScopeVerificationSummary,
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
  /** Blast radius for scope-aware classification (CLAUDE-OS-SCOPE-HARDENING) */
  blastRadius?: BlastRadius;
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
  const defaultTimeoutMs = options?.defaultTimeoutMs ?? 300_000;
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

    // Classify failure when status is FAIL or BLOCKED (CLAUDE-OS-REDESIGN-001)
    if (step.status === 'FAIL' || step.status === 'BLOCKED') {
      step.failureClassification = classifyFailure(req, commandResult);
    }

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

  // Step 5b: Build failure classification summary (CLAUDE-OS-REDESIGN-001)
  const failureClassificationSummary = buildFailureClassificationSummary(steps);

  // Step 6: Assemble result
  const result: VerificationExecutionResult = {
    sprintId: plan.request.sprintId,
    steps,
    overallStatus,
    evidenceRoot: plan.artifactPlan.canonicalRoot,
    runtimeProofGate,
    summary,
    failureClassificationSummary,
    generatedAt: new Date().toISOString(),
  };

  // Step 7: Write evidence index (skip in dry-run)
  if (!dryRun) {
    writeEvidenceIndex(result, plan.artifactPlan);
  }

  return result;
}

/**
 * Execute scope-aware verification.
 *
 * Runs the standard verification pipeline, then classifies each step
 * relative to the sprint's blast radius. Out-of-scope failures are
 * annotated but do not block the sprint.
 *
 * CLAUDE-OS-SCOPE-HARDENING
 */
export function executeScopedVerification(
  plan: SprintExecutionPlan,
  blastRadius: BlastRadius,
  options?: VerificationExecutionOptions
): ScopedVerificationResult {
  // Run standard verification first
  const baseResult = executeVerification(plan, { ...options, blastRadius });

  // Classify each step against scope
  const scopedSteps: ScopedVerificationStepResult[] = baseResult.steps.map((step, idx) => {
    const req = plan.verificationRequirements[idx];
    const { classification, targetWorkspace } = classifyScopeForStep(req, blastRadius);

    return {
      ...step,
      scopeClassification: classification,
      targetWorkspace,
    };
  });

  // Build scope summary
  const scopeSummary = buildScopeSummary(scopedSteps);

  return {
    ...baseResult,
    blastRadius,
    scopedSteps,
    scopeSummary,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildScopeSummary(steps: ScopedVerificationStepResult[]): ScopeVerificationSummary {
  const failedSteps = steps.filter(s => s.status === 'FAIL' || s.status === 'BLOCKED');

  let inScopeFailures = 0;
  let outOfScopeFailures = 0;
  let globalBlockers = 0;

  for (const step of failedSteps) {
    switch (step.scopeClassification) {
      case 'in_scope_failure':
        inScopeFailures++;
        break;
      case 'out_of_scope_failure':
        outOfScopeFailures++;
        break;
      case 'global_blocker':
        globalBlockers++;
        break;
    }
  }

  const sprintBlocked = inScopeFailures > 0 || globalBlockers > 0;
  let blockReason: string | null = null;

  if (globalBlockers > 0 && inScopeFailures > 0) {
    blockReason = `${globalBlockers} global blocker(s) + ${inScopeFailures} in-scope failure(s)`;
  } else if (globalBlockers > 0) {
    blockReason = `${globalBlockers} global blocker(s)`;
  } else if (inScopeFailures > 0) {
    blockReason = `${inScopeFailures} in-scope failure(s)`;
  }

  return {
    inScopeFailures,
    outOfScopeFailures,
    globalBlockers,
    sprintBlocked,
    blockReason,
  };
}

function buildSummary(steps: VerificationStepResult[]): VerificationSummary {
  return {
    total: steps.length,
    passed: steps.filter(s => s.status === 'PASS').length,
    failed: steps.filter(s => s.status === 'FAIL').length,
    blocked: steps.filter(s => s.status === 'BLOCKED').length,
    skipped: steps.filter(s => s.status === 'SKIPPED').length,
  };
}

function buildFailureClassificationSummary(
  steps: VerificationStepResult[]
): FailureClassificationSummary | undefined {
  const classified = steps.filter(s => s.failureClassification);
  if (classified.length === 0) return undefined;

  const counts: FailureClassificationSummary = {
    application: 0,
    infrastructure: 0,
    toolchain: 0,
    environment: 0,
    governance: 0,
    transient: 0,
  };

  for (const step of classified) {
    const cat = step.failureClassification!.category as FailureCategory;
    counts[cat]++;
  }

  return counts;
}
