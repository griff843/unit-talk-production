# Environment Audit - Supabase Projects

**Date:** 2026-01-17
**Auditor:** Production Release Engineer
**Status:** Environment Identification Complete

## Project Identification

### PRODUCTION (Original - Upgraded)
- **Project Ref:** `cqfnsozknjzvyiziwicl`
- **URL:** https://cqfnsozknjzvyiziwicl.supabase.co
- **Status:** Upgraded (quota issue resolved)
- **Purpose:** Production environment for live operations
- **Backup Location:** `.env.backup`

### STAGING (New - Clean)
- **Project Ref:** `csbiuvcpbhttcenmqcqx`
- **URL:** https://csbiuvcpbhttcenmqcqx.supabase.co
- **Status:** Fresh instance, migrations pending
- **Purpose:** Validation and testing environment
- **Current Config:** `.env` and `.env.local`

## Current Smart Form Configuration

**Active Environment:** STAGING (`csbiuvcpbhttcenmqcqx`)

Files pointing to STAGING:
- `apps/smart-form/.env` (line 2)
- `apps/smart-form/.env.local` (line 5)

## Key Rotation Status

⚠️ **ACTION REQUIRED**: Keys are currently exposed in plaintext in multiple files.

### Keys to Rotate

**PRODUCTION Project:**
1. Navigate to: https://app.supabase.com/project/cqfnsozknjzvyiziwicl/settings/api
2. Click "Reset service_role secret" under "Service role secret"
3. Click "Reset anon public" under "Project API keys"
4. Update `.env.backup` with new keys (for PROD promotion later)

**STAGING Project:**
1. Navigate to: https://app.supabase.com/project/csbiuvcpbhttcenmqcqx/settings/api
2. Click "Reset service_role secret" under "Service role secret"
3. Click "Reset anon public" under "Project API keys"
4. Update `.env` and `.env.local` with new keys

## Validation Strategy

1. **STAGING First:** All smoke pack tests run against STAGING
2. **Migration Parity:** Both PROD and STAGING get identical migrations
3. **Data Isolation:** STAGING uses test tenants/users
4. **Promotion Path:** Only after STAGING ✅ GREEN

## Next Steps

- [ ] Rotate all exposed keys
- [ ] Verify both projects accessible (no quota errors)
- [ ] Apply migrations to STAGING
- [ ] Run smoke pack validation
- [ ] Apply migrations to PROD
- [ ] Implement retention policies
