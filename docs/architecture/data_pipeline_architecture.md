# Data Flow Architecture (Odds API → Discord)

**Date:** 2025-11-20  
**Charter:** docs/PRODUCTION_CHARTER.md (canonical-first, picks + pick_publish)

This document describes the **authoritative v3.0.0 data flow** from external
odds providers through professional grading to Discord promotion readiness.

High-level pipeline:

1. **Live markets** from The Odds API (primary) and Optimal API (secondary).
2. **Ingestion & normalization** into `raw_props` (ingest staging /
   authoritative grading pickup).
3. **Professional grading pipeline** → `unified_picks`.
4. **Canonical pick creation** → `picks` + `pick_publish`.
5. **Outbox publisher** → Discord / downstream channels.

---

## 1. Ingestion: Providers → raw_props

**Code:**

- `apps/api/src/agents/FeedAgent/dataSourceRouter.ts`
- `apps/api/src/agents/FeedAgent/oddsApi.ts`
- `apps/api/src/agents/FeedAgent/optimal.ts`
- `apps/api/src/runner/runFeedAgentNow.ts`

**Flow:**

1. `FeedAgent` requests data via `fetchUnifiedData({ sport, marketType, date })`.
2. `dataSourceRouter.determineDataSource()` chooses **Odds API** as primary,
   with Optional API as secondary only when `forceSource: 'optimal-api'` is
   explicitly set.
3. Odds API responses are normalized into the **`raw_props`** table with:
   - `source = 'odds-api'`
   - full pricing, lines, metadata, and scoring columns
4. `raw_props.processed_at` is left **NULL** for new ingested rows; this is the
   authoritative gate for grading pickup.

> From `SCHEMA_MIGRATION_MAPPING.md`:
>
> ```sql
> -- raw_props (ingest staging; authoritative grading pickup by processed_at)
> ```

`raw_props` is therefore **both** the ingestion staging table **and** the
canonical source for professional grading. No direct grading queries should hit
providers or legacy views.

---

## 2. Professional Grading: raw_props → unified_picks

**Code:**

- `apps/api/src/services/ProfessionalPropProcessor.ts`
- `apps/api/src/runner/processThroughProfessionalSystem.ts`
- `apps/api/src/ml/ensemble/**`

**Flow:**

1. `ProfessionalPropProcessor.getUnprocessedRawProps()` queries:

   ```sql
   SELECT *
   FROM raw_props
   WHERE processed_at IS NULL
     AND processing_error IS NULL
   ORDER BY created_at ASC
   LIMIT :batch_size;
   ```

2. For each `raw_props` row, the professional system:
   - Devigs odds (remove bookmaker margin).
   - Computes **devigged win probability** and **devigged edge**.
   - Tracks **CLV** via `clv_tracking`.
   - Computes **professional_score**, **kelly_fraction**, and **risk`**.
   - Determines auto-approval and staging metadata.

3. Results are written to **`unified_picks`**:
   - `professional_score`
   - `devigged_win_prob`, `devigged_edge`, `clv_pct`
   - `kelly_fraction`, `risk`, `clv_tracking_id`
   - `grading_status`, `stage`, `published`, `is_instant`, `promoted_at`

4. The source `raw_props` row is marked as processed by setting
   `processed_at = now()` (and/or `processing_error` when failures occur).

`unified_picks` is the **graded pick reservoir** and compatibility replacement
for legacy `final_picks` / `daily_picks` views.

---

## 3. Canonical Picks: unified_picks → picks + pick_publish

**Code:**

- `apps/api/src/lib/canonical-direct-writer.ts`
- `apps/api/src/publish/outbox-publisher.ts`
- `apps/api/src/index.ts` (HTTP route: `/api/domain/picks/insert`)
- `scripts/ops/e2e-production-pipeline.js`

**Flow:**

1. Application code (or the E2E orchestrator) selects a graded row from
   `unified_picks` (typically highest `professional_score` since a given
   timestamp).
2. A canonical creation request is sent to
   `POST /api/domain/picks/insert` with:
   - `tenantId`, `userId`
   - league, player, market, line, side, odds
   - stake + user-facing metadata
   - `idempotencyKey` (e.g. `e2e-<unified_pick_id>`)
3. The canonical writer:
   - Inserts into **`picks`** (authoritative canonical pick record).
   - Inserts into **`pick_publish`** (outbox row for Discord / downstream).
   - Honors idempotency, tenant isolation, and shadow-mode flags.

Canonical-first rule from the charter:

- **`picks` + `pick_publish` are the only authoritative sources** for
  production-facing picks and promotion state.

---

## 4. Outbox Publisher: pick_publish → Discord

**Code:**

- `apps/api/src/publish/outbox-publisher.ts`
- Worker wiring in `apps/api/src/index.ts` (publisher worker)
- Discord bot integration (discord-bot app)

**Flow:**

1. The **Publisher Worker** polls `pick_publish` for pending rows
   (status-based, retry-aware).
2. For each eligible row it:
   - Formats the pick payload for Discord / downstream channels.
   - Sends to the appropriate channel/thread.
   - Updates `pick_publish.status` (`sent`, `processed`, `shadow-sent`, etc.)
     and increments `attempts`.
3. Command Center and the Discord bot read from canonical tables to display
   current and historical picks.

---

## 5. End-to-End Test Harness

The **single-command E2E flow** wires all stages together:

- Script: `scripts/ops/e2e-production-pipeline.js`
- Entrypoint: `bash dev.sh test:e2e-production`

Stages:

1. Ingest live props into `raw_props` using Odds API–first routing.
2. Run `ProfessionalPropProcessor` to create `unified_picks` rows.
3. Create a canonical `picks` + `pick_publish` record via the public API.
4. Verify outbox processing and summarize metrics under:
   `out/ops/cutover/metrics/e2e-production/`.

This document, together with `docs/API_PROVIDER_CONFIGURATION.md` and
`SCHEMA_MIGRATION_MAPPING.md`, is the **single source of truth** for production
pipeline data flow.

