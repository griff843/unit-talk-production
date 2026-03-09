/**
 * Claude OS Runtime Types
 *
 * Core type definitions for the governed sprint execution foundation.
 * These types mirror the governance artifacts under governance/claude-os/
 * and provide compile-time contracts for runtime operations.
 */

// ---------------------------------------------------------------------------
// Governance Artifact Types
// ---------------------------------------------------------------------------

/** Represents a single context source entry from context-manifest.json */
export interface ContextSource {
  id: string;
  path: string;
  purpose: string;
  priority?: number;
  required?: boolean;
  fail_on_missing?: boolean;
  load_type?: 'file' | 'directory_glob';
  glob?: string;
  when_relevant?: string;
  required_when_relevant?: boolean;
  notes?: string;
}

/** Sprint-specific context with path template */
export interface SprintContextSource extends ContextSource {
  path_template?: string;
}

/** Forbidden context source definition */
export interface ForbiddenContextSource {
  source: string;
  reason: string;
  exception: string;
}

/** The full context manifest as defined in context-manifest.json */
export interface ContextManifest {
  version: string;
  description: string;
  default_context_pack: string;
  always_load: ContextSource[];
  sprint_specific: SprintContextSource[];
  optional_context: ContextSource[];
  forbidden_context_sources: ForbiddenContextSource[];
  truth_priority_order: string[];
  notes: string[];
}

/** Resolved context pack — what was actually loaded for a session/sprint */
export interface ContextPack {
  manifest: ContextManifest;
  loaded: LoadedContextEntry[];
  failed: FailedContextEntry[];
  truthPriorityOrder: string[];
  forbiddenSources: ForbiddenContextSource[];
  isComplete: boolean;
  failClosedReasons: FailClosedReason[];
}

export interface LoadedContextEntry {
  id: string;
  path: string;
  category: 'always' | 'sprint_specific' | 'optional';
  contentType: 'json' | 'markdown' | 'text';
  /** Raw content as string — semantic parsing is module-specific */
  content: string;
  /** Parsed JSON if contentType is 'json', null otherwise */
  parsed: unknown | null;
}

export interface FailedContextEntry {
  id: string;
  path: string;
  category: 'always' | 'sprint_specific' | 'optional';
  reason: string;
  isFatal: boolean;
}

// ---------------------------------------------------------------------------
// Verification & Proof Types
// ---------------------------------------------------------------------------

/** A single verification recipe from verification-recipes.json */
export interface VerificationRecipe {
  id: string;
  purpose: string;
  when_required: string;
  evidence_expected: string;
  command_placeholder: string;
  output_file: string;
  failure_severity: 'blocking' | 'degraded' | 'informational';
  notes: string;
}

/** Wrapper for the full verification recipes file */
export interface VerificationRecipeSet {
  version: string;
  description: string;
  recipes: VerificationRecipe[];
}

/** A sprint type's proof recipe from proof-recipes.json */
export interface ProofRecipeEntry {
  category: string;
  artifact: string;
  description: string;
}

export interface ProofRecipe {
  type: SprintType;
  description: string;
  verification_tier: VerificationTier;
  required_proof: ProofRecipeEntry[];
  optional_proof: ProofRecipeEntry[];
  ratification_threshold: string;
  notes: string;
}

export interface ProofRecipeSet {
  version: string;
  description: string;
  sprint_types: ProofRecipe[];
}

// ---------------------------------------------------------------------------
// Package Ownership Types
// ---------------------------------------------------------------------------

export interface PackageOwnershipEntry {
  area: string;
  category: string;
  responsibility: string;
  change_risk: 'low' | 'medium' | 'high' | 'critical';
  requires_extra_verification: boolean;
  notes: string;
}

export interface PackageOwnershipMap {
  version: string;
  description: string;
  areas: PackageOwnershipEntry[];
}

// ---------------------------------------------------------------------------
// Sprint Execution Types
// ---------------------------------------------------------------------------

export type SprintType = 'docs' | 'runtime' | 'build_fix' | 'e2e_lifecycle' | 'ui' | 'schema';

export type VerificationTier = 'T1' | 'T2' | 'T3' | 'T4';

// ---------------------------------------------------------------------------
// Execution Level Types (CLAUDE-OS-REDESIGN-001)
// ---------------------------------------------------------------------------

