# System Gap Analysis — Current vs Target

> Updated: 2026-03-08 | Sprint: SPRINT-044H (originally
> SPRINT-SYSTEM-DOCUMENTATION-FOUNDATION)

---

## Classification

| Severity     | Meaning                                    |
| ------------ | ------------------------------------------ |
| **CRITICAL** | Must fix for system correctness            |
| **HIGH**     | Architecture risk, data integrity concern  |
| **MEDIUM**   | Improvement needed for target architecture |
| **LOW**      | Cosmetic or minor enhancement              |

---

## GAP-01: Ingestion writes to raw_props instead of provider_offers [CRITICAL → PARTIALLY RESOLVED]

**Status update (SPRINT-044G, 2026-03-08)**: SGO canonical path now writes to
`provider_offers` with 0 raw_props writes. 2,108 SGO rows inserted, 10
canonical_events auto-created, 94 participant FKs resolved.

**Current**: SGO ingestion via `ingestSGOProviderOffers()` writes to
`provider_offers` (proven). OddsAPI also writes to `provider_offers` via
`ingestProviderOffers()` (1.38M+ rows). FeedAgent still writes to `raw_props` as
the default scheduler path.

**Remaining**:

- Optimal API adapter for provider_offers path not yet wired
- Scheduler default still calls FeedAgent → raw_props
- GradingAgent default still reads raw_props (`GRADING_DATA_SOURCE=raw_props`)

**Fix scope**: Wire Optimal adapter, switch scheduler default to V3 path.

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

## GAP-05: No systematic event/participant resolution during ingestion [HIGH → RESOLVED for V3 path]

**Status update (SPRINT-044F/044G, 2026-03-08)**:
`upsert_provider_offers_bootstrap` RPC auto-creates events in
`canonical_events`, resolves participants via external_id → name → auto-create
cascade, and resolves markets. Runtime-proven: 10 events created, 94 participant
FKs resolved, 0 resolution failures.

**Current**: V3 path (provider_offers) has full FK resolution. Legacy path
(raw_props) still stores strings with no FK resolution.

**Remaining**: Legacy raw_props path still has no resolution. This resolves
naturally when raw_props is retired.

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

## GAP-08: provider_offers ingestion not wired to scheduler [MEDIUM → PARTIALLY RESOLVED]

**Status update (SPRINT-044F/044G)**: SGO ingestion path
(`ingestSGOProviderOffers()`) is proven working and callable. The scheduler has
a `providerOffersIngestionWorkflow` that calls `ingestV3ProviderOffers`. However
the primary scheduler loop still defaults to `ingestUnifiedData()` → raw_props.

**Remaining**: Make the V3 path the scheduler default instead of a parallel
call.

---

## GAP-09: Missing SGO and Optimal adapters for provider_offers path [MEDIUM → PARTIALLY RESOLVED]

**Status update (SPRINT-044F)**: SGO adapter (`ingestSGOProviderOffers()`)
created and runtime-proven in 044G. Transforms SGO API data into
`ProviderOfferPayload` format and calls `upsert_provider_offers_bootstrap` RPC.

**Remaining**: Optimal API adapter for provider_offers path not yet created.

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

| #   | Gap                                              | Severity             | Category         | Status (044H)                |
| --- | ------------------------------------------------ | -------------------- | ---------------- | ---------------------------- |
| 01  | Ingestion targets raw_props not provider_offers  | CRITICAL → PARTIAL   | Data contract    | SGO V3 path proven           |
| 02  | Settlement uses Odds API not SGO                 | CRITICAL             | Settlement       | Open                         |
| 03  | Lifecycle adapter blocks promotion (id field)    | CRITICAL             | Pipeline blocker | Open                         |
| 04  | GradingAgent reads raw_props not provider_offers | HIGH                 | Architecture     | Feature-flagged              |
| 05  | No event/participant FK resolution               | HIGH → RESOLVED (V3) | Data integrity   | Proven in 044G               |
| 06  | Promotion policy disabled by default             | HIGH                 | Configuration    | Open                         |
| 07  | Dual scoring agents overlap                      | MEDIUM               | Architecture     | ScoringAgent archived (044E) |
| 08  | provider_offers ingestion not in scheduler       | MEDIUM → PARTIAL     | Integration      | SGO path proven              |
| 09  | Missing SGO/Optimal provider_offers adapters     | MEDIUM → PARTIAL     | Integration      | SGO proven, Optimal pending  |
| 10  | No closing line capture workflow                 | MEDIUM               | Feature gap      | Open (unblocked by 044G)     |
| 11  | Settlement bet_side uses odds heuristic          | MEDIUM               | Settlement       | Open                         |
| 12  | Missing index on raw_props.source                | LOW                  | Performance      | Open                         |
| 13  | Supabase query timeouts                          | LOW                  | Performance      | Open                         |
| 14  | PlayerEnrichmentAgent uses deprecated table      | LOW                  | Migration        | Open                         |

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
