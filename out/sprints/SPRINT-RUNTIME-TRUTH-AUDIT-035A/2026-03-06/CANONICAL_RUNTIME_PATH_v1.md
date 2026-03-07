# CANONICAL RUNTIME PATH v1.0

**Sprint**: SPRINT-RUNTIME-TRUTH-AUDIT-035A
**Date**: 2026-03-06
**Status**: DRAFT — requires truth decisions from REMEDIATION_ORDER.md before ratification

---

## Purpose

This document declares the **single sanctioned runtime path** for the Unit Talk platform based on audit findings. It describes what IS working, what SHOULD work after remediation, and what is explicitly OUT OF SCOPE.

---

## 1. Canonical Data Flow

```
                     ┌─────────────┐
                     │  OddsAPI    │ ← Primary provider (functional)
                     │  Optimal*   │ ← Secondary (degraded, 503)
                     └──────┬──────┘
                            │
                    ┌───────▼────────┐
                    │   FeedAgent    │ ← Sole ingestion agent
                    │  fetchFeed()   │   ingestUnifiedData()
                    └───────┬────────┘
                            │
                    ┌───────▼────────┐
                    │   raw_props    │ ← Ingestion staging table
                    │   (+ games)    │   Direct insert (no lifecycle adapter)
                    └───────┬────────┘
                            │
                    ┌───────▼────────┐
                    │ GradingAgent   │ ← gradeNewProps() [CURRENTLY BROKEN]
                    │ scoreTopTier() │   Scores and classifies picks
                    └───────┬────────┘
                            │
                ┌───────────▼───────────┐
                │   Promotion Pipeline  │
                │  Stage 1: Policy Gate │ ← promotionPolicy.ts
                │  Stage 2: Band Assign │ ← analysis/promotion/
                └───────────┬───────────┘
                            │
                    ┌───────▼────────┐
                    │ unified_picks  │ ← CANONICAL table
                    │ (lifecycle     │   ALL writes via lifecycle adapters
                    │  adapters)     │   Writer roles: submitter, promoter,
                    └───────┬────────┘   poster, settler, operator_override
                            │
                ┌───────────▼───────────┐
                │  DiscordPromotion     │ ← atomicClaimForPost()
                │  Agent                │   Posts to Discord channels
                └───────────┬───────────┘
                            │
                    ┌───────▼────────┐
                    │ SettlementAgent│ ← lifecycleSettle()
                    │                │   Processes game results
                    └───────┬────────┘
                            │
                    ┌───────▼────────┐
                    │   RecapAgent   │ ← triggerDailyRecap()
                    │                │   Generates performance reports
                    └────────────────┘
```

*Optimal API: configured as primary for MLB/NBA/NFL/NHL but currently returning 503. OddsAPI handles all traffic.

---

## 2. Canonical Tables

| Table | Role | Owner | Write Method | Lifecycle-Protected |
|-------|------|-------|-------------|-------------------|
| `unified_picks` | **CANONICAL** — all pick data | API | Lifecycle adapters only | **YES** |
| `raw_props` | Ingestion staging | FeedAgent | Direct insert | No (staging table) |
| `games` | Game tracking | FeedAgent | Direct upsert | No |
| `participants` | **CANONICAL** — players/teams | SGO Sync | Direct | No |
| `participant_memberships` | **CANONICAL** — player-team links | SGO Sync | Direct | No |
| `bridge_outbox` | Ticket queue | Smart Form | Direct | No |
| `agent_health` | Agent monitoring | API Agents | Direct | No |
| `prop_settlements` | Settlement records | SettlementAgent | Direct | No |

**Deprecated** (no active writes): `daily_picks`, `players`, `teams`

---

## 3. Canonical Agents

