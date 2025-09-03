## Production Readiness Plan — Unit Talk Platform
Date: 2025-09-01
Owner: Engineering
Status: In Progress

### Executive Summary
- Overall SaaS build readiness: 86/100
- Verdict: Production-capable after targeted fixes to Discord-bot data layer, type/build health, schema consistency, and selective performance work in Grading and Next.js.

### Baseline Scores (0–100)
- Architecture & code quality: 85
- Agents & orchestration (Temporal, BaseAgent): 90
- Data model & schema (v3 unified): 88
- API performance & reliability: 80
- Business logic correctness (grading, alerts, risk): 86
- Algorithms/modeling depth: 72
- Frontend (Command Center, Dashboard): 78
- Discord bot (state and data layer): 65
- Security posture: 82
- Observability & monitoring: 88
- CI/CD & DevOps: 84
- Testing & QA: 78
- Documentation & runbooks: 92

### Non‑Negotiable Quality Gates
- No TypeScript errors across all apps (api, dashboard, command-center, smart-form, discord-bot).
- All Dockerized builds succeed; health checks green.
- E2E smoke tests pass per app; minimum test coverage ≥80% (unit+integration).
- npm audit shows no high/critical vulnerabilities on main.
- Database migrations idempotent; v3 schema applied; required tables exist.
- Rate limiting enabled on public-facing surfaces (API and bot flows).

---

## Ordered Implementation Plan (We will complete ALL items)

### Phase 0 – Pre‑flight (Day 0)
- Verify Docker stack up, service health, and logs are clean.
- Verify db migration status and apply pending migrations.
- Baseline metrics: API p95 latency, grading throughput, Next.js bundle sizes.

Acceptance/Verification
- ./dev.sh start; ./dev.sh status; ./dev.sh logs show no errors.
- docker-compose exec api npm run db:status && npm run db:migrate returns clean status.
- Record current metrics from monitoring dashboards (Prometheus/Grafana) and Command Center.

