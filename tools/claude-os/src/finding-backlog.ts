/**
 * Claude OS — Finding Backlog Automation
 *
 * Sprint: SPRINT-CLAUDE-OS-FINDING-BACKLOG-AUTOMATION
 *
 * Converts discovered findings (from failure-classifier, drift-sentinel,
 * verdict-engine, lifecycle-checker) into structured, prioritized,
 * deduplicated backlog items and issue drafts.
 *
 * Automation boundary:
 *   SAFE (runs automatically): read-only finding conversion, dedup, triage,
 *                               artifact generation
 *   REQUIRES HUMAN: creating Linear issues, creating governance issue files,
 *                   approving sprint backlog items
 *
 * Usage (CLI):
 *   npx tsx src/cli.ts findings --sprint <SPRINT-ID> [--out <dir>] [--json]
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { resolveRepoPath, safeReadJson } from './fs-utils.js';
import { resolveArtifactRoot } from './lifecycle-checker.js';

import type { LifecycleDimension, LifecycleCheckResult } from './lifecycle-checker.js';
import type { ClassifiedFailure, DriftSignal, BundleVerdict } from './types.js';

// ---------------------------------------------------------------------------
// Severity Model
// ---------------------------------------------------------------------------

/**
 * P0: Platform unusable — security breach, data loss, complete outage
 * P1: Major feature broken — revenue impact, core workflow unusable
 * P2: Minor feature broken or degraded — workaround exists
 * P3: Minor improvement needed — quality/performance
 * P4: Cosmetic / polish
 */
export type FindingSeverity = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';

// ---------------------------------------------------------------------------
// Source Taxonomy
// ---------------------------------------------------------------------------

export type FindingSource =
  | 'failure_classifier' // ClassifiedFailure from verification step
  | 'drift_sentinel' // DriftSignal from sprint planning
  | 'verdict_engine' // BundleVerdict recommendation or blocker
  | 'lifecycle_checker' // LifecycleDimension FAIL/PENDING
  | 'operator_input' // Human-identified finding
  | 'audit_report'; // Systematic audit output

// ---------------------------------------------------------------------------
// Routing Actions
// ---------------------------------------------------------------------------

/**
 * BACKLOG_CREATE:      Create a governance/claude-os/issues/<id>.json file
 * LINEAR_DRAFT:        Draft a Linear issue for human review
 * DUPLICATE_SUPPRESS:  Suppress as duplicate of existing tracked item
 * LOG_ONLY:            Log for observability, no action item required
 */
export type FindingAction = 'BACKLOG_CREATE' | 'LINEAR_DRAFT' | 'DUPLICATE_SUPPRESS' | 'LOG_ONLY';

// ---------------------------------------------------------------------------
// Normalized Finding
// ---------------------------------------------------------------------------

export interface NormalizedFinding {
  /** Deterministic ID: sha1 of (source:subsystem:fingerprint), 12 hex chars */
  id: string;
  /** Human-readable title */
  title: string;
  /** Full description of the finding */
  description: string;

  // Classification
  /** Severity level (P0–P4) */
  severity: FindingSeverity;
  /** Where this finding originated */
  source: FindingSource;
  /** Subsystem name: 'discord-bot' | 'risk-engine' | 'claude-os' | 'api' | etc. */
  subsystem: string;
  /** Category within source: failure category, drift signal type, verdict status */
  category: string;

  // Evidence
  /** Raw output, command result excerpt, signal description */
  evidence: string;
  /** File path or sprint artifact location */
  evidenceLocation?: string;

  // Remediation
  /** Concrete description of how to fix */
  suggestedRemediation: string;
  /** Suggested sprint name for the fix (replace NNN with next sprint number) */
  suggestedSprintName?: string;
  /** Rough effort estimate */
  estimatedEffort?: 'tiny' | 'small' | 'medium' | 'large';

  // Deduplication
  /** Normalized fingerprint for fuzzy dedup: subsystem:title */
  fingerprint: string;
  /** ID of existing finding this duplicates (if DUPLICATE_SUPPRESS) */
  duplicateOf?: string;

  // Routing
  /** What to do with this finding */
  recommendedAction: FindingAction;
  /** Why this action was chosen */
  actionRationale: string;

  // Metadata
  detectedAt: string;
  sprintContext?: string;
  tags?: string[];
}

// ---------------------------------------------------------------------------
// Finding Backlog Result
// ---------------------------------------------------------------------------

export interface FindingBacklogResult {
  sprintId: string;
  generatedAt: string;
  /** All findings before deduplication */
  rawFindings: NormalizedFinding[];
  /** Deduplicated, sorted by severity */
  findings: NormalizedFinding[];
  /** Summary counts */
  summary: {
    total: number;
    unique: number;
    duplicatesSuppressed: number;
    byAction: Record<FindingAction, number>;
    bySeverity: Record<FindingSeverity, number>;
    bySource: Record<FindingSource, number>;
  };
  /** Findings that require backlog creation (P0–P2, BACKLOG_CREATE) */
  backlogItems: NormalizedFinding[];
  /** Findings that require Linear draft creation */
  linearDrafts: NormalizedFinding[];
}

