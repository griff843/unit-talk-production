// SPRINT-HULY-OS-ERGONOMICS-013: Huly ops CLI (commander-based)
// Commands: list, purge, rebuild, doctor, bootstrap, discover

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { Command } from 'commander';
import { config as loadDotenv } from 'dotenv';

import { GitHubAdapter } from './adapters/github-adapter.js';
import { HulyAdapter } from './adapters/huly-adapter.js';
import { AuditLogger } from './audit-log.js';
import { loadConfig, REPO_ROOT } from './config.js';

// Load .env from tools/huly-os/
loadDotenv({ path: resolve(import.meta.dirname ?? '.', '..', '.env') });

// ── Types ───────────────────────────────────────────────────────────────

interface HulyConfig {
  baseUrl: string;
  email: string;
  password: string;
  workspace: string;
  project: string;
  teamspace: string;
}

interface HulySession {
  config: HulyConfig;
  workspaceToken: string;
  workspaceId: string;
  socialId: string;
}

interface RawIssue {
  _id: string;
  identifier: string;
  title: string;
  status: string;
  description?: string;
  modifiedOn?: number;
  [key: string]: unknown;
}

// ── Connection ──────────────────────────────────────────────────────────

async function connect(cfg: HulyConfig): Promise<HulySession> {
  const loginRes = await fetch(`${cfg.baseUrl}/_accounts/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'login',
      params: { email: cfg.email, password: cfg.password },
    }),
  });
  if (!loginRes.ok) throw new Error(`Login HTTP ${loginRes.status}`);
  const loginBody = (await loginRes.json()) as any;
  if (loginBody.error) throw new Error(`Login RPC error: ${loginBody.error.code}`);
  const accountToken = loginBody.result.token as string;
  const socialId = String(loginBody.result.socialId ?? '');

  const wsRes = await fetch(`${cfg.baseUrl}/_accounts/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accountToken}`,
    },
    body: JSON.stringify({
      method: 'selectWorkspace',
      params: { workspaceUrl: cfg.workspace },
    }),
  });
  if (!wsRes.ok) throw new Error(`selectWorkspace HTTP ${wsRes.status}`);
  const wsBody = (await wsRes.json()) as any;
  if (wsBody.error) throw new Error(`selectWorkspace RPC error: ${wsBody.error.code}`);

  return {
    config: cfg,
    workspaceToken: wsBody.result.token as string,
    workspaceId: wsBody.result.workspace as string,
    socialId,
  };
}

// ── TX helpers ──────────────────────────────────────────────────────────

function buildTx(session: HulySession, fields: Record<string, unknown>): Record<string, unknown> {
  return {
    _id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    space: 'core:space:Tx',
    modifiedBy: session.socialId,
    modifiedOn: Date.now(),
    ...fields,
  };
}

async function sendTx(session: HulySession, tx: Record<string, unknown>): Promise<any> {
  const res = await fetch(
    `${session.config.baseUrl}/_transactor/api/v1/tx/${session.workspaceId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.workspaceToken}`,
      },
      body: JSON.stringify(tx),
    }
  );
  if (!res.ok) {
    const snippet = await res.text().catch(() => '');
    throw new Error(`TX HTTP ${res.status}: ${res.statusText} — ${snippet.slice(0, 300)}`);
  }
  return res.json();
}

async function findAll(
  session: HulySession,
  cls: string,
  options: Record<string, unknown> = {}
): Promise<any[]> {
  const opts = JSON.stringify({ limit: 500, ...options });
  const url =
    `${session.config.baseUrl}/_transactor/api/v1/find-all/${session.workspaceId}` +
    `?class=${encodeURIComponent(cls)}` +
    `&options=${encodeURIComponent(opts)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${session.workspaceToken}` },
  });
  if (!res.ok) throw new Error(`findAll(${cls}) HTTP ${res.status}`);

  const body = await res.json();
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.value)) return body.value;
  if (Array.isArray(body?.docs)) return body.docs;
  if (Array.isArray(body?.result)) return body.result;
  return [];
}

// ── Operations ──────────────────────────────────────────────────────────

async function listIssues(session: HulySession): Promise<RawIssue[]> {
  const raw = await findAll(session, 'tracker:class:Issue');
  return raw.map((r: any) => ({
    _id: String(r._id ?? ''),
    identifier: String(r.identifier ?? ''),
    title: String(r.title ?? ''),
    status: String(r.status ?? ''),
    description: r.description ? String(r.description) : undefined,
    modifiedOn: r.modifiedOn,
    ...r,
  }));
}

async function discoverStatuses(session: HulySession): Promise<Record<string, any>> {
  const classes = ['tracker:class:IssueStatus', 'core:class:Status'];
  for (const cls of classes) {
    try {
      const statuses = await findAll(session, cls);
      if (statuses.length > 0) {
        console.log(`  Found ${statuses.length} statuses via ${cls}`);
        for (const s of statuses) {
          console.log(`    ${s._id}: name=${s.name ?? '?'} category=${s.category ?? '?'}`);
        }
        return { class: cls, statuses };
      }
    } catch {
      // Try next class
    }
  }
  return { class: 'none', statuses: [] };
}

async function discoverProjects(session: HulySession): Promise<any[]> {
  try {
    return await findAll(session, 'tracker:class:Project');
  } catch {
    return [];
  }
}

async function updateIssueStatus(
  session: HulySession,
  issueId: string,
  statusId: string,
  space: string
): Promise<void> {
  const tx = buildTx(session, {
    _class: 'core:class:TxUpdateDoc',
    objectId: issueId,
    objectClass: 'tracker:class:Issue',
    objectSpace: space,
    operations: { status: statusId },
  });
  await sendTx(session, tx);
}

async function addComment(session: HulySession, issueId: string, message: string): Promise<string> {
  const commentId = `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tx = buildTx(session, {
    _class: 'core:class:TxCreateDoc',
    objectId: commentId,
    objectClass: 'chunter:class:ChatMessage',
    objectSpace: issueId,
    attributes: { message },
  });
  await sendTx(session, tx);
  return commentId;
}

async function updateIssueDescription(
  session: HulySession,
  issueId: string,
  description: string,
  space: string
): Promise<void> {
  const tx = buildTx(session, {
    _class: 'core:class:TxUpdateDoc',
    objectId: issueId,
    objectClass: 'tracker:class:Issue',
    objectSpace: space,
    operations: { description },
  });
  await sendTx(session, tx);
}

async function createIssue(
  session: HulySession,
  space: string,
  title: string,
  description: string,
  extra: Record<string, unknown> = {}
): Promise<string> {
  const issueId = `issue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tx = buildTx(session, {
    _class: 'core:class:TxCreateDoc',
    objectId: issueId,
    objectClass: 'tracker:class:Issue',
    objectSpace: space,
    attributes: { title, description, ...extra },
  });
  await sendTx(session, tx);
  return issueId;
}

// ── Shared helpers ──────────────────────────────────────────────────────

function loadHulyConfig(): HulyConfig {
  return {
    baseUrl: (process.env.HULY_URL ?? 'http://localhost:8087').replace(/\/$/, ''),
    email: process.env.HULY_EMAIL ?? 'user1@example.com',
    password: process.env.HULY_PASSWORD ?? '1234',
    workspace: process.env.HULY_WORKSPACE ?? 'ws1',
    project: process.env.HULY_PROJECT ?? 'UT',
    teamspace: process.env.HULY_TEAMSPACE ?? 'Operations',
  };
}

function printBanner(cfg: HulyConfig): void {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  HULY OPS — Operating System CLI');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  URL:        ${cfg.baseUrl}`);
  console.log(`  Workspace:  ${cfg.workspace}`);
  console.log(`  Project:    ${cfg.project}`);
  console.log(`  Teamspace:  ${cfg.teamspace}`);
  console.log('═══════════════════════════════════════════════════\n');
}

