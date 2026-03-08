# Runtime Dataflow — Current System

> Updated: 2026-03-08 | Sprint: SPRINT-044H (originally
> SPRINT-SYSTEM-DOCUMENTATION-FOUNDATION)

---

## Overview

The Unit Talk platform processes betting intelligence through a
**Temporal-orchestrated pipeline** spanning 6 stages. The master scheduler runs
on a 2-minute cycle (1 min live, 5 min idle).

```
CANONICAL V3: Provider APIs → IngestionAgent → provider_offers → GradingAgent* → unified_picks → Discord → Settlement
LEGACY:       Provider APIs → FeedAgent     → raw_props       → GradingAgent  → unified_picks → Discord → Settlement

* V3 path requires GRADING_DATA_SOURCE=provider_offers (default: raw_props)
```

---

## Pipeline Stages

### Stage 1: Data Ingestion

#### Canonical V3 Path (provider_offers) — LIVE since SPRINT-044G

**Agent**: IngestionAgent via `ingestSGOProviderOffers()` /
`ingestProviderOffers()` **RPC**: `upsert_provider_offers_bootstrap`
(auto-creates `canonical_events`, resolves FKs)

| Attribute            | Value                                                                     |
| -------------------- | ------------------------------------------------------------------------- |
| **Tables written**   | `provider_offers`, `canonical_events` (auto), `provider_event_map` (auto) |
| **Writer of record** | IngestionAgent (via RPC)                                                  |
| **Providers proven** | SGO (2,108 rows, 044G), OddsAPI (1.38M+ existing rows)                    |
| **FK resolution**    | Participant: 94/94 proven; Event: 10 auto-created; Market: auto-resolved  |

#### Legacy Path (raw_props) — COMPATIBILITY, still scheduler default

**Orchestrator**: `syndicateSchedulerWorkflow` (syndicate-scheduler.ts)
**Worker**: FeedAgent via `ingestUnifiedData()` activity

```
syndicateSchedulerWorkflow (every 2 min)
  └─ leagueIngestionWorkflow() x 6 leagues (parallel)
       └─ feedActivities.ingestUnifiedData({ league, batchSize, timeout })
            └─ fetchUnifiedData({ sport, marketType: 'player-props' })
                 ├─ Try primary source (optimal-api or odds-api)
                 ├─ Try secondary fallback
                 └─ Try SGO as final fallback (if empty)
```

| Attribute            | Value                                                             |
| -------------------- | ----------------------------------------------------------------- |
| **Tables written**   | `raw_props`, `games` (COMPATIBILITY — deprecated per TD-1)        |
| **Writer of record** | FeedAgent (direct insert)                                         |
| **Trigger**          | Temporal schedule (syndicateSchedulerWorkflow)                    |
| **Leagues**          | MLB, NBA, NFL, NHL, NCAAB, NCAAF                                  |
| **Providers**        | Optimal API (primary), Odds API (secondary), SGO (final fallback) |

### Stage 2: Grading and Scoring

**Orchestrator**: `uspProcessingWorkflow` (called by syndicate-scheduler)
**Worker**: GradingAgent via `gradeNewProps()` activity

```
uspProcessingWorkflow()
  └─ gradingActivities.gradeNewProps({ league, isLiveMode, cycleCount })
       ├─ Fetch raw_props WHERE processed_at IS NULL
       ├─ For each prop: gradeProp() -> { score, tier, edge, ev }
       └─ Write tier/score back to raw_props
```

| Attribute            | Value                                           |
| -------------------- | ----------------------------------------------- |
| **Tables read**      | `raw_props`                                     |
| **Tables written**   | `raw_props` (tier, edge_score, edge_breakdown)  |
| **Writer of record** | GradingAgent                                    |
| **Tier scale**       | S (>=70), A (>=50), B (>=40), C (>=30), D (<30) |

### Stage 3: Promotion Evaluation

**Orchestrator**: `uspProcessingWorkflow` (continued) **Worker**: GradingAgent
via `scoreTopTierPicks()` activity

```
uspProcessingWorkflow() (continued)
  └─ gradingActivities.scoreTopTierPicks({ gradedProps, league })
       ├─ Filter S/A/B tier props
       ├─ evaluatePromotion() -> { promote, band, reason }
       │   ├─ Kill switch check
       │   ├─ Canary gate
       │   ├─ Band classification (HARD/SOFT/NONE)
       │   ├─ Probability primitives validation
       │   └─ Feature snapshot integrity
       └─ If promote=true: promoteToUnifiedPicks() -> lifecycleInsert()
```

| Attribute            | Value                                                         |
| -------------------- | ------------------------------------------------------------- |
| **Tables read**      | `raw_props` (graded)                                          |
| **Tables written**   | `unified_picks` (via lifecycleInsert, writerRole: 'promoter') |
| **Writer of record** | GradingAgent (promoter role)                                  |
| **Bands**            | HARD (auto-post), SOFT (conditional), NONE (no post)          |

