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

/** Full result of executing all verification steps */
export interface VerificationExecutionResult {
  sprintId: string;
  steps: VerificationStepResult[];
  overallStatus: VerificationOverallStatus;
  evidenceRoot: string;
  runtimeProofGate: RuntimeProofGateResult;
  summary: VerificationSummary;
  generatedAt: string;
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
