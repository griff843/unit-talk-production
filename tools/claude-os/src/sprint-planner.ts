/**
 * Claude OS — Sprint Planner
 *
 * The heart of Phase B. Assembles a conservative SprintExecutionPlan
 * from governed inputs. This is planning only — no code mutation.
 *
 * Given a SprintExecutionRequest, produces:
 * - Governance load summary
 * - Context pack summary
 * - Verification requirements
 * - Proof requirements
 * - Artifact plan
 * - Drift signals
 * - Fail-closed blockers
 * - Deferred requirements
 * - Next-step recommendations
 */

import { planArtifacts } from './artifact-planner.js';
import { buildContextPack } from './context-loader.js';
import { evaluateDrift, configFromProfile } from './drift-sentinel.js';
import { loadGovernance } from './governance-loader.js';
import { MAX_AUTOPILOT_LEVEL, EXECUTION_LEVEL_NAMES } from './types.js';
import { resolveVerification, isValidSprintType } from './verification-resolver.js';

import type {
  SprintExecutionRequest,
  SprintExecutionPlan,
  SprintExecutionPlanStatus,
  GovernanceSummary,
  ContextPackSummary,
  FailClosedReason,
  DeferredRequirement,
  VerificationRequirement,
  ProofRequirement,
  ProjectProfile,
  TaskEnvelope,
  ProfileDomainKeywordMap,
  ExecutionLevel,
  RiskEscalation,
} from './types.js';


// ---------------------------------------------------------------------------
// Plan Assembly
// ---------------------------------------------------------------------------

/**
 * Assemble a sprint execution plan from governed inputs.
 * Fail-closed: if governance cannot be loaded, the plan is blocked.
 */
