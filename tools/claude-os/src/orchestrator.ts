/**
 * Claude OS — Autopilot Orchestrator
 *
 * Composes a single bounded autopilot cycle: scan → select → execute pipeline → stop.
 * Never throws. Never auto-merges. One issue at a time.
 *
 * The pipeline runs: envelope → plan → implement_start → verify → git_evidence → bundle.
 * On success, the issue transitions to awaiting_ratification (human reviews proof bundle).
 */

import { assembleBundle } from './bundle-assembler.js';
import { generateEnvelope } from './envelope-generator.js';
import { resolveRepoPath, safeReadJson } from './fs-utils.js';
import { captureGitEvidence } from './git-evidence.js';
import { startImplementation } from './implementation-engine.js';
import { loadProfileById } from './profile-loader.js';
import { scanIssueQueue, selectNextIssue } from './queue-manager.js';
import { assembleSprintPlanWithProfile } from './sprint-planner.js';
import { executeVerification } from './verification-executor.js';
import {
  loadWorkflowState,
  saveWorkflowState,
  transitionIssue,
  setActiveRun,
  clearActiveRun,
} from './workflow-state.js';

import type { QueueManagerOptions } from './queue-manager.js';
import type {
  PipelineStage,
  PipelineStageResult,
  AutopilotCycleResult,
  AutopilotCycleStatus,
  CommandRunner,
  SprintExecutionRequest,
  SprintType,
} from './types.js';
import type { WorkflowStateOptions } from './workflow-state.js';


// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUTOPILOT_STATE_PATH = 'runtime_config/autopilot_state.json';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface OrchestratorOptions {
  queueOptions?: QueueManagerOptions;
  workflowStateOptions?: WorkflowStateOptions;
  commandRunner?: CommandRunner;
  dryRun?: boolean;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Check if autopilot is frozen via runtime_config/autopilot_state.json. */
export function checkAutopilotFrozen(options?: { autopilotStatePath?: string }): boolean {
  const filePath = options?.autopilotStatePath ?? resolveRepoPath(AUTOPILOT_STATE_PATH);
  const result = safeReadJson<{ frozen?: boolean }>(filePath);
  if (result.success && result.content) {
    return result.content.frozen === true;
  }
  // If the file is missing or unreadable, treat as NOT frozen (fail-open for reading state)
  return false;
}

/**
 * Run a single bounded autopilot cycle.
 * Scans the queue, selects the next eligible issue, executes the pipeline,
 * and transitions to awaiting_ratification on success.
 * Never throws.
 */
