# Runtime Component Map

Status: CANONICAL Authority: Tier 1 Owner: Platform Architecture Last Verified:
2026-03-08 Sprint: SPRINT-044H

---

## Section 1 — System Services

### Service: API

- **Location**: `apps/api`
- **Role**: Backend API server, agent orchestration, lifecycle enforcement,
  canonical writer for all business tables
- **Port**: 3010 (external) → 3000 (internal)
- **Entry Points**: `src/api-server.ts` (Express), `src/worker.ts` (Temporal
  worker)
- **Dependencies**: Supabase, Redis, Temporal, Discord API, Odds API, Optimal
  API, OpenAI

### Service: Workers

- **Location**: `apps/api` (same codebase, separate Docker container)
- **Role**: Temporal worker executing all registered activities
- **Entry Point**: `npm run worker:dev`
- **Dependencies**: Supabase, Redis, Temporal
- **Note**: There is no separate `apps/worker` directory. The worker runs from
  `apps/api/src/worker.ts` in a dedicated container.

### Service: Smart Form

- **Location**: `apps/smart-form`
- **Role**: Ticket submission UI. Writes ONLY to `bridge_outbox` table.
- **Port**: 3021
- **Framework**: Next.js 14
- **Dependencies**: Supabase (anon key only)

### Service: Command Center

- **Location**: `apps/command-center`
- **Role**: Operations monitoring dashboard (READ-ONLY)
- **Port**: 3004 (external) → 3015 (internal)
- **Framework**: Next.js 14
- **Dependencies**: Supabase (anon key), Redis, Temporal client

### Service: Dashboard

- **Location**: `apps/dashboard`
- **Role**: Analytics frontend (READ-ONLY)
- **Port**: 3003
- **Framework**: Next.js 14
- **Dependencies**: Supabase (anon key)

### Service: Discord Bot