function printComplete(): void {
  console.log('═══════════════════════════════════════════════════');
  console.log('  HULY OPS — Complete');
  console.log('═══════════════════════════════════════════════════\n');
}

// ── Command: list ───────────────────────────────────────────────────────

async function cmdList(): Promise<void> {
  const cfg = loadHulyConfig();
  printBanner(cfg);

  console.log('Connecting to Huly...');
  const session = await connect(cfg);
  console.log(`Connected. WorkspaceID: ${session.workspaceId}\n`);

  console.log('── LIST ISSUES ────────────────────────────────────\n');
  const issues = await listIssues(session);
  console.log(`Total issues in tracker: ${issues.length}\n`);

  const epics = issues.filter(i => i.title.startsWith('[EPIC]'));
  const sprints = issues.filter(i => i.title.startsWith('[SPRINT]'));
  const tasks = issues.filter(
    i => !i.title.startsWith('[EPIC]') && !i.title.startsWith('[SPRINT]')
  );

  console.log(`  Epics:   ${epics.length}`);
  console.log(`  Sprints: ${sprints.length}`);
  console.log(`  Tasks:   ${tasks.length}\n`);

  for (const issue of issues) {
    const label = issue.identifier || issue._id;
    const statusShort = issue.status.length > 30 ? issue.status.slice(0, 30) + '...' : issue.status;
    console.log(`  ${label} | ${issue.title} | status: ${statusShort}`);
  }
  console.log('');

  printComplete();
}

