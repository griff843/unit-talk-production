# Phase Status

**Last Updated**: 2026-03-10
**Source**: Linear initiatives + repo implementation + sprint closeouts

---

## PHASE 1 — Structural Dominance

**Linear Status**: Active | **Health**: At Risk
**Initiative**: Lock runtime, enforce canonical state, deterministic outbox, settlement immutability

### Completed Work
- Single-writer discipline architecture (lifecycle adapters, gate, allowlist)
- Fail-closed boot enforcement
- Canonical Supabase host validation
- Lifecycle state machine (DRAFT → SETTLED)
- Outbox pattern for Discord publishing (pick_publish)
- Bridge outbox for Smart Form (bridge_outbox)
- Settlement immutability (DB triggers + lifecycle guards)
- TOCTOU lock for settlement (latest sprint)
- Idempotency guards (submit/post/settle)
- Autopilot freeze mechanism
- 73 database migrations applied
- CI pipeline with lifecycle gate

### Additional Completed Work (Sprint Closeouts through 2026-03-09)
- Single-writer migration: 0 violations, 0 allowlist entries (SPRINT-SINGLE-WRITER-COMPLETION)
- Promotion pipeline wired: DiscordPromotionAgent Temporal activities + shadow mode fixed (SPRINT-PROMOTION-PIPELINE-ACTIVATION)
- Test infrastructure: vitest 701/701, type-check 0 errors (SPRINT-TEST-INFRA-RECOVERY + subsequent sprints)
- Observability: FM-2 (outbox depth), FM-5 (orphaned picks), FM-9 (worker heartbeat) (SPRINT-OPERATIONAL-OBSERVABILITY)
- Build verification: API PASS, Command Center PASS, Observability PASS (SPRINT-OBSERVABILITY-BUILD-FIX, 2026-03-10)

### Remaining Gaps
- Promotion requires runtime env config: `AUTOPILOT_MODE=prod`, `PROMOTION_CANARY_PERCENT>0`, `DISCORD_WEBHOOK_URL`
- Jest test suite in `test/` ~79 quarantined/broken (separate from vitest)
- Smart Form build pre-existing BROKEN on Windows (Next.js 14.2.35 pnpm extraction)

### Assessment
**PHASE 1 is 95% complete.** Core invariants enforced, migration debt cleared, promotion pipeline wired, builds verified. Remaining gaps are runtime promotion config, Jest quarantine, and Smart Form Windows build.

---

## PHASE 2 — Intelligence Superiority

**Linear Status**: Active | **Health**: At Risk
**Initiative**: Market data normalization, consensus probability, sharp signal extraction, model separation, stat distributions, CLV validation

### Completed Work (Intelligence Pipeline — SPRINT-031 through SPRINT-039)
- Model separation (sharp consensus, signal-enhanced CLV)
- Stat projection pipeline (modules + test suite)
- Signal math corrections (Z-score, Kelly)
- Market reaction layer
- Outcome tracking + baseline ROI
- Production pick selection engine
- Promotion band calibration (49 tests)
- Walk-forward evaluation hardening (26 tests)
- Daily metrics + drift rollups (24 tests)
- Model calibration loop (29 tests)
- CLV edge validation layer: `clvAnalyzer`, `edgeValidator`, `edgeCalibrator` — 46 tests (SPRINT-PHASE2-CLV-EDGE-VALIDATION, 2026-03-10)

### Completed Work (Architecture Migration — SPRINT-044A through 044E)
- Pipeline unblocker (writer authority + promotion policy)
- Ingestion migration (provider_offers + SGO adapter)
- Settlement verification (SGO + bet_side confirmation)
- Scoring migration (GradingAgent → provider_offers + closing snapshots)
- Cleanup (PlayerEnrichmentAgent + raw_props retirement)

### Remaining Work (Linear Todo — Sprint 029)
- UNI-11: V3 multi-book consensus scoring pipeline ✅ (implemented — see DRIFT-M-CONSENSUS resolution)
- UNI-12: Shadow scoring service — V3 alongside legacy ✅ (implemented)
- UNI-13: Market offer aggregator and book adapters ✅ (implemented)
- UNI-16: Edge validation framework — CLV backtesting ✅ **DONE** (SPRINT-PHASE2-CLV-EDGE-VALIDATION, 2026-03-10)
- UNI-15: Publish outbox — Discord posting pipeline alignment ✅ (SPRINT-PROMOTION-PIPELINE-ACTIVATION)
- UNI-14: Complete Linear migration — GitHub integration (Urgent — DRIFT-H4)

