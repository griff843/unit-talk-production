#!/usr/bin/env npx tsx
/**
 * SPRINT FACTORY — scaffold + Huly issue + branch/PR templates
 * Sprint: SPRINT-SFACTORY-V1-015
 *
 * Usage:
 *   pnpm sprint:new SPRINT-EXAMPLE-001
 *   pnpm sprint:new SPRINT-EXAMPLE-001 --objective "Add sprint factory"
 *   pnpm sprint:new SPRINT-EXAMPLE-001 --no-huly   # skip Huly issue creation
 *   pnpm sprint:new SPRINT-EXAMPLE-001 --dry-run   # preview only
 */

/* eslint-disable no-console, security/detect-non-literal-fs-filename */

import * as fs from 'fs';
import * as path from 'path';

const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const SPRINTS_DIR = path.join(WORKSPACE_ROOT, 'out', 'sprints');
const SPRINT_ID_RE = /^SPRINT-[A-Z0-9]+-[A-Z0-9-]*\d{1,4}[A-Z]?$/;

// ── Args ────────────────────────────────────────────────────────────────

interface ParsedArgs {
  sprintId: string;
  objective: string;
  noHuly: boolean;
  dryRun: boolean;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let sprintId = '';
  let objective = '';
  let noHuly = false;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === '--objective' && next) {
      objective = next;
      i++;
    } else if (arg === '--no-huly') {
      noHuly = true;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (!arg.startsWith('--')) {
      sprintId = arg;
    }
  }

  return { sprintId, objective, noHuly, dryRun };
}

function validateSprintId(id: string): void {
  if (!id) {
    console.error('Usage: pnpm sprint:new <SPRINT-ID> [--objective "..."] [--no-huly] [--dry-run]');
    process.exit(1);
  }
  if (!SPRINT_ID_RE.test(id)) {
    console.error(`Invalid sprint ID: ${id}`);
    console.error('Expected pattern: SPRINT-<NAME>-<NNN> (e.g., SPRINT-LIFECYCLE-MIGRATION-038)');
    process.exit(1);
  }
}

// ── Directory Scaffold ──────────────────────────────────────────────────

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function sprintIdToBranch(sprintId: string): string {
  return `sprint/${sprintId.replace(/^SPRINT-/, '').toLowerCase()}`;
}