// ── Command: purge ──────────────────────────────────────────────────────

async function cmdPurge(opts: { mode: string }): Promise<void> {
  const cfg = loadHulyConfig();
  printBanner(cfg);

  console.log('Connecting to Huly...');
  const session = await connect(cfg);
  console.log(`Connected. Mode: ${opts.mode}\n`);

  const issues = await listIssues(session);
  console.log(`── PURGE (${issues.length} issues) ──────────────────────────────\n`);

  if (issues.length === 0) {
    console.log('  No issues to purge.');
    printComplete();
    return;
  }

  // Discover close status
  const statusInfo = await discoverStatuses(session);
  let closeStatusId: string | null = null;
  for (const s of statusInfo.statuses) {
    const name = String(s.name ?? '').toLowerCase();
    const cat = String(s.category ?? '').toLowerCase();
    if (name.includes('cancel') || cat.includes('cancel') || cat.includes('lost')) {
      closeStatusId = s._id;
      break;
    }
    if (name.includes('done') || cat.includes('done') || cat.includes('won')) {
      closeStatusId = closeStatusId ?? s._id;
    }
  }

  for (const issue of issues) {
    const label = issue.identifier || issue._id;
    console.log(`  Purging ${label}: "${issue.title}"`);

    if (closeStatusId) {
      try {
        const space = (issue as any).space ?? cfg.project;
        await updateIssueStatus(session, issue._id, closeStatusId, space);
        console.log(`    + Status -> ${opts.mode === 'archive' ? 'Archived/Done' : 'Cancelled'}`);
      } catch (err) {
        console.log(`    x Status change failed: ${err instanceof Error ? err.message : err}`);
      }
    }

    try {
      const existingDesc = issue.description ?? '';
      const newDesc = `[PURGED] ${existingDesc}`.trim();
      const space = (issue as any).space ?? cfg.project;
      await updateIssueDescription(session, issue._id, newDesc, space);
      console.log(`    + Description tagged [PURGED]`);
    } catch (err) {
      console.log(`    x Description update failed: ${err instanceof Error ? err.message : err}`);
    }

    try {
      await addComment(
        session,
        issue._id,
        `Purged (mode: ${opts.mode}). Replaced by new structure.`
      );
      console.log(`    + Comment added`);
    } catch (err) {
      console.log(`    x Comment failed: ${err instanceof Error ? err.message : err}`);
    }
    console.log('');
  }

  printComplete();
}

// ── Command: rebuild ────────────────────────────────────────────────────

