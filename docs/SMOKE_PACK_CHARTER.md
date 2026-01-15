# SMOKE PACK CHARTER

**Version**: 1.0.0
**Date**: 2026-01-15
**Purpose**: Define the Unit Talk Foundation Smoke Pack specification

---

## Mission

The Foundation Smoke Pack is a **single-command orchestration** that verifies the Unit Talk platform is in a provably "FOUNDATION READY" state. It discovers repo truth, validates infrastructure, runs safety checks, and generates an evidence-backed proof bundle—all without requiring manual intervention or operator secrets for read-only operations.

---

## Objectives

1. **Repo Truth Discovery**: Enumerate all apps, packages, scripts, and infrastructure
2. **Build Verification**: Confirm all discovered apps can build and typecheck
3. **Database Health**: Verify local Docker DB is running and accessible
4. **Schema Authority**: Confirm migrations are the source of truth (drift detection)
5. **Safety Controls**: Validate readonly query runner works correctly
6. **API Discovery**: Enumerate all API routes and endpoints
7. **UI Health**: Capture Command Center screenshots (if Playwright available)
8. **Proof Generation**: Create timestamped proof bundle with all artifacts

---

## Smoke Checks

### 1. Repository Inventory

**Check**: Discover all workspace applications and packages

**Method**:
- Read package.json workspaces array
- Glob for apps/*/package.json
- Glob for packages/*/package.json
- List all scripts/ subdirectories

**Artifacts**:
- `repo-inventory.json`: Complete repo structure
- `apps-discovered.json`: List of all apps with metadata

**PASS Criteria**:
- At least 5 apps discovered
- package.json is valid JSON
- workspaces array is defined

---

### 2. Build Verification

**Check**: Verify all apps can build and typecheck

**Method**:
For each discovered app:
- Run `npm run type-check` (if script exists)
- Run `npm run build` (if script exists)
- Capture exit codes, stdout, stderr
- Record duration

**Artifacts**:
- `build-results.json`: Per-app build status
- `build-summary.md`: Human-readable summary

**PASS Criteria**:
- Core apps build successfully: api, command-center, smart-form
- TypeScript compilation has zero errors in core apps
- Non-critical apps can fail (marked as warnings)

**Scope Limitation**:
- Only test apps that were modified or touched in recent changes
- Legacy/unmaintained apps are skipped with warning

---

### 3. Local Database Health

**Check**: Verify Docker Postgres is running and accessible

**Method**:
- Check `docker-compose ps postgres` status
- Execute `SELECT 1` query via psql
- Count tables in public schema
- List all tables
- Verify required tables exist: picks, pick_publish, users, tenants, agent_health

**Artifacts**:
- `db-health.json`: Connection status, table count
- `db-tables.json`: Complete table list with row counts

**PASS Criteria**:
- Postgres container is running
- Can execute SELECT 1
- Required tables exist
- At least 20 tables in public schema

---

### 4. Schema Drift Detection

**Check**: Verify no unauthorized schema changes exist

**Method**:
- Run existing `scripts/ops/detect-schema-drift.ts --env dev`
- Parse JSON output
- Check exit code

**Artifacts**:
- `drift-report.json`: Full drift report from detect-schema-drift.ts

**PASS Criteria**:
- Exit code 0 (no drift)
- driftDetected = false
- severity = 'none'

**UNPROVEN Criteria**:
- If Supabase credentials missing, mark as UNPROVEN (not FAIL)
- Document in OPERATOR_INPUT_NEEDED.md

---

### 5. Readonly Query Runner Verification

**Check**: Confirm readonly query runner works and blocks writes

**Method**:
- Execute safe query: `SELECT COUNT(*) FROM picks`
- Verify output is valid
- Attempt blocked query: `DELETE FROM picks` (should fail)
- Verify error message contains "blocked" or "read-only"

**Artifacts**:
- `query-runner-test.json`: Test results

**PASS Criteria**:
- Safe query executes successfully
- Blocked query is rejected
- Exit code handling correct

**UNPROVEN Criteria**:
- If Supabase credentials missing, mark as UNPROVEN

---

### 6. API Route Enumeration

**Check**: Discover all API routes

**Method**:
- Parse apps/api/src/routes/**/*.ts files
- Extract route patterns (app.get, app.post, router.get, etc.)
- Group by route prefix (/api/health, /api/picks, /ops/, etc.)

**Artifacts**:
- `routes.json`: Complete route listing with methods

