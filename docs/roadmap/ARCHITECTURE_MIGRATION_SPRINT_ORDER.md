# Architecture Migration Sprint Order (Locked)

Status: LOCKED Last Updated: 2026-03-07 Owner: Unit Talk Architecture Reference:
docs/system/analysis/system-gap-analysis.md

---

## Purpose

Close all 14 gaps between current architecture (`docs/system/current/`) and
target architecture (`docs/system/target/`). This track runs in parallel with
the intelligence pipeline sprint order.

Gap analysis: 3 CRITICAL, 3 HIGH, 5 MEDIUM, 3 LOW gaps identified across
ingestion, scoring, settlement, promotion, and data model.

---

## Completed Sprints (Infrastructure Track)

### SPRINT-035A — Runtime Truth Audit

- Runtime drift audit, NO-GO blockers identified
- 12 matches, 7 doc stale, 5 doc dangerous, code drift detected
- Commit: `52c638d1` | Linear: UNI-38

### SPRINT-035B — Runtime Remediation

- 7 correctness fixes for runtime blockers
- Commit: `64c526fb`

### SPRINT-041A — E2E Platform Operational Validation

- 8 health checks, production readiness gate
- 37 passing tests, deterministic report generation
- Commit: `a136fcc9` | Linear: UNI-37

### SPRINT-041D — Lifecycle Writer-Role Corrections

- Writer authority fixes for poster/settler roles
- Commit: `49112872`

### SPRINT-042C — SGO-Primary Settlement

- Settlement source priority: SGO (finalized=true) > Odds API
- bet_side fix: explicit fields instead of odds heuristic
- Closes: GAP-02 (settlement source), GAP-11 (bet_side)
- Commit: `51445f74`

### SPRINT-042D — GradingAgent Runtime Fix

- GradingAgent method stubs for Temporal workflow activities
- Commit: `99daff17`

### SPRINT-043A — SGO Data Router Integration

- SGO as fallback provider in dataSourceRouter
- SGO data flowing to raw_props (interim path)
- Commit: `287bc4e1`

### SPRINT-SYSTEM-DOCUMENTATION-FOUNDATION

- 11 canonical system docs: current state, target state, gap analysis
- 14 gaps classified and prioritized
- Pending commit

---

## Active Migration Sprints (Gap Closure)

### SPRINT-PIPELINE-UNBLOCKER-044A

- **Gaps**: GAP-03 (lifecycle adapter blocks promotion), GAP-06 (promotion
  policy disabled)
- **Project**: Platform API
- **Priority**: P0 — unblocks entire automated pipeline
- **Depends on**: Nothing
- **Files**:
  - `apps/api/src/lib/lifecycle/writer-authority.ts` — add `promoter` to 19
    field authorities
  - Environment config — `PROMOTION_POLICY_V2=true` + canary settings

### SPRINT-INGESTION-MIGRATION-044B

- **Gaps**: GAP-01 (raw_props to provider_offers), GAP-08 (scheduler wiring),
  GAP-09 (SGO adapter), GAP-05 (FK resolution — automatic via RPC)
- **Project**: Market Data Engine
- **Priority**: P0 — core data pipeline migration
- **Depends on**: Nothing (parallel with 044A)
- **Files**:
  - `apps/api/src/workflows/syndicate-scheduler.ts` — add provider_offers
    workflow
  - `apps/api/src/agents/FeedAgent/activities/index.ts` — export new activity
  - `apps/api/src/agents/IngestionAgent/providerOffersIngestion.ts` — add SGO
    path
  - NEW: `apps/api/src/agents/IngestionAgent/sgoProviderOffersAdapter.ts`

### SPRINT-SETTLEMENT-VERIFICATION-044C

- **Gaps**: GAP-02 (verify SGO settlement), GAP-11 (verify bet_side fix)
- **Project**: Platform API
- **Priority**: P1 — verification only, no code changes expected
- **Depends on**: Nothing
- **Status**: Both gaps already fixed by SPRINT-042C — needs runtime
  verification proof only

### SPRINT-SCORING-MIGRATION-044D

- **Gaps**: GAP-04 (GradingAgent reads provider_offers), GAP-10 (closing
  snapshots), GAP-07 (deprecate ScoringAgent)
- **Project**: Scoring Engine
- **Priority**: P1 — major GradingAgent refactor
- **Depends on**: SPRINT-044B (provider_offers must be populated)
- **Files**:
  - `apps/api/src/agents/GradingAgent/GradingAgent.ts` — new
    fetchPendingProviderOffers() + feature flag
  - `apps/api/src/workflows/syndicate-scheduler.ts` — closing snapshot workflow
  - `apps/api/src/agents/ScoringAgent/index.ts` — deprecation notice
  - NEW: Migration adding `graded_at` column to provider_offers

### SPRINT-CLEANUP-044E

- **Gaps**: GAP-14 (PlayerEnrichmentAgent to participants table), GAP-12/13
  (raw_props performance — self-resolving)
- **Project**: Platform API
- **Priority**: P2 — cleanup after migration
- **Depends on**: SPRINT-044D
- **Files**:
  - `apps/api/src/agents/PlayerEnrichmentAgent.ts` — swap players to
    participants

---

## Dependency Graph

```
SPRINT-044A (Pipeline Unblocker) ──┐
                                   ├──→ SPRINT-044D (Scoring Migration)
SPRINT-044B (Ingestion Migration) ─┘         │
                                             v
SPRINT-044C (Settlement Verify)        SPRINT-044E (Cleanup)
  (independent)                              │
                                             v
                                    UNI-11, UNI-12, UNI-13, UNI-16
                                    (existing Todo issues unblocked)
```

---

## Governance Rule

These sprints follow the same governance as intelligence pipeline sprints:

- No reordering without architecture decision + repo update + commit proof
- Each sprint must be complete, committed, and linked to Linear before next
- Sprint D cannot begin until Sprint B is complete
- Sprint E cannot begin until Sprint D is complete
- Sprints A, B, and C are independent and may run in parallel

---

## Cross-Reference

- Intelligence pipeline sprints:
  `docs/roadmap/INTELLIGENCE_PIPELINE_SPRINT_ORDER.md`
- Gap analysis: `docs/system/analysis/system-gap-analysis.md`
- Current architecture: `docs/system/current/`
- Target architecture: `docs/system/target/`
