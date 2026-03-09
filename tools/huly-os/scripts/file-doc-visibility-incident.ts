/**
 * File Huly incident for UT-153: Document UI visibility bug.
 * TX-created documents not visible in Documents UI due to content format mismatch.
 */
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import { config as dotenvConfig } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '..', '.env') });

const HULY_URL = process.env.HULY_URL ?? 'http://localhost:8087';
const HULY_EMAIL = process.env.HULY_EMAIL ?? '';
const HULY_PASSWORD = process.env.HULY_PASSWORD ?? '';
const HULY_WORKSPACE = process.env.HULY_WORKSPACE ?? 'unit-talk';

interface AccountRpcResponse {
  result?: Record<string, unknown>;
}

async function main(): Promise<void> {
  // Login
  const loginRes = await fetch(`${HULY_URL}/_accounts/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'login',
      params: { email: HULY_EMAIL, password: HULY_PASSWORD },
    }),
  });
  const loginBody = (await loginRes.json()) as AccountRpcResponse;
  const accountToken = loginBody.result?.token as string;
  const socialId = String(loginBody.result?.socialId ?? '');

  // Select workspace
  const wsRes = await fetch(`${HULY_URL}/_accounts/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountToken}` },
    body: JSON.stringify({ method: 'selectWorkspace', params: { workspaceUrl: HULY_WORKSPACE } }),
  });
  const wsBody = (await wsRes.json()) as AccountRpcResponse;
  const workspaceToken = wsBody.result?.token as string;
  const workspaceId = wsBody.result?.workspace as string;

  // Find UT project
  const projOpts = JSON.stringify({ limit: 50 });
  const projUrl = `${HULY_URL}/_transactor/api/v1/find-all/${workspaceId}?class=${encodeURIComponent('tracker:class:Project')}&options=${encodeURIComponent(projOpts)}`;
  const projRes = await fetch(projUrl, { headers: { Authorization: `Bearer ${workspaceToken}` } });
  const projBody = await projRes.json();
  let projects: Record<string, unknown>[] = [];
  if (Array.isArray(projBody)) projects = projBody;
  else {
    const pb = projBody as Record<string, unknown>;
    if (Array.isArray(pb?.result)) projects = pb.result as Record<string, unknown>[];
    else if (Array.isArray(pb?.value)) projects = pb.value as Record<string, unknown>[];
    else if (Array.isArray(pb?.docs)) projects = pb.docs as Record<string, unknown>[];
    else console.log('Raw project response:', JSON.stringify(projBody).substring(0, 500));
  }
  console.log(
    `Found ${projects.length} projects:`,
    projects.map(p => `${p.identifier}/${p.name}`).join(', ')
  );
  const utProject = projects.find(p => p.identifier === 'UT');
  if (!utProject) {
    console.error('UT project not found');
    return;
  }
  const projectId = utProject._id as string;
  console.log(`Found UT project: ${projectId}`);

  // Open WebSocket
  const ws = new WebSocket(`ws://localhost:8087/${workspaceToken}`);
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  let wsReqId = 0;

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('WS timeout')), 10000);
    ws.onopen = () => {
      ws.send(JSON.stringify({ method: 'hello', id: -1, binary: false, compression: false }));
    };
    ws.onmessage = async (event: MessageEvent) => {
      const raw = event.data instanceof Blob ? await event.data.text() : String(event.data);
      try {
        const msg = JSON.parse(raw);
        if (msg.id === -1) {
          clearTimeout(timeout);
          resolve();
          return;
        }
        const p = pending.get(msg.id);
        if (p) {
          pending.delete(msg.id);
          if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
          else p.resolve(msg.result);
        }
      } catch {
        /* broadcast */
      }
    };
    ws.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('WS error'));
    };
  });
  console.log('WS connected');

  function wsSend(method: string, params: unknown[]): Promise<unknown> {
    const id = ++wsReqId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('TX timeout'));
      }, 15000);
      pending.set(id, {
        resolve: v => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: e => {
          clearTimeout(timer);
          reject(e);
        },
      });
      ws.send(JSON.stringify({ method, params, id, time: Date.now() }));
    });
  }

  // Create incident issue
  const issueId = `incident-doc-vis-${Date.now()}`;
  const title =
    '[INCIDENT] Document UI visibility — TX-created docs not renderable in Documents page';
  const description = `## Incident: Document UI Visibility Bug

**Sprint:** SPRINT-RATIFY-HULY-ENH-015C
**Enhancement:** UT-153 (Document Sync / Teamspace)
**Severity:** Medium — API layer works, UI layer broken
**Status:** PARTIAL

### Problem
Documents created via WebSocket TX are not visible in the Huly Documents UI, despite having correct database fields (\`parent\`, \`rank\`, \`attachments\`, etc.).

### Root Cause
- **UI-created documents** store a Collaborator service reference in the \`content\` field: \`"69a6e421972d134b5e8c1260-content-1772545066195"\`
- **TX-created documents** store raw markdown in the \`content\` field: \`"# Daily Reality Report..."\`
- The Documents UI renders content via the Collaborator service (Y.js/Tiptap). TX-created docs bypass this service, so the UI shows "Object doesn't exist or you are not permitted to access it."

### Evidence
- 10 documents exist in DB (verified via REST API)
- 9/10 have correct \`parent\` + \`rank\` fields
- Documents page shows blank — no sidebar, no teamspace tree
- Direct doc URL navigation → "Object doesn't exist" error
- Console error: \`Could not find document n1zw25\`

### Fix Required
\`upsertDoc()\` in \`huly-adapter.ts:601-668\` must:
1. Create a Y.js collaborative document via the Collaborator service
2. Store the collaborator document reference in the \`content\` field
3. OR find an alternative API to import markdown into the Collaborator

### Proof Location
\`out/sprints/SPRINT-RATIFY-HULY-ENH-015C/2026-03-04/proofs/enh3_content_format_comparison.json\``;

  const tx = {
    _id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    _class: 'core:class:TxCreateDoc',
    space: 'core:space:Tx',
    objectId: issueId,
    objectClass: 'tracker:class:Issue',
    objectSpace: projectId,
    modifiedBy: socialId,
    modifiedOn: Date.now(),
    attributes: {
      title,
      description,
      status: 'tracker:status:Backlog',
      priority: 1,
      number: 0,
      kind: 'tracker:taskTypes:Issue',
      identifier: 'UT',
      rank: '0|hzzzzz:',
      attachedTo: 'tracker:ids:NoParent',
      attachedToClass: 'tracker:class:Issue',
      collection: 'subIssues',
      parents: [],
      childInfo: [],
      relations: [],
      comments: 0,
    },
  };

  console.log('Creating incident issue...');
  const result = await wsSend('tx', [tx]);
  console.log('TX result:', JSON.stringify(result));
  console.log(`Incident filed: ${title}`);

  ws.close();
  console.log('Done');
}

main().catch(console.error);
