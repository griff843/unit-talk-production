# ACTIVITY REGISTRATION MATRIX

**Sprint**: SPRINT-RUNTIME-TRUTH-AUDIT-035A
**Date**: 2026-03-06
**Purpose**: Cross-reference every activity across 5 layers to identify registration gaps

---

## Legend

| Layer | Description | Source File |
|-------|-------------|------------|
| L1 | Type contract (interface definition) | `types/activities.ts` |
| L2 | Workflow caller (runtime reference) | `workflows/*.ts` |
| L3 | Class/function implementation | Agent `activities/*.ts` or `activities/*.ts` |
| L4 | Barrel export (what `import *` pulls in) | Agent `activities/index.ts` or module file |
| L5 | Worker registration (spread into worker) | `worker.ts` lines 46-63 |

| Status | Meaning |
|--------|---------|
| **MATCH** | All relevant layers agree |
| **CODE DRIFT** | Implementation exists but not wired to runtime |
| **RUNTIME BROKEN** | Called at runtime but not registered — concrete error evidence |
| **DEAD CODE** | Exported/registered but never called by any workflow |
| **NAME COLLISION** | Multiple sources export same name; later spread wins |
| **TYPE ONLY** | Defined in type contract but no implementation exists |

---

## Worker Registration Order (determines collision winners)

```
worker.ts lines 46-62 — later spreads overwrite earlier:

 1. ...baseActivities              ← agents/BaseAgent/activities.ts
 2. ...healthMonitoringActivities  ← activities/healthMonitoring.ts
 3. ...mainOperatorActivities      ← activities/operator.ts
 4. ...workflowLoggingActivities   ← activities/workflowLogging.ts
 5. ...analyticsActivities         ← agents/AnalyticsAgent/activities/index.ts
 6. ...notificationActivities      ← agents/NotificationAgent/activities/index.ts
 7. ...feedActivities              ← agents/FeedAgent/activities/index.ts
 8. ...auditActivities             ← agents/AuditAgent/activities/index.ts
 9. ...gradingActivities           ← agents/GradingAgent/activities/index.ts
10. ...alertActivities             ← agents/AlertAgent/activities/index.ts
11. ...operatorActivities          ← agents/OperatorAgent/activities/index.ts
12. ...playerEnrichmentActivities  ← agents/PlayerEnrichmentAgent/activities.ts
13. ...recapActivities             ← agents/RecapAgent/activities/index.ts
```

---

## Name Collisions

