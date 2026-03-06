// HULY BUILDER: Create the full Unit Talk Huly project structure
// Usage: npx tsx tools/huly-os/scripts/build-huly-structure.ts
//
// Creates:
//   - 5 Tracker Projects (Spaces)
//   - Milestone issues per project
//   - Phase 2 sprint issues (024-026) with 4 issues each
//   - 3 Checkpoint issues
//   - Governance documents in Operations teamspace
//
// Non-destructive: uses idempotent title-based dedup (skips existing)

import { resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: resolve(import.meta.dirname ?? '.', '..', '.env') });

const HULY_URL = (process.env.HULY_URL ?? 'http://localhost:8087').replace(/\/$/, '');
const HULY_EMAIL = process.env.HULY_EMAIL ?? 'ops@unit-talk.local';
const HULY_PASSWORD = process.env.HULY_PASSWORD ?? 'password';
const HULY_WORKSPACE = process.env.HULY_WORKSPACE ?? 'unit-talk';

// ── Types ────────────────────────────────────────────────────────────────

interface RpcResponse {
  result?: Record<string, unknown>;
  error?: { code: string; message?: string };
}

interface Session {
  accountToken: string;
  workspaceToken: string;
  workspaceId: string;
  socialId: string;
}

interface ProjectDef {
  identifier: string;
  name: string;
  description: string;
}

interface IssueDef {
  title: string;
  body: string;
  status: string;
  priority: number; // 1=urgent, 2=high, 3=medium, 4=low
}

interface ProjectState {
  spaceId: string;
  identifier: string;
  sequence: number;
}

// ── Linkage Template ─────────────────────────────────────────────────────

function sprintLinkageTemplate(opts: {
  sprintId: string;
  branchName: string;
  closeoutPath: string;
  proofBundlePath: string;
  scripts: string[];
  ciGates: string[];
  surfaces: string[];
  owner: string;
  checkpoint?: string;
}): string {
  return `
## Governance Linkage

| Field | Value |
|-------|-------|
| **Sprint** | ${opts.sprintId} |
| **Branch** | \`${opts.branchName}\` |
| **PR** | _TBD_ |
| **Commit** | _TBD_ |
| **Closeout** | \`${opts.closeoutPath}\` |
| **Proof Bundle** | \`${opts.proofBundlePath}\` |
| **Owner** | ${opts.owner} |
${opts.checkpoint ? `| **Test Checkpoint** | ${opts.checkpoint} |` : ''}

### Scripts to Run
${opts.scripts.map(s => `- \`${s}\``).join('\n')}

### CI Gates
${opts.ciGates.map(g => `- ${g}`).join('\n')}

### Canonical Surfaces Touched
${opts.surfaces.map(s => `- \`${s}\``).join('\n')}

### Proof Checklist
- [ ] proof_typecheck.txt
- [ ] proof_tests.txt
- [ ] proof_git_status.txt
- [ ] sprint closeout document
- [ ] PASS/FAIL stated
- [ ] links to artifacts included
`.trim();
}

// ── Workflow Statuses ────────────────────────────────────────────────────

const WORKFLOW_DOC = `# Unit Talk — Huly Workflow Contract

## Issue Lifecycle Statuses

| Status | Huly Status ID | Governance Phase |
|--------|---------------|-----------------|
| Backlog | tracker:status:Backlog | Pre-sprint |
| Planned | tracker:status:Todo | Phase 0: Context |
| In Progress | tracker:status:InProgress | Phase 2: Implement |
| Done | tracker:status:Done | Phase 5: Committed |
| Cancelled | tracker:status:Canceled | Abandoned |

## Extended Governance Phases (tracked in issue description)

| Phase | Label | Criteria |
|-------|-------|----------|
| Phase 0 | Context | Scope understood, files read |
| Phase 1 | Plan | Approach documented, NO code |
| Phase 2 | Implement | Smallest working change set |
| Phase 3 | Verify | Tests + gates + checks pass |
| Phase 4 | Proof | Proof artifacts generated |
| Phase 5 | Commit+Tag | git commit + git tag |
| Phase 6 | Closeout | Report + merge to main |

## "Proof Ready" Required Checklist

Before any issue transitions to Done:
- [ ] proof_typecheck.txt generated
- [ ] proof_tests.txt generated
- [ ] proof_git_status.txt clean
- [ ] Sprint closeout document written
- [ ] PASS/FAIL explicitly stated
- [ ] Links to all artifacts included in issue comment

## Workflow Mapping to Huly

Since Huly v0.7.x doesn't support custom status creation via API,
we use the built-in statuses + structured description fields:

- **Backlog** → Issue created, not yet planned
- **Todo** → Planned for sprint, approach documented
- **InProgress** → Active implementation (Phases 2-4)
- **Done** → Committed, tagged, merged, proofs attached
- **Canceled** → Abandoned with reason documented
`;

// ── Project Definitions ──────────────────────────────────────────────────

const PROJECTS: ProjectDef[] = [
  {
    identifier: 'DEV',
    name: 'Core Platform',
    description:
      'Core platform engineering — scoring pipeline, lifecycle adapters, settlement, agents, API. Canonical code owner for apps/api.',
  },
  {
    identifier: 'PUX',
    name: 'Product & UX',
    description:
      'Operator and subscriber UX — Smart Form, Command Center, Analytics Dashboard. Read-only surfaces + bridge_outbox writes.',
  },
  {
    identifier: 'DIS',
    name: 'Discord Platform',
    description:
      'Discord integration — embeds, alerts, slash commands, role onboarding, subscriber experience.',
  },
  {
    identifier: 'INT',
    name: 'Intelligence & Models',
    description:
      'Market intelligence — scoring models, feature registries, CLV validation, walk-forward backtesting, ensemble architecture.',
  },
  {
    identifier: 'BIZ',
    name: 'Growth / Business',
    description:
      'Growth engine — onboarding funnel, pricing, referral, retention, launch operations.',
  },
];

// ── Milestone Definitions ────────────────────────────────────────────────

interface MilestoneDef {
  projectId: string; // matches ProjectDef.identifier
  title: string;
  body: string;
  status: string;
}

const MILESTONES: MilestoneDef[] = [
  // Core Platform (DEV)
  {
    projectId: 'DEV',
    title: '[MILESTONE] Phase 1 — System Integrity (021-023B)',
    body: `## Phase 1 — System Integrity

**Sprints:** 021, 022, 023, 023B
**Status:** COMPLETED

### Scope
- Data foundation lock (provider_offers consensus gate)
- V3 shadow scoring pipeline activation
- Production surface lock (publish_outbox, operator API)
- Command Center write ban enforcement

### Key Deliverables
- provider_offers ingestion verified (3+ books per market)
- Shadow scoring pipeline producing V3 scores alongside legacy
- publish_outbox schema + outbox-first publishing pattern
- CC write ban CI gate (12 pre-existing violations documented)
- Operator finalize API (approve/reject/override + RBAC)

