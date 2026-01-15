# PHASE 0: REPOSITORY DISCOVERY REPORT

**Date**: 2026-01-15
**Auditor**: Release Manager + Systems Auditor
**Objective**: Establish repo truth for FOUNDATION READY state

---

## Executive Summary

The Unit Talk platform repository contains **extensive existing foundation infrastructure** including schema drift detection, readonly query runners, and comprehensive database migrations. However, **critical smoke pack infrastructure and migration CI/CD workflows are missing**.

### Key Findings

✅ **COMPLETE**:
- Schema drift detection (scripts/ops/detect-schema-drift.ts)
- Readonly query runner (scripts/ops/supabase-query.ts)
- Database smoke tests (scripts/ops/smoke-test-db.ts)
- 46 Supabase migrations including Phase 6
- Docker Compose environment
- Production Charter governance

❌ **MISSING**:
- Unified smoke pack (scripts/smoke/)
- Smoke pack documentation (docs/SMOKE_PACK_CHARTER.md)
- Foundation proof bundle
- Package.json smoke scripts
- CI/CD migration workflow
- Comprehensive smoke report generation

---

## Repository Structure

### Root Structure
```
unit-talk-production-main/
├── apps/                          # 11 applications
│   ├── api/                      # Main platform (Fortune 100-grade)
│   ├── command-center/           # Operational control center
│   ├── smart-form/               # Pick submission form
│   ├── discord-bot/              # Discord integration
│   └── ...
├── packages/                     # Shared packages (3 packages)
├── scripts/                      # Operational scripts
│   ├── ops/                      # 80+ operational scripts
│   ├── audit/                    # Audit scripts
│   ├── burn-in/                  # Load testing
│   └── smoke/                    # ❌ MISSING
├── supabase/migrations/          # 46 migrations
├── docs/                         # Documentation (50+ files)
├── docker-compose.yml            # Full stack orchestration
└── package.json                  # Workspace root
```

### Applications Discovered
1. **api** - Main backend API platform
2. **command-center** - Operational dashboard
3. **smart-form** - Pick submission interface
4. **discord-bot** - Discord integration
5. **dashboard** - Analytics dashboard
6. **developer-portal** - Developer documentation
7. **shared** - Shared utilities
8. **ml-training** - ML model training
9. **worker** - Background workers
10. **vip-automation** - VIP workflows
11. **production-readiness-bundle** - Legacy

---

## Foundation Components Analysis

### A. Readonly Query Runner ✅ EXISTS

**File**: `scripts/ops/supabase-query.ts` (lines 1-80+)

**Features**:
- Read-only by default (SELECT, EXPLAIN, SHOW, DESCRIBE, WITH)
- Write mode requires --write flag + confirmation
- SQL allowlist with blocked patterns
- Credential redaction
- Audit logging
- Rate limiting
- Query timeout (default configurable)
- Multiple output formats (table, json, csv)

**Safety Controls**:
```typescript
ALLOWED_READ_STATEMENTS = ['SELECT', 'EXPLAIN', 'SHOW', 'DESCRIBE', 'WITH']
BLOCKED_PATTERNS = [DROP, TRUNCATE, DELETE without WHERE, UPDATE without WHERE, GRANT, REVOKE, ...]
DANGEROUS_FUNCTIONS = ['pg_read_file', 'pg_ls_dir', 'lo_import', 'lo_export', ...]
```

**Usage**:
```bash
npx tsx scripts/ops/supabase-query.ts --env dev "SELECT * FROM picks LIMIT 10"
npx tsx scripts/ops/supabase-query.ts --env dev --output json "SELECT COUNT(*) FROM picks"
```

**Assessment**: PRODUCTION READY ✅

---

### B. Schema Drift Detection ✅ EXISTS

**File**: `scripts/ops/detect-schema-drift.ts` (lines 1-80+)

**Features**:
- Compares Git migrations (supabase/migrations/) vs live Supabase schema
- Detects missing/extra/modified: tables, columns, indexes, constraints, functions, views
- Severity classification: none|low|medium|high|critical
- Exit code 1 on drift (fail-closed)
- JSON report output
- Alert mode for CI/CD

**Difference Types**:
- Tables: missing/extra tables
- Columns: type changes, nullability changes, default changes
- Indexes: missing/extra indexes
- Constraints: PK/FK/CHECK/UNIQUE changes
- Functions: signature changes
- Views: definition changes

