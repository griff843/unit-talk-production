# Canonical UI Projection Architecture

> **Status**: ARCHITECTURAL DEFINITION (Not yet implemented) **Date**:
> 2026-02-23 **Scope**: Smart Form, Command Center, Dashboard, Recap System,
> Future Dashboards

---

## 1. Executive Summary

This document defines the canonical projection architecture for all Unit Talk UI
surfaces. The core principle: **UI apps NEVER query raw operational tables
directly**. All UI reads flow through projection surfaces (views and
materialized views) that provide deterministic, performant, and consistent data
access.

---

## 2. Architectural Principles

### 2.1 Core Invariants

| Invariant                         | Description                                                                                  |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| **P1: Single Source of Truth**    | `unified_picks` is the canonical operational table for all pick data                         |
| **P2: Projection-Only Reads**     | UI apps read ONLY from projection surfaces, never raw tables                                 |
| **P3: Single-Writer Discipline**  | Writes follow lifecycle adapters; UI apps are READ-ONLY or write to designated outbox tables |
| **P4: Deterministic Projections** | Same input state → same projection output                                                    |
| **P5: Minimal Layering**          | Avoid view-on-view chains deeper than 2 levels                                               |
| **P6: Explicit Refresh**          | Materialized views have documented refresh policies                                          |

### 2.2 Table Classification

| Classification            | Tables                                      | UI Access                       |
| ------------------------- | ------------------------------------------- | ------------------------------- |
| **Canonical Operational** | `unified_picks`, `bridge_outbox`            | Via projection surfaces only    |
| **Raw Ingestion**         | `raw_props`, `provider_offers`, `events`    | NEVER from UI                   |
| **Reference/Registry**    | `teams`, `players`, `games`, `market_types` | Via catalog projections         |
| **Analytics**             | `prop_settlements`, `closing_snapshots`     | Via recap/analytics projections |
| **User/Auth**             | `users`, `user_profiles`, `cappers`         | Via user projections            |
| **Agent State**           | `agent_health`, `recap_state`               | Via ops projections             |

---

## 3. Canonical Projection Surface Inventory

### 3.1 Projection Surface Matrix

| Surface                          | Type | Writer | Consumers                 | Refresh   |
| -------------------------------- | ---- | ------ | ------------------------- | --------- |
| **CATALOG SURFACES**             |
| `view_events_for_form`           | VIEW | -      | Smart Form                | Real-time |
| `view_participants_for_event`    | VIEW | -      | Smart Form                | Real-time |
| `view_market_types_for_sport`    | VIEW | -      | Smart Form                | Real-time |
| `view_provider_offers_current`   | VIEW | -      | Smart Form, Dashboard     | Real-time |
| `mv_search_teams`                | MV   | -      | Smart Form                | 15 min    |
| `mv_search_players`              | MV   | -      | Smart Form                | 15 min    |
| `mv_search_games`                | MV   | -      | Smart Form                | 5 min     |
| `mv_props_for_form`              | MV   | -      | Smart Form                | 2 min     |
| **PICK SURFACES**                |
| `view_picks_for_command_center`  | VIEW | -      | Command Center            | Real-time |
| `view_picks_lifecycle`           | VIEW | -      | Command Center            | Real-time |
| `view_picks_stuck`               | VIEW | -      | Command Center            | Real-time |
| `view_picks_for_grading`         | VIEW | -      | Command Center            | Real-time |
| `view_picks_unsettled`           | VIEW | -      | Command Center            | Real-time |
| **PIPELINE SURFACES**            |
| `v_recent_promotions_24h`        | VIEW | -      | Command Center            | Real-time |
| `v_promo_backlog`                | VIEW | -      | Command Center            | Real-time |
| `mv_pipeline_lag_24h`            | MV   | -      | Command Center            | 5 min     |
| `view_pipeline_health`           | VIEW | -      | Command Center            | Real-time |
| **ANALYTICS SURFACES**           |
| `mv_capper_daily_rollup`         | MV   | -      | Command Center, Dashboard | 1 hour    |
| `v_capper_streaks`               | VIEW | -      | Command Center            | Real-time |
| `view_ops_metrics_daily`         | VIEW | -      | Command Center            | Real-time |
| `view_props_sport_breakdown`     | VIEW | -      | Command Center            | Real-time |
| **RECAP SURFACES**               |
| `view_settled_picks_for_recap`   | VIEW | -      | RecapAgent (API)          | Real-time |
| `view_capper_performance_window` | VIEW | -      | RecapAgent, Discord Bot   | Real-time |
| **USER SURFACES**                |
| `view_users_for_dashboard`       | VIEW | -      | Dashboard                 | Real-time |
| `view_cappers_active`            | VIEW | -      | Smart Form                | Real-time |

