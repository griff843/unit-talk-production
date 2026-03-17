/**
 * SPOA — Sprint Portfolio Optimization Audit
 * Command entrypoint and orchestrator.
 *
 * Usage (via CLI):
 *   npx tsx tools/claude-os/src/cli.ts portfolio:audit [--output <path>] [--report-only]
 *
 * Or directly:
 *   npx tsx tools/claude-os/src/portfolio-audit.ts
 *
 * Sprint: SPRINT-SPOA-FOUNDATION-MANUAL-COMMAND
 */

import { writeArtifactBundle } from './portfolio-audit-artifacts.js';
import { classifySprint, loadSprintPortfolio } from './portfolio-audit-classifier.js';
import { resolveAuditOutputDir } from './portfolio-audit-config.js';
import {
  assignRunner,
  buildParallelizationMatrix,
  buildRunnerSummary,
} from './portfolio-audit-runners.js';

import type { TruthGapItem, DriftItem } from './portfolio-audit-classifier.js';
import type {
  PortfolioAuditResult,
  ClassifiedSprint,
  RiskNote,
  BlockedItem,
  AuditOptions,
  RankedSprintCandidate,
} from './portfolio-audit-types.js';

// ---------------------------------------------------------------------------
// Main audit function
// ---------------------------------------------------------------------------

export function runPortfolioAudit(options: AuditOptions = {}): {
  result: PortfolioAuditResult;
  outputDir: string;
  artifactFiles: string[];
} {
  const trigger = options.trigger ?? 'manual';
  const runAt = new Date().toISOString();
  const date = runAt.slice(0, 10);
  const auditId = `SPOA-${date}-${Date.now().toString(36).toUpperCase()}`;

  // ---- Load portfolio ----
  const {
    sprints: rawSprints,
    loadedSources,
    limitations,
    truthGaps,
    driftItems,
  } = loadSprintPortfolio();

  // ---- Classify each sprint ----
  const classifiedSprints: ClassifiedSprint[] = rawSprints.map(entry => {
    const classification = classifySprint(entry);
    const runner = assignRunner(classification.classification, classification.parallelSafe);

    return {
      entry,
      classification: classification.classification,
      secondaryTags: classification.secondaryTags,
      runner,
      rationale: classification.rationale,
      parallelSafe: classification.parallelSafe,
    };
  });

  // ---- Build parallelization matrix ----
  const parallelMatrix = buildParallelizationMatrix(classifiedSprints);

  // ---- Build runner summary ----
  const runnerSummary = buildRunnerSummary(classifiedSprints);

  // ---- Determine recommended next sprint ----
  const recommendedNextSprint = determineRecommendedNextSprint(classifiedSprints);

  // ---- Build ranked next-sprint candidates ----
  const rankedNextSprints = buildRankedNextSprints(classifiedSprints);

  // ---- Build risk notes (base + truth gaps + drift items) ----
  const riskNotes = buildRiskNotes(classifiedSprints, rawSprints.length, truthGaps, driftItems);

  // ---- Blocked items ----
  const blockedItems: BlockedItem[] = classifiedSprints
    .filter(s => s.classification === 'Blocked')
    .map(s => ({
      sprint: s.entry.id,
      blockerNote: s.blockerNote ?? s.entry.blockedBy ?? 'Dependency not satisfied',
      unblockCondition: s.entry.blockedBy ? `Complete or close: ${s.entry.blockedBy}` : undefined,
    }));

  // ---- Next actions ----
  const nextActions = buildNextActions(classifiedSprints, recommendedNextSprint, limitations);

  // ---- Combine / split candidates ----
  const { combineCandidates, splitCandidates } = detectCombineSplitCandidates(classifiedSprints);

  const result: PortfolioAuditResult = {
    auditId,
    runAt,
    trigger,
    inputSources: loadedSources,
    sprints: classifiedSprints,
    recommendedNextSprint,
    rankedNextSprints,
    parallelOpportunities: parallelMatrix,
    combineCandidates,
    splitCandidates,
    riskNotes,
    nextActions,
    blockedItems,
    limitations,
  };

  // ---- Write artifacts ----
  const outputDir = resolveAuditOutputDir(date, options.outputDir);
  const { files: artifactFiles } = writeArtifactBundle(result, runnerSummary, outputDir);

  return { result, outputDir, artifactFiles };
}

// ---------------------------------------------------------------------------
// Ranked next-sprint candidates
// ---------------------------------------------------------------------------