export function runAutopilotCycle(options?: OrchestratorOptions): AutopilotCycleResult {
  const startedAt = new Date().toISOString();
  const pipelineResults: PipelineStageResult[] = [];

  // Gate: frozen check
  if (checkAutopilotFrozen()) {
    return {
      status: 'FROZEN',
      issueId: null,
      pipelineResults: [],
      finalState: null,
      startedAt,
      completedAt: new Date().toISOString(),
      reason: 'Autopilot is frozen via runtime_config/autopilot_state.json',
    };
  }

  // Load workflow state
  const workflowState = loadWorkflowState(options?.workflowStateOptions);

  // Scan issue queue
  const scanResult = scanIssueQueue(options?.queueOptions);

  // Ensure all scanned issues have workflow entries
  for (const si of scanResult.issues) {
    if (!workflowState.issues[si.issueId]) {
      transitionIssue(workflowState, si.issueId, 'discovered', 'Discovered during queue scan');
    }
  }
  workflowState.lastScanAt = scanResult.scannedAt;

  // Select next issue
  const selection = selectNextIssue(scanResult, workflowState);

  if (!selection.selected) {
    saveWorkflowState(workflowState, options?.workflowStateOptions);
    return {
      status: 'NO_ELIGIBLE',
      issueId: null,
      pipelineResults: [],
      finalState: null,
      startedAt,
      completedAt: new Date().toISOString(),
      reason: selection.reason,
    };
  }

  const selectedIssue = selection.selected;
  const issueId = selectedIssue.issueId;

  // Transition: discovered/failed → eligible → running
  transitionIssue(workflowState, issueId, 'eligible', 'Selected for autopilot execution');
  transitionIssue(workflowState, issueId, 'running', 'Pipeline execution started');
  setActiveRun(workflowState, issueId, 'envelope');

  // Dry-run: stop before executing pipeline
  if (options?.dryRun) {
    // Roll back to eligible (don't leave in running state for dry-run)
    workflowState.issues[issueId].state = 'eligible';
    workflowState.issues[issueId].reason = 'Dry-run — pipeline not executed';
    clearActiveRun(workflowState);
    saveWorkflowState(workflowState, options?.workflowStateOptions);
    return {
      status: 'COMPLETED',
      issueId,
      pipelineResults: [],
      finalState: 'eligible',
      startedAt,
      completedAt: new Date().toISOString(),
      reason: `Dry-run: would execute pipeline for ${issueId}`,
    };
  }

  // Save state before pipeline (in case of crash)
  saveWorkflowState(workflowState, options?.workflowStateOptions);

  // --- Execute pipeline stages ---

  // Stage 1: Envelope
  const envelopeResult = runStage('envelope', () => {
    const profileResult = loadProfileById(selectedIssue.issue.projectId);
    if (!profileResult.success || !profileResult.profile) {
      throw new Error(`Failed to load profile: ${profileResult.errors.join(', ')}`);
    }
    const result = generateEnvelope(selectedIssue.issue, profileResult.profile, { write: true });
    if (!result.success) {
      throw new Error(`Envelope generation failed: ${result.errors.join(', ')}`);
    }
    return result;
  });
  pipelineResults.push(envelopeResult.stageResult);
  if (!envelopeResult.stageResult.success) {
    return failCycle(
      workflowState,
      issueId,
      pipelineResults,
      startedAt,
      envelopeResult.stageResult.error!,
      options
    );
  }

  // Stage 2: Plan
  workflowState.activeRun!.pipelineStage = 'plan';
  const planResult = runStage('plan', () => {
    const profileResult = loadProfileById(selectedIssue.issue.projectId);
    const profile = profileResult.profile!;
    const envelope = envelopeResult.value.envelope!;

    const request: SprintExecutionRequest = {
      sprintId: envelope.taskId,
      sprintType: envelope.taskType as SprintType,
      summary: envelope.summary,
      objective: envelope.objective,
      touchedAreas: envelope.touchedAreas,
      runtimeProofRequired: envelope.runtimeProofRequired,
    };

    const plan = assembleSprintPlanWithProfile(request, profile, envelope);
    if (plan.status === 'blocked') {
      throw new Error(
        `Plan is blocked: ${plan.failClosedBlockers.map(b => b.description).join(', ')}`
      );
    }
    return plan;
  });
  pipelineResults.push(planResult.stageResult);
  if (!planResult.stageResult.success) {
    return failCycle(
      workflowState,
      issueId,
      pipelineResults,
      startedAt,
      planResult.stageResult.error!,
      options
    );
  }

  const plan = planResult.value;
  const artifactRoot = resolveRepoPath(plan.artifactPlan.canonicalRoot);

  // Stage 3: Implement Start
  workflowState.activeRun!.pipelineStage = 'implement_start';
  const implResult = runStage('implement_start', () => {
    const profileResult = loadProfileById(selectedIssue.issue.projectId);
    const profile = profileResult.profile!;
    const envelope = envelopeResult.value.envelope!;

    const result = startImplementation(envelope, profile, artifactRoot, {
      commandRunner: options?.commandRunner,
    });
    if (!result.success) {
      throw new Error(`Implementation start failed: ${result.errors.join(', ')}`);
    }
    return result;
  });
  pipelineResults.push(implResult.stageResult);
  if (!implResult.stageResult.success) {
    return failCycle(
      workflowState,
      issueId,
      pipelineResults,
      startedAt,
      implResult.stageResult.error!,
      options
    );
  }

  // Stage 4: Verify
  workflowState.activeRun!.pipelineStage = 'verify';
  const verifyResult = runStage('verify', () => {
    const result = executeVerification(plan, {
      commandRunner: options?.commandRunner,
    });
    if (result.overallStatus !== 'PASS') {
      throw new Error(`Verification ${result.overallStatus}`);
    }
    return result;
  });
  pipelineResults.push(verifyResult.stageResult);
  if (!verifyResult.stageResult.success) {
    return failCycle(
      workflowState,
      issueId,
      pipelineResults,
      startedAt,
      verifyResult.stageResult.error!,
      options
    );
  }

  // Stage 5: Git Evidence
  workflowState.activeRun!.pipelineStage = 'git_evidence';
  const gitResult = runStage('git_evidence', () => {
    return captureGitEvidence(artifactRoot, {
      commandRunner: options?.commandRunner,
    });
  });
  pipelineResults.push(gitResult.stageResult);
  if (!gitResult.stageResult.success) {
    return failCycle(
      workflowState,
      issueId,
      pipelineResults,
      startedAt,
      gitResult.stageResult.error!,
      options
    );
  }

  // Stage 6: Bundle
  workflowState.activeRun!.pipelineStage = 'bundle';
  const bundleResult = runStage('bundle', () => {
    const result = assembleBundle({ plan, verificationResult: verifyResult.value });
    if (!result.success) {
      throw new Error('Bundle assembly failed');
    }
    return result;
  });
  pipelineResults.push(bundleResult.stageResult);
  if (!bundleResult.stageResult.success) {
    return failCycle(
      workflowState,
      issueId,
      pipelineResults,
      startedAt,
      bundleResult.stageResult.error!,
      options
    );
  }

  // Success: transition running → proof_ready → awaiting_ratification
  transitionIssue(workflowState, issueId, 'proof_ready', 'Pipeline completed successfully');
  transitionIssue(
    workflowState,
    issueId,
    'awaiting_ratification',
    'Proof bundle ready for human review'
  );
  clearActiveRun(workflowState);
  saveWorkflowState(workflowState, options?.workflowStateOptions);

  return {
    status: 'COMPLETED',
    issueId,
    pipelineResults,
    finalState: 'awaiting_ratification',
    startedAt,
    completedAt: new Date().toISOString(),
    reason: `Pipeline completed for ${issueId}. Awaiting human ratification.`,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface StageRunResult<T> {
  stageResult: PipelineStageResult;
  value: T;
}

function runStage<T>(stage: PipelineStage, fn: () => T): StageRunResult<T> {
  const start = Date.now();
  try {
    const value = fn();
    return {
      stageResult: { stage, success: true, error: null, durationMs: Date.now() - start },
      value,
    };
  } catch (err) {
    return {
      stageResult: {
        stage,
        success: false,
        error: (err as Error).message,
        durationMs: Date.now() - start,
      },
      value: undefined as unknown as T,
    };
  }
}

function failCycle(
  workflowState: import('./types.js').WorkflowStateFile,
  issueId: string,
  pipelineResults: PipelineStageResult[],
  startedAt: string,
  error: string,
  options?: OrchestratorOptions
): AutopilotCycleResult {
  transitionIssue(workflowState, issueId, 'failed', error);
  clearActiveRun(workflowState);
  saveWorkflowState(workflowState, options?.workflowStateOptions);

  return {
    status: 'FAILED',
    issueId,
    pipelineResults,
    finalState: 'failed',
    startedAt,
    completedAt: new Date().toISOString(),
    reason: error,
  };
}