### 3.2 Surface Ownership by App

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SMART FORM                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │ mv_props_for_   │  │ view_events_    │  │ view_participants_  │ │
│  │ form            │  │ for_form        │  │ for_event           │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │ mv_search_      │  │ mv_search_      │  │ view_market_types_  │ │
│  │ players/teams   │  │ games           │  │ for_sport           │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────┘ │
│  WRITES TO: bridge_outbox ONLY                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      COMMAND CENTER                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │ view_picks_     │  │ view_picks_     │  │ view_pipeline_      │ │
│  │ lifecycle       │  │ stuck           │  │ health              │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │ mv_capper_      │  │ v_recent_       │  │ view_ops_metrics_   │ │
│  │ daily_rollup    │  │ promotions_24h  │  │ daily               │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────┘ │
│  READ-ONLY: No writes to business tables                           │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        DASHBOARD                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │ view_users_     │  │ mv_capper_      │  │ view_analytics_     │ │
│  │ for_dashboard   │  │ daily_rollup    │  │ summary             │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────┘ │
│  READ-ONLY: No writes to business tables                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Detailed Surface Specifications

### 4.1 Smart Form Surfaces

#### `mv_props_for_form` (EXISTING - Keep)

```sql
-- Materialized view for prop selection in Smart Form
-- Source: raw_props, games
-- Refresh: Every 2 minutes via pg_cron
-- Indexes: sport+player, sport+team, sport+stat_type, game_date, trigram
```

#### `view_events_for_form` (EXISTING - Keep)

```sql
-- Real-time view for upcoming event selection
-- Source: events, participants
-- Filter: status IN ('scheduled', 'live'), scheduled_at > NOW() - 2h
-- No materialization needed - small result set
```

#### `view_catalog_teams` (NEW - Replace direct teams queries)

```sql
CREATE VIEW view_catalog_teams AS
SELECT
  t.id,
  t.name,
  t.abbr,
  t.sport,
  t.logo_url,
  t.aliases,
  t.active,
  -- Pre-computed search text for client-side filtering
  LOWER(t.name || ' ' || COALESCE(t.abbr, '') || ' ' ||
        COALESCE(t.aliases::text, '')) as search_text
FROM teams t
WHERE t.active = true;
```

#### `view_catalog_players` (NEW - Replace direct players queries)

```sql
CREATE VIEW view_catalog_players AS
SELECT
  p.id,
  p.full_name,
  p.sport,
  p.team_id,
  t.name as team_name,
  t.abbr as team_abbr,
  p.position,
  p.active,
  LOWER(p.full_name || ' ' || COALESCE(t.name, '')) as search_text
FROM players p
LEFT JOIN teams t ON p.team_id = t.id
WHERE p.active = true;
```

### 4.2 Command Center Surfaces

#### `view_picks_for_command_center` (NEW - Central picks projection)

```sql
CREATE VIEW view_picks_for_command_center AS
SELECT
  up.id,
  up.user_id,
  up.selection,
  up.odds,
  up.confidence,
  up.sport,
  up.tier_when_placed,
  up.status,
  up.promotion_status,
  up.settlement_status,
  up.posted_to_discord,
  up.discord_message_id,
  up.blocked_reason,
  up.failed_reason,
  up.created_at,
  up.placed_at,
  up.promotion_queued_at,
  up.promotion_posted_at,
  up.settled_at,
  up.blocked_at,
  up.failed_at,
  u.username,
  u.capper_tier
FROM unified_picks up
LEFT JOIN users u ON up.user_id = u.id
ORDER BY up.created_at DESC;
```

