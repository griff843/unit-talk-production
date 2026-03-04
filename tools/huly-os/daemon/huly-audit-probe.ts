// Huly capability audit probe — queries all known classes to build factual inventory
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: resolve(import.meta.dirname ?? '.', '..', '.env') });

interface Session {
  baseUrl: string;
  workspaceToken: string;
  workspaceId: string;
  socialId: string;
}

async function connect(): Promise<Session> {
  const baseUrl = (process.env.HULY_URL ?? 'http://localhost:8087').replace(/\/$/, '');
  const loginRes = await fetch(`${baseUrl}/_accounts/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'login',
      params: { email: process.env.HULY_EMAIL, password: process.env.HULY_PASSWORD },
    }),
  });
  const loginBody = (await loginRes.json()) as any;
  if (loginBody.error) throw new Error(`Login: ${loginBody.error.code}`);
  const accountToken = loginBody.result.token;
  const socialId = String(loginBody.result.socialId ?? '');

  const wsRes = await fetch(`${baseUrl}/_accounts/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountToken}` },
    body: JSON.stringify({
      method: 'selectWorkspace',
      params: { workspaceUrl: process.env.HULY_WORKSPACE ?? 'ws1' },
    }),
  });
  const wsBody = (await wsRes.json()) as any;
  if (wsBody.error) throw new Error(`selectWorkspace: ${wsBody.error.code}`);

  return {
    baseUrl,
    workspaceToken: wsBody.result.token,
    workspaceId: wsBody.result.workspace,
    socialId,
  };
}

async function findAll(
  s: Session,
  cls: string,
  opts: Record<string, unknown> = {}
): Promise<any[]> {
  const options = JSON.stringify({ limit: 500, ...opts });
  const url = `${s.baseUrl}/_transactor/api/v1/find-all/${s.workspaceId}?class=${encodeURIComponent(cls)}&options=${encodeURIComponent(options)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${s.workspaceToken}` } });
  if (!res.ok) return [];
  const body = await res.json();
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.value)) return body.value;
  if (Array.isArray(body?.docs)) return body.docs;
  if (Array.isArray(body?.result)) return body.result;
  return [];
}

async function tryClass(
  s: Session,
  cls: string
): Promise<{ cls: string; count: number; sample: any[] }> {
  try {
    const items = await findAll(s, cls);
    return { cls, count: items.length, sample: items.slice(0, 5) };
  } catch {
    return { cls, count: -1, sample: [] };
  }
}

async function main() {
  console.log('Connecting...');
  const s = await connect();
  console.log(`Connected: workspace=${s.workspaceId}\n`);

  // Comprehensive class list to probe
  const classesToProbe = [
    // Core
    'core:class:Space',
    'core:class:Account',
    'core:class:Role',
    'core:class:Permission',
    'core:class:TypedSpace',
    'core:class:Status',
    'core:class:StatusCategory',
    // Tracker
    'tracker:class:Project',
    'tracker:class:Issue',
    'tracker:class:IssueStatus',
    'tracker:class:IssueTemplate',
    'tracker:class:IssueCategory',
    'tracker:class:Component',
    'tracker:class:Milestone',
    'tracker:class:Sprint',
    'tracker:class:TimeSpentReport',
    'tracker:class:RelatedIssue',
    'tracker:class:IssueRelation',
    'tracker:class:IssuePriority',
    // Documents
    'document:class:Document',
    'document:class:Teamspace',
    'documents:class:Document',
    'documents:class:DocumentSpace',
    'documents:class:OrgSpace',
    'documents:class:Teamspace',
    // Chunter (chat/comments)
    'chunter:class:Channel',
    'chunter:class:ChatMessage',
    'chunter:class:ThreadMessage',
    'chunter:class:DirectMessage',
    // HR / Training
    'hr:class:Department',
    'hr:class:Employee',
    'training:class:Training',
    'training:class:TrainingAttempt',
    // Board (kanban)
    'board:class:Board',
    'board:class:Card',
    // Tags / Labels
    'tags:class:TagElement',
    'tags:class:TagReference',
    'tag:class:Tag',
    'label:class:ProjectLabel',
    // Lead / CRM
    'lead:class:Lead',
    'lead:class:Funnel',
    // Automation
    'automation:class:Automation',
    'automation:class:AutomationTrigger',
    // Notification
    'notification:class:NotificationProvider',
    'notification:class:NotificationSetting',
    // Survey
    'survey:class:Survey',
    // Calendar
    'calendar:class:Event',
    // Card
    'card:class:Card',
    'card:class:CardSpace',
    // Drive
    'drive:class:Drive',
    'drive:class:FileVersion',
    // Process / Workflow
    'process:class:Process',
    'process:class:ProcessStep',
    // Webhook
    'webhook:class:Webhook',
    'integration:class:Integration',
    // Templates
    'templates:class:TemplateCategory',
    // Time tracking
    'time:class:ToDo',
    'time:class:WorkSlot',
    // Relations
    'relations:class:Relation',
    'chunter:class:Activity',
    'activity:class:ActivityMessage',
  ];

  const results: Record<string, { count: number; sample: any[] }> = {};

  for (const cls of classesToProbe) {
    const r = await tryClass(s, cls);
    results[cls] = { count: r.count, sample: r.sample };
    const status = r.count === -1 ? 'ERROR' : r.count === 0 ? 'empty' : `${r.count} items`;
    console.log(`  ${cls}: ${status}`);
  }

  // Also probe the REST API endpoints
  console.log('\n── API Endpoint Probe ──');
  const endpoints = [
    {
      path: `/_transactor/api/v1/find-all/${s.workspaceId}?class=core:class:Space&options=${encodeURIComponent(JSON.stringify({ limit: 1 }))}`,
      name: 'find-all',
    },
    {
      path: `/_transactor/api/v1/search-fulltext/${s.workspaceId}?query=test&limit=1`,
      name: 'search-fulltext',
    },
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(`${s.baseUrl}${ep.path}`, {
        headers: { Authorization: `Bearer ${s.workspaceToken}` },
      });
      console.log(`  ${ep.name}: HTTP ${res.status}`);
    } catch (err) {
      console.log(`  ${ep.name}: FAILED — ${err instanceof Error ? err.message : err}`);
    }
  }

  // Check for webhook endpoints
  console.log('\n── Webhook / Integration Probe ──');
  const webhookPaths = [
    '/_api/webhooks',
    '/api/webhooks',
    '/api/v1/webhooks',
    '/webhooks',
    '/_transactor/api/v1/webhooks',
    '/api/integration',
  ];

  for (const wp of webhookPaths) {
    try {
      const res = await fetch(`${s.baseUrl}${wp}`, {
        headers: { Authorization: `Bearer ${s.workspaceToken}` },
      });
      console.log(`  ${wp}: HTTP ${res.status} (${res.headers.get('content-type') ?? 'unknown'})`);
    } catch (err) {
      console.log(`  ${wp}: FAILED — ${err instanceof Error ? err.message : err}`);
    }
  }

  // Account RPC methods probe
  console.log('\n── Account RPC Methods Probe ──');
  const rpcMethods = ['getWorkspaces', 'getUserInfo', 'getMembers', 'getPermissions', 'getRoles'];

  for (const method of rpcMethods) {
    try {
      const res = await fetch(`${s.baseUrl}/_accounts/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${s.workspaceToken}`,
        },
        body: JSON.stringify({ method, params: {} }),
      });
      const body = (await res.json()) as any;
      const status = body.error ? `ERROR: ${body.error.code}` : `OK (${typeof body.result})`;
      console.log(`  ${method}: ${status}`);
      if (body.result && !body.error) {
        const preview = JSON.stringify(body.result).slice(0, 200);
        console.log(`    → ${preview}`);
      }
    } catch (err) {
      console.log(`  ${method}: FAILED`);
    }
  }

  // Write full audit data
  const outDir = resolve(import.meta.dirname ?? '.', '..', '..', '..', 'out', 'audit');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'huly-capability-audit-raw.json');
  writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\nRaw audit data written to: ${outPath}`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