function buildRankedNextSprints(sprints: ClassifiedSprint[]): RankedSprintCandidate[] {
  const CONFIDENCE_ORDER = { high: 0, medium: 1, low: 2 };

  const candidates = sprints
    .filter(s => s.classification !== 'Blocked' && s.classification !== 'Deferred')
    .sort((a, b) => {
      const aConf = CONFIDENCE_ORDER[a.entry.confidence];
      const bConf = CONFIDENCE_ORDER[b.entry.confidence];
      if (aConf !== bConf) return aConf - bConf;
      // Prefer queued over inferred
      if (a.entry.status === 'queued' && b.entry.status !== 'queued') return -1;
      if (b.entry.status === 'queued' && a.entry.status !== 'queued') return 1;
      return 0;
    })
    .slice(0, 3);

  return candidates.map(s => {
    let rationale: string;
    if (s.entry.status === 'queued') {
      rationale = 'Explicitly queued in NEXT_5_SPRINTS.md';
    } else if (s.entry.confidence === 'medium') {
      rationale =
        'Inferred from PHASE_STATUS.md remaining work (phase context) — medium confidence';
    } else {
      rationale =
        'Inferred from platform context — low confidence. Queue sprint explicitly to confirm.';
    }
    return {
      id: s.entry.id,
      rationale,
      confidence: s.entry.confidence,
      blockedBy: s.entry.blockedBy,
    };
  });
}

// ---------------------------------------------------------------------------
// Recommended next sprint
// ---------------------------------------------------------------------------

function determineRecommendedNextSprint(sprints: ClassifiedSprint[]): string | undefined {
  // Prefer non-blocked, non-deferred sprints with high confidence
  const candidates = sprints.filter(
    s =>
      s.classification !== 'Blocked' &&
      s.classification !== 'Deferred' &&
      s.entry.confidence !== 'low'
  );

  if (candidates.length === 0) return undefined;

  // Prefer queued (explicit) over inferred
  const explicit = candidates.filter(s => s.entry.status === 'queued');
  if (explicit.length > 0) return explicit[0].entry.id;

  // Fall back to first inferred item
  return candidates[0].entry.id;
}

// ---------------------------------------------------------------------------
// Risk notes generation
// ---------------------------------------------------------------------------

function buildRiskNotes(
  sprints: ClassifiedSprint[],
  totalCount: number,
  truthGaps: TruthGapItem[] = [],
  driftItems: DriftItem[] = []
): RiskNote[] {
  const notes: RiskNote[] = [];

  // Architecture risk: Claude-Core sprints
  const coreSprints = sprints.filter(s => s.classification === 'Claude-Core');
  if (coreSprints.length > 0) {
    notes.push({
      category: 'architecture',
      severity: 'HIGH',
      description:
        `${coreSprints.length} sprint(s) classified Claude-Core — architecture-sensitive. ` +
        `Must execute sequentially with full context. No multi-runner assignment appropriate.`,
    });
  }

  // Schema risk: schema-touch secondary tag
  const schemaSprints = sprints.filter(s => s.secondaryTags.includes('schema-touch'));
  if (schemaSprints.length > 0) {
    notes.push({
      category: 'schema',
      severity: 'MEDIUM',
      description: `${schemaSprints.length} sprint(s) have schema-touch tag — database migration or column changes expected.`,
      sprint: schemaSprints.map(s => s.entry.id).join(', '),
    });
  }

  // Sequencing risk: blocked items
  const blockedCount = sprints.filter(s => s.classification === 'Blocked').length;
  if (blockedCount > 0) {
    notes.push({
      category: 'sequencing',
      severity: 'HIGH',
      description:
        `${blockedCount} sprint(s) are Blocked — cannot execute until dependency is satisfied. ` +
        `Review NEXT_ACTIONS.md for unblock conditions.`,
    });
  }

  // Proof risk: low confidence inferred items
  const inferredCount = sprints.filter(s => s.entry.status === 'inferred').length;
  if (inferredCount > 0) {
    notes.push({
      category: 'proof',
      severity: 'MEDIUM',
      description:
        `${inferredCount} sprint(s) are inferred from phase docs — no explicit sprint spec exists. ` +
        `Cannot generate a proof bundle path until the sprint is formally scoped.`,
    });
  }

  // File overlap risk: multiple core-sensitive sprints
  const coreInvariantCount = sprints.filter(s =>
    s.secondaryTags.includes('core-invariant-sensitive')
  ).length;
  if (coreInvariantCount >= 2) {
    notes.push({
      category: 'file-overlap',
      severity: 'HIGH',
      description:
        `${coreInvariantCount} core-invariant-sensitive sprints in queue — high merge collision risk if executed in proximity. ` +
        `Enforce sequential execution.`,
    });
  }

  // Empty queue
  if (totalCount === 0) {
    notes.push({
      category: 'proof',
      severity: 'LOW',
      description: 'Sprint queue is empty. SPOA could not generate specific risk analysis.',
    });
  }

  // Truth gap notes (from LIFECYCLE_TRUTH_GAP_MEMO.md)
  for (const gap of truthGaps) {
    notes.push({
      category: 'proof',
      severity: gap.severity === 'HIGH' ? 'HIGH' : 'MEDIUM',
      description: `Truth gap [${gap.file}]: ${gap.defect}`,
    });
  }

  // Active drift notes (from DRIFT_REPORT.md — CRITICAL/HIGH only to avoid noise)
  for (const drift of driftItems) {
    if (drift.severity === 'CRITICAL' || drift.severity === 'HIGH') {
      // RiskNote.severity max is HIGH — map CRITICAL down
      const sev: RiskNote['severity'] = 'HIGH';
      notes.push({
        category: 'architecture',
        severity: sev,
        description: `Active drift [${drift.id}]${drift.severity === 'CRITICAL' ? ' (CRITICAL)' : ''}: ${drift.description}`,
      });
    }
  }

  // Summarize MEDIUM drift items as a single note to avoid noise
  const mediumDrift = driftItems.filter(d => d.severity === 'MEDIUM');
  if (mediumDrift.length > 0) {
    notes.push({
      category: 'architecture',
      severity: 'MEDIUM',
      description:
        `${mediumDrift.length} MEDIUM drift item(s) active in DRIFT_REPORT.md: ` +
        mediumDrift.map(d => d.id).join(', '),
    });
  }

  return notes;
}