function scaffoldDirectories(sprintId: string, date: string, dryRun: boolean): string {
  const dateDir = path.join(SPRINTS_DIR, sprintId, date);
  const dirs = [
    path.join(dateDir, 'proofs'),
    path.join(dateDir, 'diffs'),
    path.join(dateDir, 'notes'),
  ];

  for (const dir of dirs) {
    if (dryRun) {
      console.log(`  [dry-run] mkdir -p ${path.relative(WORKSPACE_ROOT, dir)}`);
    } else {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  return dateDir;
}

// ── Sprint Plan Template ────────────────────────────────────────────────

function writePlan(dateDir: string, sprintId: string, objective: string, dryRun: boolean): string {
  const planPath = path.join(dateDir, 'SPRINT_PLAN.md');
  const branch = sprintIdToBranch(sprintId);

  const content = `# Sprint Plan: ${sprintId}

## Objective

${objective || '<!-- TODO: one-line objective -->'}

## Context

- **Branch:** \`${branch}\`
- **Date:** ${todayDate()}
- **Proof dir:** \`out/sprints/${sprintId}/${todayDate()}/\`

## Tasks

1. [ ] <!-- Task 1 -->
2. [ ] <!-- Task 2 -->
3. [ ] <!-- Task 3 -->

## Files to Modify

- \`<!-- path/to/file.ts -->\`

## Verification

- [ ] \`pnpm type-check\`
- [ ] \`pnpm test\`
- [ ] \`pnpm build\`
- [ ] Lifecycle gate (if applicable)
- [ ] Proof bundle generated

## Closeout Checklist

- [ ] All tests passing
- [ ] Gate passing
- [ ] Proofs in \`out/sprints/${sprintId}/${todayDate()}/proofs/\`
- [ ] \`SPRINT_CLOSEOUT_REPORT.md\` written
- [ ] Committed + tagged \`${sprintId}-COMPLETE\`
- [ ] Merged to main
`;

  if (dryRun) {
    console.log(`  [dry-run] write ${path.relative(WORKSPACE_ROOT, planPath)}`);
  } else {
    fs.writeFileSync(planPath, content, 'utf-8');
  }
  return planPath;
}

// ── Huly Integration ────────────────────────────────────────────────────

interface HulyResult {
  issueId: string;
  created: boolean;
}

async function upsertHulySprintIssue(
  sprintId: string,
  objective: string,
  branch: string
): Promise<HulyResult> {
  // Dynamic import to avoid loading Huly deps when --no-huly
  const { resolve } = await import('node:path');
  const { config: loadDotenv } = await import('dotenv');

  // Load .env from tools/huly-os/
  loadDotenv({ path: resolve(WORKSPACE_ROOT, 'tools', 'huly-os', '.env') });

  const { loadConfig } = await import('../tools/huly-os/daemon/config.js');
  const { HulyAdapter } = await import('../tools/huly-os/daemon/adapters/huly-adapter.js');
  const { AuditLogger } = await import('../tools/huly-os/daemon/audit-log.js');

  const config = loadConfig();
  const audit = new AuditLogger();
  const huly = new HulyAdapter(config, audit);

  await huly.connect();

  const title = `[SPRINT] ${sprintId}`;
  const date = todayDate();
  const body = [
    `**Sprint:** ${sprintId}`,
    `**Branch:** \`${branch}\``,
    `**Objective:** ${objective || '_TBD_'}`,
    `**Proof path:** \`out/sprints/${sprintId}/${date}/\``,
    '',
    '## Core Tasks',
    '- [ ] Phase 0: Context — understand scope',
    '- [ ] Phase 1: Plan — document approach',
    '- [ ] Phase 2: Implement — smallest working change',
    '- [ ] Phase 3: Verify — tests + gates',
    '- [ ] Phase 4: Proof — generate artifacts',
    '- [ ] Phase 5: Commit + Tag',
    '- [ ] Phase 6: Closeout + PR',
  ].join('\n');

  const result = await huly.upsertIssueByTitle(config.HULY_PROJECT, title, body);
  return { issueId: result.id, created: result.created };
}

// ── Main ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { sprintId, objective, noHuly, dryRun } = parseArgs();
  validateSprintId(sprintId);

  const date = todayDate();
  const branch = sprintIdToBranch(sprintId);

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  SPRINT FACTORY — New Sprint Scaffold');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log(`  Sprint:    ${sprintId}`);
  console.log(`  Branch:    ${branch}`);
  console.log(`  Date:      ${date}`);
  if (objective) console.log(`  Objective: ${objective}`);
  if (dryRun) console.log('  Mode:      DRY RUN');
  console.log('');

  // 1. Scaffold directories
  console.log('── Step 1: Scaffold directories ──');
  const dateDir = scaffoldDirectories(sprintId, date, dryRun);
  console.log(
    `  ${dryRun ? '[preview]' : '[created]'} out/sprints/${sprintId}/${date}/{proofs,diffs,notes}`
  );
  console.log('');

  // 2. Write sprint plan
  console.log('── Step 2: Write SPRINT_PLAN.md ──');
  const planPath = writePlan(dateDir, sprintId, objective, dryRun);
  console.log(`  ${dryRun ? '[preview]' : '[created]'} ${path.relative(WORKSPACE_ROOT, planPath)}`);
  console.log('');

  // 3. Huly issue
  let hulyResult: HulyResult | null = null;
  if (!noHuly && !dryRun) {
    console.log('── Step 3: Upsert Huly [SPRINT] issue ──');
    try {
      hulyResult = await upsertHulySprintIssue(sprintId, objective, branch);
      console.log(`  [${hulyResult.created ? 'created' : 'updated'}] ${hulyResult.issueId}`);
    } catch (err) {
      console.warn(`  [warn] Huly upsert failed: ${(err as Error).message}`);
      console.warn('  Continuing without Huly issue. Use --no-huly to suppress.');
    }
    console.log('');
  } else if (noHuly) {
    console.log('── Step 3: Huly issue (skipped via --no-huly) ──');
    console.log('');
  } else if (dryRun) {
    console.log('── Step 3: Huly issue (skipped in dry-run) ──');
    console.log('');
  }

  // 4. Output templates
  console.log('── Templates ──────────────────────────────────────');
  console.log('');
  console.log('  Branch:');
  console.log(`    git checkout -b ${branch}`);
  console.log('');
  console.log('  PR Title:');
  console.log(
    `    feat: ${sprintId
      .replace(/^SPRINT-/, '')
      .toLowerCase()
      .replace(/-(\d+)$/, ' #$1')
      .replace(/-/g, ' ')} [${sprintId}]`
  );
  console.log('');
  console.log('  Commit:');
  console.log(`    git commit -m "feat: <description> [${sprintId}]"`);
  console.log('');
  console.log('  Tag (on closeout):');
  console.log(`    git tag ${sprintId}-COMPLETE`);
  console.log('');

  // Summary
  console.log('═══════════════════════════════════════════════════');
  if (dryRun) {
    console.log('  DRY RUN — no files written. Remove --dry-run to execute.');
  } else {
    console.log('  Sprint scaffolded. Next: fill in SPRINT_PLAN.md and start Phase 1.');
  }
  console.log('═══════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('FATAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
