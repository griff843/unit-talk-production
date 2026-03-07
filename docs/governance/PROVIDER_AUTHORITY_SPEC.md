# Provider Authority Spec

Status: CANONICAL Authority: Tier 1 Owner: Platform Architecture Last Verified:
2026-03-07 Sprint: SPRINT-DOCS-CANONICALIZATION-040

---

## Overview

Unit Talk ingests odds data from two external providers. The DataSourceRouter
determines which provider handles each league and market type, with automatic
failover for leagues that have a secondary provider.

---

## Providers

### Optimal API (optimal-api)

- **Purpose**: Primary source for player props (NFL, NBA, MLB, NHL)
- **Base URL**: `https://api.optimal-bet.com`
- **Auth**: API key via header (`OPTIMAL_API_KEY`)
- **Rate Limit**: 900 requests/hour (15/minute)
- **Timeout**: 30 seconds
- **Retry**: 3 attempts, exponential backoff (1s base)

**Endpoints**:

- `/v1/playerPropTypes` — available prop types
- `/v1/playerProps/{sport}` — player props by sport
- `/v1/gamelines/{sport}` — game lines
- `/v1/events` — available events

### The Odds API (odds-api)

- **Purpose**: Comprehensive odds coverage, settlement data, college/WNBA
  exclusives
- **Base URL**: `https://api.the-odds-api.com/v4`
- **Auth**: API key via query param (`ODDS_API_KEY`)
- **Rate Limit**: Configurable RPM (default 60, env `ODDS_API_RPM`)
- **Credit Model**: Monthly budget with daily throttling
- **Timeout**: 30 seconds
- **Retry**: 3 attempts, exponential backoff (1s base)

**Endpoints**:

- `/sports` — available sports
- `/odds` — odds for sport + market
- `/scores` — game results (settlement)

**Credit Controls**:

- Monthly limit: env `ODDS_API_MONTHLY_LIMIT` (default 5,000,000)
- Minimum remaining: env `ODDS_API_MIN_REMAINING` (default 25)
- Emergency freeze: env `ODDS_API_EMERGENCY_FREEZE=1` disables live calls
- Below threshold: cache-only mode

---

## League Routing Table

**Source**: `apps/api/src/agents/FeedAgent/dataSourceRouter.ts`

| League | Primary     | Secondary | Markets                                   |
| ------ | ----------- | --------- | ----------------------------------------- |
| NFL    | optimal-api | odds-api  | player-props, spreads, totals, moneylines |
| NBA    | optimal-api | odds-api  | player-props, spreads, totals, moneylines |
| MLB    | optimal-api | odds-api  | player-props, spreads, totals, moneylines |
| NHL    | optimal-api | odds-api  | player-props, spreads, totals, moneylines |
| NCAAF  | odds-api    | —         | spreads, totals, moneylines, futures      |
| NCAAB  | odds-api    | —         | spreads, totals, moneylines, futures      |
| WNBA   | odds-api    | —         | spreads, totals, moneylines               |
| EPL    | odds-api    | —         | moneylines, totals                        |
| ATP    | odds-api    | —         | moneylines                                |

**Settlement**: Always from Odds API (Optimal API does not support settlement
data).

---

## Failover Behavior

1. Router selects primary provider based on sport + market type
2. Primary provider is attempted first
3. On failure, secondary provider is attempted (if configured)
4. Both failures → empty data with logged errors
5. No workflow-level fallback (removed in TD-4, SPRINT-035B)

**Failover is internal to DataSourceRouter** — workflows see a single
`ingestUnifiedData` activity.

---

## Circuit Breaker

**File**: `apps/api/src/services/enhanced-circuit-breaker.ts`

| Setting                | Value             |
| ---------------------- | ----------------- |
| Failure threshold      | 5 failures → OPEN |
| Reset timeout          | 60 seconds        |
| Half-open max requests | 3                 |
| Operation timeout      | 10 seconds        |

**Activity-level breaker** (in FeedAgent activities):

