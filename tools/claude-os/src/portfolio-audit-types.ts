/**
 * SPOA — Sprint Portfolio Optimization Audit
 * Shared types for classification, runner assignment, and artifacts.
 *
 * Sprint: SPRINT-SPOA-FOUNDATION-MANUAL-COMMAND
 */

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

export type SprintClassification =
  | 'Sequential Only'
  | 'Parallel-Safe'
  | 'Combine Candidate'
  | 'Split Candidate'
  | 'Claude-Core'
  | 'Multi-Claude Safe'
  | 'Codex-Safe'
  | 'Governance-Only'
  | 'Blocked'
  | 'Deferred';

export type SecondaryTag =
  | 'schema-touch'
  | 'lifecycle-touch'
  | 'docs-heavy'
  | 'read-only-ui'
  | 'tooling'
  | 'test-backfill'
  | 'merge-risk-high'
  | 'proof-heavy'
  | 'core-invariant-sensitive';

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export type RunnerRecommendation =
  | 'Claude Core'
  | 'Claude Secondary'
  | 'Multi-Claude Wave'
  | 'Codex'
  | 'Governance Lane'
  | 'Unassigned';

// ---------------------------------------------------------------------------
// Sprint entry (from portfolio source docs)
// ---------------------------------------------------------------------------

export interface SprintEntry {
  /** Canonical sprint ID, e.g. SPRINT-082-LAYER3-PHASE10-CC-FOO */
  id: string;
  /** Human-readable title */
  title: string;
  /** Layer designation, e.g. 'Layer 3' */
  layer?: string;
  /** Phase designation, e.g. 'Phase 10' */
  phase?: string;
  /** Queue status */
  status: 'queued' | 'blocked' | 'deferred' | 'inferred';
  /** Sprint this one is blocked by */
  blockedBy?: string;
  /** Notes from source doc */
  notes?: string;
  /** Confidence in this entry (high = from explicit doc, low = inferred) */
  confidence: 'high' | 'medium' | 'low';
}

// ---------------------------------------------------------------------------
// Classified sprint
// ---------------------------------------------------------------------------

export interface ClassifiedSprint {
  entry: SprintEntry;
  classification: SprintClassification;
  secondaryTags: SecondaryTag[];
  runner: RunnerRecommendation;
  rationale: string;
  parallelSafe: boolean;
  parallelWith?: string[];
  dependsOn?: string[];
  blockerNote?: string;
  combineCandidate?: string;
}

// ---------------------------------------------------------------------------
// Parallelization
// ---------------------------------------------------------------------------

export interface ParallelizationEntry {
  sprintA: string;
  sprintB: string;
  safe: boolean;
  reason: string;
  mergeRisk: 'high' | 'medium' | 'low' | 'none';
}

// ---------------------------------------------------------------------------
// Combine / split
// ---------------------------------------------------------------------------

export interface CombineCandidate {
  sprints: string[];
  rationale: string;
  benefit: string;
  cautions: string;
}

export interface SplitCandidate {
  sprint: string;
  rationale: string;
  proposedParts: string[];
}

// ---------------------------------------------------------------------------
// Risk notes
// ---------------------------------------------------------------------------

export interface RiskNote {
  category: 'architecture' | 'schema' | 'file-overlap' | 'sequencing' | 'proof';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  sprint?: string;
}

// ---------------------------------------------------------------------------
// Blocked item
// ---------------------------------------------------------------------------

export interface BlockedItem {
  sprint: string;
  blockerNote: string;
  unblockCondition?: string;
}

// ---------------------------------------------------------------------------
// Ranked next-sprint candidate
// ---------------------------------------------------------------------------

export interface RankedSprintCandidate {
  id: string;
  rationale: string;
  confidence: 'high' | 'medium' | 'low';
  blockedBy?: string;
}

// ---------------------------------------------------------------------------
// Audit result
// ---------------------------------------------------------------------------

export interface PortfolioAuditResult {
  auditId: string;
  runAt: string;
  trigger: string;
  inputSources: string[];
  sprints: ClassifiedSprint[];
  recommendedNextSprint?: string;
  rankedNextSprints?: RankedSprintCandidate[];
  parallelOpportunities: ParallelizationEntry[];
  combineCandidates: CombineCandidate[];
  splitCandidates: SplitCandidate[];
  riskNotes: RiskNote[];
  nextActions: string[];
  blockedItems: BlockedItem[];
  limitations: string[];
}

// ---------------------------------------------------------------------------
// Audit options
// ---------------------------------------------------------------------------

export interface AuditOptions {
  /** How the audit was triggered */
  trigger?: string;
  /** Override default output directory */
  outputDir?: string;
  /** Report-only mode (default true in v1) */
  reportOnly?: boolean;
  /** Propose mode: include queue action proposals */
  propose?: boolean;
}
