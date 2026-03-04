// SPRINT-UI-AUDIT-2026-03-04: Backfill missing status/number/identifier on TX-created issues
// Usage: npx tsx scripts/backfill-issue-fields.ts [--dry-run]

import { resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: resolve(import.meta.dirname ?? '.', '..', '.env') });

const HULY_URL = process.env.HULY_URL ?? 'http://localhost:8087';
const HULY_EMAIL = process.env.HULY_EMAIL ?? 'ops@unit-talk.local';
const HULY_PASSWORD = process.env.HULY_PASSWORD ?? 'password';
const HULY_WORKSPACE = process.env.HULY_WORKSPACE ?? 'unit-talk';
const DRY_RUN = process.argv.includes('--dry-run');

interface AccountRpcResponse {
  result?: Record<string, unknown>;
  error?: { code: string };
}

async function main(): Promise<void> {
  console.log(`\nHuly Issue Field Backfill — ${DRY_RUN ? 'DRY-RUN' : 'LIVE'}\n`);

  // Authenticate
  const loginRes = await fetch(`${HULY_URL}/_accounts/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'login',
      params: { email: HULY_EMAIL, password: HULY_PASSWORD },
    }),
  });
  const loginBody = (await loginRes.json()) as AccountRpcResponse;
  if (loginBody.error) throw new Error(`Login failed: ${loginBody.error.code}`);
  const accountToken = loginBody.result!.token as string;
  const socialId = String(loginBody.result!.socialId ?? '');

  const wsRes = await fetch(`${HULY_URL}/_accounts/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountToken}` },
    body: JSON.stringify({ method: 'selectWorkspace', params: { workspaceUrl: HULY_WORKSPACE } }),
  });
  const wsBody = (await wsRes.json()) as AccountRpcResponse;
  if (wsBody.error) throw new Error(`Workspace select failed: ${wsBody.error.code}`);
  const wsToken = wsBody.result!.token as string;
  const wsId = wsBody.result!.workspace as string;

  console.log(`Connected to workspace: ${wsId}`);

  // Fetch all issues
  const issues = await findAll(wsToken, wsId, 'tracker:class:Issue', 500);
  console.log(`Total issues: ${issues.length}`);

  // Fetch all projects
  const projects = await findAll(wsToken, wsId, 'tracker:class:Project', 20);
  const projectMap = new Map<string, Record<string, unknown>>();
  for (const p of projects) {
    projectMap.set(String(p._id), p);
  }

  // Group issues by project space
  const byProject = new Map<string, Record<string, unknown>[]>();
  for (const issue of issues) {
    const space = String(issue.space ?? '');
    if (!byProject.has(space)) byProject.set(space, []);
    byProject.get(space)!.push(issue);
  }

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const [spaceId, projectIssues] of byProject) {
    const project = projectMap.get(spaceId);
    if (!project) {
      console.log(`\nSkipping ${projectIssues.length} issues in unknown space: ${spaceId}`);
      skipped += projectIssues.length;
      continue;
    }

    const projectIdent = String(project.identifier ?? 'UNKNOWN');
    const defaultStatus = String(project.defaultIssueStatus ?? 'tracker:status:Backlog');
    let sequence = typeof project.sequence === 'number' ? project.sequence : 0;

    console.log(`\nProject: ${projectIdent} (${spaceId})`);
    console.log(`  Issues: ${projectIssues.length}, Current sequence: ${sequence}`);
    console.log(`  Default status: ${defaultStatus}`);

    // Find issues that need backfill (missing status OR number)
    const needsBackfill = projectIssues.filter(i => !i.status || typeof i.number !== 'number');

    if (needsBackfill.length === 0) {
      console.log(`  All issues already have required fields — skipping`);
      skipped += projectIssues.length;
      continue;
    }

    console.log(`  Need backfill: ${needsBackfill.length}`);

    // Sort by createdOn to assign numbers in chronological order
    needsBackfill.sort((a, b) => (Number(a.createdOn) || 0) - (Number(b.createdOn) || 0));

    for (const issue of needsBackfill) {
      const issueId = String(issue._id);
      const operations: Record<string, unknown> = {};

      if (!issue.status) {
        operations.status = defaultStatus;
      }

      if (typeof issue.number !== 'number') {
        sequence++;
        operations.number = sequence;
        operations.identifier = `${projectIdent}-${sequence}`;
      }

      if (issue.kind === undefined || issue.kind === null) {
        operations.kind = 0;
      }

      if (Object.keys(operations).length === 0) {
        skipped++;
        continue;
      }

      const preview = `${issueId} → ${JSON.stringify(operations)}`;
      if (DRY_RUN) {
        console.log(`  [DRY-RUN] ${preview}`);
        updated++;
        continue;
      }

      try {
        await sendTx(wsToken, wsId, socialId, {
          _class: 'core:class:TxUpdateDoc',
          objectId: issueId,
          objectClass: 'tracker:class:Issue',
          objectSpace: spaceId,
          operations,
        });
        console.log(`  Updated: ${preview}`);
        updated++;
      } catch (err) {
        console.error(`  ERROR: ${issueId}: ${(err as Error).message}`);
        errors++;
      }
    }

    // Update project sequence counter
    if (sequence !== (project.sequence ?? 0) && !DRY_RUN) {
      try {
        await sendTx(wsToken, wsId, socialId, {
          _class: 'core:class:TxUpdateDoc',
          objectId: spaceId,
          objectClass: 'tracker:class:Project',
          objectSpace: 'core:space:Space',
          operations: { sequence },
        });
        console.log(`  Updated project sequence → ${sequence}`);
      } catch (err) {
        console.error(`  ERROR updating project sequence: ${(err as Error).message}`);
        errors++;
      }
    }
  }

  console.log(`\n── Backfill Summary ──`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors:  ${errors}`);
}

async function findAll(
  token: string,
  wsId: string,
  cls: string,
  limit: number
): Promise<Record<string, unknown>[]> {
  const opts = JSON.stringify({ limit });
  const url =
    `${HULY_URL}/_transactor/api/v1/find-all/${wsId}` +
    `?class=${encodeURIComponent(cls)}&options=${encodeURIComponent(opts)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`findAll(${cls}) HTTP ${res.status}`);
  const body = await res.json();
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.result)) return body.result;
  if (Array.isArray(body?.value)) return body.value;
  if (Array.isArray(body?.docs)) return body.docs;
  return [];
}

async function sendTx(
  token: string,
  wsId: string,
  socialId: string,
  fields: Record<string, unknown>
): Promise<void> {
  const txId = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tx = {
    _id: txId,
    space: 'core:space:Tx',
    modifiedBy: socialId,
    modifiedOn: Date.now(),
    ...fields,
  };

  const res = await fetch(`${HULY_URL}/_transactor/api/v1/tx/${wsId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(tx),
  });

  if (!res.ok) {
    const snippet = await res.text().catch(() => '');
    throw new Error(`TX HTTP ${res.status}: ${snippet.slice(0, 200)}`);
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