// ---------------------------------------------------------------------------
// Triage Rules
// ---------------------------------------------------------------------------

interface TriageRule {
  source: FindingSource;
  /** Category string to match (null = any) */
  categoryMatch: string | null;
  /** Drift severity to match (null = any) */
  driftSeverityMatch?: 'low' | 'medium' | 'high' | 'critical' | null;
  severity: FindingSeverity;
  action: FindingAction;
}

const TRIAGE_RULES: TriageRule[] = [
  // failure_classifier
  {
    source: 'failure_classifier',
    categoryMatch: 'governance',
    severity: 'P1',
    action: 'BACKLOG_CREATE',
  },
  {
    source: 'failure_classifier',
    categoryMatch: 'application',
    severity: 'P2',
    action: 'BACKLOG_CREATE',
  },
  {
    source: 'failure_classifier',
    categoryMatch: 'infrastructure',
    severity: 'P2',
    action: 'BACKLOG_CREATE',
  },
  { source: 'failure_classifier', categoryMatch: 'toolchain', severity: 'P3', action: 'LOG_ONLY' },
  {
    source: 'failure_classifier',
    categoryMatch: 'environment',
    severity: 'P3',
    action: 'LOG_ONLY',
  },
  { source: 'failure_classifier', categoryMatch: 'transient', severity: 'P4', action: 'LOG_ONLY' },
  // drift_sentinel
  {
    source: 'drift_sentinel',
    categoryMatch: null,
    driftSeverityMatch: 'critical',
    severity: 'P1',
    action: 'BACKLOG_CREATE',
  },
  {
    source: 'drift_sentinel',
    categoryMatch: null,
    driftSeverityMatch: 'high',
    severity: 'P2',
    action: 'BACKLOG_CREATE',
  },
  {
    source: 'drift_sentinel',
    categoryMatch: null,
    driftSeverityMatch: 'medium',
    severity: 'P3',
    action: 'LINEAR_DRAFT',
  },
  {
    source: 'drift_sentinel',
    categoryMatch: null,
    driftSeverityMatch: 'low',
    severity: 'P4',
    action: 'LOG_ONLY',
  },
  // verdict_engine
  { source: 'verdict_engine', categoryMatch: 'FAIL', severity: 'P1', action: 'BACKLOG_CREATE' },
  { source: 'verdict_engine', categoryMatch: 'BLOCKED', severity: 'P2', action: 'BACKLOG_CREATE' },
  {
    source: 'verdict_engine',
    categoryMatch: 'recommendation',
    severity: 'P3',
    action: 'LINEAR_DRAFT',
  },
  // lifecycle_checker
  { source: 'lifecycle_checker', categoryMatch: 'FAIL', severity: 'P1', action: 'BACKLOG_CREATE' },
  { source: 'lifecycle_checker', categoryMatch: 'PENDING', severity: 'P3', action: 'LINEAR_DRAFT' },
  { source: 'lifecycle_checker', categoryMatch: 'UNKNOWN', severity: 'P3', action: 'LOG_ONLY' },
];

function triageFinding(
  source: FindingSource,
  category: string,
  driftSeverity?: string
): { severity: FindingSeverity; action: FindingAction; rationale: string } {
  for (const rule of TRIAGE_RULES) {
    if (rule.source !== source) continue;

    if (rule.driftSeverityMatch !== undefined && rule.driftSeverityMatch !== null) {
      if (rule.driftSeverityMatch !== driftSeverity) continue;
    }

    if (rule.categoryMatch !== null) {
      if (rule.categoryMatch !== category) continue;
    }

    return {
      severity: rule.severity,
      action: rule.action,
      rationale: `source=${source} category=${category}${driftSeverity ? ` drift_severity=${driftSeverity}` : ''} → ${rule.severity}/${rule.action}`,
    };
  }

  // Default fallback
  return {
    severity: 'P3',
    action: 'LOG_ONLY',
    rationale: `No matching triage rule for source=${source} category=${category} — defaulting to P3/LOG_ONLY`,
  };
}

// ---------------------------------------------------------------------------
// Fingerprint + ID
// ---------------------------------------------------------------------------

function normalizeForFingerprint(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export function computeFingerprint(title: string, subsystem: string): string {
  return `${normalizeForFingerprint(subsystem)}:${normalizeForFingerprint(title)}`;
}

function computeId(source: FindingSource, subsystem: string, fingerprint: string): string {
  const input = `${source}:${subsystem}:${fingerprint}`;
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, 12);
}

// ---------------------------------------------------------------------------
// Sprint Name Suggestion
// ---------------------------------------------------------------------------

