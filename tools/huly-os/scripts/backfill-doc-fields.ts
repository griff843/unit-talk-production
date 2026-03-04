// Backfill missing Document/Teamspace fields for UI visibility
// Usage: npx tsx scripts/backfill-doc-fields.ts

import { resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: resolve(import.meta.dirname ?? '.', '..', '.env') });

const HULY_URL = process.env.HULY_URL ?? 'http://localhost:8087';
const HULY_EMAIL = process.env.HULY_EMAIL ?? 'ops@unit-talk.local';
const HULY_PASSWORD = process.env.HULY_PASSWORD ?? 'password';
const HULY_WORKSPACE = process.env.HULY_WORKSPACE ?? 'unit-talk';

interface RpcResponse {
  result?: Record<string, unknown>;
  error?: { code: string };
}

async function main(): Promise<void> {
  console.log('\nDocument/Teamspace Field Backfill\n');

  // Authenticate
  const loginRes = await fetch(`${HULY_URL}/_accounts/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'login',
      params: { email: HULY_EMAIL, password: HULY_PASSWORD },
    }),
  });
  const loginBody = (await loginRes.json()) as RpcResponse;
  if (loginBody.error) throw new Error(`Login failed: ${loginBody.error.code}`);
  const accountToken = loginBody.result!.token as string;
  const socialId = String(loginBody.result!.socialId ?? '');

  const wsRes = await fetch(`${HULY_URL}/_accounts/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountToken}` },
    body: JSON.stringify({ method: 'selectWorkspace', params: { workspaceUrl: HULY_WORKSPACE } }),
  });
  const wsBody = (await wsRes.json()) as RpcResponse;
  if (wsBody.error) throw new Error(`Workspace select failed: ${wsBody.error.code}`);
  const workspaceToken = wsBody.result!.token as string;
  const workspaceId = wsBody.result!.workspace as string;

  // Connect WebSocket
  const wsUrl = HULY_URL.replace(/^http/, 'ws');
  const socket = new WebSocket(`${wsUrl}/${workspaceToken}`);
  const connected = await new Promise<boolean>(resolve => {
    const timeout = setTimeout(() => resolve(false), 10_000);
    socket.onopen = () => {
      socket.send(
        JSON.stringify({ method: 'hello', params: [], id: -1, binary: false, compression: false })
      );
    };
    socket.onmessage = async (event: MessageEvent) => {
      const raw = event.data instanceof Blob ? await event.data.text() : String(event.data);
      const data = JSON.parse(raw);
      if (data.id === -1) {
        clearTimeout(timeout);
        resolve(true);
      }
    };
    socket.onerror = () => {
      clearTimeout(timeout);
      resolve(false);
    };
  });
  if (!connected) throw new Error('WebSocket connection failed');
  console.log('Connected.\n');

  let reqId = 0;

  // ── Fix Teamspaces ──
  console.log('=== Teamspaces ===');
  const teamspaces = await findAll(workspaceToken, workspaceId, 'document:class:Teamspace', 50);
  for (const ts of teamspaces) {
    const ops: Record<string, unknown> = {};
    if (!ts.type) ops.type = 'document:spaceType:DefaultTeamspaceType';
    if (!ts.title) ops.title = String(ts.name);
    if (ts.autoJoin === undefined) ops.autoJoin = true;
    if (!ts.owners) ops.owners = [socialId];

    if (Object.keys(ops).length === 0) {
      console.log(`  OK: "${ts.name}" (${ts._id})`);
      continue;
    }

    reqId++;
    await wsSend(
      socket,
      {
        _id: `tx-fix-ts-${Date.now()}-${reqId}`,
        space: 'core:space:Tx',
        _class: 'core:class:TxUpdateDoc',
        objectId: String(ts._id),
        objectClass: 'document:class:Teamspace',
        objectSpace: 'core:space:Space',
        modifiedBy: socialId,
        modifiedOn: Date.now(),
        operations: ops,
      },
      reqId
    );
    console.log(`  Fixed: "${ts.name}" → ${JSON.stringify(ops)}`);
  }

  // ── Fix Documents ──
  console.log('\n=== Documents ===');
  const docs = await findAll(workspaceToken, workspaceId, 'document:class:Document', 200);
  let fixed = 0;

  for (const doc of docs) {
    const ops: Record<string, unknown> = {};
    if (!doc.parent) ops.parent = 'document:ids:NoParent';
    if (!doc.rank) ops.rank = '0|hzzzzz:';
    if (doc.attachments === undefined) ops.attachments = 0;
    if (doc.comments === undefined) ops.comments = 0;
    if (doc.docUpdateMessages === undefined) ops.docUpdateMessages = 0;
    if (doc.embeddings === undefined) ops.embeddings = 0;
    if (doc.labels === undefined) ops.labels = 0;
    if (doc.references === undefined) ops.references = 0;

    if (Object.keys(ops).length === 0) {
      console.log(`  OK: "${doc.title}" (${doc._id})`);
      continue;
    }

    reqId++;
    await wsSend(
      socket,
      {
        _id: `tx-fix-doc-${Date.now()}-${reqId}`,
        space: 'core:space:Tx',
        _class: 'core:class:TxUpdateDoc',
        objectId: String(doc._id),
        objectClass: 'document:class:Document',
        objectSpace: String(doc.space),
        modifiedBy: socialId,
        modifiedOn: Date.now(),
        operations: ops,
      },
      reqId
    );
    console.log(`  Fixed: "${doc.title}" → ${JSON.stringify(ops)}`);
    fixed++;
  }

  // ── Create a fresh test doc with all fields ──
  console.log('\n=== Creating test doc with all fields ===');
  const opsTeamspace = teamspaces.find(t => String(t.name) === 'Operations');
  if (opsTeamspace) {
    reqId++;
    const testDocId = `doc-test-complete-${Date.now()}`;
    await wsSend(
      socket,
      {
        _id: `tx-doc-test-${Date.now()}`,
        space: 'core:space:Tx',
        _class: 'core:class:TxCreateDoc',
        objectId: testDocId,
        objectClass: 'document:class:Document',
        objectSpace: String(opsTeamspace._id),
        modifiedBy: socialId,
        modifiedOn: Date.now(),
        attributes: {
          title: `[DOC-TEST-COMPLETE] ${new Date().toISOString()}`,
          content:
            '# Complete Test Document\n\nCreated with all required fields for UI visibility.',
          parent: 'document:ids:NoParent',
          rank: '0|hzzzzz:',
          attachments: 0,
          comments: 0,
          docUpdateMessages: 0,
          embeddings: 0,
          labels: 0,
          references: 0,
        },
      },
      reqId
    );
    console.log(`  Created: ${testDocId}`);
  }

  socket.close();
  console.log(`\nDone. Fixed ${fixed} documents.`);
}

async function wsSend(
  socket: WebSocket,
  tx: Record<string, unknown>,
  id: number
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`TX timeout for #${id}`)), 30_000);
    const handler = async (event: MessageEvent) => {
      const raw = event.data instanceof Blob ? await event.data.text() : String(event.data);
      const data = JSON.parse(raw);
      if (data.id === id) {
        clearTimeout(timeout);
        socket.removeEventListener('message', handler);
        if (data.error) reject(new Error(`TX error: ${JSON.stringify(data.error)}`));
        else resolve(data.result);
      }
    };
    socket.addEventListener('message', handler);
    socket.send(JSON.stringify({ method: 'tx', params: [tx], id, time: Date.now() }));
  });
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

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
