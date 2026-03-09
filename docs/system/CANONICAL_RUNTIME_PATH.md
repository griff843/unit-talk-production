# Canonical Runtime Path

Status: CANONICAL Authority: Tier 1 Owner: Platform Architecture Last Verified:
2026-03-08 Sprint: SPRINT-044H

---

## Overview

This document describes the canonical data flow from odds ingestion to Discord
delivery, as implemented in the syndicate-scheduler workflow.

---

## Pipeline Stages

```
                    ┌─── CANONICAL V3 PATH (live since SPRINT-044G) ───┐
Provider APIs ──→ IngestionAgent ──→ provider_offers ──→ GradingAgent* ──→ unified_picks ──→ Discord
                    │                  (canonical_events,                       │
                    │                   participants FK)                        ▼
                    │                                                  Lifecycle Adapters
                    └─── LEGACY PATH (compatibility) ──┐               (single-writer)
Provider APIs ──→ FeedAgent ──→ raw_props/games ──→ GradingAgent ──→ unified_picks ──→ Discord

* GradingAgent path controlled by GRADING_DATA_SOURCE env var (default: raw_props)
```

---

## Stage 1: Data Ingestion

### Canonical V3 Path (provider_offers) — LIVE since SPRINT-044G

**Agent**: IngestionAgent via `ingestSGOProviderOffers()` /
`ingestProviderOffers()` **RPC**: `upsert_provider_offers_bootstrap` —
auto-creates events in `canonical_events`, resolves market/participant FKs,
inserts into `provider_offers`.

**Runtime proof (SPRINT-044G, 2026-03-08)**:

- SGO → provider_offers: 2,108 rows inserted, 10 canonical_events created
- Participant FK resolution: 94/94 resolved successfully
- raw_props writes: 0 (SGO canonical path bypasses raw_props)

| Provider    | Status          | Adapter                     |
| ----------- | --------------- | --------------------------- |
| SGO         | LIVE (proven)   | `ingestSGOProviderOffers()` |
| OddsAPI     | LIVE (existing) | `ingestProviderOffers()`    |
| Optimal API | NOT YET WIRED   | Adapter pending             |

### Legacy Path (raw_props) — COMPATIBILITY

**Orchestrator**: `syndicateSchedulerWorkflow` → `leagueIngestionWorkflow`
**Activity**: `feedActivities.ingestUnifiedData({ league, batchSize, timeout })`
**Agent**: FeedAgent via `dataSourceRouter`

**Provider Routing:**

| League             | Primary Provider | Fallback |
| ------------------ | ---------------- | -------- |
| NFL, NBA, MLB, NHL | Optimal API      | OddsAPI  |
| NCAAF, NCAAB, WNBA | OddsAPI          | None     |

**Output Tables**: `raw_props`, `games` (COMPATIBILITY — deprecated per TD-1,
SPRINT-035B)

**Circuit Breaker**: 10 failures → 10-minute cooldown per provider

> **Note**: The legacy path remains the default scheduler path. The canonical V3
> path is proven but not yet the scheduler default. GradingAgent reads from
> raw_props by default (`GRADING_DATA_SOURCE=raw_props`).

---

## Stage 2: Grading and Scoring

**Orchestrator**: `syndicateSchedulerWorkflow` → `gradingAndScoringWorkflow`
**Activities**:

1. `gradingActivities.gradeNewProps({ league, isLiveMode, cycleCount })` —
   parallel across all leagues
2. `gradingActivities.scoreTopTierPicks({ gradedProps, league, cycleCount })`
3. `gradingActivities.updateUnifiedPicks({ scoringResults, cycleCount, timestamp })`

**Scoring Pipeline** (in `packages/intelligence`):

- Devig consensus → probability layer → uncertainty estimation → edge
  calculation → CLV forecast
- Output: `p_final`, `edge_final`, `uncertainty_final`, `clv_forecast`,
  `devigged_edge`

**Promotion Gate** (Stage 1 — eligibility via `promotionPolicy.ts`):

- Minimum edge threshold
- Minimum confidence threshold
- Market policy compliance (`market_policy` table)

**Band Calibration** (Stage 2 — in `apps/api/src/analysis/promotion/`):

