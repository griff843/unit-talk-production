# System Gap Analysis — Current vs Target

> Generated: 2026-03-07 | Sprint: SPRINT-SYSTEM-DOCUMENTATION-FOUNDATION

---

## Classification

| Severity     | Meaning                                    |
| ------------ | ------------------------------------------ |
| **CRITICAL** | Must fix for system correctness            |
| **HIGH**     | Architecture risk, data integrity concern  |
| **MEDIUM**   | Improvement needed for target architecture |
| **LOW**      | Cosmetic or minor enhancement              |

---

## GAP-01: Ingestion writes to raw_props instead of provider_offers [CRITICAL]

**Current**: FeedAgent ingests all provider data into `raw_props` (flat,
denormalized, COMPATIBILITY tier). The 043A sprint wired SGO into this path.

**Target**: All ingestion flows through `upsert_provider_offers_bootstrap` RPC
into `provider_offers` (normalized, CANONICAL V3 tier) with auto-event creation
and FK resolution.

**Impact**:

- `raw_props` is officially deprecated (TD-1, SPRINT-035B)
- No FK resolution occurs — event, market, and participant identity is stored as
  loose strings
- CLV tracking impossible without provider_offers snapshots
- Closing line capture has no data source

**Existing partial implementation**: `providerOffersIngestion.ts` already
handles Odds API -> provider_offers flow but is not wired to the scheduler. SGO
and Optimal API have no provider_offers adapter.

**Fix scope**: Wire SGO and Optimal adapters to produce `ProviderOfferPayload`,
integrate into scheduler, deprecate raw_props ingestion path.

---

## GAP-02: Settlement uses Odds API instead of SGO as primary source [CRITICAL]

**Current**: SettlementAgent's `fetchGameSettlementData()` calls Odds API
`/scores` endpoint for game results. SGO is not queried for settlement.

**Target**: Settlement priority should be:

1. SGO API (finalized=true, expandResults=true) — no credit cost
2. Odds API /scores — uses credits
3. player_game_stats + stat-resolver
4. Manual review

**Impact**:

- Odds API costs credits for settlement that SGO provides free
- SGO's `finalized` flag provides stronger settlement confidence than Odds API
- Player prop settlement (actual_value resolution) not systematically
  implemented

**Fix scope**: Add `fetchSettlementFromSGO()` to SettlementAgent, implement
settlement source priority chain.

---

## GAP-03: Lifecycle adapter field authority error blocks promotion [CRITICAL]

**Current**: GradingAgent's `promoteToUnifiedPicks()` calls `lifecycleInsert()`
with `writerRole: 'promoter'`, but the payload includes `id` field. The
write-adapter rejects this: "Writer role 'promoter' is not authorized to update
field 'id'".

**Target**: `id` should either be excluded from the promoter payload (let the
adapter auto-generate) or `id` should be added to the promoter's allowed fields.

**Impact**: No props can be promoted to unified_picks via the automated
pipeline. The entire grading -> promotion -> posting path is blocked.

**Fix scope**: Modify GradingAgent to exclude `id` from the payload, OR update
writer-authority to allow promoter to set `id`.

---

## GAP-04: GradingAgent reads raw_props but target uses provider_offers [HIGH]

**Current**: GradingAgent fetches ungraded props from `raw_props` WHERE
`processed_at IS NULL`.

**Target**: Scoring should read from `provider_offers` with market consensus
context (multi-book agreement, line movement, book profiles).

**Impact**:

