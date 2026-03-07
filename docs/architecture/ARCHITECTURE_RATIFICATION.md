# Architecture Ratification

Status: CANONICAL Authority: Tier 1 Owner: Platform Architecture Last Verified:
2026-03-07 Sprint: SPRINT-ARCHITECTURE-RATIFICATION-041D

---

## 1. Scope Reviewed

This ratification covers the complete Unit Talk runtime architecture as of
2026-03-07. All findings were verified against source code, not documentation
claims.

**Scope boundary:**

- 6 runtime services (API, Worker, Discord Bot, Smart Form, Command Center,
  Dashboard)
- 15 active agents on Temporal worker
- 30+ Temporal workflows across 7 categories
- 13 activity modules with spread-order registration
- 22 database tables across 5 classification tiers
- 7 external dependencies (4 required, 3 optional)
- 5 infrastructure components (Supabase, Redis, Temporal, Prometheus, Grafana)

**Out of scope:** 14 archived agents in `_archived/`, 48 design-layer contracts
(reference only), CI/CD pipeline internals.

---

## 2. Canonical Architecture Sources

| Source                      | Location                                               | Authority |
| --------------------------- | ------------------------------------------------------ | --------- |
| System Architecture Diagram | `docs/architecture/diagrams/SYSTEM_ARCHITECTURE.md`    | Tier 1    |
| Pick Machine Flow           | `docs/architecture/diagrams/PICK_MACHINE_FLOW.md`      | Tier 1    |
| Agent Ownership Diagram     | `docs/architecture/diagrams/AGENT_OWNERSHIP.md`        | Tier 1    |
| Database Relationships      | `docs/architecture/diagrams/DATABASE_RELATIONSHIPS.md` | Tier 1    |
| Workflow Orchestration      | `docs/architecture/diagrams/WORKFLOW_ORCHESTRATION.md` | Tier 1    |
| Runtime Component Map       | `docs/system/RUNTIME_COMPONENT_MAP.md`                 | Tier 1    |
| Architecture Index          | `docs/architecture/ARCHITECTURE_INDEX.md`              | Tier 1    |
| Table Classification Spec   | `docs/governance/TABLE_CLASSIFICATION_SPEC.md`         | Tier 1    |
| Agent Ownership Matrix      | `docs/governance/AGENT_OWNERSHIP_MATRIX.md`            | Tier 1    |
| Workflow Activity Contract  | `docs/governance/WORKFLOW_ACTIVITY_CONTRACT.md`        | Tier 1    |

---

## 3. Runtime Services Inventory

| Service         | Location                        | Port        | Verified                           |
| --------------- | ------------------------------- | ----------- | ---------------------------------- |
| API             | `apps/api`                      | 3010 → 3000 | `apps/api/src/index.ts`            |
| Temporal Worker | `apps/api` (separate container) | —           | `apps/api/src/temporal/worker.ts`  |
| Discord Bot     | `apps/discord-bot`              | —           | `apps/discord-bot/src/index.ts`    |
| Smart Form      | `apps/smart-form`               | 3021        | `apps/smart-form/package.json`     |
| Command Center  | `apps/command-center`           | 3004 → 3015 | `apps/command-center/package.json` |
| Dashboard       | `apps/dashboard`                | 3003        | `apps/dashboard/package.json`      |

**Infrastructure:**

| Component             | Port         | Verified             |
| --------------------- | ------------ | -------------------- |
| Supabase (PostgreSQL) | Cloud-hosted | `docker-compose.yml` |
| Redis                 | 6379         | `docker-compose.yml` |
| Temporal Server       | 7233 / 8088  | `docker-compose.yml` |
| Prometheus            | 9090         | `docker-compose.yml` |
| Grafana               | 3001         | `docker-compose.yml` |

---

## 4. Agent Authority Inventory

### Active Agents (Temporal Worker)

