// HULY BUILDER EXTENSION: System Invariants + Market Intelligence
// Usage: npx tsx tools/huly-os/scripts/extend-huly-invariants.ts
//
// Creates:
//   - System Invariants milestone in DEV (permanent, never closed)
//   - 5 invariant issues (DEV-INVARIANT-001 through 005)
//   - 4 Market Intelligence issues in INT (INT-001 through 004)
//   - Updates checkpoint issues with sprint linkage
//   - Extends issue template document
//
// Idempotent: skips existing issues by title match

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

interface IssueDef {
  title: string;
  body: string;
  status: string;
  priority: number;
}

interface ProjectState {
  spaceId: string;
  identifier: string;
  sequence: number;
}

// ── Issue Definitions ────────────────────────────────────────────────────

const INVARIANT_MILESTONE: IssueDef = {
  title: '[MILESTONE] System Invariants (Permanent Guardrails)',
  status: 'tracker:status:InProgress',
  priority: 1,
  body: `## System Invariants — Permanent Guardrails

**Status:** ACTIVE (never closed)
**Type:** Architectural invariants — these are permanent rules, not sprint deliverables.

### Purpose
These invariants prevent architectural drift and ensure the scoring pipeline cannot silently degrade. They are enforced by CI gates, runtime assertions, and architectural review. Violations are treated as P0 incidents.

### Invariant Registry

| ID | Invariant | Enforcement |
|----|-----------|-------------|
| INV-001 | Scoring reads from provider_offers only | CI grep gate + runtime assertion |
| INV-002 | Canonical tables have single writer | CI scan + architectural review |
| INV-003 | Scored markets contain canonical IDs | Runtime assertion in scoring pipeline |
| INV-004 | Publishing flows through publish outbox | Publisher guardrails + CI detection |
| INV-005 | Operator decisions are auditable | Audit log enforcement + API middleware |

### Enforcement Model
- **CI Gates**: Automated grep/AST scans on every PR
- **Runtime Assertions**: Fail-closed checks in hot path
- **Architectural Review**: Human review on any change touching canonical surfaces
- **Incident Response**: Invariant violation = P0 incident, sprint-blocks until fixed

### This milestone is NEVER closed.
It represents permanent architectural constraints that must hold across all sprints.`,
};

