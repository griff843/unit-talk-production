# Table Contracts — Current System

> Generated: 2026-03-07 | Sprint: SPRINT-SYSTEM-DOCUMENTATION-FOUNDATION

---

## Table Tier Classification

| Tier              | Enforcement                     | Tables                                           |
| ----------------- | ------------------------------- | ------------------------------------------------ |
| **CANONICAL**     | Lifecycle adapters required     | unified_picks                                    |
| **CANONICAL V3**  | RPC/application enforcement     | provider_offers, events, markets, participants   |
| **ACTIVE**        | Application-level single-writer | prop_settlements, closing_snapshots, clv_results |
| **COMPATIBILITY** | Direct writes (legacy)          | raw_props                                        |

Source: `docs/governance/TABLE_CLASSIFICATION_SPEC.md`

---

## 1. raw_props (COMPATIBILITY)

**Purpose**: Flat denormalized ingestion landing table for all provider data.
Legacy table scheduled for retirement in favor of provider_offers.

| Column           | Type        | Notes                                                       |
| ---------------- | ----------- | ----------------------------------------------------------- |
| id               | UUID PK     | Auto-generated                                              |
| external_id      | TEXT UNIQUE | Composite key for SGO: `sgo:{eventID}:{marketKey}:{player}` |
| external_game_id | TEXT        | Provider game/event ID                                      |
| player_name      | TEXT        |                                                             |
| stat_type        | TEXT        | Market stat (points, rebounds, etc.)                        |
| line             | NUMERIC     | Betting line                                                |
| over_odds        | INTEGER     | American odds                                               |
| under_odds       | INTEGER     | American odds                                               |
| sport            | TEXT        | League enum                                                 |
| source           | TEXT        | Provider name (sgo, odds-api, optimal-api)                  |
| provider         | TEXT        | Same as source                                              |
| tier             | TEXT        | S/A/B/C/D (set by GradingAgent)                             |
| edge_score       | NUMERIC     | Computed edge (set by ScoringAgent)                         |
| processed_at     | TIMESTAMPTZ | When graded                                                 |
| meta             | JSONB       | Provider-specific metadata, batch_id, raw_data              |
| created_at       | TIMESTAMPTZ |                                                             |

**Writer**: FeedAgent (direct insert), GradingAgent (tier/score update),
ScoringAgent (edge update) **Readers**: GradingAgent, ScoringAgent,
SettlementAgent **Primary key**: `id` (UUID) **External identifiers**:
`external_id` (unique), `external_game_id` **Lifecycle stage**: Pre-submission
(raw data before pick lifecycle) **Replacement target**: `provider_offers` +
`markets` (V3)

---

## 2. unified_picks (CANONICAL)

**Purpose**: Source of truth for all picks. Full lifecycle management from
submission through settlement.

| Column             | Type        | Notes                                     |
| ------------------ | ----------- | ----------------------------------------- |
| id                 | UUID PK     |                                           |
| bet_slip_id        | UUID        | Idempotency key from Smart Form           |
| user_id            | UUID        | Submitting capper                         |
| selection          | TEXT        | over/under/home/away                      |
| line               | NUMERIC     |                                           |
| odds               | NUMERIC     |                                           |
| sport              | TEXT        |                                           |
| promotion_status   | TEXT        | not_promoted / queued / promoted / failed |
| promotion_band     | TEXT        | HARD / SOFT / NO_POST                     |
| posted_to_discord  | BOOLEAN     |                                           |
| discord_message_id | TEXT        |                                           |
| settlement_status  | TEXT        | pending / settled / void / disputed       |
| settlement_result  | TEXT        | win / loss / push                         |
| settled_at         | TIMESTAMPTZ |                                           |
| created_at         | TIMESTAMPTZ | Immutable after set                       |

**Writer**: API service via lifecycle adapters only

| Role                | Service                   | Authority               |
| ------------------- | ------------------------- | ----------------------- |
| `submitter`         | Smart Form / BridgeWorker | Initial creation        |
| `promoter`          | GradingAgent              | Scoring, promotion band |
| `poster`            | DiscordPromotionAgent     | Discord delivery        |
| `settler`           | SettlementAgent           | Settlement outcome      |
| `operator_override` | Command Center            | Emergency corrections   |

**Readers**: All agents, Command Center, Dashboard **Primary key**: `id` (UUID)
**External identifiers**: `bet_slip_id` (submission reference) **Lifecycle
stage**: Full lifecycle (SUBMITTED -> QUEUED -> POSTED -> SETTLED)
**Enforcement**: `npm run lifecycle:single-writer -- --strict`

**Immutable fields**: id, bet_slip_id, user_id, selection, line, odds, stake,
sport, created_at, placed_at, discord_message_id, settlement_frozen

---

