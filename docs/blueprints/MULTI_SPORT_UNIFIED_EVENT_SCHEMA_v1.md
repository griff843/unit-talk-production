# MULTI-SPORT UNIFIED EVENT SCHEMA v1.1

Blueprint Type: Canonical Data Contract (Design-Only)  
Applies To: SaaS Core (Truth) + All Surfaces (Discord/Smart Form/Command
Center/Black Label)  
Status: DRAFT (Phase 2A)  
Owner: Griff (Operator)  
Design Authority: System Blueprint +
PHASE_2A_INTELLIGENCE_SUPERIORITY_AUDIT_v1  
Binding Over: Ingestion, scoring, selection, settlement, recap, analytics,
outbox delivery

---

## 1) Purpose

Unit Talk requires a single universal schema that can represent:

- Every sport (NBA/NFL/MLB/NHL/NCAAF/NCAAB/Soccer/etc.)
- Every bet type (ML/Spread/Total/Team Total/Player Props/Specialty Props/SGP
  legs)
- Every pricing source (multi-book odds, alternates, live, pregame)
- Every lifecycle stage (ingest → score → promote → publish → settle → recap)
- Every learning output (postmortems, attribution, execution timing, steam vs
  news)

Discord is a surface.  
The SaaS Core is the source of truth.  
This schema is the truth language.

---

## 2) Design Principles (Non-Negotiable)

### 2.1 Unified “Bet Event” primitive

All wagers are represented as a canonical `bet_event`, regardless of
sport/market.

### 2.2 Distribution-first readiness

The schema must support probability distributions and uncertainty, not just
point predictions.

### 2.3 Market truth is first-class

Devigged “fair” probabilities and market snapshots are stored as explicit
objects.

### 2.4 Single-writer + idempotent safety

All side effects flow through outbox with deterministic keys + idempotency
tokens.

### 2.5 Full auditability

Every decision must be reproducible:

- inputs used
- prices used
- model version
- selection decision
- what was published
- what was settled
- what was learned

### 2.6 Multi-tenant compatible (Black Label)

All entities are tenant-scoped. No global truth records.

---

## 3) Canonical Entity Model (Conceptual)

Core:

- `tenant`, `sport`, `league`
- `event`
- `participant` (team/player)
- `market` (definition)
- `bet_event` (canonical proposition)

Market Truth:

- `book`
- `offer`
- `market_snapshot`

Information Layer:

- `information_event` (news/injury/lineup/weather timestamps)

Model Layer:

- `model_projection`
- `model_score`

Decision + Delivery:

- `decision`
- `publish_job` (outbox)
- `receipt`

Outcome + Learning:

- `settlement`
- `postmortem`

Risk Layer:

- `correlation_group` (SGP + portfolio)

---

## 4) Canonical IDs & Deterministic Keys

### 4.1 IDs

All entities include:

- `id` (UUID/ULID)
- `created_at`, `updated_at` (server timestamps)

### 4.2 Deterministic Keys (required)

#### `event_key` (stable identity)

`{sport}:{league}:{start_time_utc}:{home_team}:{away_team}`

#### `market_key`

Examples:

- `moneyline_full_game`
- `spread_full_game`
- `total_full_game`
- `team_total_full_game`
- `player_points`
- `player_rebounds`
- `player_assists`
- `anytime_td`
- `home_run`
- `first_basket`
- `goal_scorer`

#### `selection_key`

- `player:{player_id}`
- `team:{team_id}`
- `side:home`
- `side:away`
- `side:over`
- `side:under`
- `bool:yes`
- `bool:no`

#### `line_key`

- `line:24.5`
- `spread:-3.5`
- `total:221.5`
- `bool:true`

#### `bet_event_key`

`{event_key}:{market_key}:{selection_key}:{line_key}:{market_phase}`

Note: `market_phase` is included so pregame and live markets do not collide.

---

