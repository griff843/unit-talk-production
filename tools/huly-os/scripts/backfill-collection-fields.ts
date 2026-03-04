// SPRINT-HULY-REST-LIVEQUERY-BRIDGE-017: Backfill missing collection fields for UI visibility
// Issues created via REST TX or early WS TX lack attachedTo/attachedToClass/collection.
// Without these, Huly's LiveQuery excludes them from issue list views.
// Usage: npx tsx scripts/backfill-collection-fields.ts [--dry-run]

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
  console.log(`\nHuly Collection Field Backfill — ${DRY_RUN ? 'DRY-RUN' : 'LIVE'}\n`);

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

  // Find issues missing collection fields
  const needsFix = issues.filter(i => !i.attachedTo || !i.attachedToClass || !i.collection);

  console.log(`Issues missing collection fields: ${needsFix.length}`);

  if (needsFix.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  let updated = 0;
  let errors = 0;

  for (const issue of needsFix) {
    const issueId = String(issue._id);
    const space = String(issue.space ?? '');
    const ident = String(issue.identifier ?? issueId);
    const operations: Record<string, unknown> = {};

    if (!issue.attachedTo) operations.attachedTo = 'tracker:ids:NoParent';
    if (!issue.attachedToClass) operations.attachedToClass = 'tracker:class:Issue';
    if (!issue.collection) operations.collection = 'subIssues';
    // Also fix kind if it's numeric instead of string
    if (issue.kind === 0 || issue.kind === undefined || issue.kind === null) {
      operations.kind = 'tracker:taskTypes:Issue';
    }
    // Fix empty rank
    if (!issue.rank) operations.rank = '0|hzzzzz:';
    // Add comments if missing
    if (issue.comments === undefined || issue.comments === null) operations.comments = 0;
    // Add missing array fields
    if (!Array.isArray(issue.parents)) operations.parents = [];
    if (!Array.isArray(issue.childInfo)) operations.childInfo = [];
    if (!Array.isArray(issue.relations)) operations.relations = [];

    if (Object.keys(operations).length === 0) continue;

    const preview = `${ident} (${issueId}) → ${JSON.stringify(operations)}`;
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
        objectSpace: space,
        operations,
      });
      console.log(`  Updated: ${preview}`);
      updated++;
    } catch (err) {
      console.error(`  ERROR: ${ident}: ${(err as Error).message}`);
      errors++;
    }
  }

  console.log(`\n── Backfill Summary ──`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped: ${issues.length - needsFix.length}`);
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
