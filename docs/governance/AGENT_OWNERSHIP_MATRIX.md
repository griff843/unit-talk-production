# Agent Ownership Matrix

Status: CANONICAL Authority: Tier 1 Owner: Platform Architecture Last Verified:
2026-03-07 Sprint: SPRINT-DOCS-CANONICALIZATION-040

---

## Overview

Unit Talk runs 15 active agents on a single Temporal worker. Each agent owns a
bounded domain — data ingestion, scoring, distribution, settlement, or
operations. All agent activities are registered via spread into the worker's
activity object.

---

## Active Agents

| #   | Agent                 | Directory                       | Worker Position | Domain                                  |
| --- | --------------------- | ------------------------------- | --------------- | --------------------------------------- |
| 1   | BaseAgent             | `agents/BaseAgent/`             | 1               | Framework base class (abstract)         |
| 2   | FeedAgent             | `agents/FeedAgent/`             | 3               | Data ingestion & provider routing       |
| 3   | GradingAgent          | `agents/GradingAgent/`          | 5               | Scoring, grading, promotion             |
| 4   | AlertAgent            | `agents/AlertAgent/`            | 6               | Alert evaluation & escalation           |
| 5   | OperatorAgent         | `agents/OperatorAgent/`         | 7               | System monitoring & maintenance         |
| 6   | PlayerEnrichmentAgent | `agents/PlayerEnrichmentAgent/` | 8               | Player metadata & headshots             |
| 7   | RecapAgent            | `agents/RecapAgent/`            | 9               | Daily/weekly/monthly recaps             |
| 8   | NotificationAgent     | `agents/NotificationAgent/`     | 2               | Discord & notification delivery         |
| 9   | AnalyticsAgent        | `agents/AnalyticsAgent/`        | 2               | Analytics & reporting                   |
| 10  | AuditAgent            | `agents/AuditAgent/`            | 4               | Compliance & audit logging              |
| 11  | DiscordPromotionAgent | `agents/DiscordPromotionAgent/` | —               | Discord posting via pick_publish outbox |
| 12  | SettlementAgent       | `agents/SettlementAgent/`       | —               | Settlement via lifecycle adapters       |
| 13  | IngestionAgent        | `agents/IngestionAgent/`        | —               | Raw prop ingestion                      |
| 14  | ScoringAgent          | `agents/ScoringAgent/`          | —               | Real-time edge scoring                  |
| 15  | DataAgent             | `agents/DataAgent/`             | —               | ETL, enrichment, quality checks         |

**Note**: Agents without a worker position are invoked directly by other agents
or workflows, not via `proxyActivities`.

---

## Activity Barrel Exports

### Position 1: Base & Infrastructure

| Module                       | Source                           | Key Activities                                                                    |
| ---------------------------- | -------------------------------- | --------------------------------------------------------------------------------- |
| `baseActivities`             | `agents/BaseAgent/activities.ts` | initialize, healthCheck, collectMetrics                                           |
| `healthMonitoringActivities` | `activities/healthMonitoring.ts` | performHealthCheck, monitorSystemHealth                                           |
| `mainOperatorActivities`     | `activities/operator.ts`         | logError, monitorAPIQuota, checkSystemHealth, detectLiveGames, logWorkflowMetrics |
| `workflowLoggingActivities`  | `activities/workflowLogging.ts`  | logWorkflowStart, logWorkflowEnd                                                  |

### Position 2: Analytics & Notifications

| Module                   | Source                                         | Key Activities                                              |
| ------------------------ | ---------------------------------------------- | ----------------------------------------------------------- |
| `analyticsActivities`    | `agents/AnalyticsAgent/activities/index.ts`    | runAnalyticsAgent, runAnalysis, performAnalyticsHealthCheck |
| `notificationActivities` | `agents/NotificationAgent/activities/index.ts` | sendNotification, sendBatchNotifications                    |

### Position 3: Feed

| Module           | Source                                 | Key Activities                                               |
| ---------------- | -------------------------------------- | ------------------------------------------------------------ |
| `feedActivities` | `agents/FeedAgent/activities/index.ts` | ingestUnifiedData, fetchFeed, getLiveGames, checkQuotaStatus |

### Position 4: Audit

| Module            | Source                                  | Key Activities                         |
| ----------------- | --------------------------------------- | -------------------------------------- |
| `auditActivities` | `agents/AuditAgent/activities/index.ts` | performAudit, generateReport, runAudit |

### Position 5: Grading

| Module              | Source                                    | Key Activities                                                           |
| ------------------- | ----------------------------------------- | ------------------------------------------------------------------------ |
| `gradingActivities` | `agents/GradingAgent/activities/index.ts` | gradeNewProps, scoreTopTierPicks, updateUnifiedPicks, getNewUnifiedPicks |

