// SPRINT-023 + SPRINT-024: Create sprint issues in Huly
// Usage: npx tsx tools/huly-os/scripts/create-sprint-023-024-issues.ts

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

interface SprintIssue {
  title: string;
  status: string;
  body: string;
}

// ---------------------------------------------------------------------------
// Sprint 023 — Production Surface Lock
// ---------------------------------------------------------------------------

const SPRINT_023: SprintIssue[] = [
  {
    title: '[SPRINT-023] Task 1: publish_outbox schema + receipts',
    status: 'tracker:status:Done',
    body: `**Sprint:** SPRINT-023-PRODUCTION-SURFACE-LOCK
**Priority:** P0 — Production surface

**Description:**
Align existing \`pick_publish\` table to canonical publish outbox contract. Add payload_hash for drift detection, error_code for structured error classification, unique constraint on dedupe_key for idempotency enforcement, and polling/lookup indexes.

**Deliverables:**
- Migration: \`supabase/migrations/20260304210000_publish_outbox_alignment.sql\`
- Adds: payload_hash (text), error_code (text)
- Unique index on dedupe_key (WHERE NOT NULL)
- Pending poll index (status, created_at WHERE status='pending')
- pick_id lookup index

**Acceptance Criteria:**
- [x] Migration file created with rollback comments
- [x] Columns added via IF NOT EXISTS (safe re-run)
- [x] Unique constraint enforces idempotency on dedupe_key
- [x] Typecheck passes`,
  },
  {
    title: '[SPRINT-023] Task 2: Publisher outbox-only refactor + runner proof',
    status: 'tracker:status:Done',
    body: `**Sprint:** SPRINT-023-PRODUCTION-SURFACE-LOCK
**Priority:** P0 — Production surface

**Description:**
Create canonical outbox service module and wire outbox-first publishing into all three DiscordPromotionAgent publish flows (capper, system, legacy). Every Discord post must have an outbox row before the webhook fires.

**Deliverables:**
- New: \`apps/api/src/services/publishOutbox.ts\` — enqueueForPublish, markPublished, markFailed, fetchPendingOutboxEntries, getOutboxReceipt
- Modified: \`apps/api/src/agents/DiscordPromotionAgent/index.ts\` — outbox-first pattern in all 3 flows
- New: \`scripts/analysis/run-outbox-publish-023.ts\` — runner script for proof

**Pattern:**
\`\`\`
enqueuePickToOutbox(pick, channel)
  → if alreadyPosted: skip (idempotent)
  → postEliteCardToDiscord(pick)
  → if success: recordOutboxReceipt(outboxId, messageId)
  → if failure: recordOutboxFailure(outboxId, errorCode, message)
\`\`\`

**Acceptance Criteria:**
- [x] All 3 publish flows go through outbox-first
- [x] Duplicate dedupe_key = no-op (idempotent)
- [x] Receipt written before pick confirmation
- [x] Runner script creates outbox row + verifies receipt roundtrip
- [x] Typecheck passes`,
  },
  {
    title: '[SPRINT-023] Task 3: Operator finalize API (approve/reject/override) + RBAC',
    status: 'tracker:status:Done',
    body: `**Sprint:** SPRINT-023-PRODUCTION-SURFACE-LOCK
**Priority:** P0 — Production surface

**Description:**
Add three operator finalization endpoints with JWT-based RBAC and full before/after audit logging. These endpoints are where CC write violations should migrate to.

**Deliverables:**
- POST /ops/picks/:id/approve — admin, analyst, operator roles
- POST /ops/picks/:id/reject — admin, analyst, operator roles
- POST /ops/picks/:id/override — admin only

**All endpoints:**
- Require \`reason\` for audit trail (mandatory)
- Fetch before-state for before/after snapshots
- Write to audit_log with actor, action, entity_type, entity_id, details
- Block immutable fields (id, created_at, bet_slip_id) in override
- Return correlationId for tracing

**Acceptance Criteria:**
- [x] Three endpoints added to ops.ts with operatorAuth + requireOperatorRole
- [x] Audit log written for every operation with before/after snapshots
- [x] Override blocks immutable fields
- [x] Reject prevents already-posted picks (409 conflict)
- [x] Typecheck passes`,
  },
  {
    title: '[SPRINT-023] Task 4: Audit log + Command Center DB write ban + CI gate',
    status: 'tracker:status:Done',
    body: `**Sprint:** SPRINT-023-PRODUCTION-SURFACE-LOCK
**Priority:** P0 — Production surface

**Description:**
Ensure audit_log writes for all operator actions (done — baked into Task 3 endpoints). Create CI gate script that scans Command Center for writes to canonical business tables.

**Deliverables:**
- Audit logging: integrated into approve/reject/override endpoints
- New: \`scripts/gates/cc-write-ban.ts\` — CI gate for CC write detection
- Bans writes to: unified_picks, prop_settlements, bridge_outbox, pick_publish, daily_picks, closing_snapshots
- Standard mode: warns (exit 0) | Strict mode: blocks (exit 1)

**Findings:**
12 pre-existing violations in 4 CC files:
- hooks/usePicks.ts (2) — approve/reject
- app/api/exposure/snapshot/route.ts (2) — unit reduction/demotion
- app/api/grading/picks/route.ts (4) — grading operations
- lib/supabase.ts (4) — utility write functions

**Acceptance Criteria:**
- [x] CC write ban gate detects all 12 violations
- [x] Gate is non-blocking in standard mode (pre-existing violations)
- [x] Gate supports --strict flag for blocking enforcement
- [x] All operator endpoints have audit_log writes
- [x] Typecheck + 85/85 tests pass`,
  },
];

