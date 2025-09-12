## DB Schema Inventory

This tool inventories the Unit Talk Supabase/Postgres database schema (public schema only) and produces both JSON and Markdown summaries.

- Non-destructive, read-only
- Safe to run in production
- Uses the existing Supabase client in `apps/api/src/services/supabaseClient`

### How to run

- One-time install (root): `npm ci`
- Run the inventory:
  - `npm run db:inventory`

The script is Windows-safe and runs via ts-node.

### Environment variables

The script prefers connecting directly to Postgres using:

- `SUPABASE_DB_URL` (preferred)
- `DATABASE_URL` (fallback)

It also uses the standard Supabase client for environment sanity checks:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

If no DB URL is available and the Supabase client is not configured, the script exits gracefully (status 0), logs a clear warning, and still writes placeholder outputs so CI can upload the artifact.

### What it collects

- Tables (schema: public)
- Views (schema: public)
- Indexes (schema: public)
- Approximate row counts (via `pg_stat_user_tables.n_live_tup`)

No DDL/DML is executed.

### Outputs

Files are written to:

- JSON: `out/db/schema-inventory.json`
- Markdown: `out/db/schema-inventory.md`

The JSON structure resembles:

```
{
  "tables": [
    {
      "name": "raw_props",
      "rows": 124523,
      "columns": ["id", "game_id", "player_id", "line", "odds", "inserted_at", "processed_at"],
      "indexes": ["idx_raw_props_inserted_at", "idx_raw_props_processed_at"]
    }
  ],
  "views": ["view_enriched_daily_picks", "view_roi_by_tier"],
  "indexes": ["idx_unified_picks_settled_at"]
}
```

### CI integration

The CI workflow runs this tool and uploads `out/db/schema-inventory.json` as an artifact. See `.github/workflows/ci.yml`.

