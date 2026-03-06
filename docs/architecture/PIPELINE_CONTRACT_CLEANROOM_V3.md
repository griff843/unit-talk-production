Unit Talk Clean-Room V3 Pipeline Contract SaaS-first intelligence core, Discord
as the face Status

Type: Canonical architecture + pipeline contract

Binding: All ingestion, scoring, promotion, publishing, settlement, and operator
workflows

Primary goal: Eliminate drift by defining one golden path with strict ownership
and forbidden paths

0. Purpose

Unit Talk must behave like a production-grade, audited intelligence system:

Market truth is captured deterministically

Scoring is reproducible and fail-closed

Publishing is idempotent and guarded

Operator control exists without corrupting canonical truth

All E2E states are traceable with receipts

This contract defines:

canonical data surfaces (tables)

the end-to-end “golden path”

application responsibilities

single-writer ownership rules

operator finalization layer

Smart Form input layer

forbidden paths

proof requirements

1. The single most important design decision Canonical surfaces are Offers and
   Decisions

We separate:

Offers = what the market/books are offering (multi-book, time-series)

Decisions = what Unit Talk believes and is willing to publish (scored +
promoted)

This prevents:

identity drift

fuzzy joins

“silent fallback” bugs

pipeline bypasses

2. Canonical tables (Clean-Room V3) 2.1 Canonical “Offers” surfaces

provider_offers (canonical ingest surface) Multi-book, timestamped, canonical
IDs resolved, idempotent upsert.

market_snapshots (canonical derived market truth) Multi-book consensus + devig +
weights + overround + method versioning.

2.2 Canonical “Decisions” surfaces

unified_picks (canonical scored decision surface) Holds probability primitives,
model versions, tier/confidence, promotion decision.

2.3 Canonical “Delivery” surfaces

publish_outbox (canonical publish queue) Idempotent publish jobs + receipts. No
“post directly from picks” without outbox.

2.4 Canonical “Outcome” surfaces

settlements (canonical outcomes / grading truth) Immutable once finalized (or
append-only revisions with audit trail).

2.5 Canonical “Narrative” surfaces

recaps (derived outputs only) Never used for scoring or market truth.

2.6 Non-canonical / legacy surfaces

raw_props (NOT CANONICAL in Clean-Room V3) If it exists, it must be explicitly
one of:

staging-only (transient landing, immediately resolved to canonical IDs), or

compat-only (read-only legacy), or

retired (test fixtures only)

Rule: raw_props is never the authoritative join surface for multi-book
consensus.

3. End-to-end pipeline (Golden Path) Stage A — Ingestion (Offers)

Goal: capture everything the market offers with canonical identity.

Flow:

FeedAgent pulls provider data (SGO/Odds API/etc.)

Normalize into Unified Offer Schema

Upsert into provider_offers using a single canonical RPC that:

resolves canonical IDs

dedupes (idempotent)

enforces schema correctness

logs provider call usage / telemetry

Required canonical IDs produced immediately:

event_id

participant_id

market_type_id

offer_id (or equivalent offer PK)

Hard rule: No scoring happens without canonical IDs.

Stage B — Consensus + Devig (Market snapshots)

Goal: derive market truth from multi-book offers.

Flow:

Snapshot step groups offers by canonical market key (event_id, participant_id,
market_type_id, line/side)

Compute:

implied probabilities

overround

devig fair probabilities

book weighting

consensus devig probability (p_market_devig)

Write market_snapshots with:

devig_method

overround

weights_json

fair probabilities json

devig spec version

Devig must follow the Devig Normalization Spec.

DEVIG_NORMALIZATION_SPEC_v1

Stage C — Probability Layer + Scoring (Decisions)

Goal: compute Unit Talk belief, uncertainty, edge, and promotability.

Flow:

Probability Layer consumes:

p_market_devig (market prior)

feature vectors (projections, usage, role, matchup, signals)

movement/steam resistance signals (if available)

Produces primitives:

p_final

uncertainty_final

edge_final

clv_forecast

Grading engine assigns:

tier

confidence

reason codes

Promotion policy assigns:

promotion_band: HARD / SOFT / NO_POST

fail-closed if primitives missing/invalid

Write: one canonical writer writes into unified_picks idempotently (no direct
inserts outside lifecycle writer adapter).