### Closeout Docs
- \`governance/closeouts/SPRINT-021-DATA-FOUNDATION-GATE.md\`
- \`governance/closeouts/SPRINT-022-V3-SHADOW-SCORING.md\`
- \`governance/closeouts/SPRINT-023-PRODUCTION-SURFACE-LOCK.md\`
- \`governance/closeouts/SPRINT-023B-CC-WRITE-BAN-ENFORCEMENT.md\``,
    status: 'tracker:status:Done',
  },
  {
    projectId: 'DEV',
    title: '[MILESTONE] Phase 2 — Scoring Intelligence (024-026)',
    body: `## Phase 2 — Scoring Intelligence

**Sprints:** 024, 025, 026
**Status:** NEXT (active planning)

### Scope
- Scoring enhancement layering (market efficiency, confidence, explanations)
- CLV + closing line snapshot validation
- Canonical cutover: retire raw_props from scoring, enforce single-writer

### Sprint Sequence
1. SPRINT-024-SCORING-ENHANCEMENT-LAYERING
2. SPRINT-025-CLV-CLOSING-SNAPSHOT
3. SPRINT-026-CANONICAL-CUTOVER-RAW-PROPS-RETIRE

### Test Checkpoints
- Checkpoint A (post-024): scoring sanity + calibration report
- Checkpoint B (post-025): CLV validation (truth test)
- Checkpoint C (post-026): full E2E provider_offers → publish_outbox → Discord simulation`,
    status: 'tracker:status:Todo',
  },

  // Product & UX (PUX)
  {
    projectId: 'PUX',
    title: '[MILESTONE] Operator UX v1',
    body: `## Operator UX v1

### Sub-milestones
- **UX1**: Smart Form polish (catalog from provider_offers views)
- **UX2**: Command Center operator controls (approve/reject/override via API)
- **UX3**: Analytics dashboard (scoring distribution, CLV tracking, drift alerts)

### Constraint
All UX surfaces are READ-ONLY or write to bridge_outbox / API endpoints only.
No direct writes to unified_picks, prop_settlements, or other canonical tables.`,
    status: 'tracker:status:Backlog',
  },

  // Discord Platform (DIS)
  {
    projectId: 'DIS',
    title: '[MILESTONE] Subscriber Experience v1',
    body: `## Subscriber Experience v1

### Sub-milestones
- **Embeds v2**: Rich embed cards with scoring explanation + confidence indicators
- **Alerts**: Configurable alert channels (line movement, CLV signals, model disagreement)
- **Slash Commands**: /stats, /history, /model, /subscribe
- **Role Onboarding**: Automated role assignment + welcome flow

### Constraint
Discord Bot reads from unified_picks (posted picks only).
All writes go through DiscordPromotionAgent lifecycle adapters.`,
    status: 'tracker:status:Backlog',
  },

  // Intelligence & Models (INT)
  {
    projectId: 'INT',
    title: '[MILESTONE] Market Intelligence v1 (027-030)',
    body: `## Market Intelligence v1

**Sprints:** 027, 028, 029, 030 (future)

### Scope
- Sport-specific feature registries (NBA, NFL, MLB, NHL)
- Multi-model ensemble architecture (market + features + CLV predictor)
- Walk-forward backtesting harness
- Automated model recalibration triggers

### Depends On
- Phase 2 completion (scoring intelligence baseline)
- CLV data accumulation (minimum 200 settled picks per sport)`,
    status: 'tracker:status:Backlog',
  },

  // Growth / Business (BIZ)
  {
    projectId: 'BIZ',
    title: '[MILESTONE] Launch Engine v1',
    body: `## Launch Engine v1

### Components
- **Onboarding Funnel**: Discord → free tier → paid tier conversion flow
- **Pricing**: Tier structure (free/basic/pro/enterprise)
- **Referral**: Referral tracking + reward system
- **Retention**: Engagement metrics, churn prediction, re-engagement campaigns

### Depends On
- Subscriber Experience v1 (Discord Platform)
- Operator UX v1 (Product & UX)`,
    status: 'tracker:status:Backlog',
  },
];

// ── Sprint Issue Definitions ─────────────────────────────────────────────

interface SprintIssueDef {
  sprintId: string;
  projectId: string;
  issues: IssueDef[];
}

const DATE = new Date().toISOString().slice(0, 10);

