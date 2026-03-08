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

import { loadEnvelope, envelopeToRequest } from './envelope-loader.js';
import { loadGovernance } from './governance-loader.js';
import { loadProfileById, loadProfileFromPath } from './profile-loader.js';
import { assembleSprintPlan, assembleSprintPlanWithProfile } from './sprint-planner.js';
import { executeVerification } from './verification-executor.js';
import { isValidSprintType } from './verification-resolver.js';

import type {
  SprintExecutionRequest,
  SprintExecutionPlan,
  SprintType,
  ProjectProfile,
  VerificationExecutionResult,
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
// Help
// ---------------------------------------------------------------------------

function printHelp(): void {
  console.log(`
${c.bold}Claude OS — Governed Sprint Execution Foundation${c.reset}

${c.bold}Commands:${c.reset}

  ${c.cyan}plan${c.reset}      Assemble a dry-run sprint execution plan
  ${c.cyan}verify${c.reset}    Execute verification steps and capture evidence
  ${c.cyan}validate${c.reset}  Validate governance artifact loading

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

  ${c.dim}# Dry-run verify (classify without executing):${c.reset}
  npx tsx src/cli.ts verify \\
    --sprint SPRINT-DOCS-001 \\
    --type docs \\
    --summary "Documentation update" \\
    --dry-run

  ${c.dim}# Envelope-driven:${c.reset}
  npx tsx src/cli.ts plan \\
    --project unit-talk \\
    --envelope governance/claude-os/envelopes/example-runtime-sprint.json

  npx tsx src/cli.ts validate

${c.bold}Philosophy:${c.reset}
  Plan is dry-run only — resolves requirements and evaluates drift.
  Verify executes resolved commands and captures evidence artifacts.
  Neither modifies source code, commits, or pushes.
`);
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
    case 'validate':
      commandValidate();
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