## 3. pick_publish (ACTIVE)

**Purpose**: Outbox table for Discord posting. Ensures idempotent delivery.

| Column             | Type        | Notes                     |
| ------------------ | ----------- | ------------------------- |
| id                 | UUID PK     |                           |
| pick_id            | UUID FK     | References unified_picks  |
| status             | TEXT        | pending / posted / failed |
| discord_message_id | TEXT        | Set on successful post    |
| error_code         | TEXT        | Set on failure            |
| created_at         | TIMESTAMPTZ |                           |
| posted_at          | TIMESTAMPTZ |                           |

**Writer**: DiscordPromotionAgent **Readers**: DiscordPromotionAgent (polling
for pending) **Primary key**: `id` (UUID) **Lifecycle stage**: QUEUED -> POSTED
transition support

---

## 4. closing_snapshots (ACTIVE)

**Purpose**: Consensus devigged probabilities captured at market close (30 min
before game start).

| Column         | Type        | Notes                             |
| -------------- | ----------- | --------------------------------- |
| id             | UUID PK     |                                   |
| event_id       | UUID        | References events                 |
| market_type_id | INT         | Market type enum                  |
| market_key     | TEXT UNIQUE | Idempotency key                   |
| p_close_over   | NUMERIC     | Consensus over probability (0-1)  |
| p_close_under  | NUMERIC     | Consensus under probability (0-1) |
| devig_method   | TEXT        | Default: 'proportional'           |
| book_count     | INT         | Minimum 3 required                |
| books_json     | JSONB       | Snapshot of all book offers       |
| captured_at    | TIMESTAMPTZ |                                   |

**Writer**: ClosingSnapshotService (single-writer) **Readers**:
CLVComputeService, ScoringAgent **Primary key**: `id` (UUID) **External
identifiers**: `market_key` (unique) **Lifecycle stage**: Market microstructure
(not pick lifecycle) **Immutability**: Once captured, cannot be modified

---

## 5. prop_settlements (ACTIVE)

**Purpose**: Settlement fact table recording binding outcomes for each pick.

| Column            | Type        | Notes                             |
| ----------------- | ----------- | --------------------------------- |
| final_pick_id     | UUID PK     | References unified_picks          |
| player_name       | TEXT        | Denormalized for query efficiency |
| stat_type         | TEXT        | Denormalized                      |
| line              | NUMERIC     |                                   |
| bet_side          | TEXT        | over/under/home/away              |
| actual_value      | NUMERIC     | Resolved stat value               |
| settlement_result | TEXT        | win/loss/push/void                |
| settlement_method | TEXT        | manual/automatic                  |
| data_source       | TEXT        | oddsapi/sgo/espn_stats/operator   |
| settled_at        | TIMESTAMPTZ |                                   |

**Writer**: SettlementAgent (via lifecycleSettle), Operator (via
manual_settle_pick RPC) **Readers**: RecapAgent, AnalyticsAgent, Command Center
**Primary key**: `final_pick_id` (UUID) **Lifecycle stage**: SETTLED (terminal)
**Immutability**: Guarded by settlement_frozen flag

---

## 6. provider_offers (CANONICAL V3)

**Purpose**: Multi-book offer snapshots for CLV tracking. Normalized V3
ingestion target.

| Column                 | Type        | Notes                                  |
| ---------------------- | ----------- | -------------------------------------- |
| id                     | UUID PK     |                                        |
| event_id               | UUID FK     | References events                      |
| market_id              | UUID FK     | References markets                     |
| participant_id         | UUID FK     | For player props                       |
| provider               | TEXT        | fanduel/draftkings/sgo/pinnacle        |
| line                   | NUMERIC     |                                        |
| over_odds / under_odds | INTEGER     | American odds                          |
| home_odds / away_odds  | INTEGER     | For moneylines                         |
| is_opening             | BOOLEAN     | Opening line flag                      |
| is_closing             | BOOLEAN     | Closing line flag (IMMUTABLE once set) |
| snapshot_at            | TIMESTAMPTZ | When captured                          |
| meta                   | JSONB       | Provider-specific                      |

**Writer**: IngestionAgent (via `upsert_provider_offers_bootstrap` RPC)
**Readers**: ClosingSnapshotService, CLVComputeService, ScoringAgent **Primary
key**: `id` (UUID) **External identifiers**: Composite unique (event_id,
market_id, participant_id, segment_id, provider, snapshot_at) **Lifecycle
stage**: Market microstructure **Immutability**: Closing lines protected by
database trigger

---

## Cross-Table Relationships

```
raw_props (COMPATIBILITY / legacy ingestion)

provider_offers ----> events ----> participants
       |                              ^
       +----> markets ----------------+

unified_picks ----> prop_settlements
       |
       +----> clv_results ----> closing_snapshots
```
