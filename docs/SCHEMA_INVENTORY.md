# DB Schema Inventory

This tool inventories the Unit Talk Supabase/Postgres database schema and produces both JSON and Markdown summaries with configurable output modes.

- **Non-destructive, read-only** - Safe for production use
- **Type-safe with explicit interfaces** - Full TypeScript validation
- **CLI flags support** - Configurable schema and output modes
- **Windows/Linux compatible** - Cross-platform path handling

## Quick Start

### Basic Usage

```bash
# Install dependencies (root level, one-time)
npm ci

# Run with default settings (public schema, full mode)
npm run db:inventory

# Or use ts-node directly
npx ts-node scripts/db/inventory-schema.ts
```

### CLI Flags

The tool supports the following command-line flags:

```bash
# Specify schema (default: public)
npm run db:inventory -- --schema=public
npm run db:inventory -- --schema=auth

# Set markdown output mode (default: full)
npm run db:inventory -- --md=full      # Complete details
npm run db:inventory -- --md=compact   # Truncated for readability

# Combine flags
npm run db:inventory -- --schema=public --md=compact
```

## Configuration

### Environment Variables

The script attempts to connect using these variables in order of preference:

1. **`SUPABASE_DB_URL`** (preferred) - Direct PostgreSQL connection string
2. **`DATABASE_URL`** (fallback) - Alternative database connection string
3. **Supabase Client** (fallback) - Uses existing configured client with these variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

### Connection Priority

1. **Direct PostgreSQL** via `SUPABASE_DB_URL` or `DATABASE_URL` (fastest, most comprehensive)
2. **Supabase REST API** via PostgREST system tables (fallback, limited access)
3. **Placeholder output** if no connection available (graceful degradation)

## Output Modes

### Full Mode (`--md=full`)

- Complete table details with all columns and indexes
- All indexes listed individually
- Per-table index breakdowns
- Suitable for detailed analysis

### Compact Mode (`--md=compact`)

- Summary statistics at top
- First 15 indexes with collapsible details for remaining
- Truncated per-table index lists
- Suitable for CI artifacts and quick reviews

## What It Collects

### Data Sources

- **Tables** - All user tables in specified schema
- **Views** - All views in specified schema  
- **Indexes** - All indexes including primary keys, foreign keys, and custom indexes
- **Row Counts** - Approximate counts via `pg_stat_user_tables.n_live_tup` or `pg_class.reltuples`

### Safety Features

- **Read-only queries** - No DDL/DML operations performed
- **Connection validation** - Warns on unexpected database hosts
- **Graceful fallbacks** - Multiple query strategies with error handling
- **Type safety** - Explicit interfaces for all database row shapes

## Output Files

Files are written to: `out/db/`

- **`schema-inventory.json`** - Structured data for programmatic access
- **`schema-inventory.md`** - Human-readable summary with tables

### JSON Structure

```json
{
  "generatedAt": "2025-09-12T12:34:56.789Z",
  "ok": true,
  "schema": "public",
  "mode": "full",
  "summary": {
    "totalTables": 15,
    "totalViews": 3,
    "totalIndexes": 47
  },
  "tables": [
    {
      "name": "raw_props",
      "rows": 124523,
      "columns": ["id", "game_id", "player_id", "line", "odds", "inserted_at"],
      "indexes": ["raw_props_pkey", "idx_raw_props_inserted_at", "idx_raw_props_processed_at"]
    }
  ],
  "views": ["view_enriched_daily_picks", "view_roi_by_tier"],
  "indexes": ["raw_props_pkey", "idx_unified_picks_settled_at", "users_pkey"]
}
```

### Markdown Sample

```markdown
# DB Schema Inventory

**Generated:** 2025-09-12T12:34:56.789Z  
**Schema:** public  
**Mode:** full  

## Summary

| Metric | Count |
|--------|-------|
| Tables | 15 |
| Views | 3 |
| Indexes | 47 |

## Tables

| Table | Rows≈ | Columns | Indexes |
|-------|-------|---------|---------|
| raw_props | 124,523 | 6 | 3 |
| unified_picks | 89,234 | 8 | 5 |

## All Indexes

- raw_props_pkey
- idx_raw_props_inserted_at
- idx_raw_props_processed_at
- unified_picks_pkey
- idx_unified_picks_settled_at
```

## Examples

### Development Usage

```bash
# Quick check of current schema
npm run db:inventory

# Check a specific schema with compact output for readability
npm run db:inventory -- --schema=auth --md=compact

# Full analysis of public schema
npm run db:inventory -- --schema=public --md=full
```

### CI/CD Integration

The tool is designed for CI/CD pipelines:

```yaml
# .github/workflows/ci.yml
- name: Generate Schema Inventory
  run: |
    npm run db:inventory -- --md=compact
    
- name: Upload Schema Artifact
  uses: actions/upload-artifact@v3
  with:
    name: schema-inventory
    path: out/db/schema-inventory.json
```

### Troubleshooting

#### No Database Connection

If you see: `No DB connection available`, ensure you have:

1. Set `SUPABASE_DB_URL` or `DATABASE_URL` environment variable
2. Or configured `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` for Supabase client
3. Network access to the database (if running in CI/CD)

The script will gracefully create placeholder files with warnings rather than failing.

#### Permission Issues

The script only reads from:
- `pg_catalog` (system catalogs)
- `information_schema` (standard schema metadata)  
- `pg_indexes`, `pg_stat_user_tables` (system views)

Ensure your database user has `SELECT` permission on these system views.

#### TypeScript Compilation

The script is designed to compile cleanly with your project's TypeScript configuration:

```bash
# Verify compilation
npx tsc --noEmit scripts/db/inventory-schema.ts

# Run with explicit ts-node config
npx ts-node --project tsconfig.json scripts/db/inventory-schema.ts
```

## Security Considerations

- **No write operations** - Script performs only read queries
- **Connection string validation** - Warns on unexpected database hosts
- **SQL injection protection** - Uses parameterized queries where possible
- **Minimal permissions required** - Only needs read access to system tables

---

**Tool Owner:** Platform Engineering Team  
**Last Updated:** September 2025  
**Next Review:** Quarterly schema review