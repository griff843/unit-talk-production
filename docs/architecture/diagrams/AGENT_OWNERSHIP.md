# Agent Ownership

Status: CANONICAL Authority: Tier 1 Owner: Platform Architecture Last Verified:
2026-03-07 Sprint: SPRINT-ARCHITECTURE-LOCK-041C

---

## Agent-to-Table Write Authority

```mermaid
flowchart LR
    subgraph Ingestion
        FeedAgent[FeedAgent\nposition 3]
    end

    subgraph Scoring
        GradingAgent[GradingAgent\nposition 5]
    end

    subgraph Distribution
        DiscordPromoAgent[DiscordPromotionAgent]
        NotificationAgent[NotificationAgent\nposition 2]
    end

    subgraph Operations
        SettlementAgent[SettlementAgent]
        RecapAgent[RecapAgent\nposition 9]
        OperatorAgent[OperatorAgent\nposition 7]
        DataAgent[DataAgent]
    end

    subgraph Monitoring
        AlertAgent[AlertAgent\nposition 6]
        AnalyticsAgent[AnalyticsAgent\nposition 2]
        AuditAgent[AuditAgent\nposition 4]
    end

    subgraph Tables
        RawProps[(raw_props)]
        Games[(games)]
        UnifiedPicks[(unified_picks\nCANONICAL)]
        PickPublish[(pick_publish)]
        PropSettlements[(prop_settlements)]
        PropOutcomes[(prop_outcomes)]
        PlayerGameStats[(player_game_stats)]
        AgentHealth[(agent_health)]
        ClosingSnapshots[(closing_snapshots)]
        CLVResults[(clv_results)]
    end

    subgraph External
        Discord[Discord API]
    end

    FeedAgent -- "direct insert" --> RawProps
    FeedAgent -- "direct insert" --> Games

    GradingAgent -- "lifecycleInsert\npromoter" --> UnifiedPicks

    DiscordPromoAgent -- "atomicClaimForPost\nposter" --> UnifiedPicks
    DiscordPromoAgent --> PickPublish
    DiscordPromoAgent --> Discord
    NotificationAgent --> Discord

    SettlementAgent -- "lifecycleSettle\nsettler" --> UnifiedPicks
    SettlementAgent --> PropSettlements
    SettlementAgent --> PropOutcomes

    RecapAgent -- "lifecycleUpdate\nposter" --> UnifiedPicks

    DataAgent --> PlayerGameStats
    OperatorAgent --> AgentHealth

    AlertAgent -. "read-only" .-> UnifiedPicks
    AnalyticsAgent -. "read-only" .-> UnifiedPicks
    AuditAgent -. "read-only" .-> UnifiedPicks
```

### Write Authority Matrix

| Agent                 | Table                                                | Lifecycle Adapter                    | Writer Role |
| --------------------- | ---------------------------------------------------- | ------------------------------------ | ----------- |
| FeedAgent             | `raw_props`, `games`                                 | Direct insert (compatibility tables) | —           |
| GradingAgent          | `unified_picks`                                      | `lifecycleInsert`                    | `promoter`  |
| DiscordPromotionAgent | `unified_picks`, `pick_publish`                      | `atomicClaimForPost`                 | `poster`    |
| SettlementAgent       | `unified_picks`, `prop_settlements`, `prop_outcomes` | `lifecycleSettle`                    | `settler`   |
| RecapAgent            | `unified_picks`                                      | `lifecycleUpdate`                    | `poster`    |
| DataAgent             | `player_game_stats`                                  | Direct insert (active table)         | —           |
| OperatorAgent         | `agent_health`                                       | Direct insert (active table)         | —           |
| Smart Form            | `bridge_outbox`                                      | Direct insert (active table)         | —           |

### Read-Only Agents

AlertAgent, AnalyticsAgent, AuditAgent, PlayerEnrichmentAgent, ScoringAgent —
these agents read from tables but do not write to canonical or active tables.

---

## Related Documents

- [Agent Ownership Matrix](../../governance/AGENT_OWNERSHIP_MATRIX.md)
- [Table Classification Spec](../../governance/TABLE_CLASSIFICATION_SPEC.md)