const SPRINT_ISSUES: SprintIssueDef[] = [
  // ── SPRINT-024 ──
  {
    sprintId: 'SPRINT-024-SCORING-ENHANCEMENT-LAYERING',
    projectId: 'DEV',
    issues: [
      {
        title: '[SPRINT-024] P0: Market-efficiency cap + bounded adjustment layer',
        priority: 1,
        status: 'tracker:status:Todo',
        body: `## Sprint: SPRINT-024-SCORING-ENHANCEMENT-LAYERING

**Priority:** P0 — Primary deliverable

### Description
Add a market-efficiency cap to the scoring pipeline. When consensus indicates a highly efficient market (low overround, high book agreement), edge values should be bounded. Prevents claiming unrealistic edges in liquid markets.

### Acceptance Criteria
- [ ] Market efficiency metric computed from consensus overround + book count
- [ ] Edge values capped when market efficiency exceeds threshold
- [ ] Bounded adjustment layer applied after computeProbabilityLayer, before computeScoreV2
- [ ] Constants versioned and documented (SCORING_CONSTANTS_V1)
- [ ] Shadow comparison: capped vs uncapped score distributions
- [ ] Typecheck + tests pass

### Touches
- \`apps/api/src/services/ShadowScoringService.ts\`
- \`apps/api/src/logic/providers/marketAdapters/\`
- \`apps/api/src/services/ProfessionalPropProcessor.ts\`

${sprintLinkageTemplate({
  sprintId: 'SPRINT-024-SCORING-ENHANCEMENT-LAYERING',
  branchName: 'sprint/scoring-enhancement-024',
  closeoutPath: 'governance/closeouts/SPRINT-024-SCORING-ENHANCEMENT-LAYERING.md',
  proofBundlePath: `out/sprints/SPRINT-024-SCORING-ENHANCEMENT-LAYERING/${DATE}/`,
  scripts: [
    'npm run type-check',
    'npm run test:unit',
    'npm run lifecycle:single-writer -- --strict',
    'npx tsx scripts/analysis/calibration-report-024.ts',
  ],
  ciGates: ['typecheck', 'unit tests', 'lifecycle single-writer gate'],
  surfaces: [
    'provider_offers (read)',
    'unified_picks (write via lifecycle)',
    'market_snapshots (write)',
  ],
  owner: 'Claude A (engineering)',
  checkpoint: 'Checkpoint A: Calibration after 024',
})}`,
      },
      {
        title: '[SPRINT-024] P0: Confidence/uncertainty blend + versioned constants',
        priority: 1,
        status: 'tracker:status:Todo',
        body: `## Sprint: SPRINT-024-SCORING-ENHANCEMENT-LAYERING

**Priority:** P0 — Secondary deliverable

### Description
Formalize the confidence/uncertainty blend in the probability layer. Define production formula: confidence = f(book_count, consensus_agreement, provider_quality, line_movement). All constants versioned for reproducibility.

### Acceptance Criteria
- [ ] Confidence formula defined with named inputs and documented weights
- [ ] Uncertainty formula derived from confidence + market efficiency
- [ ] All constants in versioned config object (SCORING_CONSTANTS_V1)
- [ ] Model version string updated to reflect new constants
- [ ] Backward-compatible: shadow mode still uses neutral defaults
- [ ] Calibration data: confidence distribution across real markets
- [ ] Typecheck + tests pass

### Touches
- \`apps/api/src/services/ShadowScoringService.ts\`
- \`apps/api/src/services/ProfessionalPropProcessor.ts\`
- \`apps/api/src/logic/scoring/\`

${sprintLinkageTemplate({
  sprintId: 'SPRINT-024-SCORING-ENHANCEMENT-LAYERING',
  branchName: 'sprint/scoring-enhancement-024',
  closeoutPath: 'governance/closeouts/SPRINT-024-SCORING-ENHANCEMENT-LAYERING.md',
  proofBundlePath: `out/sprints/SPRINT-024-SCORING-ENHANCEMENT-LAYERING/${DATE}/`,
  scripts: [
    'npm run type-check',
    'npm run test:unit',
    'npx tsx scripts/analysis/confidence-distribution-024.ts',
  ],
  ciGates: ['typecheck', 'unit tests'],
  surfaces: ['provider_offers (read)', 'unified_picks.meta.shadow_v3 (write via lifecycle)'],
  owner: 'Claude A (engineering)',
})}`,
      },
      {
        title: '[SPRINT-024] P1: Explanation payload + reason codes for CC',
        priority: 2,
        status: 'tracker:status:Todo',
        body: `## Sprint: SPRINT-024-SCORING-ENHANCEMENT-LAYERING

**Priority:** P1 — Validation/proof

### Description
Add structured explanation payloads to scored picks. Each scored pick carries reason codes (HIGH_CONSENSUS_AGREEMENT, EFFICIENT_MARKET_CAP_APPLIED, INSUFFICIENT_BOOKS) and human-readable explanation string for operator transparency.

### Acceptance Criteria
- [ ] ScoringExplanation type defined with reason_codes[] and explanation text
- [ ] Explanation payload attached to scored picks (meta.scoring_explanation)
- [ ] Reason codes: HIGH_CONSENSUS, LOW_CONSENSUS, EFFICIENT_MARKET_CAP, EDGE_BOUNDED, INSUFFICIENT_BOOKS, PROVIDER_QUALITY_ADJUSTMENT
- [ ] Command Center can read and display explanation from pick metadata
- [ ] Typecheck + tests pass

### Touches
- \`apps/api/src/services/ShadowScoringService.ts\`
- \`apps/api/src/services/ProfessionalPropProcessor.ts\`
- \`apps/command-center/src/\` (read-only display)

${sprintLinkageTemplate({
  sprintId: 'SPRINT-024-SCORING-ENHANCEMENT-LAYERING',
  branchName: 'sprint/scoring-enhancement-024',
  closeoutPath: 'governance/closeouts/SPRINT-024-SCORING-ENHANCEMENT-LAYERING.md',
  proofBundlePath: `out/sprints/SPRINT-024-SCORING-ENHANCEMENT-LAYERING/${DATE}/`,
  scripts: ['npm run type-check', 'npm run test:unit'],
  ciGates: ['typecheck', 'unit tests'],
  surfaces: ['unified_picks.meta (write via lifecycle)'],
  owner: 'Claude A (engineering)',
})}`,
      },
      {
        title: '[SPRINT-024] P1: Governance closeout + calibration report + tag',
        priority: 2,
        status: 'tracker:status:Todo',
        body: `## Sprint: SPRINT-024-SCORING-ENHANCEMENT-LAYERING

**Priority:** P1 — Governance closeout

### Description
Generate calibration report, sprint closeout report, proof bundle, and sprint tag. This is the quality gate before promoting scoring enhancements.

### Acceptance Criteria
- [ ] Calibration report: score/tier/edge/confidence distributions
- [ ] Drift detection: compare current vs previous scoring window
- [ ] Sanity checks: flag edge > 15%, score = 100, tier S with < 5 books
- [ ] Sprint closeout document generated
- [ ] All proof artifacts in proof bundle path
- [ ] Sprint tag created: SPRINT-024-SCORING-ENHANCEMENT-LAYERING-COMPLETE
- [ ] Merged to main

### Touches
- \`scripts/analysis/calibration-report-024.ts\`
- \`governance/closeouts/SPRINT-024-SCORING-ENHANCEMENT-LAYERING.md\`
- \`out/sprints/SPRINT-024-SCORING-ENHANCEMENT-LAYERING/\`

${sprintLinkageTemplate({
  sprintId: 'SPRINT-024-SCORING-ENHANCEMENT-LAYERING',
  branchName: 'sprint/scoring-enhancement-024',
  closeoutPath: 'governance/closeouts/SPRINT-024-SCORING-ENHANCEMENT-LAYERING.md',
  proofBundlePath: `out/sprints/SPRINT-024-SCORING-ENHANCEMENT-LAYERING/${DATE}/`,
  scripts: [
    'npm run type-check',
    'npm run test',
    'npm run lifecycle:single-writer -- --strict',
    'npx tsx scripts/analysis/calibration-report-024.ts',
    'npm run sprint:close -- SPRINT-024-SCORING-ENHANCEMENT-LAYERING',
  ],
  ciGates: ['typecheck', 'all tests', 'lifecycle single-writer gate', 'calibration sanity checks'],
  surfaces: ['governance/closeouts/', 'out/sprints/'],
  owner: 'Claude A (engineering) + Operator (review)',
  checkpoint: 'Checkpoint A: Calibration after 024',
})}`,
      },
    ],
  },

  // ── SPRINT-025 ──
  {
    sprintId: 'SPRINT-025-CLV-CLOSING-SNAPSHOT',
    projectId: 'DEV',
    issues: [
      {
        title: '[SPRINT-025] P0: ClosingLineAgent + closing snapshot capture',
        priority: 1,
        status: 'tracker:status:Backlog',
        body: `## Sprint: SPRINT-025-CLV-CLOSING-SNAPSHOT

**Priority:** P0 — Primary deliverable

### Description
Build ClosingLineAgent that snapshots provider_offers at game start (is_closing=true). Capture closing consensus probability for every market with an active pick. This is the denominator for CLV computation.

### Acceptance Criteria
- [ ] ClosingLineAgent polls for games approaching start time (T-5 min window)
- [ ] Snapshots provider_offers with is_closing=true flag
- [ ] Closing consensus computed via computeConsensus() at snapshot time
- [ ] closing_snapshots table stores: pick_id, closing_prob, closing_line, snapshot_time
- [ ] Immutability trigger on closing_line (once set, never changed)
- [ ] Idempotent: re-running for same game produces no duplicates
- [ ] Agent health heartbeat registered
- [ ] Typecheck + tests pass

### Touches
- \`apps/api/src/agents/\` (new ClosingLineAgent)
- \`apps/api/src/services/\` (closing snapshot service)
- \`supabase/migrations/\` (closing_snapshots table)
- \`apps/api/src/logic/providers/\`

${sprintLinkageTemplate({
  sprintId: 'SPRINT-025-CLV-CLOSING-SNAPSHOT',
  branchName: 'sprint/clv-closing-snapshot-025',
  closeoutPath: 'governance/closeouts/SPRINT-025-CLV-CLOSING-SNAPSHOT.md',
  proofBundlePath: `out/sprints/SPRINT-025-CLV-CLOSING-SNAPSHOT/${DATE}/`,
  scripts: [
    'npm run type-check',
    'npm run test:unit',
    'npm run test:integration',
    'npm run lifecycle:single-writer -- --strict',
  ],
  ciGates: ['typecheck', 'unit tests', 'integration tests', 'lifecycle single-writer gate'],
  surfaces: ['provider_offers (read)', 'closing_snapshots (write)', 'agent_health (write)'],
  owner: 'Claude A (engineering)',
  checkpoint: 'Checkpoint B: CLV validation (truth test)',
})}`,
      },
      {
        title: '[SPRINT-025] P0: CLV computation + tracking by sport/market/tier',
        priority: 1,
        status: 'tracker:status:Backlog',
        body: `## Sprint: SPRINT-025-CLV-CLOSING-SNAPSHOT

**Priority:** P0 — Secondary deliverable

### Description
Compute CLV for every settled pick by comparing opening vs closing probability. Track CLV metrics by sport, market type, and tier. CLV > 0 means we beat the closing line — the gold standard for pick quality.

### Acceptance Criteria
- [ ] CLV computed: clv = closing_prob - opening_prob (for picks we recommended)
- [ ] CLV tracked per pick in unified_picks.meta.clv_data
- [ ] Aggregated CLV report by sport (NBA/NFL/MLB)
- [ ] Aggregated CLV report by market type (spread/total/player prop)
- [ ] Aggregated CLV report by tier (S/A/B/C/D)
- [ ] CLV hit rate: % of picks where clv > 0
- [ ] Alert trigger: CLV goes negative for 50+ consecutive picks
- [ ] Typecheck + tests pass

### Touches
- \`apps/api/src/services/\` (CLV computation service)
- \`apps/api/src/agents/\` (CLV tracking in settlement flow)
- \`scripts/analysis/\` (CLV report generator)

${sprintLinkageTemplate({
  sprintId: 'SPRINT-025-CLV-CLOSING-SNAPSHOT',
  branchName: 'sprint/clv-closing-snapshot-025',
  closeoutPath: 'governance/closeouts/SPRINT-025-CLV-CLOSING-SNAPSHOT.md',
  proofBundlePath: `out/sprints/SPRINT-025-CLV-CLOSING-SNAPSHOT/${DATE}/`,
  scripts: [
    'npm run type-check',
    'npm run test:unit',
    'npx tsx scripts/analysis/clv-report-025.ts',
  ],
  ciGates: ['typecheck', 'unit tests', 'CLV report generation'],
  surfaces: ['unified_picks.meta.clv_data (write via lifecycle)', 'closing_snapshots (read)'],
  owner: 'Claude A (engineering)',
})}`,
      },
      {
        title: '[SPRINT-025] P1: CLV truth test script + validation artifacts',
        priority: 2,
        status: 'tracker:status:Backlog',
        body: `## Sprint: SPRINT-025-CLV-CLOSING-SNAPSHOT

**Priority:** P1 — Validation/proof

### Description
Build the CLV truth test: for a sample of settled picks, verify that our opening edge prediction correlates with realized CLV. This is Checkpoint B — the validation that our scoring model has real predictive value.

### Acceptance Criteria
- [ ] Truth test script: scripts/analysis/clv-truth-test-025.ts
- [ ] Correlation analysis: predicted edge vs realized CLV (target r > 0.3)
- [ ] Per-tier validation: higher tiers should have higher CLV hit rates
- [ ] Sample size validation: minimum 50 settled picks per sport
- [ ] Report output: CLV_TRUTH_TEST_REPORT.md with charts/tables
- [ ] Exit code 1 if correlation < threshold (blocking for cutover)
- [ ] Typecheck passes

### Touches
- \`scripts/analysis/clv-truth-test-025.ts\`
- \`out/sprints/SPRINT-025-CLV-CLOSING-SNAPSHOT/\`

${sprintLinkageTemplate({
  sprintId: 'SPRINT-025-CLV-CLOSING-SNAPSHOT',
  branchName: 'sprint/clv-closing-snapshot-025',
  closeoutPath: 'governance/closeouts/SPRINT-025-CLV-CLOSING-SNAPSHOT.md',
  proofBundlePath: `out/sprints/SPRINT-025-CLV-CLOSING-SNAPSHOT/${DATE}/`,
  scripts: ['npm run type-check', 'npx tsx scripts/analysis/clv-truth-test-025.ts'],
  ciGates: ['typecheck', 'CLV truth test (r > 0.3)'],
  surfaces: ['unified_picks (read)', 'closing_snapshots (read)', 'prop_settlements (read)'],
  owner: 'Claude A (engineering)',
  checkpoint: 'Checkpoint B: CLV validation (truth test)',
})}`,
      },
      {
        title: '[SPRINT-025] P1: Governance closeout + CLV baseline + tag',
        priority: 2,
        status: 'tracker:status:Backlog',
        body: `## Sprint: SPRINT-025-CLV-CLOSING-SNAPSHOT

**Priority:** P1 — Governance closeout

### Description
Generate CLV baseline report, sprint closeout, proof bundle, and sprint tag. Document CLV tracking methodology and establish baseline metrics.

### Acceptance Criteria
- [ ] CLV baseline report generated with per-sport/market/tier metrics
- [ ] Sprint closeout document with all deliverables documented
- [ ] All proof artifacts in proof bundle path
- [ ] Sprint tag: SPRINT-025-CLV-CLOSING-SNAPSHOT-COMPLETE
- [ ] Merged to main
- [ ] CLV tracking methodology documented

### Touches
- \`governance/closeouts/SPRINT-025-CLV-CLOSING-SNAPSHOT.md\`
- \`out/sprints/SPRINT-025-CLV-CLOSING-SNAPSHOT/\`
- \`docs/architecture/\`

${sprintLinkageTemplate({
  sprintId: 'SPRINT-025-CLV-CLOSING-SNAPSHOT',
  branchName: 'sprint/clv-closing-snapshot-025',
  closeoutPath: 'governance/closeouts/SPRINT-025-CLV-CLOSING-SNAPSHOT.md',
  proofBundlePath: `out/sprints/SPRINT-025-CLV-CLOSING-SNAPSHOT/${DATE}/`,
  scripts: [
    'npm run type-check',
    'npm run test',
    'npm run lifecycle:single-writer -- --strict',
    'npx tsx scripts/analysis/clv-report-025.ts',
    'npm run sprint:close -- SPRINT-025-CLV-CLOSING-SNAPSHOT',
  ],
  ciGates: ['typecheck', 'all tests', 'lifecycle single-writer gate', 'CLV baseline'],
  surfaces: ['governance/closeouts/', 'out/sprints/'],
  owner: 'Claude A (engineering) + Operator (review)',
  checkpoint: 'Checkpoint B: CLV validation (truth test)',
})}`,
      },
    ],
  },

  // ── SPRINT-026 ──
  {
    sprintId: 'SPRINT-026-CANONICAL-CUTOVER-RAW-PROPS-RETIRE',
    projectId: 'DEV',
    issues: [
      {
        title: '[SPRINT-026] P0: Fix single-writer violations + enforce lifecycle',
        priority: 1,
        status: 'tracker:status:Backlog',
        body: `## Sprint: SPRINT-026-CANONICAL-CUTOVER-RAW-PROPS-RETIRE

**Priority:** P0 — Primary deliverable

### Description
Fix all remaining single-writer violations identified in drift reports. Every write to unified_picks must go through lifecycle adapters. Enforce with CI gate in strict mode.

### Known Violations (from CC write ban gate)
- hooks/usePicks.ts (2) — approve/reject
- app/api/exposure/snapshot/route.ts (2) — unit reduction/demotion
- app/api/grading/picks/route.ts (4) — grading operations
- lib/supabase.ts (4) — utility write functions

### Acceptance Criteria
- [ ] All 12 CC violations migrated to API proxy endpoints
- [ ] CC write ban gate passes in --strict mode (exit 0)
- [ ] Lifecycle single-writer gate passes in --strict mode
- [ ] No direct .from('unified_picks').insert/update outside lifecycle
- [ ] Typecheck + tests pass

### Touches
- \`apps/command-center/src/hooks/usePicks.ts\`
- \`apps/command-center/src/app/api/exposure/snapshot/route.ts\`
- \`apps/command-center/src/app/api/grading/picks/route.ts\`
- \`apps/command-center/src/lib/supabase.ts\`
- \`apps/api/src/routes/ops.ts\`

${sprintLinkageTemplate({
  sprintId: 'SPRINT-026-CANONICAL-CUTOVER-RAW-PROPS-RETIRE',
  branchName: 'sprint/canonical-cutover-026',
  closeoutPath: 'governance/closeouts/SPRINT-026-CANONICAL-CUTOVER-RAW-PROPS-RETIRE.md',
  proofBundlePath: `out/sprints/SPRINT-026-CANONICAL-CUTOVER-RAW-PROPS-RETIRE/${DATE}/`,
  scripts: [
    'npm run type-check',
    'npm run test',
    'npm run lifecycle:single-writer -- --strict',
    'npx tsx scripts/gates/cc-write-ban.ts --strict',
  ],
  ciGates: [
    'typecheck',
    'all tests',
    'lifecycle single-writer gate (strict)',
    'cc-write-ban gate (strict)',
  ],
  surfaces: ['unified_picks (lifecycle only)', 'apps/command-center/ (read-only enforcement)'],
  owner: 'Claude A (engineering)',
  checkpoint: 'Checkpoint C: Full E2E simulation',
})}`,
      },
      {
        title: '[SPRINT-026] P0: Retire raw_props from scoring + catalog migration',
        priority: 1,
        status: 'tracker:status:Backlog',
        body: `## Sprint: SPRINT-026-CANONICAL-CUTOVER-RAW-PROPS-RETIRE

**Priority:** P0 — Secondary deliverable

### Description
Remove all scoring reads from raw_props. Scoring pipeline reads exclusively from provider_offers + market_snapshots. Smart Form catalog migrates to provider_offers views.

### Acceptance Criteria
- [ ] Zero scoring reads from raw_props (grep verification)
- [ ] ProfessionalPropProcessor reads from provider_offers
- [ ] ShadowScoringService reads from provider_offers
- [ ] Smart Form catalog uses view_provider_offers_current_v3
- [ ] raw_props still receives data (ingestion unchanged) but scoring ignores it
- [ ] CI gate: block scoring reads from raw_props
- [ ] Typecheck + tests pass

### Touches
- \`apps/api/src/services/ProfessionalPropProcessor.ts\`
- \`apps/api/src/services/ShadowScoringService.ts\`
- \`apps/api/src/services/MarketOfferAggregator.ts\`
- \`apps/smart-form/\` (catalog views)
- \`apps/api/src/logic/providers/\`

${sprintLinkageTemplate({
  sprintId: 'SPRINT-026-CANONICAL-CUTOVER-RAW-PROPS-RETIRE',
  branchName: 'sprint/canonical-cutover-026',
  closeoutPath: 'governance/closeouts/SPRINT-026-CANONICAL-CUTOVER-RAW-PROPS-RETIRE.md',
  proofBundlePath: `out/sprints/SPRINT-026-CANONICAL-CUTOVER-RAW-PROPS-RETIRE/${DATE}/`,
  scripts: [
    'npm run type-check',
    'npm run test',
    'rg "raw_props" apps/api/src/services/ --type ts',
  ],
  ciGates: ['typecheck', 'all tests', 'raw_props scoring read ban'],
  surfaces: ['provider_offers (read)', 'raw_props (deprecated from scoring)'],
  owner: 'Claude A (engineering)',
})}`,
      },
      {
        title: '[SPRINT-026] P1: Full E2E simulation (provider_offers → Discord)',
        priority: 2,
        status: 'tracker:status:Backlog',
        body: `## Sprint: SPRINT-026-CANONICAL-CUTOVER-RAW-PROPS-RETIRE

**Priority:** P1 — Validation/proof

### Description
Run the full end-to-end simulation: provider_offers ingestion → consensus → scoring → promotion → operator approve → publish_outbox → Discord webhook (dry-run). This is Checkpoint C.

### Acceptance Criteria
- [ ] E2E script: scripts/analysis/e2e-simulation-026.ts
- [ ] provider_offers ingested from real OddsAPI data
- [ ] Consensus computed from 3+ books
- [ ] Scoring produces tier + edge + explanation
- [ ] Promotion gate evaluates all 8+ gates
- [ ] publish_outbox row created with payload
- [ ] Discord webhook called in dry-run mode (no actual post)
- [ ] Full audit trail captured in report
- [ ] Exit code 0 = simulation passed
- [ ] Typecheck passes

### Touches
- \`scripts/analysis/e2e-simulation-026.ts\`
- \`out/sprints/SPRINT-026-CANONICAL-CUTOVER-RAW-PROPS-RETIRE/\`

${sprintLinkageTemplate({
  sprintId: 'SPRINT-026-CANONICAL-CUTOVER-RAW-PROPS-RETIRE',
  branchName: 'sprint/canonical-cutover-026',
  closeoutPath: 'governance/closeouts/SPRINT-026-CANONICAL-CUTOVER-RAW-PROPS-RETIRE.md',
  proofBundlePath: `out/sprints/SPRINT-026-CANONICAL-CUTOVER-RAW-PROPS-RETIRE/${DATE}/`,
  scripts: ['npm run type-check', 'npx tsx scripts/analysis/e2e-simulation-026.ts --dry-run'],
  ciGates: ['typecheck', 'E2E simulation pass'],
  surfaces: [
    'provider_offers (read)',
    'unified_picks (lifecycle write)',
    'publish_outbox (write)',
    'Discord webhook (dry-run)',
  ],
  owner: 'Claude A (engineering)',
  checkpoint: 'Checkpoint C: Full E2E provider_offers → publish_outbox → Discord simulation',
})}`,
      },
      {
        title: '[SPRINT-026] P1: Governance closeout + zero-drift report + tag',
        priority: 2,
        status: 'tracker:status:Backlog',
        body: `## Sprint: SPRINT-026-CANONICAL-CUTOVER-RAW-PROPS-RETIRE

**Priority:** P1 — Governance closeout

### Description
Generate the zero-drift report proving all P0 violations are resolved. Sprint closeout, proof bundle, and final sprint tag for Phase 2 completion.

### Acceptance Criteria
- [ ] Zero-drift report: no P0 violations remaining
- [ ] All CI gates pass in strict mode
- [ ] Sprint closeout document with Phase 2 summary
- [ ] All proof artifacts in proof bundle path
- [ ] Sprint tag: SPRINT-026-CANONICAL-CUTOVER-RAW-PROPS-RETIRE-COMPLETE
- [ ] Merged to main
- [ ] Phase 2 milestone marked complete

### Touches
- \`governance/closeouts/SPRINT-026-CANONICAL-CUTOVER-RAW-PROPS-RETIRE.md\`
- \`out/sprints/SPRINT-026-CANONICAL-CUTOVER-RAW-PROPS-RETIRE/\`

${sprintLinkageTemplate({
  sprintId: 'SPRINT-026-CANONICAL-CUTOVER-RAW-PROPS-RETIRE',
  branchName: 'sprint/canonical-cutover-026',
  closeoutPath: 'governance/closeouts/SPRINT-026-CANONICAL-CUTOVER-RAW-PROPS-RETIRE.md',
  proofBundlePath: `out/sprints/SPRINT-026-CANONICAL-CUTOVER-RAW-PROPS-RETIRE/${DATE}/`,
  scripts: [
    'npm run type-check',
    'npm run test',
    'npm run lifecycle:single-writer -- --strict',
    'npx tsx scripts/gates/cc-write-ban.ts --strict',
    'npx tsx scripts/analysis/e2e-simulation-026.ts --dry-run',
    'npm run sprint:close -- SPRINT-026-CANONICAL-CUTOVER-RAW-PROPS-RETIRE',
  ],
  ciGates: [
    'typecheck',
    'all tests',
    'lifecycle single-writer gate (strict)',
    'cc-write-ban gate (strict)',
    'E2E simulation',
    'zero-drift report',
  ],
  surfaces: ['governance/closeouts/', 'out/sprints/'],
  owner: 'Claude A (engineering) + Operator (review)',
  checkpoint: 'Checkpoint C: Full E2E provider_offers → publish_outbox → Discord simulation',
})}`,
      },
    ],
  },
];

