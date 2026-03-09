// SPRINT-HULY-REST-LIVEQUERY-BRIDGE-017: Create enhancement issues in Huly
// Usage: npx tsx scripts/create-enhancement-issues.ts

import { resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: resolve(import.meta.dirname ?? '.', '..', '.env') });

const HULY_URL = process.env.HULY_URL ?? 'http://localhost:8087';
const HULY_EMAIL = process.env.HULY_EMAIL ?? 'ops@unit-talk.local';
const HULY_PASSWORD = process.env.HULY_PASSWORD ?? 'password';
const HULY_WORKSPACE = process.env.HULY_WORKSPACE ?? 'unit-talk';
const PROJECT = 'UT';

interface RpcResponse {
  result?: Record<string, unknown>;
  error?: { code: string };
}

interface Enhancement {
  title: string;
  status: string;
  body: string;
}

const ENHANCEMENTS: Enhancement[] = [
  // ── P0 — In Progress (drift-critical) ──
  {
    title: '[ENH][P0] Bidirectional GitHub↔Huly sync (merge → status update)',
    status: 'tracker:status:InProgress',
    body: `**Owner:** Operator

**Priority:** P0 — Drift-critical

**Description:**
Auto-update Huly issue status when a linked GitHub PR is merged. Currently the link is one-way: operator creates a Huly→GitHub link comment, but PR merge events never flow back to update the Huly issue status. This causes immediate status drift between GitHub and Huly.

**Acceptance Criteria:**
- [ ] When a GitHub PR linked to a Huly issue is merged, the Huly issue status transitions to Done automatically
- [ ] When a PR is opened linking to a Huly issue, the issue transitions to In Progress
- [ ] Idempotent — re-processing the same PR event produces no duplicate transitions
- [ ] Audit log entry for every status transition triggered by GitHub events

**Proof:**
- Operator log showing PR merge → Huly status update
- Huly UI screenshot showing issue moved to Done after PR merge
- Audit JSONL entries for the transition`,
  },
  {
    title: '[ENH][P0] Sprint closeout writes back to Huly (Done + proof links)',
    status: 'tracker:status:InProgress',
    body: `**Owner:** Operator

**Priority:** P0 — Governance-critical

**Description:**
When \`sprint:close\` runs, automatically update all sprint-related Huly issues to Done, attach proof artifact links to each issue, and mark the sprint as closed in the Huly tracker. Currently sprint closeout generates local proof artifacts but never writes back to Huly, leaving sprint issues in stale states.

**Acceptance Criteria:**
- [ ] \`sprint:close <SPRINT-ID>\` updates all Huly issues tagged with the sprint to Done
- [ ] Each closed issue gets a comment with links to proof artifacts (closeout report, test results, screenshots)
- [ ] Sprint [SPRINT] parent issue is updated with final status summary
- [ ] Idempotent — running closeout twice on the same sprint produces no errors or duplicate comments
- [ ] Works for both completed and partially-completed sprints (partial = some issues stay In Progress with explanation)

**Proof:**
- Huly UI screenshot showing sprint issues moved to Done after closeout
- Comment on each issue with proof links
- Operator audit log showing the closeout write-back`,
  },
  {
    title: '[ENH][P0] Reports + closeouts upsert to Huly Documents',
    status: 'tracker:status:InProgress',
    body: `**Owner:** Operator

**Priority:** P0 — Canonical surface for human review

**Description:**
Reality reports and sprint closeout reports currently publish to Huly issues/comments. They should also upsert into Huly Documents (teamspace) as the canonical human-readable surface. Documents provide better formatting, navigation, and organization than issue comments.

**Acceptance Criteria:**
- [ ] Daily reality reports upsert into a Documents teamspace (e.g., "Operator Reports")
- [ ] Sprint closeout reports upsert into a "Sprint Archives" teamspace document
- [ ] Documents are created with proper titles and markdown formatting
- [ ] Existing documents are updated (not duplicated) on re-run
- [ ] Document creation uses WebSocket TX for UI visibility

**Proof:**
- Huly Documents page screenshot showing reality report document
- Huly Documents page screenshot showing sprint closeout document
- Before/after comparison (empty Documents → populated)`,
  },

  // ── P1 — Backlog (high value) ──
  {
    title: '[ENH][P1] Huly WebSocket listener for UI-driven changes',
    status: 'tracker:status:Backlog',
    body: `**Owner:** Operator

**Priority:** P1 — Enables reactive automation

**Description:**
Subscribe to Huly WebSocket broadcasts to react to UI-created changes. When someone manually moves an issue to "Done" in the Huly UI, trigger downstream actions (e.g., verify proof exists, update GitHub, log audit entry). Currently the operator only pushes data to Huly — it never listens.

**Acceptance Criteria:**
- [ ] Operator daemon subscribes to WebSocket broadcast messages for the workspace
- [ ] Issue status changes detected and logged to audit trail
- [ ] Configurable reaction rules (e.g., "on Done → check proof", "on In Progress → verify branch exists")
- [ ] Graceful reconnection on WebSocket disconnect

**Proof:**
- Operator log showing detection of a manual Huly UI status change
- Audit JSONL entry for the detected change
- Demonstration of a triggered downstream action`,
  },
  {
    title: '[ENH][P1] Custom status workflow mapped to sprint phases',
    status: 'tracker:status:Backlog',
    body: `**Owner:** Operator

**Priority:** P1 — Process alignment

**Description:**
Current Huly statuses are generic (Backlog/Todo/InProgress/Done). Should map to our sprint governance phases (Planning/Implementing/Verifying/Closing) for better alignment between the sprint protocol and the Huly tracker.

**Acceptance Criteria:**
- [ ] Custom status categories created in Huly workspace matching sprint phases
- [ ] Operator auto-transitions issues through phase-aligned statuses as sprint progresses
- [ ] Mapping documented in operator config
- [ ] Backward-compatible — existing generic statuses still work

**Proof:**
- Huly UI screenshot showing custom status categories
- Operator log showing phase-aligned status transitions`,
  },

  // ── P2 — Backlog (nice-to-have) ──
  {
    title: '[ENH][P2] Issue templates for sprints/bugs/features',
    status: 'tracker:status:Backlog',
    body: `**Owner:** Operator

**Priority:** P2 — Consistency and structure

**Description:**
Operator currently creates issues with plain text descriptions. Should use structured templates (sprint issues, bug reports, feature requests, enhancement requests) with standardized fields, acceptance criteria sections, and proof fields.

**Acceptance Criteria:**
- [ ] Template registry with at least 4 templates: Sprint, Bug, Feature, Enhancement
- [ ] Each template includes: Owner, Priority, Description, Acceptance Criteria, Proof fields
- [ ] Operator CLI \`--template=sprint\` flag selects template
- [ ] Templates are defined as TypeScript objects (not external files) for type safety

**Proof:**
- Huly UI screenshot showing a template-created issue with all structured fields
- Operator CLI output showing template selection`,
  },
  {
    title: '[ENH][P2] Real-time dashboard view',
    status: 'tracker:status:Backlog',
    body: `**Owner:** Operator

**Priority:** P2 — Operational visibility

**Description:**
LiveQuery integration for a command-center view that updates in real-time as issues change status. Currently the command center reads stale data from periodic API calls. A WebSocket subscription would provide instant updates.

**Acceptance Criteria:**
- [ ] Command center connects to Huly WebSocket and receives real-time issue updates
- [ ] Dashboard shows live issue counts by status (Backlog/In Progress/Done)
- [ ] Sprint progress bar updates without manual refresh
- [ ] Graceful fallback to polling if WebSocket unavailable

**Proof:**
- Screenshot/recording showing dashboard updating in real-time after Huly UI change
- Console log showing WebSocket broadcast reception`,
  },
  {
    title: '[ENH][P2] Chunter notifications for operator activity',
    status: 'tracker:status:Backlog',
    body: `**Owner:** Operator

**Priority:** P2 — Team awareness

**Description:**
Leverage Huly's Chunter (chat/messaging) to post operator activity summaries, drift alerts, and CI status updates as workspace messages. This provides a real-time activity feed visible to all workspace members without requiring them to check individual issues.

**Acceptance Criteria:**
- [ ] Operator posts daily summary to a Chunter channel
- [ ] Drift violations are posted as alerts to Chunter
- [ ] CI status changes (pass→fail, fail→pass) are posted
- [ ] Messages use proper Huly markdown formatting
- [ ] Configurable channel target

**Proof:**
- Huly Chunter screenshot showing operator activity message
- Huly Chunter screenshot showing drift alert
- Operator audit log showing Chunter message sends`,
  },
];

