/**
 * assign-milestones-and-labels.ts
 *
 * Creates native Huly milestones, links issues to them, creates label
 * definitions, and assigns labels to issues based on title patterns.
 *
 * Usage:
 *   npx tsx scripts/assign-milestones-and-labels.ts              # dry-run
 *   npx tsx scripts/assign-milestones-and-labels.ts --live        # live run
 *   npx tsx scripts/assign-milestones-and-labels.ts --live --milestones-only
 *   npx tsx scripts/assign-milestones-and-labels.ts --live --labels-only
 *   npx tsx scripts/assign-milestones-and-labels.ts --probe-only  # just probe TX capabilities
 */

import { resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: resolve(import.meta.dirname ?? '.', '..', '.env') });

const HULY_URL = (process.env.HULY_URL ?? 'http://localhost:8087').replace(/\/$/, '');
const HULY_EMAIL = process.env.HULY_EMAIL ?? 'ops@unit-talk.local';
const HULY_PASSWORD = process.env.HULY_PASSWORD ?? 'password';
const HULY_WORKSPACE = process.env.HULY_WORKSPACE ?? 'unit-talk';

// ── CLI Flags ─────────────────────────────────────────────────────────────

const DRY_RUN = !process.argv.includes('--live');
const MILESTONES_ONLY = process.argv.includes('--milestones-only');
const LABELS_ONLY = process.argv.includes('--labels-only');
const PROBE_ONLY = process.argv.includes('--probe-only');

// ── Types ─────────────────────────────────────────────────────────────────

interface Session {
  accountToken: string;
  workspaceToken: string;
  workspaceId: string;
  socialId: string;
}

interface MilestoneDef {
  label: string;
  projectIdentifier: string;
  description: string;
  sourceIssueTitle: string; // used to find the [MILESTONE] issue
}

interface LabelDef {
  title: string;
  color: number; // Huly uses numeric color codes
  description: string;
}

interface LabelRule {
  labelTitle: string;
  match: (issue: Record<string, unknown>) => boolean;
}

// ── Auth ──────────────────────────────────────────────────────────────────

async function authenticate(): Promise<Session> {
  const loginRes = await fetch(`${HULY_URL}/_accounts/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'login',
      params: { email: HULY_EMAIL, password: HULY_PASSWORD },
    }),
  });
  const loginBody = (await loginRes.json()) as {
    result?: Record<string, unknown>;
    error?: { code: string };
  };
  if (loginBody.error) throw new Error(`Login failed: ${loginBody.error.code}`);

  const accountToken = loginBody.result!.token as string;
  const socialId = String(loginBody.result!.socialId ?? '');

  const wsRes = await fetch(`${HULY_URL}/_accounts/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountToken}` },
    body: JSON.stringify({ method: 'selectWorkspace', params: { workspaceUrl: HULY_WORKSPACE } }),
  });
  const wsBody = (await wsRes.json()) as {
    result?: Record<string, unknown>;
    error?: { code: string };
  };
  if (wsBody.error) throw new Error(`Workspace select failed: ${wsBody.error.code}`);

  return {
    accountToken,
    workspaceToken: wsBody.result!.token as string,
    workspaceId: wsBody.result!.workspace as string,
    socialId,
  };
}

// ── WebSocket ─────────────────────────────────────────────────────────────

let globalReqId = 0;

function connectWs(session: Session): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const wsUrl = HULY_URL.replace(/^http/, 'ws');
    const socket = new WebSocket(`${wsUrl}/${session.workspaceToken}`);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error('WS timeout'));
    }, 15_000);

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
        resolve(socket);
      }
    };
    socket.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('WS error'));
    };
  });
}

async function wsSend(socket: WebSocket, tx: Record<string, unknown>): Promise<unknown> {
  const id = ++globalReqId;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`TX timeout #${id}`)), 30_000);
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

// ── Helpers ───────────────────────────────────────────────────────────────

async function findAll(
  session: Session,
  cls: string,
  limit = 500
): Promise<Record<string, unknown>[]> {
  const opts = JSON.stringify({ limit });
  const url =
    `${HULY_URL}/_transactor/api/v1/find-all/${session.workspaceId}` +
    `?class=${encodeURIComponent(cls)}&options=${encodeURIComponent(opts)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${session.workspaceToken}` } });
  if (!res.ok) throw new Error(`findAll(${cls}) HTTP ${res.status}`);
  const body = await res.json();
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.value)) return body.value;
  if (Array.isArray(body?.result)) return body.result;
  if (Array.isArray(body?.docs)) return body.docs;
  return [];
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildTx(session: Session, fields: Record<string, unknown>): Record<string, unknown> {
  return {
    _id: genId('tx'),
    space: 'core:space:Tx',
    modifiedBy: session.socialId,
    modifiedOn: Date.now(),
    ...fields,
  };
}

