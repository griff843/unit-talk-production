# Unit Talk Production Readiness Assessment - 2025-09-05

Version: 1.0.0
Change Log:
- 2025-09-05 v1.0.1: Updated comprehensive assessment, checklist, and roadmap with algorithm consolidation completion
- 2025-09-03 v1.0.0: Initial comprehensive assessment, checklist, and roadmap

## Executive Summary

The platform demonstrates strong DevOps foundations, extensive agent architecture, and mature documentation. To reach world-class sports syndicate standards, prioritize: (1) a real historical-data-driven ML pipeline with calibrated serving and shadow evaluation; (2) complete observability (metrics/tracing/logs/alerting) wired end-to-end; (3) CI/CD hardening and strict type safety across apps; (4) Kubernetes productionization. Phase 0 quick wins implemented: API metrics server wiring and CI overlay/placeholder scripts.

## Detailed Findings

- AI/ML: Predictive models are mocked/simulated; no true historical training, calibration, or drift handling. Backtesting exists but often uses synthetic data. LLMs are used for analysis/coaching, not core prediction.
- Data: Ingestion from Odds/Optimal present; need curated historical datasets, closing lines, labels, and feature store with point-in-time correctness.
- Observability: Prometheus/Grafana configs exist; API did not expose metrics prior to this assessment. OpenTelemetry package present but not integrated in API startup.
- CI/CD: Comprehensive workflows; some references to missing files (docker-compose.test.yml, check-metrics.sh, rollback.sh). Addressed in Phase 0 quick wins.
- Infra: Terraform for VPC/EKS/RDS/Redis/ALB; Kubernetes manifests for API exist; need HPAs, PDBs, secrets mgmt, progressive delivery.
- Apps: Command Center uses SKIP_TYPE_CHECK; health endpoints exist but not standardized across all services; reliability patterns present but not enforced everywhere.

## Gap Analysis

- Modeling: No real training/evaluation loop, no calibration, no shadow mode, no MLflow.
- Data: No feature store; limited labelers; no data quality SLOs.
- Observability: Metrics exposed inconsistently; no Alertmanager, no centralized logs.
- CI/CD: Brittle references; lack of deterministic E2E harness at root; missing scripts.
- K8s: Missing HPAs/PDBs/External Secrets/rollouts.
- Type Safety: CC type-check disabled; shared package strictness not enforced.

## Remediation Roadmap

Phase 0 (Week 1): Quick Wins
- Wire API metrics on :9464/metrics; fix CI E2E compose overlay; add missing CI helper scripts.

Phase 1 (Weeks 1–3): Data & Features
- Build historical ingestion (props/odds/settlements/closing lines) + feature store; define entity keys; data quality checks.

Phase 2 (Weeks 3–6): Baseline Models & Evaluation
- Train calibrated baselines; add MLflow; institute time-based CV; create evaluation dashboards and reports.

Phase 3 (Weeks 6–8): Serving & Shadow Mode
- Serve models via FastAPI; shadow inference; performance gates; rollback on regressions.

Phase 4 (Weeks 8–12): Execution Alpha & Portfolio
- CLV/line-move prediction; correlation-aware sizing; enforce risk limits.

Phase 5 (Weeks 8–12): Infra Hardening
- HPAs, PDBs, External Secrets, Argo Rollouts; centralized logs; Alertmanager; security posture.

## Master Production Readiness Checklist

Each item: [Priority] Description | Acceptance Criteria | Owner/Timeline | Verification | Mapping

### Critical
- [Critical] API metrics exposure | /metrics on :9464 reachable; Prometheus scrape healthy | Platform, Week 1 | curl :9464/metrics; Prometheus targets up | SRE best practices
- [Critical] Root E2E compose overlay | CI uses docker-compose.test.yml; E2E runs green | DevOps, Week 1 | GH Actions run; artifacts | SRE best practices
- [Critical] Historical dataset & feature store baseline | First market dataset + point-in-time features | Data/ML, Week 3 | Data tests; schema checks | ISO27001 A.12.1; SRE data quality
- [Critical] Baseline models with calibration | Calibrated probability model + evaluation | ML, Week 6 | AUC/Brier/ECE dashboards | SRE best practices
- [Critical] Alerting implemented | Alertmanager routes; paging tested | DevOps, Week 2 | Alert fire drill logs | SRE best practices
- [Critical] Security scans zero high/critical | Trivy/Snyk clean | DevOps, ongoing | CI security stage | SOC2 CC7, ISO27001 A.12.6