// ── Checkpoint Definitions ───────────────────────────────────────────────

const CHECKPOINTS: IssueDef[] = [
  {
    title: '[CHECKPOINT-A] Post-024: Scoring sanity + calibration report',
    priority: 1,
    status: 'tracker:status:Backlog',
    body: `## Checkpoint A — Post-Sprint-024

**Trigger:** After SPRINT-024-SCORING-ENHANCEMENT-LAYERING completes
**Gate Type:** Quality validation (blocking for 025)

### Required Artifacts
- [ ] Calibration report: scripts/analysis/calibration-report-024.ts output
- [ ] Score distribution: histogram + percentiles (p10/p25/p50/p75/p90)
- [ ] Tier distribution: counts + percentages for S/A/B/C/D
- [ ] Edge distribution: mean/median/max + outlier detection
- [ ] Confidence distribution: histogram + correlation with book count
- [ ] Drift detection: compare current vs previous scoring window
- [ ] Sanity checks: flag picks with edge > 15%, score = 100, tier S with < 5 books

### Pass Criteria
- No sanity check failures (edge outliers, impossible scores)
- Score distribution is roughly normal (no heavy skew)
- Tier distribution follows expected power law (more B/C than S/A)
- Confidence correlates positively with book count

### Fail Response
If checkpoint fails:
1. STOP — do not proceed to Sprint 025
2. Investigate anomalies in calibration report
3. Adjust scoring constants
4. Re-run calibration report until pass`,
  },
  {
    title: '[CHECKPOINT-B] Post-025: CLV validation (truth test)',
    priority: 1,
    status: 'tracker:status:Backlog',
    body: `## Checkpoint B — Post-Sprint-025

**Trigger:** After SPRINT-025-CLV-CLOSING-SNAPSHOT completes
**Gate Type:** Model validation (blocking for 026)

### Required Artifacts
- [ ] CLV truth test: scripts/analysis/clv-truth-test-025.ts output
- [ ] Correlation: predicted edge vs realized CLV (target r > 0.3)
- [ ] Per-tier CLV hit rates (S > A > B expected)
- [ ] Per-sport CLV breakdown (NBA/NFL/MLB)
- [ ] Sample size validation: minimum 50 settled picks per sport
- [ ] CLV_TRUTH_TEST_REPORT.md with analysis

### Pass Criteria
- Edge-CLV correlation r > 0.3 (weak but positive)
- Overall CLV hit rate > 52% (barely profitable)
- Higher tiers show higher CLV hit rates
- No sport with CLV hit rate < 45% (systematic failure)

### Fail Response
If checkpoint fails:
1. STOP — do not proceed to Sprint 026
2. Analyze which sports/markets have negative CLV
3. Review scoring constants and confidence formula
4. Accumulate more data if sample size insufficient
5. Re-run truth test after adjustments`,
  },
  {
    title: '[CHECKPOINT-C] Post-026: Full E2E simulation',
    priority: 1,
    status: 'tracker:status:Backlog',
    body: `## Checkpoint C — Post-Sprint-026

**Trigger:** After SPRINT-026-CANONICAL-CUTOVER-RAW-PROPS-RETIRE completes
**Gate Type:** System validation (blocking for Phase 3)

### Required Artifacts
- [ ] E2E simulation: scripts/analysis/e2e-simulation-026.ts output
- [ ] provider_offers → consensus → scoring → promotion → outbox → Discord (dry-run)
- [ ] Zero single-writer violations (strict gate)
- [ ] Zero CC write violations (strict gate)
- [ ] Zero scoring reads from raw_props
- [ ] Full audit trail from simulation

### Pass Criteria
- E2E simulation completes without errors
- All CI gates pass in strict mode
- Zero P0 drift violations
- provider_offers is the sole scoring source
- publish_outbox is the sole publish surface
- All operator actions go through API with audit trail

### Fail Response
If checkpoint fails:
1. STOP — Phase 2 is not complete
2. Identify which step in the pipeline failed
3. Fix the specific violation
4. Re-run full E2E simulation
5. Do not proceed to Phase 3 (Market Intelligence) until clean`,
  },
];

