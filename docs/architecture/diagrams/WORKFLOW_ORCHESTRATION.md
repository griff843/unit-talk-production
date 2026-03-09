# Workflow Orchestration

Status: CANONICAL Authority: Tier 1 Owner: Platform Architecture Last Verified:
2026-03-07 Sprint: SPRINT-ARCHITECTURE-LOCK-041C

---

## Syndicate Scheduler (Main Orchestration Loop)

```mermaid
flowchart TD
    Scheduler[syndicateSchedulerWorkflow\n60s live · 300s idle]

    subgraph Detection
        LiveDetect[liveGameDetectorWorkflow\n30s live · 5min idle]
    end

    subgraph Ingestion
        LeagueIngestion[leagueIngestionWorkflow]
        NFL[NFL]
        NBA[NBA]
        MLB[MLB]
        NHL[NHL]
        NCAAF[NCAAF]
        NCAAB[NCAAB]
        WNBA[WNBA]
    end

    subgraph Processing
        USP[uspProcessingWorkflow\nQUARANTINED no-op]
        GradingScoring[gradingAndScoringWorkflow]
    end

    subgraph Alerts
        DiscordAlert[discordAlertWorkflow]
    end

    Scheduler --> LiveDetect
    Scheduler --> LeagueIngestion
    LeagueIngestion --> NFL
    LeagueIngestion --> NBA
    LeagueIngestion --> MLB
    LeagueIngestion --> NHL
    LeagueIngestion --> NCAAF
    LeagueIngestion --> NCAAB
    LeagueIngestion --> WNBA

    Scheduler --> USP
    Scheduler --> GradingScoring
    Scheduler --> DiscordAlert

    GradingScoring -- "gradeNewProps\nper league" --> GradeActivity[gradingActivities]
    GradingScoring -- "scoreTopTierPicks" --> GradeActivity
    GradingScoring -- "updateUnifiedPicks" --> GradeActivity

    DiscordAlert -- "getNewUnifiedPicks" --> GradeActivity
    DiscordAlert -- "sendNotification" --> NotifActivity[notificationActivities]
```

**Signals**: `pauseSignal`, `resumeSignal`, `emergencyStopSignal`

---

## Support Workflows (Always-On Background)

```mermaid
flowchart LR
    subgraph Monitoring
        Health[healthMonitoringWorkflow\nevery 2 min]
        Quota[quotaMonitoringWorkflow\nevery 15 min]
    end

    subgraph LeagueSchedules["League Peak Schedules"]
        NFLSched[nflScheduleWorkflow]
        NBASched[nbaScheduleWorkflow]
        MLBSched[mlbScheduleWorkflow]
        NHLSched[nhlScheduleWorkflow]
        NCAAFSched[ncaafScheduleWorkflow]
        NCAABSched[ncaabScheduleWorkflow]
        WNBASched[wnbaScheduleWorkflow]
    end

    Health -- "processAlert" --> AlertAct[alertActivities]
    Health -- "logError" --> OpAct[operatorActivities]
    Quota -- "logError" --> OpAct

    NFLSched -- "fetchFeed" --> FeedAct[feedActivities]
    NBASched -- "fetchFeed" --> FeedAct
    MLBSched -- "fetchFeed" --> FeedAct
    NHLSched -- "fetchFeed" --> FeedAct
    NCAAFSched -- "fetchFeed" --> FeedAct
    NCAABSched -- "fetchFeed" --> FeedAct
    WNBASched -- "fetchFeed" --> FeedAct
```

---

## Recap Workflows

```mermaid
flowchart TD
    Daily[dailyRecapWorkflow\n9 AM daily]
    Weekly[weeklyRecapWorkflow\nMonday 10 AM]
    Monthly[monthlyRecapWorkflow\n1st @ 11 AM]
    Micro[microRecapWorkflow\nevery 1 min]

    Daily -- "triggerDailyRecap" --> RecapAct[recapActivities]
    Weekly -- "triggerWeeklyRecap" --> RecapAct
    Monthly -- "triggerMonthlyRecap" --> RecapAct
    Micro -- "checkMicroRecapTriggers" --> RecapAct
```

---

## Temporal Schedule Registry

| Schedule ID                 | Workflow                        | Interval       | Overlap      |
| --------------------------- | ------------------------------- | -------------- | ------------ |
| `syndicate-main-scheduler`  | syndicateSchedulerWorkflow      | 2 min          | SKIP         |
| `live-game-detector`        | liveGameDetectorWorkflow        | 30 min         | CANCEL_OTHER |
| `api-quota-monitor`         | apiQuotaMonitoringWorkflow      | 5 min          | SKIP         |
| `system-health-monitor`     | systemHealthMonitorWorkflow     | 1 min          | SKIP         |
| `daily-cleanup`             | dailyCleanupWorkflow            | 3 AM daily     | CANCEL_OTHER |
| `weekly-performance-report` | weeklyPerformanceReportWorkflow | Sunday 6 AM    | CANCEL_OTHER |
| `{league}-peak-monitor`     | leaguePeakMonitorWorkflow       | 1 min (season) | SKIP         |
| `recap-daily`               | dailyRecapWorkflow              | 9 AM daily     | SKIP         |
| `recap-weekly`              | weeklyRecapWorkflow             | Monday 10 AM   | SKIP         |
| `recap-monthly`             | monthlyRecapWorkflow            | 1st @ 11 AM    | SKIP         |

---

## Legacy Workflows (Backward Compatibility)

| Workflow                   | Activity                                      | Location             |
| -------------------------- | --------------------------------------------- | -------------------- |
| `analyticsWorkflow`        | `analyticsActivities.runAnalysis`             | `workflows/index.ts` |
| `gradingWorkflow`          | `gradingActivities.gradeSubmission`           | `workflows/index.ts` |
| `alertWorkflow`            | `alertActivities.processAlert`                | `workflows/index.ts` |
| `notificationWorkflow`     | `notificationActivities.sendNotification`     | `workflows/index.ts` |
| `feedWorkflow`             | `feedActivities.fetchFeed`                    | `workflows/index.ts` |
| `operatorWorkflow`         | `operatorActivities.monitorSystem`            | `workflows/index.ts` |
| `auditWorkflow`            | `auditActivities.runAudit`                    | `workflows/index.ts` |
| `playerEnrichmentWorkflow` | `playerEnrichmentActivities.enrichAllPlayers` | `workflows/index.ts` |

---

## Related Documents

- [Workflow Activity Contract](../../governance/WORKFLOW_ACTIVITY_CONTRACT.md)
- [Runtime Component Map](../../system/RUNTIME_COMPONENT_MAP.md)
- [Canonical Runtime Path](../../system/CANONICAL_RUNTIME_PATH.md)