#### `view_picks_stuck` (NEW - Stuck picks detection)

```sql
CREATE VIEW view_picks_stuck AS
SELECT
  'submitted_stuck' as stuck_type,
  id, selection, sport, created_at, promotion_status,
  blocked_reason, failed_reason, settlement_status,
  posted_to_discord, discord_message_id,
  EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_stuck
FROM unified_picks
WHERE promotion_status = 'submitted'
  AND created_at < NOW() - INTERVAL '5 minutes'
  AND blocked_at IS NULL
  AND failed_at IS NULL

UNION ALL

SELECT
  'queued_stuck' as stuck_type,
  id, selection, sport, created_at, promotion_status,
  blocked_reason, failed_reason, settlement_status,
  posted_to_discord, discord_message_id,
  EXTRACT(EPOCH FROM (NOW() - promotion_queued_at))/60 as minutes_stuck
FROM unified_picks
WHERE promotion_status = 'queued'
  AND promotion_queued_at < NOW() - INTERVAL '15 minutes'
  AND posted_to_discord = false

UNION ALL

SELECT
  'posted_stuck' as stuck_type,
  id, selection, sport, created_at, promotion_status,
  blocked_reason, failed_reason, settlement_status,
  posted_to_discord, discord_message_id,
  EXTRACT(EPOCH FROM (NOW() - promotion_posted_at))/60 as minutes_stuck
FROM unified_picks
WHERE posted_to_discord = true
  AND settlement_status IS NULL
  AND promotion_posted_at < NOW() - INTERVAL '24 hours';
```

#### `view_ops_metrics_daily` (NEW - Replace OperationalOverview aggregations)

```sql
CREATE VIEW view_ops_metrics_daily AS
SELECT
  DATE(created_at) as metric_date,
  sport,
  tier,
  COUNT(*) as total_props,
  COUNT(*) FILTER (WHERE graded_at IS NOT NULL) as graded_props,
  COUNT(DISTINCT COALESCE(matchup, game_id::text)) as unique_games,
  AVG(edge_score) as avg_edge_score
FROM raw_props
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at), sport, tier;
```

#### `view_pipeline_health` (NEW - Replace usePipelineHealth calculations)

```sql
CREATE VIEW view_pipeline_health AS
SELECT
  COUNT(*) as total_props,
  COUNT(*) FILTER (WHERE processed_at IS NOT NULL) as processed_count,
  COUNT(*) FILTER (WHERE promoted_at IS NOT NULL) as promoted_count,
  AVG(EXTRACT(EPOCH FROM (NOW() - processed_at))/60)
    FILTER (WHERE processed_at IS NOT NULL) as avg_processing_lag_minutes,
  AVG(EXTRACT(EPOCH FROM (promoted_at - processed_at))/60)
    FILTER (WHERE promoted_at IS NOT NULL AND processed_at IS NOT NULL) as avg_promotion_lag_minutes,
  MAX(processed_at) as last_processed_at,
  MAX(promoted_at) as last_promoted_at
FROM raw_props
WHERE created_at >= CURRENT_DATE;
```

### 4.3 Analytics/Recap Surfaces

#### `view_settled_picks_for_recap` (NEW - Recap aggregation source)