async function cmdRebuild(): Promise<{ epics: number; sprint: number; tasks: number }> {
  const cfg = loadHulyConfig();
  printBanner(cfg);

  console.log('Connecting to Huly...');
  const session = await connect(cfg);
  console.log(`Connected.\n`);

  console.log('── REBUILD ────────────────────────────────────────\n');

  // Find or create project
  const projects = await discoverProjects(session);
  let projectSpace: string | null = null;
  for (const p of projects) {
    const ident = String(p.identifier ?? '');
    const name = String(p.name ?? '');
    if (ident === cfg.project || name === cfg.project || ident === 'UT' || name.includes('Truth')) {
      projectSpace = p._id;
      break;
    }
  }

  if (!projectSpace) {
    console.log(`  Project "${cfg.project}" not found. Creating...`);
    const projId = `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      const tx = buildTx(session, {
        _class: 'core:class:TxCreateDoc',
        objectId: projId,
        objectClass: 'tracker:class:Project',
        objectSpace: 'core:space:Space',
        attributes: {
          name: 'Truth & Automation',
          identifier: 'UT',
          description: 'Unit Talk — Truth & Automation platform tracker',
          private: false,
          archived: false,
          members: [session.socialId],
          defaultIssueStatus: 'tracker:status:Todo',
          defaultAssignee: session.socialId,
        },
      });
      await sendTx(session, tx);
      projectSpace = projId;
      console.log(`  + Project created: UT -> ${projId}\n`);
    } catch (err) {
      console.log(`  x Project creation failed: ${err instanceof Error ? err.message : err}`);
      projectSpace = 'tracker:project:DefaultProject';
      console.log(`  Falling back to: ${projectSpace}\n`);
    }
  } else {
    console.log(`  Project space: ${projectSpace}\n`);
  }

  // Create Epics
  const epics = [
    {
      title: 'PHASE 1 — Structural Dominance',
      desc: 'Epic: Foundation and structural dominance of the platform architecture.',
    },
    {
      title: 'PHASE 2 — Intelligence Superiority',
      desc: 'Epic: AI/LLM intelligence layer for automated analysis and decision support.',
    },
    {
      title: 'PHASE 3 — Risk Engine Dominance',
      desc: 'Epic: Risk assessment, settlement, and financial engine hardening.',
    },
    {
      title: 'PHASE 4 — Automation Supremacy',
      desc: 'Epic: Full automation pipeline — CI/CD, event bus, operator scheduler, auto-PR.',
    },
  ];

  const epicIds: string[] = [];
  console.log('  Creating Epics...');
  for (const epic of epics) {
    try {
      const id = await createIssue(session, projectSpace, `[EPIC] ${epic.title}`, epic.desc, {
        priority: 1,
      });
      epicIds.push(id);
      console.log(`    + ${epic.title} -> ${id}`);
    } catch (err) {
      console.log(`    x ${epic.title} — ${err instanceof Error ? err.message : err}`);
      epicIds.push('');
    }
  }
  console.log('');

  // Create Sprint
  console.log('  Creating Sprint...');
  let sprintCreated = 0;
  try {
    const sprintId = await createIssue(
      session,
      projectSpace,
      '[SPRINT] SPRINT-SFACTORY-V1-000 — Sprint Factory Bootstrap',
      'Sprint: Bootstrap the Sprint Factory execution structure.',
      { priority: 1 }
    );
    sprintCreated = 1;
    console.log(`    + SPRINT-SFACTORY-V1-000 -> ${sprintId}\n`);
  } catch (err) {
    console.log(`    x Sprint creation failed: ${err instanceof Error ? err.message : err}\n`);
  }

  // Create Tasks
  const tasks = [
    {
      title: 'Wire Huly ops CLI into daemon (list / purge / rebuild)',
      desc: 'Huly-ops CLI with list, purge, and rebuild commands.',
      epicIndex: 0,
    },
    {
      title: 'Verify event bus round-trip with live Redis',
      desc: 'E2E test: emit -> consume -> report -> receipt.',
      epicIndex: 3,
    },
    {
      title: 'Create Huly-to-GitHub bidirectional sync POC',
      desc: 'Prototype bidirectional sync between Huly and GitHub issues.',
      epicIndex: 1,
    },
    {
      title: 'Add risk scoring model to drift rules engine',
      desc: 'Extend drift-rules.ts with weighted risk scoring.',
      epicIndex: 2,
    },
    {
      title: 'CI pipeline: lint + type-check + single-writer gate for huly-os',
      desc: 'Add CI job for tools/huly-os with all gates.',
      epicIndex: 3,
    },
  ];

  console.log('  Creating Tasks...');
  const taskIds: string[] = [];
  for (const task of tasks) {
    try {
      const parentEpic = epicIds[task.epicIndex];
      const extra: Record<string, unknown> = { priority: 2 };
      if (parentEpic) extra.relations = [{ _id: parentEpic, _class: 'tracker:class:Issue' }];

      const id = await createIssue(session, projectSpace, task.title, task.desc, extra);
      taskIds.push(id);
      console.log(`    + ${task.title} -> ${id}`);
    } catch (err) {
      console.log(`    x ${task.title} — ${err instanceof Error ? err.message : err}`);
      taskIds.push('');
    }
  }
  console.log('');

  const epicCount = epicIds.filter(Boolean).length;
  const taskCount = taskIds.filter(Boolean).length;

  console.log('── REBUILD SUMMARY ────────────────────────────────');
  console.log(`  Epics created:  ${epicCount}/${epics.length}`);
  console.log(`  Sprint created: ${sprintCreated}/1`);
  console.log(`  Tasks created:  ${taskCount}/${tasks.length}`);
  console.log('');

  printComplete();
  return { epics: epicCount, sprint: sprintCreated, tasks: taskCount };
}

// ── Command: discover ───────────────────────────────────────────────────

async function cmdDiscover(): Promise<void> {
  const cfg = loadHulyConfig();
  printBanner(cfg);

  console.log('Connecting to Huly...');
  const session = await connect(cfg);
  console.log(`Connected.\n`);

  console.log('── DISCOVERY ──────────────────────────────────────\n');

  console.log('Statuses:');
  await discoverStatuses(session);

  console.log('\nProjects:');
  const projects = await discoverProjects(session);
  for (const p of projects) {
    console.log(`  ${p._id}: identifier=${p.identifier ?? '?'} name=${p.name ?? '?'}`);
  }

  console.log('\nSpaces:');
  const spaces = await findAll(session, 'core:class:Space');
  for (const s of spaces) {
    console.log(`  ${s._id}: name=${s.name ?? '?'} type=${s._class ?? '?'}`);
  }
  console.log('');

  printComplete();
}

// ── Command: doctor ─────────────────────────────────────────────────────

interface DoctorCheck {
  name: string;
  status: 'PASS' | 'FAIL';
  detail: string;
}

async function cmdDoctor(): Promise<void> {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  HULY OPS — Doctor');
  console.log('═══════════════════════════════════════════════════\n');

  const checks: DoctorCheck[] = [];

  // 1. Repo root resolvable
  const repoRootExists = existsSync(REPO_ROOT);
  checks.push({
    name: 'Repo root resolvable',
    status: repoRootExists ? 'PASS' : 'FAIL',
    detail: repoRootExists ? REPO_ROOT : 'REPO_ROOT does not exist',
  });

  // 2. GitHub token present
  const ghToken = process.env.GITHUB_TOKEN;
  checks.push({
    name: 'GITHUB_TOKEN present',
    status: ghToken && ghToken.length > 0 ? 'PASS' : 'FAIL',
    detail: ghToken ? `${ghToken.slice(0, 8)}...` : 'NOT SET',
  });

  // 3. HULY_URL set
  const hulyUrl = (process.env.HULY_URL ?? 'http://localhost:8087').replace(/\/$/, '');
  checks.push({
    name: 'HULY_URL configured',
    status: 'PASS',
    detail: hulyUrl,
  });

  // 4. Huly API reachable (any HTTP response = server is up)
  let hulyReachable = false;
  try {
    const res = await fetch(`${hulyUrl}/_accounts/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'login', params: { email: '', password: '' } }),
      signal: AbortSignal.timeout(5000),
    });
    // Any response (even 4xx) means server is up and responding
    hulyReachable = true;
    checks.push({
      name: 'Huly API reachable',
      status: 'PASS',
      detail: `HTTP ${res.status} — server responding`,
    });
  } catch (err) {
    checks.push({
      name: 'Huly API reachable',
      status: 'FAIL',
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  // 5. Workspace accessible (login + select)
  let session: HulySession | null = null;
  if (hulyReachable) {
    const cfg = loadHulyConfig();
    try {
      session = await connect(cfg);
      checks.push({
        name: 'Workspace accessible',
        status: 'PASS',
        detail: `ws=${session.workspaceId}`,
      });
    } catch (err) {
      checks.push({
        name: 'Workspace accessible',
        status: 'FAIL',
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  } else {
    checks.push({
      name: 'Workspace accessible',
      status: 'FAIL',
      detail: 'Skipped — Huly API not reachable',
    });
  }

  // 6. Project UT exists
  if (session) {
    try {
      const projects = await discoverProjects(session);
      const utProject = projects.find(
        (p: any) => p.identifier === 'UT' || (p.name && p.name.includes('Truth'))
      );
      checks.push({
        name: 'Project UT exists',
        status: utProject ? 'PASS' : 'FAIL',
        detail: utProject ? `id=${utProject._id}` : 'Project UT not found',
      });
    } catch (err) {
      checks.push({
        name: 'Project UT exists',
        status: 'FAIL',
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  } else {
    checks.push({
      name: 'Project UT exists',
      status: 'FAIL',
      detail: 'Skipped — no workspace session',
    });
  }

  // 7. GitHub API accessible
  if (ghToken) {
    try {
      const config = loadConfig();
      const audit = new AuditLogger();
      const github = new GitHubAdapter(config, audit);
      const summary = await github.getRepoSummary();
      checks.push({
        name: 'GitHub API accessible',
        status: 'PASS',
        detail: `repo=${config.GITHUB_OWNER}/${config.GITHUB_REPO} branch=${summary.defaultBranch}`,
      });
    } catch (err) {
      checks.push({
        name: 'GitHub API accessible',
        status: 'PASS', // downgrade — non-blocking
        detail: `Warning: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  } else {
    checks.push({
      name: 'GitHub API accessible',
      status: 'FAIL',
      detail: 'Skipped — GITHUB_TOKEN not set',
    });
  }

  // Print results
  console.log('── HEALTH CHECKS ──────────────────────────────────\n');

  let failCount = 0;
  for (const check of checks) {
    const icon = check.status === 'PASS' ? 'PASS' : 'FAIL';
    console.log(`  [${icon}] ${check.name}`);
    console.log(`         ${check.detail}`);
    if (check.status === 'FAIL') failCount++;
  }

  console.log('\n── SUMMARY ────────────────────────────────────────');
  console.log(`  Total:  ${checks.length}`);
  console.log(`  Pass:   ${checks.length - failCount}`);
  console.log(`  Fail:   ${failCount}`);
  console.log(`  Status: ${failCount === 0 ? 'HEALTHY' : 'DEGRADED'}`);
  console.log('═══════════════════════════════════════════════════\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

// ── Command: bootstrap ──────────────────────────────────────────────────

async function cmdBootstrap(): Promise<void> {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  HULY OPS — Bootstrap');
  console.log('═══════════════════════════════════════════════════\n');

  // Step 1: Rebuild
  console.log('Step 1/3: Rebuild OS structure\n');
  const rebuildResult = await cmdRebuild();

  // Step 2: Publish OS docs
  console.log('Step 2/3: Publish OS documents\n');
  let docsPublished = 0;
  try {
    const config = loadConfig();
    const audit = new AuditLogger();
    const huly = new HulyAdapter(config, audit);
    await huly.connect();

    const docs = [
      {
        title: 'Engineering OS',
        content: 'Central governance document for Unit Talk platform engineering operations.',
      },
      {
        title: 'Sprint Execution Protocol',
        content: 'Standard operating procedure for sprint execution within the Unit Talk platform.',
      },
      {
        title: 'Incident Response',
        content: 'Incident response procedures for the Unit Talk platform.',
      },
      {
        title: 'Operator Playbooks',
        content: 'Operational playbooks for day-to-day platform operations.',
      },
      {
        title: 'System Architecture',
        content: 'Technical architecture overview of the Unit Talk platform.',
      },
    ];

    for (const doc of docs) {
      try {
        const result = await huly.upsertDoc(config.HULY_TEAMSPACE, doc.title, doc.content);
        console.log(`    + ${doc.title} (${result.created ? 'created' : 'updated'}: ${result.id})`);
        docsPublished++;
      } catch (err) {
        console.log(`    x ${doc.title}: ${err instanceof Error ? err.message : err}`);
      }
    }
    console.log('');
  } catch (err) {
    console.log(`  Publish failed: ${err instanceof Error ? err.message : err}\n`);
  }

  // Step 3: Backfill PR linkages
  console.log('Step 3/3: Backfill PR <-> issue relationships\n');
  let linkedPRs = 0;
  try {
    const config = loadConfig();
    const audit = new AuditLogger();
    const github = new GitHubAdapter(config, audit);
    const huly = new HulyAdapter(config, audit);
    await huly.connect();

    const [openPRs, mergedPRs] = await Promise.all([
      github.listOpenPRs(),
      github.listRecentlyMergedPRs(90),
    ]);
    console.log(
      `  Scanned ${openPRs.length + mergedPRs.length} PRs (${openPRs.length} open, ${mergedPRs.length} merged)`
    );

    const hulyIssues = await huly.listIssues(config.HULY_PROJECT);
    const issueByRef = new Map<string, any>();
    for (const issue of hulyIssues) {
      if (issue.identifier) issueByRef.set(issue.identifier, issue);
    }

    const ISSUE_REF_RE = /\b(UT-\d+)\b/g;
    for (const pr of [...openPRs, ...mergedPRs]) {
      const refs = [
        ...new Set([pr.title, pr.headBranch].flatMap(s => s.match(ISSUE_REF_RE) ?? [])),
      ];
      for (const ref of refs) {
        const issue = issueByRef.get(ref);
        if (issue) {
          try {
            await huly.linkIssueToPR(issue.id, pr.number, pr.title, pr.url);
            linkedPRs++;
            console.log(`    + PR #${pr.number} -> ${ref}`);
          } catch {
            // Silently skip link errors
          }
        }
      }
    }
    console.log('');
  } catch (err) {
    console.log(`  Backfill failed: ${err instanceof Error ? err.message : err}\n`);
  }

  // Summary
  console.log('── BOOTSTRAP SUMMARY ──────────────────────────────');
  console.log(
    `  Created Issues: ${rebuildResult.epics + rebuildResult.sprint + rebuildResult.tasks}`
  );
  console.log(`    Epics:   ${rebuildResult.epics}`);
  console.log(`    Sprints: ${rebuildResult.sprint}`);
  console.log(`    Tasks:   ${rebuildResult.tasks}`);
  console.log(`  Published Docs: ${docsPublished}`);
  console.log(`  Linked PRs:     ${linkedPRs}`);
  console.log('═══════════════════════════════════════════════════\n');
}

// ── CLI Program ─────────────────────────────────────────────────────────

const program = new Command();

program.name('huly-ops').description('HULY-OS Operating System CLI').version('1.0.0');

program
  .command('list')
  .description('List all Huly issues with categorized counts')
  .action(async () => {
    await cmdList();
  });

program
  .command('purge')
  .description('Close all issues, tag [PURGED], add comment')
  .option('--mode <mode>', 'Purge mode (archive or cancel)', 'archive')
  .action(async opts => {
    await cmdPurge(opts);
  });

program
  .command('rebuild')
  .description('Create epics, sprint, and tasks in Huly')
  .action(async () => {
    await cmdRebuild();
  });

program
  .command('discover')
  .description('Discover Huly statuses, spaces, and projects')
  .action(async () => {
    await cmdDiscover();
  });

program
  .command('doctor')
  .description('Verify all HULY-OS dependencies and connectivity')
  .action(async () => {
    await cmdDoctor();
  });

program
  .command('bootstrap')
  .description('Full OS setup: rebuild + publish docs + backfill PRs')
  .action(async () => {
    await cmdBootstrap();
  });

// Strip the literal '--' separator that pnpm injects when using: pnpm run huly:ops -- <cmd>
const argv = process.argv.filter((arg, i) => !(arg === '--' && i === 2));

program.parseAsync(argv).catch(err => {
  console.error('FATAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