// ---------------------------------------------------------------------------
// Sprint 024 — Scoring Enhancement Layering
// ---------------------------------------------------------------------------

const SPRINT_024: SprintIssue[] = [
  {
    title: '[SPRINT-024] Task 1: Market-efficiency cap + bounded adjustment layer',
    status: 'tracker:status:Todo',
    body: `**Sprint:** SPRINT-024-SCORING-ENHANCEMENT-LAYERING
**Priority:** P1 — Scoring accuracy

**Description:**
Add a market-efficiency cap to the scoring pipeline. When consensus indicates a highly efficient market (low overround, high book agreement), edge values should be bounded. This prevents the scoring system from claiming unrealistic edges in liquid, well-covered markets.

**Acceptance Criteria:**
- [ ] Market efficiency metric computed from consensus overround + book count
- [ ] Edge values capped when market efficiency exceeds threshold
- [ ] Bounded adjustment layer applied after computeProbabilityLayer, before computeScoreV2
- [ ] Constants versioned and documented
- [ ] Shadow comparison: capped vs uncapped score distributions
- [ ] Typecheck + tests pass`,
  },
  {
    title: '[SPRINT-024] Task 2: Confidence/uncertainty blend formalized + versioned constants',
    status: 'tracker:status:Todo',
    body: `**Sprint:** SPRINT-024-SCORING-ENHANCEMENT-LAYERING
**Priority:** P1 — Scoring accuracy

**Description:**
Formalize the confidence/uncertainty blend in the probability layer. Currently confidence uses neutral defaults (5.0 in shadow mode). This task defines the production formula: confidence = f(book_count, consensus_agreement, provider_quality, line_movement). All constants must be versioned for reproducibility.

**Acceptance Criteria:**
- [ ] Confidence formula defined with named inputs and documented weights
- [ ] Uncertainty formula derived from confidence + market efficiency
- [ ] All constants in a versioned config object (e.g., SCORING_CONSTANTS_V1)
- [ ] Model version string updated to reflect new constants
- [ ] Backward-compatible: shadow mode still uses neutral defaults
- [ ] Calibration data: confidence distribution across real markets
- [ ] Typecheck + tests pass`,
  },
  {
    title: '[SPRINT-024] Task 3: Explanation payload + reason codes for Command Center',
    status: 'tracker:status:Todo',
    body: `**Sprint:** SPRINT-024-SCORING-ENHANCEMENT-LAYERING
**Priority:** P1 — Operator transparency

**Description:**
Add structured explanation payloads to scored picks so operators can understand WHY a pick received its score/tier. Each scored pick should carry reason codes (e.g., HIGH_CONSENSUS_AGREEMENT, EFFICIENT_MARKET_CAP_APPLIED, INSUFFICIENT_BOOKS) and a human-readable explanation string.

**Acceptance Criteria:**
- [ ] ScoringExplanation type defined with reason_codes[] and explanation text
- [ ] Explanation payload attached to scored picks (meta.scoring_explanation)
- [ ] Reason codes: HIGH_CONSENSUS, LOW_CONSENSUS, EFFICIENT_MARKET_CAP, EDGE_BOUNDED, INSUFFICIENT_BOOKS, PROVIDER_QUALITY_ADJUSTMENT
- [ ] Command Center can read and display explanation from pick metadata
- [ ] Silent skip → structured INSUFFICIENT_BOOKS reason (production cutover prep)
- [ ] Typecheck + tests pass`,
  },
  {
    title: '[SPRINT-024] Task 4: Calibration report (distribution + drift + sanity checks)',
    status: 'tracker:status:Todo',
    body: `**Sprint:** SPRINT-024-SCORING-ENHANCEMENT-LAYERING
**Priority:** P1 — Quality assurance

**Description:**
Create a calibration report script that analyzes scored picks for distribution health, drift detection, and "too good to be true" anomaly checks. This is the quality gate before promoting shadow scoring to production.

**Outputs:**
- Score distribution: histogram + percentiles (p10/p25/p50/p75/p90)
- Tier distribution: counts + percentages for S/A/B/C/D
- Edge distribution: mean/median/max + outlier detection
- Confidence distribution: histogram + correlation with book count
- Drift detection: compare current window vs previous window
- Sanity checks: flag picks with edge > 15%, score = 100, or tier S with < 5 books

**Acceptance Criteria:**
- [ ] Script: scripts/analysis/calibration-report-024.ts
- [ ] Reads from unified_picks.meta.shadow_v3 (shadow scores)
- [ ] Generates CALIBRATION_REPORT.md with all distributions
- [ ] Flags anomalies with structured reason codes
- [ ] Drift metric: KL divergence or Jensen-Shannon between windows
- [ ] Exit code 1 if any sanity check fails (blocking for cutover)
- [ ] Typecheck passes`,
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const ALL_ISSUES = [...SPRINT_023, ...SPRINT_024];

async function main(): Promise<void> {
  console.log(`\nCreating ${ALL_ISSUES.length} sprint issues in Huly (${PROJECT})...\n`);
  console.log(`  Sprint 023: ${SPRINT_023.length} tasks (PRODUCTION-SURFACE-LOCK)`);
  console.log(`  Sprint 024: ${SPRINT_024.length} tasks (SCORING-ENHANCEMENT-LAYERING)\n`);

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

  // ── Create Sprint 023 issues ──
  console.log('--- SPRINT-023-PRODUCTION-SURFACE-LOCK ---');
  for (const issue of SPRINT_023) {
    sequence++;
    const issueId = `sprint023-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const identifier = `${projectIdent}-${sequence}`;

    const tx = buildCreateTx(issueId, spaceId, socialId, identifier, sequence, issue);
    reqId++;
    await wsSend(socket, tx, reqId);
    const statusLabel = issue.status.split(':').pop();
    console.log(`  ✓ ${identifier} [${statusLabel}] — ${issue.title}`);
    await new Promise(r => setTimeout(r, 100));
  }

  // ── Create Sprint 024 issues ──
  console.log('\n--- SPRINT-024-SCORING-ENHANCEMENT-LAYERING ---');
  for (const issue of SPRINT_024) {
    sequence++;
    const issueId = `sprint024-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const identifier = `${projectIdent}-${sequence}`;

    const tx = buildCreateTx(issueId, spaceId, socialId, identifier, sequence, issue);
    reqId++;
    await wsSend(socket, tx, reqId);
    const statusLabel = issue.status.split(':').pop();
    console.log(`  ✓ ${identifier} [${statusLabel}] — ${issue.title}`);
    await new Promise(r => setTimeout(r, 100));
  }

  // ── Update project sequence ──
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
  console.log(`\nDone. Created ${ALL_ISSUES.length} issues.`);
  console.log(
    `  Sprint 023: ${projectIdent}-${sequence - ALL_ISSUES.length + 1} → ${projectIdent}-${sequence - SPRINT_024.length}`
  );
  console.log(
    `  Sprint 024: ${projectIdent}-${sequence - SPRINT_024.length + 1} → ${projectIdent}-${sequence}`
  );
  console.log(`Project sequence updated to ${sequence}.`);
}

function buildCreateTx(
  issueId: string,
  spaceId: string,
  socialId: string,
  identifier: string,
  number: number,
  issue: SprintIssue
): Record<string, unknown> {
  return {
    _id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    _class: 'core:class:TxCreateDoc',
    space: 'core:space:Tx',
    objectId: issueId,
    objectClass: 'tracker:class:Issue',
    objectSpace: spaceId,
    modifiedBy: socialId,
    modifiedOn: Date.now(),
    attributes: {
      title: issue.title,
      description: issue.body,
      status: issue.status,
      number,
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