Stage D — Operator Finalization (Command Center)

Goal: enable human control without corrupting canonical truth.

Command Center role:

reads unified_picks and related snapshots

presents ranked candidates + reasoning + market context

enables Operator to finalize a decision that governs publishing

Finalization outcomes:

Approve → creates/updates publish_outbox entry (preferred) OR marks finalized
fields on pick (must be audited)

Reject → pick stays NO_POST / not queued

Override (allowed but audited) → Operator may adjust within strict bounds:

must write override_reason, override_by, override_at

must not invent missing primitives

must not bypass promotion gates unless explicitly “manual publish mode” is
enabled with audit logging

Hard rule: Operator actions mutate state only through API routes that enforce
invariants (RBAC + audit log). Command Center never writes directly to DB.

Stage E — Publish (Discord as the face)

Goal: publish only promotable decisions with idempotency + receipts.

Flow:

PublishAgent reads publish_outbox (or creates outbox rows from unified_picks
that are finalized + HARD)

Posts to Discord

Writes receipt + message ID

Marks outbox posted

Marks pick posted (if applicable) in a controlled, audited way

Hard invariants:

no duplicates

no invalid band/tier posts

no direct post without outbox receipt trail

Stage F — Settlement + Postmortem

Goal: immutable outcome truth + learning loop inputs.

Flow:

SettlementAgent reads final stats

Writes settlements immutably

Generates postmortem/learning features:

projection miss vs variance vs market move vs execution

Feeds training evaluation (walk-forward harness)

4. Smart Form wiring (Input Plane)

Goal: allow manual entries while preserving canonical identity.

Rules:

Smart Form never writes directly to DB.

Smart Form posts to API as a “manual offer” or “manual candidate pick”.

Preferred model (Clean-Room V3)

Smart Form creates:

provider_offers rows with provider='manual' (or provider='operator')

canonical IDs are resolved at ingest (same resolver as automated providers)

Then the normal pipeline runs: provider_offers → market_snapshots →
unified_picks → Operator finalize → outbox → Discord

Key: Smart Form does not create an alternate scoring path.

5. Apps and responsibilities apps/api (canonical orchestrator)

FeedAgent: ingestion into provider_offers

Snapshot/Consensus: compute market_snapshots

ScoringAgent: write unified_picks

PublishAgent: manage publish_outbox, post to Discord, write receipts

SettlementAgent: write settlements

Audit/Telemetry: truth logs, credit usage, invariants

Discord bot

Presentation + interaction only

May write receipts / interaction telemetry

Must not write canonical picks/offers directly

Command Center

Operator UI only

Reads canonical data

Writes only via API endpoints (RBAC + audit logging)

Controls finalize/approve/reject/override flows

Smart Form

Input UI only

Writes only via API endpoints

Uses canonical resolver for identity

6. Ownership map (single-writer) Table Canonical writer Notes provider_offers
   FeedAgent canonical ingest only market_snapshots Snapshot/Scoring pre-step
   derived, deterministic unified_picks ScoringAgent only after primitives
   computed publish_outbox PublishAgent (or API finalize endpoint) idempotent
   publish queue settlements SettlementAgent immutable finalize recaps
   RecapAgent derived only raw_props no canonical writer staging/legacy only
7. Forbidden paths (must be blocked) Strictly forbidden

Fuzzy matching joins to reach provider_offers consensus

Inline scoring functions bypassing Probability/Promotion pipeline

Direct inserts into unified_picks bypassing lifecycle writer adapter

Posting to Discord without outbox receipts

Any publish attempt that ignores promotion_band + tier rules

Command Center writing directly to DB (must go through API)

Enforcement mechanisms

CI grep gates (detect illegal patterns)

runtime asserts (fail-closed)

DB constraints (e.g., posted_to_discord requires HARD + S/A/B)

audit logs + receipts required for operator override

8. Proof requirements (E2E readiness)

To declare production-ready, we must produce proof artifacts showing:

Multi-book offers exist per market

market_snapshots computed with devig method + weights

unified_picks contains non-null primitives when bookCount sufficient

promotion policy blocks invalid primitives (fail-closed)

operator finalize creates outbox rows with audit trail

publish creates Discord receipts and marks outbox posted

settlement finalizes outcomes immutably

recaps generated from settled picks only