## 5) Tenant Isolation Rules (Black Label Law)

- Every entity MUST include `tenant_id` (NOT NULL).
- All uniqueness constraints that could collide MUST be composite with
  `tenant_id`.
- No cross-tenant joins are permitted in application code without explicit,
  auditable operator context.

---

## 6) Entity Definitions (Required Fields)

### 6.1 `tenant`

- `tenant_id`
- `name`
- `tier` (internal | black_label)
- `status` (active | suspended)
- `config_json` (routing, thresholds, branding pointers)

### 6.2 `sport`

- `sport_code`
- `name`

### 6.3 `league`

- `league_code`
- `sport_code`
- `name`

### 6.4 `event`

Represents a game/match. Required:

- `event_id`
- `tenant_id`
- `sport_code`
- `league_code`
- `start_time_utc`
- `status` (scheduled | live | final | canceled | postponed)
- `home_team_id`
- `away_team_id`
- `provider_event_ids` (json)

Deterministic:

- `event_key`

Optional (recommended):

- `venue_json`
- `live_clock_state_json` (quarter/inning/time/possession/etc.)

### 6.5 `participant`

Represents a team or player. Required:

- `participant_id`
- `tenant_id`
- `type` (team | player)
- `sport_code`
- `league_code`
- `name`
- `team_id` (nullable; for players)
- `provider_participant_ids` (json)

Optional:

- `position`
- `metadata_json`
- `assets_json` (logos/headshots as soft assets)

---

## 7) Markets & Bet Events

### 7.1 `market`

Defines the market type and stat semantics. Required:

- `market_id`
- `tenant_id`
- `sport_code` (or `ALL`)
- `league_code` (or `ALL`)
- `market_key` (deterministic)
- `market_type` (moneyline | spread | total | team_total | player_prop |
  specialty_prop)
- `scope` (game | period | player | team)
- `stat_key` (points, rebounds, passing_yards, shots_on_goal, etc.)
- `period` (full_game | half | quarter | inning | set | etc.)
- `units` (pts, yds, rebounds, etc.)
- `allowed_selections_json`

### 7.2 `bet_event`

Canonical wagerable proposition. Required:

- `bet_event_id`
- `tenant_id`
- `event_id`
- `event_key`
- `market_id`
- `market_key`

Selection:

- `selection_type` (team | player | side)
- `selection_id` (team_id/player_id/nullable for pure sides)
- `selection_key`
- `direction` (over | under | home | away | yes | no | null)

Line:

- `line_value` (numeric nullable)
- `line_unit` (nullable for boolean props)
- `line_key`

Market State:

- `market_phase` (pregame | live)
- `is_live` (bool; must align with market_phase)
- `status` (open | closed | void | suspended)
- `start_time_utc` (redundant for query performance; must match event)
- `bet_event_key` (deterministic)

Quality + Context:

- `data_quality_flag` (good | partial | suspect)
- `context_flags_json` (injury volatility, role volatility, etc.)
- `tags_json` (anytime_td, first_basket, goal_scorer, etc.)

Risk hooks:

- `correlation_group_id` (nullable)

---

## 8) Books, Offers, Market Snapshots (Pricing Truth)

### 8.1 `book`

Required:

- `book_id`
- `tenant_id`
- `name`
- `region` (US, EU, etc.) Optional:
- `book_profile` (market_maker | sharp | retail | unknown)

### 8.2 `offer`

A book-specific offer at a given time. Required:

- `offer_id`
- `tenant_id`
- `bet_event_id`
- `book_id`
- `price_american`
- `price_decimal`
- `line_value` (if alternate differs)
- `is_available` (bool)
- `pulled_at_utc`
- `source` (provider)

Liquidity / quality (REQUIRED for resistance modeling):

- `limit_tier` (low | medium | high | unknown)
- `is_primary_line` (bool)

Optional:

- `limits_json`
- `deep_link`
- `raw_offer_json`

