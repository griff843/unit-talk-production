# Runtime Dataflow — Target Architecture

> Generated: 2026-03-07 | Sprint: SPRINT-SYSTEM-DOCUMENTATION-FOUNDATION

---

## Overview

The target architecture replaces the flat `raw_props` ingestion path with the
normalized V3 schema centered on `provider_offers`. All provider data flows
through a single normalized ingestion pipeline with FK resolution, then feeds
scoring and promotion.

```
Provider APIs -> Router -> provider_offers (via RPC) -> ScoringPipeline -> unified_picks -> Discord -> SettlementAgent
```

---

## Pipeline Stages

### Stage 1: Normalized Ingestion

```
syndicateSchedulerWorkflow (every 2 min)
  +-- leagueIngestionWorkflow() x N leagues (parallel)
       +-- ingestProviderOffers({ sport, markets })
            +-- Fetch from provider (SGO / Odds API / Optimal)
            +-- Transform to ProviderOfferPayload
            +-- Call upsert_provider_offers_bootstrap RPC
            |     +-- Auto-create events (if new)
            |     +-- Resolve market_id (canonical_key lookup)
            |     +-- Resolve participant_id (external_id match)
            |     +-- INSERT into provider_offers
            +-- Update Redis cache (90s TTL)
```

| Attribute            | Value                                                            |
| -------------------- | ---------------------------------------------------------------- |
| **Tables written**   | `provider_offers`, `events` (auto-created), `markets` (resolved) |
| **Writer of record** | IngestionAgent (via `upsert_provider_offers_bootstrap` RPC)      |
| **Trigger**          | Temporal schedule                                                |
| **Normalization**    | All providers map to `ProviderOfferPayload` before RPC           |

### Stage 2: Market Consensus and Closing Snapshots

```
closingSnapshotWorkflow (30 min before game start)
  +-- Fetch all provider_offers for event
  +-- Filter books with book_count >= 3
  +-- computeConsensus() -> proportional devigging
  +-- INSERT into closing_snapshots
```

| Attribute            | Value                                  |
| -------------------- | -------------------------------------- |
| **Tables read**      | `provider_offers`, `events`            |
| **Tables written**   | `closing_snapshots`                    |
| **Writer of record** | ClosingSnapshotService (single-writer) |

### Stage 3: Scoring and Grading

```
scoringWorkflow()
  +-- Fetch provider_offers with market context
  +-- Build feature vectors (market consensus, line movement, book agreement)
  +-- computeScoreV2() -> { score, tier, edge, ev }
  +-- evaluatePromotion() -> { promote, band }
  +-- If promote=true: lifecycleInsert() -> unified_picks
```

| Attribute            | Value                                                                       |
| -------------------- | --------------------------------------------------------------------------- |
| **Tables read**      | `provider_offers`, `closing_snapshots`, `events`, `markets`, `participants` |
| **Tables written**   | `feature_snapshots`, `unified_picks` (via lifecycle adapter)                |
| **Writer of record** | GradingAgent (promoter role)                                                |

### Stage 4: Discord Posting (unchanged)

Same as current: atomicClaimForPost -> Discord webhook -> lifecycleUpdate.

### Stage 5: Settlement (provider-native)

```
settlementWorkflow()
  +-- Fetch completed events from events table
  +-- For each event with settled picks:
       +-- fetchSettlementFromSGO(event)       [Priority 1]
       |     +-- SGO API with finalized=true
       |     +-- Match by event.external_id (SGO eventID)
       +-- fetchSettlementFromOddsApi(event)   [Priority 2]
       |     +-- Odds API /scores endpoint
       |     +-- Match by event.external_id
       +-- resolveActualValue(stat_type, stats) [Priority 3]
       |     +-- player_game_stats lookup
       |     +-- stat-resolver mapping
       +-- resolveOutcome(actual, line) -> WIN/LOSS/PUSH
       +-- lifecycleSettle() with settlement_source tag
```

| Attribute             | Value                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------- |
| **Tables read**       | `events`, `unified_picks`, `provider_offers` (for market context), `player_game_stats` |
| **Tables written**    | `prop_settlements` (via lifecycleSettle), `unified_picks`                              |
| **Writer of record**  | SettlementAgent (settler role)                                                         |
| **Settlement source** | Tracked in `settlement_source` field                                                   |

### Stage 6: CLV Computation

```
clvWorkflow() (post-settlement)
  +-- For each settled pick:
       +-- Fetch closing_snapshots for market_key
       +-- Compute CLV: p_entry - p_close
       +-- INSERT into clv_results
```

| Attribute            | Value                                                     |
| -------------------- | --------------------------------------------------------- |
| **Tables read**      | `unified_picks`, `closing_snapshots`, `feature_snapshots` |
| **Tables written**   | `clv_results`                                             |
| **Writer of record** | CLVComputeService                                         |

---

## Target Data Flow Diagram

```
 Optimal API     Odds API      SGO API
     |               |            |
     +-------+-------+-----+------+
             |              |
             v              v
   ProviderOfferPayload (normalized)
             |
             v
   upsert_provider_offers_bootstrap RPC
             |
   +---------+---------+
   |                   |
   v                   v
 events           provider_offers
   |                   |
   v                   v
 participants     closing_snapshots
                       |
                       v
               feature_snapshots
                       |
                       v
               unified_picks (lifecycle-protected)
                       |
                       v
               prop_settlements + clv_results
```

---

## Key Differences from Current

| Aspect                | Current                        | Target                                                |
| --------------------- | ------------------------------ | ----------------------------------------------------- |
| Ingestion table       | raw_props (flat, denormalized) | provider_offers (normalized, FK-resolved)             |
| Event resolution      | Inline in raw_props fields     | Canonical `events` table with external_id             |
| Market resolution     | stat_type string               | `markets` table with canonical_key                    |
| Player resolution     | player_name string             | `participants` table with external_id                 |
| Provider identity     | source/provider text field     | provider column on provider_offers                    |
| Settlement matching   | external_game_id string match  | event.external_id FK chain                            |
| CLV tracking          | Not systematically tracked     | closing_snapshots -> clv_results pipeline             |
| Opening/closing lines | Not tracked                    | is_opening/is_closing flags with immutability trigger |
