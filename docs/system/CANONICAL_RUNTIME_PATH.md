# Canonical Runtime Path

Status: CANONICAL Authority: Tier 1 Owner: Platform Architecture Last Verified:
2026-03-07 Sprint: SPRINT-DOCS-CANONICALIZATION-040

---

## Overview

This document describes the canonical data flow from odds ingestion to Discord
delivery, as implemented in the syndicate-scheduler workflow.

---

## Pipeline Stages

```
Provider APIs → FeedAgent → raw_props/games → GradingAgent → unified_picks → DiscordPromotionAgent → Discord
     │                                              │                                    │
     │                                              ▼                                    │
     │                                    Lifecycle Adapters                              │
     │                                    (single-writer)                                 │
     ▼                                                                                   ▼
  Optimal API (NFL/NBA/MLB/NHL)                                              pick_publish outbox
  OddsAPI (NCAAF/NCAAB/WNBA/settlement)                                     Discord webhooks
```

---

## Stage 1: Data Ingestion

**Orchestrator**: `syndicateSchedulerWorkflow` → `leagueIngestionWorkflow`
**Activity**: `feedActivities.ingestUnifiedData({ league, batchSize, timeout })`
**Agent**: FeedAgent via `dataSourceRouter`

**Provider Routing:**

| League             | Primary Provider | Fallback |
| ------------------ | ---------------- | -------- |
| NFL, NBA, MLB, NHL | Optimal API      | OddsAPI  |
| NCAAF, NCAAB, WNBA | OddsAPI          | None     |

**Output Tables**: `raw_props`, `games` (compatibility — scheduled for migration
to `provider_offers`, `events`)

**Circuit Breaker**: 10 failures → 10-minute cooldown per provider

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

| Path                    | Status                    | Reason                                                 |
| ----------------------- | ------------------------- | ------------------------------------------------------ |
| USP Detection           | No-op stub                | Detector files exist but not wired (TD-6, SPRINT-035B) |
| SGO Provider            | Mappers exist, not routed | Provider adapters exist but no data flow               |
| Workflow-level fallback | Removed                   | DataSourceRouter handles failover internally (TD-4)    |

---

## Related Documents

- [System Overview](./SYSTEM_OVERVIEW.md)
- [Workflow Activity Contract](../governance/WORKFLOW_ACTIVITY_CONTRACT.md)
- [Agent Registry](../../apps/api/AGENT_REGISTRY.md)
- [Provider Authority Spec](../governance/PROVIDER_AUTHORITY_SPEC.md)