### Phase 1 – Blockers (Week 1)
1) Eliminate Discord‑bot dual database usage (MySQL → Supabase)
- Replace all usages of apps/discord-bot/src/data/mysql.js (and imports like events/client/loadTasks.js, messageTracker.js) with the typed DatabaseService at apps/discord-bot/src/services/database.ts.
- Remove mysql/mysql2 dependencies and MySQL connection logic.
- Consolidate schema into v3 unified Supabase; apply sql in apps/discord-bot/database/*.sql where applicable.
Acceptance/Verification
- Search returns zero references to mysql2/createPool/mysql.js in apps/discord-bot/src.
- Bot functional tests pass (commands, onboarding, picks, message tracking).
- One consistent DB: SUPABASE only. All related env validated via config.

2) Clean type‑check and production builds across all apps
- Run type-check and build in Docker for api, dashboard, command-center, smart-form, discord-bot.
- Resolve legacy/incorrect imports (e.g., discord SDK inconsistencies), unknown types, and build/minify issues.
- Set Next.js “treat TS errors as build-blocking” on production builds.
Acceptance/Verification
- dockerized npm run type-check && npm run build succeed for every app.
- CI: Code Quality and Build jobs green on PR.

3) Apply and verify full v3 schema + required tables
- Ensure all migrations (migrations/005_v3_schema_alignment.sql, etc.) have been applied; include any missing tables referenced by apps (e.g., system_metrics) via idempotent SQL.
- Standardize a single Docker command to apply full schema.
Acceptance/Verification
- db:status shows no pending migrations; validation queries for required tables pass.

4) Enforce rate limiting and basic abuse protections
- API: add middleware (global and key endpoints) with sane defaults.
- Discord-bot: ensure message/command rate limits and cooldowns are enforced centrally.
Acceptance/Verification
- Automated tests demonstrate throttling; none of the public routes are unlimited.

### Phase 2 – Performance & Hardening (Week 2)
5) Query Optimizer and selective columns
- Introduce a shared query utility that:
  - Selects only needed columns (remove SELECT *),
  - Supports short TTL caching for hot reads (e.g., raw_props/unified_picks),
  - Captures query timing metrics.
Acceptance/Verification
- Hot paths (e.g., GradingAgent raw_props intake) use selective column lists.
- p95 DB read time improves 3–5x on targeted endpoints.

6) Parallelize heavy Grading steps
- Convert sequential awaits (steam detection, closing line prediction, timing heuristics) to parallel with bounded concurrency and circuit breakers.
- Add per-step timing and success metrics.
Acceptance/Verification
- Grading throughput increases from baseline toward target (5–7x improvement on step timing; overall throughput goal ≥1000 props/sec in synthetic tests).

7) Frontend performance optimization (Next.js)
- Enable optimizePackageImports for heavy libraries and introduce code-splitting/dynamic imports.
- Audit server vs client components and reduce bundle size.
Acceptance/Verification
- Initial bundle <500KB; Lighthouse/Next analyzer confirms reductions; p95 route TTFB and FCP improved.

### Phase 3 – Operational Excellence (Week 3)
8) CI tightening and coverage enforcement
- Add E2E smoke tests per app to CI matrix jobs; enforce coverage ≥80%.
- Add Dockerized prod-like build/test job gating merges.
Acceptance/Verification
- CI fails on TS errors, build errors, coverage <80%, or E2E smoke failure.

9) Security posture hardening
- Add secret scanning in CI; schedule weekly audit.
- Improve secrets management path (plan SOPS/Sealed Secrets for K8s); avoid leaking service role keys anywhere client-side.
Acceptance/Verification
- CI secret scan job passes; dependency audit shows no high/critical.

10) Load and resilience drills
- Define load profiles; test for API p95 <100ms; DB p95 <50ms on targeted queries.
- Failure injection for agent workflows; verify circuit-breakers and retries.
Acceptance/Verification
- Load tests meet SLOs; chaos tests show graceful degradation and recovery.

### Phase 4 – Competitive Uplift (Weeks 4–8)
11) Research/ML pipeline
- Establish feature store, experiment tracking, model registry, backtesting harness for props.
- Start with supervised models for prop outcomes and CLV estimation; continuous evaluation.
Acceptance/Verification
- Experiments logged; CI cron runs backtests; models versioned; basic model beats baseline heuristics.

12) Market breadth and execution readiness
- Expand odds integrations and normalization; measure end-to-end ingest latency.
- Design an execution router (non-production at first) with latency metrics.
Acceptance/Verification
- Ingest latency SLOs tracked; router prototype can simulate route decisions with recorded feeds.

---

## DevOps, CI/CD and Verification Commands (Docker‑Only)
- Start/Status/Logs
  - ./dev.sh start
  - ./dev.sh status
  - ./dev.sh logs
- Database Migrations
  - docker-compose exec api npm run db:status
  - docker-compose exec api npm run db:migrate
- Type Check & Build (examples)
  - docker-compose exec api npm run type-check && npm run build
  - docker-compose exec dashboard npm run build
  - docker-compose exec command-center npm run build
  - docker-compose exec smart-form npm run build
  - docker-compose exec discord-bot npm run type-check && npm run build
- Tests & Lint
  - docker-compose exec api npm run test
  - docker-compose exec api npm run lint
  - docker-compose exec api npm run type-check
- E2E
  - docker-compose exec api npm run test:e2e (or suite-specific scripts under qa-framework/ and tools/)

---

## Acceptance Criteria for Final Sign‑Off
- 0 TypeScript errors; 0 build errors across all apps.
- CI pipeline green with coverage ≥80% and E2E smokes passing.
- Docker health checks all green; Prometheus/Grafana dashboards show no critical alerts.
- Database v3 schema verified; no missing required tables; migrations idempotent.
- API p95 <100ms; targeted DB reads p95 <50ms; grading step latency reduced 5–7x on parallelized phases.
- Discord-bot exclusively uses Supabase; all MySQL references removed.
- Security checks: no high/critical npm audit findings; secret scanning clean; rate limiting enforced.

---

## Risks & Mitigations
- Scope creep in ML uplift → Stage deliverables; deliver initial baseline model + evaluation before adding markets.
- Hidden schema coupling → Maintain idempotent migrations; add validation scripts (tools/check-*.js) to CI.
- Build flakiness in Next.js → Treat TS errors as fatal; lock dependency versions; add bundle analyzer to CI.

---

## Tracking Checklist (to be updated during execution)
- [ ] Discord-bot MySQL fully removed; Supabase only
- [ ] All apps type-check and build clean (Docker)
- [ ] v3 schema applied and validated
- [ ] Rate limiting enforced across surfaces
- [ ] Query optimizer in hot paths; no SELECT * on hot tables
- [ ] Grading steps parallelized with metrics
- [ ] Next.js bundles optimized (<500KB initial)
- [ ] CI gates: E2E smokes + coverage ≥80%
- [ ] Security scans and secrets plan enacted
- [ ] Load/resilience SLOs met
- [ ] ML pipeline baseline established