| Agent | Role | Registered in Worker | Status |
|-------|------|---------------------|--------|
| **FeedAgent** | Data ingestion from providers | YES | **WORKING** |
| **GradingAgent** | Scoring and pick classification | YES (barrel broken) | **BROKEN** — needs barrel fix |
| **DiscordPromotionAgent** | Posts picks to Discord | YES | WORKING (blocked upstream) |
| **SettlementAgent** | Processes game results | YES | WORKING (blocked upstream) |
| **RecapAgent** | Generates recap reports | YES | WORKING (no data to recap) |
| **OperatorAgent** | System monitoring and alerts | YES | WORKING (partial) |
| **AlertAgent** | Alert processing | YES (4 of 13 activities) | PARTIAL |
| **NotificationAgent** | Notification delivery | YES (overwritten by collision) | **BROKEN** — name collision |
| **AnalyticsAgent** | Data analysis | YES (name mismatch) | **BROKEN** — activity name wrong |
| **AuditAgent** | Compliance auditing | YES | DEAD CODE (never called) |
| **PlayerEnrichmentAgent** | Player headshot enrichment | YES | DISABLED (workflow not started) |

**Not agents** (utility modules): IngestionAgent, DataAgent, ScoringAgent

---

## 4. Canonical Workflows

| Workflow | ID | Owner | Status |
|----------|----|-------|--------|
| syndicateSchedulerWorkflow | syndicate-scheduler-v1 | FeedAgent + GradingAgent | **BROKEN** |
| liveGameDetectorWorkflow | live-game-detector | OperatorAgent | WORKING (degraded) |
| healthMonitoringWorkflow | health-monitoring | healthMonitoring | WORKING (no-op) |
| nfl/nba/mlb/nhl/ncaaf/ncaab/wnbaScheduleWorkflow | {league}-schedule | FeedAgent | WORKING |
| combinedRecapWorkflow | recap-agent | RecapAgent | WORKING |
| quotaMonitoringWorkflow | quota-monitoring | OperatorAgent | **BROKEN** |
| analyticsWorkflow | analytics-agent | AnalyticsAgent | **BROKEN** |

---

## 5. Provider Priority

| Priority | Provider | Sports | Status |
|----------|----------|--------|--------|
| 1 | OddsAPI (The Odds API) | ALL | **HEALTHY** |
| 2 | Optimal API | MLB, NBA, NFL, NHL | **DEGRADED** (503) |
| — | SGO | — | **NOT IMPLEMENTED** |

---

## 6. What Is Explicitly Out of Scope

The following are NOT part of the canonical runtime path. They are aspirational features referenced in docs or code but not operational:

1. **USP Detection System** — 7 AlertAgent activities (steam, line movement, hedge, middle, stale, injury, suspicious). No implementations exist.
2. **Multi-model Ensemble Scoring** — GradingAgent README describes XGBoost, Neural Networks, Poisson, Monte Carlo. Not wired to runtime.
3. **SGO Provider** — Referenced in type definitions. No client implementation.
4. **Campaign/Contest Agents** — Archived per SPRINT-REPO-TRUTH-LOCK-002.
5. **Discord Alert Pipeline via syndicate-scheduler** — `buildPickEmbeds`, `sendCriticalDiscordAlerts`, `batchDiscordAlerts` are not implemented. The canonical Discord path is via DiscordPromotionAgent.
6. **Notion Integration** — `createNotionReport` in OperatorAgent type. No implementation.
7. **Advanced Operator Activities** — 20+ OperatorAgent type methods with no implementation (database optimization, report generation, season management, etc.).

---

## 7. Minimum Viable Fix for GO Status

To transition from **NO-GO** to **GO**, the following must be resolved:

1. **B-1**: Export `gradeNewProps`, `scoreTopTierPicks`, `updateUnifiedPicks`, `getNewUnifiedPicks` from GradingAgent barrel
2. **B-2**: Fix GradingAgent single-writer violation (GradingAgent.ts:757)
3. **B-3**: Fix RecapAgent single-writer violation (RecapAgent/index.ts:693)
4. **B-4**: Fix `sendNotification` name collision
5. **B-16**: Resolve syndicate-scheduler dual implementation

After these 5 fixes, the canonical data flow (ingestion → grading → promotion → posting → settlement) can execute end-to-end.

---

**Generated**: 2026-03-06T20:25:00-05:00
**Sprint**: SPRINT-RUNTIME-TRUTH-AUDIT-035A
**Status**: DRAFT — pending truth decisions TD-1 through TD-7