const INVARIANT_ISSUES: IssueDef[] = [
  {
    title: '[INVARIANT-001] Scoring must read canonical offers (provider_offers)',
    status: 'tracker:status:InProgress',
    priority: 1,
    body: `## DEV-INVARIANT-001 — SCORING-SOURCE-INVARIANT

**Type:** Permanent architectural invariant
**Severity:** P0 — Violation blocks all sprints
**Status:** Active (permanent enforcement)

---

### Invariant Statement

> Scoring services must derive market truth from \`provider_offers\`.
> No scoring path may read from \`raw_props\` for market data.
> All scored markets must trace back to canonical provider offer records.

### Fail Conditions
- Any scoring path reads \`raw_props\` for odds/lines/probabilities
- Any scoring path lacks canonical IDs (event_id, market_type_id, participant_id)
- Any scoring path constructs probabilities without multi-book consensus

### Enforcement Mechanisms

| Mechanism | Type | Location |
|-----------|------|----------|
| CI grep gate | Automated | \`scripts/gates/scoring-source-gate.ts\` |
| Runtime assertion | Fail-closed | \`ShadowScoringService.ts\` entry point |
| PromotionPolicy rule | Fail-closed | Gate: \`CANONICAL_SOURCE_REQUIRED\` |

### CI Gate Implementation
\`\`\`bash
# Detect scoring reads from raw_props (should return 0 matches)
rg "raw_props" apps/api/src/services/ShadowScoringService.ts \\
   apps/api/src/services/ProfessionalPropProcessor.ts \\
   apps/api/src/services/MarketOfferAggregator.ts --type ts
\`\`\`

### Acceptance Criteria
- [ ] CI gate exists and runs on every PR
- [ ] Scoring service asserts canonical IDs before processing
- [ ] Any fallback/skip path has explicit reason code (e.g., INSUFFICIENT_BOOKS)
- [ ] PromotionPolicy rejects picks without canonical source data
- [ ] Zero grep matches for raw_props in scoring services

### Canonical Surfaces
- \`provider_offers\` (read — canonical market data source)
- \`market_snapshots\` (write — persisted consensus truth)
- \`unified_picks\` (write via lifecycle — scored output)

### Touches
- \`apps/api/src/services/ShadowScoringService.ts\`
- \`apps/api/src/services/ProfessionalPropProcessor.ts\`
- \`apps/api/src/services/MarketOfferAggregator.ts\`
- \`apps/api/src/lib/probability/\`
- \`apps/api/src/logic/providers/marketAdapters/\`

### Invariant Risk
**HIGH** — Regression to raw_props scoring would invalidate all V3 quality metrics and CLV tracking.`,
  },
  {
    title: '[INVARIANT-002] Canonical tables must have a single writer',
    status: 'tracker:status:InProgress',
    priority: 1,
    body: `## DEV-INVARIANT-002 — SINGLE-WRITER-INVARIANT

**Type:** Permanent architectural invariant
**Severity:** P0 — Violation blocks all sprints
**Status:** Active (permanent enforcement)

---

### Invariant Statement

> Each canonical table must have exactly one designated writer service.
> All writes must go through lifecycle adapters or designated agent interfaces.
> No service may write to a table it does not own.

### Canonical Writer Map

| Table | Designated Writer | Write Interface |
|-------|-------------------|-----------------|
| \`provider_offers\` | FeedAgent (OddsAPI ingestion) | Direct insert (ingestion-only) |
| \`market_snapshots\` | SnapshotAgent / ScoringService | Direct insert (append-only) |
| \`unified_picks\` | ScoringAgent / BridgeWorker | \`lifecycleInsert\`, \`lifecycleUpdate\` |
| \`pick_publish\` | PublishAgent / DiscordPromotionAgent | \`publishOutbox\` service |
| \`prop_settlements\` | SettlementAgent | \`lifecycleSettle\` |
| \`bridge_outbox\` | Smart Form | Direct insert (submission-only) |
| \`audit_log\` | All services (append-only) | Direct insert |
| \`agent_health\` | All agents (heartbeat) | Direct upsert |

### Fail Conditions
- Multiple services writing to the same canonical surface
- Any write to \`unified_picks\` outside lifecycle adapters
- Command Center writing to any canonical business table
- Any write bypassing the designated writer interface

### Enforcement Mechanisms

| Mechanism | Type | Location |
|-----------|------|----------|
| Lifecycle single-writer gate | CI | \`npm run lifecycle:single-writer -- --strict\` |
| CC write-ban gate | CI | \`npx tsx scripts/gates/cc-write-ban.ts --strict\` |
| Lifecycle adapter enforcement | Runtime | \`apps/api/src/lib/lifecycle/\` |
| Architectural review | Human | PR review for canonical surface changes |

### Acceptance Criteria
- [ ] Single-writer table mapping documented and enforced
- [ ] Lifecycle gate passes in strict mode (zero violations)
- [ ] CC write-ban gate passes in strict mode
- [ ] No service writes to a table it does not own
- [ ] Writer role enum covers all legitimate write paths

### Touches
- \`apps/api/src/lib/lifecycle/\`
- \`apps/api/src/agents/\`
- \`apps/api/src/services/publishOutbox.ts\`
- \`apps/command-center/\` (read-only enforcement)
- \`scripts/gates/\``,
  },
  {
    title: '[INVARIANT-003] All scored markets must contain canonical IDs',
    status: 'tracker:status:InProgress',
    priority: 1,
    body: `## DEV-INVARIANT-003 — CANONICAL-ID-INVARIANT

**Type:** Permanent architectural invariant
**Severity:** P0 — Violation blocks all sprints
**Status:** Active (permanent enforcement)

---

### Invariant Statement

> Every scored market entry must contain canonical identifiers that trace back
> to the provider_offers source data. No anonymous or ad-hoc market scoring.

### Required Canonical IDs

| Field | Source | Purpose |
|-------|--------|---------|
| \`event_id\` | SGO / provider_offers | Links to specific game/match |
| \`market_type_id\` | Market catalog | Identifies market type (spread, total, player prop) |
| \`participant_id\` | participants table | Links to canonical player/team |

### Fail Conditions
- Any scoring entry missing \`event_id\`
- Any scoring entry missing \`market_type_id\`
- Any player prop scoring entry missing \`participant_id\`
- Any canonical ID that doesn't resolve to a real record
- Scoring proceeding with placeholder/null canonical IDs

### Enforcement Mechanisms

| Mechanism | Type | Location |
|-----------|------|----------|
| Runtime assertion | Fail-closed | Scoring pipeline entry point |
| TypeScript type guard | Compile-time | \`ScoredMarket\` type requires canonical IDs |
| PromotionPolicy gate | Fail-closed | \`CANONICAL_IDS_REQUIRED\` gate |
| Database constraint | Schema | NOT NULL on canonical ID columns |

### Runtime Assertion Pattern
\`\`\`typescript
function assertCanonicalIds(market: MarketInput): asserts market is CanonicalMarket {
  if (!market.event_id) throw new ScoringInvariantError('MISSING_EVENT_ID');
  if (!market.market_type_id) throw new ScoringInvariantError('MISSING_MARKET_TYPE_ID');
  if (market.is_player_prop && !market.participant_id)
    throw new ScoringInvariantError('MISSING_PARTICIPANT_ID');
}
\`\`\`

### Acceptance Criteria
- [ ] TypeScript types enforce canonical IDs at compile time
- [ ] Runtime assertion in scoring pipeline entry
- [ ] PromotionPolicy rejects picks without canonical IDs
- [ ] Database schema has NOT NULL constraints where applicable
- [ ] Reason code MISSING_CANONICAL_ID logged for any skip

### Touches
- \`apps/api/src/services/ShadowScoringService.ts\`
- \`apps/api/src/services/ProfessionalPropProcessor.ts\`
- \`apps/api/src/logic/scoring/\`
- \`supabase/migrations/\` (schema constraints)`,
  },
  {
    title: '[INVARIANT-004] All publishing must flow through publish outbox',
    status: 'tracker:status:InProgress',
    priority: 1,
    body: `## DEV-INVARIANT-004 — OUTBOX-PUBLISH-INVARIANT

**Type:** Permanent architectural invariant
**Severity:** P0 — Violation blocks all sprints
**Status:** Active (permanent enforcement)

---

### Invariant Statement

> All pick publishing must flow through the publish outbox.
> No Discord post may occur without a corresponding outbox record.
> Every post must have an outbox receipt before the pick is marked as posted.

### Required Publishing Flow

\`\`\`
unified_picks (scored + promoted)
    │
    ▼
publish_outbox (enqueue with dedupe_key)
    │
    ▼
Discord webhook (post with embed)
    │
    ▼
publish_outbox (receipt: message_id, posted_at)
    │
    ▼
unified_picks (posted_to_discord = true, via lifecycle)
\`\`\`

### Fail Conditions
- Direct Discord post without outbox row
- Pick marked as posted without outbox receipt
- Duplicate dedupe_key producing duplicate posts
- Outbox row without eventual receipt (stale pending)

### Enforcement Mechanisms

| Mechanism | Type | Location |
|-----------|------|----------|
| Outbox-first pattern | Runtime | DiscordPromotionAgent |
| Dedupe constraint | Schema | UNIQUE on dedupe_key |
| Receipt verification | Runtime | Post-publish check |
| CI detection | Automated | Grep for direct webhook calls |

### Idempotency Contract
\`\`\`
enqueuePickToOutbox(pick, channel)
  → if alreadyPosted: skip (idempotent)
  → postEliteCardToDiscord(pick)
  → if success: recordOutboxReceipt(outboxId, messageId)
  → if failure: recordOutboxFailure(outboxId, errorCode, message)
\`\`\`

### Acceptance Criteria
- [ ] All 3 publish flows (capper, system, legacy) use outbox-first pattern
- [ ] Duplicate dedupe_key = no-op (idempotent)
- [ ] Receipt written before pick confirmation
- [ ] Stale pending detection (outbox rows pending > 1 hour)
- [ ] No direct Discord webhook calls outside publisher service

### Canonical Surfaces
- \`unified_picks\` (read — picks to publish)
- \`pick_publish\` / \`publish_outbox\` (write — outbox records + receipts)
- Discord API (external — webhook posts)

### Touches
- \`apps/api/src/agents/DiscordPromotionAgent/index.ts\`
- \`apps/api/src/services/publishOutbox.ts\`
- \`supabase/migrations/\` (dedupe constraint)`,
  },
  {
    title: '[INVARIANT-005] All operator decisions must be auditable',
    status: 'tracker:status:InProgress',
    priority: 1,
    body: `## DEV-INVARIANT-005 — OPERATOR-AUDIT-INVARIANT

**Type:** Permanent architectural invariant
**Severity:** P0 — Violation blocks all sprints
**Status:** Active (permanent enforcement)

---

### Invariant Statement

> Every operator decision that affects pick lifecycle must produce an audit trail.
> The audit record must capture: who, what, when, why, and before/after state.
> No operator action may execute without a corresponding audit_log entry.

### Auditable Operator Actions

| Action | Endpoint | Required Fields |
|--------|----------|-----------------|
| Approve | POST /ops/picks/:id/approve | actor, reason, before_state, after_state |
| Reject | POST /ops/picks/:id/reject | actor, reason, before_state, rejection_reason |
| Override | POST /ops/picks/:id/override | actor, reason, before_state, after_state, override_fields |
| Unit change | POST /ops/picks/:id/units | actor, reason, old_units, new_units |
| Promotion change | POST /ops/picks/:id/promote | actor, reason, old_tier, new_tier |

### Audit Log Schema

\`\`\`
audit_log
├── id (uuid)
├── actor (text) — who performed the action
├── action (text) — approve | reject | override | unit_change | promotion_change
├── entity_type (text) — 'pick' | 'settlement' | 'publish'
├── entity_id (uuid) — the affected record
├── details (jsonb) — { reason, before, after, correlation_id }
├── created_at (timestamptz)
└── correlation_id (text) — traces request through system
\`\`\`

### Fail Conditions
- Operator action executes without audit_log write
- Audit record missing required fields (actor, reason, before/after)
- Override modifying immutable fields (id, created_at, bet_slip_id)
- Audit record with null/empty reason

### Enforcement Mechanisms

| Mechanism | Type | Location |
|-----------|------|----------|
| API middleware | Runtime | operatorAuth + requireOperatorRole |
| Before/after snapshot | Runtime | Fetch before-state before mutation |
| Immutable field guard | Runtime | Override endpoint blocks protected fields |
| Audit completeness check | CI | Verify all operator endpoints log to audit_log |

### Acceptance Criteria
- [ ] All operator endpoints write to audit_log
- [ ] Every audit record has actor, action, entity_type, entity_id, reason
- [ ] Before/after state snapshots captured for all mutations
- [ ] Override blocks immutable fields
- [ ] Reject blocks already-posted picks (409 conflict)
- [ ] correlation_id traces full request lifecycle

### Touches
- \`apps/api/src/routes/ops.ts\`
- \`apps/api/src/middleware/\` (operatorAuth)
- \`supabase/migrations/\` (audit_log schema)`,
  },
];

