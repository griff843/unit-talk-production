/**
 * Tests for Prompt Pack Generator.
 *
 * Covers:
 *   1. All 4 prompt files are generated at correct paths
 *   2. Prompt paths are stored in sprint state
 *   3. Required governed sections (PROMPT_STANDARDIZATION_SPEC.md 9-section structure) present
 *   4. Prompts differ by role in meaningful ways
 *   5. Protected-surface prompts include elevated constraints
 *   6. Non-protected prompts do not include elevated section
 *   7. Review/resume correctly reports prompt pack status (file existence)
 *   8. Governance docs embedded in GPT audit prompt
 *   9. Context pack repo truth embedded in relevant prompts
 *  10. Error handling — bad output dir propagates as error
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { generatePromptPack } from '../prompt-pack-generator.js';
import { createSprintState } from '../sprint-state.js';

import type {
  AuthoritySurface,
  GovernanceDocRef,
  RepoContextPack,
  ReceiptClass,
} from '../types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-os-prompt-pack-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const SPRINT_ID = 'SPRINT-PROMPT-TEST-001';
const SPRINT_TITLE = 'Test Prompt Pack Sprint';
const DATE_OVERRIDE = '2026-03-13';

const SAMPLE_GOVERNANCE_DOCS: GovernanceDocRef[] = [
  { path: 'governance/ai-orchestration/LLM_AUTHORITY_MAP.md', exists: true },
  { path: 'governance/ai-orchestration/PROOF_RECEIPT_STANDARD.md', exists: true },
  { path: 'governance/ai-orchestration/STATUS_RUBRIC.md', exists: false },
];

const SAMPLE_CONTEXT_PACK: RepoContextPack = {
  pack_version: '1.0.0',
  sprint_id: SPRINT_ID,
  sprint_title: SPRINT_TITLE,
  timestamp_generated: new Date().toISOString(),
  repository_name: 'unit-talk-production',
  current_branch: 'main',
  git_status_summary: 'M  tools/claude-os/src/test.ts',
  recent_commits: ['abc1234 feat: add test'],
  diff_summary: 'tools/claude-os/src/test.ts | 5 ++---',
  changed_files: ['tools/claude-os/src/test.ts', 'tools/claude-os/src/types.ts'],
  affected_directories: ['tools/claude-os/src'],
  relevant_governance_docs: SAMPLE_GOVERNANCE_DOCS,
  authority_surfaces: [],
  expected_proof_classes: ['repo', 'build', 'test'],
  subsystem: null,
  known_blockers: [],
};

// ---------------------------------------------------------------------------
// 1. Successful generation — all 4 files created
// ---------------------------------------------------------------------------

describe('generatePromptPack — successful generation', () => {
  it('returns success=true with 4 generated files', () => {
    const result = generatePromptPack(SPRINT_ID, SPRINT_TITLE, [], ['repo', 'build', 'test'], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });

    expect(result.success).toBe(true);
    expect(result.generated_files).toHaveLength(4);
    expect(result.errors).toHaveLength(0);
  });

  it('generates files for all 4 roles', () => {
    const result = generatePromptPack(SPRINT_ID, SPRINT_TITLE, [], [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });

    expect(result.success).toBe(true);
    const roles = result.generated_files.map(f => f.role);
    expect(roles).toContain('claude');
    expect(roles).toContain('codex');
    expect(roles).toContain('gpt');
    expect(roles).toContain('gemini');
  });

  it('files are written with correct filenames', () => {
    const result = generatePromptPack(SPRINT_ID, SPRINT_TITLE, [], [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });

    expect(result.success).toBe(true);
    const filenames = result.generated_files.map(f => f.filename);
    expect(filenames).toContain('claude-implementation.md');
    expect(filenames).toContain('codex-support.md');
    expect(filenames).toContain('gpt-audit.md');
    expect(filenames).toContain('gemini-synthesis.md');
  });

  it('files exist on disk at the reported paths', () => {
    const result = generatePromptPack(SPRINT_ID, SPRINT_TITLE, [], [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });

    expect(result.success).toBe(true);
    for (const file of result.generated_files) {
      expect(fs.existsSync(file.abs_path), `${file.filename} should exist`).toBe(true);
    }
  });

  it('output_dir contains sprint ID and date', () => {
    const result = generatePromptPack(SPRINT_ID, SPRINT_TITLE, [], [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });

    expect(result.success).toBe(true);
    expect(result.output_dir).toContain(SPRINT_ID);
    expect(result.output_dir).toContain(DATE_OVERRIDE);
  });

  it('repo_relative_dir is non-null on success', () => {
    const result = generatePromptPack(SPRINT_ID, SPRINT_TITLE, [], [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });

    expect(result.success).toBe(true);
    expect(result.repo_relative_dir).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Sprint state stores prompt paths
// ---------------------------------------------------------------------------

describe('sprint state — prompt_pack_paths', () => {
  it('createSprintState initializes prompt_pack_paths as empty array', () => {
    const state = createSprintState({
      sprint_id: SPRINT_ID,
      title: SPRINT_TITLE,
      authority_surfaces: [],
      primary_owner: 'test_runner',
    });
    expect(state.prompt_pack_paths).toEqual([]);
  });

  it('prompt_pack_paths can be populated from generation result', () => {
    const state = createSprintState({
      sprint_id: SPRINT_ID,
      title: SPRINT_TITLE,
      authority_surfaces: [],
      primary_owner: 'test_runner',
    });

    const result = generatePromptPack(SPRINT_ID, SPRINT_TITLE, [], [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });

    expect(result.success).toBe(true);
    state.prompt_pack_paths = result.generated_files.map(f => f.repo_relative_path);
    expect(state.prompt_pack_paths).toHaveLength(4);
    const knownFilenames = [
      'claude-implementation.md',
      'codex-support.md',
      'gpt-audit.md',
      'gemini-synthesis.md',
    ];
    for (const pp of state.prompt_pack_paths) {
      expect(knownFilenames.some(fn => pp.endsWith(fn))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Required governed sections present
// ---------------------------------------------------------------------------

describe('generatePromptPack — required sections (PROMPT_STANDARDIZATION_SPEC.md)', () => {
  const REQUIRED_SECTION_HEADERS = [
    '## 1. Role',
    '## 2. Objective',
    '## 3. Scope',
    '## 4. Authority Surfaces',
    '## 5. Constraints',
    '## 6. Required Outputs',
    '## 7. Verification Criteria',
    '## 8. Stop Conditions',
    '## 9. Artifact Expectations',
  ];

  function readPromptFile(role: string, result: ReturnType<typeof generatePromptPack>): string {
    const file = result.generated_files.find(f => f.role === role);
    if (!file) throw new Error(`No file for role ${role}`);
    return fs.readFileSync(file.abs_path, 'utf-8');
  }

  it('claude prompt contains all 9 required sections', () => {
    const result = generatePromptPack(SPRINT_ID, SPRINT_TITLE, [], [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });
    expect(result.success).toBe(true);
    const content = readPromptFile('claude', result);
    for (const header of REQUIRED_SECTION_HEADERS) {
      expect(content, `claude prompt should contain "${header}"`).toContain(header);
    }
  });

  it('codex prompt contains all 9 required sections', () => {
    const result = generatePromptPack(SPRINT_ID, SPRINT_TITLE, [], [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });
    expect(result.success).toBe(true);
    const content = readPromptFile('codex', result);
    for (const header of REQUIRED_SECTION_HEADERS) {
      expect(content, `codex prompt should contain "${header}"`).toContain(header);
    }
  });

  it('gpt prompt contains all 9 required sections', () => {
    const result = generatePromptPack(SPRINT_ID, SPRINT_TITLE, [], [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });
    expect(result.success).toBe(true);
    const content = readPromptFile('gpt', result);
    for (const header of REQUIRED_SECTION_HEADERS) {
      expect(content, `gpt prompt should contain "${header}"`).toContain(header);
    }
  });

  it('gemini prompt contains all 9 required sections', () => {
    const result = generatePromptPack(SPRINT_ID, SPRINT_TITLE, [], [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });
    expect(result.success).toBe(true);
    const content = readPromptFile('gemini', result);
    for (const header of REQUIRED_SECTION_HEADERS) {
      expect(content, `gemini prompt should contain "${header}"`).toContain(header);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Role differentiation
// ---------------------------------------------------------------------------

describe('generatePromptPack — role differentiation', () => {
  function readPromptFile(role: string, result: ReturnType<typeof generatePromptPack>): string {
    const file = result.generated_files.find(f => f.role === role);
    if (!file) throw new Error(`No file for role ${role}`);
    return fs.readFileSync(file.abs_path, 'utf-8');
  }

  it('claude prompt contains "no speculative refactors" constraint', () => {
    const result = generatePromptPack(SPRINT_ID, SPRINT_TITLE, [], [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });
    expect(result.success).toBe(true);
    const content = readPromptFile('claude', result);
    expect(content.toLowerCase()).toContain('no speculative refactor');
  });

  it('codex prompt contains "bounded support" language', () => {
    const result = generatePromptPack(SPRINT_ID, SPRINT_TITLE, [], [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });
    expect(result.success).toBe(true);
    const content = readPromptFile('codex', result);
    expect(content.toLowerCase()).toContain('bounded support');
  });

  it('gpt prompt contains "evidence" review language', () => {
    const result = generatePromptPack(SPRINT_ID, SPRINT_TITLE, [], [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });
    expect(result.success).toBe(true);
    const content = readPromptFile('gpt', result);
    expect(content.toLowerCase()).toContain('evidence');
    expect(content).toContain('compliance');
  });

  it('gemini prompt contains "synthesis only" language', () => {
    const result = generatePromptPack(SPRINT_ID, SPRINT_TITLE, [], [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });
    expect(result.success).toBe(true);
    const content = readPromptFile('gemini', result);
    expect(content.toLowerCase()).toContain('synthesis');
    expect(content.toLowerCase()).toContain('no authoritative repo-state claims');
  });

  it('all 4 role headers reference the sprint ID', () => {
    const result = generatePromptPack(SPRINT_ID, SPRINT_TITLE, [], [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });
    expect(result.success).toBe(true);
    for (const file of result.generated_files) {
      const content = fs.readFileSync(file.abs_path, 'utf-8');
      expect(content, `${file.role} prompt should contain sprint ID`).toContain(SPRINT_ID);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Protected-surface elevated constraints
// ---------------------------------------------------------------------------

describe('generatePromptPack — protected-surface elevated constraints', () => {
  const PROTECTED_SURFACES: AuthoritySurface[] = ['scoring_authority', 'promotion_authority'];

  function readPromptFile(role: string, result: ReturnType<typeof generatePromptPack>): string {
    const file = result.generated_files.find(f => f.role === role);
    if (!file) throw new Error(`No file for role ${role}`);
    return fs.readFileSync(file.abs_path, 'utf-8');
  }

  it('all 4 prompts include elevated constraints section when surfaces are protected', () => {
    const result = generatePromptPack(SPRINT_ID, SPRINT_TITLE, PROTECTED_SURFACES, [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });
    expect(result.success).toBe(true);
    for (const file of result.generated_files) {
      const content = fs.readFileSync(file.abs_path, 'utf-8');
      expect(content, `${file.role} prompt should have elevated constraints`).toContain(
        '⚠️ Protected Surface Constraints'
      );
    }
  });

  it('protected prompts include surface names', () => {
    const result = generatePromptPack(SPRINT_ID, SPRINT_TITLE, PROTECTED_SURFACES, [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });
    expect(result.success).toBe(true);
    const claudeContent = readPromptFile('claude', result);
    expect(claudeContent).toContain('scoring_authority');
    expect(claudeContent).toContain('promotion_authority');
  });

  it('protected prompts include "fail-closed" language in elevated section', () => {
    const result = generatePromptPack(SPRINT_ID, SPRINT_TITLE, PROTECTED_SURFACES, [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });
    expect(result.success).toBe(true);
    for (const file of result.generated_files) {
      const content = fs.readFileSync(file.abs_path, 'utf-8');
      expect(content.toLowerCase(), `${file.role} prompt should mention fail-closed`).toContain(
        'fail-closed'
      );
    }
  });

  it('protected prompts reference Authority Freeze Rule', () => {
    const result = generatePromptPack(SPRINT_ID, SPRINT_TITLE, PROTECTED_SURFACES, [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });
    expect(result.success).toBe(true);
    const claudeContent = readPromptFile('claude', result);
    expect(claudeContent).toContain('Authority Freeze Rule');
  });
});

// ---------------------------------------------------------------------------
// 6. Non-protected prompts do not include elevated section
// ---------------------------------------------------------------------------

describe('generatePromptPack — non-protected sprint', () => {
  it('does not include elevated constraints section when no surfaces', () => {
    const result = generatePromptPack(SPRINT_ID, SPRINT_TITLE, [], [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });
    expect(result.success).toBe(true);
    for (const file of result.generated_files) {
      const content = fs.readFileSync(file.abs_path, 'utf-8');
      expect(content).not.toContain('⚠️ Protected Surface Constraints');
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Review/resume prompt status (fileExists check)
// ---------------------------------------------------------------------------

describe('review/resume — prompt pack file existence', () => {
  it('generated files are detected as existing', () => {
    const result = generatePromptPack(SPRINT_ID, SPRINT_TITLE, [], [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });
    expect(result.success).toBe(true);
    for (const file of result.generated_files) {
      expect(fs.existsSync(file.abs_path)).toBe(true);
    }
  });

  it('non-existent file paths are detected as missing', () => {
    const missingPath = path.join(tmpDir, 'does-not-exist', 'claude-implementation.md');
    expect(fs.existsSync(missingPath)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 8. Governance docs embedded in GPT audit prompt
// ---------------------------------------------------------------------------

describe('generatePromptPack — governance docs in GPT prompt', () => {
  it('existing governance docs appear in GPT prompt', () => {
    const result = generatePromptPack(SPRINT_ID, SPRINT_TITLE, [], [], SAMPLE_GOVERNANCE_DOCS, {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });
    expect(result.success).toBe(true);
    const gptFile = result.generated_files.find(f => f.role === 'gpt')!;
    const content = fs.readFileSync(gptFile.abs_path, 'utf-8');
    // Existing docs should appear
    expect(content).toContain('LLM_AUTHORITY_MAP.md');
    expect(content).toContain('PROOF_RECEIPT_STANDARD.md');
  });

  it('non-existing governance docs are NOT included in GPT prompt', () => {
    const result = generatePromptPack(SPRINT_ID, SPRINT_TITLE, [], [], SAMPLE_GOVERNANCE_DOCS, {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });
    expect(result.success).toBe(true);
    const gptFile = result.generated_files.find(f => f.role === 'gpt')!;
    const content = fs.readFileSync(gptFile.abs_path, 'utf-8');
    // STATUS_RUBRIC.md has exists=false — should not appear in Governance Reference Documents section
    // (It may still appear in other sections from hardcoded text, so we test specifically in the governance section)
    const govSection = content.split('## Governance Reference Documents')[1] ?? '';
    expect(govSection).not.toContain('STATUS_RUBRIC.md');
  });
});

// ---------------------------------------------------------------------------
// 9. Context pack repo truth embedded in prompts
// ---------------------------------------------------------------------------

describe('generatePromptPack — context pack repo truth', () => {
  it('claude prompt includes branch from context pack', () => {
    const result = generatePromptPack(SPRINT_ID, SPRINT_TITLE, [], [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
      contextPack: SAMPLE_CONTEXT_PACK,
    });
    expect(result.success).toBe(true);
    const claudeFile = result.generated_files.find(f => f.role === 'claude')!;
    const content = fs.readFileSync(claudeFile.abs_path, 'utf-8');
    expect(content).toContain('main'); // current_branch
  });

  it('claude prompt includes changed files from context pack', () => {
    const result = generatePromptPack(SPRINT_ID, SPRINT_TITLE, [], [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
      contextPack: SAMPLE_CONTEXT_PACK,
    });
    expect(result.success).toBe(true);
    const claudeFile = result.generated_files.find(f => f.role === 'claude')!;
    const content = fs.readFileSync(claudeFile.abs_path, 'utf-8');
    expect(content).toContain('tools/claude-os/src/test.ts');
  });
});

// ---------------------------------------------------------------------------
// 10. Error handling
// ---------------------------------------------------------------------------

describe('generatePromptPack — error handling', () => {
  it('fails gracefully when output directory cannot be created (file in the way)', () => {
    // Create a FILE at the path where the directory should be
    const blockingFile = path.join(tmpDir, SPRINT_ID);
    fs.writeFileSync(blockingFile, 'blocking');

    const result = generatePromptPack(SPRINT_ID, SPRINT_TITLE, [], [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });

    // Should fail because ensureDir can't create a dir over a file
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.generated_files).toHaveLength(0);
  });

  it('returns output_dir=null on failure', () => {
    const blockingFile = path.join(tmpDir, SPRINT_ID);
    fs.writeFileSync(blockingFile, 'blocking');

    const result = generatePromptPack(SPRINT_ID, SPRINT_TITLE, [], [], [], {
      outputRoot: tmpDir,
      dateOverride: DATE_OVERRIDE,
    });

    expect(result.success).toBe(false);
    expect(result.output_dir).toBeNull();
    expect(result.repo_relative_dir).toBeNull();
  });
});
