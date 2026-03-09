# Agent Responsibility Matrix — Current System

> Generated: 2026-03-07 | Sprint: SPRINT-SYSTEM-DOCUMENTATION-FOUNDATION

---

## Active Agents (15)

### 1. GradingAgent

**File**: `apps/api/src/agents/GradingAgent/GradingAgent.ts` **Purpose**: Grades
incoming props using ML scoring engine. Assigns tiers and evaluates promotion
eligibility.

| Attribute       | Detail                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| **Reads**       | `raw_props` (ungraded, WHERE processed_at IS NULL)                                                            |
| **Writes**      | `raw_props` (tier, edge_score, edge_breakdown), `unified_picks` (via lifecycleInsert, writerRole: 'promoter') |
| **Triggers**    | Temporal workflow (uspProcessingWorkflow via syndicateSchedulerWorkflow)                                      |
| **Outputs**     | Tier assignment (S/A/B/C/D), edge scores, promotion band decisions                                            |
| **Key methods** | `gradeProp()`, `meetsPromotionCriteria()`, `promoteToUnifiedPicks()`                                          |

### 2. SettlementAgent

**File**: `apps/api/src/agents/SettlementAgent/index.ts` **Purpose**: Settles
completed props by fetching game results and resolving outcomes.

| Attribute    | Detail                                                                                 |
| ------------ | -------------------------------------------------------------------------------------- |
| **Reads**    | `game_results`, `raw_props`, `unified_picks`, `player_game_stats`, `feature_snapshots` |
| **Writes**   | `prop_settlements` (via lifecycleSettle), `unified_picks` (settlement fields)          |
| **Triggers** | Temporal workflow (settlementWorkflow)                                                 |
| **Outputs**  | Settlement results (WIN/LOSS/PUSH/VOID), loss attribution analysis                     |
| **External** | SGO API (game results), Odds API (/scores endpoint)                                    |

### 3. FeedAgent

**File**: `apps/api/src/agents/FeedAgent/index.ts` **Purpose**: Ingests raw
sports props from multiple data providers via the data source router.

| Attribute    | Detail                                                                     |
| ------------ | -------------------------------------------------------------------------- |
| **Reads**    | `raw_props` (duplicate check)                                              |
| **Writes**   | `raw_props` (direct insert), `games` (upsert)                              |
| **Triggers** | Temporal workflow (leagueIngestionWorkflow via syndicateSchedulerWorkflow) |
| **Outputs**  | Raw props in database, provider health metrics                             |
| **External** | Optimal API, Odds API, SGO API                                             |

### 4. IngestionAgent

**File**: `apps/api/src/agents/IngestionAgent/index.ts` **Purpose**: Validates,
normalizes, and deduplicates raw prop data. Layer between FeedAgent raw fetch
and database storage.

| Attribute    | Detail                                                                    |
| ------------ | ------------------------------------------------------------------------- |
| **Reads**    | `raw_props` (24h duplicate check window)                                  |
| **Writes**   | `raw_props` (validated/normalized props)                                  |
| **Triggers** | Temporal workflow schedule                                                |
| **Outputs**  | Ingested props, validation metrics (skipped, errors, duplicates filtered) |

### 5. DiscordPromotionAgent

**File**: `apps/api/src/agents/DiscordPromotionAgent/index.ts` **Purpose**:
Posts graded picks to Discord channels, manages outbox, records receipts.

| Attribute    | Detail                                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| **Reads**    | `unified_picks` (promoted, unposted), `pick_publish` (outbox status)                                            |
| **Writes**   | `pick_publish` (outbox records), `unified_picks` (via lifecycleUpdate/atomicClaimForPost, writerRole: 'poster') |
| **Triggers** | Temporal workflow (notificationWorkflow), API call                                                              |
| **Outputs**  | Discord embeds, outbox receipts with discord_message_id                                                         |

### 6. RecapAgent

**File**: `apps/api/src/agents/RecapAgent/index.ts` **Purpose**: Generates
daily/weekly recap summaries of pick performance.

| Attribute    | Detail                                                     |
| ------------ | ---------------------------------------------------------- |
| **Reads**    | `unified_picks` (settled picks in window), `user_profiles` |
| **Writes**   | Recap records                                              |
| **Triggers** | Scheduled timer (daily/weekly)                             |
| **Outputs**  | Performance summaries (ROI, win rates by capper/tier)      |

### 7. NotificationAgent

**File**: `apps/api/src/agents/NotificationAgent/NotificationAgent.ts`
**Purpose**: Sends notifications (email, SMS, Slack). All outputs gated by
AutopilotGuard.

| Attribute    | Detail                             |
| ------------ | ---------------------------------- |
| **Reads**    | None direct                        |
| **Writes**   | None (external service calls only) |
| **Triggers** | API call from other agents         |
| **Outputs**  | Email, SMS, Slack notifications    |

### 8. AuditAgent

**File**: `apps/api/src/agents/AuditAgent/index.ts` **Purpose**: Runs integrity
checks on core tables and escalates incidents.

| Attribute    | Detail                                                                   |
| ------------ | ------------------------------------------------------------------------ |
| **Reads**    | `unified_picks`, `agent_tasks`                                           |
| **Writes**   | `audit_incidents`                                                        |
| **Triggers** | Temporal schedule (hourly)                                               |
| **Outputs**  | Audit incidents (missing fields, stuck picks, duplicates, stale records) |

### 9. AlertAgent

**File**: `apps/api/src/agents/AlertAgent/index.ts` **Purpose**: Real-time
alerts on high-value opportunities (line movements, injuries, consensus).

