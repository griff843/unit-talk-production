# Table Schema Guide (v3.0.0 Unified Database)

**Date:** 2025-11-20  
**Charter:** docs/PRODUCTION_CHARTER.md (canonical-first, schema-only via migrations)

This guide explains the **purpose and usage** of the core tables involved in the
production pick pipeline. For the full catalog of ~45 tables, see:

- `docs/database-schema-v3.md`
- `SCHEMA_MIGRATION_MAPPING.md`

---

## 1. Ingestion & Market Data

### 1.1 `raw_props`

- **Role:** Ingestion staging table and **authoritative grading pickup source**.
- **Populated by:** FeedAgent via Odds API / Optimal API integrations.
- **Key columns:**
  - `id uuid PRIMARY KEY`
  - `processed_at timestamptz` — authoritative pickup gate for grading
  - `pro_attempts int` — retry tracking
  - `processing_error text` — error logging
  - Pricing + line + metadata fields (63+ scoring columns)
- **Query patterns:**
  - Unprocessed props:
    - `WHERE processed_at IS NULL AND processing_error IS NULL`
  - Processed props:
    - `WHERE processed_at IS NOT NULL`
- **Never** bypass `raw_props` by querying providers directly for grading.

### 1.2 `games`, `teams`, `players`

- **Role:** Structured sports metadata used for context, joins, and enrichment.
- **Usage:**
  - `games`: schedules, results, and foreign keys to teams.
  - `teams`: team-level metadata.
  - `players`: player profiles and basic identifiers.

---

## 2. Professional Grading Reservoir

### 2.1 `unified_picks`

- **Role:** Reservoir of **professionally graded picks**, replacing legacy
  `final_picks` / `daily_picks` views.
- **Populated by:** `ProfessionalPropProcessor` from `raw_props`.
- **Key columns (see `SCHEMA_MIGRATION_MAPPING.md`):**
  - `professional_score` — unified professional scoring
  - `devigged_win_prob`, `devigged_edge`, `clv_pct`
  - `kelly_fraction`, `risk`, `clv_tracking_id`
  - `grading_status`, `stage`, `published`, `is_instant`, `promoted_at`
- **Canonical behavior:**
  - All new professional features should target `unified_picks`.
  - Legacy columns such as `edge_score`, `ev`, `position_size` are deprecated.

### 2.2 `clv_tracking`

- **Role:** Tracks closing line value and line movement over time for graded
  props.
- **Linked to:** `unified_picks.clv_tracking_id`.

### 2.3 `processing_logs` (and related logs)

- **Role:** Detailed audit trail of grading runs, errors, and retries.
- **Usage:** Diagnostics, observability, and regression analysis.

---

## 3. Canonical Pick System

### 3.1 `picks`

- **Role:** **Canonical pick table** for all production-facing picks.
- **Populated by:**
  - HTTP endpoint: `POST /api/domain/picks/insert`
  - Internal helpers: `canonical-direct-writer`
- **Key responsibilities:**
  - Tenant isolation via `tenant_id`.
  - Full pick context (league, player, market, stake, odds, metadata).
  - Lifecycle status (workflow stage, grading status linkage).

### 3.2 `pick_publish`

- **Role:** **Outbox table** for Discord and downstream promotion.
- **Populated by:** Canonical pick writer when a pick is ready to be published.
- **Consumed by:** Publisher Worker (`outbox-publisher`) and Discord bot.
- **Key columns:**
  - `id uuid PRIMARY KEY`
  - `pick_id uuid` — foreign key to `picks`
  - `status text` — `pending`, `sent`, `processed`, `shadow-sent`, etc.
  - `attempts int` — retry count
  - `channel_id`, `thread_id`, `target_audience` (where applicable)
- **Rule:** No direct writes outside the canonical writer; treat as append-only
  event log for publishing.

---

## 4. Users, Tenants, and Discord Integration

### 4.1 `users`

- **Role:** Unified capper/user management.
- **Usage:**
  - Pick ownership (`picks.user_id` → `users.id`).
  - Tiering, status, and onboarding flows.

### 4.2 `discord_channels`, `discord_messages`

- **Role:** Configuration + history for Discord integration.
- **Usage:**
  - Maps picks/publish events to channels/threads.
  - Tracks message IDs for edits, deletes, and audits.

---

## 5. Governance and Backward Compatibility

### 5.1 Compatibility Views

From `docs/database-schema-v3.md`:

- `final_picks` → `unified_picks`
- `daily_picks` → `unified_picks`
- `cappers` → `users`

These views exist for **backward compatibility only**. New code **must not**
introduce fresh dependencies on legacy view names. Always target the v3.0.0
canonical tables directly.

### 5.2 Safe Query Patterns

- For grading pickup:
  - `raw_props` with `processed_at IS NULL AND processing_error IS NULL`.
- For graded professional picks:
  - `unified_picks` with `grading_status = 'graded'` and `published = true`.
- For production-facing picks:
  - `picks` (optionally joined to `pick_publish` for promotion state).

All schema changes must be introduced **only** via migrations under
`supabase/migrations/**`, with this document and `SCHEMA_MIGRATION_MAPPING.md`
updated in the same change set.

