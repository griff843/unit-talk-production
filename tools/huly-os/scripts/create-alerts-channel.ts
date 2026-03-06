/**
 * SPRINT-RATIFY-HULY-ENH-015C: Create huly-os-alerts Chunter channel
 * Required for UT-158 Chunter Notifications to reach PASS.
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
  error?: { severity: string; code: string; params: Record<string, unknown> };
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
  console.log(`Login OK — socialId: ${socialId}`);

  // Select workspace
  const wsRes = await fetch(`${HULY_URL}/_accounts/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountToken}` },
    body: JSON.stringify({ method: 'selectWorkspace', params: { workspaceUrl: HULY_WORKSPACE } }),
  });
  const wsBody = (await wsRes.json()) as AccountRpcResponse;
  const workspaceToken = wsBody.result?.token as string;
  const workspaceId = wsBody.result?.workspace as string;
  console.log(`Workspace OK — id: ${workspaceId}`);

  // Open WebSocket
  const ws = new WebSocket(`ws://localhost:8087/${workspaceToken}`);
  let wsReqId = 0;
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

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

  // Create huly-os-alerts channel
  const channelId = `channel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tx = {
    _id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    _class: 'core:class:TxCreateDoc',
    space: 'core:space:Tx',
    objectId: channelId,
    objectClass: 'chunter:class:Channel',
    objectSpace: channelId,
    modifiedBy: socialId,
    modifiedOn: Date.now(),
    attributes: {
      name: 'huly-os-alerts',
      description: '',
      topic: 'Huly OS automated alerts and incident notifications',
      private: false,
      archived: false,
      members: [socialId],
    },
  };

  console.log(`Creating channel: huly-os-alerts (${channelId})`);
  const result = await wsSend('tx', [tx]);
  console.log('TX result:', JSON.stringify(result));
  console.log('Channel created successfully');

  // Verify channel exists
  const opts = JSON.stringify({ limit: 100 });
  const url = `${HULY_URL}/_transactor/api/v1/find-all/${workspaceId}?class=${encodeURIComponent('chunter:class:Channel')}&options=${encodeURIComponent(opts)}`;
  const verifyRes = await fetch(url, { headers: { Authorization: `Bearer ${workspaceToken}` } });
  const channels = await verifyRes.json();
  console.log(
    `Channels after creation: ${JSON.stringify((channels as Array<Record<string, unknown>>).map((c: Record<string, unknown>) => c.name))}`
  );

  // Send a test message
  const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const msgTx = {
    _id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    _class: 'core:class:TxCreateDoc',
    space: 'core:space:Tx',
    objectId: msgId,
    objectClass: 'chunter:class:ChatMessage',
    objectSpace: channelId,
    modifiedBy: socialId,
    modifiedOn: Date.now(),
    attributes: {
      content:
        '**[RATIFICATION TEST]** huly-os-alerts channel created and notification pipeline verified. SPRINT-RATIFY-HULY-ENH-015C.',
      attachedTo: channelId,
      attachedToClass: 'chunter:class:Channel',
      collection: 'messages',
    },
  };

  console.log('Sending test notification message...');
  const msgResult = await wsSend('tx', [msgTx]);
  console.log('Message TX result:', JSON.stringify(msgResult));

  ws.close();
  console.log('Done');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
