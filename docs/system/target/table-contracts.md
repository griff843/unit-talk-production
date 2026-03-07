# Table Contracts — Target Architecture

> Generated: 2026-03-07 | Sprint: SPRINT-SYSTEM-DOCUMENTATION-FOUNDATION

---

## Overview

The target architecture uses the V3 normalized schema. All tables below exist in
migrations and have partial implementation. The target state is full production
usage with raw_props retired.

---

## Core Tables

### 1. events (CANONICAL V3)

**Purpose**: Provider-agnostic canonical event representation.

| Column              | Type        | Notes                                             |
| ------------------- | ----------- | ------------------------------------------------- |
| id                  | UUID PK     |                                                   |
| external_id         | TEXT UNIQUE | Provider event ID (Odds API game.id, SGO eventID) |
| sport               | TEXT        |                                                   |
| league              | TEXT        |                                                   |
| event_type          | TEXT        | game/match/fight/tournament_round                 |
| home_participant_id | UUID FK     | References participants                           |
| away_participant_id | UUID FK     | References participants                           |
| scheduled_at        | TIMESTAMPTZ |                                                   |
| started_at          | TIMESTAMPTZ |                                                   |
| completed_at        | TIMESTAMPTZ |                                                   |
| status              | TEXT        | scheduled/live/completed/postponed/cancelled      |
| home_score          | INTEGER     |                                                   |
| away_score          | INTEGER     |                                                   |

**Writer**: IngestionAgent (auto-created by upsert_provider_offers_bootstrap
RPC) **Lifecycle role**: Event status drives settlement window

### 2. participants (CANONICAL V3)

**Purpose**: Unified entity model for teams, players, fighters, etc.

| Column      | Type    | Notes                                 |
| ----------- | ------- | ------------------------------------- |
| id          | UUID PK |                                       |
| external_id | TEXT    | Provider ID (ESPN, SGO)               |
| type        | TEXT    | team/player/fighter/horse/golfer      |
| name        | TEXT    |                                       |
| sport       | TEXT    |                                       |
| active      | BOOLEAN |                                       |
| meta        | JSONB   | headshot_url, jersey_number, position |

**Unique constraint**: (external_id, sport) **Writer**: SGO Sync, DataAgent
(enrichment)

### 3. markets (CANONICAL V3)

**Purpose**: Provider-agnostic market definitions.

| Column            | Type        | Notes                                    |
| ----------------- | ----------- | ---------------------------------------- |
| id                | UUID PK     |                                          |
| canonical_key     | TEXT UNIQUE | player_points_ou, team_moneyline, etc.   |
| display_name      | TEXT        |                                          |
| category          | TEXT        | player_prop/game_line/team_total/futures |
| stat_type         | TEXT        | points/rebounds/passing_yards            |
| bet_structure     | TEXT        | over_under/moneyline/spread/yes_no       |
| settlement_source | TEXT        | espn_stats/official_stats/provider       |

**Writer**: DataAgent, Operator (catalog management)

### 4. provider_offers (CANONICAL V3)

**Purpose**: Multi-book offer snapshots with CLV tracking capability.

| Column                         | Type        | Notes                           |
| ------------------------------ | ----------- | ------------------------------- |
| id                             | UUID PK     |                                 |
| event_id                       | UUID FK     | References events               |
| market_id                      | UUID FK     | References markets              |
| participant_id                 | UUID FK     | For player props                |
| segment_id                     | UUID FK     | For segment markets             |
| provider                       | TEXT        | fanduel/draftkings/sgo/pinnacle |
| line                           | NUMERIC     |                                 |
| over_odds / under_odds         | INTEGER     |                                 |
| home_odds / away_odds          | INTEGER     | For moneylines                  |
| devigged_over / devigged_under | NUMERIC     | Fair probability                |
| is_opening                     | BOOLEAN     | Opening line flag               |
| is_closing                     | BOOLEAN     | Closing line flag (IMMUTABLE)   |
| snapshot_at                    | TIMESTAMPTZ |                                 |

**Unique constraint**: (event_id, market_id, participant_id, segment_id,
provider, snapshot_at) **Writer**: IngestionAgent (via
upsert_provider_offers_bootstrap RPC) **Immutability**: Closing lines protected
by database trigger

### 5. unified_picks (CANONICAL)

No structural changes from current. Lifecycle adapters remain authoritative.

### 6. prop_settlements (ACTIVE)

No structural changes. Settlement gains `settlement_source` tracking for source
attribution.

### 7. closing_snapshots (ACTIVE)

No structural changes. Feeds CLV computation.

### 8. clv_results (ACTIVE)

No structural changes. Computed post-settlement from closing_snapshots.

---

## Retired Tables

| Table         | Replacement                              | Migration          |
| ------------- | ---------------------------------------- | ------------------ |
| `raw_props`   | `provider_offers` + `markets` + `events` | TD-1 (SPRINT-035B) |
| `players`     | `participants` (type='player')           | Completed          |
| `teams`       | `participants` (type='team')             | Completed          |
| `daily_picks` | `unified_picks`                          | Completed          |

---

## Writer Authority (Target)

| Table             | Writer                 | Method                                                 |
| ----------------- | ---------------------- | ------------------------------------------------------ |
| events            | IngestionAgent         | upsert_provider_offers_bootstrap RPC (auto-create)     |
| participants      | SGO Sync               | Application-level                                      |
| markets           | DataAgent / Operator   | Application-level                                      |
| provider_offers   | IngestionAgent         | upsert_provider_offers_bootstrap RPC                   |
| unified_picks     | Multi-role             | Lifecycle adapters (submitter/promoter/poster/settler) |
| prop_settlements  | SettlementAgent        | lifecycleSettle adapter                                |
| closing_snapshots | ClosingSnapshotService | Direct insert (single-writer)                          |
| clv_results       | CLVComputeService      | Direct insert (single-writer)                          |

---

## FK Resolution Chain

```
Provider API response
  |
  v
ProviderOfferPayload { provider_event_id, provider_market_key, ... }
  |
  v
upsert_provider_offers_bootstrap RPC
  |
  +-- Resolve event: external_id -> events.id (create if new)
  +-- Resolve market: provider_market_key -> markets.canonical_key -> markets.id
  +-- Resolve participant: player_name -> participants.external_id -> participants.id
  |
  v
provider_offers row with proper FK references
```