/**
 * Risk-proportional execution levels.
 *
 * Level 0 — AUTOPILOT:     Docs, config, non-functional changes
 * Level 1 — GUIDED:        Build fixes, test additions, low-risk refactors
 * Level 2 — SUPERVISED:    Runtime changes, agent modifications, pipeline work
 * Level 3 — COLLABORATIVE: Schema migrations, lifecycle changes, settlement logic
 * Level 4 — HUMAN_LED:     Production data operations, emergency incident response
 */
export type ExecutionLevel = 0 | 1 | 2 | 3 | 4;

export const EXECUTION_LEVEL_NAMES: Record<ExecutionLevel, string> = {
  0: 'AUTOPILOT',
  1: 'GUIDED',
  2: 'SUPERVISED',
  3: 'COLLABORATIVE',
  4: 'HUMAN_LED',
};

/** Maximum execution level eligible for fully autonomous (autopilot) pipeline */
export const MAX_AUTOPILOT_LEVEL: ExecutionLevel = 1;

// ---------------------------------------------------------------------------
// Failure Classification Types (CLAUDE-OS-REDESIGN-001)
// ---------------------------------------------------------------------------

/** Category of a verification failure */
export type FailureCategory =
  | 'application' // Code bug caught by test/build
  | 'infrastructure' // Service unreachable, database down
  | 'toolchain' // Recipe placeholder, missing binary
  | 'environment' // Corrupted node_modules, git lock
  | 'governance' // Single-writer violation, invariant breach
  | 'transient'; // Timeout, flaky test, network blip

/** Classified failure result */
export interface ClassifiedFailure {
  category: FailureCategory;
  confidence: number; // 0.0–1.0
  retryable: boolean;
  evidence: string;
  suggestedAction: string;
}

// ---------------------------------------------------------------------------
// Risk Escalation Types (CLAUDE-OS-REDESIGN-001)
// ---------------------------------------------------------------------------

/**
 * Risk escalation annotation — a critical area acknowledged but not blocking
 * in supervised/collaborative/human-led execution modes.
 *
 * In autopilot (Level 0-1), critical areas become hard blockers.
 * In supervised+ (Level 2+), critical areas become risk escalations with
 * stronger verification requirements and proof annotations.
 */
export interface RiskEscalation {
  area: string;
  severity: 'critical' | 'high';
  description: string;
  recommendation: string;
  /** Execution level at the time this escalation was evaluated */
  executionLevelAtEvaluation: ExecutionLevel;
  lawReference?: string;
}

/** Input request to plan a sprint */
export interface SprintExecutionRequest {
  sprintId: string;
  sprintType: SprintType;
  summary: string;
  objective?: string;
  touchedAreas?: string[];
  requestedArtifactDate?: string; // YYYY-MM-DD
  runtimeProofRequired?: boolean;
}

/** Status of a sprint execution plan */
export type SprintExecutionPlanStatus =
  | 'ready' // Plan is viable, no blockers
  | 'blocked' // Fail-closed conditions prevent execution
  | 'incomplete'; // Plan assembled but has unresolved items

/** The assembled sprint execution plan — output of sprint-planner */
export interface SprintExecutionPlan {
  status: SprintExecutionPlanStatus;
  request: SprintExecutionRequest;
  governanceSummary: GovernanceSummary;
  contextPackSummary: ContextPackSummary;
  verificationRequirements: VerificationRequirement[];
  proofRequirements: ProofRequirement[];
  artifactPlan: ArtifactPlan;
  driftSignals: DriftSignal[];
  failClosedBlockers: FailClosedReason[];
  /** Critical areas acknowledged but not blocking in supervised mode (CLAUDE-OS-REDESIGN-001) */
  riskEscalations: RiskEscalation[];
  deferredRequirements: DeferredRequirement[];
  nextStepRecommendations: string[];
  generatedAt: string; // ISO timestamp
}

export interface GovernanceSummary {
  lawsLoaded: number;
  contractsLoaded: number;
  recipesLoaded: number;
  loadErrors: string[];
}

export interface ContextPackSummary {
  alwaysLoadedCount: number;
  sprintSpecificCount: number;
  optionalCount: number;
  failedCount: number;
  isComplete: boolean;
}

