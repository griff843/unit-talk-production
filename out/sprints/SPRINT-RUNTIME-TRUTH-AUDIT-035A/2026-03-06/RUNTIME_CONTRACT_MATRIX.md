# RUNTIME CONTRACT MATRIX

**Sprint**: SPRINT-RUNTIME-TRUTH-AUDIT-035A
**Date**: 2026-03-06
**Purpose**: Per-workflow contract tracing — starter, provider, tables, governing doc, owner, runtime status

---

## Classification System

| Classification | Meaning |
|---------------|---------|
| **MATCH** | All layers agree — workflow runs as documented |
| **RUNTIME BROKEN** | Workflow starts but fails due to missing activities — includes evidence |
| **CODE DRIFT** | Code exists but contradicts governing docs |
| **DOC DANGEROUS** | Docs describe behavior that would mislead an operator |
| **UNKNOWN** | Cannot determine without live testing |

---

## Workflow Source Conflict

**CRITICAL**: Two files export `syndicateSchedulerWorkflow`:

| File | Implementation | Used by |
|------|---------------|---------|
| `workflows/syndicate-scheduler.ts` | Complex: 5 sub-workflows (ingestion, USP, grading, Discord alerts, monitoring) | `workflows/index.ts` re-export (line 242) |
| `workflows/support-workflows.ts` | Simple: `fetchFeed` → `gradeNewProps` → `updateUnifiedPicks` loop | `start-all-workflows.ts` import (line 7) |

The worker bundles workflows via `workflowsPath: require.resolve('./workflows')` which loads `workflows/index.ts`. The `index.ts` re-exports `syndicateSchedulerWorkflow` from `syndicate-scheduler.ts` (line 242), NOT from `support-workflows.ts`. However, `start-all-workflows.ts` imports from `support-workflows.ts` directly — the Temporal server resolves by workflow TYPE NAME, not import path. **Both implementations are in the bundle; which executes depends on Temporal's bundler resolution order.**

---

## All 13 Workflows from `start-all-workflows.ts`

### 1. syndicateSchedulerWorkflow

| Field | Value |
|-------|-------|
| **Workflow ID** | `syndicate-scheduler-v1` |
| **Starter** | `scripts/start-all-workflows.ts` |
| **Source** | `workflows/support-workflows.ts` (imported) AND `workflows/syndicate-scheduler.ts` (re-exported via index) |
| **Critical** | YES |
| **Providers** | Optimal API + OddsAPI (via `fetchUnifiedData` → `dataSourceRouter`) |
| **Tables Read** | `raw_props` (via FeedAgent queries), `games` (via game detection) |
| **Tables Written** | `raw_props` (direct insert via `supabaseClient.from('raw_props').insert()`), `games` (upsert), `unified_picks` (via `updateUnifiedPicks` — currently broken) |
| **Governing Doc** | NONE — no pipeline-level contract exists |
| **Owner** | FeedAgent (ingestion) + GradingAgent (scoring) — split ownership |
| **Activities Called** | `fetchFeed`, `gradeNewProps`, `updateUnifiedPicks`, `logError` (support-workflows version) OR `ingestUnifiedData`, `ingestFallbackProps`, `deduplicateAndNormalize`, `triggerGrading`, 7 USP detections, `gradeNewProps`, `scoreTopTierPicks`, `updateUnifiedPicks`, `getNewUnifiedPicks`, `buildPickEmbeds`, `sendCriticalDiscordAlerts`, `batchDiscordAlerts`, 10 logging activities (syndicate-scheduler version) |
| **Status** | **RUNTIME BROKEN** |

**Evidence**: Worker log `2026-03-07T00:38:55.457Z [ERROR] Activity function gradeNewProps is not registered on worker`. Both versions of this workflow call `gradeNewProps` which is not registered.

---

### 2. liveGameDetectorWorkflow

| Field | Value |
|-------|-------|
| **Workflow ID** | `live-game-detector` |
| **Starter** | `scripts/start-all-workflows.ts` |
| **Source** | `workflows/support-workflows.ts:138` |
| **Critical** | YES |
| **Providers** | OddsAPI (via `getLiveGames` → FeedAgent) |
| **Tables Read** | None directly (FeedAgent returns in-memory) |
| **Tables Written** | None directly (calls `updateLiveGameStatus` which logs) |
| **Governing Doc** | NONE |
| **Owner** | OperatorAgent + FeedAgent |
| **Activities Called** | `getLiveGames`, `updateLiveGameStatus`, `logError` |
| **Status** | **MATCH** — all 3 activities are registered |