**Usage**:
```bash
npx tsx scripts/ops/detect-schema-drift.ts --env dev
npx tsx scripts/ops/detect-schema-drift.ts --env staging --alert
npx tsx scripts/ops/detect-schema-drift.ts --env prod --report
```

**Assessment**: PRODUCTION READY ✅

---

### C. Database Smoke Tests ✅ EXISTS

**File**: `scripts/ops/smoke-test-db.ts` (lines 1-228)

**Tests**:
1. Database connectivity
2. Count picks table
3. Count pick_publish table
4. Query users table
5. Write test (dev/staging only) - creates/deletes test tenant
6. RPC function test
7. Foreign key integrity check

**Modes**:
- Basic: Tests 1-4 only
- Comprehensive: All tests (with write tests in non-prod)

**Exit Codes**:
- 0: All tests passed
- 1: One or more tests failed

**Usage**:
```bash
npx tsx scripts/ops/smoke-test-db.ts --env=dev
npx tsx scripts/ops/smoke-test-db.ts --env=staging --comprehensive
```

**Assessment**: PRODUCTION READY ✅

---

### D. Migration Infrastructure ⚠️ PARTIAL

**Migrations Directory**: `supabase/migrations/` (46 migrations)

**Recent Migrations**:
- 20260115_phase6_agent_lifecycle.sql (Phase 6)
- 20260114_historical_metrics_storage.sql
- 20260114_form_submissions_tracking.sql
- 20251226_phase3_alert_events.sql
- ... 42 more migrations

**Migration Features**:
- Idempotent SQL (IF NOT EXISTS, DO $$ blocks)
- Indexes and constraints included
- pg_notify('pgrst', 'reload schema') for PostgREST
- RLS policies defined

**Local Migration Support**: ✅
- Docker Postgres at localhost:5432
- Migrations mounted in docker-compose.yml

**CI/CD Migration Workflow**: ❌ MISSING
- No GitHub Actions workflow for Supabase migrations
- No automated migration testing
- No pre-deployment migration dry-run

**Required**:
1. `.github/workflows/supabase-migrate.yml` - Apply migrations on push
2. `.github/workflows/schema-drift-check.yml` - Run drift detection every 6 hours
3. Migration dry-run step in CI before merge

**Assessment**: NEEDS CI/CD AUTOMATION ⚠️

---

### E. Smoke Pack Infrastructure ❌ MISSING

**Required Components**:
1. `scripts/smoke/` directory
2. `scripts/smoke/run-smoke.ts` - Main orchestrator
3. `docs/SMOKE_PACK_CHARTER.md` - Smoke pack specification
4. `docs/FOUNDATION_READY_PROOF.md` - Proof bundle template
5. Package.json scripts:
   - "smoke:run"
   - "smoke:report"
   - "db:local:status"
   - "db:local:migrate"

**Smoke Pack Requirements**:
- Repo inventory (apps, packages, scripts)
- Build/typecheck for each app
- API route enumeration
- Local DB health + table list
- Required tables verification
- Readonly query runner test
- Command Center UI screenshot (if Playwright present)
- Generate proof bundle in /out/foundation-proof/<timestamp>/

**Assessment**: NOT IMPLEMENTED ❌

---

## Phase 6 Infrastructure Analysis

### Phase 6 Migration ✅ COMPLETE

**File**: `supabase/migrations/20260115_phase6_agent_lifecycle.sql` (343 lines)

**Tables Created**:
1. **agent_lifecycle_state** - Agent start/stop/pause/resume controls
   - lifecycle_status: stopped|starting|running|pausing|paused|resuming|stopping|error
   - desired_status: stopped|running|paused
   - drain_on_pause, max_restart_attempts, heartbeat tracking

2. **agent_retry_state** - Deterministic retry scheduling
   - idempotency_key (unique), attempt_count, next_retry_at
   - Exponential backoff with deterministic jitter
   - Error classification: retryable|non-retryable|fatal|transient

3. **autopilot_evidence** - Gate evaluation logging
   - Links to autopilot_decisions table
   - gate_passed, gate_score, gate_threshold
   - Evidence type: gate_evaluation|manual_override|system_check