| #   | Agent                 | Worker Position | Write Target                                         | Lifecycle Adapter             | Writer Role             |
| --- | --------------------- | --------------- | ---------------------------------------------------- | ----------------------------- | ----------------------- |
| 1   | FeedAgent             | 3               | `raw_props`, `games`                                 | Direct insert (compatibility) | —                       |
| 2   | GradingAgent          | 5               | `unified_picks`                                      | `lifecycleInsert`             | `promoter`              |
| 3   | DiscordPromotionAgent | 8               | `unified_picks`, `pick_publish`                      | `atomicClaimForPost`          | `poster`                |
| 4   | SettlementAgent       | —               | `unified_picks`, `prop_settlements`, `prop_outcomes` | `lifecycleSettle`             | `settler`               |
| 5   | RecapAgent            | 9               | `unified_picks`                                      | `lifecycleUpdate`             | `poster`                |
| 6   | AlertAgent            | 6               | —                                                    | —                             | read-only               |
| 7   | NotificationAgent     | 2               | —                                                    | —                             | read-only (Discord API) |
| 8   | OperatorAgent         | 7               | `agent_health`                                       | Direct insert (active)        | —                       |
| 9   | DataAgent             | —               | `player_game_stats`                                  | Direct insert (active)        | —                       |
| 10  | AnalyticsAgent        | 5               | —                                                    | —                             | read-only               |
| 11  | AuditAgent            | 4               | —                                                    | —                             | read-only               |
| 12  | PlayerEnrichmentAgent | 1               | —                                                    | —                             | read-only               |
| 13  | ScoringAgent          | —               | —                                                    | —                             | read-only               |
| 14  | SmartFormAgent        | —               | —                                                    | —                             | read-only               |

### Off-Worker Agents

| Agent                 | Location                                        | Role                  |
| --------------------- | ----------------------------------------------- | --------------------- |
| OpsNotificationWorker | `apps/api/src/workers/OpsNotificationWorker.ts` | Discord notifications |
| OpsRemediationWorker  | `apps/api/src/workers/OpsRemediationWorker.ts`  | Auto-remediation      |

---

## 5. Workflow Inventory

### Main Orchestration

| Workflow                     | Schedule | Activities                     |
| ---------------------------- | -------- | ------------------------------ |
| `syndicateSchedulerWorkflow` | 2 min    | Orchestrates all sub-workflows |
| `liveGameDetectorWorkflow`   | 30 min   | `detectLiveGames`              |

### Ingestion

| Workflow                        | Activities                       |
| ------------------------------- | -------------------------------- |
| `leagueIngestionWorkflow`       | `ingestUnifiedData` (per league) |
| `{league}ScheduleWorkflow` (x7) | `fetchFeed`                      |

### Processing

| Workflow                    | Activities                                                 |
| --------------------------- | ---------------------------------------------------------- |
| `gradingAndScoringWorkflow` | `gradeNewProps`, `scoreTopTierPicks`, `updateUnifiedPicks` |
| `uspProcessingWorkflow`     | QUARANTINED (no-op)                                        |

### Distribution

| Workflow               | Activities                               |
| ---------------------- | ---------------------------------------- |
| `discordAlertWorkflow` | `getNewUnifiedPicks`, `sendNotification` |

### Monitoring

| Workflow                   | Schedule | Activities                           |
| -------------------------- | -------- | ------------------------------------ |
| `healthMonitoringWorkflow` | 2 min    | `performHealthCheck`, `processAlert` |
| `quotaMonitoringWorkflow`  | 15 min   | `checkApiQuota`, `logError`          |

### Recaps

| Workflow               | Schedule     | Activities                |
| ---------------------- | ------------ | ------------------------- |
| `dailyRecapWorkflow`   | 9 AM daily   | `triggerDailyRecap`       |
| `weeklyRecapWorkflow`  | Monday 10 AM | `triggerWeeklyRecap`      |
| `monthlyRecapWorkflow` | 1st @ 11 AM  | `triggerMonthlyRecap`     |
| `microRecapWorkflow`   | 1 min        | `checkMicroRecapTriggers` |

---

## 6. Database Ownership Inventory

### Canonical Tables

| Table                     | Writer Agent                                                     | Lifecycle Adapter                                                             | Immutability Rules                       |
| ------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------- |
| `unified_picks`           | GradingAgent, DiscordPromotionAgent, SettlementAgent, RecapAgent | `lifecycleInsert`, `atomicClaimForPost`, `lifecycleSettle`, `lifecycleUpdate` | Settlement fields immutable after settle |
| `participants`            | SGO Sync                                                         | Direct (canonical)                                                            | —                                        |
| `participant_memberships` | SGO Sync                                                         | Direct (canonical)                                                            | —                                        |

### Active Tables

