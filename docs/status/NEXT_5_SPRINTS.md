# Next 5 Sprints

**Last Updated**: 2026-03-15
(SPRINT-050-LAYER3-PHASE10-CC-PERMISSION-ENFORCEMENT) **Source**: Phase status +
drift report + Layer 3 scoping analysis + Claude OS backlog + codebase
investigation

> **Layer 3 Entry**: Layer 1 and Layer 2 are both COMPLETE. The sprint queue now
> targets Layer 3 (Product Complete — Phases 9–11) and governance maintenance.
> See `docs/06_status/current_phase.md` for canonical layer/phase position.

---

## Sprint 1: SPRINT-050-LAYER3-PHASE9-SMARTFORM-UX-POLISH

**Priority**: P2 | **Phase**: Layer 3 / Phase 9 — SmartForm UX | **Depends On**:
None

**Objective**: Polish the Smart Form pick submission UX with accessibility
improvements, mobile-first refinements, and component extraction for
maintainability.

**Rationale**: Smart Form is functional (sportsbook-style manual entry, bet slip
panel, keyboard shortcuts) but has not received UX polish since the initial
build sprint. Large components (SportsbookManualEntry 64KB, PickWizard 41KB)
need extraction. Mobile responsiveness and accessibility (WCAG 2.1 AA) not
verified.

**Tasks**:

1. Audit Smart Form for WCAG 2.1 AA compliance (form labels, focus states, ARIA
   attributes, color contrast)
2. Test and fix mobile responsiveness at 375w, 768w, and 1024w breakpoints
3. Extract LegCard and BetSlipPanel into smaller, composable components
4. Document keyboard shortcuts (already implemented but undocumented)
5. Improve form field validation error display (inline errors, field-level
   feedback)
6. Add Smart Form specific vitest tests for extracted components

**Success Criteria**:

- Smart Form passes WCAG 2.1 AA audit for core submission flow
- Responsive layout verified at 375w, 768w, 1024w
- No component file exceeds 40KB after extraction
- Keyboard shortcuts documented in accessible help panel
- Smart Form build passes, no type-check regressions

---

## Sprint 2: SPRINT-051-LAYER3-PHASE11-OPERATOR-WORKFLOW-FOUNDATION

**Priority**: P1 | **Phase**: Layer 3 / Phase 11 — Workflow Optimization |
**Depends On**: None (SPRINT-049 CC auth context delivered)

**Objective**: Build the foundation for operator workflow management: a unified
CLI entry point, workflow registry for 50+ scripts, and a discoverability
endpoint.

**Rationale**: 50+ utility scripts exist in `apps/api/src/scripts/` with no
registry, no help system, and no unified entry point. Operator routes are
scattered across 5+ route files. This sprint creates the infrastructure that
Phase 11 UX (workflow UI, batch operations) will build on.

**Tasks**:

1. Create a workflow registry that auto-discovers scripts in
   `apps/api/src/scripts/` with metadata (name, description, parameters,
   category)
2. Build unified CLI entry point: `pnpm ops:<workflow>` commands mapping to
   registered workflows
3. Add `GET /api/ops/workflows` endpoint exposing the registry for Command
   Center consumption
4. Categorize existing scripts (ingestion, settlement, backfill, analysis,
   health)
5. Add `--help` support for each registered workflow
6. Wire Temporal workflow triggers where applicable (feed ingestion, analytics)

**Success Criteria**:

- Workflow registry discovers and catalogs all scripts in
  `apps/api/src/scripts/`
- `pnpm ops:list` shows all available workflows with descriptions
- `GET /api/ops/workflows` returns registry in JSON format
- At least 10 scripts registered with metadata
- All operator actions logged via `operatorAuditLog` middleware
- All gates pass

---

## Sprint 3: SPRINT-052-GOVERNANCE-NAMING-CONVENTION

**Priority**: P2 | **Phase**: Meta (Governance) | **Depends On**: None

**Objective**: Resolve DRIFT-H2 (sprint naming convention inconsistency) by
establishing and documenting a canonical naming convention, then reconciling
legacy git tags.

**Rationale**: Legacy git tags use `SPRINT-<NAME>-###` numbering while recent
sprints use descriptive names only (`SPRINT-PROMOTION-PIPELINE-ACTIVATION`).
Cross-referencing sprints between git tags, Linear issues, and docs requires
manual mapping. This is the highest-severity active drift item (HIGH).

**Tasks**:

1. Document the canonical sprint naming convention in
   `docs/claude/SPRINT_NAMING_CONVENTION.md`
2. Decide: keep descriptive-only names (current practice) or restore
   `<NAME>-###` (legacy)
3. Update `CLAUDE.md` sprint naming section to reference the canonical doc
4. Create a mapping table of legacy numbered tags to their descriptive
   equivalents
5. Update `tools/governance/sprint-gate.js` to validate the chosen convention
6. Update DRIFT_REPORT.md to resolve DRIFT-H2

**Success Criteria**:

- Canonical naming convention documented and referenced from CLAUDE.md
- Sprint gate validates name format
- DRIFT-H2 resolved in DRIFT_REPORT.md
- No code changes — governance docs + tooling only

---

## Sprint 4: SPRINT-053-LAYER3-PHASE10-REPLAY-ENDPOINT

**Priority**: P2 | **Phase**: Layer 3 / Phase 10 — Command Center UX | **Depends
On**: None (SPRINT-049 auth context delivered)