### 8.3 `market_snapshot`

Append-only time-series aggregation per bet_event. Required:

- `snapshot_id`
- `tenant_id`
- `bet_event_id`
- `captured_at_utc`

Offer aggregation:

- `offers_json` (all books summary)
- `best_price` (stored)
- `consensus_price` (stored)
- `devig_fair_prob` (stored)
- `devig_method` (stored; see devig spec)

CLV truth (REQUIRED):

- `is_closing_snapshot` (bool)
- `closing_locked_at_utc` (nullable; when closing was frozen)

Optional:

- `clv_anchor_price`
- `clv_anchor_time_utc`
- `data_quality_flag` (good | partial | suspect)

Notes:

- Closing snapshot is explicit. CLV is invalid without this flag.

---

## 9) Information Arrival Layer (Steam vs News)

### 9.1 `information_event`

Represents time-stamped external information that can move markets. Required:

- `info_id`
- `tenant_id`
- `event_id`
- `info_type` (injury | lineup | scratch | weather | coaching | pitcher_confirm
  | goalie_confirm | other)
- `subject_type` (player | team | event)
- `subject_id` (nullable for event-wide)
- `reported_at_utc`
- `effective_at_utc` (nullable)
- `source`
- `confidence_score` (0-1)
- `raw_info_json`

Notes:

- This is mandatory for classifying “steam vs news.”
- It also powers execution timing and postmortems.

---

## 10) Model Outputs (Projections + Scoring)

### 10.1 `model_projection`

Distribution output for a bet_event. Required:

- `projection_id`
- `tenant_id`
- `bet_event_id`
- `model_name`
- `model_version`
- `generated_at_utc`

Distribution:

- `distribution_type` (normal | poisson | negbin | empirical | quantile | mixed)
- `params_json` (mean/var/quantiles/etc.)
- `expected_value` (market units)
- `uncertainty_score` (0-1)

Outcome probabilities (when applicable):

- `p_over` / `p_under` (nullable)
- `p_home` / `p_away` (nullable)
- `p_yes` / `p_no` (nullable)

Repro + audit (REQUIRED):

- `inputs_snapshot_id` (market_snapshot id)
- `feature_set_version`
- `feature_vector_hash`

Optional:

- `inputs_hash`
- `notes_json`

### 10.2 `model_score`

Decision-layer scoring output. Required:

- `score_id`
- `tenant_id`
- `bet_event_id`
- `model_name`
- `model_version`
- `scored_at_utc`

Edge / confidence:

- `edge` (expected edge vs devigged price)
- `confidence` (0-100)
- `tier_bucket` (internal)
- `clv_forecast` (expected CLV delta)
- `risk_flags_json` (correlation, exposure, volatility, etc.)

Optional:

- `reason_codes_json`
- `attribution_json`

---

## 11) Correlation & Portfolio Risk (SGP + Exposure)

### 11.1 `correlation_group`

Represents correlation structure among multiple bet_events. Required:

- `correlation_group_id`
- `tenant_id`
- `event_id` (nullable for cross-event portfolio groups)
- `group_type` (same_game | same_player | same_team | cross_market | portfolio)
- `members_json` (list of bet_event_ids)
- `correlation_matrix_json` (NxN; can be sparse)
- `generated_at_utc`
- `method` (heuristic | learned | hybrid)
- `quality_score` (0-1)

Notes:

- Required for SGP risk control and “Risk Engine Dominance” phase.

---

## 12) Decision & Promotion (Selection Layer)

### 12.1 `decision`

Required:

- `decision_id`
- `tenant_id`
- `bet_event_id`
- `decided_at_utc`
- `decision` (promote | hold | reject)
- `promotion_band`
- `operator_override` (bool)
- `decider` (system | operator | capper_identity)
- `reason_codes_json`

Optional:

- `capper_identity_id`
- `notes`

---