// ── Probe Phase ───────────────────────────────────────────────────────────

async function probePhase(
  session: Session,
  ws: WebSocket
): Promise<{
  milestoneOk: boolean;
  labelClassOk: boolean;
  labelRefOk: boolean;
  milestoneStatusValue: string;
  labelObjectSpace: string;
  labelCategoryValue: string;
}> {
  console.log('\n═══ Phase 0: Probe TX API Capabilities ═══\n');

  const projects = await findAll(session, 'tracker:class:Project');
  const devProject = projects.find(p => String(p.identifier) === 'DEV');
  if (!devProject) throw new Error('DEV project not found');
  const devSpaceId = String(devProject._id);
  console.log(`  DEV project space: ${devSpaceId}`);

  // ── Probe 1: Inspect existing TagElements for objectSpace / category ──
  console.log('\n  [Probe 1] Inspecting existing TagElements...');
  const existingTags = await findAll(session, 'tags:class:TagElement', 50);
  let labelObjectSpace = 'core:space:Space'; // default guess
  // IMPORTANT: tracker labels MUST use 'tracker:category:Other' — not the category
  // from existing system tags (which may be 'card:category:Labels' for Card module).
  const labelCategoryValue = 'tracker:category:Other';

  if (existingTags.length > 0) {
    const sample = existingTags[0];
    console.log(`    Found ${existingTags.length} existing TagElement(s)`);
    console.log(`    Sample: ${JSON.stringify(sample, null, 2).substring(0, 500)}`);
    if (sample.space) labelObjectSpace = String(sample.space);
    console.log(`    objectSpace: ${labelObjectSpace}`);
    console.log(`    category: ${labelCategoryValue} (hardcoded for tracker)`);
  } else {
    console.log('    No existing TagElements found. Using defaults.');
  }

  // ── Probe 2: Create a test milestone ──
  console.log('\n  [Probe 2] Creating test milestone...');
  let milestoneOk = false;
  let milestoneStatusValue = 'tracker:status:Planned'; // initial guess

  // Try common status values for milestones
  const statusCandidates = [
    'tracker:status:Planned',
    'tracker:status:InProgress',
    'tracker:status:Todo',
    'tracker:status:Backlog',
  ];

  const testMilestoneId = genId('probe-milestone');

  for (const statusCandidate of statusCandidates) {
    try {
      const tx = buildTx(session, {
        _class: 'core:class:TxCreateDoc',
        objectId: testMilestoneId,
        objectClass: 'tracker:class:Milestone',
        objectSpace: devSpaceId,
        attributes: {
          label: '__PROBE_TEST_MILESTONE__',
          description: '',
          status: statusCandidate,
          targetDate: null,
          comments: 0,
          attachments: 0,
        },
      });
      await wsSend(ws, tx);
      console.log(`    Milestone created with status: ${statusCandidate}`);
      milestoneStatusValue = statusCandidate;
      milestoneOk = true;
      break;
    } catch (e) {
      console.log(
        `    Status "${statusCandidate}" failed: ${(e as Error).message.substring(0, 100)}`
      );
    }
  }

  if (milestoneOk) {
    // Verify it exists
    const milestones = await findAll(session, 'tracker:class:Milestone', 50);
    const found = milestones.find(m => String(m._id) === testMilestoneId);
    if (found) {
      console.log(`    Verified: milestone found via findAll`);
      // Clean up: delete probe milestone
      try {
        const delTx = buildTx(session, {
          _class: 'core:class:TxRemoveDoc',
          objectId: testMilestoneId,
          objectClass: 'tracker:class:Milestone',
          objectSpace: devSpaceId,
        });
        await wsSend(ws, delTx);
        console.log(`    Cleanup: probe milestone deleted`);
      } catch {
        console.log(`    Cleanup: could not delete probe milestone (non-fatal)`);
      }
    } else {
      console.log(`    WARNING: milestone created but not found via findAll`);
    }
  } else {
    console.log(`    FAILED: Could not create milestone with any status value`);
  }

  // ── Probe 3: Create a test label (TagElement) ──
  console.log('\n  [Probe 3] Creating test label (TagElement)...');
  let labelClassOk = false;
  const testLabelId = genId('probe-label');

  try {
    const tx = buildTx(session, {
      _class: 'core:class:TxCreateDoc',
      objectId: testLabelId,
      objectClass: 'tags:class:TagElement',
      objectSpace: labelObjectSpace,
      attributes: {
        title: '__PROBE_TEST_LABEL__',
        color: 0,
        description: 'Probe test',
        targetClass: 'tracker:class:Issue',
        category: labelCategoryValue,
      },
    });
    await wsSend(ws, tx);
    console.log(`    Label TagElement created`);
    labelClassOk = true;

    // Verify
    const labels = await findAll(session, 'tags:class:TagElement', 50);
    const found = labels.find(l => String(l._id) === testLabelId);
    if (found) {
      console.log(`    Verified: label found via findAll`);
    }

    // Clean up
    try {
      const delTx = buildTx(session, {
        _class: 'core:class:TxRemoveDoc',
        objectId: testLabelId,
        objectClass: 'tags:class:TagElement',
        objectSpace: labelObjectSpace,
      });
      await wsSend(ws, delTx);
      console.log(`    Cleanup: probe label deleted`);
    } catch {
      console.log(`    Cleanup: could not delete probe label (non-fatal)`);
    }
  } catch (e) {
    console.log(`    FAILED: ${(e as Error).message.substring(0, 200)}`);
  }

  // ── Probe 4: Create a test TagReference (label assignment) ──
  console.log('\n  [Probe 4] Creating test TagReference (label assignment)...');
  let labelRefOk = false;

  // We need a real issue to attach to
  const issues = await findAll(session, 'tracker:class:Issue', 5);
  if (issues.length > 0 && labelClassOk) {
    const testIssue = issues[0];
    const testIssueId = String(testIssue._id);
    const testRefLabelId = genId('probe-ref-label');
    const testRefId = genId('probe-ref');

    // Create a temporary label for this test
    try {
      const labelTx = buildTx(session, {
        _class: 'core:class:TxCreateDoc',
        objectId: testRefLabelId,
        objectClass: 'tags:class:TagElement',
        objectSpace: labelObjectSpace,
        attributes: {
          title: '__PROBE_REF_LABEL__',
          color: 1,
          description: 'Probe ref test',
          targetClass: 'tracker:class:Issue',
          category: labelCategoryValue,
        },
      });
      await wsSend(ws, labelTx);

      // Create TagReference (must include title/color for sidebar display)
      const refTx = buildTx(session, {
        _class: 'core:class:TxCreateDoc',
        objectId: testRefId,
        objectClass: 'tags:class:TagReference',
        objectSpace: String(testIssue.space),
        attributes: {
          attachedTo: testIssueId,
          attachedToClass: 'tracker:class:Issue',
          collection: 'labels',
          tag: testRefLabelId,
          title: '__PROBE_REF_LABEL__',
          color: 1,
        },
      });
      await wsSend(ws, refTx);
      console.log(`    TagReference created (issue: ${testIssueId.substring(0, 30)})`);

      // Increment labels count on the issue
      const incTx = buildTx(session, {
        _class: 'core:class:TxUpdateDoc',
        objectId: testIssueId,
        objectClass: 'tracker:class:Issue',
        objectSpace: String(testIssue.space),
        operations: {
          $inc: { labels: 1 },
        },
      });
      await wsSend(ws, incTx);
      console.log(`    Labels counter incremented on issue`);

      labelRefOk = true;

      // Clean up: remove ref, decrement counter, remove label
      try {
        const delRefTx = buildTx(session, {
          _class: 'core:class:TxRemoveDoc',
          objectId: testRefId,
          objectClass: 'tags:class:TagReference',
          objectSpace: String(testIssue.space),
        });
        await wsSend(ws, delRefTx);

        const decTx = buildTx(session, {
          _class: 'core:class:TxUpdateDoc',
          objectId: testIssueId,
          objectClass: 'tracker:class:Issue',
          objectSpace: String(testIssue.space),
          operations: {
            $inc: { labels: -1 },
          },
        });
        await wsSend(ws, decTx);

        const delLabelTx = buildTx(session, {
          _class: 'core:class:TxRemoveDoc',
          objectId: testRefLabelId,
          objectClass: 'tags:class:TagElement',
          objectSpace: labelObjectSpace,
        });
        await wsSend(ws, delLabelTx);
        console.log(`    Cleanup: probe ref, label, and counter reverted`);
      } catch {
        console.log(`    Cleanup: partial cleanup (non-fatal)`);
      }
    } catch (e) {
      console.log(`    FAILED: ${(e as Error).message.substring(0, 200)}`);
    }
  } else {
    console.log(`    SKIPPED: no issues to test with or label creation failed`);
  }

  // ── Summary ──
  console.log('\n  ═══ Probe Summary ═══');
  console.log(`    Milestone creation: ${milestoneOk ? 'OK' : 'FAILED'}`);
  console.log(`    Milestone status value: ${milestoneStatusValue}`);
  console.log(`    Label creation: ${labelClassOk ? 'OK' : 'FAILED'}`);
  console.log(`    Label assignment (TagRef): ${labelRefOk ? 'OK' : 'FAILED'}`);
  console.log(`    Label objectSpace: ${labelObjectSpace}`);
  console.log(`    Label category: ${labelCategoryValue}`);

  return {
    milestoneOk,
    labelClassOk,
    labelRefOk,
    milestoneStatusValue,
    labelObjectSpace,
    labelCategoryValue,
  };
}