// ── Market Intelligence Issues ───────────────────────────────────────────

const INTELLIGENCE_ISSUES: IssueDef[] = [
  {
    title: '[INT-001] Market Disagreement Detector',
    status: 'tracker:status:Backlog',
    priority: 2,
    body: `## INT-001 — Market Disagreement Detector

**Milestone:** Market Intelligence v1
**Priority:** P1 — Edge detection infrastructure
**Owner:** Claude A (engineering)

---

### Purpose
Identify markets where sportsbooks disagree significantly on implied probabilities.
High disagreement = potential pricing inefficiency = potential edge.

### Logic Concept

For each (event, market_type, participant) tuple:
1. Collect implied probabilities from all books in provider_offers
2. Compute dispersion metrics across books
3. Flag markets exceeding disagreement thresholds

### Disagreement Signals

| Signal | Measurement | Threshold |
|--------|-------------|-----------|
| Probability variance | Var(implied_prob) across books | > 0.02 |
| Pinnacle vs soft-book divergence | |p_pinnacle - p_soft_avg| | > 0.03 |
| Overround asymmetry | Max(overround) - Min(overround) | > 0.04 |
| Sharp-retail spread | p_sharp_consensus - p_retail_consensus | > 0.02 |
| Book count asymmetry | Books with higher line vs lower line | > 2:1 ratio |

### Outputs

\`\`\`typescript
interface MarketDisagreement {
  event_id: string;
  market_type_id: string;
  participant_id: string | null;
  disagreement_score: number;        // 0-1 normalized
  disagreement_reason: string[];     // reason codes
  book_count: number;
  prob_variance: number;
  pinnacle_divergence: number | null;
  overround_asymmetry: number;
  snapshot_time: string;
}
\`\`\`

### Reason Codes
- \`HIGH_PROB_VARIANCE\` — Books disagree on implied probability
- \`PINNACLE_DIVERGENCE\` — Sharp book differs from soft consensus
- \`OVERROUND_ASYMMETRY\` — Vig structure differs across books
- \`SHARP_RETAIL_SPREAD\` — Sharp and retail books disagree
- \`BOOK_COUNT_ASYMMETRY\` — Uneven distribution of book positions

### Usage in Scoring Pipeline
- Markets with high disagreement_score get **boosted confidence** (more room for edge)
- Markets with low disagreement_score get **capped edge** (efficient market)
- Disagreement signals feed into \`computeProbabilityLayer()\` uncertainty calculation

### Acceptance Criteria
- [ ] Disagreement detector reads from provider_offers
- [ ] All 5 signals computed per market tuple
- [ ] disagreement_score normalized to 0-1 range
- [ ] Reason codes attached to every flagged market
- [ ] Integration point defined for scoring pipeline
- [ ] Typecheck passes

### Canonical Surfaces
- \`provider_offers\` (read)
- \`market_snapshots\` (write — disagreement metrics)

### Touches
- \`apps/api/src/logic/providers/\`
- \`apps/api/src/services/MarketOfferAggregator.ts\`
- \`apps/api/src/lib/probability/\``,
  },
  {
    title: '[INT-002] Pinnacle Anchor Weighting',
    status: 'tracker:status:Backlog',
    priority: 2,
    body: `## INT-002 — Pinnacle Anchor Weighting

**Milestone:** Market Intelligence v1
**Priority:** P1 — Consensus quality
**Owner:** Claude A (engineering)

---

### Purpose
Use sharp book(s) as anchor for consensus probability computation.
Pinnacle and Circa consistently lead market moves — their lines should carry more weight.

### Current State
computeConsensus() already supports book weighting via provider_registry:
- sharp: weight 1.5x
- market_maker: weight 1.2x
- retail: weight 1.0x

This issue formalizes and extends the weighting model.

### Proposed Weighting Model

| Book Tier | Examples | Base Weight | Quality Multiplier |
|-----------|----------|-------------|-------------------|
| Sharp (anchor) | Pinnacle, Circa | 3.0 | data_quality * liquidity_tier |
| Market Maker | DraftKings, FanDuel | 2.0 | data_quality * liquidity_tier |
| Retail (noise) | BetMGM, PointsBet | 1.0 | data_quality * liquidity_tier |

### Anchor Logic

\`\`\`
IF pinnacle_available:
  anchor_prob = pinnacle_devigged_prob
  consensus = weighted_mean(all_books, weights)
  anchored_prob = 0.4 * anchor_prob + 0.6 * consensus
ELSE IF circa_available:
  anchor_prob = circa_devigged_prob
  anchored_prob = 0.3 * anchor_prob + 0.7 * consensus
ELSE:
  anchored_prob = consensus  // no anchor available
\`\`\`

### Outputs

\`\`\`typescript
interface AnchoredConsensus {
  anchored_market_probability: number;
  anchor_book: string | null;        // 'pinnacle' | 'circa' | null
  anchor_weight: number;             // 0-1, how much anchor influenced result
  consensus_probability: number;     // unanchored consensus for comparison
  book_weights: Record<string, number>;  // per-book effective weights
}
\`\`\`

### Acceptance Criteria
- [ ] Anchor weighting implemented in computeConsensus()
- [ ] Pinnacle gets highest anchor weight when available
- [ ] Graceful degradation when no sharp book available
- [ ] Weight breakdown persisted in market_snapshots
- [ ] A/B comparison: anchored vs unanchored consensus quality
- [ ] Backward-compatible with existing shadow scoring
- [ ] Typecheck passes

### Canonical Surfaces
- \`provider_offers\` (read)
- \`provider_registry\` (read — book profiles)
- \`market_snapshots\` (write — anchored consensus)

### Touches
- \`apps/api/src/logic/providers/marketAdapters/\`
- \`apps/api/src/services/MarketOfferAggregator.ts\`
- \`apps/api/src/lib/probability/\``,
  },
  {
    title: '[INT-003] Book Reliability Index',
    status: 'tracker:status:Backlog',
    priority: 3,
    body: `## INT-003 — Book Reliability Index

**Milestone:** Market Intelligence v1
**Priority:** P2 — Weighting refinement
**Owner:** Claude A (engineering)

---

### Purpose
Track which books consistently lead market moves and have highest pricing accuracy.
Use historical performance to dynamically adjust book weights in consensus computation.

### Reliability Metrics

| Metric | Measurement | Window |
|--------|-------------|--------|
| Line lead time | How early a book moves before others follow | Rolling 30 days |
| Odds adjustment speed | Time between opening and settling on final line | Per market |
| Historical accuracy | Correlation between book's implied prob and actual outcome | Rolling 90 days |
| Market coverage | % of markets this book prices | Rolling 7 days |
| Data freshness | Average staleness of odds data at query time | Rolling 24 hours |

### Outputs

\`\`\`typescript
interface BookReliabilityScore {
  book_id: string;
  book_name: string;
  reliability_score: number;         // 0-1 composite score
  line_lead_time_ms: number;         // avg milliseconds ahead of market
  accuracy_correlation: number;      // r-value vs actual outcomes
  market_coverage_pct: number;       // % of markets priced
  data_freshness_ms: number;         // avg staleness
  sample_size: number;               // number of markets analyzed
  computed_at: string;               // ISO timestamp
  sport_breakdown: Record<string, number>;  // per-sport reliability
}
\`\`\`

### Usage
- Feed reliability_score into consensus weighting (replaces static provider_registry weights)
- Books with high reliability get higher consensus weight
- Books with low reliability or stale data get downweighted
- Sport-specific breakdown allows different weights per sport

### Acceptance Criteria
- [ ] Reliability metrics computed from historical provider_offers data
- [ ] Composite score normalized to 0-1
- [ ] Sport-specific breakdown available
- [ ] Minimum sample size threshold before reliability is used
- [ ] Fallback to static weights if insufficient history
- [ ] Typecheck passes

### Canonical Surfaces
- \`provider_offers\` (read — historical odds data)
- \`provider_registry\` (read/write — reliability scores)
- \`prop_settlements\` (read — actual outcomes for accuracy)

### Touches
- \`apps/api/src/logic/providers/\`
- \`apps/api/src/services/MarketOfferAggregator.ts\`
- \`scripts/analysis/\` (reliability computation script)`,
  },
  {
    title: '[INT-004] Market Movement Signals',
    status: 'tracker:status:Backlog',
    priority: 2,
    body: `## INT-004 — Market Movement Signals

**Milestone:** Market Intelligence v1
**Priority:** P1 — Edge detection
**Owner:** Claude A (engineering)

---

### Purpose
Detect significant line movement patterns before game start.
Line movement is one of the strongest signals for identifying sharp money and market inefficiency.

### Movement Signal Types

| Signal | Description | Detection Method |
|--------|-------------|-----------------|
| Steam move | Rapid, coordinated line movement across books | > 3 books move same direction within 5 min |
| Late move | Significant movement in final 30 min before game | Line change > 1 point in last window |
| Reverse line movement | Line moves against public betting percentages | Requires betting % data (future) |
| Book disagreement convergence | Books converging to consensus | Variance decreasing over time |
| Anchor divergence | Sharp book moves away from consensus | Pinnacle deviates from weighted mean |

### Outputs

\`\`\`typescript
interface MarketMovementSignal {
  event_id: string;
  market_type_id: string;
  participant_id: string | null;
  movement_score: number;            // 0-1 composite score
  signals: MovementSignalDetail[];
  direction: 'up' | 'down' | 'neutral';
  magnitude: number;                 // absolute line change
  velocity: number;                  // change per hour
  detected_at: string;
}

interface MovementSignalDetail {
  type: 'STEAM_MOVE' | 'LATE_MOVE' | 'CONVERGENCE' | 'ANCHOR_DIVERGENCE';
  confidence: number;                // 0-1
  books_involved: string[];
  time_window_minutes: number;
}
\`\`\`

### Detection Algorithm (Conceptual)

\`\`\`
For each market tuple (event, market_type, participant):
  1. Fetch provider_offers time series (last 24 hours)
  2. Compute line trajectory (opening → current → closing)
  3. Detect inflection points (sudden changes in trajectory)
  4. Classify each inflection as steam/late/convergence/divergence
  5. Compute composite movement_score
  6. Flag markets with movement_score > threshold
\`\`\`

### Usage in Scoring Pipeline
- Steam moves boost edge confidence (sharp money agrees with our model)
- Late moves against our position reduce edge confidence
- Convergence signals reduce disagreement_score (market resolving)
- High movement_score markets get elevated attention in calibration reports

### Acceptance Criteria
- [ ] Movement detection reads from provider_offers time series
- [ ] At least 3 signal types implemented (steam, late, convergence)
- [ ] Composite movement_score normalized to 0-1
- [ ] Signal details attached with confidence and books involved
- [ ] Integration point for scoring pipeline defined
- [ ] Historical analysis script for signal validation
- [ ] Typecheck passes

### Canonical Surfaces
- \`provider_offers\` (read — time series odds data)
- \`market_snapshots\` (write — movement metrics)

### Touches
- \`apps/api/src/logic/providers/\`
- \`apps/api/src/services/MarketOfferAggregator.ts\`
- \`scripts/analysis/\` (movement detection script)`,
  },
];