// ── Connection & TX Helpers ──────────────────────────────────────────────

async function authenticate(): Promise<Session> {
  console.log(`  Authenticating as ${HULY_EMAIL}...`);
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

  return {
    accountToken,
    workspaceToken: wsBody.result!.token as string,
    workspaceId: wsBody.result!.workspace as string,
    socialId,
  };
}

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
  if (Array.isArray(body?.result)) return body.result;
  if (Array.isArray(body?.value)) return body.value;
  if (Array.isArray(body?.docs)) return body.docs;
  return [];
}

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

let globalReqId = 0;

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

function buildIssueTx(
  session: Session,
  spaceId: string,
  identifier: string,
  number: number,
  issue: IssueDef
): Record<string, unknown> {
  const issueId = `huly-builder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    _id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    _class: 'core:class:TxCreateDoc',
    space: 'core:space:Tx',
    objectId: issueId,
    objectClass: 'tracker:class:Issue',
    objectSpace: spaceId,
    modifiedBy: session.socialId,
    modifiedOn: Date.now(),
    attributes: {
      title: issue.title,
      description: issue.body,
      status: issue.status,
      number,
      identifier,
      kind: 'tracker:taskTypes:Issue',
      priority: issue.priority,
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

function buildProjectTx(session: Session, project: ProjectDef): Record<string, unknown> {
  const projId = `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    _id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    _class: 'core:class:TxCreateDoc',
    space: 'core:space:Tx',
    objectId: projId,
    objectClass: 'tracker:class:Project',
    objectSpace: 'core:space:Space',
    modifiedBy: session.socialId,
    modifiedOn: Date.now(),
    attributes: {
      name: project.name,
      identifier: project.identifier,
      description: project.description,
      private: false,
      archived: false,
      members: [session.socialId],
      defaultIssueStatus: 'tracker:status:Todo',
      defaultAssignee: null,
      sequence: 0,
    },
    projId, // carry for caller
  };
}