function suggestSprintName(
  severity: FindingSeverity,
  subsystem: string,
  category: string
): string | undefined {
  const sub = subsystem
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const cat = category
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (severity === 'P0' || severity === 'P1') {
    return `SPRINT-FIX-${sub}-NNN`;
  }
  if (severity === 'P2') {
    return `SPRINT-${sub}-${cat}-NNN`;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Effort Estimation
// ---------------------------------------------------------------------------

function estimateEffort(
  source: FindingSource,
  severity: FindingSeverity
): 'tiny' | 'small' | 'medium' | 'large' {
  if (source === 'drift_sentinel' && (severity === 'P0' || severity === 'P1')) return 'large';
  if (source === 'verdict_engine' && severity === 'P1') return 'medium';
  if (source === 'failure_classifier' && severity === 'P2') return 'small';
  if (source === 'lifecycle_checker') return 'tiny';
  return 'small';
}

// ---------------------------------------------------------------------------
// Converter: ClassifiedFailure → NormalizedFinding
// ---------------------------------------------------------------------------

/**
 * Convert a ClassifiedFailure from failure-classifier into a NormalizedFinding.
 *
 * @param sprintId  Sprint that produced this failure
 * @param recipeId  Verification recipe ID (e.g., 'typecheck', 'lifecycle-gate')
 * @param failure   Classified failure from failure-classifier
 * @param subsystem Subsystem the recipe was checking (default: 'api')
 */
export function convertFailureToFinding(
  sprintId: string,
  recipeId: string,
  failure: ClassifiedFailure,
  subsystem: string = 'api'
): NormalizedFinding {
  const title = `${recipeId} failure [${failure.category}]: ${failure.suggestedAction.slice(0, 60)}`;
  const fingerprint = computeFingerprint(title, subsystem);
  const triage = triageFinding('failure_classifier', failure.category);
  const id = computeId('failure_classifier', subsystem, fingerprint);

  return {
    id,
    title,
    description: `Verification step '${recipeId}' failed with category '${failure.category}'. Confidence: ${(failure.confidence * 100).toFixed(0)}%. Evidence: ${failure.evidence}`,
    severity: triage.severity,
    source: 'failure_classifier',
    subsystem,
    category: failure.category,
    evidence: failure.evidence,
    evidenceLocation: `out/sprints/${sprintId}/`,
    suggestedRemediation: failure.suggestedAction,
    suggestedSprintName: suggestSprintName(triage.severity, subsystem, failure.category),
    estimatedEffort: estimateEffort('failure_classifier', triage.severity),
    fingerprint,
    recommendedAction: triage.action,
    actionRationale: triage.rationale,
    detectedAt: new Date().toISOString(),
    sprintContext: sprintId,
    tags: [failure.category, recipeId, failure.retryable ? 'retryable' : 'persistent'],
  };
}

// ---------------------------------------------------------------------------
// Converter: DriftSignal → NormalizedFinding
// ---------------------------------------------------------------------------

/**
 * Convert a DriftSignal from drift-sentinel into a NormalizedFinding.
 */
export function convertDriftSignalToFinding(
  sprintId: string,
  signal: DriftSignal
): NormalizedFinding {
  const subsystem = signal.area;
  const title = `[drift:${signal.type}] ${signal.description.slice(0, 80)}`;
  const fingerprint = computeFingerprint(title, subsystem);
  const triage = triageFinding('drift_sentinel', signal.type, signal.severity);
  const id = computeId('drift_sentinel', subsystem, fingerprint);

  return {
    id,
    title,
    description: `Drift signal detected in '${signal.area}': ${signal.description}. Recommendation: ${signal.recommendation}`,
    severity: triage.severity,
    source: 'drift_sentinel',
    subsystem,
    category: signal.type,
    evidence: `type=${signal.type} severity=${signal.severity}: ${signal.description}`,
    evidenceLocation: signal.lawReference
      ? `governance/claude-os/laws/${signal.lawReference}`
      : undefined,
    suggestedRemediation: signal.recommendation,
    suggestedSprintName: suggestSprintName(triage.severity, subsystem, signal.type),
    estimatedEffort: estimateEffort('drift_sentinel', triage.severity),
    fingerprint,
    recommendedAction: triage.action,
    actionRationale: triage.rationale,
    detectedAt: new Date().toISOString(),
    sprintContext: sprintId,
    tags: [signal.type, signal.severity, ...(signal.lawReference ? [signal.lawReference] : [])],
  };
}

// ---------------------------------------------------------------------------
// Converter: BundleVerdict → NormalizedFinding[]
// ---------------------------------------------------------------------------

/**
 * Convert a BundleVerdict into a set of NormalizedFindings.
 * Generates one finding per blocker and one per actionable recommendation.
 */
export function convertVerdictToFindings(
  sprintId: string,
  verdict: BundleVerdict
): NormalizedFinding[] {
  const findings: NormalizedFinding[] = [];
  const subsystem = 'claude-os-verification';

  // Blockers → P1 (FAIL) or P2 (BLOCKED)
  for (const blocker of verdict.blockers) {
    const title = `[verdict-blocker:${blocker.type}] ${blocker.description.slice(0, 80)}`;
    const fingerprint = computeFingerprint(title, subsystem);
    const category = verdict.status; // 'FAIL' or 'BLOCKED'
    const triage = triageFinding('verdict_engine', category);
    const id = computeId('verdict_engine', subsystem, fingerprint);

    findings.push({
      id,
      title,
      description: `Bundle verdict blocker (${blocker.type}): ${blocker.description}. Verdict: ${verdict.status}. Resolution: ${blocker.resolution}`,
      severity: triage.severity,
      source: 'verdict_engine',
      subsystem,
      category,
      evidence: `Blocker type: ${blocker.type}. Sprint verdict: ${verdict.status} (confidence: ${verdict.confidence})`,
      evidenceLocation: `out/sprints/${sprintId}/verdict.json`,
      suggestedRemediation: blocker.resolution,
      suggestedSprintName: suggestSprintName(triage.severity, subsystem, category),
      estimatedEffort: estimateEffort('verdict_engine', triage.severity),
      fingerprint,
      recommendedAction: triage.action,
      actionRationale: triage.rationale,
      detectedAt: new Date().toISOString(),
      sprintContext: sprintId,
      tags: [blocker.type, verdict.status, 'blocker'],
    });
  }

  // Limitations → P3/LINEAR_DRAFT (when verdict is PASS_WITH_LIMITATIONS)
  if (verdict.status === 'PASS_WITH_LIMITATIONS') {
    for (const lim of verdict.limitations) {
      const title = `[verdict-limitation:${lim.severity}] ${lim.description.slice(0, 80)}`;
      const fingerprint = computeFingerprint(title, subsystem);
      const triage = triageFinding('verdict_engine', 'recommendation');
      const id = computeId('verdict_engine', subsystem, fingerprint);

      findings.push({
        id,
        title,
        description: `Bundle verdict limitation (${lim.severity}): ${lim.description}. Impact: ${lim.impact}`,
        severity: triage.severity,
        source: 'verdict_engine',
        subsystem,
        category: 'limitation',
        evidence: `Limitation severity: ${lim.severity}. Sprint verdict: PASS_WITH_LIMITATIONS`,
        evidenceLocation: `out/sprints/${sprintId}/verdict.json`,
        suggestedRemediation: `Address limitation: ${lim.description}`,
        suggestedSprintName: undefined,
        estimatedEffort: 'tiny',
        fingerprint,
        recommendedAction: triage.action,
        actionRationale: triage.rationale,
        detectedAt: new Date().toISOString(),
        sprintContext: sprintId,
        tags: [lim.severity, 'limitation', 'PASS_WITH_LIMITATIONS'],
      });
    }
  }

  // Recommendations → P3/LINEAR_DRAFT (only if verdict is not PASS)
  if (verdict.status !== 'PASS') {
    for (const rec of verdict.recommendations) {
      const title = `[verdict-rec] ${rec.slice(0, 80)}`;
      const fingerprint = computeFingerprint(title, subsystem);
      const triage = triageFinding('verdict_engine', 'recommendation');
      const id = computeId('verdict_engine', subsystem, fingerprint);

      findings.push({
        id,
        title,
        description: `Bundle verdict recommendation: ${rec}`,
        severity: triage.severity,
        source: 'verdict_engine',
        subsystem,
        category: 'recommendation',
        evidence: `Verdict: ${verdict.status} (confidence: ${verdict.confidence}). Recommendation: ${rec}`,
        evidenceLocation: `out/sprints/${sprintId}/verdict.json`,
        suggestedRemediation: rec,
        suggestedSprintName: undefined,
        estimatedEffort: 'tiny',
        fingerprint,
        recommendedAction: triage.action,
        actionRationale: triage.rationale,
        detectedAt: new Date().toISOString(),
        sprintContext: sprintId,
        tags: ['recommendation', verdict.status],
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Converter: LifecycleDimension → NormalizedFinding | null
// ---------------------------------------------------------------------------

/**
 * Convert a single LifecycleDimension that is not PASS into a NormalizedFinding.
 * Returns null if the dimension is PASS (nothing to report).
 */
export function convertLifecycleDimensionToFinding(
  sprintId: string,
  dimension: LifecycleDimension
): NormalizedFinding | null {
  if (dimension.status === 'PASS') return null;

  const subsystem = 'sprint-lifecycle';
  const title = `[lifecycle:${dimension.id}] ${dimension.label}: ${dimension.detail.slice(0, 70)}`;
  const fingerprint = computeFingerprint(title, subsystem);
  const triage = triageFinding('lifecycle_checker', dimension.status);
  const id = computeId('lifecycle_checker', subsystem, fingerprint);

  return {
    id,
    title,
    description: `Sprint lifecycle gate '${dimension.label}' (${dimension.id}) is ${dimension.status}: ${dimension.detail}`,
    severity: triage.severity,
    source: 'lifecycle_checker',
    subsystem,
    category: dimension.status,
    evidence: dimension.detail,
    evidenceLocation: `docs/status/CURRENT_SYSTEM_STATUS.md`,
    suggestedRemediation: dimension.nextStep ?? `Resolve ${dimension.label} gate`,
    suggestedSprintName: undefined,
    estimatedEffort: 'tiny',
    fingerprint,
    recommendedAction: triage.action,
    actionRationale: triage.rationale,
    detectedAt: new Date().toISOString(),
    sprintContext: sprintId,
    tags: [
      dimension.id,
      dimension.status,
      dimension.requiresHuman ? 'human-required' : 'automatable',
    ],
  };
}

/**
 * Convert a full LifecycleCheckResult into NormalizedFindings for all non-PASS dimensions.
 */
export function convertLifecycleResultToFindings(
  sprintId: string,
  result: LifecycleCheckResult
): NormalizedFinding[] {
  const findings: NormalizedFinding[] = [];
  for (const dim of Object.values(result.checks)) {
    const finding = convertLifecycleDimensionToFinding(sprintId, dim);
    if (finding) findings.push(finding);
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

/**
 * Deduplicate findings by fingerprint.
 * When two findings share a fingerprint, the higher-severity one wins.
 * Lower-severity duplicates are marked DUPLICATE_SUPPRESS with duplicateOf set.
 */
export function deduplicateFindings(findings: NormalizedFinding[]): NormalizedFinding[] {
  const severityOrder: FindingSeverity[] = ['P0', 'P1', 'P2', 'P3', 'P4'];
  const canonicalByFingerprint = new Map<string, NormalizedFinding>();

  // First pass: select canonical (highest severity) per fingerprint
  for (const finding of findings) {
    const existing = canonicalByFingerprint.get(finding.fingerprint);
    if (!existing) {
      canonicalByFingerprint.set(finding.fingerprint, finding);
      continue;
    }
    const existingRank = severityOrder.indexOf(existing.severity);
    const newRank = severityOrder.indexOf(finding.severity);
    if (newRank < existingRank) {
      // New finding is higher severity — replace
      canonicalByFingerprint.set(finding.fingerprint, finding);
    }
  }

  // Second pass: mark duplicates
  return findings.map(f => {
    const canonical = canonicalByFingerprint.get(f.fingerprint);
    if (canonical && canonical.id !== f.id) {
      return {
        ...f,
        recommendedAction: 'DUPLICATE_SUPPRESS' as FindingAction,
        duplicateOf: canonical.id,
        actionRationale: `Duplicate of ${canonical.id} (fingerprint: ${f.fingerprint})`,
      };
    }
    return f;
  });
}

// ---------------------------------------------------------------------------
// Backlog Result Assembly
// ---------------------------------------------------------------------------

export function assembleBacklogResult(
  sprintId: string,
  rawFindings: NormalizedFinding[]
): FindingBacklogResult {
  const severityOrder: FindingSeverity[] = ['P0', 'P1', 'P2', 'P3', 'P4'];
  const findings = deduplicateFindings(rawFindings).sort(
    (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
  );

  const byAction: Record<FindingAction, number> = {
    BACKLOG_CREATE: 0,
    LINEAR_DRAFT: 0,
    DUPLICATE_SUPPRESS: 0,
    LOG_ONLY: 0,
  };
  const bySeverity: Record<FindingSeverity, number> = {
    P0: 0,
    P1: 0,
    P2: 0,
    P3: 0,
    P4: 0,
  };
  const bySource: Record<FindingSource, number> = {
    failure_classifier: 0,
    drift_sentinel: 0,
    verdict_engine: 0,
    lifecycle_checker: 0,
    operator_input: 0,
    audit_report: 0,
  };

  for (const f of findings) {
    byAction[f.recommendedAction]++;
    bySeverity[f.severity]++;
    bySource[f.source]++;
  }

  return {
    sprintId,
    generatedAt: new Date().toISOString(),
    rawFindings,
    findings,
    summary: {
      total: rawFindings.length,
      unique: findings.filter(f => f.recommendedAction !== 'DUPLICATE_SUPPRESS').length,
      duplicatesSuppressed: byAction.DUPLICATE_SUPPRESS,
      byAction,
      bySeverity,
      bySource,
    },
    backlogItems: findings.filter(f => f.recommendedAction === 'BACKLOG_CREATE'),
    linearDrafts: findings.filter(f => f.recommendedAction === 'LINEAR_DRAFT'),
  };
}

// ---------------------------------------------------------------------------
// Sprint Artifact Loading
// ---------------------------------------------------------------------------

/**
 * Attempt to load a BundleVerdict from a sprint artifact directory.
 * Returns null if not found (not all sprints run through supervised-run).
 */
export function loadVerdictFromArtifacts(
  sprintId: string,
  dateOverride?: string
): BundleVerdict | null {
  const artifactRoot = resolveArtifactRoot(sprintId, dateOverride);
  if (!artifactRoot) return null;

  const verdictPath = path.join(artifactRoot, 'verdict.json');
  const result = safeReadJson<BundleVerdict>(verdictPath);
  if (!result.success || !result.content) return null;

  return result.content;
}

/**
 * Attempt to load failed step failure classifications from a sprint
 * evidence index. Returns empty array if not found.
 */
export interface EvidenceEntry {
  recipeId: string;
  status: string;
  failureClassification?: ClassifiedFailure;
  outputFile?: string;
}

export function loadFailedStepsFromArtifacts(
  sprintId: string,
  dateOverride?: string
): EvidenceEntry[] {
  const artifactRoot = resolveArtifactRoot(sprintId, dateOverride);
  if (!artifactRoot) return [];

  const indexPath = path.join(artifactRoot, 'verification-evidence-index.json');

  // Try VerificationExecutionResult format (steps[])
  const stepsResult = safeReadJson<{ steps?: EvidenceEntry[]; entries?: EvidenceEntry[] }>(
    indexPath
  );
  if (!stepsResult.success || !stepsResult.content) return [];

  const data = stepsResult.content;

  // Support both formats: steps[] (executor) and entries[] (evidence-capture)
  const items = data.steps ?? data.entries ?? [];
  return items.filter(s => s.status !== 'PASS' && s.status !== 'SKIPPED');
}

// ---------------------------------------------------------------------------
// Artifact Generation
// ---------------------------------------------------------------------------

const SEV_ICON: Record<FindingSeverity, string> = {
  P0: 'P0',
  P1: 'P1',
  P2: 'P2',
  P3: 'P3',
  P4: 'P4',
};

const ACTION_ICON: Record<FindingAction, string> = {
  BACKLOG_CREATE: '[BACKLOG]',
  LINEAR_DRAFT: '[LINEAR]',
  DUPLICATE_SUPPRESS: '[DUP]',
  LOG_ONLY: '[LOG]',
};

/**
 * Generate all finding artifact markdown files into the output directory.
 * Creates the directory if it does not exist.
 */
export function generateFindingArtifacts(result: FindingBacklogResult, outputDir: string): void {
  fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(
    path.join(outputDir, 'VERIFICATION_FINDINGS.md'),
    renderVerificationFindings(result),
    'utf-8'
  );

  fs.writeFileSync(
    path.join(outputDir, 'RECOMMENDED_REMEDIATION_SPRINTS.md'),
    renderRemediationSprints(result),
    'utf-8'
  );

  fs.writeFileSync(
    path.join(outputDir, 'LINEAR_ISSUE_DRAFTS.md'),
    renderLinearDrafts(result),
    'utf-8'
  );

  fs.writeFileSync(
    path.join(outputDir, 'FINDING_DECISION_LOG.md'),
    renderDecisionLog(result),
    'utf-8'
  );

  fs.writeFileSync(
    path.join(outputDir, 'HANDOFF_SUMMARY.md'),
    renderHandoffSummary(result),
    'utf-8'
  );
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

function renderVerificationFindings(result: FindingBacklogResult): string {
  const verFindings = result.findings.filter(
    f =>
      f.source === 'failure_classifier' ||
      f.source === 'verdict_engine' ||
      f.source === 'lifecycle_checker'
  );

  const lines: string[] = [
    `# Verification Findings — ${result.sprintId}`,
    '',
    `**Generated**: ${result.generatedAt}`,
    `**Sources**: failure_classifier, verdict_engine, lifecycle_checker`,
    `**Total findings**: ${verFindings.length}`,
    '',
    '---',
    '',
  ];

  if (verFindings.length === 0) {
    lines.push('_No verification findings detected. All checks passed._');
    return lines.join('\n');
  }

  for (const f of verFindings) {
    lines.push(`## [${SEV_ICON[f.severity]}] ${ACTION_ICON[f.recommendedAction]} ${f.title}`);
    lines.push('');
    lines.push(`- **ID**: \`${f.id}\``);
    lines.push(`- **Source**: ${f.source}`);
    lines.push(`- **Category**: ${f.category}`);
    lines.push(`- **Action**: ${f.recommendedAction}`);
    lines.push(`- **Sprint**: ${f.sprintContext ?? 'unknown'}`);
    if (f.duplicateOf) lines.push(`- **Duplicate of**: \`${f.duplicateOf}\``);
    lines.push('');
    lines.push(`**Description**: ${f.description}`);
    lines.push('');
    lines.push(`**Evidence**: \`${f.evidence}\``);
    if (f.evidenceLocation) lines.push(`**Location**: ${f.evidenceLocation}`);
    lines.push('');
    lines.push(`**Remediation**: ${f.suggestedRemediation}`);
    if (f.suggestedSprintName) {
      lines.push('');
      lines.push(`**Suggested Sprint**: \`${f.suggestedSprintName}\``);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

function renderRemediationSprints(result: FindingBacklogResult): string {
  const backlogItems = result.backlogItems;
  const lines: string[] = [
    `# Recommended Remediation Sprints — ${result.sprintId}`,
    '',
    `**Generated**: ${result.generatedAt}`,
    `**Backlog items**: ${backlogItems.length}`,
    '',
    '> These are structured sprint recommendations derived from P0–P2 findings.',
    '> Replace NNN with the next available sprint number before creating the sprint.',
    '',
    '---',
    '',
  ];

  if (backlogItems.length === 0) {
    lines.push('_No backlog items to create. All findings are P3/P4 or duplicates._');
    return lines.join('\n');
  }

  for (const f of backlogItems) {
    const sprintName =
      f.suggestedSprintName ??
      `SPRINT-FIX-${f.subsystem.toUpperCase().replace(/[^A-Z0-9]/g, '-')}-NNN`;
    lines.push(`## ${sprintName}`);
    lines.push('');
    lines.push(`**Priority**: ${f.severity} | **Effort**: ${f.estimatedEffort ?? 'small'}`);
    lines.push(`**Finding ID**: \`${f.id}\``);
    lines.push(`**Subsystem**: ${f.subsystem}`);
    lines.push(`**Source**: ${f.source}`);
    lines.push('');
    lines.push(`**Goal**: ${f.suggestedRemediation}`);
    lines.push('');
    lines.push(`**Context**: ${f.description}`);
    lines.push('');
    lines.push('**Definition of Done**:');
    lines.push(`- [ ] ${f.suggestedRemediation}`);
    lines.push(`- [ ] Verification gate passes for \`${f.category}\``);
    lines.push(`- [ ] Proof artifacts captured and bundle verdict is PASS`);
    lines.push('');
    lines.push(`_Finding: ${f.title}_`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

function renderLinearDrafts(result: FindingBacklogResult): string {
  const drafts = result.linearDrafts;
  const lines: string[] = [
    `# Linear Issue Drafts — ${result.sprintId}`,
    '',
    `**Generated**: ${result.generatedAt}`,
    `**Draft count**: ${drafts.length}`,
    '',
    '> These findings are P3 or lower. Review and create Linear issues as appropriate.',
    '> Copy each code block into Linear > New Issue.',
    '',
    '---',
    '',
  ];

  if (drafts.length === 0) {
    lines.push('_No Linear drafts generated._');
    return lines.join('\n');
  }

  for (const f of drafts) {
    lines.push(`## ${f.title}`);
    lines.push('');
    lines.push('```');
    lines.push(`Title: ${f.title}`);
    lines.push(`Team: Unit Talk`);
    lines.push(`Priority: ${f.severity}`);
    lines.push(`Labels: sprint, improvement`);
    lines.push('');
    lines.push(`Description:`);
    lines.push(f.description);
    lines.push('');
    lines.push(`Remediation: ${f.suggestedRemediation}`);
    lines.push(`Evidence: ${f.evidence}`);
    lines.push(`Finding ID: ${f.id}`);
    lines.push(`Sprint Context: ${f.sprintContext ?? 'unknown'}`);
    lines.push('```');
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

function renderDecisionLog(result: FindingBacklogResult): string {
  const s = result.summary;
  const lines: string[] = [
    `# Finding Decision Log — ${result.sprintId}`,
    '',
    `**Generated**: ${result.generatedAt}`,
    `**Total raw**: ${s.total} | **Unique**: ${s.unique} | **Duplicates suppressed**: ${s.duplicatesSuppressed}`,
    '',
    '## Summary',
    '',
    '| Metric | Count |',
    '|--------|-------|',
    `| Total findings | ${s.total} |`,
    `| Unique findings | ${s.unique} |`,
    `| BACKLOG_CREATE | ${s.byAction.BACKLOG_CREATE} |`,
    `| LINEAR_DRAFT | ${s.byAction.LINEAR_DRAFT} |`,
    `| LOG_ONLY | ${s.byAction.LOG_ONLY} |`,
    `| DUPLICATE_SUPPRESS | ${s.byAction.DUPLICATE_SUPPRESS} |`,
    '',
    '### By Severity',
    '',
    '| Severity | Count |',
    '|----------|-------|',
    `| P0 | ${s.bySeverity.P0} |`,
    `| P1 | ${s.bySeverity.P1} |`,
    `| P2 | ${s.bySeverity.P2} |`,
    `| P3 | ${s.bySeverity.P3} |`,
    `| P4 | ${s.bySeverity.P4} |`,
    '',
    '### By Source',
    '',
    '| Source | Count |',
    '|--------|-------|',
    `| failure_classifier | ${s.bySource.failure_classifier} |`,
    `| drift_sentinel | ${s.bySource.drift_sentinel} |`,
    `| verdict_engine | ${s.bySource.verdict_engine} |`,
    `| lifecycle_checker | ${s.bySource.lifecycle_checker} |`,
    `| operator_input | ${s.bySource.operator_input} |`,
    `| audit_report | ${s.bySource.audit_report} |`,
    '',
    '---',
    '',
    '## All Findings',
    '',
    '| ID | Severity | Source | Action | Title |',
    '|----|----------|--------|--------|-------|',
  ];

  for (const f of result.findings) {
    const dupNote = f.duplicateOf ? ` _(dup of \`${f.duplicateOf}\`)_` : '';
    const truncTitle = f.title.length > 60 ? f.title.slice(0, 57) + '...' : f.title;
    lines.push(
      `| \`${f.id}\` | ${f.severity} | ${f.source} | ${f.recommendedAction} | ${truncTitle}${dupNote} |`
    );
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(
    '> Full finding details available as JSON output: run `findings --sprint <id> --json`'
  );
  lines.push('');

  return lines.join('\n');
}

function renderHandoffSummary(result: FindingBacklogResult): string {
  const s = result.summary;
  const lines: string[] = [
    `# Handoff Summary — ${result.sprintId}`,
    '',
    `**Generated**: ${result.generatedAt}`,
    '',
    '## What This Sprint Delivered',
    '',
    'Implemented finding-backlog automation in Claude OS (`tools/claude-os/src/finding-backlog.ts`):',
    '',
    '- **Normalized finding schema**: `NormalizedFinding` with severity P0–P4, source taxonomy, routing actions',
    '- **Converters**: failure-classifier, drift-sentinel, verdict-engine, lifecycle-checker → NormalizedFinding',
    '- **Deduplication**: fingerprint-based, higher-severity wins',
    '- **Triage rules**: source+category → severity+action mapping',
    '- **Artifact generation**: 5 markdown artifact files per sprint findings run',
    '- **CLI command**: `findings --sprint <id>` added to Claude OS',
    '',
    '## Findings This Sprint',
    '',
    '| Category | Count |',
    '|----------|-------|',
    `| Backlog items (P0–P2, BACKLOG_CREATE) | ${s.byAction.BACKLOG_CREATE} |`,
    `| Linear drafts (P3, LINEAR_DRAFT) | ${s.byAction.LINEAR_DRAFT} |`,
    `| Log only (P3–P4) | ${s.byAction.LOG_ONLY} |`,
    `| Duplicates suppressed | ${s.byAction.DUPLICATE_SUPPRESS} |`,
    '',
    '## Next Steps for Operator',
    '',
  ];

  if (result.backlogItems.length > 0) {
    lines.push('### High-Priority Backlog Items (create sprint)');
    lines.push('');
    for (const f of result.backlogItems) {
      const name =
        f.suggestedSprintName ??
        `SPRINT-FIX-${f.subsystem.toUpperCase().replace(/[^A-Z0-9]/g, '-')}-NNN`;
      lines.push(`- [ ] Create \`${name}\` — ${f.suggestedRemediation.slice(0, 100)}`);
    }
    lines.push('');
  }

  if (result.linearDrafts.length > 0) {
    lines.push('### Linear Issues to Review (create issue)');
    lines.push('');
    for (const f of result.linearDrafts) {
      lines.push(`- [ ] Review \`${f.id}\`: ${f.title.slice(0, 80)}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(
    '> Generated automatically by `findings` CLI command. All routing decisions are recommendations.',
    '> Human review required before creating Linear issues or sprint backlog entries.'
  );

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

/**
 * Full findings analysis pipeline for a sprint.
 *
 * Loads available artifacts (verdict.json, verification-evidence-index.json),
 * converts all findings to NormalizedFinding[], deduplicates, and assembles
 * the FindingBacklogResult.
 *
 * @param sprintId Sprint identifier
 * @param extraFindings Additional findings to include (e.g., from operator input or drift signals)
 * @param dateOverride Override artifact date directory (default: most recent)
 */
export function analyzeSprintFindings(
  sprintId: string,
  extraFindings: NormalizedFinding[] = [],
  dateOverride?: string
): FindingBacklogResult {
  const rawFindings: NormalizedFinding[] = [...extraFindings];

  // Load verdict findings
  const verdict = loadVerdictFromArtifacts(sprintId, dateOverride);
  if (verdict) {
    rawFindings.push(...convertVerdictToFindings(sprintId, verdict));
  }

  // Load failed step findings
  const failedSteps = loadFailedStepsFromArtifacts(sprintId, dateOverride);
  for (const step of failedSteps) {
    if (step.failureClassification) {
      rawFindings.push(
        convertFailureToFinding(sprintId, step.recipeId, step.failureClassification)
      );
    }
  }

  return assembleBacklogResult(sprintId, rawFindings);
}

// ---------------------------------------------------------------------------
// CLI Output Printer
// ---------------------------------------------------------------------------

export function printFindingBacklogResult(result: FindingBacklogResult): void {
  const { summary: s } = result;

  console.log(`\nFinding Backlog — ${result.sprintId}`);
  console.log(`Generated: ${result.generatedAt}`);
  console.log('');
  console.log(
    `Total: ${s.total}  |  Unique: ${s.unique}  |  Duplicates: ${s.duplicatesSuppressed}`
  );
  console.log('');
  console.log('By action:');
  console.log(`  BACKLOG_CREATE:     ${s.byAction.BACKLOG_CREATE}`);
  console.log(`  LINEAR_DRAFT:       ${s.byAction.LINEAR_DRAFT}`);
  console.log(`  LOG_ONLY:           ${s.byAction.LOG_ONLY}`);
  console.log(`  DUPLICATE_SUPPRESS: ${s.byAction.DUPLICATE_SUPPRESS}`);
  console.log('');
  console.log('By severity:');
  console.log(
    `  P0: ${s.bySeverity.P0}  P1: ${s.bySeverity.P1}  P2: ${s.bySeverity.P2}  P3: ${s.bySeverity.P3}  P4: ${s.bySeverity.P4}`
  );

  if (result.backlogItems.length > 0) {
    console.log('');
    console.log('--- Backlog Items (BACKLOG_CREATE) ---');
    for (const f of result.backlogItems) {
      console.log(`  [${f.severity}] ${f.id}  ${f.title.slice(0, 70)}`);
      if (f.suggestedSprintName) {
        console.log(`        -> ${f.suggestedSprintName}`);
      }
    }
  }

  if (result.linearDrafts.length > 0) {
    console.log('');
    console.log('--- Linear Drafts (LINEAR_DRAFT) ---');
    for (const f of result.linearDrafts) {
      console.log(`  [${f.severity}] ${f.id}  ${f.title.slice(0, 70)}`);
    }
  }

  console.log('');
}
