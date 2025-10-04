# Database Operations Guide

**Last Updated**: 2025-10-01
**Purpose**: Supabase Cloud operations for E2E and production workflows

---

## Supabase CLI Discipline

### Configuration Files

- `.supabase/config.cloud.toml` → Cloud project (production/E2E)
- `.supabase/config.local.toml` → Local emulator (optional, not currently used)

### Critical Commands

**ALWAYS** use `--local-config` flag to avoid accidentally targeting wrong database:

```bash
# Link to cloud project
supabase link --project-ref lxqmuzmqtnnlpfapvief --local-config .supabase/config.cloud.toml

# Pull current schema from cloud
supabase db pull --local-config .supabase/config.cloud.toml

# Generate migration from schema diff
supabase db diff --use-migra -f "supabase/migrations/$(date +%Y%m%d%H%M%S)_reconcile.sql" --local-config .supabase/config.cloud.toml

# Push migrations to cloud
supabase db push --local-config .supabase/config.cloud.toml

# Reset remote database (DESTRUCTIVE - use with caution)
supabase db reset --local-config .supabase/config.cloud.toml
```

### NPM Script Wrappers

```bash
# Run database health check
npm run db:health

# Push migrations to cloud (uses correct config automatically)
npm run db:push:cloud
```

---

## Schema Management

### Baseline Migration

The baseline migration (`supabase/migrations/20251001_000000_baseline_saas.sql`) establishes:

- **Tables**: `games`, `unified_picks`
- **Indexes**: Performance and deduplication indexes
- **RLS**: Row-level security enabled (service role bypasses)
- **Policies**: Minimal read policies for authenticated users

### Adding New Migrations

1. **Make schema changes locally** (if using local dev mode)
2. **Generate diff migration**:
   ```bash
   supabase db diff --use-migra -f "supabase/migrations/$(date +%Y%m%d%H%M%S)_your_change.sql" --local-config .supabase/config.cloud.toml
   ```
3. **Review the generated SQL** in `supabase/migrations/`
4. **Test locally** (optional): Apply to local DB and verify
5. **Push to cloud**:
   ```bash
   npm run db:push:cloud
   ```

### Verifying Migrations

```bash
# Check migration status
supabase migration list --local-config .supabase/config.cloud.toml

# Verify schema health
npm run db:health
```

---

## Row Level Security (RLS)

### Current Configuration

- **RLS Enabled**: Yes, on `games` and `unified_picks`
- **Service Role**: Bypasses RLS automatically (used by API in production)
- **Read Policies**: Allow authenticated users to SELECT

### Important Notes

- **DO NOT** disable RLS in production
- **Service role key** bypasses RLS for write operations
- **Anon key** respects RLS for public read-only access

---

## Troubleshooting

### "Relation does not exist" Error

**Cause**: Tables not created in cloud database
**Fix**:
```bash
npm run db:push:cloud
npm run db:health
```

### "Permission denied" Error

**Cause**: RLS blocking query or insufficient permissions
**Fix**:
- Verify using `SUPABASE_SERVICE_ROLE_KEY` (not anon key)
- Check RLS policies are configured correctly

### Stale Schema

**Cause**: Local and cloud schemas out of sync
**Fix**:
```bash
# Pull latest from cloud
supabase db pull --local-config .supabase/config.cloud.toml

# Or push local changes to cloud
npm run db:push:cloud
```

---

## Emergency Procedures

### Complete Schema Reset (DESTRUCTIVE)

⚠️ **WARNING**: This deletes ALL data in the database

```bash
# Backup data first
supabase db dump --local-config .supabase/config.cloud.toml > backup_$(date +%Y%m%d).sql

# Reset to migrations
supabase db reset --local-config .supabase/config.cloud.toml
```

### Green Cutover (New Project)

If schema drift is irreparable:

1. Create new Supabase project ("Green")
2. Update `.env.cloud` with new project URL and keys
3. Update `.supabase/config.cloud.toml` with new project_id
4. Run baseline migration:
   ```bash
   npm run db:push:cloud
   ```
5. Verify with health check:
   ```bash
   npm run db:health
   ```
6. Run E2E to populate data:
   ```bash
   npm run e2e
   ```
7. Import historical data (if needed)

---

## Best Practices

1. **Always use `--local-config`** flag to avoid targeting wrong database
2. **Test migrations locally** before pushing to cloud (if possible)
3. **Review generated SQL** before applying
4. **Keep migrations idempotent** (safe to run multiple times)
5. **Use service role key** for server-side operations
6. **Never commit secrets** to git (`.env.cloud` is gitignored)

---

## References

- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [Migration Guide](https://supabase.com/docs/guides/cli/managing-environments)
- [RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
