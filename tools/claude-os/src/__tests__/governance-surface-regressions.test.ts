import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { classifySprint } from '../portfolio-audit-classifier.js';
import { loadProfileById } from '../profile-loader.js';
import { deriveScopeContract, validateFileAgainstScope } from '../scope-contract.js';

import type { SprintEntry } from '../portfolio-audit-types.js';
import type { TaskEnvelope, ProjectProfile } from '../types.js';

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(THIS_DIR, '..', '..', '..', '..');
const AGENTS_PATH = path.join(REPO_ROOT, 'AGENTS.md');
const SCOPE_CONTRACT_PATH = path.join(REPO_ROOT, 'tools', 'claude-os', 'src', 'scope-contract.ts');

const profileResult = loadProfileById('unit-talk');
const unitTalkProfile: ProjectProfile = profileResult.profile!;

function makeEnvelope(overrides?: Partial<TaskEnvelope>): TaskEnvelope {
  return {
    envelopeVersion: '1.0.0',
    taskId: 'SPRINT-GOV-SURFACE-TEST-001',
    taskType: 'docs',
    projectId: 'unit-talk',
    objective: 'Test governance surface hardening',
    summary: 'Test summary',
    touchedAreas: ['AGENTS.md'],
    truthSourcesRequired: [],
    killConditions: [],
    notes: [],
    deferredRequirements: [],
    ...overrides,
  };
}

async function loadAuditModule(loadResult: {
  sprints: SprintEntry[];
  loadedSources?: string[];
  limitations?: string[];
}) {
  vi.resetModules();

  vi.doMock('../portfolio-audit-classifier.js', () => ({
    loadSprintPortfolio: () => ({
      sprints: loadResult.sprints,
      loadedSources: loadResult.loadedSources ?? ['docs/status/NEXT_5_SPRINTS.md'],
      missingSource: [],
      limitations: loadResult.limitations ?? [],
      truthGaps: [],
      driftItems: [],
      certMatrix: new Map(),
    }),
    classifySprint: (entry: SprintEntry) => ({
      classification: entry.status === 'queued' ? 'Governance-Only' : 'Parallel-Safe',
      secondaryTags: ['docs-heavy'],
      rationale: `classified ${entry.id}`,
      parallelSafe: entry.status !== 'queued',
    }),
  }));

  vi.doMock('../portfolio-audit-runners.js', () => ({
    assignRunner: (classification: string) =>
      classification === 'Governance-Only' ? 'Governance Lane' : 'Claude Secondary',
    buildParallelizationMatrix: () => [],
    buildRunnerSummary: () => ({
      claudeCore: [],
      claudeSecondary: [],
      multiClaudeWave: [],
      codex: [],
      governanceLane: [],
      unassigned: [],
    }),
  }));

  vi.doMock('../portfolio-audit-artifacts.js', () => ({
    writeArtifactBundle: () => ({ files: ['PORTFOLIO_AUDIT.md'] }),
  }));

  vi.doMock('../portfolio-audit-config.js', async () => {
    const actual = await vi.importActual<typeof import('../portfolio-audit-config.js')>(
      '../portfolio-audit-config.js'
    );
    return {
      ...actual,
      resolveAuditOutputDir: () => '/tmp/spoa',
    };
  });

  return import('../portfolio-audit.js');
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unmock('../portfolio-audit-classifier.js');
  vi.unmock('../portfolio-audit-runners.js');
  vi.unmock('../portfolio-audit-artifacts.js');
  vi.unmock('../portfolio-audit-config.js');
});

describe('governance surface hardening', () => {
  it('forbids docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md when it is not in touchedAreas', () => {
    const contract = deriveScopeContract(makeEnvelope(), unitTalkProfile);

    const result = validateFileAgainstScope('docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md', contract);

    expect(result.allowed).toBe(false);
    expect(result.violation?.violationType).toBe('in_forbidden');
  });

  it('allows docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md when it is explicitly in touchedAreas', () => {
    const contract = deriveScopeContract(
      makeEnvelope({ touchedAreas: ['docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md'] }),
      unitTalkProfile
    );

    const result = validateFileAgainstScope('docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md', contract);

    expect(result.allowed).toBe(true);
    expect(result.violation).toBeNull();
  });

  it('contains the governance contract in the default forbidden surface list', () => {
    const source = readFileSync(SCOPE_CONTRACT_PATH, 'utf8');

    expect(source).toContain("pattern: 'docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md'");
    expect(source).toContain("type: 'exact'");
    expect(source).toContain("source: 'governance-default'");
  });
});

describe('SPOA conservative mode', () => {
  it('suppresses actionable recommendations when no queued sprint exists', async () => {
    const { runPortfolioAudit } = await loadAuditModule({
      sprints: [
        {
          id: 'INFERRED-PHASE4-EDGE-RANKING',
          title: 'Phase 4 edge ranking',
          status: 'inferred',
          confidence: 'low',
        },
      ],
      limitations: ['Original limitation'],
    });

    const { result } = runPortfolioAudit({ trigger: 'test' });

    expect(result.conservativeMode).toBe(true);
    expect(result.recommendedNextSprint).toBeUndefined();
    expect(result.rankedNextSprints).toEqual([]);
    expect(result.sprints[0].runner).toBe('Unassigned');
    expect(result.limitations[0]).toContain('[SPOA CONSERVATIVE MODE]');
    expect(result.conservativeModeReason).toContain('Queue truth is insufficient');
  });

  it('keeps recommendations active when at least one queued sprint exists', async () => {
    const { runPortfolioAudit } = await loadAuditModule({
      sprints: [
        {
          id: 'SPRINT-085-GOVERNANCE-SURFACE-HARDENING-AND-SPOA-CONSERVATIVE-MODE',
          title: 'Governance surface hardening',
          status: 'queued',
          confidence: 'high',
        },
      ],
    });

    const { result } = runPortfolioAudit({ trigger: 'test' });

    expect(result.conservativeMode).toBe(false);
    expect(result.recommendedNextSprint).toBe(
      'SPRINT-085-GOVERNANCE-SURFACE-HARDENING-AND-SPOA-CONSERVATIVE-MODE'
    );
    expect(result.rankedNextSprints?.length).toBeGreaterThan(0);
  });
});

describe('SPOA inferred classification fallback', () => {
  it('classifies inferred Phase 4 work as Sequential Only', () => {
    const result = classifySprint({
      id: 'INFERRED-PHASE4-EDGE-RANKING',
      title: 'Phase 4 edge ranking',
      status: 'inferred',
      confidence: 'low',
    });

    expect(result.classification).toBe('Sequential Only');
  });

  it('classifies inferred COS mode B work as Sequential Only', () => {
    const result = classifySprint({
      id: 'INFERRED-COS008-MODE-B',
      title: 'COS-008 mode B',
      status: 'inferred',
      confidence: 'low',
    });

    expect(result.classification).toBe('Sequential Only');
  });
});

describe('AGENTS.md governance references', () => {
  it('contains no .Codex or docs/Codex references', () => {
    const content = readFileSync(AGENTS_PATH, 'utf8');

    expect(content).not.toContain('.Codex');
    expect(content).not.toContain('docs/Codex');
  });

  it('points section 12 at NEXT_5_SPRINTS.md and section 11 at the corrected sprint id', () => {
    const content = readFileSync(AGENTS_PATH, 'utf8');

    expect(content).toContain('SPRINT-CLAUDE-OS-SESSION-ENFORCEMENT-110A');
    expect(content).toContain('docs/status/NEXT_5_SPRINTS.md');
    expect(content).toContain('historical record only');
  });
});
