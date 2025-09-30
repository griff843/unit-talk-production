## Database Readiness (SaaS-Grade)

This document summarizes the canonical schema, archival/retention policy, and operational hooks required to run Unit Talk in a production, SaaS-grade posture.

### Canonical Pipeline
- games → unified_picks is the canonical flow.
  - games: canonical game metadata with external_game_id for provider alignment.
  - unified_picks: canonical pick records (core fields ensured), with settlement timestamps and external IDs for cross-system joins.

### raw_props Role
- raw_props acts as staging for ingestion. During migration windows, if a table does not exist, a compatibility view is created:
  - CREATE OR REPLACE VIEW public.raw_props AS SELECT * FROM public.unified_picks;
- If a raw_props table exists, it is preserved. Legacy rows are archived automatically per policy (see Archival Strategy).

### Retention and Archival Policy
- Schema archive is created automatically: schema archive if not exists.
- archive.raw_props is created as a structural clone of public.raw_props (LIKE if table, CTAS WITH NO DATA if view).
- Legacy rows are moved from public.raw_props to archive.raw_props when either is true:
  - source IS NULL
  - inserted_at < now() - interval '30 days' (fallback to created_at if inserted_at not present)
- Movement is idempotent and safe:
  - Only rows not already present in archive are inserted.
  - Deletion from public occurs only for rows successfully inserted into archive in the same transaction.

Manual archival run (optional):
- Execute scripts/db/archive-raw-props.sql against the database (psql or Supabase SQL editor). Safe to run multiple times.

### Indexes and Performance
- games: idx_games_date_sport on (sport, game_date)
- unified_picks:
  - idx_unified_picks_external_ids on (external_game_id, external_prop_id)
  - idx_unified_picks_settled_at on (settled_at)

### Schema Inventory Hook
- The repository provides a read-only inventory tool that inspects pg_catalog and information_schema and writes artifacts to out/db/:
  - JSON: out/db/schema-inventory.json
  - Markdown: out/db/schema-inventory.md

How to run (Docker-first):
- From monorepo root:
  - docker-compose exec api npm run db:inventory
  - or: npm run db:inventory (if environment is already wired locally)

Flags:
- --schema=public (default)
- --md=compact|full (default: full)

### Acceptance Checklist
- games, unified_picks, settlement_jobs, historical_config exist.
- raw_props exists (backed by table or compatibility view).
- archive schema exists and legacy raw_props rows are moved per policy.
- Required indexes exist for games and unified_picks.
- Inventory artifacts are generated under out/db/.

### Notes
- All migrations are non-destructive and idempotent (CREATE IF NOT EXISTS / ALTER ADD IF NOT EXISTS).
- The compatibility view guarantees application code can compile/operate while the migration is completed.
- The archival logic auto-detects available timestamp columns and skips gracefully if none are present.

