# Pick Machine Flow

Status: CANONICAL Authority: Tier 1 Owner: Platform Architecture Last Verified:
2026-03-07 Sprint: SPRINT-ARCHITECTURE-LOCK-041C

---

## Canonical Pick Lifecycle

```mermaid
flowchart TD
    subgraph Ingestion["Stage 1: Ingestion"]
        OptimalAPI[Optimal API\nNFL NBA MLB NHL]
        OddsAPI[The Odds API\nNCAA WNBA Settlement]
        Router[DataSourceRouter\ncircuit breaker + failover]
        RawProps[(raw_props\ncompatibility)]
        Games[(games\ncompatibility)]
    end

    subgraph Scoring["Stage 2: Scoring & Promotion"]
        GradeNew[gradeNewProps\nper-league parallel]
        Intelligence[packages/intelligence\ndevig · probability · calibration]
        ScoreTop[scoreTopTierPicks\nedge + CLV forecast]
        PromotionGate[Promotion Gate\npromotionPolicy.ts]
        MarketPolicy[(market_policy)]
        UpdatePicks[updateUnifiedPicks\nlifecycleInsert · promoter role]
    end

    subgraph Canonical["Canonical Record"]
        UnifiedPicks[(unified_picks\nCANONICAL)]
    end

    subgraph Distribution["Stage 3: Distribution"]
        GetNew[getNewUnifiedPicks]
        AtomicClaim[atomicClaimForPost\nidempotent]
        PickPublish[(pick_publish\noutbox)]
        Discord[Discord Webhooks\n7 channels]
    end

    subgraph Settlement["Stage 4: Settlement"]
        SettlementData[Odds API /scores]
        LifecycleSettle[lifecycleSettle\nsettler role]
        PropSettlements[(prop_settlements)]
        PropOutcomes[(prop_outcomes\nWIN/LOSS/PUSH)]
    end

    subgraph Analytics["Stage 5: Analytics"]
        ClosingSnapshots[(closing_snapshots)]
        CLVResults[(clv_results)]
        RecapAgent[RecapAgent\ndaily · weekly · monthly]
    end

    OptimalAPI --> Router
    OddsAPI --> Router
    Router --> RawProps
    Router --> Games

    RawProps --> GradeNew
    GradeNew --> Intelligence
    Intelligence --> ScoreTop
    ScoreTop --> PromotionGate
    MarketPolicy --> PromotionGate
    PromotionGate --> UpdatePicks
    UpdatePicks --> UnifiedPicks

    UnifiedPicks --> GetNew
    GetNew --> AtomicClaim
    AtomicClaim --> PickPublish
    PickPublish --> Discord

    UnifiedPicks --> SettlementData
    SettlementData --> LifecycleSettle
    LifecycleSettle --> UnifiedPicks
    LifecycleSettle --> PropSettlements
    LifecycleSettle --> PropOutcomes

    UnifiedPicks --> ClosingSnapshots
    UnifiedPicks --> CLVResults
    PropOutcomes --> RecapAgent
```

### Alternate Entry: Smart Form

```mermaid
flowchart LR
    SmartForm[Smart Form UI]
    BridgeOutbox[(bridge_outbox)]
    BridgeWorker[BridgeWorker\npolls every 5s]
    LifecycleInsert[lifecycleInsert\nsubmitter role]
    UnifiedPicks[(unified_picks)]

    SmartForm --> BridgeOutbox
    BridgeOutbox --> BridgeWorker
    BridgeWorker --> LifecycleInsert
    LifecycleInsert --> UnifiedPicks
```

### Stage Summary

| Stage           | Agent                 | Activity                                                   | Output Table                        |
| --------------- | --------------------- | ---------------------------------------------------------- | ----------------------------------- |
| 1. Ingestion    | FeedAgent             | `ingestUnifiedData`                                        | `raw_props`, `games`                |
| 2. Scoring      | GradingAgent          | `gradeNewProps`, `scoreTopTierPicks`, `updateUnifiedPicks` | `unified_picks`                     |
| 3. Distribution | DiscordPromotionAgent | `atomicClaimForPost`                                       | `pick_publish` → Discord            |
| 4. Settlement   | SettlementAgent       | `lifecycleSettle`                                          | `prop_settlements`, `prop_outcomes` |
| 5. Analytics    | RecapAgent, CLV       | `triggerDailyRecap`                                        | `closing_snapshots`, `clv_results`  |

---

## Related Documents

- [Canonical Runtime Path](../../system/CANONICAL_RUNTIME_PATH.md)
- [Table Classification Spec](../../governance/TABLE_CLASSIFICATION_SPEC.md)
