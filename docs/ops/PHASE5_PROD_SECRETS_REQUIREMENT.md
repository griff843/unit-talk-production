# Phase 5 PROD Secrets Configuration

## Status: ❌ REQUIRED - Workflow currently failing due to missing secrets

**Run #4 Evidence**: Run 21106953579 failed with "Error: supabaseUrl is required"

## The Problem

The Phase 5 PROD validation workflow requires Supabase PROD credentials to:
1. Create test tenant and user in PROD database
2. Run schema verification against PROD
3. Execute smoke pack tests against PROD Smart Form API
4. Verify database isolation

Currently, the GitHub Actions environment shows:
```
PROD_SUPABASE_URL: (EMPTY)
PROD_SUPABASE_SERVICE_KEY: (EMPTY)
```

## Required Secrets

Configure these in GitHub Actions → Settings → Secrets → Actions:

| Secret Name | Value | Source |
|-------------|-------|--------|
| `SUPABASE_URL_PROD` | `https://cqfnsozknjzvyiziwicl.supabase.co` | Supabase Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY_PROD` | `eyJhbG...` (long JWT) | Supabase Project Settings → API (service_role key) |
| `SUPABASE_ANON_KEY_PROD` | `eyJhbG...` (long JWT) | Supabase Project Settings → API (anon/public key) |
| `SUPABASE_PROJECT_REF_PROD` | `cqfnsozknjzvyiziwicl` | Extracted from URL |

## How to Configure

### Step 1: Get Credentials from Supabase

1. Navigate to: https://supabase.com/dashboard/project/cqfnsozknjzvyiziwicl/settings/api
2. Find these values:
   - **URL**: Copy entire URL (e.g., `https://cqfnsozknjzvyiziwicl.supabase.co`)
   - **anon public**: Copy the "anon/public" key
   - **service_role**: Copy the "service_role" key (⚠️ SECRET - never commit to git)

### Step 2: Add to GitHub Actions

1. Navigate to: https://github.com/griff843/unit-talk-production/settings/secrets/actions
2. Click "New repository secret" for each:

   **Secret 1:**
   - Name: `SUPABASE_URL_PROD`
   - Value: Paste the Supabase URL

   **Secret 2:**
   - Name: `SUPABASE_SERVICE_ROLE_KEY_PROD`
   - Value: Paste the service_role key

   **Secret 3:**
   - Name: `SUPABASE_ANON_KEY_PROD`
   - Value: Paste the anon/public key

   **Secret 4:**
   - Name: `SUPABASE_PROJECT_REF_PROD`
   - Value: `cqfnsozknjzvyiziwicl`

3. Click "Add secret" after each

### Step 3: Verify Configuration

After adding secrets, trigger a new Phase 5 run:

```powershell
gh workflow run phase5-prod-validation.yml --ref feat/phase15-orchestrator
```

The "Mask PROD secrets" step should now show:
```
##[add-mask]***  # Indicates secrets are present
```

Instead of:
```
##[warning]Can't add secret mask for empty string
```

## Security Notes

✅ **SAFE**: GitHub Actions secrets are:
- Encrypted at rest
- Masked in logs automatically
- Only accessible to workflows with explicit permission
- Audited in GitHub Actions logs

✅ **WORKFLOW USES environment: production**: Requires manual approval before accessing secrets

❌ **NEVER**:
- Commit PROD credentials to git
- Print/echo secrets in workflows
- Share service_role keys in chat/email

## Troubleshooting

### Symptom: "Error: supabaseUrl is required"
**Fix**: Secrets not configured. Follow Step 2 above.

### Symptom: "Can't add secret mask for empty string"
**Fix**: Secret names don't match. Verify exact names:
- `SUPABASE_URL_PROD` (not `SUPABASE_PROD_URL`)
- `SUPABASE_SERVICE_ROLE_KEY_PROD` (not `SUPABASE_SERVICE_KEY_PROD`)

### Symptom: "Invalid API key"
**Fix**: Wrong key pasted. Re-copy from Supabase dashboard.

## After Configuration

Once secrets are configured, Phase 5 will:
1. ✅ Create test tenant/user in PROD
2. ✅ Run schema verification
3. ✅ Execute 15/15 smoke pack tests
4. ✅ Verify database isolation
5. ✅ Generate proof bundle

Expected workflow result: **GO FOR PHASE 6**

---

**Last Updated**: 2026-01-18
**Status**: Awaiting operator to configure secrets
**Next Step**: Add secrets → Re-run Phase 5