**Note**: `getLiveGames` in FeedAgent barrel returns hardcoded `{success: true, games: []}` — functional but returns no data. Not RUNTIME BROKEN (activity exists), but operationally degraded.

---

### 3. quotaMonitoringWorkflow

| Field | Value |
|-------|-------|
| **Workflow ID** | `quota-monitoring` |
| **Starter** | `scripts/start-all-workflows.ts` |
| **Source** | `workflows/support-workflows.ts:188` |
| **Critical** | YES |
| **Providers** | None (internal monitoring) |
| **Tables Read** | None |
| **Tables Written** | None |
| **Governing Doc** | NONE |
| **Owner** | OperatorAgent |
| **Activities Called** | `checkApiQuota`, `processAlert`, `logError` |
| **Status** | **RUNTIME BROKEN** |

**Evidence**: `checkApiQuota` is not registered. Worker log shows 879+ consecutive failed activity attempts before the stale workflow was terminated on 2026-03-06.

---

### 4. healthMonitoringWorkflow

| Field | Value |
|-------|-------|
| **Workflow ID** | `health-monitoring` |
| **Starter** | `scripts/start-all-workflows.ts` |
| **Source** | `workflows/support-workflows.ts:257` |
| **Critical** | YES |
| **Providers** | None (internal monitoring) |
| **Tables Read** | None (hardcoded health score) |
| **Tables Written** | None (logs only) |
| **Governing Doc** | NONE |
| **Owner** | healthMonitoring module |
| **Activities Called** | `processAlert`, `logError` |
| **Status** | **MATCH** — both activities are registered |

**Note**: This workflow currently hardcodes `healthScore: 95` and never triggers alerts (threshold is < 80). Functionally a no-op.

---

### 5-11. League Schedule Workflows (NFL, NBA, MLB, NHL, NCAAF, NCAAB, WNBA)

| Field | Value |
|-------|-------|
| **Workflow IDs** | `nfl-schedule`, `nba-schedule`, `mlb-schedule`, `nhl-schedule`, `ncaaf-schedule`, `ncaab-schedule`, `wnba-schedule` |
| **Starter** | `scripts/start-all-workflows.ts` |
| **Source** | `workflows/support-workflows.ts:344-587` (individual functions per league) |
| **Critical** | NFL, NCAAF = YES; NBA, MLB, NHL, NCAAB, WNBA = NO |
| **Providers** | Optimal API + OddsAPI (via `fetchFeed` → `fetchUnifiedData` → `dataSourceRouter`) |
| **Tables Read** | None directly |
| **Tables Written** | None directly (fetchFeed only logs, does NOT persist to raw_props) |
| **Governing Doc** | NONE |
| **Owner** | FeedAgent |
| **Activities Called** | `fetchFeed`, `logError` |
| **Status** | **MATCH** — both activities are registered |

**Note**: These workflows call `fetchFeed` which fetches data from providers but does NOT write to `raw_props`. Only `ingestUnifiedData` (called by `syndicateSchedulerWorkflow`) persists data. These league-schedule workflows are effectively polling monitors — they fetch and discard. This is potentially a **CODE DRIFT** if the intention was to persist per-league data.

---

### 12. combinedRecapWorkflow

| Field | Value |
|-------|-------|
| **Workflow ID** | `recap-agent` |
| **Starter** | `scripts/start-all-workflows.ts` |
| **Source** | `workflows/recap-workflows.ts:240` |
| **Critical** | YES |
| **Providers** | None (internal — operates on settled data) |
| **Tables Read** | `unified_picks` (settled picks for recap generation) |
| **Tables Written** | `unified_picks` **(!!)** — `RecapAgent/index.ts:693` direct `.update()` |
| **Governing Doc** | NONE |
| **Owner** | RecapAgent |
| **Activities Called** | `triggerDailyRecap`, `triggerWeeklyRecap`, `triggerMonthlyRecap`, `checkMicroRecapTriggers` |
| **Status** | **MATCH** (activities registered) + **CODE DRIFT** (single-writer violation) |

**Single-writer violation**: RecapAgent writes to `unified_picks` via direct `supabase.from('unified_picks').update(...)` at `RecapAgent/index.ts:693`, bypassing lifecycle adapters. This violates `CLAUDE_EXECUTION_CONTRACT.md` Section I (Level 1 doc authority).

---

### 13. analyticsWorkflow