export function assembleSprintPlan(request: SprintExecutionRequest): SprintExecutionPlan {
  const failClosedBlockers: FailClosedReason[] = [];
  const deferredRequirements: DeferredRequirement[] = [];
  const nextStepRecommendations: string[] = [];

  // --- Validate sprint type ---
  if (!isValidSprintType(request.sprintType)) {
    failClosedBlockers.push({
      rule: 'Rule 7: Ambiguous Canonical Target',
      description: `Unrecognized sprint type: '${request.sprintType}'. Valid types: docs, runtime, build_fix, e2e_lifecycle, ui, schema.`,
      severity: 'blocking',
      source: 'sprint-planner',
      resolution: `Specify a valid sprint type in the request.`,
    });
  }

  // --- Validate sprint ID format ---
  if (!request.sprintId.startsWith('SPRINT-')) {
    failClosedBlockers.push({
      rule: 'Sprint Naming Convention',
      description: `Sprint ID '${request.sprintId}' does not follow SPRINT-<NAME>-### convention.`,
      severity: 'blocking',
      source: 'sprint-planner',
      resolution: 'Use format: SPRINT-<NAME>-###',
    });
  }

  // --- Load governance ---
  const governance = loadGovernance();
  const governanceSummary: GovernanceSummary = {
    lawsLoaded: governance.systemLaws.length,
    contractsLoaded: governance.loadedFiles.length,
    recipesLoaded:
      (governance.verificationRecipes?.recipes.length ?? 0) +
      (governance.proofRecipes?.sprint_types.length ?? 0),
    loadErrors: governance.errors.map(e => `${e.file}: ${e.error}`),
  };

  if (!governance.success) {
    for (const err of governance.errors.filter(e => e.isFatal)) {
      failClosedBlockers.push({
        rule: 'Rule 1: Missing Truth Source',
        description: `Required governance artifact failed to load: ${err.file}`,
        severity: 'blocking',
        source: 'governance-loader',
        resolution: `Ensure ${err.file} exists and is valid. Error: ${err.error}`,
      });
    }
  }

  // --- Build context pack ---
  let contextPackSummary: ContextPackSummary = {
    alwaysLoadedCount: 0,
    sprintSpecificCount: 0,
    optionalCount: 0,
    failedCount: 0,
    isComplete: false,
  };

  if (governance.contextManifest) {
    // Determine relevant domains from touched areas
    const relevantDomains = deriveRelevantDomains(request);

    const contextPack = buildContextPack(
      governance.contextManifest,
      request.sprintId,
      relevantDomains
    );

    contextPackSummary = {
      alwaysLoadedCount: contextPack.loaded.filter(e => e.category === 'always').length,
      sprintSpecificCount: contextPack.loaded.filter(e => e.category === 'sprint_specific').length,
      optionalCount: contextPack.loaded.filter(e => e.category === 'optional').length,
      failedCount: contextPack.failed.length,
      isComplete: contextPack.isComplete,
    };

    // Propagate context fail-closed reasons
    for (const reason of contextPack.failClosedReasons) {
      failClosedBlockers.push(reason);
    }
  }

  // --- Resolve verification requirements ---
  let verificationRequirements: VerificationRequirement[] = [];
  let proofRequirements: ProofRequirement[] = [];

  if (
    governance.verificationRecipes &&
    governance.proofRecipes &&
    isValidSprintType(request.sprintType)
  ) {
    const verification = resolveVerification(
      request.sprintType,
      governance.verificationRecipes,
      governance.proofRecipes
    );

    verificationRequirements = [...verification.required, ...verification.recommended];
    proofRequirements = [...verification.proofRequired, ...verification.proofOptional];

    // Check if runtime proof is required but not declared
    if (verification.runtimeProofRequired && request.runtimeProofRequired === false) {
      failClosedBlockers.push({
        rule: 'Rule 6: Runtime Evidence Required But Unavailable',
        description: `Sprint type '${request.sprintType}' requires runtime proof (tier ${verification.verificationTier}), but request declares runtimeProofRequired=false.`,
        severity: 'blocking',
        source: 'verification-resolver',
        resolution:
          'Set runtimeProofRequired to true, or use a sprint type that does not require runtime proof.',
      });
    }

    // Add unresolved verification items as deferred
    for (const item of verification.unresolvedItems) {
      deferredRequirements.push(item);
    }

    // Check for unresolved commands in required verification
    const unresolvedRequired = verification.required.filter(r => !r.commandResolved && r.required);
    if (unresolvedRequired.length > 0) {
      nextStepRecommendations.push(
        `${unresolvedRequired.length} required verification recipe(s) have placeholder commands. ` +
          `These must be resolved before verification can execute: ${unresolvedRequired.map(r => r.recipeId).join(', ')}.`
      );
    }
  }

  // --- Plan artifacts ---
  const artifactDate = request.requestedArtifactDate ?? 'today';
  const artifactPlan = isValidSprintType(request.sprintType)
    ? planArtifacts(request.sprintId, artifactDate, request.sprintType, proofRequirements)
    : planArtifacts(request.sprintId, artifactDate, 'docs', proofRequirements);

  // --- Evaluate drift ---
  const driftSignals = evaluateDrift(request, governance.packageOwnership, governance.systemLaws);

  // Critical drift signals become fail-closed blockers (no execution level → always block)
  for (const signal of driftSignals) {
    if (signal.severity === 'critical') {
      failClosedBlockers.push({
        rule: signal.lawReference ?? 'Drift Detection',
        description: signal.description,
        severity: 'blocking',
        source: 'drift-sentinel',
        resolution: signal.recommendation,
      });
    }
  }

  // --- Determine plan status ---
  const status: SprintExecutionPlanStatus =
    failClosedBlockers.length > 0
      ? 'blocked'
      : deferredRequirements.length > 0
        ? 'incomplete'
        : 'ready';

  // --- Generate recommendations ---
  if (status === 'ready') {
    nextStepRecommendations.push(
      'Plan is viable. Next: populate sprint contract, get human approval, begin implementation.'
    );
  } else if (status === 'blocked') {
    nextStepRecommendations.push(
      `Plan is BLOCKED by ${failClosedBlockers.length} fail-closed condition(s). Resolve blockers before proceeding.`
    );
  } else {
    nextStepRecommendations.push(
      `Plan is incomplete — ${deferredRequirements.length} item(s) deferred. ` +
        'Sprint can proceed with documented limitations if deferred items are non-critical.'
    );
  }

  if (driftSignals.length > 0) {
    nextStepRecommendations.push(
      `Drift sentinel detected ${driftSignals.length} signal(s). Review before implementation.`
    );
  }

  return {
    status,
    request,
    governanceSummary,
    contextPackSummary,
    verificationRequirements,
    proofRequirements,
    artifactPlan,
    driftSignals,
    failClosedBlockers,
    riskEscalations: [],
    deferredRequirements,
    nextStepRecommendations,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Assemble a profile-aware sprint execution plan.
 * Uses project profile for drift config, verification defaults, and domain keywords.
 * Optionally merges task envelope data into the request.
 *
 * When executionLevel is provided, critical drift signals from risk-area detection
 * are handled proportionally:
 * - Level 0-1 (AUTOPILOT/GUIDED): critical areas → hard blockers (fail-closed)
 * - Level 2+ (SUPERVISED/COLLABORATIVE/HUMAN_LED): critical areas → risk escalations
 *   (flagged, annotated, stronger verification required, but NOT blocking)
 *
 * True governance violations (missing truth sources, invalid sprint type, etc.)
 * always remain hard blockers regardless of execution level.
 */
export function assembleSprintPlanWithProfile(
  request: SprintExecutionRequest,
  profile: ProjectProfile,
  envelope?: TaskEnvelope,
  executionLevel?: ExecutionLevel
): SprintExecutionPlan {
  const failClosedBlockers: FailClosedReason[] = [];
  const deferredRequirements: DeferredRequirement[] = [];
  const nextStepRecommendations: string[] = [];

  // --- Merge envelope data into request if provided ---
  const effectiveRequest = envelope ? mergeEnvelopeIntoRequest(request, envelope) : request;

  // --- Validate sprint type ---
  if (!isValidSprintType(effectiveRequest.sprintType)) {
    failClosedBlockers.push({
      rule: 'Rule 7: Ambiguous Canonical Target',
      description: `Unrecognized sprint type: '${effectiveRequest.sprintType}'. Valid types: docs, runtime, build_fix, e2e_lifecycle, ui, schema.`,
      severity: 'blocking',
      source: 'sprint-planner',
      resolution: `Specify a valid sprint type in the request.`,
    });
  }

  // --- Validate sprint ID format ---
  if (!effectiveRequest.sprintId.startsWith('SPRINT-')) {
    failClosedBlockers.push({
      rule: 'Sprint Naming Convention',
      description: `Sprint ID '${effectiveRequest.sprintId}' does not follow SPRINT-<NAME>-### convention.`,
      severity: 'blocking',
      source: 'sprint-planner',
      resolution: 'Use format: SPRINT-<NAME>-###',
    });
  }

  // --- Load governance ---
  const governance = loadGovernance();
  const governanceSummary: GovernanceSummary = {
    lawsLoaded: governance.systemLaws.length,
    contractsLoaded: governance.loadedFiles.length,
    recipesLoaded:
      (governance.verificationRecipes?.recipes.length ?? 0) +
      (governance.proofRecipes?.sprint_types.length ?? 0),
    loadErrors: governance.errors.map(e => `${e.file}: ${e.error}`),
  };

  if (!governance.success) {
    for (const err of governance.errors.filter(e => e.isFatal)) {
      failClosedBlockers.push({
        rule: 'Rule 1: Missing Truth Source',
        description: `Required governance artifact failed to load: ${err.file}`,
        severity: 'blocking',
        source: 'governance-loader',
        resolution: `Ensure ${err.file} exists and is valid. Error: ${err.error}`,
      });
    }
  }

  // --- Build context pack (using profile domain keywords) ---
  let contextPackSummary: ContextPackSummary = {
    alwaysLoadedCount: 0,
    sprintSpecificCount: 0,
    optionalCount: 0,
    failedCount: 0,
    isComplete: false,
  };

  if (governance.contextManifest) {
    const relevantDomains = deriveRelevantDomains(effectiveRequest, profile.domainKeywords);

    const contextPack = buildContextPack(
      governance.contextManifest,
      effectiveRequest.sprintId,
      relevantDomains
    );

    contextPackSummary = {
      alwaysLoadedCount: contextPack.loaded.filter(e => e.category === 'always').length,
      sprintSpecificCount: contextPack.loaded.filter(e => e.category === 'sprint_specific').length,
      optionalCount: contextPack.loaded.filter(e => e.category === 'optional').length,
      failedCount: contextPack.failed.length,
      isComplete: contextPack.isComplete,
    };

    for (const reason of contextPack.failClosedReasons) {
      failClosedBlockers.push(reason);
    }
  }

  // --- Resolve verification (using profile defaults) ---
  let verificationRequirements: VerificationRequirement[] = [];
  let proofRequirements: ProofRequirement[] = [];

  if (
    governance.verificationRecipes &&
    governance.proofRecipes &&
    isValidSprintType(effectiveRequest.sprintType)
  ) {
    // Envelope tier override uses floor: max(envelope.tier, profile minimum)
    const overrideTier = envelope?.verificationTierOverride;

    const verification = resolveVerification(
      effectiveRequest.sprintType,
      governance.verificationRecipes,
      governance.proofRecipes,
      overrideTier,
      profile.verificationDefaults
    );

    verificationRequirements = [...verification.required, ...verification.recommended];
    proofRequirements = [...verification.proofRequired, ...verification.proofOptional];

    if (verification.runtimeProofRequired && effectiveRequest.runtimeProofRequired === false) {
      failClosedBlockers.push({
        rule: 'Rule 6: Runtime Evidence Required But Unavailable',
        description: `Sprint type '${effectiveRequest.sprintType}' requires runtime proof (tier ${verification.verificationTier}), but request declares runtimeProofRequired=false.`,
        severity: 'blocking',
        source: 'verification-resolver',
        resolution:
          'Set runtimeProofRequired to true, or use a sprint type that does not require runtime proof.',
      });
    }

    for (const item of verification.unresolvedItems) {
      deferredRequirements.push(item);
    }

    const unresolvedRequired = verification.required.filter(r => !r.commandResolved && r.required);
    if (unresolvedRequired.length > 0) {
      nextStepRecommendations.push(
        `${unresolvedRequired.length} required verification recipe(s) have placeholder commands. ` +
          `These must be resolved before verification can execute: ${unresolvedRequired.map(r => r.recipeId).join(', ')}.`
      );
    }
  }

  // --- Plan artifacts ---
  const artifactDate = effectiveRequest.requestedArtifactDate ?? 'today';
  const artifactPlan = isValidSprintType(effectiveRequest.sprintType)
    ? planArtifacts(
        effectiveRequest.sprintId,
        artifactDate,
        effectiveRequest.sprintType,
        proofRequirements
      )
    : planArtifacts(effectiveRequest.sprintId, artifactDate, 'docs', proofRequirements);

  // --- Evaluate drift (using profile config) ---
  const driftConfig = configFromProfile(profile);
  const driftSignals = evaluateDrift(
    effectiveRequest,
    governance.packageOwnership,
    governance.systemLaws,
    driftConfig
  );

  // --- Execution-level-aware drift signal handling (CLAUDE-OS-REDESIGN-001) ---
  const riskEscalations: RiskEscalation[] = [];
  const effectiveLevel: ExecutionLevel = executionLevel ?? 0;
  const supervisedOrAbove = effectiveLevel > MAX_AUTOPILOT_LEVEL;

  for (const signal of driftSignals) {
    if (signal.severity === 'critical') {
      if (supervisedOrAbove) {
        // Level 2+: Critical areas become risk escalations, not blockers.
        // The human is supervising — flag it, annotate it, elevate verification.
        riskEscalations.push({
          area: signal.area,
          severity: 'critical',
          description: signal.description,
          recommendation: signal.recommendation,
          executionLevelAtEvaluation: effectiveLevel,
          lawReference: signal.lawReference,
        });
      } else {
        // Level 0-1: Critical areas are hard blockers (fail-closed).
        failClosedBlockers.push({
          rule: signal.lawReference ?? 'Drift Detection',
          description: signal.description,
          severity: 'blocking',
          source: 'drift-sentinel',
          resolution: signal.recommendation,
        });
      }
    }
  }

  // --- Add envelope deferred requirements ---
  if (envelope?.deferredRequirements) {
    for (const desc of envelope.deferredRequirements) {
      deferredRequirements.push({
        category: 'envelope',
        description: desc,
        reason: 'Deferred per task envelope',
        suggestedPhase: 'Future sprint',
      });
    }
  }

  // --- Determine plan status ---
  const status: SprintExecutionPlanStatus =
    failClosedBlockers.length > 0
      ? 'blocked'
      : deferredRequirements.length > 0
        ? 'incomplete'
        : 'ready';

  // --- Generate recommendations ---
  if (status === 'ready') {
    nextStepRecommendations.push(
      'Plan is viable. Next: populate sprint contract, get human approval, begin implementation.'
    );
  } else if (status === 'blocked') {
    nextStepRecommendations.push(
      `Plan is BLOCKED by ${failClosedBlockers.length} fail-closed condition(s). Resolve blockers before proceeding.`
    );
  } else {
    nextStepRecommendations.push(
      `Plan is incomplete — ${deferredRequirements.length} item(s) deferred. ` +
        'Sprint can proceed with documented limitations if deferred items are non-critical.'
    );
  }

  if (driftSignals.length > 0) {
    nextStepRecommendations.push(
      `Drift sentinel detected ${driftSignals.length} signal(s). Review before implementation.`
    );
  }

  // Risk escalation annotations for supervised mode
  if (riskEscalations.length > 0) {
    const levelName = EXECUTION_LEVEL_NAMES[effectiveLevel];
    nextStepRecommendations.push(
      `${riskEscalations.length} critical area(s) acknowledged as risk escalation(s) at Level ${effectiveLevel} (${levelName}). ` +
        'Stronger verification and proof annotations are required. Human ratification recommended before merge.'
    );
  }

  return {
    status,
    request: effectiveRequest,
    governanceSummary,
    contextPackSummary,
    verificationRequirements,
    proofRequirements,
    artifactPlan,
    driftSignals,
    failClosedBlockers,
    riskEscalations,
    deferredRequirements,
    nextStepRecommendations,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Merge envelope data into a sprint request. Envelope values fill in
 * any fields not already set on the request.
 */
function mergeEnvelopeIntoRequest(
  request: SprintExecutionRequest,
  envelope: TaskEnvelope
): SprintExecutionRequest {
  return {
    sprintId: request.sprintId || envelope.taskId,
    sprintType: request.sprintType || envelope.taskType,
    summary: request.summary || envelope.summary,
    objective: request.objective || envelope.objective,
    touchedAreas: request.touchedAreas?.length ? request.touchedAreas : envelope.touchedAreas,
    requestedArtifactDate: request.requestedArtifactDate || envelope.artifactDate,
    runtimeProofRequired: request.runtimeProofRequired ?? envelope.runtimeProofRequired,
  };
}

/** Default domain keywords — used when no profile is loaded */
const DEFAULT_DOMAIN_KEYWORDS: ProfileDomainKeywordMap = {
  unified_picks: ['unified_picks', 'pick', 'lifecycle', 'settlement', 'promotion'],
  discord: ['discord', 'embed', 'posting', 'distribution', 'channel'],
  ingestion: ['ingestion', 'provider_offers', 'raw_props', 'provider', 'feed'],
  schema: ['migration', 'schema', 'alter', 'table', 'column'],
  'smart-form': ['smart-form', 'smartform', 'bridge_outbox', 'submission'],
  agents: ['agent', 'feedagent', 'gradingagent', 'settlementagent'],
};

/** Derive relevant context domains from a sprint request */
function deriveRelevantDomains(
  request: SprintExecutionRequest,
  domainKeywords?: ProfileDomainKeywordMap
): string[] {
  const domains: string[] = [];
  const text =
    `${request.summary} ${request.objective ?? ''} ${(request.touchedAreas ?? []).join(' ')}`.toLowerCase();

  const keywords = domainKeywords ?? DEFAULT_DOMAIN_KEYWORDS;

  for (const [domain, kws] of Object.entries(keywords)) {
    if (kws.some(kw => text.includes(kw))) {
      domains.push(domain);
    }
  }

  return domains;
}
