// SPRINT-HULY-REST-LIVEQUERY-BRIDGE-017: WebSocket TX test script
// Creates a test issue via WebSocket TX and verifies it via REST findAll.
// Usage: npx tsx scripts/ws-tx-test.ts

import { resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: resolve(import.meta.dirname ?? '.', '..', '.env') });

const HULY_URL = process.env.HULY_URL ?? 'http://localhost:8087';
const HULY_EMAIL = process.env.HULY_EMAIL ?? 'ops@unit-talk.local';
const HULY_PASSWORD = process.env.HULY_PASSWORD ?? 'password';
const HULY_WORKSPACE = process.env.HULY_WORKSPACE ?? 'unit-talk';
const PROJECT = process.argv[2] ?? 'GAME'; // Default to GAME project (has UI-created issues for comparison)

interface RpcResponse {
  result?: Record<string, unknown>;
  error?: { code: string };
}

async function main(): Promise<void> {
  const timestamp = new Date().toISOString();
  const testTitle = `[WS-TEST] ${timestamp}`;

  console.log(`\nWebSocket TX Test — ${timestamp}`);
  console.log(`Project: ${PROJECT}`);
  console.log(`URL: ${HULY_URL}\n`);

  // ── Step 1: Authenticate ──
  console.log('1. Authenticating...');
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
  console.log(`   Logged in as: ${socialId}`);

  // ── Step 2: Select workspace ──
  console.log('2. Selecting workspace...');
  const wsRes = await fetch(`${HULY_URL}/_accounts/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountToken}` },
    body: JSON.stringify({ method: 'selectWorkspace', params: { workspaceUrl: HULY_WORKSPACE } }),
  });
  const wsBody = (await wsRes.json()) as RpcResponse;
  if (wsBody.error) throw new Error(`Workspace select failed: ${wsBody.error.code}`);
  const workspaceToken = wsBody.result!.token as string;
  const workspaceId = wsBody.result!.workspace as string;
  console.log(`   Workspace: ${workspaceId}`);

  // ── Step 3: Find project space ID ──
  console.log(`3. Finding project "${PROJECT}"...`);
  const findProjectUrl =
    `${HULY_URL}/_transactor/api/v1/find-all/${workspaceId}` +
    `?class=${encodeURIComponent('tracker:class:Project')}&options=${encodeURIComponent(JSON.stringify({ limit: 20 }))}`;
  const projectRes = await fetch(findProjectUrl, {
    headers: { Authorization: `Bearer ${workspaceToken}` },
  });
  const projectBody = await projectRes.json();
  const projects: Record<string, unknown>[] = Array.isArray(projectBody)
    ? projectBody
    : (projectBody?.value ?? projectBody?.docs ?? []);

  const project = projects.find(p => String(p.identifier) === PROJECT);
  if (!project) {
    console.error(
      `   Project "${PROJECT}" not found. Available: ${projects.map(p => p.identifier).join(', ')}`
    );
    process.exit(1);
  }
  const spaceId = String(project._id);
  const projectIdent = String(project.identifier);
  const defaultStatus = String(project.defaultIssueStatus ?? 'tracker:status:Backlog');
  let sequence = typeof project.sequence === 'number' ? project.sequence : 0;
  console.log(`   Found: ${projectIdent} (${spaceId}), sequence=${sequence}`);

  // ── Step 4: Connect WebSocket ──
  console.log('4. Connecting WebSocket...');
  const wsUrl = HULY_URL.replace(/^http/, 'ws');
  const socket = new WebSocket(`${wsUrl}/${workspaceToken}`);

  const connected = await new Promise<boolean>(resolve => {
    const timeout = setTimeout(() => {
      console.error('   WebSocket connection timeout');
      resolve(false);
    }, 10_000);

    socket.onopen = () => {
      socket.send(
        JSON.stringify({ method: 'hello', params: [], id: -1, binary: false, compression: false })
      );
    };

    socket.onmessage = async (event: MessageEvent) => {
      const raw = event.data instanceof Blob ? await event.data.text() : String(event.data);
      const data = JSON.parse(raw);
      if (data.id === -1 && data.result === 'hello') {
        clearTimeout(timeout);
        console.log(`   Connected! Server version: ${data.serverVersion ?? 'unknown'}`);
        resolve(true);
      }
    };

    socket.onerror = () => {
      clearTimeout(timeout);
      resolve(false);
    };
  });

  if (!connected) {
    console.error('   Failed to connect via WebSocket');
    process.exit(1);
  }

  // ── Step 5: Send TX via WebSocket ──
  sequence++;
  const issueId = `ws-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const issueIdentifier = `${projectIdent}-${sequence}`;

  console.log(`5. Creating issue via WebSocket TX...`);
  console.log(`   ID: ${issueId}`);
  console.log(`   Identifier: ${issueIdentifier}`);
  console.log(`   Title: ${testTitle}`);

  const tx = {
    _id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    _class: 'core:class:TxCreateDoc',
    space: 'core:space:Tx',
    objectId: issueId,
    objectClass: 'tracker:class:Issue',
    objectSpace: spaceId,
    modifiedBy: socialId,
    modifiedOn: Date.now(),
    attributes: {
      title: testTitle,
      description: `Created via WebSocket TX test at ${timestamp}`,
      status: defaultStatus,
      number: sequence,
      identifier: issueIdentifier,
      kind: 'tracker:taskTypes:Issue',
      priority: 0,
      component: null,
      assignee: null,
      estimation: 0,
      remainingTime: 0,
      reportedTime: 0,
      reports: 0,
      subIssues: 0,
      parents: [],
      childInfo: [],
      relations: [],
      dueDate: null,
      rank: '0|hzzzzz:',
      comments: 0,
      // CRITICAL: Collection fields required for LiveQuery visibility
      attachedTo: 'tracker:ids:NoParent',
      attachedToClass: 'tracker:class:Issue',
      collection: 'subIssues',
    },
  };

  const txResult = await new Promise<unknown>((resolve, reject) => {
    const reqId = 1;
    const timeout = setTimeout(() => reject(new Error('TX timeout (30s)')), 30_000);

    const handler = async (event: MessageEvent) => {
      const raw = event.data instanceof Blob ? await event.data.text() : String(event.data);
      const data = JSON.parse(raw);
      if (data.id === reqId) {
        clearTimeout(timeout);
        socket.removeEventListener('message', handler);
        if (data.error) {
          reject(new Error(`TX error: ${JSON.stringify(data.error)}`));
        } else {
          resolve(data.result);
        }
      }
    };
    socket.addEventListener('message', handler);

    socket.send(JSON.stringify({ method: 'tx', params: [tx], id: reqId, time: Date.now() }));
  });

  console.log(`   TX result: ${JSON.stringify(txResult)}`);

  // ── Step 6: Also update project sequence ──
  console.log(`6. Updating project sequence → ${sequence}...`);
  const seqTx = {
    _id: `tx-seq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    _class: 'core:class:TxUpdateDoc',
    space: 'core:space:Tx',
    objectId: spaceId,
    objectClass: 'tracker:class:Project',
    objectSpace: 'core:space:Space',
    modifiedBy: socialId,
    modifiedOn: Date.now(),
    operations: { sequence },
  };

  const seqResult = await new Promise<unknown>((resolve, reject) => {
    const reqId = 2;
    const timeout = setTimeout(() => reject(new Error('Seq TX timeout')), 30_000);

    const handler = async (event: MessageEvent) => {
      const raw = event.data instanceof Blob ? await event.data.text() : String(event.data);
      const data = JSON.parse(raw);
      if (data.id === reqId) {
        clearTimeout(timeout);
        socket.removeEventListener('message', handler);
        resolve(data.result);
      }
    };
    socket.addEventListener('message', handler);

    socket.send(JSON.stringify({ method: 'tx', params: [seqTx], id: reqId, time: Date.now() }));
  });
  console.log(`   Seq TX result: ${JSON.stringify(seqResult)}`);

  // ── Step 7: Verify via REST findAll ──
  console.log('7. Verifying issue exists via REST findAll...');
  const findUrl =
    `${HULY_URL}/_transactor/api/v1/find-all/${workspaceId}` +
    `?class=${encodeURIComponent('tracker:class:Issue')}&options=${encodeURIComponent(JSON.stringify({ limit: 500 }))}`;
  const findRes = await fetch(findUrl, { headers: { Authorization: `Bearer ${workspaceToken}` } });
  const findBody = await findRes.json();
  const issues: Record<string, unknown>[] = Array.isArray(findBody)
    ? findBody
    : (findBody?.value ?? findBody?.docs ?? []);

  const found = issues.find(i => String(i._id) === issueId);
  if (found) {
    console.log(`   FOUND: ${found.identifier} — "${found.title}"`);
    console.log(`   Status: ${found.status}, Number: ${found.number}`);
  } else {
    console.error(`   NOT FOUND in findAll results (${issues.length} total issues)`);
  }

  // ── Step 8: Close ──
  socket.close();
  console.log('\n8. WebSocket closed.');
  console.log(`\n── Result ──`);
  console.log(`Issue created: ${issueIdentifier} — "${testTitle}"`);
  console.log(`Verify in UI: ${HULY_URL}/workbench/${HULY_WORKSPACE}/tracker/${issueIdentifier}`);
  console.log(`Or check project issues list in Huly Tracker.`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
