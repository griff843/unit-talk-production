# raw_props Retirement Plan

> Sprint: SPRINT-044E | Status: PLANNING This document tracks the phased
> retirement of the `raw_props` table.

## Current State

`raw_props` is a **staging/working table** used as the primary ingestion target
for prop data. It is read by 6+ active agents and written by the ingestion
pipeline. The canonical business table is `unified_picks`.

**Consumer count**: 458+ references across 50+ files (agents, services, scripts,
tests).

## Migration Progress

### Phase 1: Dual-Write to provider_offers (DONE - SPRINT-044B)

- `leagueIngestionWorkflow` now writes to both `raw_props` (existing) and
  `provider_offers` (V3 canonical) via `ingestV3ProviderOffers()`
- OddsAPI + SGO paths both populate `provider_offers`
- `provider_offers` table has auto-FK resolution via
  `upsert_provider_offers_bootstrap` RPC

### Phase 2: GradingAgent Reads provider_offers (DONE - SPRINT-044D)

- `GRADING_DATA_SOURCE` env var controls data source (default: `raw_props`)
- When set to `provider_offers`, GradingAgent reads from V3 table
- `graded_at` column + partial index added for processing tracking
- Feature-flagged — zero behavioral change until flag is flipped

### Phase 3: Migrate Remaining Read Consumers (FUTURE)

Agents that still read from `raw_props`:

| Agent/Service                 | Read Purpose                   | Migration Path                                   |
| ----------------------------- | ------------------------------ | ------------------------------------------------ |
| **GradingAgent**              | Scoring input                  | Done (Phase 2, feature-flagged)                  |
| **SettlementAgent**           | Settlement metadata            | Read from `provider_offers` + `prop_settlements` |
| **AlertAgent**                | Hedge detection, line movement | Read from `provider_offers`                      |
| **FeedAgent**                 | Discord embed data             | Read from `provider_offers` joined with events   |
| **ProfessionalPropProcessor** | Professional scoring           | Already uses GradingAgent path                   |
| **espnGradingService**        | ESPN correlation               | Join provider_offers with participants           |

Each migration should be feature-flagged with a `*_DATA_SOURCE` env var.

### Phase 4: Stop Writing to raw_props (FUTURE)

Once all read consumers are migrated (Phase 3 complete):

1. Remove `raw_props` insert from `ingestUnifiedData()` in FeedAgent activities
2. Remove raw_props write path from `storeGradingResult()` in GradingAgent
3. Keep `raw_props` table alive but frozen (no new writes)
4. Monitor for any missed consumers via DB audit logs

### Phase 5: Archive and Drop Table (FUTURE)

1. Create `raw_props_archive` table or export to cold storage
2. Run final consumer audit (`grep -r "raw_props" apps/`)
3. Drop `raw_props` table via migration (with rollback documented)
4. Remove `raw_props` references from type definitions

## Risk Assessment

| Risk                             | Severity | Mitigation                               |
| -------------------------------- | -------- | ---------------------------------------- |
| Consumer missed during migration | High     | Feature flags + `*_DATA_SOURCE` env vars |
| Data shape mismatch              | Medium   | Adapter functions per consumer           |
| Performance regression           | Low      | provider_offers has proper indexes       |
| Rollback needed                  | Medium   | Feature flags allow instant rollback     |

## Decision Log

- **2026-03-07**: Phases 1-2 complete. Phase 3+ deferred to dedicated sprint.
- raw_props retirement requires coordinated migration across 6 agents — too
  large for a single cleanup sprint.