### Assessment
**PHASE 2 is 80% complete.** Intelligence pipeline sprints (031-039) are done. Architecture migration (044A-044E) is done. CLV edge validation (UNI-16) is done. Multi-book consensus, shadow scoring, and market aggregator are fully implemented. Only remaining gap: Linear-GitHub integration (UNI-14).

---

## PHASE 3 — Risk Engine Dominance

**Linear Status**: Planned | **Health**: On Track
**Initiative**: Bankroll management, Kelly criterion, exposure caps, correlation controls, drawdown freeze

### Completed Work
- Risk engine foundation migration deployed (`20260302150401_risk_engine_foundation.sql`)
- Market policy table created (`20260306210000_market_policy.sql`)
- RiskEngine service implemented with Kelly threshold, event-level exposure, drift detection
- RiskEngine pre-flight gate wired into GradingAgent `promoteFromProviderOffer()` — fail-closed (SPRINT-RISK-ENGINE-INTEGRATION, 2026-03-09)
- 17 integration tests: 10 RiskEngine scenarios + 7 GradingAgent gate tests
- Bankroll-aware Kelly sizing: `KellySizer.ts` with `computeKellySize()`, `computeKellyFraction()`, `americanToDecimal()` (SPRINT-RISK-BANKROLL-KELLY, 2026-03-10)
- RiskEngine returns `RiskSizing` with recommended units, fractional Kelly, cap enforcement
- ProfessionalPropProcessor: `kelly_fraction: 0` replaced with real computation from pFinal + odds
- GradingAgent passes sizing inputs (winProbability + decimalOdds) to RiskEngine gate
- 36 new Kelly sizer tests (666 total vitest passing)
- Sport-level exposure caps via ExposureCalculator extension with `events` join (SPRINT-RISK-EXPOSURE-CORRELATION, 2026-03-10)
- CorrelationDetector: same-event and same-participant cluster detection from pending ticket_legs
- DrawdownTracker: daily P&L computation with configurable freeze threshold
- 5 new risk_engine_config fields: sport_kelly_limit, correlation_max_same_event, correlation_max_same_participant, drawdown_freeze_threshold, drawdown_lookback_days
- All 3 new gate checks wired into RiskEngine.evaluateForPromotion() (fail-closed)
- 35 new exposure/correlation/drawdown tests (701 total vitest passing)

### Remaining Work
- Risk dashboard / monitoring UI for risk state visibility
- Historical risk decision audit trail queries
- Market-type level exposure caps (beyond sport-level)

### Assessment
**PHASE 3 is 70% complete.** Core risk controls fully implemented: Kelly sizing, exposure caps (total + event + sport), correlation detection, drawdown freeze. All gates wired into promotion pipeline with fail-closed semantics. Remaining work is visibility tooling and refinement, not core risk logic.

---

## PHASE 4 — Automation Supremacy

**Linear Status**: Planned | **Health**: On Track
**Initiative**: Workflow automation, edge ranking feeds, market alerts, context/recap automation

### Completed Work
- AlertAgent live with AI-generated advice
- RecapAgent infrastructure complete
- Temporal workflow orchestration in place
- Discord bot standalone deployment

### Remaining Work
- Automated edge ranking feeds
- Full market alert automation
- Context-aware recap generation
- Workflow orchestration refinement

### Assessment
**PHASE 4 is 20% complete.** Building blocks exist. Automation logic not yet integrated.

---

## PHASE 5 — Enterprise Scaling

**Linear Status**: Planned | **Health**: On Track
**Initiative**: Tenant isolation, config scoping, branded delivery, tenant controls

### Completed Work
- None specific to enterprise scaling

### Remaining Work
- Multi-tenant architecture
- Config scoping per tenant
- Branded delivery channels
- Tenant-level controls

### Assessment
**PHASE 5 is 0% complete.** Not started.

---

## Phase Summary

| Phase | Status | Completion | Blocking Issues |
|-------|--------|------------|-----------------|
| **Phase 1** — Structural Dominance | Active | 95% | Runtime env config, Jest quarantine, Smart Form Windows build |
| **Phase 2** — Intelligence Superiority | Active | 80% | Linear-GitHub integration (UNI-14) |
| **Phase 3** — Risk Engine Dominance | Active | 70% | Core risk controls complete (Kelly, exposure, correlation, drawdown); visibility tooling remaining |
| **Phase 4** — Automation Supremacy | Planned | 20% | Blocked by Phase 3 |
| **Phase 5** — Enterprise Scaling | Planned | 0% | Blocked by Phase 4 |

**Current Platform Phase**: Transitioning from Phase 1 → Phase 2 (parallel tracks)
