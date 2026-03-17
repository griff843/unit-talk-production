/**
 * SPOA - Sprint Portfolio Optimization Audit
 * Sprint classifier: assigns classifications and secondary tags to each sprint.
 *
 * Fail-closed: when in doubt, classify as Sequential Only + Claude Core.
 *
 * Sprint: SPRINT-SPOA-FOUNDATION-MANUAL-COMMAND
 */

import * as fs from 'node:fs';

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

  const next5Path = resolveRepoPath('docs/status/NEXT_5_SPRINTS.md');
  if (fs.existsSync(next5Path)) {
    const content = fs.readFileSync(next5Path, 'utf-8');
    const queued = parseQueuedSprints(content);
    for (const sprint of queued) {
      if (!sprints.find(existing => existing.id === sprint.id)) {
        sprints.push(sprint);
      }
    }
  }

  const phaseStatusPath = resolveRepoPath('docs/status/PHASE_STATUS.md');
  if (fs.existsSync(phaseStatusPath)) {
    const content = fs.readFileSync(phaseStatusPath, 'utf-8');
    const inferred = parseRemainingWorkFromPhaseStatus(content);
    for (const sprint of inferred) {
      if (!sprints.find(existing => existing.id === sprint.id)) {
        sprints.push(sprint);
      }
    }
  }

  if (sprints.length === 0) {
    limitations.push(
      'Sprint queue appears empty based on available docs. ' +
        'Run /sprint-plan to populate the queue before running SPOA. ' +
        'Audit proceeds with inferred work items from phase status.'
    );
    sprints.push(...buildInferredQueueFromPhaseContext());
  }

  const driftPath = resolveRepoPath('docs/status/DRIFT_REPORT.md');
  if (fs.existsSync(driftPath)) {
    const content = fs.readFileSync(driftPath, 'utf-8');
    driftItems.push(...parseDriftReport(content));
  }

  const proofMatrixPath = resolveRepoPath('docs/status/LIFECYCLE_PROOF_MATRIX.md');
  if (fs.existsSync(proofMatrixPath)) {
    const content = fs.readFileSync(proofMatrixPath, 'utf-8');
    for (const [key, value] of parseLifecycleProofMatrix(content)) {
      certMatrix.set(key, value);
    }
  }

  const truthGapPath = resolveRepoPath('docs/status/LIFECYCLE_TRUTH_GAP_MEMO.md');
  if (fs.existsSync(truthGapPath)) {
    const content = fs.readFileSync(truthGapPath, 'utf-8');
    truthGaps.push(...parseTruthGapMemo(content));
  }

  return { sprints, loadedSources, missingSource, limitations, truthGaps, driftItems, certMatrix };
}