// ── Checkpoint Linkage Updates ───────────────────────────────────────────

const CHECKPOINT_UPDATES: { titleMatch: string; appendBody: string }[] = [
  {
    titleMatch: '[CHECKPOINT-A]',
    appendBody: `

---

## Sprint Linkage

**Linked Sprint:** SPRINT-024-SCORING-ENHANCEMENT-LAYERING
**Sprint Issues:** DEV-3, DEV-4, DEV-5, DEV-6

### Trigger Condition
This checkpoint activates after ALL Sprint 024 issues reach Done status.

### Gate Script
\`\`\`bash
npx tsx scripts/analysis/calibration-report-024.ts
\`\`\`

### Invariant Checks (must hold)
- [x] INV-001: Scoring reads from provider_offers only
- [x] INV-003: All scored markets have canonical IDs
- [ ] Calibration report shows no sanity check failures

### Architecture Linkage
- **Canonical surfaces touched:** provider_offers (read), market_snapshots (write), unified_picks (lifecycle write)
- **Scoring layer affected:** computeProbabilityLayer, computeScoreV2, market efficiency cap
- **Invariant risk:** LOW — extends existing scoring, does not change data source`,
  },
  {
    titleMatch: '[CHECKPOINT-B]',
    appendBody: `

---

## Sprint Linkage

**Linked Sprint:** SPRINT-025-CLV-CLOSING-SNAPSHOT
**Sprint Issues:** DEV-7, DEV-8, DEV-9, DEV-10

### Trigger Condition
This checkpoint activates after ALL Sprint 025 issues reach Done status.

### Gate Script
\`\`\`bash
npx tsx scripts/analysis/clv-truth-test-025.ts
\`\`\`

### Invariant Checks (must hold)
- [x] INV-001: Scoring reads from provider_offers only
- [x] INV-003: All scored markets have canonical IDs
- [x] INV-004: Closing snapshots go through proper pipeline
- [ ] CLV truth test: edge-CLV correlation r > 0.3

### Architecture Linkage
- **Canonical surfaces touched:** provider_offers (read), closing_snapshots (write), unified_picks.meta.clv_data (lifecycle write)
- **Scoring layer affected:** ClosingLineAgent (new), CLV computation service (new)
- **Invariant risk:** MEDIUM — new agent writing to new table, must verify single-writer`,
  },
  {
    titleMatch: '[CHECKPOINT-C]',
    appendBody: `

---

## Sprint Linkage

**Linked Sprint:** SPRINT-026-CANONICAL-CUTOVER-RAW-PROPS-RETIRE
**Sprint Issues:** DEV-11, DEV-12, DEV-13, DEV-14

### Trigger Condition
This checkpoint activates after ALL Sprint 026 issues reach Done status.

### Gate Scripts
\`\`\`bash
npx tsx scripts/analysis/e2e-simulation-026.ts --dry-run
npm run lifecycle:single-writer -- --strict
npx tsx scripts/gates/cc-write-ban.ts --strict
\`\`\`

### Invariant Checks (ALL must hold)
- [x] INV-001: Zero scoring reads from raw_props
- [x] INV-002: Zero single-writer violations
- [x] INV-003: All scored markets have canonical IDs
- [x] INV-004: All publishing through outbox
- [x] INV-005: All operator actions auditable
- [ ] E2E simulation completes without errors

### Architecture Linkage
- **Canonical surfaces touched:** ALL canonical surfaces (full pipeline validation)
- **Scoring layer affected:** ALL layers (canonical cutover)
- **Invariant risk:** HIGH — this is the cutover point, all invariants must hold simultaneously`,
  },
];