// ── Milestone Definitions ─────────────────────────────────────────────────

const MILESTONE_DEFS: MilestoneDef[] = [
  {
    label: 'Phase 1 — System Integrity',
    projectIdentifier: 'DEV',
    description:
      'Sprints 021-023B: Data foundation, shadow scoring, production surface lock, CC write ban',
    sourceIssueTitle: '[MILESTONE] Phase 1',
  },
  {
    label: 'Phase 2 — Scoring Intelligence',
    projectIdentifier: 'DEV',
    description: 'Sprints 024-026: Scoring enhancement, CLV + closing snapshots, canonical cutover',
    sourceIssueTitle: '[MILESTONE] Phase 2',
  },
  {
    label: 'System Invariants',
    projectIdentifier: 'DEV',
    description:
      'Non-negotiable system rules that govern all scoring, lifecycle, and data operations',
    sourceIssueTitle: '[MILESTONE] System Invariants',
  },
  {
    label: 'Market Intelligence v1',
    projectIdentifier: 'INT',
    description:
      'Sprints 027-030: Feature registries, ensemble architecture, walk-forward backtesting',
    sourceIssueTitle: '[MILESTONE] Market Intelligence',
  },
  {
    label: 'Operator UX v1',
    projectIdentifier: 'PUX',
    description: 'Smart Form polish, Command Center controls, analytics dashboard',
    sourceIssueTitle: '[MILESTONE] Operator UX',
  },
  {
    label: 'Subscriber Experience v1',
    projectIdentifier: 'DIS',
    description: 'Rich embeds, alerts, slash commands, role onboarding',
    sourceIssueTitle: '[MILESTONE] Subscriber Experience',
  },
  {
    label: 'Launch Engine v1',
    projectIdentifier: 'BIZ',
    description: 'Onboarding funnel, pricing, referral, retention',
    sourceIssueTitle: '[MILESTONE] Launch Engine',
  },
];

