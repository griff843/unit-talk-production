# Ingestion Freshness Policy — Current System

> Generated: 2026-03-07 | Sprint: SPRINT-SYSTEM-DOCUMENTATION-FOUNDATION

---

## Overview

The ingestion system enforces freshness rules to prevent stale, duplicate, or
invalid props from entering the pipeline. Rules are applied at multiple layers:
provider fetch, validation, normalization, and database insertion.

---

## Duplicate Filtering

**File**: `apps/api/src/agents/IngestionAgent/isDuplicate.ts`

### 24-Hour Lookback Window

```
duplicateCheckWindow = 86400000 ms (24 hours)
```

A prop is considered duplicate if a row exists in `raw_props` with matching:

- `player_name`
- `stat_type`
- `line`
- `sport`
- `source` (provider)
- `created_at` within the last 24 hours

### Database-Level Uniqueness

`raw_props.external_id` has a UNIQUE constraint. Composite keys prevent
collisions:

- SGO: `sgo:{eventID}:{marketKey}:{playerName}`
- Odds API: `game.id`
- Optimal: `prop.id || crypto.randomUUID()`

---

## Provider Refresh Expectations

| Provider    | Ingestion Cycle             | Data Freshness        | Notes                      |
| ----------- | --------------------------- | --------------------- | -------------------------- |
| SGO         | Every 2 min (via scheduler) | Now to +24 hours      | Rate limited: 10 req/min   |
| Odds API    | Every 2 min (via scheduler) | Current odds snapshot | Credit-limited: ~500/month |
| Optimal API | Every 2 min (via scheduler) | Current player props  | Rate limited: 900 req/hour |

### Scheduler Intervals

**File**: `apps/api/src/workflows/syndicate-scheduler.ts`

| Mode   | Interval  | Trigger             |
| ------ | --------- | ------------------- |
| Normal | 2 minutes | Default             |
| Live   | 1 minute  | Live games detected |
| Idle   | 5 minutes | No live games       |

---

## Validation Rules

**File**: `apps/api/src/agents/IngestionAgent/validation.ts`

### Error-Level (prop rejected)

| Check                | Rule                                     |
| -------------------- | ---------------------------------------- |
| Player/team identity | Must have either `player_name` OR `team` |
| Stat type            | `stat_type` must be present              |
| Line                 | `line` must be present                   |

### Warning-Level (prop accepted with flag)

| Check     | Rule                                          |
| --------- | --------------------------------------------- |
| Odds data | `over_odds` or `under_odds` should be present |
| Game date | `game_date` should be present                 |

---

## Market Eligibility

### Supported Market Types

| Market                    | Provider Support |
| ------------------------- | ---------------- |
| Player props (over/under) | SGO, Optimal API |
| Moneyline (h2h)           | Odds API         |
| Spread                    | Odds API         |
| Game total                | Odds API         |

### Stat Types (player props)

Common stat types ingested from SGO:

- points, rebounds, assists, steals, blocks
- threePointersMade, freeThrowsAttempted
- turnovers, blocks+steals, points+assists
- (combo stats supported via SGO pairing)

---

## Staleness Detection

### Edge Engine Staleness

**File**: `apps/api/src/agents/ScoringAgent/scoring/edgeEngineV1.ts`

The scoring engine flags props with stale lines:

```
flags.push('stale_line')    // Line hasn't moved in expected window
flags.push('stale_opening') // Opening line data is outdated
```

### AuditAgent Staleness Check

**File**: `apps/api/src/agents/AuditAgent/index.ts`

AuditAgent checks for stale records:

- Props with `processed_at` older than 48 hours in pending status are flagged
- Generates `stale_pick_{id}` audit incident

### AlertAgent Stale Line Detection

**File**: `apps/api/src/agents/AlertAgent/utils/detection.ts`

Detects stale lines and generates Discord alerts when market values haven't
updated.

---

## Provider-Specific Freshness Rules

### SGO

- Date range: `now` to `now + 24 hours` (upcoming events only)
- Events must have `oddsAvailable=true`
- 6-second delay between requests (rate limit compliance)
- Props for past events are not fetched

### Odds API

- Returns current odds snapshot (no historical)
- Credit usage logged to `api_credit_log`
- Cache: 90-second Redis TTL via `offersCache.ts` (for provider_offers path)
- Stale cache returns cached data without API call

### Optimal API

- Returns current player props
- Sport detection from game_id prefix
- Single-sided odds estimated when only one side available

---

## Circuit Breaker

**File**: `apps/api/src/agents/FeedAgent/activities/index.ts`

| Parameter         | Value                   |
| ----------------- | ----------------------- |
| Failure threshold | 10 consecutive failures |
| Timeout           | 10 minutes              |
| Reset             | Automatic after timeout |

When circuit breaker is open:

- Returns `{ success: false, source: 'circuit-breaker' }` immediately
- No API calls made
- Automatically resets after 10-minute timeout

---

## Data Flow Summary

```
Provider API
  |
  v
dataSourceRouter (provider selection)
  |
  v
Validation (reject if missing required fields)
  |
  v
Normalization (UUID generation, defaults, type conversion)
  |
  v
Duplicate check (24h window + external_id uniqueness)
  |
  v
raw_props INSERT (batch, 100 per batch)
  |
  v
GradingAgent picks up WHERE processed_at IS NULL
```