// ---------------------------------------------------------------------------
// Verification & Proof Requirements
// ---------------------------------------------------------------------------

export interface VerificationRequirement {
  recipeId: string;
  purpose: string;
  required: boolean;
  commandPlaceholder: string;
  commandResolved: boolean;
  outputFile: string;
  failureSeverity: 'blocking' | 'degraded' | 'informational';
  notes: string;
}

export interface ProofRequirement {
  category: string;
  artifact: string;
  description: string;
  required: boolean;
}

// ---------------------------------------------------------------------------
// Artifact Planning
// ---------------------------------------------------------------------------

export interface ArtifactPlan {
  sprintId: string;
  date: string;
  canonicalRoot: string;
  requiredDirectories: string[];
  requiredFiles: ArtifactFileExpectation[];
  notes: string[];
}

export interface ArtifactFileExpectation {
  relativePath: string;
  category: string;
  description: string;
  required: boolean;
}

// ---------------------------------------------------------------------------
// Drift & Risk
// ---------------------------------------------------------------------------

export interface DriftSignal {
  type: DriftSignalType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  area: string;
  description: string;
  recommendation: string;
  lawReference?: string;
}

export type DriftSignalType =
  | 'deprecated_path_risk'
  | 'ambiguous_canonical_target'
  | 'cross_boundary_risk'
  | 'runtime_build_boundary'
  | 'high_risk_area'
  | 'canonical_write_target'
  | 'truth_conflict_risk'
  | 'missing_truth_source';

// ---------------------------------------------------------------------------
// Fail-Closed & Governance
// ---------------------------------------------------------------------------

export interface FailClosedReason {
  rule: string;
  description: string;
  severity: 'blocking';
  source: string;
  resolution: string;
}

export interface LawReference {
  id: string;
  name: string;
  statement: string;
}

export interface GovernanceLoadResult {
  success: boolean;
  contextManifest: ContextManifest | null;
  verificationRecipes: VerificationRecipeSet | null;
  proofRecipes: ProofRecipeSet | null;
  packageOwnership: PackageOwnershipMap | null;
  systemLaws: LawReference[];
  loadedFiles: string[];
  errors: GovernanceLoadError[];
}

export interface GovernanceLoadError {
  file: string;
  error: string;
  isFatal: boolean;
}

// ---------------------------------------------------------------------------
// Contract Parsing
// ---------------------------------------------------------------------------

/** Partially parsed sprint contract — not all sections are machine-parseable */
export interface ParsedSprintContract {
  raw: string;
  sections: ContractSection[];
  unresolvedSections: string[];
  metadata: Record<string, string>;
}

export interface ContractSection {
  heading: string;
  level: number;
  content: string;
  checklists: ChecklistItem[];
  tables: ParsedTable[];
}

export interface ChecklistItem {
  text: string;
  checked: boolean;
}

export interface ParsedTable {
  headers: string[];
  rows: string[][];
}

// ---------------------------------------------------------------------------
// Runtime Boundary & Deferred
// ---------------------------------------------------------------------------

export interface RuntimeBoundaryNote {
  area: string;
  isBuildTime: boolean;
  isRuntime: boolean;
  notes: string;
}

export interface DeferredRequirement {
  category: string;
  description: string;
  reason: string;
  suggestedPhase: string;
}

// ---------------------------------------------------------------------------
// Project Profile Types
// ---------------------------------------------------------------------------

/** A deprecated path entry in the project profile */
export interface ProfileDeprecatedPath {
  path: string;
  canonical: string;
  context: string;
  alternateCanonical?: { trigger: string; target: string; context: string }[];
}

/** A canonical write target entry */
export interface ProfileCanonicalWriteTarget {
  table: string;
  discipline: string;
  risk: string;
}

/** Domain keyword mapping for context resolution */
export type ProfileDomainKeywordMap = Record<string, string[]>;

/** Verification tier configuration overrides */
export interface ProfileVerificationDefaults {
  sprintTypeTiers?: Partial<Record<SprintType, VerificationTier>>;
  tierRequiredRecipes?: Partial<Record<VerificationTier, string[]>>;
  tierRecommendedRecipes?: Partial<Record<VerificationTier, string[]>>;
}