function buildUpdateSequenceTx(
  session: Session,
  spaceId: string,
  sequence: number
): Record<string, unknown> {
  return {
    _id: `tx-seq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    _class: 'core:class:TxUpdateDoc',
    space: 'core:space:Tx',
    objectId: spaceId,
    objectClass: 'tracker:class:Project',
    objectSpace: 'core:space:Space',
    modifiedBy: session.socialId,
    modifiedOn: Date.now(),
    operations: { sequence },
  };
}

function buildDocTx(
  session: Session,
  teamspaceId: string,
  title: string,
  content: string
): Record<string, unknown> {
  const docId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    _id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    _class: 'core:class:TxCreateDoc',
    space: 'core:space:Tx',
    objectId: docId,
    objectClass: 'document:class:Document',
    objectSpace: teamspaceId,
    modifiedBy: session.socialId,
    modifiedOn: Date.now(),
    attributes: {
      title,
      content,
      parent: 'document:ids:NoParent',
      rank: '0|hzzzzz:',
      attachments: 0,
      comments: 0,
      docUpdateMessages: 0,
      embeddings: 0,
      labels: 0,
      references: 0,
    },
  };
}

// ── Summary Tracking ─────────────────────────────────────────────────────

const summary = {
  projectsCreated: [] as string[],
  projectsExisting: [] as string[],
  milestonesCreated: 0,
  sprintIssuesCreated: 0,
  checkpointsCreated: 0,
  docsCreated: 0,
  errors: [] as string[],
};

// ── Main ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('  HULY BUILDER — Unit Talk Full Structure');
  console.log('='.repeat(60));
  console.log(`  URL:       ${HULY_URL}`);
  console.log(`  Workspace: ${HULY_WORKSPACE}`);
  console.log(`  Date:      ${DATE}`);
  console.log('='.repeat(60) + '\n');

  // ── Step 1: Authenticate ──
  const session = await authenticate();
  console.log(`  Authenticated. WorkspaceID: ${session.workspaceId}\n`);

  // ── Step 2: Connect WebSocket ──
  console.log('  Connecting WebSocket...');
  const socket = await connectWs(session);
  console.log('  WebSocket connected.\n');

  // ── Step 3: Discover existing projects ──
  console.log('--- STEP 1: Create/Verify Projects (Spaces) ---\n');
  const existingProjects = await findAll(session, 'tracker:class:Project');
  const projectMap = new Map<string, ProjectState>();

  for (const p of existingProjects) {
    const ident = String(p.identifier ?? '');
    if (ident) {
      projectMap.set(ident, {
        spaceId: String(p._id),
        identifier: ident,
        sequence: typeof p.sequence === 'number' ? p.sequence : 0,
      });
    }
  }

  // Create projects that don't exist
  for (const projDef of PROJECTS) {
    if (projectMap.has(projDef.identifier)) {
      console.log(
        `  [EXISTS] ${projDef.identifier} — ${projDef.name} (${projectMap.get(projDef.identifier)!.spaceId})`
      );
      summary.projectsExisting.push(projDef.identifier);
    } else {
      try {
        const tx = buildProjectTx(session, projDef);
        const projId = tx.projId as string;
        delete tx.projId;
        await wsSend(socket, tx);
        projectMap.set(projDef.identifier, {
          spaceId: projId,
          identifier: projDef.identifier,
          sequence: 0,
        });
        console.log(`  [CREATED] ${projDef.identifier} — ${projDef.name} (${projId})`);
        summary.projectsCreated.push(projDef.identifier);
        await delay(200);
      } catch (err) {
        const msg = `Project ${projDef.identifier}: ${err instanceof Error ? err.message : err}`;
        console.log(`  [ERROR] ${msg}`);
        summary.errors.push(msg);
      }
    }
  }

  // Also check for the existing UT project and add to map if present
  if (!projectMap.has('UT')) {
    for (const p of existingProjects) {
      const name = String(p.name ?? '');
      if (name.includes('Truth') || name.includes('Unit Talk')) {
        projectMap.set('UT', {
          spaceId: String(p._id),
          identifier: String(p.identifier ?? 'UT'),
          sequence: typeof p.sequence === 'number' ? p.sequence : 0,
        });
        console.log(`  [MAPPED] UT — ${name} (${p._id})`);
        break;
      }
    }
  }
  console.log('');

  // ── Step 4: Create milestone issues ──
  console.log('--- STEP 2: Create Milestones ---\n');

  for (const ms of MILESTONES) {
    const proj = projectMap.get(ms.projectId);
    if (!proj) {
      const msg = `Milestone "${ms.title}" — project ${ms.projectId} not found`;
      console.log(`  [SKIP] ${msg}`);
      summary.errors.push(msg);
      continue;
    }

    // Check if milestone already exists (by title)
    const existingIssues = await findAll(session, 'tracker:class:Issue');
    const existing = existingIssues.find(
      (i: any) => String(i.title) === ms.title && String(i.space ?? i.objectSpace) === proj.spaceId
    );

    if (existing) {
      console.log(`  [EXISTS] ${ms.title}`);
      continue;
    }

    try {
      proj.sequence++;
      const identifier = `${proj.identifier}-${proj.sequence}`;
      const issueDef: IssueDef = { title: ms.title, body: ms.body, status: ms.status, priority: 1 };
      const tx = buildIssueTx(session, proj.spaceId, identifier, proj.sequence, issueDef);
      await wsSend(socket, tx);
      console.log(`  [CREATED] ${identifier} — ${ms.title}`);
      summary.milestonesCreated++;
      await delay(150);
    } catch (err) {
      const msg = `Milestone "${ms.title}": ${err instanceof Error ? err.message : err}`;
      console.log(`  [ERROR] ${msg}`);
      summary.errors.push(msg);
    }
  }
  console.log('');

  // ── Step 5: Create sprint issues ──
  console.log('--- STEP 3: Create Sprint Issues (024-026) ---\n');

  for (const sprint of SPRINT_ISSUES) {
    const proj = projectMap.get(sprint.projectId);
    if (!proj) {
      const msg = `Sprint ${sprint.sprintId} — project ${sprint.projectId} not found`;
      console.log(`  [SKIP] ${msg}`);
      summary.errors.push(msg);
      continue;
    }

    console.log(`  --- ${sprint.sprintId} ---`);
    for (const issue of sprint.issues) {
      try {
        proj.sequence++;
        const identifier = `${proj.identifier}-${proj.sequence}`;
        const tx = buildIssueTx(session, proj.spaceId, identifier, proj.sequence, issue);
        await wsSend(socket, tx);
        const statusLabel = issue.status.split(':').pop();
        const prioLabel = issue.priority === 1 ? 'P0' : `P${issue.priority - 1}`;
        console.log(`    [CREATED] ${identifier} [${statusLabel}] [${prioLabel}] — ${issue.title}`);
        summary.sprintIssuesCreated++;
        await delay(150);
      } catch (err) {
        const msg = `Issue "${issue.title}": ${err instanceof Error ? err.message : err}`;
        console.log(`    [ERROR] ${msg}`);
        summary.errors.push(msg);
      }
    }
    console.log('');
  }

  // ── Step 6: Create checkpoint issues ──
  console.log('--- STEP 4: Create Checkpoint Issues ---\n');

  const devProj = projectMap.get('DEV');
  if (devProj) {
    for (const cp of CHECKPOINTS) {
      try {
        devProj.sequence++;
        const identifier = `${devProj.identifier}-${devProj.sequence}`;
        const tx = buildIssueTx(session, devProj.spaceId, identifier, devProj.sequence, cp);
        await wsSend(socket, tx);
        console.log(`  [CREATED] ${identifier} — ${cp.title}`);
        summary.checkpointsCreated++;
        await delay(150);
      } catch (err) {
        const msg = `Checkpoint "${cp.title}": ${err instanceof Error ? err.message : err}`;
        console.log(`  [ERROR] ${msg}`);
        summary.errors.push(msg);
      }
    }
  } else {
    console.log('  [SKIP] DEV project not found — cannot create checkpoints');
  }
  console.log('');

  // ── Step 7: Update project sequences ──
  console.log('--- STEP 5: Update Project Sequences ---\n');

  for (const [ident, proj] of projectMap) {
    if (proj.sequence > 0) {
      try {
        const tx = buildUpdateSequenceTx(session, proj.spaceId, proj.sequence);
        await wsSend(socket, tx);
        console.log(`  [UPDATED] ${ident}: sequence=${proj.sequence}`);
      } catch (err) {
        console.log(
          `  [ERROR] ${ident} sequence update: ${err instanceof Error ? err.message : err}`
        );
      }
    }
  }
  console.log('');

  // ── Step 8: Create governance documents ──
  console.log('--- STEP 6: Create Governance Documents ---\n');

  // Find or create Operations teamspace
  const teamspaces = await findAll(session, 'document:class:Teamspace');
  let opsTeamspace = teamspaces.find((t: any) => String(t.name ?? '').includes('Operations'));

  if (!opsTeamspace) {
    // Try to create the teamspace
    try {
      const tsId = `teamspace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const tx = {
        _id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        _class: 'core:class:TxCreateDoc',
        space: 'core:space:Tx',
        objectId: tsId,
        objectClass: 'document:class:Teamspace',
        objectSpace: 'core:space:Space',
        modifiedBy: session.socialId,
        modifiedOn: Date.now(),
        attributes: {
          name: 'Operations',
          description: 'Unit Talk governance documents, workflows, and reference material.',
          private: false,
          archived: false,
          members: [session.socialId],
        },
      };
      await wsSend(socket, tx);
      opsTeamspace = { _id: tsId, name: 'Operations' };
      console.log(`  [CREATED] Teamspace: Operations (${tsId})`);
      await delay(300);
    } catch (err) {
      console.log(`  [ERROR] Teamspace creation: ${err instanceof Error ? err.message : err}`);
    }
  } else {
    console.log(`  [EXISTS] Teamspace: Operations (${opsTeamspace._id})`);
  }

  if (opsTeamspace) {
    const tsId = String(opsTeamspace._id);
    const docs = [
      { title: 'Workflow Contract', content: WORKFLOW_DOC },
      {
        title: 'Issue Template — Sprint',
        content: `# Sprint Issue Template

Use this template for all sprint-scoped issues.

\`\`\`markdown
## Sprint: SPRINT-<NAME>-###

**Priority:** P0 | P1

### Description
<What this task delivers>

### Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Typecheck + tests pass

### Touches
- \`apps/api/src/...\`
- \`scripts/analysis/...\`

## Governance Linkage

| Field | Value |
|-------|-------|
| **Sprint** | SPRINT-<NAME>-### |
| **Branch** | \`sprint/<name>-###\` |
| **PR** | _TBD_ |
| **Commit** | _TBD_ |
| **Closeout** | \`governance/closeouts/SPRINT-<NAME>-###.md\` |
| **Proof Bundle** | \`out/sprints/SPRINT-<NAME>-###/<date>/\` |
| **Owner** | Claude A / Operator |

### Scripts to Run
- \`npm run type-check\`
- \`npm run test\`
- \`npm run lifecycle:single-writer -- --strict\`

### CI Gates
- typecheck
- unit tests
- lifecycle single-writer gate

### Proof Checklist
- [ ] proof_typecheck.txt
- [ ] proof_tests.txt
- [ ] proof_git_status.txt
- [ ] sprint closeout document
- [ ] PASS/FAIL stated
\`\`\``,
      },
      {
        title: 'Phase 2 Roadmap — Scoring Intelligence',
        content: `# Phase 2 — Scoring Intelligence Roadmap

## Sprint Sequence
1. **SPRINT-024** — Scoring Enhancement Layering
2. **SPRINT-025** — CLV + Closing Line Snapshot
3. **SPRINT-026** — Canonical Cutover + raw_props Retirement

## Test Checkpoints
- **Checkpoint A** (post-024): Scoring calibration + sanity checks
- **Checkpoint B** (post-025): CLV truth test (predicted edge vs realized CLV)
- **Checkpoint C** (post-026): Full E2E simulation

## Key Metrics
| Metric | Target |
|--------|--------|
| CLV hit rate | > 55% |
| Edge accuracy (r) | > 0.3 |
| Tier calibration | S > A > B |
| Single-writer violations | 0 |
| Scoring reads from raw_props | 0 |

## Dependencies
- Phase 1 (System Integrity) — COMPLETED
- provider_offers ingestion — VERIFIED
- Shadow scoring pipeline — ACTIVE
`,
      },
    ];

    for (const doc of docs) {
      try {
        const tx = buildDocTx(session, tsId, doc.title, doc.content);
        await wsSend(socket, tx);
        console.log(`  [CREATED] Doc: ${doc.title}`);
        summary.docsCreated++;
        await delay(200);
      } catch (err) {
        const msg = `Doc "${doc.title}": ${err instanceof Error ? err.message : err}`;
        console.log(`  [ERROR] ${msg}`);
        summary.errors.push(msg);
      }
    }
  }
  console.log('');

  // ── Cleanup ──
  socket.close();

  // ── Final Summary ──
  console.log('='.repeat(60));
  console.log('  HULY BUILDER — Summary');
  console.log('='.repeat(60));
  console.log(
    `  Projects created:  ${summary.projectsCreated.length} (${summary.projectsCreated.join(', ') || 'none'})`
  );
  console.log(
    `  Projects existing: ${summary.projectsExisting.length} (${summary.projectsExisting.join(', ') || 'none'})`
  );
  console.log(`  Milestones:        ${summary.milestonesCreated}`);
  console.log(`  Sprint issues:     ${summary.sprintIssuesCreated}`);
  console.log(`  Checkpoints:       ${summary.checkpointsCreated}`);
  console.log(`  Documents:         ${summary.docsCreated}`);
  console.log(`  Errors:            ${summary.errors.length}`);
  if (summary.errors.length > 0) {
    console.log('\n  Errors:');
    for (const err of summary.errors) {
      console.log(`    - ${err}`);
    }
  }
  console.log('='.repeat(60) + '\n');
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

main().catch(err => {
  console.error('\nFATAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