**Objective**: Wire the Temporal `startWorkflow` call in `/api/replay/route.ts`
(currently TODO) and connect replay triggers to the Command Center UI.

**Rationale**: The replay endpoint was scaffolded in SPRINT-044-LAYER2-PHASE8
but the Temporal `startWorkflow` method is still a TODO. With auth context from
Sprint 1 available, this sprint completes the replay loop: CC UI → replay API →
Temporal workflow.

**Tasks**:

1. Audit `apps/command-center/src/app/api/replay/route.ts` for the TODO
2. Wire `startWorkflow` using the Temporal client (pattern from existing
   workflow callers in `apps/api/`)
3. Add actor identity from auth context to the workflow input
4. Add a replay trigger button to the Command Center replay page
5. Add vitest unit tests for the route handler

**Success Criteria**:

- Replay API accepts POST with replay params and starts a Temporal workflow
- Actor identity is sourced from auth context (not hardcoded)
- UI has a functional trigger button
- All gates pass

---

## Summary

| #   | Sprint                                     | Priority | Phase    | Focus                                        | Linear | Blocked By |
| --- | ------------------------------------------ | -------- | -------- | -------------------------------------------- | ------ | ---------- |
| 1   | 050-LAYER3-PHASE9-SMARTFORM-UX-POLISH      | P2       | L3/Ph 9  | Accessibility, mobile, component extraction  | TBD    | None       |
| 2   | 051-LAYER3-PHASE11-OPERATOR-WORKFLOW-FNDTN | P1       | L3/Ph 11 | Workflow registry + CLI + discovery endpoint | TBD    | None       |
| 3   | 052-GOVERNANCE-NAMING-CONVENTION           | P2       | Meta     | Resolve DRIFT-H2 naming inconsistency        | TBD    | None       |
| 4   | 053-LAYER3-PHASE10-REPLAY-ENDPOINT         | P2       | L3/Ph 10 | Wire Temporal startWorkflow in replay route  | TBD    | None       |

**Total estimated effort**: 4–6 days **Dependency chain**: All sprints are now
independent — SPRINT-049 (auth context) completed and unblocked Sprints 2 and 4.

---

## Completed Sprint History

<details>
<summary>22 sprints completed (2026-03-10 through 2026-03-15) — click to expand</summary>

| Sprint                           | Date       | PR   | Linear    | Layer/Phase |
| -------------------------------- | ---------- | ---- | --------- | ----------- |
| RISK-BANKROLL-KELLY              | 2026-03-10 | #141 | UNI-53    | Ph 3        |
| RISK-EXPOSURE-CORRELATION        | 2026-03-10 | #142 | UNI-54    | Ph 3        |
| OBSERVABILITY-BUILD-FIX          | 2026-03-10 | #146 | UNI-55    | Ph 1        |
| PROMOTION-RUNTIME-ACTIVATION     | 2026-03-10 | #149 | UNI-56    | Ph 1→3      |
| DISCORD-RECAP-VERIFICATION       | 2026-03-10 | #152 | UNI-57    | Ph 4        |
| LAYER1-PHASE5-E2E-CLOSURE        | 2026-03-14 | #163 | —         | L1/Ph 5     |
| CLAUDE-OS-UPGRADE-COS001-005     | 2026-03-14 | #170 | UNI-64–68 | Meta        |
| RISK-DASHBOARD-MONITORING        | 2026-03-14 | #177 | UNI-69    | L2/Ph 7     |
| JEST-QUARANTINE-CLEANUP          | 2026-03-14 | —    | UNI-70    | L1/Ph 0     |
| 041-MARKET-TYPE-EXPOSURE-CAPS    | 2026-03-14 | #185 | UNI-72    | Ph 3        |
| 042-LAYER2-PHASE6-OPERATOR-CP    | 2026-03-14 | #189 | —         | L2/Ph 6     |
| 043-LAYER2-PHASE7-RELIABILITY    | 2026-03-14 | #191 | UNI-74    | L2/Ph 7     |
| 044-LAYER2-PHASE8-RECOVERY       | 2026-03-14 | #199 | UNI-77    | L2/Ph 8     |
| PLATFORM-VERIFICATION-LOCK       | 2026-03-14 | —    | —         | L2          |
| 045-OPERATOR-AUTH-HARDENING      | 2026-03-14 | —    | —         | L2/Sec      |
| 045-SCHEMA-TYPE-SYNC             | 2026-03-14 | —    | —         | Infra       |
| 046-OPERATOR-AUDIT-TRAIL         | 2026-03-14 | #210 | —         | L2/Sec      |
| 047-INGESTION-UNIT-COVERAGE-LOCK | 2026-03-14 | #211 | UNI-81    | L2/Ph 7     |
| 048-TRUTH-RECONCILIATION-LAYER3  | 2026-03-15 | #215 | UNI-82    | Meta        |
| COS-007-SPRINT-CLOSE-VALIDATION  | 2026-03-15 | #217 | UNI-83    | Claude OS   |
| 049-LAYER3-PHASE10-CC-AUTH-FNDTN | 2026-03-15 | #221 | UNI-84    | L3/Ph 10    |
| 050-LAYER3-PHASE10-CC-PERM-ENF   | 2026-03-15 | #224 | UNI-85    | L3/Ph 10    |

</details>