```sql
CREATE VIEW view_settled_picks_for_recap AS
SELECT
  up.id,
  up.capper_username,
  up.capper_id,
  up.tags,
  up.player_name,
  up.team_name,
  up.market_type,
  up.line,
  up.odds,
  up.tier,
  up.sport,
  up.league,
  up.units,
  up.profit_loss,
  up.parlay_id,
  up.outcome,
  up.settlement_status,
  up.settlement_result,
  up.play_status,
  up.edge_score,
  up.clv_delta,
  up.confidence,
  up.professional_score,
  up.promotion_band,
  up.created_at,
  up.settled_at,
  DATE(up.created_at) as pick_date,
  DATE_TRUNC('week', up.created_at) as pick_week,
  DATE_TRUNC('month', up.created_at) as pick_month
FROM unified_picks up
WHERE up.settlement_status = 'settled'
  AND up.play_status IN ('settled', 'graded')
  AND up.outcome IS NOT NULL;
```

### 4.4 Dashboard Surfaces

#### `view_analytics_summary` (NEW - Dashboard analytics)

```sql
CREATE VIEW view_analytics_summary AS
SELECT
  DATE(created_at) as summary_date,
  COUNT(*) as total_picks,
  COUNT(*) FILTER (WHERE outcome = 'won') as wins,
  COUNT(*) FILTER (WHERE outcome = 'lost') as losses,
  COUNT(*) FILTER (WHERE outcome = 'push') as pushes,
  SUM(profit_loss) as net_units,
  CASE
    WHEN SUM(units) > 0 THEN (SUM(profit_loss) / SUM(units)) * 100
    ELSE 0
  END as roi_percent
FROM unified_picks
WHERE settlement_status = 'settled'
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY summary_date DESC;
```

---

## 5. Materialized View Refresh Strategy

### 5.1 Refresh Tiers

| Tier     | Refresh Interval | Use Case              | Views                                           |
| -------- | ---------------- | --------------------- | ----------------------------------------------- |
| **HOT**  | 2-5 minutes      | Active form selection | `mv_props_for_form`, `mv_search_games`          |
| **WARM** | 15-30 minutes    | Catalog/search        | `mv_search_teams`, `mv_search_players`          |
| **COLD** | 1 hour           | Analytics rollups     | `mv_capper_daily_rollup`, `mv_pipeline_lag_24h` |

### 5.2 Refresh Implementation

```sql
-- pg_cron job configuration
SELECT cron.schedule('refresh_hot_views', '*/2 * * * *', $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_props_for_form;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_search_games;
$$);

SELECT cron.schedule('refresh_warm_views', '*/15 * * * *', $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_search_teams;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_search_players;
$$);

SELECT cron.schedule('refresh_cold_views', '0 * * * *', $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_capper_daily_rollup;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_pipeline_lag_24h;
$$);
```

### 5.3 Manual Refresh RPC

```sql
-- For admin-triggered refresh
CREATE OR REPLACE FUNCTION refresh_projection_surface(surface_name TEXT)
RETURNS VOID AS $$
BEGIN
  EXECUTE 'REFRESH MATERIALIZED VIEW CONCURRENTLY ' || quote_ident(surface_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 6. Index Requirements

### 6.1 Required Indexes by Surface

```sql
-- mv_props_for_form
CREATE UNIQUE INDEX idx_mv_props_form_id ON mv_props_for_form(id);
CREATE INDEX idx_mv_props_form_sport_player ON mv_props_for_form(sport, player_name);
CREATE INDEX idx_mv_props_form_sport_team ON mv_props_for_form(sport, team);
CREATE INDEX idx_mv_props_form_game_date ON mv_props_for_form(game_date);
CREATE INDEX idx_mv_props_form_search ON mv_props_for_form USING gin(display_label gin_trgm_ops);

-- view_picks_for_command_center (indexes on underlying unified_picks)
CREATE INDEX idx_unified_picks_created ON unified_picks(created_at DESC);
CREATE INDEX idx_unified_picks_lifecycle ON unified_picks(promotion_status, settlement_status);
CREATE INDEX idx_unified_picks_user ON unified_picks(user_id, created_at DESC);