## 13) Publish & Receipts (Outbox → Discord)

### 13.1 `publish_job`

Required:

- `publish_job_id`
- `tenant_id`
- `bet_event_id`
- `target_surface` (discord)
- `target_channel_id` OR `target_webhook_id`
- `payload_json` (embed-ready)
- `publish_token` (UUID; DB-unique when set)
- `status` (pending | claimed | posted | failed)
- `claimed_at_utc`
- `posted_at_utc`

### 13.2 `receipt`

Required:

- `receipt_id`
- `tenant_id`
- `publish_job_id`
- `bet_event_id`
- `discord_message_id` (snowflake)
- `channel_id`
- `posted_at_utc`
- `raw_response_json`

Notes:

- Receipt existence is proof of external delivery.
- Receipts are immutable.

---

## 14) Settlement (Grading Layer)

### 14.1 `settlement`

Required:

- `settlement_id`
- `tenant_id`
- `bet_event_id`
- `settled_at_utc`
- `result` (win | loss | push | void | pending)
- `final_stat_value` (numeric nullable)
- `settlement_source` (official feed | provider | manual override)
- `settlement_version`
- `audit_hash`

Optional:

- `operator_override` (bool)
- `override_reason`
- `raw_settlement_json`

Notes:

- Settlement must be replay-safe and idempotent.
- Truth fields are immutable post-settlement per invariants.

---

## 15) Postmortems (Learning Layer)

### 15.1 `postmortem`

Required:

- `postmortem_id`
- `tenant_id`
- `bet_event_id`
- `generated_at_utc`
- `loss_class` (variance | projection_miss | role_miss | news_miss |
  execution_miss | price_miss | correlation)
- `explanation_md`
- `reason_codes_json`
- `counterfactuals_json`
- `action_items_json`

Optional:

- `attribution_json`
- `links_json` (traces, receipts, inputs)

---

## 16) Market-Type Field Requirements (Matrix)

### 16.1 Moneyline

- `market_type=moneyline`
- `selection_type=team`
- `direction=home|away`
- `line_value=null`

### 16.2 Spread

- `market_type=spread`
- `selection_type=team`
- `direction=home|away`
- `line_value=numeric`

### 16.3 Total

- `market_type=total`
- `selection_type=side`
- `direction=over|under`
- `line_value=numeric`

### 16.4 Team Total

- `market_type=team_total`
- `selection_type=team`
- `direction=over|under`
- `line_value=numeric`

### 16.5 Player Props

- `market_type=player_prop`
- `selection_type=player`
- `selection_id=player_id`
- `direction=over|under` (or yes/no)
- `line_value=numeric or boolean-equivalent`

### 16.6 Specialty Props (Anytime TD/HR/First Basket/Goal Scorer)

- `market_type=specialty_prop`
- `direction=yes/no`
- `line_value often null`
- Must use `tags_json` to identify subtype
- Must support devig + distribution modeling

---

## 17) Compatibility With Canonical Pick Table (`unified_picks`)

If a single canonical table (`unified_picks`) is used, it MUST contain or
reference:

- `event_key` + event identity
- `market_key` + market semantics
- `selection_key` + direction
- `line_value` + market_phase
- references to `market_snapshot` used for scoring
- scoring outputs (`edge`, `confidence`, `model_version`, `feature_set_version`)
- decision/promotion
- outbox publish fields (`publish_token`, status, receipt link)
- settlement fields
- postmortem link
- correlation group link (nullable)

No app may invent alternate meanings for these fields.

---

## 18) Versioning Rules

- This document is `v1.1`.
- Breaking changes require:
  - new version doc
  - migration plan
  - compatibility layer
  - governance closeout marker

---

## 19) Phase 2A Next Step

Proceed to:

1. DATA_MOAT_REQUIREMENTS_v1.md
2. DEVIG_NORMALIZATION_SPEC_v1.md

END.
