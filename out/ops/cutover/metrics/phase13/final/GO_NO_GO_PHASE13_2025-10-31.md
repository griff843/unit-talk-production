# Phase 13 Production Cutover - GO/NO-GO Decision
**Date**: 2025-10-31  
**Phase**: 13 - Model Serving & Ensemble Layer  
**Operator**: Ops Orchestrator (Augment Agent)  
**Decision**: **NO-GO** (Blockers Identified)

---

## Executive Summary

Phase 13 cutover verification revealed **critical blockers** that prevent production deployment:

1. **API Server Mismatch**: Docker container running outdated code; routes not registered
2. **Database Schema Drift**: `pick_publish.next_attempt_at` column missing
3. **Inference Layer Not Integrated**: Phase 13 model serving routes exist but not registered
4. **Container Rebuild Required**: API server needs rebuild to load current codebase

**Recommendation**: **NO-GO** - Complete blockers resolution before attempting cutover.

---

## Detailed Findings

### ✅ PASS: Infrastructure Health
- **Docker Services**: All 7 services healthy (api, postgres, redis, temporal, prometheus, grafana, temporal-db)
- **Uptime**: API running 24 hours, infrastructure 33 hours
- **Database Connectivity**: Supabase connection verified
- **PostgREST Visibility**: Canonical tables (`picks`, `pick_publish`) visible via REST API

### ✅ PASS: Environment Configuration
- **Canonical Driver**: `PICK_DRIVER=canonical` ✅
- **Outbox Publisher**: `PUBLISH_MODE=outbox` ✅
- **Live Mode**: `SHADOW_MODE=false` ✅
- **Logging**: `LOG_MODE=sync` ✅
- **Phase 13 Parameters**: All inference/ensemble/evaluator env vars configured

### ❌ FAIL: API Server Routes
**Status**: CRITICAL BLOCKER

**Issue**: API server only exposing 4 routes:
```
- GET /
- GET /api/health
- POST /api/smart-form/process
- GET /api/smart-form/health
```

**Missing Routes**:
- `/api/picks` (404)
- `/api/domain/picks/*` (404)
- `/api/inference/*` (404)

**Root Cause**: Docker container running stale build; `api-server.ts` changes not reflected

**Evidence**:
```bash
$ curl http://localhost:3010/api/picks
{"success":false,"error":"Route not found","path":"/api/picks","method":"GET"}
```

**Resolution Required**:
1. Rebuild API container: `docker-compose build api`
2. Restart services: `docker-compose up -d api`
3. Verify routes: `curl http://localhost:3010/api/domain/picks/preflight`

### ❌ FAIL: Database Schema Alignment
**Status**: CRITICAL BLOCKER

**Issue**: Outbox publisher failing with column error:
```
ERROR: Failed to fetch pending publish jobs
error: "column pick_publish.next_attempt_at does not exist"
```

**Root Cause**: Migration drift - `pick_publish` table missing retry scheduling column

**Resolution Required**:
1. Apply missing migration: `supabase/migrations/*_add_next_retry_at.sql`
2. Force PostgREST reload: `node scripts/ops/force-postgrest-reload.ts`
3. Verify column exists: `SELECT column_name FROM information_schema.columns WHERE table_name='pick_publish'`

### ❌ FAIL: E2E Validation
**Status**: BLOCKED (Cannot run until API routes available)

**Attempted**: Manual E2E for NBA, NFL, MLB, NHL
**Result**: All 4 leagues failed at DRY-RUN step (404 route not found)

**Test User**: `012602a5-52e8-457e-838e-45f0f43edfc3` (E2E_TestCapper) ✅ Exists

**Artifact**: `out/ops/cutover/metrics/phase13/e2e/manual_e2e_results_2025-10-31T10-21-15-197Z.json`

### ⚠️  WARN: Phase 13 Inference Layer
**Status**: NOT INTEGRATED (Non-blocking for core picks flow)

**Findings**:
- ✅ Code exists: `InferenceGateway`, `EnsembleCoordinator`, `ContinuousEvaluator`, `ModelRegistrySync`
- ✅ Routes defined: `apps/api/src/routes/inference.ts`
- ❌ Routes not registered in `api-server.ts`
- ❌ Services not instantiated in application bootstrap

**Impact**: Phase 13 model serving unavailable, but core canonical picks flow can proceed

**Resolution Path** (Post-Blocker):
1. Instantiate ML services in `apps/api/src/index.ts`:
   ```typescript
   const modelRegistry = new ModelRegistrySync(logger, supabase);
   const ensembleCoordinator = new EnsembleCoordinator(logger, supabase, modelRegistry, ensembleConfig);
   const continuousEvaluator = new ContinuousEvaluator(logger, supabase, modelRegistry, evaluatorConfig);
   const inferenceGateway = new InferenceGateway(logger, supabase, modelRegistry, ensembleCoordinator, gatewayConfig);
   ```
2. Register routes in `api-server.ts`:
   ```typescript
   import { createInferenceRoutes } from './routes/inference';
   app.use('/api/inference', createInferenceRoutes(logger, supabase, inferenceGateway, ensembleCoordinator, continuousEvaluator, modelRegistry));
   ```
3. Rebuild and test: `/api/inference/health`