| Setting               | Value                   |
| --------------------- | ----------------------- |
| Threshold             | 10 consecutive failures |
| Cooldown              | 10 minutes              |
| Per-provider tracking | Yes                     |

**States**: CLOSED (normal) → OPEN (blocked) → HALF_OPEN (recovery)

---

## Rate Limiting & Quota

**Token Bucket** (`ProviderGateway.ts`):

- Per-provider token buckets
- Default RPM: 60 (configurable)
- Automatic refill based on elapsed time

**Request Deduplication**:

- Concurrent requests with same `dedupKey` return same promise
- Prevents duplicate API calls within same timeframe

**Caching**:

- Default TTL: 120 seconds (env `ODDS_EVENT_CACHE_TTL_SECONDS`)
- Cache-first strategy before rate limit/credit checks
- Redis-backed for distributed caching

---

## Provider Health

**Endpoint**: `/health/provider`

| Metric                                      | Description                         |
| ------------------------------------------- | ----------------------------------- |
| `providerCircuitBreakerState`               | 0=CLOSED, 0.5=HALF_OPEN, 1=OPEN     |
| `externalApiCalls`                          | Count by provider, endpoint, status |
| `externalApiDuration`                       | Histogram by provider, endpoint     |
| `externalApiErrors`                         | Count by provider, status code      |
| `providerCacheHits` / `providerCacheMisses` | Cache performance                   |
| `providerCreditsUsed`                       | Credit consumption                  |
| `providerBudgetRemainingPercent`            | Budget gauge                        |

**Data Freshness**: fresh (<15m), stale (<60m), critical (>60m)

---

## Agent Integration

| Agent           | Provider Usage              | Method               |
| --------------- | --------------------------- | -------------------- |
| FeedAgent       | Both (via DataSourceRouter) | `fetchUnifiedData()` |
| IngestionAgent  | Both (via DataSourceRouter) | `fetchRawProps()`    |
| SettlementAgent | Odds API only               | Settlement scores    |

**Data Pipeline**:

```
FeedAgent / IngestionAgent
  → dataSourceRouter.fetchUnifiedData()
    → providerGateway.request()
      → Circuit breaker check
      → Token bucket rate limit
      → Cache check
      → Quota coordinator approval
      → HTTP request
      → Metrics recording
```

---

## Environment Variables

| Variable                       | Required | Default   | Purpose                          |
| ------------------------------ | -------- | --------- | -------------------------------- |
| `ODDS_API_KEY`                 | Yes      | —         | The Odds API key                 |
| `OPTIMAL_API_KEY`              | Yes      | —         | Optimal API key                  |
| `ODDS_API_RPM`                 | No       | 60        | Requests per minute              |
| `ODDS_API_MONTHLY_LIMIT`       | No       | 5,000,000 | Monthly credit budget            |
| `ODDS_API_MIN_REMAINING`       | No       | 25        | Min credits before cache-only    |
| `ODDS_API_EMERGENCY_FREEZE`    | No       | —         | Set to `1` to disable live calls |
| `ODDS_EVENT_CACHE_TTL_SECONDS` | No       | 120       | Cache TTL                        |

---

## Key Files

| File                                   | Purpose                                         |
| -------------------------------------- | ----------------------------------------------- |
| `agents/FeedAgent/dataSourceRouter.ts` | League-to-provider routing                      |
| `agents/FeedAgent/oddsApi.ts`          | Odds API client                                 |
| `agents/FeedAgent/optimal.ts`          | Optimal API client                              |
| `services/provider/ProviderGateway.ts` | Gateway with circuit breaker, rate limit, cache |
| `services/enhanced-circuit-breaker.ts` | Circuit breaker implementation                  |
| `routes/health/provider.ts`            | Provider health endpoint                        |

---

## Related Documents

- [Canonical Runtime Path](../system/CANONICAL_RUNTIME_PATH.md)
- [Workflow Activity Contract](./WORKFLOW_ACTIVITY_CONTRACT.md)
- [System Overview](../system/SYSTEM_OVERVIEW.md)