function parseQueuedSprints(content: string): SprintEntry[] {
  const sprints: SprintEntry[] = [];
  const tableRowRegex =
    /^\|\s*(\d+)\s*\|\s*([A-Z][^\|]+)\|\s*([^\|]*)\|\s*([^\|]*)\|\s*([^\|]*)\|\s*([^\|]*)\|\s*([^\|]*)\|/gm;

  let match: RegExpExecArray | null;
  while ((match = tableRowRegex.exec(content)) !== null) {
    const num = match[1].trim();
    const sprintId = match[2].trim();
    const phase = match[4].trim();
    const focus = match[5].trim();
    const blockedBy = match[7].trim();

    if (sprintId === 'Sprint' || sprintId === 'TBD' || sprintId === 'â€”') continue;
    if (num === '#') continue;

    const isBlocked = blockedBy && blockedBy !== 'â€”' && blockedBy !== '' && blockedBy !== 'None';

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

function parseRemainingWorkFromPhaseStatus(content: string): SprintEntry[] {
  const sprints: SprintEntry[] = [];
  const remainingWorkSections = content.match(/### Remaining Work\s*\n([\s\S]*?)(?=\n###|\n##|$)/g);
  if (!remainingWorkSections) return sprints;

  for (const section of remainingWorkSections) {
    const bullets = section.match(/^[-*]\s+(.+)$/gm);
    if (!bullets) continue;

    for (const bullet of bullets) {
      const text = bullet.replace(/^[-*]\s+/, '').trim();
      if (!text || text.includes('None') || text.includes('COMPLETE')) continue;

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

function buildInferredQueueFromPhaseContext(): SprintEntry[] {
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
      title: 'Workflow orchestration refinement - batch operations and trigger automation',
      layer: 'Layer 3',
      phase: 'Phase 11',
      status: 'inferred',
      confidence: 'medium',
      notes: 'Inferred from PHASE_STATUS.md Phase 4 remaining',
    },
    {
      id: 'INFERRED-PHASE1-E2E-SMOKE',
      title: 'E2E smoke test suite - full-lifecycle pick proof (Phase 1 3% remaining)',
      layer: 'Layer 1',
      phase: 'Phase 5',
      status: 'inferred',
      confidence: 'medium',
      notes: 'Inferred from PHASE_STATUS.md Phase 1 remaining gaps',
    },
    {
      id: 'INFERRED-PHASE5-ENTERPRISE-SCALING',
      title: 'Phase 5 Enterprise Scaling - multi-tenant architecture, config scoping',
      layer: 'Layer 3+',
      phase: 'Phase 5',
      status: 'deferred',
      confidence: 'medium',
      notes: 'Inferred from PHASE_STATUS.md Phase 5: blocked by Phase 4',
      blockedBy: 'Phase 4 completion',
    },
    {
      id: 'INFERRED-COS008-MODE-B-ENVELOPES',
      title: 'COS-008 - Mode B task envelopes for external LLM advisory lanes',
      layer: 'Claude OS',
      phase: 'COS',
      status: 'inferred',
      confidence: 'medium',
      notes: 'Inferred from PHASE_STATUS.md Claude OS Future: COS-008',
    },
    {
      id: 'INFERRED-COS009-MODE-B-PILOT',
      title: 'COS-009 - Mode B pilot: ChatGPT-4o for Lane 4 docs advisory',
      layer: 'Claude OS',
      phase: 'COS',
      status: 'inferred',
      confidence: 'low',
      notes: 'Inferred from PHASE_STATUS.md Claude OS Future: COS-009',
      blockedBy: 'COS-008',
    },
  ];
}

export interface ClassificationResult {
  classification: SprintClassification;
  secondaryTags: SecondaryTag[];
  rationale: string;
  parallelSafe: boolean;
}

export function classifySprint(entry: SprintEntry): ClassificationResult {
  const titleLower = `${entry.id.toLowerCase()} ${entry.title.toLowerCase()}`;

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
      rationale: entry.notes ?? 'Strategically deferred - lower priority than current work',
      parallelSafe: false,
    };
  }

  if (entry.confidence === 'low' || entry.status === 'inferred') {
    return {
      classification: CONSERVATIVE_CLASSIFICATION,
      secondaryTags: ['docs-heavy'],
      rationale:
        'Sprint is inferred from phase status docs - insufficient explicit truth to classify safely. Defaulting to Sequential Only (fail-closed).',
      parallelSafe: false,
    };
  }

  const isGovernance = GOVERNANCE_KEYWORDS.some(keyword => titleLower.includes(keyword));
  if (isGovernance && !CORE_SENSITIVE_KEYWORDS.some(keyword => titleLower.includes(keyword))) {
    const tags: SecondaryTag[] = ['docs-heavy'];
    if (titleLower.includes('audit') || titleLower.includes('proof')) tags.push('proof-heavy');
    return {
      classification: 'Governance-Only',
      secondaryTags: tags,
      rationale:
        'Sprint is governance, docs, audit, or policy oriented. No core product mutation required.',
      parallelSafe: true,
    };
  }

  const isCoreTouch = CORE_SENSITIVE_KEYWORDS.some(keyword => titleLower.includes(keyword));
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
        'Sprint touches core lifecycle, settlement, grading, scoring, or schema - requires Claude Core execution with full context.',
      parallelSafe: false,
    };
  }

  const isCodexCandidate = CODEX_SAFE_KEYWORDS.some(keyword => titleLower.includes(keyword));
  const hasCodexOverride = CODEX_OVERRIDE_KEYWORDS.some(keyword => titleLower.includes(keyword));

  if (isCodexCandidate && !hasCodexOverride) {
    return {
      classification: 'Codex-Safe',
      secondaryTags: ['read-only-ui'],
      rationale:
        'Sprint is bounded Command Center / dashboard UI work with settled contracts and no schema or lifecycle touch. Eligible for Codex execution.',
      parallelSafe: true,
    };
  }

  return {
    classification: CONSERVATIVE_CLASSIFICATION,
    secondaryTags: [],
    rationale:
      'Insufficient classification signal. Defaulting to Sequential Only (fail-closed). Review sprint spec before reclassifying.',
    parallelSafe: false,
  };
}