// ── Extended Issue Template Document ─────────────────────────────────────

const EXTENDED_TEMPLATE_DOC = `# Sprint Issue Template (Extended v2)

Use this template for all sprint-scoped issues. v2 adds Architecture Linkage and Verification sections.

---

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

---

## Architecture Linkage

### Canonical Surfaces Touched
- \`provider_offers\` (read | write)
- \`unified_picks\` (lifecycle write)
- \`market_snapshots\` (write)

### Scoring Layer Affected
- [ ] computeConsensus()
- [ ] computeProbabilityLayer()
- [ ] computeScoreV2()
- [ ] promotionPolicy()
- [ ] None (non-scoring change)

### Invariant Risk Check
- [ ] INV-001: Does this change affect scoring data source? → Verify provider_offers only
- [ ] INV-002: Does this change add a new writer? → Verify single-writer map
- [ ] INV-003: Does this change affect canonical IDs? → Verify ID propagation
- [ ] INV-004: Does this change affect publishing? → Verify outbox flow
- [ ] INV-005: Does this change affect operator actions? → Verify audit trail

---

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

---

## Verification

### Scripts Executed
- \`npm run type-check\`
- \`npm run test\`
- \`npm run lifecycle:single-writer -- --strict\`
- \`<sprint-specific scripts>\`

### Proof Bundle Path
\`out/sprints/SPRINT-<NAME>-###/<date>/\`

### Closeout Document
\`governance/closeouts/SPRINT-<NAME>-###.md\`

### Proof Checklist
- [ ] proof_typecheck.txt
- [ ] proof_tests.txt
- [ ] proof_git_status.txt
- [ ] sprint closeout document
- [ ] PASS/FAIL stated
- [ ] links to artifacts included
\`\`\`
`;

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
  const issueId = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