- Scoring lacks multi-book context (only sees one provider's line)
- Edge calculations cannot use consensus devigging
- Feature vectors are incomplete without market microstructure data

**Fix scope**: Adapt GradingAgent to read from `provider_offers` joined with
`events`, `markets`, `participants`. Requires significant scoring pipeline
refactor.

---

## GAP-05: No systematic event/participant resolution during ingestion [HIGH]

**Current**: Ingestion stores player names and team names as strings in
`raw_props`. No resolution to canonical `participants` or `events` tables
occurs.

**Target**: The `upsert_provider_offers_bootstrap` RPC automatically creates
events and resolves participant/market FKs during insertion.

**Impact**:

- Settlement must do string matching instead of FK joins
- Player identity is ambiguous (e.g., "Mike Williams" could be multiple players)
- No canonical event timeline for scheduling settlement windows

**Fix scope**: Route ingestion through the provider_offers RPC path which
handles resolution automatically.

---

## GAP-06: PROMOTION_POLICY_V2 is disabled by default [HIGH]

**Current**: `PROMOTION_POLICY_V2=false` by default. This means the entire
promotion evaluation is bypassed — no props can be automatically promoted.

**Target**: Policy should be enabled with appropriate canary configuration for
gradual rollout.

**Impact**: The automated pipeline is functionally disabled at the promotion
gate. Even if GAP-03 (lifecycle error) were fixed, no props would be promoted
because the policy is off.

**Fix scope**: Set `PROMOTION_POLICY_V2=true` in environment, configure canary
sports and percent for controlled rollout.

---

## GAP-07: Dual scoring agents (GradingAgent vs ScoringAgent) [MEDIUM]

**Current**: Both GradingAgent and ScoringAgent write to `raw_props` (tier,
edge_score). Their responsibilities overlap:

- GradingAgent: `gradeProp()` assigns tier, evaluates promotion
- ScoringAgent: computes `edge_score`, assigns tier, sets `is_postable`

**Target**: Single unified scoring pipeline with clear separation of concerns.

**Impact**:

- Potential race condition if both agents process same prop
- Conflicting tier assignments possible
- Unclear which agent's score is authoritative

**Fix scope**: Consolidate into single scoring pipeline or clearly separate
responsibilities (e.g., ScoringAgent handles edge computation, GradingAgent
handles promotion evaluation only).

---

## GAP-08: provider_offers ingestion not wired to scheduler [MEDIUM]

**Current**: `providerOffersIngestion.ts` exists and works for Odds API, but is
not called by the syndicateSchedulerWorkflow. The scheduler only calls
`ingestUnifiedData()` which writes to `raw_props`.

**Target**: Scheduler calls provider_offers ingestion as the primary path.

**Impact**: provider_offers table exists but is not continuously populated by
the scheduler.

**Fix scope**: Add `ingestProviderOffers()` call to the scheduler workflow,
either replacing or alongside `ingestUnifiedData()`.

---

## GAP-09: Missing SGO and Optimal adapters for provider_offers path [MEDIUM]

**Current**: Only Odds API has a `ProviderOfferPayload` adapter in
`providerOffersIngestion.ts`. SGO and Optimal API have no equivalent.

**Target**: All three providers have adapters that produce
`ProviderOfferPayload`.

**Impact**: Even if the scheduler called provider_offers ingestion, only Odds
API data would be stored. SGO and Optimal data would be lost.

**Fix scope**: Create `transformSGOToV3Payloads()` and
`transformOptimalToV3Payloads()` functions.

---

## GAP-10: No closing line capture workflow [MEDIUM]

**Current**: `ClosingSnapshotService` exists but depends on `provider_offers`
being populated. Since ingestion goes to `raw_props`, closing snapshots are
never captured.

**Target**: Closing snapshots captured 30 minutes before game start from
multi-book provider_offers data.

**Impact**: CLV computation is impossible without closing snapshots. Performance
attribution lacks closing line value.

**Fix scope**: Depends on GAP-01 (ingestion to provider_offers) being resolved
first.

---

## GAP-11: SettlementAgent bet_side determination uses odds heuristic [MEDIUM]

**Current**: `calculatePropSettlement()` determines bet_side using
`prop.over_odds > 0` heuristic instead of reading the explicit `selection`
field.

**Target**: Use `prop.selection || prop.prediction || prop.side` for
deterministic side identification.

**Impact**: Settlement could incorrectly assign WIN/LOSS if odds don't correlate
with the actual selection.

**Fix scope**: Update `calculatePropSettlement()` to use explicit selection
field.

---

## GAP-12: No index on raw_props.source column [LOW]

**Current**: Queries filtering by `source='sgo'` on `raw_props` time out due to
missing index.

**Target**: If raw_props is retained during migration, add index. If retired, no
action needed.

**Impact**: Monitoring queries and proof capture for SGO ingestion are slow.

**Fix scope**: `CREATE INDEX idx_raw_props_source ON raw_props(source)` or
accept as temporary since raw_props is being retired.

---

## GAP-13: Supabase query timeouts on large raw_props queries [LOW]

**Current**: Count queries and filtered selects on raw_props time out at
Supabase statement timeout.

**Target**: Either index the table or retire it.

**Impact**: Operational monitoring difficulty. Does not affect pipeline
correctness.

---

## GAP-14: PlayerEnrichmentAgent uses deprecated `players` table [LOW]

**Current**: PlayerEnrichmentAgent reads/writes the `players` table which is
deprecated in favor of `participants`.

**Target**: Migrate to read/write `participants` table.

**Impact**: Enrichment data is stored in deprecated table, not available to V3
pipeline.

**Fix scope**: Update PlayerEnrichmentAgent to use `participants` table.

---

## Summary

| #   | Gap                                              | Severity | Category         |
| --- | ------------------------------------------------ | -------- | ---------------- |
| 01  | Ingestion targets raw_props not provider_offers  | CRITICAL | Data contract    |
| 02  | Settlement uses Odds API not SGO                 | CRITICAL | Settlement       |
| 03  | Lifecycle adapter blocks promotion (id field)    | CRITICAL | Pipeline blocker |
| 04  | GradingAgent reads raw_props not provider_offers | HIGH     | Architecture     |
| 05  | No event/participant FK resolution               | HIGH     | Data integrity   |
| 06  | Promotion policy disabled by default             | HIGH     | Configuration    |
| 07  | Dual scoring agents overlap                      | MEDIUM   | Architecture     |
| 08  | provider_offers ingestion not in scheduler       | MEDIUM   | Integration      |
| 09  | Missing SGO/Optimal provider_offers adapters     | MEDIUM   | Integration      |
| 10  | No closing line capture workflow                 | MEDIUM   | Feature gap      |
| 11  | Settlement bet_side uses odds heuristic          | MEDIUM   | Settlement       |
| 12  | Missing index on raw_props.source                | LOW      | Performance      |
| 13  | Supabase query timeouts                          | LOW      | Performance      |
| 14  | PlayerEnrichmentAgent uses deprecated table      | LOW      | Migration        |

---

## Recommended Priority Order

1. **GAP-03** (lifecycle adapter) — Unblocks the entire automated pipeline
2. **GAP-06** (promotion policy) — Enables automated promotion after GAP-03
3. **GAP-01 + GAP-08 + GAP-09** (provider_offers migration) — Core architecture
   alignment
4. **GAP-02** (SGO settlement) — Enables free settlement without API credits
5. **GAP-05** (FK resolution) — Comes with GAP-01 via RPC
6. **GAP-04** (scoring from provider_offers) — Enables multi-book consensus
   scoring
7. **GAP-10** (closing snapshots) — Enables CLV computation
8. **GAP-07** (scoring consolidation) — Architecture cleanup
9. **GAP-11** (bet_side fix) — Settlement correctness
10. **GAP-12/13/14** — Low priority operational improvements
