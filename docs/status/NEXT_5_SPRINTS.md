# Next 5 Sprints

**Last Updated**: 2026-03-15 (SPRINT-053-GOVERNANCE-NAMING-CONVENTION)
**Source**: Phase status + drift report + Layer 3 scoping analysis + Claude OS
backlog + codebase investigation

> **Layer 3 Entry**: Layer 1 and Layer 2 are both COMPLETE. The sprint queue now
> targets Layer 3 (Product Complete — Phases 9–11) and governance maintenance.
> See `docs/06_status/current_phase.md` for canonical layer/phase position.

---

## Sprint 1: SPRINT-054-LAYER3-PHASE10-REPLAY-ENDPOINT

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

| #   | Sprint                             | Priority | Phase    | Focus                                       | Linear | Blocked By |
| --- | ---------------------------------- | -------- | -------- | ------------------------------------------- | ------ | ---------- |
| 1   | 054-LAYER3-PHASE10-REPLAY-ENDPOINT | P2       | L3/Ph 10 | Wire Temporal startWorkflow in replay route | TBD    | None       |

**Total estimated effort**: 1–2 days **Dependency chain**: All sprints are now
independent — SPRINT-049 (auth context), SPRINT-052 (workflow registry), and
SPRINT-053 (naming convention) all completed.

---

## Completed Sprint History

<details>
<summary>25 sprints completed (2026-03-10 through 2026-03-15) — click to expand</summary>

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
| 051-LAYER3-PHASE9-SMARTFORM-UX   | 2026-03-15 | #227 | UNI-86    | L3/Ph 9     |
| 052-LAYER3-PHASE11-OP-WORKFLOW   | 2026-03-15 | #230 | UNI-87    | L3/Ph 11    |
| 053-GOVERNANCE-NAMING-CONVENTION | 2026-03-15 | #234 | UNI-88    | Meta        |

</details>
