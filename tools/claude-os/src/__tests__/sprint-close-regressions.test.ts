import { spawnSync } from 'child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { afterEach, describe, expect, it } from 'vitest';

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(THIS_DIR, '..', '..', '..', '..');
const SPRINT_CLOSE_SCRIPT = path.join(REPO_ROOT, 'scripts', 'sprint-close.ts');
const TSX_CLI = path.join(REPO_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const SPRINTS_ROOT = path.join(REPO_ROOT, 'out', 'sprints');

const cleanupPaths: string[] = [];

function trackForCleanup(targetPath: string) {
  cleanupPaths.push(targetPath);
  return targetPath;
}

function writeFile(targetPath: string, contents: string) {
  mkdirSync(path.dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, contents);
}

function createFakeNpm(logPath: string) {
  const binDir = trackForCleanup(mkdtempSync(path.join(os.tmpdir(), 'fake-npm-')));
  const scriptPath = path.join(binDir, 'npm.cmd');
  writeFile(scriptPath, `@echo off\r\necho %*>>"${logPath}"\r\nexit /b 0\r\n`);
  return { binDir, logPath };
}

function createSprintFixture(sprintId: string, proofFiles: string[], date = '2026-03-17') {
  const sprintDir = trackForCleanup(path.join(SPRINTS_ROOT, sprintId));
  const proofsDir = path.join(sprintDir, date, 'proofs');
  mkdirSync(proofsDir, { recursive: true });

  for (const file of proofFiles) {
    writeFile(path.join(proofsDir, file), `${file}\n`);
  }

  return { sprintDir, proofsDir, date };
}

function runSprintClose(args: string[], env: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [TSX_CLI, SPRINT_CLOSE_SCRIPT, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...env,
    },
  });
}

function baseProofs() {
  return [
    'proof_git_status.txt',
    'proof_typecheck.txt',
    'proof_fetch_main.txt',
    'proof_rebase_or_merge_main.txt',
    'proof_tag_exists.txt',
    'proof_git_status_clean.txt',
  ];
}

afterEach(() => {
  while (cleanupPaths.length > 0) {
    const targetPath = cleanupPaths.pop();
    if (targetPath) {
      rmSync(targetPath, { recursive: true, force: true });
    }
  }
});

