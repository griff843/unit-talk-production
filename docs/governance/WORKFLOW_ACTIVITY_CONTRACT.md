# Workflow-Activity Contract

Status: CANONICAL Authority: Tier 1 Owner: Platform Architecture Last Verified:
2026-03-07 Sprint: SPRINT-DOCS-CANONICALIZATION-040

---

## Overview

Every Temporal workflow calls activities via `proxyActivities<T>()`. Every
activity called must be registered on the worker. This document is the binding
contract between workflows, activities, and worker registration.

---

## Production Workflows

### syndicateSchedulerWorkflow (Master Orchestrator)

**File**: `apps/api/src/workflows/syndicate-scheduler.ts` **Cycle**: 1 min
(live) / 5 min (idle) **Signals**: `pauseSignal`, `resumeSignal`,
`emergencyStopSignal`

| Sub-Workflow                | Activities Called                                                                 | Timeout | Retries |
| --------------------------- | --------------------------------------------------------------------------------- | ------- | ------- |
| `leagueIngestionWorkflow`   | `feedActivities.ingestUnifiedData`                                                | 90s     | 3       |
| `gradingAndScoringWorkflow` | `gradingActivities.gradeNewProps`, `.scoreTopTierPicks`, `.updateUnifiedPicks`    | 60s     | 3       |
| `discordAlertWorkflow`      | `gradingActivities.getNewUnifiedPicks`, `notificationActivities.sendNotification` | 30s     | 2       |
| `uspProcessingWorkflow`     | (no-op — quarantined TD-6)                                                        | —       | —       |
| Error handling              | `operatorActivities.logError`                                                     | 30s     | 2       |
| Live game status            | `operatorActivities.updateLiveGameStatus`                                         | 30s     | 2       |

### Support Workflows

| Workflow                   | File                   | Activities                                                                                              | Interval                 |
| -------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------ |
| `liveGameDetectorWorkflow` | `support-workflows.ts` | `feedActivities.getLiveGames`, `operatorActivities.updateLiveGameStatus`, `operatorActivities.logError` | 30s (live) / 5min (idle) |
| `quotaMonitoringWorkflow`  | `support-workflows.ts` | `operatorActivities.logError`                                                                           | 15 min                   |
| `healthMonitoringWorkflow` | `support-workflows.ts` | `alertActivities.processAlert`, `operatorActivities.logError`                                           | 2 min                    |
| `nflScheduleWorkflow`      | `support-workflows.ts` | `feedActivities.fetchFeed`, `operatorActivities.logError`                                               | 30s/5min                 |
| `nbaScheduleWorkflow`      | `support-workflows.ts` | `feedActivities.fetchFeed`, `operatorActivities.logError`                                               | 30s/5min                 |
| `mlbScheduleWorkflow`      | `support-workflows.ts` | `feedActivities.fetchFeed`, `operatorActivities.logError`                                               | 30s/5min                 |
| `nhlScheduleWorkflow`      | `support-workflows.ts` | `feedActivities.fetchFeed`, `operatorActivities.logError`                                               | 30s/5min                 |
| `ncaafScheduleWorkflow`    | `support-workflows.ts` | `feedActivities.fetchFeed`, `operatorActivities.logError`                                               | 30s/5min                 |
| `ncaabScheduleWorkflow`    | `support-workflows.ts` | `feedActivities.fetchFeed`, `operatorActivities.logError`                                               | 30s/5min                 |
| `wnbaScheduleWorkflow`     | `support-workflows.ts` | `feedActivities.fetchFeed`, `operatorActivities.logError`                                               | 30s/5min                 |

### Legacy Workflows

| Workflow               | File       | Activity                                |
| ---------------------- | ---------- | --------------------------------------- |
| `analyticsWorkflow`    | `index.ts` | `analytics.runAnalysis()`               |
| `gradingWorkflow`      | `index.ts` | `grading.gradeSubmission(params)`       |
| `alertWorkflow`        | `index.ts` | `alert.processAlert(params)`            |
| `notificationWorkflow` | `index.ts` | `notification.sendNotification(params)` |
| `feedWorkflow`         | `index.ts` | `feed.fetchFeed(params)`                |
| `operatorWorkflow`     | `index.ts` | `operator.monitorSystem()`              |
| `auditWorkflow`        | `index.ts` | `audit.runAudit(params)`                |

---

## Activity Registration (worker.ts)

Activities are registered via spread into the worker's activity object. Later
positions overwrite earlier ones on name collision.

| Spread Position | Module                     | Source File                                        |
| --------------- | -------------------------- | -------------------------------------------------- |
| 1               | baseActivities             | `agents/BaseAgent/activities.ts`                   |
| 1               | healthMonitoringActivities | `activities/healthMonitoring.ts`                   |
| 1               | mainOperatorActivities     | `activities/operator.ts`                           |
| 1               | workflowLoggingActivities  | `activities/workflowLogging.ts`                    |
| 2               | analyticsActivities        | `agents/AnalyticsAgent/activities/index.ts`        |
| 2               | notificationActivities     | `agents/NotificationAgent/activities/index.ts`     |
| 3               | feedActivities             | `agents/FeedAgent/activities/index.ts`             |
| 4               | auditActivities            | `agents/AuditAgent/activities/index.ts`            |
| 5               | gradingActivities          | `agents/GradingAgent/activities/index.ts`          |
| 6               | alertActivities            | `agents/AlertAgent/activities/index.ts`            |
| 7               | operatorActivities         | `agents/OperatorAgent/activities/index.ts`         |
| 8               | playerEnrichmentActivities | `agents/PlayerEnrichmentAgent/activities/index.ts` |
| 9               | recapActivities            | `agents/RecapAgent/activities/index.ts`            |

## Type Contract

All activity interfaces are defined in `apps/api/src/types/activities.ts`. Every
method in the type contract has a matching export in the corresponding barrel
file.

---

## Invariants

1. **No phantom activities**: Every activity called by a workflow MUST be
   exported by a registered barrel
2. **No harmful collisions**: If two barrels export the same name, the collision
   must be benign (same behavior)
3. **Type contract matches runtime**: `types/activities.ts` must only contain
   methods that actually exist
4. **Timeout enforcement**: All activity proxies must specify
   `startToCloseTimeout`

---

## Related Documents

- [Canonical Runtime Path](../system/CANONICAL_RUNTIME_PATH.md)
- [Type Contract](../../apps/api/src/types/activities.ts)
- [Worker Registration](../../apps/api/src/worker.ts)
