// P0 Enhancement 3: Test Document visibility in Huly UI
// Creates a test document via HulyAdapter.upsertDoc() and verifies it exists.
// Usage: npx tsx scripts/doc-visibility-test.ts

import { resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: resolve(import.meta.dirname ?? '.', '..', '.env') });

const HULY_URL = process.env.HULY_URL ?? 'http://localhost:8087';
const HULY_EMAIL = process.env.HULY_EMAIL ?? 'ops@unit-talk.local';
const HULY_PASSWORD = process.env.HULY_PASSWORD ?? 'password';
const HULY_WORKSPACE = process.env.HULY_WORKSPACE ?? 'unit-talk';
const TEAMSPACE = process.env.HULY_TEAMSPACE ?? 'Operations';

interface RpcResponse {
  result?: Record<string, unknown>;
  error?: { code: string };
}

async function main(): Promise<void> {
  const timestamp = new Date().toISOString();
  console.log(`\nDocument Visibility Test — ${timestamp}`);
  console.log(`URL: ${HULY_URL}`);
  console.log(`Teamspace: ${TEAMSPACE}\n`);

  // ── Authenticate ──
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

  // ── Connect WebSocket ──
  console.log('3. Connecting WebSocket...');
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
  console.log('   Connected.\n');

  let reqId = 0;

  // ── Find or create teamspace ──
  console.log(`4. Resolving teamspace "${TEAMSPACE}"...`);
  const teamspaces = await findAll(workspaceToken, workspaceId, 'document:class:Teamspace', 50);
  let teamspaceId = teamspaces.find(t => String(t.name) === TEAMSPACE)?._id as string | undefined;

  if (!teamspaceId) {
    console.log(`   Creating teamspace "${TEAMSPACE}"...`);
    teamspaceId = `teamspace-${Date.now()}`;
    reqId++;
    const tx = buildTx(socialId, {
      _class: 'core:class:TxCreateDoc',
      objectId: teamspaceId,
      objectClass: 'document:class:Teamspace',
      objectSpace: 'core:space:Space',
      attributes: {
        name: TEAMSPACE,
        description: `${TEAMSPACE} — auto-created by doc-visibility-test`,
        private: false,
        archived: false,
        members: [socialId],
      },
    });
    await wsSend(socket, tx, reqId);
    console.log(`   Created: ${teamspaceId}`);
  } else {
    teamspaceId = String(teamspaceId);
    console.log(`   Found: ${teamspaceId}`);
  }

  // ── Fetch existing docs for comparison ──
  console.log('\n5. Listing existing documents...');
  const existingDocs = await findAll(workspaceToken, workspaceId, 'document:class:Document', 100);
  console.log(`   Found ${existingDocs.length} documents`);
  for (const doc of existingDocs.slice(0, 5)) {
    console.log(`   - "${doc.title}" (${doc._id}) space=${doc.space}`);
    // Show all fields for first doc to understand structure
    if (doc === existingDocs[0]) {
      const keys = Object.keys(doc).sort();
      console.log(`     Fields: ${keys.join(', ')}`);
    }
  }

  // ── Create test document ──
  const docTitle = `[DOC-TEST] ${timestamp}`;
  const docContent = `# Document Visibility Test\n\nCreated: ${timestamp}\n\nThis document was created via WebSocket TX to test Huly Documents UI visibility.`;
  const docId = `doc-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  console.log(`\n6. Creating test document...`);
  console.log(`   Title: ${docTitle}`);
  console.log(`   ID: ${docId}`);
  console.log(`   Space: ${teamspaceId}`);

  reqId++;
  const docTx = buildTx(socialId, {
    _class: 'core:class:TxCreateDoc',
    objectId: docId,
    objectClass: 'document:class:Document',
    objectSpace: teamspaceId,
    attributes: {
      title: docTitle,
      content: docContent,
    },
  });
  await wsSend(socket, docTx, reqId);
  console.log('   Document created via WebSocket TX.');

  // ── Verify via REST ──
  console.log('\n7. Verifying via REST findAll...');
  const allDocs = await findAll(workspaceToken, workspaceId, 'document:class:Document', 200);
  const found = allDocs.find(d => String(d._id) === docId);
  if (found) {
    console.log(`   FOUND: "${found.title}" (${found._id})`);
    console.log(`   All fields: ${JSON.stringify(found, null, 2)}`);
  } else {
    console.log(`   NOT FOUND in ${allDocs.length} documents.`);
  }

  // ── Also compare with a UI-created doc if one exists ──
  if (existingDocs.length > 0) {
    const uiDoc = existingDocs[0];
    console.log('\n8. Comparing with existing document (likely UI-created):');
    console.log(`   Existing: ${JSON.stringify(uiDoc, null, 2)}`);
    if (found) {
      const existingKeys = new Set(Object.keys(uiDoc));
      const newKeys = new Set(Object.keys(found));
      const missingInNew = [...existingKeys].filter(k => !newKeys.has(k));
      const extraInNew = [...newKeys].filter(k => !existingKeys.has(k));
      if (missingInNew.length > 0) {
        console.log(`\n   MISSING in TX doc (present in existing): ${missingInNew.join(', ')}`);
      }
      if (extraInNew.length > 0) {
        console.log(`   EXTRA in TX doc (not in existing): ${extraInNew.join(', ')}`);
      }
    }
  }

  socket.close();
  console.log('\n9. Done.');
  console.log(`\nVerify in Huly UI: ${HULY_URL}/workbench/${HULY_WORKSPACE}/documents`);
  console.log('Check if the test document appears in the Documents page.');
}

function buildTx(socialId: string, fields: Record<string, unknown>): Record<string, unknown> {
  return {
    _id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    space: 'core:space:Tx',
    modifiedBy: socialId,
    modifiedOn: Date.now(),
    ...fields,
  };
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