| Attribute    | Detail                                                            |
| ------------ | ----------------------------------------------------------------- |
| **Reads**    | `unit_talk_alerts_log`, `unified_picks` (via event subscriptions) |
| **Writes**   | `unit_talk_alerts_log`                                            |
| **Triggers** | Event subscriptions (line movement, injury, consensus)            |
| **Outputs**  | Discord embeds with AI-generated advice                           |
| **External** | OpenAI (advice), Discord (posting)                                |

### 10. ScoringAgent

**File**: `apps/api/src/agents/ScoringAgent/index.ts` **Purpose**: Computes edge
scores and tier classification for unscored props.

| Attribute    | Detail                                                                    |
| ------------ | ------------------------------------------------------------------------- |
| **Reads**    | `raw_props` (WHERE edge_score IS NULL)                                    |
| **Writes**   | `raw_props` (edge_score, tier, context_tags, edge_breakdown, is_postable) |
| **Triggers** | Temporal workflow polling                                                 |
| **Outputs**  | Edge scores, tier assignments                                             |

### 11. AnalyticsAgent

**File**: `apps/api/src/agents/AnalyticsAgent/index.ts` **Purpose**: Analyzes
capper performance, ROI, win rates.

| Attribute    | Detail                                                                    |
| ------------ | ------------------------------------------------------------------------- |
| **Reads**    | `unified_picks`, `analytics_summary`, `roi_by_tier`, `roi_by_ticket_type` |
| **Writes**   | `analytics_summary`                                                       |
| **Triggers** | Temporal workflow schedule                                                |
| **Outputs**  | Capper performance summaries, ROI trends                                  |

### 12. DataAgent

**File**: `apps/api/src/agents/DataAgent/index.ts` **Purpose**: Orchestrates ETL
workflows, enrichment pipelines, data quality checks.

| Attribute    | Detail                                                 |
| ------------ | ------------------------------------------------------ |
| **Reads**    | `data_agent_events`, `users`                           |
| **Writes**   | `data_agent_events`                                    |
| **Triggers** | Temporal workflow schedule                             |
| **Outputs**  | ETL results, enrichment records, quality check reports |

### 13. OperatorAgent

**File**: `apps/api/src/agents/OperatorAgent/index.ts` **Purpose**: Monitors
agent health, escalates incidents, generates system reports.

| Attribute    | Detail                                                           |
| ------------ | ---------------------------------------------------------------- |
| **Reads**    | `agent_logs`, `operator_tasks`, `system_events`                  |
| **Writes**   | `operator_tasks`                                                 |
| **Triggers** | Scheduled polling (hourly), daily at midnight, weekly Sunday 2am |
| **Outputs**  | System health reports, agent failure alerts                      |
| **External** | Discord (alerts), Notion (logging), OpenAI (learning)            |

### 14. PlayerEnrichmentAgent

**File**: `apps/api/src/agents/PlayerEnrichmentAgent.ts` **Purpose**: Enriches
player data with headshots, physical stats, birthday from league APIs.

| Attribute    | Detail                                                     |
| ------------ | ---------------------------------------------------------- |
| **Reads**    | `players` (needing enrichment)                             |
| **Writes**   | `players` (photo_url, height_cm, weight_kg, birthday)      |
| **Triggers** | Manual/scheduled                                           |
| **External** | MLB Stats API, NBA Stats API, NFL Stats API, NHL Stats API |

### 15. BridgeWorker

**File**: `apps/api/src/workers/BridgeWorker.ts` **Purpose**: Consumes events
from bridge_outbox, triggers workflows, bridges Smart Form submissions into the
pipeline.

| Attribute    | Detail                                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| **Reads**    | `events`, `bridge_outbox`                                                                                      |
| **Writes**   | `unified_picks` (via lifecycleInsert, writerRole: 'submitter'), `workflow_executions`, `event_processing_logs` |
| **Triggers** | Polling loop (5s interval)                                                                                     |
| **Outputs**  | Picks moved from bridge_outbox to unified_picks, grading workflows triggered                                   |

---

## Summary Table

| Agent                 | Reads                                  | Writes                          | Trigger        |
| --------------------- | -------------------------------------- | ------------------------------- | -------------- |
| GradingAgent          | raw_props                              | raw_props, unified_picks        | Temporal       |
| SettlementAgent       | game_results, raw_props, unified_picks | prop_settlements, unified_picks | Temporal       |
| FeedAgent             | raw_props                              | raw_props, games                | Temporal       |
| IngestionAgent        | raw_props                              | raw_props                       | Temporal       |
| DiscordPromotionAgent | unified_picks, pick_publish            | pick_publish, unified_picks     | Temporal / API |
| RecapAgent            | unified_picks                          | recap records                   | Scheduled      |
| NotificationAgent     | --                                     | -- (external)                   | API call       |
| AuditAgent            | unified_picks, agent_tasks             | audit_incidents                 | Scheduled      |
| AlertAgent            | alerts_log, unified_picks              | alerts_log                      | Event sub      |
| ScoringAgent          | raw_props                              | raw_props                       | Temporal       |
| AnalyticsAgent        | unified_picks, analytics tables        | analytics_summary               | Scheduled      |
| DataAgent             | data_agent_events                      | data_agent_events               | Scheduled      |
| OperatorAgent         | agent_logs, operator_tasks             | operator_tasks                  | Scheduled      |
| PlayerEnrichmentAgent | players                                | players                         | Manual         |
| BridgeWorker          | events, bridge_outbox                  | unified_picks, logs             | Polling        |