export function detectMultiClaudeOpportunities(
  titleLowers: Array<{ id: string; titleLower: string; classification: string }>
): Array<{ sprintA: string; sprintB: string; rationale: string }> {
  const opportunities: Array<{ sprintA: string; sprintB: string; rationale: string }> = [];

  const parallelEligible = titleLowers.filter(
    item => item.classification === 'Codex-Safe' || item.classification === 'Governance-Only'
  );

  const governanceSprints = parallelEligible.filter(
    item => item.classification === 'Governance-Only'
  );
  const codexSprints = parallelEligible.filter(item => item.classification === 'Codex-Safe');

  for (const governanceSprint of governanceSprints) {
    for (const codexSprint of codexSprints) {
      opportunities.push({
        sprintA: governanceSprint.id,
        sprintB: codexSprint.id,
        rationale:
          'Governance-Only sprint (docs-only lane) can run safely in parallel with Codex-Safe sprint (bounded UI implementation). No file overlap expected.',
      });
    }
  }

  return opportunities;
}

export function parseDriftReport(content: string): DriftItem[] {
  const items: DriftItem[] = [];
  const activeSectionMatch = content.match(/## ACTIVE DRIFT([\s\S]*?)(?=## RESOLVED DRIFT|$)/i);
  const activeContent = activeSectionMatch ? activeSectionMatch[1] : content;
  const driftHeadingRegex = /#{3,4}\s+(DRIFT-[A-Z0-9-]+):\s+(.+)/g;

  let match: RegExpExecArray | null;
  while ((match = driftHeadingRegex.exec(activeContent)) !== null) {
    const id = match[1].trim();
    const description = match[2].trim();

    if (match[0].includes('~~')) continue;

    let severity: DriftItem['severity'] = 'MEDIUM';
    const beforeMatch = activeContent.slice(0, match.index);
    const lastSectionHeader = [
      ...beforeMatch.matchAll(/### (CRITICAL|HIGH|MEDIUM|LOW) DRIFT/gi),
    ].pop();
    if (lastSectionHeader) {
      const sectionSeverity = lastSectionHeader[1].toUpperCase();
      if (sectionSeverity === 'CRITICAL') severity = 'CRITICAL';
      else if (sectionSeverity === 'HIGH') severity = 'HIGH';
      else if (sectionSeverity === 'LOW') severity = 'LOW';
    }

    items.push({ id, severity, description });
  }

  return items;
}

export function parseLifecycleProofMatrix(content: string): Map<string, string> {
  const matrix = new Map<string, string>();
  const rowRegex = /^\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/gm;

  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(content)) !== null) {
    const key = match[1].trim();
    const result = match[2].trim();

    if (key === '---' || key === 'Sprint' || key === 'Gate' || key === 'Check') continue;
    if (result === '---' || result === 'Result' || result === 'Status') continue;

    if (key && result) {
      matrix.set(key, result);
    }
  }

  return matrix;
}

export function parseTruthGapMemo(content: string): TruthGapItem[] {
  const gaps: TruthGapItem[] = [];
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

  const bulletRegex = /\*\*GAP-[A-Z0-9-]+\*\*[:\s]+(.+)/g;
  while ((match = bulletRegex.exec(content)) !== null) {
    const defect = match[1].trim();
    if (defect) {
      gaps.push({ file: 'unspecified', defect, severity: 'MEDIUM' });
    }
  }

  return gaps;
}