| Table               | Writer Agent          |
| ------------------- | --------------------- |
| `bridge_outbox`     | Smart Form            |
| `agent_health`      | OperatorAgent         |
| `prop_settlements`  | SettlementAgent       |
| `pick_publish`      | DiscordPromotionAgent |
| `closing_snapshots` | CLV subsystem         |
| `clv_results`       | CLV subsystem         |
| `player_game_stats` | DataAgent             |
| `prop_outcomes`     | SettlementAgent       |
| `market_policy`     | Operator (manual)     |

### Compatibility Tables

| Table          | Writer    | Notes                  |
| -------------- | --------- | ---------------------- |
| `raw_props`    | FeedAgent | Direct insert (legacy) |
| `games`        | FeedAgent | Direct insert (legacy) |
| `game_results` | FeedAgent | Direct insert (legacy) |

### Deprecated Tables

| Table         | Status                                    |
| ------------- | ----------------------------------------- |
| `daily_picks` | No writes — superseded by `unified_picks` |
| `players`     | No writes — superseded by `participants`  |
| `teams`       | No writes — superseded by `participants`  |

---

## 7. Confirmed Invariants

The following invariants are supported by both architecture documentation and
runtime code:

| #   | Invariant                                                             | Enforcement                                                   |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | All `unified_picks` writes go through lifecycle adapters              | CI gate: `npm run lifecycle:single-writer -- --strict`        |
| 2   | `atomicClaimForPost` is idempotent — same pick cannot be posted twice | PostgreSQL atomic UPDATE with WHERE guard                     |
| 3   | Settlement fields are immutable after settlement                      | Database trigger `guard_closing_line_immutability`            |
| 4   | Smart Form writes only to `bridge_outbox`, never `unified_picks`      | Application boundary + CI gate                                |
| 5   | Command Center and Dashboard are read-only                            | No write imports in their codebases                           |
| 6   | Later activity spreads overwrite earlier ones in worker registration  | Temporal worker spread order in `worker.ts`                   |
| 7   | Single Temporal worker process hosts all 13 activity modules          | `worker.ts` registers all activities in one `Worker.create()` |
| 8   | DataSourceRouter implements circuit breaker with failover             | 5-failure threshold, 60s reset, provider fallback             |
| 9   | Each agent has a designated writer role for `unified_picks`           | Enforced by lifecycle adapter `writerRole` parameter          |
| 10  | Recap workflows are time-triggered, not event-triggered               | Temporal schedules with fixed cron expressions                |

---

## 8. Discrepancies, Conflicts, and Follow-Up Gaps

### D-1: GradingAgent Writer Role Mismatch

**Severity: MEDIUM — Runtime correctness issue**

- **Expected** (per docs): `writerRole: 'promoter'`
- **Actual** (code): `writerRole: 'submitter'` at
  `apps/api/src/agents/GradingAgent/GradingAgent.ts:767`
- **Impact**: GradingAgent uses the wrong writer role. The `submitter` role is
  designated for Smart Form / BridgeWorker initial pick creation. GradingAgent
  should use `promoter` since it promotes scored props into `unified_picks`.
- **Resolution**: Change `writerRole: 'submitter'` to `writerRole: 'promoter'`
  in `GradingAgent.ts:767`. Already tracked in SPRINT-035A Fix B-2.

### D-2: OperatorAgent Activity Export Gap

**Severity: LOW — Documentation completeness**

- **Location**: `docs/governance/AGENT_OWNERSHIP_MATRIX.md`
- **Issue**: Lists 6 OperatorAgent activities but actual barrel at
  `apps/api/src/agents/OperatorAgent/activities/index.ts` exports 11 functions.
  Missing: `logError`, `monitorAPIQuota`, `checkSystemHealth`,
  `detectLiveGames`, `logWorkflowMetrics` (sourced from
  `activities/operator.ts`, not the agent barrel).
- **Impact**: Documentation incomplete but no runtime effect.
- **Resolution**: Update AGENT_OWNERSHIP_MATRIX.md to list all 11 activities.

### D-3: `logError` Parameter Contract Over-Promise

**Severity: LOW — Type contract mismatch**

- **Location**: `apps/api/src/types/activities.ts` vs
  `apps/api/src/temporal/activities/operator.ts`
- **Issue**: Type contract declares
  `logError(params: { message: string; workflow?: string; league?: string; batchId?: string })`
  but runtime implementation at `operator.ts` accepts only `(message: string)`.