| Activity Name | Source A (overwritten) | Source B (winner) | Impact |
|--------------|----------------------|-------------------|--------|
| `sendNotification` | NotificationAgent (spread #6) — `sendNotification(params: NotificationPayload)` | AlertAgent (spread #10) — `sendNotification()` (no params, starts full agent) | **CRITICAL**: NotificationAgent's parameterized version silently lost. Any workflow calling `sendNotification` with params gets AlertAgent's no-op version. |
| `logUSPError` | `activities/operator.ts` (spread #3) — returns `{success: boolean}` | OperatorAgent (spread #11) — returns `{success: boolean; message: string}` | **LOW**: Both log the same data. OperatorAgent version has richer response but callers don't use it. |
| `performHealthCheck` | `activities/healthMonitoring.ts` (spread #2) — system-level check | AnalyticsAgent (spread #5) — placeholder stub | **MEDIUM**: healthMonitoring version (system-level) lost. AnalyticsAgent version is a placeholder. |
| `initialize` | BaseAgent (spread #1) — `console.log('Initializing agent')` | GradingAgent (spread #9) — factory function `(config, deps) => impl.initialize.bind(impl)` | **LOW**: Neither is called by runtime workflows. |

---

## Section A: Activities Called by Workflows (Runtime-Critical)

### A1. GradingAgent Activities — syndicate-scheduler.ts + support-workflows.ts

| Activity | L1 Type | L2 Caller | L3 Impl | L4 Barrel | L5 Registered | Status |
|----------|---------|-----------|---------|-----------|---------------|--------|
| `gradeNewProps` | `GradingAgentActivities` | syndicate-scheduler:343, support-workflows:89 | `GradingAgentActivitiesImpl.gradeNewProps()` activities.ts:32 | **NOT EXPORTED** | **NO** | **RUNTIME BROKEN** |
| `scoreTopTierPicks` | `GradingAgentActivities` | syndicate-scheduler:360 | `GradingAgentActivitiesImpl.scoreTopTierPicks()` activities.ts:51 | **NOT EXPORTED** | **NO** | **RUNTIME BROKEN** |
| `updateUnifiedPicks` | `GradingAgentActivities` | syndicate-scheduler:375, support-workflows:106 | `GradingAgentActivitiesImpl.updateUnifiedPicks()` activities.ts:70 | **NOT EXPORTED** | **NO** | **RUNTIME BROKEN** |
| `getNewUnifiedPicks` | `GradingAgentActivities` | syndicate-scheduler:418 | `GradingAgentActivitiesImpl.getNewUnifiedPicks()` activities.ts:84 | **NOT EXPORTED** | **NO** | **RUNTIME BROKEN** |
| `gradeSubmission` | `GradingAgentActivities` | workflows/index.ts:160 (legacy) | `GradingAgentActivitiesImpl.gradeSubmission()` activities.ts:97 | **NOT EXPORTED** | **NO** | **CODE DRIFT** |

**Evidence**: Worker log `2026-03-07T00:38:55.457Z [ERROR] Error while processing ActivityTask.start: Activity function gradeNewProps is not registered on worker`

**Root cause**: `GradingAgent/activities/index.ts` exports 7 factory functions (`gradeProp`, `validateGrade`, `monitorGrading`, `initialize`, `healthCheck`, `validateDependencies`, `createActivities`). These are NOT the activities the workflows call. The workflow-needed activities (`gradeNewProps`, `scoreTopTierPicks`, `updateUnifiedPicks`, `getNewUnifiedPicks`) exist on the class but are never exported.

**Additional issue**: The exported factory functions have signature `(config: BaseAgentConfig, deps: BaseAgentDependencies) => bound_method`. This is incompatible with Temporal's activity calling convention (Temporal passes the workflow-provided params as the first argument). Even if a workflow called `gradeProp({propId, models})`, the factory would receive `{propId, models}` as `config` and `undefined` as `deps`, crashing the constructor.

### A2. FeedAgent Activities — syndicate-scheduler.ts + support-workflows.ts

| Activity | L1 Type | L2 Caller | L3 Impl | L4 Barrel | L5 Registered | Status |
|----------|---------|-----------|---------|-----------|---------------|--------|
| `ingestUnifiedData` | `FeedAgentActivities` | syndicate-scheduler:187 | FeedAgent/activities/index.ts:134 | **YES** | **YES** (spread #7) | **MATCH** |
| `fetchFeed` | `FeedAgentActivities` | support-workflows:81,322,359,394,429,464,499,534,569 | FeedAgent/activities/index.ts:352 | **YES** | **YES** (spread #7) | **MATCH** |
| `getLiveGames` | `FeedAgentActivities` | support-workflows:150 | FeedAgent/activities/index.ts:418 | **YES** | **YES** (spread #7) | **MATCH** |
| `ingestFallbackProps` | `FeedAgentActivities` | syndicate-scheduler:201 | **NO** | **NO** | **NO** | **RUNTIME BROKEN** |
| `deduplicateAndNormalize` | `FeedAgentActivities` | syndicate-scheduler:210 | **NO** | **NO** | **NO** | **RUNTIME BROKEN** |
| `triggerGrading` | `FeedAgentActivities` | syndicate-scheduler:215 | **NO** | **NO** | **NO** | **RUNTIME BROKEN** |
| `ingestOptimalProps` | `FeedAgentActivities` | None | **NO** | **NO** | **NO** | **TYPE ONLY** |
| `deduplicateProps` | `FeedAgentActivities` | None | **NO** | **NO** | **NO** | **TYPE ONLY** |
| `normalizeProps` | `FeedAgentActivities` | None | **NO** | **NO** | **NO** | **TYPE ONLY** |

**Evidence**: `ingestFallbackProps`, `deduplicateAndNormalize`, `triggerGrading` are called by `leagueIngestionWorkflow()` in syndicate-scheduler.ts but have no implementation anywhere. The workflow catches errors via `Promise.allSettled` so these fail silently per cycle.

### A3. AlertAgent Activities — syndicate-scheduler.ts + support-workflows.ts

| Activity | L1 Type | L2 Caller | L3 Impl | L4 Barrel | L5 Registered | Status |
|----------|---------|-----------|---------|-----------|---------------|--------|
| `processAlert` | `AlertAgentActivities` | support-workflows:217,273 | AlertAgent/activities/index.ts:8 | **YES** | **YES** (spread #10) | **MATCH** |
| `detectSteamMovement` | `AlertAgentActivities` | syndicate-scheduler:255 | **NO** | **NO** | **NO** | **RUNTIME BROKEN** |
| `detectLineMovement` | `AlertAgentActivities` | syndicate-scheduler:262 | **NO** | **NO** | **NO** | **RUNTIME BROKEN** |
| `detectHedgeOpportunities` | `AlertAgentActivities` | syndicate-scheduler:269 | **NO** | **NO** | **NO** | **RUNTIME BROKEN** |
| `detectMiddleOpportunities` | `AlertAgentActivities` | syndicate-scheduler:275 | **NO** | **NO** | **NO** | **RUNTIME BROKEN** |
| `detectStaleLines` | `AlertAgentActivities` | syndicate-scheduler:281 | **NO** | **NO** | **NO** | **RUNTIME BROKEN** |
| `detectInjuryImpacts` | `AlertAgentActivities` | syndicate-scheduler:287 | **NO** | **NO** | **NO** | **RUNTIME BROKEN** |
| `detectSuspiciousActivity` | `AlertAgentActivities` | syndicate-scheduler:293 | **NO** | **NO** | **NO** | **RUNTIME BROKEN** |
| `sendQuotaWarning` | `AlertAgentActivities` | None | **NO** | **NO** | **NO** | **TYPE ONLY** |
| `sendQuotaCritical` | `AlertAgentActivities` | None | **NO** | **NO** | **NO** | **TYPE ONLY** |
| `sendHealthAlert` | `AlertAgentActivities` | None | **NO** | **NO** | **NO** | **TYPE ONLY** |
| `sendWeeklyReport` | `AlertAgentActivities` | None | **NO** | **NO** | **NO** | **TYPE ONLY** |
| `checkLeagueOpportunities` | `AlertAgentActivities` | None | **NO** | **NO** | **NO** | **TYPE ONLY** |

**Evidence**: All 7 USP detection activities fail with `Activity function detectSteamMovement is not registered` etc. The `uspProcessingWorkflow()` wraps them in `Promise.allSettled` so failures don't crash the parent workflow, but all USP detection is non-functional.

### A4. NotificationAgent Activities — syndicate-scheduler.ts

| Activity | L1 Type | L2 Caller | L3 Impl | L4 Barrel | L5 Registered | Status |
|----------|---------|-----------|---------|-----------|---------------|--------|
| `sendNotification` | `NotificationAgentActivities` | workflows/index.ts:176 (legacy) | NotificationAgent/activities/index.ts:28 | **YES** | **OVERWRITTEN** by AlertAgent | **NAME COLLISION** |
| `buildPickEmbeds` | `NotificationAgentActivities` | syndicate-scheduler:425 | **NO** | **NO** | **NO** | **RUNTIME BROKEN** |
| `sendCriticalDiscordAlerts` | `NotificationAgentActivities` | syndicate-scheduler:433 | **NO** | **NO** | **NO** | **RUNTIME BROKEN** |
| `batchDiscordAlerts` | `NotificationAgentActivities` | syndicate-scheduler:447 | **NO** | **NO** | **NO** | **RUNTIME BROKEN** |
| `sendDiscordEmbed` | `NotificationAgentActivities` | None | **NO** | **NO** | **NO** | **TYPE ONLY** |

### A5. OperatorAgent Activities — syndicate-scheduler.ts + support-workflows.ts

| Activity | L1 Type | L2 Caller | L3 Impl | L4 Barrel | L5 Registered | Actual Source | Status |
|----------|---------|-----------|---------|-----------|---------------|---------------|--------|
| `updateLiveGameStatus` | `OperatorAgentActivities` | syndicate-scheduler:100, support-workflows:161 | OperatorAgent/activities/index.ts:60 | **YES** | **YES** (spread #11) | OperatorAgent | **MATCH** |
| `handleCriticalError` | `OperatorAgentActivities` | syndicate-scheduler:160 | OperatorAgent/activities/index.ts:30 | **YES** | **YES** (spread #11) | OperatorAgent | **MATCH** |
| `logPerformanceWarning` | `OperatorAgentActivities` | syndicate-scheduler:146 | workflowLogging.ts:102 | **YES** (workflowLogging) | **YES** (spread #4) | workflowLogging | **MATCH** (cross-module) |
| `logFallbackActivation` | `OperatorAgentActivities` | syndicate-scheduler:195 | workflowLogging.ts:141 | **YES** (workflowLogging) | **YES** (spread #4) | workflowLogging | **MATCH** (cross-module) |
| `updateProcessingMetrics` | `OperatorAgentActivities` | syndicate-scheduler:222 | workflowLogging.ts:162 | **YES** (workflowLogging) | **YES** (spread #4) | workflowLogging | **MATCH** (cross-module) |
| `logError` | `OperatorAgentActivities` | syndicate-scheduler:231, support-workflows:various | operator.ts:276 | **YES** (operator.ts) | **YES** (spread #3) | mainOperator | **MATCH** (cross-module) |
| `logUSPError` | `OperatorAgentActivities` | syndicate-scheduler:313 | Both operator.ts:10 AND OperatorAgent/index.ts:98 | **YES** (both) | **YES** (spread #11 wins) | OperatorAgent | **NAME COLLISION** (functional) |
| `logGradingError` | `OperatorAgentActivities` | syndicate-scheduler:389 | workflowLogging.ts:15 | **YES** (workflowLogging) | **YES** (spread #4) | workflowLogging | **MATCH** (cross-module) |
| `logDiscordMetrics` | `OperatorAgentActivities` | syndicate-scheduler:460 | workflowLogging.ts:79 | **YES** (workflowLogging) | **YES** (spread #4) | workflowLogging | **MATCH** (cross-module) |
| `logDiscordError` | `OperatorAgentActivities` | syndicate-scheduler:470 | workflowLogging.ts:48 | **YES** (workflowLogging) | **YES** (spread #4) | workflowLogging | **MATCH** (cross-module) |
| `checkApiQuota` | `OperatorAgentActivities` | support-workflows:201 | **NO** | **NO** | **NO** | — | **RUNTIME BROKEN** |
| `monitorSystem` | `OperatorAgentActivities` | workflows/index.ts:184 (legacy) | OperatorAgent/activities/index.ts:14 | **YES** | **YES** (spread #11) | OperatorAgent | **DEAD CODE** (no active workflow calls it) |

**Evidence**: `checkApiQuota` is called by `quotaMonitoringWorkflow` in support-workflows.ts:201. Worker log shows `Activity function checkApiQuota is not registered` with 879+ failed attempts before workflow was terminated.

**Note**: Many `OperatorAgentActivities` type methods are satisfied by non-agent modules (`workflowLogging.ts`, `operator.ts`). The type contract lists 34 methods but Temporal resolves by function name, not by type — so cross-module satisfaction works at runtime.

### A6. RecapAgent Activities — recap-workflows.ts

| Activity | L1 Type | L2 Caller | L3 Impl | L4 Barrel | L5 Registered | Status |
|----------|---------|-----------|---------|-----------|---------------|--------|
| `triggerDailyRecap` | `RecapActivities` (local) | recap-workflows:79 | RecapAgent/activities/index.ts:19 | **YES** | **YES** (spread #13) | **MATCH** |
| `triggerWeeklyRecap` | `RecapActivities` (local) | recap-workflows:126 | RecapAgent/activities/index.ts:47 | **YES** | **YES** (spread #13) | **MATCH** |
| `triggerMonthlyRecap` | `RecapActivities` (local) | recap-workflows:176 | RecapAgent/activities/index.ts:74 | **YES** | **YES** (spread #13) | **MATCH** |
| `checkMicroRecapTriggers` | `RecapActivities` (local) | recap-workflows:213 | RecapAgent/activities/index.ts:101 | **YES** | **YES** (spread #13) | **MATCH** |

### A7. AnalyticsAgent Activities — analyticsWorkflow.ts

| Activity | L1 Type | L2 Caller | L3 Impl | L4 Barrel | L5 Registered | Status |
|----------|---------|-----------|---------|-----------|---------------|--------|
| `runAnalyticsAgent` | Local inline type | analyticsWorkflow:4 | **NO** (barrel exports `runAnalyticsAgentActivity`) | **NO** (name mismatch) | **NO** | **RUNTIME BROKEN** |
| `runAnalysis` | `AnalyticsAgentActivities` | workflows/index.ts:156 (legacy) | AnalyticsAgent/activities/index.ts:9 | **YES** | **YES** (spread #5) | **DEAD CODE** |
| `runAnalyticsAgentActivity` | None | None | AnalyticsAgent/activities/index.ts:3 | **YES** | **YES** (spread #5) | **DEAD CODE** |

**Evidence**: `analyticsWorkflow.ts` calls `runAnalyticsAgent()` but barrel exports `runAnalyticsAgentActivity`. Name mismatch means the activity is not found at runtime.

---

## Section B: Registered but Not Called (Dead Code)

| Activity | Barrel Source | Registered via | Notes |
|----------|-------------|----------------|-------|
| `gradeProp` | GradingAgent | spread #9 | Factory function — wrong signature for Temporal |
| `validateGrade` | GradingAgent | spread #9 | Factory function — wrong signature for Temporal |
| `monitorGrading` | GradingAgent | spread #9 | Factory function — wrong signature for Temporal |
| `healthCheck` | GradingAgent | spread #9 | Factory function — wrong signature for Temporal |
| `validateDependencies` | GradingAgent | spread #9 | Factory function — wrong signature for Temporal |
| `createActivities` | GradingAgent | spread #9 | Factory function — returns object |
| `evaluateConditions` | AlertAgent | spread #10 | Creates AlertAgent and calls `start()` |
| `escalateAlert` | AlertAgent | spread #10 | Creates AlertAgent and calls `start()` |
| `sendBatchNotifications` | NotificationAgent | spread #6 | Never called by any workflow |
| `sendNotifications` | NotificationAgent | spread #6 | Never called by any workflow |
| `handleAlert` | OperatorAgent | spread #11 | Never called by any workflow |
| `performMaintenance` | OperatorAgent | spread #11 | Never called by any workflow |
| `fetchFromProviderActivity` | FeedAgent | spread #7 | Never called by any workflow |
| `checkQuotaStatus` | FeedAgent | spread #7 | Never called (workflows call `checkApiQuota` — different name) |
| `getProviderHealth` | FeedAgent | spread #7 | Never called by any workflow |
| `performAudit` | AuditAgent | spread #8 | Never called by any workflow |
| `generateReport` | AuditAgent | spread #8 | Never called by any workflow |
| `checkCompliance` | AuditAgent | spread #8 | Never called by any workflow |
| `performSecurityAudit` | AuditAgent | spread #8 | Never called by any workflow |
| `monitorSystemHealth` | healthMonitoring | spread #2 | Never called by any workflow |
| `monitorAPIQuota` | operator.ts | spread #3 | Never called (workflows call `checkApiQuota` — different name) |
| `checkSystemHealth` | operator.ts | spread #3 | Never called by any workflow |
| `detectLiveGames` | operator.ts | spread #3 | Never called (workflows call `getLiveGames` from FeedAgent) |
| `logWorkflowMetrics` | operator.ts | spread #3 | Never called by any workflow |
| `runHealthCheck` | BaseAgent | spread #1 | Never called by any workflow |
| `collectMetrics` | BaseAgent | spread #1 | Never called by any workflow |
| `handleCommand` | BaseAgent | spread #1 | Never called by any workflow |
| `cleanup` | BaseAgent | spread #1 | Never called by any workflow |
| `enrichAllPlayersActivity` | PlayerEnrichment | spread #12 | workflows/index.ts references but workflow disabled |
| `enrichPlayerByIdActivity` | PlayerEnrichment | spread #12 | workflows/index.ts references but workflow disabled |
| `getPlayerHeadshotActivity` | PlayerEnrichment | spread #12 | workflows/index.ts references but workflow disabled |
| `getMlbHeadshotActivity` | PlayerEnrichment | spread #12 | workflows/index.ts references but workflow disabled |
| `getNbaHeadshotActivity` | PlayerEnrichment | spread #12 | workflows/index.ts references but workflow disabled |
| `getNflHeadshotActivity` | PlayerEnrichment | spread #12 | workflows/index.ts references but workflow disabled |
| `getNhlHeadshotActivity` | PlayerEnrichment | spread #12 | workflows/index.ts references but workflow disabled |

---

## Section C: Type-Only (defined in `types/activities.ts`, never implemented)

| Activity | Interface | Notes |
|----------|-----------|-------|
| `ingestOptimalProps` | `FeedAgentActivities` | No implementation anywhere |
| `deduplicateProps` | `FeedAgentActivities` | No implementation anywhere |
| `normalizeProps` | `FeedAgentActivities` | No implementation anywhere |
| `sendQuotaWarning` | `AlertAgentActivities` | No implementation anywhere |
| `sendQuotaCritical` | `AlertAgentActivities` | No implementation anywhere |
| `sendHealthAlert` | `AlertAgentActivities` | No implementation anywhere |
| `sendWeeklyReport` | `AlertAgentActivities` | No implementation anywhere |
| `checkLeagueOpportunities` | `AlertAgentActivities` | No implementation anywhere |
| `sendDiscordEmbed` | `NotificationAgentActivities` | No implementation anywhere |
| `ensureLiveMode` | `OperatorAgentActivities` | No implementation anywhere |
| `ensureOffPeakMode` | `OperatorAgentActivities` | No implementation anywhere |
| `getHourlyApiUsage` | `OperatorAgentActivities` | No implementation anywhere |
| `activateFallbackMode` | `OperatorAgentActivities` | No implementation anywhere |
| `logQuotaStatus` | `OperatorAgentActivities` | No implementation anywhere |
| `checkDatabaseHealth` | `OperatorAgentActivities` | No implementation anywhere |
| `checkApiEndpoints` | `OperatorAgentActivities` | No implementation anywhere |
| `getWorkflowMetrics` | `OperatorAgentActivities` | No implementation anywhere |
| `getSystemMetrics` | `OperatorAgentActivities` | No implementation anywhere |
| `logHealthStatus` | `OperatorAgentActivities` | No implementation anywhere |
| `checkLeagueSeason` | `OperatorAgentActivities` | No implementation anywhere |
| `enablePeakMonitoring` | `OperatorAgentActivities` | No implementation anywhere |
| `enableStandardMonitoring` | `OperatorAgentActivities` | No implementation anywhere |
| `cleanupOldLogs` | `OperatorAgentActivities` | No implementation anywhere |
| `cleanupOldMetrics` | `OperatorAgentActivities` | No implementation anywhere |
| `cleanupOldRawProps` | `OperatorAgentActivities` | No implementation anywhere |
| `optimizeDatabase` | `OperatorAgentActivities` | No implementation anywhere |
| `generateDailySummary` | `OperatorAgentActivities` | No implementation anywhere |
| `generateWeeklyReport` | `OperatorAgentActivities` | No implementation anywhere |
| `createNotionReport` | `OperatorAgentActivities` | No implementation anywhere |
| `logCriticalAlert` | `OperatorAgentActivities` | No implementation anywhere |
| `handleIngestionFailures` | `OperatorAgentActivities` | No implementation anywhere |
| `createCampaign` | `CampaignAgentActivities` | ARCHIVED agent — type should be removed |
| `createContest` | `ContestAgentActivities` | ARCHIVED agent — type should be removed |

---

## Section D: Archived Agent Types Still in Contract

| Interface | Agent | Status |
|-----------|-------|--------|
| `CampaignAgentActivities` | CampaignAgent | ARCHIVED to `_archived/` per SPRINT-REPO-TRUTH-LOCK-002 |
| `ContestAgentActivities` | ContestAgent | ARCHIVED to `_archived/` per SPRINT-REPO-TRUTH-LOCK-002 |

Both are still referenced in `workflows/index.ts` lines 18-19 and have proxy objects created (lines 54-60).

---

## Summary Statistics

| Category | Count |
|----------|-------|
| Activities called by workflows (runtime-critical) | 39 unique |
| MATCH (registered and functional) | 16 |
| RUNTIME BROKEN (called but not registered) | 19 |
| NAME COLLISION (registered but wrong version) | 1 (`sendNotification`) |
| CODE DRIFT (exists but not wired) | 1 (`gradeSubmission`) |
| DEAD CODE (registered, never called) | 35 |
| TYPE ONLY (interface, no implementation) | 33 |

**Pipeline impact**: 19 out of 39 runtime-critical activities are BROKEN. The entire grading pipeline (4 activities), all USP detection (7 activities), all Discord notification (3 activities), and several FeedAgent data processing steps (3 activities) are non-functional.

---

**Generated**: 2026-03-06T20:00:00-05:00
**Sprint**: SPRINT-RUNTIME-TRUTH-AUDIT-035A