### Stage 4: Discord Posting

**Orchestrator**: `notificationWorkflow` (called by syndicate-scheduler)
**Worker**: DiscordPromotionAgent

```
notificationWorkflow()
  └─ discordActivities.postNewPicks()
       ├─ Query unified_picks WHERE posted_to_discord=false AND promotion_band='HARD'
       ├─ atomicClaimForPost(pickId) -> idempotent claim
       ├─ Format Discord embed
       ├─ Post to Discord webhook
       └─ lifecycleUpdate() -> { posted_to_discord: true, discord_message_id }
```

| Attribute            | Value                                                                       |
| -------------------- | --------------------------------------------------------------------------- |
| **Tables read**      | `unified_picks` (promoted, unposted)                                        |
| **Tables written**   | `unified_picks` (via lifecycleUpdate, writerRole: 'poster'), `pick_publish` |
| **Writer of record** | DiscordPromotionAgent (poster role)                                         |
| **Idempotency**      | atomicClaimForPost prevents double-posting                                  |

### Stage 5: Settlement

**Orchestrator**: `settlementWorkflow` (called by syndicate-scheduler)
**Worker**: SettlementAgent

```
settlementWorkflow()
  └─ settlementActivities.settleCompletedGames()
       ├─ Fetch game_results WHERE status='completed'
       ├─ For each game: fetch props tied to game
       ├─ calculatePropSettlement() -> WIN/LOSS/PUSH/VOID
       │   ├─ Try SGO API (finalized results)
       │   ├─ Try Odds API /scores endpoint
       │   └─ Try player_game_stats + stat-resolver
       └─ lifecycleSettle() -> prop_settlements + unified_picks update
```

| Attribute            | Value                                                                            |
| -------------------- | -------------------------------------------------------------------------------- |
| **Tables read**      | `game_results`, `raw_props`, `unified_picks`, `player_game_stats`                |
| **Tables written**   | `prop_settlements`, `unified_picks` (via lifecycleSettle, writerRole: 'settler') |
| **Writer of record** | SettlementAgent (settler role)                                                   |
| **Data sources**     | SGO API, Odds API /scores, player_game_stats                                     |

### Stage 6: Analytics and Recap

**Orchestrator**: Support workflows (recap, analytics schedules) **Workers**:
RecapAgent, AnalyticsAgent

| Attribute            | Value                               |
| -------------------- | ----------------------------------- |
| **Tables read**      | `unified_picks`, `prop_settlements` |
| **Tables written**   | `analytics_summary`, recap records  |
| **Writer of record** | RecapAgent, AnalyticsAgent          |

---

## Support Workflows

| Workflow                     | Schedule    | Purpose                           |
| ---------------------------- | ----------- | --------------------------------- |
| `quotaMonitoringWorkflow`    | Every 5 min | Monitor API credit usage          |
| `auditWorkflow`              | Hourly      | Integrity checks on unified_picks |
| `operatorMonitoringWorkflow` | Hourly      | Agent health monitoring           |

---

## Data Flow Diagram

```
 Optimal API     Odds API      SGO API
     |               |            |
     +-------+-------+-----+------+
             |              |
             v              v
      dataSourceRouter (fetchUnifiedData)
             |
             v
      +-------------+
      |  raw_props   |  <-- FeedAgent (direct insert)
      +------+------+
             |
             v
      +-------------+
      | GradingAgent |  --> tier, score, edge
      +------+------+
             |
             v
      evaluatePromotion --> HARD / SOFT / NONE
             |
             v (if HARD)
      +---------------+
      | unified_picks  |  <-- lifecycleInsert (promoter)
      +-------+-------+
              |
              v
      +-----------------+
      | DiscordPromotion |  --> Discord webhook
      | Agent            |  <-- lifecycleUpdate (poster)
      +--------+--------+
               |
               v
      +------------------+
      | SettlementAgent  |  --> WIN/LOSS/PUSH
      |                  |  <-- lifecycleSettle (settler)
      +--------+---------+
               |
               v
      +------------------+
      | prop_settlements |
      +------------------+
```

---

## Writer Authority Summary

| Stage              | Writer                     | Role     | Adapter                                           |
| ------------------ | -------------------------- | -------- | ------------------------------------------------- |
| Ingestion (V3)     | IngestionAgent             | --       | `upsert_provider_offers_bootstrap` RPC            |
| Ingestion (legacy) | FeedAgent                  | --       | Direct insert to raw_props (compatibility)        |
| Grading            | GradingAgent               | --       | Reads raw_props (default) or provider_offers (V3) |
| Promotion          | GradingAgent               | promoter | lifecycleInsert to unified_picks                  |
| Posting            | DiscordPromotionAgent      | poster   | lifecycleUpdate / atomicClaimForPost              |
| Settlement         | SettlementAgent            | settler  | lifecycleSettle                                   |
| Analytics          | RecapAgent, AnalyticsAgent | --       | Direct to analytics tables                        |