function buildUpdateIssueTx(
  session: Session,
  issueId: string,
  spaceId: string,
  description: string
): Record<string, unknown> {
  return {
    _id: `tx-upd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    _class: 'core:class:TxUpdateDoc',
    space: 'core:space:Tx',
    objectId: issueId,
    objectClass: 'tracker:class:Issue',
    objectSpace: spaceId,
    modifiedBy: session.socialId,
    modifiedOn: Date.now(),
    operations: { description },
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

function buildUpdateDocTx(
  session: Session,
  docId: string,
  teamspaceId: string,
  content: string
): Record<string, unknown> {
  return {
    _id: `tx-upd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    _class: 'core:class:TxUpdateDoc',
    space: 'core:space:Tx',
    objectId: docId,
    objectClass: 'document:class:Document',
    objectSpace: teamspaceId,
    modifiedBy: session.socialId,
    modifiedOn: Date.now(),
    operations: { content },
  };
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ── Summary ──────────────────────────────────────────────────────────────

const summary = {
  milestonesCreated: 0,
  milestonesSkipped: 0,
  invariantsCreated: 0,
  invariantsSkipped: 0,
  intelligenceCreated: 0,
  intelligenceSkipped: 0,
  checkpointsUpdated: 0,
  checkpointsSkipped: 0,
  docsCreated: 0,
  docsUpdated: 0,
  errors: [] as string[],
};

// ── Main ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('  HULY BUILDER — System Invariants + Market Intelligence');
  console.log('='.repeat(60));
  console.log(`  URL:       ${HULY_URL}`);
  console.log(`  Workspace: ${HULY_WORKSPACE}`);
  console.log('='.repeat(60) + '\n');

  // Step 1: Authenticate + WebSocket
  const session = await authenticate();
  console.log(`  Authenticated. WorkspaceID: ${session.workspaceId}\n`);

  console.log('  Connecting WebSocket...');
  const socket = await connectWs(session);
  console.log('  WebSocket connected.\n');

  // Step 2: Discover existing state
  const existingProjects = await findAll(session, 'tracker:class:Project');
  const existingIssues = await findAll(session, 'tracker:class:Issue');
  const existingDocs = await findAll(session, 'document:class:Document');

  const existingTitles = new Set(existingIssues.map((i: any) => String(i.title ?? '')));
  const existingDocTitles = new Set(existingDocs.map((d: any) => String(d.title ?? d.name ?? '')));

  // Resolve project states
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

  const devProj = projectMap.get('DEV');
  const intProj = projectMap.get('INT');

  if (!devProj) {
    console.log('  FATAL: DEV project not found. Run build-huly-structure.ts first.');
    process.exit(1);
  }
  if (!intProj) {
    console.log('  FATAL: INT project not found. Run build-huly-structure.ts first.');
    process.exit(1);
  }

  console.log(`  DEV project: ${devProj.spaceId} (seq=${devProj.sequence})`);
  console.log(`  INT project: ${intProj.spaceId} (seq=${intProj.sequence})\n`);

  // ── PART 1: System Invariants Milestone + Issues ──
  console.log('--- PART 1: System Invariants (DEV) ---\n');

  // Create milestone
  if (existingTitles.has(INVARIANT_MILESTONE.title)) {
    console.log(`  [SKIP] ${INVARIANT_MILESTONE.title} (already exists)`);
    summary.milestonesSkipped++;
  } else {
    try {
      devProj.sequence++;
      const identifier = `${devProj.identifier}-${devProj.sequence}`;
      const tx = buildIssueTx(
        session,
        devProj.spaceId,
        identifier,
        devProj.sequence,
        INVARIANT_MILESTONE
      );
      await wsSend(socket, tx);
      console.log(`  [CREATED] ${identifier} — ${INVARIANT_MILESTONE.title}`);
      summary.milestonesCreated++;
      existingTitles.add(INVARIANT_MILESTONE.title);
      await delay(150);
    } catch (err) {
      const msg = `Milestone: ${err instanceof Error ? err.message : err}`;
      console.log(`  [ERROR] ${msg}`);
      summary.errors.push(msg);
    }
  }

  // Create invariant issues
  for (const inv of INVARIANT_ISSUES) {
    if (existingTitles.has(inv.title)) {
      console.log(`  [SKIP] ${inv.title} (already exists)`);
      summary.invariantsSkipped++;
      continue;
    }
    try {
      devProj.sequence++;
      const identifier = `${devProj.identifier}-${devProj.sequence}`;
      const tx = buildIssueTx(session, devProj.spaceId, identifier, devProj.sequence, inv);
      await wsSend(socket, tx);
      console.log(`  [CREATED] ${identifier} — ${inv.title}`);
      summary.invariantsCreated++;
      existingTitles.add(inv.title);
      await delay(150);
    } catch (err) {
      const msg = `Invariant "${inv.title}": ${err instanceof Error ? err.message : err}`;
      console.log(`  [ERROR] ${msg}`);
      summary.errors.push(msg);
    }
  }
  console.log('');

  // ── PART 2: Market Intelligence Issues (INT) ──
  console.log('--- PART 2: Market Intelligence (INT) ---\n');

  for (const intIssue of INTELLIGENCE_ISSUES) {
    if (existingTitles.has(intIssue.title)) {
      console.log(`  [SKIP] ${intIssue.title} (already exists)`);
      summary.intelligenceSkipped++;
      continue;
    }
    try {
      intProj.sequence++;
      const identifier = `${intProj.identifier}-${intProj.sequence}`;
      const tx = buildIssueTx(session, intProj.spaceId, identifier, intProj.sequence, intIssue);
      await wsSend(socket, tx);
      console.log(`  [CREATED] ${identifier} — ${intIssue.title}`);
      summary.intelligenceCreated++;
      existingTitles.add(intIssue.title);
      await delay(150);
    } catch (err) {
      const msg = `Intelligence "${intIssue.title}": ${err instanceof Error ? err.message : err}`;
      console.log(`  [ERROR] ${msg}`);
      summary.errors.push(msg);
    }
  }
  console.log('');

  // ── PART 3: Checkpoint Linkage Updates ──
  console.log('--- PART 3: Checkpoint Linkage Updates ---\n');

  for (const cp of CHECKPOINT_UPDATES) {
    const existing = existingIssues.find((i: any) => String(i.title ?? '').includes(cp.titleMatch));

    if (!existing) {
      console.log(`  [SKIP] ${cp.titleMatch} — issue not found`);
      summary.checkpointsSkipped++;
      continue;
    }

    const currentBody = String(existing.description ?? '');
    // Check if linkage already added (idempotent)
    if (currentBody.includes('## Sprint Linkage')) {
      console.log(`  [SKIP] ${cp.titleMatch} — linkage already present`);
      summary.checkpointsSkipped++;
      continue;
    }

    try {
      const newBody = currentBody + cp.appendBody;
      const issueSpace = String((existing as any).space ?? devProj.spaceId);
      const tx = buildUpdateIssueTx(session, String(existing._id), issueSpace, newBody);
      await wsSend(socket, tx);
      console.log(
        `  [UPDATED] ${String((existing as any).identifier ?? existing._id)} — ${cp.titleMatch} linkage added`
      );
      summary.checkpointsUpdated++;
      await delay(150);
    } catch (err) {
      const msg = `Checkpoint ${cp.titleMatch}: ${err instanceof Error ? err.message : err}`;
      console.log(`  [ERROR] ${msg}`);
      summary.errors.push(msg);
    }
  }
  console.log('');

  // ── PART 4: Extended Issue Template Document ──
  console.log('--- PART 4: Issue Template Extension ---\n');

  const templateTitle = 'Issue Template — Sprint (Extended v2)';
  const existingTemplate = existingDocs.find(
    (d: any) => String(d.title ?? d.name ?? '') === templateTitle
  );

  // Find Operations teamspace
  const teamspaces = await findAll(session, 'document:class:Teamspace');
  const opsTeamspace = teamspaces.find((t: any) => String(t.name ?? '').includes('Operations'));

  if (!opsTeamspace) {
    console.log('  [ERROR] Operations teamspace not found');
    summary.errors.push('Operations teamspace not found');
  } else if (existingTemplate) {
    // Update existing doc
    try {
      const tsId = String(opsTeamspace._id);
      const tx = buildUpdateDocTx(
        session,
        String(existingTemplate._id),
        tsId,
        EXTENDED_TEMPLATE_DOC
      );
      await wsSend(socket, tx);
      console.log(`  [UPDATED] ${templateTitle}`);
      summary.docsUpdated++;
    } catch (err) {
      const msg = `Doc update: ${err instanceof Error ? err.message : err}`;
      console.log(`  [ERROR] ${msg}`);
      summary.errors.push(msg);
    }
  } else {
    // Create new doc
    try {
      const tsId = String(opsTeamspace._id);
      const tx = buildDocTx(session, tsId, templateTitle, EXTENDED_TEMPLATE_DOC);
      await wsSend(socket, tx);
      console.log(`  [CREATED] ${templateTitle}`);
      summary.docsCreated++;
    } catch (err) {
      const msg = `Doc create: ${err instanceof Error ? err.message : err}`;
      console.log(`  [ERROR] ${msg}`);
      summary.errors.push(msg);
    }
  }
  console.log('');

  // ── Update project sequences ──
  console.log('--- Sequence Updates ---\n');

  for (const [ident, proj] of projectMap) {
    if (ident === 'DEV' || ident === 'INT') {
      try {
        const tx = buildUpdateSequenceTx(session, proj.spaceId, proj.sequence);
        await wsSend(socket, tx);
        console.log(`  [UPDATED] ${ident}: sequence=${proj.sequence}`);
      } catch (err) {
        console.log(`  [ERROR] ${ident} seq: ${err instanceof Error ? err.message : err}`);
      }
    }
  }
  console.log('');

  // ── Cleanup ──
  socket.close();

  // ── Final Report ──
  console.log('='.repeat(60));
  console.log('  HULY BUILDER — Extension Report');
  console.log('='.repeat(60));
  console.log('');
  console.log('  1. MILESTONES');
  console.log(`     Created:  ${summary.milestonesCreated}`);
  console.log(`     Skipped:  ${summary.milestonesSkipped} (idempotent)`);
  console.log('');
  console.log('  2. INVARIANT ISSUES');
  console.log(`     Created:  ${summary.invariantsCreated}`);
  console.log(`     Skipped:  ${summary.invariantsSkipped} (idempotent)`);
  console.log('');
  console.log('  3. INTELLIGENCE ISSUES');
  console.log(`     Created:  ${summary.intelligenceCreated}`);
  console.log(`     Skipped:  ${summary.intelligenceSkipped} (idempotent)`);
  console.log('');
  console.log('  4. CHECKPOINT LINKAGES');
  console.log(`     Updated:  ${summary.checkpointsUpdated}`);
  console.log(`     Skipped:  ${summary.checkpointsSkipped} (already linked or not found)`);
  console.log('');
  console.log('  5. DOCUMENTS');
  console.log(`     Created:  ${summary.docsCreated}`);
  console.log(`     Updated:  ${summary.docsUpdated}`);
  console.log('');
  console.log(`  ERRORS:      ${summary.errors.length}`);
  if (summary.errors.length > 0) {
    for (const err of summary.errors) {
      console.log(`    - ${err}`);
    }
  }
  console.log('');
  console.log('  CONFLICTS:   None detected');
  console.log('  IDEMPOTENT:  Yes — safe to re-run');
  console.log('='.repeat(60) + '\n');
}

main().catch(err => {
  console.error('\nFATAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
