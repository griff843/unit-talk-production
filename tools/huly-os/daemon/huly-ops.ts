// SPRINT-SFACTORY-V1-000: Huly ops script for Sprint Factory rebuild
// Handles: list, purge (close + label + comment), rebuild (epics + sprint + tasks)

import { resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';

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
  // Step 1: Login
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

  // Step 2: Select workspace
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
  // Try multiple possible status classes
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

async function discoverSpaces(session: HulySession): Promise<any[]> {
  const spaces = await findAll(session, 'core:class:Space');
  return spaces;
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

// ── CLI ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const mode = args[0];

  if (!mode || !['list', 'purge', 'rebuild', 'full', 'discover'].includes(mode)) {
    console.log('Usage: npx tsx huly-ops.ts <list|purge|rebuild|full|discover>');
    console.log('  list     — List all UT issues with count + titles');
    console.log('  purge    — Close all issues, add PURGED comment');
    console.log('  rebuild  — Create epics, sprint, and tasks');
    console.log('  full     — Run list → purge → rebuild');
    console.log('  discover — Discover Huly statuses, spaces, and projects');
    process.exit(1);
  }

  const cfg: HulyConfig = {
    baseUrl: (process.env.HULY_URL ?? 'http://localhost:8087').replace(/\/$/, ''),
    email: process.env.HULY_EMAIL ?? 'user1@example.com',
    password: process.env.HULY_PASSWORD ?? '1234',
    workspace: process.env.HULY_WORKSPACE ?? 'ws1',
    project: process.env.HULY_PROJECT ?? 'UT',
    teamspace: process.env.HULY_TEAMSPACE ?? 'Operations',
  };

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  HULY OPS — Sprint Factory');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  URL:        ${cfg.baseUrl}`);
  console.log(`  Workspace:  ${cfg.workspace}`);
  console.log(`  Project:    ${cfg.project}`);
  console.log(`  Teamspace:  ${cfg.teamspace}`);
  console.log('═══════════════════════════════════════════════════\n');

  console.log('Connecting to Huly...');
  const session = await connect(cfg);
  console.log(`Connected. WorkspaceID: ${session.workspaceId}, SocialID: ${session.socialId}\n`);

  if (mode === 'discover' || mode === 'full') {
    console.log('── DISCOVERY ──────────────────────────────────────');
    console.log('\nDiscovering statuses...');
    await discoverStatuses(session);

    console.log('\nDiscovering projects...');
    const projects = await discoverProjects(session);
    for (const p of projects) {
      console.log(`  ${p._id}: identifier=${p.identifier ?? '?'} name=${p.name ?? '?'}`);
    }

    console.log('\nDiscovering spaces...');
    const spaces = await discoverSpaces(session);
    for (const s of spaces) {
      console.log(`  ${s._id}: name=${s.name ?? '?'} type=${s._class ?? '?'}`);
    }
    console.log('');
  }

  if (mode === 'list' || mode === 'full' || mode === 'purge') {
    console.log('── LIST ISSUES ────────────────────────────────────');
    const issues = await listIssues(session);
    console.log(`\nTotal issues in tracker: ${issues.length}\n`);

    if (issues.length === 0) {
      console.log('  (no issues found)');
    } else {
      for (const issue of issues) {
        const statusShort =
          issue.status.length > 30 ? issue.status.slice(0, 30) + '...' : issue.status;
        console.log(`  ${issue.identifier || issue._id} | ${issue.title} | status: ${statusShort}`);
      }
    }
    console.log('');

    if (mode === 'purge' || mode === 'full') {
      console.log('── PURGE ──────────────────────────────────────────');

      if (issues.length === 0) {
        console.log('  No issues to purge.\n');
      } else {
        // Discover done/cancelled status
        console.log('  Discovering "Cancelled" status...');
        const statusInfo = await discoverStatuses(session);
        let cancelledStatusId: string | null = null;
        let doneStatusId: string | null = null;

        for (const s of statusInfo.statuses) {
          const name = String(s.name ?? '').toLowerCase();
          const cat = String(s.category ?? '').toLowerCase();
          if (name.includes('cancel') || cat.includes('cancel') || cat.includes('lost')) {
            cancelledStatusId = s._id;
          }
          if (name.includes('done') || cat.includes('done') || cat.includes('won')) {
            doneStatusId = s._id;
          }
        }

        const closeStatusId = cancelledStatusId ?? doneStatusId;
        if (closeStatusId) {
          console.log(`  Using status: ${closeStatusId}\n`);
        } else {
          console.log('  WARNING: No Done/Cancelled status found. Will skip status change.\n');
        }

        for (const issue of issues) {
          const label = issue.identifier || issue._id;
          console.log(`  Purging ${label}: "${issue.title}"`);

          // 1. Close (change status)
          if (closeStatusId) {
            try {
              // Need the space for this issue
              const space = (issue as any).space ?? cfg.project;
              await updateIssueStatus(session, issue._id, closeStatusId, space);
              console.log(`    ✓ Status → Cancelled/Done`);
            } catch (err) {
              console.log(
                `    ✗ Status change failed: ${err instanceof Error ? err.message : err}`
              );
            }
          }

          // 2. Add PURGED to description (since native labels may not be available via API)
          try {
            const existingDesc = issue.description ?? '';
            const newDesc = `[PURGED] ${existingDesc}`.trim();
            const space = (issue as any).space ?? cfg.project;
            await updateIssueDescription(session, issue._id, newDesc, space);
            console.log(`    ✓ Description tagged [PURGED]`);
          } catch (err) {
            console.log(
              `    ✗ Description update failed: ${err instanceof Error ? err.message : err}`
            );
          }

          // 3. Add comment
          try {
            await addComment(
              session,
              issue._id,
              'Purged for Sprint Factory rebuild. Replaced by new execution structure.'
            );
            console.log(`    ✓ Comment added`);
          } catch (err) {
            console.log(`    ✗ Comment failed: ${err instanceof Error ? err.message : err}`);
          }

          console.log('');
        }
      }
    }
  }

  if (mode === 'rebuild' || mode === 'full') {
    console.log('── REBUILD ────────────────────────────────────────');

    // Discover or create the project
    const projects = await discoverProjects(session);
    let projectSpace: string | null = null;
    for (const p of projects) {
      const name = String(p.name ?? '');
      const ident = String(p.identifier ?? '');
      if (
        ident === cfg.project ||
        name === cfg.project ||
        ident === 'UT' ||
        name.includes('Truth')
      ) {
        projectSpace = p._id;
        break;
      }
    }

    if (!projectSpace) {
      // Create the UT project
      console.log(`  Project "UT" not found. Creating...`);
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
        console.log(`  ✓ Project created: UT → ${projId}\n`);
      } catch (err) {
        console.log(`  ✗ Project creation failed: ${err instanceof Error ? err.message : err}`);
        projectSpace = 'tracker:project:DefaultProject'; // fallback
        console.log(`  Falling back to default project: ${projectSpace}\n`);
      }
    } else {
      console.log(`  Project space: ${projectSpace}\n`);
    }

    // Create Epics (as issues with [EPIC] prefix)
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
          priority: 1, // Urgent
        });
        epicIds.push(id);
        console.log(`    ✓ ${epic.title} → ${id}`);
      } catch (err) {
        console.log(`    ✗ ${epic.title} — ${err instanceof Error ? err.message : err}`);
        epicIds.push('');
      }
    }
    console.log('');

    // Create Sprint issue
    console.log('  Creating Sprint...');
    let sprintId = '';
    try {
      sprintId = await createIssue(
        session,
        projectSpace,
        '[SPRINT] SPRINT-SFACTORY-V1-000 — Sprint Factory Bootstrap',
        'Sprint: Bootstrap the Sprint Factory execution structure.\n\nObjective: Stand up the minimal Huly project structure with epics, tasks, and sprint tracking.',
        { priority: 1 }
      );
      console.log(`    ✓ SPRINT-SFACTORY-V1-000 → ${sprintId}\n`);
    } catch (err) {
      console.log(`    ✗ Sprint creation failed: ${err instanceof Error ? err.message : err}\n`);
    }

    // Create 5 Tasks under the sprint
    const tasks = [
      {
        title: 'Wire Huly ops CLI into daemon (list / purge / rebuild)',
        desc: 'Add huly-ops.ts script with list, purge, and rebuild commands.\nAttached to: PHASE 1 — Structural Dominance',
        epicIndex: 0,
      },
      {
        title: 'Verify event bus round-trip with live Redis',
        desc: 'End-to-end test: emit event → consume → report → receipt.\nAttached to: PHASE 4 — Automation Supremacy',
        epicIndex: 3,
      },
      {
        title: 'Create Huly-to-GitHub bidirectional sync POC',
        desc: 'Prototype bidirectional sync between Huly issues and GitHub issues.\nAttached to: PHASE 2 — Intelligence Superiority',
        epicIndex: 1,
      },
      {
        title: 'Add risk scoring model to drift rules engine',
        desc: 'Extend drift-rules.ts with weighted risk scoring per violation category.\nAttached to: PHASE 3 — Risk Engine Dominance',
        epicIndex: 2,
      },
      {
        title: 'CI pipeline: lint + type-check + single-writer gate for huly-os',
        desc: 'Add CI job specifically for tools/huly-os with all gates.\nAttached to: PHASE 4 — Automation Supremacy',
        epicIndex: 3,
      },
    ];

    console.log('  Creating Tasks...');
    const taskIds: string[] = [];
    for (const task of tasks) {
      try {
        const parentEpic = epicIds[task.epicIndex];
        const extra: Record<string, unknown> = { priority: 2 }; // Normal priority
        if (parentEpic) {
          extra.relations = [{ _id: parentEpic, _class: 'tracker:class:Issue' }];
        }

        const id = await createIssue(session, projectSpace, task.title, task.desc, extra);
        taskIds.push(id);
        console.log(`    ✓ ${task.title} → ${id}`);
      } catch (err) {
        console.log(`    ✗ ${task.title} — ${err instanceof Error ? err.message : err}`);
        taskIds.push('');
      }
    }
    console.log('');

    // Summary
    console.log('── REBUILD SUMMARY ────────────────────────────────');
    console.log(`  Epics created:  ${epicIds.filter(Boolean).length}/${epics.length}`);
    console.log(`  Sprint created: ${sprintId ? '1' : '0'}/1`);
    console.log(`  Tasks created:  ${taskIds.filter(Boolean).length}/${tasks.length}`);
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════');
  console.log('  HULY OPS — Complete');
  console.log('═══════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
