#!/usr/bin/env npx tsx
/* eslint-disable no-console */

/**
 * Claude OS — CLI Entrypoint
 *
 * Provides governed sprint planning and verification execution.
 * Does NOT mutate source code. Does NOT commit or push.
 *
 * Usage:
 *   npx tsx src/cli.ts plan --sprint SPRINT-044R --type runtime --summary "description"
 *   npx tsx src/cli.ts verify --sprint SPRINT-044R --type runtime --summary "description"
 *   npx tsx src/cli.ts validate
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  loadAuthorityLocks,
  saveAuthorityLocks,
  checkConflict,
  lockSurfaces,
  unlockSurfaces,
  getAllActiveLocks,
  getSprintLocks,
} from './authority-lock.js';
import { resolveExecutionLevel } from './autonomy-policy.js';
import { assembleBundle, loadVerificationResultFromIndex } from './bundle-assembler.js';
import {
  generateContextPack,
  checkContextPackFreshness,
  loadContextPackFromRepoPath,
} from './context-pack-generator.js';
import { checkEligibility } from './eligibility-checker.js';
import { generateEnvelope } from './envelope-generator.js';
import { loadEnvelope, envelopeToRequest } from './envelope-loader.js';
import {
  analyzeSprintFindings,
  generateFindingArtifacts,
  printFindingBacklogResult,
} from './finding-backlog.js';
import { resolveRepoPath, fileExists } from './fs-utils.js';
import { captureGitEvidence } from './git-evidence.js';
import { loadGovernance } from './governance-loader.js';
import { startImplementation, checkImplementation } from './implementation-engine.js';
import { loadIssue } from './issue-loader.js';
import { checkLifecycle } from './lifecycle-checker.js';
import { runRouterCli } from './llm-router.js';
import { runAutopilotCycle, checkAutopilotFrozen } from './orchestrator.js';
import { runPortfolioAudit } from './portfolio-audit.js';
import { loadProfileById, loadProfileFromPath } from './profile-loader.js';
import { generatePromptPack } from './prompt-pack-generator.js';
import { scanIssueQueue, selectNextIssue } from './queue-manager.js';
import { validateAllReceipts } from './receipt-validator.js';
import { validateRoutingDecision } from './routing-decision-validator.js';
import { resolveBlastRadius } from './scope-resolver.js';
import { assembleSprintPlan, assembleSprintPlanWithProfile } from './sprint-planner.js';
import {
  createSprintState,
  loadSprintState,
  saveSprintState,
  updateSprintStage,
  registerReceipt,
  closeSprintState,
  loadArchivedSprint,
  addBlocker,
} from './sprint-state.js';
import { generateStatusArtifact } from './status-artifact-generator.js';
import { EXECUTION_LEVEL_NAMES, MAX_AUTOPILOT_LEVEL } from './types.js';
import { executeVerification, executeScopedVerification } from './verification-executor.js';
import { isValidSprintType } from './verification-resolver.js';
import { loadWorkflowState } from './workflow-state.js';

import type {
  AuthoritySurface,
  ReceiptClass,
  SprintStage,
  AutopilotCycleResult,
  BlastRadius,
  BundleAssemblyResult,
  EligibilityResult,
  EnvelopeGenerationResult,
  ExecutionLevel,
  ImplementationCheckResult,
  ImplementationStartResult,
  PackageOwnershipMap,
  QueueScanResult,
  QueueSelection,
  ScopedVerificationResult,
  SprintExecutionRequest,
  SprintExecutionPlan,
  SprintType,
  SupervisedRunResult,
  ProjectProfile,
  VerificationExecutionResult,
  WorkflowStateFile,
} from './types.js';

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const c = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

// ---------------------------------------------------------------------------
// Command: findings
// ---------------------------------------------------------------------------

function commandFindings(args: Record<string, string | boolean | string[]>): void {
  const sprint = args.sprint as string | undefined;
  const dateOverride = args.date as string | undefined;
  const jsonOutput = args.json === true;
  const outDir = args.out as string | undefined;

  if (!sprint) {
    console.error(`${c.red}ERROR: --sprint <id> is required.${c.reset}`);
    console.error(
      'Usage: findings --sprint SPRINT-044-... [--out <dir>] [--json] [--date YYYY-MM-DD]'
    );
    process.exit(1);
  }

  console.log(`\n${c.bold}${c.cyan}CLAUDE OS — Finding Backlog Analysis${c.reset}`);
  console.log(`${c.dim}Sprint: ${sprint}${c.reset}\n`);

  const result = analyzeSprintFindings(sprint, [], dateOverride);

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  printFindingBacklogResult(result);

  // Write artifacts to output directory
  const effectiveOutDir =
    outDir ??
    resolveRepoPath(
      `out/sprints/${sprint}/${dateOverride ?? new Date().toISOString().slice(0, 10)}/findings`
    );

  generateFindingArtifacts(result, effectiveOutDir);

  console.log(`${c.bold}Artifacts written to:${c.reset}`);
  console.log(`  ${c.dim}${effectiveOutDir}/VERIFICATION_FINDINGS.md${c.reset}`);
  console.log(`  ${c.dim}${effectiveOutDir}/RECOMMENDED_REMEDIATION_SPRINTS.md${c.reset}`);
  console.log(`  ${c.dim}${effectiveOutDir}/LINEAR_ISSUE_DRAFTS.md${c.reset}`);
  console.log(`  ${c.dim}${effectiveOutDir}/FINDING_DECISION_LOG.md${c.reset}`);
  console.log(`  ${c.dim}${effectiveOutDir}/HANDOFF_SUMMARY.md${c.reset}`);
  console.log('');

  process.exit(0);
}

function commandPortfolioAudit(args: Record<string, string | boolean | string[]>): void {
  const jsonOutput = args.json === true;
  const outputDir = args.output as string | undefined;
  const trigger = (args.trigger as string | undefined) ?? 'cli';

  console.log(`\n${c.bold}${c.cyan}CLAUDE OS — Sprint Portfolio Optimization Audit${c.reset}\n`);

  const {
    result,
    outputDir: resolvedOutputDir,
    artifactFiles,
  } = runPortfolioAudit({
    trigger,
    outputDir,
  });

  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          result,
          outputDir: resolvedOutputDir,
          artifactFiles,
        },
        null,
        2
      )
    );
    process.exit(0);
  }

  console.log(`${c.bold}Audit ID:${c.reset} ${result.auditId}`);
  console.log(`${c.bold}Run At:${c.reset} ${result.runAt}`);
  console.log(`${c.bold}Trigger:${c.reset} ${result.trigger}`);
  console.log(`${c.bold}Sources:${c.reset} ${result.inputSources.join(', ') || 'none'}`);
  console.log(
    `${c.bold}Conservative Mode:${c.reset} ${result.conservativeMode ? c.yellow + 'YES' : c.green + 'NO'}${c.reset}`
  );

  if (result.conservativeModeReason) {
    console.log(`\n${c.yellow}${result.conservativeModeReason}${c.reset}`);
  }

  console.log(
    `\n${c.bold}Recommended Next Sprint:${c.reset} ${result.recommendedNextSprint ?? 'suppressed'}`
  );
  console.log(`${c.bold}Ranked Candidates:${c.reset} ${result.rankedNextSprints?.length ?? 0}`);
  console.log(`${c.bold}Blocked Items:${c.reset} ${result.blockedItems.length}`);
  console.log(`${c.bold}Risk Notes:${c.reset} ${result.riskNotes.length}`);

  if (result.nextActions.length > 0) {
    console.log(`\n${c.bold}Next Actions:${c.reset}`);
    for (const action of result.nextActions) {
      console.log(`  - ${action}`);
    }
  }

  console.log(`\n${c.bold}Artifacts:${c.reset}`);
  console.log(`  ${c.dim}${resolvedOutputDir}${c.reset}`);
  for (const file of artifactFiles) {
    console.log(`  ${c.dim}${file}${c.reset}`);
  }
  console.log('');

  process.exit(0);
}

// ---------------------------------------------------------------------------
// Argument Parsing
// ---------------------------------------------------------------------------

interface _PlanArgs {
  sprint: string;
  type: SprintType;
  summary: string;
  touched?: string[];
  date?: string;
  json?: boolean;
  outFile?: string;
}

function parseArgs(argv: string[]): {
  command: string;
  args: Record<string, string | boolean | string[]>;
} {
  const command = argv[2] ?? 'help';
  const args: Record<string, string | boolean | string[]> = {};

  for (let i = 3; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        // Handle comma-separated values for touched areas
        if (key === 'touched') {
          args[key] = next.split(',').map(s => s.trim());
        } else {
          args[key] = next;
        }
        i++;
      } else {
        args[key] = true;
      }
    }
  }

  return { command, args };
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function commandPlan(args: Record<string, string | boolean | string[]>): void {
  const sprint = args.sprint as string | undefined;
  const type = args.type as string | undefined;
  const summary = args.summary as string | undefined;
  const touched = args.touched as string[] | undefined;
  const date = args.date as string | undefined;
  const jsonOutput = args.json === true;
  const outFile = args.out as string | undefined;
  const projectId = args.project as string | undefined;
  const profilePath = args.profile as string | undefined;
  const envelopePath = args.envelope as string | undefined;

  // --- Load profile if specified ---
  let profile: ProjectProfile | null = null;
  if (projectId || profilePath) {
    const profileResult = profilePath
      ? loadProfileFromPath(profilePath)
      : loadProfileById(projectId!);

    if (!profileResult.success || !profileResult.profile) {
      console.error(`${c.red}ERROR: Failed to load project profile.${c.reset}`);
      for (const err of profileResult.errors) {
        console.error(`  ${err}`);
      }
      process.exit(1);
    }
    profile = profileResult.profile;
    console.log(`${c.dim}Profile loaded: ${profile.projectName} (${profile.projectId})${c.reset}`);
  }

  // --- Load envelope if specified ---
  let envelope = undefined;
  if (envelopePath) {
    const envelopeResult = loadEnvelope(envelopePath);
    if (!envelopeResult.success || !envelopeResult.envelope) {
      console.error(`${c.red}ERROR: Failed to load task envelope.${c.reset}`);
      for (const err of envelopeResult.errors) {
        console.error(`  ${err}`);
      }
      process.exit(1);
    }
    envelope = envelopeResult.envelope;
    console.log(`${c.dim}Envelope loaded: ${envelope.taskId} (${envelope.taskType})${c.reset}`);
  }

  // --- Build request: CLI args take precedence, envelope fills gaps ---
  const effectiveSprint = sprint ?? envelope?.taskId;
  const effectiveType = type ?? envelope?.taskType;
  const effectiveSummary = summary ?? envelope?.summary;

  if (!effectiveSprint || !effectiveType || !effectiveSummary) {
    console.error(`${c.red}ERROR: Missing required arguments.${c.reset}`);
    console.error('Required: --sprint <id> --type <type> --summary "<text>"');
    console.error('  (or provide --envelope <path> to derive these from a task envelope)');
    console.error(`Valid types: docs, runtime, build_fix, e2e_lifecycle, ui, schema`);
    process.exit(1);
  }

  if (!isValidSprintType(effectiveType)) {
    console.error(`${c.red}ERROR: Invalid sprint type '${effectiveType}'.${c.reset}`);
    console.error('Valid types: docs, runtime, build_fix, e2e_lifecycle, ui, schema');
    process.exit(1);
  }

  const request: SprintExecutionRequest = {
    sprintId: effectiveSprint,
    sprintType: effectiveType as SprintType,
    summary: effectiveSummary,
    objective: envelope?.objective,
    touchedAreas: touched ?? (envelope ? undefined : undefined),
    requestedArtifactDate: date,
    runtimeProofRequired: envelope?.runtimeProofRequired,
  };

  console.log(`\n${c.bold}${c.cyan}CLAUDE OS — Sprint Execution Plan${c.reset}\n`);
  console.log(`${c.dim}Assembling plan for ${effectiveSprint}...${c.reset}\n`);

  // --- Route to profile-aware or default planner ---
  let plan: SprintExecutionPlan;
  if (profile) {
    plan = assembleSprintPlanWithProfile(request, profile, envelope);
  } else {
    if (!projectId && !profilePath) {
      console.log(
        `${c.yellow}Note: Running without project profile. Pass --project <id> for profile-aware planning.${c.reset}\n`
      );
    }
    plan = assembleSprintPlan(request);
  }

  if (jsonOutput) {
    const jsonStr = JSON.stringify(plan, null, 2);
    if (outFile) {
      const outPath = path.resolve(outFile);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, jsonStr, 'utf-8');
      console.log(`${c.green}Plan written to: ${outPath}${c.reset}`);
    } else {
      console.log(jsonStr);
    }
    process.exit(plan.status === 'blocked' ? 1 : 0);
  }

  printPlan(plan, profile);
  process.exit(plan.status === 'blocked' ? 1 : 0);
}

function commandValidate(): void {
  console.log(`\n${c.bold}${c.cyan}CLAUDE OS — Governance Validation${c.reset}\n`);

  const result = loadGovernance();

  console.log(`${c.bold}Loaded Files:${c.reset} ${result.loadedFiles.length}`);
  for (const f of result.loadedFiles) {
    console.log(`  ${c.green}+${c.reset} ${f}`);
  }

  if (result.errors.length > 0) {
    console.log(`\n${c.bold}Errors:${c.reset} ${result.errors.length}`);
    for (const err of result.errors) {
      const severity = err.isFatal ? `${c.red}FATAL` : `${c.yellow}WARN`;
      console.log(`  ${severity}${c.reset} ${err.file}: ${err.error}`);
    }
  }

  console.log(`\n${c.bold}System Laws:${c.reset} ${result.systemLaws.length} loaded`);
  for (const law of result.systemLaws) {
    console.log(`  ${c.dim}${law.id}${c.reset}: ${law.name}`);
  }

  if (result.verificationRecipes) {
    console.log(
      `\n${c.bold}Verification Recipes:${c.reset} ${result.verificationRecipes.recipes.length}`
    );
    for (const recipe of result.verificationRecipes.recipes) {
      const status = recipe.command_placeholder.startsWith('TODO')
        ? `${c.yellow}[placeholder]${c.reset}`
        : `${c.green}[resolved]${c.reset}`;
      console.log(`  ${recipe.id} ${status}`);
    }
  }

  if (result.proofRecipes) {
    console.log(
      `\n${c.bold}Proof Recipes:${c.reset} ${result.proofRecipes.sprint_types.length} sprint types`
    );
    for (const recipe of result.proofRecipes.sprint_types) {
      console.log(
        `  ${recipe.type}: ${recipe.required_proof.length} required, ${recipe.optional_proof.length} optional`
      );
    }
  }

  const verdict = result.success
    ? `${c.green}${c.bold}GOVERNANCE VALID${c.reset}`
    : `${c.red}${c.bold}GOVERNANCE INVALID — ${result.errors.filter(e => e.isFatal).length} fatal error(s)${c.reset}`;

  console.log(`\n${verdict}\n`);
  process.exit(result.success ? 0 : 1);
}

function commandVerify(args: Record<string, string | boolean | string[]>): void {
  const sprint = args.sprint as string | undefined;
  const type = args.type as string | undefined;
  const summary = args.summary as string | undefined;
  const touched = args.touched as string[] | undefined;
  const date = args.date as string | undefined;
  const projectId = args.project as string | undefined;
  const profilePath = args.profile as string | undefined;
  const envelopePath = args.envelope as string | undefined;
  const dryRun = args['dry-run'] === true;
  const timeoutStr = args.timeout as string | undefined;
  const defaultTimeoutMs = timeoutStr ? parseInt(timeoutStr, 10) : undefined;

  // --- Load profile if specified ---
  let profile: ProjectProfile | null = null;
  if (projectId || profilePath) {
    const profileResult = profilePath
      ? loadProfileFromPath(profilePath)
      : loadProfileById(projectId!);

    if (!profileResult.success || !profileResult.profile) {
      console.error(`${c.red}ERROR: Failed to load project profile.${c.reset}`);
      for (const err of profileResult.errors) {
        console.error(`  ${err}`);
      }
      process.exit(1);
    }
    profile = profileResult.profile;
  }

  // --- Load envelope if specified ---
  let envelope = undefined;
  if (envelopePath) {
    const envelopeResult = loadEnvelope(envelopePath);
    if (!envelopeResult.success || !envelopeResult.envelope) {
      console.error(`${c.red}ERROR: Failed to load task envelope.${c.reset}`);
      for (const err of envelopeResult.errors) {
        console.error(`  ${err}`);
      }
      process.exit(1);
    }
    envelope = envelopeResult.envelope;
  }

  // --- Build request ---
  const effectiveSprint = sprint ?? envelope?.taskId;
  const effectiveType = type ?? envelope?.taskType;
  const effectiveSummary = summary ?? envelope?.summary;

  if (!effectiveSprint || !effectiveType || !effectiveSummary) {
    console.error(`${c.red}ERROR: Missing required arguments.${c.reset}`);
    console.error('Required: --sprint <id> --type <type> --summary "<text>"');
    process.exit(1);
  }

  if (!isValidSprintType(effectiveType)) {
    console.error(`${c.red}ERROR: Invalid sprint type '${effectiveType}'.${c.reset}`);
    process.exit(1);
  }

  const request: SprintExecutionRequest = {
    sprintId: effectiveSprint,
    sprintType: effectiveType as SprintType,
    summary: effectiveSummary,
    objective: envelope?.objective,
    touchedAreas: touched ?? (envelope ? undefined : undefined),
    requestedArtifactDate: date,
    runtimeProofRequired: envelope?.runtimeProofRequired,
  };

  console.log(`\n${c.bold}${c.cyan}CLAUDE OS — Verification Execution${c.reset}\n`);
  if (dryRun) {
    console.log(`${c.yellow}[DRY RUN] No commands will be executed.${c.reset}\n`);
  }

  // --- Build plan ---
  let plan: SprintExecutionPlan;
  if (profile) {
    plan = assembleSprintPlanWithProfile(request, profile, envelope);
  } else {
    plan = assembleSprintPlan(request);
  }

  // --- Execute verification ---
  const result = executeVerification(plan, {
    dryRun,
    defaultTimeoutMs,
  });

  printVerificationResult(result);
  process.exit(result.overallStatus === 'PASS' ? 0 : 1);
}

function commandBundle(args: Record<string, string | boolean | string[]>): void {
  const sprint = args.sprint as string | undefined;
  const type = args.type as string | undefined;
  const summary = args.summary as string | undefined;
  const touched = args.touched as string[] | undefined;
  const date = args.date as string | undefined;
  const jsonOutput = args.json === true;
  const projectId = args.project as string | undefined;
  const profilePath = args.profile as string | undefined;
  const envelopePath = args.envelope as string | undefined;

  // --- Load profile if specified ---
  let profile: ProjectProfile | null = null;
  if (projectId || profilePath) {
    const profileResult = profilePath
      ? loadProfileFromPath(profilePath)
      : loadProfileById(projectId!);

    if (!profileResult.success || !profileResult.profile) {
      console.error(`${c.red}ERROR: Failed to load project profile.${c.reset}`);
      for (const err of profileResult.errors) {
        console.error(`  ${err}`);
      }
      process.exit(1);
    }
    profile = profileResult.profile;
  }

  // --- Load envelope if specified ---
  let envelope = undefined;
  if (envelopePath) {
    const envelopeResult = loadEnvelope(envelopePath);
    if (!envelopeResult.success || !envelopeResult.envelope) {
      console.error(`${c.red}ERROR: Failed to load task envelope.${c.reset}`);
      for (const err of envelopeResult.errors) {
        console.error(`  ${err}`);
      }
      process.exit(1);
    }
    envelope = envelopeResult.envelope;
  }

  // --- Build request ---
  const effectiveSprint = sprint ?? envelope?.taskId;
  const effectiveType = type ?? envelope?.taskType;
  const effectiveSummary = summary ?? envelope?.summary;

  if (!effectiveSprint || !effectiveType || !effectiveSummary) {
    console.error(`${c.red}ERROR: Missing required arguments.${c.reset}`);
    console.error('Required: --sprint <id> --type <type> --summary "<text>"');
    process.exit(1);
  }

  if (!isValidSprintType(effectiveType)) {
    console.error(`${c.red}ERROR: Invalid sprint type '${effectiveType}'.${c.reset}`);
    process.exit(1);
  }

  const request: SprintExecutionRequest = {
    sprintId: effectiveSprint,
    sprintType: effectiveType as SprintType,
    summary: effectiveSummary,
    objective: envelope?.objective,
    touchedAreas: touched ?? (envelope ? undefined : undefined),
    requestedArtifactDate: date,
    runtimeProofRequired: envelope?.runtimeProofRequired,
  };

  console.log(`\n${c.bold}${c.cyan}CLAUDE OS — Proof Bundle Assembly${c.reset}\n`);

  // --- Build plan ---
  let plan: SprintExecutionPlan;
  if (profile) {
    plan = assembleSprintPlanWithProfile(request, profile, envelope);
  } else {
    plan = assembleSprintPlan(request);
  }

  // --- Load verification result from evidence index ---
  const artifactRoot = resolveRepoPath(plan.artifactPlan.canonicalRoot);
  const evidenceIndexPath = `${artifactRoot}/verification-evidence-index.json`;

  const loadResult = loadVerificationResultFromIndex(evidenceIndexPath);
  if (!loadResult.success || !loadResult.result) {
    console.error(`${c.red}ERROR: Could not load verification result.${c.reset}`);
    console.error(`  ${loadResult.error ?? 'Unknown error'}`);
    console.error(`  Path: ${evidenceIndexPath}`);
    console.error(`\n  Run 'verify' first to generate evidence.`);
    process.exit(1);
  }

  // --- Assemble bundle ---
  const result = assembleBundle({ plan, verificationResult: loadResult.result });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    const exitCode =
      !result.success || !result.verdict
        ? 1
        : result.verdict.status === 'PASS' || result.verdict.status === 'PASS_WITH_LIMITATIONS'
          ? 0
          : 1;
    process.exit(exitCode);
  }

  printBundleResult(result, plan);

  const exitCode =
    !result.success || !result.verdict
      ? 1
      : result.verdict.status === 'PASS' || result.verdict.status === 'PASS_WITH_LIMITATIONS'
        ? 0
        : 1;
  process.exit(exitCode);
}

function commandRun(args: Record<string, string | boolean | string[]>): void {
  const sprint = args.sprint as string | undefined;
  const type = args.type as string | undefined;
  const summary = args.summary as string | undefined;
  const touched = args.touched as string[] | undefined;
  const date = args.date as string | undefined;
  const jsonOutput = args.json === true;
  const projectId = args.project as string | undefined;
  const profilePath = args.profile as string | undefined;
  const envelopePath = args.envelope as string | undefined;
  const timeoutStr = args.timeout as string | undefined;
  const defaultTimeoutMs = timeoutStr ? parseInt(timeoutStr, 10) : undefined;

  // --- Load profile if specified ---
  let profile: ProjectProfile | null = null;
  if (projectId || profilePath) {
    const profileResult = profilePath
      ? loadProfileFromPath(profilePath)
      : loadProfileById(projectId!);
    if (!profileResult.success || !profileResult.profile) {
      console.error(`${c.red}ERROR: Failed to load project profile.${c.reset}`);
      for (const err of profileResult.errors) {
        console.error(`  ${err}`);
      }
      process.exit(1);
    }
    profile = profileResult.profile;
  }

  // --- Load envelope if specified ---
  let envelope = undefined;
  if (envelopePath) {
    const envelopeResult = loadEnvelope(envelopePath);
    if (!envelopeResult.success || !envelopeResult.envelope) {
      console.error(`${c.red}ERROR: Failed to load task envelope.${c.reset}`);
      for (const err of envelopeResult.errors) {
        console.error(`  ${err}`);
      }
      process.exit(1);
    }
    envelope = envelopeResult.envelope;
  }

  // --- Build request ---
  const effectiveSprint = sprint ?? envelope?.taskId;
  const effectiveType = type ?? envelope?.taskType;
  const effectiveSummary = summary ?? envelope?.summary;

  if (!effectiveSprint || !effectiveType || !effectiveSummary) {
    console.error(`${c.red}ERROR: Missing required arguments.${c.reset}`);
    console.error('Required: --sprint <id> --type <type> --summary "<text>"');
    process.exit(1);
  }

  if (!isValidSprintType(effectiveType)) {
    console.error(`${c.red}ERROR: Invalid sprint type '${effectiveType}'.${c.reset}`);
    process.exit(1);
  }

  const request: SprintExecutionRequest = {
    sprintId: effectiveSprint,
    sprintType: effectiveType as SprintType,
    summary: effectiveSummary,
    objective: envelope?.objective,
    touchedAreas: touched,
    requestedArtifactDate: date,
    runtimeProofRequired: envelope?.runtimeProofRequired,
  };

  console.log(`\n${c.bold}${c.cyan}CLAUDE OS — Full Sprint Execution${c.reset}\n`);

  // =========================================================================
  // GATE 1: Plan
  // =========================================================================
  console.log(`${c.bold}[1/4] Planning...${c.reset}`);

  let plan: SprintExecutionPlan;
  if (profile) {
    plan = assembleSprintPlanWithProfile(request, profile, envelope);
  } else {
    plan = assembleSprintPlan(request);
  }

  if (plan.status === 'blocked') {
    console.error(`\n${c.red}${c.bold}HALT: Plan is BLOCKED${c.reset}`);
    for (const blocker of plan.failClosedBlockers) {
      console.error(`  ${c.red}*${c.reset} ${blocker.description}`);
    }
    if (jsonOutput) {
      console.log(JSON.stringify({ phase: 'plan', status: 'BLOCKED', plan }, null, 2));
    }
    process.exit(1);
  }

  console.log(`  ${c.green}PLAN: ${plan.status.toUpperCase()}${c.reset}`);

  // =========================================================================
  // GATE 2: Verify
  // =========================================================================
  console.log(`${c.bold}[2/4] Verifying...${c.reset}`);

  const verResult = executeVerification(plan, { defaultTimeoutMs });

  if (verResult.overallStatus !== 'PASS') {
    console.error(`\n${c.red}${c.bold}HALT: Verification ${verResult.overallStatus}${c.reset}`);
    printVerificationResult(verResult);
    if (jsonOutput) {
      console.log(
        JSON.stringify({ phase: 'verify', status: verResult.overallStatus, verResult }, null, 2)
      );
    }
    process.exit(1);
  }

  // Runtime Proof Gate check
  if (verResult.runtimeProofGate.required && !verResult.runtimeProofGate.satisfied) {
    console.error(`\n${c.red}${c.bold}HALT: Runtime Proof Gate BLOCKED${c.reset}`);
    console.error(`  ${verResult.runtimeProofGate.reason}`);
    if (jsonOutput) {
      console.log(
        JSON.stringify(
          { phase: 'verify', status: 'BLOCKED', reason: 'runtime_proof_gate', verResult },
          null,
          2
        )
      );
    }
    process.exit(1);
  }

  console.log(`  ${c.green}VERIFY: ${verResult.overallStatus}${c.reset}`);

  // =========================================================================
  // STEP 3: Git Evidence
  // =========================================================================
  console.log(`${c.bold}[3/4] Capturing git evidence...${c.reset}`);

  const artifactRoot = resolveRepoPath(plan.artifactPlan.canonicalRoot);
  const gitResult = captureGitEvidence(artifactRoot);

  if (gitResult.status === 'PASS_WITH_LIMITATIONS') {
    console.log(`  ${c.yellow}GIT EVIDENCE: PASS_WITH_LIMITATIONS${c.reset}`);
    for (const f of gitResult.failures) {
      console.log(`    ${c.dim}${f}${c.reset}`);
    }
  } else {
    console.log(`  ${c.green}GIT EVIDENCE: PASS (${gitResult.files.length} files)${c.reset}`);
  }

  // =========================================================================
  // GATE 4: Bundle
  // =========================================================================
  console.log(`${c.bold}[4/4] Assembling bundle...${c.reset}`);

  const bundleResult = assembleBundle({ plan, verificationResult: verResult });

  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          phase: 'complete',
          plan: { sprintId: plan.request.sprintId, status: plan.status },
          verify: { overallStatus: verResult.overallStatus },
          gitEvidence: gitResult,
          bundle: bundleResult,
        },
        null,
        2
      )
    );
  } else {
    // Summary output
    console.log('');
    printBundleResult(bundleResult, plan);
  }

  const exitCode =
    !bundleResult.success || !bundleResult.verdict
      ? 1
      : bundleResult.verdict.status === 'PASS' ||
          bundleResult.verdict.status === 'PASS_WITH_LIMITATIONS'
        ? 0
        : 1;
  process.exit(exitCode);
}

// ---------------------------------------------------------------------------
// Bundle Result Printer
// ---------------------------------------------------------------------------

function printBundleResult(result: BundleAssemblyResult, plan: SprintExecutionPlan): void {
  console.log(`${c.bold}Sprint:${c.reset} ${plan.request.sprintId}`);
  console.log(
    `${c.bold}Type:${c.reset}   ${plan.request.sprintType}  |  ${c.bold}Tier:${c.reset} ${plan.artifactPlan.canonicalRoot ? 'see manifest' : 'N/A'}`
  );
  console.log(`${c.bold}Root:${c.reset}   ${plan.artifactPlan.canonicalRoot}`);

  if (!result.success) {
    console.log(`\n${c.red}${c.bold}--- HALT: Bundle Assembly Failed ---${c.reset}`);
    for (const reason of result.failClosedReasons) {
      console.log(`  ${c.red}BLOCKED${c.reset}: ${reason.description}`);
      console.log(`  ${c.dim}Rule: ${reason.rule}${c.reset}`);
      console.log(`  ${c.dim}Resolution: ${reason.resolution}${c.reset}`);
    }
    console.log(`\n${c.dim}Generated: ${result.generatedAt}${c.reset}\n`);
    return;
  }

  // Artifact Status
  if (result.manifest) {
    console.log(`\n${c.bold}--- Artifact Status ---${c.reset}`);
    for (const artifact of result.manifest.artifacts) {
      const statusColor =
        artifact.status === 'present' ? c.green : artifact.status === 'empty' ? c.yellow : c.red;
      const sizeStr = artifact.sizeBytes != null ? `(${formatBytes(artifact.sizeBytes)})` : '';
      console.log(
        `  ${c.bold}*${c.reset} ${artifact.relativePath.padEnd(40)} ${statusColor}${artifact.status.toUpperCase().padEnd(8)}${c.reset} ${sizeStr}`
      );
    }

    // Completeness
    const comp = result.manifest.completeness;
    console.log(`\n${c.bold}--- Completeness ---${c.reset}`);
    console.log(
      `Required: ${comp.presentRequired}/${comp.totalRequired}  |  Optional: ${comp.presentOptional}/${comp.totalOptional}`
    );
    if (comp.missingRequired.length > 0) {
      console.log(`${c.red}Missing required:${c.reset} ${comp.missingRequired.join(', ')}`);
    }
    if (comp.emptyRequired.length > 0) {
      console.log(`${c.yellow}Empty required:${c.reset} ${comp.emptyRequired.join(', ')}`);
    }
  }

  // Verdict
  if (result.verdict) {
    const verdictColor =
      result.verdict.status === 'PASS'
        ? c.green
        : result.verdict.status === 'PASS_WITH_LIMITATIONS'
          ? c.yellow
          : c.red;
    console.log(`\n${c.bold}--- Verdict ---${c.reset}`);
    console.log(`${c.bold}Status:${c.reset}     ${verdictColor}${result.verdict.status}${c.reset}`);
    console.log(`${c.bold}Rationale:${c.reset}  ${result.verdict.rationale}`);
    console.log(`${c.bold}Confidence:${c.reset} ${result.verdict.confidence}`);

    if (result.verdict.blockers.length > 0) {
      console.log(`\n${c.bold}Blockers:${c.reset}`);
      for (const b of result.verdict.blockers) {
        console.log(`  ${c.red}*${c.reset} ${b.description} (${b.resolution})`);
      }
    }

    if (result.verdict.limitations.length > 0) {
      console.log(`\n${c.bold}Limitations:${c.reset}`);
      for (const l of result.verdict.limitations) {
        console.log(`  ${c.yellow}*${c.reset} ${l.description} [${l.severity}]`);
      }
    }

    if (result.verdict.recommendations.length > 0) {
      console.log(`\n${c.bold}Recommendations:${c.reset}`);
      for (const rec of result.verdict.recommendations) {
        console.log(`  -> ${rec}`);
      }
    }
  }

  // Output files
  console.log(`\n${c.bold}--- Output ---${c.reset}`);
  console.log(
    `  manifest.json    ${result.manifestPath ? `${c.green}written${c.reset}` : `${c.red}not written${c.reset}`}`
  );
  console.log(
    `  verdict.json     ${result.verdictPath ? `${c.green}written${c.reset}` : `${c.red}not written${c.reset}`}`
  );
  console.log(
    `  PROOF_INDEX.md   ${result.proofIndexPath ? `${c.green}written${c.reset}` : `${c.red}not written${c.reset}`}`
  );

  console.log(`\n${c.dim}Generated: ${result.generatedAt}${c.reset}\n`);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Verification Result Printer
// ---------------------------------------------------------------------------

function printVerificationResult(result: VerificationExecutionResult): void {
  const statusColor =
    result.overallStatus === 'PASS' ? c.green : result.overallStatus === 'FAIL' ? c.red : c.yellow;

  console.log(`${c.bold}Status: ${statusColor}${result.overallStatus}${c.reset}`);
  console.log(`${c.bold}Sprint:${c.reset} ${result.sprintId}`);

  // Steps
  console.log(`\n${c.bold}--- Verification Steps ---${c.reset}`);
  for (const step of result.steps) {
    const stepColor =
      step.status === 'PASS'
        ? c.green
        : step.status === 'FAIL'
          ? c.red
          : step.status === 'BLOCKED'
            ? c.yellow
            : c.dim;
    const duration = step.commandResult ? `(${step.commandResult.durationMs}ms)` : '';
    console.log(
      `  ${c.bold}*${c.reset} ${step.recipeId.padEnd(20)} ${stepColor}${step.status.padEnd(7)}${c.reset} ${duration}`
    );
    if (step.status !== 'PASS') {
      console.log(`    ${c.dim}${step.reason}${c.reset}`);
    }
    if (step.browserArtifacts && step.browserArtifacts.length > 0) {
      console.log(`    ${c.cyan}Browser artifacts: ${step.browserArtifacts.length}${c.reset}`);
    }
  }

  // Summary
  const s = result.summary;
  console.log(`\n${c.bold}--- Summary ---${c.reset}`);
  console.log(
    `Total: ${s.total}  |  Passed: ${c.green}${s.passed}${c.reset}  |  Failed: ${c.red}${s.failed}${c.reset}  |  Blocked: ${c.yellow}${s.blocked}${c.reset}  |  Skipped: ${c.dim}${s.skipped}${c.reset}`
  );

  // Runtime Proof Gate
  const rpg = result.runtimeProofGate;
  console.log(`\n${c.bold}--- Runtime Proof Gate ---${c.reset}`);
  const reqStr = rpg.required ? 'YES' : 'NO';
  const satColor = rpg.satisfied ? c.green : c.red;
  const satStr = rpg.satisfied ? 'YES' : 'NO';
  console.log(`Required: ${reqStr}  |  Satisfied: ${satColor}${satStr}${c.reset}`);
  console.log(`Reason: ${rpg.reason}`);
  if (rpg.missingEvidence.length > 0) {
    console.log(`Missing: ${rpg.missingEvidence.join(', ')}`);
  }

  // Evidence
  console.log(`\n${c.bold}--- Evidence ---${c.reset}`);
  console.log(`Root:  ${result.evidenceRoot}`);
  console.log(`Index: verification-evidence-index.json`);

  console.log(`\n${c.dim}Generated: ${result.generatedAt}${c.reset}\n`);
}

// ---------------------------------------------------------------------------
// Plan Printer
// ---------------------------------------------------------------------------

function printPlan(plan: SprintExecutionPlan, profile?: ProjectProfile | null): void {
  // Status banner
  const statusColor =
    plan.status === 'ready' ? c.green : plan.status === 'blocked' ? c.red : c.yellow;
  console.log(`${c.bold}Status: ${statusColor}${plan.status.toUpperCase()}${c.reset}\n`);

  // Profile
  if (profile) {
    console.log(`${c.bold}Profile:${c.reset} ${profile.projectName} (${profile.projectId})`);
  }

  // Request
  console.log(`${c.bold}Sprint:${c.reset}  ${plan.request.sprintId}`);
  console.log(`${c.bold}Type:${c.reset}    ${plan.request.sprintType}`);
  console.log(`${c.bold}Summary:${c.reset} ${plan.request.summary}`);
  if (plan.request.touchedAreas?.length) {
    console.log(`${c.bold}Touched:${c.reset} ${plan.request.touchedAreas.join(', ')}`);
  }

  // Governance
  console.log(`\n${c.bold}--- Governance ---${c.reset}`);
  console.log(`Laws loaded:     ${plan.governanceSummary.lawsLoaded}`);
  console.log(`Contracts loaded: ${plan.governanceSummary.contractsLoaded}`);
  console.log(`Recipes loaded:  ${plan.governanceSummary.recipesLoaded}`);
  if (plan.governanceSummary.loadErrors.length > 0) {
    console.log(`Load errors:     ${plan.governanceSummary.loadErrors.length}`);
  }

  // Context
  console.log(`\n${c.bold}--- Context Pack ---${c.reset}`);
  console.log(`Always loaded:    ${plan.contextPackSummary.alwaysLoadedCount}`);
  console.log(`Sprint specific:  ${plan.contextPackSummary.sprintSpecificCount}`);
  console.log(`Optional:         ${plan.contextPackSummary.optionalCount}`);
  console.log(`Failed:           ${plan.contextPackSummary.failedCount}`);
  console.log(
    `Complete:         ${plan.contextPackSummary.isComplete ? `${c.green}YES${c.reset}` : `${c.red}NO${c.reset}`}`
  );

  // Verification
  console.log(`\n${c.bold}--- Verification Requirements ---${c.reset}`);
  const required = plan.verificationRequirements.filter(v => v.required);
  const recommended = plan.verificationRequirements.filter(v => !v.required);
  console.log(`Required: ${required.length}  |  Recommended: ${recommended.length}`);
  for (const v of required) {
    const cmdStatus = v.commandResolved
      ? `${c.green}[cmd ready]${c.reset}`
      : `${c.yellow}[placeholder]${c.reset}`;
    console.log(`  ${c.bold}*${c.reset} ${v.recipeId} ${cmdStatus} — ${v.purpose}`);
  }
  for (const v of recommended) {
    console.log(`  ${c.dim}  ${v.recipeId} — ${v.purpose}${c.reset}`);
  }

  // Proof
  console.log(`\n${c.bold}--- Proof Requirements ---${c.reset}`);
  const reqProof = plan.proofRequirements.filter(p => p.required);
  const optProof = plan.proofRequirements.filter(p => !p.required);
  console.log(`Required: ${reqProof.length}  |  Optional: ${optProof.length}`);
  for (const p of reqProof) {
    console.log(`  ${c.bold}*${c.reset} ${p.category}: ${p.artifact}`);
  }

  // Artifact Plan
  console.log(`\n${c.bold}--- Artifact Plan ---${c.reset}`);
  console.log(`Root: ${plan.artifactPlan.canonicalRoot}`);
  console.log(`Directories: ${plan.artifactPlan.requiredDirectories.length}`);
  console.log(`Files: ${plan.artifactPlan.requiredFiles.length}`);
  for (const note of plan.artifactPlan.notes) {
    console.log(`  ${c.yellow}!${c.reset} ${note}`);
  }

  // Drift Signals
  if (plan.driftSignals.length > 0) {
    console.log(`\n${c.bold}--- Drift Signals ---${c.reset}`);
    for (const signal of plan.driftSignals) {
      const sevColor =
        signal.severity === 'critical' ? c.red : signal.severity === 'high' ? c.yellow : c.dim;
      console.log(
        `  ${sevColor}[${signal.severity}]${c.reset} ${signal.type}: ${signal.description}`
      );
      console.log(`  ${c.dim}  -> ${signal.recommendation}${c.reset}`);
    }
  }

  // Fail-Closed Blockers
  if (plan.failClosedBlockers.length > 0) {
    console.log(`\n${c.red}${c.bold}--- FAIL-CLOSED BLOCKERS ---${c.reset}`);
    for (const blocker of plan.failClosedBlockers) {
      console.log(`  ${c.red}BLOCKED${c.reset}: ${blocker.description}`);
      console.log(`  ${c.dim}Rule: ${blocker.rule}${c.reset}`);
      console.log(`  ${c.dim}Resolution: ${blocker.resolution}${c.reset}`);
    }
  }

  // Deferred
  if (plan.deferredRequirements.length > 0) {
    console.log(`\n${c.bold}--- Deferred Requirements ---${c.reset}`);
    for (const d of plan.deferredRequirements) {
      console.log(`  ${c.yellow}DEFERRED${c.reset}: ${d.description} (${d.suggestedPhase})`);
    }
  }

  // Recommendations
  console.log(`\n${c.bold}--- Next Steps ---${c.reset}`);
  for (const rec of plan.nextStepRecommendations) {
    console.log(`  -> ${rec}`);
  }

  console.log(`\n${c.dim}Generated: ${plan.generatedAt}${c.reset}\n`);
}

// ---------------------------------------------------------------------------
// Command: issue
// ---------------------------------------------------------------------------

function commandIssue(args: Record<string, string | boolean | string[]>): void {
  const issueArg = args.issue as string | undefined;
  const jsonOutput = args.json === true;

  if (!issueArg) {
    console.error(`${c.red}ERROR: --issue <id-or-path> is required.${c.reset}`);
    process.exit(1);
  }

  const result = loadIssue(issueArg);
  if (!result.success || !result.issue) {
    console.error(`${c.red}ERROR: Failed to load issue.${c.reset}`);
    for (const err of result.errors) {
      console.error(`  ${err}`);
    }
    process.exit(1);
  }

  if (jsonOutput) {
    console.log(JSON.stringify(result.issue, null, 2));
    process.exit(0);
  }

  const issue = result.issue;
  console.log(`\n${c.bold}Issue: ${issue.issueId}${c.reset}`);
  console.log(`${c.dim}Source: ${result.source}${c.reset}\n`);

  console.log(`  ${c.cyan}Project${c.reset}:  ${issue.projectId}`);
  console.log(`  ${c.cyan}Type${c.reset}:     ${issue.taskType}`);
  console.log(`  ${c.cyan}Title${c.reset}:    ${issue.title}`);
  console.log(`  ${c.cyan}Status${c.reset}:   ${issue.status ?? 'open'}`);
  console.log(`  ${c.cyan}Priority${c.reset}: ${issue.priority ?? 'normal'}`);

  console.log(`\n${c.bold}Objective${c.reset}`);
  console.log(`  ${issue.objective}`);

  console.log(`\n${c.bold}Summary${c.reset}`);
  console.log(`  ${issue.summary}`);

  console.log(`\n${c.bold}Acceptance Criteria${c.reset}`);
  for (const ac of issue.acceptanceCriteria) {
    console.log(`  ${c.green}•${c.reset} ${ac}`);
  }

  console.log(`\n${c.bold}Touched Areas${c.reset}`);
  for (const area of issue.touchedAreas) {
    console.log(`  ${c.dim}→${c.reset} ${area}`);
  }

  if (issue.dependencies.length > 0) {
    console.log(`\n${c.bold}Dependencies${c.reset}`);
    for (const dep of issue.dependencies) {
      const icon = dep.status === 'resolved' ? c.green + '✓' : c.red + '✗';
      console.log(`  ${icon}${c.reset} ${dep.issueId} (${dep.status})`);
    }
  }

  if (issue.killConditions && issue.killConditions.length > 0) {
    console.log(`\n${c.bold}Kill Conditions${c.reset}`);
    for (const kc of issue.killConditions) {
      console.log(`  ${c.red}⊘${c.reset} ${kc}`);
    }
  }

  console.log('');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Command: eligible
// ---------------------------------------------------------------------------

function commandEligible(args: Record<string, string | boolean | string[]>): void {
  const issueArg = args.issue as string | undefined;
  const jsonOutput = args.json === true;

  if (!issueArg) {
    console.error(`${c.red}ERROR: --issue <id-or-path> is required.${c.reset}`);
    process.exit(1);
  }

  const issueResult = loadIssue(issueArg);
  if (!issueResult.success || !issueResult.issue) {
    console.error(`${c.red}ERROR: Failed to load issue.${c.reset}`);
    for (const err of issueResult.errors) {
      console.error(`  ${err}`);
    }
    process.exit(1);
  }

  const eligibility = checkEligibility(issueResult.issue);

  if (jsonOutput) {
    console.log(JSON.stringify(eligibility, null, 2));
    process.exit(eligibility.status === 'ELIGIBLE' ? 0 : 1);
  }

  printEligibility(eligibility);
  process.exit(eligibility.status === 'ELIGIBLE' ? 0 : 1);
}

function printEligibility(result: EligibilityResult): void {
  const statusColor =
    result.status === 'ELIGIBLE'
      ? c.green
      : result.status === 'BLOCKED'
        ? c.red
        : result.status === 'UNSUPPORTED'
          ? c.red
          : c.yellow;

  console.log(`\n${c.bold}Eligibility: ${result.issueId}${c.reset}`);
  console.log(`  ${c.cyan}Project${c.reset}: ${result.projectId}`);
  console.log(`  ${c.cyan}Status${c.reset}:  ${statusColor}${result.status}${c.reset}\n`);

  console.log(`${c.bold}Checks${c.reset}`);
  for (const check of result.checks) {
    const icon = check.passed ? `${c.green}PASS${c.reset}` : `${c.red}FAIL${c.reset}`;
    console.log(`  [${icon}] ${check.name}: ${check.reason}`);
  }

  if (result.blockers.length > 0) {
    console.log(`\n${c.bold}${c.red}Blockers${c.reset}`);
    for (const b of result.blockers) {
      console.log(`  ${c.red}•${c.reset} ${b}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log(`\n${c.bold}${c.yellow}Warnings${c.reset}`);
    for (const w of result.warnings) {
      console.log(`  ${c.yellow}•${c.reset} ${w}`);
    }
  }

  console.log('');
}

// ---------------------------------------------------------------------------
// Command: generate
// ---------------------------------------------------------------------------

function commandGenerate(args: Record<string, string | boolean | string[]>): void {
  const issueArg = args.issue as string | undefined;
  const jsonOutput = args.json === true;
  const write = args.write === true;
  const sprintIdOverride = args['sprint-id'] as string | undefined;

  if (!issueArg) {
    console.error(`${c.red}ERROR: --issue <id-or-path> is required.${c.reset}`);
    process.exit(1);
  }

  // Load issue
  const issueResult = loadIssue(issueArg);
  if (!issueResult.success || !issueResult.issue) {
    console.error(`${c.red}ERROR: Failed to load issue.${c.reset}`);
    for (const err of issueResult.errors) {
      console.error(`  ${err}`);
    }
    process.exit(1);
  }

  // Load profile
  const profileResult = loadProfileById(issueResult.issue.projectId);
  if (!profileResult.success || !profileResult.profile) {
    console.error(
      `${c.red}ERROR: Failed to load project profile for '${issueResult.issue.projectId}'.${c.reset}`
    );
    for (const err of profileResult.errors) {
      console.error(`  ${err}`);
    }
    process.exit(1);
  }

  // Generate envelope
  const result = generateEnvelope(issueResult.issue, profileResult.profile, {
    write,
    sprintIdOverride,
  });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  }

  if (!result.success) {
    console.error(`${c.red}ERROR: Envelope generation failed.${c.reset}`);
    for (const err of result.errors) {
      console.error(`  ${err}`);
    }
    if (result.eligibility.status !== 'ELIGIBLE') {
      console.log('');
      printEligibility(result.eligibility);
    }
    process.exit(1);
  }

  printGenerationResult(result);
  process.exit(0);
}

function printGenerationResult(result: EnvelopeGenerationResult): void {
  console.log(`\n${c.bold}${c.green}Envelope Generated${c.reset}`);
  console.log(`  ${c.cyan}Issue${c.reset}:    ${result.issueId}`);
  console.log(`  ${c.cyan}Task ID${c.reset}:  ${result.envelope!.taskId}`);
  console.log(`  ${c.cyan}Type${c.reset}:     ${result.envelope!.taskType}`);
  console.log(`  ${c.cyan}Project${c.reset}:  ${result.envelope!.projectId}`);
  console.log(
    `  ${c.cyan}Tier${c.reset}:     ${result.envelope!.verificationTierOverride ?? 'default'}`
  );
  console.log(
    `  ${c.cyan}Runtime${c.reset}:  ${result.envelope!.runtimeProofRequired ? 'required' : 'not required'}`
  );

  if (result.writtenTo) {
    console.log(`\n  ${c.green}Written to:${c.reset} ${result.writtenTo}`);
  }

  console.log(`\n${c.bold}Envelope Contents${c.reset}`);
  console.log(JSON.stringify(result.envelope, null, 2));
  console.log('');
}

// ---------------------------------------------------------------------------
// Implement Command (Phase G)
// ---------------------------------------------------------------------------

function commandImplement(args: Record<string, string | boolean | string[]>): void {
  const start = args.start === true;
  const check = args.check === true;
  const jsonOutput = args.json === true;

  if (!start && !check) {
    console.error(`${c.red}ERROR: Must specify --start or --check.${c.reset}`);
    process.exit(1);
  }

  if (start && check) {
    console.error(`${c.red}ERROR: Cannot specify both --start and --check.${c.reset}`);
    process.exit(1);
  }

  // --- Common: load envelope + profile ---
  const envelopePath = args.envelope as string | undefined;
  const projectId = args.project as string | undefined;
  const profilePath = args.profile as string | undefined;
  const sprint = args.sprint as string | undefined;
  const type = args.type as string | undefined;
  const summary = args.summary as string | undefined;

  if (start) {
    // --start requires envelope
    if (!envelopePath) {
      console.error(`${c.red}ERROR: --envelope <path> is required for --start.${c.reset}`);
      process.exit(1);
    }

    const envelopeResult = loadEnvelope(envelopePath);
    if (!envelopeResult.success || !envelopeResult.envelope) {
      console.error(`${c.red}ERROR: Failed to load task envelope.${c.reset}`);
      for (const err of envelopeResult.errors) {
        console.error(`  ${err}`);
      }
      process.exit(1);
    }
    const envelope = envelopeResult.envelope;

    // Load profile
    const effectiveProjectId = projectId ?? envelope.projectId;
    const profileResult = profilePath
      ? loadProfileFromPath(profilePath)
      : loadProfileById(effectiveProjectId);

    if (!profileResult.success || !profileResult.profile) {
      console.error(`${c.red}ERROR: Failed to load project profile.${c.reset}`);
      for (const err of profileResult.errors) {
        console.error(`  ${err}`);
      }
      process.exit(1);
    }

    // Build plan to get artifact root
    const request: SprintExecutionRequest = {
      sprintId: sprint ?? envelope.taskId,
      sprintType: (type ?? envelope.taskType) as SprintType,
      summary: summary ?? envelope.summary,
      objective: envelope.objective,
      touchedAreas: envelope.touchedAreas,
      runtimeProofRequired: envelope.runtimeProofRequired,
    };
    const plan = assembleSprintPlanWithProfile(request, profileResult.profile, envelope);
    const artifactRoot = resolveRepoPath(plan.artifactPlan.canonicalRoot);

    const result = startImplementation(envelope, profileResult.profile, artifactRoot);

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    }

    if (!result.success) {
      console.error(`${c.red}ERROR: Implementation start failed.${c.reset}`);
      for (const err of result.errors) {
        console.error(`  ${err}`);
      }
      process.exit(1);
    }

    printImplementationStart(result);
    process.exit(0);
  }

  if (check) {
    // --check needs plan args to derive artifact root
    const effectiveSprint = sprint;
    const effectiveType = type;
    const effectiveSummary = summary;

    if (!effectiveSprint || !effectiveType || !effectiveSummary) {
      console.error(`${c.red}ERROR: Missing required arguments for --check.${c.reset}`);
      console.error('Required: --sprint <id> --type <type> --summary "<text>"');
      process.exit(1);
    }

    if (!isValidSprintType(effectiveType)) {
      console.error(`${c.red}ERROR: Invalid sprint type '${effectiveType}'.${c.reset}`);
      process.exit(1);
    }

    // Optionally load profile
    let profile: ProjectProfile | null = null;
    if (projectId || profilePath) {
      const profileResult = profilePath
        ? loadProfileFromPath(profilePath)
        : loadProfileById(projectId!);
      if (profileResult.success && profileResult.profile) {
        profile = profileResult.profile;
      }
    }

    const request: SprintExecutionRequest = {
      sprintId: effectiveSprint,
      sprintType: effectiveType as SprintType,
      summary: effectiveSummary,
    };

    let plan: SprintExecutionPlan;
    if (profile) {
      plan = assembleSprintPlanWithProfile(request, profile);
    } else {
      plan = assembleSprintPlan(request);
    }
    const artifactRoot = resolveRepoPath(plan.artifactPlan.canonicalRoot);

    const result = checkImplementation(artifactRoot);

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    }

    if (!result.success) {
      console.error(`\n${c.bold}${c.red}IMPLEMENTATION CHECK: ${result.status}${c.reset}\n`);
      for (const err of result.errors) {
        console.error(`  ${err}`);
      }
      if (result.boundaryValidation) {
        printBoundaryValidation(result);
      }
      process.exit(1);
    }

    printImplementationCheck(result);
    process.exit(0);
  }
}

function printImplementationStart(result: ImplementationStartResult): void {
  console.log(`\n${c.bold}${c.green}IMPLEMENTATION START: Ready${c.reset}\n`);
  console.log(`  ${c.cyan}Task ID${c.reset}:   ${result.scopeContract!.taskId}`);
  console.log(`  ${c.cyan}Git HEAD${c.reset}:  ${result.snapshot!.gitHead}`);
  console.log(`  ${c.cyan}Branch${c.reset}:    ${result.snapshot!.gitBranch}`);
  console.log(
    `  ${c.cyan}Clean${c.reset}:     ${result.snapshot!.workingTreeClean ? 'yes' : 'no'}`
  );

  console.log(`\n${c.bold}Scope Contract${c.reset}`);
  console.log(`  Allowed paths (${result.scopeContract!.allowedPaths.length}):`);
  for (const rule of result.scopeContract!.allowedPaths) {
    console.log(`    ${c.green}+${c.reset} ${rule.pattern} ${c.dim}(${rule.source})${c.reset}`);
  }
  console.log(`  Forbidden paths (${result.scopeContract!.forbiddenPaths.length}):`);
  for (const rule of result.scopeContract!.forbiddenPaths) {
    console.log(`    ${c.red}-${c.reset} ${rule.pattern} ${c.dim}(${rule.source})${c.reset}`);
  }

  console.log(`\n  ${c.cyan}Contract${c.reset}: ${result.scopeContractPath}`);
  console.log(`  ${c.cyan}Snapshot${c.reset}: ${result.snapshotPath}`);
  console.log('');
}

function printImplementationCheck(result: ImplementationCheckResult): void {
  console.log(`\n${c.bold}${c.green}IMPLEMENTATION CHECK: ${result.status}${c.reset}\n`);

  if (result.boundaryValidation) {
    const bv = result.boundaryValidation;
    console.log(`  ${c.cyan}Files checked${c.reset}:  ${bv.totalFilesChecked}`);
    console.log(`  ${c.cyan}Allowed${c.reset}:        ${bv.allowedFiles.length}`);
    console.log(`  ${c.cyan}Violations${c.reset}:     ${bv.violations.length}`);
  }

  if (result.changeReceipt) {
    const cr = result.changeReceipt;
    console.log(`\n${c.bold}Change Receipt${c.reset}`);
    console.log(`  ${c.cyan}Files changed${c.reset}: ${cr.totalFilesChanged}`);
    console.log(`  ${c.cyan}Lines added${c.reset}:   +${cr.totalLinesAdded}`);
    console.log(`  ${c.cyan}Lines removed${c.reset}: -${cr.totalLinesRemoved}`);
    for (const f of cr.files) {
      const icon = f.changeType === 'added' ? '+' : f.changeType === 'deleted' ? '-' : '~';
      const color =
        f.changeType === 'added' ? c.green : f.changeType === 'deleted' ? c.red : c.yellow;
      console.log(
        `    ${color}${icon}${c.reset} ${f.filePath} ${c.dim}(+${f.linesAdded}/-${f.linesRemoved})${c.reset}`
      );
    }
  }

  if (result.diffArtifactPath) {
    console.log(`\n  ${c.cyan}Diff${c.reset}:    ${result.diffArtifactPath}`);
  }
  if (result.changeReceiptPath) {
    console.log(`  ${c.cyan}Receipt${c.reset}: ${result.changeReceiptPath}`);
  }
  console.log('');
}

function printBoundaryValidation(result: ImplementationCheckResult): void {
  if (!result.boundaryValidation) return;

  const bv = result.boundaryValidation;
  console.log(`\n${c.bold}Boundary Violations (${bv.violations.length})${c.reset}`);
  for (const v of bv.violations) {
    const label = v.violationType === 'in_forbidden' ? 'FORBIDDEN' : 'OUT OF SCOPE';
    console.log(`  ${c.red}[${label}]${c.reset} ${v.filePath}`);
    if (v.matchedRule) {
      console.log(`    ${c.dim}Rule: ${v.matchedRule.pattern} (${v.matchedRule.source})${c.reset}`);
    }
  }
  console.log('');
}

// ---------------------------------------------------------------------------
// Command: supervised-run (CLAUDE-OS-REDESIGN-001)
// ---------------------------------------------------------------------------

function commandSupervisedRun(args: Record<string, string | boolean | string[]>): void {
  const sprint = args.sprint as string | undefined;
  const type = args.type as string | undefined;
  const summary = args.summary as string | undefined;
  const touched = args.touched as string[] | undefined;
  const date = args.date as string | undefined;
  const jsonOutput = args.json === true;
  const projectId = (args.project as string | undefined) ?? 'unit-talk';
  const profilePath = args.profile as string | undefined;
  const envelopePath = args.envelope as string | undefined;
  const timeoutStr = args.timeout as string | undefined;
  const defaultTimeoutMs = timeoutStr ? parseInt(timeoutStr, 10) : undefined;

  const startedAt = new Date().toISOString();

  // --- Always load profile (supervised mode requires project context) ---
  const profileResult = profilePath ? loadProfileFromPath(profilePath) : loadProfileById(projectId);

  if (!profileResult.success || !profileResult.profile) {
    console.error(`${c.red}ERROR: Supervised-run requires a project profile.${c.reset}`);
    console.error(`  Use --project <id> or --profile <path>.`);
    for (const err of profileResult.errors) {
      console.error(`  ${err}`);
    }
    process.exit(1);
  }
  const profile = profileResult.profile;

  // --- Load envelope if specified ---
  let envelope = undefined;
  if (envelopePath) {
    const envelopeResult = loadEnvelope(envelopePath);
    if (!envelopeResult.success || !envelopeResult.envelope) {
      console.error(`${c.red}ERROR: Failed to load task envelope.${c.reset}`);
      for (const err of envelopeResult.errors) {
        console.error(`  ${err}`);
      }
      process.exit(1);
    }
    envelope = envelopeResult.envelope;
  }

  // --- Build request ---
  const effectiveSprint = sprint ?? envelope?.taskId;
  const effectiveType = type ?? envelope?.taskType;
  const effectiveSummary = summary ?? envelope?.summary;

  if (!effectiveSprint || !effectiveType || !effectiveSummary) {
    console.error(`${c.red}ERROR: Missing required arguments.${c.reset}`);
    console.error('Required: --sprint <id> --type <type> --summary "<text>"');
    console.error('  (or provide --envelope <path> to derive these from a task envelope)');
    process.exit(1);
  }

  if (!isValidSprintType(effectiveType)) {
    console.error(`${c.red}ERROR: Invalid sprint type '${effectiveType}'.${c.reset}`);
    process.exit(1);
  }

  const request: SprintExecutionRequest = {
    sprintId: effectiveSprint,
    sprintType: effectiveType as SprintType,
    summary: effectiveSummary,
    objective: envelope?.objective,
    touchedAreas: touched ?? envelope?.touchedAreas,
    requestedArtifactDate: date,
    runtimeProofRequired: envelope?.runtimeProofRequired,
  };

  // --- Resolve execution level ---
  const issueProxy = {
    taskType: effectiveType as SprintType,
    touchedAreas: touched ?? envelope?.touchedAreas ?? [],
    priority: 'normal' as const,
  };
  const executionLevel = resolveExecutionLevel(
    issueProxy as import('./types.js').IssueFile,
    profile
  );
  const levelName = EXECUTION_LEVEL_NAMES[executionLevel];

  console.log(`\n${c.bold}${c.cyan}CLAUDE OS — Supervised Sprint Execution${c.reset}\n`);
  console.log(`  ${c.bold}Sprint:${c.reset}    ${effectiveSprint}`);
  console.log(`  ${c.bold}Type:${c.reset}      ${effectiveType}`);
  console.log(`  ${c.bold}Profile:${c.reset}   ${profile.projectName} (${profile.projectId})`);
  console.log(`  ${c.bold}Level:${c.reset}     ${executionLevel} (${levelName})`);
  console.log('');

  if (executionLevel <= MAX_AUTOPILOT_LEVEL) {
    console.log(
      `  ${c.yellow}Note: This sprint is Level ${executionLevel} (${levelName}), eligible for autopilot.${c.reset}`
    );
    console.log(
      `  ${c.yellow}Use 'autopilot run-once' for fully autonomous execution.${c.reset}\n`
    );
  }

  // =========================================================================
  // STAGE 1: Plan
  // =========================================================================
  console.log(`${c.bold}[1/4] Planning...${c.reset}`);

  const plan = assembleSprintPlanWithProfile(request, profile, envelope, executionLevel);

  if (plan.status === 'blocked') {
    console.error(`\n${c.red}${c.bold}HALT: Plan is BLOCKED${c.reset}`);
    for (const blocker of plan.failClosedBlockers) {
      console.error(`  ${c.red}*${c.reset} ${blocker.description}`);
    }

    if (jsonOutput) {
      const result: SupervisedRunResult = {
        sprintId: effectiveSprint,
        executionLevel,
        executionLevelName: levelName,
        plan,
        verification: null,
        bundle: null,
        failureClassificationSummary: null,
        status: 'PLAN_BLOCKED',
        reason: plan.failClosedBlockers.map(b => b.description).join('; '),
        startedAt,
        completedAt: new Date().toISOString(),
      };
      console.log(JSON.stringify(result, null, 2));
    }
    process.exit(1);
  }

  console.log(`  ${c.green}PLAN: ${plan.status.toUpperCase()}${c.reset}`);

  // Print risk escalations (critical areas acknowledged in supervised mode)
  if (plan.riskEscalations.length > 0) {
    console.log(
      `\n  ${c.yellow}${c.bold}RISK ESCALATIONS (${plan.riskEscalations.length}):${c.reset}`
    );
    for (const esc of plan.riskEscalations) {
      console.log(`  ${c.yellow}!${c.reset} ${esc.description}`);
      console.log(`    ${c.dim}Recommendation: ${esc.recommendation}${c.reset}`);
    }
    console.log(
      `  ${c.yellow}Note: Stronger verification required. Human ratification recommended before merge.${c.reset}\n`
    );
  }

  // Print verification requirements summary
  const required = plan.verificationRequirements.filter(v => v.required);
  const unresolved = required.filter(v => !v.commandResolved);
  console.log(
    `  ${c.dim}Verification: ${required.length} required, ${unresolved.length} unresolved${c.reset}`
  );

  // =========================================================================
  // STAGE 1b: Resolve Blast Radius (CLAUDE-OS-SCOPE-HARDENING)
  // =========================================================================
  const touchedAreas = request.touchedAreas ?? [];
  const governance = loadGovernance();
  const blastRadius = resolveBlastRadius(touchedAreas, governance.packageOwnership ?? undefined);

  console.log(`  ${c.dim}Blast radius: ${blastRadius.summary}${c.reset}`);
  if (blastRadius.affectedWorkspaces.length > 0) {
    for (const ws of blastRadius.affectedWorkspaces) {
      console.log(
        `    ${c.dim}${ws.name} (${ws.changeRisk} risk, ${ws.touchedPaths.length} touched)${c.reset}`
      );
    }
  }

  // =========================================================================
  // STAGE 2: Verify (scope-aware with failure classification)
  // =========================================================================
  console.log(`${c.bold}[2/4] Verifying (scope-aware with failure classification)...${c.reset}`);

  const scopedResult = executeScopedVerification(plan, blastRadius, { defaultTimeoutMs });
  const verResult: VerificationExecutionResult = scopedResult;

  // Print step results with scope classification and failure info
  for (const step of scopedResult.scopedSteps) {
    const stepColor =
      step.status === 'PASS'
        ? c.green
        : step.status === 'FAIL'
          ? c.red
          : step.status === 'BLOCKED'
            ? c.yellow
            : c.dim;
    const duration = step.commandResult ? `(${step.commandResult.durationMs}ms)` : '';

    // Scope tag
    const scopeTag =
      step.status === 'PASS'
        ? ''
        : step.scopeClassification === 'out_of_scope_failure'
          ? ` ${c.dim}[OUT_OF_SCOPE]${c.reset}`
          : step.scopeClassification === 'global_blocker'
            ? ` ${c.red}[GLOBAL_BLOCKER]${c.reset}`
            : step.scopeClassification === 'in_scope_failure'
              ? ` ${c.yellow}[IN_SCOPE]${c.reset}`
              : '';

    let line = `  ${stepColor}${step.status.padEnd(7)}${c.reset} ${step.recipeId.padEnd(20)} ${duration}${scopeTag}`;

    // Add failure classification
    if (step.failureClassification) {
      const fc = step.failureClassification;
      const catColor =
        fc.category === 'application'
          ? c.red
          : fc.category === 'governance'
            ? c.red
            : fc.category === 'infrastructure'
              ? c.yellow
              : fc.category === 'transient'
                ? c.yellow
                : c.dim;
      line += `  ${catColor}[${fc.category}]${c.reset}`;
      if (fc.retryable) {
        line += ` ${c.dim}(retryable)${c.reset}`;
      }
    }
    console.log(line);
  }

  // Print scope summary (CLAUDE-OS-SCOPE-HARDENING)
  const ss = scopedResult.scopeSummary;
  console.log(`\n  ${c.bold}Scope Analysis:${c.reset}`);
  if (ss.inScopeFailures > 0)
    console.log(`    ${c.red}In-scope failures:${c.reset}     ${ss.inScopeFailures}`);
  if (ss.globalBlockers > 0)
    console.log(`    ${c.red}Global blockers:${c.reset}       ${ss.globalBlockers}`);
  if (ss.outOfScopeFailures > 0)
    console.log(`    ${c.dim}Out-of-scope (excluded):${c.reset} ${ss.outOfScopeFailures}`);
  console.log(
    `    ${c.bold}Sprint blocked:${c.reset}        ${ss.sprintBlocked ? `${c.red}YES${c.reset}` : `${c.green}NO${c.reset}`}`
  );
  if (ss.blockReason) console.log(`    ${c.dim}Reason: ${ss.blockReason}${c.reset}`);

  // Print failure classification summary
  if (verResult.failureClassificationSummary) {
    const fcs = verResult.failureClassificationSummary;
    console.log(`\n  ${c.bold}Failure Breakdown:${c.reset}`);
    if (fcs.application > 0)
      console.log(`    ${c.red}application:${c.reset}    ${fcs.application}`);
    if (fcs.governance > 0) console.log(`    ${c.red}governance:${c.reset}      ${fcs.governance}`);
    if (fcs.infrastructure > 0)
      console.log(`    ${c.yellow}infrastructure:${c.reset} ${fcs.infrastructure}`);
    if (fcs.toolchain > 0) console.log(`    ${c.dim}toolchain:${c.reset}       ${fcs.toolchain}`);
    if (fcs.environment > 0)
      console.log(`    ${c.dim}environment:${c.reset}     ${fcs.environment}`);
    if (fcs.transient > 0)
      console.log(`    ${c.yellow}transient:${c.reset}       ${fcs.transient}`);
  }

  // Print suggested actions for in-scope failures only
  const actionableFailures = scopedResult.scopedSteps.filter(
    s =>
      s.failureClassification &&
      (s.status === 'FAIL' || s.status === 'BLOCKED') &&
      s.scopeClassification !== 'out_of_scope_failure'
  );
  if (actionableFailures.length > 0) {
    console.log(`\n  ${c.bold}Suggested Actions:${c.reset}`);
    for (const step of actionableFailures) {
      console.log(
        `    ${c.cyan}${step.recipeId}${c.reset}: ${step.failureClassification!.suggestedAction}`
      );
    }
  }

  // Use scope-aware blocking decision instead of raw overall status
  const scopeAwareBlocked = ss.sprintBlocked;
  const verStatus = scopeAwareBlocked ? 'FAIL' : 'PASS';
  const verStatusColor = verStatus === 'PASS' ? c.green : c.red;
  console.log(
    `\n  ${c.bold}Overall (scope-aware):${c.reset} ${verStatusColor}${verStatus}${c.reset}`
  );
  if (!scopeAwareBlocked && verResult.overallStatus !== 'PASS') {
    console.log(
      `  ${c.dim}(Raw overall was ${verResult.overallStatus} — out-of-scope failures excluded)${c.reset}`
    );
  }

  // =========================================================================
  // STAGE 3: Git Evidence
  // =========================================================================
  console.log(`${c.bold}[3/4] Capturing git evidence...${c.reset}`);

  const artifactRoot = resolveRepoPath(plan.artifactPlan.canonicalRoot);
  const gitResult = captureGitEvidence(artifactRoot);

  if (gitResult.status === 'PASS_WITH_LIMITATIONS') {
    console.log(`  ${c.yellow}GIT EVIDENCE: PASS_WITH_LIMITATIONS${c.reset}`);
    for (const f of gitResult.failures) {
      console.log(`    ${c.dim}${f}${c.reset}`);
    }
  } else {
    console.log(`  ${c.green}GIT EVIDENCE: PASS (${gitResult.files.length} files)${c.reset}`);
  }

  // =========================================================================
  // STAGE 4: Bundle
  // =========================================================================
  console.log(`${c.bold}[4/4] Assembling bundle...${c.reset}`);

  const bundleResult = assembleBundle({ plan, verificationResult: verResult });

  // Determine overall status (using scope-aware decision)
  let status: SupervisedRunResult['status'];
  if (scopeAwareBlocked) {
    status = 'VERIFICATION_FAILED';
  } else if (!bundleResult.success) {
    status = 'BUNDLE_FAILED';
  } else {
    status = 'BUNDLED';
  }

  const supervisedResult: SupervisedRunResult = {
    sprintId: effectiveSprint,
    executionLevel,
    executionLevelName: levelName,
    plan,
    verification: verResult,
    bundle: bundleResult,
    failureClassificationSummary: verResult.failureClassificationSummary ?? null,
    status,
    reason:
      status === 'BUNDLED'
        ? 'Supervised run completed. Proof bundle ready for human review.' +
          (ss.outOfScopeFailures > 0
            ? ` (${ss.outOfScopeFailures} out-of-scope failure(s) excluded)`
            : '')
        : status === 'VERIFICATION_FAILED'
          ? `Verification blocked: ${ss.blockReason ?? verResult.overallStatus}. Review scope analysis above.`
          : 'Bundle assembly failed.',
    startedAt,
    completedAt: new Date().toISOString(),
  };

  if (jsonOutput) {
    console.log(JSON.stringify(supervisedResult, null, 2));
  } else {
    // Final summary
    console.log('');
    printBundleResult(bundleResult, plan);

    // Supervised-run specific footer
    console.log(`${c.bold}--- Supervised Run Summary ---${c.reset}`);
    console.log(`  Level:    ${executionLevel} (${levelName})`);
    console.log(
      `  Scope:    ${blastRadius.affectedWorkspaces.map(w => w.name).join(', ') || '(global only)'}`
    );
    console.log(`  Status:   ${status === 'BUNDLED' ? c.green : c.red}${status}${c.reset}`);
    console.log(`  Reason:   ${supervisedResult.reason}`);
    console.log('');

    if (status === 'BUNDLED') {
      console.log(
        `  ${c.green}${c.bold}Next: Review proof bundle and proceed with commit + tag + merge.${c.reset}`
      );
    } else if (status === 'VERIFICATION_FAILED') {
      console.log(
        `  ${c.yellow}${c.bold}Next: Address failures by classification, then re-run supervised-run.${c.reset}`
      );
    }
    console.log('');
  }

  process.exit(status === 'BUNDLED' ? 0 : 1);
}

// ---------------------------------------------------------------------------
// Command: sprint (stateful sprint memory — CLAUDE-OS-UPGRADE-ROADMAP Sprint 1)
// ---------------------------------------------------------------------------

const VALID_AUTHORITY_SURFACES: AuthoritySurface[] = [
  'scoring_authority',
  'promotion_authority',
  'settlement_authority',
  'discord_publish_authority',
  'outbox_state_machine',
  'canonical_schema_contract',
  'env_truth_contract',
  'routing_status_engine',
];

const VALID_RECEIPT_CLASSES: ReceiptClass[] = [
  'repo',
  'build',
  'test',
  'runtime',
  'db',
  'distribution',
  'status',
];

const VALID_SPRINT_STAGES: SprintStage[] = [
  'planning',
  'implementing',
  'verifying',
  'bundling',
  'closed',
];

function commandSprint(args: Record<string, string | boolean | string[]>): void {
  const subAction = process.argv[3];
  switch (subAction) {
    case 'start':
      commandSprintStart(args);
      break;
    case 'resume':
      commandSprintResume(args);
      break;
    case 'review':
    case 'status':
      commandSprintReview(args);
      break;
    case 'stage':
      commandSprintStage(args);
      break;
    case 'register-receipt':
      commandSprintRegisterReceipt(args);
      break;
    case 'close':
      commandSprintClose(args);
      break;
    case 'locks':
      commandSprintLocks(args);
      break;
    case 'force-unlock':
      commandSprintForceUnlock(args);
      break;
    case 'verify-receipts':
      commandSprintVerifyReceipts(args);
      break;
    default:
      console.error(`${c.red}Unknown sprint sub-command: ${subAction ?? '(none)'}${c.reset}`);
      console.error(
        'Usage: sprint <start|resume|review|stage|register-receipt|close|locks|force-unlock|verify-receipts>'
      );
      process.exit(1);
  }
}

function commandSprintStart(args: Record<string, string | boolean | string[]>): void {
  const sprintId = args.sprint as string | undefined;
  const title = args.title as string | undefined;
  const surfacesArg = args.surfaces as string | undefined;
  const owner = (args.owner as string | undefined) ?? 'claude_code';
  const supportArg = args.support as string | undefined;
  const receiptsArg = args.receipts as string | undefined;
  const maturity = args.maturity as string | undefined;
  const jsonOutput = args.json === true;

  if (!sprintId) {
    console.error(`${c.red}ERROR: --sprint <id> is required.${c.reset}`);
    process.exit(1);
  }
  if (!title) {
    console.error(`${c.red}ERROR: --title "<title>" is required.${c.reset}`);
    process.exit(1);
  }

  // Parse surfaces
  const surfaces: AuthoritySurface[] = [];
  if (surfacesArg) {
    for (const s of surfacesArg.split(',').map(x => x.trim())) {
      if (!VALID_AUTHORITY_SURFACES.includes(s as AuthoritySurface)) {
        console.error(`${c.red}ERROR: Unknown authority surface '${s}'.${c.reset}`);
        console.error(`Valid surfaces: ${VALID_AUTHORITY_SURFACES.join(', ')}`);
        process.exit(1);
      }
      surfaces.push(s as AuthoritySurface);
    }
  }

  // Parse extra receipts
  const extraReceipts: ReceiptClass[] = [];
  if (receiptsArg) {
    for (const r of receiptsArg.split(',').map(x => x.trim())) {
      if (!VALID_RECEIPT_CLASSES.includes(r as ReceiptClass)) {
        console.error(`${c.red}ERROR: Unknown receipt class '${r}'.${c.reset}`);
        console.error(`Valid classes: ${VALID_RECEIPT_CLASSES.join(', ')}`);
        process.exit(1);
      }
      extraReceipts.push(r as ReceiptClass);
    }
  }

  const supportOwners = supportArg ? supportArg.split(',').map(x => x.trim()) : [];

  // Check for existing active sprint (fail-closed)
  const existing = loadSprintState();
  if (existing) {
    console.error(
      `${c.red}ERROR: An active sprint already exists: ${existing.sprint_id}${c.reset}`
    );
    console.error(`Close the current sprint with 'sprint close' before starting a new one.`);
    if (jsonOutput)
      console.log(JSON.stringify({ error: 'active_sprint_exists', existing }, null, 2));
    process.exit(1);
  }

  // Check authority surface conflicts
  if (surfaces.length > 0) {
    const registry = loadAuthorityLocks();
    const conflict = checkConflict(registry, sprintId, surfaces);
    if (!conflict.allowed) {
      console.error(`${c.red}ERROR: Authority surface conflict detected.${c.reset}`);
      console.error(`  ${conflict.blocker_message}`);
      if (jsonOutput)
        console.log(JSON.stringify({ error: 'authority_conflict', conflict }, null, 2));
      process.exit(1);
    }

    // Acquire locks
    const lockError = lockSurfaces(registry, sprintId, owner, surfaces);
    if (lockError) {
      console.error(`${c.red}ERROR: Failed to acquire authority locks: ${lockError}${c.reset}`);
      process.exit(1);
    }
    const saveLockError = saveAuthorityLocks(registry);
    if (saveLockError) {
      console.error(`${c.red}ERROR: Failed to save authority locks: ${saveLockError}${c.reset}`);
      process.exit(1);
    }
  }

  // Generate context pack (fail-closed for protected sprints)
  let contextPackPath: string | null = null;
  const packResult = generateContextPack(sprintId, title, surfaces, []);
  if (!packResult.success) {
    if (surfaces.length > 0) {
      console.error(
        `${c.red}ERROR: Context pack generation failed for protected-surface sprint.${c.reset}`
      );
      for (const err of packResult.errors) {
        console.error(`  ${err}`);
      }
      process.exit(1);
    }
    for (const w of packResult.errors) {
      console.error(`${c.yellow}WARNING: Context pack generation failed: ${w}${c.reset}`);
    }
  } else {
    contextPackPath = packResult.repo_relative_path;
    for (const w of packResult.warnings) {
      console.error(`${c.yellow}WARNING: Context pack: ${w}${c.reset}`);
    }
  }

  // Create and persist sprint state
  const state = createSprintState({
    sprint_id: sprintId,
    title,
    authority_surfaces: surfaces,
    primary_owner: owner,
    support_owners: supportOwners,
    extra_receipts: extraReceipts.length > 0 ? extraReceipts : undefined,
    requested_maturity_delta: maturity,
    repo_context_pack_path: contextPackPath,
  });

  // Generate prompt pack (auto at sprint start)
  const promptResult = generatePromptPack(
    sprintId,
    title,
    surfaces,
    state.required_receipts,
    packResult.pack?.relevant_governance_docs ?? [],
    {
      sprintState: state,
      contextPack: packResult.pack ?? undefined,
    }
  );
  if (!promptResult.success) {
    if (surfaces.length > 0) {
      console.error(
        `${c.red}ERROR: Prompt pack generation failed for protected-surface sprint.${c.reset}`
      );
      for (const err of promptResult.errors) {
        console.error(`  ${err}`);
      }
      process.exit(1);
    }
    for (const w of promptResult.errors) {
      console.error(`${c.yellow}WARNING: Prompt pack generation failed: ${w}${c.reset}`);
    }
  } else {
    state.prompt_pack_paths = promptResult.generated_files.map(f => f.repo_relative_path);
    state.updated_at = new Date().toISOString();
    for (const w of promptResult.warnings) {
      console.error(`${c.yellow}WARNING: Prompt pack: ${w}${c.reset}`);
    }
  }

  const saveError = saveSprintState(state);
  if (saveError) {
    // Roll back authority locks to prevent orphaned lock state (S-1/A-1)
    if (surfaces.length > 0) {
      const rollbackRegistry = loadAuthorityLocks();
      unlockSurfaces(rollbackRegistry, sprintId);
      const rollbackSaveError = saveAuthorityLocks(rollbackRegistry);
      if (rollbackSaveError) {
        console.error(
          `${c.red}CRITICAL: Sprint state save failed AND lock rollback failed.${c.reset}`
        );
        console.error(`  Manual action required: remove sprint '${sprintId}' from`);
        console.error(`  governance/claude-os/state/authority-locks.json`);
      } else {
        console.error(
          `${c.yellow}NOTE: Authority locks rolled back for sprint '${sprintId}'.${c.reset}`
        );
      }
    }
    console.error(`${c.red}ERROR: Failed to save sprint state: ${saveError}${c.reset}`);
    process.exit(1);
  }

  if (jsonOutput) {
    console.log(JSON.stringify(state, null, 2));
    process.exit(0);
  }

  console.log(`\n${c.bold}${c.green}Sprint Started${c.reset}\n`);
  printSprintStateSummary(state);
  process.exit(0);
}

function commandSprintResume(args: Record<string, string | boolean | string[]>): void {
  const sprintId = args.sprint as string | undefined;
  const jsonOutput = args.json === true;

  let state = loadSprintState();

  if (!state && sprintId) {
    // Try loading from history
    state = loadArchivedSprint(sprintId);
    if (state) {
      console.error(
        `${c.yellow}Sprint ${sprintId} is archived (status: ${state.status}).${c.reset}`
      );
      console.error(`An archived sprint cannot be resumed.`);
      process.exit(1);
    }
    console.error(
      `${c.red}ERROR: No active sprint found and no archived sprint '${sprintId}'.${c.reset}`
    );
    process.exit(1);
  }

  if (!state) {
    console.error(`${c.red}ERROR: No active sprint to resume.${c.reset}`);
    process.exit(1);
  }

  if (sprintId && state.sprint_id !== sprintId) {
    console.error(
      `${c.red}ERROR: Active sprint is '${state.sprint_id}', not '${sprintId}'.${c.reset}`
    );
    process.exit(1);
  }

  if (jsonOutput) {
    console.log(JSON.stringify(state, null, 2));
    process.exit(0);
  }

  console.log(`\n${c.bold}${c.cyan}Resuming Sprint${c.reset}\n`);
  printSprintStateSummary(state);
  process.exit(0);
}

function commandSprintReview(args: Record<string, string | boolean | string[]>): void {
  const sprintId = args.sprint as string | undefined;
  const jsonOutput = args.json === true;

  let state = loadSprintState();

  if (!state && sprintId) {
    state = loadArchivedSprint(sprintId);
  }

  if (!state) {
    if (sprintId) {
      console.error(
        `${c.red}ERROR: Sprint '${sprintId}' not found (active or archived).${c.reset}`
      );
    } else {
      console.log(`${c.dim}No active sprint.${c.reset}`);
    }
    process.exit(sprintId ? 1 : 0);
  }

  if (jsonOutput) {
    console.log(JSON.stringify(state, null, 2));
    process.exit(0);
  }

  const statusColor =
    state.status === 'active' ? c.green : state.status === 'complete' ? c.cyan : c.yellow;
  console.log(`\n${c.bold}${c.cyan}Sprint Review${c.reset}\n`);
  console.log(`${c.bold}Status:${c.reset}  ${statusColor}${state.status.toUpperCase()}${c.reset}`);
  printSprintStateSummary(state);
  process.exit(0);
}

function commandSprintStage(args: Record<string, string | boolean | string[]>): void {
  const stageArg = args.stage as string | undefined;
  const jsonOutput = args.json === true;

  if (!stageArg) {
    console.error(`${c.red}ERROR: --stage <stage> is required.${c.reset}`);
    console.error(`Valid stages: ${VALID_SPRINT_STAGES.join(', ')}`);
    process.exit(1);
  }

  if (!VALID_SPRINT_STAGES.includes(stageArg as SprintStage)) {
    console.error(`${c.red}ERROR: Unknown stage '${stageArg}'.${c.reset}`);
    console.error(`Valid stages: ${VALID_SPRINT_STAGES.join(', ')}`);
    process.exit(1);
  }

  const state = loadSprintState();
  if (!state) {
    console.error(`${c.red}ERROR: No active sprint.${c.reset}`);
    process.exit(1);
  }

  const error = updateSprintStage(state, stageArg as SprintStage);
  if (error) {
    console.error(`${c.red}ERROR: ${error}${c.reset}`);
    if (jsonOutput) console.log(JSON.stringify({ error }, null, 2));
    process.exit(1);
  }

  const saveError = saveSprintState(state);
  if (saveError) {
    console.error(`${c.red}ERROR: Failed to save sprint state: ${saveError}${c.reset}`);
    process.exit(1);
  }

  if (jsonOutput) {
    console.log(
      JSON.stringify(
        { sprint_id: state.sprint_id, stage: state.stage, next_action: state.next_action },
        null,
        2
      )
    );
    process.exit(0);
  }

  console.log(`${c.green}Stage advanced to:${c.reset} ${state.stage}`);
  console.log(`${c.bold}Next action:${c.reset} ${state.next_action}`);
  process.exit(0);
}

function commandSprintRegisterReceipt(args: Record<string, string | boolean | string[]>): void {
  const receiptClass = args.class as string | undefined;
  const artifactPath = args.path as string | undefined;
  const description = (args.description as string | undefined) ?? '';
  const jsonOutput = args.json === true;

  if (!receiptClass) {
    console.error(`${c.red}ERROR: --class <receipt-class> is required.${c.reset}`);
    console.error(`Valid classes: ${VALID_RECEIPT_CLASSES.join(', ')}`);
    process.exit(1);
  }
  if (!artifactPath) {
    console.error(`${c.red}ERROR: --path <artifact-path> is required.${c.reset}`);
    process.exit(1);
  }
  if (!VALID_RECEIPT_CLASSES.includes(receiptClass as ReceiptClass)) {
    console.error(`${c.red}ERROR: Unknown receipt class '${receiptClass}'.${c.reset}`);
    process.exit(1);
  }

  const state = loadSprintState();
  if (!state) {
    console.error(`${c.red}ERROR: No active sprint.${c.reset}`);
    process.exit(1);
  }

  registerReceipt(state, {
    receipt_class: receiptClass as ReceiptClass,
    artifact_path: artifactPath,
    description,
  });

  const saveError = saveSprintState(state);
  if (saveError) {
    console.error(`${c.red}ERROR: Failed to save sprint state: ${saveError}${c.reset}`);
    process.exit(1);
  }

  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          sprint_id: state.sprint_id,
          registered: { receipt_class: receiptClass, artifact_path: artifactPath },
          found_receipts: state.found_receipts.length,
          missing_receipts: state.missing_receipts,
          next_action: state.next_action,
        },
        null,
        2
      )
    );
    process.exit(0);
  }

  console.log(`${c.green}Receipt registered:${c.reset} ${receiptClass} → ${artifactPath}`);
  console.log(
    `${c.bold}Missing receipts:${c.reset} ${state.missing_receipts.join(', ') || '(none)'}`
  );
  console.log(`${c.bold}Next action:${c.reset} ${state.next_action}`);
  process.exit(0);
}

function commandSprintClose(args: Record<string, string | boolean | string[]>): void {
  const force = args.force === true;
  const jsonOutput = args.json === true;

  const state = loadSprintState();
  if (!state) {
    console.error(`${c.red}ERROR: No active sprint to close.${c.reset}`);
    process.exit(1);
  }

  // Receipt validation gate — runs BEFORE authority lock release
  // Hoist validation result so it can be passed to status artifact generator
  let validation: import('./types.js').ReceiptValidationReport | undefined;
  if (!force) {
    validation = validateAllReceipts(state);
    if (!validation.valid) {
      console.error(`${c.red}ERROR: Receipt validation failed — cannot close sprint.${c.reset}`);
      for (const entry of validation.entries.filter(e => !e.valid)) {
        console.error(`  [INVALID] ${entry.receipt.receipt_class}: ${entry.receipt.artifact_path}`);
        for (const err of entry.errors) console.error(`    ${c.red}→ ${err}${c.reset}`);
      }
      if (state.missing_receipts.length > 0) {
        console.error(`  [MISSING] ${state.missing_receipts.join(', ')}`);
      }
      if (jsonOutput)
        console.log(JSON.stringify({ error: 'receipt_validation_failed', validation }, null, 2));
      process.exit(1);
    }
  }

  // LLM routing decision gate — runs BEFORE authority lock release
  // Skipped when --force is set (same as receipt validation gate)
  if (!force) {
    const routingValidation = validateRoutingDecision(state.sprint_id);
    if (!routingValidation.valid) {
      console.error(
        `${c.red}ERROR: LLM routing decision validation failed — cannot close sprint.${c.reset}`
      );
      for (const err of routingValidation.errors) {
        console.error(`  ${c.red}→ ${err}${c.reset}`);
      }
      if (jsonOutput)
        console.log(
          JSON.stringify(
            { error: 'routing_decision_validation_failed', errors: routingValidation.errors },
            null,
            2
          )
        );
      process.exit(1);
    }
  }

  // Release authority locks
  if (state.authority_surfaces.length > 0) {
    const registry = loadAuthorityLocks();
    const released = unlockSurfaces(registry, state.sprint_id);
    if (released.length > 0) {
      const saveLockError = saveAuthorityLocks(registry);
      if (saveLockError) {
        console.error(
          `${c.red}ERROR: Failed to persist authority lock release — cannot close sprint.${c.reset}`
        );
        console.error(`  ${saveLockError}`);
        console.error(`  The lock registry still shows ${state.sprint_id} holding surfaces.`);
        console.error(`  Fix the underlying I/O issue and retry 'sprint close'.`);
        if (jsonOutput) {
          console.log(
            JSON.stringify({ error: 'lock_release_save_failed', detail: saveLockError }, null, 2)
          );
        }
        process.exit(1);
      }
    }
  }

  // Generate status artifact BEFORE archiving so path is stored in sprint state
  const contextPackForStatus = state.repo_context_pack_path
    ? (loadContextPackFromRepoPath(state.repo_context_pack_path) ?? undefined)
    : undefined;
  const statusResult = generateStatusArtifact(state, {
    validationReport: validation,
    contextPack: contextPackForStatus,
  });
  if (!statusResult.success) {
    if (state.authority_surfaces.length > 0) {
      console.error(
        `${c.red}ERROR: Status artifact generation failed for protected-surface sprint.${c.reset}`
      );
      for (const err of statusResult.errors) console.error(`  ${err}`);
      process.exit(1);
    }
    for (const w of statusResult.errors) {
      console.error(`${c.yellow}WARNING: Status artifact: ${w}${c.reset}`);
    }
  } else {
    state.status_artifact_path = statusResult.repo_relative_json_path;
    state.updated_at = new Date().toISOString();
  }

  const error = closeSprintState(state, { force });
  if (error) {
    console.error(`${c.red}ERROR: ${error}${c.reset}`);
    if (jsonOutput) console.log(JSON.stringify({ error }, null, 2));
    process.exit(1);
  }

  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          sprint_id: state.sprint_id,
          status: state.status,
          closed_at: state.closed_at,
          status_artifact_path: state.status_artifact_path,
        },
        null,
        2
      )
    );
    process.exit(0);
  }

  const statusColor = state.status === 'complete' ? c.green : c.yellow;
  console.log(`\n${c.bold}Sprint Closed${c.reset}`);
  console.log(`  ID:     ${state.sprint_id}`);
  console.log(`  Status: ${statusColor}${state.status.toUpperCase()}${c.reset}`);
  console.log(`  Archived to: governance/claude-os/state/sprint-history/${state.sprint_id}.json`);
  if (statusResult.success && statusResult.repo_relative_json_path) {
    console.log(`  Status artifact: ${statusResult.repo_relative_json_path}`);
  }
  process.exit(0);
}

function commandSprintLocks(args: Record<string, string | boolean | string[]>): void {
  const jsonOutput = args.json === true;
  const registry = loadAuthorityLocks();
  const allLocks = getAllActiveLocks(registry);

  if (jsonOutput) {
    console.log(JSON.stringify(registry, null, 2));
    process.exit(0);
  }

  console.log(`\n${c.bold}${c.cyan}Authority Lock Registry${c.reset}\n`);
  if (allLocks.length === 0) {
    console.log(`  ${c.dim}No active locks.${c.reset}`);
  } else {
    console.log(`  ${'Surface'.padEnd(30)} ${'Sprint'.padEnd(32)} ${'Owner'.padEnd(14)} Locked At`);
    console.log(`  ${'─'.repeat(30)} ${'─'.repeat(32)} ${'─'.repeat(14)} ${'─'.repeat(25)}`);
    for (const { surface, lock } of allLocks) {
      console.log(
        `  ${surface.padEnd(30)} ${lock.sprint_id.padEnd(32)} ${lock.primary_owner.padEnd(14)} ${lock.locked_at}`
      );
    }
  }
  console.log('');
  process.exit(0);
}

function commandSprintForceUnlock(args: Record<string, string | boolean | string[]>): void {
  const sprintId = args.sprint as string | undefined;
  const confirmed = args.confirm === true;
  const jsonOutput = args.json === true;

  if (!sprintId) {
    console.error(`${c.red}ERROR: --sprint <id> is required.${c.reset}`);
    process.exit(1);
  }

  const registry = loadAuthorityLocks();
  const held = getSprintLocks(registry, sprintId);

  if (held.length === 0) {
    if (jsonOutput) {
      console.log(
        JSON.stringify(
          { sprint_id: sprintId, released: [], message: 'No locks held by this sprint' },
          null,
          2
        )
      );
    } else {
      console.log(`${c.dim}No locks held by sprint '${sprintId}'.${c.reset}`);
    }
    process.exit(0);
  }

  if (!confirmed) {
    console.error(
      `${c.yellow}⚠  Force-unlock will release authority locks held by '${sprintId}':${c.reset}`
    );
    for (const s of held) {
      console.error(`  - ${s}`);
    }
    console.error(`Re-run with --confirm to proceed.`);
    if (jsonOutput) {
      console.log(JSON.stringify({ error: 'confirmation_required', held_surfaces: held }, null, 2));
    }
    process.exit(1);
  }

  const released = unlockSurfaces(registry, sprintId);
  const saveError = saveAuthorityLocks(registry);
  if (saveError) {
    console.error(
      `${c.red}ERROR: Failed to save lock registry after force-unlock: ${saveError}${c.reset}`
    );
    if (jsonOutput) {
      console.log(JSON.stringify({ error: 'save_failed', detail: saveError }, null, 2));
    }
    process.exit(1);
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ sprint_id: sprintId, released }, null, 2));
    process.exit(0);
  }

  console.log(`\n${c.bold}${c.green}Force-Unlock Complete${c.reset}`);
  console.log(`  Sprint:   ${sprintId}`);
  console.log(`  Released: ${released.join(', ')}`);
  console.log('');
  process.exit(0);
}

function commandSprintVerifyReceipts(args: Record<string, string | boolean | string[]>): void {
  const sprintId = args.sprint as string | undefined;
  const jsonOutput = args.json === true;

  const state = loadSprintState() ?? (sprintId ? loadArchivedSprint(sprintId) : null);

  if (!state) {
    console.error(
      `${c.red}ERROR: No active sprint found${sprintId ? ` and no archived sprint '${sprintId}'` : ''}.${c.reset}`
    );
    process.exit(1);
  }

  const report = validateAllReceipts(state);

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.valid ? 0 : 1);
  }

  console.log(`\n${c.bold}${c.cyan}Receipt Verification Report${c.reset}`);
  console.log(`  Sprint:  ${report.sprint_id}`);
  console.log(
    `  Checked: ${report.checked_count} | Valid: ${report.valid_count} | Invalid: ${report.invalid_count}`
  );

  if (report.entries.length === 0) {
    console.log(`\n  ${c.dim}No receipts registered.${c.reset}`);
  } else {
    console.log('');
    for (const entry of report.entries) {
      const icon = entry.valid ? `${c.green}✓` : `${c.red}✗`;
      console.log(
        `  ${icon}${c.reset} [${entry.receipt.receipt_class}] ${entry.receipt.artifact_path}`
      );
      if (!entry.valid) {
        for (const err of entry.errors) {
          console.log(`      ${c.red}→ ${err}${c.reset}`);
        }
      }
      if (entry.hash_match === false) {
        console.log(`      ${c.red}→ HASH MISMATCH — file may have been tampered${c.reset}`);
      } else if (entry.hash_match === true) {
        console.log(`      ${c.green}→ hash verified${c.reset}`);
      }
    }
  }

  if (state.missing_receipts.length > 0) {
    console.log(
      `\n  ${c.red}Missing receipt classes: ${state.missing_receipts.join(', ')}${c.reset}`
    );
  }

  const overallIcon = report.valid ? `${c.green}PASS` : `${c.red}FAIL`;
  console.log(`\n  Overall: ${overallIcon}${c.reset}\n`);
  process.exit(report.valid ? 0 : 1);
}

function printSprintStateSummary(state: import('./types.js').ActiveSprintState): void {
  const stageColor = state.stage === 'closed' ? c.dim : c.cyan;
  console.log(`  ${c.bold}Sprint:${c.reset}    ${state.sprint_id}`);
  console.log(`  ${c.bold}Title:${c.reset}     ${state.title}`);
  console.log(`  ${c.bold}Stage:${c.reset}     ${stageColor}${state.stage}${c.reset}`);
  console.log(`  ${c.bold}Owner:${c.reset}     ${state.primary_owner}`);

  if (state.authority_surfaces.length > 0) {
    console.log(`  ${c.bold}Surfaces:${c.reset}  ${state.authority_surfaces.join(', ')}`);
  }

  // Receipts
  console.log(`\n  ${c.bold}Receipts:${c.reset}`);
  for (const rc of state.required_receipts) {
    const found = state.found_receipts.some(f => f.receipt_class === rc);
    const icon = found ? `${c.green}✓` : `${c.red}✗`;
    console.log(`    ${icon}${c.reset} ${rc}`);
  }

  // Blockers
  if (state.blockers.length > 0) {
    console.log(`\n  ${c.bold}${c.red}Blockers:${c.reset}`);
    for (const b of state.blockers) {
      const sev = b.severity === 'blocking' ? c.red : c.yellow;
      console.log(`    ${sev}[${b.severity}]${c.reset} ${b.description}`);
    }
  }

  // Context pack
  if (state.repo_context_pack_path) {
    const pack = loadContextPackFromRepoPath(state.repo_context_pack_path);
    if (pack) {
      const freshness = checkContextPackFreshness(pack);
      const freshIcon = freshness.fresh ? `${c.green}✓ fresh` : `${c.yellow}⚠ stale`;
      console.log(`\n  ${c.bold}Context Pack:${c.reset} ${state.repo_context_pack_path}`);
      console.log(
        `  ${c.bold}Freshness:${c.reset}    ${freshIcon}${c.reset} — ${freshness.reason}`
      );
    } else {
      console.log(
        `\n  ${c.bold}Context Pack:${c.reset} ${c.yellow}${state.repo_context_pack_path} (unreadable)${c.reset}`
      );
    }
  }

  // Prompt packs
  if (state.prompt_pack_paths.length > 0) {
    console.log(`\n  ${c.bold}Prompt Packs:${c.reset}`);
    for (const pp of state.prompt_pack_paths) {
      const exists = fileExists(resolveRepoPath(pp));
      const icon = exists ? `${c.green}✓` : `${c.yellow}✗ (missing)`;
      console.log(`    ${icon}${c.reset} ${pp}`);
    }
  } else {
    console.log(`\n  ${c.dim}Prompt packs: not yet generated${c.reset}`);
  }

  // Status artifact
  if (state.status_artifact_path) {
    const exists = fileExists(resolveRepoPath(state.status_artifact_path));
    const icon = exists ? `${c.green}✓` : `${c.yellow}✗ (missing)`;
    console.log(
      `\n  ${c.bold}Status Artifact:${c.reset} ${icon}${c.reset} ${state.status_artifact_path}`
    );
  } else {
    console.log(`\n  ${c.dim}Status artifact: not yet generated${c.reset}`);
  }

  // Next action
  console.log(`\n  ${c.bold}Next action:${c.reset} ${state.next_action}`);
  console.log('');
}

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Command: autopilot
// ---------------------------------------------------------------------------

function commandAutopilot(args: Record<string, string | boolean | string[]>): void {
  // Find sub-action: skip '--' separators and the 'autopilot' command itself
  const subAction = process.argv.slice(3).find(a => a !== '--');
  const jsonOutput = args.json === true;

  switch (subAction) {
    case 'scan':
      commandAutopilotScan(jsonOutput);
      break;
    case 'next':
      commandAutopilotNext(jsonOutput);
      break;
    case 'run-once':
      commandAutopilotRunOnce(args, jsonOutput);
      break;
    case 'status':
      commandAutopilotStatus(jsonOutput);
      break;
    default:
      console.error(`${c.red}Unknown autopilot sub-action: ${subAction ?? '(none)'}${c.reset}`);
      console.error(`Usage: autopilot <scan|next|run-once|status> [--json]`);
      process.exit(1);
  }
}

function commandAutopilotScan(jsonOutput: boolean): void {
  console.log(`\n${c.bold}${c.cyan}CLAUDE OS — Autopilot Queue Scan${c.reset}\n`);

  const scanResult = scanIssueQueue();
  const workflowState = loadWorkflowState();

  if (jsonOutput) {
    console.log(JSON.stringify(scanResult, null, 2));
    return;
  }

  console.log(`  Scanned at:   ${scanResult.scannedAt}`);
  console.log(`  Total files:  ${scanResult.totalFiles}`);
  console.log(`  Loaded:       ${scanResult.loaded}`);
  if (scanResult.loadErrors.length > 0) {
    console.log(`  Load errors:  ${scanResult.loadErrors.length}`);
    for (const err of scanResult.loadErrors) {
      console.log(`    ${c.red}*${c.reset} ${err}`);
    }
  }
  console.log('');

  if (scanResult.issues.length === 0) {
    console.log(`  ${c.dim}No issues found.${c.reset}`);
    return;
  }

  // Table header
  console.log(
    `  ${'Issue'.padEnd(20)} ${'Type'.padEnd(12)} ${'Priority'.padEnd(10)} ${'Eligible'.padEnd(10)} ${'Autonomy'.padEnd(10)} ${'State'.padEnd(20)}`
  );
  console.log(
    `  ${'─'.repeat(20)} ${'─'.repeat(12)} ${'─'.repeat(10)} ${'─'.repeat(10)} ${'─'.repeat(10)} ${'─'.repeat(20)}`
  );

  for (const si of scanResult.issues) {
    const wsEntry = workflowState.issues[si.issueId];
    const state = wsEntry?.state ?? '—';
    const eligible =
      si.eligibility.status === 'ELIGIBLE'
        ? `${c.green}ELIGIBLE${c.reset}`
        : `${c.red}${si.eligibility.status}${c.reset}`;
    const autonomy =
      si.autonomy.decision === 'ALLOW' ? `${c.green}ALLOW${c.reset}` : `${c.yellow}DENY${c.reset}`;

    console.log(
      `  ${si.issueId.padEnd(20)} ${si.issue.taskType.padEnd(12)} ${(si.issue.priority ?? 'normal').padEnd(10)} ${eligible.padEnd(19)} ${autonomy.padEnd(19)} ${state}`
    );
  }
  console.log('');
}

function commandAutopilotNext(jsonOutput: boolean): void {
  console.log(`\n${c.bold}${c.cyan}CLAUDE OS — Autopilot Next Selection${c.reset}\n`);

  const scanResult = scanIssueQueue();
  const workflowState = loadWorkflowState();
  const selection = selectNextIssue(scanResult, workflowState);

  if (jsonOutput) {
    console.log(JSON.stringify(selection, null, 2));
    return;
  }

  if (!selection.selected) {
    console.log(`  ${c.yellow}No eligible issue found.${c.reset}`);
    console.log(`  Reason: ${selection.reason}`);
  } else {
    console.log(`  ${c.green}Selected:${c.reset}  ${selection.selected.issueId}`);
    console.log(`  Type:      ${selection.selected.issue.taskType}`);
    console.log(`  Priority:  ${selection.selected.issue.priority ?? 'normal'}`);
    console.log(`  Title:     ${selection.selected.issue.title}`);
    console.log(`  Candidates: ${selection.candidateCount}`);
  }
  console.log('');
}

function commandAutopilotRunOnce(
  args: Record<string, string | boolean | string[]>,
  jsonOutput: boolean
): void {
  const dryRun = args['dry-run'] === true;

  console.log(
    `\n${c.bold}${c.cyan}CLAUDE OS — Autopilot Run Once${dryRun ? ' (DRY RUN)' : ''}${c.reset}\n`
  );

  // Check frozen first
  if (checkAutopilotFrozen()) {
    console.error(
      `  ${c.red}${c.bold}FROZEN:${c.reset} Autopilot is frozen via runtime_config/autopilot_state.json`
    );
    process.exit(1);
  }

  const result = runAutopilotCycle({ dryRun });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.status === 'COMPLETED' ? 0 : 1);
  }

  console.log(
    `  Status:    ${result.status === 'COMPLETED' ? c.green : c.red}${result.status}${c.reset}`
  );
  console.log(`  Issue:     ${result.issueId ?? '—'}`);
  console.log(`  Reason:    ${result.reason}`);

  if (result.pipelineResults.length > 0) {
    console.log('');
    console.log(`  ${c.bold}Pipeline Stages:${c.reset}`);
    for (const stage of result.pipelineResults) {
      const icon = stage.success ? c.green + 'PASS' : c.red + 'FAIL';
      console.log(
        `    ${stage.stage.padEnd(18)} ${icon}${c.reset}  (${stage.durationMs}ms)${stage.error ? '  ' + stage.error : ''}`
      );
    }
  }

  if (result.finalState) {
    console.log(`  Final state: ${result.finalState}`);
  }
  console.log('');

  process.exit(result.status === 'COMPLETED' ? 0 : 1);
}

function commandAutopilotStatus(jsonOutput: boolean): void {
  console.log(`\n${c.bold}${c.cyan}CLAUDE OS — Autopilot Status${c.reset}\n`);

  const workflowState = loadWorkflowState();
  const frozen = checkAutopilotFrozen();

  if (jsonOutput) {
    console.log(JSON.stringify({ frozen, workflowState }, null, 2));
    return;
  }

  console.log(`  Frozen:     ${frozen ? c.red + 'YES' : c.green + 'NO'}${c.reset}`);
  console.log(`  Last scan:  ${workflowState.lastScanAt ?? '—'}`);
  console.log(
    `  Active run: ${workflowState.activeRun ? workflowState.activeRun.issueId + ' (' + workflowState.activeRun.pipelineStage + ')' : '—'}`
  );

  const issueIds = Object.keys(workflowState.issues);
  if (issueIds.length === 0) {
    console.log(`\n  ${c.dim}No tracked issues.${c.reset}`);
  } else {
    console.log(`\n  ${c.bold}Tracked Issues:${c.reset}`);
    console.log(`  ${'Issue'.padEnd(20)} ${'State'.padEnd(24)} ${'Updated'.padEnd(26)} Reason`);
    console.log(`  ${'─'.repeat(20)} ${'─'.repeat(24)} ${'─'.repeat(26)} ${'─'.repeat(30)}`);
    for (const id of issueIds.sort()) {
      const entry = workflowState.issues[id];
      console.log(
        `  ${id.padEnd(20)} ${entry.state.padEnd(24)} ${entry.updatedAt.padEnd(26)} ${entry.reason}`
      );
    }
  }
  console.log('');
}

function printHelp(): void {
  console.log(`
${c.bold}Claude OS — Governed Sprint Execution Foundation${c.reset}

${c.bold}Commands:${c.reset}

  ${c.cyan}supervised-run${c.reset}  ${c.bold}[PRIMARY]${c.reset} Supervised pipeline with failure classification (Level 2+)
  ${c.cyan}run${c.reset}             Orchestrate full pipeline: plan → verify → git-evidence → bundle
  ${c.cyan}plan${c.reset}            Assemble a dry-run sprint execution plan
  ${c.cyan}verify${c.reset}          Execute verification steps and capture evidence
  ${c.cyan}bundle${c.reset}          Assemble proof bundle from plan + verification outputs
  ${c.cyan}validate${c.reset}        Validate governance artifact loading
  ${c.cyan}portfolio:audit${c.reset} Run SPOA and emit audit artifacts
  ${c.cyan}issue${c.reset}           Load and display an issue file
  ${c.cyan}eligible${c.reset}        Evaluate issue eligibility for autonomous execution
  ${c.cyan}generate${c.reset}        Generate TaskEnvelope from an issue (--write to persist)
  ${c.cyan}implement${c.reset}       Governance wrapper for implementation (--start before, --check after)
  ${c.cyan}autopilot${c.reset}       Bounded autopilot orchestrator (Level 0-1 only)
  ${c.cyan}sprint${c.reset}          Stateful sprint memory: start, resume, review, close

${c.bold}Sprint usage (stateful sprint memory):${c.reset}

  npx tsx src/cli.ts sprint start \\
    --sprint SPRINT-NAME-### \\
    --title "Sprint title" \\
    [--surfaces scoring_authority,settlement_authority] \\
    [--owner claude_code] \\
    [--support codex] \\
    [--receipts runtime,db] \\
    [--maturity "Prototype → Operational"] \\
    [--json]

  npx tsx src/cli.ts sprint resume [--sprint SPRINT-NAME-###] [--json]
  npx tsx src/cli.ts sprint review [--sprint SPRINT-NAME-###] [--json]
  npx tsx src/cli.ts sprint stage --stage implementing [--json]
  npx tsx src/cli.ts sprint register-receipt \\
    --class repo \\
    --path out/sprints/SPRINT-NAME/2026-03-13/proofs/proof_git_status.txt \\
    [--description "Git status"] \\
    [--json]
  npx tsx src/cli.ts sprint close [--force] [--json]
  npx tsx src/cli.ts sprint locks [--json]

${c.bold}Plan usage:${c.reset}

  npx tsx src/cli.ts plan \\
    --sprint SPRINT-NAME-### \\
    --type <docs|runtime|build_fix|e2e_lifecycle|ui|schema> \\
    --summary "Sprint objective description" \\
    [--touched area1,area2] \\
    [--date YYYY-MM-DD] \\
    [--project <id>] \\
    [--profile <path>] \\
    [--envelope <path>] \\
    [--json] \\
    [--out path/to/plan.json]

${c.bold}Verify usage:${c.reset}

  npx tsx src/cli.ts verify \\
    --sprint SPRINT-NAME-### \\
    --type <docs|runtime|build_fix|e2e_lifecycle|ui|schema> \\
    --summary "Sprint objective description" \\
    [--touched area1,area2] \\
    [--date YYYY-MM-DD] \\
    [--project <id>] \\
    [--profile <path>] \\
    [--envelope <path>] \\
    [--dry-run] \\
    [--timeout <ms>]

${c.bold}Bundle usage:${c.reset}

  npx tsx src/cli.ts bundle \\
    --sprint SPRINT-NAME-### \\
    --type <docs|runtime|build_fix|e2e_lifecycle|ui|schema> \\
    --summary "Sprint objective description" \\
    [--touched area1,area2] \\
    [--date YYYY-MM-DD] \\
    [--project <id>] \\
    [--profile <path>] \\
    [--envelope <path>] \\
    [--json]

${c.bold}Run usage:${c.reset}

  npx tsx src/cli.ts run \\
    --sprint SPRINT-NAME-### \\
    --type <docs|runtime|build_fix|e2e_lifecycle|ui|schema> \\
    --summary "Sprint objective description" \\
    [--touched area1,area2] \\
    [--date YYYY-MM-DD] \\
    [--project <id>] \\
    [--profile <path>] \\
    [--envelope <path>] \\
    [--timeout <ms>] \\
    [--json]

${c.bold}Issue usage:${c.reset}

  npx tsx src/cli.ts issue --issue ISSUE-001 [--json]

${c.bold}Eligible usage:${c.reset}

  npx tsx src/cli.ts eligible --issue ISSUE-001 [--json]

${c.bold}Generate usage:${c.reset}

  npx tsx src/cli.ts generate \\
    --issue ISSUE-001 \\
    [--write] \\
    [--sprint-id SPRINT-NAME-###] \\
    [--json]

${c.bold}Implement usage:${c.reset}

  ${c.dim}# Before implementation (derive scope + snapshot):${c.reset}
  npx tsx src/cli.ts implement --start \\
    --envelope <path> \\
    [--project <id>] [--sprint <id>] [--type <type>] [--summary "<text>"]

  ${c.dim}# After implementation (validate + receipt + diff):${c.reset}
  npx tsx src/cli.ts implement --check \\
    --sprint <id> --type <type> --summary "<text>" \\
    [--project <id>] [--json]

${c.bold}Autopilot usage:${c.reset}

  npx tsx src/cli.ts autopilot scan [--json]       ${c.dim}# Scan issue queue${c.reset}
  npx tsx src/cli.ts autopilot next [--json]       ${c.dim}# Show next eligible issue${c.reset}
  npx tsx src/cli.ts autopilot run-once [--json]   ${c.dim}# Execute one bounded cycle${c.reset}
  npx tsx src/cli.ts autopilot run-once --dry-run  ${c.dim}# Dry-run (no pipeline)${c.reset}
  npx tsx src/cli.ts autopilot status [--json]     ${c.dim}# Show workflow state${c.reset}

${c.bold}Profile & Envelope flags:${c.reset}

  --project <id>       Load project profile by ID (from governance/claude-os/profiles/<id>.json)
  --profile <path>     Load project profile from explicit file path
  --envelope <path>    Load task envelope (fills in sprint/type/summary if not given via CLI)

${c.bold}Examples:${c.reset}

  ${c.dim}# Plan (dry-run, no execution):${c.reset}
  npx tsx src/cli.ts plan \\
    --sprint SPRINT-SETTLEMENT-045 \\
    --type runtime \\
    --summary "Migrate settlement off raw_props to provider_offers" \\
    --touched apps/api/src/agents/SettlementAgent/

  ${c.dim}# Verify (execute resolved commands, capture evidence):${c.reset}
  npx tsx src/cli.ts verify \\
    --project unit-talk \\
    --sprint SPRINT-044R \\
    --type runtime \\
    --summary "Settlement migration off raw_props to unified_picks" \\
    --touched apps/api/src/agents/SettlementAgent/

  ${c.dim}# Bundle (assemble proof bundle after verify):${c.reset}
  npx tsx src/cli.ts bundle \\
    --sprint SPRINT-044R \\
    --type runtime \\
    --summary "Settlement migration off raw_props to unified_picks"

  ${c.dim}# Bundle with profile + JSON output:${c.reset}
  npx tsx src/cli.ts bundle \\
    --project unit-talk \\
    --sprint SPRINT-044R \\
    --type runtime \\
    --summary "Settlement migration" \\
    --json

  ${c.dim}# Dry-run verify (classify without executing):${c.reset}
  npx tsx src/cli.ts verify \\
    --sprint SPRINT-DOCS-001 \\
    --type docs \\
    --summary "Documentation update" \\
    --dry-run

  ${c.dim}# Full pipeline (plan → verify → git-evidence → bundle):${c.reset}
  npx tsx src/cli.ts run \\
    --sprint SPRINT-045 \\
    --type runtime \\
    --summary "Settlement migration" \\
    --project unit-talk

  ${c.dim}# Full pipeline with JSON output:${c.reset}
  npx tsx src/cli.ts run \\
    --sprint SPRINT-045 \\
    --type runtime \\
    --summary "Settlement migration" \\
    --json

  ${c.dim}# Envelope-driven:${c.reset}
  npx tsx src/cli.ts plan \\
    --project unit-talk \\
    --envelope governance/claude-os/envelopes/example-runtime-sprint.json

  npx tsx src/cli.ts validate

  ${c.dim}# Load and inspect an issue:${c.reset}
  npx tsx src/cli.ts issue --issue ISSUE-001

  ${c.dim}# Run SPOA and write audit artifacts:${c.reset}
  npx tsx src/cli.ts portfolio:audit [--output out/portfolio-audits/custom] [--json]

  ${c.dim}# Check issue eligibility:${c.reset}
  npx tsx src/cli.ts eligible --issue ISSUE-001

  ${c.dim}# Generate envelope from issue:${c.reset}
  npx tsx src/cli.ts generate --issue ISSUE-001

  ${c.dim}# Generate + write envelope with custom sprint ID:${c.reset}
  npx tsx src/cli.ts generate --issue ISSUE-001 --write --sprint-id SPRINT-SETTLEMENT-055

  ${c.dim}# Start implementation (scope contract + snapshot):${c.reset}
  npx tsx src/cli.ts implement --start \\
    --envelope governance/claude-os/envelopes/SPRINT-045.json \\
    --project unit-talk

  ${c.dim}# Check implementation (validate boundaries + receipt):${c.reset}
  npx tsx src/cli.ts implement --check \\
    --sprint SPRINT-045 --type runtime --summary "Settlement migration"

${c.bold}Supervised-run usage:${c.reset}

  npx tsx src/cli.ts supervised-run \\
    --sprint SPRINT-NAME-### \\
    --type <docs|runtime|build_fix|e2e_lifecycle|ui|schema> \\
    --summary "Sprint objective description" \\
    [--project <id>]  ${c.dim}# defaults to unit-talk${c.reset} \\
    [--envelope <path>] \\
    [--touched area1,area2] \\
    [--timeout <ms>] \\
    [--json]

  ${c.dim}# Supervised-run for Unit Talk runtime sprint:${c.reset}
  npx tsx src/cli.ts supervised-run \\
    --sprint SPRINT-SETTLEMENT-045 \\
    --type runtime \\
    --summary "Migrate settlement off raw_props to provider_offers"

  ${c.dim}# Supervised-run with envelope:${c.reset}
  npx tsx src/cli.ts supervised-run \\
    --envelope governance/claude-os/envelopes/SPRINT-044R.json

${c.bold}Execution Levels:${c.reset}

  Level 0: AUTOPILOT      — Docs, config (use 'autopilot run-once')
  Level 1: GUIDED          — Build fixes, low-risk refactors (use 'autopilot run-once')
  Level 2: SUPERVISED      — Runtime, agents, pipelines (use 'supervised-run')
  Level 3: COLLABORATIVE   — Schema, lifecycle, settlement (use 'supervised-run')
  Level 4: HUMAN_LED       — Production data, incidents (manual with verification)

${c.bold}Philosophy:${c.reset}
  supervised-run is the PRIMARY command for high-risk projects like Unit Talk.
  It provides risk-proportional execution with failure classification.
  Autopilot is demoted to Level 0-1 work only (docs, build fixes).
  All commands produce proof artifacts. None modify source code, commit, or push.
`);
}

// ---------------------------------------------------------------------------
// Command: lifecycle-status (SPRINT-CLAUDE-OS-LIFECYCLE-AUTOMATION-HARDENING)
// ---------------------------------------------------------------------------

function commandLifecycleStatus(args: Record<string, string | boolean | string[]>): void {
  const sprint = args.sprint as string | undefined;
  const dateOverride = args.date as string | undefined;
  const jsonOutput = args.json === true;
  const skipTagCheck = args['skip-tag-check'] === true;

  if (!sprint) {
    console.error(`${c.red}ERROR: --sprint <id> is required.${c.reset}`);
    console.error('Usage: lifecycle-status --sprint SPRINT-044-...');
    process.exit(1);
  }

  const result = checkLifecycle(sprint, { dateOverride, skipTagCheck });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    const exitCode = result.overall === 'ACTION_REQUIRED' ? 1 : 0;
    process.exit(exitCode);
  }

  // Human-readable output
  const overallColor =
    result.overall === 'COMPLETE'
      ? c.green
      : result.overall === 'IN_PROGRESS'
        ? c.cyan
        : result.overall === 'ACTION_REQUIRED'
          ? c.red
          : c.yellow;

  console.log(`\n${c.bold}${c.cyan}CLAUDE OS — Sprint Lifecycle Status${c.reset}`);
  console.log(`${c.bold}Sprint:${c.reset} ${sprint}`);
  console.log(`${c.bold}Checked:${c.reset} ${result.checkedAt}`);
  console.log(`${c.bold}Overall:${c.reset} ${overallColor}${result.overall}${c.reset}\n`);

  console.log(`${c.bold}--- Lifecycle Gates ---${c.reset}`);

  for (const dim of Object.values(result.checks)) {
    const statusColor =
      dim.status === 'PASS'
        ? c.green
        : dim.status === 'FAIL'
          ? c.red
          : dim.status === 'PENDING'
            ? c.yellow
            : c.dim;

    const icon =
      dim.status === 'PASS'
        ? '✅'
        : dim.status === 'FAIL'
          ? '❌'
          : dim.status === 'PENDING'
            ? '⏳'
            : '❓';

    console.log(
      `  ${icon} ${c.bold}${dim.label.padEnd(20)}${c.reset} ${statusColor}${dim.status}${c.reset}`
    );
    console.log(`     ${c.dim}${dim.detail}${c.reset}`);
    if (dim.nextStep && dim.status !== 'PASS') {
      const humanTag = dim.requiresHuman ? ` ${c.yellow}[human]${c.reset}` : '';
      console.log(`     ${c.cyan}→ ${dim.nextStep}${c.reset}${humanTag}`);
    }
    console.log('');
  }

  if (result.nextSteps.length > 0) {
    console.log(`${c.bold}--- Next Steps ---${c.reset}`);
    for (const step of result.nextSteps) {
      const humanTag = step.requiresHuman
        ? ` ${c.yellow}(needs you)${c.reset}`
        : ` ${c.dim}(auto-safe)${c.reset}`;
      console.log(`  ${step.priority}. ${step.action}${humanTag}`);
      if (step.command) {
        console.log(`     ${c.dim}${step.command}${c.reset}`);
      }
    }
    console.log('');
  } else if (result.overall === 'COMPLETE') {
    console.log(`${c.green}${c.bold}Sprint lifecycle complete. Nothing more to do.${c.reset}\n`);
  }

  const exitCode = result.overall === 'ACTION_REQUIRED' ? 1 : 0;
  process.exit(exitCode);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const { command, args } = parseArgs(process.argv);

  switch (command) {
    case 'plan':
      commandPlan(args);
      break;
    case 'verify':
      commandVerify(args);
      break;
    case 'bundle':
      commandBundle(args);
      break;
    case 'run':
      commandRun(args);
      break;
    case 'validate':
      commandValidate();
      break;
    case 'portfolio:audit':
      commandPortfolioAudit(args);
      break;
    case 'issue':
      commandIssue(args);
      break;
    case 'eligible':
      commandEligible(args);
      break;
    case 'generate':
      commandGenerate(args);
      break;
    case 'implement':
      commandImplement(args);
      break;
    case 'autopilot':
      commandAutopilot(args);
      break;
    case 'supervised-run':
      commandSupervisedRun(args);
      break;
    case 'sprint':
      commandSprint(args);
      break;
    case 'lifecycle-status':
      commandLifecycleStatus(args);
      break;
    case 'findings':
      commandFindings(args);
      break;
    case 'route':
      // LLM Routing Engine — emits a governed multi-LLM routing plan for /sprint-plan
      // Usage: cli.ts route --sprint <id> --summary "<text>" [--type <type>]
      //        [--layer <L>] [--phase <P>] [--orchestration-mode A|B|C]
      //        [--output-dir <path>]
      runRouterCli(process.argv.slice(2));
      break;
    case 'help':
    case '--help':
    case '-h':
      printHelp();
      break;
    default:
      console.error(`${c.red}Unknown command: ${command}${c.reset}`);
      printHelp();
      process.exit(1);
  }
}

main();