// ── Issue → Milestone Mapping Rules ───────────────────────────────────────

interface MilestoneAssignmentRule {
  milestoneName: string;
  match: (identifier: string, title: string) => boolean;
}

const MILESTONE_RULES: MilestoneAssignmentRule[] = [
  // DEV sprint issues → Phase 2
  {
    milestoneName: 'Phase 2 — Scoring Intelligence',
    match: (id, title) => {
      if (!id.startsWith('DEV-')) return false;
      const num = parseInt(id.split('-')[1]);
      // DEV-3 to DEV-17 are sprint 024-026 + checkpoint issues
      if (num >= 3 && num <= 17) return true;
      // Also match any [SPRINT-024/025/026] or [CHECKPOINT] in title
      return /\[SPRINT-02[456]\]|\[CHECKPOINT-/.test(title);
    },
  },
  // DEV invariant issues → System Invariants
  {
    milestoneName: 'System Invariants',
    match: (id, title) => {
      if (!id.startsWith('DEV-')) return false;
      const num = parseInt(id.split('-')[1]);
      // DEV-19 to DEV-23 are invariant issues
      if (num >= 19 && num <= 23) return true;
      return /\[INVARIANT-/.test(title);
    },
  },
  // INT issues → Market Intelligence v1
  {
    milestoneName: 'Market Intelligence v1',
    match: (id, _title) => {
      if (!id.startsWith('INT-')) return false;
      const num = parseInt(id.split('-')[1]);
      return num >= 2; // INT-2 onwards (INT-1 is the milestone issue itself)
    },
  },
];

// ── Label Definitions ─────────────────────────────────────────────────────

const LABEL_DEFS: LabelDef[] = [
  { title: 'invariant', color: 0, description: 'System invariant rule' },
  { title: 'sprint', color: 3, description: 'Sprint work item' },
  { title: 'checkpoint', color: 6, description: 'Sprint checkpoint / quality gate' },
  { title: 'milestone', color: 4, description: 'Milestone tracking issue' },
  { title: 'enhancement', color: 10, description: 'Enhancement / improvement' },
  { title: 'P0-urgent', color: 0, description: 'Priority: Urgent' },
  { title: 'P1-high', color: 1, description: 'Priority: High' },
  { title: 'P2-medium', color: 4, description: 'Priority: Medium' },
  { title: 'intelligence', color: 8, description: 'Intelligence / ML / scoring model' },
  { title: 'governance', color: 5, description: 'Governance / closeout / proof' },
  { title: 'phase-1', color: 3, description: 'Phase 1: System Integrity' },
  { title: 'phase-2', color: 9, description: 'Phase 2: Scoring Intelligence' },
];

// ── Label Assignment Rules ────────────────────────────────────────────────

const LABEL_RULES: LabelRule[] = [
  { labelTitle: 'invariant', match: i => /\[INVARIANT-/.test(String(i.title)) },
  { labelTitle: 'sprint', match: i => /\[SPRINT-\d{3}\]/.test(String(i.title)) },
  { labelTitle: 'checkpoint', match: i => /\[CHECKPOINT-/.test(String(i.title)) },
  { labelTitle: 'milestone', match: i => /\[MILESTONE\]/.test(String(i.title)) },
  { labelTitle: 'enhancement', match: i => /\[ENH\]/.test(String(i.title)) },
  {
    labelTitle: 'P0-urgent',
    match: i => i.priority === 1 && !/\[MILESTONE\]/.test(String(i.title)),
  },
  { labelTitle: 'P1-high', match: i => i.priority === 2 && !/\[MILESTONE\]/.test(String(i.title)) },
  {
    labelTitle: 'P2-medium',
    match: i => i.priority === 3 && !/\[MILESTONE\]/.test(String(i.title)),
  },
  { labelTitle: 'intelligence', match: i => String(i.identifier ?? '').startsWith('INT-') },
  {
    labelTitle: 'governance',
    match: i => {
      const title = String(i.title);
      return /closeout|governance|tag$/.test(title.toLowerCase()) && /\[SPRINT-/.test(title);
    },
  },
  {
    labelTitle: 'phase-1',
    match: i => {
      const title = String(i.title);
      return /\[MILESTONE\] Phase 1/.test(title) || /\[SPRINT-02[123]\]/.test(title);
    },
  },
  {
    labelTitle: 'phase-2',
    match: i => {
      const title = String(i.title);
      const id = String(i.identifier ?? '');
      if (/\[MILESTONE\] Phase 2/.test(title)) return true;
      if (/\[SPRINT-02[456]\]/.test(title)) return true;
      if (/\[CHECKPOINT-/.test(title)) return true;
      // DEV-3 to DEV-17
      if (id.startsWith('DEV-')) {
        const num = parseInt(id.split('-')[1]);
        if (num >= 3 && num <= 17) return true;
      }
      return false;
    },
  },
];

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log(
    `║  Assign Milestones & Labels  ${DRY_RUN ? '[DRY RUN]' : '[LIVE]'}                     ║`
  );
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const session = await authenticate();
  console.log(`Workspace: ${session.workspaceId}`);

  const ws = await connectWs(session);
  console.log('WebSocket connected\n');

  // ── Phase 0: Probe ──
  const probe = await probePhase(session, ws);

  if (PROBE_ONLY) {
    ws.close();
    return;
  }

  if (!LABELS_ONLY) {
    if (!probe.milestoneOk) {
      console.error('\nFATAL: Milestone creation not supported. Cannot proceed.');
      ws.close();
      process.exit(1);
    }

    // ── Phase 1: Create Milestones ──
    console.log('\n═══ Phase 1: Create Milestones ═══\n');

    const projects = await findAll(session, 'tracker:class:Project');
    const projectSpaces = new Map<string, string>();
    for (const p of projects) {
      projectSpaces.set(String(p.identifier), String(p._id));
    }

    // Check existing milestones to avoid duplicates
    const existingMilestones = await findAll(session, 'tracker:class:Milestone', 100);
    const existingLabels = new Set(existingMilestones.map(m => String(m.label)));

    const milestoneIds = new Map<string, string>(); // label → objectId

    for (const ms of MILESTONE_DEFS) {
      const spaceId = projectSpaces.get(ms.projectIdentifier);
      if (!spaceId) {
        console.log(`  [SKIP] ${ms.label}: project ${ms.projectIdentifier} not found`);
        continue;
      }

      if (existingLabels.has(ms.label)) {
        const existing = existingMilestones.find(m => String(m.label) === ms.label);
        const existingId = String(existing?._id ?? '');
        milestoneIds.set(ms.label, existingId);
        console.log(`  [EXISTS] ${ms.label} → ${existingId.substring(0, 30)}`);
        continue;
      }

      const milestoneId = genId('milestone');
      milestoneIds.set(ms.label, milestoneId);

      if (DRY_RUN) {
        console.log(
          `  [DRY] Would create: ${ms.label} in ${ms.projectIdentifier} (${spaceId.substring(0, 20)})`
        );
      } else {
        const tx = buildTx(session, {
          _class: 'core:class:TxCreateDoc',
          objectId: milestoneId,
          objectClass: 'tracker:class:Milestone',
          objectSpace: spaceId,
          attributes: {
            label: ms.label,
            description: ms.description,
            status: probe.milestoneStatusValue,
            targetDate: null,
            comments: 0,
            attachments: 0,
          },
        });
        try {
          await wsSend(ws, tx);
          console.log(`  [OK] ${ms.label} → ${milestoneId.substring(0, 30)}`);
        } catch (e) {
          console.error(`  [ERR] ${ms.label}: ${(e as Error).message.substring(0, 100)}`);
        }
      }
    }

    // ── Phase 2: Link Issues to Milestones ──
    console.log('\n═══ Phase 2: Link Issues to Milestones ═══\n');

    const allIssues = await findAll(session, 'tracker:class:Issue', 500);
    let linked = 0;
    let skipped = 0;

    for (const issue of allIssues) {
      const issueId = String(issue._id);
      const identifier = String(issue.identifier ?? '');
      const title = String(issue.title ?? '');
      const currentMilestone = issue.milestone;

      // Skip if already has a milestone
      if (currentMilestone && currentMilestone !== null && currentMilestone !== 'null') {
        skipped++;
        continue;
      }

      // Find matching milestone
      let matchedMilestone: string | null = null;
      for (const rule of MILESTONE_RULES) {
        if (rule.match(identifier, title)) {
          matchedMilestone = rule.milestoneName;
          break;
        }
      }

      if (!matchedMilestone) continue;

      const milestoneId = milestoneIds.get(matchedMilestone);
      if (!milestoneId) {
        console.log(`  [SKIP] ${identifier}: milestone "${matchedMilestone}" not created`);
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [DRY] ${identifier}: "${title.substring(0, 50)}" → ${matchedMilestone}`);
        linked++;
      } else {
        try {
          const tx = buildTx(session, {
            _class: 'core:class:TxUpdateDoc',
            objectId: issueId,
            objectClass: 'tracker:class:Issue',
            objectSpace: String(issue.space),
            operations: {
              milestone: milestoneId,
            },
          });
          await wsSend(ws, tx);
          console.log(`  [OK] ${identifier} → ${matchedMilestone}`);
          linked++;
        } catch (e) {
          console.error(`  [ERR] ${identifier}: ${(e as Error).message.substring(0, 100)}`);
        }
      }
    }

    console.log(`\n  Linked: ${linked}, Skipped (already has milestone): ${skipped}`);
  }

  if (!MILESTONES_ONLY) {
    if (!probe.labelClassOk || !probe.labelRefOk) {
      console.error('\nFATAL: Label creation/assignment not supported. Cannot proceed.');
      ws.close();
      process.exit(1);
    }

    // ── Phase 3: Create Label Definitions ──
    console.log('\n═══ Phase 3: Create Label Definitions ═══\n');

    const existingLabels = await findAll(session, 'tags:class:TagElement', 100);
    const existingLabelTitles = new Map<string, string>();
    for (const l of existingLabels) {
      existingLabelTitles.set(String(l.title), String(l._id));
    }

    const labelIds = new Map<string, string>(); // title → objectId

    for (const labelDef of LABEL_DEFS) {
      if (existingLabelTitles.has(labelDef.title)) {
        labelIds.set(labelDef.title, existingLabelTitles.get(labelDef.title)!);
        console.log(`  [EXISTS] ${labelDef.title}`);
        continue;
      }

      const labelId = genId('label');
      labelIds.set(labelDef.title, labelId);

      if (DRY_RUN) {
        console.log(`  [DRY] Would create: ${labelDef.title} (color: ${labelDef.color})`);
      } else {
        try {
          const tx = buildTx(session, {
            _class: 'core:class:TxCreateDoc',
            objectId: labelId,
            objectClass: 'tags:class:TagElement',
            objectSpace: probe.labelObjectSpace,
            attributes: {
              title: labelDef.title,
              color: labelDef.color,
              description: labelDef.description,
              targetClass: 'tracker:class:Issue',
              category: probe.labelCategoryValue,
            },
          });
          await wsSend(ws, tx);
          console.log(`  [OK] ${labelDef.title} (color: ${labelDef.color})`);
        } catch (e) {
          console.error(`  [ERR] ${labelDef.title}: ${(e as Error).message.substring(0, 100)}`);
        }
      }
    }

    // ── Phase 4: Assign Labels to Issues ──
    console.log('\n═══ Phase 4: Assign Labels to Issues ═══\n');

    const allIssues = await findAll(session, 'tracker:class:Issue', 500);
    // Also fetch existing TagReferences to avoid duplicates
    const existingRefs = await findAll(session, 'tags:class:TagReference', 1000);
    const existingRefKeys = new Set(existingRefs.map(r => `${r.attachedTo}::${r.tag}`));

    let assigned = 0;
    let refSkipped = 0;

    for (const issue of allIssues) {
      const issueId = String(issue._id);
      const identifier = String(issue.identifier ?? '');
      const title = String(issue.title ?? '');
      const issueLabels: string[] = [];

      for (const rule of LABEL_RULES) {
        if (rule.match(issue)) {
          const labelId = labelIds.get(rule.labelTitle);
          if (!labelId) continue;

          const refKey = `${issueId}::${labelId}`;
          if (existingRefKeys.has(refKey)) {
            refSkipped++;
            continue;
          }

          issueLabels.push(rule.labelTitle);

          if (!DRY_RUN) {
            try {
              const refId = genId('label-ref');
              // Huly sidebar reads title/color directly from TagReference (not TagElement)
              const labelDef = LABEL_DEFS.find(l => l.title === rule.labelTitle);
              const refTx = buildTx(session, {
                _class: 'core:class:TxCreateDoc',
                objectId: refId,
                objectClass: 'tags:class:TagReference',
                objectSpace: String(issue.space),
                attributes: {
                  attachedTo: issueId,
                  attachedToClass: 'tracker:class:Issue',
                  collection: 'labels',
                  tag: labelId,
                  title: rule.labelTitle,
                  color: labelDef?.color ?? 0,
                },
              });
              await wsSend(ws, refTx);
              existingRefKeys.add(refKey);
              assigned++;
            } catch (e) {
              console.error(
                `  [ERR] ${identifier} label "${rule.labelTitle}": ${(e as Error).message.substring(0, 80)}`
              );
            }
          } else {
            assigned++;
          }
        }
      }

      if (issueLabels.length > 0) {
        if (DRY_RUN) {
          console.log(`  [DRY] ${identifier}: ${issueLabels.join(', ')}`);
        } else {
          // Update labels count on the issue
          try {
            const incTx = buildTx(session, {
              _class: 'core:class:TxUpdateDoc',
              objectId: issueId,
              objectClass: 'tracker:class:Issue',
              objectSpace: String(issue.space),
              operations: {
                labels: (Number(issue.labels) || 0) + issueLabels.length,
              },
            });
            await wsSend(ws, incTx);
            console.log(`  [OK] ${identifier}: ${issueLabels.join(', ')}`);
          } catch (e) {
            console.error(
              `  [ERR] ${identifier} labels counter: ${(e as Error).message.substring(0, 80)}`
            );
          }
        }
      }
    }

    console.log(`\n  Assigned: ${assigned}, Skipped (already assigned): ${refSkipped}`);
  }

  // ── Summary ──
  console.log('\n═══════════════════════════════════════════════════════════');
  if (DRY_RUN) {
    console.log('This was a DRY RUN. Re-run with --live to apply changes.');
  } else {
    console.log('Done. Milestones and labels have been assigned.');
  }
  console.log('═══════════════════════════════════════════════════════════');

  ws.close();
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
