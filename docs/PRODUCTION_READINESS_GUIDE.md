# Production Readiness Guide (Phases 0–5)

This guide is the canonical reference for readiness objectives, acceptance criteria, tasks with verification, dependencies, and status.

## Phase Overview

- Phase 0 – Quick Wins
  - Objectives: Telemetry, /metrics, monitoring stack, CI overlays, strict TS green, scripts consolidation
  - Acceptance: Metrics live; Prometheus+Alertmanager configured; monorepo type-check pass; scripts doc + deprecations
- Phase 1 – Data & Features
  - Objectives: Ingestion skeleton with idempotent upserts; Feature Store; Data Quality SLOs/metrics
  - Acceptance: Migrations applied; FeatureStoreService; /api/features; backfill run; unit tests pass; metrics exported
- Phase 2 – Calibrated Baselines & Evaluation
  - Objectives: Baseline models with calibration; experiment tracking; evaluation harness
  - Acceptance: Reproducible runs; MLflow dashboards; metrics
- Phase 3 – Serving & Shadow Mode
  - Objectives: Model service API; shadow traffic; guardrails
  - Acceptance: Load/perf tests; latency SLOs; shadow-vs-live dashboards
- Phase 4 – Execution Alpha & Portfolio
  - Objectives: Integrate predictors; allocation/risk; guardrails
  - Acceptance: Simulation reports; runbooks; feature flags
- Phase 5 – Infrastructure Hardening
  - Objectives: HPA/PDBs; rollouts; centralized logs; SLO dashboards
  - Acceptance: SRE playbooks; dashboards; rollouts and rollback tested

## Status Tracking

- Current Phase: Phase 1 – Data & Features [IN PROGRESS]
- **Infrastructure Stabilization**: ✅ COMPLETE (2025-09-05)
- Phase 0: Complete
- Phase 1 Progress:
  - [x] **Infrastructure Fixes**: All 8 critical DevOps issues resolved
  - [x] **System Validation**: End-to-end workflow operational 
  - [x] **Live Data Access**: Command Center connected to production database
  - [x] **Service Health**: API, Command Center, Database all operational
  - [x] Migrations: feature_values, feature_freshness, data_quality_events
  - [x] FeatureStoreService with idempotent upserts and query
  - [x] API features route: GET /api/features/query
  - [x] Metrics: upserts, durations, freshness, dq events
  - [x] Backfill script and unit test
  - [ ] End-to-end data freshness dashboard (optional stretch)

## Detailed Tasks and Verification

### Phase 0 – Quick Wins
- See docs/ROADMAP_STATUS.md (complete)

### Phase 1 – Data & Features
1) Database migrations
   - Files: apps/api/migrations/2025_09_feature_store.sql
   - Verify: Apply migrations via local Postgres init or manual psql; schema tables and indexes present
2) FeatureStoreService
   - Files: apps/api/src/services/FeatureStoreService.ts
   - Verify: Unit test apps/api/src/test/unit/feature-store.service.test.ts; strict TS builds pass
3) API endpoints
   - Files: apps/api/src/routes/features.ts, api-server.ts (routing)
   - Verify: curl "http://localhost:3000/api/features/query?entityType=player&entityId=p1&names=recent_avg_points"
4) Metrics instrumentation
   - Files: apps/api/src/services/metrics/featureStoreMetrics.ts, metricsServer.ts
   - Verify: curl http://localhost:9000/metrics (or configured port) and check for feature_* metrics
5) Backfill script
   - Files: apps/api/src/scripts/feature-backfill.ts
   - Verify: Run script; query via API; observe metrics increments

## Dependencies

- Phase 1 depends on Phase 0 monitoring/metrics being available
- FeatureStoreService depends on Supabase configuration when running against a real database
- API feature route depends on service implemented and registered in api-server

## Notes

- All new code adheres to strict TypeScript and existing architectural patterns
- Metrics and observability included for new components
- Rollback: The migrations are additive; dropping the new tables reverts the feature store.

