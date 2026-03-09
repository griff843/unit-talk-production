# Entity-Relationship & Schema Reference

Status: CANONICAL Authority: Tier 1 Owner: Platform Architecture Last Verified:
2026-03-07 Sprint: SPRINT-DOCS-CANONICALIZATION-040

---

## Overview

Unit Talk uses Supabase (PostgreSQL) with 48 migration files defining the
production schema. Tables are classified by tier (CANONICAL, ACTIVE,
COMPATIBILITY, SHADOW, DEPRECATED) with write enforcement at each level.

For full table classification and writer authority, see
[Table Classification Spec](../governance/TABLE_CLASSIFICATION_SPEC.md).

---

## Core Entity Relationships

```
users
  |
  |-- 1:N --> unified_picks (user_id)
  |             |
  |             |-- 1:1 --> pick_publish (pick_id) [Discord outbox]
  |             |-- 1:1 --> clv_results (pick_id) [CLV measurement]
  |             |-- 1:1 --> closing_snapshots (pick_id) [Market close]
  |             |-- N:1 --> parlay_tickets (parlay_id)
  |             |
  |             |-- settlement -->
  |                   |-- prop_settlements (pick_id)
  |                   |-- prop_outcomes (pick_id)
  |
  |-- 1:N --> tickets (user_id) [V3 canonical]
                |
                |-- 1:N --> ticket_legs (ticket_id)
                              |
                              |-- 1:1 --> scored_legs (leg_id)
                              |-- N:1 --> events (event_id)
                              |-- N:1 --> markets (market_id)

events
  |-- 1:N --> event_participants (event_id)
  |-- 1:N --> event_segments (event_id)
  |-- 1:N --> provider_offers (event_id)
  |-- N:1 --> games (legacy link)

participants
  |-- 1:N --> participant_memberships (participant_id)
  |-- players (deprecated alias)
  |-- teams (deprecated alias)

raw_props --> provider_offers (migration target)
games --> events (migration target)
```

---

## Table Groups

### Canonical Tables (Lifecycle-Protected)

| Table                     | PK          | Key Columns                                                                                                          | Writer                     |
| ------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `unified_picks`           | `id` (uuid) | user_id, selection, line, odds, stake, sport, bet_type, tier, p_final, edge_final, promotion_band, settlement_status | API via lifecycle adapters |
| `participants`            | `id` (uuid) | name, sport, type (player/team/fighter), external_id                                                                 | SGO Sync                   |
| `participant_memberships` | `id` (uuid) | participant_id, team_participant_id, start_date, end_date                                                            | SGO Sync                   |

### Active Tables

| Table               | PK          | Key Columns                            | Writer                |
| ------------------- | ----------- | -------------------------------------- | --------------------- |
| `bridge_outbox`     | `id` (uuid) | payload, status, created_at            | Smart Form            |
| `agent_health`      | `id` (uuid) | agent_name, status, last_heartbeat     | API Agents            |
| `prop_settlements`  | `id` (uuid) | pick_id, result, source, settled_at    | SettlementAgent       |
| `pick_publish`      | `id` (uuid) | pick_id, discord_message_id, posted_at | DiscordPromotionAgent |
| `closing_snapshots` | `id` (uuid) | pick_id, closing_line, snapshot_at     | ClosingSnapshotAgent  |
| `clv_results`       | `id` (uuid) | pick_id, clv_bps, measured_at          | CLV computation       |
| `player_game_stats` | `id` (uuid) | player_id, game_id, stat_type, value   | DataAgent             |
| `prop_outcomes`     | `id` (uuid) | pick_id, outcome (WIN/LOSS/PUSH)       | SettlementAgent       |
| `market_policy`     | `id` (uuid) | sport, market_type, enabled, min_edge  | Operator              |

### V3 Canonical Schema (Target)

| Table                | PK          | Key Columns                                     | Migration        |
| -------------------- | ----------- | ----------------------------------------------- | ---------------- |
| `events`             | `id` (uuid) | sport, start_time, status, home_team, away_team | `20260220100000` |
| `event_participants` | `id` (uuid) | event_id, participant_id, role                  | `20260220100000` |
| `event_segments`     | `id` (uuid) | event_id, segment_type, number                  | `20260220100000` |
| `markets`            | `id` (uuid) | event_id, market_type, period                   | `20260220100000` |
| `provider_offers`    | `id` (uuid) | market_id, provider, odds, line, timestamp      | `20260220100000` |
| `tickets`            | `id` (uuid) | user_id, stake, ticket_type, status             | `20260220100000` |
| `ticket_legs`        | `id` (uuid) | ticket_id, event_id, market_id, selection       | `20260220100000` |
| `feature_snapshots`  | `id` (uuid) | leg_id, features (jsonb)                        | `20260220100000` |
| `scored_legs`        | `id` (uuid) | leg_id, score, confidence, edge                 | `20260220100000` |

### Shadow Tables (Isolated)