describe('sprint-close lane selection and artifact requirements', () => {
  it('defaults to full verification with no --lane flag and does not require proof_verify', () => {
    const sprintId = 'SPRINT-CLOSE-REGRESSION-DEFAULT';
    const { date } = createSprintFixture(sprintId, baseProofs());
    const logPath = trackForCleanup(path.join(os.tmpdir(), `fake-npm-${Date.now()}.log`));
    const { binDir } = createFakeNpm(logPath);

    const result = runSprintClose([sprintId, '--date', date], {
      PATH: `${binDir};${process.env.PATH}`,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      'No --lane flag provided. Defaulting to full verification (type-check + test).'
    );
    expect(result.stdout).not.toContain('proof_verify');
    const npmLog = readFileSync(logPath, 'utf8');
    expect(npmLog).toContain('run type-check');
    expect(npmLog).toContain('run test');
  });

  it('runs full verification explicitly and still does not require proof_verify', () => {
    const sprintId = 'SPRINT-CLOSE-REGRESSION-FULL';
    const { date } = createSprintFixture(sprintId, [...baseProofs(), 'proof_verify_lane.txt']);
    const logPath = trackForCleanup(path.join(os.tmpdir(), `fake-npm-${Date.now()}-full.log`));
    const { binDir } = createFakeNpm(logPath);

    const result = runSprintClose([sprintId, '--date', date, '--lane', 'full'], {
      PATH: `${binDir};${process.env.PATH}`,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('RUNNING VERIFICATION LANE: full');
    const npmLog = readFileSync(logPath, 'utf8');
    expect(npmLog).toContain('run type-check');
    expect(npmLog).toContain('run test');
  });

  it('requires proof_verify artifacts for ops-submit lane', () => {
    const sprintId = 'SPRINT-CLOSE-REGRESSION-OPS';
    const { date } = createSprintFixture(sprintId, [...baseProofs(), 'proof_verify_lane.txt']);
    const logPath = trackForCleanup(path.join(os.tmpdir(), `fake-npm-${Date.now()}-ops.log`));
    const { binDir } = createFakeNpm(logPath);

    const result = runSprintClose([sprintId, '--date', date, '--lane', 'ops-submit'], {
      PATH: `${binDir};${process.env.PATH}`,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Scoped lane selected: ops-submit');
    expect(result.stdout).toContain('SPRINT_PLAN.md');
    expect(result.stdout).toContain('proofs/proof_verify_lane.txt');
    const npmLog = readFileSync(logPath, 'utf8');
    expect(npmLog).toContain('run verify:ops-submit');
  });

  it('requires proof_verify artifacts for api lane', () => {
    const sprintId = 'SPRINT-CLOSE-REGRESSION-API';
    const { date } = createSprintFixture(sprintId, [...baseProofs(), 'proof_verify_api.txt']);
    const logPath = trackForCleanup(path.join(os.tmpdir(), `fake-npm-${Date.now()}-api.log`));
    const { binDir } = createFakeNpm(logPath);

    const result = runSprintClose([sprintId, '--date', date, '--lane', 'api'], {
      PATH: `${binDir};${process.env.PATH}`,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Scoped lane selected: api');
    expect(result.stdout).toContain('proofs/proof_verify_api.txt');
    const npmLog = readFileSync(logPath, 'utf8');
    expect(npmLog).toContain('run verify:sprint -- --api');
  });

  it('fails closed for unknown lanes before verification runs', () => {
    const sprintId = 'SPRINT-CLOSE-REGRESSION-UNKNOWN';
    const { date } = createSprintFixture(sprintId, baseProofs());
    const logPath = trackForCleanup(path.join(os.tmpdir(), `fake-npm-${Date.now()}-unknown.log`));
    const { binDir } = createFakeNpm(logPath);

    const result = runSprintClose([sprintId, '--date', date, '--lane', 'mystery'], {
      PATH: `${binDir};${process.env.PATH}`,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('[SPRINT CLOSE] FAIL: Unknown lane "mystery".');
    expect(result.stderr).toContain('Valid lanes: full, ops-submit, api');
    expect(result.stdout).not.toContain('RUNNING VERIFICATION LANE');
    expect(existsSync(logPath)).toBe(false);
  });

  it('fails scoped lanes when proof_verify artifacts are absent', () => {
    const sprintId = 'SPRINT-CLOSE-REGRESSION-SCOPED-MISSING';
    const { date } = createSprintFixture(sprintId, baseProofs());

    const result = runSprintClose([
      sprintId,
      '--date',
      date,
      '--lane',
      'ops-submit',
      '--validate-only',
    ]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('proof_verify*\\.txt');
    expect(result.stderr).toContain('CLOSEOUT FAILED: Missing required artifacts');
  });

  it('does not require proof_verify artifacts for full lane', () => {
    const sprintId = 'SPRINT-CLOSE-REGRESSION-FULL-NO-VERIFY';
    const { date } = createSprintFixture(sprintId, baseProofs());

    const result = runSprintClose([sprintId, '--date', date, '--lane', 'full', '--validate-only']);

    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain('proof_verify');
  });

  it('fails when proof_typecheck artifacts are absent even for full lane', () => {
    const sprintId = 'SPRINT-CLOSE-REGRESSION-NO-TYPECHECK';
    const { date } = createSprintFixture(sprintId, [
      'proof_git_status.txt',
      'proof_fetch_main.txt',
      'proof_rebase_or_merge_main.txt',
      'proof_tag_exists.txt',
      'proof_git_status_clean.txt',
    ]);

    const result = runSprintClose([sprintId, '--date', date, '--lane', 'full', '--validate-only']);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('proof_typecheck*\\.txt');
    expect(result.stderr).toContain('CLOSEOUT FAILED: Missing required artifacts');
  });
});

describe('sprint-close source-level guards', () => {
  it('keeps proof_verify conditional and full as the default lane', () => {
    const source = readFileSync(SPRINT_CLOSE_SCRIPT, 'utf8');

    expect(source).toContain("let lane = 'full';");
    expect(source).toContain('const REQUIRED_PATTERNS_ALWAYS = [/^proof_typecheck.*\\.txt$/];');
    expect(source).toContain('const REQUIRED_PATTERNS_SCOPED = [/^proof_verify.*\\.txt$/];');
    expect(source).not.toContain(
      'const REQUIRED_PATTERNS = [/^proof_typecheck.*\\.txt$/, /^proof_verify.*\\.txt$/];'
    );
  });

  it('has no default case in runVerificationLane switch', () => {
    const source = readFileSync(SPRINT_CLOSE_SCRIPT, 'utf8');
    const switchMatch = source.match(/switch \(lane\) \{([\s\S]*?)\n {4}\}/);

    expect(switchMatch?.[1] || '').not.toContain('default:');
  });
});
