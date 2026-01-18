# API Provider Configuration (Odds API–First)

**Date:** 2025-11-20  
**Charter:** docs/PRODUCTION_CHARTER.md (v3.0.0, canonical-first)

This document is the **authoritative specification** for external odds provider
configuration and priority for the Unit Talk platform.

- **Primary provider for all live ingestion:** The Odds API
- **Secondary / experimental provider:** Optimal API (player-prop specialist,
  only when explicitly forced)
- **Canonical routing implementation:**
  `apps/api/src/agents/FeedAgent/dataSourceRouter.ts`

---

## 1. Environment Variables

All provider configuration is controlled via environment variables. For
production parity across environments, use **`.env.shared`** as the canonical
source; `.env` and `.env.local` may override for local-only testing.

```bash
# The Odds API (PRIMARY)
ODDS_API_KEY=YOUR_PRODUCTION_ODDS_API_KEY

# Optional: configure credit limits (defaults assume 5,000,000/month)
ODDS_API_MONTHLY_LIMIT=5000000      # Total monthly requests
# ODDS_API_DAILY_BUDGET can override the computed daily budget
# ODDS_API_DAILY_BUDGET=200000

# Optimal API (SECONDARY / EXPERIMENTAL)
OPTIMAL_API_KEY=your_optimal_key_here
```

**Precedence (highest → lowest):**

1. `.env.shared`
2. `.env.local`
3. `.env`

The Odds API key defined in **`.env.shared`** is what the containers use by
default. There are **no hard-coded API keys** in the code any more; if
`ODDS_API_KEY` is missing, Odds API calls will fail fast with a clear error.

---

## 2. Routing Strategy (Authoritative)

The routing strategy is implemented in
`apps/api/src/agents/FeedAgent/dataSourceRouter.ts` and enforced by
`SPORT_ROUTING_CONFIG` plus the `determineDataSource` function.

**Core rules (v3.0.0 production):**

1. **Odds API is primary for all sports** covered by the platform
   (NFL/NBA/MLB/NHL/NCAAF/WNBA/EPL/ATP, etc.).
2. **Player props** use Odds API by default; Optimal API is only used when
   `forceSource: 'optimal-api'` is explicitly specified.
3. **Settlement data** always uses Odds API.
4. **Unknown sports** fall back to Odds API for maximum coverage.

Conceptual view (mirrors the actual TypeScript config):

```typescript
const PROVIDER_ROUTING = {
  NFL:  { primary: 'odds-api', secondary: 'optimal-api' },
  NBA:  { primary: 'odds-api', secondary: 'optimal-api' },
  MLB:  { primary: 'odds-api', secondary: 'optimal-api' },
  NHL:  { primary: 'odds-api', secondary: 'optimal-api' },
  NCAAF:{ primary: 'odds-api', secondary: null },
  WNBA: { primary: 'odds-api', secondary: null },
  EPL:  { primary: 'odds-api', secondary: null },
  ATP:  { primary: 'odds-api', secondary: null },
};
```

The `getRoutingInfo()` helper exposes this configuration for diagnostics and is
used by `apps/api/scripts/test-odds-api-integration.ts`.

---

## 3. Credit Monitoring & Limits

Credit monitoring for The Odds API is implemented in
`apps/api/src/agents/FeedAgent/oddsApi.ts`.

Key behavior:

- Uses **`ODDS_API_MONTHLY_LIMIT`** and **`ODDS_API_DAILY_BUDGET`** if set.
- Defaults to **5,000,000 monthly requests** with a computed daily budget
  (`monthly_limit / 30`) when not set.
- `getCreditUsageStatus()` returns a structured view consumed by tests and
  health checks.
- `canMakeRequest()` enforces soft guardrails before making outbound calls.

The **E2E production pipeline** and the **Odds API integration test suite** are
credit-aware and designed to use a tiny fraction of the monthly budget.

---

## 4. Operational Commands

All commands are **Docker-first** and must be executed from the workspace root.

### 4.1. Test Odds API Integration

```bash
# From workspace root
docker-compose exec api sh -lc "cd /app/apps/api && npx tsx scripts/test-odds-api-integration.ts"
```

This script validates:

- API connectivity and authentication
- Sports discovery and key sports (NFL/NBA/NCAAF)
- Unified data routing (`fetchUnifiedData`)
- Settlement data fetching
- Credit usage monitoring and system status

### 4.2. E2E Production Pipeline Test

```bash
# Single-command end-to-end pipeline test
bash dev.sh test:e2e-production
```

This uses the Odds API–first routing, processes props through the professional
system, writes canonical `picks` + `pick_publish`, and produces a summary report
under `out/ops/cutover/metrics/e2e-production/`.

---

## 5. Source of Truth

- **Routing + provider priority:**
  `apps/api/src/agents/FeedAgent/dataSourceRouter.ts`
- **Odds API integration + credit monitoring:**
  `apps/api/src/agents/FeedAgent/oddsApi.ts`
- **Operational validation:**
  - `apps/api/scripts/test-odds-api-integration.ts`
  - `scripts/ops/e2e-production-pipeline.js`

Any future changes to provider priority **must** update this document and the
above code locations together, under the governance of
`docs/PRODUCTION_CHARTER.md`.

