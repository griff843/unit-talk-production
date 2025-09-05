# Unit Talk Production Readiness Roadmap (Phases 0–5)

Last Updated: <to be filled after commit>
Owner: Engineering
SLOs: 99.9% uptime, <200ms p95 latency, <0.1% error rate

This document is the single source of truth for readiness status. It supersedes point-in-time status docs. Evidence and verification steps are embedded in each phase.

## Phase 0 – Quick Wins [IN PROGRESS]

Scope: Telemetry, metrics & alerts, CI overlays, strict TS type-check green, scripts consolidation.

- Tasks
  - [x] API: Initialize shared OpenTelemetry SDK on boot (dev console exporter; prod via OTLP)
  - [x] Metrics: Expose /metrics on 9464 with prom-client (PROMETHEUS_ENABLED=true)
  - [x] Monitoring: Prometheus + Alertmanager configs and alert rules mounted by docker-compose
  - [x] CI Overlay: docker-compose.test.yml to enable metrics in CI
  - [ ] Command Center: Fix Radix/shadcn UI wrapper typings to pass tsc --noEmit
  - [ ] Scripts: Add scripts/README and mark legacy scripts with deprecation headers

- Evidence & How to Verify
  - OTEL: Start API locally; see "Telemetry initialized" logs; set OTEL_EXPORTER_OTLP_ENDPOINT to point at a collector and see spans
  - Metrics: curl http://localhost:9464/metrics returns prom-client output
  - Prometheus: http://localhost:9090/targets shows unit-talk-api UP
  - Alertmanager: http://localhost:9093/ shows receiver "default"
  - CC Type-check: npm run -w apps/command-center type-check returns 0 exit code

- Notes/Decisions
  - Alert routing: Discord webhook via DISCORD_WEBHOOK_URL in Alertmanager
  - DropdownMenuItem supports onClick (mapped to onSelect) for convenience

## Phase 1 – Data & Features (Weeks 1–3) [NOT STARTED]

Acceptance Criteria
- Reliable historical ingestion with point-in-time correctness (backfill job)
- Feature store tables with versioning and freshness checks
- Data quality SLIs/SLOs with alerts on missing/late data

Planned Tasks
- Build ingestion pipeline skeleton with idempotent upserts
- Add feature store schemas, migrations, and read API with typed client
- Implement data quality checks and Prometheus metrics

Evidence & Verification
- E2E backfill run logs; row counts; freshness dashboards
- API contract: typed client usage examples; integration tests green

## Phase 2 – Calibrated Baselines & Evaluation (Weeks 3–6) [NOT STARTED]

Acceptance Criteria
- Trained baseline models (e.g., LGBM/XGB) with calibration (Platt/Isotonic)
- Reproducible experiments tracked (MLflow or equivalent)
- Evaluation harness with metrics and dashboards

Evidence & Verification
- Repro notebooks/scripts; MLflow runs; dashboard screenshots

## Phase 3 – Serving & Shadow Mode (Weeks 6–8) [NOT STARTED]

Acceptance Criteria
- Model service API with strict TS client and schema contracts
- Shadow traffic in production; no customer impact
- Guardrails and rollback hooks

Evidence & Verification
- Load tests; latency/availability metrics; shadow-vs-live agreement stats

## Phase 4 – Execution Alpha & Portfolio (Weeks 8–12) [NOT STARTED]

Acceptance Criteria
- CLV/line-move predictors integrated in alpha
- Correlation-aware allocation and risk limits
- Operator controls in Command Center

Evidence & Verification
- Simulation reports; guardrail configs; operator runbook updates

## Phase 5 – Infrastructure Hardening (Weeks 8–12) [NOT STARTED]

Acceptance Criteria
- HPA/PDBs, blue/green or canary (Argo Rollouts), centralized logs
- External Secrets; SLO dashboards; Alertmanager playbooks

Evidence & Verification
- K8s manifests; Grafana dashboards; incident playbooks

---

Changelog
- 2025-09-03: Created document and recorded Phase 0 progress (telemetry, metrics, monitoring).