### High
- [High] OpenTelemetry traces | API initializes telemetry to OTLP | Platform, Week 2 | Trace visible in backend | SRE best practices
- [High] Log aggregation | Centralized structured logs with trace IDs | DevOps, Week 3 | Loki/ELK dashboards | SRE logging
- [High] HPAs/PDBs | Autoscaling and disruption budgets | DevOps, Week 6 | kubectl get hpa/pdb | SRE best practices
- [High] Progressive delivery | Argo Rollouts/Flagger | DevOps, Week 8 | rollout history; canary success | SRE deployments
- [High] Type safety enforcement | All apps strict TS; no SKIP_TYPE_CHECK | Platform, Week 4 | CI type-check stage | SOC2 change mgmt

### Medium
- [Medium] Runbooks & incident response | Playbooks updated and tested | Ops, Week 4 | Tabletop exercise notes | SRE incident mgmt
- [Medium] Risk limits & DLQs enforced | Circuit breakers, retries, DLQs standardized | Platform, Week 5 | Chaos test; metrics | SRE resilience
- [Medium] Standardized health | Consistent /health detail across services | Platform, Week 3 | Integration tests | SRE best practices

### Low
- [Low] Documentation consolidation | Single source of truth; deprecated marked | Docs, Week 6 | Doc review checklist | SOC2 documentation
- [Low] Cost/efficiency | Metrics budgets; LLM spend guardrails | Ops, Week 8 | Cost reports | FinOps/SRE

## Acceptance Criteria Examples (Detailed)

- API metrics exposure: Response includes prom-client default and custom counters; Prometheus target status=up for api; Grafana dashboard renders http latency histogram.
- Baseline models: AUC >= 0.70 (market-dependent), ECE <= 0.03; backtests show positive ROI vs close; reports archived in MLflow with artifacts.
- Progressive delivery: Canaries receive <=10% traffic initially; automatic rollback on error rate > 1% or latency p95 > 500ms for 10m.

## Owners, Timelines, Verification Methods

- DevOps: CI/CD fixes, observability, K8s hardening; verify via GH Actions, kubectl, Grafana/Prometheus, alert fire drills.
- Platform: API changes, telemetry, health standardization; verify via integration tests and smoke scripts.
- Data/ML: Datasets, feature store, training/eval/serving; verify via MLflow, dashboards, shadow results.
- Ops: Runbooks, incident response, cost controls; verify via drills and cost reports.

## Standards Mapping

- SOC2: CC7 (change mgmt), CC2 (availability), CC6 (security) via CI gates, RBAC, incident response.
- ISO27001: A.12 (ops security), A.16 (incident mgmt), A.17 (BC/DR) via runbooks, backups, DR tests.
- SRE: SLIs/SLOs, error budgets, progressive delivery, incident mgmt, robust monitoring and logging.

## Repository Hygiene Plan

- Consolidate scripts: remove duplicates; ensure single canonical health/ops scripts; align ports/paths.
- Mark legacy/experimental directories; add deprecation banners; update all READMEs.
- Enforce config consistency via lint/check scripts in CI.

## Execution Standards

- Enterprise-grade implementations; fix root causes; comprehensive tests (unit/integration/E2E/perf). Decisions/trade-offs captured in CHANGELOG and ADRs.

## Success Criteria

- Green CI/CD; 100% Critical/High complete; SLOs: 99.9% uptime, p95<200ms, error<0.1%; monitoring+alerting operational; zero high/critical vulns; load testing passes; DR tested and documented.

