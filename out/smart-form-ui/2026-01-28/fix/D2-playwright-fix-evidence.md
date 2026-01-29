# Playwright Fix Evidence
## Date: 2026-01-28

---

## Verification Status: PENDING CONTAINER REBUILD

The fixes were applied to the source code but the Docker container is running the old version. To complete Playwright verification:

```bash
# Rebuild the smart-form container with the new code
docker-compose build smart-form
docker-compose up -d smart-form

# Wait for container to be healthy
./dev.sh status
```

---

## Expected Behavior After Fix

### Fix 1: Capper Loading Timeout

**Before Fix**:
- Capper dropdown shows "Loading cappers..." indefinitely
- Evidence: `ISSUE-02-cappers-still-loading.png`

**After Fix**:
- Capper dropdown will either:
  - Load cappers successfully, OR
  - Exit loading state after 10 second timeout and show empty/error state
- The dropdown will NOT stay in infinite loading state

### Fix 2: Sidebar State Sync

**Before Fix**:
- Select NBA sport - sidebar shows "Sport: Not set"
- Evidence: `ISSUE-04-sport-selected-but-sidebar-not-updated.png`

**After Fix**:
- Select NBA sport - sidebar shows "Sport: NBA"
- Selections persist correctly in parent state

### Fix 3: Mutual Exclusion Bug Resolved

**Before Fix**:
- Select NBA, then select Single ticket type - NBA becomes deselected
- Evidence: `ISSUE-05-ticket-type-deselects-sport.png`

**After Fix**:
- Select NBA, then select Single ticket type - BOTH remain selected
- Sidebar shows both "Sport: NBA" AND "Type: single"

---

## Scope Enforcement Verification

### Files Changed by This Fix

Only ONE file was modified by the UI fix:

| File | Change Type |
|------|-------------|
| `apps/smart-form/app/submit-ticket/components/Step1Essentials.tsx` | **NEW CHANGE - UI FIX** |

### Pre-Existing Modified Files (NOT from this fix)

These files were already modified before the audit (per baseline git-status-before.txt):

| File | Status |
|------|--------|
| `apps/smart-form/app/api/cappers/route.ts` | Pre-existing change |
| `apps/smart-form/app/api/players/route.ts` | Pre-existing change |
| `apps/smart-form/app/api/submit-ticket/route.ts` | Pre-existing change |
| `apps/smart-form/lib/api-client.ts` | Pre-existing change |
| `apps/smart-form/lib/supabase-queries.ts` | Pre-existing change |

### No Backend Logic Added

- No new API endpoints
- No API contract changes
- No new intelligence beyond existing
- No database schema changes

---

## Post-Rebuild Verification Checklist

After container rebuild, capture new screenshots to `out/smart-form-ui/2026-01-28/playwright/fixed/`:

- [ ] `FIXED-01-cappers-loaded.png` - Capper dropdown showing loaded cappers OR timeout error state
- [ ] `FIXED-02-sport-sidebar-sync.png` - NBA selected with sidebar showing "Sport: NBA"
- [ ] `FIXED-03-both-selections-persist.png` - Both NBA and Single selected simultaneously
- [ ] `FIXED-04-full-step1-valid.png` - All Step 1 fields filled, Continue button enabled

---

## Verification Commands

```bash
# Run Playwright test after container rebuild
cd apps/smart-form
npx playwright test --headed

# Or use MCP Playwright
# Navigate to http://localhost:3002/submit-ticket
# Capture screenshots showing fixed behavior
```