4. **circuit_breaker_events** - Dependency health tracking
   - service_name: discord|supabase|openai|odds_api
   - event_type: opened|closed|half_open|failure|success
   - Circuit state: closed|open|half_open

**Functions**:
- `update_agent_heartbeat(agent_name, status, error)` - Upsert lifecycle state
- `calculate_next_retry(key, attempt, base_delay, max_delay, factor)` - Deterministic retry time
- `get_agent_health_summary()` - Aggregate health metrics

**Indexes**: 15 indexes for optimal query performance

**RLS**: Enabled with service_role full access policies

---

### Phase 6 Application Code ✅ COMPLETE

**Core Modules**:

1. **DeterministicRetryModule** (`apps/api/src/lib/DeterministicRetryModule.ts`)
   - Error classification
   - Idempotency key generation
   - Retry state persistence
   - executeWithRetry() wrapper

2. **AgentLifecycleController** (`apps/api/src/lib/AgentLifecycleController.ts`)
   - start/stop/pause/resume/restart operations
   - Heartbeat monitoring
   - Drain behavior for graceful pausing
   - Event emission

**API Routes**:
- `apps/api/src/routes/ops/autopilot.ts` - Autopilot control endpoints

**Scripts**:
- `apps/api/src/scripts/apply-phase6-migration.ts` - Apply Phase 6 migration
- `apps/api/src/scripts/setup-data-lifecycle.ts` - Setup lifecycle data
- `apps/api/src/scripts/test-lifecycle-agent.ts` - Test lifecycle controls

**Tests**:
- `apps/api/test/integration/phase6-autopilot-log-only.test.ts` - Autopilot integration
- `apps/api/test/unit/phase6-retry-determinism.test.ts` - Retry determinism

**Documentation**:
- `PHASE6_IMPLEMENTATION_SUMMARY.md` - Complete implementation summary

**Assessment**: PRODUCTION READY ✅

---

## Docker Infrastructure ✅ COMPLETE

**File**: `docker-compose.yml` (542 lines)

**Services**:

### Database Layer
- **postgres** (port 5432) - Main PostgreSQL 15
- **postgres-replica** (port 5433) - Read replica (HA profile)
- **redis** (port 6379) - Cache + session store
- **temporal-postgres** - Temporal DB
- **temporal** (port 7233) - Temporal orchestration
- **temporal-ui** (port 8088) - Temporal dashboard

### Monitoring
- **prometheus** (port 9090) - Metrics
- **grafana** (port 3001) - Dashboards

### Applications
- **api** (port 3010) - Main API
- **workers** - Temporal workers
- **discord-bot** - Discord integration
- **smart-form** (port 3002) - Form UI
- **dashboard** (port 3003) - Analytics UI
- **command-center** (port 3004) - Ops UI

### Dev Tools (profiles: tools)
- **pgadmin** (port 5050) - DB management
- **redis-commander** (port 8081) - Redis UI
- **mailhog** (ports 1025, 8025) - Email testing

**Health Checks**: All services have proper health checks
**Networks**: bridge network (172.20.0.0/16)
**Volumes**: Persistent for postgres, redis, temporal, prometheus, grafana

**Assessment**: PRODUCTION READY ✅

---

## Production Charter Compliance

**File**: `docs/PRODUCTION_CHARTER.md` (lines 1-100+)