-- mv_capper_daily_rollup
CREATE UNIQUE INDEX idx_mv_capper_rollup_pk ON mv_capper_daily_rollup(capper_id, day);
CREATE INDEX idx_mv_capper_rollup_day ON mv_capper_daily_rollup(day DESC);
```

---

## 7. Current Violations Inventory

### 7.1 Critical Violations (Must Fix)

| App            | File                      | Violation                                         | Fix                          |
| -------------- | ------------------------- | ------------------------------------------------- | ---------------------------- |
| Command Center | `OperationalOverview.tsx` | 8x direct `raw_props` queries with JS aggregation | Use `view_ops_metrics_daily` |
| Command Center | `usePipelineHealth.ts`    | 4x direct `raw_props` queries for lag calculation | Use `view_pipeline_health`   |
| Command Center | Multiple API routes       | Direct `raw_props` queries                        | Use projection views         |
| Smart Form     | `supabase-queries.ts`     | 6x direct `teams` queries                         | Use `view_catalog_teams`     |
| Smart Form     | `supabase-queries.ts`     | 4x direct `players` queries                       | Use `view_catalog_players`   |
| Smart Form     | `supabase-queries.ts`     | 5x direct `games` queries                         | Use `mv_search_games`        |
| Smart Form     | `api/props/route.ts`      | Direct `raw_props` query                          | Use `mv_props_for_form`      |
| Dashboard      | `api/analytics/route.ts`  | Direct `unified_picks` query                      | Use `view_analytics_summary` |
| Dashboard      | `api/users/route.ts`      | Direct `unified_picks` query per user             | Use `mv_capper_daily_rollup` |

### 7.2 Anti-Patterns Found

1. **TypeScript Aggregation**: Complex GROUP BY/COUNT/AVG logic in JavaScript
   instead of SQL
2. **Multiple Fallback Queries**: Same data fetched 3 different ways with
   fallback chains
3. **Inline JOINs**: Frontend code using `.select('*, table!inner(*)')` patterns
4. **Duplicate Query Paths**: 12+ independent queries for `raw_props` in Command
   Center
5. **Missing Projections**: No views for common dashboard metrics

---

## 8. Migration Plan

### Phase 1: Create Missing Views (Week 1)

1. Create `view_catalog_teams`, `view_catalog_players`
2. Create `view_picks_for_command_center`, `view_picks_stuck`
3. Create `view_ops_metrics_daily`, `view_pipeline_health`
4. Create `view_settled_picks_for_recap`, `view_analytics_summary`

### Phase 2: Migrate Smart Form (Week 2)

1. Update `supabase-queries.ts` to use catalog views
2. Update API routes to use MVs with fallback to views (not tables)
3. Remove direct `teams`, `players`, `games` queries

### Phase 3: Migrate Command Center (Week 3)

1. Update `OperationalOverview.tsx` to use `view_ops_metrics_daily`
2. Update `usePipelineHealth.ts` to use `view_pipeline_health`
3. Update all API routes to use pick views
4. Remove all direct `raw_props` queries

### Phase 4: Migrate Dashboard (Week 4)

1. Update analytics endpoint to use `view_analytics_summary`
2. Update user stats to use `mv_capper_daily_rollup`
3. Remove direct `unified_picks` queries

### Phase 5: Enforcement Gate (Week 5)

1. Create lint rule to detect direct table queries
2. Add CI gate to fail on new violations
3. Document allowed exceptions

---

## 9. Enforcement Recommendations

### 9.1 Static Analysis Gate

```bash
# Add to CI pipeline
npm run projection:audit -- --strict
```

**Gate Rules:**

1. UI apps may NOT import raw table names: `teams`, `players`, `games`,
   `raw_props`, `prop_settlements`
2. UI apps may ONLY query surfaces prefixed with `view_`, `mv_`, or `v_`
3. Exception: `bridge_outbox` for Smart Form writes

### 9.2 Allowed Surface Patterns

```typescript
// ALLOWED in UI apps
supabase.from('view_picks_for_command_center');
supabase.from('mv_props_for_form');
supabase.from('v_recent_promotions_24h');