**PASS Criteria**:
- At least 10 routes discovered
- Health endpoint exists (/api/health or /health)
- Ops endpoints exist (/ops/*)

---

### 7. Migration Status

**Check**: Verify migration infrastructure

**Method**:
- Count supabase/migrations/*.sql files
- Verify migrations are idempotent (contain IF NOT EXISTS or DO $$)
- Check for schema_versions table (if exists)
- List last 5 applied migrations (if schema_versions exists)

**Artifacts**:
- `migrations-status.json`: Migration count, latest applied

**PASS Criteria**:
- At least 40 migration files exist
- All migrations use idempotent patterns
- No duplicate migration filenames

---

### 8. Command Center UI Health (Optional)

**Check**: Capture screenshots of Command Center dashboard

**Method** (if Playwright installed):
- Start Command Center on localhost:3004
- Navigate to /dashboard
- Wait for page load
- Capture screenshot
- Check for errors in console

**Artifacts**:
- `screenshots/command-center-dashboard.png`
- `screenshots/command-center-agents.png`

**PASS Criteria**:
- Screenshots captured without errors
- No critical console errors

**SKIP Criteria**:
- If Playwright not installed, skip with note
- If Command Center not running, skip with note

---

### 9. Phase 6 Infrastructure Verification

**Check**: Verify Phase 6 agent lifecycle components

**Method**:
- Check Phase 6 migration exists: 20260115_phase6_agent_lifecycle.sql
- Verify tables exist: agent_lifecycle_state, agent_retry_state, autopilot_evidence, circuit_breaker_events
- Check core modules exist: AgentLifecycleController.ts, DeterministicRetryModule.ts
- Verify tests exist: phase6-autopilot-log-only.test.ts, phase6-retry-determinism.test.ts

**Artifacts**:
- `phase6-verification.json`: Phase 6 component status

**PASS Criteria**:
- Migration file exists
- Core modules exist
- Tests exist

---

## Proof Bundle Structure

All artifacts are generated in `/out/foundation-proof/<timestamp>/`:

```
/out/foundation-proof/2026-01-15T12-30-45Z/
├── smoke-report.json          # Overall smoke run results
├── smoke-report.md            # Human-readable summary
├── repo-inventory.json        # Repo structure
├── apps-discovered.json       # App list with metadata
├── build-results.json         # Per-app build status
├── build-summary.md           # Build summary
├── db-health.json             # Database health
├── db-tables.json             # Table listing
├── drift-report.json          # Schema drift detection
├── query-runner-test.json     # Readonly query test
├── routes.json                # API routes
├── migrations-status.json     # Migration info
├── phase6-verification.json   # Phase 6 status
└── screenshots/               # UI screenshots (if available)
    ├── command-center-dashboard.png
    └── command-center-agents.png
```

---

## Overall PASS Criteria

The smoke pack returns **PASS** if and only if:

1. ✅ Repo inventory succeeds
2. ✅ Core apps build successfully (api, command-center, smart-form)
3. ✅ Local database is healthy and has required tables
4. ✅ Schema drift detection shows no drift (or UNPROVEN if no credentials)
5. ✅ Readonly query runner works correctly (or UNPROVEN if no credentials)
6. ✅ API routes discovered (at least 10 routes)
7. ✅ Migrations infrastructure verified
8. ✅ Phase 6 components exist

**FAIL** conditions:
- Core app builds fail
- Database unreachable
- Required tables missing
- Confirmed schema drift detected
- Readonly query runner broken

**UNPROVEN** conditions:
- Supabase credentials missing (document in OPERATOR_INPUT_NEEDED.md)
- Non-critical apps fail to build
- UI screenshots not captured

---

## Usage

### Run Full Smoke Pack

```bash
npm run smoke:run
```

**Output**:
- Live progress to console
- Proof bundle in /out/foundation-proof/<timestamp>/
- Exit code 0 if PASS, 1 if FAIL

### Generate Report Only

```bash
npm run smoke:report
```

**Output**:
- Re-generate docs/FOUNDATION_READY_PROOF.md from latest proof bundle
- No checks executed

### Check Specific Component

```bash
npx tsx scripts/smoke/run-smoke.ts --check=db-health
npx tsx scripts/smoke/run-smoke.ts --check=drift-detection
npx tsx scripts/smoke/run-smoke.ts --check=build-verification
```

---

## Integration Points

### Existing Tools

The smoke pack integrates with existing foundation tools:

1. **detect-schema-drift.ts**: Called directly, output parsed
2. **supabase-query.ts**: Used for readonly query verification
3. **smoke-test-db.ts**: Can be called for comprehensive DB tests

### Future CI/CD Integration

The smoke pack is designed for CI/CD:

```yaml
# .github/workflows/foundation-smoke.yml
- name: Run Foundation Smoke Pack
  run: npm run smoke:run

- name: Upload Proof Bundle
  uses: actions/upload-artifact@v3
  with:
    name: foundation-proof-${{ github.sha }}
    path: out/foundation-proof/
```

---

## Maintenance

### When to Update

Update this charter when:
- New foundation components added
- New smoke checks required
- PASS criteria change
- Proof bundle structure changes

### Versioning

Charter uses semantic versioning:
- Major: Breaking changes to proof bundle structure
- Minor: New smoke checks added
- Patch: Clarifications or documentation updates

---

## Charter Enforcement

**All developers and AI agents MUST**:
1. Run smoke pack before submitting PRs that touch foundation components
2. Ensure smoke pack PASS before merging to main
3. Update charter when adding new foundation components
4. Never bypass smoke checks

**Smoke pack failures are blocking** unless:
- Explicitly marked as UNPROVEN due to missing operator secrets
- Non-critical legacy components

---

**Charter Authority**: Release Manager
**Last Updated**: 2026-01-15
**Next Review**: After Phase 6 completion