### Position 6: Alert

| Module            | Source                                  | Key Activities                                                         |
| ----------------- | --------------------------------------- | ---------------------------------------------------------------------- |
| `alertActivities` | `agents/AlertAgent/activities/index.ts` | processAlert, evaluateConditions, sendAlertNotification, escalateAlert |

### Position 7: Operator

| Module               | Source                                     | Key Activities                                                                                         |
| -------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `operatorActivities` | `agents/OperatorAgent/activities/index.ts` | monitorSystem, handleAlert, performMaintenance, handleCriticalError, updateLiveGameStatus, logUSPError |

### Position 8: Player Enrichment

| Module                       | Source                                             | Key Activities                                                                                     |
| ---------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `playerEnrichmentActivities` | `agents/PlayerEnrichmentAgent/activities/index.ts` | enrichAllPlayers, enrichPlayerById, getMlbHeadshot, getNbaHeadshot, getNflHeadshot, getNhlHeadshot |

### Position 9: Recap

| Module            | Source                                  | Key Activities                                                 |
| ----------------- | --------------------------------------- | -------------------------------------------------------------- |
| `recapActivities` | `agents/RecapAgent/activities/index.ts` | triggerDailyRecap, triggerWeeklyRecap, checkMicroRecapTriggers |

---

## Writer Authority

Agents that write to canonical tables must use lifecycle adapters:

| Agent                 | Table           | Lifecycle Adapter                   | Writer Role |
| --------------------- | --------------- | ----------------------------------- | ----------- |
| GradingAgent          | `unified_picks` | `lifecycleInsert`                   | `promoter`  |
| DiscordPromotionAgent | `unified_picks` | `atomicClaimForPost`                | `poster`    |
| RecapAgent            | `unified_picks` | `lifecycleUpdate`                   | `poster`    |
| SettlementAgent       | `unified_picks` | `lifecycleSettle`                   | `settler`   |
| Smart Form (bridge)   | `bridge_outbox` | Direct insert (non-canonical table) | —           |

---

## Collision Map

Later spread positions overwrite earlier ones on name collision:

| Activity Name | Position 1 (loses)     | Position 7 (wins)  | Impact                   |
| ------------- | ---------------------- | ------------------ | ------------------------ |
| `logUSPError` | mainOperatorActivities | operatorActivities | Benign — both log errors |

**Resolved collisions** (SPRINT-035A):

- `sendNotification`: AlertAgent renamed to `sendAlertNotification`
- `performHealthCheck`: AnalyticsAgent renamed to `performAnalyticsHealthCheck`
- `initialize`: GradingAgent no longer exports it

---

## Archived Agents

14 agents archived to `agents/_archived/` (SPRINT-REPO-TRUTH-LOCK-002):

| Agent                        | Reason                                                |
| ---------------------------- | ----------------------------------------------------- |
| AutomatedOnboardingAgent     | Experimental onboarding flows                         |
| CampaignAgent                | Campaign management — types removed from contract     |
| ContestAgent                 | Contest management — types removed from contract      |
| DataLifecycleAgent           | Data lifecycle stub                                   |
| EligibilityAgent             | Promotion eligibility (superseded by promotionPolicy) |
| FeedbackLoopAgent            | Feedback loop processing                              |
| MarketingAgent               | Marketing campaigns                                   |
| PerformanceOptimizationAgent | System optimization                                   |
| PredictiveAnalyticsAgent     | Predictive modeling                                   |
| ProjectionAgent              | Player projections                                    |
| ReferralAgent                | Referral program                                      |
| RiskManagementAgent          | Risk portfolio optimization                           |
| UserRetentionAgent           | User retention strategies                             |
| V3ScoringAdapter             | V3 scoring adapter (superseded)                       |

---

## Data Flow

```
FeedAgent (ingest from providers)
    |
    v
GradingAgent (score + promote)
    |
    v
DiscordPromotionAgent (post to Discord)
    |-- AlertAgent (concurrent alerts)
    |-- NotificationAgent (concurrent notifications)
    |-- RecapAgent (post-settlement recaps)
    |-- AnalyticsAgent (post-settlement analytics)
    |
    v
SettlementAgent (settle against outcomes)
    |
    v
AuditAgent (compliance logging)
    |
    v
OperatorAgent (system monitoring)
```

---

## Related Documents

- [Workflow Activity Contract](./WORKFLOW_ACTIVITY_CONTRACT.md)
- [Canonical Runtime Path](../system/CANONICAL_RUNTIME_PATH.md)
- [Agent Registry](../../apps/api/AGENT_REGISTRY.md)
- [Type Contract](../../apps/api/src/types/activities.ts)
