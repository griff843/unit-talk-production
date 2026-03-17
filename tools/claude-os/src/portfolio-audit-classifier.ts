/**
 * SPOA — Sprint Portfolio Optimization Audit
 * Sprint classifier: assigns classifications and secondary tags to each sprint.
 *
 * Fail-closed: when in doubt, classify as Sequential Only + Claude Core.
 *
 * Sprint: SPRINT-SPOA-FOUNDATION-MANUAL-COMMAND
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { resolveRepoPath } from './fs-utils.js';
import {
  CONSERVATIVE_CLASSIFICATION,
  CORE_SENSITIVE_KEYWORDS,
  GOVERNANCE_KEYWORDS,
  CODEX_SAFE_KEYWORDS,
  CODEX_OVERRIDE_KEYWORDS,
  SPOA_INPUT_SOURCES,
} from './portfolio-audit-config.js';

import type { SprintEntry, SprintClassification, SecondaryTag } from './portfolio-audit-types.js';

// ---------------------------------------------------------------------------
// Intermediate parsing types (used by orchestrator for risk note generation)
// ---------------------------------------------------------------------------

export interface TruthGapItem {
  file: string;
  defect: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface DriftItem {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
}

// ---------------------------------------------------------------------------
// Portfolio source loading
// ---------------------------------------------------------------------------

/**
 * Load remaining sprint queue from repo docs.
 * Returns what it can find and populates limitations list.
 */
export function loadSprintPortfolio(): {
  sprints: SprintEntry[];
  loadedSources: string[];
  missingSource: string[];
  limitations: string[];
  truthGaps: TruthGapItem[];
  driftItems: DriftItem[];
  certMatrix: Map<string, string>;
} {
  const sprints: SprintEntry[] = [];
  const loadedSources: string[] = [];
  const missingSource: string[] = [];
  const limitations: string[] = [];
  const truthGaps: TruthGapItem[] = [];
  const driftItems: DriftItem[] = [];
  const certMatrix = new Map<string, string>();

  for (const relPath of SPOA_INPUT_SOURCES) {
    const absPath = resolveRepoPath(relPath);
    if (!fs.existsSync(absPath)) {
      missingSource.push(relPath);
      limitations.push(`Source not found: ${relPath}`);
      continue;
    }
    loadedSources.push(relPath);
  }

  // Parse NEXT_5_SPRINTS.md for queued sprints
  const next5Path = resolveRepoPath('docs/status/NEXT_5_SPRINTS.md');
  if (fs.existsSync(next5Path)) {
    const content = fs.readFileSync(next5Path, 'utf-8');
    const queued = parseQueuedSprints(content);
    for (const s of queued) {
      if (!sprints.find(x => x.id === s.id)) {
        sprints.push(s);
      }
    }
  }

  // Parse PHASE_STATUS.md for remaining work items
  const phaseStatusPath = resolveRepoPath('docs/status/PHASE_STATUS.md');
  if (fs.existsSync(phaseStatusPath)) {
    const content = fs.readFileSync(phaseStatusPath, 'utf-8');
    const inferred = parseRemainingWorkFromPhaseStatus(content);
    for (const s of inferred) {
      if (!sprints.find(x => x.id === s.id)) {
        sprints.push(s);
      }
    }
  }

  if (sprints.length === 0) {
    limitations.push(
      'Sprint queue appears empty based on available docs. ' +
        'Run /sprint-plan to populate the queue before running SPOA. ' +
        'Audit proceeds with inferred work items from phase status.'
    );
    // Inject inferred work items based on what phase docs describe as remaining
    sprints.push(...buildInferredQueueFromPhaseContext());
  }

  // Parse DRIFT_REPORT.md for active drift items
  const driftPath = resolveRepoPath('docs/status/DRIFT_REPORT.md');
  if (fs.existsSync(driftPath)) {
    const content = fs.readFileSync(driftPath, 'utf-8');
    const parsed = parseDriftReport(content);
    driftItems.push(...parsed);
  }

  // Parse LIFECYCLE_PROOF_MATRIX.md (defensive — may not exist yet)
  const proofMatrixPath = resolveRepoPath('docs/status/LIFECYCLE_PROOF_MATRIX.md');
  if (fs.existsSync(proofMatrixPath)) {
    const content = fs.readFileSync(proofMatrixPath, 'utf-8');
    const parsed = parseLifecycleProofMatrix(content);
    for (const [k, v] of parsed) {
      certMatrix.set(k, v);
    }
  }

  // Parse LIFECYCLE_TRUTH_GAP_MEMO.md (defensive — may not exist yet)
  const truthGapPath = resolveRepoPath('docs/status/LIFECYCLE_TRUTH_GAP_MEMO.md');
  if (fs.existsSync(truthGapPath)) {
    const content = fs.readFileSync(truthGapPath, 'utf-8');
    const parsed = parseTruthGapMemo(content);
    truthGaps.push(...parsed);
  }

  return { sprints, loadedSources, missingSource, limitations, truthGaps, driftItems, certMatrix };
}