**Key Requirements**:
1. ✅ Canonical-first: picks + pick_publish authoritative
2. ✅ Git-driven: Schema in supabase/migrations/
3. ⚠️ Zero-surprises: No CI/CD deployment workflow
4. ✅ Agent alignment: Charter exists
5. ✅ Schema source: supabase/migrations/** (idempotent)
6. ✅ Env file precedence: .env.shared > .env.local > .env
7. ✅ Secrets masking: Required
8. ⚠️ Migrations must be idempotent: True, but no CI enforcement

**Data Model**:
- picks table: Core pick records with workflow_stage, status, grading_status
- pick_publish table: Outbox for Discord delivery
- unified_picks: Fallback (read-compat only)

**Assessment**: CHARTER EXISTS, CI/CD GAPS ⚠️

---

## Package.json Analysis

**File**: `package.json` (lines 1-116)

**Existing Scripts**:
```json
{
  "ops:verify": "verify-gates.ts && verify-slo.ts",
  "ops:monitor": "monitor-cutover.ts",
  "ops:phase15:run": "phase15-orchestrator.js",
  "audit:e2e": "phase16-e2e-validation.ts",
  "audit:performance": "phase16-performance-audit.ts",
  "audit:security": "phase16-security-audit.ts",
  "audit:master": "phase16-master-audit.ts"
}
```

**Missing Scripts**:
```json
{
  "smoke:run": "npx tsx scripts/smoke/run-smoke.ts",
  "smoke:report": "npx tsx scripts/smoke/run-smoke.ts --report-only",
  "db:local:status": "Check local Docker DB migration status",
  "db:local:migrate": "Apply migrations to local Docker DB"
}
```

**Assessment**: NEEDS SMOKE SCRIPTS ❌

---

## Gap Analysis Summary

### CRITICAL GAPS (Blocking FOUNDATION READY)

1. **Smoke Pack Infrastructure** ❌
   - scripts/smoke/ directory
   - scripts/smoke/run-smoke.ts orchestrator
   - docs/SMOKE_PACK_CHARTER.md
   - Proof bundle generation

2. **Package.json Scripts** ❌
   - smoke:run, smoke:report
   - db:local:status, db:local:migrate

3. **Foundation Proof** ❌
   - docs/FOUNDATION_READY_PROOF.md
   - /out/foundation-proof/<timestamp>/ artifacts

### IMPORTANT GAPS (CI/CD Automation)

4. **Migration CI/CD Workflow** ⚠️
   - .github/workflows/supabase-migrate.yml
   - .github/workflows/schema-drift-check.yml
   - Pre-deployment dry-run

### NON-BLOCKING (Nice to Have)

5. **Operator Input Documentation**
   - docs/OPERATOR_INPUT_NEEDED.md (create if secrets missing)

---

## Recommendations

### Immediate Actions (PHASE 1)

1. **Create Smoke Pack Infrastructure**
   ```bash
   mkdir -p scripts/smoke
   touch scripts/smoke/run-smoke.ts
   touch docs/SMOKE_PACK_CHARTER.md
   ```

2. **Implement run-smoke.ts**
   - Repo inventory
   - App discovery
   - Build/typecheck orchestration
   - API route enumeration
   - DB health + table list
   - Drift detection integration
   - Readonly query test
   - UI screenshot (if Playwright)
   - Proof bundle generation

3. **Add Package.json Scripts**
   ```json
   {
     "smoke:run": "npx tsx scripts/smoke/run-smoke.ts",
     "smoke:report": "npx tsx scripts/smoke/run-smoke.ts --report-only",
     "db:local:status": "docker-compose exec postgres psql -U postgres -d unit_talk_dev -c \"SELECT * FROM schema_versions ORDER BY applied_at DESC LIMIT 5\"",
     "db:local:migrate": "for f in supabase/migrations/*.sql; do docker-compose exec -T postgres psql -U postgres -d unit_talk_dev < \"$f\"; done"
   }
   ```

4. **Create SMOKE_PACK_CHARTER.md**
   - Define smoke pack objectives
   - List all smoke checks
   - Define PASS criteria
   - Document proof bundle structure

### Phase 2 Actions (CI/CD)

5. **Create Migration Workflows**
   - supabase-migrate.yml: Apply on push to main
   - schema-drift-check.yml: Run every 6 hours

6. **Add Pre-merge Checks**
   - Migration dry-run
   - Drift detection
   - Smoke pack execution

---

## Next Steps

**PHASE 0 Complete** ✅

Proceed to **PHASE 1: IMPLEMENT/FIX**:
1. Create scripts/smoke/ infrastructure
2. Implement run-smoke.ts orchestrator
3. Add package.json scripts
4. Create SMOKE_PACK_CHARTER.md
5. Wire drift detection + readonly query into smoke pack
6. Generate initial proof bundle

**Success Criteria**:
- `npm run smoke:run` executes successfully
- Proof bundle generated in /out/foundation-proof/<timestamp>/
- All smoke checks documented with PASS/FAIL status
- docs/FOUNDATION_READY_PROOF.md auto-generated

---

**Auditor Signature**: Release Manager + Systems Auditor
**Date**: 2026-01-15
**Status**: PHASE 0 COMPLETE — PROCEED TO PHASE 1
