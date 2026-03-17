import { spawnSync } from 'child_process';
import { mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { afterEach, describe, expect, it } from 'vitest';

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(THIS_DIR, '..', '..', '..', '..');
const SPRINT_GATE_SCRIPT = path.join(REPO_ROOT, 'tools', 'governance', 'sprint-gate.js');
const PRE_SPRINT_CHECK_SCRIPT = path.join(REPO_ROOT, 'scripts', 'pre-sprint-check.mjs');
const SESSION_BASELINE_CHECK_SCRIPT = path.join(REPO_ROOT, 'scripts', 'check-session-baseline.mjs');
const tempDirs: string[] = [];

function makeWorkspace() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'governance-cli-'));
  tempDirs.push(dir);
  return dir;
}

function writeFile(root: string, relativePath: string, contents: string) {
  const fullPath = path.join(root, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, contents);
}

function createBaseline(
  root: string,
  name: string,
  options: {
    timestamp?: string;
    fileMode?: 'complete' | 'missing' | 'invalid_json' | 'missing_timestamp';
    mtime?: Date;
    typescriptErrors?: number;
    eslintErrors?: number;
    eslintWarnings?: number;
    hasDrift?: boolean;
    gitClean?: boolean;
  } = {}
) {
  const baselineDir = path.join(root, 'out', 'session-baseline', name);
  mkdirSync(baselineDir, { recursive: true });

  const {
    timestamp = '2026-03-17T19:00:00.000Z',
    fileMode = 'complete',
    mtime = new Date(timestamp),
    typescriptErrors = 0,
    eslintErrors = 0,
    eslintWarnings = 0,
    hasDrift = false,
    gitClean = true,
  } = options;

  if (fileMode === 'complete') {
    writeFileSync(
      path.join(baselineDir, 'baseline.json'),
      JSON.stringify(
        {
          timestamp,
          typescript: { totalErrors: typescriptErrors },
          eslint: {
            summary: {
              totalErrors: eslintErrors,
              totalWarnings: eslintWarnings,
            },
          },
          supabase: {
            drift: { hasDrift },
            hash: { hash: 'abc123' },
          },
          git: {
            clean: gitClean,
            status: {
              staged: 0,
              modified: gitClean ? 0 : 1,
            },
          },
        },
        null,
        2
      )
    );
  } else if (fileMode === 'invalid_json') {
    writeFileSync(path.join(baselineDir, 'baseline.json'), '{invalid');
  } else if (fileMode === 'missing_timestamp') {
    writeFileSync(
      path.join(baselineDir, 'baseline.json'),
      JSON.stringify({ typescript: { totalErrors: typescriptErrors } }, null, 2)
    );
  }

  utimesSync(baselineDir, mtime, mtime);
}