- **Impact**: Callers passing object params would get `[object Object]` as the
  error message string.
- **Resolution**: Align type contract to match implementation, or update
  implementation to accept structured params.

### D-4: Schedule Workflow Name Mismatch

**Severity: LOW — Naming inconsistency**

- **Docs**: `apiQuotaMonitoringWorkflow` (WORKFLOW_ORCHESTRATION.md)
- **Code**: `apiQuotaMonitorWorkflow` (actual workflow function name)
- **Impact**: Documentation-only. No runtime effect since Temporal schedules use
  IDs, not function names directly.
- **Resolution**: Update WORKFLOW_ORCHESTRATION.md schedule registry table.

### D-5: League Schedule Interval Documentation

**Severity: LOW — Documentation accuracy**

- **Docs**: Claim dynamic 30s (live) / 5min (idle) intervals
- **Code**: `schedule-manager.ts` uses fixed 1-minute intervals for all league
  peak monitors
- **Impact**: Documentation overcomplicates what is actually a simple fixed
  schedule.
- **Resolution**: Update documentation to reflect fixed 1-minute intervals.

### D-6: Type Contract Position Comments

**Severity: TRIVIAL — Code comment noise**

- **Location**: `apps/api/src/types/activities.ts:99`
- **Issue**: Position number comments are nonsensical (e.g., position "3" and
  "11" on the same interface).
- **Impact**: None — comments have no runtime effect.
- **Resolution**: Remove or correct position comments in type file.

### D-7: Activity Spread Collision Risk

**Severity: INFORMATIONAL — Architecture awareness**

- **Issue**: Worker registration uses JavaScript spread (`...activities`). If
  two agent barrels export a function with the same name, the later spread wins.
  Known resolved collisions:
  - `sendNotification`: AlertAgent (pos 10) overwrites NotificationAgent (pos 6)
    — tracked in SPRINT-035A Fix B-4
  - `performHealthCheck`: AnalyticsAgent (pos 5) overwrites healthMonitoring
    (pos 2) — tracked in SPRINT-035A Fix B-5
  - `initialize`: Multiple agents export this — tracked in SPRINT-035A Fix B-6
- **Impact**: Already identified and tracked for remediation.
- **Resolution**: SPRINT-035A Round 1 fixes B-4, B-5, B-6.

---

## 9. Ratification Verdict

### LOCKED FOR DOCUMENTATION

The architecture documentation set is **ratified as canonical** with the
following conditions:

**Ratified (no caveats):**

- System Architecture Diagram — accurate
- Pick Machine Flow — accurate
- Database Relationships — accurate
- Workflow Orchestration — accurate (minor naming fix needed, D-4)
- Runtime Component Map — accurate and comprehensive
- Table Classification Spec — accurate
- Architecture Index — complete

**Ratified with known gaps:**

- Agent Ownership Diagram — accurate for write authority; D-1 (writer role)
  tracked for fix
- Agent Ownership Matrix — incomplete activity listing (D-2); tracked for update

**Runtime enforcement gaps (tracked, not blocking):**

- D-1: GradingAgent writer role — SPRINT-035A Fix B-2
- D-7: Activity name collisions — SPRINT-035A Fixes B-4, B-5, B-6

### Authority Chain

```
ARCHITECTURE_INDEX.md (this sprint)
    ├── 5 Mermaid diagrams (SPRINT-041C)
    ├── RUNTIME_COMPONENT_MAP.md (SPRINT-041A)
    ├── Governance specs (SPRINT-040)
    └── ARCHITECTURE_RATIFICATION.md (this sprint)
            └── 7 discrepancies logged
            └── Verdict: LOCKED FOR DOCUMENTATION
```

### Next Actions

1. **SPRINT-035A Round 1**: Fix D-1 (writer role), D-7 (name collisions)
2. **Documentation patch**: Fix D-2 (OperatorAgent matrix), D-4 (workflow name),
   D-5 (schedule intervals)
3. **Type contract cleanup**: Fix D-3 (logError params), D-6 (position comments)

---

## Related Documents

- [Architecture Index](ARCHITECTURE_INDEX.md)
- [Runtime Component Map](../system/RUNTIME_COMPONENT_MAP.md)
- [Agent Ownership Matrix](../governance/AGENT_OWNERSHIP_MATRIX.md)
- [Table Classification Spec](../governance/TABLE_CLASSIFICATION_SPEC.md)