// ---------------------------------------------------------------------------
// NEXT_5_SPRINTS.md parser
// ---------------------------------------------------------------------------

function parseQueuedSprints(content: string): SprintEntry[] {
  const sprints: SprintEntry[] = [];

  // Look for table rows that aren't header/separator lines
  // Format: | # | Sprint | Priority | Phase | Focus | Linear | Blocked By |
  const tableRowRegex =
    /^\|\s*(\d+)\s*\|\s*([A-Z][^\|]+)\|\s*([^\|]*)\|\s*([^\|]*)\|\s*([^\|]*)\|\s*([^\|]*)\|\s*([^\|]*)\|/gm;

  let match: RegExpExecArray | null;
  while ((match = tableRowRegex.exec(content)) !== null) {
    const num = match[1].trim();
    const sprintId = match[2].trim();
    const phase = match[4].trim();
    const focus = match[5].trim();
    const blockedBy = match[7].trim();

    // Skip header rows and TBD placeholders with no real sprint
    if (sprintId === 'Sprint' || sprintId === 'TBD' || sprintId === '—') continue;
    if (num === '#') continue;

    const isBlocked = blockedBy && blockedBy !== '—' && blockedBy !== '' && blockedBy !== 'None';

    sprints.push({
      id: sprintId,
      title: focus || sprintId,
      phase: phase || undefined,
      status: isBlocked ? 'blocked' : 'queued',
      blockedBy: isBlocked ? blockedBy : undefined,
      confidence: 'high',
    });
  }

  return sprints;
}

// ---------------------------------------------------------------------------
// PHASE_STATUS.md remaining work parser
// ---------------------------------------------------------------------------