- **Location**: `apps/discord-bot`
- **Role**: Discord slash commands, tier system, user onboarding
- **Framework**: discord.js 14
- **Dependencies**: Discord API, Supabase (anon key), API service
  (http://api:3000)

### Infrastructure: Temporal

- **Port**: 7233 (server), 8088 (UI)
- **Image**: `temporalio/auto-setup:1.20.0`
- **Role**: Workflow orchestration, activity scheduling, signal handling
- **Database**: Dedicated PostgreSQL instance (internal)

### Infrastructure: Redis

- **Port**: 6379
- **Image**: `redis:7-alpine`
- **Role**: Caching (props, picks, health), autopilot freeze state, rate
  limiting
- **Config**: appendonly, 512MB max, allkeys-lru eviction
- **Fallback**: In-memory Map if Redis unavailable (fail-open for cache)

### Infrastructure: Supabase (Cloud)

- **Role**: Primary PostgreSQL database
- **Access**: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (API), anon key
  (frontends)
- **Local mode**: `DB_MODE=local` uses Docker PostgreSQL on port 5432

### Infrastructure: Prometheus

- **Port**: 9090
- **Role**: Metrics collection from API and workers
- **Retention**: 200 hours

### Infrastructure: Grafana

- **Port**: 3001
- **Role**: Dashboards and alerting
- **Credentials**: admin/admin (default)

---

## Section 2 — Agents

### Active Agents (Registered on Temporal Worker)

| Agent                 | Location                        | Primary Responsibility                        | Tables Written                               | Worker Position |
| --------------------- | ------------------------------- | --------------------------------------------- | -------------------------------------------- | --------------- |
| BaseAgent             | `agents/BaseAgent/`             | Framework base class (abstract)               | None                                         | 1               |
| FeedAgent             | `agents/FeedAgent/`             | Data ingestion via DataSourceRouter           | `raw_props`, `games`                         | 3               |
| GradingAgent          | `agents/GradingAgent/`          | Scoring, grading, promotion to unified_picks  | `unified_picks` (via lifecycle)              | 5               |
| AlertAgent            | `agents/AlertAgent/`            | Alert evaluation, escalation, Discord alerts  | None (notifications only)                    | 6               |
| OperatorAgent         | `agents/OperatorAgent/`         | System monitoring, maintenance, error logging | `agent_health`                               | 7               |
| PlayerEnrichmentAgent | `agents/PlayerEnrichmentAgent/` | Player metadata and headshot enrichment       | `participants`                               | 8               |
| RecapAgent            | `agents/RecapAgent/`            | Daily/weekly/monthly recap generation         | `unified_picks` (via lifecycle, poster role) | 9               |
| NotificationAgent     | `agents/NotificationAgent/`     | Discord and notification delivery             | None (delivery only)                         | 2               |
| AnalyticsAgent        | `agents/AnalyticsAgent/`        | Analytics and reporting                       | None (read-only analysis)                    | 2               |
| AuditAgent            | `agents/AuditAgent/`            | Compliance and audit logging                  | None (logging only)                          | 4               |

### Active Agents (Not on Worker Spread)

| Agent                 | Location                        | Primary Responsibility                    | Tables Written                                                             |
| --------------------- | ------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------- |
| DiscordPromotionAgent | `agents/DiscordPromotionAgent/` | Discord posting via pick_publish outbox   | `unified_picks` (via atomicClaimForPost), `pick_publish`                   |
| SettlementAgent       | `agents/SettlementAgent/`       | Settlement against real outcomes          | `unified_picks` (via lifecycleSettle), `prop_settlements`, `prop_outcomes` |
| IngestionAgent        | `agents/IngestionAgent/`        | V3 canonical ingestion to provider_offers | `provider_offers` (via `upsert_provider_offers_bootstrap` RPC)             |
| ScoringAgent          | `agents/ScoringAgent/`          | Real-time edge scoring                    | None (computation only)                                                    |
| DataAgent             | `agents/DataAgent/`             | ETL, enrichment, quality checks           | `player_game_stats`                                                        |

### Infrastructure Activities (Not Agent Classes)

| Module                     | Location                         | Purpose                                              | Worker Position |
| -------------------------- | -------------------------------- | ---------------------------------------------------- | --------------- |
| healthMonitoringActivities | `activities/healthMonitoring.ts` | System health checks                                 | 1               |
| mainOperatorActivities     | `activities/operator.ts`         | Error logging, quota monitoring, live game detection | 1               |
| workflowLoggingActivities  | `activities/workflowLogging.ts`  | Workflow start/end logging                           | 1               |

### Archived Agents (14 total in `agents/_archived/`)

AutomatedOnboardingAgent, CampaignAgent, ContestAgent, DataLifecycleAgent,
EligibilityAgent, FeedbackLoopAgent, MarketingAgent,
PerformanceOptimizationAgent, PredictiveAnalyticsAgent, ProjectionAgent,
ReferralAgent, RiskManagementAgent, UserRetentionAgent, V3ScoringAdapter

---

## Section 3 — Workflows

### Core Orchestration

| Workflow                     | Location                           | Trigger                         | Activities Used                                                                                                                                                                                                      | Timing                   |
| ---------------------------- | ---------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `syndicateSchedulerWorkflow` | `workflows/syndicate-scheduler.ts` | Temporal schedule (every 2 min) | feedActivities.ingestUnifiedData, gradingActivities.gradeNewProps/scoreTopTierPicks/updateUnifiedPicks/getNewUnifiedPicks, notificationActivities.sendNotification, operatorActivities.logError/updateLiveGameStatus | 60s (live) / 300s (idle) |
| `leagueIngestionWorkflow`    | `workflows/syndicate-scheduler.ts` | Child of syndicateScheduler     | feedActivities.ingestUnifiedData                                                                                                                                                                                     | Per-league parallel      |
| `gradingAndScoringWorkflow`  | `workflows/syndicate-scheduler.ts` | Child of syndicateScheduler     | gradingActivities.gradeNewProps/scoreTopTierPicks/updateUnifiedPicks                                                                                                                                                 | Per-cycle                |
| `discordAlertWorkflow`       | `workflows/syndicate-scheduler.ts` | Child of syndicateScheduler     | gradingActivities.getNewUnifiedPicks, notificationActivities.sendNotification                                                                                                                                        | Per-cycle                |
| `uspProcessingWorkflow`      | `workflows/syndicate-scheduler.ts` | Child of syndicateScheduler     | None (quarantined — TD-6, SPRINT-035B)                                                                                                                                                                               | No-op                    |

**Signals**: `pauseSignal`, `resumeSignal`, `emergencyStopSignal`

### Support/Background Workflows

| Workflow                   | Location                         | Trigger           | Activities Used                                                               | Timing                   |
| -------------------------- | -------------------------------- | ----------------- | ----------------------------------------------------------------------------- | ------------------------ |
| `liveGameDetectorWorkflow` | `workflows/support-workflows.ts` | Temporal schedule | feedActivities.getLiveGames, operatorActivities.updateLiveGameStatus/logError | 30s (live) / 5min (idle) |
| `quotaMonitoringWorkflow`  | `workflows/support-workflows.ts` | Temporal schedule | operatorActivities.logError                                                   | 15 min heartbeat         |
| `healthMonitoringWorkflow` | `workflows/support-workflows.ts` | Temporal schedule | alertActivities.processAlert, operatorActivities.logError                     | 2 min                    |
| `nflScheduleWorkflow`      | `workflows/support-workflows.ts` | Temporal schedule | feedActivities.fetchFeed, operatorActivities.logError                         | 30s peak / 5min off-peak |
| `nbaScheduleWorkflow`      | `workflows/support-workflows.ts` | Temporal schedule | feedActivities.fetchFeed, operatorActivities.logError                         | 30s peak / 5min off-peak |
| `mlbScheduleWorkflow`      | `workflows/support-workflows.ts` | Temporal schedule | feedActivities.fetchFeed, operatorActivities.logError                         | 30s peak / 5min off-peak |
| `nhlScheduleWorkflow`      | `workflows/support-workflows.ts` | Temporal schedule | feedActivities.fetchFeed, operatorActivities.logError                         | 30s peak / 5min off-peak |
| `ncaafScheduleWorkflow`    | `workflows/support-workflows.ts` | Temporal schedule | feedActivities.fetchFeed, operatorActivities.logError                         | 30s peak / 5min off-peak |
| `ncaabScheduleWorkflow`    | `workflows/support-workflows.ts` | Temporal schedule | feedActivities.fetchFeed, operatorActivities.logError                         | 30s peak / 5min off-peak |
| `wnbaScheduleWorkflow`     | `workflows/support-workflows.ts` | Temporal schedule | feedActivities.fetchFeed, operatorActivities.logError                         | 30s peak / 5min off-peak |

### Recap Workflows

| Workflow                | Location                       | Trigger                    | Activities Used                         | Timing                 |
| ----------------------- | ------------------------------ | -------------------------- | --------------------------------------- | ---------------------- |
| `dailyRecapWorkflow`    | `workflows/recap-workflows.ts` | Temporal schedule / signal | recapActivities.triggerDailyRecap       | 9:00 AM daily          |
| `weeklyRecapWorkflow`   | `workflows/recap-workflows.ts` | Temporal schedule / signal | recapActivities.triggerWeeklyRecap      | Monday 10:00 AM        |
| `monthlyRecapWorkflow`  | `workflows/recap-workflows.ts` | Temporal schedule / signal | recapActivities.triggerMonthlyRecap     | 1st of month 11:00 AM  |
| `microRecapWorkflow`    | `workflows/recap-workflows.ts` | Continuous                 | recapActivities.checkMicroRecapTriggers | Every 1 min (cooldown) |
| `combinedRecapWorkflow` | `workflows/recap-workflows.ts` | On-demand                  | All recap activities (children)         | Parallel               |

### Smart Form Workflows

| Workflow                         | Location                         | Trigger           | Activities Used            | Timing             |
| -------------------------------- | -------------------------------- | ----------------- | -------------------------- | ------------------ |
| `smartFormDailyBatchWorkflow`    | `workflows/smartFormWorkflow.ts` | Temporal schedule | Placeholder implementation | 10:00 AM EST daily |
| `smartFormLivePickWorkflow`      | `workflows/smartFormWorkflow.ts` | On-demand         | Placeholder implementation | On-demand          |
| `smartFormHealthMonitorWorkflow` | `workflows/smartFormWorkflow.ts` | Temporal schedule | Placeholder implementation | Every 5 min        |

### Event-Driven Grading

| Workflow                     | Location                                   | Trigger                     | Activities Used                                   | Timing             |
| ---------------------------- | ------------------------------------------ | --------------------------- | ------------------------------------------------- | ------------------ |
| `eventDrivenGradingWorkflow` | `workflows/event-driven-grading-simple.ts` | On-demand (per bet_slip_id) | Internal functions (circuit breaker, idempotency) | On-demand          |
| `replayGradingWorkflow`      | `workflows/event-driven-grading-simple.ts` | On-demand                   | eventDrivenGradingWorkflow (child)                | Batch              |
| `reemitAlertsWorkflow`       | `workflows/event-driven-grading-simple.ts` | On-demand                   | Internal                                          | Operator-initiated |

### Backfill & Recovery

| Workflow                    | Location                                 | Trigger   | Activities Used                                                                                                            | Timing      |
| --------------------------- | ---------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `FeedAgentBackfillWorkflow` | `workflows/FeedAgentBackfillWorkflow.ts` | On-demand | backfillPropsForHour, triggerProcessor, triggerPromoter, validateBackfillRequest, checkIdempotency, recordBackfillProgress | Per request |

### Legacy Workflows (Backward Compatibility)

| Workflow                   | Location             | Activities Used                             |
| -------------------------- | -------------------- | ------------------------------------------- |
| `analyticsWorkflow`        | `workflows/index.ts` | analyticsActivities.runAnalysis             |
| `gradingWorkflow`          | `workflows/index.ts` | gradingActivities.gradeSubmission           |
| `alertWorkflow`            | `workflows/index.ts` | alertActivities.processAlert                |
| `notificationWorkflow`     | `workflows/index.ts` | notificationActivities.sendNotification     |
| `feedWorkflow`             | `workflows/index.ts` | feedActivities.fetchFeed                    |
| `operatorWorkflow`         | `workflows/index.ts` | operatorActivities.monitorSystem            |
| `auditWorkflow`            | `workflows/index.ts` | auditActivities.runAudit                    |
| `playerEnrichmentWorkflow` | `workflows/index.ts` | playerEnrichmentActivities.enrichAllPlayers |

---

## Section 4 — Activity Registry

### Worker Registration Order (`apps/api/src/worker.ts`)

Activities are registered via object spread. Later positions overwrite earlier
ones on name collision.

| Position | Module                     | Source                                             | Key Activities                                                                                         |
| -------- | -------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1        | baseActivities             | `agents/BaseAgent/activities.ts`                   | initialize, healthCheck, collectMetrics                                                                |
| 1        | healthMonitoringActivities | `activities/healthMonitoring.ts`                   | performHealthCheck, monitorSystemHealth                                                                |
| 1        | mainOperatorActivities     | `activities/operator.ts`                           | logError, monitorAPIQuota, checkSystemHealth, detectLiveGames, logWorkflowMetrics                      |
| 1        | workflowLoggingActivities  | `activities/workflowLogging.ts`                    | logWorkflowStart, logWorkflowEnd                                                                       |
| 2        | analyticsActivities        | `agents/AnalyticsAgent/activities/index.ts`        | runAnalyticsAgent, runAnalysis, performAnalyticsHealthCheck                                            |
| 2        | notificationActivities     | `agents/NotificationAgent/activities/index.ts`     | sendNotification, sendBatchNotifications                                                               |
| 3        | feedActivities             | `agents/FeedAgent/activities/index.ts`             | ingestUnifiedData, fetchFeed, getLiveGames, checkQuotaStatus                                           |
| 4        | auditActivities            | `agents/AuditAgent/activities/index.ts`            | performAudit, generateReport, runAudit                                                                 |
| 5        | gradingActivities          | `agents/GradingAgent/activities/index.ts`          | gradeNewProps, scoreTopTierPicks, updateUnifiedPicks, getNewUnifiedPicks                               |
| 6        | alertActivities            | `agents/AlertAgent/activities/index.ts`            | processAlert, evaluateConditions, sendAlertNotification, escalateAlert                                 |
| 7        | operatorActivities         | `agents/OperatorAgent/activities/index.ts`         | monitorSystem, handleAlert, performMaintenance, handleCriticalError, updateLiveGameStatus, logUSPError |
| 8        | playerEnrichmentActivities | `agents/PlayerEnrichmentAgent/activities/index.ts` | enrichAllPlayers, enrichPlayerById, getMlbHeadshot, getNbaHeadshot, getNflHeadshot, getNhlHeadshot     |
| 9        | recapActivities            | `agents/RecapAgent/activities/index.ts`            | triggerDailyRecap, triggerWeeklyRecap, checkMicroRecapTriggers                                         |

### Activity Proxy Timeouts

| Activity Group             | startToCloseTimeout | Retry          |
| -------------------------- | ------------------- | -------------- |
| baseActivities             | 1 minute            | default        |
| analyticsActivities        | 5 minutes           | default        |
| notificationActivities     | 30 seconds          | default        |
| feedActivities             | 90 seconds          | max 3 attempts |
| auditActivities            | 10 minutes          | default        |
| gradingActivities          | 60 seconds          | max 3 attempts |
| alertActivities            | 30 seconds          | default        |
| operatorActivities         | 30 seconds          | max 2 attempts |
| playerEnrichmentActivities | 10 minutes          | default        |

### Known Collision

| Activity      | Position 1 (loses)     | Position 7 (wins)  | Impact                   |
| ------------- | ---------------------- | ------------------ | ------------------------ |
| `logUSPError` | mainOperatorActivities | operatorActivities | Benign — both log errors |

---

## Section 5 — Canonical Data Flow

```
STAGE 1: INGESTION
═══════════════════
                    ┌─── CANONICAL V3 (live since 044G) ───┐
SGO API ────────────┤                                       │
Odds API ───────────┤──→ IngestionAgent ──→ provider_offers │
                    │    (upsert_provider_offers_bootstrap)  │
                    │    + canonical_events auto-creation    │
                    │    + participant FK resolution         │
                    └───────────────────────────────────────┘

                    ┌─── LEGACY (compatibility) ────────────┐
Optimal API ──┐     │                                       │
              ├──→  │ DataSourceRouter ──→ FeedAgent         │
Odds API ─────┘     │                    .ingestUnifiedData()│
                    │         ▼                              │
                    │  ┌─────────────────┐                   │
                    │  │   raw_props      │ (compatibility)  │
                    │  │   games           │ (compatibility)  │
                    │  └────────┬────────┘                   │
                    └───────────┼────────────────────────────┘
                                │
STAGE 2: SCORING & PROMOTION    │
════════════════════════════     ▼
                              GradingAgent.gradeNewProps()
                              (data source: GRADING_DATA_SOURCE env var, default=raw_props)
                                             │
                                             ▼
                              ┌──────────────────────────┐
                              │  packages/intelligence    │
                              │  • computeConsensus()     │
                              │  • computeProbability()   │
                              │  • calculateEdge()        │
                              │  • computeCalibration()   │
                              └──────────┬───────────────┘
                                         │
                              GradingAgent.scoreTopTierPicks()
                                         │
                                         ▼
                              Promotion Gate (promotionPolicy.ts)
                              • min edge threshold
                              • min confidence threshold
                              • market_policy compliance
                                         │
                              GradingAgent.updateUnifiedPicks()
                                         │
                                         ▼
                              ┌──────────────────────────┐
                              │   unified_picks           │ (CANONICAL)
                              │   via lifecycleInsert()   │
                              │   writerRole: 'promoter'  │
                              └──────────┬───────────────┘
                                         │
STAGE 3: DISTRIBUTION                    │
═════════════════════                    ▼
                              DiscordPromotionAgent
                              • atomicClaimForPost() (idempotent)
                                         │
                                         ▼
                              ┌──────────────────────────┐
                              │   pick_publish            │ (outbox)
                              └──────────┬───────────────┘
                                         │
                                         ▼
                              Discord Webhooks
                              • Trader Insights
                              • Best Bets
                              • Strategy Lab
                              • Free Daily Picks
                              • VIP Lounge
                                         │
STAGE 4: SETTLEMENT                      │
═══════════════════                      ▼
                              SettlementAgent
                              • Odds API /scores endpoint
                              • lifecycleSettle()
                              • writerRole: 'settler'
                                         │
                                         ▼
                              ┌──────────────────────────┐
                              │   unified_picks           │ (settlement fields)
                              │   prop_settlements        │
                              │   prop_outcomes           │ (WIN/LOSS/PUSH)
                              └──────────┬───────────────┘
                                         │
STAGE 5: ANALYTICS & RECAP              │
═══════════════════════════              ▼
                              RecapAgent (daily/weekly/monthly)
                              AnalyticsAgent (reporting)
                              CLV computation → clv_results
                              ClosingSnapshotAgent → closing_snapshots
```

### Alternate Entry: Smart Form Submission

```
Smart Form UI
    │
    ▼
bridge_outbox (direct insert, non-canonical table)
    │
    ▼
BridgeWorker (polls every 5s)
    │
    ▼
lifecycleInsert(supabase, pick, { writerRole: 'submitter' })
    │
    ▼
unified_picks (CANONICAL)
```

---

## Section 6 — Table Authority

Reference:
[Table Classification Spec](../governance/TABLE_CLASSIFICATION_SPEC.md)

### Canonical Tables (Lifecycle-Protected)

| Table                     | Writer                                  | Enforcement                                             |
| ------------------------- | --------------------------------------- | ------------------------------------------------------- |
| `unified_picks`           | API (multi-role via lifecycle adapters) | `lifecycleInsert`, `lifecycleUpdate`, `lifecycleSettle` |
| `participants`            | SGO Sync                                | Application-level                                       |
| `participant_memberships` | SGO Sync                                | Application-level                                       |

### Active Tables (Application-Enforced)

| Table               | Writer Agent          | Purpose                                |
| ------------------- | --------------------- | -------------------------------------- |
| `bridge_outbox`     | Smart Form            | Pick submission bridge                 |
| `agent_health`      | API Agents            | Agent health telemetry                 |
| `prop_settlements`  | SettlementAgent       | Settlement tracking                    |
| `pick_publish`      | DiscordPromotionAgent | Discord publish outbox                 |
| `closing_snapshots` | ClosingSnapshotAgent  | Consensus devig at market close        |
| `clv_results`       | CLV computation       | Per-pick CLV measurement               |
| `player_game_stats` | DataAgent             | Box score data                         |
| `prop_outcomes`     | SettlementAgent       | WIN/LOSS/PUSH outcomes                 |
| `market_policy`     | Operator              | Promotion gate config per sport/market |

### Writer Roles (unified_picks)

| Role                | Authority                      | Agent                             |
| ------------------- | ------------------------------ | --------------------------------- |
| `submitter`         | Initial pick fields            | Smart Form (via BridgeWorker)     |
| `promoter`          | Scoring and promotion fields   | GradingAgent                      |
| `poster`            | Discord delivery fields        | DiscordPromotionAgent, RecapAgent |
| `settler`           | Settlement fields              | SettlementAgent                   |
| `operator_override` | ALL fields including immutable | Manual operator action            |

### V3 Canonical Tables (Active)

| Table              | Writer         | Status                                                    |
| ------------------ | -------------- | --------------------------------------------------------- |
| `provider_offers`  | IngestionAgent | LIVE — 1.38M+ rows, SGO proven (044G)                     |
| `canonical_events` | IngestionAgent | LIVE — auto-created via `auto_create_event_for_ingestion` |
| `participants`     | SGO Sync / RPC | LIVE — FK resolution proven (044G)                        |

### Compatibility Tables (Scheduled for Retirement)

| Table          | Current Writer  | Replacement                     | Status                                                         |
| -------------- | --------------- | ------------------------------- | -------------------------------------------------------------- |
| `raw_props`    | FeedAgent       | `provider_offers` (TD-1)        | SGO bypasses raw_props; GradingAgent still reads it by default |
| `games`        | FeedAgent       | `canonical_events` (TD-2)       | Canonical events auto-created via RPC                          |
| `game_results` | SettlementAgent | Settlement via lifecycle (TD-3) | Not yet migrated                                               |

---

## Section 7 — External Dependencies

### Data Providers

| Service      | Base URL                          | Purpose                                               | Env Variable      |
| ------------ | --------------------------------- | ----------------------------------------------------- | ----------------- |
| The Odds API | `https://api.the-odds-api.com/v4` | Odds data, settlement scores, college/WNBA exclusives | `ODDS_API_KEY`    |
| Optimal API  | `https://api.optimal-bet.com`     | Player props (NFL, NBA, MLB, NHL primary)             | `OPTIMAL_API_KEY` |

### Communication

| Service          | Purpose                                                    | Env Variable                         |
| ---------------- | ---------------------------------------------------------- | ------------------------------------ |
| Discord API      | Bot interactions, slash commands, user onboarding          | `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` |
| Discord Webhooks | Pick posting, alerts, recaps (7 channel-specific webhooks) | `DISCORD_WEBHOOK_*`                  |

### AI Services

| Service   | Purpose                                                | Env Variable        | Status                       |
| --------- | ------------------------------------------------------ | ------------------- | ---------------------------- |
| OpenAI    | Alert advice, line movement detection, hedge detection | `OPENAI_API_KEY`    | Active (gpt-4-turbo-preview) |
| Anthropic | Planned alternative to OpenAI                          | `ANTHROPIC_API_KEY` | Installed, not integrated    |

### Optional Integrations

| Service | Purpose                          | Env Variable         | Status                             |
| ------- | -------------------------------- | -------------------- | ---------------------------------- |
| Notion  | Recap sync, ops incident logging | `NOTION_API_KEY`     | Feature-gated (`NOTION_SYNC=true`) |
| Twilio  | SMS alerts                       | `TWILIO_ACCOUNT_SID` | Optional                           |
| Retool  | Alert webhooks                   | `RETOOL_WEBHOOK_URL` | Optional                           |

### Infrastructure (Self-Hosted)

| Service          | Purpose                                 | Port         |
| ---------------- | --------------------------------------- | ------------ |
| Supabase (cloud) | PostgreSQL database                     | Cloud-hosted |
| Redis            | Caching, autopilot state, rate limiting | 6379         |
| Temporal         | Workflow orchestration                  | 7233         |
| Prometheus       | Metrics collection                      | 9090         |
| Grafana          | Dashboards and alerting                 | 3001         |

---

## Section 8 — System Boundaries

### Inside the Unit Talk Runtime

- **5 applications**: API, Smart Form, Command Center, Dashboard, Discord Bot
- **7 shared packages**: config, contracts, data-access, distribution,
  intelligence, observability, shared
- **15 active agents**: FeedAgent through RecapAgent (see Section 2)
- **13 activity modules**: Registered on single Temporal worker (see Section 4)
- **30+ Temporal workflows**: Core orchestration, support, recap, smart form,
  event-driven, legacy (see Section 3)
- **40+ API endpoints**: Health, picks, ops, risk, smart-form, webhooks, admin
  (see routes under `apps/api/src/routes/`)
- **4 background workers**: BridgeWorker, DiscordTicketWorker, OpsEventConsumer,
  SettlementAgent
- **Lifecycle enforcement**: Single-writer discipline via `lib/lifecycle/`
  adapters
- **Pure computation**: `packages/intelligence` (devig, probability, calibration
  — zero I/O)

### External to the Runtime

- **Odds API** — third-party odds data provider (read-only consumption)
- **Optimal API** — third-party player props provider (read-only consumption)
- **Discord** — message delivery platform (webhook POST, bot gateway)
- **OpenAI** — AI inference (optional, for alert enrichment)
- **Supabase** — managed PostgreSQL (cloud-hosted database)
- **Notion** — optional recap sync target
- **Twilio** — optional SMS delivery
- **Retool** — optional webhook target

### Boundary Rules

1. **Only `apps/api` writes to business tables** — all other apps are read-only
   or write to `bridge_outbox` only
2. **All `unified_picks` writes go through lifecycle adapters** — enforced by CI
   gate
3. **External API calls are funneled through DataSourceRouter** — with circuit
   breaker, rate limiting, and caching
4. **Temporal is the sole orchestrator** — no cron jobs, no custom schedulers
   outside Temporal
5. **Redis is fail-open for caching** — falls back to in-memory Map if
   unavailable
6. **Environment validation is fail-closed** — missing required vars prevent
   startup

---

## API Routes Summary

### Public Endpoints

| Method | Path                  | Purpose                         |
| ------ | --------------------- | ------------------------------- |
| GET    | `/api/health`         | Detailed health check           |
| GET    | `/api/health/live`    | K8s liveness probe              |
| GET    | `/api/health/ready`   | K8s readiness probe             |
| GET    | `/api/health/metrics` | Prometheus metrics              |
| GET    | `/health/provider`    | Provider circuit breaker states |
| GET    | `/api/picks/recent`   | Recent picks                    |
| GET    | `/api/picks/stats`    | Pick statistics by stage        |
| GET    | `/version`            | Build info (commit, branch)     |

### Operations Endpoints (Bearer admin-\*)

| Method | Path                           | Purpose                     |
| ------ | ------------------------------ | --------------------------- |
| POST   | `/ops/ingest-now`              | Trigger immediate ingestion |
| POST   | `/ops/settle`                  | Manual settlement           |
| POST   | `/ops/retry-posting`           | Retry stuck picks           |
| POST   | `/ops/retry-settlement`        | Retry drifted settlement    |
| GET    | `/ops/unsettled`               | List unsettled picks        |
| POST   | `/ops/recap`                   | Trigger recap               |
| POST   | `/ops/submit`                  | Operator pick submission    |
| POST   | `/ops/canary/publish-one`      | Publish 1 pick to canary    |
| GET    | `/ops/status`                  | Global ops status           |
| POST   | `/ops/picks/:id/approve`       | Approve pick                |
| POST   | `/ops/picks/:id/reject`        | Reject pick                 |
| POST   | `/ops/picks/:id/settle-result` | Manual settlement result    |

### Internal Endpoints

| Method | Path                      | Purpose                       |
| ------ | ------------------------- | ----------------------------- |
| POST   | `/api/smart-form/process` | Process smart form submission |
| POST   | `/webhooks/smart-form`    | Supabase webhook handler      |
| GET    | `/api/risk/exposure`      | Risk exposure state           |
| GET    | `/api/risk/drift`         | Model drift state             |

---

## Background Workers

| Worker                | Location                                | Trigger                                                  | Polling Interval | Feature Flag                   |
| --------------------- | --------------------------------------- | -------------------------------------------------------- | ---------------- | ------------------------------ |
| BridgeWorker          | `workers/BridgeWorker.ts`               | Polls `bridge_outbox`                                    | 5 seconds        | `ENABLE_BRIDGE_WORKER`         |
| DiscordTicketWorker   | `consumers/DiscordTicketWorker.ts`      | Polls `ticket_discord_outbox`                            | 10 seconds       | `ENABLE_DISCORD_TICKET_WORKER` |
| OpsEventConsumer      | `consumers/OpsEventConsumer.ts`         | Listens for PICK_SETTLED events                          | Event-driven     | `ENABLE_OPS_EVENT_CONSUMERS`   |
| OpsNotificationWorker | `services/ops/OpsNotificationWorker.ts` | Incident polling, Discord/Notion delivery, weekly digest | Configurable     | Optional                       |
| OpsRemediationWorker  | `services/ops/OpsRemediationWorker.ts`  | SLO incident polling, auto-remediation playbooks         | Configurable     | DRY RUN by default             |

---

## Temporal Schedules

Managed by `SyndicateScheduleManager` (`workflows/schedule-manager.ts`):

| Schedule ID                 | Workflow                        | Interval             | Overlap Policy |
| --------------------------- | ------------------------------- | -------------------- | -------------- |
| `syndicate-main-scheduler`  | syndicateSchedulerWorkflow      | Every 2 min          | SKIP           |
| `live-game-detector`        | liveGameDetectorWorkflow        | Every 30 min         | CANCEL_OTHER   |
| `api-quota-monitor`         | apiQuotaMonitoringWorkflow      | Every 5 min          | SKIP           |
| `system-health-monitor`     | systemHealthMonitorWorkflow     | Every 1 min          | SKIP           |
| `daily-cleanup`             | dailyCleanupWorkflow            | 3:00 AM daily        | CANCEL_OTHER   |
| `weekly-performance-report` | weeklyPerformanceReportWorkflow | Sunday 6:00 AM       | CANCEL_OTHER   |
| `{league}-peak-monitor`     | leaguePeakMonitorWorkflow       | Every 1 min (season) | SKIP           |
| `recap-daily`               | dailyRecapWorkflow              | 9:00 AM daily        | SKIP           |
| `recap-weekly`              | weeklyRecapWorkflow             | Monday 10:00 AM      | SKIP           |
| `recap-monthly`             | monthlyRecapWorkflow            | 1st @ 11:00 AM       | SKIP           |

---

## Related Documents

- [System Overview](./SYSTEM_OVERVIEW.md)
- [Canonical Runtime Path](./CANONICAL_RUNTIME_PATH.md)
- [Current System Status](./CURRENT_SYSTEM_STATUS.md)
- [Table Classification Spec](../governance/TABLE_CLASSIFICATION_SPEC.md)
- [Workflow Activity Contract](../governance/WORKFLOW_ACTIVITY_CONTRACT.md)
- [Agent Ownership Matrix](../governance/AGENT_OWNERSHIP_MATRIX.md)
- [Provider Authority Spec](../governance/PROVIDER_AUTHORITY_SPEC.md)
- [ERD Schema Reference](../architecture/ERD_SCHEMA.md)