/** Execution level overrides by task type */
export type TaskTypeExecutionLevels = Partial<Record<SprintType, ExecutionLevel>>;

/** Escalation trigger — patterns that force a higher execution level */
export interface EscalationTrigger {
  pattern: string;
  minLevel: ExecutionLevel;
  reason: string;
}

/** Machine-readable project profile */
export interface ProjectProfile {
  profileVersion: string;
  projectId: string;
  projectName: string;
  projectType: 'monorepo' | 'single-app' | 'library';
  architectureMode: string;

  truthPriorityOrder: string[];
  criticalInvariants: string[];
  deliverySurfaces: string[];

  deprecatedPaths: ProfileDeprecatedPath[];
  canonicalWriteTargets: ProfileCanonicalWriteTarget[];
  runtimeSensitiveAreas: string[];

  domainKeywords: ProfileDomainKeywordMap;
  lifecycleKeywords: string[];
  schemaKeywords: string[];

  verificationDefaults: ProfileVerificationDefaults;

  /** Default execution level for this project (CLAUDE-OS-REDESIGN-001) */
  defaultExecutionLevel?: ExecutionLevel;
  /** Per-task-type execution level overrides (CLAUDE-OS-REDESIGN-001) */
  taskTypeExecutionLevels?: TaskTypeExecutionLevels;
  /** Patterns that force escalation to a higher level (CLAUDE-OS-REDESIGN-001) */
  escalationTriggers?: EscalationTrigger[];

  artifactConventions: {
    artifactBase: string;
    standardDirectories: string[];
  };

  riskAreas: {
    area: string;
    description: string;
    lawReference?: string;
  }[];
}

/** Result of loading a project profile */
export interface ProfileLoadResult {
  success: boolean;
  profile: ProjectProfile | null;
  source: string;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Task Envelope Types
// ---------------------------------------------------------------------------

/** Machine-readable task execution envelope */
export interface TaskEnvelope {
  envelopeVersion: string;
  taskId: string;
  taskType: SprintType;
  projectId: string;

  objective: string;
  summary: string;

  touchedAreas: string[];
  truthSourcesRequired: string[];

  verificationTierOverride?: VerificationTier;
  runtimeProofRequired?: boolean;

  artifactRoot?: string;
  artifactDate?: string;