- Deterministic band assignment based on scored metrics
- Walk-forward evaluation harness for model validation

---

## Stage 3: Distribution

**Orchestrator**: `syndicateSchedulerWorkflow` → `discordAlertWorkflow`
**Activities**:

1. `gradingActivities.getNewUnifiedPicks({ cycleCount })`
2. `notificationActivities.sendNotification({ type, channel, data })`

**Delivery Path**: DiscordPromotionAgent → `pick_publish` outbox → Discord
webhook **Idempotency**: `atomicClaimForPost()` prevents duplicate posting

---

## Stage 4: Settlement

**Agent**: SettlementAgent (via OddsAPI settlement data) **Lifecycle**:
`lifecycleSettle(supabase, pickId, settlement, { writerRole: 'settler' })`
**Immutable Fields**: `settlement_hash`, `settlement_frozen` — cannot be changed
after set (except `operator_override`)

---

## Worker Activity Registration

All activities are registered on a single Temporal worker via spread order:

| Position | Module                       | Key Activities                                                                                         |
| -------- | ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1        | `baseActivities`             | initialize, healthCheck, collectMetrics                                                                |
| 1        | `healthMonitoringActivities` | performHealthCheck, monitorSystemHealth                                                                |
| 1        | `mainOperatorActivities`     | logError, monitorAPIQuota, checkSystemHealth, detectLiveGames, logWorkflowMetrics                      |
| 1        | `workflowLoggingActivities`  | logWorkflowStart, logWorkflowEnd                                                                       |
| 2        | `analyticsActivities`        | runAnalyticsAgent, runAnalysis, performAnalyticsHealthCheck                                            |
| 2        | `notificationActivities`     | sendNotification, sendBatchNotifications                                                               |
| 3        | `feedActivities`             | ingestUnifiedData, fetchFeed, getLiveGames, checkQuotaStatus                                           |
| 4        | `auditActivities`            | performAudit, generateReport, runAudit                                                                 |
| 5        | `gradingActivities`          | gradeNewProps, scoreTopTierPicks, updateUnifiedPicks, getNewUnifiedPicks                               |
| 6        | `alertActivities`            | processAlert, evaluateConditions, sendAlertNotification, escalateAlert                                 |
| 7        | `operatorActivities`         | monitorSystem, handleAlert, performMaintenance, handleCriticalError, updateLiveGameStatus, logUSPError |
| 8        | `playerEnrichmentActivities` | enrichAllPlayers, enrichPlayerById, get\*Headshot                                                      |
| 9        | `recapActivities`            | triggerDailyRecap, triggerWeeklyRecap, checkMicroRecapTriggers                                         |

**Collision Rule**: Later spread positions overwrite earlier ones on name
collision. The `logUSPError` collision (position 1 vs 7) is benign — both
implementations log errors.

---

## Cycle Timing

| Mode                | Interval                     | Trigger                                         |
| ------------------- | ---------------------------- | ----------------------------------------------- |
| Live (games active) | 1 minute                     | `liveGameDetectorWorkflow` detects active games |
| Idle (no games)     | 5 minutes                    | Default when no live games                      |
| League schedule     | 30s (peak) / 5min (off-peak) | Per-league peak hours                           |

---

## Quarantined Paths

| Path                    | Status     | Reason                                                 |
| ----------------------- | ---------- | ------------------------------------------------------ |
| USP Detection           | No-op stub | Detector files exist but not wired (TD-6, SPRINT-035B) |
| Workflow-level fallback | Removed    | DataSourceRouter handles failover internally (TD-4)    |

> **De-quarantined (SPRINT-044F/044G)**: SGO provider_offers path is now LIVE.
> `ingestSGOProviderOffers()` proven with 2,108 rows in runtime validation.

---

## Related Documents

- [System Overview](./SYSTEM_OVERVIEW.md)
- [Workflow Activity Contract](../governance/WORKFLOW_ACTIVITY_CONTRACT.md)
- [Agent Registry](../../apps/api/AGENT_REGISTRY.md)
- [Provider Authority Spec](../governance/PROVIDER_AUTHORITY_SPEC.md)
