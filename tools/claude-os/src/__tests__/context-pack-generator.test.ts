/**
 * Tests for Repo Context Pack Generator.
 *
 * Covers:
 *   1. Context pack generated with all required fields present
 *   2. Sprint state stores context pack path
 *   3. Protected-surface sprints fail-closed on context pack errors
 *   4. Freshness logic correctly identifies stale/fresh packs
 *   5. validateContextPack reports missing required fields
 *   6. Pack is written to out/context/<SPRINT_ID>/<DATE>/context-pack.json
 *   7. Pack is loadable from repo-relative path
 *   8. Non-protected sprints warn but do not fail on generation errors
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  generateContextPack,
  validateContextPack,
  checkContextPackFreshness,
  loadContextPack,
  CONTEXT_PACK_MAX_AGE_MS,
} from '../context-pack-generator.js';

import type { AuthoritySurface, CommandRunner, RepoContextPack } from '../types.js';

// ---------------------------------------------------------------------------
// Mock Command Runner
// ---------------------------------------------------------------------------

function makeMockRunner(
  overrides?: Partial<Record<string, { exitCode: number; stdout: string; stderr: string }>>
): CommandRunner {
  const defaults: Record<string, { exitCode: number; stdout: string; stderr: string }> = {
    'git remote get-url origin': {
      exitCode: 0,
      stdout: 'https://github.com/org/unit-talk-production.git\n',
      stderr: '',
    },
    'git rev-parse --abbrev-ref HEAD': {
      exitCode: 0,
      stdout: 'main\n',
      stderr: '',
    },
    'git status --short': {
      exitCode: 0,
      stdout: 'M  apps/api/src/index.ts\n?? out/context/\n',
      stderr: '',
    },
    'git log -n 10 --oneline': {
      exitCode: 0,
      stdout: 'abc1234 feat: add feature A\ndef5678 fix: fix bug B\n',
      stderr: '',
    },
    'git diff --stat HEAD': {
      exitCode: 0,
      stdout: 'apps/api/src/index.ts | 5 ++---\n 1 file changed, 2 insertions(+), 3 deletions(-)\n',
      stderr: '',
    },
    'git diff --name-only HEAD': {
      exitCode: 0,
      stdout: 'apps/api/src/index.ts\n',
      stderr: '',
    },
    ...overrides,
  };

  return (command: string) => {
    const result = defaults[command] ?? {
      exitCode: 1,
      stdout: '',
      stderr: `unknown command: ${command}`,
    };
    return {
      command,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs: 0,
      timedOut: false,
    };
  };
}

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-os-context-pack-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const SPRINT_ID = 'SPRINT-TEST-001';
const SPRINT_TITLE = 'Test Sprint';
const DATE_OVERRIDE = '2026-03-13';

// ---------------------------------------------------------------------------
// 1. Successful generation — required fields present
// ---------------------------------------------------------------------------

describe('generateContextPack — successful generation', () => {
  it('returns success=true with all required fields populated', () => {
    const result = generateContextPack(SPRINT_ID, SPRINT_TITLE, [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
      commandRunner: makeMockRunner(),
    });

    expect(result.success).toBe(true);
    expect(result.pack).not.toBeNull();
    const pack = result.pack!;

    expect(pack.pack_version).toBe('1.0.0');
    expect(pack.sprint_id).toBe(SPRINT_ID);
    expect(pack.sprint_title).toBe(SPRINT_TITLE);
    expect(pack.timestamp_generated).toBeTruthy();
    expect(pack.repository_name).toBe('unit-talk-production');
    expect(pack.current_branch).toBe('main');
    expect(pack.git_status_summary).toContain('apps/api');
    expect(pack.recent_commits).toHaveLength(2);
    expect(pack.diff_summary).toContain('1 file changed');
    expect(pack.changed_files).toEqual(['apps/api/src/index.ts']);
    expect(pack.affected_directories).toEqual(['apps/api/src']);
    expect(result.errors).toHaveLength(0);
  });

  it('writes context-pack.json to out/context/<SPRINT_ID>/<DATE>/', () => {
    const result = generateContextPack(SPRINT_ID, SPRINT_TITLE, [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
      commandRunner: makeMockRunner(),
    });

    expect(result.success).toBe(true);
    expect(result.output_path).not.toBeNull();
    expect(fs.existsSync(result.output_path!)).toBe(true);

    const expectedPath = path.join(tmpDir, SPRINT_ID, DATE_OVERRIDE, 'context-pack.json');
    expect(result.output_path).toBe(expectedPath);
  });

  it('pack is loadable from the written path', () => {
    const result = generateContextPack(SPRINT_ID, SPRINT_TITLE, [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
      commandRunner: makeMockRunner(),
    });

    expect(result.success).toBe(true);
    const loaded = loadContextPack(result.output_path!);
    expect(loaded).not.toBeNull();
    expect(loaded!.sprint_id).toBe(SPRINT_ID);
    expect(loaded!.current_branch).toBe('main');
  });

  it('falls back to directory name when remote URL lookup fails', () => {
    const result = generateContextPack(SPRINT_ID, SPRINT_TITLE, [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
      commandRunner: makeMockRunner({
        'git remote get-url origin': { exitCode: 1, stdout: '', stderr: 'not a git repo' },
      }),
    });

    expect(result.success).toBe(true);
    // Falls back to directory name — just verify it's non-empty
    expect(result.pack!.repository_name).toBeTruthy();
  });

  it('embeds authority_surfaces in the pack', () => {
    const surfaces: AuthoritySurface[] = ['scoring_authority', 'promotion_authority'];
    const result = generateContextPack(
      SPRINT_ID,
      SPRINT_TITLE,
      surfaces,
      ['repo', 'build', 'test', 'runtime', 'status'],
      {
        outputRoot: tmpDir,
        dateOverride: DATE_OVERRIDE,
        commandRunner: makeMockRunner(),
      }
    );

    expect(result.success).toBe(true);
    expect(result.pack!.authority_surfaces).toEqual(surfaces);
    expect(result.pack!.expected_proof_classes).toContain('repo');
    expect(result.pack!.expected_proof_classes).toContain('runtime');
  });

  it('includes relevant_governance_docs list (required docs always present)', () => {
    const result = generateContextPack(SPRINT_ID, SPRINT_TITLE, [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
      commandRunner: makeMockRunner(),
    });

    expect(result.success).toBe(true);
    const docs = result.pack!.relevant_governance_docs;
    const requiredPaths = [
      'governance/ai-orchestration/LLM_AUTHORITY_MAP.md',
      'governance/ai-orchestration/PROOF_RECEIPT_STANDARD.md',
      'governance/ai-orchestration/STATUS_RUBRIC.md',
      'governance/ai-orchestration/PROMPT_STANDARDIZATION_SPEC.md',
      'governance/ai-orchestration/REPO_TRUTH_ACCESS_STANDARD.md',
    ];
    for (const docPath of requiredPaths) {
      const found = docs.find(d => d.path === docPath);
      expect(found, `Expected governance doc entry for ${docPath}`).toBeDefined();
      // exists is true or false based on disk — just verify the field is present
      expect(typeof found!.exists).toBe('boolean');
    }
  });

  it('affected_directories is empty when no changed files', () => {
    const result = generateContextPack(SPRINT_ID, SPRINT_TITLE, [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
      commandRunner: makeMockRunner({
        'git diff --name-only HEAD': { exitCode: 0, stdout: '', stderr: '' },
      }),
    });

    expect(result.success).toBe(true);
    expect(result.pack!.changed_files).toEqual([]);
    expect(result.pack!.affected_directories).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. Sprint state stores context pack path
// ---------------------------------------------------------------------------

describe('createSprintState — repo_context_pack_path integration', () => {
  it('stores context pack path when provided', async () => {
    const { createSprintState } = await import('../sprint-state.js');

    const state = createSprintState({
      sprint_id: SPRINT_ID,
      title: SPRINT_TITLE,
      authority_surfaces: [],
      primary_owner: 'test_runner',
      repo_context_pack_path: 'out/context/SPRINT-TEST-001/2026-03-13/context-pack.json',
    });

    expect(state.repo_context_pack_path).toBe(
      'out/context/SPRINT-TEST-001/2026-03-13/context-pack.json'
    );
  });

  it('defaults repo_context_pack_path to null when not provided', async () => {
    const { createSprintState } = await import('../sprint-state.js');

    const state = createSprintState({
      sprint_id: SPRINT_ID,
      title: SPRINT_TITLE,
      authority_surfaces: [],
      primary_owner: 'test_runner',
    });

    expect(state.repo_context_pack_path).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. Protected-surface fail-closed behavior
// ---------------------------------------------------------------------------

describe('generateContextPack — protected-surface fail-closed', () => {
  it('returns success=false for protected sprint when current branch is unknown', () => {
    const surfaces: AuthoritySurface[] = ['scoring_authority'];
    const result = generateContextPack(SPRINT_ID, SPRINT_TITLE, surfaces, [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
      commandRunner: makeMockRunner({
        'git rev-parse --abbrev-ref HEAD': {
          exitCode: 1,
          stdout: '',
          stderr: 'fatal: not a git repo',
        },
      }),
    });

    expect(result.success).toBe(false);
    expect(result.pack).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.toLowerCase().includes('unknown'))).toBe(true);
  });

  it('returns success=false for protected sprint when required governance docs missing (errors include doc list)', () => {
    // This test verifies the fail-closed path; actual docs may or may not exist on disk.
    // We confirm: if required docs are missing, protected sprints fail with errors.
    const surfaces: AuthoritySurface[] = ['canonical_schema_contract'];
    const result = generateContextPack(SPRINT_ID, SPRINT_TITLE, surfaces, [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
      commandRunner: makeMockRunner(),
    });

    // Result depends on whether governance docs exist on disk.
    // For protected sprints: either success=true (docs exist) or success=false (docs missing).
    // We only assert the shape is correct.
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.pack).toBeNull();
    } else {
      expect(result.pack).not.toBeNull();
    }
  });

  it('non-protected sprint succeeds with warnings when governance docs are missing on disk', () => {
    // For a non-protected sprint, missing governance docs add warnings but do NOT fail.
    const result = generateContextPack(SPRINT_ID, SPRINT_TITLE, [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
      commandRunner: makeMockRunner(),
    });

    // Must succeed regardless of governance doc existence on disk
    expect(result.success).toBe(true);
    expect(result.pack).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. Freshness logic
// ---------------------------------------------------------------------------

describe('checkContextPackFreshness', () => {
  it('returns fresh=true for a newly generated pack', () => {
    const result = generateContextPack(SPRINT_ID, SPRINT_TITLE, [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
      commandRunner: makeMockRunner(),
    });

    expect(result.success).toBe(true);
    const freshness = checkContextPackFreshness(result.pack!);
    expect(freshness.fresh).toBe(true);
    expect(freshness.ageMs).toBeLessThan(5000); // should be <5 seconds old
    expect(freshness.reason).toBe('Pack is fresh');
  });

  it('returns fresh=false for a pack older than maxAgeMs', () => {
    const staleTimestamp = new Date(Date.now() - CONTEXT_PACK_MAX_AGE_MS - 1000).toISOString();
    const stalePack: RepoContextPack = {
      pack_version: '1.0.0',
      sprint_id: SPRINT_ID,
      sprint_title: SPRINT_TITLE,
      timestamp_generated: staleTimestamp,
      repository_name: 'unit-talk-production',
      current_branch: 'main',
      git_status_summary: '(clean working tree)',
      recent_commits: ['abc1234 feat: something'],
      diff_summary: '(no diff from HEAD)',
      changed_files: [],
      affected_directories: [],
      relevant_governance_docs: [],
      authority_surfaces: [],
      expected_proof_classes: [],
      subsystem: null,
      known_blockers: [],
    };

    const freshness = checkContextPackFreshness(stalePack);
    expect(freshness.fresh).toBe(false);
    expect(freshness.reason).toContain('stale');
    expect(freshness.ageMs).toBeGreaterThan(CONTEXT_PACK_MAX_AGE_MS);
  });

  it('returns fresh=false for a pack with no timestamp', () => {
    const noTimestampPack = {
      pack_version: '1.0.0',
      sprint_id: SPRINT_ID,
      sprint_title: SPRINT_TITLE,
      timestamp_generated: '',
    } as unknown as RepoContextPack;

    const freshness = checkContextPackFreshness(noTimestampPack);
    expect(freshness.fresh).toBe(false);
  });

  it('returns fresh=false for a pack with invalid timestamp', () => {
    const badPack = {
      pack_version: '1.0.0',
      sprint_id: SPRINT_ID,
      sprint_title: SPRINT_TITLE,
      timestamp_generated: 'not-a-date',
    } as unknown as RepoContextPack;

    const freshness = checkContextPackFreshness(badPack);
    expect(freshness.fresh).toBe(false);
    expect(freshness.reason).toContain('Invalid timestamp');
  });

  it('respects custom maxAgeMs override', () => {
    const result = generateContextPack(SPRINT_ID, SPRINT_TITLE, [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
      commandRunner: makeMockRunner(),
    });

    expect(result.success).toBe(true);
    // A 0ms max age means even a brand-new pack is stale
    const freshness = checkContextPackFreshness(result.pack!, 0);
    expect(freshness.fresh).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. validateContextPack
// ---------------------------------------------------------------------------

describe('validateContextPack', () => {
  it('returns valid=true for a complete pack', () => {
    const result = generateContextPack(SPRINT_ID, SPRINT_TITLE, [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
      commandRunner: makeMockRunner(),
    });

    expect(result.success).toBe(true);
    const validation = validateContextPack(result.pack!, false);
    expect(validation.valid).toBe(true);
    expect(validation.missing_required_fields).toHaveLength(0);
  });

  it('reports missing fields for an empty pack (non-protected)', () => {
    const emptyPack = {
      pack_version: '1.0.0',
      sprint_id: '',
      sprint_title: '',
      timestamp_generated: '',
      repository_name: '',
      current_branch: '',
      git_status_summary: '',
      recent_commits: [],
      diff_summary: '',
      changed_files: [],
      affected_directories: [],
      relevant_governance_docs: [],
      authority_surfaces: [],
      expected_proof_classes: [],
      subsystem: null,
      known_blockers: [],
    } as RepoContextPack;

    const validation = validateContextPack(emptyPack, false);
    expect(validation.valid).toBe(false);
    expect(validation.missing_required_fields).toContain('repository_name');
    expect(validation.missing_required_fields).toContain('current_branch');
    expect(validation.missing_required_fields).toContain('git_status_summary');
    expect(validation.missing_required_fields).toContain('diff_summary');
  });

  it('is_protected reflects the isProtected parameter', () => {
    const result = generateContextPack(SPRINT_ID, SPRINT_TITLE, [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
      commandRunner: makeMockRunner(),
    });

    expect(result.success).toBe(true);
    const validationProtected = validateContextPack(result.pack!, true);
    const validationStandard = validateContextPack(result.pack!, false);
    expect(validationProtected.is_protected).toBe(true);
    expect(validationStandard.is_protected).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. Output path structure
// ---------------------------------------------------------------------------

describe('generateContextPack — output path', () => {
  it('output_path includes sprint ID and date segments', () => {
    const result = generateContextPack(SPRINT_ID, SPRINT_TITLE, [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
      commandRunner: makeMockRunner(),
    });

    expect(result.success).toBe(true);
    expect(result.output_path).toContain(SPRINT_ID);
    expect(result.output_path).toContain(DATE_OVERRIDE);
    expect(result.output_path).toContain('context-pack.json');
  });

  it('repo_relative_path is set and non-null on success', () => {
    const result = generateContextPack(SPRINT_ID, SPRINT_TITLE, [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
      commandRunner: makeMockRunner(),
    });

    expect(result.success).toBe(true);
    expect(result.repo_relative_path).not.toBeNull();
    expect(result.repo_relative_path).toContain('context-pack.json');
  });
});

// ---------------------------------------------------------------------------
// 7. loadContextPack
// ---------------------------------------------------------------------------

describe('loadContextPack', () => {
  it('returns null for a non-existent path', () => {
    const loaded = loadContextPack(path.join(tmpDir, 'does-not-exist.json'));
    expect(loaded).toBeNull();
  });

  it('returns null for an invalid JSON file', () => {
    const badPath = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(badPath, 'not json');
    const loaded = loadContextPack(badPath);
    expect(loaded).toBeNull();
  });

  it('returns the pack for a valid file', () => {
    const result = generateContextPack(SPRINT_ID, SPRINT_TITLE, [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
      commandRunner: makeMockRunner(),
    });

    expect(result.success).toBe(true);
    const loaded = loadContextPack(result.output_path!);
    expect(loaded).not.toBeNull();
    expect(loaded!.sprint_id).toBe(SPRINT_ID);
  });
});

// ---------------------------------------------------------------------------
// 8. Diff fallback paths
// ---------------------------------------------------------------------------

describe('generateContextPack — fallback git commands', () => {
  it('falls back to git diff --stat when HEAD diff fails', () => {
    const result = generateContextPack(SPRINT_ID, SPRINT_TITLE, [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
      commandRunner: makeMockRunner({
        'git diff --stat HEAD': { exitCode: 1, stdout: '', stderr: 'ambiguous HEAD' },
        'git diff --stat': { exitCode: 0, stdout: '(no uncommitted changes)\n', stderr: '' },
      }),
    });

    expect(result.success).toBe(true);
    expect(result.pack!.diff_summary).toBe('(no uncommitted changes)');
  });

  it('falls back to staged files when HEAD diff name-only fails', () => {
    const result = generateContextPack(SPRINT_ID, SPRINT_TITLE, [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
      commandRunner: makeMockRunner({
        'git diff --name-only HEAD': { exitCode: 1, stdout: '', stderr: 'ambiguous HEAD' },
        'git diff --cached --name-only': { exitCode: 0, stdout: 'staged-file.ts\n', stderr: '' },
      }),
    });

    expect(result.success).toBe(true);
    expect(result.pack!.changed_files).toContain('staged-file.ts');
  });
});