| Field | Value |
|-------|-------|
| **Workflow ID** | `analytics-agent` |
| **Starter** | `scripts/start-all-workflows.ts` |
| **Source** | `workflows/analyticsWorkflow.ts` |
| **Critical** | YES |
| **Providers** | None |
| **Tables Read** | `unified_picks` (for analysis) |
| **Tables Written** | None (read-only) |
| **Governing Doc** | NONE |
| **Owner** | AnalyticsAgent |
| **Activities Called** | `runAnalyticsAgent` |
| **Status** | **RUNTIME BROKEN** |

**Evidence**: The workflow calls `runAnalyticsAgent` but the AnalyticsAgent barrel exports `runAnalyticsAgentActivity`. Name mismatch. The workflow will fail with `Activity function runAnalyticsAgent is not registered`.

---

## Summary: Workflow Health

| # | Workflow | ID | Status | Blocking Issue |
|---|----------|----|--------|----------------|
| 1 | syndicateSchedulerWorkflow | syndicate-scheduler-v1 | **RUNTIME BROKEN** | `gradeNewProps` + 18 other activities not registered |
| 2 | liveGameDetectorWorkflow | live-game-detector | **MATCH** | None (functionally degraded — returns empty) |
| 3 | quotaMonitoringWorkflow | quota-monitoring | **RUNTIME BROKEN** | `checkApiQuota` not registered |
| 4 | healthMonitoringWorkflow | health-monitoring | **MATCH** | None (functionally a no-op) |
| 5 | nflScheduleWorkflow | nfl-schedule | **MATCH** | None |
| 6 | nbaScheduleWorkflow | nba-schedule | **MATCH** | None |
| 7 | mlbScheduleWorkflow | mlb-schedule | **MATCH** | None |
| 8 | nhlScheduleWorkflow | nhl-schedule | **MATCH** | None |
| 9 | ncaafScheduleWorkflow | ncaaf-schedule | **MATCH** | None |
| 10 | ncaabScheduleWorkflow | ncaab-schedule | **MATCH** | None |
| 11 | wnbaScheduleWorkflow | wnba-schedule | **MATCH** | None |
| 12 | combinedRecapWorkflow | recap-agent | **CODE DRIFT** | Single-writer violation |
| 13 | analyticsWorkflow | analytics-agent | **RUNTIME BROKEN** | Name mismatch (`runAnalyticsAgent` vs `runAnalyticsAgentActivity`) |

**Tally**: 3 RUNTIME BROKEN, 1 CODE DRIFT, 9 MATCH (of which 2 are functionally degraded)

---

## Table Write Authority

| Table | Actual Writer(s) | Via Lifecycle Adapter? | Governing Doc |
|-------|-----------------|----------------------|---------------|
| `raw_props` | FeedAgent (`ingestUnifiedData` → `supabaseClient.from('raw_props').insert()`) | **NO** — direct insert | NOT in CLAUDE.md canonical tables |
| `games` | FeedAgent (`ingestUnifiedData` → `supabaseClient.from('games').upsert()`) | **NO** — direct upsert | NOT in CLAUDE.md canonical tables |
| `unified_picks` | GradingAgent (`updateUnifiedPicks` → `GradingAgent.ts:757` direct insert) | **NO** — single-writer violation | `CLAUDE_EXECUTION_CONTRACT.md` requires lifecycle adapters |
| `unified_picks` | RecapAgent (`index.ts:693` direct update) | **NO** — single-writer violation | `CLAUDE_EXECUTION_CONTRACT.md` requires lifecycle adapters |
| `unified_picks` | DiscordPromotionAgent, SettlementAgent | **YES** — via `lifecycleUpdate`, `atomicClaimForPost`, `lifecycleSettle` | `PICK_LIFECYCLE_CONTRACT.md` |
| `agent_logs` | BaseAgent (via `logActivity`) | **NO** — internal table, not governed | N/A |

---

## Provider Routing (Runtime)

| Provider | Configured For | Runtime Status | Evidence |
|----------|---------------|----------------|----------|
| Optimal API | MLB, NBA, NFL, NHL (primary) | **DEGRADED** — returns 503 / no events | Worker log: `[Optimal] Error fetching events: Error: Optimal API request failed (503)` |
| OddsAPI (The Odds API) | All sports (fallback + NCAAB/NCAAF/WNBA primary) | **HEALTHY** — 447 requests remaining | Validation report: 772 prop lines for BOS@DAL from 6 books |
| SGO | Referenced in `ingestFallbackProps` type | **UNKNOWN** — no implementation exists | `ingestFallbackProps` is TYPE ONLY |

---

**Generated**: 2026-03-06T20:00:00-05:00
**Sprint**: SPRINT-RUNTIME-TRUTH-AUDIT-035A