// FORBIDDEN in UI apps
supabase.from('unified_picks'); // Use view_picks_* instead
supabase.from('raw_props'); // Use mv_props_for_form instead
supabase.from('teams'); // Use view_catalog_teams instead
supabase.from('players'); // Use view_catalog_players instead
```

### 9.3 Exception Registry

| Exception                            | Reason              | Approved By       |
| ------------------------------------ | ------------------- | ----------------- |
| `bridge_outbox` writes in Smart Form | Outbox architecture | Architecture Team |
| `agent_health` in Command Center     | Ops monitoring      | Architecture Team |
| `audit_logs` in Command Center       | Security logging    | Architecture Team |

---

## 10. Performance Considerations

### 10.1 View vs Materialized View Decision Matrix

| Factor            | Use VIEW             | Use MATERIALIZED VIEW    |
| ----------------- | -------------------- | ------------------------ |
| Data freshness    | Critical (real-time) | Tolerable lag (2-60 min) |
| Query complexity  | Simple joins         | Complex aggregations     |
| Result set size   | < 1000 rows          | > 1000 rows              |
| Query frequency   | < 10/min             | > 10/min                 |
| Source table size | < 100K rows          | > 100K rows              |

### 10.2 Caching Strategy

| Layer               | TTL      | Surfaces                        |
| ------------------- | -------- | ------------------------------- |
| Application (Redis) | 30-60s   | Catalog views, search results   |
| Database (pg_stat)  | N/A      | All views have query plan cache |
| Materialized        | 2-60 min | All MVs per refresh tier        |

### 10.3 Data Freshness Tradeoffs

| Surface                   | Max Staleness | Justification                   |
| ------------------------- | ------------- | ------------------------------- |
| `mv_props_for_form`       | 2 min         | Prop lines change frequently    |
| `mv_search_games`         | 5 min         | Game schedule relatively stable |
| `mv_search_teams/players` | 15 min        | Roster changes infrequent       |
| `mv_capper_daily_rollup`  | 1 hour        | Analytics tolerate lag          |
| `view_picks_*`            | Real-time     | Lifecycle tracking critical     |

---

## 11. Summary: Canonical Surface Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     CANONICAL PROJECTION ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                  │
│  │ SMART FORM  │    │ CMD CENTER  │    │  DASHBOARD  │                  │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                  │
│         │                  │                  │                          │
│         ▼                  ▼                  ▼                          │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │              PROJECTION SURFACE LAYER                        │        │
│  │  ┌──────────────────┐  ┌──────────────────┐                 │        │
│  │  │ CATALOG SURFACES │  │ PICK SURFACES    │                 │        │
│  │  │ mv_props_for_form│  │ view_picks_*     │                 │        │
│  │  │ mv_search_*      │  │ view_picks_stuck │                 │        │
│  │  │ view_catalog_*   │  │ v_recent_promo   │                 │        │
│  │  │ view_events_*    │  │ v_promo_backlog  │                 │        │
│  │  └──────────────────┘  └──────────────────┘                 │        │
│  │  ┌──────────────────┐  ┌──────────────────┐                 │        │
│  │  │ OPS SURFACES     │  │ ANALYTICS        │                 │        │
│  │  │ view_ops_metrics │  │ mv_capper_rollup │                 │        │
│  │  │ view_pipeline_*  │  │ v_capper_streaks │                 │        │
│  │  │ agent_health*    │  │ view_analytics_* │                 │        │
│  │  └──────────────────┘  └──────────────────┘                 │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                                  │                                       │
│                                  ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │              CANONICAL OPERATIONAL LAYER                     │        │
│  │  unified_picks | raw_props | events | teams | players | ... │        │
│  │  (NEVER QUERIED DIRECTLY BY UI)                              │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                                                                          │
│  * Exception: agent_health for ops monitoring                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 12. Approval & Sign-off

| Role             | Name | Date | Signature |
| ---------------- | ---- | ---- | --------- |
| Architect        |      |      |           |
| Engineering Lead |      |      |           |
| DBA              |      |      |           |

---

**Document Status**: DRAFT - Pending Review **Next Steps**: Architecture review,
then implementation sprint