### ⏭️  SKIP: Canary Deployment
**Status**: BLOCKED (Requires functional API)

**Plan**: 
- Set `CANARY_PERCENT=5` for 5-minute soak
- Monitor SLOs: p95 < 150ms, error rate < 0.5%
- Ramp to 25% for 15 minutes if GREEN
- Auto-rollback on SLO violation

**Cannot Execute**: API routes unavailable

### ⏭️  SKIP: Grafana Dashboard Import
**Status**: DEFERRED (Non-blocking)

**Artifacts Available**:
- `infrastructure/dashboards/model-serving-dashboard.json`
- `infrastructure/monitoring/prometheus-rules-model-serving.yaml`

**Action Required**: Manual import after API stabilization

### ⏭️  SKIP: Nightly Validation
**Status**: DEFERRED (Requires functional E2E)

**Script Ready**: `scripts/ops/nightly-canonical-validation.js`
**Scheduler**: `scripts/ops/install-nightly-validation.ps1`

---

## Blocker Resolution Checklist

### Priority 1: API Server Rebuild
- [ ] Stop API container: `docker-compose stop api`
- [ ] Rebuild with no cache: `docker-compose build --no-cache api`
- [ ] Start API: `docker-compose up -d api`
- [ ] Verify routes: `curl http://localhost:3010/api/domain/picks/preflight`
- [ ] Check logs: `docker-compose logs api --tail=100`

### Priority 2: Database Schema Fix
- [ ] Identify missing migration for `next_retry_at` column
- [ ] Apply migration via Supabase client
- [ ] Force PostgREST reload
- [ ] Verify outbox publisher starts without errors
- [ ] Test outbox query: `SELECT * FROM pick_publish LIMIT 1`

### Priority 3: E2E Validation
- [ ] Run manual E2E script: `node scripts/ops/phase13-manual-e2e.js`
- [ ] Verify all 4 leagues PASS (NBA, NFL, MLB, NHL)
- [ ] Confirm picks inserted into `picks` table
- [ ] Confirm outbox entries in `pick_publish` table
- [ ] Verify Command Center displays picks

### Priority 4: Phase 13 Integration (Optional)
- [ ] Instantiate ML services in bootstrap
- [ ] Register inference routes
- [ ] Test `/api/inference/health`
- [ ] Seed test model in `predictive_models` table
- [ ] Run inference prediction test

---

## Exit Criteria for GO Decision

### Must-Have (Blocking)
1. ✅ All Docker services healthy
2. ❌ API routes responding (currently 404)
3. ❌ Database schema aligned (missing column)
4. ❌ E2E validation PASS for all 4 leagues
5. ❌ Outbox publisher operational (currently failing)
6. ✅ PostgREST visibility confirmed
7. ✅ Canonical driver active

### Should-Have (Non-Blocking)
8. ⏭️  Canary deployment 5% → 25% successful
9. ⏭️  Grafana dashboard imported
10. ⏭️  Prometheus alerts configured
11. ⏭️  Nightly validation installed

### Nice-to-Have (Phase 13 Specific)
12. ⏭️  Inference routes operational
13. ⏭️  Ensemble coordinator healthy
14. ⏭️  Continuous evaluator running
15. ⏭️  Model registry populated

---

## Artifacts Generated

### Preflight
- `out/ops/cutover/metrics/phase13/preflight/ENV_SNAPSHOT_2025-10-31.md`
- `out/ops/cutover/metrics/phase13/preflight/health_checks_2025-10-31.json`

### E2E
- `out/ops/cutover/metrics/phase13/e2e/manual_e2e_results_2025-10-31T10-21-15-197Z.json`

### Scripts Created
- `scripts/ops/seed-test-user.js` (test user seeding)
- `scripts/ops/phase13-manual-e2e.js` (manual E2E validation)

### Final Decision
- `out/ops/cutover/metrics/phase13/final/GO_NO_GO_PHASE13_2025-10-31.md` (this document)

---

## Recommended Next Steps

1. **Immediate** (Today):
   - Rebuild API container with current codebase
   - Apply missing database migration
   - Re-run E2E validation

2. **Short-Term** (This Week):
   - Integrate Phase 13 inference layer
   - Complete canary deployment
   - Import monitoring dashboards

3. **Medium-Term** (Next Sprint):
   - Seed production models in registry
   - Enable continuous evaluation
   - Deploy ensemble coordinator

---

## Decision Rationale

**NO-GO** decision based on:
- **2 Critical Blockers**: API routes unavailable, database schema drift
- **0% E2E Success Rate**: All 4 leagues failed validation
- **Production Risk**: Outbox publisher failing, picks cannot be published
- **Charter Compliance**: Violates "zero-surprises deployments" principle

**Path to GO**:
1. Resolve API server mismatch (rebuild container)
2. Fix database schema (apply migration)
3. Achieve 100% E2E success (all 4 leagues)
4. Verify outbox publisher operational
5. Re-run this validation workflow

---

**Signed**: Ops Orchestrator (Augment Agent)  
**Date**: 2025-10-31T10:22:00Z  
**Charter Reference**: docs/PRODUCTION_CHARTER.md v3.0  
**Alignment Spec**: docs/SYSTEM_ALIGNMENT_SPEC.yml v3.0

