# Cache-First Provider Layer

Objective: Reduce external API calls and ensure deterministic per-game snapshots using Redis with strict TTLs.

Pattern:
1) Attempt Redis snapshot by external_game_id
2) On miss, fetch from provider (e.g., OddsAPI)
3) Write snapshot to Redis with TTL (CACHE_TTL_SNAPSHOTS)
4) Log credits via RPC: log_credit_usage(provider, credits)
5) Optionally write quotes via RPC: write_book_quote(...)

Libraries:
- packages/shared-utils/src/cache/redisClient.ts
- packages/shared-utils/src/providers/cachedOddsApiClient.ts

Environment:
- REDIS_URL
- CACHE_TTL_SNAPSHOTS (seconds)

Discipline:
- Snapshot is entire game payload; avoid partial-key sprawl
- Avoid per-market keys; normalize in DB if needed
- Keep TTL short (60–120s) unless provider limits require longer
- Never block ingestion if Redis is unavailable

Runbook:
- Validate Redis connectivity via Command Center /health
- Observe ops.credit_usage for provider call deltas post-deploy
- If cache poisoning suspected, flush only relevant keys (game:*)
- Rollback path: bypass cache by temporary feature flag or TTL=0



## Credit Usage RPC

- RPC: `public.log_credit_usage(provider, credits)`
- Behavior: idempotent hour-bucketed aggregation into `ops.credit_usage`
- Exposure: granted to `anon`, `authenticated`, `service_role`
- Deployment: Supabase migration at `supabase/migrations/20250926_enable_rpc_credit_logging.sql`
- Verification:
  - Run FeedAgent runner to trigger cache-miss fetches
  - Query `select provider, sum(credits), sum(calls) from ops.credit_usage group by provider;`
