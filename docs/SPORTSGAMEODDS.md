# SportsGameOdds (SGO) Live Ingestion

This document explains how to configure and run the SportsGameOdds (SGO) live ingestion to load today's games and props into the database, trigger scoring, and surface status in Command Center.

## 1) Configuration

Set the following environment variables (e.g., in .env or your deployment environment):

- SPORTSGAMEODDS_KEY: API key for SGO
- SPORTSGAMEODDS_BASE_URL (optional): Override base URL (default: https://api.sportsgameodds.com)
- SUPABASE_URL: Supabase project URL
- SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (server-side only)

Example .env snippet:

```
SPORTSGAMEODDS_KEY=sk_live_xxx
SPORTSGAMEODDS_BASE_URL=https://api.sportsgameodds.com
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

## 2) Database Migrations

The migration file at supabase/migrations/20250912_sgo_init.sql will:

- Create public.games for cross-provider game metadata
- Add raw_props columns if missing: source (default 'sgo'), external_game_id, external_prop_id
- Add unique index on (source, external_game_id, external_prop_id) for idempotent upserts
- Create public.historical_config to control hot/cold archival windows by sport
- Create archive.raw_props as a structural copy of public.raw_props

Run migrations:

```
npm run db:migrate:sgo
```

This uses `supabase migration up` and is safe/idempotent.

## 3) Live Ingestion

Start live ingestion for all sports:

```
npm run db:ingest:sgo:live
```

This will:

- Fetch today's games and props from SGO
- Upsert into public.games (on external_game_id)
- Upsert into public.raw_props (on source, external_game_id, external_prop_id)
- Mark all inserted props with source = 'sgo'
- Trigger ScoringAgent automatically (best-effort)
- If any games are already final, attempt to trigger SettlementAgent (best-effort)

Command-line options:

- --sports=all (default) – provider-dependent comma list also supported

## 4) Backfill vs Live

- Live ingestion (recommended daily):
  - `npm run db:ingest:sgo:live`
- Backfill: create a simple script referencing apps/worker/src/workflows/liveSportsGameOdds.ts with a date range and reuse the same upsert logic. Name the script db:backfill:sgo for consistency.

Note: A specific backfill script is not included here to keep this change focused. If you need it, ask to add `db:backfill:sgo` with date-interval support.

## 5) Monitoring with Command Center

Command Center displays ingestion health via /api/monitoring. We added a new data source key `sgo` that checks public.raw_props for source = 'sgo' and reports:

- Time since last record
- Records in last hour / 24 hours
- Health classification (healthy, stale, critical, no_data)

No UI changes are required; the existing monitoring page will include this source in its backend summary.

## 6) Safety Notes

- Idempotent inserts:
  - games: upsert on external_game_id
  - raw_props: upsert on (source, external_game_id, external_prop_id)
- Read-only schema inventory:
  - Use `npm run db:inventory` to print a schema overview
- Archive-ready:
  - archive.raw_props is created as a structural copy for future lifecycle moves

## 7) Troubleshooting

- No data appears:
  - Verify SPORTSGAMEODDS_KEY is set and valid
  - Check network/ingress to SPORTSGAMEODDS_BASE_URL
- Supabase errors:
  - Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set
  - Run `npm run db:inventory` to confirm tables and indexes
- Command Center shows stale/critical:
  - Confirm `raw_props.source = 'sgo'` records are arriving
  - The health auto-recovers as new records arrive