function runCli(scriptPath: string, cwd: string, args: string[] = []) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    encoding: 'utf8',
  });
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('sprint-gate regressions', () => {
  it('returns a vacancy notice for a vacant queue with no requested sprint', () => {
    const workspace = makeWorkspace();
    writeFile(
      workspace,
      'docs/status/NEXT_5_SPRINTS.md',
      '# Next 5 Sprints\n\n> **Sprint 1 slot is vacant.** Run /sprint-plan.\n'
    );

    const result = runCli(SPRINT_GATE_SCRIPT, workspace);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[SPRINT GATE] QUEUE VACANT');
    expect(result.stdout).toContain('Sprint 1 slot is not locked.');
    expect(result.stdout).toContain('Format: ## Sprint 1: SPRINT-<NAME>');
  });

  it('fails requested sprint validation when the queue is vacant', () => {
    const workspace = makeWorkspace();
    writeFile(workspace, 'docs/status/NEXT_5_SPRINTS.md', '# Next 5 Sprints\n\n| 1 | TBD |\n');

    const result = runCli(SPRINT_GATE_SCRIPT, workspace, [
      'SPRINT-083-CLAUDE-OS-QUEUE-AND-BASELINE-HARDENING',
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Sprint 1 slot is vacant');
    expect(result.stderr).toContain(
      'Cannot validate "SPRINT-083-CLAUDE-OS-QUEUE-AND-BASELINE-HARDENING"'
    );
  });

  it('fails closed when NEXT_5_SPRINTS.md is missing', () => {
    const workspace = makeWorkspace();

    const result = runCli(SPRINT_GATE_SCRIPT, workspace);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('docs/status/NEXT_5_SPRINTS.md is missing.');
    expect(result.stderr).toContain('Format: ## Sprint 1: SPRINT-<NAME>');
  });

  it('reads only the locked sprint from NEXT_5_SPRINTS.md', () => {
    const workspace = makeWorkspace();
    writeFile(
      workspace,
      'docs/status/NEXT_5_SPRINTS.md',
      '# Next 5 Sprints\n\n## Sprint 1: SPRINT-083-CLAUDE-OS-QUEUE-AND-BASELINE-HARDENING\n'
    );
    writeFile(
      workspace,
      'docs/roadmap/INTELLIGENCE_PIPELINE_SPRINT_ORDER.md',
      '## Next Sprint (LOCKED)\n\n### SPRINT-042\n'
    );

    const result = runCli(SPRINT_GATE_SCRIPT, workspace, [
      'SPRINT-083-CLAUDE-OS-QUEUE-AND-BASELINE-HARDENING',
    ]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('matches locked next sprint');
    expect(result.stdout).not.toContain('SPRINT-042');
    expect(result.stderr).not.toContain('SPRINT-042');
  });

  it('fails with the correct locked sprint when the requested sprint is wrong', () => {
    const workspace = makeWorkspace();
    writeFile(
      workspace,
      'docs/status/NEXT_5_SPRINTS.md',
      '# Next 5 Sprints\n\n## Sprint 1: SPRINT-083-CLAUDE-OS-QUEUE-AND-BASELINE-HARDENING\n'
    );

    const result = runCli(SPRINT_GATE_SCRIPT, workspace, ['SPRINT-084-SOMETHING-ELSE']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Allowed next sprint: "SPRINT-083-CLAUDE-OS-QUEUE-AND-BASELINE-HARDENING"'
    );
  });
});

describe('pre-sprint-check regressions', () => {
  it('uses the newest valid completed baseline when the newest folder is incomplete', () => {
    const workspace = makeWorkspace();
    createBaseline(workspace, 'latest-incomplete', {
      fileMode: 'missing',
      mtime: minutesAgo(1),
    });
    createBaseline(workspace, 'latest-complete', {
      timestamp: minutesAgo(5).toISOString(),
      mtime: minutesAgo(5),
    });

    const result = runCli(PRE_SPRINT_CHECK_SCRIPT, workspace);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('PRE-SPRINT CHECK PASSED');
    expect(result.stdout).toContain(path.join('out', 'session-baseline', 'latest-complete'));
  });

  it('fails with no baseline found when every candidate is incomplete', () => {
    const workspace = makeWorkspace();
    createBaseline(workspace, 'latest-incomplete', {
      fileMode: 'missing',
      mtime: minutesAgo(1),
    });
    createBaseline(workspace, 'older-invalid', {
      fileMode: 'invalid_json',
      mtime: minutesAgo(2),
    });

    const result = runCli(PRE_SPRINT_CHECK_SCRIPT, workspace);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('No baseline found!');
  });

  it('fails when the newest valid completed baseline is stale', () => {
    const workspace = makeWorkspace();
    createBaseline(workspace, 'latest-incomplete', {
      fileMode: 'missing',
      mtime: minutesAgo(1),
    });
    createBaseline(workspace, 'older-stale', {
      timestamp: minutesAgo(20).toISOString(),
      mtime: minutesAgo(20),
    });

    const result = runCli(PRE_SPRINT_CHECK_SCRIPT, workspace);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Baseline is');
    expect(result.stdout).toContain('minutes old');
  });
});

describe('session baseline freshness hook regressions', () => {
  it('stays quiet when the newest valid baseline is fresh and the newest folder is incomplete', () => {
    const workspace = makeWorkspace();
    createBaseline(workspace, 'latest-incomplete', {
      fileMode: 'missing',
      mtime: minutesAgo(1),
    });
    createBaseline(workspace, 'latest-complete', {
      timestamp: minutesAgo(5).toISOString(),
      mtime: minutesAgo(5),
    });

    const result = runCli(SESSION_BASELINE_CHECK_SCRIPT, workspace);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('warns when the newest valid baseline is stale even if a newer folder is incomplete', () => {
    const workspace = makeWorkspace();
    createBaseline(workspace, 'latest-incomplete', {
      fileMode: 'missing',
      mtime: minutesAgo(1),
    });
    createBaseline(workspace, 'older-stale', {
      timestamp: minutesAgo(45).toISOString(),
      mtime: minutesAgo(45),
    });

    const result = runCli(SESSION_BASELINE_CHECK_SCRIPT, workspace);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('SESSION BASELINE STALE');
    expect(result.stdout).toContain('Last run: older-stale');
  });
});
