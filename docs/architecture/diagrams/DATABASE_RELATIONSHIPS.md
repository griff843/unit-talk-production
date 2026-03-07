# Database Relationships

Status: CANONICAL Authority: Tier 1 Owner: Platform Architecture Last Verified:
2026-03-07 Sprint: SPRINT-ARCHITECTURE-LOCK-041C

---

## Entity-Relationship Diagram

```mermaid
erDiagram
    users ||--o{ unified_picks : "submits"
    users ||--o{ tickets : "creates"

    unified_picks ||--o| pick_publish : "posted via"
    unified_picks ||--o| clv_results : "measured by"
    unified_picks ||--o| closing_snapshots : "snapshot at close"
    unified_picks ||--o| prop_settlements : "settled by"
    unified_picks ||--o| prop_outcomes : "outcome"
    unified_picks }o--|| parlay_tickets : "grouped in"

    tickets ||--o{ ticket_legs : "contains"
    ticket_legs ||--o| scored_legs : "scored as"
    ticket_legs }o--|| events : "references"
    ticket_legs }o--|| markets : "references"

    events ||--o{ event_participants : "includes"
    events ||--o{ event_segments : "divided into"
    events ||--o{ provider_offers : "priced by"

    markets ||--o{ provider_offers : "offered on"

    participants ||--o{ participant_memberships : "belongs to"

    raw_props }o--|| games : "linked to"

    users {
        uuid id PK
        text email
        text role
    }

    unified_picks {
        uuid id PK
        uuid user_id FK
        text selection
        numeric line
        integer odds
        numeric stake
        text sport
        text tier
        numeric p_final
        numeric edge_final
        text promotion_band
        text settlement_status
        boolean posted_to_discord
    }

    tickets {
        uuid id PK
        uuid user_id FK
        numeric stake
        text ticket_type
        text status
    }

    ticket_legs {
        uuid id PK
        uuid ticket_id FK
        uuid event_id FK
        uuid market_id FK
        text selection
    }

    scored_legs {
        uuid id PK
        uuid leg_id FK
        numeric score
        numeric confidence
        numeric edge
    }

    events {
        uuid id PK
        text sport
        timestamptz start_time
        text status
        text home_team
        text away_team
    }

    event_participants {
        uuid id PK
        uuid event_id FK
        uuid participant_id FK
        text role
    }

    event_segments {
        uuid id PK
        uuid event_id FK
        text segment_type
        integer number
    }

    markets {
        uuid id PK
        uuid event_id FK
        text market_type
        text period
    }

    provider_offers {
        uuid id PK
        uuid market_id FK
        text provider
        integer odds
        numeric line
        timestamptz timestamp
    }

    participants {
        uuid id PK
        text name
        text sport
        text type
        text external_id
    }

    participant_memberships {
        uuid id PK
        uuid participant_id FK
        uuid team_participant_id FK
        date start_date
        date end_date
    }

    pick_publish {
        uuid id PK
        uuid pick_id FK
        text discord_message_id
        timestamptz posted_at
    }

    prop_settlements {
        uuid id PK
        uuid pick_id FK
        text result
        text source
        timestamptz settled_at
    }

    prop_outcomes {
        uuid id PK
        uuid pick_id FK
        text outcome
    }

    clv_results {
        uuid id PK
        uuid pick_id FK
        numeric clv_bps
        timestamptz measured_at
    }

    closing_snapshots {
        uuid id PK
        uuid pick_id FK
        numeric closing_line
        timestamptz snapshot_at
    }

    raw_props {
        uuid id PK
        text sport
        date game_date
        text player_name
    }

    games {
        uuid id PK
        text sport
        timestamptz start_time
        text status
    }

    parlay_tickets {
        uuid id PK
        uuid user_id FK
        text status
    }

    market_policy {
        uuid id PK
        text sport
        text market_type
        boolean enabled
        numeric min_edge
    }

    bridge_outbox {
        uuid id PK
        jsonb payload
        text status
        timestamptz created_at
    }
```

### Table Classification Summary

| Tier              | Tables                                                                                                                                                         | Write Enforcement       |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **Canonical**     | `unified_picks`, `participants`, `participant_memberships`                                                                                                     | Lifecycle adapters only |
| **Active**        | `bridge_outbox`, `agent_health`, `prop_settlements`, `pick_publish`, `closing_snapshots`, `clv_results`, `player_game_stats`, `prop_outcomes`, `market_policy` | Designated writer agent |
| **V3 Target**     | `events`, `event_participants`, `event_segments`, `markets`, `provider_offers`, `tickets`, `ticket_legs`, `feature_snapshots`, `scored_legs`                   | Migration in progress   |
| **Compatibility** | `raw_props`, `games`, `game_results`                                                                                                                           | Direct writes (legacy)  |
| **Deprecated**    | `daily_picks`, `players`, `teams`                                                                                                                              | No writes               |

---

## Related Documents

- [ERD Schema Reference](../ERD_SCHEMA.md)
- [Table Classification Spec](../../governance/TABLE_CLASSIFICATION_SPEC.md)