// ---------------------------------------------------------------------------
// Next actions
// ---------------------------------------------------------------------------

function buildNextActions(
  sprints: ClassifiedSprint[],
  recommendedNext: string | undefined,
  limitations: string[]
): string[] {
  const actions: string[] = [];

  if (recommendedNext) {
    actions.push(`Execute recommended next sprint: \`${recommendedNext}\``);
  } else {
    actions.push('Run `/sprint-plan` to select and lock the next sprint from roadmap priorities');
  }

  const blocked = sprints.filter(s => s.classification === 'Blocked');
  if (blocked.length > 0) {
    actions.push(
      `Resolve ${blocked.length} blocked sprint(s) — see NEXT_ACTIONS.md for unblock conditions`
    );
  }

  const safePairs = buildParallelizationMatrix(sprints).filter(p => p.safe);
  if (safePairs.length > 0) {
    actions.push(
      `Consider parallel lane: ${safePairs[0].sprintA} ↔ ${safePairs[0].sprintB} (safe pair identified)`
    );
  }

  const codexCount = sprints.filter(s => s.runner === 'Codex').length;
  if (codexCount > 0) {
    actions.push(
      `Review ${codexCount} Codex-Safe sprint(s) — eligible for Codex execution if Codex lane is active`
    );
  }

  if (limitations.length > 0) {
    actions.push(
      'Populate sprint queue (run /sprint-plan) to improve SPOA classification accuracy'
    );
    actions.push('Update docs/status/NEXT_5_SPRINTS.md with upcoming sprint backlog');
  }

  actions.push('Re-run `claude-os portfolio:audit` after next sprint closes to refresh analysis');

  return actions;
}

// ---------------------------------------------------------------------------
// Combine / split detection
// ---------------------------------------------------------------------------

function detectCombineSplitCandidates(sprints: ClassifiedSprint[]): {
  combineCandidates: PortfolioAuditResult['combineCandidates'];
  splitCandidates: PortfolioAuditResult['splitCandidates'];
} {
  const combineCandidates: PortfolioAuditResult['combineCandidates'] = [];
  const splitCandidates: PortfolioAuditResult['splitCandidates'] = [];

  // Find pairs of Governance-Only sprints that could combine (docs-heavy wave)
  const govSprints = sprints.filter(s => s.classification === 'Governance-Only');
  if (govSprints.length >= 2) {
    combineCandidates.push({
      sprints: govSprints.slice(0, 2).map(s => s.entry.id),
      rationale:
        'Multiple small governance sprints can be combined into a single docs wave for reduced sprint overhead',
      benefit: 'Fewer sprint lifecycles to manage; cleaner proof bundle',
      cautions: 'Ensure scope remains bounded; avoid mixing governance with implementation',
    });
  }

  // Find sprints with mixed risk tags that could split
  const mixedRiskSprints = sprints.filter(
    s =>
      s.secondaryTags.includes('core-invariant-sensitive') &&
      (s.secondaryTags.includes('read-only-ui') || s.secondaryTags.includes('docs-heavy'))
  );
  for (const s of mixedRiskSprints) {
    splitCandidates.push({
      sprint: s.entry.id,
      rationale:
        'Sprint mixes core-invariant-sensitive work with UI or docs work — different runners are better suited to each slice',
      proposedParts: [
        `${s.entry.id}-CORE: Core implementation (Claude Core, sequential)`,
        `${s.entry.id}-UI: UI/docs portion (Codex-Safe or Governance lane)`,
      ],
    });
  }

  return { combineCandidates, splitCandidates };
}