function parseRemainingWorkFromPhaseStatus(content: string): SprintEntry[] {
  const sprints: SprintEntry[] = [];

  // Extract "Remaining Work" sections
  const remainingWorkSections = content.match(/### Remaining Work\s*\n([\s\S]*?)(?=\n###|\n##|$)/g);
  if (!remainingWorkSections) return sprints;

  for (const section of remainingWorkSections) {
    // Extract bullet items from remaining work sections
    const bullets = section.match(/^[-*]\s+(.+)$/gm);
    if (!bullets) continue;

    for (const bullet of bullets) {
      const text = bullet.replace(/^[-*]\s+/, '').trim();
      if (!text || text.includes('None') || text.includes('COMPLETE')) continue;

      // Create an inferred sprint entry
      const inferredId = `INFERRED-${text
        .slice(0, 40)
        .replace(/[^a-zA-Z0-9]/g, '-')
        .toUpperCase()}`;
      sprints.push({
        id: inferredId,
        title: text,
        status: 'inferred',
        confidence: 'low',
        notes: 'Inferred from PHASE_STATUS.md remaining work section',
      });
    }
  }

  return sprints;
}

// ---------------------------------------------------------------------------
// Inferred queue from known platform context
// (used when explicit queue is empty — conservative inference from phase docs)
// ---------------------------------------------------------------------------

function buildInferredQueueFromPhaseContext(): SprintEntry[] {
  // Based on PHASE_STATUS.md Phase 4 remaining work (72% complete, ~28% left)
  // and Phase 5 (0% complete)
  // These are the known remaining work areas that will need sprints
  return [
    {
      id: 'INFERRED-PHASE4-EDGE-RANKING-FEEDS',
      title: 'Automated edge ranking feeds (Phase 4)',
      layer: 'Layer 3',
      phase: 'Phase 11',
      status: 'inferred',
      confidence: 'medium',
      notes: 'Inferred from PHASE_STATUS.md Phase 4 remaining: automated edge ranking feeds',
    },
    {
      id: 'INFERRED-PHASE4-MARKET-ALERT-AUTOMATION',
      title: 'Full market alert automation (Phase 4)',
      layer: 'Layer 3',
      phase: 'Phase 11',
      status: 'inferred',
      confidence: 'medium',
      notes: 'Inferred from PHASE_STATUS.md Phase 4 remaining: full market alert automation',
    },
    {
      id: 'INFERRED-PHASE4-RECAP-SCHEDULING',
      title: 'RecapAgent scheduling + context-aware recap generation (Phase 4)',
      layer: 'Layer 3',
      phase: 'Phase 10-11',
      status: 'inferred',
      confidence: 'medium',
      notes:
        'Inferred from PHASE_STATUS.md: RecapAgent infrastructure ready; scheduling config external',
    },
    {
      id: 'INFERRED-PHASE4-WORKFLOW-BATCH-OPS',
      title: 'Workflow orchestration refinement — batch operations and trigger automation',
      layer: 'Layer 3',
      phase: 'Phase 11',
      status: 'inferred',
      confidence: 'medium',
      notes: 'Inferred from PHASE_STATUS.md Phase 4 remaining',
    },
    {
      id: 'INFERRED-PHASE1-E2E-SMOKE',
      title: 'E2E smoke test suite — full-lifecycle pick proof (Phase 1 3% remaining)',
      layer: 'Layer 1',
      phase: 'Phase 5',
      status: 'inferred',
      confidence: 'medium',
      notes: 'Inferred from PHASE_STATUS.md Phase 1 remaining gaps',
    },
    {
      id: 'INFERRED-PHASE5-ENTERPRISE-SCALING',
      title: 'Phase 5 Enterprise Scaling — multi-tenant architecture, config scoping',
      layer: 'Layer 3+',
      phase: 'Phase 5',
      status: 'deferred',
      confidence: 'medium',
      notes: 'Inferred from PHASE_STATUS.md Phase 5: blocked by Phase 4',
      blockedBy: 'Phase 4 completion',
    },
    {
      id: 'INFERRED-COS008-MODE-B-ENVELOPES',
      title: 'COS-008 — Mode B task envelopes for external LLM advisory lanes',
      layer: 'Claude OS',
      phase: 'COS',
      status: 'inferred',
      confidence: 'medium',
      notes: 'Inferred from PHASE_STATUS.md Claude OS Future: COS-008',
    },
    {
      id: 'INFERRED-COS009-MODE-B-PILOT',
      title: 'COS-009 — Mode B pilot: ChatGPT-4o for Lane 4 docs advisory',
      layer: 'Claude OS',
      phase: 'COS',
      status: 'inferred',
      confidence: 'low',
      notes: 'Inferred from PHASE_STATUS.md Claude OS Future: COS-009',
      blockedBy: 'COS-008',
    },
  ];
}

// ---------------------------------------------------------------------------
// Classification logic
// ---------------------------------------------------------------------------

export interface ClassificationResult {
  classification: SprintClassification;
  secondaryTags: SecondaryTag[];
  rationale: string;
  parallelSafe: boolean;
}

/**
 * Classify a sprint entry.
 * Fail-closed: when in doubt, classify as Sequential Only.
 */
export function classifySprint(entry: SprintEntry): ClassificationResult {
  const titleLower = entry.id.toLowerCase() + ' ' + entry.title.toLowerCase();

  // ---- Explicit status overrides first ----

  if (entry.status === 'blocked') {
    return {
      classification: 'Blocked',
      secondaryTags: [],
      rationale: `Blocked by: ${entry.blockedBy ?? 'dependency not satisfied'}`,
      parallelSafe: false,
    };
  }

  if (entry.status === 'deferred') {
    return {
      classification: 'Deferred',
      secondaryTags: [],
      rationale: entry.notes ?? 'Strategically deferred — lower priority than current work',
      parallelSafe: false,
    };
  }

  // ---- Governance-Only detection ----
  const isGovernance = GOVERNANCE_KEYWORDS.some(kw => titleLower.includes(kw));
  if (isGovernance && !CORE_SENSITIVE_KEYWORDS.some(kw => titleLower.includes(kw))) {
    const tags: SecondaryTag[] = ['docs-heavy'];
    if (titleLower.includes('audit') || titleLower.includes('proof')) tags.push('proof-heavy');
    return {
      classification: 'Governance-Only',
      secondaryTags: tags,
      rationale:
        'Sprint is governance, docs, audit, or policy oriented. No core product mutation required.',
      parallelSafe: true, // governance work is generally safe to run in parallel with non-overlapping impl
    };
  }

  // ---- Core-sensitive detection (fail-closed → Claude-Core) ----
  const isCoreTouch = CORE_SENSITIVE_KEYWORDS.some(kw => titleLower.includes(kw));
  if (isCoreTouch) {
    const tags: SecondaryTag[] = [];
    if (
      titleLower.includes('schema') ||
      titleLower.includes('migration') ||
      titleLower.includes('lifecycle')
    ) {
      tags.push('schema-touch', 'lifecycle-touch');
    }
    if (
      titleLower.includes('settlement') ||
      titleLower.includes('grading') ||
      titleLower.includes('scoring') ||
      titleLower.includes('invariant')
    ) {
      tags.push('core-invariant-sensitive');
    }
    if (titleLower.includes('e2e') || titleLower.includes('cert')) {
      tags.push('proof-heavy');
    }
    return {
      classification: 'Claude-Core',
      secondaryTags: tags,
      rationale:
        'Sprint touches core lifecycle, settlement, grading, scoring, or schema — requires Claude Core execution with full context.',
      parallelSafe: false,
    };
  }

  // ---- Codex-safe detection (bounded UI / docs with no core touch) ----
  const isCodexCandidate = CODEX_SAFE_KEYWORDS.some(kw => titleLower.includes(kw));
  const hasCodexOverride = CODEX_OVERRIDE_KEYWORDS.some(kw => titleLower.includes(kw));

  if (isCodexCandidate && !hasCodexOverride) {
    return {
      classification: 'Codex-Safe',
      secondaryTags: ['read-only-ui'],
      rationale:
        'Sprint is bounded Command Center / dashboard UI work with settled contracts and no schema or lifecycle touch. Eligible for Codex execution.',
      parallelSafe: true,
    };
  }

  // ---- Inferred items with low confidence → conservative (with Phase 4/11 exception) ----
  if (entry.confidence === 'low' || entry.status === 'inferred') {
    // Phase 4/11 and Claude OS inferred items represent analytics/feature/tooling
    // work. When no core-sensitive keywords are present, these can run in parallel.
    const isPhase4or11 =
      titleLower.includes('phase 4') ||
      titleLower.includes('phase-4') ||
      titleLower.includes('phase 11') ||
      titleLower.includes('phase-11') ||
      titleLower.includes('cos-') ||
      titleLower.includes('claude-os') ||
      titleLower.includes('mode b');
    if (isPhase4or11 && !CORE_SENSITIVE_KEYWORDS.some(kw => titleLower.includes(kw))) {
      return {
        classification: 'Parallel-Safe',
        secondaryTags: ['docs-heavy'],
        rationale:
          'Phase 4/11 or Claude OS inferred sprint — analytics/feature/tooling work eligible ' +
          'for parallel execution. Low confidence — populate NEXT_5_SPRINTS.md to confirm.',
        parallelSafe: true,
      };
    }
    return {
      classification: CONSERVATIVE_CLASSIFICATION,
      secondaryTags: ['docs-heavy'],
      rationale:
        'Sprint is inferred from phase status docs — insufficient explicit truth to classify safely. Defaulting to Sequential Only (fail-closed).',
      parallelSafe: false,
    };
  }

  // ---- Default: conservative ----
  return {
    classification: CONSERVATIVE_CLASSIFICATION,
    secondaryTags: [],
    rationale:
      'Insufficient classification signal. Defaulting to Sequential Only (fail-closed). Review sprint spec before reclassifying.',
    parallelSafe: false,
  };
}

// ---------------------------------------------------------------------------
// Multi-Claude wave detection
// ---------------------------------------------------------------------------

/**
 * Identify Multi-Claude Safe opportunity when two or more Codex-Safe or
 * Governance-Only sprints can run in parallel with non-overlapping scope.
 */
export function detectMultiClaudeOpportunities(
  titleLowers: Array<{ id: string; titleLower: string; classification: string }>
): Array<{ sprintA: string; sprintB: string; rationale: string }> {
  const opportunities: Array<{ sprintA: string; sprintB: string; rationale: string }> = [];

  const parallelEligible = titleLowers.filter(
    x => x.classification === 'Codex-Safe' || x.classification === 'Governance-Only'
  );

  // Pair governance sprints with codex sprints as a safe multi-claude wave
  const governanceSprints = parallelEligible.filter(x => x.classification === 'Governance-Only');
  const codexSprints = parallelEligible.filter(x => x.classification === 'Codex-Safe');

  for (const gov of governanceSprints) {
    for (const codex of codexSprints) {
      opportunities.push({
        sprintA: gov.id,
        sprintB: codex.id,
        rationale:
          'Governance-Only sprint (docs-only lane) can run safely in parallel with Codex-Safe sprint (bounded UI implementation). No file overlap expected.',
      });
    }
  }

  return opportunities;
}

// ---------------------------------------------------------------------------
// New source parsers (added in SPRINT-SPOA-INTELLIGENCE-TUNING)
// ---------------------------------------------------------------------------

/**
 * Parse DRIFT_REPORT.md for active (non-resolved) drift items.
 * Returns severity-tagged drift items for risk note injection.
 */
export function parseDriftReport(content: string): DriftItem[] {
  const items: DriftItem[] = [];

  // Only parse the ACTIVE DRIFT section — stop at RESOLVED section
  const activeSectionMatch = content.match(/## ACTIVE DRIFT([\s\S]*?)(?=## RESOLVED DRIFT|$)/i);
  const activeContent = activeSectionMatch ? activeSectionMatch[1] : content;

  // Match heading-style drift items: #### DRIFT-XX: description
  const driftHeadingRegex = /#{3,4}\s+(DRIFT-[A-Z0-9-]+):\s+(.+)/g;
  let match: RegExpExecArray | null;

  while ((match = driftHeadingRegex.exec(activeContent)) !== null) {
    const id = match[1].trim();
    const description = match[2].trim();

    // Skip items with strikethrough (resolved inline)
    if (match[0].includes('~~')) continue;

    // Determine severity from section context
    let severity: DriftItem['severity'] = 'MEDIUM';
    const beforeMatch = activeContent.slice(0, match.index);
    const lastSectionHeader = [
      ...beforeMatch.matchAll(/### (CRITICAL|HIGH|MEDIUM|LOW) DRIFT/gi),
    ].pop();
    if (lastSectionHeader) {
      const s = lastSectionHeader[1].toUpperCase();
      if (s === 'CRITICAL') severity = 'CRITICAL';
      else if (s === 'HIGH') severity = 'HIGH';
      else if (s === 'LOW') severity = 'LOW';
      else severity = 'MEDIUM';
    }

    items.push({ id, severity, description });
  }

  return items;
}

/**
 * Parse LIFECYCLE_PROOF_MATRIX.md for certification gate results.
 * Returns a map of gate-key → result string.
 */
export function parseLifecycleProofMatrix(content: string): Map<string, string> {
  const matrix = new Map<string, string>();

  // Table rows: | Sprint/Gate | Result | ... |
  const rowRegex = /^\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/gm;
  let match: RegExpExecArray | null;

  while ((match = rowRegex.exec(content)) !== null) {
    const key = match[1].trim();
    const result = match[2].trim();

    // Skip header/separator rows
    if (key === '---' || key === 'Sprint' || key === 'Gate' || key === 'Check') continue;
    if (result === '---' || result === 'Result' || result === 'Status') continue;

    if (key && result) {
      matrix.set(key, result);
    }
  }

  return matrix;
}

/**
 * Parse LIFECYCLE_TRUTH_GAP_MEMO.md for documented truth gaps.
 * Returns gap items for risk note injection.
 */
export function parseTruthGapMemo(content: string): TruthGapItem[] {
  const gaps: TruthGapItem[] = [];

  // Table rows: | File | Defect | Severity |
  const rowRegex = /^\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*(HIGH|MEDIUM|LOW|CRITICAL)\s*\|/gim;
  let match: RegExpExecArray | null;

  while ((match = rowRegex.exec(content)) !== null) {
    const file = match[1].trim();
    const defect = match[2].trim();
    const severity = match[3].toUpperCase() as TruthGapItem['severity'];

    if (file && defect && !file.startsWith('-') && file !== 'File') {
      gaps.push({ file, defect, severity });
    }
  }

  // Also parse bullet-style gap items: **GAP-N**: description
  const bulletRegex = /\*\*GAP-[A-Z0-9-]+\*\*[:\s]+(.+)/g;
  while ((match = bulletRegex.exec(content)) !== null) {
    const defect = match[1].trim();
    if (defect) {
      gaps.push({ file: 'unspecified', defect, severity: 'MEDIUM' });
    }
  }

  return gaps;
}