  killConditions: string[];
  notes: string[];
  deferredRequirements: string[];
}

/** Result of loading a task envelope */
export interface EnvelopeLoadResult {
  success: boolean;
  envelope: TaskEnvelope | null;
  source: string;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Verification Execution Types (Phase C)
// ---------------------------------------------------------------------------

/** Result of running a single shell command */
export interface CommandRunResult {
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

/** Options for command execution */
export interface CommandRunOptions {
  timeoutMs?: number;
  cwd?: string;
}

/** Function signature for command execution (enables DI in tests) */
export type CommandRunner = (command: string, options?: CommandRunOptions) => CommandRunResult;

/** Possible outcomes of a verification step */
export type VerificationStepStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED';

/** Result of executing a single verification recipe */
export interface VerificationStepResult {
  recipeId: string;
  status: VerificationStepStatus;
  reason: string;
  commandResult: CommandRunResult | null;
  outputFile: string | null;
  durationMs: number;
  /** Browser artifacts collected after execution (Phase C.2) */
  browserArtifacts?: BrowserArtifactEntry[];
  /** Failure classification when status is FAIL or BLOCKED (CLAUDE-OS-REDESIGN-001) */
  failureClassification?: ClassifiedFailure;
}

/** Result of the runtime proof gate evaluation */
export interface RuntimeProofGateResult {
  required: boolean;
  satisfied: boolean;
  reason: string;
  missingEvidence: string[];
}

/** Possible overall verification outcomes */
export type VerificationOverallStatus = 'PASS' | 'FAIL' | 'BLOCKED';

/** Numeric summary of step outcomes */
export interface VerificationSummary {
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
}

/** Failure classification summary across all steps (CLAUDE-OS-REDESIGN-001) */
export interface FailureClassificationSummary {
  application: number;
  infrastructure: number;
  toolchain: number;
  environment: number;
  governance: number;
  transient: number;
}

/** Full result of executing all verification steps */
export interface VerificationExecutionResult {
  sprintId: string;
  steps: VerificationStepResult[];
  overallStatus: VerificationOverallStatus;
  evidenceRoot: string;
  runtimeProofGate: RuntimeProofGateResult;
  summary: VerificationSummary;
  /** Failure classification breakdown (CLAUDE-OS-REDESIGN-001) */
  failureClassificationSummary?: FailureClassificationSummary;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Supervised Run Types (CLAUDE-OS-REDESIGN-001)
// ---------------------------------------------------------------------------

/** Result of a supervised-run execution */
export interface SupervisedRunResult {
  sprintId: string;
  executionLevel: ExecutionLevel;
  executionLevelName: string;
  plan: SprintExecutionPlan | null;
  verification: VerificationExecutionResult | null;
  bundle: BundleAssemblyResult | null;
  failureClassificationSummary: FailureClassificationSummary | null;
  status:
    | 'PLAN_READY'
    | 'VERIFIED'
    | 'BUNDLED'
    | 'PLAN_BLOCKED'
    | 'VERIFICATION_FAILED'
    | 'BUNDLE_FAILED';
  reason: string;
  startedAt: string;
  completedAt: string;
}

/** A single entry in the evidence index file */
export interface EvidenceIndexEntry {
  recipeId: string;
  status: VerificationStepStatus;
  outputFile: string | null;
  capturedAt: string;
  /** Browser-specific evidence detail (Phase C.2) */
  browserEvidence?: BrowserEvidenceDetail;
}

/** Machine-readable evidence index written to the artifact root */
export interface EvidenceIndex {
  sprintId: string;
  generatedAt: string;
  evidenceRoot: string;
  entries: EvidenceIndexEntry[];
  runtimeProofGate: RuntimeProofGateResult;
  overallStatus: VerificationOverallStatus;
}

// ---------------------------------------------------------------------------
// Browser Verification Types (Phase C.2)
// ---------------------------------------------------------------------------

/** Browser verification artifact type */
export type BrowserArtifactType =
  | 'screenshot'
  | 'console_log'
  | 'accessibility_snapshot'
  | 'network_log';

/** Expected browser artifact from a verification recipe */
export interface BrowserArtifactExpectation {
  type: BrowserArtifactType;
  /** Glob pattern relative to evidence root, e.g. "proofs/screenshots/*.png" */
  pattern: string;
  required: boolean;
}

/** Captured browser artifact found on disk */
export interface BrowserArtifactEntry {
  type: BrowserArtifactType;
  /** Path relative to evidence root */
  path: string;
  sizeBytes: number;
  capturedAt: string;
}

/** Browser-specific evidence detail, attached to evidence index entries */
export interface BrowserEvidenceDetail {
  browserArtifacts: BrowserArtifactEntry[];
  playwrightAvailable: boolean;
}

// ---------------------------------------------------------------------------
// Proof Bundle Types (Phase D)
// ---------------------------------------------------------------------------

/** Possible verdict statuses for a proof bundle */
export type BundleVerdictStatus = 'PASS' | 'PASS_WITH_LIMITATIONS' | 'BLOCKED' | 'FAIL';

/** Status of a single artifact in the bundle */
export type ArtifactPresenceStatus = 'present' | 'missing' | 'empty';

/** A single artifact's status in the manifest */
export interface BundleManifestEntry {
  relativePath: string;
  category: string;
  description: string;
  required: boolean;
  status: ArtifactPresenceStatus;
  sizeBytes: number | null;
}

/** Bundle completeness summary */
export interface BundleCompletenessCheck {
  totalRequired: number;
  presentRequired: number;
  missingRequired: string[];
  emptyRequired: string[];
  totalOptional: number;
  presentOptional: number;
}

/** Machine-readable manifest.json */
export interface BundleManifest {
  sprintId: string;
  sprintType: SprintType;
  date: string;
  generatedAt: string;
  bundlePath: string;
  verificationTier: VerificationTier;
  artifacts: BundleManifestEntry[];
  completeness: BundleCompletenessCheck;
  verdictSummary: {
    status: BundleVerdictStatus;
    rationale: string;
  };
  runtimeProofGate: RuntimeProofGateResult;
}

/** Evidence checklist entry for verdict evaluation */
export interface VerdictEvidenceEntry {
  category: string;
  artifact: string;
  required: boolean;
  present: boolean;
  nonEmpty: boolean;
  verificationStatus: VerificationStepStatus | null;
}

/** A limitation in a PASS_WITH_LIMITATIONS verdict */
export interface VerdictLimitation {
  description: string;
  severity: 'low' | 'medium' | 'high';
  impact: string;
}

/** A blocker in a BLOCKED verdict */
export interface VerdictBlocker {
  description: string;
  type: 'missing_evidence' | 'verification_failure' | 'infrastructure' | 'governance';
  resolution: string;
}

/** Full verdict output from the verdict engine */
export interface BundleVerdict {
  status: BundleVerdictStatus;
  rationale: string;
  evidenceChecklist: VerdictEvidenceEntry[];
  limitations: VerdictLimitation[];
  blockers: VerdictBlocker[];
  recommendations: string[];
  confidence: 'high' | 'medium' | 'low';
  confidenceRationale: string;
}

/** Input required for bundle assembly */
export interface BundleAssemblyInput {
  plan: SprintExecutionPlan;
  verificationResult: VerificationExecutionResult;
}

/** Result of bundle assembly */
export interface BundleAssemblyResult {
  success: boolean;
  manifest: BundleManifest | null;
  verdict: BundleVerdict | null;
  proofIndexPath: string | null;
  manifestPath: string | null;
  verdictPath: string | null;
  failClosedReasons: FailClosedReason[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Git Evidence Types (Phase E)
// ---------------------------------------------------------------------------

/** Result of capturing a single git evidence command */
export interface GitEvidenceFileEntry {
  command: string;
  outputFile: string;
  success: boolean;
  sizeBytes: number;
  capturedAt: string;
}

/** Overall result of git evidence capture — never hard-fails */
export interface GitEvidenceCaptureResult {
  /** Always true — git evidence capture never causes a hard failure */
  success: boolean;
  /** PASS if all commands succeeded, PASS_WITH_LIMITATIONS if any failed */
  status: 'PASS' | 'PASS_WITH_LIMITATIONS';
  files: GitEvidenceFileEntry[];
  failures: string[];
  capturedAt: string;
}

// ---------------------------------------------------------------------------
// Issue Intake Types (Phase F)
// ---------------------------------------------------------------------------

/** Machine-readable issue file for autonomous intake */
export interface IssueFile {
  issueVersion: string;
  issueId: string;
  projectId: string;
  taskType: SprintType;
  title: string;
  objective: string;
  summary: string;
  acceptanceCriteria: string[];
  touchedAreas: string[];
  dependencies: IssueDependency[];
  truthSourcesRequired?: string[];
  killConditions?: string[];
  notes?: string[];
  status?: IssueStatus;
  priority?: IssuePriority;
}

/** Dependency reference within an issue */
export interface IssueDependency {
  issueId: string;
  status: 'resolved' | 'unresolved' | 'in_progress';
}

/** Allowed issue statuses */
export type IssueStatus = 'open' | 'blocked' | 'paused' | 'closed';

/** Issue priority levels */
export type IssuePriority = 'urgent' | 'high' | 'normal' | 'low';

/** Result of loading an issue file */
export interface IssueLoadResult {
  success: boolean;
  issue: IssueFile | null;
  source: string;
  errors: string[];
}

/** Eligibility evaluation status */
export type EligibilityStatus = 'ELIGIBLE' | 'BLOCKED' | 'INCOMPLETE' | 'UNSUPPORTED';

/** A single eligibility check result */
export interface EligibilityCheck {
  name: string;
  passed: boolean;
  reason: string;
}

/** Full eligibility evaluation result */
export interface EligibilityResult {
  status: EligibilityStatus;
  issueId: string;
  projectId: string;
  checks: EligibilityCheck[];
  blockers: string[];
  warnings: string[];
}

/** Result of envelope generation from an issue */
export interface EnvelopeGenerationResult {
  success: boolean;
  envelope: TaskEnvelope | null;
  issueId: string;
  eligibility: EligibilityResult;
  errors: string[];
  writtenTo?: string;
}

// ---------------------------------------------------------------------------
// Implementation Engine Types (Phase G)
// ---------------------------------------------------------------------------

/** Rule defining allowed or forbidden file paths in a scope contract */
export interface ScopePathRule {
  /** Path pattern (prefix, exact path, or simple glob) */
  pattern: string;
  /** How to match: prefix = startsWith, exact = ===, glob = simple wildcard */
  type: 'prefix' | 'exact' | 'glob';
  /** Origin of this rule (envelope, profile, governance-default) */
  source: string;
}

/** Machine-readable scope contract derived from envelope + profile */
export interface ScopeContract {
  contractVersion: string;
  taskId: string;
  generatedAt: string;
  allowedPaths: ScopePathRule[];
  forbiddenPaths: ScopePathRule[];
  /** strict = any violation is blocking (fail-closed per Rule 9) */
  boundaryMode: 'strict';
  notes: string[];
}

/** Pre-implementation git state snapshot */
export interface PreImplementationSnapshot {
  snapshotVersion: string;
  taskId: string;
  gitHead: string;
  gitBranch: string;
  workingTreeClean: boolean;
  untrackedFiles: string[];
  capturedAt: string;
}

/** Type of boundary violation */
export type BoundaryViolationType = 'outside_allowed' | 'in_forbidden';

/** A single boundary violation detected during check */
export interface BoundaryViolation {
  filePath: string;
  violationType: BoundaryViolationType;
  matchedRule: ScopePathRule | null;
  severity: 'blocking';
}

/** Overall boundary validation status */
export type BoundaryValidationStatus = 'PASS' | 'FAIL';

/** Result of validating changed files against scope contract */
export interface BoundaryValidationResult {
  status: BoundaryValidationStatus;
  totalFilesChecked: number;
  allowedFiles: string[];
  violations: BoundaryViolation[];
  validatedAt: string;
}

/** A single file entry in the change receipt */
export interface ChangeReceiptFileEntry {
  filePath: string;
  changeType: 'added' | 'modified' | 'deleted' | 'renamed';
  linesAdded: number;
  linesRemoved: number;
}

/** Structured record of all changes made during implementation */
export interface ChangeReceipt {
  receiptVersion: string;
  taskId: string;
  preSnapshotHead: string;
  currentHead: string;
  boundaryValidation: BoundaryValidationResult;
  files: ChangeReceiptFileEntry[];
  totalFilesChanged: number;
  totalLinesAdded: number;
  totalLinesRemoved: number;
  generatedAt: string;
}

/** Result of implement --start */
export interface ImplementationStartResult {
  success: boolean;
  scopeContract: ScopeContract | null;
  snapshot: PreImplementationSnapshot | null;
  scopeContractPath: string | null;
  snapshotPath: string | null;
  errors: string[];
}

/** Overall status of implement --check */
export type ImplementationCheckStatus = 'PASS' | 'FAIL' | 'BLOCKED';

/** Result of implement --check */
export interface ImplementationCheckResult {
  success: boolean;
  status: ImplementationCheckStatus;
  boundaryValidation: BoundaryValidationResult | null;
  changeReceipt: ChangeReceipt | null;
  diffArtifactPath: string | null;
  changeReceiptPath: string | null;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Scope-Aware Verification Types (CLAUDE-OS-SCOPE-HARDENING)
// ---------------------------------------------------------------------------

/** Classification of a verification failure relative to sprint scope */
export type ScopeClassification =
  | 'in_scope_failure' // Failure in affected workspace — blocks sprint
  | 'out_of_scope_failure' // Failure in unrelated workspace — annotated, not blocking
  | 'global_blocker'; // Failure in a required global gate — always blocks

/** An affected workspace identified by blast-radius analysis */
export interface AffectedWorkspace {
  /** Workspace name (e.g. 'api', 'discord-bot', 'observability') */
  name: string;
  /** pnpm filter pattern (e.g. 'api', 'discord-bot') */
  filterPattern: string;
  /** Paths within the workspace that are touched */
  touchedPaths: string[];
  /** Change risk level from package-ownership.json */
  changeRisk: 'low' | 'medium' | 'high' | 'critical';
}

/** Blast radius of a sprint — which workspaces and global gates are affected */
export interface BlastRadius {
  /** Workspaces directly affected by touched files */
  affectedWorkspaces: AffectedWorkspace[];
  /** Whether global gates (lifecycle_gate, schema_guard, etc.) should run */
  globalGatesRequired: boolean;
  /** Touched areas that don't map to a workspace (e.g. docs, scripts) */
  unmappedAreas: string[];
  /** Summary string for display */
  summary: string;
}

/** Scope-annotated verification step result */
export interface ScopedVerificationStepResult extends VerificationStepResult {
  /** Scope classification for this step */
  scopeClassification: ScopeClassification;
  /** Which workspace this step targets (null for global gates) */
  targetWorkspace: string | null;
}

/** Scope-aware verification execution result */
export interface ScopedVerificationResult extends VerificationExecutionResult {
  /** Blast radius used for this run */
  blastRadius: BlastRadius;
  /** Steps with scope classification */
  scopedSteps: ScopedVerificationStepResult[];
  /** Scope-aware summary */
  scopeSummary: ScopeVerificationSummary;
}

/** Summary of scope-aware verification results */
export interface ScopeVerificationSummary {
  inScopeFailures: number;
  outOfScopeFailures: number;
  globalBlockers: number;
  /** Whether the sprint should be considered blocked by verification */
  sprintBlocked: boolean;
  /** Reason for the blocking decision */
  blockReason: string | null;
}

// ---------------------------------------------------------------------------
// Autopilot Orchestrator Types (Phase H)
// ---------------------------------------------------------------------------

/** Workflow states for issue processing */
export type WorkflowState =
  | 'discovered'
  | 'eligible'
  | 'blocked'
  | 'running'
  | 'proof_ready'
  | 'awaiting_ratification'
  | 'failed';

/** A single workflow state transition */
export interface WorkflowTransition {
  from: WorkflowState | 'initial';
  to: WorkflowState;
  at: string;
  reason: string;
}

/** Tracked state for a single issue */
export interface WorkflowStateEntry {
  issueId: string;
  state: WorkflowState;
  updatedAt: string;
  reason: string;
  history: WorkflowTransition[];
}

/** Info about the currently active autopilot run */
export interface ActiveRunInfo {
  issueId: string;
  startedAt: string;
  pipelineStage: PipelineStage;
}

/** Pipeline stages executed by the orchestrator */
export type PipelineStage =
  | 'envelope'
  | 'plan'
  | 'implement_start'
  | 'verify'
  | 'git_evidence'
  | 'bundle';

/** Persistent workflow state file */
export interface WorkflowStateFile {
  stateVersion: string;
  issues: Record<string, WorkflowStateEntry>;
  lastScanAt: string | null;
  activeRun: ActiveRunInfo | null;
}

/** Autonomy decision: allow or deny automated execution */
export type AutonomyDecision = 'ALLOW' | 'DENY';

/** A single autonomy policy check */
export interface AutonomyPolicyCheck {
  name: string;
  passed: boolean;
  reason: string;
}

/** Result of evaluating autonomy policy for an issue */
export interface AutonomyPolicyResult {
  decision: AutonomyDecision;
  issueId: string;
  checks: AutonomyPolicyCheck[];
  denialReasons: string[];
}

/** An issue loaded and evaluated during queue scan */
export interface ScannedIssue {
  issueId: string;
  filePath: string;
  issue: IssueFile;
  eligibility: EligibilityResult;
  autonomy: AutonomyPolicyResult;
  workflowState: WorkflowState | null;
}

/** Result of scanning the issue queue directory */
export interface QueueScanResult {
  scannedAt: string;
  totalFiles: number;
  loaded: number;
  loadErrors: string[];
  issues: ScannedIssue[];
}

/** Result of deterministic issue selection from queue */
export interface QueueSelection {
  selected: ScannedIssue | null;
  reason: string;
  candidateCount: number;
  scannedAt: string;
}

/** Result of a single pipeline stage execution */
export interface PipelineStageResult {
  stage: PipelineStage;
  success: boolean;
  error: string | null;
  durationMs: number;
}

/** Overall autopilot cycle status */
export type AutopilotCycleStatus = 'COMPLETED' | 'FAILED' | 'NO_ELIGIBLE' | 'FROZEN';

/** Result of a single bounded autopilot cycle */
export interface AutopilotCycleResult {
  status: AutopilotCycleStatus;
  issueId: string | null;
  pipelineResults: PipelineStageResult[];
  finalState: WorkflowState | null;
  startedAt: string;
  completedAt: string;
  reason: string;
}