async function main(): Promise<void> {
  console.log(`\nCreating ${ENHANCEMENTS.length} enhancement issues in Huly (${PROJECT})...\n`);

  // ── Authenticate ──
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

  // ── Find project ──
  const projects = await findAll(workspaceToken, workspaceId, 'tracker:class:Project', 20);
  const project = projects.find(p => String(p.identifier) === PROJECT);
  if (!project) throw new Error(`Project "${PROJECT}" not found`);
  const spaceId = String(project._id);
  const projectIdent = String(project.identifier);
  let sequence = typeof project.sequence === 'number' ? project.sequence : 0;
  console.log(`Project: ${projectIdent} (${spaceId}), sequence=${sequence}\n`);

  // ── Connect WebSocket ──
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
  console.log('WebSocket connected.\n');

  let reqId = 0;

  for (const enh of ENHANCEMENTS) {
    sequence++;
    const issueId = `enh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const identifier = `${projectIdent}-${sequence}`;

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
        title: enh.title,
        description: enh.body,
        status: enh.status,
        number: sequence,
        identifier,
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
        attachedTo: 'tracker:ids:NoParent',
        attachedToClass: 'tracker:class:Issue',
        collection: 'subIssues',
      },
    };

    reqId++;
    await wsSend(socket, tx, reqId);
    const statusLabel = enh.status.split(':').pop();
    console.log(`  ✓ ${identifier} [${statusLabel}] — ${enh.title}`);

    await new Promise(r => setTimeout(r, 100));
  }

  // Update project sequence
  reqId++;
  const seqTx = {
    _id: `tx-seq-${Date.now()}`,
    _class: 'core:class:TxUpdateDoc',
    space: 'core:space:Tx',
    objectId: spaceId,
    objectClass: 'tracker:class:Project',
    objectSpace: 'core:space:Space',
    modifiedBy: socialId,
    modifiedOn: Date.now(),
    operations: { sequence },
  };
  await wsSend(socket, seqTx, reqId);

  socket.close();
  console.log(
    `\nDone. Created ${ENHANCEMENTS.length} issues (${projectIdent}-${sequence - ENHANCEMENTS.length + 1} → ${projectIdent}-${sequence}).`
  );
  console.log(`Project sequence updated to ${sequence}.`);
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