| Table                 | PK          | Purpose                    | Migration        |
| --------------------- | ----------- | -------------------------- | ---------------- |
| `shadow_scoring_runs` | `id` (uuid) | Backfill run metadata      | `20260306000000` |
| `shadow_scores`       | `id` (uuid) | Historical scoring outputs | `20260306000000` |
| `shadow_clv_results`  | `id` (uuid) | Historical CLV measurement | `20260306000000` |

### Compatibility Tables (Scheduled for Retirement)

| Table          | Replacement              | Decision           |
| -------------- | ------------------------ | ------------------ |
| `raw_props`    | `provider_offers`        | TD-1 (SPRINT-035B) |
| `games`        | `events`                 | TD-2 (SPRINT-035B) |
| `game_results` | Settlement via lifecycle | TD-3 (SPRINT-035B) |

### Deprecated Tables

| Table         | Replacement     | Dropped                    |
| ------------- | --------------- | -------------------------- |
| `daily_picks` | `unified_picks` | Migration `20260223100000` |
| `players`     | `participants`  | Views retained for compat  |
| `teams`       | `participants`  | Views retained for compat  |

---

## unified_picks Field Groups

### Submission Fields (writerRole: submitter)

| Column      | Type        | Immutable |
| ----------- | ----------- | --------- |
| id          | uuid        | Yes       |
| bet_slip_id | text        | Yes       |
| leg_index   | integer     | Yes       |
| user_id     | uuid        | Yes       |
| selection   | text        | Yes       |
| line        | numeric     | Yes       |
| odds        | integer     | Yes       |
| stake       | numeric     | Yes       |
| sport       | text        | Yes       |
| bet_type    | text        | Yes       |
| stat_type   | text        | Yes       |
| player_name | text        | Yes       |
| team        | text        | Yes       |
| direction   | text        | Yes       |
| side        | text        | Yes       |
| source      | text        | Yes       |
| ticket_type | text        | Yes       |
| parlay_id   | uuid        | Yes       |
| pick_type   | text        | Yes       |
| over_odds   | integer     | Yes       |
| under_odds  | integer     | Yes       |
| game_date   | date        | Yes       |
| created_at  | timestamptz | Yes       |
| placed_at   | timestamptz | Yes       |

### Scoring & Promotion Fields (writerRole: promoter)

| Column             | Type    | Immutable |
| ------------------ | ------- | --------- |
| tier               | text    | No        |
| professional_score | numeric | No        |
| p_final            | numeric | No        |
| edge_final         | numeric | No        |
| uncertainty_final  | numeric | No        |
| clv_forecast       | numeric | No        |
| devigged_edge      | numeric | No        |
| promotion_band     | text    | No        |
| lifecycle_stage    | text    | No        |

### Discord Fields (writerRole: poster)

| Column              | Type        | Immutable       |
| ------------------- | ----------- | --------------- |
| discord_message_id  | text        | Yes (after set) |
| discord_thread_id   | text        | Yes (after set) |
| promotion_posted_at | timestamptz | Yes (after set) |
| posted_to_discord   | boolean     | No              |

### Settlement Fields (writerRole: settler)

| Column             | Type        | Immutable       |
| ------------------ | ----------- | --------------- |
| settlement_status  | text        | No              |
| settlement_result  | text        | No              |
| settlement_source  | text        | No              |
| settled_at         | timestamptz | No              |
| settlement_hash    | text        | Yes (after set) |
| settlement_frozen  | boolean     | Yes (after set) |
| freeze_enforced_at | timestamptz | Yes (after set) |

---

## Migration History

48 migration files spanning 2025-01-25 through 2026-03-06.

**Recent additions** (2026-02 through 2026-03):

- `market_policy` — sport/market gating table
- `shadow_scoring_runs`, `shadow_scores`, `shadow_clv_results` — backfill
  scoring
- `player_game_stats`, `prop_outcomes` — outcome tracking
- `closing_snapshots`, `clv_results` — CLV measurement
- `api_credit_log` — API credit usage tracking
- `probability_foundation`, `probability_integration_rpc` — probability
  primitives
- `execution_events_telemetry` — execution event tracking

**Foundation** (2026-02-20):

- `canonical_schema_v3_foundation` — V3 core tables (events, markets, tickets,
  etc.)
- `canonical_v3_feed_offers` — provider offer storage
- `canonical_v3_scoring_storage` — scoring model storage
- `canonical_v3_smartform_submission` — atomic ticket submission

---

## Indexes & Performance

Key indexes on high-query tables:

- `unified_picks`: sport, user_id, created_at, settlement_status,
  posted_to_discord, tier
- `raw_props`: sport, game_date, player_name
- `events`: sport, start_time, status
- `provider_offers`: market_id, provider, timestamp
- `tickets`: user_id, status, created_at

Immutability enforced via database triggers on `closing_snapshots.closing_line`
and `unified_picks` settlement fields.

---

## Related Documents

- [Table Classification Spec](../governance/TABLE_CLASSIFICATION_SPEC.md)
- [Pick Lifecycle Contract](../contracts/PICK_LIFECYCLE_CONTRACT.md)
- [Database Schema V3](./database-schema-v3.md) (detailed reference)
- [System Overview](../system/SYSTEM_OVERVIEW.md)
